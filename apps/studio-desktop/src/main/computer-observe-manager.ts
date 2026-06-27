import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type {
  ComputerActionExecutionResult,
  ComputerActiveActionPolicy,
  ComputerActionRisk,
  ComputerActionStatus,
  ComputerActionVerificationRequest,
  ComputerActionVerificationResult,
  ComputerActiveAction,
  ComputerActiveTarget,
  ComputerBounds,
  ComputerControlState,
  ComputerScreenshotResult,
  ComputerUiNode,
  ComputerUiTreeResult,
  ComputerWindowListResult,
  ComputerWindowSummary,
  ExecuteComputerActionRequest,
  GetComputerUiTreeRequest,
  HighlightComputerElementRequest,
  Milestone8ActiveAction,
  ProposeComputerActionRequest,
  ReviewComputerActionRequest
} from "@hermes-local-ai/contracts";

const MAX_BROKER_OUTPUT_BYTES = 10 * 1024 * 1024;
const BROKER_TIMEOUT_MS = 15000;
const MILESTONE8_ACTIVE_ACTIONS: readonly Milestone8ActiveAction[] = [
  "ui.invoke",
  "ui.set_value",
  "ui.select",
  "ui.toggle",
  "keyboard.type",
  "keyboard.chord",
  "mouse.click"
];
const MILESTONE8_COMPUTER_ACTION_POLICY: ComputerActiveActionPolicy = {
  milestone: 8,
  allowInput: true,
  allowDestructiveAction: false,
  allowElevation: false,
  requiresApproval: true,
  allowedActions: MILESTONE8_ACTIVE_ACTIONS,
  blockedActions: ["app.launch", "app.focus", "clipboard.write", "file.delete", "payment.confirm", "credential.enter", "uac.elevate"]
};
const SAFE_KEYBOARD_CHORDS = new Set(["TAB", "ENTER", "ESC", "CTRL+A", "CTRL+C", "CTRL+V"]);
const SECRET_TEXT_PATTERN = /\b(password|passcode|otp|mfa|api[-_\s]?key|secret|token|bearer|credential)\b|sk-[a-z0-9_-]+/iu;

export class ComputerObserveManager {
  private readonly brokerExe: string;
  private readonly captureDir: string;
  private lastTree: ComputerUiTreeResult | null = null;
  private lastScreenshot: ComputerScreenshotResult | null = null;
  private lastHighlight: ComputerScreenshotResult | null = null;
  private readonly activeActions: ComputerActiveAction[] = [];
  private activeNextId = 1;
  private emergencyStopActive = false;

  public constructor(private readonly root: string) {
    this.brokerExe = join(root, "services", "windows-control-broker", "bin", "Release", "net8.0-windows", "HermesLocalAI.WindowsBroker.exe");
    this.captureDir = join(root, "artifacts", "milestone8", "captures");
  }

  public async getState(): Promise<ComputerControlState> {
    return {
      policy: {
        milestone: 7,
        allowInput: false,
        allowDestructiveAction: false,
        allowElevation: false,
        observeOnly: true,
        allowedActions: ["window.list", "ui.get_tree", "screen.capture", "ui.highlight"]
      },
      activePolicy: MILESTONE8_COMPUTER_ACTION_POLICY,
      windows: (await this.listWindows()).windows,
      lastTree: this.lastTree,
      lastScreenshot: this.lastScreenshot,
      lastHighlight: this.lastHighlight,
      activeActions: [...this.activeActions],
      emergencyStopActive: this.emergencyStopActive
    };
  }

  public async listWindows(): Promise<ComputerWindowListResult> {
    const output = await this.runBroker(["window.list"]);
    return parseWindowListResult(output);
  }

