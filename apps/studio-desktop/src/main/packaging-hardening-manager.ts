import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import type {
  CreateInstallerManifestRequest,
  CreateRestorePlanRequest,
  PackagingAcceptanceSuite,
  PackagingCheckStatus,
  PackagingDependencyReadiness,
  PackagingHardeningPolicy,
  PackagingHardeningState,
  PackagingInstallerManifest,
  PackagingManifestFile,
  PackagingPerformanceReview,
  PackagingReadinessCheck,
  PackagingRestoreOperation,
  PackagingRestorePlan,
  PackagingSecurityReview,
  PackagingUpdateStrategy
} from "@hermes-local-ai/contracts";

const MILESTONE16_PACKAGING_HARDENING_POLICY: PackagingHardeningPolicy = {
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

const UPDATE_STRATEGY: PackagingUpdateStrategy = {
  channel: "local-manual",
  automaticUpdatesAllowed: false,
  userApprovalRequired: true,
  dependencyLockMustMatch: true,
  rollbackPlanRequired: true,
  updateSteps: [
    "Run the full milestone acceptance suite before publishing a package manifest.",
    "Generate a package manifest with SHA-256 checksums.",
    "Ask the user to approve the exact local portable install target.",
    "Install into a versioned local app data folder without deleting prior versions.",
    "Keep the prior version available for manual rollback."
  ]
};

export class PackagingHardeningManager {
  private dependencyReadiness: PackagingDependencyReadiness = {
    status: "fail",
    packageManager: "unknown",
    lockfilePath: "",
    checks: []
  };
  private securityReview: PackagingSecurityReview = {
    status: "fail",
    checks: []
  };
  private performanceReview: PackagingPerformanceReview = {
    status: "fail",
    checks: []
  };
  private latestInstallerManifest: PackagingInstallerManifest | null = null;
  private readonly restorePlans: PackagingRestorePlan[] = [];
  private nextRestorePlanId = 1;

  public constructor(private readonly root: string) {
    this.root = resolve(root);
  }

  public async getState(): Promise<PackagingHardeningState> {
    await this.refreshReadiness();
    return this.buildState();
  }

  public async inspectReadiness(): Promise<PackagingHardeningState> {
    await this.refreshReadiness();
    return this.buildState();
  }

  public async createInstallerManifest(request: CreateInstallerManifestRequest): Promise<PackagingHardeningState> {
    if (request.target !== "local-portable") {
      throw new Error("Unsupported installer target.");
    }
    await this.refreshReadiness();
    if (this.dependencyReadiness.status !== "pass") {
      throw new Error("Dependency readiness must pass before generating an installer manifest.");
    }
    if (this.securityReview.status !== "pass") {
      throw new Error("Security review must pass before generating an installer manifest.");
    }
    if (this.performanceReview.status !== "pass") {
      throw new Error("Performance review must pass before generating an installer manifest.");
    }

    const packageJson = await readJson(join(this.root, "package.json"));
    const version = getString(packageJson, "version");
    const appName = getString(packageJson, "name");
    const artifactsRoot = join(this.root, "artifacts", "milestone16");
    await mkdir(artifactsRoot, { recursive: true });

    const files = await collectPackageFiles(this.root);
    const createdAt = new Date().toISOString();
    const manifestPath = join(artifactsRoot, "installer-manifest.json");
    const sha256SumsPath = join(artifactsRoot, "SHA256SUMS.milestone16.txt");
    const manifest: PackagingInstallerManifest = {
      schemaVersion: 1,
      target: "local-portable",
      appName,
      version,
      createdAt,
      sourceRoot: this.root,
      installerScriptPath: join(this.root, "scripts", "install-studio-local.ps1"),
      manifestPath,
      sha256SumsPath,
      entryPoint: join(this.root, "apps", "studio-desktop", "dist", "main", "main.js"),
      requiresUserConfirmation: true,
      silentInstallAllowed: false,
      writesProgramFiles: false,
      files
    };

    await writeText(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeText(
      sha256SumsPath,
      files.map((file) => `${file.sha256}  ${file.relativePath}`).join("\n") + "\n"
    );
    this.latestInstallerManifest = manifest;
    return this.buildState();
  }

  public async createRestorePlan(request: CreateRestorePlanRequest): Promise<PackagingHardeningState> {
    const exportPath = resolve(request.exportPath);
    if (!isWithin(this.root, exportPath)) {
      throw new Error("Restore planning is limited to Studio workspace exports in Milestone 16.");
    }
    const manifestPath = join(exportPath, "manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error("Backup export manifest was not found.");
    }
    const manifest = await readJson(manifestPath);
    const profileCount = getNumber(manifest, "profileCount");
    const projectCount = getNumber(manifest, "projectCount");
    const hermesConfigIncluded = getBoolean(manifest, "hermesConfigIncluded");
    const createdAt = new Date().toISOString();
    const operations: PackagingRestoreOperation[] = [
      {
        id: "restore-profiles",
        source: join(exportPath, "profiles"),
        destination: join(this.root, "profiles"),
        mode: "copy",
        requiresUserApproval: true
      },
      {
        id: "restore-project-registry",
        source: join(exportPath, "projects", "project-registry.json"),
        destination: join(this.root, "projects", "project-registry.json"),
        mode: "copy",
        requiresUserApproval: true
      }
    ];
    if (hermesConfigIncluded) {
      operations.push({
        id: "restore-hermes-config",
        source: join(exportPath, "hermes", "config.yaml"),
        destination: join(process.env.LOCALAPPDATA ?? "", "hermes", "config.yaml"),
        mode: "copy",
        requiresUserApproval: true
      });
    }

    const plan: PackagingRestorePlan = {
      id: `restore-plan-${this.nextRestorePlanId}`,
      status: "draft",
      exportPath,
      manifestPath,
      createdAt,
      profileCount,
      projectCount,
      hermesConfigIncluded,
      applyBlockedAtMilestone: true,
      requiresUserApproval: true,
      blockedReasons: [
        "Milestone 16 creates restore plans only; applying a restore requires a future explicit restore executor and user confirmation."
      ],
      operations
    };
    this.nextRestorePlanId += 1;
    this.restorePlans.unshift(plan);
    this.restorePlans.splice(8);
    return this.buildState();
  }

  private async refreshReadiness(): Promise<void> {
    this.dependencyReadiness = await inspectDependencies(this.root);
    this.securityReview = await inspectSecurity(this.root);
    this.performanceReview = await inspectPerformance(this.root);
  }

  private buildState(): PackagingHardeningState {
    return {
      policy: MILESTONE16_PACKAGING_HARDENING_POLICY,
      dependencyReadiness: this.dependencyReadiness,
      updateStrategy: UPDATE_STRATEGY,
      latestInstallerManifest: this.latestInstallerManifest,
      restorePlans: [...this.restorePlans],
      securityReview: this.securityReview,
      performanceReview: this.performanceReview,
      acceptanceSuite: {
        runnerPath: join(this.root, "scripts", "run-milestone16.ps1"),
        requiredChecks: [
          "milestone15-regression",
          "desktop-build",
          "packaging-hardening",
          "milestone16-node-tests"
        ],
        lastRunSummaryPath: join(this.root, "artifacts", "milestone16", "run-summary.json")
      }
    };
  }
}

async function inspectDependencies(root: string): Promise<PackagingDependencyReadiness> {
  const checks: PackagingReadinessCheck[] = [];
  const packageJson = await readJson(join(root, "package.json"));
  const packageManager = getString(packageJson, "packageManager");
  checks.push(check("package-manager", "Pinned package manager", packageManager === "pnpm@11.7.0", packageManager));

  const lockfilePath = join(root, "pnpm-lock.yaml");
  const lockfileExists = existsSync(lockfilePath);
  checks.push(check("pnpm-lock", "pnpm lockfile", lockfileExists, lockfilePath));
  if (lockfileExists) {
    const lockfile = await readFile(lockfilePath, "utf8");
    checks.push(check("pnpm-lock-version", "pnpm lockfile version", lockfile.includes("lockfileVersion: '9.0'"), "lockfileVersion 9.0"));
  }

  const workspaceText = await readFile(join(root, "pnpm-workspace.yaml"), "utf8");
  checks.push(check("approved-builds", "Approved build scripts", workspaceText.includes("onlyBuiltDependencies:") && workspaceText.includes("esbuild") && workspaceText.includes("electron"), "esbuild and electron are explicitly approved"));

  const packagePaths = await findPackageJsons(root);
  const unpinned = [];
  for (const packagePath of packagePaths) {
    const parsed = await readJson(packagePath);
    for (const section of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
      const dependencies = parsed[section];
      if (!isRecord(dependencies)) {
        continue;
      }
      for (const [name, version] of Object.entries(dependencies)) {
        if (typeof version === "string" && !isPinnedVersion(version)) {
          unpinned.push(`${relativePath(root, packagePath)}:${section}:${name}@${version}`);
        }
      }
    }
  }
  checks.push(check("external-dependencies-pinned", "External dependency versions", unpinned.length === 0, unpinned.length === 0 ? "all external dependency versions are exact" : unpinned.join("; ")));

  const globalJson = await readJson(join(root, "global.json"));
  checks.push(check("dotnet-sdk", ".NET SDK pinned", getString(globalJson.sdk, "version") === "8.0.413", "8.0.413"));

  const directoryBuild = await readFile(join(root, "Directory.Build.props"), "utf8");
  checks.push(check("dotnet-hardening", ".NET nullable and warnings", directoryBuild.includes("<Nullable>enable</Nullable>") && directoryBuild.includes("<TreatWarningsAsErrors>true</TreatWarningsAsErrors>"), "nullable enabled and warnings treated as errors"));

  const nugetConfig = await readFile(join(root, "NuGet.Config"), "utf8");
  checks.push(check("nuget-sources", "NuGet sources locked", nugetConfig.includes("<clear />"), "package sources cleared unless explicitly restored by script"));

  return {
    status: statusFor(checks),
    packageManager,
    lockfilePath,
    checks
  };
}

async function inspectSecurity(root: string): Promise<PackagingSecurityReview> {
  const mainSource = await readFile(join(root, "apps", "studio-desktop", "src", "main", "main.ts"), "utf8");
  const preloadSource = await readFile(join(root, "apps", "studio-desktop", "src", "preload", "preload.cts"), "utf8");
  const automationSource = await readFile(join(root, "apps", "studio-desktop", "src", "main", "automation-manager.ts"), "utf8");
  const elevatedHelperSource = await readFile(join(root, "services", "elevated-helper", "Program.cs"), "utf8");
  const checks: PackagingReadinessCheck[] = [
    check("renderer-isolation", "Renderer isolation", mainSource.includes("nodeIntegration: false") && mainSource.includes("contextIsolation: true") && mainSource.includes("sandbox: true"), "Electron renderer remains isolated"),
    check("preload-no-shell", "Preload shell isolation", !/shell\.|require\(|process\./u.test(preloadSource), "preload exposes named IPC only"),
    check("no-hidden-watchers", "No hidden automation watchers", !/fs\.watch|watchFile|setInterval/u.test(automationSource), "Milestone 15 automations remain explicit simulations"),
    check("no-silent-elevation", "No silent elevation", !/Process\.Start|Verb\s*=\s*"runas"|requestedExecutionLevel/iu.test(elevatedHelperSource), "elevated helper does not launch elevation itself"),
    check("no-insecure-webprefs", "No insecure Electron prefs", !/nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/u.test(mainSource), "no insecure Electron webPreferences detected")
  ];
  return {
    status: statusFor(checks),
    checks
  };
}

async function inspectPerformance(root: string): Promise<PackagingPerformanceReview> {
  const checks: PackagingReadinessCheck[] = [];
  const rendererAssets = join(root, "apps", "studio-desktop", "dist", "renderer", "assets");
  const mainPath = join(root, "apps", "studio-desktop", "dist", "main", "main.js");
  const preloadPath = join(root, "apps", "studio-desktop", "dist", "preload", "preload.cjs");
  const indexPath = join(root, "apps", "studio-desktop", "dist", "renderer", "index.html");
  checks.push(check("desktop-dist", "Desktop dist exists", existsSync(mainPath) && existsSync(preloadPath) && existsSync(indexPath), "main, preload, and renderer entrypoints"));

  let jsBytes = 0;
  let cssBytes = 0;
  if (existsSync(rendererAssets)) {
    const assets = await readdir(rendererAssets, { withFileTypes: true });
    for (const asset of assets) {
      if (!asset.isFile()) {
        continue;
      }
      const fileStat = await stat(join(rendererAssets, asset.name));
      if (asset.name.endsWith(".js")) {
        jsBytes += fileStat.size;
      } else if (asset.name.endsWith(".css")) {
        cssBytes += fileStat.size;
      }
    }
  }
  checks.push(check("renderer-js-size", "Renderer JS budget", jsBytes > 0 && jsBytes < 750_000, `${jsBytes} bytes`));
  checks.push(check("renderer-css-size", "Renderer CSS budget", cssBytes > 0 && cssBytes < 120_000, `${cssBytes} bytes`));
  if (existsSync(mainPath)) {
    const mainStat = await stat(mainPath);
    checks.push(check("main-bundle-size", "Main process budget", mainStat.size < 1_500_000, `${mainStat.size} bytes`));
  } else {
    checks.push(check("main-bundle-size", "Main process budget", false, "main.js missing"));
  }

  return {
    status: statusFor(checks),
    checks
  };
}

async function collectPackageFiles(root: string): Promise<readonly PackagingManifestFile[]> {
  const distRoot = join(root, "apps", "studio-desktop", "dist");
  if (!existsSync(join(distRoot, "main", "main.js")) || !existsSync(join(distRoot, "preload", "preload.cjs")) || !existsSync(join(distRoot, "renderer", "index.html"))) {
    throw new Error("Desktop build output is required before packaging.");
  }

  const filePaths = [
    ...(await listFiles(distRoot)),
    join(root, "package.json"),
    join(root, "pnpm-lock.yaml"),
    join(root, "pnpm-workspace.yaml"),
    join(root, "global.json"),
    join(root, "Directory.Build.props"),
    join(root, "scripts", "start-studio-desktop.ps1"),
    join(root, "scripts", "install-studio-local.ps1")
  ];

  const uniquePaths = [...new Set(filePaths.map((filePath) => resolve(filePath)))].sort((a, b) => a.localeCompare(b));
  return Promise.all(uniquePaths.map(async (filePath) => {
    if (!existsSync(filePath)) {
      throw new Error(`Package file is missing: ${filePath}`);
    }
    const data = await readFile(filePath);
    const fileStat = await stat(filePath);
    return {
      relativePath: relativePath(root, filePath),
      sizeBytes: fileStat.size,
      sha256: createHash("sha256").update(data).digest("hex")
    };
  }));
}

async function findPackageJsons(root: string): Promise<readonly string[]> {
  const results: string[] = [];
  for (const topLevel of ["package.json", "apps", "services", "packages"]) {
    const candidate = join(root, topLevel);
    if (!existsSync(candidate)) {
      continue;
    }
    if (candidate.endsWith("package.json")) {
      results.push(candidate);
    } else {
      const entries = await readdir(candidate, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const packagePath = join(candidate, entry.name, "package.json");
          if (existsSync(packagePath)) {
            results.push(packagePath);
          }
        }
      }
    }
  }
  return [...new Set(results.map((filePath) => resolve(filePath)))].sort((a, b) => a.localeCompare(b));
}

async function listFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listFiles(entryPath));
    } else if (entry.isFile()) {
      results.push(entryPath);
    }
  }
  return results;
}

