import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/app-adapter-manager.js")).href;

test("Milestone 13 app adapter contracts define safe adapter policy", () => {
  const source = fs.readFileSync("packages/contracts/src/app-adapters.ts", "utf8");
  assert.match(source, /MILESTONE13_APP_ADAPTER_POLICY/);
  assert.match(source, /semanticInterfacesPreferred:\s*true/);
  assert.match(source, /genericWindowsFallbackEnabled:\s*true/);
  assert.match(source, /actionsRequireApproval:\s*true/);
  assert.match(source, /noCredentialEntry:\s*true/);
  assert.match(source, /"file-explorer"/);
  assert.match(source, /"microsoft-office"/);
  assert.match(source, /"vscode-codex"/);
  assert.match(source, /"browser"/);
  assert.match(source, /"powershell"/);
  assert.match(source, /"generic-windows"/);
  assert.match(source, /"bambu-studio"/);
});

test("AppAdapterManager detects adapters and creates approval-gated plans", async () => {
  const { AppAdapterManager } = await import(managerModulePath);
  const manager = new AppAdapterManager(path.resolve("."));

  let state = manager.getState();
  assert.equal(state.policy.milestone, 13);
  assert.equal(state.adapters.length, 7);

  state = manager.probeAdapters({});
  assert.ok(state.lastProbedAt);
  assert.equal(state.adapters.find((adapter) => adapter.id === "generic-windows")?.detection.status, "fallback");
  assert.equal(state.adapters.find((adapter) => adapter.id === "bambu-studio")?.detection.status, "future");

  const plan = manager.createPlan({
    adapterId: "generic-windows",
    action: "generic-ui-tree",
    target: "Hermes Local AI Studio",
    intent: "Inspect the visible Studio window with UI Automation.",
    context: [{ key: "source", value: "node test" }]
  });
  assert.equal(plan.requiresApproval, true);
  assert.equal(plan.risk, "medium");
  assert.equal(plan.blockedReasons.length, 0);
  assert.equal(plan.steps.some((step) => step.route === "windows-broker"), true);

  state = manager.reviewPlan({ planId: plan.id, decision: "approve", reviewNote: "test approval" });
  assert.equal(state.actionPlans.find((candidate) => candidate.id === plan.id)?.status, "approved");
});

test("AppAdapterManager blocks credentials and prevents approval of blocked plans", async () => {
  const { AppAdapterManager } = await import(managerModulePath);
  const manager = new AppAdapterManager(path.resolve("."));

  assert.throws(
    () => manager.createPlan({
      adapterId: "browser",
      action: "browser-inspect",
      target: "saved passwords",
      intent: "Inspect password settings.",
      context: []
    }),
    /credential-like/
  );

  const destructive = manager.createPlan({
    adapterId: "powershell",
    action: "run-command",
    target: "D:\\LocalAI",
    intent: "Delete generated files recursively.",
    context: []
  });
  assert.equal(destructive.risk, "high");
  assert.equal(destructive.blockedReasons.length > 0, true);
  assert.throws(
    () => manager.reviewPlan({ planId: destructive.id, decision: "approve" }),
    /blocked reasons/
  );

  const future = manager.createPlan({
    adapterId: "bambu-studio",
    action: "bambu-placeholder",
    target: "Bambu Studio",
    intent: "Prepare a future printer workflow.",
    context: []
  });
  assert.equal(future.blockedReasons.some((reason) => reason.includes("future")), true);
});

test("Studio exposes typed App Adapter IPC without renderer shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(preloadSource, /getAppAdapterState/);
  assert.match(preloadSource, /createAppAdapterPlan/);
  assert.match(preloadSource, /reviewAppAdapterPlan/);
  assert.match(mainSource, /AppAdapterManager/);
  assert.match(mainSource, /parseCreateAppAdapterPlanRequest/);
  assert.match(mainSource, /isAppAdapterActionKind/);
  assert.match(rendererSource, /app-adapter-workspace/);
  assert.match(rendererSource, /Probe Adapters/);
  assert.match(rendererSource, /Create Plan/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
});

test("Milestone 13 runner and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone13.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-app-adapters.ps1"), true);
  assert.equal(fs.existsSync("apps/studio-desktop/src/main/app-adapter-manager.ts"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json",
    "services/browser-control/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:1[3-9]|[2-9][0-9]+)$/, `${packagePath} should be milestone 13 or later`);
  }
});
