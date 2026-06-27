import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines a typed approval trail", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandApprovalTrailTone = "created" \| "pending" \| "approved" \| "rejected"/);
  assert.match(rendererSource, /type CommandApprovalTrailItem/);
  assert.match(rendererSource, /function formatCommandTimestamp\(value: string\): string/);
  assert.match(rendererSource, /function buildCommandApprovalTrail\(plan: CommandPlan\): readonly CommandApprovalTrailItem\[\]/);
});

test("Command approval trail uses existing plan timestamps and review notes", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const contractSource = fs.readFileSync("packages/contracts/src/command-center.ts", "utf8");
  assert.match(contractSource, /readonly createdAt: string/);
  assert.match(contractSource, /readonly reviewedAt: string \| null/);
  assert.match(contractSource, /readonly reviewNote: string \| null/);
  assert.match(rendererSource, /detail: formatCommandTimestamp\(plan\.createdAt\)/);
  assert.match(rendererSource, /if \(!plan\.reviewedAt\)/);
  assert.match(rendererSource, /detail: formatCommandTimestamp\(plan\.reviewedAt\)/);
  assert.match(rendererSource, /note: plan\.reviewNote \?\? "No review note\."/);
});

test("Command approval trail renders pending and reviewed states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /selectedCommandApprovalTrail = selectedCommandPlan \? buildCommandApprovalTrail\(selectedCommandPlan\) : \[\]/);
  assert.match(rendererSource, /className="command-approval-trail"/);
  assert.match(rendererSource, /aria-label="Command approval trail"/);
  assert.match(rendererSource, /selectedCommandApprovalTrail\.map/);
  assert.match(rendererSource, /className=\{item\.tone\}/);
  assert.match(styleSource, /\.command-approval-trail/);
  assert.match(styleSource, /\.command-approval-trail li\.pending/);
  assert.match(styleSource, /\.command-approval-trail li\.approved/);
  assert.match(styleSource, /\.command-approval-trail li\.rejected/);
});

test("Command approval trail preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.doesNotMatch(rendererSource, /buildCommandApprovalTrail\(.*reviewCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-approval-trail.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux10.ps1"), true);
  assert.equal(pkg.scripts["test:command-approval-trail"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-approval-trail.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux10"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux10.ps1");
});
