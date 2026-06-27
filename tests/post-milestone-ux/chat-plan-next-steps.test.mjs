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

test("Chat command plan cue includes a draft approval handoff step preview", () => {
  assert.match(rendererSource, /readonly nextSteps: readonly CommandPlanPreviewStep\[\]/);
  const cueFunction = sourceBetween(
    rendererSource,
    "function buildChatCommandPlanCue(",
    "function buildCommandIntentChecklist"
  );

  assert.match(cueFunction, /const nextSteps: readonly CommandPlanPreviewStep\[\] = \[/);
  assert.match(cueFunction, /label: "Draft"/);
  assert.match(cueFunction, /label: "Approve"/);
  assert.match(cueFunction, /label: "Handoff"/);
  assert.match(cueFunction, /state: canPrepare \? "ready" : "blocked"/);
  assert.match(cueFunction, /state: canPrepare \? "pending" : "blocked"/);
  assert.match(cueFunction, /nextSteps,/);
});

test("Chat sidebar renders next steps before the prepare action", () => {
  const cueBlock = sourceBetween(
    rendererSource,
    '<section className={`chat-plan-cue risk-${chatCommandPlanCue.risk}`} aria-label="Chat command plan cue">',
    '<button\n                type="button"'
  );

  assert.match(cueBlock, /className="chat-plan-next-steps" aria-label="Chat plan next steps"/);
  assert.match(cueBlock, /chatCommandPlanCue\.nextSteps\.map/);
  assert.match(cueBlock, /<strong>\{step\.label\}<\/strong>/);
  assert.match(cueBlock, /<span>\{step\.detail\}<\/span>/);
});

test("Chat plan next-step styling stays compact", () => {
  assert.match(styleSource, /\.chat-plan-next-steps/);
  assert.match(styleSource, /grid-template-columns: 70px minmax\(0, 1fr\)/);
  assert.match(styleSource, /\.chat-plan-next-steps li\.blocked/);
  assert.match(styleSource, /overflow-wrap: anywhere/);
});

test("Chat plan next-step validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-chat-plan-next-steps.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux45.ps1"), true);
  assert.equal(pkg.scripts["test:chat-plan-next-steps"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-plan-next-steps.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux45"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux45.ps1");
});
