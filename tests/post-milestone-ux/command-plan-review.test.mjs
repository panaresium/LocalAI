import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command Center has a selected plan review surface", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /selectedCommandPlanId/);
  assert.match(rendererSource, /setSelectedCommandPlanId\(plan\?\.id \?\? null\)/);
  assert.match(rendererSource, /const selectedCommandPlan = filteredCommandPlans\.find/);
  assert.match(rendererSource, /\?\? filteredCommandPlans\[0\]/);
  assert.match(rendererSource, /className="admin-panel command-review-panel"/);
  assert.match(rendererSource, /aria-label="Command plan review"/);
});

test("Command plan review exposes approval context before decisions", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /selectedCommandPlan\.steps\.map/);
  assert.match(rendererSource, /step\.requiresApproval \? "approval required" : "ready"/);
  assert.match(rendererSource, /command-blocked-reasons/);
  assert.match(rendererSource, /aria-pressed=\{selectedCommandPlan\?\.id === plan\.id\}/);
  assert.match(rendererSource, /selected-command-plan/);
});

test("Command plan review keeps approved-only handoff controls", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /disabled=\{selectedCommandPlan\.status !== "draft" \|\| selectedCommandPlan\.blockedReasons\.length > 0\}/);
  assert.match(rendererSource, /disabled=\{selectedCommandPlan\.status !== "approved"\}/);
  assert.match(rendererSource, /workspaceForCommandRoute\(selectedCommandPlan\.route\)/);
});

test("Command plan review styling and validation scripts are present", () => {
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(styleSource, /\.command-review-panel/);
  assert.match(styleSource, /\.command-step-list/);
  assert.match(styleSource, /\.command-blocked-reasons/);
  assert.match(styleSource, /\.selected-command-plan/);
  assert.equal(fs.existsSync("scripts/test-command-plan-review.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux4.ps1"), true);
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["test:command-plan-review"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-plan-review.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux4"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux4.ps1");
});
