import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/model-fabric-manager.js")).href;
const contractSource = fs.readFileSync("packages/contracts/src/model-fabric.ts", "utf8");
const managerSource = fs.readFileSync("apps/studio-desktop/src/main/model-fabric-manager.ts", "utf8");
const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const manifest = JSON.parse(fs.readFileSync("ai_model_download_manifest.json", "utf8"));
const modelDocs = fs.readFileSync("AI_Model_Downloads.md", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  };
}

function createEmptyOllamaFetch(log = []) {
  return async (url, options = {}) => {
    const requestUrl = String(url);
    const method = options.method ?? "GET";
    const body = typeof options.body === "string" ? JSON.parse(options.body) : null;
    log.push({ url: requestUrl, method, body });

    if (requestUrl.endsWith("/api/tags") || requestUrl.endsWith("/api/ps")) {
      return jsonResponse({ models: [] });
    }
    if (requestUrl.endsWith("/api/pull")) {
      return jsonResponse({ status: "success" });
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({})
    };
  };
}

test("contracts support local artifact providers, source-only downloads, and voice task profiles", () => {
  assert.match(contractSource, /export type ModelProviderKind = "ollama" \| "local-artifact" \| "external-api"/);
  assert.match(contractSource, /export type ModelMarketplaceDownloadState = "available" \| "installed" \| "loaded" \| "source-only"/);
  assert.match(contractSource, /export type ModelRuntimeKind = "ollama" \| "manual-local"/);
  assert.match(contractSource, /\| "voice-assistant"/);
  assert.match(contractSource, /readonly parameterCountB: number \| null/);
  assert.match(contractSource, /readonly marketplaceRank: number \| null/);
  assert.match(contractSource, /readonly downloadSupported: boolean/);
});

test("marketplace exposes exactly ten ranked latest June 2026 Ollama models", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createEmptyOllamaFetch()
  });

  const state = await manager.getState();
  const featured = state.marketplace.filter((entry) => entry.marketplaceRank !== null);
  assert.equal(featured.length, 10);
  assert.deepEqual(featured.map((entry) => entry.marketplaceRank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(featured.map((entry) => entry.model), [
    "gemma4:31b",
    "qwen3.6:35b",
    "gemma4:26b",
    "qwen3.6:27b",
    "mistral-small3.2:24b",
    "gpt-oss:20b",
    "qwen3-coder-next:latest",
    "gemma4:12b",
    "gemma4:e4b",
    "gemma4:e2b"
  ]);
  assert.equal(featured.every((entry) => entry.runtimeKind === "ollama"), true);
  assert.equal(featured.every((entry) => entry.downloadSupported), true);
  assert.equal(featured.every((entry) => entry.capabilities.includes("latest-june-2026")), true);
});

test("Thai ASR and TTS entries are source-only local runtime models", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const calls = [];
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createEmptyOllamaFetch(calls)
  });

  const state = await manager.getState();
  const thaiModels = state.marketplace.filter((entry) => entry.capabilities.includes("thai"));
  assert.equal(thaiModels.length, 3);
  assert.equal(thaiModels.every((entry) => entry.providerId === "huggingface-local"), true);
  assert.equal(thaiModels.every((entry) => entry.runtimeKind === "manual-local"), true);
  assert.equal(thaiModels.every((entry) => !entry.downloadSupported), true);
  assert.equal(thaiModels.every((entry) => entry.downloadState === "source-only"), true);
  assert.equal(thaiModels.some((entry) => entry.roles.includes("speech.asr.fast")), true);
  assert.equal(thaiModels.some((entry) => entry.roles.includes("speech.asr.accurate")), true);
  assert.equal(thaiModels.some((entry) => entry.roles.includes("speech.tts.fast")), true);

  await assert.rejects(
    manager.downloadMarketplaceModel({ marketplaceEntryId: "market:hf:facebook:mms-tts-tha" }),
    /Automatic downloads currently support local Ollama models only/
  );
  assert.equal(calls.some((call) => call.url.endsWith("/api/pull")), false);
});

test("voice task profile and chat classifier route voice prompts to speech roles", () => {
  assert.match(managerSource, /id: "voice-assistant"/);
  assert.match(managerSource, /"speech.asr.fast", "speech.asr.accurate", "speech.tts.fast"/);
  assert.match(mainSource, /value === "voice-assistant"/);
  assert.match(rendererSource, /return "voice-assistant"/);
  assert.match(rendererSource, /thai transcription/);
  assert.match(rendererSource, /Source Only/);
  assert.match(rendererSource, /Model source/);
});

test("model docs list the ten featured local models and Thai speech entries", () => {
  assert.equal(manifest.featured_june_2026_ollama_models.length, 10);
  assert.equal(manifest.featured_june_2026_ollama_models[0].model, "gemma4:31b");
  assert.equal(manifest.featured_june_2026_ollama_models.some((entry) => entry.model === "qwen3-coder-next:latest"), true);
  assert.equal(manifest.thai_voice_models.length, 3);
  assert.match(modelDocs, /Featured June 2026 Ollama models/);
  assert.match(modelDocs, /ollama pull gemma4:31b/);
  assert.match(modelDocs, /ollama pull qwen3\.6:35b/);
  assert.match(modelDocs, /ollama pull qwen3-coder-next:latest/);
  assert.match(modelDocs, /MMS Thai TTS/);
});

test("UX51 validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-model-marketplace-speech-catalog.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux51.ps1"), true);
  assert.equal(pkg.scripts["test:model-marketplace-speech-catalog"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-model-marketplace-speech-catalog.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux51"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux51.ps1");
  assert.equal(fs.existsSync("scripts/test-model-marketplace-latest-june2026.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux52.ps1"), true);
  assert.equal(pkg.scripts["test:model-marketplace-latest-june2026"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-model-marketplace-latest-june2026.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux52"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux52.ps1");
});
