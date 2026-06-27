import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines a typed queue summary", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandReviewQueueTone = "empty" \| "ready" \| "blocked" \| "complete"/);
  assert.match(rendererSource, /type CommandReviewQueueSummary/);
  assert.match(rendererSource, /readonly nextPlan: string/);
  assert.match(rendererSource, /readonly guard: string/);
  assert.match(rendererSource, /function buildCommandReviewQueueSummary\(plans: readonly CommandPlan\[\]\): CommandReviewQueueSummary/);
});

test("Command review queue summary prioritizes ready, blocked, approved, and empty states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /label: "No plans"/);
  assert.match(rendererSource, /guard: "No handoff"/);
  assert.match(rendererSource, /const readyDraft = plans\.find/);
  assert.match(rendererSource, /label: "Review ready"/);
  assert.match(rendererSource, /Approve or reject after reading the plan/);
  assert.match(rendererSource, /const blockedDraft = plans\.find/);
  assert.match(rendererSource, /label: "Revision needed"/);
  assert.match(rendererSource, /guard: "Approval blocked"/);
  assert.match(rendererSource, /const approvedPlan = plans\.find/);
  assert.match(rendererSource, /label: "Approved handoff"/);
  assert.match(rendererSource, /label: "Queue complete"/);
});

test("Command review queue summary renders before filters", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const overviewIndex = rendererSource.indexOf('aria-label="Command queue overview"');
  const summaryIndex = rendererSource.indexOf('aria-label="Command review queue summary"');
  const filterIndex = rendererSource.indexOf('aria-label="Command plan filters"');
  assert.match(rendererSource, /const commandReviewQueueSummary = buildCommandReviewQueueSummary\(recentCommandPlans\)/);
  assert.match(rendererSource, /className=\{`command-review-queue-summary \$\{commandReviewQueueSummary\.tone\}`\}/);
  assert.match(rendererSource, /commandReviewQueueSummary\.nextPlan/);
  assert.match(rendererSource, /commandReviewQueueSummary\.guard/);
  assert.ok(overviewIndex >= 0 && summaryIndex > overviewIndex);
  assert.ok(filterIndex > summaryIndex);
  assert.match(styleSource, /\.command-review-queue-summary/);
  assert.match(styleSource, /\.command-review-queue-summary\.ready/);
  assert.match(styleSource, /\.command-review-queue-summary\.blocked/);
  assert.match(styleSource, /\.command-review-queue-summary\.complete/);
  assert.match(styleSource, /\.command-review-queue-summary\.empty/);
});

test("Command review queue summary remains display-only and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandReviewQueueSummary");
  const functionEnd = rendererSource.indexOf("function limitCommandDraft", functionStart);
  assert.ok(functionStart >= 0);
  assert.ok(functionEnd > functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /setActiveWorkspace\(/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-review-queue-summary.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux30.ps1"), true);
  assert.equal(pkg.scripts["test:command-review-queue-summary"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-review-queue-summary.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux30"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux30.ps1");
});
