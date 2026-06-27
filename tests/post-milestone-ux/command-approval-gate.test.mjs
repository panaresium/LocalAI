import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines a typed approval gate", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandApprovalGateTone = "disabled" \| "blocked" \| "ready"/);
  assert.match(rendererSource, /type CommandApprovalGate/);
  assert.match(rendererSource, /readonly approval: string/);
  assert.match(rendererSource, /readonly execution: string/);
  assert.match(rendererSource, /readonly action: string/);
  assert.match(
    rendererSource,
    /function buildCommandApprovalGate\(\s*command: string,\s*blockedTerms: readonly string\[\],\s*composerBrief: CommandComposerBrief,\s*readiness: CommandReadinessMeter,\s*requiresApproval: boolean,\s*silentExecutionAllowed: boolean\s*\): CommandApprovalGate/
  );
});

test("Command approval gate explains disabled, blocked, policy, and ready states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /const trimmedCommand = command\.trim\(\)/);
  assert.match(rendererSource, /const execution = silentExecutionAllowed \? "Silent execution allowed by policy" : "No automatic execution"/);
  assert.match(rendererSource, /label: "Waiting for command"/);
  assert.match(rendererSource, /action: "Add command"/);
  assert.match(rendererSource, /if \(!composerBrief\.canPlan\)/);
  assert.match(rendererSource, /label: "Cannot create plan"/);
  assert.match(rendererSource, /detail: readiness\.nextStep/);
  assert.match(rendererSource, /label: "Review-only plan"/);
  assert.match(rendererSource, /approval: "Approval blocked until revised"/);
  assert.match(rendererSource, /label: "Approval unavailable"/);
  assert.match(rendererSource, /approval: "Restore approval policy"/);
  assert.match(rendererSource, /label: "Ready for draft"/);
  assert.match(rendererSource, /detail: "Make Plan creates a local draft only\."/);
  assert.match(rendererSource, /approval: "User approval required before handoff"/);
});

test("Command approval gate renders next to Make Plan", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const gateIndex = rendererSource.indexOf('aria-label="Command approval gate"');
  const buttonIndex = rendererSource.indexOf("Make Plan", gateIndex);
  assert.match(rendererSource, /const commandApprovalGate = buildCommandApprovalGate\(/);
  assert.match(rendererSource, /aria-label="Command approval gate"/);
  assert.match(rendererSource, /commandApprovalGate\.approval/);
  assert.match(rendererSource, /commandApprovalGate\.execution/);
  assert.match(rendererSource, /commandApprovalGate\.action/);
  assert.ok(gateIndex >= 0 && buttonIndex > gateIndex);
  assert.match(styleSource, /\.command-approval-gate/);
  assert.match(styleSource, /\.command-approval-gate\.ready/);
  assert.match(styleSource, /\.command-approval-gate\.blocked/);
  assert.match(styleSource, /\.command-approval-gate\.disabled/);
});

test("Command approval gate remains display-only and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandApprovalGate");
  const functionEnd = rendererSource.indexOf("function pluralize", functionStart);
  assert.ok(functionStart >= 0);
  assert.ok(functionEnd > functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /setActiveWorkspace\(/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-approval-gate.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux25.ps1"), true);
  assert.equal(pkg.scripts["test:command-approval-gate"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-approval-gate.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux25"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux25.ps1");
});
