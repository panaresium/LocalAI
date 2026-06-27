import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/automation-manager.js")).href;

test("Milestone 15 automation contracts define safe unattended policy", () => {
  const source = fs.readFileSync("packages/contracts/src/automations.ts", "utf8");
  assert.match(source, /MILESTONE15_AUTOMATION_POLICY/);
  assert.match(source, /desktopUnlockedRequired:\s*true/);
  assert.match(source, /unattendedOsInputAllowed:\s*false/);
  assert.match(source, /hiddenBackgroundWatchersAllowed:\s*false/);
  assert.match(source, /broadFilesystemTriggersAllowed:\s*false/);
  assert.match(source, /requiresApproval:\s*true/);
  assert.match(source, /dryRunOnly:\s*true/);
  assert.match(source, /AutomationFailurePolicy/);
  assert.match(source, /AutomationRun/);
});

test("AutomationManager creates approved schedule dry-runs with audit history", async () => {
  const { AutomationManager } = await import(managerModulePath);
  const manager = new AutomationManager(path.resolve("."));

  let state = manager.getState();
  assert.equal(state.policy.milestone, 15);
  assert.equal(state.policy.desktopUnlockedRequired, true);
  assert.equal(state.policy.unattendedOsInputAllowed, false);
  assert.equal(state.policy.dryRunOnly, true);

  state = manager.createAutomation({
    name: "Daily status dry-run",
    purpose: "Prepare a notification summary when the desktop is unlocked.",
    trigger: {
      kind: "schedule",
      startAt: new Date(Date.now() + 60_000).toISOString(),
      timezone: "Asia/Bangkok",
      repeat: "daily"
    },
    action: {
      kind: "notify",
      target: "Studio notification center",
      instructions: "Create a dry-run notification only."
    },
    failurePolicy: {
      retryCount: 1,
      disableAfterFailures: 2,
      timeoutSeconds: 60,
      notifyOnFailure: true
    }
  });
  const automation = state.automations[0];
  assert.equal(automation.status, "draft");
  assert.equal(automation.trigger.kind, "schedule");

  state = manager.reviewAutomation({
    automationId: automation.id,
    decision: "approve",
    reviewNote: "Approved validation schedule."
  });
  assert.equal(state.automations[0]?.status, "approved");

  state = manager.simulateAutomation({
    automationId: automation.id,
    triggerKind: "schedule",
    desktopUnlocked: true
  });
  assert.equal(state.runs[0]?.status, "dry-run-completed");
  assert.equal(state.runs[0]?.dryRunOnly, true);
  assert.equal(state.audit.some((event) => event.kind === "run.completed"), true);
});

test("AutomationManager blocks broad file triggers, sensitive content, and locked desktop runs", async () => {
  const { AutomationManager } = await import(managerModulePath);
  const manager = new AutomationManager(path.resolve("."));

  assert.throws(
    () => manager.createAutomation({
      name: "Drive root watcher",
      purpose: "Watch the whole drive.",
      trigger: {
        kind: "file-change",
        path: path.parse(process.cwd()).root,
        event: "changed",
        recursive: false
      },
      action: {
        kind: "notify",
        target: "Studio notification center",
        instructions: "Create a notification."
      },
      failurePolicy: {
        retryCount: 0,
        disableAfterFailures: 1,
        timeoutSeconds: 30,
        notifyOnFailure: true
      }
    }),
    /Broad|specific/
  );

  assert.throws(
    () => manager.createAutomation({
      name: "Credential prompt",
      purpose: "Enter password into a prompt.",
      trigger: { kind: "manual" },
      action: {
        kind: "teach-replay-dry-run",
        target: "Login prompt",
        instructions: "Use password credential."
      },
      failurePolicy: {
        retryCount: 0,
        disableAfterFailures: 1,
        timeoutSeconds: 30,
        notifyOnFailure: true
      }
    }),
    /Sensitive/
  );

  let state = manager.createAutomation({
    name: "Exact file watcher",
    purpose: "Observe a specific file change.",
    trigger: {
      kind: "file-change",
      path: path.resolve("STATUS.md"),
      event: "changed",
      recursive: false
    },
    action: {
      kind: "knowledge-refresh-dry-run",
      target: "Local project knowledge index",
      instructions: "Plan a local refresh only."
    },
    failurePolicy: {
      retryCount: 1,
      disableAfterFailures: 2,
      timeoutSeconds: 60,
      notifyOnFailure: true
    }
  });
  const automation = state.automations[0];
  state = manager.reviewAutomation({
    automationId: automation.id,
    decision: "approve"
  });
  state = manager.simulateAutomation({
    automationId: automation.id,
    triggerKind: "file-change",
    desktopUnlocked: false
  });
  assert.equal(state.runs[0]?.status, "blocked");
  assert.match(state.runs[0]?.failureReason ?? "", /Desktop/);
});

test("AutomationManager failure policy retries and disables after repeated failures", async () => {
  const { AutomationManager } = await import(managerModulePath);
  const manager = new AutomationManager(path.resolve("."));

  let state = manager.createAutomation({
    name: "Failure threshold dry-run",
    purpose: "Validate failure handling.",
    trigger: { kind: "manual" },
    action: {
      kind: "notify",
      target: "Studio notification center",
      instructions: "Create a dry-run notification."
    },
    failurePolicy: {
      retryCount: 1,
      disableAfterFailures: 2,
      timeoutSeconds: 30,
      notifyOnFailure: true
    }
  });
  const automation = state.automations[0];
  state = manager.reviewAutomation({
    automationId: automation.id,
    decision: "approve"
  });
  state = manager.simulateAutomation({
    automationId: automation.id,
    triggerKind: "manual",
    desktopUnlocked: true,
    forceFailure: true
  });
  assert.equal(state.automations[0]?.failureCount, 1);
  assert.notEqual(state.runs[0]?.nextRetryAt, null);

  state = manager.simulateAutomation({
    automationId: automation.id,
    triggerKind: "manual",
    desktopUnlocked: true,
    forceFailure: true
  });
  assert.equal(state.automations[0]?.status, "disabled");
  assert.equal(state.automations[0]?.failureCount, 2);
  assert.equal(state.audit.some((event) => event.kind === "automation.disabled"), true);
});

test("Studio exposes typed Automation IPC without hidden watchers or renderer shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  const managerSource = fs.readFileSync("apps/studio-desktop/src/main/automation-manager.ts", "utf8");
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(preloadSource, /getAutomationState/);
  assert.match(preloadSource, /createAutomation/);
  assert.match(preloadSource, /simulateAutomation/);
  assert.match(mainSource, /AutomationManager/);
  assert.match(mainSource, /parseCreateAutomationRequest/);
  assert.match(rendererSource, /automation-workspace/);
  assert.match(rendererSource, /Create Automation/);
  assert.match(rendererSource, /Force Failure/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
  assert.doesNotMatch(managerSource, /fs\.watch|watchFile|setInterval|Process\.Start/);
});

test("Milestone 15 runner and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone15.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-automations.ps1"), true);
  assert.equal(fs.existsSync("apps/studio-desktop/src/main/automation-manager.ts"), true);
  assert.equal(fs.existsSync("packages/contracts/src/automations.ts"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json",
    "services/browser-control/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:1[5-9]|[2-9][0-9]+)$/, `${packagePath} should be milestone 15 or later`);
  }
});
