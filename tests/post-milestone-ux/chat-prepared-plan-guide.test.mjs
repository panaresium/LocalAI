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

test("Chat prepared-plan guide derives next action from command plan state", () => {
  const helper = sourceBetween(
    rendererSource,
    "function buildChatPreparedPlanGuide(plan: CommandPlan): ChatPreparedPlanGuide {",
    "function buildCommandIntentChecklist"
  );

  assert.match(rendererSource, /type ChatPreparedPlanGuideTone = "ready" \| "blocked" \| "approved" \| "rejected"/);
  assert.match(helper, /plan\.status === "approved"/);
  assert.match(helper, /Ready for approved handoff to \$\{workspaceLabel\(workspaceForCommandRoute\(plan\.route\)\)\}/);
  assert.match(helper, /plan\.status === "rejected"/);
  assert.match(helper, /Use the existing review note to prepare a safer revision/);
  assert.match(helper, /plan\.blockedReasons\.length > 0/);
  assert.match(helper, /blocker", "blockers"/);
  assert.match(helper, /Draft plan is waiting for user approval/);
});

test("Prepared-plan guide renders as display-only Chat status", () => {
  const cueBlock = sourceBetween(
    rendererSource,
    '<section className={`chat-prepared-plan status-${preparedChatPlan.status}`} aria-label="Prepared chat command plan">',
    '<button type="button" onClick={() => reviewPreparedChatPlan(preparedChatPlan)}>'
  );

  assert.match(rendererSource, /const preparedChatPlanGuide = preparedChatPlan \? buildChatPreparedPlanGuide\(preparedChatPlan\) : null/);
  assert.match(cueBlock, /aria-label="Prepared plan next action"/);
  assert.match(cueBlock, /chat-prepared-plan-guide \$\{preparedChatPlanGuide\.tone\}/);
  assert.match(cueBlock, /\{preparedChatPlanGuide\.label\}/);
  assert.match(cueBlock, /\{preparedChatPlanGuide\.detail\}/);
  assert.match(cueBlock, /\{preparedChatPlanGuide\.action\}/);
  assert.doesNotMatch(cueBlock, /onClick=|executeCommandPlan|reviewCommandPlan|createCommandPlan/);
});

test("Prepared-plan guide styling and validation scripts are registered", () => {
  assert.match(styleSource, /\.chat-prepared-plan-guide/);
  assert.match(styleSource, /\.chat-prepared-plan-guide\.approved/);
  assert.match(styleSource, /\.chat-prepared-plan-guide\.rejected/);
  assert.match(styleSource, /\.chat-prepared-plan-guide\.blocked/);
  assert.equal(fs.existsSync("scripts/test-chat-prepared-plan-guide.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux48.ps1"), true);
  assert.equal(pkg.scripts["test:chat-prepared-plan-guide"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-prepared-plan-guide.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux48"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux48.ps1");
});
