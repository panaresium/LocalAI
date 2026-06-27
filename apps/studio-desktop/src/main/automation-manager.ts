import { win32 } from "node:path";

import type {
  AutomationAction,
  AutomationActionKind,
  AutomationAuditEvent,
  AutomationAuditKind,
  AutomationDefinition,
  AutomationFailurePolicy,
  AutomationFileEventKind,
  AutomationPolicy,
  AutomationReviewDecision,
  AutomationRun,
  AutomationRunStatus,
  AutomationScheduleRepeat,
  AutomationState,
  AutomationTrigger,
  AutomationTriggerKind,
  CreateAutomationRequest,
  DisableAutomationRequest,
  ReviewAutomationRequest,
  SimulateAutomationRequest
} from "@hermes-local-ai/contracts";

const MILESTONE15_AUTOMATION_POLICY: AutomationPolicy = {
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

const DESTRUCTIVE_PATTERN = /\b(delete|remove|erase|format|wipe|shutdown|restart|kill|terminate|drop\s+table|rm\s+-rf|del\s+\/[sq]|rd\s+\/s)\b/iu;
const SENSITIVE_PATTERN = /\b(password|passcode|otp|mfa|payment|purchase|credit\s+card|api\s+key|secret|token|credential|elevate|administrator)\b/iu;

export class AutomationManager {
  private readonly automations: AutomationDefinition[] = [];
  private readonly runs: AutomationRun[] = [];
  private readonly audit: AutomationAuditEvent[] = [];
  private nextAutomationId = 1;
  private nextRunId = 1;
  private nextAuditId = 1;

  public constructor(private readonly root: string) {
    void this.root;
  }

  public getState(): AutomationState {
    return {
      policy: MILESTONE15_AUTOMATION_POLICY,
      automations: [...this.automations],
      runs: [...this.runs],
      audit: [...this.audit]
    };
  }

  public createAutomation(request: CreateAutomationRequest): AutomationState {
    const name = normalizeText(request.name, "automation name", 80);
    const purpose = normalizeText(request.purpose, "automation purpose", 240);
    const trigger = normalizeTrigger(request.trigger);
    const action = normalizeAction(request.action);
    const failurePolicy = normalizeFailurePolicy(request.failurePolicy);
    rejectUnsafeText([name, purpose, action.target, action.instructions]);

    const now = new Date().toISOString();
    const automation: AutomationDefinition = {
      id: `automation-${this.nextAutomationId}`,
      name,
      purpose,
      trigger,
      action,
      failurePolicy,
      status: "draft",
      requiresDesktopUnlocked: true,
      requiresApproval: true,
      dryRunOnly: true,
      blockedReasons: buildBlockedReasons(trigger, action),
      createdAt: now,
      reviewedAt: null,
      reviewNote: null,
      failureCount: 0,
      lastRunId: null
    };
    this.nextAutomationId += 1;
    this.automations.unshift(automation);
    this.automations.splice(24);
    this.recordAudit(
      "automation.created",
      automation.id,
      null,
      "user",
      `Created draft automation ${automation.name}.`,
      automation.purpose
    );
    return this.getState();
  }

  public reviewAutomation(request: ReviewAutomationRequest): AutomationState {
    const automation = this.findAutomation(request.automationId);
    if (automation.status !== "draft") {
      throw new Error("Only draft automations can be reviewed.");
    }
    if (request.decision === "approve" && automation.blockedReasons.length > 0) {
      throw new Error("Automation with blocked reasons cannot be approved.");
    }

    const reviewedAt = new Date().toISOString();
    const reviewNote = request.reviewNote === undefined ? null : normalizeOptionalText(request.reviewNote, "automation review note", 240);
    const nextStatus = request.decision === "approve" ? "approved" : "rejected";
    this.replaceAutomation({
      ...automation,
      status: nextStatus,
      reviewedAt,
      reviewNote
    });
    this.recordAudit(
      request.decision === "approve" ? "automation.approved" : "automation.rejected",
      automation.id,
      null,
      "user",
      `${capitalizeDecision(request.decision)} automation ${automation.name}.`,
      reviewNote ?? "No review note."
    );
    return this.getState();
  }

  public simulateAutomation(request: SimulateAutomationRequest): AutomationState {
    const automation = this.findAutomation(request.automationId);
    if (automation.status !== "approved") {
      throw new Error("Only approved automations can be simulated.");
    }

    const startedAt = new Date();
    const nextRunId = `automation-run-${this.nextRunId}`;
    this.nextRunId += 1;

    const blockedReason = getSimulationBlockReason(automation, request);
    const forcedFailure = request.forceFailure === true;
    let runStatus: AutomationRunStatus = "dry-run-completed";
    let failureReason: string | null = null;
    let summary = `Dry-run completed for ${automation.action.kind} on ${automation.action.target}.`;
    let nextFailureCount = 0;
    let nextRetryAt: string | null = null;

    if (blockedReason !== null) {
      runStatus = "blocked";
      failureReason = blockedReason;
      summary = `Automation blocked before execution: ${blockedReason}`;
      nextFailureCount = automation.failureCount;
    } else if (forcedFailure) {
      runStatus = "failed";
      failureReason = "Forced dry-run failure for failure-policy validation.";
      summary = "Dry-run failed before any unattended OS action was attempted.";
      nextFailureCount = automation.failureCount + 1;
      if (nextFailureCount <= automation.failurePolicy.retryCount) {
        nextRetryAt = new Date(startedAt.getTime() + 60_000).toISOString();
      }
    }

    const finishedAt = new Date().toISOString();
    const run: AutomationRun = {
      id: nextRunId,
      automationId: automation.id,
      triggerKind: request.triggerKind,
      status: runStatus,
      dryRunOnly: true,
      desktopUnlocked: request.desktopUnlocked,
      startedAt: startedAt.toISOString(),
      finishedAt,
      summary,
      failureReason,
      attempt: nextFailureCount === 0 ? 1 : nextFailureCount,
      nextRetryAt
    };
    this.runs.unshift(run);
    this.runs.splice(32);

    const shouldDisable = runStatus === "failed" && nextFailureCount >= automation.failurePolicy.disableAfterFailures;
    this.replaceAutomation({
      ...automation,
      status: shouldDisable ? "disabled" : automation.status,
      failureCount: runStatus === "dry-run-completed" ? 0 : nextFailureCount,
      lastRunId: run.id
    });

    this.recordAudit(
      auditKindForRun(runStatus),
      automation.id,
      run.id,
      "studio",
      run.summary,
      run.failureReason ?? "No failure."
    );
    if (shouldDisable) {
      this.recordAudit(
        "automation.disabled",
        automation.id,
        run.id,
        "studio",
        `Disabled ${automation.name} after ${nextFailureCount} failed dry-runs.`,
        "Failure policy threshold reached."
      );
    }
    return this.getState();
  }

  public disableAutomation(request: DisableAutomationRequest): AutomationState {
    const automation = this.findAutomation(request.automationId);
    if (automation.status === "disabled") {
      return this.getState();
    }
    const reason = request.reason === undefined ? "Disabled by user." : normalizeOptionalText(request.reason, "disable reason", 240);
    this.replaceAutomation({
      ...automation,
      status: "disabled",
      reviewedAt: new Date().toISOString(),
      reviewNote: reason
    });
    this.recordAudit(
      "automation.disabled",
      automation.id,
      null,
      "user",
      `Disabled automation ${automation.name}.`,
      reason
    );
    return this.getState();
  }

  private findAutomation(automationId: string): AutomationDefinition {
    const automation = this.automations.find((candidate) => candidate.id === automationId);
    if (!automation) {
      throw new Error("Unknown automation.");
    }
    return automation;
  }

  private replaceAutomation(nextAutomation: AutomationDefinition): void {
    const index = this.automations.findIndex((candidate) => candidate.id === nextAutomation.id);
    if (index < 0) {
      throw new Error("Unknown automation.");
    }
    this.automations[index] = nextAutomation;
  }

  private recordAudit(
    kind: AutomationAuditKind,
    automationId: string | null,
    runId: string | null,
    actor: AutomationAuditEvent["actor"],
    summary: string,
    detail: string
  ): void {
    this.audit.unshift({
      id: this.nextAuditId,
      timestamp: new Date().toISOString(),
      kind,
      automationId,
      runId,
      actor,
      summary,
      detail
    });
    this.nextAuditId += 1;
    this.audit.splice(48);
  }
}

function normalizeTrigger(trigger: AutomationTrigger): AutomationTrigger {
  if (trigger.kind === "manual") {
    return { kind: "manual" };
  }

  if (trigger.kind === "schedule") {
    if (!isScheduleRepeat(trigger.repeat)) {
      throw new Error("Invalid automation schedule repeat.");
    }
    const startAt = normalizeText(trigger.startAt, "automation schedule start", 80);
    const timestamp = Date.parse(startAt);
    if (!Number.isFinite(timestamp)) {
      throw new Error("Invalid automation schedule start.");
    }
    return {
      kind: "schedule",
      startAt: new Date(timestamp).toISOString(),
      timezone: normalizeText(trigger.timezone, "automation timezone", 80),
      repeat: trigger.repeat
    };
  }

  if (trigger.kind === "file-change") {
    if (!isFileEventKind(trigger.event)) {
      throw new Error("Invalid automation file event.");
    }
    if (trigger.recursive !== false) {
      throw new Error("Recursive file triggers are not allowed in Milestone 15.");
    }
    const path = normalizeText(trigger.path, "automation file trigger path", 260);
    validateExactPath(path);
    return {
      kind: "file-change",
      path: win32.normalize(path),
      event: trigger.event,
      recursive: false
    };
  }

  throw new Error("Invalid automation trigger.");
}

function normalizeAction(action: AutomationAction): AutomationAction {
  if (!isAutomationActionKind(action.kind)) {
    throw new Error("Invalid automation action.");
  }
  return {
    kind: action.kind,
    target: normalizeText(action.target, "automation action target", 220),
    instructions: normalizeText(action.instructions, "automation instructions", 320)
  };
}

function normalizeFailurePolicy(policy: AutomationFailurePolicy): AutomationFailurePolicy {
  if (!Number.isInteger(policy.retryCount) || policy.retryCount < 0 || policy.retryCount > MILESTONE15_AUTOMATION_POLICY.maxRetryCount) {
    throw new Error("Invalid automation retry count.");
  }
  if (!Number.isInteger(policy.disableAfterFailures) || policy.disableAfterFailures < 1 || policy.disableAfterFailures > 5) {
    throw new Error("Invalid automation disable threshold.");
  }
  if (!Number.isInteger(policy.timeoutSeconds) || policy.timeoutSeconds < 5 || policy.timeoutSeconds > MILESTONE15_AUTOMATION_POLICY.maxTimeoutSeconds) {
    throw new Error("Invalid automation timeout.");
  }
  if (typeof policy.notifyOnFailure !== "boolean") {
    throw new Error("Invalid automation failure notification setting.");
  }
  return {
    retryCount: policy.retryCount,
    disableAfterFailures: policy.disableAfterFailures,
    timeoutSeconds: policy.timeoutSeconds,
    notifyOnFailure: policy.notifyOnFailure
  };
}

function validateExactPath(path: string): void {
  if (!win32.isAbsolute(path)) {
    throw new Error("File triggers require an absolute Windows path.");
  }
  if (/[*?<>|]/u.test(path)) {
    throw new Error("File triggers must use an exact path without wildcards.");
  }
  const normalized = win32.normalize(path);
  const parsed = win32.parse(normalized);
  if (normalized.toLowerCase() === parsed.root.toLowerCase()) {
    throw new Error("Broad filesystem trigger roots are not allowed.");
  }
  const segments = normalized.slice(parsed.root.length).split(win32.sep).filter(Boolean);
  if (segments.length < 2) {
    throw new Error("File triggers must target a specific file or folder, not a broad location.");
  }
}

function buildBlockedReasons(trigger: AutomationTrigger, action: AutomationAction): readonly string[] {
  const reasons: string[] = [];
  if (trigger.kind === "file-change" && trigger.recursive) {
    reasons.push("Recursive file watching is disabled for Milestone 15.");
  }
  if (!MILESTONE15_AUTOMATION_POLICY.supportedActions.includes(action.kind)) {
    reasons.push("Unsupported automation action.");
  }
  return reasons;
}

function rejectUnsafeText(values: readonly string[]): void {
  const haystack = values.join(" ");
  if (SENSITIVE_PATTERN.test(haystack)) {
    throw new Error("Sensitive automation content is blocked by policy.");
  }
  if (DESTRUCTIVE_PATTERN.test(haystack)) {
    throw new Error("Destructive automation content is blocked by policy.");
  }
}

function getSimulationBlockReason(automation: AutomationDefinition, request: SimulateAutomationRequest): string | null {
  if (!request.desktopUnlocked) {
    return "Desktop must be unlocked before automation dry-runs.";
  }
  if (request.triggerKind !== automation.trigger.kind) {
    return `Trigger mismatch: expected ${automation.trigger.kind}.`;
  }
  if (automation.blockedReasons.length > 0) {
    return automation.blockedReasons.join(" ");
  }
  return null;
}

function auditKindForRun(status: AutomationRunStatus): AutomationAuditKind {
  if (status === "dry-run-completed") {
    return "run.completed";
  }
  if (status === "blocked") {
    return "run.blocked";
  }
  return "run.failed";
}

function isScheduleRepeat(value: unknown): value is AutomationScheduleRepeat {
  return value === "once" || value === "hourly" || value === "daily";
}

function isFileEventKind(value: unknown): value is AutomationFileEventKind {
  return value === "created" || value === "changed" || value === "deleted";
}

function isAutomationActionKind(value: unknown): value is AutomationActionKind {
  return value === "notify" ||
    value === "teach-replay-dry-run" ||
    value === "app-adapter-plan-dry-run" ||
    value === "knowledge-refresh-dry-run";
}

function normalizeText(value: string, label: string, maxLength: number): string {
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new Error(`Invalid ${label}.`);
  }
  return text;
}

function normalizeOptionalText(value: string, label: string, maxLength: number): string {
  const text = value.trim();
  if (text.length > maxLength) {
    throw new Error(`Invalid ${label}.`);
  }
  return text;
}

function capitalizeDecision(decision: AutomationReviewDecision): string {
  return decision === "approve" ? "Approved" : "Rejected";
}
