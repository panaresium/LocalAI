import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines typed action availability", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandReviewActionState = "available" \| "blocked" \| "complete" \| "unavailable"/);
  assert.match(rendererSource, /type CommandReviewAction/);
  assert.match(rendererSource, /readonly id: "approve" \| "reject" \| "open"/);
  assert.match(rendererSource, /function buildCommandReviewActions\(plan: CommandPlan\): readonly CommandReviewAction\[\]/);
});

test("Command review actions explain approve, reject, and open readiness", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /id: "approve"/);
  assert.match(rendererSource, /Blocked until the command is revised/);
  assert.match(rendererSource, /Available now/);
  assert.match(rendererSource, /id: "reject"/);
  assert.match(rendererSource, /Available as the alternate decision/);
  assert.match(rendererSource, /id: "open"/);
  assert.match(rendererSource, /Approve before opening/);
  assert.match(rendererSource, /Rejected plans cannot be opened/);
});

test("Command review action strip renders in the review panel", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /selectedCommandReviewActions = selectedCommandPlan \? buildCommandReviewActions\(selectedCommandPlan\) : \[\]/);
  assert.match(rendererSource, /className="command-review-action-strip"/);
  assert.match(rendererSource, /aria-label="Command review actions"/);
  assert.match(rendererSource, /selectedCommandReviewActions\.map/);
  assert.match(rendererSource, /className=\{action\.state\}/);
  assert.match(styleSource, /\.command-review-action-strip/);
  assert.match(styleSource, /\.command-review-action-strip div\.available/);
  assert.match(styleSource, /\.command-review-action-strip div\.blocked/);
  assert.match(styleSource, /\.command-review-action-strip div\.complete/);
  assert.match(styleSource, /\.command-review-action-strip div\.unavailable/);
});

test("Command review action strip preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.doesNotMatch(rendererSource, /buildCommandReviewActions\(.*reviewCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-review-actions.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux12.ps1"), true);
  assert.equal(pkg.scripts["test:command-review-actions"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-review-actions.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux12"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux12.ps1");
});
