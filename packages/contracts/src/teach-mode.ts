import type { ComputerBounds } from "./computer-actions.js";

export type TeachEventKind =
  | "app.focus"
  | "window.observe"
  | "ui.invoke"
  | "ui.set_value"
  | "keyboard.input"
  | "mouse.click"
  | "clipboard.read"
  | "file.opened"
  | "file.created"
  | "wait.condition"
  | "screenshot.capture"
  | "final.state";

export type TeachSessionStatus = "idle" | "recording" | "stopped" | "workflow-ready";
export type TeachReplayStatus = "draft" | "approved" | "rejected" | "completed";
export type TeachSkillConversionStatus = "pending-approval" | "approved" | "rejected";
export type TeachWorkflowParameterKind = "text" | "file" | "folder" | "number" | "choice";
export type TeachVerificationKind = "manual" | "ui-tree-contains" | "file-exists" | "file-size-greater-than" | "screenshot";

export interface TeachModePolicy {
  readonly milestone: 12;
  readonly semanticSelectorsPreferred: true;
  readonly coordinatesFallbackOnly: true;
  readonly replayRequiresApproval: true;
  readonly skillConversionRequiresApproval: true;
  readonly maxEventsPerSession: number;
  readonly blockedTerms: readonly string[];
}

export const MILESTONE12_TEACH_MODE_POLICY: TeachModePolicy = {
  milestone: 12,
  semanticSelectorsPreferred: true,
  coordinatesFallbackOnly: true,
  replayRequiresApproval: true,
  skillConversionRequiresApproval: true,
  maxEventsPerSession: 80,
  blockedTerms: [
    "password",
    "passcode",
    "otp",
    "mfa",
    "payment",
    "credit card",
    "delete",
    "format",
    "รหัสผ่าน",
    "ชำระเงิน"
  ]
};

export interface TeachSelector {
  readonly appProcess: string | null;
  readonly windowTitle: string | null;
  readonly automationId: string | null;
  readonly name: string | null;
  readonly controlType: string | null;
  readonly bounds: ComputerBounds | null;
  readonly semanticPath: readonly string[];
}

export interface TeachRecordedEvent {
  readonly id: string;
  readonly index: number;
  readonly kind: TeachEventKind;
  readonly timestamp: string;
  readonly selector: TeachSelector;
  readonly text: string | null;
  readonly filePath: string | null;
  readonly screenshotPath: string | null;
  readonly waitCondition: string | null;
  readonly note: string;
  readonly coordinateFallbackUsed: boolean;
}

export interface TeachSession {
  readonly id: string;
  readonly status: TeachSessionStatus;
  readonly name: string;
  readonly startedAt: string | null;
  readonly stoppedAt: string | null;
  readonly events: readonly TeachRecordedEvent[];
}

export interface TeachWorkflowParameter {
  readonly name: string;
  readonly kind: TeachWorkflowParameterKind;
  readonly defaultValue: string;
  readonly sourceEventId: string;
}

export interface TeachWorkflowStep {
  readonly id: string;
  readonly eventId: string;
  readonly action: TeachEventKind;
  readonly selector: TeachSelector;
  readonly valueTemplate: string | null;
  readonly coordinateFallbackAllowed: boolean;
  readonly description: string;
}

export interface TeachVerificationRule {
  readonly id: string;
  readonly kind: TeachVerificationKind;
  readonly expected: string;
  readonly sourceEventId: string | null;
}

export interface TeachWorkflow {
  readonly id: string;
  readonly sessionId: string;
  readonly name: string;
  readonly yaml: string;
  readonly parameters: readonly TeachWorkflowParameter[];
  readonly steps: readonly TeachWorkflowStep[];
  readonly verification: readonly TeachVerificationRule[];
  readonly reliabilityScore: number;
  readonly reliabilityNotes: readonly string[];
  readonly createdAt: string;
}

export interface TeachReplayPlan {
  readonly id: string;
  readonly workflowId: string;
  readonly status: TeachReplayStatus;
  readonly dryRun: true;
  readonly requiresApproval: true;
  readonly stepCount: number;
  readonly blockedReasons: readonly string[];
  readonly createdAt: string;
  readonly reviewedAt: string | null;
}

export interface TeachSkillCandidate {
  readonly id: string;
  readonly workflowId: string;
  readonly name: string;
  readonly summary: string;
  readonly body: string;
  readonly status: TeachSkillConversionStatus;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface TeachModeState {
  readonly policy: TeachModePolicy;
  readonly activeSessionId: string | null;
  readonly sessions: readonly TeachSession[];
  readonly workflows: readonly TeachWorkflow[];
  readonly replayPlans: readonly TeachReplayPlan[];
  readonly skillCandidates: readonly TeachSkillCandidate[];
}

export interface StartTeachSessionRequest {
  readonly name: string;
}

export interface RecordTeachEventRequest {
  readonly kind: TeachEventKind;
  readonly selector: TeachSelector;
  readonly text?: string | null;
  readonly filePath?: string | null;
  readonly screenshotPath?: string | null;
  readonly waitCondition?: string | null;
  readonly note?: string;
}

export interface GenerateTeachWorkflowRequest {
  readonly sessionId: string;
  readonly name?: string;
}

export interface CreateTeachReplayRequest {
  readonly workflowId: string;
}

export interface ReviewTeachReplayRequest {
  readonly replayId: string;
  readonly decision: "approve" | "reject";
  readonly reviewNote?: string;
}

export interface ConvertTeachWorkflowToSkillRequest {
  readonly workflowId: string;
}

export interface ReviewTeachSkillCandidateRequest {
  readonly candidateId: string;
  readonly decision: "approve" | "reject";
  readonly reviewNote?: string;
}
