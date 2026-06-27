import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const presetIds = ["backup", "package", "knowledge", "automation", "app-adapter", "computer-control", "chat"];

test("Command Center defines local typed quick-command presets", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandPreset/);
  assert.match(rendererSource, /const COMMAND_PRESETS/);
  for (const id of presetIds) {
    assert.match(rendererSource, new RegExp(`id: "${id}"`));
  }
});

test("Command presets use the existing approval-gated planner", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /async function createCommandPlan\(commandOverride\?: string\): Promise<void>/);
  assert.match(rendererSource, /const command = commandOverride \?\? commandText/);
  assert.match(rendererSource, /setCommandText\(command\)/);
  assert.match(rendererSource, /createCommandPlan\(preset\.command\)/);
  assert.doesNotMatch(rendererSource, /reviewCommandPlan\(preset/);
});

test("Command presets are rendered as compact accessible controls", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /className="command-preset-grid"/);
  assert.match(rendererSource, /aria-label="Command presets"/);
  assert.match(rendererSource, /COMMAND_PRESETS\.map/);
  assert.match(rendererSource, /workspaceLabel\(preset\.workspace\)/);
  assert.match(styleSource, /\.command-preset-grid/);
});

test("Command preset validation scripts are present", () => {
  assert.equal(fs.existsSync("scripts/test-command-presets.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux6.ps1"), true);
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["test:command-presets"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-presets.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux6"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux6.ps1");
});
