import type { ModelRoleAlias } from "./model-roles.js";

export type ModelProviderKind = "ollama" | "external-api";
export type ModelPrivacyBoundary = "local" | "external";
export type ModelHealthState = "healthy" | "degraded" | "unhealthy" | "unknown";
export type ModelLifecycleClass = "pinned" | "warm" | "on-demand" | "batch" | "exclusive";
export type ModelPrivacyPreset = "offline-secure" | "local-preferred" | "balanced-hybrid" | "best-quality" | "lowest-cost" | "manual";
export type ModelLifecycleAction = "load" | "unload";
export type ModelMarketplaceDownloadState = "available" | "installed" | "loaded";
export type ModelBenchmarkStatus = "passed" | "failed";
export type ModelTaskProfileId =
  | "computer-control"
  | "knowledge-research"
  | "code-change"
  | "creative-media"
  | "conversation";
export type ModelMemoryRecommendationStatus = "ok" | "constrained" | "critical";

export interface ModelProviderHealth {
  readonly state: ModelHealthState;
  readonly detail: string;
  readonly latencyMs: number | null;
}

export interface ModelProviderStatus {
  readonly id: string;
  readonly label: string;
  readonly kind: ModelProviderKind;
  readonly endpoint: string | null;
  readonly enabled: boolean;
  readonly privacyBoundary: ModelPrivacyBoundary;
  readonly requiresApiKey: boolean;
  readonly health: ModelProviderHealth;
}

export interface ModelRegistryEntry {
  readonly id: string;
  readonly providerId: string;
  readonly model: string;
  readonly label: string;
  readonly roles: readonly ModelRoleAlias[];
  readonly lifecycle: ModelLifecycleClass;
  readonly contextLength: number;
  readonly capabilities: readonly string[];
  readonly enabled: boolean;
  readonly local: boolean;
  readonly installed: boolean;
  readonly loaded: boolean;
  readonly notes: string;
}

export interface ModelMarketplaceEntry {
  readonly id: string;
  readonly modelId: string;
  readonly providerId: string;
  readonly model: string;
  readonly label: string;
  readonly description: string;
  readonly roles: readonly ModelRoleAlias[];
  readonly lifecycle: ModelLifecycleClass;
  readonly contextLength: number;
  readonly capabilities: readonly string[];
  readonly recommendedTaskProfileIds: readonly ModelTaskProfileId[];
  readonly sourceUrl: string;
  readonly installCommand: string;
  readonly preloadRecommended: boolean;
  readonly installed: boolean;
  readonly loaded: boolean;
  readonly downloadState: ModelMarketplaceDownloadState;
  readonly notes: string;
}

export interface ModelRouteRejection {
  readonly modelId: string;
  readonly reason: string;
}

export interface ModelRoleRoute {
  readonly role: ModelRoleAlias;
  readonly privacyPreset: ModelPrivacyPreset;
  readonly selectedModelId: string | null;
  readonly providerId: string | null;
  readonly reason: string;
  readonly overrideModelId: string | null;
  readonly rejected: readonly ModelRouteRejection[];
}

export interface ModelResourceSnapshot {
  readonly checkedAt: string;
  readonly totalMemoryBytes: number;
  readonly freeMemoryBytes: number;
  readonly ollamaInstalledModels: readonly string[];
  readonly ollamaLoadedModels: readonly string[];
}

export interface ModelBenchmarkResult {
  readonly id: string;
  readonly modelId: string;
  readonly role: ModelRoleAlias;
  readonly status: ModelBenchmarkStatus;
  readonly latencyMs: number;
  readonly outputChars: number;
  readonly detail: string;
  readonly checkedAt: string;
}

export interface ModelTaskProfile {
  readonly id: ModelTaskProfileId;
  readonly label: string;
  readonly description: string;
  readonly orchestratorRole: ModelRoleAlias;
  readonly specialistRoles: readonly ModelRoleAlias[];
  readonly loadPolicy: string;
  readonly unloadPolicy: string;
  readonly confidenceFloor: number;
}

export interface ModelTaskRouteAssignment {
  readonly taskProfileId: ModelTaskProfileId;
  readonly role: ModelRoleAlias;
  readonly selectedModelId: string | null;
  readonly selectedModelLabel: string | null;
  readonly overrideModelId: string | null;
  readonly providerId: string | null;
  readonly routeReason: string;
}

export interface ModelTaskRoutePreset {
  readonly taskProfileId: ModelTaskProfileId;
  readonly taskProfileLabel: string;
  readonly assignments: readonly ModelTaskRouteAssignment[];
}

export interface ModelMemoryRecommendation {
  readonly status: ModelMemoryRecommendationStatus;
  readonly loadedModelCount: number;
  readonly freeMemoryBytes: number;
  readonly recommendation: string;
}

export interface ModelFabricState {
  readonly providers: readonly ModelProviderStatus[];
  readonly models: readonly ModelRegistryEntry[];
  readonly marketplace: readonly ModelMarketplaceEntry[];
  readonly routes: readonly ModelRoleRoute[];
  readonly resources: ModelResourceSnapshot;
  readonly benchmarks: readonly ModelBenchmarkResult[];
  readonly taskProfiles: readonly ModelTaskProfile[];
  readonly taskRoutePresets: readonly ModelTaskRoutePreset[];
  readonly memoryRecommendation: ModelMemoryRecommendation;
}

export interface RouteModelRoleRequest {
  readonly role: ModelRoleAlias;
  readonly privacyPreset: ModelPrivacyPreset;
  readonly overrideModelId: string | null;
}

export interface ModelLifecycleRequest {
  readonly modelId: string;
  readonly action: ModelLifecycleAction;
  readonly keepAliveSeconds?: number;
}

export interface ModelDownloadRequest {
  readonly marketplaceEntryId: string;
}

export interface ConfigureModelTaskRouteRequest {
  readonly taskProfileId: ModelTaskProfileId;
  readonly role: ModelRoleAlias;
  readonly modelId: string | null;
  readonly privacyPreset: ModelPrivacyPreset;
}

export interface RunModelBenchmarkRequest {
  readonly modelId: string;
  readonly role: ModelRoleAlias;
  readonly prompt?: string;
}

export interface ModelPlanValidationError {
  readonly path: string;
  readonly message: string;
}

export interface ModelPlanValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ModelPlanValidationError[];
  readonly acceptedStageIds: readonly string[];
  readonly blockedStageIds: readonly string[];
}

export interface ValidateModelPlanRequest {
  readonly plan: unknown;
  readonly privacyPreset: ModelPrivacyPreset;
}
