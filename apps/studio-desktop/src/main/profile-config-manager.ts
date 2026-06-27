import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

import type {
  ProfileConfigState,
  ProfileFileName,
  SaveHermesConfigRequest,
  SaveStudioProfileRequest,
  SaveStudioProjectRequest,
  StudioBackupExportResult,
  StudioConfigDocument,
  StudioProfileDetail,
  StudioProfileSummary,
  StudioProjectSummary
} from "@hermes-local-ai/contracts";

interface ProjectRegistryFile {
  readonly schemaVersion: 1;
  readonly activeProfileId: string;
  readonly activeProjectId: string;
  readonly projects: readonly StudioProjectSummary[];
  readonly updatedAt: string;
}

export interface ProfileConfigManagerOptions {
  readonly hermesHome?: string;
}

const PROFILE_FILE_NAMES: readonly ProfileFileName[] = ["SOUL.md", "USER.md", "MEMORY.md"];
const MAX_PROFILE_FILE_CHARS = 64000;
const MAX_CONFIG_BYTES = 512 * 1024;
const DEFAULT_PROFILE_ID = "default";
const DEFAULT_PROJECT_ID = "localai";

export class ProfileConfigManager {
  private readonly root: string;
  private readonly profilesRoot: string;
  private readonly projectsRoot: string;
  private readonly registryPath: string;
  private readonly artifactsRoot: string;
  private readonly hermesHome: string;
  private readonly hermesConfigPath: string;
  private readonly migrationPlanPath: string;

  public constructor(root: string, options: ProfileConfigManagerOptions = {}) {
    this.root = resolve(root);
    this.profilesRoot = join(this.root, "profiles");
    this.projectsRoot = join(this.root, "projects");
    this.registryPath = join(this.projectsRoot, "project-registry.json");
    this.artifactsRoot = join(this.root, "artifacts", "milestone3");
    this.hermesHome = options.hermesHome ?? join(process.env.LOCALAPPDATA ?? "", "hermes");
    this.hermesConfigPath = join(this.hermesHome, "config.yaml");
    this.migrationPlanPath = join(this.root, "docs", "milestone-3", "profile-project-config-migration-plan.md");
  }

  public async getState(): Promise<ProfileConfigState> {
    const profiles = await this.listProfiles();
    const registry = await this.readProjectRegistry(profiles);
    const hermesConfig = await this.readHermesConfig();
    return {
      profiles,
      projects: registry.projects,
      activeProfileId: registry.activeProfileId,
      activeProjectId: registry.activeProjectId,
      hermesConfig,
      migrationPlanPath: this.migrationPlanPath
    };
  }

  public async getProfile(profileId: string): Promise<StudioProfileDetail> {
    const id = normalizeId(profileId, "profile");
    const isolation = this.profileIsolation(id);
    const files = await this.readProfileFiles(id);
    return {
      id,
      label: labelFromId(id),
      updatedAt: await latestProfileUpdate(isolation.rootPath),
      isolation,
      files
    };
  }

  public async saveProfile(request: SaveStudioProfileRequest): Promise<StudioProfileDetail> {
    const id = normalizeId(request.id, "profile");
    const label = normalizeLabel(request.label, id);
    const isolation = this.profileIsolation(id);
    await mkdir(isolation.rootPath, { recursive: true });
    await mkdir(isolation.knowledgePath, { recursive: true });
    await mkdir(isolation.sessionsPath, { recursive: true });
    await mkdir(isolation.toolsPath, { recursive: true });

    for (const fileName of PROFILE_FILE_NAMES) {
      const content = request.files[fileName] ?? "";
      if (content.length > MAX_PROFILE_FILE_CHARS) {
        throw new Error(`${fileName} is too large.`);
      }

      await writeTextAtomic(join(isolation.rootPath, fileName), content);
    }

    await writeTextAtomic(
      join(isolation.rootPath, "profile.json"),
      `${JSON.stringify({ schemaVersion: 1, id, label, updatedAt: new Date().toISOString() }, null, 2)}\n`
    );

    return {
      id,
      label,
      updatedAt: await latestProfileUpdate(isolation.rootPath),
      isolation,
      files: await this.readProfileFiles(id)
    };
  }

