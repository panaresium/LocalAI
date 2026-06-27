import type { ModelRoleAlias } from "./model-roles.js";

export type CommandCenterIntent =
  | "chat"
  | "backup"
  | "package"
  | "automation"
  | "app-adapter"
  | "computer-control"
  | "media-generation"
  | "knowledge"
  | "unknown";

export type CommandPlanRisk = "low" | "medium" | "high";
export type CommandPlanStatus = "draft" | "approved" | "rejected";
export type CommandPlanExecutionStatus = "completed" | "blocked" | "handoff-required";
export type CommandPlanRoute =
  | "chat"
  | "profile-config"
  | "packaging-hardening"
  | "automation"
  | "app-adapters"
  | "computer-control"
  | "media-generation"
  | "knowledge"
  | "manual-review";

export interface CommandCenterPolicy {
  readonly localPlanningOnly: true;
  readonly externalAiPlanningAllowed: false;
  readonly requiresApproval: true;
  readonly silentExecutionAllowed: false;
  readonly noCredentialEntry: true;
  readonly noDestructiveCommands: true;
  readonly maxCommandChars: number;
  readonly supportedIntents: readonly CommandCenterIntent[];
  readonly blockedTerms: readonly string[];
}

export const COMMAND_CENTER_POLICY: CommandCenterPolicy = {
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
    "media-generation",
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

export interface CommandPlanStep {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly route: CommandPlanRoute;
  readonly requiresApproval: boolean;
}

export interface CommandPlanModelOrchestration {
  readonly orchestratorRole: ModelRoleAlias;
  readonly specialistRoles: readonly ModelRoleAlias[];
  readonly loadPlan: string;
  readonly unloadPlan: string;
  readonly memoryPlan: string;
}

export interface CommandPlan {
  readonly id: string;
  readonly command: string;
  readonly intent: CommandCenterIntent;
  readonly title: string;
  readonly summary: string;
  readonly risk: CommandPlanRisk;
  readonly status: CommandPlanStatus;
  readonly route: CommandPlanRoute;
  readonly requiresApproval: true;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly blockedReasons: readonly string[];
  readonly confidence: number;
  readonly confidenceThreshold: number;
  readonly referencesRequired: boolean;
  readonly referenceQueries: readonly string[];
  readonly modelOrchestration: CommandPlanModelOrchestration;
  readonly steps: readonly CommandPlanStep[];
}

export interface CommandPlanExecution {
  readonly id: string;
  readonly planId: string;
  readonly status: CommandPlanExecutionStatus;
  readonly route: CommandPlanRoute;
  readonly summary: string;
  readonly detail: string;
  readonly artifactPath: string | null;
  readonly createdAt: string;
}

export interface CreateCommandPlanRequest {
  readonly command: string;
  readonly context?: string;
}

export interface ReviewCommandPlanRequest {
  readonly planId: string;
  readonly decision: "approve" | "reject";
  readonly reviewNote?: string;
}

export interface ExecuteCommandPlanRequest {
  readonly planId: string;
}

export interface CommandCenterState {
  readonly policy: CommandCenterPolicy;
  readonly plans: readonly CommandPlan[];
  readonly executions: readonly CommandPlanExecution[];
}
