export const OBSERVE_ONLY_ACTIONS = ["window.list", "ui.get_tree"] as const;

export const MILESTONE7_OBSERVE_ONLY_ACTIONS = [
  "window.list",
  "ui.get_tree",
  "screen.capture",
  "ui.highlight"
] as const;

export const MILESTONE8_ACTIVE_ACTIONS = [
  "ui.invoke",
  "ui.set_value",
  "ui.select",
  "ui.toggle",
  "keyboard.type",
  "keyboard.chord",
  "mouse.click"
] as const;

export const BLOCKED_MILESTONE0_ACTIONS = [
  "app.launch",
  "app.focus",
  "window.capture",
  "ui.invoke",
  "ui.set_value",
  "ui.select",
  "mouse.click",
  "mouse.drag",
  "keyboard.type",
  "keyboard.chord",
  "clipboard.write",
  "screen.capture",
  "wait.for_element",
  "assert.element_state",
  "assert.file_exists"
] as const;

export type ObserveOnlyAction = (typeof OBSERVE_ONLY_ACTIONS)[number];
export type Milestone7ObserveOnlyAction = (typeof MILESTONE7_OBSERVE_ONLY_ACTIONS)[number];
export type Milestone8ActiveAction = (typeof MILESTONE8_ACTIVE_ACTIONS)[number];
export type BlockedMilestone0Action = (typeof BLOCKED_MILESTONE0_ACTIONS)[number];

export interface ComputerActionRequest {
  readonly action: ObserveOnlyAction;
  readonly targetWindowHandle?: number;
  readonly maxDepth?: number;
  readonly maxNodes?: number;
}

export interface ComputerActionPolicy<TMilestone extends 0 | 7 = 0 | 7> {
  readonly milestone: TMilestone;
  readonly allowInput: false;
  readonly allowDestructiveAction: false;
  readonly allowElevation: false;
  readonly observeOnly: true;
  readonly allowedActions: readonly string[];
}

export const MILESTONE0_COMPUTER_ACTION_POLICY: ComputerActionPolicy<0> = {
  milestone: 0,
  allowInput: false,
  allowDestructiveAction: false,
  allowElevation: false,
  observeOnly: true,
  allowedActions: OBSERVE_ONLY_ACTIONS
};

export const MILESTONE7_COMPUTER_ACTION_POLICY: ComputerActionPolicy<7> = {
  milestone: 7,
  allowInput: false,
  allowDestructiveAction: false,
  allowElevation: false,
  observeOnly: true,
  allowedActions: MILESTONE7_OBSERVE_ONLY_ACTIONS
};

export interface ComputerBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ComputerWindowSummary {
  readonly handle: number;
  readonly title: string;
  readonly className: string;
  readonly processId: number;
  readonly processName: string | null;
  readonly bounds: ComputerBounds | null;
}

export interface ComputerWindowListResult {
  readonly command: "window.list";
  readonly observeOnly: true;
  readonly capturedAt: string;
  readonly windows: readonly ComputerWindowSummary[];
}

export interface ComputerUiNode {
  readonly nodeId: string;
  readonly depth: number;
  readonly name: string | null;
  readonly automationId: string | null;
  readonly className: string | null;
  readonly controlType: string | null;
  readonly bounds: ComputerBounds | null;
}

export interface GetComputerUiTreeRequest {
  readonly windowHandle: number | null;
  readonly maxDepth?: number;
  readonly maxNodes?: number;
}

export interface ComputerUiTreeResult {
  readonly command: "ui.get_tree";
  readonly observeOnly: true;
  readonly capturedAt: string;
  readonly windowHandle: number | null;
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly nodes: readonly ComputerUiNode[];
}

export interface ComputerScreenshotResult {
  readonly command: "screen.capture" | "ui.highlight";
  readonly observeOnly: true;
  readonly capturedAt: string;
  readonly filePath: string;
  readonly fileUrl: string;
  readonly width: number;
  readonly height: number;
  readonly highlightBounds: ComputerBounds | null;
}

export interface HighlightComputerElementRequest {
  readonly bounds: ComputerBounds;
}

export interface ComputerObserveState {
  readonly policy: ComputerActionPolicy<7>;
  readonly windows: readonly ComputerWindowSummary[];
  readonly lastTree: ComputerUiTreeResult | null;
  readonly lastScreenshot: ComputerScreenshotResult | null;
  readonly lastHighlight: ComputerScreenshotResult | null;
}

export type ComputerActionRisk = "low" | "medium" | "high";
export type ComputerActionStatus = "pending" | "approved" | "running" | "completed" | "failed" | "rejected" | "cancelled" | "blocked";
export type ComputerActionReviewDecision = "approve" | "reject";
export type ComputerVerificationKind = "manual" | "ui-tree-contains" | "screenshot";

export interface ComputerActiveActionPolicy {
  readonly milestone: 8;
  readonly allowInput: true;
  readonly allowDestructiveAction: false;
  readonly allowElevation: false;
  readonly requiresApproval: true;
  readonly allowedActions: readonly Milestone8ActiveAction[];
  readonly blockedActions: readonly string[];
}

export const MILESTONE8_COMPUTER_ACTION_POLICY: ComputerActiveActionPolicy = {
  milestone: 8,
  allowInput: true,
  allowDestructiveAction: false,
  allowElevation: false,
  requiresApproval: true,
  allowedActions: MILESTONE8_ACTIVE_ACTIONS,
  blockedActions: ["app.launch", "app.focus", "clipboard.write", "file.delete", "payment.confirm", "credential.enter", "uac.elevate"]
};

export interface ComputerActiveTarget {
  readonly windowHandle: number | null;
  readonly automationId?: string | null;
  readonly name?: string | null;
  readonly controlType?: string | null;
  readonly bounds?: ComputerBounds | null;
}

export interface ComputerActionVerificationRequest {
  readonly kind: ComputerVerificationKind;
  readonly expectedText?: string;
}

export interface ProposeComputerActionRequest {
  readonly action: Milestone8ActiveAction;
  readonly target: ComputerActiveTarget;
  readonly text?: string;
  readonly chord?: string;
  readonly risk: ComputerActionRisk;
  readonly expectedResult: string;
  readonly verification: ComputerActionVerificationRequest;
}

export interface ReviewComputerActionRequest {
  readonly actionId: string;
  readonly decision: ComputerActionReviewDecision;
  readonly reviewNote?: string;
}

export interface ExecuteComputerActionRequest {
  readonly actionId: string;
}

export interface ComputerActionVerificationResult {
  readonly kind: ComputerVerificationKind;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ComputerActionExecutionResult {
  readonly ok: boolean;
  readonly detail: string;
  readonly command: Milestone8ActiveAction;
  readonly executedAt: string;
}

export interface ComputerActiveAction {
  readonly id: string;
  readonly action: Milestone8ActiveAction;
  readonly target: ComputerActiveTarget;
  readonly text?: string;
  readonly chord?: string;
  readonly risk: ComputerActionRisk;
  readonly expectedResult: string;
  readonly verification: ComputerActionVerificationRequest;
  readonly status: ComputerActionStatus;
  readonly requiresApproval: true;
  readonly createdAt: string;
  readonly approvedAt?: string;
  readonly completedAt?: string;
  readonly reviewNote?: string;
  readonly result?: ComputerActionExecutionResult;
  readonly verificationResult?: ComputerActionVerificationResult;
  readonly error?: string;
}

export interface ComputerControlState extends ComputerObserveState {
  readonly activePolicy: ComputerActiveActionPolicy;
  readonly activeActions: readonly ComputerActiveAction[];
  readonly emergencyStopActive: boolean;
}
