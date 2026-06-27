import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source start: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing source end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Chat defines a local command-plan cue from the current draft", () => {
  assert.match(rendererSource, /type ChatCommandPlanCue = \{/);
  assert.match(rendererSource, /function buildChatCommandPlanCue\(\s*command: string,\s*policy: CommandCenterState\["policy"\] \| null\s*\): ChatCommandPlanCue \| null/);
  assert.match(rendererSource, /buildCommandComposerRoutePreview\(trimmedCommand, blockedTerms\)/);
  assert.match(rendererSource, /routePreview\.confidence !== "matched" \|\| routePreview\.route === "chat"/);
  assert.match(rendererSource, /const canPrepare = trimmedCommand\.length <= maxChars && blockedTerms\.length === 0/);
  assert.match(rendererSource, /canPrepare\s*\n\s*\};/);
});

test("Chat prepares draft command plans without approval or execution", () => {
  const prepareFunction = sourceBetween(
    rendererSource,
    "async function prepareChatCommandPlan(command: string): Promise<void> {",
    "async function reviewCommandPlan"
  );

  assert.match(prepareFunction, /window\.hermesStudio\.createCommandPlan/);
  assert.match(prepareFunction, /context: selectedRoute \? `Prepared from Chat/);
  assert.match(prepareFunction, /setSelectedCommandPlanId\(plan\?\.id \?\? null\)/);
  assert.match(prepareFunction, /setActiveWorkspace\("command"\)/);
  assert.doesNotMatch(prepareFunction, /reviewCommandPlan|executeCommandPlan|reviewPlan|executePlan/);
});

test("Chat sidebar renders the plan cue without adding composer configuration", () => {
  const chatBlock = sourceBetween(
    rendererSource,
    '<section className="chat-workspace" aria-label="Simple chat">',
    '<section className="admin-workspace" aria-label="Profiles projects and config">'
  );
  const composerBlock = sourceBetween(
    chatBlock,
    '<div className="composer simple-composer" aria-label="Simple chat composer">',
    '</div>\n          </div>\n        </section>'
  );

  assert.match(chatBlock, /aria-label="Chat command plan cue"/);
  assert.match(chatBlock, /chatCommandPlanCue\.intentLabel/);
  assert.match(chatBlock, /Opens \{chatCommandPlanCue\.workspaceLabel\} for approval/);
  assert.match(chatBlock, /onClick=\{\(\) => void prepareChatCommandPlan\(chatCommandPlanCue\.command\)\}/);
  assert.match(chatBlock, /disabled=\{!chatCommandPlanCue\.canPrepare \|\| isChatRunning\}/);
  assert.doesNotMatch(composerBlock, /<select|Profile|Session|Attach|chat-toolbar/);
});

test("Chat command plan cue styling and validation scripts are registered", () => {
  assert.match(styleSource, /\.chat-plan-cue/);
  assert.match(styleSource, /\.chat-plan-cue\.risk-medium/);
  assert.match(styleSource, /\.chat-plan-cue\.risk-high/);
  assert.equal(fs.existsSync("scripts/test-chat-command-plan-cue.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux43.ps1"), true);
  assert.equal(pkg.scripts["test:chat-command-plan-cue"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-command-plan-cue.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux43"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux43.ps1");
});
