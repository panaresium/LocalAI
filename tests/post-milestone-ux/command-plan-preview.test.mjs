import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines typed plan preview steps", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandPlanPreviewStepState = "ready" \| "pending" \| "blocked"/);
  assert.match(rendererSource, /type CommandPlanPreviewStep/);
  assert.match(rendererSource, /readonly id: "confirm" \| "approval" \| "handoff"/);
  assert.match(rendererSource, /readonly state: CommandPlanPreviewStepState/);
  assert.match(
    rendererSource,
    /function buildCommandPlanPreview\(\s*command: string,\s*routePreview: CommandComposerRoutePreview,\s*blockedTerms: readonly string\[\],\s*requiresApproval: boolean\s*\): readonly CommandPlanPreviewStep\[\]/
  );
});

test("Command plan preview explains confirm, approval, and handoff path", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /const hasCommand = command\.trim\(\)\.length > 0/);
  assert.match(rendererSource, /const targetWorkspace = workspaceLabel\(routePreview\.workspace\)/);
  assert.match(rendererSource, /const hasBlockers = blockedTerms\.length > 0/);
  assert.match(rendererSource, /label: "Confirm"/);
  assert.match(rendererSource, /label: "Approval"/);
  assert.match(rendererSource, /label: "Handoff"/);
  assert.match(rendererSource, /detail: hasCommand \? `\$\{routePreview\.intentLabel\} intent` : "Enter a command first"/);
  assert.match(rendererSource, /"User approves before handoff"/);
  assert.match(rendererSource, /"No handoff until revised"/);
  assert.match(rendererSource, /`Open \$\{targetWorkspace\} after approval`/);
});

test("Command plan preview renders between intent checks and blocked warning", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /const commandPlanPreview = buildCommandPlanPreview\(/);
  assert.match(rendererSource, /aria-label="Command plan preview"/);
  assert.match(rendererSource, /commandPlanPreview\.map\(\(step\) =>/);
  assert.ok(rendererSource.indexOf('aria-label="Command intent checklist"') < rendererSource.indexOf('aria-label="Command plan preview"'));
  assert.ok(rendererSource.indexOf('aria-label="Command plan preview"') < rendererSource.indexOf("Blocked terms:"));
  assert.match(styleSource, /\.command-plan-preview/);
  assert.match(styleSource, /\.command-plan-preview li\.ready/);
  assert.match(styleSource, /\.command-plan-preview li\.pending/);
  assert.match(styleSource, /\.command-plan-preview li\.blocked/);
});

test("Command plan preview remains local and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandPlanPreview");
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
  assert.equal(fs.existsSync("scripts/test-command-plan-preview.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux21.ps1"), true);
  assert.equal(pkg.scripts["test:command-plan-preview"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-plan-preview.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux21"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux21.ps1");
});
