import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chatContractSource = fs.readFileSync("packages/contracts/src/chat.ts", "utf8");
const chatManagerSource = fs.readFileSync("apps/studio-desktop/src/main/chat-manager.ts", "utf8");
const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
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

test("Chat contracts expose model-team routing for active and completed runs", () => {
  assert.match(chatContractSource, /export interface ChatModelAssignment/);
  assert.match(chatContractSource, /readonly role: ModelRoleAlias/);
  assert.match(chatContractSource, /readonly lifecycle: ModelLifecycleClass \| null/);
  assert.match(chatContractSource, /export interface ChatModelTeam/);
  assert.match(chatContractSource, /readonly orchestratorRole: ModelRoleAlias/);
  assert.match(chatContractSource, /readonly specialistRoles: readonly ModelRoleAlias\[\]/);
  assert.match(chatContractSource, /readonly assignments: readonly ChatModelAssignment\[\]/);
  assert.match(chatContractSource, /readonly activeModelTeam: ChatModelTeam \| null/);
  assert.match(chatContractSource, /readonly modelTeam: ChatModelTeam \| null/);
  assert.match(chatContractSource, /readonly modelTeam\?: ChatModelTeam/);
});

test("Chat manager builds a model team and records lifecycle-aware routing", () => {
  assert.match(chatManagerSource, /modelLifecycle\?: ChatModelLifecycleAdapter/);
  assert.match(chatManagerSource, /request\.modelTeam \?\? buildFallbackChatModelTeam\(prompt, this\.provider, this\.model\)/);
  assert.match(chatManagerSource, /const executionModel = selectChatExecutionModel\(modelTeam, this\.model\)/);
  assert.match(chatManagerSource, /await this\.warmChatModelTeam\(modelTeam\)/);
  assert.match(chatManagerSource, /await this\.releaseChatModelTeam\(activeRun\.modelTeam\)/);
  assert.match(chatManagerSource, /function buildModelTeamPromptContext\(modelTeam: ChatModelTeam\)/);
  assert.match(chatManagerSource, /Model routing: use the orchestrator as the coordinating model/);
  assert.match(chatManagerSource, /export function selectChatTaskProfileId\(prompt: string\): ModelTaskProfileId/);
  assert.match(chatManagerSource, /export function buildFallbackChatModelTeam/);
});

test("Main process validates chat model-team IPC and connects Model Fabric lifecycle", () => {
  assert.match(mainSource, /const modelFabricManager = new ModelFabricManager\(\)/);
  assert.match(mainSource, /new HermesChatManager\(appRoot, \{ modelLifecycle: modelFabricManager \}\)/);
  assert.match(mainSource, /const modelTeam = value\.modelTeam/);
  assert.match(mainSource, /isChatModelTeamInput\(modelTeam\)/);
  assert.match(mainSource, /function isChatModelAssignmentInput\(value: unknown\): value is ChatModelAssignment/);
  assert.match(mainSource, /isModelLifecycleClass/);
});

test("Renderer sends model-team routes and renders the selected orchestrator plus specialists", () => {
  const sendMessageBlock = sourceBetween(
    rendererSource,
    "async function sendMessage(): Promise<void> {",
    "async function cancelChat"
  );
  const sidebarBlock = sourceBetween(
    rendererSource,
    '<aside className="chat-thinking-sidebar thinking-trace" aria-label="Chat thinking side panel">',
    '{chatCommandPlanCue ? ('
  );

  assert.match(rendererSource, /function buildChatModelTeamForPrompt/);
  assert.match(rendererSource, /selectChatTaskProfileIdForPrompt/);
  assert.match(sendMessageBlock, /const modelTeam = buildChatModelTeamForPrompt\(prompt, modelFabricState, selectedPrivacyPreset\)/);
  assert.match(sendMessageBlock, /\.\.\.\(modelTeam \? \{ modelTeam \} : \{\}\)/);
  assert.match(rendererSource, /const visibleChatModelTeam = isChatRunning/);
  assert.match(sidebarBlock, /aria-label="Chat model team"/);
  assert.match(sidebarBlock, /visibleChatModelTeam\.orchestratorRole/);
  assert.match(sidebarBlock, /visibleChatModelTeam\.specialistRoles\.join/);
  assert.match(sidebarBlock, /visibleChatModelTeam\.assignments\.map/);
});

test("#learn in Chat proposes approval-gated learning from recent chat context", () => {
  const sendMessageBlock = sourceBetween(
    rendererSource,
    "async function sendMessage(): Promise<void> {",
    "async function cancelChat"
  );

  assert.match(rendererSource, /function isChatLearnCommand\(prompt: string\): boolean/);
  assert.match(rendererSource, /function buildChatLearningCandidateContent\(prompt: string, messages: readonly ChatMessage\[\]\): string/);
  assert.match(sendMessageBlock, /if \(isChatLearnCommand\(prompt\)\)/);
  assert.match(sendMessageBlock, /window\.hermesStudio\.proposeMemoryCandidate/);
  assert.match(sendMessageBlock, /sourceKind: "chat"/);
  assert.match(sendMessageBlock, /Captured from #learn in Chat; pending Learning approval before memory persistence/);
  assert.match(sendMessageBlock, /Learning candidate \$\{candidate\.id\} is waiting for approval/);
  assert.doesNotMatch(sendMessageBlock, /reviewMemoryCandidate\(/);
});

test("Chat model-team styling and validation scripts are registered", () => {
  assert.match(styleSource, /\.chat-model-team/);
  assert.match(styleSource, /\.chat-model-team li\.loaded/);
  assert.equal(fs.existsSync("scripts/test-chat-model-team-learn.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux49.ps1"), true);
  assert.equal(pkg.scripts["test:chat-model-team-learn"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-model-team-learn.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux49"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux49.ps1");
});
