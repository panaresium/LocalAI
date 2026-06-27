import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/command-center-manager.js")).href;

test("Command Center contracts define local approval-gated planning", () => {
  const source = fs.readFileSync("packages/contracts/src/command-center.ts", "utf8");
  assert.match(source, /COMMAND_CENTER_POLICY/);
  assert.match(source, /localPlanningOnly:\s*true/);
  assert.match(source, /externalAiPlanningAllowed:\s*false/);
  assert.match(source, /requiresApproval:\s*true/);
  assert.match(source, /silentExecutionAllowed:\s*false/);
  assert.match(source, /noCredentialEntry:\s*true/);
  assert.match(source, /noDestructiveCommands:\s*true/);
  assert.match(source, /CommandPlanStep/);
});

test("CommandCenterManager classifies direct commands into approval plans", async () => {
  const { CommandCenterManager } = await import(managerModulePath);
  const manager = new CommandCenterManager();

  let state = manager.createPlan({ command: "Create a backup and prepare a restore plan" });
  let plan = state.plans[0];
  assert.equal(plan.intent, "backup");
  assert.equal(plan.route, "profile-config");
  assert.equal(plan.status, "draft");
  assert.equal(plan.requiresApproval, true);
  assert.equal(plan.steps.some((step) => step.requiresApproval), true);

  state = manager.reviewPlan({
    planId: plan.id,
    decision: "approve",
    reviewNote: "Approved in test."
  });
  plan = state.plans.find((candidate) => candidate.id === plan.id);
  assert.equal(plan.status, "approved");

  state = manager.createPlan({ command: "Package the app and generate checksums" });
  assert.equal(state.plans[0]?.intent, "package");
  assert.equal(state.plans[0]?.route, "packaging-hardening");

  state = manager.createPlan({ command: "Schedule a daily automation" });
  assert.equal(state.plans[0]?.intent, "automation");

  state = manager.createPlan({ command: "Search knowledge for release notes" });
  assert.equal(state.plans[0]?.intent, "knowledge");
});

test("CommandCenterManager blocks sensitive or destructive command approval", async () => {
  const { CommandCenterManager } = await import(managerModulePath);
  const manager = new CommandCenterManager();

  let state = manager.createPlan({ command: "Enter password into administrator prompt" });
  const sensitive = state.plans[0];
  assert.equal(sensitive.risk, "high");
  assert.ok(sensitive.blockedReasons.length > 0);
  assert.throws(
    () => manager.reviewPlan({ planId: sensitive.id, decision: "approve" }),
    /blocked/
  );

  state = manager.reviewPlan({ planId: sensitive.id, decision: "reject" });
  assert.equal(state.plans[0]?.status, "rejected");

  state = manager.createPlan({ command: "Delete all project files" });
  const destructive = state.plans[0];
  assert.equal(destructive.risk, "high");
  assert.ok(destructive.blockedReasons.some((reason) => reason.includes("Destructive")));
});

test("Studio exposes Command Center IPC and renderer UI without shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(preloadSource, /getCommandCenterState/);
  assert.match(preloadSource, /createCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.match(mainSource, /CommandCenterManager/);
  assert.match(mainSource, /parseCreateCommandPlanRequest/);
  assert.match(mainSource, /parseReviewCommandPlanRequest/);
  assert.match(rendererSource, /command-workspace/);
  assert.match(rendererSource, /Command Center/);
  assert.match(rendererSource, /Make Plan/);
  assert.match(styleSource, /command-workspace/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
});

test("Command Center validation scripts are present", () => {
  assert.equal(fs.existsSync("scripts/test-command-center.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux1.ps1"), true);
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["test:command-center"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-center.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux1"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux1.ps1");
});
