import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type {
  AutomationActionKind,
  AutomationFileEventKind,
  AutomationScheduleRepeat,
  AutomationTriggerKind,
  BrowserEngine,
  ChatModelAssignment,
  ChatModelTeam,
  ComputerBounds,
  ComputerActiveTarget,
  ComputerActionRisk,
  ComputerActionVerificationRequest,
  AppAdapterActionKind,
  CreateCommandPlanRequest,
  ConfirmElevatedHelperSessionRequest,
  CreateInstallerManifestRequest,
  CreateAutomationRequest,
  CreateRestorePlanRequest,
  CreateAppAdapterPlanRequest,
  EvaluateKnowledgeRequest,
  ExecuteComputerActionRequest,
  ExecuteCommandPlanRequest,
  DisableAutomationRequest,
  GetComputerUiTreeRequest,
  GroundBrowserElementRequest,
  HighlightComputerElementRequest,
  IngestKnowledgeFilesRequest,
  InspectBrowserRequest,
  ImageGenerationMode,
  ImageGenerationRequest,
  ImportMediaAssetsRequest,
  ConvertTeachWorkflowToSkillRequest,
  CreateTeachReplayRequest,
  GenerateTeachWorkflowRequest,
  Milestone8ActiveAction,
  ModelLifecycleRequest,
  ProposeComputerActionRequest,
  ProposeMemoryCandidateRequest,
  ProposeSkillCandidateRequest,
  ProbeAppAdaptersRequest,
  PrepareElevatedHelperLaunchRequest,
  RevokeElevatedHelperSessionRequest,
  RouteModelRoleRequest,
  ReviewAppAdapterPlanRequest,
  ReviewAutomationRequest,
  ReviewBrowserGroundingRequest,
  ReviewCommandPlanRequest,
  ReviewComputerActionRequest,
  ReviewMemoryCandidateRequest,
  ReviewSkillCandidateRequest,
  ReviewTeachReplayRequest,
  ReviewTeachSkillCandidateRequest,
  RollbackSkillVersionRequest,
  RunModelBenchmarkRequest,
  SaveHermesConfigRequest,
  SaveKnowledgeBaseRequest,
  SaveStudioProfileRequest,
  SaveStudioProjectRequest,
  SampleVideoKeyframesRequest,
  SearchKnowledgeRequest,
  SelectMediaAssetRequest,
  SendChatMessageRequest,
  SimulateAutomationRequest,
  StartTeachSessionRequest,
  RecordTeachEventRequest,
  TeachEventKind,
  TeachSelector,
  ConfigureVoiceRequest,
  SetVoiceMicrophonePermissionRequest,
  SpeakVoiceRequest,
  StartVoiceCaptureRequest,
  StopVoiceCaptureRequest,
  SubmitVoiceUtteranceRequest,
  ValidateModelPlanRequest,
  VoiceCaptureMode,
  VoiceLanguage
} from "@hermes-local-ai/contracts";
import { AppAdapterManager } from "./app-adapter-manager.js";
import { AutomationManager } from "./automation-manager.js";
import { BrowserVisionManager } from "./browser-vision-manager.js";
import { ComputerObserveManager } from "./computer-observe-manager.js";
import { CommandCenterManager } from "./command-center-manager.js";
import { ElevatedHelperManager } from "./elevated-helper-manager.js";
import { HermesChatManager } from "./chat-manager.js";
import { KnowledgeRagManager } from "./knowledge-rag-manager.js";
import { LearningManager } from "./learning-manager.js";
import { MediaManager } from "./media-manager.js";
import { isModelRoleAlias, isPrivacyPreset, ModelFabricManager } from "./model-fabric-manager.js";
import { PackagingHardeningManager } from "./packaging-hardening-manager.js";
import { ProfileConfigManager } from "./profile-config-manager.js";
import { createStudioServiceDefinitions, StudioServiceSupervisor } from "./service-supervisor.js";
import { TeachModeManager } from "./teach-mode-manager.js";
import { VoiceManager } from "./voice-manager.js";
import { resolveWorkspaceRoot } from "./workspace-root.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolveWorkspaceRoot(currentDir);
const supervisor = new StudioServiceSupervisor(createStudioServiceDefinitions(appRoot), {
  logFilePath: join(appRoot, "artifacts", "milestone1", "studio-supervisor.log")
});
const commandCenterManager = new CommandCenterManager();
const profileConfigManager = new ProfileConfigManager(appRoot);
const modelFabricManager = new ModelFabricManager();
const chatManager = new HermesChatManager(appRoot, { modelLifecycle: modelFabricManager });
const knowledgeRagManager = new KnowledgeRagManager(appRoot);
const learningManager = new LearningManager(appRoot);
const computerObserveManager = new ComputerObserveManager(appRoot);
const browserVisionManager = new BrowserVisionManager(appRoot);
const voiceManager = new VoiceManager();
const mediaManager = new MediaManager(appRoot);
const teachModeManager = new TeachModeManager();
const appAdapterManager = new AppAdapterManager(appRoot);
const elevatedHelperManager = new ElevatedHelperManager(appRoot);
const automationManager = new AutomationManager(appRoot);
const packagingHardeningManager = new PackagingHardeningManager(appRoot);

