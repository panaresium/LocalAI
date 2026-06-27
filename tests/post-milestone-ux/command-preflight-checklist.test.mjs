import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines a typed preflight checklist", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandPreflightTone = "ready" \| "attention" \| "blocked"/);
  assert.match(rendererSource, /type CommandPreflightItem/);
  assert.match(rendererSource, /readonly id: "objective" \| "route" \| "safety" \| "approval" \| "execution"/);
  assert.match(rendererSource, /readonly detail: string/);
  assert.match(rendererSource, /function buildCommandPreflightChecklist\(/);
  assert.match(rendererSource, /\): readonly CommandPreflightItem\[\]/);
});

test("Command preflight checklist explains objective, route, safety, approval, and execution", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /id: "objective"/);
  assert.match(rendererSource, /label: "Objective"/);
  assert.match(rendererSource, /"Add target or outcome"/);
  assert.match(rendererSource, /id: "route"/);
  assert.match(rendererSource, /label: "Route"/);
  assert.match(rendererSource, /"Manual review route"/);
  assert.match(rendererSource, /id: "safety"/);
  assert.match(rendererSource, /"No blocked terms"/);
  assert.match(rendererSource, /id: "approval"/);
  assert.match(rendererSource, /"Approval policy unavailable"/);
  assert.match(rendererSource, /id: "execution"/);
  assert.match(rendererSource, /"Draft only before handoff"/);
});

test("Command preflight checklist renders before the draft summary", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const readinessIndex = rendererSource.indexOf('aria-label="Command readiness meter"');
  const preflightIndex = rendererSource.indexOf('aria-label="Command preflight checklist"');
  const draftIndex = rendererSource.indexOf('aria-label="Command draft summary"');
  assert.match(rendererSource, /const commandPreflightChecklist = buildCommandPreflightChecklist\(/);
  assert.match(rendererSource, /aria-label="Command preflight checklist"/);
  assert.match(rendererSource, /commandPreflightChecklist\.map\(\(item\) =>/);
  assert.ok(readinessIndex >= 0 && preflightIndex > readinessIndex);
  assert.ok(draftIndex > preflightIndex);
  assert.match(styleSource, /\.command-preflight-checklist/);
  assert.match(styleSource, /\.command-preflight-checklist li\.ready/);
  assert.match(styleSource, /\.command-preflight-checklist li\.attention/);
  assert.match(styleSource, /\.command-preflight-checklist li\.blocked/);
});

test("Command preflight checklist remains local and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandPreflightChecklist");
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
  assert.equal(fs.existsSync("scripts/test-command-preflight-checklist.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux27.ps1"), true);
  assert.equal(pkg.scripts["test:command-preflight-checklist"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-preflight-checklist.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux27"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux27.ps1");
});
