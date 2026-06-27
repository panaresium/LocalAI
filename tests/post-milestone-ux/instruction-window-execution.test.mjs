import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const commandManagerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/command-center-manager.js")).href;
const mediaManagerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/media-manager.js")).href;
const contractSource = fs.readFileSync("packages/contracts/src/command-center.ts", "utf8");
const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("Command contracts expose media-generation execution records", () => {
  assert.match(contractSource, /"media-generation"/);
  assert.match(contractSource, /export type CommandPlanExecutionStatus = "completed" \| "blocked" \| "handoff-required"/);
  assert.match(contractSource, /export interface CommandPlanExecution/);
  assert.match(contractSource, /export interface ExecuteCommandPlanRequest/);
  assert.match(contractSource, /readonly executions: readonly CommandPlanExecution\[\]/);
});

test("Command Center routes image requests and records approved execution results", async () => {
  const { CommandCenterManager } = await import(commandManagerModulePath);
  const manager = new CommandCenterManager();
  let state = manager.createPlan({ command: "Create an illustration of a calm local AI dashboard" });
  const plan = state.plans[0];
  assert.equal(plan.intent, "media-generation");
  assert.equal(plan.route, "media-generation");
  assert.equal(plan.risk, "low");
  assert.equal(plan.confidence >= 0.9, true);
  assert.deepEqual(plan.modelOrchestration.specialistRoles, ["image.generate", "image.verify"]);

  state = manager.reviewPlan({ planId: plan.id, decision: "approve", reviewNote: "Approved image test." });
  const approved = state.plans.find((candidate) => candidate.id === plan.id);
  assert.equal(approved?.status, "approved");
  state = manager.recordExecution(approved, "completed", "Created image preview.", "Local artifact only.", "artifacts/test.png");
  assert.equal(state.executions[0]?.status, "completed");
  assert.equal(state.executions[0]?.route, "media-generation");
});

test("Media manager creates local image workflow and preview artifacts for approved image plans", async () => {
  const { MediaManager } = await import(mediaManagerModulePath);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-media-"));
  const manager = new MediaManager(root);
  const state = manager.createImageGeneration({
    mode: "generate",
    prompt: "Create an illustration of a calm local AI dashboard"
  });
  const result = state.generationResults[0];
  assert.equal(result.status, "completed");
  assert.equal(fs.existsSync(result.workflowPath), true);
  assert.equal(fs.existsSync(result.previewPath), true);
  assert.match(result.detail, /no external generation call was made/);
});

test("Main and preload expose a separate instruction window and approved execution IPC only", () => {
  assert.match(mainSource, /let instructionWindow: BrowserWindow \| null = null/);
  assert.match(mainSource, /function createInstructionWindow\(\): BrowserWindow/);
  assert.match(mainSource, /loadFile\(join\(currentDir, "\.\.", "renderer", "index\.html"\), \{ hash: "instruction" \}\)/);
  assert.match(mainSource, /studio:openInstructionWindow/);
  assert.match(mainSource, /studio:executeCommandPlan/);
  assert.match(mainSource, /plan\.route === "media-generation"/);
  assert.match(mainSource, /handoff-required/);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
  assert.match(preloadSource, /openInstructionWindow/);
  assert.match(preloadSource, /executeCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
});

test("Renderer provides focused instruction workflow with approve-and-run behavior", () => {
  assert.match(rendererSource, /window\.location\.hash === "#instruction"/);
  assert.match(rendererSource, /className="instruction-shell"/);
  assert.match(rendererSource, /Hermes Instruction/);
  assert.match(rendererSource, /Approve And Run/);
  assert.match(rendererSource, /executeCommandPlan\(selectedCommandPlan\.id\)/);
  assert.match(rendererSource, /window\.hermesStudio\.openInstructionWindow/);
  assert.match(rendererSource, /await window\.hermesStudio\.executeCommandPlan\(\{ planId \}\)/);
  assert.match(rendererSource, /route: "media-generation"/);
  assert.match(styleSource, /\.instruction-shell/);
  assert.match(styleSource, /\.instruction-panel/);
});

test("Instruction window validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-instruction-window-execution.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux38.ps1"), true);
  assert.equal(pkg.scripts["test:instruction-window-execution"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-instruction-window-execution.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux38"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux38.ps1");
});