let mainWindow: BrowserWindow | null = null;
let instructionWindow: BrowserWindow | null = null;
let shutdownStarted = false;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    title: "Hermes Local AI Studio",
    backgroundColor: "#f6f8fa",
    webPreferences: {
      preload: join(currentDir, "..", "preload", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.removeMenu();
  void window.loadFile(join(currentDir, "..", "renderer", "index.html"));
  return window;
}

function createInstructionWindow(): BrowserWindow {
  if (instructionWindow && !instructionWindow.isDestroyed()) {
    instructionWindow.focus();
    return instructionWindow;
  }

  const window = new BrowserWindow({
    width: 760,
    height: 640,
    minWidth: 620,
    minHeight: 520,
    title: "Hermes Instruction",
    backgroundColor: "#f6f8fa",
    webPreferences: {
      preload: join(currentDir, "..", "preload", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.removeMenu();
  window.on("closed", () => {
    instructionWindow = null;
  });
  instructionWindow = window;
  void window.loadFile(join(currentDir, "..", "renderer", "index.html"), { hash: "instruction" });
  return window;
}

function registerIpcHandlers(): void {
  ipcMain.handle("studio:getSnapshot", async () => supervisor.getSnapshot());
  ipcMain.handle("studio:startService", async (_event, serviceId: unknown) => {
    if (typeof serviceId !== "string") {
      throw new Error("Invalid service id.");
    }

    await supervisor.startService(serviceId);
    return supervisor.getSnapshot();
  });
  ipcMain.handle("studio:stopService", async (_event, serviceId: unknown) => {
    if (typeof serviceId !== "string") {
      throw new Error("Invalid service id.");
    }

    await supervisor.stopService(serviceId);
    return supervisor.getSnapshot();
  });
  ipcMain.handle("studio:shutdown", async () => {
    await supervisor.shutdown();
    app.quit();
  });
  ipcMain.handle("studio:getCommandCenterState", () => commandCenterManager.getState());
  ipcMain.handle("studio:openInstructionWindow", () => {
    createInstructionWindow();
    return true;
  });
  ipcMain.handle("studio:createCommandPlan", (_event, request: unknown) => {
    return commandCenterManager.createPlan(parseCreateCommandPlanRequest(request));
  });
  ipcMain.handle("studio:reviewCommandPlan", (_event, request: unknown) => {
    return commandCenterManager.reviewPlan(parseReviewCommandPlanRequest(request));
  });
  ipcMain.handle("studio:executeCommandPlan", (_event, request: unknown) => {
    const plan = commandCenterManager.getApprovedPlan(parseExecuteCommandPlanRequest(request));
    if (plan.route === "media-generation") {
      const state = mediaManager.createImageGeneration({
        mode: "generate",
        prompt: plan.command
      });
      const latest = state.generationResults[0] ?? null;
      return commandCenterManager.recordExecution(
        plan,
        "completed",
        "Created local image workflow and preview artifact.",
        latest?.detail ?? "Created local image generation artifacts.",
        latest?.previewPath ?? null
      );
    }
    if (plan.route === "computer-control" || plan.route === "app-adapters") {
      return commandCenterManager.recordExecution(
        plan,
        "handoff-required",
        "Prepared approved handoff; active OS actions still require broker-scoped execution.",
        "Plan approval does not bypass Windows broker schemas, secure desktop, credential, payment, destructive, or elevation safeguards.",
        null
      );
    }
    return commandCenterManager.recordExecution(
      plan,
      "handoff-required",
      "Prepared approved handoff for the target Studio workspace.",
      "This route needs workspace-specific parameters before automatic execution can proceed.",
      null
    );
  });
  ipcMain.handle("studio:getChatState", async () => chatManager.getState());
  ipcMain.handle("studio:sendChatMessage", async (_event, request: unknown) => {
    return chatManager.startRun(parseSendChatMessageRequest(request));
  });
  ipcMain.handle("studio:cancelChatRun", async (_event, runId: unknown) => {
    if (typeof runId !== "string") {
      throw new Error("Invalid chat run id.");
    }

    return chatManager.cancelRun(runId);
  });
  ipcMain.handle("studio:selectChatAttachments", async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          properties: ["openFile", "multiSelections"]
        })
      : await dialog.showOpenDialog({
          properties: ["openFile", "multiSelections"]
        });
    if (result.canceled) {
      return [];
    }

    return chatManager.registerAttachmentPaths(result.filePaths);
  });
  ipcMain.handle("studio:getProfileConfigState", async () => profileConfigManager.getState());
  ipcMain.handle("studio:getProfile", async (_event, profileId: unknown) => {
    if (typeof profileId !== "string") {
      throw new Error("Invalid profile id.");
    }

    return profileConfigManager.getProfile(profileId);
  });
  ipcMain.handle("studio:saveProfile", async (_event, request: unknown) => {
    return profileConfigManager.saveProfile(parseSaveProfileRequest(request));
  });
  ipcMain.handle("studio:saveProject", async (_event, request: unknown) => {
    return profileConfigManager.saveProject(parseSaveProjectRequest(request));
  });
  ipcMain.handle("studio:saveHermesConfig", async (_event, request: unknown) => {
    return profileConfigManager.saveHermesConfig(parseSaveHermesConfigRequest(request));
  });
  ipcMain.handle("studio:exportStudioBackup", async () => profileConfigManager.exportBackup());
  ipcMain.handle("studio:getModelFabricState", async () => modelFabricManager.getState());
  ipcMain.handle("studio:routeModelRole", async (_event, request: unknown) => {
    return modelFabricManager.routeRole(parseRouteModelRoleRequest(request));
  });
  ipcMain.handle("studio:modelLifecycle", async (_event, request: unknown) => {
    return modelFabricManager.lifecycle(parseModelLifecycleRequest(request));
  });
  ipcMain.handle("studio:runModelBenchmark", async (_event, request: unknown) => {
    return modelFabricManager.benchmark(parseRunModelBenchmarkRequest(request));
  });
  ipcMain.handle("studio:validateModelPlan", async (_event, request: unknown) => {
    return modelFabricManager.validatePlan(parseValidateModelPlanRequest(request));
  });
  ipcMain.handle("studio:getKnowledgeState", async () => knowledgeRagManager.getState());
  ipcMain.handle("studio:saveKnowledgeBase", async (_event, request: unknown) => {
    return knowledgeRagManager.saveBase(parseSaveKnowledgeBaseRequest(request));
  });
  ipcMain.handle("studio:ingestKnowledgeFiles", async (_event, request: unknown) => {
    return knowledgeRagManager.ingestFiles(parseIngestKnowledgeFilesRequest(request));
  });
  ipcMain.handle("studio:selectKnowledgeFiles", async (_event, baseId: unknown) => {
    if (typeof baseId !== "string") {
      throw new Error("Invalid knowledge base id.");
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          properties: ["openFile", "multiSelections"]
        })
      : await dialog.showOpenDialog({
          properties: ["openFile", "multiSelections"]
        });
    if (result.canceled) {
      return {
        baseId,
        accepted: [],
        rejected: []
      };
    }
    return knowledgeRagManager.ingestFiles({ baseId, filePaths: result.filePaths });
  });
  ipcMain.handle("studio:searchKnowledge", async (_event, request: unknown) => {
    return knowledgeRagManager.search(parseSearchKnowledgeRequest(request));
  });
  ipcMain.handle("studio:evaluateKnowledge", async (_event, request: unknown) => {
    return knowledgeRagManager.evaluate(parseEvaluateKnowledgeRequest(request));
  });
  ipcMain.handle("studio:getLearningState", async () => learningManager.getState());
  ipcMain.handle("studio:proposeMemoryCandidate", async (_event, request: unknown) => {
    return learningManager.proposeMemory(parseProposeMemoryCandidateRequest(request));
  });
  ipcMain.handle("studio:reviewMemoryCandidate", async (_event, request: unknown) => {
    return learningManager.reviewMemory(parseReviewMemoryCandidateRequest(request));
  });
  ipcMain.handle("studio:proposeSkillCandidate", async (_event, request: unknown) => {
    return learningManager.proposeSkill(parseProposeSkillCandidateRequest(request));
  });
  ipcMain.handle("studio:reviewSkillCandidate", async (_event, request: unknown) => {
    return learningManager.reviewSkill(parseReviewSkillCandidateRequest(request));
  });
  ipcMain.handle("studio:rollbackSkillVersion", async (_event, request: unknown) => {
    return learningManager.rollbackSkill(parseRollbackSkillVersionRequest(request));
  });
  ipcMain.handle("studio:getComputerState", async () => computerObserveManager.getState());
  ipcMain.handle("studio:listComputerWindows", async () => computerObserveManager.listWindows());
  ipcMain.handle("studio:getComputerUiTree", async (_event, request: unknown) => {
    return computerObserveManager.getUiTree(parseGetComputerUiTreeRequest(request));
  });
  ipcMain.handle("studio:captureComputerScreen", async () => computerObserveManager.captureScreen());
  ipcMain.handle("studio:highlightComputerElement", async (_event, request: unknown) => {
    return computerObserveManager.highlightElement(parseHighlightComputerElementRequest(request));
  });
  ipcMain.handle("studio:proposeComputerAction", async (_event, request: unknown) => {
    return computerObserveManager.proposeAction(parseProposeComputerActionRequest(request));
  });
  ipcMain.handle("studio:reviewComputerAction", async (_event, request: unknown) => {
    return computerObserveManager.reviewAction(parseReviewComputerActionRequest(request));
  });
  ipcMain.handle("studio:executeComputerAction", async (_event, request: unknown) => {
    return computerObserveManager.executeAction(parseExecuteComputerActionRequest(request));
  });
  ipcMain.handle("studio:emergencyStopComputer", async () => computerObserveManager.emergencyStop());
  ipcMain.handle("studio:resetComputerEmergencyStop", async () => computerObserveManager.resetEmergencyStop());
  ipcMain.handle("studio:getBrowserVisionState", () => browserVisionManager.getState());
  ipcMain.handle("studio:inspectBrowser", async (_event, request: unknown) => {
    return browserVisionManager.inspect(parseInspectBrowserRequest(request));
  });
  ipcMain.handle("studio:groundBrowserElement", async (_event, request: unknown) => {
    return browserVisionManager.ground(parseGroundBrowserElementRequest(request));
  });
  ipcMain.handle("studio:reviewBrowserGrounding", (_event, request: unknown) => {
    return browserVisionManager.review(parseReviewBrowserGroundingRequest(request));
  });
  ipcMain.handle("studio:getVoiceState", () => voiceManager.getState());
  ipcMain.handle("studio:setVoiceMicrophonePermission", (_event, request: unknown) => {
    return voiceManager.setMicrophonePermission(parseSetVoiceMicrophonePermissionRequest(request));
  });
  ipcMain.handle("studio:configureVoice", (_event, request: unknown) => {
    return voiceManager.configure(parseConfigureVoiceRequest(request));
  });
  ipcMain.handle("studio:startVoiceCapture", (_event, request: unknown) => {
    return voiceManager.startCapture(parseStartVoiceCaptureRequest(request));
  });
  ipcMain.handle("studio:stopVoiceCapture", (_event, request: unknown) => {
    return voiceManager.stopCapture(parseStopVoiceCaptureRequest(request));
  });
  ipcMain.handle("studio:submitVoiceUtterance", (_event, request: unknown) => {
    return voiceManager.submitUtterance(parseSubmitVoiceUtteranceRequest(request));
  });
  ipcMain.handle("studio:speakVoice", (_event, request: unknown) => {
    return voiceManager.speak(parseSpeakVoiceRequest(request));
  });
  ipcMain.handle("studio:interruptVoice", (_event, reason: unknown) => {
    if (reason !== undefined && typeof reason !== "string") {
      throw new Error("Invalid voice interruption reason.");
    }
    return voiceManager.interrupt(reason);
  });
  ipcMain.handle("studio:runVoiceSelfTest", () => voiceManager.runSelfTest());
  ipcMain.handle("studio:getMediaState", () => mediaManager.getState());
  ipcMain.handle("studio:selectMediaFiles", async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          properties: ["openFile", "multiSelections"],
          filters: [
            { name: "Media", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "mp4", "mov", "mkv", "webm", "avi", "wav", "mp3", "m4a", "flac", "ogg"] }
          ]
        })
      : await dialog.showOpenDialog({
          properties: ["openFile", "multiSelections"],
          filters: [
            { name: "Media", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "mp4", "mov", "mkv", "webm", "avi", "wav", "mp3", "m4a", "flac", "ogg"] }
          ]
        });
    if (result.canceled) {
      return mediaManager.getState();
    }
    return mediaManager.importAssets({ filePaths: result.filePaths });
  });
  ipcMain.handle("studio:importMediaAssets", (_event, request: unknown) => {
    return mediaManager.importAssets(parseImportMediaAssetsRequest(request));
  });
  ipcMain.handle("studio:selectMediaAsset", (_event, request: unknown) => {
    return mediaManager.selectAsset(parseSelectMediaAssetRequest(request));
  });
  ipcMain.handle("studio:understandImage", (_event, request: unknown) => {
    return mediaManager.understandImage(parseMediaAssetRequest(request));
  });
  ipcMain.handle("studio:runImageOcr", (_event, request: unknown) => {
    return mediaManager.runOcr(parseMediaAssetRequest(request));
  });
  ipcMain.handle("studio:probeComfyUi", async () => mediaManager.probeComfyUi());
  ipcMain.handle("studio:createImageGeneration", (_event, request: unknown) => {
    return mediaManager.createImageGeneration(parseImageGenerationRequest(request));
  });
  ipcMain.handle("studio:probeVideo", (_event, request: unknown) => {
    return mediaManager.probeVideo(parseMediaAssetRequest(request));
  });
  ipcMain.handle("studio:extractVideoAudio", (_event, request: unknown) => {
    return mediaManager.extractAudio(parseMediaAssetRequest(request));
  });
  ipcMain.handle("studio:sampleVideoKeyframes", (_event, request: unknown) => {
    return mediaManager.sampleKeyframes(parseSampleVideoKeyframesRequest(request));
  });
  ipcMain.handle("studio:summarizeVideo", (_event, request: unknown) => {
    return mediaManager.summarizeVideo(parseMediaAssetRequest(request));
  });
  ipcMain.handle("studio:getTeachModeState", () => teachModeManager.getState());
  ipcMain.handle("studio:startTeachSession", (_event, request: unknown) => {
    return teachModeManager.startSession(parseStartTeachSessionRequest(request));
  });
  ipcMain.handle("studio:recordTeachEvent", (_event, request: unknown) => {
    return teachModeManager.recordEvent(parseRecordTeachEventRequest(request));
  });
  ipcMain.handle("studio:stopTeachSession", () => teachModeManager.stopSession());
  ipcMain.handle("studio:generateTeachWorkflow", (_event, request: unknown) => {
    return teachModeManager.generateWorkflow(parseGenerateTeachWorkflowRequest(request));
  });
  ipcMain.handle("studio:createTeachReplay", (_event, request: unknown) => {
    return teachModeManager.createReplay(parseCreateTeachReplayRequest(request));
  });
  ipcMain.handle("studio:reviewTeachReplay", (_event, request: unknown) => {
    return teachModeManager.reviewReplay(parseReviewTeachReplayRequest(request));
  });
  ipcMain.handle("studio:convertTeachWorkflowToSkill", (_event, request: unknown) => {
    return teachModeManager.convertToSkill(parseConvertTeachWorkflowToSkillRequest(request));
  });
  ipcMain.handle("studio:reviewTeachSkillCandidate", (_event, request: unknown) => {
    return teachModeManager.reviewSkillCandidate(parseReviewTeachSkillCandidateRequest(request));
  });
  ipcMain.handle("studio:getAppAdapterState", () => appAdapterManager.getState());
  ipcMain.handle("studio:probeAppAdapters", (_event, request: unknown) => {
    return appAdapterManager.probeAdapters(parseProbeAppAdaptersRequest(request));
  });
  ipcMain.handle("studio:createAppAdapterPlan", (_event, request: unknown) => {
    return appAdapterManager.createPlan(parseCreateAppAdapterPlanRequest(request));
  });
  ipcMain.handle("studio:reviewAppAdapterPlan", (_event, request: unknown) => {
    return appAdapterManager.reviewPlan(parseReviewAppAdapterPlanRequest(request));
  });
  ipcMain.handle("studio:getElevatedHelperState", () => elevatedHelperManager.getState());
  ipcMain.handle("studio:probeElevatedHelper", () => elevatedHelperManager.probeHelper());
  ipcMain.handle("studio:prepareElevatedHelperLaunch", (_event, request: unknown) => {
    return elevatedHelperManager.prepareLaunch(parsePrepareElevatedHelperLaunchRequest(request));
  });
  ipcMain.handle("studio:confirmElevatedHelperSession", (_event, request: unknown) => {
    return elevatedHelperManager.confirmSession(parseConfirmElevatedHelperSessionRequest(request));
  });
  ipcMain.handle("studio:revokeElevatedHelperSession", (_event, request: unknown) => {
    return elevatedHelperManager.revokeSession(parseRevokeElevatedHelperSessionRequest(request));
  });
  ipcMain.handle("studio:getAutomationState", () => automationManager.getState());
  ipcMain.handle("studio:createAutomation", (_event, request: unknown) => {
    return automationManager.createAutomation(parseCreateAutomationRequest(request));
  });
  ipcMain.handle("studio:reviewAutomation", (_event, request: unknown) => {
    return automationManager.reviewAutomation(parseReviewAutomationRequest(request));
  });
  ipcMain.handle("studio:simulateAutomation", (_event, request: unknown) => {
    return automationManager.simulateAutomation(parseSimulateAutomationRequest(request));
  });
  ipcMain.handle("studio:disableAutomation", (_event, request: unknown) => {
    return automationManager.disableAutomation(parseDisableAutomationRequest(request));
  });
  ipcMain.handle("studio:getPackagingHardeningState", async () => packagingHardeningManager.getState());
  ipcMain.handle("studio:inspectPackagingHardening", async () => packagingHardeningManager.inspectReadiness());
  ipcMain.handle("studio:createInstallerManifest", async (_event, request: unknown) => {
    return packagingHardeningManager.createInstallerManifest(parseCreateInstallerManifestRequest(request));
  });
  ipcMain.handle("studio:createRestorePlan", async (_event, request: unknown) => {
    return packagingHardeningManager.createRestorePlan(parseCreateRestorePlanRequest(request));
  });
}

