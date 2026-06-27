import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/model-fabric-manager.js")).href;
const contractSource = fs.readFileSync("packages/contracts/src/model-fabric.ts", "utf8");
const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  };
}

function createMarketplaceOllamaFetch(log = []) {
  const installed = new Set(["qwen3.5:4b"]);
  const loaded = new Set(["qwen3.5:4b"]);

  return async (url, options = {}) => {
    const requestUrl = String(url);
    assert.equal(requestUrl.startsWith("http://127.0.0.1:11434/"), true, "Marketplace must call only the configured local Ollama endpoint.");
    const method = options.method ?? "GET";
    const body = typeof options.body === "string" ? JSON.parse(options.body) : null;
    log.push({ url: requestUrl, method, body });

    if (requestUrl.endsWith("/api/tags")) {
      return jsonResponse({
        models: [...installed].sort().map((name) => ({ name }))
      });
    }
    if (requestUrl.endsWith("/api/ps")) {
      return jsonResponse({
        models: [...loaded].sort().map((name) => ({ name }))
      });
    }
    if (requestUrl.endsWith("/api/pull")) {
      assert.equal(method, "POST");
      assert.equal(body.stream, false);
      installed.add(body.name);
      return jsonResponse({ status: "success" });
    }
    if (requestUrl.endsWith("/api/generate")) {
      assert.equal(method, "POST");
      if (body.keep_alive !== 0) {
        loaded.add(body.model);
      }
      return jsonResponse({ response: "" });
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({})
    };
  };
}

test("Model Fabric contracts expose marketplace downloads and task route presets", () => {
  assert.match(contractSource, /export interface ModelMarketplaceEntry/);
  assert.match(contractSource, /readonly marketplace: readonly ModelMarketplaceEntry\[\]/);
  assert.match(contractSource, /export interface ModelTaskRoutePreset/);
  assert.match(contractSource, /readonly taskRoutePresets: readonly ModelTaskRoutePreset\[\]/);
  assert.match(contractSource, /export interface ModelDownloadRequest/);
  assert.match(contractSource, /export interface ConfigureModelTaskRouteRequest/);
});

test("marketplace download pulls through local Ollama and updates inventory", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const calls = [];
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createMarketplaceOllamaFetch(calls)
  });

  const initialState = await manager.getState();
  const optionalModel = initialState.marketplace.find((entry) => entry.model === "qwen3.5:2b");
  assert.equal(optionalModel?.downloadState, "available");
  assert.equal(initialState.models.some((model) => model.id === "ollama:qwen3.5:2b"), true);

  const afterDownload = await manager.downloadMarketplaceModel({
    marketplaceEntryId: "market:ollama:qwen3.5:2b"
  });
  const pullCall = calls.find((call) => call.method === "POST" && call.url.endsWith("/api/pull"));
  assert.deepEqual(pullCall.body, {
    name: "qwen3.5:2b",
    stream: false
  });

  const downloaded = afterDownload.marketplace.find((entry) => entry.model === "qwen3.5:2b");
  assert.equal(downloaded?.installed, true);
  assert.equal(downloaded?.downloadState, "installed");
});

test("task profile routes can be assigned only to installed compatible models", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createMarketplaceOllamaFetch()
  });

  await assert.rejects(
    manager.configureTaskRoute({
      taskProfileId: "conversation",
      role: "agent.deep",
      modelId: "ollama:qwen3.5:9b",
      privacyPreset: "offline-secure"
    }),
    /Download the model/
  );

  await manager.downloadMarketplaceModel({ marketplaceEntryId: "market:ollama:qwen3.5:2b" });
  const configured = await manager.configureTaskRoute({
    taskProfileId: "conversation",
    role: "agent.general",
    modelId: "ollama:qwen3.5:2b",
    privacyPreset: "offline-secure"
  });

  const conversationPreset = configured.taskRoutePresets.find((preset) => preset.taskProfileId === "conversation");
  const assignment = conversationPreset?.assignments.find((entry) => entry.role === "agent.general");
  assert.equal(assignment?.overrideModelId, "ollama:qwen3.5:2b");
  assert.equal(assignment?.selectedModelId, "ollama:qwen3.5:2b");
  assert.match(assignment?.routeReason ?? "", /override/);
});

test("IPC and preload expose safe marketplace operations", () => {
  assert.match(mainSource, /studio:downloadMarketplaceModel/);
  assert.match(mainSource, /parseModelDownloadRequest/);
  assert.match(mainSource, /studio:configureModelTaskRoute/);
  assert.match(mainSource, /parseConfigureModelTaskRouteRequest/);
  assert.match(preloadSource, /downloadMarketplaceModel/);
  assert.match(preloadSource, /configureModelTaskRoute/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("process"/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("require"/);
  assert.doesNotMatch(preloadSource, /shell\./);
});

test("renderer shows marketplace download, preload, and task assignment controls", () => {
  assert.match(rendererSource, /Model Marketplace/);
  assert.match(rendererSource, /downloadMarketplaceModel/);
  assert.match(rendererSource, /preloadMarketplaceModel/);
  assert.match(rendererSource, /configureTaskRouteWithModel/);
  assert.match(rendererSource, /taskRoutePresets/);
  assert.match(rendererSource, /Use for Task/);
  assert.match(styleSource, /\.marketplace-list/);
  assert.match(styleSource, /\.marketplace-actions/);
});

test("UX50 validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-model-marketplace-download.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux50.ps1"), true);
  assert.equal(pkg.scripts["test:model-marketplace-download"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-model-marketplace-download.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux50"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux50.ps1");
});
