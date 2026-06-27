import { useEffect, useMemo, useState } from "react";

import type {
  AppAdapterActionKind,
  AppAdapterState,
  AutomationActionKind,
  AutomationFileEventKind,
  AutomationScheduleRepeat,
  AutomationState,
  AutomationTriggerKind,
  BrowserEngine,
  BrowserVisionState,
  ChatAttachment,
  ChatEvent,
  ChatMessage,
  ChatState,
  ChatTimelineEntry,
  CommandCenterState,
  CommandPlan,
  CommandPlanRoute,
  ComputerActionRisk,
  ComputerControlState,
  ComputerScreenshotResult,
  ComputerUiNode,
  ComputerVerificationKind,
  ElevatedHelperState,
  KnowledgeEvaluationResult,
  KnowledgeRagState,
  KnowledgeScope,
  KnowledgeSearchResult,
  ImageGenerationMode,
  LearningScope,
  LearningState,
  MediaAsset,
  MediaState,
  Milestone8ActiveAction,
  ModelFabricState,
  ModelPlanValidationResult,
  PackagingHardeningState,
  ModelPrivacyPreset,
  ModelRoleAlias,
  ProfileConfigState,
  ProfileFileName,
  ServiceLogEntry,
  ServiceStatus,
  ServiceSupervisorSnapshot,
  StudioProjectSummary,
  TeachEventKind,
  TeachModeState,
  VoiceCaptureMode,
  VoiceLanguage,
  VoiceState
} from "@hermes-local-ai/contracts";
import { MILESTONE8_ACTIVE_ACTIONS, MODEL_ROLE_ALIASES } from "@hermes-local-ai/contracts";
import type { ReactElement } from "react";
import "./studio-api.js";

type RefreshState = "idle" | "refreshing" | "error";
type ProfileDraft = {
  readonly id: string;
  readonly label: string;
  readonly files: Record<ProfileFileName, string>;
};
type ProjectDraft = {
  readonly id: string;
  readonly label: string;
  readonly rootPath: string;
  readonly profileId: string;
};
type KnowledgeBaseDraft = {
  readonly id: string;
  readonly label: string;
  readonly scope: KnowledgeScope;
  readonly ownerId: string;
};
type MemoryCandidateDraft = {
  readonly scope: LearningScope;
  readonly content: string;
  readonly note: string;
};
type SkillCandidateDraft = {
  readonly name: string;
  readonly summary: string;
  readonly body: string;
  readonly note: string;
};
type ActiveComputerDraft = {
  readonly action: Milestone8ActiveAction;
  readonly risk: ComputerActionRisk;
  readonly text: string;
  readonly chord: string;
  readonly expectedResult: string;
  readonly verificationKind: ComputerVerificationKind;
  readonly verificationText: string;
};
type VoiceDraft = {
  readonly language: VoiceLanguage;
  readonly mode: VoiceCaptureMode;
  readonly utterance: string;
  readonly ttsText: string;
  readonly wakeWord: string;
  readonly rms: string;
  readonly durationMs: string;
};
type MediaDraft = {
  readonly generationMode: ImageGenerationMode;
  readonly prompt: string;
  readonly keyframeCount: string;
};
type TeachEventDraft = {
  readonly kind: TeachEventKind;
  readonly appProcess: string;
  readonly windowTitle: string;
  readonly automationId: string;
  readonly name: string;
  readonly controlType: string;
  readonly text: string;
  readonly filePath: string;
  readonly waitCondition: string;
  readonly note: string;
};
type AppAdapterDraft = {
  readonly action: AppAdapterActionKind;
  readonly target: string;
  readonly intent: string;
  readonly contextKey: string;
  readonly contextValue: string;
};
type ElevatedHelperDraft = {
  readonly purpose: string;
  readonly durationMinutes: string;
  readonly approvalCode: string;
  readonly helperProcessId: string;
  readonly helperElevated: boolean;
};
type AutomationDraft = {
  readonly name: string;
  readonly purpose: string;
  readonly triggerKind: AutomationTriggerKind;
  readonly scheduleStartAt: string;
  readonly scheduleRepeat: AutomationScheduleRepeat;
  readonly filePath: string;
  readonly fileEvent: AutomationFileEventKind;
  readonly actionKind: AutomationActionKind;
  readonly actionTarget: string;
  readonly instructions: string;
  readonly retryCount: string;
  readonly disableAfterFailures: string;
  readonly timeoutSeconds: string;
  readonly notifyOnFailure: boolean;
  readonly desktopUnlocked: boolean;
  readonly forceFailure: boolean;
};
type PackagingDraft = {
  readonly restoreExportPath: string;
};
type WorkspaceId = "command" | "control" | "knowledge" | "creation" | "automation" | "admin" | "services";
type WorkspaceTab = {
  readonly id: WorkspaceId;
  readonly label: string;
};
type WorkspaceHeaderSummary = {
  readonly label: string;
  readonly detail: string;
  readonly countLabel: string;
};
type CommandPreset = {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly workspace: WorkspaceId;
};
type CommandStarterAction = {
  readonly id: "backup" | "knowledge" | "automation" | "app";
  readonly label: string;
  readonly detail: string;
  readonly command: string;
  readonly workspace: WorkspaceId;
};
type CommandPlanFilter = "all" | "draft" | "approved" | "rejected" | "blocked";
type CommandPlanFilterOption = {
  readonly id: CommandPlanFilter;
  readonly label: string;
};
type CommandDecisionTone = "ready" | "blocked" | "approved" | "rejected";
type CommandDecisionSummary = {
  readonly tone: CommandDecisionTone;
  readonly label: string;
  readonly detail: string;
  readonly nextAction: string;
};
type CommandApprovalTrailTone = "created" | "pending" | "approved" | "rejected";
type CommandApprovalTrailItem = {
  readonly tone: CommandApprovalTrailTone;
  readonly label: string;
  readonly detail: string;
  readonly note?: string;
};
type CommandApprovalCheckState = "pass" | "pending" | "blocked";
type CommandApprovalCheck = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly state: CommandApprovalCheckState;
};
type CommandReviewActionState = "available" | "blocked" | "complete" | "unavailable";
type CommandReviewAction = {
  readonly id: "approve" | "reject" | "open";
  readonly label: string;
  readonly detail: string;
  readonly state: CommandReviewActionState;
};
type CommandReviewBriefTone = "ready" | "blocked" | "approved" | "rejected";
type CommandReviewBrief = {
  readonly tone: CommandReviewBriefTone;
  readonly headline: string;
  readonly detail: string;
  readonly primaryAction: string;
  readonly handoff: string;
};
type CommandStepSummaryTone = "ready" | "blocked" | "approved" | "rejected";
type CommandStepSummary = {
  readonly tone: CommandStepSummaryTone;
  readonly stepCount: number;
  readonly approvalCount: number;
  readonly firstStep: string;
  readonly handoff: string;
  readonly detail: string;
};
type CommandApprovalImpactTone = "ready" | "blocked" | "approved" | "rejected";
type CommandApprovalImpact = {
  readonly tone: CommandApprovalImpactTone;
  readonly approval: string;
  readonly execution: string;
  readonly handoff: string;
  readonly audit: string;
};
type CommandReviewDecisionPromptTone = "ready" | "blocked" | "approved" | "rejected";
type CommandReviewDecisionPrompt = {
  readonly tone: CommandReviewDecisionPromptTone;
  readonly headline: string;
  readonly detail: string;
  readonly action: string;
  readonly guard: string;
};
type CommandReviewNoteCueTone = "idle" | "ready" | "blocked" | "locked";
type CommandReviewNoteCue = {
  readonly tone: CommandReviewNoteCueTone;
  readonly label: string;
  readonly detail: string;
  readonly suggestion: string;
  readonly guard: string;
  readonly characterCount: number;
};
type CommandQueueOverviewId = "total" | "ready" | "blocked" | "approved" | "rejected";
type CommandQueueOverviewTone = "neutral" | "ready" | "blocked" | "approved" | "rejected";
type CommandQueueOverviewItem = {
  readonly id: CommandQueueOverviewId;
  readonly label: string;
  readonly value: number;
  readonly detail: string;
  readonly tone: CommandQueueOverviewTone;
};
type CommandReviewQueueTone = "empty" | "ready" | "blocked" | "complete";
type CommandReviewQueueSummary = {
  readonly tone: CommandReviewQueueTone;
  readonly label: string;
  readonly detail: string;
  readonly nextPlan: string;
  readonly guard: string;
};
type CommandRevisionDraftSource = "review-note" | "blockers" | "reviewed-note" | "default";
type CommandRevisionDraft = {
  readonly sourcePlanId: string;
  readonly command: string;
  readonly feedback: string;
  readonly source: CommandRevisionDraftSource;
  readonly ready: boolean;
};
type CommandComposerBriefTone = "empty" | "ready" | "blocked" | "limit";
type CommandComposerBrief = {
  readonly tone: CommandComposerBriefTone;
  readonly label: string;
  readonly detail: string;
  readonly nextAction: string;
  readonly canPlan: boolean;
};
type CommandComposerRouteConfidence = "empty" | "matched" | "manual";
type CommandComposerRoutePreview = {
  readonly route: CommandPlanRoute;
  readonly workspace: WorkspaceId;
  readonly intentLabel: string;
  readonly risk: CommandPlan["risk"];
  readonly detail: string;
  readonly confidence: CommandComposerRouteConfidence;
};
type CommandIntentCheckState = "pass" | "hint" | "blocked";
type CommandIntentCheck = {
  readonly id: "intent" | "target" | "approval" | "safety";
  readonly label: string;
  readonly detail: string;
  readonly state: CommandIntentCheckState;
};
type CommandPlanPreviewStepState = "ready" | "pending" | "blocked";
type CommandPlanPreviewStep = {
  readonly id: "confirm" | "approval" | "handoff";
  readonly label: string;
  readonly detail: string;
  readonly state: CommandPlanPreviewStepState;
};
type CommandReadinessTone = "empty" | "needs-detail" | "blocked" | "ready";
type CommandReadinessMeter = {
  readonly tone: CommandReadinessTone;
  readonly score: number;
  readonly label: string;
  readonly detail: string;
  readonly nextStep: string;
};
type CommandDraftSummaryTone = "empty" | "blocked" | "ready";
type CommandDraftSummary = {
  readonly tone: CommandDraftSummaryTone;
  readonly title: string;
  readonly objective: string;
  readonly target: string;
  readonly approval: string;
  readonly execution: string;
  readonly handoff: string;
};
type CommandComposerSuggestionTone = "info" | "warning" | "success";
type CommandComposerSuggestion = {
  readonly id: "outcome" | "target" | "route" | "safety" | "length" | "approval" | "plan";
  readonly label: string;
  readonly detail: string;
  readonly tone: CommandComposerSuggestionTone;
};
type CommandApprovalGateTone = "disabled" | "blocked" | "ready";
type CommandApprovalGate = {
  readonly tone: CommandApprovalGateTone;
  readonly label: string;
  readonly detail: string;
  readonly approval: string;
  readonly execution: string;
  readonly action: string;
};
type CommandPolicyContractTone = "ready" | "warning" | "blocked";
type CommandPolicyContractItem = {
  readonly id: "planning" | "external-ai" | "approval" | "execution";
  readonly label: string;
  readonly detail: string;
  readonly tone: CommandPolicyContractTone;
};
type CommandPreflightTone = "ready" | "attention" | "blocked";
type CommandPreflightItem = {
  readonly id: "objective" | "route" | "safety" | "approval" | "execution";
  readonly label: string;
  readonly detail: string;
  readonly tone: CommandPreflightTone;
};
type CommandNextStepTone = "idle" | "attention" | "blocked" | "ready";
type CommandNextStep = {
  readonly tone: CommandNextStepTone;
  readonly label: string;
  readonly detail: string;
  readonly action: string;
  readonly guard: string;
};
type CommandFocusBarTone = "idle" | "ready" | "review" | "blocked" | "handoff";
type CommandFocusBar = {
  readonly tone: CommandFocusBarTone;
  readonly objective: string;
  readonly next: string;
  readonly review: string;
  readonly approval: string;
  readonly handoff: string;
};
type CommandFocusActionId = "make-plan" | "review-plan" | "use-revision" | "open-handoff";
type CommandFocusActionTone = "primary" | "secondary" | "blocked" | "handoff";
type CommandFocusAction = {
  readonly id: CommandFocusActionId;
  readonly label: string;
  readonly detail: string;
  readonly tone: CommandFocusActionTone;
  readonly disabled: boolean;
  readonly guard: string;
};
type CommandReviewTimelineTone = "done" | "current" | "blocked" | "waiting";
type CommandReviewTimelineItem = {
  readonly id: "draft" | "approval" | "handoff";
  readonly label: string;
  readonly detail: string;
  readonly tone: CommandReviewTimelineTone;
};

const WORKSPACES: readonly WorkspaceTab[] = [
  { id: "command", label: "Command" },
  { id: "control", label: "Control" },
  { id: "knowledge", label: "Knowledge" },
  { id: "creation", label: "Creation" },
  { id: "automation", label: "Automation" },
  { id: "admin", label: "Admin" },
  { id: "services", label: "Services" }
];

const WORKSPACE_HEADER_DETAILS: Record<WorkspaceId, string> = {
  command: "Command-first planning with explicit approval.",
  control: "Observe, propose, approve, and verify computer actions.",
  knowledge: "Local knowledge, memory, and learning queues.",
  creation: "Voice, media, and teach-mode creation tools.",
  automation: "Dry-run automations, packaging, and restore planning.",
  admin: "Profiles, models, chat sessions, and local configuration.",
  services: "Local service health, logs, and supervisor state."
};

const COMMAND_PRESETS: readonly CommandPreset[] = [
  {
    id: "backup",
    label: "Backup",
    command: "Create a backup and prepare a restore plan",
    workspace: "admin"
  },
  {
    id: "package",
    label: "Package",
    command: "Package the app and generate installer checksums",
    workspace: "automation"
  },
  {
    id: "knowledge",
    label: "Knowledge",
    command: "Search local knowledge for project status",
    workspace: "knowledge"
  },
  {
    id: "automation",
    label: "Automate",
    command: "Schedule a dry-run automation for STATUS.md",
    workspace: "automation"
  },
  {
    id: "app-adapter",
    label: "App",
    command: "Create an app adapter plan for the current workspace",
    workspace: "control"
  },
  {
    id: "computer-control",
    label: "Control",
    command: "Inspect the active window before any computer control",
    workspace: "control"
  },
  {
    id: "chat",
    label: "Chat",
    command: "Draft a concise local project status answer",
    workspace: "admin"
  }
];

const COMMAND_STARTER_ACTIONS: readonly CommandStarterAction[] = [
  {
    id: "backup",
    label: "Backup",
    detail: "Prepare restore path",
    command: "Create a backup and prepare a restore plan",
    workspace: "admin"
  },
  {
    id: "knowledge",
    label: "Knowledge",
    detail: "Search local project context",
    command: "Search local knowledge for project status",
    workspace: "knowledge"
  },
  {
    id: "automation",
    label: "Automation",
    detail: "Draft a dry-run workflow",
    command: "Schedule a dry-run automation for STATUS.md",
    workspace: "automation"
  },
  {
    id: "app",
    label: "App",
    detail: "Route through app adapter",
    command: "Open an app adapter plan for the target desktop app",
    workspace: "control"
  }
];

const COMMAND_PLAN_FILTERS: readonly CommandPlanFilterOption[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "blocked", label: "Blocked" }
];

function commandPlanMatchesFilter(plan: CommandPlan, filter: CommandPlanFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "blocked") {
    return plan.blockedReasons.length > 0;
  }
  return plan.status === filter;
}

function buildCommandQueueOverview(plans: readonly CommandPlan[]): readonly CommandQueueOverviewItem[] {
  const readyCount = plans.filter((plan) => plan.status === "draft" && plan.blockedReasons.length === 0).length;
  const blockedCount = plans.filter((plan) => plan.blockedReasons.length > 0).length;
  const approvedCount = plans.filter((plan) => plan.status === "approved").length;
  const rejectedCount = plans.filter((plan) => plan.status === "rejected").length;
  return [
    {
      id: "total",
      label: "Total",
      value: plans.length,
      detail: "Recent plans",
      tone: "neutral"
    },
    {
      id: "ready",
      label: "Ready",
      value: readyCount,
      detail: "Can approve",
      tone: "ready"
    },
    {
      id: "blocked",
      label: "Blocked",
      value: blockedCount,
      detail: "Needs revision",
      tone: "blocked"
    },
    {
      id: "approved",
      label: "Approved",
      value: approvedCount,
      detail: "Can open",
      tone: "approved"
    },
    {
      id: "rejected",
      label: "Rejected",
      value: rejectedCount,
      detail: "Closed",
      tone: "rejected"
    }
  ];
}

function buildCommandReviewQueueSummary(plans: readonly CommandPlan[]): CommandReviewQueueSummary {
  if (plans.length === 0) {
    return {
      tone: "empty",
      label: "No plans",
      detail: "Create a command plan to start review.",
      nextPlan: "None",
      guard: "No handoff"
    };
  }

  const readyDraft = plans.find((plan) => plan.status === "draft" && plan.blockedReasons.length === 0);
  if (readyDraft) {
    return {
      tone: "ready",
      label: "Review ready",
      detail: "Approve or reject after reading the plan.",
      nextPlan: `${readyDraft.title} · ${readyDraft.risk}`,
      guard: `Opens ${workspaceLabel(workspaceForCommandRoute(readyDraft.route))} after approval`
    };
  }

  const blockedDraft = plans.find((plan) => plan.status === "draft" && plan.blockedReasons.length > 0);
  if (blockedDraft) {
    return {
      tone: "blocked",
      label: "Revision needed",
      detail: `${pluralize(blockedDraft.blockedReasons.length, "blocked reason", "blocked reasons")} before approval.`,
      nextPlan: blockedDraft.title,
      guard: "Approval blocked"
    };
  }

  const approvedPlan = plans.find((plan) => plan.status === "approved");
  if (approvedPlan) {
    return {
      tone: "complete",
      label: "Approved handoff",
      detail: "Open the target workspace when ready.",
      nextPlan: approvedPlan.title,
      guard: `Open ${workspaceLabel(workspaceForCommandRoute(approvedPlan.route))}`
    };
  }

  return {
    tone: "complete",
    label: "Queue complete",
    detail: "No draft plans are waiting.",
    nextPlan: plans[0]?.title ?? "None",
    guard: "Create another plan"
  };
}

function findCommandReviewTargetPlan(plans: readonly CommandPlan[]): CommandPlan | null {
  return plans.find((plan) => plan.status === "draft" && plan.blockedReasons.length === 0)
    ?? plans.find((plan) => plan.status === "draft" && plan.blockedReasons.length > 0)
    ?? plans.find((plan) => plan.status === "approved")
    ?? plans[0]
    ?? null;
}

