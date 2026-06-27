import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines a typed approval checklist", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandApprovalCheckState = "pass" \| "pending" \| "blocked"/);
  assert.match(rendererSource, /type CommandApprovalCheck/);
  assert.match(rendererSource, /function buildCommandApprovalChecklist\(/);
  assert.match(rendererSource, /policy: CommandCenterState\["policy"\] \| null/);
});

test("Command approval checklist covers approval readiness gates", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /id: "review-state"/);
  assert.match(rendererSource, /id: "blockers"/);
  assert.match(rendererSource, /id: "approval-policy"/);
  assert.match(rendererSource, /id: "silent-execution"/);
  assert.match(rendererSource, /id: "handoff-target"/);
  assert.match(rendererSource, /policy\?\.requiresApproval && !reviewComplete \? "pending" : "pass"/);
  assert.match(rendererSource, /policy\?\.silentExecutionAllowed \? "blocked" : "pass"/);
  assert.match(rendererSource, /plan\.blockedReasons\.length > 0/);
});

test("Command approval checklist renders in the review panel", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /selectedCommandApprovalChecklist = selectedCommandPlan \? buildCommandApprovalChecklist\(selectedCommandPlan, commandPolicy\) : \[\]/);
  assert.match(rendererSource, /className="command-approval-checklist"/);
  assert.match(rendererSource, /aria-label="Command approval checklist"/);
  assert.match(rendererSource, /selectedCommandApprovalChecklist\.map/);
  assert.match(rendererSource, /className=\{check\.state\}/);
  assert.match(styleSource, /\.command-approval-checklist/);
  assert.match(styleSource, /\.command-approval-checklist li\.pass/);
  assert.match(styleSource, /\.command-approval-checklist li\.pending/);
  assert.match(styleSource, /\.command-approval-checklist li\.blocked/);
});

test("Command approval checklist preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.doesNotMatch(rendererSource, /buildCommandApprovalChecklist\(.*reviewCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-approval-checklist.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux11.ps1"), true);
  assert.equal(pkg.scripts["test:command-approval-checklist"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-approval-checklist.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux11"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux11.ps1");
});