app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event) => {
    event.preventDefault();
  });
});

app.on("before-quit", (event) => {
  if (shutdownStarted) {
    return;
  }

  event.preventDefault();
  shutdownStarted = true;
  void supervisor.shutdown().finally(() => {
    app.exit(0);
  });
});

registerIpcHandlers();

void app.whenReady().then(() => {
  mainWindow = createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  mainWindow = null;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

chatManager.onChatEvent((event) => {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("studio:chatEvent", event);
});

function parseSendChatMessageRequest(value: unknown): SendChatMessageRequest {
  if (!isRecord(value)) {
    throw new Error("Invalid chat request.");
  }

  const prompt = value.prompt;
  const profileId = value.profileId;
  const sessionId = value.sessionId;
  const attachmentIds = value.attachmentIds;
  const maxTurns = value.maxTurns;
  const modelTeam = value.modelTeam;
  if (typeof prompt !== "string" || typeof profileId !== "string") {
    throw new Error("Invalid chat request.");
  }
  if (sessionId !== null && typeof sessionId !== "string") {
    throw new Error("Invalid chat session id.");
  }
  if (!Array.isArray(attachmentIds) || !attachmentIds.every((id) => typeof id === "string")) {
    throw new Error("Invalid chat attachments.");
  }
  if (maxTurns !== undefined && (typeof maxTurns !== "number" || !Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 20)) {
    throw new Error("Invalid chat max turns.");
  }
  if (modelTeam !== undefined && !isChatModelTeamInput(modelTeam)) {
    throw new Error("Invalid chat model team.");
  }

  const request: SendChatMessageRequest = {
    prompt,
    profileId,
    sessionId,
    attachmentIds
  };
  return {
    ...request,
    ...(maxTurns === undefined ? {} : { maxTurns }),
    ...(modelTeam === undefined ? {} : { modelTeam })
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isChatModelTeamInput(value: unknown): value is ChatModelTeam {
  if (!isRecord(value) ||
    !isModelTaskProfileId(value.taskProfileId) ||
    typeof value.taskProfileLabel !== "string" ||
    !isPrivacyPreset(value.privacyPreset) ||
    !isModelRoleAlias(value.orchestratorRole) ||
    !Array.isArray(value.specialistRoles) ||
    !value.specialistRoles.every(isModelRoleAlias) ||
    !Array.isArray(value.assignments) ||
    !value.assignments.every(isChatModelAssignmentInput) ||
    typeof value.loadPlan !== "string" ||
    typeof value.unloadPlan !== "string" ||
    typeof value.memoryPlan !== "string" ||
    typeof value.confidenceFloor !== "number") {
    return false;
  }

  return value.taskProfileLabel.length <= 80 &&
    value.specialistRoles.length <= 8 &&
    value.assignments.length <= 12 &&
    value.loadPlan.length <= 1000 &&
    value.unloadPlan.length <= 1000 &&
    value.memoryPlan.length <= 1000 &&
    value.confidenceFloor >= 0 &&
    value.confidenceFloor <= 1;
}

function isChatModelAssignmentInput(value: unknown): value is ChatModelAssignment {
  return isRecord(value) &&
    isModelRoleAlias(value.role) &&
    (value.modelId === null || typeof value.modelId === "string") &&
    (value.model === null || typeof value.model === "string") &&
    (value.label === null || typeof value.label === "string") &&
    (value.providerId === null || typeof value.providerId === "string") &&
    (value.providerLabel === null || typeof value.providerLabel === "string") &&
    (value.lifecycle === null || isModelLifecycleClass(value.lifecycle)) &&
    typeof value.installed === "boolean" &&
    typeof value.loaded === "boolean" &&
    typeof value.reason === "string" &&
    (value.modelId === null || value.modelId.length <= 160) &&
    (value.model === null || value.model.length <= 120) &&
    (value.label === null || value.label.length <= 120) &&
    (value.providerId === null || value.providerId.length <= 80) &&
    (value.providerLabel === null || value.providerLabel.length <= 120) &&
    value.reason.length <= 1000;
}

function isModelTaskProfileId(value: unknown): value is ChatModelTeam["taskProfileId"] {
  return value === "computer-control" ||
    value === "knowledge-research" ||
    value === "code-change" ||
    value === "creative-media" ||
    value === "conversation";
}

function isModelLifecycleClass(value: unknown): value is NonNullable<ChatModelAssignment["lifecycle"]> {
  return value === "pinned" ||
    value === "warm" ||
    value === "on-demand" ||
    value === "batch" ||
    value === "exclusive";
}

function parseCreateCommandPlanRequest(value: unknown): CreateCommandPlanRequest {
  if (!isRecord(value) || typeof value.command !== "string") {
    throw new Error("Invalid command plan request.");
  }
  if (value.context !== undefined && typeof value.context !== "string") {
    throw new Error("Invalid command plan context.");
  }
  return {
    command: value.command,
    ...(value.context === undefined ? {} : { context: value.context })
  };
}

function parseReviewCommandPlanRequest(value: unknown): ReviewCommandPlanRequest {
  if (!isRecord(value) || typeof value.planId !== "string" || (value.decision !== "approve" && value.decision !== "reject")) {
    throw new Error("Invalid command plan review.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid command plan review note.");
  }
  return {
    planId: value.planId,
    decision: value.decision,
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote })
  };
}

function parseExecuteCommandPlanRequest(value: unknown): ExecuteCommandPlanRequest {
  if (!isRecord(value) || typeof value.planId !== "string") {
    throw new Error("Invalid command plan execution request.");
  }

  return {
    planId: value.planId
  };
}

function parseSaveProfileRequest(value: unknown): SaveStudioProfileRequest {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string" || !isRecord(value.files)) {
    throw new Error("Invalid profile request.");
  }

  const soul = value.files["SOUL.md"];
  const user = value.files["USER.md"];
  const memory = value.files["MEMORY.md"];
  if (typeof soul !== "string" || typeof user !== "string" || typeof memory !== "string") {
    throw new Error("Invalid profile files.");
  }

  return {
    id: value.id,
    label: value.label,
    files: {
      "SOUL.md": soul,
      "USER.md": user,
      "MEMORY.md": memory
    }
  };
}

function parseSaveProjectRequest(value: unknown): SaveStudioProjectRequest {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.rootPath !== "string" ||
    typeof value.profileId !== "string"
  ) {
    throw new Error("Invalid project request.");
  }

  return {
    id: value.id,
    label: value.label,
    rootPath: value.rootPath,
    profileId: value.profileId
  };
}

