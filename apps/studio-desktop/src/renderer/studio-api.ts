import type {
  AppAdapterActionPlan,
  AppAdapterState,
  AutomationState,
  ChatAttachment,
  ChatEvent,
  ChatState,
  BrowserVisionState,
  CommandCenterState,
  ComputerActiveAction,
  ComputerControlState,
  ComputerScreenshotResult,
  ComputerUiTreeResult,
  ComputerWindowListResult,
  EvaluateKnowledgeRequest,
  ExecuteComputerActionRequest,
  ExecuteCommandPlanRequest,
  CreateCommandPlanRequest,
  ConfirmElevatedHelperSessionRequest,
  CreateAutomationRequest,
  CreateInstallerManifestRequest,
  ElevatedHelperState,
  GetComputerUiTreeRequest,
  GroundBrowserElementRequest,
  HighlightComputerElementRequest,
  IngestKnowledgeFilesRequest,
  IngestKnowledgeFilesResult,
  KnowledgeBaseSummary,
  KnowledgeEvaluationResult,
  KnowledgeRagState,
  KnowledgeSearchResult,
  LearningMemoryCandidate,
  LearningSkillCandidate,
  LearningState,
  ImageGenerationRequest,
  ImportMediaAssetsRequest,
  DisableAutomationRequest,
  MediaAssetRequest,
  MediaState,
  PackagingHardeningState,
  SampleVideoKeyframesRequest,
  SelectMediaAssetRequest,
  ConvertTeachWorkflowToSkillRequest,
  CreateAppAdapterPlanRequest,
  CreateTeachReplayRequest,
  GenerateTeachWorkflowRequest,
  ModelBenchmarkResult,
  ModelFabricState,
  ModelLifecycleRequest,
  ModelPlanValidationResult,
  ProposeComputerActionRequest,
  ProposeMemoryCandidateRequest,
  ProposeSkillCandidateRequest,
  ProbeAppAdaptersRequest,
  PrepareElevatedHelperLaunchRequest,
  RevokeElevatedHelperSessionRequest,
  RouteModelRoleRequest,
  ReviewBrowserGroundingRequest,
  ReviewCommandPlanRequest,
  ReviewAppAdapterPlanRequest,
  ReviewAutomationRequest,
  ReviewComputerActionRequest,
  ReviewMemoryCandidateRequest,
  ReviewSkillCandidateRequest,
  ReviewTeachReplayRequest,
  ReviewTeachSkillCandidateRequest,
  RollbackSkillVersionRequest,
  RunModelBenchmarkRequest,
  SaveKnowledgeBaseRequest,
  ProfileConfigState,
  SaveHermesConfigRequest,
  SaveStudioProfileRequest,
  SaveStudioProjectRequest,
  SendChatMessageRequest,
  StudioBackupExportResult,
  StudioConfigDocument,
  StudioProfileDetail,
  StudioProjectSummary,
  ServiceSupervisorSnapshot,
  SearchKnowledgeRequest,
  SimulateAutomationRequest,
  CreateRestorePlanRequest,
  ValidateModelPlanRequest,
  ConfigureVoiceRequest,
  SetVoiceMicrophonePermissionRequest,
  SpeakVoiceRequest,
  StartVoiceCaptureRequest,
  StopVoiceCaptureRequest,
  SubmitVoiceUtteranceRequest,
  StartTeachSessionRequest,
  RecordTeachEventRequest,
  TeachModeState,
  VoiceState
} from "@hermes-local-ai/contracts";

