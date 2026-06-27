import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/elevated-helper-manager.js")).href;

test("Milestone 14 elevated helper contracts define manual UAC safety policy", () => {
  const source = fs.readFileSync("packages/contracts/src/elevated-helper.ts", "utf8");
  assert.match(source, /MILESTONE14_ELEVATED_HELPER_POLICY/);
  assert.match(source, /manualUacStartupOnly:\s*true/);
  assert.match(source, /silentElevationAllowed:\s*false/);
  assert.match(source, /secureDesktopAutomationAllowed:\s*false/);
  assert.match(source, /requiresSignedHelperForTrustedSession:\s*true/);
  assert.match(source, /maxSessionMinutes:\s*15/);
  assert.match(source, /ElevatedHelperAuditEvent/);
  assert.match(source, /PrepareElevatedHelperLaunchRequest/);
});

test("ElevatedHelperManager creates manual launch instructions and rejects unsigned sessions", async () => {
  const { ElevatedHelperManager } = await import(managerModulePath);
  const manager = new ElevatedHelperManager(path.resolve("."));

  let state = manager.getState();
  assert.equal(state.policy.milestone, 14);
  assert.equal(state.policy.manualUacStartupOnly, true);
  assert.equal(state.policy.silentElevationAllowed, false);
  assert.equal(state.policy.secureDesktopAutomationAllowed, false);

  state = manager.prepareLaunch({
    purpose: "Inspect elevated app state after explicit user approval.",
    durationMinutes: 5
  });
  const session = state.sessions[0];
  assert.equal(session.status, "pending-manual-start");
  assert.equal(state.launchInstruction.requiresManualUac, true);
  assert.match(state.launchInstruction.powershellCommand, /Start-Process/);
  assert.match(state.launchInstruction.powershellCommand, /-Verb RunAs/);
  assert.doesNotMatch(state.launchInstruction.powershellCommand.toLowerCase(), /bypass/);
  assert.equal(session.durationMinutes, 5);

  state = manager.confirmSession({
    sessionId: session.id,
    approvalCode: session.approvalCode,
    helperProcessId: 1234,
    helperElevated: true
  });
  assert.equal(state.sessions[0]?.status, "rejected");
  assert.match(state.sessions[0]?.rejectionReason ?? "", /not signed/);
});

test("ElevatedHelperManager blocks sensitive purpose, revokes sessions, and expires grants", async () => {
  const { ElevatedHelperManager } = await import(managerModulePath);
  const manager = new ElevatedHelperManager(path.resolve("."));

  assert.throws(
    () => manager.prepareLaunch({
      purpose: "Enter password into administrator prompt.",
      durationMinutes: 5
    }),
    /Sensitive/
  );

  let state = manager.prepareLaunch({
    purpose: "Temporary elevated inspection window.",
    durationMinutes: 1
  });
  const session = state.sessions[0];
  state = manager.revokeSession({ sessionId: session.id, reason: "test revoke" });
  assert.equal(state.sessions[0]?.status, "revoked");
  assert.equal(state.audit.some((event) => event.kind === "session.revoked"), true);

  state = manager.prepareLaunch({
    purpose: "Expire this helper grant.",
    durationMinutes: 1
  });
  const expiring = state.sessions[0];
  state = manager.getState(new Date(Date.parse(expiring.expiresAt) + 1000));
  assert.equal(state.sessions[0]?.status, "expired");
  assert.equal(state.audit.some((event) => event.kind === "session.expired"), true);
});

test("Elevated helper service source exposes no silent elevation or secure desktop automation", () => {
  const source = fs.readFileSync("services/elevated-helper/Program.cs", "utf8");
  const project = fs.readFileSync("services/elevated-helper/HermesLocalAI.ElevatedHelper.csproj", "utf8");
  assert.match(source, /manualUacStartupOnly\s*=\s*true/);
  assert.match(source, /silentElevationAllowed\s*=\s*false/);
  assert.match(source, /secureDesktopAutomationAllowed\s*=\s*false/);
  assert.doesNotMatch(source, /Process\.Start|Verb\s*=\s*"runas"|requestedExecutionLevel/iu);
  assert.match(project, /<TargetFramework>net8\.0-windows<\/TargetFramework>/);
});

test("Studio exposes typed Elevated Helper IPC without renderer shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(preloadSource, /getElevatedHelperState/);
  assert.match(preloadSource, /prepareElevatedHelperLaunch/);
  assert.match(preloadSource, /confirmElevatedHelperSession/);
  assert.match(mainSource, /ElevatedHelperManager/);
  assert.match(mainSource, /parsePrepareElevatedHelperLaunchRequest/);
  assert.match(mainSource, /parseConfirmElevatedHelperSessionRequest/);
  assert.match(rendererSource, /elevated-helper-workspace/);
  assert.match(rendererSource, /Prepare Manual Launch/);
  assert.match(rendererSource, /Probe Helper/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
});

test("Milestone 14 runner and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone14.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-elevated-helper.ps1"), true);
  assert.equal(fs.existsSync("apps/studio-desktop/src/main/elevated-helper-manager.ts"), true);
  assert.equal(fs.existsSync("services/elevated-helper/HermesLocalAI.ElevatedHelper.csproj"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json",
    "services/browser-control/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:1[4-9]|[2-9][0-9]+)$/, `${packagePath} should be milestone 14 or later`);
  }
});
