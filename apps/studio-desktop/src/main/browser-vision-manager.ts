import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type {
  BrowserElementCandidate,
  BrowserEngine,
  BrowserGroundingApproval,
  BrowserGroundingApprovalStatus,
  BrowserGroundingResult,
  BrowserInspectionResult,
  BrowserVisionPolicy,
  BrowserVisionState,
  GroundBrowserElementRequest,
  InspectBrowserRequest,
  ReviewBrowserGroundingRequest
} from "@hermes-local-ai/contracts";

const MAX_RUNNER_OUTPUT_BYTES = 10 * 1024 * 1024;
const RUNNER_TIMEOUT_MS = 30000;
const LOW_CONFIDENCE_THRESHOLD = 0.72;
const MILESTONE9_BROWSER_VISION_POLICY: BrowserVisionPolicy = {
  milestone: 9,
  preferredAutomation: "browser-dom",
  fallbackAutomation: "screenshot-visual-grounding",
  lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
  requiresApprovalForLowConfidence: true,
  allowedEngines: ["edge", "chrome"],
  blockedTargets: [
    "browser.passwords",
    "browser.cookies",
    "browser.history",
    "browser.payment-methods",
    "credential.enter",
    "mfa.confirm"
  ]
};

export class BrowserVisionManager {
  private readonly runnerPath: string;
  private readonly artifactDir: string;
  private lastInspection: BrowserInspectionResult | null = null;
  private lastGrounding: BrowserGroundingResult | null = null;
  private readonly approvals: BrowserGroundingApproval[] = [];
  private nextApprovalId = 1;

  public constructor(private readonly root: string) {
    this.runnerPath = join(root, "services", "browser-control", "browser-vision-runner.mjs");
    this.artifactDir = join(root, "artifacts", "milestone9", "browser-vision");
  }

  public getState(): BrowserVisionState {
    return {
      policy: MILESTONE9_BROWSER_VISION_POLICY,
      lastInspection: this.lastInspection,
      lastGrounding: this.lastGrounding,
      approvals: [...this.approvals]
    };
  }

  public async inspect(request: InspectBrowserRequest): Promise<BrowserVisionState> {
    const engine = normalizeBrowserEngine(request.engine);
    const output = await this.runBrowserRunner(["inspect", "--engine", engine]);
    this.lastInspection = parseInspectionResult(output, engine, this.artifactDir);
    return this.getState();
  }

  public async ground(request: GroundBrowserElementRequest): Promise<BrowserVisionState> {
    const engine = normalizeBrowserEngine(request.engine);
    const query = normalizeQuery(request.query);
    const output = await this.runBrowserRunner(["ground", "--engine", engine, "--query", query]);
    const grounding = parseGroundingResult(output, engine, this.artifactDir);
    this.lastGrounding = grounding;
    const selected = grounding.candidates.find((candidate) => candidate.id === grounding.selectedCandidateId) ?? null;
    if (selected?.requiresApproval) {
      this.approvals.unshift({
        id: `browser-grounding-${this.nextApprovalId}`,
        candidate: selected,
        query,
        status: "pending",
        createdAt: new Date().toISOString()
      });
      this.nextApprovalId += 1;
    }
    return this.getState();
  }

  public review(request: ReviewBrowserGroundingRequest): BrowserVisionState {
    const index = this.approvals.findIndex((approval) => approval.id === request.approvalId);
    if (index < 0) {
      throw new Error("Unknown browser grounding approval.");
    }
    const existing = this.approvals[index];
    if (!existing || existing.status !== "pending") {
      throw new Error("Only pending browser grounding approvals can be reviewed.");
    }
    const status: BrowserGroundingApprovalStatus = request.decision === "approve" ? "approved" : "rejected";
    this.approvals[index] = {
      ...existing,
      status,
      reviewedAt: new Date().toISOString(),
      ...(request.reviewNote === undefined ? {} : { reviewNote: normalizeReviewNote(request.reviewNote) })
    };
    return this.getState();
  }

  private async runBrowserRunner(args: readonly string[]): Promise<unknown> {
    if (!existsSync(this.runnerPath)) {
      throw new Error(`Browser vision runner is missing: ${this.runnerPath}`);
    }

    return new Promise<unknown>((resolvePromise, rejectPromise) => {
      execFile(process.execPath, [this.runnerPath, ...args], {
        cwd: this.root,
        windowsHide: true,
        timeout: RUNNER_TIMEOUT_MS,
        maxBuffer: MAX_RUNNER_OUTPUT_BYTES
      }, (error, stdout, stderr) => {
        if (error) {
          rejectPromise(new Error((stderr || stdout || error.message).trim()));
          return;
        }

        try {
          resolvePromise(JSON.parse(stdout) as unknown);
        } catch (parseError) {
          rejectPromise(parseError instanceof Error ? parseError : new Error(String(parseError)));
        }
      });
    });
  }
}