function parseSaveHermesConfigRequest(value: unknown): SaveHermesConfigRequest {
  if (!isRecord(value) || typeof value.text !== "string") {
    throw new Error("Invalid Hermes config request.");
  }

  return {
    text: value.text
  };
}

function parseRouteModelRoleRequest(value: unknown): RouteModelRoleRequest {
  if (!isRecord(value) || !isModelRoleAlias(value.role) || !isPrivacyPreset(value.privacyPreset)) {
    throw new Error("Invalid model route request.");
  }
  if (value.overrideModelId !== null && typeof value.overrideModelId !== "string") {
    throw new Error("Invalid model override.");
  }

  return {
    role: value.role,
    privacyPreset: value.privacyPreset,
    overrideModelId: value.overrideModelId
  };
}

function parseModelLifecycleRequest(value: unknown): ModelLifecycleRequest {
  if (!isRecord(value) || typeof value.modelId !== "string" || (value.action !== "load" && value.action !== "unload")) {
    throw new Error("Invalid model lifecycle request.");
  }
  if (value.keepAliveSeconds !== undefined && typeof value.keepAliveSeconds !== "number") {
    throw new Error("Invalid keep-alive seconds.");
  }

  return {
    modelId: value.modelId,
    action: value.action,
    ...(value.keepAliveSeconds === undefined ? {} : { keepAliveSeconds: value.keepAliveSeconds })
  };
}

function parseRunModelBenchmarkRequest(value: unknown): RunModelBenchmarkRequest {
  if (!isRecord(value) || typeof value.modelId !== "string" || !isModelRoleAlias(value.role)) {
    throw new Error("Invalid model benchmark request.");
  }
  if (value.prompt !== undefined && typeof value.prompt !== "string") {
    throw new Error("Invalid model benchmark prompt.");
  }

  return {
    modelId: value.modelId,
    role: value.role,
    ...(value.prompt === undefined ? {} : { prompt: value.prompt })
  };
}

function parseValidateModelPlanRequest(value: unknown): ValidateModelPlanRequest {
  if (!isRecord(value) || !isPrivacyPreset(value.privacyPreset)) {
    throw new Error("Invalid model plan validation request.");
  }

  return {
    plan: value.plan,
    privacyPreset: value.privacyPreset
  };
}

function parseSaveKnowledgeBaseRequest(value: unknown): SaveKnowledgeBaseRequest {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    !isKnowledgeScope(value.scope) ||
    (value.ownerId !== null && typeof value.ownerId !== "string")
  ) {
    throw new Error("Invalid knowledge base request.");
  }

  return {
    id: value.id,
    label: value.label,
    scope: value.scope,
    ownerId: value.ownerId
  };
}

