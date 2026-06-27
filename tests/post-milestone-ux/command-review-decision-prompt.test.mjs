import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines a typed decision prompt", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandReviewDecisionPromptTone = "ready" \| "blocked" \| "approved" \| "rejected"/);
  assert.match(rendererSource, /type CommandReviewDecisionPrompt/);
  assert.match(rendererSource, /readonly headline: string/);
  assert.match(rendererSource, /readonly action: string/);
  assert.match(rendererSource, /readonly guard: string/);
  assert.match(
    rendererSource,
    /function buildCommandReviewDecisionPrompt\(\s*plan: CommandPlan,\s*reviewNote: string,\s*policy: CommandCenterState\["policy"\] \| null\s*\): CommandReviewDecisionPrompt/
  );
});

test("Command review decision prompt covers blocked, approved, rejected, policy, and ready states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /headline: "Revise before approval"/);
  assert.match(rendererSource, /action: hasReviewNote \? "Use note for revision" : "Add review note"/);
  assert.match(rendererSource, /guard: "Approve disabled"/);
  assert.match(rendererSource, /headline: "Ready to open"/);
  assert.match(rendererSource, /guard: "User-controlled handoff"/);
  assert.match(rendererSource, /headline: "Plan rejected"/);
  assert.match(rendererSource, /action: "Create a revision"/);
  assert.match(rendererSource, /headline: "Approval policy unavailable"/);
  assert.match(rendererSource, /guard: "No handoff"/);
  assert.match(rendererSource, /headline: hasReviewNote \? "Decision ready with note" : "Decision ready"/);
  assert.match(rendererSource, /action: "Approve or reject"/);
});

test("Command review decision prompt renders before approval checklist", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const impactIndex = rendererSource.indexOf('aria-label="Command approval impact"');
  const promptIndex = rendererSource.indexOf('aria-label="Command review decision prompt"');
  const checklistIndex = rendererSource.indexOf('aria-label="Command approval checklist"');
  assert.match(rendererSource, /const selectedCommandDecisionPrompt = selectedCommandPlan/);
  assert.match(rendererSource, /buildCommandReviewDecisionPrompt\(selectedCommandPlan, commandReviewNote, commandPolicy\)/);
  assert.match(rendererSource, /className=\{`command-review-decision-prompt \$\{selectedCommandDecisionPrompt\.tone\}`\}/);
  assert.match(rendererSource, /selectedCommandDecisionPrompt\.action/);
  assert.match(rendererSource, /selectedCommandDecisionPrompt\.guard/);
  assert.ok(impactIndex >= 0 && promptIndex > impactIndex);
  assert.ok(checklistIndex > promptIndex);
  assert.match(styleSource, /\.command-review-decision-prompt/);
  assert.match(styleSource, /\.command-review-decision-prompt\.ready/);
  assert.match(styleSource, /\.command-review-decision-prompt\.blocked/);
  assert.match(styleSource, /\.command-review-decision-prompt\.approved/);
  assert.match(styleSource, /\.command-review-decision-prompt\.rejected/);
});

test("Command review decision prompt remains display-only and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandReviewDecisionPrompt");
  const functionEnd = rendererSource.indexOf("function summarizeCommandDecision", functionStart);
  assert.ok(functionStart >= 0);
  assert.ok(functionEnd > functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /setActiveWorkspace\(/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-review-decision-prompt.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux31.ps1"), true);
  assert.equal(pkg.scripts["test:command-review-decision-prompt"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-review-decision-prompt.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux31"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux31.ps1");
});