function parseInspectionResult(value: unknown, engine: BrowserEngine, artifactDir: string): BrowserInspectionResult {
  if (
    !isRecord(value) ||
    value.command !== "browser.inspect" ||
    value.engine !== engine ||
    typeof value.inspectedAt !== "string" ||
    typeof value.url !== "string" ||
    typeof value.title !== "string" ||
    typeof value.screenshotPath !== "string" ||
    !Array.isArray(value.elements)
  ) {
    throw new Error("Invalid browser inspection result.");
  }
  const screenshotPath = normalizeArtifactPath(value.screenshotPath, artifactDir);

  return {
    command: "browser.inspect",
    engine,
    inspectedAt: value.inspectedAt,
    url: value.url,
    title: value.title,
    screenshotPath,
    screenshotUrl: pathToFileURL(screenshotPath).href,
    elements: value.elements.map(parseBrowserCandidate)
  };
}

function parseGroundingResult(value: unknown, engine: BrowserEngine, artifactDir: string): BrowserGroundingResult {
  if (
    !isRecord(value) ||
    value.command !== "browser.ground" ||
    value.engine !== engine ||
    typeof value.groundedAt !== "string" ||
    typeof value.query !== "string" ||
    typeof value.screenshotPath !== "string" ||
    typeof value.overlayPath !== "string" ||
    (value.selectedCandidateId !== null && typeof value.selectedCandidateId !== "string") ||
    typeof value.requiresApproval !== "boolean" ||
    !Array.isArray(value.candidates)
  ) {
    throw new Error("Invalid browser grounding result.");
  }
  const screenshotPath = normalizeArtifactPath(value.screenshotPath, artifactDir);
  const overlayPath = normalizeArtifactPath(value.overlayPath, artifactDir);
  const candidates = value.candidates.map(parseBrowserCandidate);

  return {
    command: "browser.ground",
    engine,
    groundedAt: value.groundedAt,
    query: value.query,
    screenshotPath,
    screenshotUrl: pathToFileURL(screenshotPath).href,
    overlayPath,
    overlayUrl: pathToFileURL(overlayPath).href,
    candidates,
    selectedCandidateId: value.selectedCandidateId,
    requiresApproval: value.requiresApproval
  };
}

function parseBrowserCandidate(value: unknown): BrowserElementCandidate {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.selector !== "string" ||
    (value.role !== null && typeof value.role !== "string") ||
    typeof value.text !== "string" ||
    typeof value.confidence !== "number" ||
    (value.confidenceLabel !== "high" && value.confidenceLabel !== "medium" && value.confidenceLabel !== "low") ||
    (value.source !== "dom" && value.source !== "vision-fallback") ||
    typeof value.requiresApproval !== "boolean" ||
    !isBounds(value.bounds)
  ) {
    throw new Error("Invalid browser grounding candidate.");
  }

  return {
    id: value.id,
    selector: value.selector,
    role: value.role,
    text: value.text,
    bounds: value.bounds,
    confidence: normalizeConfidence(value.confidence),
    confidenceLabel: value.confidenceLabel,
    source: value.source,
    requiresApproval: value.requiresApproval
  };
}

function normalizeArtifactPath(value: string, artifactDir: string): string {
  const filePath = resolve(value);
  if (!isPathInside(artifactDir, filePath) || !existsSync(filePath)) {
    throw new Error("Browser runner returned an invalid artifact path.");
  }
  return filePath;
}

function normalizeBrowserEngine(value: unknown): BrowserEngine {
  if (value !== "edge" && value !== "chrome") {
    throw new Error("Invalid browser engine.");
  }
  return value;
}

function normalizeQuery(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Invalid browser grounding query.");
  }
  const query = value.trim();
  if (!query || query.length > 160) {
    throw new Error("Invalid browser grounding query.");
  }
  if (/password|passcode|mfa|otp|payment|credit card|cookie|history/iu.test(query)) {
    throw new Error("Blocked browser grounding target.");
  }
  return query;
}

function normalizeReviewNote(value: unknown): string {
  if (typeof value !== "string" || value.length > 240) {
    throw new Error("Invalid browser grounding review note.");
  }
  return value;
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Invalid browser grounding confidence.");
  }
  return value;
}

function isBounds(value: unknown): value is BrowserElementCandidate["bounds"] {
  return isRecord(value) &&
    typeof value.left === "number" &&
    typeof value.top === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    Number.isInteger(value.left) &&
    Number.isInteger(value.top) &&
    Number.isInteger(value.width) &&
    Number.isInteger(value.height) &&
    value.width > 0 &&
    value.height > 0;
}

function isPathInside(directoryPath: string, targetPath: string): boolean {
  const normalizedDirectory = resolve(directoryPath);
  const normalizedTarget = resolve(targetPath);
  const relativePath = relative(normalizedDirectory, normalizedTarget);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