function parseIngestKnowledgeFilesRequest(value: unknown): IngestKnowledgeFilesRequest {
  if (!isRecord(value) || typeof value.baseId !== "string" || !Array.isArray(value.filePaths)) {
    throw new Error("Invalid knowledge ingestion request.");
  }
  if (!value.filePaths.every((filePath) => typeof filePath === "string")) {
    throw new Error("Invalid knowledge ingestion file paths.");
  }

  return {
    baseId: value.baseId,
    filePaths: value.filePaths
  };
}

function parseSearchKnowledgeRequest(value: unknown): SearchKnowledgeRequest {
  if (!isRecord(value) || typeof value.baseId !== "string" || typeof value.query !== "string") {
    throw new Error("Invalid knowledge search request.");
  }
  if (value.limit !== undefined && typeof value.limit !== "number") {
    throw new Error("Invalid knowledge search limit.");
  }

  return {
    baseId: value.baseId,
    query: value.query,
    ...(value.limit === undefined ? {} : { limit: value.limit })
  };
}

function parseEvaluateKnowledgeRequest(value: unknown): EvaluateKnowledgeRequest {
  if (!isRecord(value) || typeof value.baseId !== "string" || !Array.isArray(value.questions)) {
    throw new Error("Invalid knowledge evaluation request.");
  }
  const questions = value.questions.map((question) => {
    if (!isRecord(question) || typeof question.id !== "string" || typeof question.question !== "string") {
      throw new Error("Invalid knowledge evaluation question.");
    }
    if (question.expectedDocumentName !== undefined && typeof question.expectedDocumentName !== "string") {
      throw new Error("Invalid expected document name.");
    }
    if (question.expectedSnippet !== undefined && typeof question.expectedSnippet !== "string") {
      throw new Error("Invalid expected snippet.");
    }
    return {
      id: question.id,
      question: question.question,
      ...(question.expectedDocumentName === undefined ? {} : { expectedDocumentName: question.expectedDocumentName }),
      ...(question.expectedSnippet === undefined ? {} : { expectedSnippet: question.expectedSnippet })
    };
  });

  return {
    baseId: value.baseId,
    questions
  };
}

function isKnowledgeScope(value: unknown): value is SaveKnowledgeBaseRequest["scope"] {
  return value === "global" || value === "profile" || value === "project" || value === "session";
}

function parseProposeMemoryCandidateRequest(value: unknown): ProposeMemoryCandidateRequest {
  if (
    !isRecord(value) ||
    !isLearningScope(value.scope) ||
    typeof value.content !== "string" ||
    typeof value.confidence !== "number" ||
    !isLearningProvenanceInput(value.provenance)
  ) {
    throw new Error("Invalid memory candidate request.");
  }

  return {
    scope: value.scope,
    content: value.content,
    confidence: value.confidence,
    provenance: value.provenance
  };
}

function parseReviewMemoryCandidateRequest(value: unknown): ReviewMemoryCandidateRequest {
  if (!isRecord(value) || typeof value.candidateId !== "string" || !isLearningReviewDecision(value.decision)) {
    throw new Error("Invalid memory review request.");
  }
  if (value.editedContent !== undefined && typeof value.editedContent !== "string") {
    throw new Error("Invalid edited memory content.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid memory review note.");
  }
  if (value.expiresAt !== undefined && value.expiresAt !== null && typeof value.expiresAt !== "string") {
    throw new Error("Invalid memory expiration.");
  }

  return {
    candidateId: value.candidateId,
    decision: value.decision,
    ...(value.editedContent === undefined ? {} : { editedContent: value.editedContent }),
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote }),
    ...(value.expiresAt === undefined ? {} : { expiresAt: value.expiresAt })
  };
}

function parseProposeSkillCandidateRequest(value: unknown): ProposeSkillCandidateRequest {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.summary !== "string" ||
    typeof value.body !== "string" ||
    !isLearningProvenanceInput(value.provenance)
  ) {
    throw new Error("Invalid skill candidate request.");
  }

  return {
    name: value.name,
    summary: value.summary,
    body: value.body,
    provenance: value.provenance
  };
}

function parseReviewSkillCandidateRequest(value: unknown): ReviewSkillCandidateRequest {
  if (!isRecord(value) || typeof value.candidateId !== "string" || !isLearningReviewDecision(value.decision)) {
    throw new Error("Invalid skill review request.");
  }
  if (value.editedBody !== undefined && typeof value.editedBody !== "string") {
    throw new Error("Invalid edited skill body.");
  }
  if (value.editedSummary !== undefined && typeof value.editedSummary !== "string") {
    throw new Error("Invalid edited skill summary.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid skill review note.");
  }

  return {
    candidateId: value.candidateId,
    decision: value.decision,
    ...(value.editedBody === undefined ? {} : { editedBody: value.editedBody }),
    ...(value.editedSummary === undefined ? {} : { editedSummary: value.editedSummary }),
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote })
  };
}

function parseRollbackSkillVersionRequest(value: unknown): RollbackSkillVersionRequest {
  if (!isRecord(value) || typeof value.skillId !== "string" || typeof value.version !== "number") {
    throw new Error("Invalid skill rollback request.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid skill rollback note.");
  }

  return {
    skillId: value.skillId,
    version: value.version,
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote })
  };
}

function isLearningScope(value: unknown): value is ProposeMemoryCandidateRequest["scope"] {
  return value === "user" || value === "profile" || value === "project" || value === "session";
}

function isLearningSourceKind(value: unknown): value is ProposeMemoryCandidateRequest["provenance"]["sourceKind"] {
  return value === "chat" || value === "task" || value === "manual" || value === "knowledge" || value === "workflow";
}

function isLearningReviewDecision(value: unknown): value is ReviewMemoryCandidateRequest["decision"] {
  return value === "approve" || value === "reject";
}

function isLearningProvenanceInput(value: unknown): value is ProposeMemoryCandidateRequest["provenance"] {
  return isRecord(value) &&
    isLearningSourceKind(value.sourceKind) &&
    (value.sourceId === null || typeof value.sourceId === "string") &&
    (value.profileId === null || typeof value.profileId === "string") &&
    (value.projectId === null || typeof value.projectId === "string") &&
    typeof value.note === "string";
}

function parseGetComputerUiTreeRequest(value: unknown): GetComputerUiTreeRequest {
  if (!isRecord(value) || (value.windowHandle !== null && typeof value.windowHandle !== "number")) {
    throw new Error("Invalid computer UI tree request.");
  }
  if (typeof value.windowHandle === "number" && (!Number.isInteger(value.windowHandle) || value.windowHandle < 0)) {
    throw new Error("Invalid computer window handle.");
  }
  if (value.maxDepth !== undefined && (typeof value.maxDepth !== "number" || !Number.isInteger(value.maxDepth))) {
    throw new Error("Invalid computer tree depth.");
  }
  if (value.maxNodes !== undefined && (typeof value.maxNodes !== "number" || !Number.isInteger(value.maxNodes))) {
    throw new Error("Invalid computer tree node limit.");
  }

  return {
    windowHandle: value.windowHandle,
    ...(value.maxDepth === undefined ? {} : { maxDepth: value.maxDepth }),
    ...(value.maxNodes === undefined ? {} : { maxNodes: value.maxNodes })
  };
}

function parseHighlightComputerElementRequest(value: unknown): HighlightComputerElementRequest {
  if (!isRecord(value) || !isComputerBounds(value.bounds)) {
    throw new Error("Invalid computer highlight request.");
  }

  return {
    bounds: value.bounds
  };
}

function parseProposeComputerActionRequest(value: unknown): ProposeComputerActionRequest {
  if (
    !isRecord(value) ||
    !isMilestone8ActiveAction(value.action) ||
    !isComputerActionRisk(value.risk) ||
    typeof value.expectedResult !== "string" ||
    !isComputerVerificationRequest(value.verification)
  ) {
    throw new Error("Invalid computer action proposal.");
  }
  const target = parseComputerActiveTarget(value.target);
  if (value.text !== undefined && typeof value.text !== "string") {
    throw new Error("Invalid computer action text.");
  }
  if (value.chord !== undefined && typeof value.chord !== "string") {
    throw new Error("Invalid computer action chord.");
  }

  return {
    action: value.action,
    target,
    risk: value.risk,
    expectedResult: value.expectedResult,
    verification: value.verification,
    ...(value.text === undefined ? {} : { text: value.text }),
    ...(value.chord === undefined ? {} : { chord: value.chord })
  };
}

