import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines typed starter actions", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandStarterAction/);
  assert.match(rendererSource, /readonly id: "backup" \| "knowledge" \| "automation" \| "app"/);
  assert.match(rendererSource, /readonly command: string/);
  assert.match(rendererSource, /const COMMAND_STARTER_ACTIONS: readonly CommandStarterAction\[\]/);
});

test("Command starter actions cover safe common command routes", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /id: "backup"/);
  assert.match(rendererSource, /command: "Create a backup and prepare a restore plan"/);
  assert.match(rendererSource, /id: "knowledge"/);
  assert.match(rendererSource, /command: "Search local knowledge for project status"/);
  assert.match(rendererSource, /id: "automation"/);
  assert.match(rendererSource, /command: "Schedule a dry-run automation for STATUS\.md"/);
  assert.match(rendererSource, /id: "app"/);
  assert.match(rendererSource, /command: "Open an app adapter plan for the target desktop app"/);
});

test("Command starter actions fill the composer before safety preview", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const inputIndex = rendererSource.indexOf('className="text-field command-input"');
  const starterIndex = rendererSource.indexOf('aria-label="Command starter actions"');
  const safetyIndex = rendererSource.indexOf('aria-label="Command safety preview"');
  assert.match(rendererSource, /function applyCommandStarter\(starter: CommandStarterAction\): void/);
  assert.match(rendererSource, /setCommandText\(starter\.command\)/);
  assert.match(rendererSource, /Loaded \$\{starter\.label\} starter/);
  assert.match(rendererSource, /COMMAND_STARTER_ACTIONS\.map\(\(starter\) =>/);
  assert.match(rendererSource, /onClick=\{\(\) => applyCommandStarter\(starter\)\}/);
  assert.ok(inputIndex >= 0 && starterIndex > inputIndex);
  assert.ok(safetyIndex > starterIndex);
  assert.match(styleSource, /\.command-starter-actions/);
  assert.match(styleSource, /\.command-starter-actions button/);
});

test("Command starter actions do not create plans and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function applyCommandStarter");
  const functionEnd = rendererSource.indexOf("async function createCommandPlan", functionStart);
  assert.ok(functionStart >= 0);
  assert.ok(functionEnd > functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /setActiveWorkspace\(/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-starter-actions.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux28.ps1"), true);
  assert.equal(pkg.scripts["test:command-starter-actions"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-starter-actions.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux28"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux28.ps1");
});
