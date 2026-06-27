import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("Command review defines a typed approval timeline", () => {
  assert.match(rendererSource, /type CommandReviewTimelineTone = "done" \| "current" \| "blocked" \| "waiting"/);
  assert.match(rendererSource, /type CommandReviewTimelineItem = \{/);
  assert.match(rendererSource, /readonly id: "draft" \| "approval" \| "handoff"/);
  assert.match(
    rendererSource,
    /function buildCommandReviewTimeline\(\s*plan: CommandPlan,\s*policy: CommandCenterState\["policy"\] \| null\s*\): readonly CommandReviewTimelineItem\[\]/
  );
});

test("Command review timeline covers draft, approval, blocker, and handoff states", () => {
  assert.match(rendererSource, /id: "draft",\s*label: "Draft ready"/);
  assert.match(rendererSource, /detail: `\$\{plan\.intent\} · \$\{plan\.risk\}`/);
  assert.match(rendererSource, /plan\.status === "approved"/);
  assert.match(rendererSource, /label: "Approved"/);
  assert.match(rendererSource, /plan\.status === "rejected"/);
  assert.match(rendererSource, /label: "Rejected"/);
  assert.match(rendererSource, /label: "Approval blocked"/);
  assert.match(rendererSource, /policy === null/);
  assert.match(rendererSource, /label: "Awaiting decision"/);
  assert.match(rendererSource, /label: "Ready to open"/);
  assert.match(rendererSource, /label: "Locked"/);
  assert.match(rendererSource, /return \[draft, approval, handoff\]/);
});

test("Command review timeline renders between step summary and approval impact", () => {
  const stepIndex = rendererSource.indexOf('aria-label="Command step summary"');
  const timelineIndex = rendererSource.indexOf('aria-label="Command review timeline"');
  const impactIndex = rendererSource.indexOf('aria-label="Command approval impact"');

  assert.match(rendererSource, /const selectedCommandReviewTimeline = selectedCommandPlan \? buildCommandReviewTimeline\(selectedCommandPlan, commandPolicy\) : \[\]/);
  assert.match(rendererSource, /selectedCommandReviewTimeline\.map\(\(item\) =>/);
  assert.match(rendererSource, /className=\{item\.tone\}/);
  assert.ok(stepIndex >= 0 && timelineIndex > stepIndex);
  assert.ok(impactIndex > timelineIndex);
});

test("Command review timeline has responsive neutral styling", () => {
  assert.match(styleSource, /\.command-review-timeline \{/);
  assert.match(styleSource, /repeat\(auto-fit, minmax\(132px, 1fr\)\)/);
  assert.match(styleSource, /\.command-review-timeline li::before/);
  assert.match(styleSource, /\.command-review-timeline li\.done/);
  assert.match(styleSource, /\.command-review-timeline li\.current/);
  assert.match(styleSource, /\.command-review-timeline li\.blocked/);
  assert.match(styleSource, /\.command-review-timeline li\.waiting/);
  assert.match(styleSource, /overflow-wrap: anywhere/);
});

test("Command review timeline remains display-only and package scripts are registered", () => {
  const helperStart = rendererSource.indexOf("function buildCommandReviewTimeline");
  const helperEnd = rendererSource.indexOf("function buildCommandApprovalTrail", helperStart);
  const helperBlock = helperStart >= 0 && helperEnd > helperStart ? rendererSource.slice(helperStart, helperEnd) : "";

  assert.doesNotMatch(helperBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(helperBlock, /createCommandPlan\(/);
  assert.doesNotMatch(helperBlock, /setActiveWorkspace\(/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.equal(fs.existsSync("scripts/test-command-review-timeline.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux35.ps1"), true);
  assert.equal(pkg.scripts["test:command-review-timeline"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-review-timeline.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux35"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux35.ps1");
});