function parseReviewComputerActionRequest(value: unknown): ReviewComputerActionRequest {
  if (!isRecord(value) || typeof value.actionId !== "string" || (value.decision !== "approve" && value.decision !== "reject")) {
    throw new Error("Invalid computer action review.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid computer action review note.");
  }

  return {
    actionId: value.actionId,
    decision: value.decision,
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote })
  };
}

function parseExecuteComputerActionRequest(value: unknown): ExecuteComputerActionRequest {
  if (!isRecord(value) || typeof value.actionId !== "string") {
    throw new Error("Invalid computer action execution request.");
  }

  return {
    actionId: value.actionId
  };
}

function parseComputerActiveTarget(value: unknown): ComputerActiveTarget {
  if (!isRecord(value) || (value.windowHandle !== null && typeof value.windowHandle !== "number")) {
    throw new Error("Invalid computer action target.");
  }
  if (typeof value.windowHandle === "number" && (!Number.isInteger(value.windowHandle) || value.windowHandle < 0)) {
    throw new Error("Invalid computer action target window.");
  }
  if (value.automationId !== undefined && value.automationId !== null && typeof value.automationId !== "string") {
    throw new Error("Invalid computer action target automation id.");
  }
  if (value.name !== undefined && value.name !== null && typeof value.name !== "string") {
    throw new Error("Invalid computer action target name.");
  }
  if (value.controlType !== undefined && value.controlType !== null && typeof value.controlType !== "string") {
    throw new Error("Invalid computer action target control type.");
  }
  if (value.bounds !== undefined && value.bounds !== null && !isComputerBounds(value.bounds)) {
    throw new Error("Invalid computer action target bounds.");
  }

  return {
    windowHandle: value.windowHandle,
    ...(value.automationId === undefined || value.automationId === null ? {} : { automationId: value.automationId }),
    ...(value.name === undefined || value.name === null ? {} : { name: value.name }),
    ...(value.controlType === undefined || value.controlType === null ? {} : { controlType: value.controlType }),
    ...(value.bounds === undefined || value.bounds === null ? {} : { bounds: value.bounds })
  };
}

function isMilestone8ActiveAction(value: unknown): value is Milestone8ActiveAction {
  return value === "ui.invoke" ||
    value === "ui.set_value" ||
    value === "ui.select" ||
    value === "ui.toggle" ||
    value === "keyboard.type" ||
    value === "keyboard.chord" ||
    value === "mouse.click";
}

function isComputerActionRisk(value: unknown): value is ComputerActionRisk {
  return value === "low" || value === "medium" || value === "high";
}

function isComputerVerificationRequest(value: unknown): value is ComputerActionVerificationRequest {
  if (!isRecord(value) || (value.kind !== "manual" && value.kind !== "ui-tree-contains" && value.kind !== "screenshot")) {
    return false;
  }
  return value.expectedText === undefined || typeof value.expectedText === "string";
}

function parseInspectBrowserRequest(value: unknown): InspectBrowserRequest {
  if (!isRecord(value) || !isBrowserEngine(value.engine)) {
    throw new Error("Invalid browser inspection request.");
  }

  return {
    engine: value.engine
  };
}

function parseGroundBrowserElementRequest(value: unknown): GroundBrowserElementRequest {
  if (!isRecord(value) || !isBrowserEngine(value.engine) || typeof value.query !== "string") {
    throw new Error("Invalid browser grounding request.");
  }

  return {
    engine: value.engine,
    query: value.query
  };
}

function parseReviewBrowserGroundingRequest(value: unknown): ReviewBrowserGroundingRequest {
  if (!isRecord(value) || typeof value.approvalId !== "string" || (value.decision !== "approve" && value.decision !== "reject")) {
    throw new Error("Invalid browser grounding review.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid browser grounding review note.");
  }

  return {
    approvalId: value.approvalId,
    decision: value.decision,
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote })
  };
}

function isBrowserEngine(value: unknown): value is BrowserEngine {
  return value === "edge" || value === "chrome";
}

function parseSetVoiceMicrophonePermissionRequest(value: unknown): SetVoiceMicrophonePermissionRequest {
  if (!isRecord(value) || (value.permission !== "granted" && value.permission !== "denied")) {
    throw new Error("Invalid voice microphone permission request.");
  }
  if (value.deviceLabel !== undefined && value.deviceLabel !== null && typeof value.deviceLabel !== "string") {
    throw new Error("Invalid voice microphone label.");
  }

  return {
    permission: value.permission,
    ...(value.deviceLabel === undefined ? {} : { deviceLabel: value.deviceLabel })
  };
}

function parseConfigureVoiceRequest(value: unknown): ConfigureVoiceRequest {
  if (!isRecord(value) || typeof value.wakeWordEnabled !== "boolean") {
    throw new Error("Invalid voice configuration request.");
  }
  if (value.wakeWord !== undefined && typeof value.wakeWord !== "string") {
    throw new Error("Invalid voice wake word.");
  }

  return {
    wakeWordEnabled: value.wakeWordEnabled,
    ...(value.wakeWord === undefined ? {} : { wakeWord: value.wakeWord })
  };
}

function parseStartVoiceCaptureRequest(value: unknown): StartVoiceCaptureRequest {
  if (!isRecord(value) || !isVoiceCaptureMode(value.mode) || !isVoiceLanguage(value.language)) {
    throw new Error("Invalid voice capture request.");
  }

  return {
    mode: value.mode,
    language: value.language
  };
}

function parseStopVoiceCaptureRequest(value: unknown): StopVoiceCaptureRequest {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error("Invalid voice stop request.");
  }
  if (value.reason !== undefined && typeof value.reason !== "string") {
    throw new Error("Invalid voice stop reason.");
  }

  return {
    ...(value.reason === undefined ? {} : { reason: value.reason })
  };
}

function parseSubmitVoiceUtteranceRequest(value: unknown): SubmitVoiceUtteranceRequest {
  if (
    !isRecord(value) ||
    typeof value.text !== "string" ||
    !isVoiceLanguage(value.language) ||
    typeof value.rms !== "number" ||
    typeof value.durationMs !== "number"
  ) {
    throw new Error("Invalid voice utterance request.");
  }
  if (value.sessionId !== undefined && value.sessionId !== null && typeof value.sessionId !== "string") {
    throw new Error("Invalid voice session id.");
  }

  return {
    text: value.text,
    language: value.language,
    rms: value.rms,
    durationMs: value.durationMs,
    ...(value.sessionId === undefined ? {} : { sessionId: value.sessionId })
  };
}

function parseSpeakVoiceRequest(value: unknown): SpeakVoiceRequest {
  if (!isRecord(value) || typeof value.text !== "string" || !isVoiceLanguage(value.language)) {
    throw new Error("Invalid voice speech request.");
  }

  return {
    text: value.text,
    language: value.language
  };
}

function isVoiceCaptureMode(value: unknown): value is VoiceCaptureMode {
  return value === "push-to-talk" || value === "wake-word";
}

function isVoiceLanguage(value: unknown): value is VoiceLanguage {
  return value === "en" || value === "th";
}

function parseImportMediaAssetsRequest(value: unknown): ImportMediaAssetsRequest {
  if (!isRecord(value) || !Array.isArray(value.filePaths) || !value.filePaths.every((filePath) => typeof filePath === "string")) {
    throw new Error("Invalid media import request.");
  }

  return {
    filePaths: value.filePaths
  };
}

function parseSelectMediaAssetRequest(value: unknown): SelectMediaAssetRequest {
  if (!isRecord(value) || typeof value.assetId !== "string") {
    throw new Error("Invalid media asset selection request.");
  }

  return {
    assetId: value.assetId
  };
}

function parseMediaAssetRequest(value: unknown): SelectMediaAssetRequest {
  return parseSelectMediaAssetRequest(value);
}

