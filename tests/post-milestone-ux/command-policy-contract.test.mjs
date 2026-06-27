import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines a typed policy contract", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandPolicyContractTone = "ready" \| "warning" \| "blocked"/);
  assert.match(rendererSource, /type CommandPolicyContractItem/);
  assert.match(rendererSource, /readonly id: "planning" \| "external-ai" \| "approval" \| "execution"/);
  assert.match(rendererSource, /readonly detail: string/);
  assert.match(
    rendererSource,
    /function buildCommandPolicyContract\(policy: CommandCenterState\["policy"\] \| null\): readonly CommandPolicyContractItem\[\]/
  );
});

test("Command policy contract explains planning, AI calls, approval, and execution", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /id: "planning"/);
  assert.match(rendererSource, /label: "Planning"/);
  assert.match(rendererSource, /policy\?\.localPlanningOnly \? "Local deterministic planning" : "External planning may be used"/);
  assert.match(rendererSource, /id: "external-ai"/);
  assert.match(rendererSource, /label: "AI calls"/);
  assert.match(rendererSource, /policy\?\.externalAiPlanningAllowed \? "External AI planning allowed" : "No external AI planning"/);
  assert.match(rendererSource, /id: "approval"/);
  assert.match(rendererSource, /policy\?\.requiresApproval \? "User approval required" : "Approval policy unavailable"/);
  assert.match(rendererSource, /id: "execution"/);
  assert.match(rendererSource, /policy\?\.silentExecutionAllowed \? "Silent execution allowed" : "No automatic execution"/);
});

test("Command policy contract renders before composer brief", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const safetyIndex = rendererSource.indexOf('aria-label="Command safety preview"');
  const contractIndex = rendererSource.indexOf('aria-label="Command policy contract"');
  const briefIndex = rendererSource.indexOf('aria-label="Command composer brief"');
  assert.match(rendererSource, /const commandPolicyContract = buildCommandPolicyContract\(commandPolicy\)/);
  assert.match(rendererSource, /aria-label="Command policy contract"/);
  assert.match(rendererSource, /commandPolicyContract\.map\(\(item\) =>/);
  assert.ok(safetyIndex >= 0 && contractIndex > safetyIndex);
  assert.ok(briefIndex > contractIndex);
  assert.match(styleSource, /\.command-policy-contract/);
  assert.match(styleSource, /\.command-policy-contract li\.ready/);
  assert.match(styleSource, /\.command-policy-contract li\.warning/);
  assert.match(styleSource, /\.command-policy-contract li\.blocked/);
});

test("Command policy contract remains local and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandPolicyContract");
  const functionEnd = rendererSource.indexOf("function pluralize", functionStart);
  assert.ok(functionStart >= 0);
  assert.ok(functionEnd > functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /setActiveWorkspace\(/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-policy-contract.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux26.ps1"), true);
  assert.equal(pkg.scripts["test:command-policy-contract"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-policy-contract.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux26"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux26.ps1");
});