  public async getUiTree(request: GetComputerUiTreeRequest): Promise<ComputerUiTreeResult> {
    const normalized = normalizeUiTreeRequest(request);
    const args = [
      "ui.get_tree",
      "--max-depth",
      String(normalized.maxDepth),
      "--max-nodes",
      String(normalized.maxNodes)
    ];
    if (normalized.windowHandle !== null) {
      args.push("--window-handle", String(normalized.windowHandle));
    }

    const output = await this.runBroker(args);
    const tree = parseUiTreeResult(output);
    this.lastTree = tree;
    return tree;
  }

  public async captureScreen(): Promise<ComputerScreenshotResult> {
    const outputPath = await this.nextCapturePath("screen");
    const output = await this.runBroker(["screen.capture", "--output", outputPath]);
    const screenshot = this.parseScreenshotResult(output, "screen.capture");
    this.lastScreenshot = screenshot;
    return screenshot;
  }

  public async highlightElement(request: HighlightComputerElementRequest): Promise<ComputerScreenshotResult> {
    const bounds = normalizeBounds(request.bounds);
    const outputPath = await this.nextCapturePath("highlight");
    const output = await this.runBroker([
      "ui.highlight",
      "--bounds",
      String(bounds.left),
      String(bounds.top),
      String(bounds.width),
      String(bounds.height),
      "--output",
      outputPath
    ]);
    const screenshot = this.parseScreenshotResult(output, "ui.highlight");
    this.lastHighlight = screenshot;
    return screenshot;
  }

  public async proposeAction(request: ProposeComputerActionRequest): Promise<ComputerActiveAction> {
    if (this.emergencyStopActive) {
      throw new Error("Emergency stop is active. Reset it before proposing active actions.");
    }

    const action = normalizeActiveAction(request.action);
    const risk = normalizeRisk(request.risk);
    if (risk === "high") {
      throw new Error("High-risk active computer actions are blocked in Milestone 8.");
    }

    const target = normalizeActiveTarget(request.target);
    validateActionTarget(action, target);
    const text = normalizeOptionalActionText(action, request.text);
    const chord = normalizeOptionalChord(action, request.chord);
    const expectedResult = normalizeRequiredText(request.expectedResult, "expected result", 240);
    const verification = normalizeVerificationRequest(request.verification);

    const now = new Date().toISOString();
    const nextAction: ComputerActiveAction = {
      id: `computer-action-${this.activeNextId}`,
      action,
      target,
      risk,
      expectedResult,
      verification,
      status: "pending",
      requiresApproval: true,
      createdAt: now,
      ...(text === undefined ? {} : { text }),
      ...(chord === undefined ? {} : { chord })
    };
    this.activeNextId += 1;
    this.activeActions.unshift(nextAction);
    return nextAction;
  }

  public async reviewAction(request: ReviewComputerActionRequest): Promise<ComputerControlState> {
    const index = this.findActionIndex(request.actionId);
    const existing = this.activeActions[index];
    if (!existing || existing.status !== "pending") {
      throw new Error("Only pending computer actions can be reviewed.");
    }
    const reviewNote = request.reviewNote === undefined ? undefined : normalizeOptionalText(request.reviewNote, "review note", 240);
    const status: ComputerActionStatus = request.decision === "approve" ? "approved" : "rejected";
    this.activeActions[index] = {
      ...existing,
      status,
      ...(request.decision === "approve" ? { approvedAt: new Date().toISOString() } : {}),
      ...(reviewNote === undefined ? {} : { reviewNote })
    };
    return this.getState();
  }

