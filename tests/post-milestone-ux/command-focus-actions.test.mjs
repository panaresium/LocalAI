import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command Center defines typed focus actions", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandFocusActionId = "make-plan" \| "review-plan" \| "use-revision" \| "open-handoff"/);
  assert.match(rendererSource, /type CommandFocusActionTone = "primary" \| "secondary" \| "blocked" \| "handoff"/);
  assert.match(rendererSource, /type CommandFocusAction/);
  assert.match(rendererSource, /readonly id: CommandFocusActionId/);
  assert.match(rendererSource, /readonly disabled: boolean/);
  assert.match(rendererSource, /readonly guard: string/);
  assert.match(
    rendererSource,
    /function buildCommandFocusActions\(\s*composerBrief: CommandComposerBrief,\s*reviewQueue: CommandReviewQueueSummary,\s*reviewTargetPlan: CommandPlan \| null,\s*selectedPlan: CommandPlan \| null,\s*revisionDraft: CommandRevisionDraft \| null\s*\): readonly CommandFocusAction\[\]/
  );
});

test("Command focus actions cover make, review, revision, and handoff paths", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /id: "make-plan"/);
  assert.match(rendererSource, /label: "Make Plan"/);
  assert.match(rendererSource, /disabled: !composerBrief\.canPlan/);
  assert.match(rendererSource, /id: "review-plan"/);
  assert.match(rendererSource, /detail: reviewTargetPlan \? reviewTargetPlan\.title : reviewQueue\.label/);
  assert.match(rendererSource, /guard: reviewTargetPlan \? "Selects plan only" : "No plan"/);
  assert.match(rendererSource, /id: "use-revision"/);
  assert.match(rendererSource, /revisionDraft\?\.ready && selectedPlan\?\.status !== "approved"/);
  assert.match(rendererSource, /guard: "No plan created"/);
  assert.match(rendererSource, /id: "open-handoff"/);
  assert.match(rendererSource, /disabled: !approvedHandoff/);
  assert.match(rendererSource, /guard: approvedHandoff \? "User opens workspace" : "Approval required"/);
});

test("Command focus action handler requires explicit clicks and preserves approval gates", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const handlerStart = rendererSource.indexOf("function handleCommandFocusAction");
  const handlerEnd = rendererSource.indexOf("useEffect(", handlerStart);
  assert.ok(handlerStart >= 0);
  assert.ok(handlerEnd > handlerStart);
  const handlerBlock = rendererSource.slice(handlerStart, handlerEnd);
  assert.match(handlerBlock, /function handleCommandFocusAction\(actionId: CommandFocusActionId\): void/);
  assert.match(handlerBlock, /actionId === "make-plan"/);
  assert.match(handlerBlock, /void createCommandPlan\(\)/);
  assert.match(handlerBlock, /actionId === "review-plan"/);
  assert.match(handlerBlock, /findCommandReviewTargetPlan\(commandCenterState\?\.plans \?\? \[\]\)/);
  assert.match(handlerBlock, /setCommandPlanFilter\("all"\)/);
  assert.match(handlerBlock, /setSelectedCommandPlanId\(reviewTargetPlan\.id\)/);
  assert.match(handlerBlock, /actionId === "use-revision"/);
  assert.match(handlerBlock, /useCommandRevisionDraft\(selectedCommandPlan\)/);
  assert.match(handlerBlock, /actionId === "open-handoff"/);
  assert.match(handlerBlock, /selectedCommandPlan\?\.status !== "approved"/);
  assert.match(handlerBlock, /setActiveWorkspace\(nextWorkspace\)/);
  assert.doesNotMatch(handlerBlock, /reviewCommandPlan\(/);
});

test("Command focus actions render inside the focus bar", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const focusIndex = rendererSource.indexOf('aria-label="Command focus bar"');
  const actionsIndex = rendererSource.indexOf('aria-label="Command focus actions"');
  const panelIndex = rendererSource.indexOf('className="command-panel"');
  assert.match(rendererSource, /const commandFocusActions = buildCommandFocusActions\(/);
  assert.match(rendererSource, /commandComposerBrief,\s*commandReviewQueueSummary,\s*commandReviewTargetPlan,\s*selectedCommandPlan,\s*selectedCommandRevisionDraft/);
  assert.match(rendererSource, /commandFocusActions\.map\(\(action\) =>/);
  assert.match(rendererSource, /disabled=\{action\.disabled\}/);
  assert.match(rendererSource, /onClick=\{\(\) => handleCommandFocusAction\(action\.id\)\}/);
  assert.ok(focusIndex >= 0 && actionsIndex > focusIndex);
  assert.ok(panelIndex > actionsIndex);
  assert.match(styleSource, /\.command-focus-bar \.command-focus-actions/);
  assert.match(styleSource, /repeat\(auto-fit, minmax\(128px, 1fr\)\)/);
  assert.match(styleSource, /\.command-focus-actions button\.primary/);
  assert.match(styleSource, /\.command-focus-actions button\.handoff/);
  assert.match(styleSource, /\.command-focus-actions button:disabled/);
});

test("Command focus actions keep helpers isolated and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandFocusActions");
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
  assert.equal(fs.existsSync("scripts/test-command-focus-actions.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux34.ps1"), true);
  assert.equal(pkg.scripts["test:command-focus-actions"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-focus-actions.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux34"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux34.ps1");
});
