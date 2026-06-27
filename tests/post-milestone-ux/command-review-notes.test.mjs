import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command Center review notes are captured for the selected plan", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /commandReviewNote/);
  assert.match(rendererSource, /setCommandReviewNote\(""\)/);
  assert.match(rendererSource, /const selectedReviewNote = selectedCommandPlanId === planId \? commandReviewNote\.trim\(\) : ""/);
  assert.match(rendererSource, /reviewNote: selectedReviewNote \|\| defaultReviewNote/);
});

test("Command Center review note field is bounded and draft-only", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /className="text-field command-review-note"/);
  assert.match(rendererSource, /maxLength=\{240\}/);
  assert.match(rendererSource, /disabled=\{selectedCommandPlan\.status !== "draft"\}/);
  assert.match(rendererSource, /onChange=\{\(event\) => setCommandReviewNote\(event\.target\.value\)\}/);
});

test("Command Center stores and reloads review notes locally", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  assert.match(rendererSource, /setCommandReviewNote\(reviewedPlan\?\.reviewNote \?\? ""\)/);
  assert.match(rendererSource, /setCommandReviewNote\(plan\.reviewNote \?\? ""\)/);
  assert.match(mainSource, /value\.reviewNote !== undefined && typeof value\.reviewNote !== "string"/);
});

test("Command review note styling and validation scripts are present", () => {
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(styleSource, /\.command-review-note/);
  assert.equal(fs.existsSync("scripts/test-command-review-notes.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux5.ps1"), true);
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["test:command-review-notes"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-review-notes.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux5"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux5.ps1");
});
