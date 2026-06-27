import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/model-fabric-manager.js")).href;

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  };
}

function createLocalOllamaFetch(log = []) {
  return async (url, options = {}) => {
    const requestUrl = String(url);
    assert.equal(requestUrl.startsWith("http://127.0.0.1:11434/"), true, "Model Fabric must call only the configured local Ollama endpoint.");
    const method = options.method ?? "GET";
    const body = typeof options.body === "string" ? JSON.parse(options.body) : null;
    log.push({ url: requestUrl, method, body });

    if (requestUrl.endsWith("/api/tags")) {
      return jsonResponse({
        models: [
          { name: "qwen3.5:4b" },
          { name: "qwen3.5:9b" },
          { name: "qwen3-vl:4b" },
          { name: "qwen3-embedding:0.6b" }
        ]
      });
    }
    if (requestUrl.endsWith("/api/ps")) {
      return jsonResponse({
        models: [
          { name: "qwen3.5:4b" }
        ]
      });
    }
    if (requestUrl.endsWith("/api/generate")) {
      return jsonResponse({
        response: "local model ok"
      });
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({})
    };
  };
}

test("Model Fabric routes pinned controller to installed local Ollama model", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createLocalOllamaFetch()
  });

  const state = await manager.getState();
  const route = state.routes.find((entry) => entry.role === "controller.fast");
  assert.equal(route?.selectedModelId, "ollama:qwen3.5:4b");
  assert.equal(route?.providerId, "ollama");
  assert.match(route?.reason ?? "", /pinned/);
});

test("user override is visible and disabled external providers are never selected", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createLocalOllamaFetch()
  });

  const route = await manager.routeRole({
    role: "agent.general",
    privacyPreset: "offline-secure",
    overrideModelId: "ollama:qwen3.5:9b"
  });

  assert.equal(route.selectedModelId, "ollama:qwen3.5:9b");
  assert.equal(route.overrideModelId, "ollama:qwen3.5:9b");
  assert.equal(route.providerId, "ollama");

  const state = await manager.getState();
  assert.equal(state.providers.filter((provider) => provider.privacyBoundary === "external").every((provider) => !provider.enabled), true);
  assert.equal(state.routes.some((entry) => entry.providerId && entry.providerId !== "ollama"), false);
});

test("Offline Secure mode makes zero external API calls", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const calls = [];
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createLocalOllamaFetch(calls)
  });

  await manager.getState();
  await manager.routeRole({
    role: "agent.deep",
    privacyPreset: "offline-secure",
    overrideModelId: null
  });

  assert.equal(calls.length > 0, true);
  assert.equal(calls.every((call) => call.url.startsWith("http://127.0.0.1:11434/")), true);
});

test("Ollama unload uses keep_alive 0", async () => {
  const { ModelFabricManager, buildOllamaGenerateRequest } = await import(managerModulePath);
  assert.deepEqual(buildOllamaGenerateRequest("qwen3.5:4b", "", 0), {
    model: "qwen3.5:4b",
    prompt: "",
    stream: false,
    keep_alive: 0
  });

  const calls = [];
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createLocalOllamaFetch(calls)
  });
  await manager.lifecycle({
    modelId: "ollama:qwen3.5:4b",
    action: "unload"
  });

  const unloadCall = calls.find((call) => call.method === "POST" && call.url.endsWith("/api/generate"));
  assert.equal(unloadCall.body.keep_alive, 0);
});

test("benchmarks run through local Ollama adapter only", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createLocalOllamaFetch()
  });

  const result = await manager.benchmark({
    modelId: "ollama:qwen3.5:4b",
    role: "controller.fast"
  });

  assert.equal(result.status, "passed");
  assert.equal(result.outputChars, "local model ok".length);
});

test("plan validator accepts model plans across milestone domains", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createLocalOllamaFetch()
  });

  const result = manager.validatePlan({
    privacyPreset: "offline-secure",
    plan: {
      intent: "multi_domain_plan",
      privacy_class: "local_only",
      cloud_allowed: false,
      stages: [
        { id: "text", type: "model", role: "agent.general" },
        { id: "rag", type: "model", role: "retrieval.embedding", depends_on: ["text"] },
        { id: "image", type: "model", role: "image.generate", depends_on: ["text"] },
        { id: "audio", type: "model", role: "speech.asr.fast", depends_on: ["text"] },
        { id: "video", type: "model", role: "vision.video", depends_on: ["text"] },
        { id: "code", type: "model", role: "agent.code", depends_on: ["text"] },
        { id: "computer", type: "model", role: "vision.ui_grounding", depends_on: ["text"] }
      ]
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.acceptedStageIds.length, 7);
});

test("plan validator rejects invalid plans and direct OS tool execution", async () => {
  const { ModelFabricManager } = await import(managerModulePath);
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createLocalOllamaFetch()
  });

  const result = manager.validatePlan({
    privacyPreset: "offline-secure",
    plan: {
      intent: "unsafe_control",
      privacy_class: "local_only",
      cloud_allowed: false,
      stages: [
        { id: "click", type: "tool", role: "mouse.click" }
      ]
    }
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.blockedStageIds, ["click"]);
  assert.match(result.errors.map((error) => error.message).join("\n"), /Direct OS tool execution is blocked/);
});

test("preload exposes Model Fabric APIs without Node or shell access", () => {
  const preloadSource = existsSync("apps/studio-desktop/src/preload/preload.cts")
    ? readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8")
    : "";
  assert.match(preloadSource, /getModelFabricState/);
  assert.match(preloadSource, /routeModelRole/);
  assert.match(preloadSource, /validateModelPlan/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("process"/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("require"/);
  assert.doesNotMatch(preloadSource, /shell\./);
});
