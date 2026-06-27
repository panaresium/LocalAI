import { delimiter } from "node:path";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type {
  AppAdapterActionKind,
  AppAdapterActionPlan,
  AppAdapterCapability,
  AppAdapterKind,
  AppAdapterPlanStep,
  AppAdapterPolicy,
  AppAdapterProbeResult,
  AppAdapterRisk,
  AppAdapterRoute,
  AppAdapterState,
  AppAdapterStatus,
  AppAdapterSummary,
  CreateAppAdapterPlanRequest,
  ProbeAppAdaptersRequest,
  ReviewAppAdapterPlanRequest
} from "@hermes-local-ai/contracts";

const MILESTONE13_APP_ADAPTER_POLICY: AppAdapterPolicy = {
  milestone: 13,
  semanticInterfacesPreferred: true,
  genericWindowsFallbackEnabled: true,
  actionsRequireApproval: true,
  destructiveActionRequiresExplicitConfirmation: true,
  noCredentialEntry: true,
  noSilentElevation: true,
  supportedAdapterKinds: [
    "file-explorer",
    "microsoft-office",
    "vscode-codex",
    "browser",
    "powershell",
    "generic-windows",
    "bambu-studio"
  ],
  blockedTerms: [
    "password",
    "passcode",
    "otp",
    "mfa",
    "payment",
    "credit card",
    "api key",
    "secret",
    "token",
    "credential"
  ]
};

type AdapterSeed = {
  readonly id: string;
  readonly kind: AppAdapterKind;
  readonly label: string;
  readonly priority: number;
  readonly executableHints: readonly string[];
  readonly knownPaths: readonly string[];
  readonly capabilities: readonly AppAdapterCapability[];
  readonly supportedActions: readonly AppAdapterActionKind[];
  readonly safetyNotes: readonly string[];
  readonly route: AppAdapterRoute;
  readonly fixedStatus?: AppAdapterStatus;
};

