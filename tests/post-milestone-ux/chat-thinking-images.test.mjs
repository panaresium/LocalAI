import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const chatManagerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/chat-manager.js")).href;
const contractSource = fs.readFileSync("packages/contracts/src/chat.ts", "utf8");
const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("Chat contract exposes visible process summaries, metrics, diagrams, and generated images", () => {
  assert.match(contractSource, /export interface ChatRunMetrics/);
  assert.match(contractSource, /readonly tokensPerSecond: number/);
  assert.match(contractSource, /readonly maxTurns: number/);
  assert.match(contractSource, /export interface ChatThinkingStep/);
  assert.match(contractSource, /export interface ChatThinkingDiagram/);
  assert.match(contractSource, /export interface ChatThinkingTrace/);
  assert.match(contractSource, /readonly visibility: "summary"/);
  assert.match(contractSource, /export interface ChatGeneratedImage/);
  assert.match(contractSource, /readonly previewUrl: string/);
  assert.match(contractSource, /readonly thinkingTrace: ChatThinkingTrace \| null/);
  assert.match(contractSource, /readonly generatedImages: readonly ChatGeneratedImage\[\]/);
});

test("Chat manager builds user-visible thinking traces and local generated image artifacts", async () => {
  const {
    buildChatThinkingTrace,
    createChatGeneratedImageArtifact,
    estimateChatTokens,
    isChatImagePrompt,
    isSensitiveImagePrompt
  } = await import(chatManagerModulePath);

  assert.equal(isChatImagePrompt("Create an illustration of a clean dashboard"), true);
  assert.equal(isSensitiveImagePrompt("Create an icon for a password vault token"), true);
  assert.equal(estimateChatTokens("This is a visible process summary.") >= 5, true);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-chat-image-"));
  const image = createChatGeneratedImageArtifact(root, "Create an illustration of a clean dashboard");
  assert.equal(image.mimeType, "image/svg+xml");
  assert.equal(image.width, 960);
  assert.equal(image.height, 540);
  assert.equal(image.previewUrl.startsWith("file:"), true);
  assert.equal(fs.existsSync(image.path), true);
  assert.match(fs.readFileSync(image.path, "utf8"), /Hermes generated preview/);

  assert.throws(
    () => createChatGeneratedImageArtifact(root, "Create a logo showing my password token"),
    /Sensitive prompt content/
  );

  const trace = buildChatThinkingTrace({
    prompt: "Create an illustration of a clean dashboard",
    provider: "local",
    model: "orchestrator.primary",
    startedAt: "2026-06-27T05:00:00.000Z",
    startedAtMs: 1000,
    completedAtMs: 3500,
    maxTurns: 16,
    output: "Generated image preview is attached below.",
    attachments: [],
    generatedImages: [image],
    imageBlocked: false
  });

  assert.equal(trace.visibility, "summary");
  assert.match(trace.summary, /Private chain-of-thought is not exposed/);
  assert.deepEqual(trace.steps.map((step) => step.id), ["understand", "route", "context", "generate", "verify"]);
  assert.equal(trace.diagram.nodes.length, trace.steps.length);
  assert.equal(trace.diagram.edges.length, trace.steps.length - 1);
  assert.equal(trace.metrics.outputTokens > 0, true);
  assert.equal(trace.metrics.tokensPerSecond > 0, true);
  assert.equal(trace.metrics.maxTurns, 16);
});

test("Renderer shows process metrics, step diagram, and generated images inside simple chat", () => {
  assert.match(rendererSource, /thinkingTrace/);
  assert.match(rendererSource, /className="chat-thinking-sidebar thinking-trace"/);
  assert.match(rendererSource, /token\/s/);
  assert.match(rendererSource, /className="thinking-diagram"/);
  assert.match(rendererSource, /AI thinking steps diagram/);
  assert.match(rendererSource, /className="thinking-steps"/);
  assert.match(rendererSource, /message\.generatedImages\.length > 0/);
  assert.match(rendererSource, /className="chat-generated-images"/);
  assert.match(rendererSource, /<img src=\{image\.previewUrl\}/);
  assert.match(rendererSource, /thinkingTrace: null,\s*generatedImages: \[\]/);
});

test("Chat process and generated image styling stays compact", () => {
  assert.match(styleSource, /\.thinking-trace/);
  assert.match(styleSource, /\.thinking-metrics/);
  assert.match(styleSource, /\.thinking-diagram/);
  assert.match(styleSource, /\.thinking-node/);
  assert.match(styleSource, /\.thinking-steps/);
  assert.match(styleSource, /\.chat-generated-images/);
  assert.match(styleSource, /max-height: 320px/);
});

test("Chat thinking and images validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-chat-thinking-images.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux40.ps1"), true);
  assert.equal(pkg.scripts["test:chat-thinking-images"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-thinking-images.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux40"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux40.ps1");
});
