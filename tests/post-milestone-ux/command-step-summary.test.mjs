import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines a typed step summary", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandStepSummaryTone = "ready" \| "blocked" \| "approved" \| "rejected"/);
  assert.match(rendererSource, /type CommandStepSummary/);
  assert.match(rendererSource, /readonly stepCount: number/);
  assert.match(rendererSource, /readonly approvalCount: number/);
  assert.match(rendererSource, /function buildCommandStepSummary\(plan: CommandPlan\): CommandStepSummary/);
});

test("Command step summary covers plan steps, approval count, and handoff", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /const approvalCount = plan\.steps\.filter\(\(step\) => step\.requiresApproval\)\.length/);
  assert.match(rendererSource, /const firstStep = plan\.steps\[0\]\?\.title \?\? "No steps"/);
  assert.match(rendererSource, /stepCount: plan\.steps\.length/);
  assert.match(rendererSource, /handoff: `Will open \$\{handoffWorkspace\}`/);
  assert.match(rendererSource, /handoff: `Open \$\{handoffWorkspace\}`/);
  assert.match(rendererSource, /handoff: `Target was \$\{handoffWorkspace\}`/);
  assert.match(rendererSource, /handoff: `Target: \$\{handoffWorkspace\}`/);
});

test("Command step summary renders before approval checklist", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /selectedCommandStepSummary = selectedCommandPlan \? buildCommandStepSummary\(selectedCommandPlan\) : null/);
  assert.match(rendererSource, /aria-label="Command step summary"/);
  assert.match(rendererSource, /selectedCommandStepSummary\.stepCount/);
  assert.match(rendererSource, /selectedCommandStepSummary\.approvalCount/);
  assert.ok(rendererSource.indexOf('aria-label="Command decision summary"') < rendererSource.indexOf('aria-label="Command step summary"'));
  assert.ok(rendererSource.indexOf('aria-label="Command step summary"') < rendererSource.indexOf('aria-label="Command approval checklist"'));
  assert.match(styleSource, /\.command-step-summary/);
  assert.match(styleSource, /\.command-step-summary\.blocked/);
  assert.match(styleSource, /\.command-step-summary\.approved/);
  assert.match(styleSource, /\.command-step-summary\.rejected/);
});

test("Command step summary preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandStepSummary");
  const functionEnd = rendererSource.indexOf("function summarizeCommandDecision", functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-step-summary.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux19.ps1"), true);
  assert.equal(pkg.scripts["test:command-step-summary"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-step-summary.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux19"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux19.ps1");
});
