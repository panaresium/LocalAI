Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone16"
$OutputPath = Join-Path $Artifacts "packaging-hardening.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$installPlanOutput = powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\install-studio-local.ps1") -PlanOnly 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    [ordered]@{
        checkedAt = (Get-Date).ToString("o")
        errors = @("Installer plan-only mode failed.")
        output = $installPlanOutput.Trim()
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    Write-Output $installPlanOutput.Trim()
    exit $LASTEXITCODE
}

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputPath = path.resolve("artifacts/milestone16/packaging-hardening.json");
const packagingModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/packaging-hardening-manager.js")).href;
const profileModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/profile-config-manager.js")).href;
const { PackagingHardeningManager } = await import(packagingModulePath);
const { ProfileConfigManager } = await import(profileModulePath);
const manager = new PackagingHardeningManager(path.resolve("."));
const installPlan = JSON.parse(process.env.HERMES_INSTALL_PLAN);
const errors = [];
function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

let state = await manager.inspectReadiness();
check(state.policy.milestone === 16, "Packaging policy milestone is not 16.");
check(state.policy.silentInstallAllowed === false, "Silent install must be blocked.");
check(state.policy.automaticUpdatesAllowed === false, "Automatic updates must be disabled.");
check(state.policy.updateRequiresUserApproval === true, "Updates must require user approval.");
check(state.policy.restoreRequiresPlan === true, "Restore must require a plan.");
check(state.policy.destructiveRestoreApplyAllowed === false, "Destructive restore apply must be blocked.");
check(state.policy.fullAcceptanceSuiteRequired === true, "Full acceptance suite requirement missing.");
check(state.dependencyReadiness.status === "pass", "Dependency readiness did not pass.");
check(state.securityReview.status === "pass", "Security review did not pass.");
check(state.performanceReview.status === "pass", "Performance review did not pass.");
check(state.acceptanceSuite.requiredChecks.includes("milestone15-regression"), "Milestone 15 regression check missing.");

check(installPlan.planOnly === true, "Installer plan-only flag missing.");
check(installPlan.requiresUserConfirmation === true, "Installer must require explicit confirmation.");
check(installPlan.silentInstallAllowed === false, "Installer must not allow silent install.");
check(installPlan.destructiveDeleteAllowed === false, "Installer must not allow destructive delete.");
check(installPlan.version === "0.0.0-milestone16", "Installer plan version mismatch.");

state = await manager.createInstallerManifest({ target: "local-portable" });
const manifest = state.latestInstallerManifest;
check(Boolean(manifest), "Installer manifest was not generated.");
check(manifest?.target === "local-portable", "Installer target mismatch.");
check(manifest?.requiresUserConfirmation === true, "Manifest must require user confirmation.");
check(manifest?.silentInstallAllowed === false, "Manifest must block silent install.");
check(manifest?.writesProgramFiles === false, "Manifest must not write Program Files.");
check((manifest?.files ?? []).some((file) => file.relativePath === "apps/studio-desktop/dist/main/main.js"), "Main process file missing from package manifest.");
check((manifest?.files ?? []).some((file) => file.relativePath === "apps/studio-desktop/dist/preload/preload.cjs"), "Preload file missing from package manifest.");
check((manifest?.files ?? []).some((file) => file.relativePath === "apps/studio-desktop/dist/renderer/index.html"), "Renderer index missing from package manifest.");
check((manifest?.files ?? []).some((file) => file.relativePath === "pnpm-lock.yaml"), "pnpm lockfile missing from package manifest.");
check((manifest?.files ?? []).some((file) => file.relativePath === "scripts/install-studio-local.ps1"), "Installer script missing from package manifest.");
check(fs.existsSync("artifacts/milestone16/installer-manifest.json"), "Installer manifest artifact missing.");
check(fs.existsSync("artifacts/milestone16/SHA256SUMS.milestone16.txt"), "SHA256 sums artifact missing.");

const profileManager = new ProfileConfigManager(path.resolve("."), {
  hermesHome: path.resolve("artifacts/milestone16/hermes-home")
});
await profileManager.saveHermesConfig({ text: "models:\n  default: local\n" });
const backup = await profileManager.exportBackup();
check(fs.existsSync(backup.manifestPath), "Backup export manifest missing.");
state = await manager.createRestorePlan({ exportPath: backup.exportPath });
const restorePlan = state.restorePlans[0];
check(restorePlan?.status === "draft", "Restore plan should be draft.");
check(restorePlan?.applyBlockedAtMilestone === true, "Restore apply must be blocked at Milestone 16.");
check(restorePlan?.requiresUserApproval === true, "Restore plan must require user approval.");
check((restorePlan?.operations ?? []).some((operation) => operation.id === "restore-profiles"), "Restore profiles operation missing.");
check((restorePlan?.operations ?? []).some((operation) => operation.id === "restore-project-registry"), "Restore project registry operation missing.");
check((restorePlan?.operations ?? []).some((operation) => operation.id === "restore-hermes-config"), "Restore Hermes config operation missing.");

const result = {
  checkedAt: new Date().toISOString(),
  dependencyReadiness: state.dependencyReadiness,
  securityReview: state.securityReview,
  performanceReview: state.performanceReview,
  installerManifest: state.latestInstallerManifest,
  installPlan,
  backup,
  restorePlan,
  errors
};

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) {
  process.exitCode = 1;
}
'@

$env:HERMES_INSTALL_PLAN = $installPlanOutput.Trim()
$output = $nodeScript | node --input-type=module 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    if (-not (Test-Path -LiteralPath $OutputPath)) {
        [ordered]@{
            checkedAt = (Get-Date).ToString("o")
            errors = @("Packaging hardening validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
