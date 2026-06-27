import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines a typed decision summary", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandDecisionTone = "ready" \| "blocked" \| "approved" \| "rejected"/);
  assert.match(rendererSource, /type CommandDecisionSummary/);
  assert.match(rendererSource, /function summarizeCommandDecision\(plan: CommandPlan\): CommandDecisionSummary/);
  assert.match(rendererSource, /pluralize\(plan\.blockedReasons\.length, "blocker", "blockers"\)/);
  assert.match(rendererSource, /plan\.steps\.filter\(\(step\) => step\.requiresApproval\)\.length/);
});

test("Command decision summary covers blocked, approved, rejected, and draft states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /tone: "blocked"/);
  assert.match(rendererSource, /nextAction: "Reject or re-plan"/);
  assert.match(rendererSource, /plan\.status === "approved"/);
  assert.match(rendererSource, /nextAction: "Open workspace"/);
  assert.match(rendererSource, /plan\.status === "rejected"/);
  assert.match(rendererSource, /nextAction: "Make a revised plan"/);
  assert.match(rendererSource, /tone: "ready"/);
  assert.match(rendererSource, /nextAction: "Approve or reject"/);
});

test("Command decision summary renders in the review panel", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /selectedCommandDecision = selectedCommandPlan \? summarizeCommandDecision\(selectedCommandPlan\) : null/);
  assert.match(rendererSource, /className=\{`command-decision-summary \$\{selectedCommandDecision\.tone\}`\}/);
  assert.match(rendererSource, /aria-label="Command decision summary"/);
  assert.match(rendererSource, /selectedCommandDecision\.nextAction/);
  assert.match(styleSource, /\.command-decision-summary/);
  assert.match(styleSource, /\.command-decision-summary\.blocked div/);
  assert.match(styleSource, /\.command-decision-summary\.approved div/);
});

test("Command decision summary preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.doesNotMatch(rendererSource, /summarizeCommandDecision\(.*reviewCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-decision-summary.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux9.ps1"), true);
  assert.equal(pkg.scripts["test:command-decision-summary"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-decision-summary.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux9"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux9.ps1");
});