export interface StudioRendererApi {
  readonly getSnapshot: () => Promise<ServiceSupervisorSnapshot>;
  readonly startService: (serviceId: string) => Promise<ServiceSupervisorSnapshot>;
  readonly stopService: (serviceId: string) => Promise<ServiceSupervisorSnapshot>;
  readonly shutdown: () => Promise<void>;
  readonly getCommandCenterState: () => Promise<CommandCenterState>;
  readonly openInstructionWindow: () => Promise<boolean>;
  readonly createCommandPlan: (request: CreateCommandPlanRequest) => Promise<CommandCenterState>;
  readonly reviewCommandPlan: (request: ReviewCommandPlanRequest) => Promise<CommandCenterState>;
  readonly executeCommandPlan: (request: ExecuteCommandPlanRequest) => Promise<CommandCenterState>;
  readonly getChatState: () => Promise<ChatState>;
  readonly sendChatMessage: (request: SendChatMessageRequest) => Promise<ChatState>;
  readonly cancelChatRun: (runId: string) => Promise<ChatState>;
  readonly selectChatAttachments: () => Promise<readonly ChatAttachment[]>;
  readonly onChatEvent: (callback: (event: ChatEvent) => void) => () => void;
  readonly getProfileConfigState: () => Promise<ProfileConfigState>;
  readonly getProfile: (profileId: string) => Promise<StudioProfileDetail>;
  readonly saveProfile: (request: SaveStudioProfileRequest) => Promise<StudioProfileDetail>;
  readonly saveProject: (request: SaveStudioProjectRequest) => Promise<StudioProjectSummary>;
  readonly saveHermesConfig: (request: SaveHermesConfigRequest) => Promise<StudioConfigDocument>;
  readonly exportStudioBackup: () => Promise<StudioBackupExportResult>;
  readonly getModelFabricState: () => Promise<ModelFabricState>;
  readonly routeModelRole: (request: RouteModelRoleRequest) => Promise<ModelFabricState["routes"][number]>;
  readonly modelLifecycle: (request: ModelLifecycleRequest) => Promise<ModelFabricState>;
  readonly runModelBenchmark: (request: RunModelBenchmarkRequest) => Promise<ModelBenchmarkResult>;
  readonly validateModelPlan: (request: ValidateModelPlanRequest) => Promise<ModelPlanValidationResult>;
  readonly getKnowledgeState: () => Promise<KnowledgeRagState>;
  readonly saveKnowledgeBase: (request: SaveKnowledgeBaseRequest) => Promise<KnowledgeBaseSummary>;
  readonly ingestKnowledgeFiles: (request: IngestKnowledgeFilesRequest) => Promise<IngestKnowledgeFilesResult>;
  readonly selectKnowledgeFiles: (baseId: string) => Promise<IngestKnowledgeFilesResult>;
  readonly searchKnowledge: (request: SearchKnowledgeRequest) => Promise<KnowledgeSearchResult>;
  readonly evaluateKnowledge: (request: EvaluateKnowledgeRequest) => Promise<KnowledgeEvaluationResult>;
  readonly getLearningState: () => Promise<LearningState>;
  readonly proposeMemoryCandidate: (request: ProposeMemoryCandidateRequest) => Promise<LearningMemoryCandidate>;
  readonly reviewMemoryCandidate: (request: ReviewMemoryCandidateRequest) => Promise<LearningState>;
  readonly proposeSkillCandidate: (request: ProposeSkillCandidateRequest) => Promise<LearningSkillCandidate>;
  readonly reviewSkillCandidate: (request: ReviewSkillCandidateRequest) => Promise<LearningState>;
  readonly rollbackSkillVersion: (request: RollbackSkillVersionRequest) => Promise<LearningState>;
  readonly getComputerState: () => Promise<ComputerControlState>;
  readonly listComputerWindows: () => Promise<ComputerWindowListResult>;
  readonly getComputerUiTree: (request: GetComputerUiTreeRequest) => Promise<ComputerUiTreeResult>;
  readonly captureComputerScreen: () => Promise<ComputerScreenshotResult>;
  readonly highlightComputerElement: (request: HighlightComputerElementRequest) => Promise<ComputerScreenshotResult>;
  readonly proposeComputerAction: (request: ProposeComputerActionRequest) => Promise<ComputerActiveAction>;
  readonly reviewComputerAction: (request: ReviewComputerActionRequest) => Promise<ComputerControlState>;
  readonly executeComputerAction: (request: ExecuteComputerActionRequest) => Promise<ComputerControlState>;
  readonly emergencyStopComputer: () => Promise<ComputerControlState>;
  readonly resetComputerEmergencyStop: () => Promise<ComputerControlState>;
  readonly getBrowserVisionState: () => Promise<BrowserVisionState>;
  readonly inspectBrowser: (request: { readonly engine: "edge" | "chrome" }) => Promise<BrowserVisionState>;
  readonly groundBrowserElement: (request: GroundBrowserElementRequest) => Promise<BrowserVisionState>;
  readonly reviewBrowserGrounding: (request: ReviewBrowserGroundingRequest) => Promise<BrowserVisionState>;
  readonly getVoiceState: () => Promise<VoiceState>;
  readonly setVoiceMicrophonePermission: (request: SetVoiceMicrophonePermissionRequest) => Promise<VoiceState>;
  readonly configureVoice: (request: ConfigureVoiceRequest) => Promise<VoiceState>;
  readonly startVoiceCapture: (request: StartVoiceCaptureRequest) => Promise<VoiceState>;
  readonly stopVoiceCapture: (request: StopVoiceCaptureRequest) => Promise<VoiceState>;
  readonly submitVoiceUtterance: (request: SubmitVoiceUtteranceRequest) => Promise<VoiceState>;
  readonly speakVoice: (request: SpeakVoiceRequest) => Promise<VoiceState>;
  readonly interruptVoice: (reason?: string) => Promise<VoiceState>;
  readonly runVoiceSelfTest: () => Promise<VoiceState>;
  readonly getMediaState: () => Promise<MediaState>;
  readonly selectMediaFiles: () => Promise<MediaState>;
  readonly importMediaAssets: (request: ImportMediaAssetsRequest) => Promise<MediaState>;
  readonly selectMediaAsset: (request: SelectMediaAssetRequest) => Promise<MediaState>;
  readonly understandImage: (request: MediaAssetRequest) => Promise<MediaState>;
  readonly runImageOcr: (request: MediaAssetRequest) => Promise<MediaState>;
  readonly probeComfyUi: () => Promise<MediaState>;
  readonly createImageGeneration: (request: ImageGenerationRequest) => Promise<MediaState>;
  readonly probeVideo: (request: MediaAssetRequest) => Promise<MediaState>;
  readonly extractVideoAudio: (request: MediaAssetRequest) => Promise<MediaState>;
  readonly sampleVideoKeyframes: (request: SampleVideoKeyframesRequest) => Promise<MediaState>;
  readonly summarizeVideo: (request: MediaAssetRequest) => Promise<MediaState>;
  readonly getTeachModeState: () => Promise<TeachModeState>;
  readonly startTeachSession: (request: StartTeachSessionRequest) => Promise<TeachModeState>;
  readonly recordTeachEvent: (request: RecordTeachEventRequest) => Promise<TeachModeState>;
  readonly stopTeachSession: () => Promise<TeachModeState>;
  readonly generateTeachWorkflow: (request: GenerateTeachWorkflowRequest) => Promise<TeachModeState>;
  readonly createTeachReplay: (request: CreateTeachReplayRequest) => Promise<TeachModeState>;
  readonly reviewTeachReplay: (request: ReviewTeachReplayRequest) => Promise<TeachModeState>;
  readonly convertTeachWorkflowToSkill: (request: ConvertTeachWorkflowToSkillRequest) => Promise<TeachModeState>;
  readonly reviewTeachSkillCandidate: (request: ReviewTeachSkillCandidateRequest) => Promise<TeachModeState>;
  readonly getAppAdapterState: () => Promise<AppAdapterState>;
  readonly probeAppAdapters: (request: ProbeAppAdaptersRequest) => Promise<AppAdapterState>;
  readonly createAppAdapterPlan: (request: CreateAppAdapterPlanRequest) => Promise<AppAdapterActionPlan>;
  readonly reviewAppAdapterPlan: (request: ReviewAppAdapterPlanRequest) => Promise<AppAdapterState>;
  readonly getElevatedHelperState: () => Promise<ElevatedHelperState>;
  readonly probeElevatedHelper: () => Promise<ElevatedHelperState>;
  readonly prepareElevatedHelperLaunch: (request: PrepareElevatedHelperLaunchRequest) => Promise<ElevatedHelperState>;
  readonly confirmElevatedHelperSession: (request: ConfirmElevatedHelperSessionRequest) => Promise<ElevatedHelperState>;
  readonly revokeElevatedHelperSession: (request: RevokeElevatedHelperSessionRequest) => Promise<ElevatedHelperState>;
  readonly getAutomationState: () => Promise<AutomationState>;
  readonly createAutomation: (request: CreateAutomationRequest) => Promise<AutomationState>;
  readonly reviewAutomation: (request: ReviewAutomationRequest) => Promise<AutomationState>;
  readonly simulateAutomation: (request: SimulateAutomationRequest) => Promise<AutomationState>;
  readonly disableAutomation: (request: DisableAutomationRequest) => Promise<AutomationState>;
  readonly getPackagingHardeningState: () => Promise<PackagingHardeningState>;
  readonly inspectPackagingHardening: () => Promise<PackagingHardeningState>;
  readonly createInstallerManifest: (request: CreateInstallerManifestRequest) => Promise<PackagingHardeningState>;
  readonly createRestorePlan: (request: CreateRestorePlanRequest) => Promise<PackagingHardeningState>;
}

declare global {
  interface Window {
    readonly hermesStudio: StudioRendererApi;
  }
}
