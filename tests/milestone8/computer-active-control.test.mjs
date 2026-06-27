import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/computer-observe-manager.js")).href;

test("Milestone 8 contracts define active actions with explicit approval policy", () => {
  const source = fs.readFileSync("packages/contracts/src/computer-actions.ts", "utf8");
  assert.match(source, /MILESTONE8_ACTIVE_ACTIONS = \[/);
  for (const action of ["ui.invoke", "ui.set_value", "ui.select", "ui.toggle", "keyboard.type", "keyboard.chord", "mouse.click"]) {
    assert.match(source, new RegExp(`"${action.replace(".", "\\.")}"`));
  }
  assert.match(source, /requiresApproval:\s*true/);
  assert.match(source, /allowInput:\s*true/);
  assert.match(source, /allowDestructiveAction:\s*false/);
  assert.match(source, /allowElevation:\s*false/);
  assert.match(source, /credential\.enter/);
  assert.match(source, /uac\.elevate/);
  assert.match(source, /payment\.confirm/);
});

test("Windows broker active commands require an approval token", () => {
  const source = fs.readFileSync("services/windows-control-broker/Program.cs", "utf8");
  assert.match(source, /activeCommandsRequireApprovalToken = true/);
  assert.match(source, /ValidateApprovalToken/);
  assert.match(source, /HERMES_BROKER_APPROVAL_TOKEN/);
  assert.match(source, /--approval-token/);
  assert.match(source, /"emergency\.stop"/);
  assert.doesNotMatch(source, /clipboard\.write|credential\.enter|payment\.confirm|uac\.elevate/i);
});

test("computer control manager requires review, blocks unsafe proposals, and supports emergency stop", async () => {
  const { ComputerObserveManager } = await import(managerModulePath);
  const manager = new ComputerObserveManager(path.resolve("."));
  const state = await manager.getState();
  assert.equal(state.policy.observeOnly, true);
  assert.equal(state.activePolicy.requiresApproval, true);
  assert.equal(state.activePolicy.allowDestructiveAction, false);

  const proposed = await manager.proposeAction({
    action: "ui.invoke",
    target: {
      windowHandle: null,
      name: "Refresh"
    },
    risk: "low",
    expectedResult: "The refresh control is invoked.",
    verification: {
      kind: "manual"
    }
  });
  assert.equal(proposed.status, "pending");
  assert.equal(proposed.requiresApproval, true);

  await assert.rejects(
    () => manager.executeAction({ actionId: proposed.id }),
    /Only approved computer actions can execute/
  );

  const reviewed = await manager.reviewAction({
    actionId: proposed.id,
    decision: "approve",
    reviewNote: "test approval"
  });
  assert.equal(reviewed.activeActions.find((action) => action.id === proposed.id)?.status, "approved");

  const stopped = await manager.emergencyStop();
  assert.equal(stopped.emergencyStopActive, true);
  assert.equal(stopped.activeActions.find((action) => action.id === proposed.id)?.status, "cancelled");

  await assert.rejects(
    () => manager.proposeAction({
      action: "keyboard.type",
      target: {
        windowHandle: null
      },
      risk: "low",
      text: "hello",
      expectedResult: "Text appears.",
      verification: {
        kind: "manual"
      }
    }),
    /Emergency stop is active/
  );

  const reset = await manager.resetEmergencyStop();
  assert.equal(reset.emergencyStopActive, false);

  await assert.rejects(
    () => manager.proposeAction({
      action: "keyboard.type",
      target: {
        windowHandle: null
      },
      risk: "low",
      text: "password token",
      expectedResult: "Text appears.",
      verification: {
        kind: "manual"
      }
    }),
    /Secret-like text/
  );

  await assert.rejects(
    () => manager.proposeAction({
      action: "mouse.click",
      target: {
        windowHandle: null
      },
      risk: "low",
      expectedResult: "Click happens.",
      verification: {
        kind: "manual"
      }
    }),
    /positive target bounds/
  );

  await assert.rejects(
    () => manager.proposeAction({
      action: "ui.invoke",
      target: {
        windowHandle: null
      },
      risk: "high",
      expectedResult: "Blocked.",
      verification: {
        kind: "manual"
      }
    }),
    /High-risk/
  );
});

test("preload and main process expose only typed active-control IPC", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  for (const api of [
    "proposeComputerAction",
    "reviewComputerAction",
    "executeComputerAction",
    "emergencyStopComputer",
    "resetComputerEmergencyStop"
  ]) {
    assert.match(preloadSource, new RegExp(api));
  }
  assert.match(mainSource, /parseProposeComputerActionRequest/);
  assert.match(mainSource, /parseComputerActiveTarget/);
  assert.match(mainSource, /parseReviewComputerActionRequest/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
});

test("Milestone 8 runner and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone8.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-windows-broker-active.ps1"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:[8-9]|[1-9][0-9]+)$/, `${packagePath} should be a current milestone version`);
  }
});