function parseImageGenerationRequest(value: unknown): ImageGenerationRequest {
  if (!isRecord(value) || !isImageGenerationMode(value.mode) || typeof value.prompt !== "string") {
    throw new Error("Invalid image generation request.");
  }
  if (value.sourceAssetId !== undefined && value.sourceAssetId !== null && typeof value.sourceAssetId !== "string") {
    throw new Error("Invalid image generation source asset.");
  }

  return {
    mode: value.mode,
    prompt: value.prompt,
    ...(value.sourceAssetId === undefined ? {} : { sourceAssetId: value.sourceAssetId })
  };
}

function parseSampleVideoKeyframesRequest(value: unknown): SampleVideoKeyframesRequest {
  if (!isRecord(value) || typeof value.assetId !== "string" || typeof value.count !== "number") {
    throw new Error("Invalid video keyframe request.");
  }

  return {
    assetId: value.assetId,
    count: value.count
  };
}

function isImageGenerationMode(value: unknown): value is ImageGenerationMode {
  return value === "generate" || value === "edit";
}

function parseStartTeachSessionRequest(value: unknown): StartTeachSessionRequest {
  if (!isRecord(value) || typeof value.name !== "string") {
    throw new Error("Invalid Teach Mode session request.");
  }

  return {
    name: value.name
  };
}

function parseRecordTeachEventRequest(value: unknown): RecordTeachEventRequest {
  if (!isRecord(value) || !isTeachEventKind(value.kind) || !isRecord(value.selector)) {
    throw new Error("Invalid Teach Mode event request.");
  }
  if (value.text !== undefined && value.text !== null && typeof value.text !== "string") {
    throw new Error("Invalid Teach Mode event text.");
  }
  if (value.filePath !== undefined && value.filePath !== null && typeof value.filePath !== "string") {
    throw new Error("Invalid Teach Mode file path.");
  }
  if (value.screenshotPath !== undefined && value.screenshotPath !== null && typeof value.screenshotPath !== "string") {
    throw new Error("Invalid Teach Mode screenshot path.");
  }
  if (value.waitCondition !== undefined && value.waitCondition !== null && typeof value.waitCondition !== "string") {
    throw new Error("Invalid Teach Mode wait condition.");
  }
  if (value.note !== undefined && typeof value.note !== "string") {
    throw new Error("Invalid Teach Mode note.");
  }

  return {
    kind: value.kind,
    selector: parseTeachSelector(value.selector),
    ...(value.text === undefined ? {} : { text: value.text }),
    ...(value.filePath === undefined ? {} : { filePath: value.filePath }),
    ...(value.screenshotPath === undefined ? {} : { screenshotPath: value.screenshotPath }),
    ...(value.waitCondition === undefined ? {} : { waitCondition: value.waitCondition }),
    ...(value.note === undefined ? {} : { note: value.note })
  };
}

function parseGenerateTeachWorkflowRequest(value: unknown): GenerateTeachWorkflowRequest {
  if (!isRecord(value) || typeof value.sessionId !== "string") {
    throw new Error("Invalid Teach Mode workflow request.");
  }
  if (value.name !== undefined && typeof value.name !== "string") {
    throw new Error("Invalid Teach Mode workflow name.");
  }

  return {
    sessionId: value.sessionId,
    ...(value.name === undefined ? {} : { name: value.name })
  };
}

function parseCreateTeachReplayRequest(value: unknown): CreateTeachReplayRequest {
  if (!isRecord(value) || typeof value.workflowId !== "string") {
    throw new Error("Invalid Teach Mode replay request.");
  }

  return {
    workflowId: value.workflowId
  };
}

function parseReviewTeachReplayRequest(value: unknown): ReviewTeachReplayRequest {
  if (!isRecord(value) || typeof value.replayId !== "string" || (value.decision !== "approve" && value.decision !== "reject")) {
    throw new Error("Invalid Teach Mode replay review.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid Teach Mode replay review note.");
  }

  return {
    replayId: value.replayId,
    decision: value.decision,
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote })
  };
}

function parseConvertTeachWorkflowToSkillRequest(value: unknown): ConvertTeachWorkflowToSkillRequest {
  if (!isRecord(value) || typeof value.workflowId !== "string") {
    throw new Error("Invalid Teach Mode skill conversion request.");
  }

  return {
    workflowId: value.workflowId
  };
}

function parseReviewTeachSkillCandidateRequest(value: unknown): ReviewTeachSkillCandidateRequest {
  if (!isRecord(value) || typeof value.candidateId !== "string" || (value.decision !== "approve" && value.decision !== "reject")) {
    throw new Error("Invalid Teach Mode skill candidate review.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid Teach Mode skill review note.");
  }

  return {
    candidateId: value.candidateId,
    decision: value.decision,
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote })
  };
}

function parseTeachSelector(value: Record<string, unknown>): TeachSelector {
  if (
    (value.appProcess !== undefined && value.appProcess !== null && typeof value.appProcess !== "string") ||
    (value.windowTitle !== undefined && value.windowTitle !== null && typeof value.windowTitle !== "string") ||
    (value.automationId !== undefined && value.automationId !== null && typeof value.automationId !== "string") ||
    (value.name !== undefined && value.name !== null && typeof value.name !== "string") ||
    (value.controlType !== undefined && value.controlType !== null && typeof value.controlType !== "string") ||
    (value.bounds !== undefined && value.bounds !== null && !isComputerBounds(value.bounds)) ||
    (value.semanticPath !== undefined && !Array.isArray(value.semanticPath))
  ) {
    throw new Error("Invalid Teach Mode selector.");
  }
  const semanticPath = value.semanticPath === undefined
    ? []
    : value.semanticPath.map((part) => {
        if (typeof part !== "string") {
          throw new Error("Invalid Teach Mode semantic path.");
        }
        return part;
      });

  return {
    appProcess: typeof value.appProcess === "string" ? value.appProcess : null,
    windowTitle: typeof value.windowTitle === "string" ? value.windowTitle : null,
    automationId: typeof value.automationId === "string" ? value.automationId : null,
    name: typeof value.name === "string" ? value.name : null,
    controlType: typeof value.controlType === "string" ? value.controlType : null,
    bounds: value.bounds === undefined || value.bounds === null ? null : value.bounds,
    semanticPath
  };
}

function isTeachEventKind(value: unknown): value is TeachEventKind {
  return value === "app.focus" ||
    value === "window.observe" ||
    value === "ui.invoke" ||
    value === "ui.set_value" ||
    value === "keyboard.input" ||
    value === "mouse.click" ||
    value === "clipboard.read" ||
    value === "file.opened" ||
    value === "file.created" ||
    value === "wait.condition" ||
    value === "screenshot.capture" ||
    value === "final.state";
}

function parseProbeAppAdaptersRequest(value: unknown): ProbeAppAdaptersRequest {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error("Invalid app adapter probe request.");
  }
  if (value.adapterIds === undefined) {
    return {};
  }
  if (!Array.isArray(value.adapterIds) || !value.adapterIds.every((adapterId) => typeof adapterId === "string")) {
    throw new Error("Invalid app adapter ids.");
  }

  return {
    adapterIds: value.adapterIds
  };
}

function parseCreateAppAdapterPlanRequest(value: unknown): CreateAppAdapterPlanRequest {
  if (
    !isRecord(value) ||
    typeof value.adapterId !== "string" ||
    !isAppAdapterActionKind(value.action) ||
    typeof value.target !== "string" ||
    typeof value.intent !== "string" ||
    !Array.isArray(value.context)
  ) {
    throw new Error("Invalid app adapter plan request.");
  }

  const context = value.context.map((entry) => {
    if (!isRecord(entry) || typeof entry.key !== "string" || typeof entry.value !== "string") {
      throw new Error("Invalid app adapter context.");
    }
    return {
      key: entry.key,
      value: entry.value
    };
  });

  return {
    adapterId: value.adapterId,
    action: value.action,
    target: value.target,
    intent: value.intent,
    context
  };
}

function parseReviewAppAdapterPlanRequest(value: unknown): ReviewAppAdapterPlanRequest {
  if (!isRecord(value) || typeof value.planId !== "string" || (value.decision !== "approve" && value.decision !== "reject")) {
    throw new Error("Invalid app adapter plan review.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid app adapter review note.");
  }

  return {
    planId: value.planId,
    decision: value.decision,
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote })
  };
}

