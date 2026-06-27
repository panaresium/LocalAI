import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command queue defines typed overview items", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandQueueOverviewId = "total" \| "ready" \| "blocked" \| "approved" \| "rejected"/);
  assert.match(rendererSource, /type CommandQueueOverviewTone = "neutral" \| "ready" \| "blocked" \| "approved" \| "rejected"/);
  assert.match(rendererSource, /type CommandQueueOverviewItem/);
  assert.match(rendererSource, /readonly value: number/);
  assert.match(rendererSource, /function buildCommandQueueOverview\(plans: readonly CommandPlan\[\]\): readonly CommandQueueOverviewItem\[\]/);
});

test("Command queue overview counts actionable plan states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /readyCount = plans\.filter\(\(plan\) => plan\.status === "draft" && plan\.blockedReasons\.length === 0\)\.length/);
  assert.match(rendererSource, /blockedCount = plans\.filter\(\(plan\) => plan\.blockedReasons\.length > 0\)\.length/);
  assert.match(rendererSource, /approvedCount = plans\.filter\(\(plan\) => plan\.status === "approved"\)\.length/);
  assert.match(rendererSource, /rejectedCount = plans\.filter\(\(plan\) => plan\.status === "rejected"\)\.length/);
  assert.match(rendererSource, /detail: "Can approve"/);
  assert.match(rendererSource, /detail: "Needs revision"/);
  assert.match(rendererSource, /detail: "Can open"/);
});

test("Command queue overview renders before plan filters", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /commandQueueOverview = buildCommandQueueOverview\(recentCommandPlans\)/);
  assert.match(rendererSource, /aria-label="Command queue overview"/);
  assert.match(rendererSource, /commandQueueOverview\.map\(\(item\) =>/);
  assert.match(rendererSource, /className=\{item\.tone\}/);
  assert.ok(rendererSource.indexOf('aria-label="Command queue overview"') < rendererSource.indexOf('aria-label="Command plan filters"'));
  assert.match(styleSource, /\.command-queue-overview/);
  assert.match(styleSource, /\.command-queue-overview div\.ready/);
  assert.match(styleSource, /\.command-queue-overview div\.blocked/);
  assert.match(styleSource, /\.command-queue-overview div\.approved/);
  assert.match(styleSource, /\.command-queue-overview div\.rejected/);
});

test("Command queue overview preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.doesNotMatch(rendererSource, /buildCommandQueueOverview\(.*reviewCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-queue-overview.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux14.ps1"), true);
  assert.equal(pkg.scripts["test:command-queue-overview"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-queue-overview.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux14"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux14.ps1");
});
