import type { ComputerBounds } from "./computer-actions.js";

export type BrowserEngine = "edge" | "chrome";
export type BrowserGroundingSource = "dom" | "vision-fallback";
export type BrowserConfidenceLabel = "high" | "medium" | "low";
export type BrowserGroundingApprovalStatus = "pending" | "approved" | "rejected";
export type BrowserGroundingReviewDecision = "approve" | "reject";

export interface BrowserVisionPolicy {
  readonly milestone: 9;
  readonly preferredAutomation: "browser-dom";
  readonly fallbackAutomation: "screenshot-visual-grounding";
  readonly lowConfidenceThreshold: number;
  readonly requiresApprovalForLowConfidence: true;
  readonly allowedEngines: readonly BrowserEngine[];
  readonly blockedTargets: readonly string[];
}

export const MILESTONE9_BROWSER_VISION_POLICY: BrowserVisionPolicy = {
  milestone: 9,
  preferredAutomation: "browser-dom",
  fallbackAutomation: "screenshot-visual-grounding",
  lowConfidenceThreshold: 0.72,
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

export interface BrowserElementCandidate {
  readonly id: string;
  readonly selector: string;
  readonly role: string | null;
  readonly text: string;
  readonly bounds: ComputerBounds;
  readonly confidence: number;
  readonly confidenceLabel: BrowserConfidenceLabel;
  readonly source: BrowserGroundingSource;
  readonly requiresApproval: boolean;
}

export interface BrowserInspectionResult {
  readonly command: "browser.inspect";
  readonly engine: BrowserEngine;
  readonly inspectedAt: string;
  readonly url: string;
  readonly title: string;
  readonly screenshotPath: string;
  readonly screenshotUrl: string;
  readonly elements: readonly BrowserElementCandidate[];
}

export interface BrowserGroundingResult {
  readonly command: "browser.ground";
  readonly engine: BrowserEngine;
  readonly groundedAt: string;
  readonly query: string;
  readonly screenshotPath: string;
  readonly screenshotUrl: string;
  readonly overlayPath: string;
  readonly overlayUrl: string;
  readonly candidates: readonly BrowserElementCandidate[];
  readonly selectedCandidateId: string | null;
  readonly requiresApproval: boolean;
}

export interface BrowserGroundingApproval {
  readonly id: string;
  readonly candidate: BrowserElementCandidate;
  readonly query: string;
  readonly status: BrowserGroundingApprovalStatus;
  readonly createdAt: string;
  readonly reviewedAt?: string;
  readonly reviewNote?: string;
}

export interface BrowserVisionState {
  readonly policy: BrowserVisionPolicy;
  readonly lastInspection: BrowserInspectionResult | null;
  readonly lastGrounding: BrowserGroundingResult | null;
  readonly approvals: readonly BrowserGroundingApproval[];
}

export interface InspectBrowserRequest {
  readonly engine: BrowserEngine;
}

export interface GroundBrowserElementRequest {
  readonly engine: BrowserEngine;
  readonly query: string;
}

export interface ReviewBrowserGroundingRequest {
  readonly approvalId: string;
  readonly decision: BrowserGroundingReviewDecision;
  readonly reviewNote?: string;
}
