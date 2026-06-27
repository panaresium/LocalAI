export type AppAdapterKind =
  | "file-explorer"
  | "microsoft-office"
  | "vscode-codex"
  | "browser"
  | "powershell"
  | "generic-windows"
  | "bambu-studio";

export type AppAdapterStatus = "available" | "missing" | "fallback" | "future" | "disabled";

export type AppAdapterCapability =
  | "filesystem-navigation"
  | "office-document-context"
  | "developer-workspace-context"
  | "browser-dom"
  | "command-planning"
  | "ui-automation"
  | "workflow-replay"
  | "future-specialized-control";

export type AppAdapterActionKind =
  | "open-path"
  | "focus-window"
  | "inspect-context"
  | "open-project"
  | "run-command"
  | "browser-inspect"
  | "office-document-context"
  | "generic-ui-tree"
  | "bambu-placeholder";

export type AppAdapterPlanStatus = "draft" | "approved" | "rejected";

export type AppAdapterRisk = "low" | "medium" | "high";

export type AppAdapterRoute =
  | "windows-broker"
  | "browser-control"
  | "structured-adapter"
  | "manual-review"
  | "future-adapter";

export interface AppAdapterPolicy {
  readonly milestone: 13;
  readonly semanticInterfacesPreferred: boolean;
  readonly genericWindowsFallbackEnabled: boolean;
  readonly actionsRequireApproval: boolean;
  readonly destructiveActionRequiresExplicitConfirmation: boolean;
  readonly noCredentialEntry: boolean;
  readonly noSilentElevation: boolean;
  readonly supportedAdapterKinds: readonly AppAdapterKind[];
  readonly blockedTerms: readonly string[];
}

export const MILESTONE13_APP_ADAPTER_POLICY: AppAdapterPolicy = {
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

export interface AppAdapterProbeResult {
  readonly adapterId: string;
  readonly status: AppAdapterStatus;
  readonly checkedAt: string;
  readonly executablePath: string | null;
  readonly confidence: number;
  readonly detail: string;
}

export interface AppAdapterSummary {
  readonly id: string;
  readonly kind: AppAdapterKind;
  readonly label: string;
  readonly priority: number;
  readonly executableHints: readonly string[];
  readonly capabilities: readonly AppAdapterCapability[];
  readonly supportedActions: readonly AppAdapterActionKind[];
  readonly safetyNotes: readonly string[];
  readonly detection: AppAdapterProbeResult;
}

export interface AppAdapterPlanStep {
  readonly id: string;
  readonly description: string;
  readonly route: AppAdapterRoute;
  readonly requiresApproval: boolean;
}

export interface AppAdapterActionPlan {
  readonly id: string;
  readonly adapterId: string;
  readonly adapterKind: AppAdapterKind;
  readonly action: AppAdapterActionKind;
  readonly target: string;
  readonly intent: string;
  readonly risk: AppAdapterRisk;
  readonly status: AppAdapterPlanStatus;
  readonly requiresApproval: boolean;
  readonly blockedReasons: readonly string[];
  readonly steps: readonly AppAdapterPlanStep[];
  readonly verification: readonly string[];
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface AppAdapterContextEntry {
  readonly key: string;
  readonly value: string;
}

export interface ProbeAppAdaptersRequest {
  readonly adapterIds?: readonly string[];
}

export interface CreateAppAdapterPlanRequest {
  readonly adapterId: string;
  readonly action: AppAdapterActionKind;
  readonly target: string;
  readonly intent: string;
  readonly context: readonly AppAdapterContextEntry[];
}

export interface ReviewAppAdapterPlanRequest {
  readonly planId: string;
  readonly decision: "approve" | "reject";
  readonly reviewNote?: string;
}

export interface AppAdapterState {
  readonly policy: AppAdapterPolicy;
  readonly adapters: readonly AppAdapterSummary[];
  readonly actionPlans: readonly AppAdapterActionPlan[];
  readonly lastProbedAt: string | null;
}