  public async executeAction(request: ExecuteComputerActionRequest): Promise<ComputerControlState> {
    if (this.emergencyStopActive) {
      throw new Error("Emergency stop is active. Reset it before executing active actions.");
    }

    const index = this.findActionIndex(request.actionId);
    const action = this.activeActions[index];
    if (!action || action.status !== "approved") {
      throw new Error("Only approved computer actions can execute.");
    }

    this.activeActions[index] = { ...action, status: "running" };
    try {
      const token = randomBytes(24).toString("base64url");
      const output = await this.runBroker(buildActiveBrokerArgs(action, token), {
        HERMES_BROKER_APPROVAL_TOKEN: token
      });
      const executionResult = parseExecutionResult(output, action.action);
      const verificationResult = await this.verifyAction(action, executionResult);
      const completedStatus: ComputerActionStatus = executionResult.ok && verificationResult.passed ? "completed" : "failed";
      this.activeActions[index] = {
        ...this.activeActions[index],
        status: completedStatus,
        completedAt: new Date().toISOString(),
        result: executionResult,
        verificationResult
      } as ComputerActiveAction;
    } catch (executeError) {
      this.activeActions[index] = {
        ...this.activeActions[index],
        status: "failed",
        completedAt: new Date().toISOString(),
        error: executeError instanceof Error ? executeError.message : String(executeError)
      } as ComputerActiveAction;
    }

    return this.getState();
  }

  public async emergencyStop(): Promise<ComputerControlState> {
    this.emergencyStopActive = true;
    for (const [index, action] of this.activeActions.entries()) {
      if (action.status === "pending" || action.status === "approved" || action.status === "running") {
        this.activeActions[index] = {
          ...action,
          status: "cancelled",
          completedAt: new Date().toISOString(),
          error: "Cancelled by emergency stop."
        };
      }
    }
    try {
      await this.runBroker(["emergency.stop"]);
    } catch {
      // The local queue is the authoritative stop gate for Studio-owned actions.
    }

    return this.getState();
  }

  public async resetEmergencyStop(): Promise<ComputerControlState> {
    this.emergencyStopActive = false;
    return this.getState();
  }

  private async verifyAction(
    action: ComputerActiveAction,
    executionResult: ComputerActionExecutionResult
  ): Promise<ComputerActionVerificationResult> {
    if (action.verification.kind === "manual") {
      return {
        kind: "manual",
        passed: executionResult.ok,
        detail: executionResult.ok ? `Manual verification requested: ${action.expectedResult}` : executionResult.detail
      };
    }

    if (action.verification.kind === "screenshot") {
      const screenshot = await this.captureScreen();
      return {
        kind: "screenshot",
        passed: existsSync(screenshot.filePath),
        detail: `Captured verification screenshot ${screenshot.width} x ${screenshot.height}.`
      };
    }

    const expectedText = normalizeRequiredText(action.verification.expectedText ?? "", "verification text", 160).toLocaleLowerCase();
    const tree = await this.getUiTree({
      windowHandle: action.target.windowHandle,
      maxDepth: 4,
      maxNodes: 160
    });
    const searchableText = tree.nodes
      .map((node) => [node.name, node.automationId, node.className, node.controlType].filter(Boolean).join(" "))
      .join("\n")
      .toLocaleLowerCase();
    const passed = searchableText.includes(expectedText);
    return {
      kind: "ui-tree-contains",
      passed,
      detail: passed ? `UI tree contains "${expectedText}".` : `UI tree did not contain "${expectedText}".`
    };
  }

  private findActionIndex(actionId: string): number {
    if (!actionId) {
      throw new Error("Invalid computer action id.");
    }
    const index = this.activeActions.findIndex((action) => action.id === actionId);
    if (index < 0) {
      throw new Error(`Unknown computer action id: ${actionId}`);
    }
    return index;
  }

