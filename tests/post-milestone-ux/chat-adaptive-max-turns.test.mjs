import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const chatManagerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/chat-manager.js")).href;
const contractSource = fs.readFileSync("packages/contracts/src/chat.ts", "utf8");
const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("Chat contract carries active and completed max-turn metadata", () => {
  assert.match(contractSource, /readonly maxTurns: number/);
  assert.match(contractSource, /readonly activeMaxTurns: number \| null/);
  assert.match(contractSource, /readonly maxTurns\?: number/);
});

test("Chat manager selects bounded max turns from task complexity", async () => {
  const {
    buildChatThinkingTrace,
    buildHermesChatArgs,
    normalizeChatMaxTurnsLimit,
    selectChatMaxTurns
  } = await import(chatManagerModulePath);

  assert.equal(normalizeChatMaxTurnsLimit(50), 20);
  assert.equal(normalizeChatMaxTurnsLimit(Number.NaN), 16);
  assert.equal(selectChatMaxTurns("hello", 16), 8);
  assert.equal(selectChatMaxTurns("I want to set the date and time in my computer as Singapore time", 16), 12);
  assert.equal(selectChatMaxTurns("Generate an image of this BCP flow as an architecture diagram", 16), 16);
  assert.equal(selectChatMaxTurns("Research, troubleshoot, and implement the full multi-step plan", 20), 20);
  assert.equal(selectChatMaxTurns("Research, troubleshoot, and implement the full multi-step plan", 16), 16);
  assert.equal(selectChatMaxTurns("hello", 1), 1);

  const args = buildHermesChatArgs({
    prompt: "Generate an image of this BCP flow as an architecture diagram",
    provider: "custom",
    model: "qwen3.5:4b",
    maxTurns: selectChatMaxTurns("Generate an image of this BCP flow as an architecture diagram", 16),
    sessionId: null,
    imagePath: null
  });
  assert.equal(args.at(args.indexOf("--max-turns") + 1), "16");

  const trace = buildChatThinkingTrace({
    prompt: "Generate an image of this BCP flow as an architecture diagram",
    provider: "custom",
    model: "qwen3.5:4b",
    startedAt: "2026-06-27T05:00:00.000Z",
    startedAtMs: 1000,
    completedAtMs: 5000,
    maxTurns: 16,
    output: "Generated image preview is attached below.",
    attachments: [],
    generatedImages: [],
    imageBlocked: false
  });

  assert.equal(trace.metrics.maxTurns, 16);
  assert.match(trace.steps.find((step) => step.id === "route")?.detail ?? "", /16 max turns/);
  assert.match(trace.steps.find((step) => step.id === "verify")?.detail ?? "", /within 16 max turns/);
});

test("Chat process sidebar shows the selected max-turn budget without adding composer options", () => {
  assert.match(rendererSource, /const activeChatMaxTurns = chatState\?\.activeMaxTurns \?\? null/);
  assert.match(rendererSource, /const visibleChatMaxTurns = isChatRunning/);
  assert.match(rendererSource, /latestThinkingTrace\?\.metrics\.maxTurns/);
  assert.match(rendererSource, /buildLiveThinkingSteps\(liveChatOutputTokens > 0, activeChatMaxTurns\)/);
  assert.match(rendererSource, /\$\{visibleChatMaxTurns\} max turns/);
  assert.doesNotMatch(rendererSource, /label>\s*<span>Max turns<\/span>/);
});

test("Adaptive max-turn validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-chat-adaptive-max-turns.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux42.ps1"), true);
  assert.equal(pkg.scripts["test:chat-adaptive-max-turns"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-adaptive-max-turns.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux42"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux42.ps1");
});
