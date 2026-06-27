export type PackagingInstallerTarget = "local-portable";
export type PackagingCheckStatus = "pass" | "fail";
export type PackagingRestorePlanStatus = "draft" | "rejected";

export interface PackagingHardeningPolicy {
  readonly milestone: 16;
  readonly installerTargets: readonly PackagingInstallerTarget[];
  readonly signedInstallerRequiredForProgramFiles: boolean;
  readonly silentInstallAllowed: false;
  readonly automaticUpdatesAllowed: false;
  readonly updateRequiresUserApproval: true;
  readonly dependencyLockRequired: true;
  readonly restoreRequiresPlan: true;
  readonly destructiveRestoreApplyAllowed: false;
  readonly backupsExcludeSecrets: true;
  readonly fullAcceptanceSuiteRequired: true;
  readonly blockedWriteLocations: readonly string[];
}

export const MILESTONE16_PACKAGING_HARDENING_POLICY: PackagingHardeningPolicy = {
  milestone: 16,
  installerTargets: ["local-portable"],
  signedInstallerRequiredForProgramFiles: true,
  silentInstallAllowed: false,
  automaticUpdatesAllowed: false,
  updateRequiresUserApproval: true,
  dependencyLockRequired: true,
  restoreRequiresPlan: true,
  destructiveRestoreApplyAllowed: false,
  backupsExcludeSecrets: true,
  fullAcceptanceSuiteRequired: true,
  blockedWriteLocations: [
    "Windows/System32",
    "Program Files",
    "Credential stores",
    "Browser password databases"
  ]
};

export interface PackagingReadinessCheck {
  readonly id: string;
  readonly label: string;
  readonly status: PackagingCheckStatus;
  readonly detail: string;
}

export interface PackagingDependencyReadiness {
  readonly status: PackagingCheckStatus;
  readonly packageManager: string;
  readonly lockfilePath: string;
  readonly checks: readonly PackagingReadinessCheck[];
}

export interface PackagingManifestFile {
  readonly relativePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface PackagingInstallerManifest {
  readonly schemaVersion: 1;
  readonly target: PackagingInstallerTarget;
  readonly appName: string;
  readonly version: string;
  readonly createdAt: string;
  readonly sourceRoot: string;
  readonly installerScriptPath: string;
  readonly manifestPath: string;
  readonly sha256SumsPath: string;
  readonly entryPoint: string;
  readonly requiresUserConfirmation: true;
  readonly silentInstallAllowed: false;
  readonly writesProgramFiles: false;
  readonly files: readonly PackagingManifestFile[];
}

export interface PackagingUpdateStrategy {
  readonly channel: "local-manual";
  readonly automaticUpdatesAllowed: false;
  readonly userApprovalRequired: true;
  readonly dependencyLockMustMatch: true;
  readonly rollbackPlanRequired: true;
  readonly updateSteps: readonly string[];
}

export interface PackagingRestoreOperation {
  readonly id: string;
  readonly source: string;
  readonly destination: string;
  readonly mode: "copy";
  readonly requiresUserApproval: true;
}

export interface PackagingRestorePlan {
  readonly id: string;
  readonly status: PackagingRestorePlanStatus;
  readonly exportPath: string;
  readonly manifestPath: string;
  readonly createdAt: string;
  readonly profileCount: number;
  readonly projectCount: number;
  readonly hermesConfigIncluded: boolean;
  readonly applyBlockedAtMilestone: true;
  readonly requiresUserApproval: true;
  readonly blockedReasons: readonly string[];
  readonly operations: readonly PackagingRestoreOperation[];
}

export interface PackagingSecurityReview {
  readonly status: PackagingCheckStatus;
  readonly checks: readonly PackagingReadinessCheck[];
}

export interface PackagingPerformanceReview {
  readonly status: PackagingCheckStatus;
  readonly checks: readonly PackagingReadinessCheck[];
}

export interface PackagingAcceptanceSuite {
  readonly runnerPath: string;
  readonly requiredChecks: readonly string[];
  readonly lastRunSummaryPath: string;
}

export interface CreateInstallerManifestRequest {
  readonly target: PackagingInstallerTarget;
}

export interface CreateRestorePlanRequest {
  readonly exportPath: string;
}

export interface PackagingHardeningState {
  readonly policy: PackagingHardeningPolicy;
  readonly dependencyReadiness: PackagingDependencyReadiness;
  readonly updateStrategy: PackagingUpdateStrategy;
  readonly latestInstallerManifest: PackagingInstallerManifest | null;
  readonly restorePlans: readonly PackagingRestorePlan[];
  readonly securityReview: PackagingSecurityReview;
  readonly performanceReview: PackagingPerformanceReview;
  readonly acceptanceSuite: PackagingAcceptanceSuite;
}
