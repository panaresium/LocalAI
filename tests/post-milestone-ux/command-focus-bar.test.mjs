import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command Center defines a typed focus bar", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandFocusBarTone = "idle" \| "ready" \| "review" \| "blocked" \| "handoff"/);
  assert.match(rendererSource, /type CommandFocusBar/);
  assert.match(rendererSource, /readonly objective: string/);
  assert.match(rendererSource, /readonly next: string/);
  assert.match(rendererSource, /readonly review: string/);
  assert.match(rendererSource, /readonly approval: string/);
  assert.match(rendererSource, /readonly handoff: string/);
  assert.match(
    rendererSource,
    /function buildCommandFocusBar\(\s*command: string,\s*nextStep: CommandNextStep,\s*reviewQueue: CommandReviewQueueSummary,\s*selectedPlan: CommandPlan \| null\s*\): CommandFocusBar/
  );
});

test("Command focus bar covers idle, ready, review, blocked, and handoff states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /tone: "blocked"/);
  assert.match(rendererSource, /nextStep\.tone === "blocked" \|\| reviewQueue\.tone === "blocked"/);
  assert.match(rendererSource, /tone: "handoff"/);
  assert.match(rendererSource, /selectedPlan\?\.status === "approved" \|\| reviewQueue\.label === "Approved handoff"/);
  assert.match(rendererSource, /tone: "review"/);
  assert.match(rendererSource, /reviewQueue\.tone === "ready"/);
  assert.match(rendererSource, /tone: "ready"/);
  assert.match(rendererSource, /nextStep\.tone === "ready"/);
  assert.match(rendererSource, /tone: "idle"/);
  assert.match(rendererSource, /objective = command\.trim\(\) \? limitCommandDraft\(command\.trim\(\), 96\) : "No command entered"/);
});

test("Command focus bar renders first in the Command workspace", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const workspaceIndex = rendererSource.indexOf('aria-label="Command Center"');
  const focusIndex = rendererSource.indexOf('aria-label="Command focus bar"');
  const commandPanelIndex = rendererSource.indexOf('className="command-panel"');
  assert.match(rendererSource, /const commandFocusBar = buildCommandFocusBar\(/);
  assert.match(rendererSource, /commandText,\s*commandNextStep,\s*commandReviewQueueSummary,\s*selectedCommandPlan/);
  assert.match(rendererSource, /className=\{`command-focus-bar \$\{commandFocusBar\.tone\}`\}/);
  assert.match(rendererSource, /commandFocusBar\.objective/);
  assert.match(rendererSource, /commandFocusBar\.next/);
  assert.match(rendererSource, /commandFocusBar\.review/);
  assert.match(rendererSource, /commandFocusBar\.approval/);
  assert.match(rendererSource, /commandFocusBar\.handoff/);
  assert.ok(workspaceIndex >= 0 && focusIndex > workspaceIndex);
  assert.ok(commandPanelIndex > focusIndex);
  assert.match(styleSource, /\.command-focus-bar/);
  assert.match(styleSource, /grid-column: 1 \/ -1/);
  assert.match(styleSource, /repeat\(auto-fit, minmax\(150px, 1fr\)\)/);
  assert.match(styleSource, /\.command-focus-bar\.review/);
  assert.match(styleSource, /\.command-focus-bar\.handoff/);
});

test("Command focus bar remains display-only and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandFocusBar");
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
  assert.equal(fs.existsSync("scripts/test-command-focus-bar.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux33.ps1"), true);
  assert.equal(pkg.scripts["test:command-focus-bar"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-focus-bar.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux33"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux33.ps1");
});
