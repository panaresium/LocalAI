import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines a typed decision brief", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandReviewBriefTone = "ready" \| "blocked" \| "approved" \| "rejected"/);
  assert.match(rendererSource, /type CommandReviewBrief/);
  assert.match(rendererSource, /readonly primaryAction: string/);
  assert.match(rendererSource, /function buildCommandReviewBrief\(plan: CommandPlan\): CommandReviewBrief/);
});

test("Command review brief covers ready, blocked, approved, and rejected plans", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /headline: "Ready for your decision"/);
  assert.match(rendererSource, /primaryAction: "Approve or reject"/);
  assert.match(rendererSource, /headline: "Revise before approval"/);
  assert.match(rendererSource, /primaryAction: "Reject or re-plan"/);
  assert.match(rendererSource, /headline: "Approved for handoff"/);
  assert.match(rendererSource, /primaryAction: "Open workspace"/);
  assert.match(rendererSource, /headline: "Plan rejected"/);
  assert.match(rendererSource, /primaryAction: "Make a revised plan"/);
});

test("Command review brief renders before detailed review sections", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /selectedCommandReviewBrief = selectedCommandPlan \? buildCommandReviewBrief\(selectedCommandPlan\) : null/);
  assert.match(rendererSource, /className=\{`command-review-brief \$\{selectedCommandReviewBrief\.tone\}`\}/);
  assert.match(rendererSource, /aria-label="Command review brief"/);
  assert.match(rendererSource, /selectedCommandReviewBrief\.primaryAction/);
  assert.match(styleSource, /\.command-review-brief/);
  assert.match(styleSource, /\.command-review-brief\.ready/);
  assert.match(styleSource, /\.command-review-brief\.blocked/);
  assert.match(styleSource, /\.command-review-brief\.approved/);
  assert.match(styleSource, /\.command-review-brief\.rejected/);
});

test("Command review brief preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.doesNotMatch(rendererSource, /buildCommandReviewBrief\(.*reviewCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-review-brief.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux13.ps1"), true);
  assert.equal(pkg.scripts["test:command-review-brief"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-review-brief.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux13"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux13.ps1");
});
