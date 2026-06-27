export type AutomationTriggerKind = "manual" | "schedule" | "file-change";
export type AutomationScheduleRepeat = "once" | "hourly" | "daily";
export type AutomationFileEventKind = "created" | "changed" | "deleted";
export type AutomationActionKind =
  | "notify"
  | "teach-replay-dry-run"
  | "app-adapter-plan-dry-run"
  | "knowledge-refresh-dry-run";
export type AutomationStatus = "draft" | "approved" | "rejected" | "disabled";
export type AutomationReviewDecision = "approve" | "reject";
export type AutomationRunStatus = "dry-run-completed" | "blocked" | "failed";
export type AutomationAuditKind =
  | "automation.created"
  | "automation.approved"
  | "automation.rejected"
  | "automation.disabled"
  | "run.completed"
  | "run.blocked"
  | "run.failed";

export interface AutomationPolicy {
  readonly milestone: 15;
  readonly schedulesEnabled: boolean;
  readonly fileTriggersEnabled: boolean;
  readonly desktopUnlockedRequired: true;
  readonly unattendedOsInputAllowed: false;
  readonly hiddenBackgroundWatchersAllowed: false;
  readonly broadFilesystemTriggersAllowed: false;
  readonly requiresApproval: true;
  readonly dryRunOnly: true;
  readonly maxRetryCount: number;
  readonly maxTimeoutSeconds: number;
  readonly supportedTriggers: readonly AutomationTriggerKind[];
  readonly supportedActions: readonly AutomationActionKind[];
  readonly blockedTerms: readonly string[];
}

export const MILESTONE15_AUTOMATION_POLICY: AutomationPolicy = {
  milestone: 15,
  schedulesEnabled: true,
  fileTriggersEnabled: true,
  desktopUnlockedRequired: true,
  unattendedOsInputAllowed: false,
  hiddenBackgroundWatchersAllowed: false,
  broadFilesystemTriggersAllowed: false,
  requiresApproval: true,
  dryRunOnly: true,
  maxRetryCount: 3,
  maxTimeoutSeconds: 300,
  supportedTriggers: ["manual", "schedule", "file-change"],
  supportedActions: [
    "notify",
    "teach-replay-dry-run",
    "app-adapter-plan-dry-run",
    "knowledge-refresh-dry-run"
  ],
  blockedTerms: [
    "password",
    "passcode",
    "otp",
    "mfa",
    "payment",
    "purchase",
    "credit card",
    "api key",
    "secret",
    "token",
    "credential",
    "delete",
    "remove",
    "format",
    "wipe",
    "shutdown",
    "restart",
    "elevate",
    "administrator"
  ]
};

export interface ManualAutomationTrigger {
  readonly kind: "manual";
}

export interface ScheduledAutomationTrigger {
  readonly kind: "schedule";
  readonly startAt: string;
  readonly timezone: string;
  readonly repeat: AutomationScheduleRepeat;
}

export interface FileChangeAutomationTrigger {
  readonly kind: "file-change";
  readonly path: string;
  readonly event: AutomationFileEventKind;
  readonly recursive: false;
}

export type AutomationTrigger =
  | ManualAutomationTrigger
  | ScheduledAutomationTrigger
  | FileChangeAutomationTrigger;

export interface AutomationAction {
  readonly kind: AutomationActionKind;
  readonly target: string;
  readonly instructions: string;
}

export interface AutomationFailurePolicy {
  readonly retryCount: number;
  readonly disableAfterFailures: number;
  readonly timeoutSeconds: number;
  readonly notifyOnFailure: boolean;
}

export interface AutomationDefinition {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly trigger: AutomationTrigger;
  readonly action: AutomationAction;
  readonly failurePolicy: AutomationFailurePolicy;
  readonly status: AutomationStatus;
  readonly requiresDesktopUnlocked: true;
  readonly requiresApproval: true;
  readonly dryRunOnly: true;
  readonly blockedReasons: readonly string[];
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly failureCount: number;
  readonly lastRunId: string | null;
}

export interface AutomationRun {
  readonly id: string;
  readonly automationId: string;
  readonly triggerKind: AutomationTriggerKind;
  readonly status: AutomationRunStatus;
  readonly dryRunOnly: true;
  readonly desktopUnlocked: boolean;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly summary: string;
  readonly failureReason: string | null;
  readonly attempt: number;
  readonly nextRetryAt: string | null;
}

export interface AutomationAuditEvent {
  readonly id: number;
  readonly timestamp: string;
  readonly kind: AutomationAuditKind;
  readonly automationId: string | null;
  readonly runId: string | null;
  readonly actor: "studio" | "user";
  readonly summary: string;
  readonly detail: string;
}

export interface CreateAutomationRequest {
  readonly name: string;
  readonly purpose: string;
  readonly trigger: AutomationTrigger;
  readonly action: AutomationAction;
  readonly failurePolicy: AutomationFailurePolicy;
}

export interface ReviewAutomationRequest {
  readonly automationId: string;
  readonly decision: AutomationReviewDecision;
  readonly reviewNote?: string;
}

export interface SimulateAutomationRequest {
  readonly automationId: string;
  readonly triggerKind: AutomationTriggerKind;
  readonly desktopUnlocked: boolean;
  readonly forceFailure?: boolean;
}

export interface DisableAutomationRequest {
  readonly automationId: string;
  readonly reason?: string;
}

export interface AutomationState {
  readonly policy: AutomationPolicy;
  readonly automations: readonly AutomationDefinition[];
  readonly runs: readonly AutomationRun[];
  readonly audit: readonly AutomationAuditEvent[];
}