  private async runBroker(args: readonly string[], env?: Record<string, string>): Promise<unknown> {
    if (!existsSync(this.brokerExe)) {
      throw new Error(`Windows broker executable is missing: ${this.brokerExe}`);
    }

    return new Promise<unknown>((resolvePromise, rejectPromise) => {
      execFile(this.brokerExe, [...args], {
        windowsHide: true,
        timeout: BROKER_TIMEOUT_MS,
        maxBuffer: MAX_BROKER_OUTPUT_BYTES,
        env: env === undefined ? process.env : { ...process.env, ...env }
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

  private async nextCapturePath(prefix: "screen" | "highlight"): Promise<string> {
    await mkdir(this.captureDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
    return join(this.captureDir, `${prefix}-${stamp}.png`);
  }

  private parseScreenshotResult(value: unknown, expectedCommand: ComputerScreenshotResult["command"]): ComputerScreenshotResult {
    if (!isRecord(value) || value.command !== expectedCommand || value.observeOnly !== true || typeof value.capturedAt !== "string") {
      throw new Error("Invalid screenshot response.");
    }
    if (typeof value.filePath !== "string" || typeof value.width !== "number" || typeof value.height !== "number") {
      throw new Error("Invalid screenshot artifact metadata.");
    }
    const filePath = resolve(value.filePath);
    if (!isPathInside(this.captureDir, filePath)) {
      throw new Error("Broker returned a screenshot outside the capture directory.");
    }

    return {
      command: expectedCommand,
      observeOnly: true,
      capturedAt: value.capturedAt,
      filePath,
      fileUrl: pathToFileURL(filePath).href,
      width: normalizePositiveInteger(value.width, "screenshot width", 1, 100000),
      height: normalizePositiveInteger(value.height, "screenshot height", 1, 100000),
      highlightBounds: parseNullableBounds(value.highlightBounds)
    };
  }
}

function parseWindowListResult(value: unknown): ComputerWindowListResult {
  if (!isRecord(value) || value.command !== "window.list" || value.observeOnly !== true || typeof value.capturedAt !== "string") {
    throw new Error("Invalid window list response.");
  }
  if (!Array.isArray(value.windows)) {
    throw new Error("Invalid window list payload.");
  }

  return {
    command: "window.list",
    observeOnly: true,
    capturedAt: value.capturedAt,
    windows: value.windows.map(parseWindowSummary)
  };
}

function parseWindowSummary(value: unknown): ComputerWindowSummary {
  if (
    !isRecord(value) ||
    typeof value.handle !== "number" ||
    typeof value.title !== "string" ||
    typeof value.className !== "string" ||
    typeof value.processId !== "number" ||
    (value.processName !== null && typeof value.processName !== "string")
  ) {
    throw new Error("Invalid window summary.");
  }

  return {
    handle: normalizeNonNegativeInteger(value.handle, "window handle", 0, Number.MAX_SAFE_INTEGER),
    title: value.title,
    className: value.className,
    processId: normalizeNonNegativeInteger(value.processId, "process id", 0, Number.MAX_SAFE_INTEGER),
    processName: value.processName,
    bounds: parseNullableBounds(value.bounds)
  };
}

function parseUiTreeResult(value: unknown): ComputerUiTreeResult {
  if (
    !isRecord(value) ||
    value.command !== "ui.get_tree" ||
    value.observeOnly !== true ||
    typeof value.capturedAt !== "string" ||
    (value.windowHandle !== null && typeof value.windowHandle !== "number") ||
    typeof value.maxDepth !== "number" ||
    typeof value.maxNodes !== "number" ||
    !Array.isArray(value.nodes)
  ) {
    throw new Error("Invalid UI tree response.");
  }

  return {
    command: "ui.get_tree",
    observeOnly: true,
    capturedAt: value.capturedAt,
    windowHandle: value.windowHandle === null ? null : normalizeNonNegativeInteger(value.windowHandle, "window handle", 0, Number.MAX_SAFE_INTEGER),
    maxDepth: normalizePositiveInteger(value.maxDepth, "max depth", 0, 8),
    maxNodes: normalizePositiveInteger(value.maxNodes, "max nodes", 1, 250),
    nodes: value.nodes.map(parseUiNode)
  };
}

function parseUiNode(value: unknown): ComputerUiNode {
  if (
    !isRecord(value) ||
    typeof value.nodeId !== "string" ||
    typeof value.depth !== "number" ||
    (value.name !== null && typeof value.name !== "string") ||
    (value.automationId !== null && typeof value.automationId !== "string") ||
    (value.className !== null && typeof value.className !== "string") ||
    (value.controlType !== null && typeof value.controlType !== "string")
  ) {
    throw new Error("Invalid UI node.");
  }

  return {
    nodeId: value.nodeId,
    depth: normalizePositiveInteger(value.depth, "node depth", 0, 8),
    name: value.name,
    automationId: value.automationId,
    className: value.className,
    controlType: value.controlType,
    bounds: parseNullableBounds(value.bounds)
  };
}

function parseExecutionResult(value: unknown, expectedCommand: Milestone8ActiveAction): ComputerActionExecutionResult {
  if (
    !isRecord(value) ||
    value.command !== expectedCommand ||
    typeof value.ok !== "boolean" ||
    typeof value.detail !== "string" ||
    typeof value.executedAt !== "string"
  ) {
    throw new Error("Invalid active command execution response.");
  }

  return {
    ok: value.ok,
    detail: value.detail,
    command: expectedCommand,
    executedAt: value.executedAt
  };
}

function normalizeUiTreeRequest(request: GetComputerUiTreeRequest): Required<GetComputerUiTreeRequest> {
  return {
    windowHandle: request.windowHandle === null ? null : normalizeNonNegativeInteger(request.windowHandle, "window handle", 0, Number.MAX_SAFE_INTEGER),
    maxDepth: normalizePositiveInteger(request.maxDepth ?? 3, "max depth", 0, 8),
    maxNodes: normalizePositiveInteger(request.maxNodes ?? 80, "max nodes", 1, 250)
  };
}

function normalizeActiveAction(value: unknown): Milestone8ActiveAction {
  if (typeof value !== "string" || !MILESTONE8_ACTIVE_ACTIONS.includes(value as Milestone8ActiveAction)) {
    throw new Error("Invalid active computer action.");
  }
  return value as Milestone8ActiveAction;
}

function normalizeRisk(value: unknown): ComputerActionRisk {
  if (value !== "low" && value !== "medium" && value !== "high") {
    throw new Error("Invalid computer action risk.");
  }
  return value;
}

function normalizeActiveTarget(value: unknown): ComputerActiveTarget {
  if (!isRecord(value) || (value.windowHandle !== null && typeof value.windowHandle !== "number")) {
    throw new Error("Invalid active action target.");
  }

  const windowHandle = value.windowHandle === null ? null : normalizeNonNegativeInteger(value.windowHandle, "window handle", 0, Number.MAX_SAFE_INTEGER);
  const automationId = value.automationId === undefined || value.automationId === null ? null : normalizeOptionalText(value.automationId, "automation id", 160);
  const name = value.name === undefined || value.name === null ? null : normalizeOptionalText(value.name, "target name", 200);
  const controlType = value.controlType === undefined || value.controlType === null ? null : normalizeOptionalText(value.controlType, "control type", 120);
  const bounds = value.bounds === undefined ? null : parseNullableBounds(value.bounds);

  return {
    windowHandle,
    ...(automationId === null ? {} : { automationId }),
    ...(name === null ? {} : { name }),
    ...(controlType === null ? {} : { controlType }),
    ...(bounds === null ? {} : { bounds })
  };
}

function validateActionTarget(action: Milestone8ActiveAction, target: ComputerActiveTarget): void {
  if (action.startsWith("ui.") && !target.automationId && !target.name) {
    throw new Error(`${action} requires a UI tree target with an automation id or name.`);
  }
  if (action === "mouse.click" && !target.bounds) {
    throw new Error("mouse.click requires positive target bounds.");
  }
}

function normalizeOptionalActionText(action: Milestone8ActiveAction, value: unknown): string | undefined {
  if (action !== "ui.set_value" && action !== "keyboard.type") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${action} requires text.`);
  }
  const text = normalizeRequiredText(value, "action text", 400);
  if (SECRET_TEXT_PATTERN.test(text)) {
    throw new Error("Secret-like text is blocked for active computer input.");
  }
  return text;
}

function normalizeOptionalChord(action: Milestone8ActiveAction, value: unknown): string | undefined {
  if (action !== "keyboard.chord") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("keyboard.chord requires a chord.");
  }
  const chord = value.trim().toUpperCase();
  if (!SAFE_KEYBOARD_CHORDS.has(chord)) {
    throw new Error("Unsupported keyboard chord.");
  }
  return chord;
}

function normalizeVerificationRequest(value: ComputerActionVerificationRequest): ComputerActionVerificationRequest {
  if (!isRecord(value) || (value.kind !== "manual" && value.kind !== "ui-tree-contains" && value.kind !== "screenshot")) {
    throw new Error("Invalid action verification request.");
  }
  if (value.kind !== "ui-tree-contains") {
    return { kind: value.kind };
  }
  if (typeof value.expectedText !== "string") {
    throw new Error("ui-tree-contains verification requires expected text.");
  }
  return {
    kind: "ui-tree-contains",
    expectedText: normalizeRequiredText(value.expectedText, "verification text", 160)
  };
}

function buildActiveBrokerArgs(action: ComputerActiveAction, token: string): string[] {
  const args = [action.action, "--approval-token", token];
  if (action.target.windowHandle !== null) {
    args.push("--window-handle", String(action.target.windowHandle));
  }
  if (action.target.automationId) {
    args.push("--automation-id", action.target.automationId);
  } else if (action.target.name) {
    args.push("--name", action.target.name);
  }

  if (action.action === "ui.set_value" || action.action === "keyboard.type") {
    if (!action.text) {
      throw new Error(`${action.action} has no approved text.`);
    }
    args.push("--text", action.text);
  }
  if (action.action === "keyboard.chord") {
    if (!action.chord) {
      throw new Error("keyboard.chord has no approved chord.");
    }
    args.push("--chord", action.chord);
  }
  if (action.action === "mouse.click") {
    if (!action.target.bounds) {
      throw new Error("mouse.click has no approved bounds.");
    }
    args.push(
      "--bounds",
      String(action.target.bounds.left),
      String(action.target.bounds.top),
      String(action.target.bounds.width),
      String(action.target.bounds.height)
    );
  }

  return args;
}

function normalizeRequiredText(value: string, label: string, maxLength: number): string {
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new Error(`Invalid ${label}.`);
  }
  return text;
}

function normalizeOptionalText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${label}.`);
  }
  if (value.length > maxLength) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function parseNullableBounds(value: unknown): ComputerBounds | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error("Invalid bounds.");
  }
  if (
    typeof value.left !== "number" ||
    typeof value.top !== "number" ||
    typeof value.width !== "number" ||
    typeof value.height !== "number"
  ) {
    throw new Error("Invalid bounds.");
  }
  if (!Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width <= 0 || value.height <= 0) {
    return null;
  }

  return normalizeBounds(value);
}

function normalizeBounds(value: unknown): ComputerBounds {
  if (!isRecord(value)) {
    throw new Error("Invalid bounds.");
  }
  if (
    typeof value.left !== "number" ||
    typeof value.top !== "number" ||
    typeof value.width !== "number" ||
    typeof value.height !== "number"
  ) {
    throw new Error("Invalid bounds.");
  }

  return {
    left: normalizeInteger(value.left, "bounds left", -100000, 100000),
    top: normalizeInteger(value.top, "bounds top", -100000, 100000),
    width: normalizePositiveInteger(value.width, "bounds width", 1, 100000),
    height: normalizePositiveInteger(value.height, "bounds height", 1, 100000)
  };
}

function normalizeNonNegativeInteger(value: number, label: string, min: number, max: number): number {
  return normalizeInteger(value, label, min, max);
}

function normalizePositiveInteger(value: number, label: string, min: number, max: number): number {
  return normalizeInteger(value, label, min, max);
}

function normalizeInteger(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${label}.`);
  }

  return value;
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