function check(id: string, label: string, passed: boolean, detail: string): PackagingReadinessCheck {
  return {
    id,
    label,
    status: passed ? "pass" : "fail",
    detail
  };
}

function statusFor(checks: readonly PackagingReadinessCheck[]): PackagingCheckStatus {
  return checks.every((item) => item.status === "pass") ? "pass" : "fail";
}

function isPinnedVersion(version: string): boolean {
  if (version.startsWith("workspace:") || version.startsWith("link:") || version.startsWith("file:")) {
    return true;
  }
  return /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version);
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`Invalid JSON object: ${filePath}`);
  }
  return parsed;
}

function getString(value: unknown, key: string): string {
  if (!isRecord(value) || typeof value[key] !== "string") {
    throw new Error(`Expected string field: ${key}.`);
  }
  return value[key];
}

function getNumber(value: unknown, key: string): number {
  if (!isRecord(value) || typeof value[key] !== "number") {
    throw new Error(`Expected number field: ${key}.`);
  }
  return value[key];
}

function getBoolean(value: unknown, key: string): boolean {
  if (!isRecord(value) || typeof value[key] !== "boolean") {
    throw new Error(`Expected boolean field: ${key}.`);
  }
  return value[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWithin(parent: string, child: string): boolean {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !resolve(relativePath).startsWith("\\\\"));
}

function relativePath(root: string, filePath: string): string {
  return relative(root, filePath).replace(/\\/gu, "/");
}

async function writeText(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}