function isAppAdapterActionKind(value: unknown): value is AppAdapterActionKind {
  return value === "open-path" ||
    value === "focus-window" ||
    value === "inspect-context" ||
    value === "open-project" ||
    value === "run-command" ||
    value === "browser-inspect" ||
    value === "office-document-context" ||
    value === "generic-ui-tree" ||
    value === "bambu-placeholder";
}

function parsePrepareElevatedHelperLaunchRequest(value: unknown): PrepareElevatedHelperLaunchRequest {
  if (!isRecord(value) || typeof value.purpose !== "string" || typeof value.durationMinutes !== "number") {
    throw new Error("Invalid elevated helper launch request.");
  }
  if (!Number.isInteger(value.durationMinutes)) {
    throw new Error("Invalid elevated helper duration.");
  }

  return {
    purpose: value.purpose,
    durationMinutes: value.durationMinutes
  };
}

function parseConfirmElevatedHelperSessionRequest(value: unknown): ConfirmElevatedHelperSessionRequest {
  if (
    !isRecord(value) ||
    typeof value.sessionId !== "string" ||
    typeof value.approvalCode !== "string" ||
    typeof value.helperProcessId !== "number" ||
    typeof value.helperElevated !== "boolean"
  ) {
    throw new Error("Invalid elevated helper session confirmation.");
  }
  if (!Number.isInteger(value.helperProcessId)) {
    throw new Error("Invalid elevated helper process id.");
  }

  return {
    sessionId: value.sessionId,
    approvalCode: value.approvalCode,
    helperProcessId: value.helperProcessId,
    helperElevated: value.helperElevated
  };
}

function parseRevokeElevatedHelperSessionRequest(value: unknown): RevokeElevatedHelperSessionRequest {
  if (!isRecord(value) || typeof value.sessionId !== "string") {
    throw new Error("Invalid elevated helper revoke request.");
  }
  if (value.reason !== undefined && typeof value.reason !== "string") {
    throw new Error("Invalid elevated helper revoke reason.");
  }

  return {
    sessionId: value.sessionId,
    ...(value.reason === undefined ? {} : { reason: value.reason })
  };
}

function parseCreateAutomationRequest(value: unknown): CreateAutomationRequest {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.purpose !== "string" ||
    !isRecord(value.trigger) ||
    !isRecord(value.action) ||
    !isRecord(value.failurePolicy)
  ) {
    throw new Error("Invalid automation create request.");
  }

  return {
    name: value.name,
    purpose: value.purpose,
    trigger: parseAutomationTrigger(value.trigger),
    action: parseAutomationAction(value.action),
    failurePolicy: parseAutomationFailurePolicy(value.failurePolicy)
  };
}

function parseReviewAutomationRequest(value: unknown): ReviewAutomationRequest {
  if (!isRecord(value) || typeof value.automationId !== "string" || (value.decision !== "approve" && value.decision !== "reject")) {
    throw new Error("Invalid automation review request.");
  }
  if (value.reviewNote !== undefined && typeof value.reviewNote !== "string") {
    throw new Error("Invalid automation review note.");
  }
  return {
    automationId: value.automationId,
    decision: value.decision,
    ...(value.reviewNote === undefined ? {} : { reviewNote: value.reviewNote })
  };
}

function parseSimulateAutomationRequest(value: unknown): SimulateAutomationRequest {
  if (
    !isRecord(value) ||
    typeof value.automationId !== "string" ||
    !isAutomationTriggerKind(value.triggerKind) ||
    typeof value.desktopUnlocked !== "boolean"
  ) {
    throw new Error("Invalid automation simulation request.");
  }
  if (value.forceFailure !== undefined && typeof value.forceFailure !== "boolean") {
    throw new Error("Invalid automation forced failure flag.");
  }
  return {
    automationId: value.automationId,
    triggerKind: value.triggerKind,
    desktopUnlocked: value.desktopUnlocked,
    ...(value.forceFailure === undefined ? {} : { forceFailure: value.forceFailure })
  };
}

function parseDisableAutomationRequest(value: unknown): DisableAutomationRequest {
  if (!isRecord(value) || typeof value.automationId !== "string") {
    throw new Error("Invalid automation disable request.");
  }
  if (value.reason !== undefined && typeof value.reason !== "string") {
    throw new Error("Invalid automation disable reason.");
  }
  return {
    automationId: value.automationId,
    ...(value.reason === undefined ? {} : { reason: value.reason })
  };
}

function parseAutomationTrigger(value: Record<string, unknown>): CreateAutomationRequest["trigger"] {
  if (value.kind === "manual") {
    return { kind: "manual" };
  }
  if (value.kind === "schedule") {
    if (typeof value.startAt !== "string" || typeof value.timezone !== "string" || !isAutomationScheduleRepeat(value.repeat)) {
      throw new Error("Invalid automation schedule trigger.");
    }
    return {
      kind: "schedule",
      startAt: value.startAt,
      timezone: value.timezone,
      repeat: value.repeat
    };
  }
  if (value.kind === "file-change") {
    if (typeof value.path !== "string" || !isAutomationFileEventKind(value.event) || value.recursive !== false) {
      throw new Error("Invalid automation file trigger.");
    }
    return {
      kind: "file-change",
      path: value.path,
      event: value.event,
      recursive: false
    };
  }
  throw new Error("Invalid automation trigger kind.");
}

function parseAutomationAction(value: Record<string, unknown>): CreateAutomationRequest["action"] {
  if (!isAutomationActionKind(value.kind) || typeof value.target !== "string" || typeof value.instructions !== "string") {
    throw new Error("Invalid automation action.");
  }
  return {
    kind: value.kind,
    target: value.target,
    instructions: value.instructions
  };
}

function parseAutomationFailurePolicy(value: Record<string, unknown>): CreateAutomationRequest["failurePolicy"] {
  if (
    typeof value.retryCount !== "number" ||
    typeof value.disableAfterFailures !== "number" ||
    typeof value.timeoutSeconds !== "number" ||
    typeof value.notifyOnFailure !== "boolean"
  ) {
    throw new Error("Invalid automation failure policy.");
  }
  if (!Number.isInteger(value.retryCount) || !Number.isInteger(value.disableAfterFailures) || !Number.isInteger(value.timeoutSeconds)) {
    throw new Error("Invalid automation failure policy integers.");
  }
  return {
    retryCount: value.retryCount,
    disableAfterFailures: value.disableAfterFailures,
    timeoutSeconds: value.timeoutSeconds,
    notifyOnFailure: value.notifyOnFailure
  };
}

function isAutomationTriggerKind(value: unknown): value is AutomationTriggerKind {
  return value === "manual" || value === "schedule" || value === "file-change";
}

function isAutomationScheduleRepeat(value: unknown): value is AutomationScheduleRepeat {
  return value === "once" || value === "hourly" || value === "daily";
}

function isAutomationFileEventKind(value: unknown): value is AutomationFileEventKind {
  return value === "created" || value === "changed" || value === "deleted";
}

function isAutomationActionKind(value: unknown): value is AutomationActionKind {
  return value === "notify" ||
    value === "teach-replay-dry-run" ||
    value === "app-adapter-plan-dry-run" ||
    value === "knowledge-refresh-dry-run";
}

function parseCreateInstallerManifestRequest(value: unknown): CreateInstallerManifestRequest {
  if (!isRecord(value) || value.target !== "local-portable") {
    throw new Error("Invalid installer manifest request.");
  }
  return {
    target: "local-portable"
  };
}

function parseCreateRestorePlanRequest(value: unknown): CreateRestorePlanRequest {
  if (!isRecord(value) || typeof value.exportPath !== "string") {
    throw new Error("Invalid restore plan request.");
  }
  return {
    exportPath: value.exportPath
  };
}

function isComputerBounds(value: unknown): value is ComputerBounds {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.left === "number" &&
    typeof value.top === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    Number.isInteger(value.left) &&
    Number.isInteger(value.top) &&
    Number.isInteger(value.width) &&
    Number.isInteger(value.height) &&
    value.width > 0 &&
    value.height > 0;
}
