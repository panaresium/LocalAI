import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const commandManagerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/command-center-manager.js")).href;
const modelFabricModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/model-fabric-manager.js")).href;
const commandContractSource = fs.readFileSync("packages/contracts/src/command-center.ts", "utf8");
const modelContractSource = fs.readFileSync("packages/contracts/src/model-fabric.ts", "utf8");
const modelRoleSource = fs.readFileSync("packages/contracts/src/model-roles.ts", "utf8");
const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  };
}

function createLocalOllamaFetch() {
  return async (url) => {
    const requestUrl = String(url);
    assert.equal(requestUrl.startsWith("http://127.0.0.1:11434/"), true);
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
          { name: "qwen3.5:4b" },
          { name: "qwen3-vl:4b" }
        ]
      });
    }
    return jsonResponse({ response: "local model ok" });
  };
}

test("contracts define orchestrator role, task profiles, memory guidance, and command confidence gates", () => {
  assert.match(modelRoleSource, /"orchestrator\.primary"/);
  assert.match(modelContractSource, /export interface ModelTaskProfile/);
  assert.match(modelContractSource, /readonly orchestratorRole: ModelRoleAlias/);
  assert.match(modelContractSource, /readonly specialistRoles: readonly ModelRoleAlias\[\]/);
  assert.match(modelContractSource, /export interface ModelMemoryRecommendation/);
  assert.match(modelContractSource, /readonly taskProfiles: readonly ModelTaskProfile\[\]/);
  assert.match(modelContractSource, /readonly memoryRecommendation: ModelMemoryRecommendation/);
  assert.match(commandContractSource, /export interface CommandPlanModelOrchestration/);
  assert.match(commandContractSource, /readonly confidence: number/);
  assert.match(commandContractSource, /readonly confidenceThreshold: number/);
  assert.match(commandContractSource, /readonly referencesRequired: boolean/);
});

test("Model Fabric routes an orchestrator and publishes specialty task profiles", async () => {
  const { ModelFabricManager } = await import(modelFabricModulePath);
  const manager = new ModelFabricManager({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: createLocalOllamaFetch()
  });
  const state = await manager.getState();
  const orchestrator = state.routes.find((route) => route.role === "orchestrator.primary");
  assert.equal(orchestrator?.selectedModelId, "ollama:qwen3.5:4b");
  assert.equal(state.taskProfiles.length >= 5, true);
  assert.equal(state.taskProfiles.some((profile) => profile.id === "computer-control"), true);
  assert.equal(state.taskProfiles.every((profile) => profile.orchestratorRole === "orchestrator.primary"), true);
  assert.equal(state.taskProfiles.every((profile) => profile.confidenceFloor >= 0.9), true);
  assert.match(state.memoryRecommendation.recommendation, /orchestrator|specialist|Unload/u);
});

test("Command Center plans include model teams and enforce the 90 percent confidence gate", async () => {
  const { CommandCenterManager } = await import(commandManagerModulePath);
  const manager = new CommandCenterManager();
  let state = manager.createPlan({ command: "I want to set the date and time in my computer as Singapore time" });
  const singaporePlan = state.plans[0];
  assert.equal(singaporePlan.intent, "computer-control");
  assert.equal(singaporePlan.route, "computer-control");
  assert.equal(singaporePlan.risk, "high");
  assert.equal(singaporePlan.confidence >= 0.9, true);
  assert.equal(singaporePlan.referencesRequired, false);
  assert.equal(singaporePlan.modelOrchestration.orchestratorRole, "orchestrator.primary");
  assert.deepEqual(singaporePlan.modelOrchestration.specialistRoles, ["agent.verify", "vision.ui_grounding"]);
  assert.equal(singaporePlan.steps.some((step) => step.title === "Choose model team"), true);
  assert.equal(singaporePlan.steps.some((step) => step.title === "Check confidence"), true);
  assert.match(singaporePlan.referenceQueries.join("\n"), /Singapore Standard Time/);

  state = manager.createPlan({ command: "Do the thing for me" });
  const vaguePlan = state.plans[0];
  assert.equal(vaguePlan.confidence < 0.9, true);
  assert.equal(vaguePlan.referencesRequired, true);
  assert.match(vaguePlan.blockedReasons.join("\n"), /below 90%/);
  assert.throws(() => manager.reviewPlan({ planId: vaguePlan.id, decision: "approve" }), /blocked/);
});

test("Studio renders model orchestration and confidence details without adding shell access", () => {
  assert.match(rendererSource, /useState<ModelRoleAlias>\("orchestrator\.primary"\)/);
  assert.match(rendererSource, /aria-label="Command model orchestration"/);
  assert.match(rendererSource, /aria-label="Command reference queries"/);
  assert.match(rendererSource, /selectedCommandPlan\.modelOrchestration\.orchestratorRole/);
  assert.match(rendererSource, /selectedCommandPlan\.modelOrchestration\.specialistRoles\.join/);
  assert.match(rendererSource, /selectedCommandPlan\.referencesRequired/);
  assert.match(rendererSource, /aria-label="Model task profiles"/);
  assert.match(rendererSource, /modelFabricState\?\.memoryRecommendation\.recommendation/);
  assert.match(styleSource, /\.command-orchestration/);
  assert.match(styleSource, /\.command-reference-list/);
  assert.match(styleSource, /\.task-profile-list/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
});

test("Model orchestration validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-model-orchestration-confidence.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux37.ps1"), true);
  assert.equal(pkg.scripts["test:model-orchestration-confidence"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-model-orchestration-confidence.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux37"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux37.ps1");
});
