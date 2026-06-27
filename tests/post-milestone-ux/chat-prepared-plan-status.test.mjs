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

test("Chat can find an existing prepared plan for the current draft", () => {
  assert.match(rendererSource, /function findPreparedChatPlan\(command: string, plans: readonly CommandPlan\[\]\): CommandPlan \| null/);
  assert.match(rendererSource, /const trimmedCommand = command\.trim\(\)/);
  assert.match(rendererSource, /plans\.find\(\(plan\) => plan\.command === trimmedCommand\) \?\? null/);
  assert.match(rendererSource, /const preparedChatPlan = chatCommandPlanCue \? findPreparedChatPlan\(chatCommandPlanCue\.command, recentCommandPlans\) : null/);
});

test("Prepared chat plan review opens Command Center without approval or execution", () => {
  const handler = sourceBetween(
    rendererSource,
    "function reviewPreparedChatPlan(plan: CommandPlan): void {",
    "async function reviewCommandPlan"
  );

  assert.match(handler, /setCommandPlanFilter\("all"\)/);
  assert.match(handler, /setSelectedCommandPlanId\(plan\.id\)/);
  assert.match(handler, /setCommandText\(plan\.command\)/);
  assert.match(handler, /setActiveWorkspace\("command"\)/);
  assert.doesNotMatch(handler, /reviewCommandPlan|executeCommandPlan|createCommandPlan/);
});

test("Chat cue renders prepared plan status and review action", () => {
  const cueBlock = sourceBetween(
    rendererSource,
    '<section className={`chat-plan-cue risk-${chatCommandPlanCue.risk}`} aria-label="Chat command plan cue">',
    '<ol className="chat-plan-next-steps" aria-label="Chat plan next steps">'
  );

  assert.match(cueBlock, /preparedChatPlan \? \(/);
  assert.match(cueBlock, /className=\{`chat-prepared-plan status-\$\{preparedChatPlan\.status\}`\}/);
  assert.match(cueBlock, /aria-label="Prepared chat command plan"/);
  assert.match(cueBlock, /\{preparedChatPlan\.title\}/);
  assert.match(cueBlock, /\{preparedChatPlan\.status\}/);
  assert.match(cueBlock, /onClick=\{\(\) => reviewPreparedChatPlan\(preparedChatPlan\)\}/);
});

test("Prepared chat plan status styling and validation scripts are registered", () => {
  assert.match(styleSource, /\.chat-prepared-plan/);
  assert.match(styleSource, /\.chat-prepared-plan\.status-draft span/);
  assert.match(styleSource, /\.chat-prepared-plan\.status-approved span/);
  assert.match(styleSource, /\.chat-prepared-plan\.status-rejected span/);
  assert.equal(fs.existsSync("scripts/test-chat-prepared-plan-status.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux46.ps1"), true);
  assert.equal(pkg.scripts["test:chat-prepared-plan-status"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-prepared-plan-status.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux46"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux46.ps1");
});
