import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines a typed draft summary", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandDraftSummaryTone = "empty" \| "blocked" \| "ready"/);
  assert.match(rendererSource, /type CommandDraftSummary/);
  assert.match(rendererSource, /readonly objective: string/);
  assert.match(rendererSource, /readonly target: string/);
  assert.match(rendererSource, /readonly approval: string/);
  assert.match(rendererSource, /readonly execution: string/);
  assert.match(rendererSource, /readonly handoff: string/);
  assert.match(
    rendererSource,
    /function buildCommandDraftSummary\(\s*command: string,\s*routePreview: CommandComposerRoutePreview,\s*blockedTerms: readonly string\[\],\s*requiresApproval: boolean,\s*silentExecutionAllowed: boolean\s*\): CommandDraftSummary/
  );
});

test("Command draft summary previews objective, approval, execution, and handoff", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /const trimmedCommand = command\.trim\(\)/);
  assert.match(rendererSource, /const targetWorkspace = workspaceLabel\(routePreview\.workspace\)/);
  assert.match(rendererSource, /const hasBlockers = blockedTerms\.length > 0/);
  assert.match(rendererSource, /const approval = hasBlockers/);
  assert.match(rendererSource, /"Approval blocked"/);
  assert.match(rendererSource, /"Approval required"/);
  assert.match(rendererSource, /"Approval policy unavailable"/);
  assert.match(rendererSource, /const execution = silentExecutionAllowed \? "Silent execution allowed by policy" : "No automatic execution"/);
  assert.match(rendererSource, /title: "Draft waiting"/);
  assert.match(rendererSource, /objective: "Enter a command to preview plan"/);
  assert.match(rendererSource, /title: `\$\{routePreview\.intentLabel\} draft`/);
  assert.match(rendererSource, /objective: limitCommandDraft\(trimmedCommand, 96\)/);
  assert.match(rendererSource, /handoff: hasBlockers \|\| !requiresApproval \? "No handoff until revised" : `Open \$\{targetWorkspace\} after approval`/);
});

test("Command draft summary renders before detailed route preview", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const meterIndex = rendererSource.indexOf('aria-label="Command readiness meter"');
  const summaryIndex = rendererSource.indexOf('aria-label="Command draft summary"');
  const routeIndex = rendererSource.indexOf('aria-label="Command route preview"');
  assert.match(rendererSource, /const commandDraftSummary = buildCommandDraftSummary\(/);
  assert.match(rendererSource, /aria-label="Command draft summary"/);
  assert.match(rendererSource, /commandDraftSummary\.objective/);
  assert.match(rendererSource, /commandDraftSummary\.approval/);
  assert.match(rendererSource, /commandDraftSummary\.execution/);
  assert.match(rendererSource, /commandDraftSummary\.handoff/);
  assert.ok(meterIndex >= 0 && summaryIndex > meterIndex);
  assert.ok(routeIndex > summaryIndex);
  assert.match(styleSource, /\.command-draft-summary/);
  assert.match(styleSource, /\.command-draft-summary\.ready/);
  assert.match(styleSource, /\.command-draft-summary\.blocked/);
  assert.match(styleSource, /\.command-draft-summary-grid/);
});

test("Command draft summary remains display-only and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandDraftSummary");
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
  assert.equal(fs.existsSync("scripts/test-command-draft-summary.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux23.ps1"), true);
  assert.equal(pkg.scripts["test:command-draft-summary"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-draft-summary.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux23"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux23.ps1");
});
