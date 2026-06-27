import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source start: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing source end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Chat plan cue disables duplicate preparation when a matching plan exists", () => {
  const cueBlock = sourceBetween(
    rendererSource,
    '<section className={`chat-plan-cue risk-${chatCommandPlanCue.risk}`} aria-label="Chat command plan cue">',
    '<svg className="thinking-diagram"'
  );

  assert.match(cueBlock, /preparedChatPlan \? \(/);
  assert.match(cueBlock, /disabled=\{Boolean\(preparedChatPlan\) \|\| !chatCommandPlanCue\.canPrepare \|\| isChatRunning\}/);
  assert.match(cueBlock, /\{preparedChatPlan \? "Plan Prepared" : "Prepare Plan"\}/);
  assert.match(cueBlock, /onClick=\{\(\) => void prepareChatCommandPlan\(chatCommandPlanCue\.command\)\}/);
});

test("Prepared plan review remains the only enabled route back to Command Center", () => {
  const cueBlock = sourceBetween(
    rendererSource,
    '<section className={`chat-prepared-plan status-${preparedChatPlan.status}`} aria-label="Prepared chat command plan">',
    '<ol className="chat-plan-next-steps" aria-label="Chat plan next steps">'
  );

  assert.match(cueBlock, /Review Plan/);
  assert.match(cueBlock, /onClick=\{\(\) => reviewPreparedChatPlan\(preparedChatPlan\)\}/);
  assert.doesNotMatch(cueBlock, /prepareChatCommandPlan/);
});

test("Chat duplicate plan guard validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-chat-plan-duplicate-guard.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux47.ps1"), true);
  assert.equal(pkg.scripts["test:chat-plan-duplicate-guard"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-plan-duplicate-guard.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux47"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux47.ps1");
});
