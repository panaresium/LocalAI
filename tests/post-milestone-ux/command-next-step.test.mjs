import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines a typed next-step summary", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandNextStepTone = "idle" \| "attention" \| "blocked" \| "ready"/);
  assert.match(rendererSource, /type CommandNextStep/);
  assert.match(rendererSource, /readonly action: string/);
  assert.match(rendererSource, /readonly guard: string/);
  assert.match(rendererSource, /function buildCommandNextStep\(/);
  assert.match(rendererSource, /\): CommandNextStep/);
});

test("Command next-step summary explains idle, blocked, attention, and ready actions", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /label: "Choose a starter"/);
  assert.match(rendererSource, /action: "No plan yet"/);
  assert.match(rendererSource, /guard: "No automatic execution"/);
  assert.match(rendererSource, /label: "Revise blocked terms"/);
  assert.match(rendererSource, /action: "Review-only draft"/);
  assert.match(rendererSource, /label: "Restore approval policy"/);
  assert.match(rendererSource, /guard: "No handoff"/);
  assert.match(rendererSource, /tone: "attention"/);
  assert.match(rendererSource, /label: "Make Plan"/);
  assert.match(rendererSource, /guard: "No handoff before approval"/);
});

test("Command next-step summary renders between starters and safety preview", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const starterIndex = rendererSource.indexOf('aria-label="Command starter actions"');
  const nextStepIndex = rendererSource.indexOf('aria-label="Command next step"');
  const safetyIndex = rendererSource.indexOf('aria-label="Command safety preview"');
  assert.match(rendererSource, /const commandNextStep = buildCommandNextStep\(/);
  assert.match(rendererSource, /className=\{`command-next-step \$\{commandNextStep\.tone\}`\}/);
  assert.match(rendererSource, /aria-label="Command next step"/);
  assert.match(rendererSource, /commandNextStep\.action/);
  assert.match(rendererSource, /commandNextStep\.guard/);
  assert.ok(starterIndex >= 0 && nextStepIndex > starterIndex);
  assert.ok(safetyIndex > nextStepIndex);
  assert.match(styleSource, /\.command-next-step/);
  assert.match(styleSource, /\.command-next-step\.ready/);
  assert.match(styleSource, /\.command-next-step\.attention/);
  assert.match(styleSource, /\.command-next-step\.blocked/);
  assert.match(styleSource, /\.command-next-step\.idle/);
});

test("Command next-step summary remains display-only and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandNextStep");
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
  assert.equal(fs.existsSync("scripts/test-command-next-step.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux29.ps1"), true);
  assert.equal(pkg.scripts["test:command-next-step"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-next-step.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux29"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux29.ps1");
});