function limitCommandDraft(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxChars - 3))}...`;
}

function buildCommandRevisionDraft(
  plan: CommandPlan,
  reviewNote: string,
  maxChars: number
): CommandRevisionDraft {
  const trimmedReviewNote = reviewNote.trim();
  const blockedFeedback = plan.blockedReasons.join("; ");
  const reviewedNote = plan.reviewNote?.trim() ?? "";
  const feedback = trimmedReviewNote
    || blockedFeedback
    || reviewedNote
    || "Clarify the plan, reduce risk, and keep approval explicit.";
  const source: CommandRevisionDraftSource = trimmedReviewNote
    ? "review-note"
    : blockedFeedback
      ? "blockers"
      : reviewedNote
        ? "reviewed-note"
        : "default";
  return {
    sourcePlanId: plan.id,
    command: limitCommandDraft(`Revise this command plan.\nOriginal command: ${plan.command}\nFeedback: ${feedback}`, maxChars),
    feedback,
    source,
    ready: source !== "default"
  };
}

function buildCommandComposerBrief(
  command: string,
  blockedTerms: readonly string[],
  maxChars: number
): CommandComposerBrief {
  const trimmedCommand = command.trim();
  if (!trimmedCommand) {
    return {
      tone: "empty",
      label: "No command",
      detail: "Command box is empty.",
      nextAction: "Enter a command",
      canPlan: false
    };
  }
  if (command.length > maxChars) {
    return {
      tone: "limit",
      label: "Too long",
      detail: `${command.length}/${maxChars} characters`,
      nextAction: "Shorten command",
      canPlan: false
    };
  }
  if (blockedTerms.length > 0) {
    return {
      tone: "blocked",
      label: "Review only",
      detail: pluralize(blockedTerms.length, "blocked term", "blocked terms"),
      nextAction: "Plan can be created but not approved",
      canPlan: true
    };
  }
  return {
    tone: "ready",
    label: "Ready",
    detail: `${trimmedCommand.length}/${maxChars} characters`,
    nextAction: "Make Plan",
    canPlan: true
  };
}

function buildCommandComposerRoutePreview(
  command: string,
  blockedTerms: readonly string[]
): CommandComposerRoutePreview {
  const text = command.toLowerCase();
  const blockedRisk: CommandPlan["risk"] | null = blockedTerms.length > 0 ? "high" : null;
  if (!command.trim()) {
    return {
      route: "manual-review",
      workspace: workspaceForCommandRoute("manual-review"),
      intentLabel: "Waiting",
      risk: "low",
      detail: "Enter a command to preview target workspace.",
      confidence: "empty"
    };
  }
  if (/\b(backup|export|restore)\b/u.test(text)) {
    return {
      route: "profile-config",
      workspace: workspaceForCommandRoute("profile-config"),
      intentLabel: "Backup",
      risk: blockedRisk ?? (text.includes("restore") ? "medium" : "low"),
      detail: "Profile and restore planning",
      confidence: "matched"
    };
  }
  if (/\b(automation|automate|schedule|trigger|watch)\b/u.test(text)) {
    return {
      route: "automation",
      workspace: workspaceForCommandRoute("automation"),
      intentLabel: "Automation",
      risk: blockedRisk ?? "medium",
      detail: "Dry-run automation workflow",
      confidence: "matched"
    };
  }
  if (/\b(knowledge|rag|document|search|index|ingest|file)\b/u.test(text)) {
    return {
      route: "knowledge",
      workspace: workspaceForCommandRoute("knowledge"),
      intentLabel: "Knowledge",
      risk: blockedRisk ?? "low",
      detail: "Scoped local knowledge workflow",
      confidence: "matched"
    };
  }
  if (/\b(package|installer|install|update|hardening|release)\b/u.test(text)) {
    return {
      route: "packaging-hardening",
      workspace: workspaceForCommandRoute("packaging-hardening"),
      intentLabel: "Packaging",
      risk: blockedRisk ?? "medium",
      detail: "Packaging and hardening workflow",
      confidence: "matched"
    };
  }
  if (/\b(app adapter|adapter|open app|office|browser|explorer|powershell|vscode|bambu)\b/u.test(text)) {
    return {
      route: "app-adapters",
      workspace: workspaceForCommandRoute("app-adapters"),
      intentLabel: "App adapter",
      risk: blockedRisk ?? "medium",
      detail: "Semantic app handoff workflow",
      confidence: "matched"
    };
  }
  if (/\b(click|type|mouse|keyboard|window|screen|computer|ui tree|control)\b/u.test(text)) {
    return {
      route: "computer-control",
      workspace: workspaceForCommandRoute("computer-control"),
      intentLabel: "Computer control",
      risk: "high",
      detail: "Observe-first computer control workflow",
      confidence: "matched"
    };
  }
  if (/\b(chat|ask|answer|summarize|explain|draft)\b/u.test(text)) {
    return {
      route: "chat",
      workspace: workspaceForCommandRoute("chat"),
      intentLabel: "Chat",
      risk: blockedRisk ?? "low",
      detail: "Local chat response workflow",
      confidence: "matched"
    };
  }
  return {
    route: "manual-review",
    workspace: workspaceForCommandRoute("manual-review"),
    intentLabel: "Manual review",
    risk: blockedRisk ?? "low",
    detail: "Clarify target before handoff",
    confidence: "manual"
  };
}

function buildCommandIntentChecklist(
  command: string,
  routePreview: CommandComposerRoutePreview,
  blockedTerms: readonly string[],
  requiresApproval: boolean
): readonly CommandIntentCheck[] {
  const trimmedCommand = command.trim();
  const wordCount = trimmedCommand ? trimmedCommand.split(/\s+/u).length : 0;
  return [
    {
      id: "intent",
      label: "Intent",
      detail: routePreview.confidence === "matched"
        ? `${routePreview.intentLabel} route matched`
        : routePreview.confidence === "manual"
          ? "Manual review will clarify route"
          : "Enter a command",
      state: routePreview.confidence === "matched" ? "pass" : "hint"
    },
    {
      id: "target",
      label: "Target",
      detail: wordCount >= 4 ? "Command includes enough detail" : "Add target or outcome",
      state: wordCount >= 4 ? "pass" : "hint"
    },
    {
      id: "approval",
      label: "Approval",
      detail: requiresApproval ? "User approval required" : "Approval policy unavailable",
      state: requiresApproval ? "pass" : "hint"
    },
    {
      id: "safety",
      label: "Safety",
      detail: blockedTerms.length > 0 ? pluralize(blockedTerms.length, "blocked term", "blocked terms") : "No blocked terms",
      state: blockedTerms.length > 0 ? "blocked" : "pass"
    }
  ];
}

function buildCommandPlanPreview(
  command: string,
  routePreview: CommandComposerRoutePreview,
  blockedTerms: readonly string[],
  requiresApproval: boolean
): readonly CommandPlanPreviewStep[] {
  const hasCommand = command.trim().length > 0;
  const targetWorkspace = workspaceLabel(routePreview.workspace);
  const hasBlockers = blockedTerms.length > 0;
  return [
    {
      id: "confirm",
      label: "Confirm",
      detail: hasCommand ? `${routePreview.intentLabel} intent` : "Enter a command first",
      state: hasCommand ? "ready" : "pending"
    },
    {
      id: "approval",
      label: "Approval",
      detail: hasBlockers
        ? "Blocked plan stays review-only"
        : requiresApproval
          ? "User approves before handoff"
          : "Approval policy unavailable",
      state: hasBlockers ? "blocked" : requiresApproval ? "pending" : "blocked"
    },
    {
      id: "handoff",
      label: "Handoff",
      detail: hasBlockers ? "No handoff until revised" : `Open ${targetWorkspace} after approval`,
      state: hasBlockers ? "blocked" : "pending"
    }
  ];
}

function buildCommandReadinessMeter(
  command: string,
  routePreview: CommandComposerRoutePreview,
  blockedTerms: readonly string[],
  maxChars: number,
  requiresApproval: boolean
): CommandReadinessMeter {
  const trimmedCommand = command.trim();
  const wordCount = trimmedCommand ? trimmedCommand.split(/\s+/u).length : 0;
  const withinLimit = command.length <= maxChars;
  const hasTargetDetail = wordCount >= 4;
  const hasMatchedRoute = routePreview.confidence === "matched";
  const hasBlockers = blockedTerms.length > 0;
  const score = Math.min(100, Math.max(0,
    (trimmedCommand ? 20 : 0)
    + (hasTargetDetail ? 20 : 0)
    + (hasMatchedRoute ? 20 : routePreview.confidence === "manual" ? 10 : 0)
    + (withinLimit ? 20 : 0)
    + (!hasBlockers && requiresApproval ? 20 : 0)
  ));

  if (!trimmedCommand) {
    return {
      tone: "empty",
      score: 0,
      label: "Waiting",
      detail: "No command yet",
      nextStep: "Add the outcome you want"
    };
  }
  if (!withinLimit) {
    return {
      tone: "blocked",
      score: Math.min(score, 40),
      label: "Too long",
      detail: `${command.length}/${maxChars} characters`,
      nextStep: "Shorten command before planning"
    };
  }
  if (hasBlockers) {
    return {
      tone: "blocked",
      score: Math.min(score, 60),
      label: "Review only",
      detail: pluralize(blockedTerms.length, "blocked term", "blocked terms"),
      nextStep: "Revise blocked terms before approval"
    };
  }
  if (!requiresApproval) {
    return {
      tone: "blocked",
      score: Math.min(score, 70),
      label: "Policy check",
      detail: "Approval policy unavailable",
      nextStep: "Enable user approval before handoff"
    };
  }
  if (!hasTargetDetail) {
    return {
      tone: "needs-detail",
      score,
      label: "Needs target",
      detail: "Add target or outcome",
      nextStep: "Be specific before planning"
    };
  }
  if (!hasMatchedRoute) {
    return {
      tone: "needs-detail",
      score,
      label: "Needs route",
      detail: "Manual review route",
      nextStep: "Add app, task, or workspace keyword"
    };
  }
  return {
    tone: "ready",
    score,
    label: "Ready",
    detail: `${routePreview.intentLabel} plan`,
    nextStep: "Make Plan for approval"
  };
}

function buildCommandDraftSummary(
  command: string,
  routePreview: CommandComposerRoutePreview,
  blockedTerms: readonly string[],
  requiresApproval: boolean,
  silentExecutionAllowed: boolean
): CommandDraftSummary {
  const trimmedCommand = command.trim();
  const targetWorkspace = workspaceLabel(routePreview.workspace);
  const hasBlockers = blockedTerms.length > 0;
  const approval = hasBlockers
    ? "Approval blocked"
    : requiresApproval
      ? "Approval required"
      : "Approval policy unavailable";
  const execution = silentExecutionAllowed ? "Silent execution allowed by policy" : "No automatic execution";

  if (!trimmedCommand) {
    return {
      tone: "empty",
      title: "Draft waiting",
      objective: "Enter a command to preview plan",
      target: targetWorkspace,
      approval,
      execution: "No automatic execution",
      handoff: "No handoff yet"
    };
  }

  return {
    tone: hasBlockers || !requiresApproval ? "blocked" : "ready",
    title: `${routePreview.intentLabel} draft`,
    objective: limitCommandDraft(trimmedCommand, 96),
    target: targetWorkspace,
    approval,
    execution,
    handoff: hasBlockers || !requiresApproval ? "No handoff until revised" : `Open ${targetWorkspace} after approval`
  };
}

function buildCommandComposerSuggestions(
  command: string,
  routePreview: CommandComposerRoutePreview,
  blockedTerms: readonly string[],
  maxChars: number,
  requiresApproval: boolean,
  readiness: CommandReadinessMeter
): readonly CommandComposerSuggestion[] {
  const trimmedCommand = command.trim();
  const wordCount = trimmedCommand ? trimmedCommand.split(/\s+/u).length : 0;
  const suggestions: CommandComposerSuggestion[] = [];

  if (!trimmedCommand) {
    suggestions.push(
      {
        id: "outcome",
        label: "Describe outcome",
        detail: "Say what you want the app to plan.",
        tone: "info"
      },
      {
        id: "target",
        label: "Name a target",
        detail: "Include an app, file, service, or workflow.",
        tone: "info"
      }
    );
    return suggestions;
  }

  if (command.length > maxChars) {
    suggestions.push({
      id: "length",
      label: "Shorten command",
      detail: `${command.length}/${maxChars} characters used.`,
      tone: "warning"
    });
  }

  if (blockedTerms.length > 0) {
    suggestions.push({
      id: "safety",
      label: "Revise blocked terms",
      detail: `${pluralize(blockedTerms.length, "term", "terms")} block approval.`,
      tone: "warning"
    });
  }

  if (!requiresApproval) {
    suggestions.push({
      id: "approval",
      label: "Restore approval",
      detail: "User approval is required before handoff.",
      tone: "warning"
    });
  }

  if (wordCount < 4) {
    suggestions.push({
      id: "target",
      label: "Add target detail",
      detail: "Mention the object, app, or end state.",
      tone: "info"
    });
  }

  if (routePreview.confidence !== "matched") {
    suggestions.push({
      id: "route",
      label: "Clarify route",
      detail: "Add backup, automation, app, control, or chat.",
      tone: "info"
    });
  }

  if (suggestions.length === 0 && readiness.tone === "ready") {
    suggestions.push({
      id: "plan",
      label: "Make Plan",
      detail: "Create the draft for user approval.",
      tone: "success"
    });
  }

  return suggestions.slice(0, 3);
}

function buildCommandApprovalGate(
  command: string,
  blockedTerms: readonly string[],
  composerBrief: CommandComposerBrief,
  readiness: CommandReadinessMeter,
  requiresApproval: boolean,
  silentExecutionAllowed: boolean
): CommandApprovalGate {
  const trimmedCommand = command.trim();
  const execution = silentExecutionAllowed ? "Silent execution allowed by policy" : "No automatic execution";

  if (!trimmedCommand) {
    return {
      tone: "disabled",
      label: "Waiting for command",
      detail: "Make Plan stays disabled until a command is entered.",
      approval: requiresApproval ? "Approval will be required" : "Approval policy unavailable",
      execution: "No automatic execution",
      action: "Add command"
    };
  }

  if (!composerBrief.canPlan) {
    return {
      tone: "disabled",
      label: "Cannot create plan",
      detail: readiness.nextStep,
      approval: requiresApproval ? "Approval will be required" : "Approval policy unavailable",
      execution: "No automatic execution",
      action: "Fix command"
    };
  }

  if (blockedTerms.length > 0) {
    return {
      tone: "blocked",
      label: "Review-only plan",
      detail: `${pluralize(blockedTerms.length, "blocked term", "blocked terms")} will prevent approval.`,
      approval: "Approval blocked until revised",
      execution: "No automatic execution",
      action: "Make Plan for review"
    };
  }

  if (!requiresApproval) {
    return {
      tone: "blocked",
      label: "Approval unavailable",
      detail: "User approval is required before handoff.",
      approval: "Restore approval policy",
      execution: "No automatic execution",
      action: "Fix policy"
    };
  }

  return {
    tone: "ready",
    label: "Ready for draft",
    detail: "Make Plan creates a local draft only.",
    approval: "User approval required before handoff",
    execution,
    action: "Make Plan"
  };
}

function buildCommandPolicyContract(policy: CommandCenterState["policy"] | null): readonly CommandPolicyContractItem[] {
  return [
    {
      id: "planning",
      label: "Planning",
      detail: policy?.localPlanningOnly ? "Local deterministic planning" : "External planning may be used",
      tone: policy?.localPlanningOnly ? "ready" : "warning"
    },
    {
      id: "external-ai",
      label: "AI calls",
      detail: policy?.externalAiPlanningAllowed ? "External AI planning allowed" : "No external AI planning",
      tone: policy?.externalAiPlanningAllowed ? "warning" : "ready"
    },
    {
      id: "approval",
      label: "Approval",
      detail: policy?.requiresApproval ? "User approval required" : "Approval policy unavailable",
      tone: policy?.requiresApproval ? "ready" : "blocked"
    },
    {
      id: "execution",
      label: "Execution",
      detail: policy?.silentExecutionAllowed ? "Silent execution allowed" : "No automatic execution",
      tone: policy?.silentExecutionAllowed ? "blocked" : "ready"
    }
  ];
}

function buildCommandPreflightChecklist(
  command: string,
  routePreview: CommandComposerRoutePreview,
  blockedTerms: readonly string[],
  composerBrief: CommandComposerBrief,
  readiness: CommandReadinessMeter,
  requiresApproval: boolean,
  silentExecutionAllowed: boolean
): readonly CommandPreflightItem[] {
  const trimmedCommand = command.trim();
  const wordCount = trimmedCommand ? trimmedCommand.split(/\s+/u).length : 0;
  const hasObjective = wordCount >= 4;
  const routeMatched = routePreview.confidence === "matched";
  const hasBlockers = blockedTerms.length > 0;
  return [
    {
      id: "objective",
      label: "Objective",
      detail: !trimmedCommand
        ? "Enter a command"
        : composerBrief.tone === "limit"
          ? composerBrief.detail
          : hasObjective
            ? "Outcome has enough detail"
            : "Add target or outcome",
      tone: !trimmedCommand || composerBrief.tone === "limit" ? "blocked" : hasObjective ? "ready" : "attention"
    },
    {
      id: "route",
      label: "Route",
      detail: routeMatched
        ? `${routePreview.intentLabel} to ${workspaceLabel(routePreview.workspace)}`
        : routePreview.confidence === "manual"
          ? "Manual review route"
          : "Waiting for target route",
      tone: routeMatched ? "ready" : "attention"
    },
    {
      id: "safety",
      label: "Safety",
      detail: hasBlockers ? pluralize(blockedTerms.length, "blocked term", "blocked terms") : "No blocked terms",
      tone: hasBlockers ? "blocked" : "ready"
    },
    {
      id: "approval",
      label: "Approval",
      detail: requiresApproval ? "User approval required" : "Approval policy unavailable",
      tone: requiresApproval ? "ready" : "blocked"
    },
    {
      id: "execution",
      label: "Execution",
      detail: silentExecutionAllowed
        ? "Silent execution allowed"
        : readiness.tone === "ready"
          ? "Draft only before handoff"
          : "No automatic execution",
      tone: silentExecutionAllowed ? "blocked" : "ready"
    }
  ];
}

function buildCommandNextStep(
  command: string,
  blockedTerms: readonly string[],
  composerBrief: CommandComposerBrief,
  readiness: CommandReadinessMeter,
  requiresApproval: boolean
): CommandNextStep {
  const trimmedCommand = command.trim();
  if (!trimmedCommand) {
    return {
      tone: "idle",
      label: "Choose a starter",
      detail: "Type a command or load a safe starter.",
      action: "No plan yet",
      guard: "No automatic execution"
    };
  }

  if (!composerBrief.canPlan) {
    return {
      tone: "blocked",
      label: composerBrief.nextAction,
      detail: readiness.nextStep,
      action: "Fix command",
      guard: "Plan creation disabled"
    };
  }

  if (blockedTerms.length > 0) {
    return {
      tone: "blocked",
      label: "Revise blocked terms",
      detail: `${pluralize(blockedTerms.length, "blocked term", "blocked terms")} must be removed before approval.`,
      action: "Review-only draft",
      guard: "Approval blocked"
    };
  }

  if (!requiresApproval) {
    return {
      tone: "blocked",
      label: "Restore approval policy",
      detail: "User approval is required before any handoff.",
      action: "Fix policy",
      guard: "No handoff"
    };
  }

  if (readiness.tone === "needs-detail") {
    return {
      tone: "attention",
      label: readiness.nextStep,
      detail: readiness.detail,
      action: "Refine command",
      guard: "Approval still required"
    };
  }

  return {
    tone: "ready",
    label: "Make Plan",
    detail: "Create a local draft for user review.",
    action: "Draft for approval",
    guard: "No handoff before approval"
  };
}

function buildCommandFocusBar(
  command: string,
  nextStep: CommandNextStep,
  reviewQueue: CommandReviewQueueSummary,
  selectedPlan: CommandPlan | null
): CommandFocusBar {
  const objective = command.trim() ? limitCommandDraft(command.trim(), 96) : "No command entered";
  const review = reviewQueue.nextPlan === "None"
    ? reviewQueue.label
    : `${reviewQueue.label}: ${reviewQueue.nextPlan}`;
  const selectedHandoff = selectedPlan ? workspaceLabel(workspaceForCommandRoute(selectedPlan.route)) : null;
  const handoff = selectedPlan?.status === "approved"
    ? `Open ${selectedHandoff}`
    : selectedPlan?.status === "rejected"
      ? "No handoff after rejection"
      : reviewQueue.guard;

  if (nextStep.tone === "blocked" || reviewQueue.tone === "blocked") {
    return {
      tone: "blocked",
      objective,
      next: nextStep.action,
      review,
      approval: nextStep.guard,
      handoff
    };
  }

  if (selectedPlan?.status === "approved" || reviewQueue.label === "Approved handoff") {
    return {
      tone: "handoff",
      objective,
      next: "Open approved workspace",
      review,
      approval: "Approval recorded",
      handoff
    };
  }

  if (reviewQueue.tone === "ready") {
    return {
      tone: "review",
      objective,
      next: "Review plan",
      review,
      approval: "User decision required",
      handoff: reviewQueue.guard
    };
  }

  if (nextStep.tone === "ready") {
    return {
      tone: "ready",
      objective,
      next: nextStep.action,
      review,
      approval: "Approval required after plan",
      handoff: nextStep.guard
    };
  }

  return {
    tone: "idle",
    objective,
    next: nextStep.action,
    review,
    approval: nextStep.guard,
    handoff
  };
}

function buildCommandFocusActions(
  composerBrief: CommandComposerBrief,
  reviewQueue: CommandReviewQueueSummary,
  reviewTargetPlan: CommandPlan | null,
  selectedPlan: CommandPlan | null,
  revisionDraft: CommandRevisionDraft | null
): readonly CommandFocusAction[] {
  const revisionReady = Boolean(revisionDraft?.ready && selectedPlan?.status !== "approved");
  const approvedHandoff = selectedPlan?.status === "approved";
  return [
    {
      id: "make-plan",
      label: "Make Plan",
      detail: composerBrief.canPlan ? "Draft for approval" : composerBrief.nextAction,
      tone: composerBrief.canPlan ? "primary" : "secondary",
      disabled: !composerBrief.canPlan,
      guard: composerBrief.canPlan ? "Creates review draft" : "Plan disabled"
    },
    {
      id: "review-plan",
      label: "Review Plan",
      detail: reviewTargetPlan ? reviewTargetPlan.title : reviewQueue.label,
      tone: reviewQueue.tone === "ready" ? "primary" : reviewQueue.tone === "blocked" ? "blocked" : "secondary",
      disabled: reviewTargetPlan === null,
      guard: reviewTargetPlan ? "Selects plan only" : "No plan"
    },
    {
      id: "use-revision",
      label: "Use Revision",
      detail: revisionReady ? "Fill composer from feedback" : "Need review feedback",
      tone: selectedPlan?.blockedReasons.length || selectedPlan?.status === "rejected" ? "blocked" : "secondary",
      disabled: !revisionReady,
      guard: "No plan created"
    },
    {
      id: "open-handoff",
      label: "Open Handoff",
      detail: approvedHandoff ? `Open ${workspaceLabel(workspaceForCommandRoute(selectedPlan.route))}` : "Approve first",
      tone: "handoff",
      disabled: !approvedHandoff,
      guard: approvedHandoff ? "User opens workspace" : "Approval required"
    }
  ];
}

function pluralize(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatCommandTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function buildCommandReviewTimeline(
  plan: CommandPlan,
  policy: CommandCenterState["policy"] | null
): readonly CommandReviewTimelineItem[] {
  const hasBlockedReasons = plan.blockedReasons.length > 0;
  const handoffWorkspace = workspaceLabel(workspaceForCommandRoute(plan.route));
  const draft: CommandReviewTimelineItem = {
    id: "draft",
    label: "Draft ready",
    detail: `${plan.intent} · ${plan.risk}`,
    tone: "done"
  };

  const approval: CommandReviewTimelineItem = plan.status === "approved"
    ? {
        id: "approval",
        label: "Approved",
        detail: plan.reviewedAt ? formatCommandTimestamp(plan.reviewedAt) : "Approval recorded",
        tone: "done"
      }
    : plan.status === "rejected"
      ? {
          id: "approval",
          label: "Rejected",
          detail: plan.reviewNote ?? "No approval granted",
          tone: "blocked"
        }
      : hasBlockedReasons
        ? {
            id: "approval",
            label: "Approval blocked",
            detail: pluralize(plan.blockedReasons.length, "blocked reason", "blocked reasons"),
            tone: "blocked"
          }
        : policy === null
          ? {
              id: "approval",
              label: "Approval unavailable",
              detail: "Restore approval policy before handoff",
              tone: "blocked"
            }
          : {
              id: "approval",
              label: "Awaiting decision",
              detail: "Approve or reject explicitly",
              tone: "current"
            };

  const handoff: CommandReviewTimelineItem = plan.status === "approved"
    ? {
        id: "handoff",
        label: "Ready to open",
        detail: `Open ${handoffWorkspace}`,
        tone: "current"
      }
    : plan.status === "rejected"
      ? {
          id: "handoff",
          label: "No handoff",
          detail: "Plan was rejected",
          tone: "blocked"
        }
      : hasBlockedReasons
        ? {
            id: "handoff",
            label: "No handoff",
            detail: "Resolve blockers first",
            tone: "blocked"
          }
        : {
            id: "handoff",
            label: "Locked",
            detail: `Requires approval before ${handoffWorkspace}`,
            tone: "waiting"
          };

  return [draft, approval, handoff];
}

function buildCommandApprovalTrail(plan: CommandPlan): readonly CommandApprovalTrailItem[] {
  const created: CommandApprovalTrailItem = {
    tone: "created",
    label: "Plan created",
    detail: formatCommandTimestamp(plan.createdAt),
    note: plan.command
  };
  if (!plan.reviewedAt) {
    return [
      created,
      {
        tone: "pending",
        label: "Awaiting review",
        detail: plan.blockedReasons.length > 0 ? "Blocked plans cannot be approved" : "Approval required before handoff"
      }
    ];
  }
  return [
    created,
    {
      tone: plan.status === "approved" ? "approved" : "rejected",
      label: plan.status === "approved" ? "Approved" : "Rejected",
      detail: formatCommandTimestamp(plan.reviewedAt),
      note: plan.reviewNote ?? "No review note."
    }
  ];
}

function buildCommandApprovalChecklist(
  plan: CommandPlan,
  policy: CommandCenterState["policy"] | null
): readonly CommandApprovalCheck[] {
  const reviewComplete = plan.status !== "draft";
  const hasBlockedReasons = plan.blockedReasons.length > 0;
  const handoffWorkspace = workspaceLabel(workspaceForCommandRoute(plan.route));
  return [
    {
      id: "review-state",
      label: "Review state",
      detail: reviewComplete ? `Plan ${plan.status}` : "Ready for your decision",
      state: reviewComplete ? "pass" : "pending"
    },
    {
      id: "blockers",
      label: "Blockers",
      detail: hasBlockedReasons ? pluralize(plan.blockedReasons.length, "blocked reason", "blocked reasons") : "No blocked terms",
      state: hasBlockedReasons ? "blocked" : "pass"
    },
    {
      id: "approval-policy",
      label: "Approval gate",
      detail: policy?.requiresApproval ? "User approval required" : "No approval required",
      state: policy?.requiresApproval && !reviewComplete ? "pending" : "pass"
    },
    {
      id: "silent-execution",
      label: "Silent execution",
      detail: policy?.silentExecutionAllowed ? "Silent execution allowed" : "Silent execution blocked",
      state: policy?.silentExecutionAllowed ? "blocked" : "pass"
    },
    {
      id: "handoff-target",
      label: "Handoff",
      detail: plan.status === "approved"
        ? `Open ${handoffWorkspace}`
        : plan.status === "rejected"
          ? "Handoff unavailable after rejection"
          : `Will open ${handoffWorkspace} after approval`,
      state: plan.status === "approved" ? "pass" : plan.status === "rejected" ? "blocked" : "pending"
    }
  ];
}

function buildCommandReviewActions(plan: CommandPlan): readonly CommandReviewAction[] {
  const hasBlockedReasons = plan.blockedReasons.length > 0;
  const handoffWorkspace = workspaceLabel(workspaceForCommandRoute(plan.route));
  return [
    {
      id: "approve",
      label: "Approve",
      detail: plan.status === "draft"
        ? hasBlockedReasons
          ? "Blocked until the command is revised"
          : "Available now"
        : plan.status === "approved"
          ? "Already approved"
          : "Unavailable after rejection",
      state: plan.status === "approved"
        ? "complete"
        : plan.status === "draft" && !hasBlockedReasons
          ? "available"
          : hasBlockedReasons
            ? "blocked"
            : "unavailable"
    },
    {
      id: "reject",
      label: "Reject",
      detail: plan.status === "draft"
        ? "Available as the alternate decision"
        : plan.status === "rejected"
          ? "Already rejected"
          : "Unavailable after approval",
      state: plan.status === "rejected" ? "complete" : plan.status === "draft" ? "available" : "unavailable"
    },
    {
      id: "open",
      label: "Open",
      detail: plan.status === "approved"
        ? `Open ${handoffWorkspace}`
        : plan.status === "rejected"
          ? "Rejected plans cannot be opened"
          : `Approve before opening ${handoffWorkspace}`,
      state: plan.status === "approved" ? "available" : plan.status === "rejected" ? "blocked" : "unavailable"
    }
  ];
}

function buildCommandReviewBrief(plan: CommandPlan): CommandReviewBrief {
  const handoffWorkspace = workspaceLabel(workspaceForCommandRoute(plan.route));
  if (plan.blockedReasons.length > 0) {
    return {
      tone: "blocked",
      headline: "Revise before approval",
      detail: pluralize(plan.blockedReasons.length, "blocked reason", "blocked reasons"),
      primaryAction: "Reject or re-plan",
      handoff: `Target: ${handoffWorkspace}`
    };
  }
  if (plan.status === "approved") {
    return {
      tone: "approved",
      headline: "Approved for handoff",
      detail: plan.summary,
      primaryAction: "Open workspace",
      handoff: `Open ${handoffWorkspace}`
    };
  }
  if (plan.status === "rejected") {
    return {
      tone: "rejected",
      headline: "Plan rejected",
      detail: plan.reviewNote ?? "No review note.",
      primaryAction: "Make a revised plan",
      handoff: `Target was ${handoffWorkspace}`
    };
  }
  return {
    tone: "ready",
    headline: "Ready for your decision",
    detail: `${pluralize(plan.steps.length, "step", "steps")} reviewed · ${plan.risk} risk`,
    primaryAction: "Approve or reject",
    handoff: `Will open ${handoffWorkspace}`
  };
}

function buildCommandStepSummary(plan: CommandPlan): CommandStepSummary {
  const approvalCount = plan.steps.filter((step) => step.requiresApproval).length;
  const firstStep = plan.steps[0]?.title ?? "No steps";
  const handoffWorkspace = workspaceLabel(workspaceForCommandRoute(plan.route));
  if (plan.blockedReasons.length > 0) {
    return {
      tone: "blocked",
      stepCount: plan.steps.length,
      approvalCount,
      firstStep,
      handoff: `Target: ${handoffWorkspace}`,
      detail: `${pluralize(plan.blockedReasons.length, "blocked reason", "blocked reasons")} before handoff`
    };
  }
  if (plan.status === "approved") {
    return {
      tone: "approved",
      stepCount: plan.steps.length,
      approvalCount,
      firstStep,
      handoff: `Open ${handoffWorkspace}`,
      detail: "Approval complete"
    };
  }
  if (plan.status === "rejected") {
    return {
      tone: "rejected",
      stepCount: plan.steps.length,
      approvalCount,
      firstStep,
      handoff: `Target was ${handoffWorkspace}`,
      detail: "Plan closed"
    };
  }
  return {
    tone: "ready",
    stepCount: plan.steps.length,
    approvalCount,
    firstStep,
    handoff: `Will open ${handoffWorkspace}`,
    detail: `${pluralize(approvalCount, "approval step", "approval steps")} before handoff`
  };
}

function buildCommandApprovalImpact(
  plan: CommandPlan,
  policy: CommandCenterState["policy"] | null
): CommandApprovalImpact {
  const handoffWorkspace = workspaceLabel(workspaceForCommandRoute(plan.route));
  const execution = policy?.silentExecutionAllowed ? "Silent execution allowed by policy" : "No automatic execution";
  if (plan.blockedReasons.length > 0) {
    return {
      tone: "blocked",
      approval: "Approval blocked",
      execution,
      handoff: `Revise before ${handoffWorkspace}`,
      audit: pluralize(plan.blockedReasons.length, "blocked reason", "blocked reasons")
    };
  }
  if (plan.status === "approved") {
    return {
      tone: "approved",
      approval: "Approved",
      execution,
      handoff: `Open ${handoffWorkspace}`,
      audit: plan.reviewedAt ? `Reviewed ${formatCommandTimestamp(plan.reviewedAt)}` : "Review recorded"
    };
  }
  if (plan.status === "rejected") {
    return {
      tone: "rejected",
      approval: "Rejected",
      execution: "No handoff",
      handoff: `Target was ${handoffWorkspace}`,
      audit: plan.reviewNote ?? "No review note"
    };
  }
  return {
    tone: policy?.silentExecutionAllowed ? "blocked" : "ready",
    approval: "Approval unlocks handoff",
    execution,
    handoff: `User opens ${handoffWorkspace}`,
    audit: "Decision will be recorded"
  };
}

function buildCommandReviewDecisionPrompt(
  plan: CommandPlan,
  reviewNote: string,
  policy: CommandCenterState["policy"] | null
): CommandReviewDecisionPrompt {
  const handoffWorkspace = workspaceLabel(workspaceForCommandRoute(plan.route));
  const hasReviewNote = reviewNote.trim().length > 0;
  if (plan.blockedReasons.length > 0) {
    return {
      tone: "blocked",
      headline: "Revise before approval",
      detail: `${pluralize(plan.blockedReasons.length, "blocked reason", "blocked reasons")} must be resolved before handoff.`,
      action: hasReviewNote ? "Use note for revision" : "Add review note",
      guard: "Approve disabled"
    };
  }
  if (plan.status === "approved") {
    return {
      tone: "approved",
      headline: "Ready to open",
      detail: `Approval recorded for ${handoffWorkspace}.`,
      action: `Open ${handoffWorkspace}`,
      guard: "User-controlled handoff"
    };
  }
  if (plan.status === "rejected") {
    return {
      tone: "rejected",
      headline: "Plan rejected",
      detail: plan.reviewNote ?? "No review note recorded.",
      action: "Create a revision",
      guard: "No handoff"
    };
  }
  if (!policy?.requiresApproval) {
    return {
      tone: "blocked",
      headline: "Approval policy unavailable",
      detail: "Restore user approval before handoff.",
      action: "Fix policy",
      guard: "No handoff"
    };
  }
  return {
    tone: "ready",
    headline: hasReviewNote ? "Decision ready with note" : "Decision ready",
    detail: hasReviewNote ? "Review note will be recorded with your decision." : "Approve or reject after reading the plan.",
    action: "Approve or reject",
    guard: `Open ${handoffWorkspace} only after approval`
  };
}

function buildCommandReviewNoteCue(plan: CommandPlan, reviewNote: string): CommandReviewNoteCue {
  const trimmedReviewNote = reviewNote.trim();
  const recordedNote = plan.reviewNote?.trim() ?? "";
  const activeCharacterCount = reviewNote.length;
  if (plan.status === "approved") {
    return {
      tone: "locked",
      label: "Review closed",
      detail: recordedNote ? "Approval note recorded." : "Approval recorded without a note.",
      suggestion: "Open handoff or create a new plan",
      guard: "Note locked",
      characterCount: plan.reviewNote?.length ?? 0
    };
  }
  if (plan.status === "rejected") {
    return {
      tone: "locked",
      label: "Revision source",
      detail: recordedNote ? "Rejected note is available for revision." : "No rejection note recorded.",
      suggestion: "Use revision draft for feedback",
      guard: "No handoff",
      characterCount: plan.reviewNote?.length ?? 0
    };
  }
  if (plan.blockedReasons.length > 0) {
    return {
      tone: "blocked",
      label: trimmedReviewNote ? "Revision note ready" : "Add blocker feedback",
      detail: trimmedReviewNote ? "Note can explain the required changes." : "Explain what must change before approval.",
      suggestion: trimmedReviewNote ? "Reject or use note for revision" : "Record a note before revision",
      guard: "Approve disabled",
      characterCount: activeCharacterCount
    };
  }
  if (trimmedReviewNote) {
    return {
      tone: "ready",
      label: "Decision note ready",
      detail: "The note will be saved with approve or reject.",
      suggestion: "Confirm decision",
      guard: "Handoff still approval-gated",
      characterCount: activeCharacterCount
    };
  }
  return {
    tone: "idle",
    label: "Optional note",
    detail: "Add context if the decision needs an audit note.",
    suggestion: "Approve or reject when ready",
    guard: "No handoff before approval",
    characterCount: activeCharacterCount
  };
}

function summarizeCommandDecision(plan: CommandPlan): CommandDecisionSummary {
  const stepCount = plan.steps.length;
  const approvalStepCount = plan.steps.filter((step) => step.requiresApproval).length;
  if (plan.blockedReasons.length > 0) {
    return {
      tone: "blocked",
      label: "Blocked",
      detail: pluralize(plan.blockedReasons.length, "blocker", "blockers"),
      nextAction: "Reject or re-plan"
    };
  }
  if (plan.status === "approved") {
    return {
      tone: "approved",
      label: "Approved",
      detail: `Opens ${workspaceLabel(workspaceForCommandRoute(plan.route))}`,
      nextAction: "Open workspace"
    };
  }
  if (plan.status === "rejected") {
    return {
      tone: "rejected",
      label: "Rejected",
      detail: pluralize(stepCount, "step reviewed", "steps reviewed"),
      nextAction: "Make a revised plan"
    };
  }
  return {
    tone: "ready",
    label: "Ready",
    detail: `${pluralize(stepCount, "step", "steps")} · ${pluralize(approvalStepCount, "approval", "approvals")}`,
    nextAction: "Approve or reject"
  };
}

function workspaceForCommandRoute(route: CommandPlanRoute): WorkspaceId {
  if (route === "computer-control" || route === "app-adapters") {
    return "control";
  }
  if (route === "knowledge") {
    return "knowledge";
  }
  if (route === "automation" || route === "packaging-hardening") {
    return "automation";
  }
  if (route === "chat" || route === "profile-config") {
    return "admin";
  }
  return "command";
}

function workspaceLabel(workspaceId: WorkspaceId): string {
  return WORKSPACES.find((workspace) => workspace.id === workspaceId)?.label ?? "Command";
}

function buildWorkspaceHeaderSummary(
  workspaceId: WorkspaceId,
  badges: Record<WorkspaceId, number>
): WorkspaceHeaderSummary {
  const count = badges[workspaceId];
  return {
    label: workspaceLabel(workspaceId),
    detail: WORKSPACE_HEADER_DETAILS[workspaceId],
    countLabel: `${count} ${count === 1 ? "item" : "items"}`
  };
}

function commandContainsBlockedTerm(command: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/\s+/gu, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "iu").test(command);
}

const DEFAULT_MODEL_PLAN = JSON.stringify({
  intent: "answer_with_local_model",
  privacy_class: "local_only",
  cloud_allowed: false,
  stages: [
    {
      id: "classify-request",
      type: "model",
      role: "controller.fast"
    },
    {
      id: "draft-answer",
      type: "model",
      role: "agent.general",
      depends_on: ["classify-request"]
    },
    {
      id: "verify-answer",
      type: "model",
      role: "agent.verify",
      depends_on: ["draft-answer"]
    }
  ]
}, null, 2);

const DEFAULT_KNOWLEDGE_EVALUATION = JSON.stringify([
  {
    id: "q1",
    question: "What source explains the current project?",
    expectedDocumentName: "project-notes.md"
  }
], null, 2);

function healthClass(service: ServiceStatus): string {
  return `health health-${service.health.state}`;
}

function sortLogs(logs: readonly ServiceLogEntry[]): readonly ServiceLogEntry[] {
  return [...logs].sort((a, b) => b.id - a.id).slice(0, 6);
}

function sortTimeline(timeline: readonly ChatTimelineEntry[]): readonly ChatTimelineEntry[] {
  return [...timeline].sort((a, b) => b.id - a.id).slice(0, 8);
}

function pendingAssistantId(runId: string): string {
  return `pending-assistant-${runId}`;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function projectToDraft(project: StudioProjectSummary): ProjectDraft {
  return {
    id: project.id,
    label: project.label,
    rootPath: project.rootPath,
    profileId: project.profileId
  };
}

function privacyPresetLabel(preset: ModelPrivacyPreset): string {
  return preset
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function applyChatEvent(messages: readonly ChatMessage[], event: ChatEvent): readonly ChatMessage[] {
  if (event.type === "runStarted") {
    const assistantPlaceholder: ChatMessage = {
      id: pendingAssistantId(event.runId),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      attachments: []
    };
    return [...messages, event.message, assistantPlaceholder];
  }

  if (event.type === "assistantContent") {
    return messages.map((message) => (
      message.id === pendingAssistantId(event.runId)
        ? { ...message, content: event.content }
        : message
    ));
  }

  if (event.type === "runCompleted") {
    return messages.map((message) => (
      message.id === pendingAssistantId(event.runId) ? event.message : message
    ));
  }

  if (event.type === "runFailed") {
    return messages.map((message) => (
      message.id === pendingAssistantId(event.runId)
        ? { ...message, content: `Hermes chat failed: ${event.error}` }
        : message
    ));
  }

  if (event.type === "runCancelled") {
    return messages.map((message) => (
      message.id === pendingAssistantId(event.runId)
        ? { ...message, content: "Cancelled." }
        : message
    ));
  }

  return messages;
}

export function App(): ReactElement {
  const [snapshot, setSnapshot] = useState<ServiceSupervisorSnapshot | null>(null);
  const [commandCenterState, setCommandCenterState] = useState<CommandCenterState | null>(null);
  const [chatState, setChatState] = useState<ChatState | null>(null);
  const [profileConfigState, setProfileConfigState] = useState<ProfileConfigState | null>(null);
  const [modelFabricState, setModelFabricState] = useState<ModelFabricState | null>(null);
  const [knowledgeState, setKnowledgeState] = useState<KnowledgeRagState | null>(null);
  const [learningState, setLearningState] = useState<LearningState | null>(null);
  const [computerState, setComputerState] = useState<ComputerControlState | null>(null);
  const [browserVisionState, setBrowserVisionState] = useState<BrowserVisionState | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState | null>(null);
  const [mediaState, setMediaState] = useState<MediaState | null>(null);
  const [teachModeState, setTeachModeState] = useState<TeachModeState | null>(null);
  const [appAdapterState, setAppAdapterState] = useState<AppAdapterState | null>(null);
  const [elevatedHelperState, setElevatedHelperState] = useState<ElevatedHelperState | null>(null);
  const [automationState, setAutomationState] = useState<AutomationState | null>(null);
  const [packagingState, setPackagingState] = useState<PackagingHardeningState | null>(null);
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const [configDraft, setConfigDraft] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("default");
  const [selectedAdminProfileId, setSelectedAdminProfileId] = useState("default");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<readonly string[]>([]);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [fabricMessage, setFabricMessage] = useState<string | null>(null);
  const [selectedModelRole, setSelectedModelRole] = useState<ModelRoleAlias>("controller.fast");
  const [selectedPrivacyPreset, setSelectedPrivacyPreset] = useState<ModelPrivacyPreset>("offline-secure");
  const [selectedOverrideModelId, setSelectedOverrideModelId] = useState("");
  const [selectedLifecycleModelId, setSelectedLifecycleModelId] = useState("");
  const [planDraft, setPlanDraft] = useState(DEFAULT_MODEL_PLAN);
  const [planValidation, setPlanValidation] = useState<ModelPlanValidationResult | null>(null);
  const [knowledgeBaseDraft, setKnowledgeBaseDraft] = useState<KnowledgeBaseDraft>({
    id: "localai-global",
    label: "LocalAI Global",
    scope: "global",
    ownerId: ""
  });
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState("localai-global");
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeSearchResult, setKnowledgeSearchResult] = useState<KnowledgeSearchResult | null>(null);
  const [knowledgeEvaluationDraft, setKnowledgeEvaluationDraft] = useState(DEFAULT_KNOWLEDGE_EVALUATION);
  const [knowledgeEvaluationResult, setKnowledgeEvaluationResult] = useState<KnowledgeEvaluationResult | null>(null);
  const [knowledgeMessage, setKnowledgeMessage] = useState<string | null>(null);
  const [memoryCandidateDraft, setMemoryCandidateDraft] = useState<MemoryCandidateDraft>({
    scope: "project",
    content: "",
    note: "Manual Studio learning candidate"
  });
  const [skillCandidateDraft, setSkillCandidateDraft] = useState<SkillCandidateDraft>({
    name: "Reusable workflow",
    summary: "Describe when to use this workflow.",
    body: "steps:\n  - describe the first safe step\nverification:\n  - describe how success is verified",
    note: "Manual Studio skill candidate"
  });
  const [learningMessage, setLearningMessage] = useState<string | null>(null);
  const [selectedComputerWindowHandle, setSelectedComputerWindowHandle] = useState("");
  const [selectedComputerNodeId, setSelectedComputerNodeId] = useState<string | null>(null);
  const [activeComputerDraft, setActiveComputerDraft] = useState<ActiveComputerDraft>({
    action: "ui.invoke",
    risk: "low",
    text: "",
    chord: "TAB",
    expectedResult: "The selected control changes as expected.",
    verificationKind: "manual",
    verificationText: ""
  });
  const [computerMessage, setComputerMessage] = useState<string | null>(null);
  const [browserEngine, setBrowserEngine] = useState<BrowserEngine>("edge");
  const [browserGroundingQuery, setBrowserGroundingQuery] = useState("Run Browser Probe");
  const [browserMessage, setBrowserMessage] = useState<string | null>(null);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft>({
    language: "en",
    mode: "push-to-talk",
    utterance: "Summarize this project",
    ttsText: "Voice system ready.",
    wakeWord: "hermes",
    rms: "0.32",
    durationMs: "1200"
  });
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState("");
  const [mediaDraft, setMediaDraft] = useState<MediaDraft>({
    generationMode: "generate",
    prompt: "Clean modern product screenshot, local workflow only",
    keyframeCount: "3"
  });
  const [mediaMessage, setMediaMessage] = useState<string | null>(null);
  const [teachSessionName, setTeachSessionName] = useState("Export report workflow");
  const [selectedTeachWorkflowId, setSelectedTeachWorkflowId] = useState("");
  const [teachEventDraft, setTeachEventDraft] = useState<TeachEventDraft>({
    kind: "ui.invoke",
    appProcess: "excel",
    windowTitle: "Workbook",
    automationId: "FileMenu",
    name: "File",
    controlType: "MenuItem",
    text: "",
    filePath: "",
    waitCondition: "",
    note: "Prefer semantic selector."
  });
  const [teachMessage, setTeachMessage] = useState<string | null>(null);
  const [selectedAppAdapterId, setSelectedAppAdapterId] = useState("file-explorer");
  const [appAdapterDraft, setAppAdapterDraft] = useState<AppAdapterDraft>({
    action: "inspect-context",
    target: "D:\\LocalAI",
    intent: "Inspect the current project workspace.",
    contextKey: "source",
    contextValue: "Studio user request"
  });
  const [appAdapterMessage, setAppAdapterMessage] = useState<string | null>(null);
  const [elevatedHelperDraft, setElevatedHelperDraft] = useState<ElevatedHelperDraft>({
    purpose: "Inspect elevated app state after explicit user approval.",
    durationMinutes: "5",
    approvalCode: "",
    helperProcessId: "",
    helperElevated: false
  });
  const [elevatedHelperMessage, setElevatedHelperMessage] = useState<string | null>(null);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [automationDraft, setAutomationDraft] = useState<AutomationDraft>({
    name: "Daily project status dry-run",
    purpose: "Prepare a notification-only summary when the desktop is unlocked.",
    triggerKind: "schedule",
    scheduleStartAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scheduleRepeat: "daily",
    filePath: "D:\\LocalAI\\STATUS.md",
    fileEvent: "changed",
    actionKind: "notify",
    actionTarget: "Studio notification center",
    instructions: "Create a dry-run notification with no OS input or external calls.",
    retryCount: "1",
    disableAfterFailures: "2",
    timeoutSeconds: "60",
    notifyOnFailure: true,
    desktopUnlocked: true,
    forceFailure: false
  });
  const [automationMessage, setAutomationMessage] = useState<string | null>(null);
  const [packagingDraft, setPackagingDraft] = useState<PackagingDraft>({
    restoreExportPath: ""
  });
  const [packagingMessage, setPackagingMessage] = useState<string | null>(null);
  const [commandText, setCommandText] = useState("Create a backup and prepare a restore plan");
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [commandHandoffMessage, setCommandHandoffMessage] = useState<string | null>(null);
  const [selectedCommandPlanId, setSelectedCommandPlanId] = useState<string | null>(null);
  const [commandReviewNote, setCommandReviewNote] = useState("");
  const [commandPlanFilter, setCommandPlanFilter] = useState<CommandPlanFilter>("all");
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>("command");
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setRefreshState("refreshing");
    try {
      const [nextSnapshot, nextCommandCenterState, nextChatState, nextModelFabricState, nextKnowledgeState, nextLearningState, nextComputerState, nextBrowserVisionState, nextVoiceState, nextMediaState, nextTeachModeState, nextAppAdapterState, nextElevatedHelperState, nextAutomationState, nextPackagingState] = await Promise.all([
        window.hermesStudio.getSnapshot(),
        window.hermesStudio.getCommandCenterState(),
        window.hermesStudio.getChatState(),
        window.hermesStudio.getModelFabricState(),
        window.hermesStudio.getKnowledgeState(),
        window.hermesStudio.getLearningState(),
        window.hermesStudio.getComputerState(),
        window.hermesStudio.getBrowserVisionState(),
        window.hermesStudio.getVoiceState(),
        window.hermesStudio.getMediaState(),
        window.hermesStudio.getTeachModeState(),
        window.hermesStudio.getAppAdapterState(),
        window.hermesStudio.getElevatedHelperState(),
        window.hermesStudio.getAutomationState(),
        window.hermesStudio.getPackagingHardeningState()
      ]);
      const nextProfileConfigState = await window.hermesStudio.getProfileConfigState();
      setSnapshot(nextSnapshot);
      setCommandCenterState(nextCommandCenterState);
      setChatState(nextChatState);
      setModelFabricState(nextModelFabricState);
      setKnowledgeState(nextKnowledgeState);
      setLearningState(nextLearningState);
      setComputerState(nextComputerState);
      setBrowserVisionState(nextBrowserVisionState);
      setVoiceState(nextVoiceState);
      setMediaState(nextMediaState);
      setTeachModeState(nextTeachModeState);
      setAppAdapterState(nextAppAdapterState);
      setElevatedHelperState(nextElevatedHelperState);
      setAutomationState(nextAutomationState);
      setPackagingState(nextPackagingState);
      if (!selectedMediaAssetId && nextMediaState.selectedAssetId) {
        setSelectedMediaAssetId(nextMediaState.selectedAssetId);
      }
      if (!selectedTeachWorkflowId && nextTeachModeState.workflows[0]) {
        setSelectedTeachWorkflowId(nextTeachModeState.workflows[0].id);
      }
      if (!selectedAppAdapterId && nextAppAdapterState.adapters[0]) {
        setSelectedAppAdapterId(nextAppAdapterState.adapters[0].id);
      }
      if (!selectedAutomationId && nextAutomationState.automations[0]) {
        setSelectedAutomationId(nextAutomationState.automations[0].id);
      }
      if (!selectedComputerWindowHandle && nextComputerState.windows[0]) {
        setSelectedComputerWindowHandle(String(nextComputerState.windows[0].handle));
      }
      setProfileConfigState(nextProfileConfigState);
      setError(null);
      setRefreshState("idle");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
      setRefreshState("error");
    }
  }

  async function startService(serviceId: string): Promise<void> {
    setSnapshot(await window.hermesStudio.startService(serviceId));
  }

  async function stopService(serviceId: string): Promise<void> {
    setSnapshot(await window.hermesStudio.stopService(serviceId));
  }

  async function sendMessage(): Promise<void> {
    const prompt = draft.trim();
    if (!prompt || chatState?.runStatus === "running") {
      return;
    }

    const nextState = await window.hermesStudio.sendChatMessage({
      prompt,
      profileId: selectedProfileId,
      sessionId: selectedSessionId,
      attachmentIds: selectedAttachmentIds
    });
    setChatState(nextState);
    setDraft("");
    setSelectedAttachmentIds([]);
  }

  async function cancelChat(): Promise<void> {
    if (!chatState?.activeRunId) {
      return;
    }

    setChatState(await window.hermesStudio.cancelChatRun(chatState.activeRunId));
  }

  async function selectAttachments(): Promise<void> {
    const attachments = await window.hermesStudio.selectChatAttachments();
    if (attachments.length === 0) {
      return;
    }

    setSelectedAttachmentIds((existing) => [
      ...existing,
      ...attachments.map((attachment) => attachment.id)
    ]);
    setChatState(await window.hermesStudio.getChatState());
  }

  async function loadProfile(profileId: string): Promise<void> {
    const profile = await window.hermesStudio.getProfile(profileId);
    setSelectedAdminProfileId(profile.id);
    setProfileDraft({
      id: profile.id,
      label: profile.label,
      files: {
        "SOUL.md": profile.files["SOUL.md"],
        "USER.md": profile.files["USER.md"],
        "MEMORY.md": profile.files["MEMORY.md"]
      }
    });
  }

  async function saveProfile(): Promise<void> {
    if (!profileDraft) {
      return;
    }

    const saved = await window.hermesStudio.saveProfile(profileDraft);
    setAdminMessage(`Saved profile ${saved.id}`);
    setProfileConfigState(await window.hermesStudio.getProfileConfigState());
    await loadProfile(saved.id);
    setChatState(await window.hermesStudio.getChatState());
  }

  async function saveProject(): Promise<void> {
    if (!projectDraft) {
      return;
    }

    const saved = await window.hermesStudio.saveProject(projectDraft);
    setAdminMessage(`Saved project ${saved.id}`);
    setProfileConfigState(await window.hermesStudio.getProfileConfigState());
  }

  async function saveHermesConfig(): Promise<void> {
    if (configDraft === null) {
      return;
    }

    const saved = await window.hermesStudio.saveHermesConfig({ text: configDraft });
    setAdminMessage(`Saved config backup and ${saved.targetPath}`);
    setProfileConfigState(await window.hermesStudio.getProfileConfigState());
  }

  async function exportBackup(): Promise<void> {
    const result = await window.hermesStudio.exportStudioBackup();
    setPackagingDraft((existing) => ({ ...existing, restoreExportPath: result.exportPath }));
    setAdminMessage(`Exported backup to ${result.exportPath}`);
  }

  async function routeModelRole(): Promise<void> {
    const route = await window.hermesStudio.routeModelRole({
      role: selectedModelRole,
      privacyPreset: selectedPrivacyPreset,
      overrideModelId: selectedOverrideModelId || null
    });
    setFabricMessage(`Route ${route.role}: ${route.selectedModelId ?? "no eligible model"}`);
    setModelFabricState(await window.hermesStudio.getModelFabricState());
  }

  async function runModelLifecycle(action: "load" | "unload"): Promise<void> {
    if (!selectedLifecycleModelId) {
      return;
    }
    setModelFabricState(await window.hermesStudio.modelLifecycle({
      modelId: selectedLifecycleModelId,
      action,
      keepAliveSeconds: 300
    }));
    setFabricMessage(`${action === "load" ? "Loaded" : "Unloaded"} ${selectedLifecycleModelId}`);
  }

  async function runModelBenchmark(): Promise<void> {
    if (!selectedLifecycleModelId) {
      return;
    }
    const result = await window.hermesStudio.runModelBenchmark({
      modelId: selectedLifecycleModelId,
      role: selectedModelRole
    });
    setFabricMessage(`Benchmark ${result.status}: ${result.detail}`);
    setModelFabricState(await window.hermesStudio.getModelFabricState());
  }

  async function validateModelPlan(): Promise<void> {
    try {
      const parsed = JSON.parse(planDraft) as unknown;
      const result = await window.hermesStudio.validateModelPlan({
        plan: parsed,
        privacyPreset: selectedPrivacyPreset
      });
      setPlanValidation(result);
      setFabricMessage(result.valid ? "Plan accepted by Model Fabric." : "Plan rejected by Model Fabric.");
    } catch (parseError) {
      setPlanValidation({
        valid: false,
        errors: [{
          path: "$",
          message: parseError instanceof Error ? parseError.message : String(parseError)
        }],
        acceptedStageIds: [],
        blockedStageIds: []
      });
      setFabricMessage("Plan JSON parse failed.");
    }
  }

  async function saveKnowledgeBase(): Promise<void> {
    const saved = await window.hermesStudio.saveKnowledgeBase({
      id: knowledgeBaseDraft.id,
      label: knowledgeBaseDraft.label,
      scope: knowledgeBaseDraft.scope,
      ownerId: knowledgeBaseDraft.ownerId.trim() || null
    });
    setSelectedKnowledgeBaseId(saved.id);
    setKnowledgeMessage(`Saved knowledge base ${saved.id}`);
    setKnowledgeState(await window.hermesStudio.getKnowledgeState());
  }

  async function selectKnowledgeFiles(): Promise<void> {
    const result = await window.hermesStudio.selectKnowledgeFiles(selectedKnowledgeBaseId);
    setKnowledgeMessage(`Indexed ${result.accepted.length} file(s), rejected ${result.rejected.length}.`);
    setKnowledgeState(await window.hermesStudio.getKnowledgeState());
  }

  async function searchKnowledge(): Promise<void> {
    const result = await window.hermesStudio.searchKnowledge({
      baseId: selectedKnowledgeBaseId,
      query: knowledgeQuery,
      limit: 5
    });
    setKnowledgeSearchResult(result);
    setKnowledgeState(await window.hermesStudio.getKnowledgeState());
  }

  async function evaluateKnowledge(): Promise<void> {
    const parsed = JSON.parse(knowledgeEvaluationDraft) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Evaluation JSON must be an array.");
    }
    const result = await window.hermesStudio.evaluateKnowledge({
      baseId: selectedKnowledgeBaseId,
      questions: parsed
    });
    setKnowledgeEvaluationResult(result);
    setKnowledgeState(await window.hermesStudio.getKnowledgeState());
  }

  async function proposeMemoryCandidate(): Promise<void> {
    const candidate = await window.hermesStudio.proposeMemoryCandidate({
      scope: memoryCandidateDraft.scope,
      content: memoryCandidateDraft.content,
      confidence: 0.8,
      provenance: {
        sourceKind: "manual",
        sourceId: null,
        profileId: selectedProfileId,
        projectId: selectedKnowledgeBaseId,
        note: memoryCandidateDraft.note
      }
    });
    setLearningMessage(`Proposed memory ${candidate.id}`);
    setMemoryCandidateDraft((existing) => ({ ...existing, content: "" }));
    setLearningState(await window.hermesStudio.getLearningState());
  }

  async function reviewMemoryCandidate(candidateId: string, decision: "approve" | "reject"): Promise<void> {
    setLearningState(await window.hermesStudio.reviewMemoryCandidate({
      candidateId,
      decision,
      reviewNote: decision === "approve" ? "Approved in Studio learning queue." : "Rejected in Studio learning queue."
    }));
    setLearningMessage(`${decision === "approve" ? "Approved" : "Rejected"} memory candidate ${candidateId}`);
  }

  async function proposeSkillCandidate(): Promise<void> {
    const candidate = await window.hermesStudio.proposeSkillCandidate({
      name: skillCandidateDraft.name,
      summary: skillCandidateDraft.summary,
      body: skillCandidateDraft.body,
      provenance: {
        sourceKind: "manual",
        sourceId: null,
        profileId: selectedProfileId,
        projectId: selectedKnowledgeBaseId,
        note: skillCandidateDraft.note
      }
    });
    setLearningMessage(`Proposed skill ${candidate.id}`);
    setLearningState(await window.hermesStudio.getLearningState());
  }

  async function reviewSkillCandidate(candidateId: string, decision: "approve" | "reject"): Promise<void> {
    setLearningState(await window.hermesStudio.reviewSkillCandidate({
      candidateId,
      decision,
      reviewNote: decision === "approve" ? "Approved in Studio learning queue." : "Rejected in Studio learning queue."
    }));
    setLearningMessage(`${decision === "approve" ? "Approved" : "Rejected"} skill candidate ${candidateId}`);
  }

  async function rollbackSkillVersion(skillId: string, version: number): Promise<void> {
    setLearningState(await window.hermesStudio.rollbackSkillVersion({
      skillId,
      version,
      reviewNote: `Rolled back to version ${version} from Studio.`
    }));
    setLearningMessage(`Rolled back ${skillId} to version ${version}`);
  }

  async function refreshComputerWindows(): Promise<void> {
    const windowList = await window.hermesStudio.listComputerWindows();
    setComputerState((existing) => existing
      ? { ...existing, windows: windowList.windows }
      : null);
    if (!selectedComputerWindowHandle && windowList.windows[0]) {
      setSelectedComputerWindowHandle(String(windowList.windows[0].handle));
    }
    setComputerMessage(`Observed ${windowList.windows.length} window(s).`);
  }

  async function inspectComputerWindow(): Promise<void> {
    const windowHandle = selectedComputerWindowHandle ? Number(selectedComputerWindowHandle) : null;
    const tree = await window.hermesStudio.getComputerUiTree({
      windowHandle,
      maxDepth: 3,
      maxNodes: 120
    });
    setComputerState(await window.hermesStudio.getComputerState());
    setComputerMessage(`Observed ${tree.nodes.length} UI node(s).`);
  }

  async function captureComputerScreen(): Promise<void> {
    const screenshot = await window.hermesStudio.captureComputerScreen();
    setComputerState(await window.hermesStudio.getComputerState());
    setComputerMessage(`Captured ${screenshot.width} x ${screenshot.height}.`);
  }

  async function highlightComputerNode(node: ComputerUiNode): Promise<void> {
    if (!node.bounds) {
      return;
    }
    const screenshot = await window.hermesStudio.highlightComputerElement({ bounds: node.bounds });
    setComputerState(await window.hermesStudio.getComputerState());
    setComputerMessage(`Highlighted ${screenshot.highlightBounds ? `${screenshot.highlightBounds.width} x ${screenshot.highlightBounds.height}` : "element"}.`);
  }

  function buildActiveComputerTarget(): {
    readonly windowHandle: number | null;
    readonly automationId?: string | null;
    readonly name?: string | null;
    readonly controlType?: string | null;
    readonly bounds?: ComputerUiNode["bounds"];
  } {
    const windowHandle = selectedComputerWindowHandle ? Number(selectedComputerWindowHandle) : null;
    if (!selectedComputerNode) {
      return { windowHandle };
    }

    return {
      windowHandle,
      automationId: selectedComputerNode.automationId,
      name: selectedComputerNode.name,
      controlType: selectedComputerNode.controlType,
      bounds: selectedComputerNode.bounds
    };
  }

  async function proposeActiveComputerAction(): Promise<void> {
    try {
      const action = await window.hermesStudio.proposeComputerAction({
        action: activeComputerDraft.action,
        target: buildActiveComputerTarget(),
        risk: activeComputerDraft.risk,
        expectedResult: activeComputerDraft.expectedResult,
        verification: activeComputerDraft.verificationKind === "ui-tree-contains"
          ? { kind: "ui-tree-contains", expectedText: activeComputerDraft.verificationText }
          : { kind: activeComputerDraft.verificationKind },
        ...(activeComputerDraft.action === "ui.set_value" || activeComputerDraft.action === "keyboard.type"
          ? { text: activeComputerDraft.text }
          : {}),
        ...(activeComputerDraft.action === "keyboard.chord" ? { chord: activeComputerDraft.chord } : {})
      });
      setComputerState(await window.hermesStudio.getComputerState());
      setComputerMessage(`Proposed ${action.action}; explicit approval is required.`);
    } catch (proposalError) {
      setComputerMessage(proposalError instanceof Error ? proposalError.message : String(proposalError));
    }
  }

  async function reviewComputerAction(actionId: string, decision: "approve" | "reject"): Promise<void> {
    try {
      setComputerState(await window.hermesStudio.reviewComputerAction({
        actionId,
        decision,
        reviewNote: decision === "approve" ? "Approved in Studio active-control queue." : "Rejected in Studio active-control queue."
      }));
      setComputerMessage(`${decision === "approve" ? "Approved" : "Rejected"} ${actionId}.`);
    } catch (reviewError) {
      setComputerMessage(reviewError instanceof Error ? reviewError.message : String(reviewError));
    }
  }

  async function executeComputerAction(actionId: string): Promise<void> {
    try {
      setComputerState(await window.hermesStudio.executeComputerAction({ actionId }));
      setComputerMessage(`Execution finished for ${actionId}.`);
    } catch (executeError) {
      setComputerMessage(executeError instanceof Error ? executeError.message : String(executeError));
    }
  }

  async function emergencyStopComputer(): Promise<void> {
    setComputerState(await window.hermesStudio.emergencyStopComputer());
    setComputerMessage("Emergency stop is active. Reset is required before active control resumes.");
  }

  async function resetComputerEmergencyStop(): Promise<void> {
    setComputerState(await window.hermesStudio.resetComputerEmergencyStop());
    setComputerMessage("Emergency stop reset. Active actions still require explicit approval.");
  }

  async function inspectBrowser(): Promise<void> {
    try {
      const state = await window.hermesStudio.inspectBrowser({ engine: browserEngine });
      setBrowserVisionState(state);
      setBrowserMessage(`Inspected ${state.lastInspection?.elements.length ?? 0} browser element(s).`);
    } catch (inspectError) {
      setBrowserMessage(inspectError instanceof Error ? inspectError.message : String(inspectError));
    }
  }

  async function groundBrowserElement(): Promise<void> {
    try {
      const state = await window.hermesStudio.groundBrowserElement({
        engine: browserEngine,
        query: browserGroundingQuery
      });
      setBrowserVisionState(state);
      const selected = state.lastGrounding?.candidates.find((candidate) => candidate.id === state.lastGrounding?.selectedCandidateId);
      setBrowserMessage(selected
        ? `Grounded ${selected.text || selected.selector} at ${Math.round(selected.confidence * 100)}%.`
        : "No browser grounding candidate found.");
    } catch (groundError) {
      setBrowserMessage(groundError instanceof Error ? groundError.message : String(groundError));
    }
  }

  async function reviewBrowserGrounding(approvalId: string, decision: "approve" | "reject"): Promise<void> {
    try {
      setBrowserVisionState(await window.hermesStudio.reviewBrowserGrounding({
        approvalId,
        decision,
        reviewNote: decision === "approve" ? "Approved low-confidence browser grounding." : "Rejected low-confidence browser grounding."
      }));
      setBrowserMessage(`${decision === "approve" ? "Approved" : "Rejected"} browser grounding ${approvalId}.`);
    } catch (reviewError) {
      setBrowserMessage(reviewError instanceof Error ? reviewError.message : String(reviewError));
    }
  }

  async function setVoiceMicrophonePermission(permission: "granted" | "denied"): Promise<void> {
    if (permission === "denied") {
      setVoiceState(await window.hermesStudio.setVoiceMicrophonePermission({
        permission,
        deviceLabel: null
      }));
      setVoiceMessage("Microphone permission denied.");
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser microphone API is not available.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0] ?? null;
      const deviceLabel = audioTrack?.label || "Default microphone";
      stream.getTracks().forEach((track) => track.stop());
      setVoiceState(await window.hermesStudio.setVoiceMicrophonePermission({
        permission: "granted",
        deviceLabel
      }));
      setVoiceMessage(`Microphone permission granted for ${deviceLabel}.`);
    } catch (microphoneError) {
      setVoiceState(await window.hermesStudio.setVoiceMicrophonePermission({
        permission: "denied",
        deviceLabel: null
      }));
      setVoiceMessage(microphoneError instanceof Error ? microphoneError.message : String(microphoneError));
    }
  }

  async function configureVoice(): Promise<void> {
    setVoiceState(await window.hermesStudio.configureVoice({
      wakeWordEnabled: voiceDraft.mode === "wake-word",
      wakeWord: voiceDraft.wakeWord
    }));
    setVoiceMessage(voiceDraft.mode === "wake-word" ? `Wake word set to ${voiceDraft.wakeWord}.` : "Wake word disabled for push-to-talk.");
  }

  async function startVoiceCapture(): Promise<void> {
    try {
      await configureVoice();
      setVoiceState(await window.hermesStudio.startVoiceCapture({
        mode: voiceDraft.mode,
        language: voiceDraft.language
      }));
      setVoiceMessage(voiceDraft.mode === "wake-word" ? "Wake-word capture started." : "Push-to-talk capture started.");
    } catch (voiceError) {
      setVoiceMessage(voiceError instanceof Error ? voiceError.message : String(voiceError));
    }
  }

  async function stopVoiceCapture(): Promise<void> {
    setVoiceState(await window.hermesStudio.stopVoiceCapture({ reason: "Stopped from Studio voice panel." }));
    setVoiceMessage("Voice capture stopped.");
  }

  async function submitVoiceUtterance(): Promise<void> {
    try {
      const state = await window.hermesStudio.submitVoiceUtterance({
        text: voiceDraft.utterance,
        language: voiceDraft.language,
        rms: Number.parseFloat(voiceDraft.rms),
        durationMs: Number.parseInt(voiceDraft.durationMs, 10),
        sessionId: voiceState?.session.id ?? null
      });
      setVoiceState(state);
      const transcript = state.transcripts[0];
      if (transcript?.status === "accepted" && transcript.commandDraft) {
        setDraft(transcript.commandDraft);
        setVoiceMessage("Transcript accepted and staged as a chat draft.");
      } else {
        setVoiceMessage(transcript?.reason ?? "Voice utterance was not accepted.");
      }
    } catch (voiceError) {
      setVoiceMessage(voiceError instanceof Error ? voiceError.message : String(voiceError));
    }
  }

  async function speakVoice(): Promise<void> {
    try {
      setVoiceState(await window.hermesStudio.speakVoice({
        text: voiceDraft.ttsText,
        language: voiceDraft.language
      }));
      setVoiceMessage("Text-to-speech queued locally.");
    } catch (voiceError) {
      setVoiceMessage(voiceError instanceof Error ? voiceError.message : String(voiceError));
    }
  }

  async function interruptVoice(): Promise<void> {
    setVoiceState(await window.hermesStudio.interruptVoice("manual"));
    setVoiceMessage("Voice output interrupted.");
  }

  async function runVoiceSelfTest(): Promise<void> {
    const state = await window.hermesStudio.runVoiceSelfTest();
    setVoiceState(state);
    setVoiceMessage(`Voice self-test ${state.lastSelfTest?.status ?? "failed"}.`);
  }

  function requireSelectedMediaAssetId(): string {
    const assetId = selectedMediaAssetId || mediaState?.selectedAssetId;
    if (!assetId) {
      throw new Error("Select a media asset first.");
    }
    return assetId;
  }

  function applyMediaState(state: MediaState): void {
    setMediaState(state);
    if (state.selectedAssetId) {
      setSelectedMediaAssetId(state.selectedAssetId);
    }
  }

  async function selectMediaFiles(): Promise<void> {
    try {
      const state = await window.hermesStudio.selectMediaFiles();
      applyMediaState(state);
      setMediaMessage(`Loaded ${state.assets.length} media asset(s).`);
    } catch (mediaError) {
      setMediaMessage(mediaError instanceof Error ? mediaError.message : String(mediaError));
    }
  }

  async function selectMediaAsset(assetId: string): Promise<void> {
    try {
      setSelectedMediaAssetId(assetId);
      applyMediaState(await window.hermesStudio.selectMediaAsset({ assetId }));
    } catch (mediaError) {
      setMediaMessage(mediaError instanceof Error ? mediaError.message : String(mediaError));
    }
  }

  async function understandSelectedImage(): Promise<void> {
    try {
      const assetId = requireSelectedMediaAssetId();
      const state = await window.hermesStudio.understandImage({ assetId });
      applyMediaState(state);
      setMediaMessage("Image understanding completed.");
    } catch (mediaError) {
      setMediaMessage(mediaError instanceof Error ? mediaError.message : String(mediaError));
    }
  }

  async function runSelectedImageOcr(): Promise<void> {
    try {
      const assetId = requireSelectedMediaAssetId();
      const state = await window.hermesStudio.runImageOcr({ assetId });
      applyMediaState(state);
      setMediaMessage("OCR completed.");
    } catch (mediaError) {
      setMediaMessage(mediaError instanceof Error ? mediaError.message : String(mediaError));
    }
  }

  async function probeComfyUi(): Promise<void> {
    const state = await window.hermesStudio.probeComfyUi();
    applyMediaState(state);
    setMediaMessage(state.comfyUi?.detail ?? "ComfyUI probe finished.");
  }

  async function createImageGeneration(): Promise<void> {
    try {
      const sourceAsset = (mediaState?.assets ?? []).find((asset) => asset.id === selectedMediaAssetId) ?? null;
      const state = await window.hermesStudio.createImageGeneration({
        mode: mediaDraft.generationMode,
        prompt: mediaDraft.prompt,
        sourceAssetId: mediaDraft.generationMode === "edit" ? sourceAsset?.id ?? null : null
      });
      applyMediaState(state);
      setMediaMessage("Created local image workflow and preview artifact.");
    } catch (mediaError) {
      setMediaMessage(mediaError instanceof Error ? mediaError.message : String(mediaError));
    }
  }

  async function probeSelectedVideo(): Promise<void> {
    try {
      const assetId = requireSelectedMediaAssetId();
      const state = await window.hermesStudio.probeVideo({ assetId });
      applyMediaState(state);
      setMediaMessage("Video probe completed.");
    } catch (mediaError) {
      setMediaMessage(mediaError instanceof Error ? mediaError.message : String(mediaError));
    }
  }

  async function extractSelectedVideoAudio(): Promise<void> {
    try {
      const assetId = requireSelectedMediaAssetId();
      const state = await window.hermesStudio.extractVideoAudio({ assetId });
      applyMediaState(state);
      setMediaMessage("Audio extraction artifact created.");
    } catch (mediaError) {
      setMediaMessage(mediaError instanceof Error ? mediaError.message : String(mediaError));
    }
  }

  async function sampleSelectedVideoKeyframes(): Promise<void> {
    try {
      const assetId = requireSelectedMediaAssetId();
      const state = await window.hermesStudio.sampleVideoKeyframes({
        assetId,
        count: Number.parseInt(mediaDraft.keyframeCount, 10)
      });
      applyMediaState(state);
      setMediaMessage("Keyframe artifacts created.");
    } catch (mediaError) {
      setMediaMessage(mediaError instanceof Error ? mediaError.message : String(mediaError));
    }
  }

  async function summarizeSelectedVideo(): Promise<void> {
    try {
      const assetId = requireSelectedMediaAssetId();
      const state = await window.hermesStudio.summarizeVideo({ assetId });
      applyMediaState(state);
      setMediaMessage("Video summary completed.");
    } catch (mediaError) {
      setMediaMessage(mediaError instanceof Error ? mediaError.message : String(mediaError));
    }
  }

  function applyTeachState(state: TeachModeState): void {
    setTeachModeState(state);
    if (!selectedTeachWorkflowId && state.workflows[0]) {
      setSelectedTeachWorkflowId(state.workflows[0].id);
    }
  }

  async function startTeachSession(): Promise<void> {
    try {
      const state = await window.hermesStudio.startTeachSession({ name: teachSessionName });
      applyTeachState(state);
      setTeachMessage("Teach Mode recording started.");
    } catch (teachError) {
      setTeachMessage(teachError instanceof Error ? teachError.message : String(teachError));
    }
  }

  async function recordTeachEvent(): Promise<void> {
    try {
      const state = await window.hermesStudio.recordTeachEvent({
        kind: teachEventDraft.kind,
        selector: {
          appProcess: teachEventDraft.appProcess || null,
          windowTitle: teachEventDraft.windowTitle || null,
          automationId: teachEventDraft.automationId || null,
          name: teachEventDraft.name || null,
          controlType: teachEventDraft.controlType || null,
          bounds: null,
          semanticPath: [teachEventDraft.appProcess, teachEventDraft.windowTitle, teachEventDraft.name]
            .filter((part) => part.trim().length > 0)
        },
        text: teachEventDraft.text || null,
        filePath: teachEventDraft.filePath || null,
        waitCondition: teachEventDraft.waitCondition || null,
        note: teachEventDraft.note
      });
      applyTeachState(state);
      setTeachMessage(`Recorded ${teachEventDraft.kind}.`);
    } catch (teachError) {
      setTeachMessage(teachError instanceof Error ? teachError.message : String(teachError));
    }
  }

  async function stopTeachSession(): Promise<void> {
    try {
      const state = await window.hermesStudio.stopTeachSession();
      applyTeachState(state);
      setTeachMessage("Teach Mode recording stopped.");
    } catch (teachError) {
      setTeachMessage(teachError instanceof Error ? teachError.message : String(teachError));
    }
  }

  async function generateTeachWorkflow(): Promise<void> {
    const sessionId = teachModeState?.sessions[0]?.id;
    if (!sessionId) {
      setTeachMessage("Record a Teach Mode session first.");
      return;
    }
    try {
      const state = await window.hermesStudio.generateTeachWorkflow({
        sessionId,
        name: teachSessionName
      });
      applyTeachState(state);
      setSelectedTeachWorkflowId(state.workflows[0]?.id ?? "");
      setTeachMessage("Workflow generated with parameters and verification.");
    } catch (teachError) {
      setTeachMessage(teachError instanceof Error ? teachError.message : String(teachError));
    }
  }

  async function createTeachReplay(): Promise<void> {
    const workflowId = selectedTeachWorkflowId || teachModeState?.workflows[0]?.id;
    if (!workflowId) {
      setTeachMessage("Generate a workflow first.");
      return;
    }
    const state = await window.hermesStudio.createTeachReplay({ workflowId });
    applyTeachState(state);
    setTeachMessage("Created dry-run replay plan; approval is required.");
  }

  async function reviewTeachReplay(replayId: string, decision: "approve" | "reject"): Promise<void> {
    try {
      const state = await window.hermesStudio.reviewTeachReplay({
        replayId,
        decision,
        reviewNote: decision === "approve" ? "Approved supervised Teach Mode dry-run." : "Rejected Teach Mode dry-run."
      });
      applyTeachState(state);
      setTeachMessage(`${decision === "approve" ? "Approved" : "Rejected"} replay ${replayId}.`);
    } catch (teachError) {
      setTeachMessage(teachError instanceof Error ? teachError.message : String(teachError));
    }
  }

  async function convertTeachWorkflowToSkill(): Promise<void> {
    const workflowId = selectedTeachWorkflowId || teachModeState?.workflows[0]?.id;
    if (!workflowId) {
      setTeachMessage("Generate a workflow first.");
      return;
    }
    const state = await window.hermesStudio.convertTeachWorkflowToSkill({ workflowId });
    applyTeachState(state);
    setTeachMessage("Created pending skill candidate from workflow.");
  }

  async function reviewTeachSkillCandidate(candidateId: string, decision: "approve" | "reject"): Promise<void> {
    const state = await window.hermesStudio.reviewTeachSkillCandidate({
      candidateId,
      decision,
      reviewNote: decision === "approve" ? "Approved Teach Mode skill candidate." : "Rejected Teach Mode skill candidate."
    });
    applyTeachState(state);
    setTeachMessage(`${decision === "approve" ? "Approved" : "Rejected"} Teach Mode skill candidate.`);
  }

  async function probeAppAdapters(): Promise<void> {
    try {
      const state = await window.hermesStudio.probeAppAdapters({});
      setAppAdapterState(state);
      setAppAdapterMessage(`Probed ${state.adapters.length} app adapter(s).`);
    } catch (adapterError) {
      setAppAdapterMessage(adapterError instanceof Error ? adapterError.message : String(adapterError));
    }
  }

  async function createAppAdapterPlan(): Promise<void> {
    try {
      const context = appAdapterDraft.contextKey.trim() && appAdapterDraft.contextValue.trim()
        ? [{ key: appAdapterDraft.contextKey, value: appAdapterDraft.contextValue }]
        : [];
      const plan = await window.hermesStudio.createAppAdapterPlan({
        adapterId: selectedAppAdapterId,
        action: appAdapterDraft.action,
        target: appAdapterDraft.target,
        intent: appAdapterDraft.intent,
        context
      });
      setAppAdapterState(await window.hermesStudio.getAppAdapterState());
      setAppAdapterMessage(`Created ${plan.risk} risk adapter plan ${plan.id}.`);
    } catch (adapterError) {
      setAppAdapterMessage(adapterError instanceof Error ? adapterError.message : String(adapterError));
    }
  }

  async function reviewAppAdapterPlan(planId: string, decision: "approve" | "reject"): Promise<void> {
    try {
      const state = await window.hermesStudio.reviewAppAdapterPlan({
        planId,
        decision,
        reviewNote: decision === "approve" ? "Approved app adapter plan." : "Rejected app adapter plan."
      });
      setAppAdapterState(state);
      setAppAdapterMessage(`${decision === "approve" ? "Approved" : "Rejected"} adapter plan ${planId}.`);
    } catch (adapterError) {
      setAppAdapterMessage(adapterError instanceof Error ? adapterError.message : String(adapterError));
    }
  }

  async function probeElevatedHelper(): Promise<void> {
    try {
      const state = await window.hermesStudio.probeElevatedHelper();
      setElevatedHelperState(state);
      setElevatedHelperMessage(state.helper.detail);
    } catch (helperError) {
      setElevatedHelperMessage(helperError instanceof Error ? helperError.message : String(helperError));
    }
  }

  async function prepareElevatedHelperLaunch(): Promise<void> {
    try {
      const state = await window.hermesStudio.prepareElevatedHelperLaunch({
        purpose: elevatedHelperDraft.purpose,
        durationMinutes: Number.parseInt(elevatedHelperDraft.durationMinutes, 10)
      });
      setElevatedHelperState(state);
      const pending = state.sessions[0];
      if (pending) {
        setElevatedHelperDraft((existing) => ({ ...existing, approvalCode: pending.approvalCode }));
      }
      setElevatedHelperMessage("Manual UAC launch instruction prepared.");
    } catch (helperError) {
      setElevatedHelperMessage(helperError instanceof Error ? helperError.message : String(helperError));
    }
  }

  async function confirmElevatedHelperSession(sessionId: string): Promise<void> {
    try {
      const state = await window.hermesStudio.confirmElevatedHelperSession({
        sessionId,
        approvalCode: elevatedHelperDraft.approvalCode,
        helperProcessId: Number.parseInt(elevatedHelperDraft.helperProcessId, 10),
        helperElevated: elevatedHelperDraft.helperElevated
      });
      setElevatedHelperState(state);
      setElevatedHelperMessage(`Reviewed elevated helper session ${sessionId}.`);
    } catch (helperError) {
      setElevatedHelperMessage(helperError instanceof Error ? helperError.message : String(helperError));
    }
  }

  async function revokeElevatedHelperSession(sessionId: string): Promise<void> {
    try {
      const state = await window.hermesStudio.revokeElevatedHelperSession({
        sessionId,
        reason: "Revoked from Studio UI."
      });
      setElevatedHelperState(state);
      setElevatedHelperMessage(`Revoked elevated helper session ${sessionId}.`);
    } catch (helperError) {
      setElevatedHelperMessage(helperError instanceof Error ? helperError.message : String(helperError));
    }
  }

  async function createAutomation(): Promise<void> {
    try {
      const trigger = automationDraft.triggerKind === "manual"
        ? { kind: "manual" as const }
        : automationDraft.triggerKind === "schedule"
          ? {
              kind: "schedule" as const,
              startAt: automationDraft.scheduleStartAt,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              repeat: automationDraft.scheduleRepeat
            }
          : {
              kind: "file-change" as const,
              path: automationDraft.filePath,
              event: automationDraft.fileEvent,
              recursive: false as const
            };
      const state = await window.hermesStudio.createAutomation({
        name: automationDraft.name,
        purpose: automationDraft.purpose,
        trigger,
        action: {
          kind: automationDraft.actionKind,
          target: automationDraft.actionTarget,
          instructions: automationDraft.instructions
        },
        failurePolicy: {
          retryCount: Number.parseInt(automationDraft.retryCount, 10),
          disableAfterFailures: Number.parseInt(automationDraft.disableAfterFailures, 10),
          timeoutSeconds: Number.parseInt(automationDraft.timeoutSeconds, 10),
          notifyOnFailure: automationDraft.notifyOnFailure
        }
      });
      setAutomationState(state);
      const created = state.automations[0];
      if (created) {
        setSelectedAutomationId(created.id);
        setAutomationMessage(`Created draft automation ${created.id}.`);
      }
    } catch (automationError) {
      setAutomationMessage(automationError instanceof Error ? automationError.message : String(automationError));
    }
  }

  async function reviewAutomation(automationId: string, decision: "approve" | "reject"): Promise<void> {
    try {
      const state = await window.hermesStudio.reviewAutomation({
        automationId,
        decision,
        reviewNote: decision === "approve" ? "Approved dry-run automation." : "Rejected automation draft."
      });
      setAutomationState(state);
      setAutomationMessage(`${decision === "approve" ? "Approved" : "Rejected"} automation ${automationId}.`);
    } catch (automationError) {
      setAutomationMessage(automationError instanceof Error ? automationError.message : String(automationError));
    }
  }

  async function simulateAutomation(forceFailure = false): Promise<void> {
    const automationId = selectedAutomationId ?? automationState?.automations[0]?.id;
    const selectedAutomation = (automationState?.automations ?? []).find((automation) => automation.id === automationId);
    if (!automationId || !selectedAutomation) {
      setAutomationMessage("Create and approve an automation first.");
      return;
    }
    try {
      const state = await window.hermesStudio.simulateAutomation({
        automationId,
        triggerKind: selectedAutomation.trigger.kind,
        desktopUnlocked: automationDraft.desktopUnlocked,
        ...(forceFailure || automationDraft.forceFailure ? { forceFailure: true } : {})
      });
      setAutomationState(state);
      const latestRun = state.runs[0];
      setAutomationMessage(latestRun ? `${latestRun.status}: ${latestRun.summary}` : `Simulated automation ${automationId}.`);
    } catch (automationError) {
      setAutomationMessage(automationError instanceof Error ? automationError.message : String(automationError));
    }
  }

  async function disableAutomation(automationId: string): Promise<void> {
    try {
      const state = await window.hermesStudio.disableAutomation({
        automationId,
        reason: "Disabled from Studio automation workspace."
      });
      setAutomationState(state);
      setAutomationMessage(`Disabled automation ${automationId}.`);
    } catch (automationError) {
      setAutomationMessage(automationError instanceof Error ? automationError.message : String(automationError));
    }
  }

  async function inspectPackagingHardening(): Promise<void> {
    try {
      const state = await window.hermesStudio.inspectPackagingHardening();
      setPackagingState(state);
      setPackagingMessage(`Readiness: dependencies ${state.dependencyReadiness.status}, security ${state.securityReview.status}, performance ${state.performanceReview.status}.`);
    } catch (packagingError) {
      setPackagingMessage(packagingError instanceof Error ? packagingError.message : String(packagingError));
    }
  }

  async function createInstallerManifest(): Promise<void> {
    try {
      const state = await window.hermesStudio.createInstallerManifest({ target: "local-portable" });
      setPackagingState(state);
      setPackagingMessage(state.latestInstallerManifest ? `Created package manifest ${state.latestInstallerManifest.manifestPath}.` : "Created package manifest.");
    } catch (packagingError) {
      setPackagingMessage(packagingError instanceof Error ? packagingError.message : String(packagingError));
    }
  }

  async function createRestorePlan(): Promise<void> {
    try {
      const state = await window.hermesStudio.createRestorePlan({
        exportPath: packagingDraft.restoreExportPath
      });
      setPackagingState(state);
      const plan = state.restorePlans[0];
      setPackagingMessage(plan ? `Created restore plan ${plan.id}.` : "Created restore plan.");
    } catch (packagingError) {
      setPackagingMessage(packagingError instanceof Error ? packagingError.message : String(packagingError));
    }
  }

  function applyCommandStarter(starter: CommandStarterAction): void {
    setCommandText(starter.command);
    setCommandMessage(`Loaded ${starter.label} starter for ${workspaceLabel(starter.workspace)}. Press Make Plan to review it.`);
    setCommandHandoffMessage(null);
  }

  async function createCommandPlan(commandOverride?: string): Promise<void> {
    try {
      const command = commandOverride ?? commandText;
      setCommandText(command);
      const state = await window.hermesStudio.createCommandPlan({
        command,
        context: selectedRoute ? `Active model route: ${selectedRoute.role}` : "Studio command center"
      });
      setCommandCenterState(state);
      const plan = state.plans[0];
      setSelectedCommandPlanId(plan?.id ?? null);
      setCommandReviewNote("");
      setCommandHandoffMessage(null);
      setCommandMessage(plan ? `${plan.title}: ${plan.summary}` : "Created command plan.");
    } catch (commandError) {
      setCommandMessage(commandError instanceof Error ? commandError.message : String(commandError));
    }
  }

  async function reviewCommandPlan(planId: string, decision: "approve" | "reject"): Promise<void> {
    try {
      const defaultReviewNote = decision === "approve" ? "Approved from Command Center." : "Rejected from Command Center.";
      const selectedReviewNote = selectedCommandPlanId === planId ? commandReviewNote.trim() : "";
      const state = await window.hermesStudio.reviewCommandPlan({
        planId,
        decision,
        reviewNote: selectedReviewNote || defaultReviewNote
      });
      setCommandCenterState(state);
      const reviewedPlan = state.plans.find((plan) => plan.id === planId) ?? null;
      setSelectedCommandPlanId(planId);
      setCommandReviewNote(reviewedPlan?.reviewNote ?? "");
      if (decision === "approve" && reviewedPlan) {
        const nextWorkspace = workspaceForCommandRoute(reviewedPlan.route);
        setActiveWorkspace(nextWorkspace);
        setCommandHandoffMessage(`${reviewedPlan.title} opened ${workspaceLabel(nextWorkspace)}.`);
      } else {
        setCommandHandoffMessage(null);
      }
      setCommandMessage(`${decision === "approve" ? "Approved" : "Rejected"} command plan ${planId}.`);
    } catch (commandError) {
      setCommandMessage(commandError instanceof Error ? commandError.message : String(commandError));
    }
  }

  function useCommandRevisionDraft(plan: CommandPlan): void {
    const revisionDraft = buildCommandRevisionDraft(plan, commandReviewNote, commandCenterState?.policy.maxCommandChars ?? 600);
    if (!revisionDraft.ready || plan.status === "approved") {
      setCommandMessage("Add a review note or use blocked feedback before preparing a revision draft.");
      return;
    }
    setCommandText(revisionDraft.command);
    setCommandPlanFilter("all");
    setCommandHandoffMessage(null);
    setCommandMessage(`Revision draft prepared from ${plan.title}. Press Make Plan to review it.`);
  }

  function handleCommandFocusAction(actionId: CommandFocusActionId): void {
    if (actionId === "make-plan") {
      void createCommandPlan();
      return;
    }

    if (actionId === "review-plan") {
      const reviewTargetPlan = findCommandReviewTargetPlan(commandCenterState?.plans ?? []);
      if (!reviewTargetPlan) {
        setCommandMessage("No command plan is available for review.");
        return;
      }
      setCommandPlanFilter("all");
      setSelectedCommandPlanId(reviewTargetPlan.id);
      setCommandReviewNote(reviewTargetPlan.reviewNote ?? "");
      setCommandHandoffMessage(null);
      setCommandMessage(`Reviewing ${reviewTargetPlan.title}.`);
      return;
    }

    if (actionId === "use-revision") {
      if (!selectedCommandPlan) {
        setCommandMessage("Select a command plan before preparing a revision.");
        return;
      }
      useCommandRevisionDraft(selectedCommandPlan);
      return;
    }

    if (actionId === "open-handoff") {
      if (selectedCommandPlan?.status !== "approved") {
        setCommandMessage("Approve the command plan before opening handoff.");
        return;
      }
      const nextWorkspace = workspaceForCommandRoute(selectedCommandPlan.route);
      setActiveWorkspace(nextWorkspace);
      setCommandHandoffMessage(`${selectedCommandPlan.title} opened ${workspaceLabel(nextWorkspace)}.`);
      setCommandMessage(`Opened ${workspaceLabel(nextWorkspace)} from ${selectedCommandPlan.title}.`);
    }
  }

  useEffect(() => {
    void refresh();
    const unsubscribe = window.hermesStudio.onChatEvent((event) => {
      setMessages((existing) => applyChatEvent(existing, event));
      if ("state" in event) {
        setChatState(event.state);
        if (event.state.activeSessionId) {
          setSelectedSessionId(event.state.activeSessionId);
        }
      }
    });
    const timer = window.setInterval(() => {
      void refresh();
    }, 7000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!profileConfigState) {
      return;
    }
    if (!profileDraft) {
      void loadProfile(profileConfigState.activeProfileId);
    }
    if (!projectDraft) {
      const activeProject = profileConfigState.projects.find((project) => project.id === profileConfigState.activeProjectId)
        ?? profileConfigState.projects[0];
      if (activeProject) {
        setProjectDraft(projectToDraft(activeProject));
      }
    }
    if (configDraft === null) {
      setConfigDraft(profileConfigState.hermesConfig.text);
    }
  }, [profileConfigState, profileDraft, projectDraft, configDraft]);

  const recentLogs = useMemo(() => sortLogs(snapshot?.logs ?? []), [snapshot]);
  const recentTimeline = useMemo(() => sortTimeline(chatState?.timeline ?? []), [chatState]);
  const selectedAttachments = useMemo(() => {
    const attachments = chatState?.attachments ?? [];
    return selectedAttachmentIds
      .map((id) => attachments.find((attachment) => attachment.id === id))
      .filter((attachment): attachment is ChatAttachment => Boolean(attachment));
  }, [chatState, selectedAttachmentIds]);
  const selectedRoute = useMemo(() => (
    modelFabricState?.routes.find((route) => route.role === selectedModelRole) ?? null
  ), [modelFabricState, selectedModelRole]);
  const roleModels = useMemo(() => (
    (modelFabricState?.models ?? []).filter((model) => model.roles.includes(selectedModelRole))
  ), [modelFabricState, selectedModelRole]);
  const lifecycleModels = modelFabricState?.models ?? [];
  const selectedKnowledgeBase = knowledgeState?.bases.find((base) => base.id === selectedKnowledgeBaseId) ?? null;
  const selectedKnowledgeDocuments = (knowledgeState?.documents ?? []).filter((document) => document.baseId === selectedKnowledgeBaseId);
  const pendingMemoryCandidates = (learningState?.memoryCandidates ?? []).filter((candidate) => candidate.status === "pending").slice(0, 5);
  const pendingSkillCandidates = (learningState?.skillCandidates ?? []).filter((candidate) => candidate.status === "pending").slice(0, 5);
  const computerWindows = computerState?.windows ?? [];
  const computerTreeNodes = computerState?.lastTree?.nodes ?? [];
  const selectedComputerNode = computerTreeNodes.find((node) => node.nodeId === selectedComputerNodeId) ?? null;
  const computerPreview: ComputerScreenshotResult | null = computerState?.lastHighlight ?? computerState?.lastScreenshot ?? null;
  const activeComputerActions = computerState?.activeActions ?? [];
  const activeComputerNeedsText = activeComputerDraft.action === "ui.set_value" || activeComputerDraft.action === "keyboard.type";
  const activeComputerNeedsUiTarget = activeComputerDraft.action.startsWith("ui.");
  const activeComputerNeedsBounds = activeComputerDraft.action === "mouse.click";
  const activeComputerProposalReady = Boolean(activeComputerDraft.expectedResult.trim()) &&
    (!activeComputerNeedsText || Boolean(activeComputerDraft.text.trim())) &&
    (activeComputerDraft.verificationKind !== "ui-tree-contains" || Boolean(activeComputerDraft.verificationText.trim())) &&
    (!activeComputerNeedsUiTarget || Boolean(selectedComputerNode?.automationId || selectedComputerNode?.name)) &&
    (!activeComputerNeedsBounds || Boolean(selectedComputerNode?.bounds)) &&
    !computerState?.emergencyStopActive;
  const browserInspection = browserVisionState?.lastInspection ?? null;
  const browserGrounding = browserVisionState?.lastGrounding ?? null;
  const browserOverlayUrl = browserGrounding?.overlayUrl ?? browserInspection?.screenshotUrl ?? null;
  const pendingBrowserApprovals = (browserVisionState?.approvals ?? []).filter((approval) => approval.status === "pending").slice(0, 4);
  const recentVoiceTranscripts = (voiceState?.transcripts ?? []).slice(0, 5);
  const recentVoiceTts = (voiceState?.ttsQueue ?? []).slice(0, 5);
  const voiceSelfTestItems = voiceState?.lastSelfTest?.items ?? [];
  const voiceCanStart = voiceState?.microphone.permission === "granted";
  const selectedMediaAsset = (mediaState?.assets ?? []).find((asset) => asset.id === selectedMediaAssetId)
    ?? (mediaState?.assets ?? []).find((asset) => asset.id === mediaState?.selectedAssetId)
    ?? null;
  const latestImageResult = mediaState?.imageResults.find((result) => result.assetId === selectedMediaAsset?.id) ?? null;
  const latestOcrResult = mediaState?.ocrResults.find((result) => result.assetId === selectedMediaAsset?.id) ?? null;
  const latestGenerationResult = mediaState?.generationResults[0] ?? null;
  const latestVideoProbe = mediaState?.videoProbes.find((result) => result.assetId === selectedMediaAsset?.id) ?? null;
  const latestAudioExtraction = mediaState?.audioExtractions.find((result) => result.assetId === selectedMediaAsset?.id) ?? null;
  const selectedVideoKeyframes = (mediaState?.keyframes ?? []).filter((keyframe) => keyframe.assetId === selectedMediaAsset?.id).slice(0, 6);
  const latestVideoSummary = mediaState?.videoSummaries.find((result) => result.assetId === selectedMediaAsset?.id) ?? null;
  const selectedMediaIsImage = selectedMediaAsset?.kind === "image";
  const selectedMediaIsVideo = selectedMediaAsset?.kind === "video";
  const activeTeachSession = teachModeState?.sessions.find((session) => session.id === teachModeState.activeSessionId)
    ?? teachModeState?.sessions[0]
    ?? null;
  const selectedTeachWorkflow = (teachModeState?.workflows ?? []).find((workflow) => workflow.id === selectedTeachWorkflowId)
    ?? teachModeState?.workflows[0]
    ?? null;
  const recentTeachReplayPlans = (teachModeState?.replayPlans ?? []).slice(0, 4);
  const pendingTeachSkillCandidates = (teachModeState?.skillCandidates ?? []).filter((candidate) => candidate.status === "pending-approval").slice(0, 4);
  const teachIsRecording = activeTeachSession?.status === "recording";
  const selectedAppAdapter = (appAdapterState?.adapters ?? []).find((adapter) => adapter.id === selectedAppAdapterId)
    ?? appAdapterState?.adapters[0]
    ?? null;
  const recentAppAdapterPlans = (appAdapterState?.actionPlans ?? []).slice(0, 5);
  const recentElevatedHelperSessions = (elevatedHelperState?.sessions ?? []).slice(0, 4);
  const recentElevatedHelperAudit = (elevatedHelperState?.audit ?? []).slice(0, 6);
  const selectedAutomation = (automationState?.automations ?? []).find((automation) => automation.id === selectedAutomationId)
    ?? automationState?.automations[0]
    ?? null;
  const recentAutomations = (automationState?.automations ?? []).slice(0, 6);
  const recentAutomationRuns = (automationState?.runs ?? []).slice(0, 5);
  const recentAutomationAudit = (automationState?.audit ?? []).slice(0, 5);
  const packagingChecks = [
    ...(packagingState?.dependencyReadiness.checks ?? []),
    ...(packagingState?.securityReview.checks ?? []),
    ...(packagingState?.performanceReview.checks ?? [])
  ].slice(0, 10);
  const latestRestorePlan = packagingState?.restorePlans[0] ?? null;
  const recentCommandPlans = (commandCenterState?.plans ?? []).slice(0, 4);
  const filteredCommandPlans = recentCommandPlans.filter((plan) => commandPlanMatchesFilter(plan, commandPlanFilter));
  const commandQueueOverview = buildCommandQueueOverview(recentCommandPlans);
  const commandReviewQueueSummary = buildCommandReviewQueueSummary(recentCommandPlans);
  const commandReviewTargetPlan = findCommandReviewTargetPlan(recentCommandPlans);
  const commandPlanFilterCounts: Record<CommandPlanFilter, number> = {
    all: recentCommandPlans.length,
    draft: recentCommandPlans.filter((plan) => plan.status === "draft").length,
    approved: recentCommandPlans.filter((plan) => plan.status === "approved").length,
    rejected: recentCommandPlans.filter((plan) => plan.status === "rejected").length,
    blocked: recentCommandPlans.filter((plan) => plan.blockedReasons.length > 0).length
  };
  const selectedCommandPlan = filteredCommandPlans.find((plan) => plan.id === selectedCommandPlanId)
    ?? filteredCommandPlans[0]
    ?? null;
  const commandPolicy = commandCenterState?.policy ?? null;
  const selectedCommandDecision = selectedCommandPlan ? summarizeCommandDecision(selectedCommandPlan) : null;
  const selectedCommandApprovalTrail = selectedCommandPlan ? buildCommandApprovalTrail(selectedCommandPlan) : [];
  const selectedCommandApprovalChecklist = selectedCommandPlan ? buildCommandApprovalChecklist(selectedCommandPlan, commandPolicy) : [];
  const selectedCommandReviewActions = selectedCommandPlan ? buildCommandReviewActions(selectedCommandPlan) : [];
  const selectedCommandReviewBrief = selectedCommandPlan ? buildCommandReviewBrief(selectedCommandPlan) : null;
  const selectedCommandStepSummary = selectedCommandPlan ? buildCommandStepSummary(selectedCommandPlan) : null;
  const selectedCommandReviewTimeline = selectedCommandPlan ? buildCommandReviewTimeline(selectedCommandPlan, commandPolicy) : [];
  const selectedCommandApprovalImpact = selectedCommandPlan ? buildCommandApprovalImpact(selectedCommandPlan, commandPolicy) : null;
  const selectedCommandDecisionPrompt = selectedCommandPlan
    ? buildCommandReviewDecisionPrompt(selectedCommandPlan, commandReviewNote, commandPolicy)
    : null;
  const selectedCommandReviewNoteCue = selectedCommandPlan
    ? buildCommandReviewNoteCue(selectedCommandPlan, commandReviewNote)
    : null;
  const commandLengthLimit = commandPolicy?.maxCommandChars ?? 600;
  const selectedCommandRevisionDraft = selectedCommandPlan
    ? buildCommandRevisionDraft(selectedCommandPlan, commandReviewNote, commandLengthLimit)
    : null;
  const commandCharsRemaining = Math.max(0, commandLengthLimit - commandText.length);
  const commandIsTooLong = commandText.length > commandLengthLimit;
  const blockedCommandTerms = (commandPolicy?.blockedTerms ?? []).filter((term) => commandContainsBlockedTerm(commandText, term));
  const commandComposerBrief = buildCommandComposerBrief(commandText, blockedCommandTerms, commandLengthLimit);
  const commandComposerRoutePreview = buildCommandComposerRoutePreview(commandText, blockedCommandTerms);
  const commandPolicyContract = buildCommandPolicyContract(commandPolicy);
  const commandReadinessMeter = buildCommandReadinessMeter(
    commandText,
    commandComposerRoutePreview,
    blockedCommandTerms,
    commandLengthLimit,
    commandPolicy?.requiresApproval ?? true
  );
  const commandPreflightChecklist = buildCommandPreflightChecklist(
    commandText,
    commandComposerRoutePreview,
    blockedCommandTerms,
    commandComposerBrief,
    commandReadinessMeter,
    commandPolicy?.requiresApproval ?? true,
    commandPolicy?.silentExecutionAllowed ?? false
  );
  const commandNextStep = buildCommandNextStep(
    commandText,
    blockedCommandTerms,
    commandComposerBrief,
    commandReadinessMeter,
    commandPolicy?.requiresApproval ?? true
  );
  const commandFocusBar = buildCommandFocusBar(
    commandText,
    commandNextStep,
    commandReviewQueueSummary,
    selectedCommandPlan
  );
  const commandFocusActions = buildCommandFocusActions(
    commandComposerBrief,
    commandReviewQueueSummary,
    commandReviewTargetPlan,
    selectedCommandPlan,
    selectedCommandRevisionDraft
  );
  const commandDraftSummary = buildCommandDraftSummary(
    commandText,
    commandComposerRoutePreview,
    blockedCommandTerms,
    commandPolicy?.requiresApproval ?? true,
    commandPolicy?.silentExecutionAllowed ?? false
  );
  const commandComposerSuggestions = buildCommandComposerSuggestions(
    commandText,
    commandComposerRoutePreview,
    blockedCommandTerms,
    commandLengthLimit,
    commandPolicy?.requiresApproval ?? true,
    commandReadinessMeter
  );
  const commandApprovalGate = buildCommandApprovalGate(
    commandText,
    blockedCommandTerms,
    commandComposerBrief,
    commandReadinessMeter,
    commandPolicy?.requiresApproval ?? true,
    commandPolicy?.silentExecutionAllowed ?? false
  );
  const commandIntentChecklist = buildCommandIntentChecklist(
    commandText,
    commandComposerRoutePreview,
    blockedCommandTerms,
    commandPolicy?.requiresApproval ?? true
  );
  const commandPlanPreview = buildCommandPlanPreview(
    commandText,
    commandComposerRoutePreview,
    blockedCommandTerms,
    commandPolicy?.requiresApproval ?? true
  );
  const isChatRunning = chatState?.runStatus === "running";
  const workspaceBadges: Record<WorkspaceId, number> = {
    command: recentCommandPlans.length,
    control: computerWindows.length + activeComputerActions.length + pendingBrowserApprovals.length + recentAppAdapterPlans.length,
    knowledge: selectedKnowledgeDocuments.length + pendingMemoryCandidates.length + pendingSkillCandidates.length,
    creation: recentVoiceTranscripts.length + (mediaState?.assets.length ?? 0) + recentTeachReplayPlans.length,
    automation: recentAutomations.length + recentElevatedHelperSessions.length + (packagingState?.restorePlans.length ?? 0),
    admin: (profileConfigState?.profiles.length ?? 0) + (modelFabricState?.routes.length ?? 0) + (chatState?.sessions.length ?? 0),
    services: (snapshot?.services.length ?? 0) + recentLogs.length
  };
  const workspaceHeaderSummary = buildWorkspaceHeaderSummary(activeWorkspace, workspaceBadges);

  return (
    <main className={`studio-shell workspace-${activeWorkspace}`}>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Hermes Local AI Studio</h1>
          <p>{workspaceHeaderSummary.detail}</p>
        </div>
        <div className="topbar-context" aria-label="Active workspace summary">
          <span>{workspaceHeaderSummary.label}</span>
          <strong>{workspaceHeaderSummary.countLabel}</strong>
        </div>
        <div className="topbar-actions">
          <span className={`status-dot ${refreshState}`} aria-label={refreshState} />
          <button type="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      {error ? <section className="alert">{error}</section> : null}

      <section className="summary-grid">
        <div className="summary-panel">
          <span className="label">Model Route</span>
          <strong>{selectedRoute?.selectedModelId ?? "none"}</strong>
          <small>{selectedModelRole}</small>
        </div>
        <div className="summary-panel">
          <span className="label">Session</span>
          <strong>{selectedSessionId ?? "new"}</strong>
          <small>{chatState?.runStatus ?? "idle"}</small>
        </div>
        <div className="summary-panel">
          <span className="label">Approvals</span>
          <strong>{chatState?.approvals.length ?? 0}</strong>
          <small>No silent approvals in Studio chat</small>
        </div>
      </section>

      <nav className="workspace-nav" aria-label="Studio workspace">
        {WORKSPACES.map((workspace) => (
          <button
            key={workspace.id}
            type="button"
            className={activeWorkspace === workspace.id ? "active" : ""}
            aria-current={activeWorkspace === workspace.id ? "page" : undefined}
            onClick={() => setActiveWorkspace(workspace.id)}
          >
            <span>{workspace.label}</span>
            <small>{workspaceBadges[workspace.id]}</small>
          </button>
        ))}
      </nav>

      <section className="command-workspace" aria-label="Command Center">
        <div className={`command-focus-bar ${commandFocusBar.tone}`} aria-label="Command focus bar">
          <div className="command-focus-main">
            <span>Command focus</span>
            <strong>{commandFocusBar.objective}</strong>
          </div>
          <div>
            <span>Next</span>
            <strong>{commandFocusBar.next}</strong>
          </div>
          <div>
            <span>Review</span>
            <strong>{commandFocusBar.review}</strong>
          </div>
          <div>
            <span>Approval</span>
            <strong>{commandFocusBar.approval}</strong>
          </div>
          <div>
            <span>Handoff</span>
            <strong>{commandFocusBar.handoff}</strong>
          </div>
          <div className="command-focus-actions" aria-label="Command focus actions">
            {commandFocusActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={action.tone}
                disabled={action.disabled}
                onClick={() => handleCommandFocusAction(action.id)}
              >
                <span>{action.label}</span>
                <small>{action.detail}</small>
                <em>{action.guard}</em>
              </button>
            ))}
          </div>
        </div>
        <section className="command-panel">
          <div className="panel-heading">
            <h2>Command Center</h2>
            <span>{commandCenterState?.policy.localPlanningOnly ? "local plan" : "external"}</span>
          </div>
          <label className="text-field command-input">
            <span>Command</span>
            <textarea
              rows={3}
              maxLength={commandLengthLimit}
              value={commandText}
              onChange={(event) => setCommandText(event.target.value)}
            />
          </label>
          <div className="command-starter-actions" aria-label="Command starter actions">
            {COMMAND_STARTER_ACTIONS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                aria-label={`Use ${starter.label} starter`}
                onClick={() => applyCommandStarter(starter)}
              >
                <strong>{starter.label}</strong>
                <span>{starter.detail}</span>
              </button>
            ))}
          </div>
          <div className={`command-next-step ${commandNextStep.tone}`} aria-label="Command next step">
            <div>
              <span>Next</span>
              <strong>{commandNextStep.label}</strong>
              <small>{commandNextStep.detail}</small>
            </div>
            <div>
              <span>Action</span>
              <strong>{commandNextStep.action}</strong>
            </div>
            <div>
              <span>Guard</span>
              <strong>{commandNextStep.guard}</strong>
            </div>
          </div>
          <div className="command-safety-preview" aria-label="Command safety preview">
            <span>{commandPolicy?.localPlanningOnly ? "local" : "external"}</span>
            <span>{commandPolicy?.requiresApproval ? "approval" : "direct"}</span>
            <span className={commandIsTooLong ? "warning" : ""}>{commandCharsRemaining} chars</span>
            {blockedCommandTerms.length > 0 ? (
              <span className="warning">{blockedCommandTerms.length} blocked</span>
            ) : (
              <span>clear</span>
            )}
          </div>
          <ul className="command-policy-contract" aria-label="Command policy contract">
            {commandPolicyContract.map((item) => (
              <li key={item.id} className={item.tone}>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
          <div className={`command-composer-brief ${commandComposerBrief.tone}`} aria-label="Command composer brief">
            <strong>{commandComposerBrief.label}</strong>
            <span>{commandComposerBrief.detail}</span>
            <small>{commandComposerBrief.nextAction}</small>
          </div>
          <div className={`command-readiness-meter ${commandReadinessMeter.tone}`} aria-label="Command readiness meter">
            <div>
              <span>Readiness</span>
              <strong>{commandReadinessMeter.label}</strong>
              <small>{commandReadinessMeter.detail}</small>
            </div>
            <div className="command-readiness-score" aria-label={`Readiness score ${commandReadinessMeter.score} percent`}>
              <span>{commandReadinessMeter.score}%</span>
              <div className="command-readiness-track">
                <i style={{ width: `${commandReadinessMeter.score}%` }} />
              </div>
            </div>
            <small>{commandReadinessMeter.nextStep}</small>
          </div>
          <ul className="command-preflight-checklist" aria-label="Command preflight checklist">
            {commandPreflightChecklist.map((item) => (
              <li key={item.id} className={item.tone}>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
          <div className={`command-draft-summary ${commandDraftSummary.tone}`} aria-label="Command draft summary">
            <div className="command-draft-summary-main">
              <span>Draft</span>
              <strong>{commandDraftSummary.title}</strong>
              <small>{commandDraftSummary.objective}</small>
            </div>
            <div className="command-draft-summary-grid">
              <div>
                <span>Target</span>
                <strong>{commandDraftSummary.target}</strong>
              </div>
              <div>
                <span>Approval</span>
                <strong>{commandDraftSummary.approval}</strong>
              </div>
              <div>
                <span>Execution</span>
                <strong>{commandDraftSummary.execution}</strong>
              </div>
              <div>
                <span>Handoff</span>
                <strong>{commandDraftSummary.handoff}</strong>
              </div>
            </div>
          </div>
          <ul className="command-composer-suggestions" aria-label="Command composer suggestions">
            {commandComposerSuggestions.map((suggestion) => (
              <li key={suggestion.id} className={suggestion.tone}>
                <strong>{suggestion.label}</strong>
                <span>{suggestion.detail}</span>
              </li>
            ))}
          </ul>
          <div
            className={`command-route-preview ${commandComposerRoutePreview.confidence} risk-${commandComposerRoutePreview.risk}`}
            aria-label="Command route preview"
          >
            <div>
              <span>Target</span>
              <strong>{workspaceLabel(commandComposerRoutePreview.workspace)}</strong>
            </div>
            <div>
              <span>Route</span>
              <strong>{commandComposerRoutePreview.intentLabel}</strong>
            </div>
            <div>
              <span>Risk</span>
              <strong>{commandComposerRoutePreview.risk}</strong>
            </div>
            <small>{commandComposerRoutePreview.detail}</small>
          </div>
          <ul className="command-intent-checklist" aria-label="Command intent checklist">
            {commandIntentChecklist.map((check) => (
              <li key={check.id} className={check.state}>
                <strong>{check.label}</strong>
                <span>{check.detail}</span>
              </li>
            ))}
          </ul>
          <ol className="command-plan-preview" aria-label="Command plan preview">
            {commandPlanPreview.map((step) => (
              <li key={step.id} className={step.state}>
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
          {blockedCommandTerms.length > 0 ? (
            <p className="command-safety-note">
              Blocked terms: {blockedCommandTerms.join(", ")}. A plan can be created for review, but it cannot be approved.
            </p>
          ) : null}
          <div className="command-preset-grid" aria-label="Command presets">
            {COMMAND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => void createCommandPlan(preset.command)}
              >
                <strong>{preset.label}</strong>
                <span>{workspaceLabel(preset.workspace)}</span>
              </button>
            ))}
          </div>
          <div className="admin-actions">
            <div className={`command-approval-gate ${commandApprovalGate.tone}`} aria-label="Command approval gate">
              <div>
                <span>Gate</span>
                <strong>{commandApprovalGate.label}</strong>
                <small>{commandApprovalGate.detail}</small>
              </div>
              <div>
                <span>Approval</span>
                <strong>{commandApprovalGate.approval}</strong>
              </div>
              <div>
                <span>Execution</span>
                <strong>{commandApprovalGate.execution}</strong>
              </div>
              <div>
                <span>Action</span>
                <strong>{commandApprovalGate.action}</strong>
              </div>
            </div>
            <button type="button" disabled={!commandComposerBrief.canPlan} onClick={() => void createCommandPlan()}>
              Make Plan
            </button>
          </div>
          <div className="route-detail">
            <strong>{commandCenterState?.policy.requiresApproval ? "Approval required" : "No approval"}</strong>
            <span>{commandCenterState?.policy.externalAiPlanningAllowed ? "External AI planning allowed" : "Local deterministic planning only"}</span>
            <span>{commandCenterState?.policy.silentExecutionAllowed ? "Silent execution allowed" : "Silent execution blocked"}</span>
          </div>
          {commandMessage ? <p className="admin-message">{commandMessage}</p> : null}
          {commandHandoffMessage ? <p className="command-handoff">{commandHandoffMessage}</p> : null}
        </section>

        <section className="admin-panel command-plan-panel">
          <div className="panel-heading">
            <h2>Plans</h2>
            <span>{filteredCommandPlans.length}/{recentCommandPlans.length}</span>
          </div>
          <div className="command-queue-overview" aria-label="Command queue overview">
            {commandQueueOverview.map((item) => (
              <div key={item.id} className={item.tone}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>
          <div className={`command-review-queue-summary ${commandReviewQueueSummary.tone}`} aria-label="Command review queue summary">
            <div>
              <span>Next review</span>
              <strong>{commandReviewQueueSummary.label}</strong>
              <small>{commandReviewQueueSummary.detail}</small>
            </div>
            <div>
              <span>Plan</span>
              <strong>{commandReviewQueueSummary.nextPlan}</strong>
            </div>
            <div>
              <span>Guard</span>
              <strong>{commandReviewQueueSummary.guard}</strong>
            </div>
          </div>
          <div className="command-plan-filter" aria-label="Command plan filters">
            {COMMAND_PLAN_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={commandPlanFilter === filter.id ? "active" : ""}
                aria-pressed={commandPlanFilter === filter.id}
                onClick={() => setCommandPlanFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <small>{commandPlanFilterCounts[filter.id]}</small>
              </button>
            ))}
          </div>
          <ol className="validation-list">
            {filteredCommandPlans.map((plan) => (
              <li key={plan.id} className={selectedCommandPlan?.id === plan.id ? "selected-command-plan" : ""}>
                <strong>{plan.title} · {plan.status} · {plan.risk}</strong>
                <span>{plan.summary}</span>
                <span>{plan.route} · {plan.intent}</span>
                <span>Opens {workspaceLabel(workspaceForCommandRoute(plan.route))}</span>
                {plan.blockedReasons.length > 0 ? <small>{plan.blockedReasons.join(" ")}</small> : null}
                <div className="inline-actions">
                  <button
                    type="button"
                    aria-pressed={selectedCommandPlan?.id === plan.id}
                    onClick={() => {
                      setSelectedCommandPlanId(plan.id);
                      setCommandReviewNote(plan.reviewNote ?? "");
                    }}
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    disabled={plan.status !== "draft" || plan.blockedReasons.length > 0}
                    onClick={() => void reviewCommandPlan(plan.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={plan.status !== "draft"}
                    onClick={() => void reviewCommandPlan(plan.id, "reject")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={plan.status !== "approved"}
                    onClick={() => {
                      const nextWorkspace = workspaceForCommandRoute(plan.route);
                      setActiveWorkspace(nextWorkspace);
                      setCommandHandoffMessage(`${plan.title} opened ${workspaceLabel(nextWorkspace)}.`);
                    }}
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {filteredCommandPlans.length === 0 ? <p className="muted">No plans.</p> : null}
        </section>

        <section className="admin-panel command-review-panel" aria-label="Command plan review">
          <div className="panel-heading">
            <h2>Review</h2>
            <span>{selectedCommandPlan?.status ?? "empty"}</span>
          </div>
          {selectedCommandPlan ? (
            <>
              <div className="command-review-meta">
                <span>{selectedCommandPlan.risk}</span>
                <span>{selectedCommandPlan.route}</span>
                <span>{workspaceLabel(workspaceForCommandRoute(selectedCommandPlan.route))}</span>
              </div>
              <strong className="command-review-title">{selectedCommandPlan.title}</strong>
              <p>{selectedCommandPlan.summary}</p>
              {selectedCommandReviewBrief ? (
                <div
                  className={`command-review-brief ${selectedCommandReviewBrief.tone}`}
                  aria-label="Command review brief"
                >
                  <strong>{selectedCommandReviewBrief.headline}</strong>
                  <span>{selectedCommandReviewBrief.detail}</span>
                  <small>{selectedCommandReviewBrief.primaryAction} · {selectedCommandReviewBrief.handoff}</small>
                </div>
              ) : null}
              {selectedCommandDecision ? (
                <div
                  className={`command-decision-summary ${selectedCommandDecision.tone}`}
                  aria-label="Command decision summary"
                >
                  <div>
                    <span>Decision</span>
                    <strong>{selectedCommandDecision.label}</strong>
                  </div>
                  <div>
                    <span>Plan</span>
                    <strong>{selectedCommandDecision.detail}</strong>
                  </div>
                  <div>
                    <span>Next</span>
                    <strong>{selectedCommandDecision.nextAction}</strong>
                  </div>
                </div>
              ) : null}
              {selectedCommandStepSummary ? (
                <div
                  className={`command-step-summary ${selectedCommandStepSummary.tone}`}
                  aria-label="Command step summary"
                >
                  <div>
                    <span>Steps</span>
                    <strong>{selectedCommandStepSummary.stepCount}</strong>
                  </div>
                  <div>
                    <span>Approval</span>
                    <strong>{selectedCommandStepSummary.approvalCount}</strong>
                  </div>
                  <div>
                    <span>First</span>
                    <strong>{selectedCommandStepSummary.firstStep}</strong>
                  </div>
                  <small>{selectedCommandStepSummary.detail} · {selectedCommandStepSummary.handoff}</small>
                </div>
              ) : null}
              <ol className="command-review-timeline" aria-label="Command review timeline">
                {selectedCommandReviewTimeline.map((item) => (
                  <li key={item.id} className={item.tone}>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </li>
                ))}
              </ol>
              {selectedCommandApprovalImpact ? (
                <div
                  className={`command-approval-impact ${selectedCommandApprovalImpact.tone}`}
                  aria-label="Command approval impact"
                >
                  <div>
                    <span>Approval</span>
                    <strong>{selectedCommandApprovalImpact.approval}</strong>
                  </div>
                  <div>
                    <span>Execution</span>
                    <strong>{selectedCommandApprovalImpact.execution}</strong>
                  </div>
                  <div>
                    <span>Handoff</span>
                    <strong>{selectedCommandApprovalImpact.handoff}</strong>
                  </div>
                  <div>
                    <span>Audit</span>
                    <strong>{selectedCommandApprovalImpact.audit}</strong>
                  </div>
                </div>
              ) : null}
              {selectedCommandDecisionPrompt ? (
                <div
                  className={`command-review-decision-prompt ${selectedCommandDecisionPrompt.tone}`}
                  aria-label="Command review decision prompt"
                >
                  <div>
                    <span>Decision prompt</span>
                    <strong>{selectedCommandDecisionPrompt.headline}</strong>
                    <small>{selectedCommandDecisionPrompt.detail}</small>
                  </div>
                  <div>
                    <span>Action</span>
                    <strong>{selectedCommandDecisionPrompt.action}</strong>
                  </div>
                  <div>
                    <span>Guard</span>
                    <strong>{selectedCommandDecisionPrompt.guard}</strong>
                  </div>
                </div>
              ) : null}
              <ul className="command-approval-checklist" aria-label="Command approval checklist">
                {selectedCommandApprovalChecklist.map((check) => (
                  <li key={check.id} className={check.state}>
                    <strong>{check.label}</strong>
                    <span>{check.detail}</span>
                    <small>{check.state}</small>
                  </li>
                ))}
              </ul>
              <div className="command-review-action-strip" aria-label="Command review actions">
                {selectedCommandReviewActions.map((action) => (
                  <div key={action.id} className={action.state}>
                    <strong>{action.label}</strong>
                    <span>{action.detail}</span>
                    <small>{action.state}</small>
                  </div>
                ))}
              </div>
              <ol className="command-approval-trail" aria-label="Command approval trail">
                {selectedCommandApprovalTrail.map((item) => (
                  <li key={`${item.tone}-${item.label}`} className={item.tone}>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                    {item.note ? <small>{item.note}</small> : null}
                  </li>
                ))}
              </ol>
              <label className="text-field command-review-note">
                <span>Review note</span>
                <textarea
                  rows={3}
                  maxLength={240}
                  disabled={selectedCommandPlan.status !== "draft"}
                  value={commandReviewNote}
                  onChange={(event) => setCommandReviewNote(event.target.value)}
                />
              </label>
              {selectedCommandReviewNoteCue ? (
                <div
                  className={`command-review-note-cue ${selectedCommandReviewNoteCue.tone}`}
                  aria-label="Command review note cue"
                >
                  <div>
                    <span>Note</span>
                    <strong>{selectedCommandReviewNoteCue.label}</strong>
                    <small>{selectedCommandReviewNoteCue.detail}</small>
                  </div>
                  <div>
                    <span>Suggestion</span>
                    <strong>{selectedCommandReviewNoteCue.suggestion}</strong>
                  </div>
                  <div>
                    <span>Guard</span>
                    <strong>{selectedCommandReviewNoteCue.guard}</strong>
                    <small>{selectedCommandReviewNoteCue.characterCount}/240 chars</small>
                  </div>
                </div>
              ) : null}
              {selectedCommandRevisionDraft ? (
                <div
                  className={`command-revision-draft ${selectedCommandRevisionDraft.ready ? "ready" : "idle"}`}
                  aria-label="Command revision draft"
                >
                  <strong>Revision draft</strong>
                  <span>
                    {selectedCommandRevisionDraft.ready
                      ? selectedCommandRevisionDraft.feedback
                      : "Add a review note or use blockers to prepare a revised command."}
                  </span>
                  <small>
                    {selectedCommandRevisionDraft.ready
                      ? `${selectedCommandRevisionDraft.source} feedback fills the command box only.`
                      : "No automatic plan creation."}
                  </small>
                  <button
                    type="button"
                    disabled={!selectedCommandRevisionDraft.ready || selectedCommandPlan.status === "approved"}
                    onClick={() => useCommandRevisionDraft(selectedCommandPlan)}
                  >
                    Use note for revision
                  </button>
                </div>
              ) : null}
              {selectedCommandPlan.blockedReasons.length > 0 ? (
                <div className="command-blocked-reasons">
                  {selectedCommandPlan.blockedReasons.map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                </div>
              ) : null}
              <ol className="command-step-list">
                {selectedCommandPlan.steps.map((step) => (
                  <li key={step.id}>
                    <strong>{step.title}</strong>
                    <span>{step.detail}</span>
                    <small>{step.route} · {step.requiresApproval ? "approval required" : "ready"}</small>
                  </li>
                ))}
              </ol>
              <div className="admin-actions">
                <button
                  type="button"
                  disabled={selectedCommandPlan.status !== "draft" || selectedCommandPlan.blockedReasons.length > 0}
                  onClick={() => void reviewCommandPlan(selectedCommandPlan.id, "approve")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={selectedCommandPlan.status !== "draft"}
                  onClick={() => void reviewCommandPlan(selectedCommandPlan.id, "reject")}
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={selectedCommandPlan.status !== "approved"}
                  onClick={() => {
                    const nextWorkspace = workspaceForCommandRoute(selectedCommandPlan.route);
                    setActiveWorkspace(nextWorkspace);
                    setCommandHandoffMessage(`${selectedCommandPlan.title} opened ${workspaceLabel(nextWorkspace)}.`);
                  }}
                >
                  Open
                </button>
              </div>
            </>
          ) : (
            <p className="muted">No plans.</p>
          )}
        </section>
      </section>

      <section className="computer-workspace" aria-label="Safe active computer control">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Windows</h2>
            <span>{computerWindows.length}</span>
          </div>
          <label className="text-field">
            <span>Target</span>
            <select
              value={selectedComputerWindowHandle}
              onChange={(event) => {
                setSelectedComputerWindowHandle(event.target.value);
                setSelectedComputerNodeId(null);
              }}
            >
              <option value="">Desktop root</option>
              {computerWindows.map((windowSummary) => (
                <option key={windowSummary.handle} value={windowSummary.handle}>
                  {windowSummary.title} · {windowSummary.processName ?? "process"}
                </option>
              ))}
            </select>
          </label>
          <dl className="resource-list">
            <div>
              <dt>Mode</dt>
              <dd>{computerState?.activePolicy.requiresApproval ? "approval" : "observe"}</dd>
            </div>
            <div>
              <dt>Input</dt>
              <dd>{computerState?.activePolicy.allowInput ? "gated" : "no"}</dd>
            </div>
            <div>
              <dt>Elevation</dt>
              <dd>{computerState?.policy.allowElevation ? "yes" : "no"}</dd>
            </div>
          </dl>
          <div className="admin-actions">
            <button type="button" onClick={() => void refreshComputerWindows()}>
              Refresh Windows
            </button>
            <button type="button" onClick={() => void inspectComputerWindow()}>
              Inspect Tree
            </button>
          </div>
          {computerMessage ? <p className="admin-message">{computerMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Capture</h2>
            <span>{computerPreview ? `${computerPreview.width} x ${computerPreview.height}` : "ready"}</span>
          </div>
          <div className="capture-preview">
            {computerPreview ? (
              <img src={computerPreview.fileUrl} alt="Observe-only desktop capture" />
            ) : (
              <span className="muted">No capture yet.</span>
            )}
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => void captureComputerScreen()}>
              Capture Screen
            </button>
          </div>
        </section>

        <section className="admin-panel computer-tree-panel">
          <div className="panel-heading">
            <h2>UI Tree</h2>
            <span>{computerTreeNodes.length}</span>
          </div>
          <ol className="validation-list computer-tree-list">
            {computerTreeNodes.slice(0, 12).map((node) => (
              <li key={node.nodeId} className={selectedComputerNodeId === node.nodeId ? "selected-tree-node" : undefined}>
                <strong>{node.controlType ?? "Control"} · depth {node.depth}</strong>
                <span>{node.name || node.automationId || node.className || node.nodeId}</span>
                <div className="inline-actions">
                  <button type="button" onClick={() => setSelectedComputerNodeId(node.nodeId)}>
                    Target
                  </button>
                  <button type="button" disabled={!node.bounds} onClick={() => void highlightComputerNode(node)}>
                    Highlight
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {computerTreeNodes.length === 0 ? <p className="muted">No UI tree loaded.</p> : null}
        </section>

        <section className="admin-panel active-computer-panel">
          <div className="panel-heading">
            <h2>Active Queue</h2>
            <span>{computerState?.emergencyStopActive ? "stopped" : `${activeComputerActions.length} queued`}</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Action</span>
              <select
                value={activeComputerDraft.action}
                onChange={(event) => setActiveComputerDraft((existing) => ({
                  ...existing,
                  action: event.target.value as Milestone8ActiveAction
                }))}
              >
                {MILESTONE8_ACTIVE_ACTIONS.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Risk</span>
              <select
                value={activeComputerDraft.risk}
                onChange={(event) => setActiveComputerDraft((existing) => ({
                  ...existing,
                  risk: event.target.value as ComputerActionRisk
                }))}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
              </select>
            </label>
          </div>
          {activeComputerNeedsText ? (
            <label className="text-field">
              <span>Text</span>
              <input
                value={activeComputerDraft.text}
                onChange={(event) => setActiveComputerDraft((existing) => ({ ...existing, text: event.target.value }))}
              />
            </label>
          ) : null}
          {activeComputerDraft.action === "keyboard.chord" ? (
            <label className="text-field">
              <span>Chord</span>
              <select
                value={activeComputerDraft.chord}
                onChange={(event) => setActiveComputerDraft((existing) => ({ ...existing, chord: event.target.value }))}
              >
                {["TAB", "ENTER", "ESC", "CTRL+A", "CTRL+C", "CTRL+V"].map((chord) => (
                  <option key={chord} value={chord}>{chord}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="text-field">
            <span>Expected</span>
            <input
              value={activeComputerDraft.expectedResult}
              onChange={(event) => setActiveComputerDraft((existing) => ({ ...existing, expectedResult: event.target.value }))}
            />
          </label>
          <div className="form-row two">
            <label>
              <span>Verify</span>
              <select
                value={activeComputerDraft.verificationKind}
                onChange={(event) => setActiveComputerDraft((existing) => ({
                  ...existing,
                  verificationKind: event.target.value as ComputerVerificationKind
                }))}
              >
                <option value="manual">manual</option>
                <option value="ui-tree-contains">ui-tree-contains</option>
                <option value="screenshot">screenshot</option>
              </select>
            </label>
            <label>
              <span>Target</span>
              <input value={selectedComputerNode ? (selectedComputerNode.name || selectedComputerNode.automationId || selectedComputerNode.nodeId) : "window"} readOnly />
            </label>
          </div>
          {activeComputerDraft.verificationKind === "ui-tree-contains" ? (
            <label className="text-field">
              <span>Verification text</span>
              <input
                value={activeComputerDraft.verificationText}
                onChange={(event) => setActiveComputerDraft((existing) => ({ ...existing, verificationText: event.target.value }))}
              />
            </label>
          ) : null}
          <div className="admin-actions">
            <button type="button" disabled={!activeComputerProposalReady} onClick={() => void proposeActiveComputerAction()}>
              Propose Action
            </button>
            <button type="button" onClick={() => void emergencyStopComputer()}>
              Emergency Stop
            </button>
            <button type="button" disabled={!computerState?.emergencyStopActive} onClick={() => void resetComputerEmergencyStop()}>
              Reset Stop
            </button>
          </div>
          <ol className="validation-list active-action-list">
            {activeComputerActions.slice(0, 6).map((action) => (
              <li key={action.id}>
                <strong>{action.action} · {action.status} · {action.risk}</strong>
                <span>{action.expectedResult}</span>
                {action.result ? <span>{action.result.detail}</span> : null}
                {action.verificationResult ? <span>{action.verificationResult.passed ? "verified" : "unverified"} · {action.verificationResult.detail}</span> : null}
                {action.error ? <span>{action.error}</span> : null}
                <div className="inline-actions">
                  <button type="button" disabled={action.status !== "pending"} onClick={() => void reviewComputerAction(action.id, "approve")}>
                    Approve
                  </button>
                  <button type="button" disabled={action.status !== "pending"} onClick={() => void reviewComputerAction(action.id, "reject")}>
                    Reject
                  </button>
                  <button type="button" disabled={action.status !== "approved" || computerState?.emergencyStopActive} onClick={() => void executeComputerAction(action.id)}>
                    Execute
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <section className="browser-workspace" aria-label="Browser DOM and visual grounding">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Browser</h2>
            <span>{browserVisionState?.policy.fallbackAutomation ?? "visual"}</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Engine</span>
              <select value={browserEngine} onChange={(event) => setBrowserEngine(event.target.value as BrowserEngine)}>
                <option value="edge">edge</option>
                <option value="chrome">chrome</option>
              </select>
            </label>
            <label>
              <span>Threshold</span>
              <input value={`${Math.round((browserVisionState?.policy.lowConfidenceThreshold ?? 0.72) * 100)}%`} readOnly />
            </label>
          </div>
          <label className="text-field">
            <span>Grounding query</span>
            <input
              value={browserGroundingQuery}
              onChange={(event) => setBrowserGroundingQuery(event.target.value)}
            />
          </label>
          <dl className="resource-list">
            <div>
              <dt>Mode</dt>
              <dd>{browserVisionState?.policy.preferredAutomation ?? "dom"}</dd>
            </div>
            <div>
              <dt>Fallback</dt>
              <dd>{browserVisionState?.policy.requiresApprovalForLowConfidence ? "approval" : "auto"}</dd>
            </div>
            <div>
              <dt>Blocked</dt>
              <dd>{browserVisionState?.policy.blockedTargets.length ?? 0}</dd>
            </div>
          </dl>
          <div className="admin-actions">
            <button type="button" onClick={() => void inspectBrowser()}>
              Inspect Browser
            </button>
            <button type="button" disabled={!browserGroundingQuery.trim()} onClick={() => void groundBrowserElement()}>
              Ground Element
            </button>
          </div>
          {browserMessage ? <p className="admin-message">{browserMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Overlay</h2>
            <span>{browserGrounding ? `${browserGrounding.candidates.length} candidates` : "ready"}</span>
          </div>
          <div className="capture-preview">
            {browserOverlayUrl ? (
              <img src={browserOverlayUrl} alt="Browser grounding overlay" />
            ) : (
              <span className="muted">No browser overlay yet.</span>
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Candidates</h2>
            <span>{browserGrounding?.requiresApproval ? "approval" : "dom"}</span>
          </div>
          <ol className="validation-list browser-candidate-list">
            {(browserGrounding?.candidates ?? browserInspection?.elements ?? []).slice(0, 6).map((candidate) => (
              <li key={candidate.id}>
                <strong>{candidate.role ?? "element"} · {candidate.confidenceLabel} · {Math.round(candidate.confidence * 100)}%</strong>
                <span>{candidate.text || candidate.selector}</span>
                <span>{candidate.source} · {candidate.bounds.width} x {candidate.bounds.height}</span>
              </li>
            ))}
          </ol>
          {!browserGrounding && !browserInspection ? <p className="muted">No browser inspection loaded.</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Grounding Approval</h2>
            <span>{pendingBrowserApprovals.length} pending</span>
          </div>
          <ol className="validation-list">
            {pendingBrowserApprovals.map((approval) => (
              <li key={approval.id}>
                <strong>{approval.candidate.text || approval.candidate.selector}</strong>
                <span>{approval.query} · {Math.round(approval.candidate.confidence * 100)}% · {approval.candidate.source}</span>
                <div className="inline-actions">
                  <button type="button" onClick={() => void reviewBrowserGrounding(approval.id, "approve")}>
                    Approve
                  </button>
                  <button type="button" onClick={() => void reviewBrowserGrounding(approval.id, "reject")}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {pendingBrowserApprovals.length === 0 ? <p className="muted">No low-confidence grounding approval pending.</p> : null}
        </section>
      </section>

      <section className="voice-workspace" aria-label="Voice system">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Voice</h2>
            <span>{voiceState?.session.status ?? "idle"}</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Language</span>
              <select
                value={voiceDraft.language}
                onChange={(event) => setVoiceDraft((existing) => ({ ...existing, language: event.target.value as VoiceLanguage }))}
              >
                <option value="en">English</option>
                <option value="th">Thai</option>
              </select>
            </label>
            <label>
              <span>Mode</span>
              <select
                value={voiceDraft.mode}
                onChange={(event) => setVoiceDraft((existing) => ({ ...existing, mode: event.target.value as VoiceCaptureMode }))}
              >
                <option value="push-to-talk">push-to-talk</option>
                <option value="wake-word">wake-word</option>
              </select>
            </label>
          </div>
          <label className="text-field">
            <span>Wake word</span>
            <input
              value={voiceDraft.wakeWord}
              onChange={(event) => setVoiceDraft((existing) => ({ ...existing, wakeWord: event.target.value }))}
            />
          </label>
          <dl className="resource-list">
            <div>
              <dt>Mic</dt>
              <dd>{voiceState?.microphone.permission ?? "not-requested"}</dd>
            </div>
            <div>
              <dt>Wake</dt>
              <dd>{voiceState?.wakeWordEnabled ? "on" : "off"}</dd>
            </div>
            <div>
              <dt>Barge-in</dt>
              <dd>{voiceState?.session.bargeInCount ?? 0}</dd>
            </div>
          </dl>
          <div className="admin-actions">
            <button type="button" onClick={() => void setVoiceMicrophonePermission("granted")}>
              Grant Mic
            </button>
            <button type="button" onClick={() => void setVoiceMicrophonePermission("denied")}>
              Deny Mic
            </button>
            <button type="button" disabled={!voiceCanStart} onClick={() => void startVoiceCapture()}>
              Start
            </button>
            <button type="button" disabled={voiceState?.session.status !== "listening"} onClick={() => void stopVoiceCapture()}>
              Stop
            </button>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => void configureVoice()}>
              Configure
            </button>
            <button type="button" onClick={() => void runVoiceSelfTest()}>
              Self-Test
            </button>
          </div>
          {voiceMessage ? <p className="admin-message">{voiceMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>ASR</h2>
            <span>{voiceState?.policy.localOnly ? "local" : "external"}</span>
          </div>
          <label className="text-field">
            <span>Utterance</span>
            <textarea
              rows={4}
              value={voiceDraft.utterance}
              onChange={(event) => setVoiceDraft((existing) => ({ ...existing, utterance: event.target.value }))}
            />
          </label>
          <div className="form-row two">
            <label>
              <span>RMS</span>
              <input
                value={voiceDraft.rms}
                onChange={(event) => setVoiceDraft((existing) => ({ ...existing, rms: event.target.value }))}
              />
            </label>
            <label>
              <span>Duration ms</span>
              <input
                value={voiceDraft.durationMs}
                onChange={(event) => setVoiceDraft((existing) => ({ ...existing, durationMs: event.target.value }))}
              />
            </label>
          </div>
          <dl className="resource-list">
            <div>
              <dt>VAD threshold</dt>
              <dd>{voiceState?.policy.vad.thresholdRms ?? 0.08}</dd>
            </div>
            <div>
              <dt>Min speech</dt>
              <dd>{voiceState?.policy.vad.minSpeechMs ?? 250} ms</dd>
            </div>
            <div>
              <dt>Draft</dt>
              <dd>{recentVoiceTranscripts[0]?.commandDraft ? "ready" : "none"}</dd>
            </div>
          </dl>
          <div className="admin-actions">
            <button type="button" disabled={!voiceDraft.utterance.trim()} onClick={() => void submitVoiceUtterance()}>
              Submit Utterance
            </button>
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>TTS</h2>
            <span>{voiceState?.activeTtsId ?? "idle"}</span>
          </div>
          <label className="text-field">
            <span>Speech text</span>
            <textarea
              rows={4}
              value={voiceDraft.ttsText}
              onChange={(event) => setVoiceDraft((existing) => ({ ...existing, ttsText: event.target.value }))}
            />
          </label>
          <div className="admin-actions">
            <button type="button" disabled={!voiceDraft.ttsText.trim()} onClick={() => void speakVoice()}>
              Speak
            </button>
            <button type="button" disabled={!voiceState?.activeTtsId} onClick={() => void interruptVoice()}>
              Interrupt
            </button>
          </div>
          <ol className="validation-list">
            {recentVoiceTts.map((item) => (
              <li key={item.id}>
                <strong>{item.status} · {item.language}</strong>
                <span>{item.text}</span>
                {item.interruptReason ? <span>{item.interruptReason}</span> : null}
              </li>
            ))}
          </ol>
          {recentVoiceTts.length === 0 ? <p className="muted">No local speech queued.</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Transcripts</h2>
            <span>{recentVoiceTranscripts.length}</span>
          </div>
          <ol className="validation-list">
            {recentVoiceTranscripts.map((transcript) => (
              <li key={transcript.id}>
                <strong>{transcript.status} · {transcript.language} · {Math.round(transcript.confidence * 100)}%</strong>
                <span>{transcript.text}</span>
                {transcript.commandDraft ? <span>Draft: {transcript.commandDraft}</span> : null}
                {transcript.reason ? <span>{transcript.reason}</span> : null}
              </li>
            ))}
          </ol>
          {recentVoiceTranscripts.length === 0 ? <p className="muted">No voice transcripts yet.</p> : null}
          {voiceSelfTestItems.length > 0 ? (
            <ol className="validation-list">
              {voiceSelfTestItems.map((item) => (
                <li key={item.id}>
                  <strong>{item.status} · {item.language}</strong>
                  <span>{item.detail}</span>
                  <span>{item.actualText}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      </section>

      <section className="media-workspace" aria-label="Image and video system">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Media</h2>
            <span>{mediaState?.assets.length ?? 0}</span>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => void selectMediaFiles()}>
              Select Media
            </button>
          </div>
          <label className="text-field">
            <span>Selected</span>
            <select
              value={selectedMediaAsset?.id ?? ""}
              onChange={(event) => void selectMediaAsset(event.target.value)}
            >
              <option value="">No media</option>
              {(mediaState?.assets ?? []).map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.kind} · {asset.name}
                </option>
              ))}
            </select>
          </label>
          {selectedMediaAsset ? (
            <dl className="resource-list">
              <div>
                <dt>Kind</dt>
                <dd>{selectedMediaAsset.kind}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(selectedMediaAsset.sizeBytes)}</dd>
              </div>
              <div>
                <dt>Shape</dt>
                <dd>{selectedMediaAsset.dimensions ? `${selectedMediaAsset.dimensions.width} x ${selectedMediaAsset.dimensions.height}` : "n/a"}</dd>
              </div>
            </dl>
          ) : <p className="muted">No media asset selected.</p>}
          {selectedMediaAsset?.previewUrl ? (
            <div className="capture-preview">
              <img src={selectedMediaAsset.previewUrl} alt="Selected media preview" />
            </div>
          ) : null}
          {mediaMessage ? <p className="admin-message">{mediaMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Image</h2>
            <span>{latestImageResult?.status ?? "ready"}</span>
          </div>
          <div className="admin-actions">
            <button type="button" disabled={!selectedMediaIsImage} onClick={() => void understandSelectedImage()}>
              Understand
            </button>
            <button type="button" disabled={!selectedMediaIsImage} onClick={() => void runSelectedImageOcr()}>
              OCR
            </button>
          </div>
          {latestImageResult ? (
            <div className="route-detail">
              <strong>{latestImageResult.summary}</strong>
              <span>{latestImageResult.labels.join(", ")}</span>
            </div>
          ) : null}
          {latestOcrResult ? (
            <div className="route-detail">
              <strong>{latestOcrResult.source} · {Math.round(latestOcrResult.confidence * 100)}%</strong>
              <span>{latestOcrResult.text || latestOcrResult.warning}</span>
            </div>
          ) : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Generation</h2>
            <span>{mediaState?.comfyUi?.available ? "ComfyUI" : "workflow"}</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Mode</span>
              <select
                value={mediaDraft.generationMode}
                onChange={(event) => setMediaDraft((existing) => ({ ...existing, generationMode: event.target.value as ImageGenerationMode }))}
              >
                <option value="generate">generate</option>
                <option value="edit">edit</option>
              </select>
            </label>
            <label>
              <span>Keyframes</span>
              <input
                value={mediaDraft.keyframeCount}
                onChange={(event) => setMediaDraft((existing) => ({ ...existing, keyframeCount: event.target.value }))}
              />
            </label>
          </div>
          <label className="text-field">
            <span>Prompt</span>
            <textarea
              rows={4}
              value={mediaDraft.prompt}
              onChange={(event) => setMediaDraft((existing) => ({ ...existing, prompt: event.target.value }))}
            />
          </label>
          <div className="admin-actions">
            <button type="button" onClick={() => void probeComfyUi()}>
              Probe ComfyUI
            </button>
            <button type="button" disabled={!mediaDraft.prompt.trim() || (mediaDraft.generationMode === "edit" && !selectedMediaIsImage)} onClick={() => void createImageGeneration()}>
              Create Workflow
            </button>
          </div>
          {mediaState?.comfyUi ? <p className="muted">{mediaState.comfyUi.detail}</p> : null}
          {latestGenerationResult ? (
            <div className="capture-preview">
              <img src={latestGenerationResult.previewUrl} alt="Generated workflow preview" />
            </div>
          ) : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Video</h2>
            <span>{latestVideoProbe?.status ?? "ready"}</span>
          </div>
          <div className="admin-actions">
            <button type="button" disabled={!selectedMediaIsVideo} onClick={() => void probeSelectedVideo()}>
              Probe
            </button>
            <button type="button" disabled={!selectedMediaIsVideo} onClick={() => void extractSelectedVideoAudio()}>
              Extract Audio
            </button>
            <button type="button" disabled={!selectedMediaIsVideo} onClick={() => void sampleSelectedVideoKeyframes()}>
              Sample Frames
            </button>
            <button type="button" disabled={!selectedMediaIsVideo} onClick={() => void summarizeSelectedVideo()}>
              Summarize
            </button>
          </div>
          <dl className="resource-list">
            <div>
              <dt>Duration</dt>
              <dd>{latestVideoProbe?.durationSeconds ?? "n/a"}</dd>
            </div>
            <div>
              <dt>Audio</dt>
              <dd>{latestAudioExtraction ? "artifact" : latestVideoProbe?.hasAudio ? "yes" : "n/a"}</dd>
            </div>
            <div>
              <dt>Frames</dt>
              <dd>{selectedVideoKeyframes.length}</dd>
            </div>
          </dl>
          {latestVideoSummary ? (
            <div className="route-detail">
              <strong>{latestVideoSummary.summary}</strong>
              <span>{latestVideoSummary.warnings.join(" ")}</span>
            </div>
          ) : null}
          <ol className="validation-list">
            {selectedVideoKeyframes.map((keyframe) => (
              <li key={keyframe.id}>
                <strong>Frame {keyframe.index + 1} · {keyframe.timestampSeconds}s</strong>
                <span>{keyframe.imagePath}</span>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <section className="app-adapter-workspace" aria-label="App adapters">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>App Adapters</h2>
            <span>{appAdapterState?.lastProbedAt ? "probed" : "ready"}</span>
          </div>
          <dl className="resource-list">
            <div>
              <dt>Semantic</dt>
              <dd>{appAdapterState?.policy.semanticInterfacesPreferred ? "preferred" : "off"}</dd>
            </div>
            <div>
              <dt>Fallback</dt>
              <dd>{appAdapterState?.policy.genericWindowsFallbackEnabled ? "generic" : "off"}</dd>
            </div>
            <div>
              <dt>Approval</dt>
              <dd>{appAdapterState?.policy.actionsRequireApproval ? "required" : "auto"}</dd>
            </div>
          </dl>
          <div className="admin-actions">
            <button type="button" onClick={() => void probeAppAdapters()}>
              Probe Adapters
            </button>
          </div>
          <ol className="validation-list">
            {(appAdapterState?.adapters ?? []).map((adapter) => (
              <li key={adapter.id}>
                <strong>{adapter.label} · {adapter.detection.status}</strong>
                <span>{adapter.detection.detail}</span>
                <small>{adapter.capabilities.join(", ")}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Plan</h2>
            <span>{selectedAppAdapter?.label ?? "none"}</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Adapter</span>
              <select value={selectedAppAdapterId} onChange={(event) => setSelectedAppAdapterId(event.target.value)}>
                {(appAdapterState?.adapters ?? []).map((adapter) => (
                  <option key={adapter.id} value={adapter.id}>
                    {adapter.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Action</span>
              <select
                value={appAdapterDraft.action}
                onChange={(event) => setAppAdapterDraft((existing) => ({ ...existing, action: event.target.value as AppAdapterActionKind }))}
              >
                {(["open-path", "focus-window", "inspect-context", "open-project", "run-command", "browser-inspect", "office-document-context", "generic-ui-tree", "bambu-placeholder"] as const).map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-field">
            <span>Target</span>
            <input
              value={appAdapterDraft.target}
              onChange={(event) => setAppAdapterDraft((existing) => ({ ...existing, target: event.target.value }))}
            />
          </label>
          <label className="text-field">
            <span>Intent</span>
            <textarea
              rows={4}
              value={appAdapterDraft.intent}
              onChange={(event) => setAppAdapterDraft((existing) => ({ ...existing, intent: event.target.value }))}
            />
          </label>
          <div className="form-row two">
            <label>
              <span>Context key</span>
              <input
                value={appAdapterDraft.contextKey}
                onChange={(event) => setAppAdapterDraft((existing) => ({ ...existing, contextKey: event.target.value }))}
              />
            </label>
            <label>
              <span>Context value</span>
              <input
                value={appAdapterDraft.contextValue}
                onChange={(event) => setAppAdapterDraft((existing) => ({ ...existing, contextValue: event.target.value }))}
              />
            </label>
          </div>
          <div className="admin-actions">
            <button
              type="button"
              disabled={!selectedAppAdapter || !appAdapterDraft.target.trim() || !appAdapterDraft.intent.trim()}
              onClick={() => void createAppAdapterPlan()}
            >
              Create Plan
            </button>
          </div>
          {selectedAppAdapter ? (
            <div className="route-detail">
              <strong>{selectedAppAdapter.supportedActions.join(", ")}</strong>
              <span>{selectedAppAdapter.safetyNotes.join(" ")}</span>
            </div>
          ) : null}
          {appAdapterMessage ? <p className="admin-message">{appAdapterMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Review Queue</h2>
            <span>{recentAppAdapterPlans.length}</span>
          </div>
          <ol className="validation-list">
            {recentAppAdapterPlans.map((plan) => (
              <li key={plan.id}>
                <strong>{plan.adapterId} · {plan.action} · {plan.status}</strong>
                <span>{plan.intent}</span>
                <span>Risk {plan.risk}; blocked {plan.blockedReasons.length}</span>
                {plan.blockedReasons.length > 0 ? <small>{plan.blockedReasons.join(" ")}</small> : null}
                <div className="inline-actions">
                  <button type="button" disabled={plan.status !== "draft" || plan.blockedReasons.length > 0} onClick={() => void reviewAppAdapterPlan(plan.id, "approve")}>
                    Approve
                  </button>
                  <button type="button" disabled={plan.status !== "draft"} onClick={() => void reviewAppAdapterPlan(plan.id, "reject")}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <section className="elevated-helper-workspace" aria-label="Elevated helper">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Elevated Helper</h2>
            <span>{elevatedHelperState?.helper.signatureStatus ?? "unknown"}</span>
          </div>
          <dl className="resource-list">
            <div>
              <dt>Manual UAC</dt>
              <dd>{elevatedHelperState?.policy.manualUacStartupOnly ? "required" : "off"}</dd>
            </div>
            <div>
              <dt>Silent</dt>
              <dd>{elevatedHelperState?.policy.silentElevationAllowed ? "allowed" : "blocked"}</dd>
            </div>
            <div>
              <dt>Secure Desktop</dt>
              <dd>{elevatedHelperState?.policy.secureDesktopAutomationAllowed ? "allowed" : "blocked"}</dd>
            </div>
          </dl>
          <div className="route-detail">
            <strong>{elevatedHelperState?.helper.exists ? "Helper binary detected" : "Helper binary missing"}</strong>
            <span>{elevatedHelperState?.helper.detail ?? "Build the optional helper before use."}</span>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => void probeElevatedHelper()}>
              Probe Helper
            </button>
          </div>
          {elevatedHelperMessage ? <p className="admin-message">{elevatedHelperMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Manual Launch</h2>
            <span>{elevatedHelperState?.launchInstruction ? "prepared" : "none"}</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Minutes</span>
              <input
                value={elevatedHelperDraft.durationMinutes}
                onChange={(event) => setElevatedHelperDraft((existing) => ({ ...existing, durationMinutes: event.target.value }))}
              />
            </label>
            <label>
              <span>Approval code</span>
              <input
                value={elevatedHelperDraft.approvalCode}
                onChange={(event) => setElevatedHelperDraft((existing) => ({ ...existing, approvalCode: event.target.value }))}
              />
            </label>
          </div>
          <label className="text-field">
            <span>Purpose</span>
            <textarea
              rows={4}
              value={elevatedHelperDraft.purpose}
              onChange={(event) => setElevatedHelperDraft((existing) => ({ ...existing, purpose: event.target.value }))}
            />
          </label>
          <div className="admin-actions">
            <button type="button" onClick={() => void prepareElevatedHelperLaunch()}>
              Prepare Manual Launch
            </button>
          </div>
          {elevatedHelperState?.launchInstruction ? (
            <label className="text-field">
              <span>PowerShell command</span>
              <textarea rows={5} value={elevatedHelperState.launchInstruction.powershellCommand} readOnly />
            </label>
          ) : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Sessions</h2>
            <span>{recentElevatedHelperSessions.length}</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Helper PID</span>
              <input
                value={elevatedHelperDraft.helperProcessId}
                onChange={(event) => setElevatedHelperDraft((existing) => ({ ...existing, helperProcessId: event.target.value }))}
              />
            </label>
            <label>
              <span>Elevated</span>
              <select
                value={elevatedHelperDraft.helperElevated ? "yes" : "no"}
                onChange={(event) => setElevatedHelperDraft((existing) => ({ ...existing, helperElevated: event.target.value === "yes" }))}
              >
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
            </label>
          </div>
          <ol className="validation-list">
            {recentElevatedHelperSessions.map((session) => (
              <li key={session.id}>
                <strong>{session.id} · {session.status}</strong>
                <span>{session.purpose}</span>
                <span>Expires {new Date(session.expiresAt).toLocaleTimeString()}</span>
                {session.rejectionReason ? <small>{session.rejectionReason}</small> : null}
                <div className="inline-actions">
                  <button type="button" disabled={session.status !== "pending-manual-start"} onClick={() => void confirmElevatedHelperSession(session.id)}>
                    Confirm
                  </button>
                  <button type="button" disabled={session.status === "revoked" || session.status === "expired"} onClick={() => void revokeElevatedHelperSession(session.id)}>
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Audit</h2>
            <span>{recentElevatedHelperAudit.length}</span>
          </div>
          <ol className="validation-list">
            {recentElevatedHelperAudit.map((event) => (
              <li key={event.id}>
                <strong>{event.kind} · {event.actor}</strong>
                <span>{event.summary}</span>
                <small>{event.detail}</small>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <section className="automation-workspace" aria-label="Automations">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Automations</h2>
            <span>{automationState?.policy.dryRunOnly ? "dry-run" : "active"}</span>
          </div>
          <dl className="resource-list">
            <div>
              <dt>Schedule</dt>
              <dd>{automationState?.policy.schedulesEnabled ? "enabled" : "off"}</dd>
            </div>
            <div>
              <dt>File Trigger</dt>
              <dd>{automationState?.policy.fileTriggersEnabled ? "exact" : "off"}</dd>
            </div>
            <div>
              <dt>Desktop</dt>
              <dd>{automationState?.policy.desktopUnlockedRequired ? "unlocked" : "optional"}</dd>
            </div>
            <div>
              <dt>OS Input</dt>
              <dd>{automationState?.policy.unattendedOsInputAllowed ? "allowed" : "blocked"}</dd>
            </div>
          </dl>
          <div className="route-detail">
            <strong>{automationState?.policy.requiresApproval ? "Approval required" : "Auto approved"}</strong>
            <span>{automationState?.policy.hiddenBackgroundWatchersAllowed ? "Background watchers allowed" : "Hidden watchers blocked"}</span>
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Create Draft</h2>
            <span>{automationDraft.triggerKind}</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Name</span>
              <input
                value={automationDraft.name}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, name: event.target.value }))}
              />
            </label>
            <label>
              <span>Trigger</span>
              <select
                value={automationDraft.triggerKind}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, triggerKind: event.target.value as AutomationTriggerKind }))}
              >
                {(["manual", "schedule", "file-change"] as const).map((trigger) => (
                  <option key={trigger} value={trigger}>{trigger}</option>
                ))}
              </select>
            </label>
          </div>
          {automationDraft.triggerKind === "schedule" ? (
            <div className="form-row two">
              <label>
                <span>Start</span>
                <input
                  value={automationDraft.scheduleStartAt}
                  onChange={(event) => setAutomationDraft((existing) => ({ ...existing, scheduleStartAt: event.target.value }))}
                />
              </label>
              <label>
                <span>Repeat</span>
                <select
                  value={automationDraft.scheduleRepeat}
                  onChange={(event) => setAutomationDraft((existing) => ({ ...existing, scheduleRepeat: event.target.value as AutomationScheduleRepeat }))}
                >
                  {(["once", "hourly", "daily"] as const).map((repeat) => (
                    <option key={repeat} value={repeat}>{repeat}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {automationDraft.triggerKind === "file-change" ? (
            <div className="form-row two">
              <label>
                <span>Path</span>
                <input
                  value={automationDraft.filePath}
                  onChange={(event) => setAutomationDraft((existing) => ({ ...existing, filePath: event.target.value }))}
                />
              </label>
              <label>
                <span>Event</span>
                <select
                  value={automationDraft.fileEvent}
                  onChange={(event) => setAutomationDraft((existing) => ({ ...existing, fileEvent: event.target.value as AutomationFileEventKind }))}
                >
                  {(["created", "changed", "deleted"] as const).map((fileEvent) => (
                    <option key={fileEvent} value={fileEvent}>{fileEvent}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <div className="form-row two">
            <label>
              <span>Action</span>
              <select
                value={automationDraft.actionKind}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, actionKind: event.target.value as AutomationActionKind }))}
              >
                {(["notify", "teach-replay-dry-run", "app-adapter-plan-dry-run", "knowledge-refresh-dry-run"] as const).map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Target</span>
              <input
                value={automationDraft.actionTarget}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, actionTarget: event.target.value }))}
              />
            </label>
          </div>
          <label className="text-field">
            <span>Purpose</span>
            <textarea
              rows={3}
              value={automationDraft.purpose}
              onChange={(event) => setAutomationDraft((existing) => ({ ...existing, purpose: event.target.value }))}
            />
          </label>
          <label className="text-field">
            <span>Instructions</span>
            <textarea
              rows={3}
              value={automationDraft.instructions}
              onChange={(event) => setAutomationDraft((existing) => ({ ...existing, instructions: event.target.value }))}
            />
          </label>
          <div className="form-row two">
            <label>
              <span>Retries</span>
              <input
                value={automationDraft.retryCount}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, retryCount: event.target.value }))}
              />
            </label>
            <label>
              <span>Disable After</span>
              <input
                value={automationDraft.disableAfterFailures}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, disableAfterFailures: event.target.value }))}
              />
            </label>
          </div>
          <div className="form-row two">
            <label>
              <span>Timeout</span>
              <input
                value={automationDraft.timeoutSeconds}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, timeoutSeconds: event.target.value }))}
              />
            </label>
            <label>
              <span>Notify</span>
              <select
                value={automationDraft.notifyOnFailure ? "yes" : "no"}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, notifyOnFailure: event.target.value === "yes" }))}
              >
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </label>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => void createAutomation()}>
              Create Automation
            </button>
          </div>
          {automationMessage ? <p className="admin-message">{automationMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Review And Run</h2>
            <span>{selectedAutomation?.status ?? "none"}</span>
          </div>
          <label className="text-field">
            <span>Automation</span>
            <select
              value={selectedAutomation?.id ?? ""}
              onChange={(event) => setSelectedAutomationId(event.target.value || null)}
            >
              <option value="">none</option>
              {recentAutomations.map((automation) => (
                <option key={automation.id} value={automation.id}>
                  {automation.id} · {automation.status} · {automation.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row two">
            <label>
              <span>Desktop</span>
              <select
                value={automationDraft.desktopUnlocked ? "unlocked" : "locked"}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, desktopUnlocked: event.target.value === "unlocked" }))}
              >
                <option value="unlocked">unlocked</option>
                <option value="locked">locked</option>
              </select>
            </label>
            <label>
              <span>Failure</span>
              <select
                value={automationDraft.forceFailure ? "yes" : "no"}
                onChange={(event) => setAutomationDraft((existing) => ({ ...existing, forceFailure: event.target.value === "yes" }))}
              >
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
            </label>
          </div>
          {selectedAutomation ? (
            <div className="route-detail">
              <strong>{selectedAutomation.trigger.kind} · {selectedAutomation.action.kind}</strong>
              <span>{selectedAutomation.purpose}</span>
              <span>Failures {selectedAutomation.failureCount}; blocked {selectedAutomation.blockedReasons.length}</span>
              {selectedAutomation.blockedReasons.length > 0 ? <small>{selectedAutomation.blockedReasons.join(" ")}</small> : null}
            </div>
          ) : null}
          <div className="inline-actions">
            <button
              type="button"
              disabled={!selectedAutomation || selectedAutomation.status !== "draft" || selectedAutomation.blockedReasons.length > 0}
              onClick={() => selectedAutomation ? void reviewAutomation(selectedAutomation.id, "approve") : undefined}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={!selectedAutomation || selectedAutomation.status !== "draft"}
              onClick={() => selectedAutomation ? void reviewAutomation(selectedAutomation.id, "reject") : undefined}
            >
              Reject
            </button>
            <button
              type="button"
              disabled={!selectedAutomation || selectedAutomation.status !== "approved"}
              onClick={() => void simulateAutomation(false)}
            >
              Simulate
            </button>
            <button
              type="button"
              disabled={!selectedAutomation || selectedAutomation.status !== "approved"}
              onClick={() => void simulateAutomation(true)}
            >
              Force Failure
            </button>
            <button
              type="button"
              disabled={!selectedAutomation || selectedAutomation.status === "disabled"}
              onClick={() => selectedAutomation ? void disableAutomation(selectedAutomation.id) : undefined}
            >
              Disable
            </button>
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Run History</h2>
            <span>{recentAutomationRuns.length}</span>
          </div>
          <ol className="validation-list">
            {recentAutomationRuns.map((run) => (
              <li key={run.id}>
                <strong>{run.id} · {run.status}</strong>
                <span>{run.summary}</span>
                <span>{run.triggerKind} · desktop {run.desktopUnlocked ? "unlocked" : "locked"} · attempt {run.attempt}</span>
                {run.failureReason ? <small>{run.failureReason}</small> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Automation Audit</h2>
            <span>{recentAutomationAudit.length}</span>
          </div>
          <ol className="validation-list">
            {recentAutomationAudit.map((event) => (
              <li key={event.id}>
                <strong>{event.kind} · {event.actor}</strong>
                <span>{event.summary}</span>
                <small>{event.detail}</small>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <section className="packaging-workspace" aria-label="Packaging and hardening">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Hardening</h2>
            <span>{packagingState?.dependencyReadiness.status ?? "unknown"}</span>
          </div>
          <dl className="resource-list">
            <div>
              <dt>Installer</dt>
              <dd>{packagingState?.policy.installerTargets.join(", ") ?? "none"}</dd>
            </div>
            <div>
              <dt>Silent Install</dt>
              <dd>{packagingState?.policy.silentInstallAllowed ? "allowed" : "blocked"}</dd>
            </div>
            <div>
              <dt>Auto Update</dt>
              <dd>{packagingState?.policy.automaticUpdatesAllowed ? "allowed" : "manual"}</dd>
            </div>
            <div>
              <dt>Restore</dt>
              <dd>{packagingState?.policy.restoreRequiresPlan ? "planned" : "direct"}</dd>
            </div>
          </dl>
          <div className="route-detail">
            <strong>{packagingState?.updateStrategy.channel ?? "local-manual"}</strong>
            <span>{packagingState?.updateStrategy.updateSteps.join(" ") ?? "Run readiness checks before packaging."}</span>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => void inspectPackagingHardening()}>
              Inspect Readiness
            </button>
          </div>
          {packagingMessage ? <p className="admin-message">{packagingMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Package</h2>
            <span>{packagingState?.latestInstallerManifest ? "ready" : "none"}</span>
          </div>
          <div className="route-detail">
            <strong>{packagingState?.latestInstallerManifest?.version ?? "No manifest generated"}</strong>
            <span>{packagingState?.latestInstallerManifest?.manifestPath ?? "Build the desktop app, then generate a local portable manifest."}</span>
            <span>{packagingState?.latestInstallerManifest ? `${packagingState.latestInstallerManifest.files.length} file(s) checksummed` : "Requires explicit user confirmation for install."}</span>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => void createInstallerManifest()}>
              Create Manifest
            </button>
          </div>
          <ol className="validation-list">
            {(packagingState?.latestInstallerManifest?.files ?? []).slice(0, 4).map((file) => (
              <li key={file.relativePath}>
                <strong>{file.relativePath}</strong>
                <span>{file.sizeBytes} bytes</span>
                <small>{file.sha256}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Restore Plan</h2>
            <span>{latestRestorePlan?.status ?? "none"}</span>
          </div>
          <label className="text-field">
            <span>Export path</span>
            <input
              value={packagingDraft.restoreExportPath}
              onChange={(event) => setPackagingDraft((existing) => ({ ...existing, restoreExportPath: event.target.value }))}
            />
          </label>
          <div className="admin-actions">
            <button type="button" disabled={!packagingDraft.restoreExportPath.trim()} onClick={() => void createRestorePlan()}>
              Create Plan
            </button>
          </div>
          {latestRestorePlan ? (
            <div className="route-detail">
              <strong>{latestRestorePlan.id}</strong>
              <span>{latestRestorePlan.profileCount} profile(s), {latestRestorePlan.projectCount} project(s)</span>
              <span>{latestRestorePlan.applyBlockedAtMilestone ? "Apply blocked at this milestone" : "Apply available"}</span>
            </div>
          ) : null}
          <ol className="validation-list">
            {(latestRestorePlan?.operations ?? []).map((operation) => (
              <li key={operation.id}>
                <strong>{operation.id}</strong>
                <span>{operation.source}</span>
                <small>{operation.destination}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Readiness Checks</h2>
            <span>{packagingChecks.filter((item) => item.status === "pass").length}/{packagingChecks.length}</span>
          </div>
          <ol className="validation-list">
            {packagingChecks.map((item) => (
              <li key={item.id}>
                <strong>{item.label} · {item.status}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ol>
          <div className="route-detail">
            <strong>Full acceptance suite</strong>
            <span>{packagingState?.acceptanceSuite.runnerPath ?? "scripts\\run-milestone16.ps1"}</span>
            <span>{packagingState?.acceptanceSuite.requiredChecks.join(", ") ?? "pending"}</span>
          </div>
        </section>
      </section>

      <section className="teach-workspace" aria-label="Teach Mode and workflow builder">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Teach Mode</h2>
            <span>{activeTeachSession?.status ?? "idle"}</span>
          </div>
          <label className="text-field">
            <span>Workflow name</span>
            <input
              value={teachSessionName}
              onChange={(event) => setTeachSessionName(event.target.value)}
            />
          </label>
          <dl className="resource-list">
            <div>
              <dt>Events</dt>
              <dd>{activeTeachSession?.events.length ?? 0}</dd>
            </div>
            <div>
              <dt>Semantic</dt>
              <dd>{teachModeState?.policy.semanticSelectorsPreferred ? "preferred" : "off"}</dd>
            </div>
            <div>
              <dt>Replay</dt>
              <dd>{teachModeState?.policy.replayRequiresApproval ? "approval" : "auto"}</dd>
            </div>
          </dl>
          <div className="admin-actions">
            <button type="button" disabled={teachIsRecording} onClick={() => void startTeachSession()}>
              Start
            </button>
            <button type="button" disabled={!teachIsRecording} onClick={() => void stopTeachSession()}>
              Stop
            </button>
            <button type="button" disabled={teachIsRecording || !activeTeachSession?.events.length} onClick={() => void generateTeachWorkflow()}>
              Generate Workflow
            </button>
          </div>
          {teachMessage ? <p className="admin-message">{teachMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Recorder</h2>
            <span>{teachEventDraft.kind}</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Event</span>
              <select
                value={teachEventDraft.kind}
                onChange={(event) => setTeachEventDraft((existing) => ({ ...existing, kind: event.target.value as TeachEventKind }))}
              >
                {(["app.focus", "window.observe", "ui.invoke", "ui.set_value", "keyboard.input", "mouse.click", "clipboard.read", "file.opened", "file.created", "wait.condition", "screenshot.capture", "final.state"] as const).map((kind) => (
                  <option key={kind} value={kind}>{kind}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Control</span>
              <input
                value={teachEventDraft.controlType}
                onChange={(event) => setTeachEventDraft((existing) => ({ ...existing, controlType: event.target.value }))}
              />
            </label>
          </div>
          <div className="form-row two">
            <label>
              <span>App</span>
              <input
                value={teachEventDraft.appProcess}
                onChange={(event) => setTeachEventDraft((existing) => ({ ...existing, appProcess: event.target.value }))}
              />
            </label>
            <label>
              <span>Window</span>
              <input
                value={teachEventDraft.windowTitle}
                onChange={(event) => setTeachEventDraft((existing) => ({ ...existing, windowTitle: event.target.value }))}
              />
            </label>
          </div>
          <div className="form-row two">
            <label>
              <span>Automation ID</span>
              <input
                value={teachEventDraft.automationId}
                onChange={(event) => setTeachEventDraft((existing) => ({ ...existing, automationId: event.target.value }))}
              />
            </label>
            <label>
              <span>Name</span>
              <input
                value={teachEventDraft.name}
                onChange={(event) => setTeachEventDraft((existing) => ({ ...existing, name: event.target.value }))}
              />
            </label>
          </div>
          <label className="text-field">
            <span>Value, file path, or final state</span>
            <input
              value={teachEventDraft.text || teachEventDraft.filePath || teachEventDraft.waitCondition}
              onChange={(event) => {
                const value = event.target.value;
                setTeachEventDraft((existing) => ({
                  ...existing,
                  text: existing.kind === "ui.set_value" || existing.kind === "keyboard.input" || existing.kind === "final.state" ? value : "",
                  filePath: existing.kind === "file.opened" || existing.kind === "file.created" ? value : "",
                  waitCondition: existing.kind === "wait.condition" ? value : ""
                }));
              }}
            />
          </label>
          <label className="text-field">
            <span>Note</span>
            <input
              value={teachEventDraft.note}
              onChange={(event) => setTeachEventDraft((existing) => ({ ...existing, note: event.target.value }))}
            />
          </label>
          <div className="admin-actions">
            <button type="button" disabled={!teachIsRecording} onClick={() => void recordTeachEvent()}>
              Record Event
            </button>
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Workflow</h2>
            <span>{selectedTeachWorkflow ? `${Math.round(selectedTeachWorkflow.reliabilityScore * 100)}%` : "none"}</span>
          </div>
          <label className="text-field">
            <span>Workflow</span>
            <select
              value={selectedTeachWorkflow?.id ?? ""}
              onChange={(event) => setSelectedTeachWorkflowId(event.target.value)}
            >
              <option value="">No workflow</option>
              {(teachModeState?.workflows ?? []).map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-field">
            <span>YAML</span>
            <textarea rows={10} value={selectedTeachWorkflow?.yaml ?? ""} readOnly />
          </label>
          <ol className="validation-list">
            {(selectedTeachWorkflow?.reliabilityNotes ?? []).map((note) => (
              <li key={note}>
                <strong>Reliability</strong>
                <span>{note}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Replay and Skill</h2>
            <span>{pendingTeachSkillCandidates.length} skill pending</span>
          </div>
          <div className="admin-actions">
            <button type="button" disabled={!selectedTeachWorkflow} onClick={() => void createTeachReplay()}>
              Dry-Run Replay
            </button>
            <button type="button" disabled={!selectedTeachWorkflow} onClick={() => void convertTeachWorkflowToSkill()}>
              Convert Skill
            </button>
          </div>
          <ol className="validation-list">
            {recentTeachReplayPlans.map((plan) => (
              <li key={plan.id}>
                <strong>{plan.status} · {plan.stepCount} step(s)</strong>
                <span>{plan.blockedReasons.length ? plan.blockedReasons.join(" ") : "Approval required before replay."}</span>
                <div className="inline-actions">
                  <button type="button" disabled={plan.status !== "draft" || plan.blockedReasons.length > 0} onClick={() => void reviewTeachReplay(plan.id, "approve")}>
                    Approve
                  </button>
                  <button type="button" disabled={plan.status !== "draft"} onClick={() => void reviewTeachReplay(plan.id, "reject")}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <ol className="validation-list">
            {pendingTeachSkillCandidates.map((candidate) => (
              <li key={candidate.id}>
                <strong>{candidate.name}</strong>
                <span>{candidate.summary}</span>
                <div className="inline-actions">
                  <button type="button" onClick={() => void reviewTeachSkillCandidate(candidate.id, "approve")}>
                    Approve
                  </button>
                  <button type="button" onClick={() => void reviewTeachSkillCandidate(candidate.id, "reject")}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <section className="fabric-workspace" aria-label="Model Fabric">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Providers</h2>
            <span>{modelFabricState?.providers.length ?? 0}</span>
          </div>
          <ol className="provider-list">
            {(modelFabricState?.providers ?? []).map((provider) => (
              <li key={provider.id}>
                <strong>{provider.label}</strong>
                <span>{provider.enabled ? "enabled" : "disabled"} · {provider.privacyBoundary}</span>
                <small>{provider.health.detail}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Routing Inspector</h2>
            <span>{selectedRoute?.rejected.length ?? 0} rejected</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Role</span>
              <select value={selectedModelRole} onChange={(event) => setSelectedModelRole(event.target.value as ModelRoleAlias)}>
                {MODEL_ROLE_ALIASES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Privacy</span>
              <select
                value={selectedPrivacyPreset}
                onChange={(event) => setSelectedPrivacyPreset(event.target.value as ModelPrivacyPreset)}
              >
                {(["offline-secure", "local-preferred", "balanced-hybrid", "best-quality", "lowest-cost", "manual"] as const).map((preset) => (
                  <option key={preset} value={preset}>{privacyPresetLabel(preset)}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-field">
            <span>Override</span>
            <select value={selectedOverrideModelId} onChange={(event) => setSelectedOverrideModelId(event.target.value)}>
              <option value="">Auto route</option>
              {roleModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} · {model.installed ? "installed" : "missing"}
                </option>
              ))}
            </select>
          </label>
          <div className="route-detail">
            <strong>{selectedRoute?.selectedModelId ?? "No selected model"}</strong>
            <span>{selectedRoute?.reason ?? "Refresh to inspect the current route."}</span>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => void routeModelRole()}>
              Route
            </button>
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Lifecycle</h2>
            <span>{modelFabricState?.resources.ollamaLoadedModels.length ?? 0} loaded</span>
          </div>
          <label className="text-field">
            <span>Model</span>
            <select value={selectedLifecycleModelId} onChange={(event) => setSelectedLifecycleModelId(event.target.value)}>
              <option value="">Select model</option>
              {lifecycleModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} · {model.lifecycle} · {model.loaded ? "loaded" : "idle"}
                </option>
              ))}
            </select>
          </label>
          <dl className="resource-list">
            <div>
              <dt>Free RAM</dt>
              <dd>{formatBytes(modelFabricState?.resources.freeMemoryBytes ?? 0)}</dd>
            </div>
            <div>
              <dt>Installed</dt>
              <dd>{modelFabricState?.resources.ollamaInstalledModels.length ?? 0}</dd>
            </div>
            <div>
              <dt>Benchmarks</dt>
              <dd>{modelFabricState?.benchmarks.length ?? 0}</dd>
            </div>
          </dl>
          <div className="admin-actions">
            <button type="button" disabled={!selectedLifecycleModelId} onClick={() => void runModelLifecycle("load")}>
              Load
            </button>
            <button type="button" disabled={!selectedLifecycleModelId} onClick={() => void runModelLifecycle("unload")}>
              Unload
            </button>
            <button type="button" disabled={!selectedLifecycleModelId} onClick={() => void runModelBenchmark()}>
              Benchmark
            </button>
          </div>
          {fabricMessage ? <p className="admin-message">{fabricMessage}</p> : null}
        </section>

        <section className="admin-panel plan-panel">
          <div className="panel-heading">
            <h2>Plan Validator</h2>
            <span>{planValidation ? (planValidation.valid ? "valid" : "blocked") : "ready"}</span>
          </div>
          <label className="text-field">
            <span>Execution Plan JSON</span>
            <textarea rows={12} value={planDraft} onChange={(event) => setPlanDraft(event.target.value)} />
          </label>
          <div className="admin-actions">
            <button type="button" onClick={() => void validateModelPlan()}>
              Validate
            </button>
          </div>
          {planValidation ? (
            <ol className="validation-list">
              {planValidation.errors.map((validationError) => (
                <li key={`${validationError.path}-${validationError.message}`}>
                  <strong>{validationError.path}</strong>
                  <span>{validationError.message}</span>
                </li>
              ))}
              {planValidation.errors.length === 0 ? <li>All stages accepted.</li> : null}
            </ol>
          ) : null}
        </section>
      </section>

      <section className="knowledge-workspace" aria-label="Knowledge and RAG">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Knowledge Bases</h2>
            <span>{knowledgeState?.bases.length ?? 0}</span>
          </div>
          <div className="project-list">
            {(knowledgeState?.bases ?? []).map((base) => (
              <button
                type="button"
                key={base.id}
                onClick={() => {
                  setSelectedKnowledgeBaseId(base.id);
                  setKnowledgeBaseDraft({
                    id: base.id,
                    label: base.label,
                    scope: base.scope,
                    ownerId: base.ownerId ?? ""
                  });
                }}
              >
                {base.label}
              </button>
            ))}
          </div>
          <div className="form-row two">
            <label>
              <span>ID</span>
              <input
                value={knowledgeBaseDraft.id}
                onChange={(event) => setKnowledgeBaseDraft((existing) => ({ ...existing, id: event.target.value }))}
              />
            </label>
            <label>
              <span>Label</span>
              <input
                value={knowledgeBaseDraft.label}
                onChange={(event) => setKnowledgeBaseDraft((existing) => ({ ...existing, label: event.target.value }))}
              />
            </label>
          </div>
          <div className="form-row two">
            <label>
              <span>Scope</span>
              <select
                value={knowledgeBaseDraft.scope}
                onChange={(event) => setKnowledgeBaseDraft((existing) => ({ ...existing, scope: event.target.value as KnowledgeScope }))}
              >
                {(["global", "profile", "project", "session"] as const).map((scope) => (
                  <option key={scope} value={scope}>{scope}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Owner</span>
              <input
                value={knowledgeBaseDraft.ownerId}
                onChange={(event) => setKnowledgeBaseDraft((existing) => ({ ...existing, ownerId: event.target.value }))}
              />
            </label>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => void saveKnowledgeBase()}>
              Save Base
            </button>
          </div>
          {knowledgeMessage ? <p className="admin-message">{knowledgeMessage}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Retrieval</h2>
            <span>{selectedKnowledgeBase?.chunkCount ?? 0} chunks</span>
          </div>
          <label className="text-field">
            <span>Base</span>
            <select value={selectedKnowledgeBaseId} onChange={(event) => setSelectedKnowledgeBaseId(event.target.value)}>
              <option value="localai-global">LocalAI Global</option>
              {(knowledgeState?.bases ?? []).map((base) => (
                <option key={base.id} value={base.id}>{base.label}</option>
              ))}
            </select>
          </label>
          <dl className="resource-list">
            <div>
              <dt>Documents</dt>
              <dd>{selectedKnowledgeDocuments.filter((document) => document.status === "ready").length}</dd>
            </div>
            <div>
              <dt>Rejected</dt>
              <dd>{selectedKnowledgeDocuments.filter((document) => document.status !== "ready").length}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selectedKnowledgeBase?.status ?? "empty"}</dd>
            </div>
          </dl>
          <label className="text-field">
            <span>Query</span>
            <textarea rows={3} value={knowledgeQuery} onChange={(event) => setKnowledgeQuery(event.target.value)} />
          </label>
          <div className="admin-actions">
            <button type="button" onClick={() => void selectKnowledgeFiles()}>
              Add Files
            </button>
            <button type="button" disabled={!knowledgeQuery.trim()} onClick={() => void searchKnowledge()}>
              Search
            </button>
          </div>
          {knowledgeSearchResult ? (
            <div className="search-result">
              <strong>{knowledgeSearchResult.notFound ? "Not found" : "Found"}</strong>
              <span>{knowledgeSearchResult.answer}</span>
              <ol className="citation-list">
                {knowledgeSearchResult.citations.map((citation) => (
                  <li key={citation.chunkId}>
                    <strong>{citation.documentName} lines {citation.lineStart}-{citation.lineEnd}</strong>
                    <span>{citation.snippet}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Evaluation</h2>
            <span>{knowledgeEvaluationResult ? `${knowledgeEvaluationResult.passed}/${knowledgeEvaluationResult.total}` : "ready"}</span>
          </div>
          <label className="text-field">
            <span>Questions JSON</span>
            <textarea
              rows={12}
              value={knowledgeEvaluationDraft}
              onChange={(event) => setKnowledgeEvaluationDraft(event.target.value)}
            />
          </label>
          <div className="admin-actions">
            <button type="button" onClick={() => void evaluateKnowledge()}>
              Evaluate
            </button>
          </div>
          {knowledgeEvaluationResult ? (
            <ol className="validation-list">
              {knowledgeEvaluationResult.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.passed ? "pass" : "fail"} · {item.id}</strong>
                  <span>{item.detail} Top: {item.topDocumentName ?? "none"}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      </section>

      <section className="learning-workspace" aria-label="Memory skills and learning queue">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Memory Queue</h2>
            <span>{pendingMemoryCandidates.length} pending</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Scope</span>
              <select
                value={memoryCandidateDraft.scope}
                onChange={(event) => setMemoryCandidateDraft((existing) => ({ ...existing, scope: event.target.value as LearningScope }))}
              >
                {(["user", "profile", "project", "session"] as const).map((scope) => (
                  <option key={scope} value={scope}>{scope}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Note</span>
              <input
                value={memoryCandidateDraft.note}
                onChange={(event) => setMemoryCandidateDraft((existing) => ({ ...existing, note: event.target.value }))}
              />
            </label>
          </div>
          <label className="text-field">
            <span>Candidate</span>
            <textarea
              rows={5}
              value={memoryCandidateDraft.content}
              onChange={(event) => setMemoryCandidateDraft((existing) => ({ ...existing, content: event.target.value }))}
            />
          </label>
          <div className="admin-actions">
            <button type="button" disabled={!memoryCandidateDraft.content.trim()} onClick={() => void proposeMemoryCandidate()}>
              Propose Memory
            </button>
          </div>
          <ol className="validation-list">
            {pendingMemoryCandidates.map((candidate) => (
              <li key={candidate.id}>
                <strong>{candidate.scope} · {candidate.confidence.toFixed(2)}</strong>
                <span>{candidate.content}</span>
                <div className="inline-actions">
                  <button type="button" onClick={() => void reviewMemoryCandidate(candidate.id, "approve")}>Approve</button>
                  <button type="button" onClick={() => void reviewMemoryCandidate(candidate.id, "reject")}>Reject</button>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Skill Queue</h2>
            <span>{pendingSkillCandidates.length} pending</span>
          </div>
          <div className="form-row two">
            <label>
              <span>Name</span>
              <input
                value={skillCandidateDraft.name}
                onChange={(event) => setSkillCandidateDraft((existing) => ({ ...existing, name: event.target.value }))}
              />
            </label>
            <label>
              <span>Note</span>
              <input
                value={skillCandidateDraft.note}
                onChange={(event) => setSkillCandidateDraft((existing) => ({ ...existing, note: event.target.value }))}
              />
            </label>
          </div>
          <label className="text-field">
            <span>Summary</span>
            <input
              value={skillCandidateDraft.summary}
              onChange={(event) => setSkillCandidateDraft((existing) => ({ ...existing, summary: event.target.value }))}
            />
          </label>
          <label className="text-field">
            <span>Body</span>
            <textarea
              rows={8}
              value={skillCandidateDraft.body}
              onChange={(event) => setSkillCandidateDraft((existing) => ({ ...existing, body: event.target.value }))}
            />
          </label>
          <div className="admin-actions">
            <button type="button" onClick={() => void proposeSkillCandidate()}>
              Propose Skill
            </button>
          </div>
          <ol className="validation-list">
            {pendingSkillCandidates.map((candidate) => (
              <li key={candidate.id}>
                <strong>{candidate.name}</strong>
                <span>{candidate.summary}</span>
                <div className="inline-actions">
                  <button type="button" onClick={() => void reviewSkillCandidate(candidate.id, "approve")}>Approve</button>
                  <button type="button" onClick={() => void reviewSkillCandidate(candidate.id, "reject")}>Reject</button>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Approved Learning</h2>
            <span>{learningState?.skills.length ?? 0} skills</span>
          </div>
          <dl className="resource-list">
            <div>
              <dt>Memories</dt>
              <dd>{learningState?.memoryItems.length ?? 0}</dd>
            </div>
            <div>
              <dt>Skills</dt>
              <dd>{learningState?.skills.length ?? 0}</dd>
            </div>
            <div>
              <dt>Audit</dt>
              <dd>{learningState?.audit.length ?? 0}</dd>
            </div>
          </dl>
          <ol className="validation-list">
            {(learningState?.skills ?? []).map((skill) => (
              <li key={skill.id}>
                <strong>{skill.name} · v{skill.activeVersion}</strong>
                <span>{skill.versions.length} version(s)</span>
                <div className="inline-actions">
                  {skill.versions.map((version) => (
                    <button
                      type="button"
                      key={version.version}
                      disabled={version.version === skill.activeVersion}
                      onClick={() => void rollbackSkillVersion(skill.id, version.version)}
                    >
                      v{version.version}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          {learningMessage ? <p className="admin-message">{learningMessage}</p> : null}
        </section>
      </section>

      <section className="chat-workspace" aria-label="Hermes chat">
        <section className="chat-panel">
          <div className="chat-toolbar">
            <label>
              <span>Profile</span>
              <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                {(chatState?.profiles ?? []).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Session</span>
              <select
                value={selectedSessionId ?? ""}
                onChange={(event) => setSelectedSessionId(event.target.value ? event.target.value : null)}
              >
                <option value="">New session</option>
                {(chatState?.sessions ?? []).map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.preview} · {session.lastActive}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="message-list" aria-live="polite">
            {messages.length === 0 ? (
              <div className="empty-chat">
                Start a local Hermes chat. Selected files stay metadata-only unless supported by the current profile.
              </div>
            ) : null}
            {messages.map((message) => (
              <article className={`message message-${message.role}`} key={message.id}>
                <div className="message-meta">
                  <strong>{message.role === "user" ? "You" : "Hermes"}</strong>
                  <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
                </div>
                <p>{message.content || (message.role === "assistant" && isChatRunning ? "Thinking..." : "")}</p>
                {message.attachments.length > 0 ? (
                  <ul className="attachment-list">
                    {message.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        {attachment.name} · {attachment.kind} · {formatBytes(attachment.sizeBytes)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>

          {selectedAttachments.length > 0 ? (
            <ul className="selected-attachments">
              {selectedAttachments.map((attachment) => (
                <li key={attachment.id}>
                  {attachment.name}
                  <span>{attachment.kind} · {formatBytes(attachment.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="composer">
            <textarea
              value={draft}
              rows={4}
              placeholder="Message Hermes..."
              disabled={isChatRunning}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="composer-actions">
              <button type="button" disabled={isChatRunning} onClick={() => void selectAttachments()}>
                Attach
              </button>
              <button type="button" disabled={!isChatRunning} onClick={() => void cancelChat()}>
                Stop
              </button>
              <button type="button" disabled={!draft.trim() || isChatRunning} onClick={() => void sendMessage()}>
                Send
              </button>
            </div>
          </div>
        </section>

        <aside className="timeline-panel">
          <div className="panel-heading">
            <h2>Tool Timeline</h2>
            <span>{recentTimeline.length}</span>
          </div>
          <ol>
            {recentTimeline.map((entry) => (
              <li key={entry.id} className={`timeline-${entry.state}`}>
                <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
                <strong>{entry.title}</strong>
                <span>{entry.detail}</span>
              </li>
            ))}
          </ol>
          {recentTimeline.length === 0 ? <p className="muted">No chat activity yet.</p> : null}
        </aside>
      </section>

      <section className="admin-workspace" aria-label="Profiles projects and config">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Profiles</h2>
            <span>{profileConfigState?.profiles.length ?? 0}</span>
          </div>
          <div className="form-row">
            <label>
              <span>Load</span>
              <select value={selectedAdminProfileId} onChange={(event) => setSelectedAdminProfileId(event.target.value)}>
                {(profileConfigState?.profiles ?? []).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void loadProfile(selectedAdminProfileId)}>
              Load
            </button>
          </div>
          <div className="form-row two">
            <label>
              <span>ID</span>
              <input
                value={profileDraft?.id ?? ""}
                onChange={(event) => setProfileDraft((existing) => existing ? { ...existing, id: event.target.value } : null)}
              />
            </label>
            <label>
              <span>Label</span>
              <input
                value={profileDraft?.label ?? ""}
                onChange={(event) => setProfileDraft((existing) => existing ? { ...existing, label: event.target.value } : null)}
              />
            </label>
          </div>
          {(["SOUL.md", "USER.md", "MEMORY.md"] as const).map((fileName) => (
            <label className="text-field" key={fileName}>
              <span>{fileName}</span>
              <textarea
                rows={4}
                value={profileDraft?.files[fileName] ?? ""}
                onChange={(event) => setProfileDraft((existing) => existing
                  ? { ...existing, files: { ...existing.files, [fileName]: event.target.value } }
                  : null)}
              />
            </label>
          ))}
          <div className="admin-actions">
            <button type="button" disabled={!profileDraft} onClick={() => void saveProfile()}>
              Save Profile
            </button>
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Projects</h2>
            <span>{profileConfigState?.projects.length ?? 0}</span>
          </div>
          <div className="project-list">
            {(profileConfigState?.projects ?? []).map((project) => (
              <button type="button" key={project.id} onClick={() => setProjectDraft(projectToDraft(project))}>
                {project.label}
              </button>
            ))}
          </div>
          <div className="form-row two">
            <label>
              <span>ID</span>
              <input
                value={projectDraft?.id ?? ""}
                onChange={(event) => setProjectDraft((existing) => existing ? { ...existing, id: event.target.value } : null)}
              />
            </label>
            <label>
              <span>Label</span>
              <input
                value={projectDraft?.label ?? ""}
                onChange={(event) => setProjectDraft((existing) => existing ? { ...existing, label: event.target.value } : null)}
              />
            </label>
          </div>
          <label className="text-field">
            <span>Root</span>
            <input
              value={projectDraft?.rootPath ?? ""}
              onChange={(event) => setProjectDraft((existing) => existing ? { ...existing, rootPath: event.target.value } : null)}
            />
          </label>
          <label className="text-field">
            <span>Profile</span>
            <select
              value={projectDraft?.profileId ?? "default"}
              onChange={(event) => setProjectDraft((existing) => existing ? { ...existing, profileId: event.target.value } : null)}
            >
              {(profileConfigState?.profiles ?? []).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-actions">
            <button type="button" disabled={!projectDraft} onClick={() => void saveProject()}>
              Save Project
            </button>
          </div>
        </section>

        <section className="admin-panel config-panel">
          <div className="panel-heading">
            <h2>Config</h2>
            <span>{profileConfigState?.hermesConfig.sizeBytes ?? 0} B</span>
          </div>
          <label className="text-field">
            <span>Path</span>
            <input value={profileConfigState?.hermesConfig.targetPath ?? ""} readOnly />
          </label>
          <label className="text-field">
            <span>YAML</span>
            <textarea rows={12} value={configDraft ?? ""} onChange={(event) => setConfigDraft(event.target.value)} />
          </label>
          <div className="admin-actions">
            <button type="button" disabled={configDraft === null} onClick={() => void saveHermesConfig()}>
              Save Config
            </button>
            <button type="button" onClick={() => void exportBackup()}>
              Export Backup
            </button>
          </div>
          {adminMessage ? <p className="admin-message">{adminMessage}</p> : null}
        </section>
      </section>

      <section className="service-grid" aria-label="Service health">
        {(snapshot?.services ?? []).map((service) => (
          <article className="service-card" key={service.id}>
            <div className="service-heading">
              <div>
                <h2>{service.label}</h2>
                <p>{service.description}</p>
              </div>
              <span className={healthClass(service)}>{service.health.state}</span>
            </div>
            <dl>
              <div>
                <dt>Lifecycle</dt>
                <dd>{service.lifecycle}</dd>
              </div>
              <div>
                <dt>PID</dt>
                <dd>{service.pid ?? "none"}</dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd>{service.health.latencyMs ? `${service.health.latencyMs} ms` : "n/a"}</dd>
              </div>
            </dl>
            <p className="detail">{service.health.detail}</p>
            <div className="service-actions">
              <button type="button" disabled={!service.startable} onClick={() => void startService(service.id)}>
                Start
              </button>
              <button type="button" disabled={!service.stoppable} onClick={() => void stopService(service.id)}>
                Stop
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="log-panel">
        <div className="panel-heading">
          <h2>Supervisor Logs</h2>
          <span>{recentLogs.length}</span>
        </div>
        <ol>
          {recentLogs.map((log) => (
            <li key={log.id} className={`log-${log.level}`}>
              <time>{new Date(log.timestamp).toLocaleTimeString()}</time>
              <strong>{log.serviceId}</strong>
              <span>{log.message}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
