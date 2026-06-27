import type {
  CommandCenterIntent,
  CommandCenterPolicy,
  CommandCenterState,
  CommandPlan,
  CommandPlanRisk,
  CommandPlanRoute,
  CommandPlanStep,
  CreateCommandPlanRequest,
  ReviewCommandPlanRequest
} from "@hermes-local-ai/contracts";

const COMMAND_CENTER_POLICY: CommandCenterPolicy = {
  localPlanningOnly: true,
  externalAiPlanningAllowed: false,
  requiresApproval: true,
  silentExecutionAllowed: false,
  noCredentialEntry: true,
  noDestructiveCommands: true,
  maxCommandChars: 600,
  supportedIntents: [
    "chat",
    "backup",
    "package",
    "automation",
    "app-adapter",
    "computer-control",
    "knowledge",
    "unknown"
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

const SENSITIVE_PATTERN = /\b(password|passcode|otp|mfa|payment|purchase|credit\s+card|api\s+key|secret|token|credential|elevate|administrator)\b/iu;
const DESTRUCTIVE_PATTERN = /\b(delete|remove|erase|format|wipe|shutdown|restart|kill|terminate|drop\s+table|rm\s+-rf|del\s+\/[sq]|rd\s+\/s)\b/iu;

export class CommandCenterManager {
  private readonly plans: CommandPlan[] = [];
  private nextPlanId = 1;

  public getState(): CommandCenterState {
    return {
      policy: COMMAND_CENTER_POLICY,
      plans: [...this.plans]
    };
  }

  public createPlan(request: CreateCommandPlanRequest): CommandCenterState {
    const command = normalizeText(request.command, "command", COMMAND_CENTER_POLICY.maxCommandChars);
    const context = request.context === undefined ? "" : normalizeOptionalText(request.context, "command context", 400);
    const classification = classifyCommand(`${command} ${context}`);
    const blockedReasons = buildBlockedReasons(command, context);
    const now = new Date().toISOString();
    const plan: CommandPlan = {
      id: `command-plan-${this.nextPlanId}`,
      command,
      intent: classification.intent,
      title: classification.title,
      summary: classification.summary,
      risk: blockedReasons.length > 0 ? "high" : classification.risk,
      status: "draft",
      route: classification.route,
      requiresApproval: true,
      createdAt: now,
      reviewedAt: null,
      reviewNote: null,
      blockedReasons,
      steps: buildSteps(classification.intent, classification.route, command, blockedReasons.length > 0)
    };
    this.nextPlanId += 1;
    this.plans.unshift(plan);
    this.plans.splice(20);
    return this.getState();
  }

  public reviewPlan(request: ReviewCommandPlanRequest): CommandCenterState {
    const index = this.plans.findIndex((plan) => plan.id === request.planId);
    if (index < 0) {
      throw new Error("Unknown command plan.");
    }
    const existing = this.plans[index];
    if (!existing || existing.status !== "draft") {
      throw new Error("Only draft command plans can be reviewed.");
    }
    if (request.decision === "approve" && existing.blockedReasons.length > 0) {
      throw new Error("Command plan with blocked reasons cannot be approved.");
    }
    this.plans[index] = {
      ...existing,
      status: request.decision === "approve" ? "approved" : "rejected",
      reviewedAt: new Date().toISOString(),
      reviewNote: request.reviewNote === undefined ? null : normalizeOptionalText(request.reviewNote, "command review note", 240)
    };
    return this.getState();
  }
}

function classifyCommand(value: string): {
  readonly intent: CommandCenterIntent;
  readonly title: string;
  readonly summary: string;
  readonly risk: CommandPlanRisk;
  readonly route: CommandPlanRoute;
} {
  const text = value.toLowerCase();
  if (/\b(backup|export|restore)\b/u.test(text)) {
    return {
      intent: "backup",
      title: "Backup or restore plan",
      summary: "Prepare a backup/export or restore-plan workflow with explicit review before any restore apply path.",
      risk: text.includes("restore") ? "medium" : "low",
      route: "profile-config"
    };
  }
  if (/\b(automation|automate|schedule|trigger|watch)\b/u.test(text)) {
    return {
      intent: "automation",
      title: "Automation draft plan",
      summary: "Create a dry-run automation draft with approval, desktop-unlocked checks, and failure handling.",
      risk: "medium",
      route: "automation"
    };
  }
  if (/\b(knowledge|rag|document|search|index|ingest|file)\b/u.test(text)) {
    return {
      intent: "knowledge",
      title: "Knowledge workflow plan",
      summary: "Use local knowledge bases for scoped search, ingestion, or evaluation without broad filesystem access.",
      risk: "low",
      route: "knowledge"
    };
  }
  if (/\b(package|installer|install|update|hardening|release)\b/u.test(text)) {
    return {
      intent: "package",
      title: "Packaging and hardening plan",
      summary: "Inspect readiness, generate checksums, and keep install or update steps approval-gated.",
      risk: "medium",
      route: "packaging-hardening"
    };
  }
  if (/\b(app adapter|adapter|open app|office|browser|explorer|powershell|vscode|bambu)\b/u.test(text)) {
    return {
      intent: "app-adapter",
      title: "App adapter plan",
      summary: "Create an app-specific plan that prefers semantic adapters and keeps active actions review-gated.",
      risk: "medium",
      route: "app-adapters"
    };
  }
  if (/\b(click|type|mouse|keyboard|window|screen|computer|ui tree|control)\b/u.test(text)) {
    return {
      intent: "computer-control",
      title: "Computer control plan",
      summary: "Observe the target first, propose a strict-schema action, and require approval before any active control.",
      risk: "high",
      route: "computer-control"
    };
  }
  if (/\b(chat|ask|answer|summarize|explain|draft)\b/u.test(text)) {
    return {
      intent: "chat",
      title: "Chat response plan",
      summary: "Route the request through the local chat workflow with current profile and project context.",
      risk: "low",
      route: "chat"
    };
  }
  return {
    intent: "unknown",
    title: "Manual review plan",
    summary: "Clarify the target workflow, then route to the safest matching Studio module.",
    risk: "low",
    route: "manual-review"
  };
}

function buildSteps(intent: CommandCenterIntent, route: CommandPlanRoute, command: string, blocked: boolean): readonly CommandPlanStep[] {
  if (blocked) {
    return [
      {
        id: "step-1",
        title: "Stop and review",
        detail: "The command contains blocked sensitive or destructive content and cannot be approved from Command Center.",
        route: "manual-review",
        requiresApproval: true
      }
    ];
  }

  const first: CommandPlanStep = {
    id: "step-1",
    title: "Confirm intent",
    detail: `Interpret the command as ${intent}: ${command}`,
    route,
    requiresApproval: false
  };
  const approval: CommandPlanStep = {
    id: "step-2",
    title: "Get approval",
    detail: "User approves this command plan before handoff to the target Studio module.",
    route: "manual-review",
    requiresApproval: true
  };
  const handoff: CommandPlanStep = {
    id: "step-3",
    title: "Handoff",
    detail: handoffDetail(intent),
    route,
    requiresApproval: false
  };
  return [first, approval, handoff];
}

function handoffDetail(intent: CommandCenterIntent): string {
  if (intent === "backup") {
    return "Use Profile and Config backup/export or create a restore plan.";
  }
  if (intent === "package") {
    return "Use Packaging and Hardening readiness checks and manifest generation.";
  }
  if (intent === "automation") {
    return "Use Automations to create a dry-run draft with failure policy.";
  }
  if (intent === "app-adapter") {
    return "Use App Adapters to create a semantic app plan.";
  }
  if (intent === "computer-control") {
    return "Use Computer Control observe-first workflow and strict action approval.";
  }
  if (intent === "knowledge") {
    return "Use Knowledge/RAG to ingest, search, or evaluate local documents.";
  }
  if (intent === "chat") {
    return "Use Chat with the active profile and project context.";
  }
  return "Use manual review to choose the safest route.";
}

function buildBlockedReasons(command: string, context: string): readonly string[] {
  const haystack = `${command} ${context}`;
  const reasons: string[] = [];
  if (SENSITIVE_PATTERN.test(haystack)) {
    reasons.push("Sensitive credential, payment, MFA, or elevation content is blocked.");
  }
  if (DESTRUCTIVE_PATTERN.test(haystack)) {
    reasons.push("Destructive commands require separate explicit confirmation outside Command Center.");
  }
  return reasons;
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