  public async saveProject(request: SaveStudioProjectRequest): Promise<StudioProjectSummary> {
    const id = normalizeId(request.id, "project");
    const label = normalizeLabel(request.label, id);
    const profileId = normalizeId(request.profileId, "profile");
    const rootPath = resolve(request.rootPath || this.root);
    if (!isWithin(this.root, rootPath)) {
      throw new Error("Project root must be inside the Studio workspace for Milestone 3.");
    }

    const profiles = await this.listProfiles();
    if (!profiles.some((profile) => profile.id === profileId)) {
      throw new Error(`Unknown profile id: ${profileId}`);
    }

    const registry = await this.readProjectRegistry(profiles);
    const now = new Date().toISOString();
    const existing = registry.projects.find((project) => project.id === id);
    const project: StudioProjectSummary = {
      id,
      label,
      rootPath,
      profileId,
      knowledgePath: join(this.projectsRoot, id, "knowledge"),
      sessionsPath: join(this.projectsRoot, id, "sessions"),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await mkdir(project.knowledgePath, { recursive: true });
    await mkdir(project.sessionsPath, { recursive: true });
    const projects = [
      ...registry.projects.filter((item) => item.id !== id),
      project
    ].sort((a, b) => a.label.localeCompare(b.label));
    await this.writeProjectRegistry({
      schemaVersion: 1,
      activeProfileId: profileId,
      activeProjectId: id,
      projects,
      updatedAt: now
    });

    return project;
  }

  public async readHermesConfig(): Promise<StudioConfigDocument> {
    if (!existsSync(this.hermesConfigPath)) {
      return {
        targetPath: this.hermesConfigPath,
        text: "",
        updatedAt: null,
        sizeBytes: 0
      };
    }

    const fileStat = await stat(this.hermesConfigPath);
    if (fileStat.size > MAX_CONFIG_BYTES) {
      throw new Error("Hermes config is too large for the Studio editor.");
    }

    return {
      targetPath: this.hermesConfigPath,
      text: await readFile(this.hermesConfigPath, "utf8"),
      updatedAt: fileStat.mtime.toISOString(),
      sizeBytes: fileStat.size
    };
  }

  public async saveHermesConfig(request: SaveHermesConfigRequest): Promise<StudioConfigDocument> {
    if (Buffer.byteLength(request.text, "utf8") > MAX_CONFIG_BYTES) {
      throw new Error("Hermes config is too large for the Studio editor.");
    }
    if (request.text.includes("\0")) {
      throw new Error("Hermes config cannot contain null bytes.");
    }

    if (!isWithin(this.hermesHome, this.hermesConfigPath)) {
      throw new Error("Hermes config path is outside Hermes home.");
    }

    await mkdir(this.hermesHome, { recursive: true });
    await mkdir(join(this.artifactsRoot, "config-backups"), { recursive: true });
    if (existsSync(this.hermesConfigPath)) {
      await copyFile(
        this.hermesConfigPath,
        join(this.artifactsRoot, "config-backups", `config.yaml.${timestampForPath()}.bak`)
      );
    }
    await writeTextAtomic(this.hermesConfigPath, request.text);
    return this.readHermesConfig();
  }

  public async exportBackup(): Promise<StudioBackupExportResult> {
    const createdAt = new Date().toISOString();
    const exportPath = join(this.artifactsRoot, "exports", `studio-export-${timestampForPath()}`);
    const profiles = await this.listProfiles();
    const registry = await this.readProjectRegistry(profiles);
    await mkdir(exportPath, { recursive: true });

    const profilesOut = join(exportPath, "profiles");
    for (const profile of profiles) {
      const profileOut = join(profilesOut, profile.id);
      await mkdir(profileOut, { recursive: true });
      for (const fileName of PROFILE_FILE_NAMES) {
        const source = join(this.profilesRoot, profile.id, fileName);
        if (existsSync(source)) {
          await copyFile(source, join(profileOut, fileName));
        }
      }
      const metadata = join(this.profilesRoot, profile.id, "profile.json");
      if (existsSync(metadata)) {
        await copyFile(metadata, join(profileOut, "profile.json"));
      }
    }

    await mkdir(join(exportPath, "projects"), { recursive: true });
    await writeTextAtomic(
      join(exportPath, "projects", "project-registry.json"),
      `${JSON.stringify(registry, null, 2)}\n`
    );

    let hermesConfigIncluded = false;
    if (existsSync(this.hermesConfigPath)) {
      await mkdir(join(exportPath, "hermes"), { recursive: true });
      await copyFile(this.hermesConfigPath, join(exportPath, "hermes", "config.yaml"));
      hermesConfigIncluded = true;
    }

    const manifest = {
      schemaVersion: 1,
      createdAt,
      excludes: [".env", "auth.json", "auth.lock", "state.db"],
      profileCount: profiles.length,
      projectCount: registry.projects.length,
      hermesConfigIncluded
    };
    const manifestPath = join(exportPath, "manifest.json");
    await writeTextAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return {
      exportPath,
      manifestPath,
      createdAt,
      profileCount: profiles.length,
      projectCount: registry.projects.length,
      hermesConfigIncluded
    };
  }

  private async listProfiles(): Promise<readonly StudioProfileSummary[]> {
    const profiles: StudioProfileSummary[] = [
      {
        id: DEFAULT_PROFILE_ID,
        label: "Default",
        updatedAt: null,
        isolation: this.profileIsolation(DEFAULT_PROFILE_ID)
      }
    ];

    if (!existsSync(this.profilesRoot)) {
      return profiles;
    }

    const entries = await readdir(this.profilesRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !isValidId(entry.name) || entry.name === DEFAULT_PROFILE_ID) {
        continue;
      }

      const isolation = this.profileIsolation(entry.name);
      profiles.push({
        id: entry.name,
        label: await readProfileLabel(isolation.rootPath, entry.name),
        updatedAt: await latestProfileUpdate(isolation.rootPath),
        isolation
      });
    }

    return profiles.sort((a, b) => a.label.localeCompare(b.label));
  }

