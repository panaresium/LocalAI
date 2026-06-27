import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines typed approval impact", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandApprovalImpactTone = "ready" \| "blocked" \| "approved" \| "rejected"/);
  assert.match(rendererSource, /type CommandApprovalImpact/);
  assert.match(rendererSource, /readonly approval: string/);
  assert.match(rendererSource, /readonly execution: string/);
  assert.match(rendererSource, /function buildCommandApprovalImpact\(\s*plan: CommandPlan,\s*policy: CommandCenterState\["policy"\] \| null\s*\): CommandApprovalImpact/);
});

test("Command approval impact explains approval, execution, handoff, and audit", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /approval: "Approval unlocks handoff"/);
  assert.match(rendererSource, /execution = policy\?\.silentExecutionAllowed \? "Silent execution allowed by policy" : "No automatic execution"/);
  assert.match(rendererSource, /handoff: `User opens \$\{handoffWorkspace\}`/);
  assert.match(rendererSource, /audit: "Decision will be recorded"/);
  assert.match(rendererSource, /approval: "Approval blocked"/);
  assert.match(rendererSource, /handoff: `Open \$\{handoffWorkspace\}`/);
  assert.match(rendererSource, /execution: "No handoff"/);
});

test("Command approval impact renders before approval checklist", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /selectedCommandApprovalImpact = selectedCommandPlan \? buildCommandApprovalImpact\(selectedCommandPlan, commandPolicy\) : null/);
  assert.match(rendererSource, /aria-label="Command approval impact"/);
  assert.match(rendererSource, /selectedCommandApprovalImpact\.approval/);
  assert.match(rendererSource, /selectedCommandApprovalImpact\.execution/);
  assert.ok(rendererSource.indexOf('aria-label="Command step summary"') < rendererSource.indexOf('aria-label="Command approval impact"'));
  assert.ok(rendererSource.indexOf('aria-label="Command approval impact"') < rendererSource.indexOf('aria-label="Command approval checklist"'));
  assert.match(styleSource, /\.command-approval-impact/);
  assert.match(styleSource, /\.command-approval-impact\.blocked/);
  assert.match(styleSource, /\.command-approval-impact\.approved/);
  assert.match(styleSource, /\.command-approval-impact\.rejected/);
});

test("Command approval impact preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandApprovalImpact");
  const functionEnd = rendererSource.indexOf("function summarizeCommandDecision", functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /setActiveWorkspace\(/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-approval-impact.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux20.ps1"), true);
  assert.equal(pkg.scripts["test:command-approval-impact"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-approval-impact.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux20"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux20.ps1");
});
