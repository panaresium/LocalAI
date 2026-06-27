import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/packaging-hardening-manager.js")).href;
const profileModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/profile-config-manager.js")).href;

test("Milestone 16 packaging contracts define hardening policy", () => {
  const source = fs.readFileSync("packages/contracts/src/packaging-hardening.ts", "utf8");
  assert.match(source, /MILESTONE16_PACKAGING_HARDENING_POLICY/);
  assert.match(source, /silentInstallAllowed:\s*false/);
  assert.match(source, /automaticUpdatesAllowed:\s*false/);
  assert.match(source, /updateRequiresUserApproval:\s*true/);
  assert.match(source, /dependencyLockRequired:\s*true/);
  assert.match(source, /restoreRequiresPlan:\s*true/);
  assert.match(source, /destructiveRestoreApplyAllowed:\s*false/);
  assert.match(source, /fullAcceptanceSuiteRequired:\s*true/);
});

test("PackagingHardeningManager passes readiness checks and creates package manifest", async () => {
  const { PackagingHardeningManager } = await import(managerModulePath);
  const manager = new PackagingHardeningManager(path.resolve("."));

  let state = await manager.inspectReadiness();
  assert.equal(state.policy.milestone, 16);
  assert.equal(state.dependencyReadiness.status, "pass");
  assert.equal(state.securityReview.status, "pass");
  assert.equal(state.performanceReview.status, "pass");
  assert.equal(state.updateStrategy.automaticUpdatesAllowed, false);
  assert.equal(state.updateStrategy.userApprovalRequired, true);

  state = await manager.createInstallerManifest({ target: "local-portable" });
  const manifest = state.latestInstallerManifest;
  assert.equal(manifest.target, "local-portable");
  assert.equal(manifest.requiresUserConfirmation, true);
  assert.equal(manifest.silentInstallAllowed, false);
  assert.equal(manifest.writesProgramFiles, false);
  assert.equal(fs.existsSync("artifacts/milestone16/installer-manifest.json"), true);
  assert.equal(fs.existsSync("artifacts/milestone16/SHA256SUMS.milestone16.txt"), true);
  assert.equal(manifest.files.some((file) => file.relativePath === "apps/studio-desktop/dist/main/main.js"), true);
  assert.equal(manifest.files.some((file) => file.relativePath === "apps/studio-desktop/dist/preload/preload.cjs"), true);
  assert.equal(manifest.files.some((file) => file.relativePath === "apps/studio-desktop/dist/renderer/index.html"), true);
  assert.equal(manifest.files.some((file) => file.relativePath === "scripts/install-studio-local.ps1"), true);
});

test("PackagingHardeningManager creates restore plans without applying them", async () => {
  const { PackagingHardeningManager } = await import(managerModulePath);
  const { ProfileConfigManager } = await import(profileModulePath);
  const profileManager = new ProfileConfigManager(path.resolve("."), {
    hermesHome: path.resolve("artifacts/milestone16/test-hermes-home")
  });
  await profileManager.saveHermesConfig({ text: "models:\n  default: local\n" });
  const backup = await profileManager.exportBackup();
  const manager = new PackagingHardeningManager(path.resolve("."));

  const state = await manager.createRestorePlan({ exportPath: backup.exportPath });
  const plan = state.restorePlans[0];
  assert.equal(plan.status, "draft");
  assert.equal(plan.applyBlockedAtMilestone, true);
  assert.equal(plan.requiresUserApproval, true);
  assert.equal(plan.hermesConfigIncluded, true);
  assert.equal(plan.operations.some((operation) => operation.id === "restore-profiles"), true);
  assert.equal(plan.operations.some((operation) => operation.id === "restore-project-registry"), true);
  assert.equal(plan.operations.some((operation) => operation.id === "restore-hermes-config"), true);
});

test("Local installer script supports plan-only mode and blocks silent installation", () => {
  const output = execFileSync("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "scripts\\install-studio-local.ps1",
    "-PlanOnly"
  ], { encoding: "utf8" });
  const plan = JSON.parse(output);
  assert.equal(plan.version, "0.0.0-milestone16");
  assert.equal(plan.planOnly, true);
  assert.equal(plan.requiresUserConfirmation, true);
  assert.equal(plan.silentInstallAllowed, false);
  assert.equal(plan.destructiveDeleteAllowed, false);
  assert.ok(plan.files.length > 0);
});

test("Studio exposes typed Packaging Hardening IPC without renderer shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const managerSource = fs.readFileSync("apps/studio-desktop/src/main/packaging-hardening-manager.ts", "utf8");
  assert.match(preloadSource, /getPackagingHardeningState/);
  assert.match(preloadSource, /createInstallerManifest/);
  assert.match(preloadSource, /createRestorePlan/);
  assert.match(mainSource, /PackagingHardeningManager/);
  assert.match(mainSource, /parseCreateInstallerManifestRequest/);
  assert.match(rendererSource, /packaging-workspace/);
  assert.match(rendererSource, /Create Manifest/);
  assert.match(rendererSource, /Restore Plan/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
  assert.doesNotMatch(managerSource, /execFile|spawn|rmSync|rmdir|Remove-Item/);
});

test("Milestone 16 runner, docs, and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone16.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-packaging-hardening.ps1"), true);
  assert.equal(fs.existsSync("scripts/install-studio-local.ps1"), true);
  assert.equal(fs.existsSync("docs/milestone-16/packaging-hardening-plan.md"), true);
  assert.equal(fs.existsSync("apps/studio-desktop/src/main/packaging-hardening-manager.ts"), true);
  assert.equal(fs.existsSync("packages/contracts/src/packaging-hardening.ts"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json",
    "services/browser-control/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:1[6-9]|[2-9][0-9]+)$/, `${packagePath} should be milestone 16 or later`);
  }
});
