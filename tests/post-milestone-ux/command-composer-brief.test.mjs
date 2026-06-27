import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines typed brief states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandComposerBriefTone = "empty" \| "ready" \| "blocked" \| "limit"/);
  assert.match(rendererSource, /type CommandComposerBrief/);
  assert.match(rendererSource, /readonly nextAction: string/);
  assert.match(rendererSource, /readonly canPlan: boolean/);
  assert.match(rendererSource, /function buildCommandComposerBrief\(\s*command: string,\s*blockedTerms: readonly string\[\],\s*maxChars: number\s*\): CommandComposerBrief/);
});

test("Command composer brief covers empty, limit, blocked, and ready states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /tone: "empty"/);
  assert.match(rendererSource, /nextAction: "Enter a command"/);
  assert.match(rendererSource, /tone: "limit"/);
  assert.match(rendererSource, /nextAction: "Shorten command"/);
  assert.match(rendererSource, /tone: "blocked"/);
  assert.match(rendererSource, /nextAction: "Plan can be created but not approved"/);
  assert.match(rendererSource, /tone: "ready"/);
  assert.match(rendererSource, /nextAction: "Make Plan"/);
});

test("Command composer brief renders between safety preview and presets", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /commandComposerBrief = buildCommandComposerBrief\(commandText, blockedCommandTerms, commandLengthLimit\)/);
  assert.match(rendererSource, /aria-label="Command composer brief"/);
  assert.match(rendererSource, /className=\{`command-composer-brief \$\{commandComposerBrief\.tone\}`\}/);
  assert.ok(rendererSource.indexOf('aria-label="Command safety preview"') < rendererSource.indexOf('aria-label="Command composer brief"'));
  assert.ok(rendererSource.indexOf('aria-label="Command composer brief"') < rendererSource.indexOf('aria-label="Command presets"'));
  assert.match(styleSource, /\.command-composer-brief/);
  assert.match(styleSource, /\.command-composer-brief\.ready/);
  assert.match(styleSource, /\.command-composer-brief\.blocked/);
  assert.match(styleSource, /\.command-composer-brief\.limit/);
  assert.match(styleSource, /\.command-composer-brief\.empty/);
});

test("Command composer brief gates only plan creation readiness", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandComposerBrief");
  const functionEnd = rendererSource.indexOf("function pluralize", functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.match(rendererSource, /disabled=\{!commandComposerBrief\.canPlan\}/);
  assert.match(rendererSource, /createCommandPlan\(\)/);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.match(preloadSource, /createCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-composer-brief.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux16.ps1"), true);
  assert.equal(pkg.scripts["test:command-composer-brief"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-composer-brief.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux16"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux16.ps1");
});