const ADAPTER_SEEDS: readonly AdapterSeed[] = [
  {
    id: "file-explorer",
    kind: "file-explorer",
    label: "File Explorer",
    priority: 10,
    executableHints: ["explorer.exe"],
    knownPaths: [join(process.env["WINDIR"] ?? "C:\\Windows", "explorer.exe")],
    capabilities: ["filesystem-navigation", "ui-automation"],
    supportedActions: ["open-path", "focus-window", "inspect-context"],
    safetyNotes: ["File operations are planned only; destructive filesystem actions are blocked at this milestone."],
    route: "structured-adapter"
  },
  {
    id: "microsoft-office",
    kind: "microsoft-office",
    label: "Microsoft Office",
    priority: 20,
    executableHints: ["WINWORD.EXE", "EXCEL.EXE", "POWERPNT.EXE", "OUTLOOK.EXE"],
    knownPaths: [
      "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE",
      "C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE",
      "C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE",
      "C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE",
      "C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\WINWORD.EXE",
      "C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\EXCEL.EXE",
      "C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\POWERPNT.EXE",
      "C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE"
    ],
    capabilities: ["office-document-context", "ui-automation", "workflow-replay"],
    supportedActions: ["office-document-context", "focus-window", "inspect-context"],
    safetyNotes: ["Office adapters expose document context planning; macros and credential entry are not executed."],
    route: "structured-adapter"
  },
  {
    id: "vscode-codex",
    kind: "vscode-codex",
    label: "VS Code / Codex Workflow",
    priority: 30,
    executableHints: ["Code.exe", "codex.cmd", "codex.exe"],
    knownPaths: [
      join(process.env["LOCALAPPDATA"] ?? "", "Programs", "Microsoft VS Code", "Code.exe"),
      "C:\\Program Files\\Microsoft VS Code\\Code.exe"
    ],
    capabilities: ["developer-workspace-context", "command-planning", "ui-automation"],
    supportedActions: ["open-project", "run-command", "inspect-context"],
    safetyNotes: ["Command plans are dry-run and require explicit review before any shell execution path can be used."],
    route: "structured-adapter"
  },
  {
    id: "browser",
    kind: "browser",
    label: "Browser",
    priority: 40,
    executableHints: ["msedge.exe", "chrome.exe"],
    knownPaths: [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    ],
    capabilities: ["browser-dom", "ui-automation"],
    supportedActions: ["browser-inspect", "focus-window", "inspect-context"],
    safetyNotes: ["Browser adapters prefer DOM inspection and never inspect passwords, cookies, payment methods, or MFA flows."],
    route: "browser-control"
  },
  {
    id: "powershell",
    kind: "powershell",
    label: "PowerShell",
    priority: 50,
    executableHints: ["pwsh.exe", "powershell.exe"],
    knownPaths: [
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      join(process.env["WINDIR"] ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    ],
    capabilities: ["command-planning"],
    supportedActions: ["run-command", "inspect-context"],
    safetyNotes: ["PowerShell commands are planned, not executed, and destructive commands are blocked for approval routing."],
    route: "manual-review"
  },
  {
    id: "generic-windows",
    kind: "generic-windows",
    label: "Generic Windows App",
    priority: 60,
    executableHints: [],
    knownPaths: [],
    capabilities: ["ui-automation", "workflow-replay"],
    supportedActions: ["generic-ui-tree", "focus-window", "inspect-context"],
    safetyNotes: ["Generic Windows fallback uses observe-first Windows UI Automation and routes active actions through the broker."],
    route: "windows-broker",
    fixedStatus: "fallback"
  },
  {
    id: "bambu-studio",
    kind: "bambu-studio",
    label: "Bambu Studio",
    priority: 70,
    executableHints: ["bambu-studio.exe", "BambuStudio.exe"],
    knownPaths: [
      "C:\\Program Files\\Bambu Studio\\bambu-studio.exe",
      "C:\\Program Files\\BambuStudio\\BambuStudio.exe"
    ],
    capabilities: ["future-specialized-control", "ui-automation"],
    supportedActions: ["bambu-placeholder", "inspect-context"],
    safetyNotes: ["Bambu Studio is registered as a future specialized adapter; Milestone 13 does not automate printer operations."],
    route: "future-adapter",
    fixedStatus: "future"
  }
];

const DESTRUCTIVE_PATTERN = /\b(delete|remove|erase|format|wipe|shutdown|restart|kill|terminate|drop\s+table|rm\s+-rf|del\s+\/[sq]|rd\s+\/s)\b/iu;

export class AppAdapterManager {
  private adapters: AppAdapterSummary[] = [];
  private readonly plans: AppAdapterActionPlan[] = [];
  private nextPlanId = 1;
  private lastProbedAt: string | null = null;

  public constructor(private readonly root: string) {
    void this.root;
    this.adapters = ADAPTER_SEEDS.map((seed) => this.probeSeed(seed, new Date().toISOString()));
  }

  public getState(): AppAdapterState {
    return {
      policy: MILESTONE13_APP_ADAPTER_POLICY,
      adapters: [...this.adapters],
      actionPlans: [...this.plans],
      lastProbedAt: this.lastProbedAt
    };
  }

  public probeAdapters(request: ProbeAppAdaptersRequest = {}): AppAdapterState {
    const allowedIds = request.adapterIds === undefined ? null : new Set(request.adapterIds);
    const checkedAt = new Date().toISOString();
    this.adapters = ADAPTER_SEEDS.map((seed) => {
      const existing = this.adapters.find((adapter) => adapter.id === seed.id);
      if (allowedIds !== null && !allowedIds.has(seed.id) && existing) {
        return existing;
      }
      return this.probeSeed(seed, checkedAt);
    });
    this.lastProbedAt = checkedAt;
    return this.getState();
  }

  public createPlan(request: CreateAppAdapterPlanRequest): AppAdapterActionPlan {
    const adapter = this.findAdapter(request.adapterId);
    if (!adapter.supportedActions.includes(request.action)) {
      throw new Error("Adapter does not support the requested action.");
    }

    const target = normalizeText(request.target, "adapter target", 300);
    const intent = normalizeText(request.intent, "adapter intent", 300);
    const context = normalizeContext(request.context);
    rejectCredentialLikeText([target, intent, ...context.map((entry) => `${entry.key} ${entry.value}`)]);

    const blockedReasons = buildBlockedReasons(adapter, target, intent);
    const risk = determineRisk(adapter.kind, request.action, target, intent, blockedReasons);
    const steps = buildPlanSteps(adapter, request.action, target, intent);
    const verification = buildVerification(adapter, request.action, target);
    const now = new Date().toISOString();
    const plan: AppAdapterActionPlan = {
      id: `app-adapter-plan-${this.nextPlanId}`,
      adapterId: adapter.id,
      adapterKind: adapter.kind,
      action: request.action,
      target,
      intent,
      risk,
      status: "draft",
      requiresApproval: true,
      blockedReasons,
      steps,
      verification,
      createdAt: now,
      reviewedAt: null,
      reviewNote: null
    };
    this.nextPlanId += 1;
    this.plans.unshift(plan);
    this.plans.splice(16);
    return plan;
  }

  public reviewPlan(request: ReviewAppAdapterPlanRequest): AppAdapterState {
    const index = this.plans.findIndex((plan) => plan.id === request.planId);
    if (index < 0) {
      throw new Error("Unknown app adapter plan.");
    }
    const existing = this.plans[index];
    if (!existing || existing.status !== "draft") {
      throw new Error("Only draft app adapter plans can be reviewed.");
    }
    if (request.decision === "approve" && existing.blockedReasons.length > 0) {
      throw new Error("App adapter plan with blocked reasons cannot be approved.");
    }
    this.plans[index] = {
      ...existing,
      status: request.decision === "approve" ? "approved" : "rejected",
      reviewedAt: new Date().toISOString(),
      reviewNote: request.reviewNote === undefined ? null : normalizeOptionalText(request.reviewNote, "review note", 240)
    };
    return this.getState();
  }

  private findAdapter(adapterId: string): AppAdapterSummary {
    const adapter = this.adapters.find((candidate) => candidate.id === adapterId);
    if (!adapter) {
      throw new Error("Unknown app adapter.");
    }
    return adapter;
  }

  private probeSeed(seed: AdapterSeed, checkedAt: string): AppAdapterSummary {
    const detection = detectAdapter(seed, checkedAt);
    return {
      id: seed.id,
      kind: seed.kind,
      label: seed.label,
      priority: seed.priority,
      executableHints: seed.executableHints,
      capabilities: seed.capabilities,
      supportedActions: seed.supportedActions,
      safetyNotes: seed.safetyNotes,
      detection
    };
  }
}

function detectAdapter(seed: AdapterSeed, checkedAt: string): AppAdapterProbeResult {
  if (seed.fixedStatus === "fallback") {
    return {
      adapterId: seed.id,
      status: "fallback",
      checkedAt,
      executablePath: null,
      confidence: 1,
      detail: "Available through the Windows UI Automation broker fallback."
    };
  }
  if (seed.fixedStatus === "future") {
    return {
      adapterId: seed.id,
      status: "future",
      checkedAt,
      executablePath: findExecutable(seed),
      confidence: 0.2,
      detail: "Registered as a future specialized adapter. Planning only."
    };
  }

  const executablePath = findExecutable(seed);
  if (executablePath) {
    return {
      adapterId: seed.id,
      status: "available",
      checkedAt,
      executablePath,
      confidence: 0.9,
      detail: `Detected ${seed.label} executable.`
    };
  }

  return {
    adapterId: seed.id,
    status: "missing",
    checkedAt,
    executablePath: null,
    confidence: 0.3,
    detail: `${seed.label} executable was not found in known locations or PATH.`
  };
}

function findExecutable(seed: AdapterSeed): string | null {
  for (const knownPath of seed.knownPaths) {
    if (knownPath && existsSync(knownPath)) {
      return knownPath;
    }
  }

  const pathEntries = (process.env["PATH"] ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of pathEntries) {
    for (const hint of seed.executableHints) {
      const candidate = join(entry, hint);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function buildBlockedReasons(adapter: AppAdapterSummary, target: string, intent: string): readonly string[] {
  const reasons: string[] = [];
  if (adapter.detection.status === "missing") {
    reasons.push("Adapter executable is not available on this machine.");
  }
  if (adapter.detection.status === "future") {
    reasons.push("Adapter is registered for future specialized control only.");
  }
  if (DESTRUCTIVE_PATTERN.test(`${target} ${intent}`)) {
    reasons.push("Destructive adapter plans require a separate explicit confirmation outside Milestone 13.");
  }
  return reasons;
}

function determineRisk(
  adapterKind: AppAdapterKind,
  action: AppAdapterActionKind,
  target: string,
  intent: string,
  blockedReasons: readonly string[]
): AppAdapterRisk {
  if (blockedReasons.length > 0 && DESTRUCTIVE_PATTERN.test(`${target} ${intent}`)) {
    return "high";
  }
  if (action === "run-command" || adapterKind === "powershell" || adapterKind === "generic-windows") {
    return "medium";
  }
  return "low";
}

function buildPlanSteps(
  adapter: AppAdapterSummary,
  action: AppAdapterActionKind,
  target: string,
  intent: string
): readonly AppAdapterPlanStep[] {
  const route = routeFor(adapter.kind);
  const base: AppAdapterPlanStep[] = [
    {
      id: "step-1",
      description: `Select ${adapter.label} for ${action}.`,
      route,
      requiresApproval: false
    }
  ];

  if (adapter.kind === "file-explorer") {
    base.push({
      id: "step-2",
      description: `Resolve and focus the requested path: ${target}.`,
      route: "structured-adapter",
      requiresApproval: true
    });
  } else if (adapter.kind === "microsoft-office") {
    base.push({
      id: "step-2",
      description: `Inspect Office document context for: ${target}.`,
      route: "structured-adapter",
      requiresApproval: true
    });
  } else if (adapter.kind === "vscode-codex") {
    base.push({
      id: "step-2",
      description: `Open or inspect the developer workspace for: ${target}.`,
      route: "structured-adapter",
      requiresApproval: true
    });
  } else if (adapter.kind === "browser") {
    base.push({
      id: "step-2",
      description: `Use DOM-first browser inspection for: ${target}.`,
      route: "browser-control",
      requiresApproval: true
    });
  } else if (adapter.kind === "powershell") {
    base.push({
      id: "step-2",
      description: `Keep command intent as a reviewed dry-run plan: ${intent}.`,
      route: "manual-review",
      requiresApproval: true
    });
  } else if (adapter.kind === "generic-windows") {
    base.push({
      id: "step-2",
      description: `Capture window and UI Automation context before any active action: ${target}.`,
      route: "windows-broker",
      requiresApproval: true
    });
  } else {
    base.push({
      id: "step-2",
      description: "Hold this workflow for a future specialized Bambu Studio adapter.",
      route: "future-adapter",
      requiresApproval: true
    });
  }

  base.push({
    id: "step-3",
    description: "Verify the visible app state before considering the plan complete.",
    route,
    requiresApproval: false
  });
  return base;
}

function routeFor(kind: AppAdapterKind): AppAdapterRoute {
  if (kind === "browser") {
    return "browser-control";
  }
  if (kind === "generic-windows") {
    return "windows-broker";
  }
  if (kind === "powershell") {
    return "manual-review";
  }
  if (kind === "bambu-studio") {
    return "future-adapter";
  }
  return "structured-adapter";
}

function buildVerification(adapter: AppAdapterSummary, action: AppAdapterActionKind, target: string): readonly string[] {
  if (action === "browser-inspect") {
    return ["DOM inspection returns the expected page title or element.", "No blocked browser credential surface is requested."];
  }
  if (adapter.kind === "powershell") {
    return ["Command remains a dry-run plan.", "User reviews exact command text before any later execution path."];
  }
  if (adapter.kind === "generic-windows") {
    return ["Window list contains the target app.", "UI tree contains the expected semantic control."];
  }
  return [`Visible app context matches ${target}.`, "No credential, payment, or destructive prompt is present."];
}

function normalizeContext(value: readonly unknown[]): readonly { readonly key: string; readonly value: string }[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid app adapter context.");
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.key !== "string" || typeof entry.value !== "string") {
      throw new Error("Invalid app adapter context entry.");
    }
    return {
      key: normalizeText(entry.key, "context key", 60),
      value: normalizeText(entry.value, "context value", 240)
    };
  });
}

function normalizeText(value: string, label: string, maxLength: number): string {
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new Error(`Invalid ${label}.`);
  }
  return text;
}

function normalizeOptionalText(value: string, label: string, maxLength: number): string {
  if (value.length > maxLength) {
    throw new Error(`Invalid ${label}.`);
  }
  return value.trim();
}

function rejectCredentialLikeText(values: readonly string[]): void {
  const haystack = values.join(" ").toLowerCase();
  const blocked = MILESTONE13_APP_ADAPTER_POLICY.blockedTerms.find((term) => haystack.includes(term));
  if (blocked) {
    throw new Error(`Blocked app adapter credential-like content: ${blocked}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
