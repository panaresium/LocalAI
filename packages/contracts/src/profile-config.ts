export type ProfileFileName = "SOUL.md" | "USER.md" | "MEMORY.md";

export interface ProfileIsolationPaths {
  readonly rootPath: string;
  readonly memoryPath: string;
  readonly knowledgePath: string;
  readonly sessionsPath: string;
  readonly toolsPath: string;
}

export interface StudioProfileSummary {
  readonly id: string;
  readonly label: string;
  readonly updatedAt: string | null;
  readonly isolation: ProfileIsolationPaths;
}

export interface StudioProfileDetail extends StudioProfileSummary {
  readonly files: Readonly<Record<ProfileFileName, string>>;
}

export interface SaveStudioProfileRequest {
  readonly id: string;
  readonly label: string;
  readonly files: Readonly<Record<ProfileFileName, string>>;
}

export interface StudioProjectSummary {
  readonly id: string;
  readonly label: string;
  readonly rootPath: string;
  readonly profileId: string;
  readonly knowledgePath: string;
  readonly sessionsPath: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SaveStudioProjectRequest {
  readonly id: string;
  readonly label: string;
  readonly rootPath: string;
  readonly profileId: string;
}

export interface StudioConfigDocument {
  readonly targetPath: string;
  readonly text: string;
  readonly updatedAt: string | null;
  readonly sizeBytes: number;
}

export interface SaveHermesConfigRequest {
  readonly text: string;
}

export interface StudioBackupExportResult {
  readonly exportPath: string;
  readonly manifestPath: string;
  readonly createdAt: string;
  readonly profileCount: number;
  readonly projectCount: number;
  readonly hermesConfigIncluded: boolean;
}

export interface ProfileConfigState {
  readonly profiles: readonly StudioProfileSummary[];
  readonly projects: readonly StudioProjectSummary[];
  readonly activeProfileId: string;
  readonly activeProjectId: string;
  readonly hermesConfig: StudioConfigDocument;
  readonly migrationPlanPath: string;
}