  private async readProfileFiles(profileId: string): Promise<Readonly<Record<ProfileFileName, string>>> {
    const isolation = this.profileIsolation(profileId);
    const entries = await Promise.all(PROFILE_FILE_NAMES.map(async (fileName) => {
      const filePath = join(isolation.rootPath, fileName);
      if (!existsSync(filePath)) {
        return [fileName, ""] as const;
      }

      return [fileName, await readFile(filePath, "utf8")] as const;
    }));

    return Object.fromEntries(entries) as Readonly<Record<ProfileFileName, string>>;
  }

  private profileIsolation(profileId: string) {
    const rootPath = join(this.profilesRoot, profileId);
    return {
      rootPath,
      memoryPath: join(rootPath, "MEMORY.md"),
      knowledgePath: join(rootPath, "knowledge"),
      sessionsPath: join(rootPath, "sessions"),
      toolsPath: join(rootPath, "tools")
    };
  }

  private async readProjectRegistry(profiles: readonly StudioProfileSummary[]): Promise<ProjectRegistryFile> {
    if (!existsSync(this.registryPath)) {
      return this.defaultProjectRegistry(profiles);
    }

    const parsed = JSON.parse(await readFile(this.registryPath, "utf8")) as unknown;
    if (!isProjectRegistryFile(parsed)) {
      throw new Error("Unsupported project registry format.");
    }

    return parsed;
  }

  private async writeProjectRegistry(registry: ProjectRegistryFile): Promise<void> {
    await mkdir(dirname(this.registryPath), { recursive: true });
    await writeTextAtomic(this.registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  }

  private defaultProjectRegistry(profiles: readonly StudioProfileSummary[]): ProjectRegistryFile {
    const activeProfileId = profiles.some((profile) => profile.id === "test-profile") ? "test-profile" : DEFAULT_PROFILE_ID;
    const now = new Date().toISOString();
    const project: StudioProjectSummary = {
      id: DEFAULT_PROJECT_ID,
      label: "LocalAI Workspace",
      rootPath: this.root,
      profileId: activeProfileId,
      knowledgePath: join(this.projectsRoot, DEFAULT_PROJECT_ID, "knowledge"),
      sessionsPath: join(this.projectsRoot, DEFAULT_PROJECT_ID, "sessions"),
      createdAt: now,
      updatedAt: now
    };
    return {
      schemaVersion: 1,
      activeProfileId,
      activeProjectId: DEFAULT_PROJECT_ID,
      projects: [project],
      updatedAt: now
    };
  }
}

function normalizeId(value: string, label: string): string {
  const id = value.trim().toLowerCase();
  if (!isValidId(id)) {
    throw new Error(`Invalid ${label} id.`);
  }

  return id;
}

function isValidId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,63}$/u.test(value);
}

function normalizeLabel(value: string, fallbackId: string): string {
  const label = value.trim() || labelFromId(fallbackId);
  if (label.length > 120) {
    throw new Error("Label is too long.");
  }

  return label;
}

function isWithin(parent: string, child: string): boolean {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !resolve(relativePath).startsWith("\\\\"));
}

async function writeTextAtomic(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, filePath);
}

async function latestProfileUpdate(profilePath: string): Promise<string | null> {
  if (!existsSync(profilePath)) {
    return null;
  }

  let latest: Date | null = null;
  for (const fileName of [...PROFILE_FILE_NAMES, "profile.json"]) {
    const filePath = join(profilePath, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const fileStat = await stat(filePath);
    if (!latest || fileStat.mtime > latest) {
      latest = fileStat.mtime;
    }
  }

  return latest?.toISOString() ?? null;
}

async function readProfileLabel(profilePath: string, id: string): Promise<string> {
  const metadataPath = join(profilePath, "profile.json");
  if (existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as { label?: unknown };
      if (typeof metadata.label === "string" && metadata.label.trim().length > 0) {
        return metadata.label.trim();
      }
    } catch {
      return labelFromId(id);
    }
  }

  return labelFromId(id);
}

function labelFromId(id: string): string {
  return id
    .split(/[-_]+/u)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function timestampForPath(): string {
  return new Date().toISOString().replace(/[:.]/gu, "-");
}

function isProjectRegistryFile(value: unknown): value is ProjectRegistryFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as { schemaVersion?: unknown; activeProfileId?: unknown; activeProjectId?: unknown; projects?: unknown };
  return (
    record.schemaVersion === 1 &&
    typeof record.activeProfileId === "string" &&
    typeof record.activeProjectId === "string" &&
    Array.isArray(record.projects)
  );
}
