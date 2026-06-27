import { randomUUID } from "node:crypto";
import { freemem, totalmem } from "node:os";

import type {
  ConfigureModelTaskRouteRequest,
  ModelBenchmarkResult,
  ModelDownloadRequest,
  ModelFabricState,
  ModelLifecycleRequest,
  ModelMemoryRecommendation,
  ModelMarketplaceDownloadState,
  ModelMarketplaceEntry,
  ModelPlanValidationError,
  ModelPlanValidationResult,
  ModelPrivacyPreset,
  ModelProviderHealth,
  ModelProviderStatus,
  ModelRegistryEntry,
  ModelResourceSnapshot,
  ModelRoleAlias,
  ModelRoleRoute,
  ModelTaskProfileId,
  ModelTaskRoutePreset,
  ModelTaskProfile,
  RouteModelRoleRequest,
  RunModelBenchmarkRequest,
  ValidateModelPlanRequest
} from "@hermes-local-ai/contracts";

interface SeedProvider {
  readonly id: string;
  readonly label: string;
  readonly kind: ModelProviderStatus["kind"];
  readonly endpoint: string | null;
  readonly enabled: boolean;
  readonly privacyBoundary: ModelProviderStatus["privacyBoundary"];
  readonly requiresApiKey: boolean;
}

interface SeedModel {
  readonly id: string;
  readonly providerId: string;
  readonly model: string;
  readonly label: string;
  readonly roles: readonly ModelRoleAlias[];
  readonly lifecycle: ModelRegistryEntry["lifecycle"];
  readonly contextLength: number;
  readonly capabilities: readonly string[];
  readonly parameterCountB: number | null;
  readonly marketplaceRank: number | null;
  readonly recommendedTaskProfileIds: readonly ModelTaskProfileId[];
  readonly sourceUrl: string;
  readonly runtimeKind: ModelMarketplaceEntry["runtimeKind"];
  readonly downloadSupported: boolean;
  readonly preloadRecommended: boolean;
  readonly enabled: boolean;
  readonly local: boolean;
  readonly notes: string;
}

interface OllamaSnapshot {
  readonly health: ModelProviderHealth;
  readonly installedModels: readonly string[];
  readonly loadedModels: readonly string[];
}

interface OllamaTagsResponse {
  readonly models?: readonly {
    readonly name?: string;
    readonly model?: string;
  }[];
}

interface OllamaPsResponse {
  readonly models?: readonly {
    readonly name?: string;
    readonly model?: string;
  }[];
}

interface OllamaGenerateResponse {
  readonly response?: string;
  readonly error?: string;
}

interface OllamaPullResponse {
  readonly status?: string;
  readonly error?: string;
}

interface ExecutionPlanStage {
  readonly id?: unknown;
  readonly type?: unknown;
  readonly role?: unknown;
  readonly depends_on?: unknown;
}

export interface ModelFabricManagerOptions {
  readonly ollamaBaseUrl?: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_PRIVACY_PRESET: ModelPrivacyPreset = "offline-secure";
const MODEL_FABRIC_ROLE_ALIASES: readonly ModelRoleAlias[] = [
  "orchestrator.primary",
  "controller.fast",
  "agent.general",
  "agent.deep",
  "agent.code",
  "agent.summarize",
  "agent.verify",
  "vision.general",
  "vision.ui_grounding",
  "vision.document",
  "vision.video",
  "speech.vad",
  "speech.asr.fast",
  "speech.asr.accurate",
  "speech.tts.fast",
  "speech.tts.quality",
  "retrieval.embedding",
  "retrieval.reranker",
  "image.generate",
  "image.edit",
  "image.verify",
  "video.analyze",
  "video.generate",
  "translation.fast",
  "translation.quality"
];
const DEFAULT_MANUAL_LOCAL_ENDPOINT = "manual local runtime";
const ROLE_SET = new Set<string>(MODEL_FABRIC_ROLE_ALIASES);
const DIRECT_OS_TOOL_PREFIXES = [
  "app.",
  "window.",
  "ui.",
  "mouse.",
  "keyboard.",
  "clipboard.",
  "screen.",
  "powershell.",
  "filesystem.",
  "file."
];
const MODEL_TASK_PROFILES: readonly ModelTaskProfile[] = [
  {
    id: "computer-control",
    label: "Computer control",
    description: "Plan OS and UI tasks with observation, verification, and broker-only action handoff.",
    orchestratorRole: "orchestrator.primary",
    specialistRoles: ["agent.verify", "vision.ui_grounding"],
    loadPolicy: "Keep the orchestrator warm; load UI grounding only when screen observation or element verification is needed.",
    unloadPolicy: "Unload on-demand vision specialists after the approved task is verified.",
    confidenceFloor: 0.9
  },
  {
    id: "knowledge-research",
    label: "Knowledge research",
    description: "Gather trusted local context and use retrieval specialists before answer or action planning.",
    orchestratorRole: "orchestrator.primary",
    specialistRoles: ["retrieval.embedding", "agent.summarize", "agent.verify"],
    loadPolicy: "Keep embeddings available for batch retrieval and warm the verifier for citation checks.",
    unloadPolicy: "Release summarization and verifier models after the answer or plan is reviewed.",
    confidenceFloor: 0.9
  },
  {
    id: "code-change",
    label: "Code change",
    description: "Route implementation through code, review, and verification specialists.",
    orchestratorRole: "orchestrator.primary",
    specialistRoles: ["agent.code", "agent.verify", "agent.summarize"],
    loadPolicy: "Warm code and verifier roles while tests are running; avoid loading unrelated media models.",
    unloadPolicy: "Unload non-pinned code specialists after validation completes.",
    confidenceFloor: 0.9
  },
  {
    id: "creative-media",
    label: "Creative media",
    description: "Coordinate prompt, image, vision, and verification roles for generated media workflows.",
    orchestratorRole: "orchestrator.primary",
    specialistRoles: ["image.generate", "image.edit", "image.verify"],
    loadPolicy: "Load generation/edit models one at a time and keep the verifier separate for review.",
    unloadPolicy: "Unload exclusive generation models immediately after artifacts are saved and verified.",
    confidenceFloor: 0.9
  },
  {
    id: "conversation",
    label: "Conversation",
    description: "Use a fast local orchestrator with optional deep and summarization specialists.",
    orchestratorRole: "orchestrator.primary",
    specialistRoles: ["agent.general", "agent.deep", "agent.summarize"],
    loadPolicy: "Keep the fast orchestrator pinned and warm deeper specialists only for complex prompts.",
    unloadPolicy: "Unload deep specialists after the conversation turn when memory pressure is constrained.",
    confidenceFloor: 0.9
  },
  {
    id: "voice-assistant",
    label: "Voice assistant",
    description: "Route Thai-capable transcription, speech synthesis, summarization, and verification models.",
    orchestratorRole: "orchestrator.primary",
    specialistRoles: ["speech.asr.fast", "speech.asr.accurate", "speech.tts.fast", "agent.summarize", "agent.verify"],
    loadPolicy: "Keep the text orchestrator warm; load ASR/TTS models only during voice capture or speech output.",
    unloadPolicy: "Unload ASR/TTS specialists after transcription, synthesis, and verification complete.",
    confidenceFloor: 0.9
  }
];

const PROVIDERS: readonly SeedProvider[] = [
  {
    id: "ollama",
    label: "Ollama Local",
    kind: "ollama",
    endpoint: DEFAULT_OLLAMA_BASE_URL,
    enabled: true,
    privacyBoundary: "local",
    requiresApiKey: false
  },
  {
    id: "huggingface-local",
    label: "Hugging Face Local Runtime",
    kind: "local-artifact",
    endpoint: DEFAULT_MANUAL_LOCAL_ENDPOINT,
    enabled: true,
    privacyBoundary: "local",
    requiresApiKey: false
  },
  {
    id: "openai",
    label: "OpenAI API",
    kind: "external-api",
    endpoint: null,
    enabled: false,
    privacyBoundary: "external",
    requiresApiKey: true
  },
  {
    id: "anthropic",
    label: "Anthropic API",
    kind: "external-api",
    endpoint: null,
    enabled: false,
    privacyBoundary: "external",
    requiresApiKey: true
  },
  {
    id: "google-ai-studio",
    label: "Google AI Studio API",
    kind: "external-api",
    endpoint: null,
    enabled: false,
    privacyBoundary: "external",
    requiresApiKey: true
  },
  {
    id: "openrouter",
    label: "OpenRouter API",
    kind: "external-api",
    endpoint: null,
    enabled: false,
    privacyBoundary: "external",
    requiresApiKey: true
  }
];

const SEED_MODELS: readonly SeedModel[] = [
  {
    id: "ollama:qwen3.5:4b",
    providerId: "ollama",
    model: "qwen3.5:4b",
    label: "Qwen3.5 4B",
    roles: ["orchestrator.primary", "controller.fast", "agent.general", "agent.summarize", "agent.verify", "translation.fast"],
    lifecycle: "pinned",
    contextLength: 65536,
    capabilities: ["text", "structured-output", "local"],
    parameterCountB: 4,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["conversation", "computer-control"],
    sourceUrl: "https://ollama.com/library/qwen3.5:4b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: true,
    enabled: true,
    local: true,
    notes: "Baseline local controller and general chat model."
  },
  {
    id: "ollama:qwen3.5:9b",
    providerId: "ollama",
    model: "qwen3.5:9b",
    label: "Qwen3.5 9B",
    roles: ["agent.general", "agent.deep", "agent.code", "agent.verify", "translation.quality"],
    lifecycle: "warm",
    contextLength: 65536,
    capabilities: ["text", "code", "structured-output", "local"],
    parameterCountB: 9,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["conversation", "code-change", "knowledge-research"],
    sourceUrl: "https://ollama.com/library/qwen3.5",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: true,
    enabled: true,
    local: true,
    notes: "Stronger local text, reasoning, and code model."
  },
  {
    id: "ollama:qwen3-vl:4b",
    providerId: "ollama",
    model: "qwen3-vl:4b",
    label: "Qwen3 VL 4B",
    roles: ["vision.general", "vision.ui_grounding", "vision.document", "vision.video"],
    lifecycle: "on-demand",
    contextLength: 32768,
    capabilities: ["vision", "image", "local"],
    parameterCountB: 4,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["computer-control", "creative-media", "knowledge-research"],
    sourceUrl: "https://ollama.com/library/qwen3-vl",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Baseline local vision model."
  },
  {
    id: "ollama:qwen3-embedding:0.6b",
    providerId: "ollama",
    model: "qwen3-embedding:0.6b",
    label: "Qwen3 Embedding 0.6B",
    roles: ["retrieval.embedding"],
    lifecycle: "batch",
    contextLength: 8192,
    capabilities: ["embedding", "retrieval", "local"],
    parameterCountB: 0.6,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["knowledge-research"],
    sourceUrl: "https://ollama.com/library/qwen3-embedding",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Baseline local embedding model for future knowledge indexing."
  },
  {
    id: "ollama:qwen3.5:2b",
    providerId: "ollama",
    model: "qwen3.5:2b",
    label: "Qwen3.5 2B",
    roles: ["orchestrator.primary", "controller.fast", "agent.general", "agent.summarize", "translation.fast"],
    lifecycle: "on-demand",
    contextLength: 32768,
    capabilities: ["text", "structured-output", "low-resource", "local"],
    parameterCountB: 2,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["conversation", "computer-control"],
    sourceUrl: "https://ollama.com/library/qwen3.5",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Optional low-resource local model for smaller machines."
  },
  {
    id: "ollama:qwen3-vl:8b",
    providerId: "ollama",
    model: "qwen3-vl:8b",
    label: "Qwen3 VL 8B",
    roles: ["vision.general", "vision.ui_grounding", "vision.document", "vision.video", "image.verify"],
    lifecycle: "on-demand",
    contextLength: 32768,
    capabilities: ["vision", "image", "document", "local"],
    parameterCountB: 8,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["computer-control", "creative-media", "knowledge-research"],
    sourceUrl: "https://ollama.com/library/qwen3-vl:8b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Optional stronger local vision model for UI grounding and document review."
  },
  {
    id: "ollama:qwen3:0.6b",
    providerId: "ollama",
    model: "qwen3:0.6b",
    label: "Qwen3 0.6B",
    roles: ["controller.fast", "agent.summarize", "translation.fast"],
    lifecycle: "on-demand",
    contextLength: 32768,
    capabilities: ["text", "low-resource", "local"],
    parameterCountB: 0.6,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["conversation"],
    sourceUrl: "https://ollama.com/library/qwen3:0.6b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Optional ultra-small local text model for very constrained systems."
  },
  {
    id: "ollama:qwen3:14b",
    providerId: "ollama",
    model: "qwen3:14b",
    label: "Qwen3 14B",
    roles: ["orchestrator.primary", "agent.general", "agent.deep", "agent.verify", "translation.quality"],
    lifecycle: "warm",
    contextLength: 65536,
    capabilities: ["text", "reasoning", "structured-output", "local", "featured-under-20b"],
    parameterCountB: 14,
    marketplaceRank: 1,
    recommendedTaskProfileIds: ["conversation", "knowledge-research", "code-change"],
    sourceUrl: "https://ollama.com/library/qwen3:14b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: true,
    enabled: true,
    local: true,
    notes: "Featured under-20B reasoning and general-purpose local model."
  },
  {
    id: "ollama:deepseek-r1:14b",
    providerId: "ollama",
    model: "deepseek-r1:14b",
    label: "DeepSeek R1 14B",
    roles: ["agent.deep", "agent.verify", "agent.summarize"],
    lifecycle: "warm",
    contextLength: 32768,
    capabilities: ["text", "reasoning", "verification", "local", "featured-under-20b"],
    parameterCountB: 14,
    marketplaceRank: 2,
    recommendedTaskProfileIds: ["knowledge-research", "code-change", "conversation"],
    sourceUrl: "https://ollama.com/library/deepseek-r1:14b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: true,
    enabled: true,
    local: true,
    notes: "Featured under-20B reasoning specialist."
  },
  {
    id: "ollama:phi4:14b",
    providerId: "ollama",
    model: "phi4:14b",
    label: "Phi-4 14B",
    roles: ["agent.general", "agent.deep", "agent.verify", "agent.summarize"],
    lifecycle: "warm",
    contextLength: 16384,
    capabilities: ["text", "reasoning", "math", "local", "featured-under-20b"],
    parameterCountB: 14,
    marketplaceRank: 3,
    recommendedTaskProfileIds: ["conversation", "knowledge-research"],
    sourceUrl: "https://ollama.com/library/phi4:14b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: true,
    enabled: true,
    local: true,
    notes: "Featured under-20B general reasoning model."
  },
  {
    id: "ollama:gemma3:12b",
    providerId: "ollama",
    model: "gemma3:12b",
    label: "Gemma 3 12B",
    roles: ["agent.general", "agent.summarize", "vision.general", "vision.document", "image.verify"],
    lifecycle: "warm",
    contextLength: 128000,
    capabilities: ["text", "vision", "document", "local", "featured-under-20b"],
    parameterCountB: 12,
    marketplaceRank: 4,
    recommendedTaskProfileIds: ["conversation", "knowledge-research", "creative-media"],
    sourceUrl: "https://ollama.com/library/gemma3:12b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: true,
    enabled: true,
    local: true,
    notes: "Featured under-20B multimodal local model."
  },
  {
    id: "ollama:qwen2.5-coder:14b",
    providerId: "ollama",
    model: "qwen2.5-coder:14b",
    label: "Qwen2.5 Coder 14B",
    roles: ["agent.code", "agent.verify", "agent.summarize"],
    lifecycle: "warm",
    contextLength: 32768,
    capabilities: ["text", "code", "structured-output", "local", "featured-under-20b"],
    parameterCountB: 14,
    marketplaceRank: 5,
    recommendedTaskProfileIds: ["code-change"],
    sourceUrl: "https://ollama.com/library/qwen2.5-coder:14b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: true,
    enabled: true,
    local: true,
    notes: "Featured under-20B coding specialist."
  },
  {
    id: "ollama:qwen2.5:14b",
    providerId: "ollama",
    model: "qwen2.5:14b",
    label: "Qwen2.5 14B",
    roles: ["agent.general", "agent.deep", "agent.summarize", "translation.quality"],
    lifecycle: "warm",
    contextLength: 32768,
    capabilities: ["text", "multilingual", "structured-output", "local", "featured-under-20b"],
    parameterCountB: 14,
    marketplaceRank: 6,
    recommendedTaskProfileIds: ["conversation", "knowledge-research"],
    sourceUrl: "https://ollama.com/library/qwen2.5:14b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: true,
    enabled: true,
    local: true,
    notes: "Featured under-20B multilingual general-purpose model."
  },
  {
    id: "ollama:granite3.3:8b",
    providerId: "ollama",
    model: "granite3.3:8b",
    label: "Granite 3.3 8B",
    roles: ["agent.general", "agent.code", "agent.summarize", "agent.verify"],
    lifecycle: "on-demand",
    contextLength: 128000,
    capabilities: ["text", "code", "enterprise", "local", "featured-under-20b"],
    parameterCountB: 8,
    marketplaceRank: 7,
    recommendedTaskProfileIds: ["code-change", "knowledge-research", "conversation"],
    sourceUrl: "https://ollama.com/library/granite3.3:8b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Featured under-20B enterprise and code-capable model."
  },
  {
    id: "ollama:llama3:8b",
    providerId: "ollama",
    model: "llama3:8b",
    label: "Llama 3 8B",
    roles: ["agent.general", "agent.summarize", "agent.verify"],
    lifecycle: "on-demand",
    contextLength: 8192,
    capabilities: ["text", "general", "local", "featured-under-20b"],
    parameterCountB: 8,
    marketplaceRank: 8,
    recommendedTaskProfileIds: ["conversation", "knowledge-research"],
    sourceUrl: "https://ollama.com/library/llama3:8b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Featured under-20B widely used general chat model."
  },
  {
    id: "ollama:qwen3:8b",
    providerId: "ollama",
    model: "qwen3:8b",
    label: "Qwen3 8B",
    roles: ["agent.general", "agent.deep", "agent.verify", "translation.quality"],
    lifecycle: "on-demand",
    contextLength: 40960,
    capabilities: ["text", "reasoning", "multilingual", "local", "featured-under-20b"],
    parameterCountB: 8,
    marketplaceRank: 9,
    recommendedTaskProfileIds: ["conversation", "knowledge-research"],
    sourceUrl: "https://ollama.com/library/qwen3:8b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Featured under-20B balanced reasoning and multilingual model."
  },
  {
    id: "ollama:deepseek-r1:8b",
    providerId: "ollama",
    model: "deepseek-r1:8b",
    label: "DeepSeek R1 8B",
    roles: ["agent.deep", "agent.verify", "agent.summarize"],
    lifecycle: "on-demand",
    contextLength: 32768,
    capabilities: ["text", "reasoning", "local", "featured-under-20b"],
    parameterCountB: 8,
    marketplaceRank: 10,
    recommendedTaskProfileIds: ["knowledge-research", "conversation"],
    sourceUrl: "https://ollama.com/library/deepseek-r1:8b",
    runtimeKind: "ollama",
    downloadSupported: true,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Featured under-20B compact reasoning model."
  },
  {
    id: "hf:openai:whisper-large-v3-turbo",
    providerId: "huggingface-local",
    model: "openai/whisper-large-v3-turbo",
    label: "Whisper Large v3 Turbo",
    roles: ["speech.asr.fast", "speech.asr.accurate"],
    lifecycle: "on-demand",
    contextLength: 0,
    capabilities: ["asr", "transcription", "thai", "multilingual", "local-runtime"],
    parameterCountB: null,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["voice-assistant"],
    sourceUrl: "https://huggingface.co/openai/whisper-large-v3-turbo",
    runtimeKind: "manual-local",
    downloadSupported: false,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Thai-capable local transcription candidate. Requires a Transformers, faster-whisper, or equivalent ASR runtime adapter."
  },
  {
    id: "hf:airesearch:wav2vec2-large-xlsr-53-th",
    providerId: "huggingface-local",
    model: "airesearch/wav2vec2-large-xlsr-53-th",
    label: "Thai Wav2Vec2 XLSR",
    roles: ["speech.asr.accurate"],
    lifecycle: "on-demand",
    contextLength: 0,
    capabilities: ["asr", "transcription", "thai", "local-runtime"],
    parameterCountB: null,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["voice-assistant"],
    sourceUrl: "https://huggingface.co/airesearch/wav2vec2-large-xlsr-53-th",
    runtimeKind: "manual-local",
    downloadSupported: false,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Thai-specific speech recognition candidate. Requires a Transformers or ONNX ASR runtime adapter."
  },
  {
    id: "hf:facebook:mms-tts-tha",
    providerId: "huggingface-local",
    model: "facebook/mms-tts-tha",
    label: "MMS Thai TTS",
    roles: ["speech.tts.fast", "speech.tts.quality"],
    lifecycle: "on-demand",
    contextLength: 0,
    capabilities: ["tts", "speech-synthesis", "thai", "local-runtime"],
    parameterCountB: null,
    marketplaceRank: null,
    recommendedTaskProfileIds: ["voice-assistant"],
    sourceUrl: "https://huggingface.co/facebook/mms-tts-tha",
    runtimeKind: "manual-local",
    downloadSupported: false,
    preloadRecommended: false,
    enabled: true,
    local: true,
    notes: "Thai text-to-speech candidate. Requires a local TTS runtime adapter."
  }
];

export class ModelFabricManager {
  private readonly ollamaBaseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly benchmarks: ModelBenchmarkResult[] = [];
  private readonly routeOverrides = new Map<ModelRoleAlias, string>();
  private readonly taskRouteOverrides = new Map<ModelTaskProfileId, Map<ModelRoleAlias, string>>();

  public constructor(options: ModelFabricManagerOptions = {}) {
    this.ollamaBaseUrl = removeTrailingSlash(options.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL);
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? (() => new Date());
  }

  public async getState(): Promise<ModelFabricState> {
    const ollama = await this.readOllamaSnapshot();
    const providers = this.buildProviderStatuses(ollama.health);
    const models = this.buildModelRegistry(ollama);
    const resources = this.buildResourceSnapshot(ollama);
    const marketplace = this.buildMarketplace(models);
    const memoryRecommendation = buildMemoryRecommendation(resources);
    const routes = MODEL_FABRIC_ROLE_ALIASES.map((role) => this.routeWithRegistry(models, providers, {
      role,
      privacyPreset: DEFAULT_PRIVACY_PRESET,
      overrideModelId: this.routeOverrides.get(role) ?? null
    }));
    const taskRoutePresets = this.buildTaskRoutePresets(models, providers);

    return {
      providers,
      models,
      marketplace,
      routes,
      resources,
      benchmarks: [...this.benchmarks],
      taskProfiles: MODEL_TASK_PROFILES,
      taskRoutePresets,
      memoryRecommendation
    };
  }

  public async routeRole(request: RouteModelRoleRequest): Promise<ModelRoleRoute> {
    if (!isModelRoleAlias(request.role)) {
      throw new Error("Invalid model role.");
    }
    if (!isPrivacyPreset(request.privacyPreset)) {
      throw new Error("Invalid privacy preset.");
    }

    if (request.overrideModelId) {
      this.routeOverrides.set(request.role, request.overrideModelId);
    } else {
      this.routeOverrides.delete(request.role);
    }

    const state = await this.getState();
    return this.routeWithRegistry(state.models, state.providers, request);
  }

  public async downloadMarketplaceModel(request: ModelDownloadRequest): Promise<ModelFabricState> {
    if (typeof request.marketplaceEntryId !== "string" || request.marketplaceEntryId.trim().length === 0) {
      throw new Error("Invalid marketplace model request.");
    }

    const entry = SEED_MODELS.find((model) => marketplaceEntryId(model.id) === request.marketplaceEntryId) ?? null;
    if (!entry) {
      throw new Error("Unknown marketplace model.");
    }
    if (!entry.downloadSupported || entry.providerId !== "ollama" || !entry.local) {
      throw new Error("Automatic downloads currently support local Ollama models only.");
    }

    const response = await this.postOllama<OllamaPullResponse>("/api/pull", {
      name: entry.model,
      stream: false
    });
    if (response.error) {
      throw new Error(response.error);
    }

    return this.getState();
  }

  public async configureTaskRoute(request: ConfigureModelTaskRouteRequest): Promise<ModelFabricState> {
    if (!isModelTaskProfileId(request.taskProfileId)) {
      throw new Error("Invalid model task profile.");
    }
    if (!isModelRoleAlias(request.role)) {
      throw new Error("Invalid model task role.");
    }
    if (!isPrivacyPreset(request.privacyPreset)) {
      throw new Error("Invalid privacy preset.");
    }

    const profile = MODEL_TASK_PROFILES.find((entry) => entry.id === request.taskProfileId) ?? null;
    if (!profile) {
      throw new Error("Unknown model task profile.");
    }
    const profileRoles = uniqueModelRoles([profile.orchestratorRole, ...profile.specialistRoles]);
    if (!profileRoles.includes(request.role)) {
      throw new Error("Role is not part of the selected task profile.");
    }

    if (request.modelId === null) {
      this.taskRouteOverrides.get(request.taskProfileId)?.delete(request.role);
      return this.getState();
    }

    if (typeof request.modelId !== "string" || request.modelId.trim().length === 0) {
      throw new Error("Invalid task model override.");
    }

    const state = await this.getState();
    const model = state.models.find((entry) => entry.id === request.modelId) ?? null;
    if (!model) {
      throw new Error("Unknown model.");
    }
    if (!model.roles.includes(request.role)) {
      throw new Error("Model is not assigned to the selected task role.");
    }
    if (!model.installed) {
      throw new Error("Download the model before assigning it to a task.");
    }

    const profileOverrides = this.taskRouteOverrides.get(request.taskProfileId) ?? new Map<ModelRoleAlias, string>();
    profileOverrides.set(request.role, model.id);
    this.taskRouteOverrides.set(request.taskProfileId, profileOverrides);
    return this.getState();
  }

  public async lifecycle(request: ModelLifecycleRequest): Promise<ModelFabricState> {
    if (request.action !== "load" && request.action !== "unload") {
      throw new Error("Invalid lifecycle action.");
    }
    const state = await this.getState();
    const model = state.models.find((entry) => entry.id === request.modelId);
    if (!model) {
      throw new Error("Unknown model.");
    }
    if (model.providerId !== "ollama") {
      throw new Error("Only the local Ollama adapter supports lifecycle operations in this milestone.");
    }

    const body = request.action === "unload"
      ? buildOllamaGenerateRequest(model.model, "", 0)
      : buildOllamaGenerateRequest(model.model, "", `${request.keepAliveSeconds ?? 300}s`);

    await this.postOllama("/api/generate", body);
    return this.getState();
  }

  public async benchmark(request: RunModelBenchmarkRequest): Promise<ModelBenchmarkResult> {
    if (!isModelRoleAlias(request.role)) {
      throw new Error("Invalid benchmark role.");
    }

    const state = await this.getState();
    const model = state.models.find((entry) => entry.id === request.modelId);
    if (!model) {
      throw new Error("Unknown model.");
    }
    if (!model.roles.includes(request.role)) {
      throw new Error("Model is not assigned to the requested role.");
    }
    if (model.providerId !== "ollama") {
      throw new Error("External benchmark calls are disabled until a privacy and cost policy is implemented.");
    }

    const started = Date.now();
    try {
      const response = await this.postOllama<OllamaGenerateResponse>("/api/generate", buildOllamaGenerateRequest(
        model.model,
        request.prompt ?? "Reply with one short local model status line.",
        "30s"
      ));
      const output = response.response ?? "";
      const result: ModelBenchmarkResult = {
        id: randomUUID(),
        modelId: model.id,
        role: request.role,
        status: response.error ? "failed" : "passed",
        latencyMs: Date.now() - started,
        outputChars: output.length,
        detail: response.error ?? `Generated ${output.length} characters.`,
        checkedAt: this.now().toISOString()
      };
      this.pushBenchmark(result);
      return result;
    } catch (error) {
      const result: ModelBenchmarkResult = {
        id: randomUUID(),
        modelId: model.id,
        role: request.role,
        status: "failed",
        latencyMs: Date.now() - started,
        outputChars: 0,
        detail: error instanceof Error ? error.message : String(error),
        checkedAt: this.now().toISOString()
      };
      this.pushBenchmark(result);
      return result;
    }
  }

  public validatePlan(request: ValidateModelPlanRequest): ModelPlanValidationResult {
    if (!isPrivacyPreset(request.privacyPreset)) {
      return invalidResult([{ path: "$.privacyPreset", message: "Invalid privacy preset." }]);
    }
    if (!isRecord(request.plan)) {
      return invalidResult([{ path: "$", message: "Plan must be a JSON object." }]);
    }

    const errors: ModelPlanValidationError[] = [];
    const acceptedStageIds: string[] = [];
    const blockedStageIds: string[] = [];
    const stages = request.plan.stages;
    if (typeof request.plan.intent !== "string" || request.plan.intent.trim().length === 0) {
      errors.push({ path: "$.intent", message: "Intent is required." });
    }
    if (typeof request.plan.cloud_allowed !== "boolean") {
      errors.push({ path: "$.cloud_allowed", message: "cloud_allowed must be boolean." });
    }
    if (request.privacyPreset === "offline-secure" && request.plan.cloud_allowed === true) {
      errors.push({ path: "$.cloud_allowed", message: "Offline Secure plans cannot allow cloud execution." });
    }
    if (!Array.isArray(stages) || stages.length === 0) {
      errors.push({ path: "$.stages", message: "At least one stage is required." });
      return {
        valid: false,
        errors,
        acceptedStageIds,
        blockedStageIds
      };
    }

    const stageIds = new Set<string>();
    stages.forEach((stage: unknown, index: number) => {
      if (!isRecord(stage)) {
        errors.push({ path: `$.stages[${index}]`, message: "Stage must be an object." });
        return;
      }
      const typedStage = stage as ExecutionPlanStage;
      if (typeof typedStage.id !== "string" || !/^[a-z][a-z0-9-]{1,63}$/u.test(typedStage.id)) {
        errors.push({ path: `$.stages[${index}].id`, message: "Stage id must be a stable lowercase id." });
        return;
      }
      if (stageIds.has(typedStage.id)) {
        errors.push({ path: `$.stages[${index}].id`, message: "Stage id must be unique." });
      }
      stageIds.add(typedStage.id);

      if (typedStage.type !== "model" && typedStage.type !== "tool") {
        errors.push({ path: `$.stages[${index}].type`, message: "Stage type must be model or tool." });
      }
      if (typeof typedStage.role !== "string" || typedStage.role.trim().length === 0) {
        errors.push({ path: `$.stages[${index}].role`, message: "Stage role is required." });
      }
      if (typedStage.type === "model" && typeof typedStage.role === "string" && !ROLE_SET.has(typedStage.role)) {
        errors.push({ path: `$.stages[${index}].role`, message: "Model stage role must be a registered model alias." });
      }
      if (typedStage.type === "tool" && typeof typedStage.role === "string" && isDirectOsToolRole(typedStage.role)) {
        blockedStageIds.push(typedStage.id);
        errors.push({
          path: `$.stages[${index}].role`,
          message: "Direct OS tool execution is blocked by Model Fabric; route through the Windows broker milestone."
        });
      }
      if (typedStage.depends_on !== undefined && !isStringArray(typedStage.depends_on)) {
        errors.push({ path: `$.stages[${index}].depends_on`, message: "depends_on must be a string array." });
      }
      if (!blockedStageIds.includes(typedStage.id)) {
        acceptedStageIds.push(typedStage.id);
      }
    });

    for (const [index, stage] of stages.entries()) {
      if (!isRecord(stage) || !Array.isArray(stage.depends_on)) {
        continue;
      }
      for (const dependency of stage.depends_on) {
        if (typeof dependency === "string" && !stageIds.has(dependency)) {
          errors.push({ path: `$.stages[${index}].depends_on`, message: `Unknown dependency: ${dependency}.` });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      acceptedStageIds,
      blockedStageIds
    };
  }

  private routeWithRegistry(
    models: readonly ModelRegistryEntry[],
    providers: readonly ModelProviderStatus[],
    request: RouteModelRoleRequest
  ): ModelRoleRoute {
    const rejected: { modelId: string; reason: string }[] = [];
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));
    const candidates = models.filter((model) => model.roles.includes(request.role));
    const override = request.overrideModelId
      ? candidates.find((model) => model.id === request.overrideModelId) ?? null
      : null;

    if (request.overrideModelId && !override) {
      rejected.push({ modelId: request.overrideModelId, reason: "Override model is not assigned to this role." });
    }

    const eligible = candidates.filter((model) => {
      const provider = providerById.get(model.providerId);
      const rejection = getModelRejection(model, provider, request.privacyPreset);
      if (rejection) {
        rejected.push({ modelId: model.id, reason: rejection });
        return false;
      }
      return true;
    });

    const selected = override && eligible.some((model) => model.id === override.id)
      ? override
      : [...eligible].sort((left, right) => scoreModel(right) - scoreModel(left))[0] ?? null;

    return {
      role: request.role,
      privacyPreset: request.privacyPreset,
      selectedModelId: selected?.id ?? null,
      providerId: selected?.providerId ?? null,
      reason: selected
        ? buildRouteReason(selected, request.overrideModelId === selected.id)
        : "No eligible model is installed and allowed for this role.",
      overrideModelId: request.overrideModelId,
      rejected
    };
  }

  private async readOllamaSnapshot(): Promise<OllamaSnapshot> {
    const started = Date.now();
    try {
      const tags = await this.getOllama<OllamaTagsResponse>("/api/tags");
      const ps = await this.getOllama<OllamaPsResponse>("/api/ps");
      const installedModels = extractOllamaModelNames(tags.models ?? []);
      const loadedModels = extractOllamaModelNames(ps.models ?? []);
      return {
        health: {
          state: "healthy",
          detail: "Ollama API responded.",
          latencyMs: Date.now() - started
        },
        installedModels,
        loadedModels
      };
    } catch (error) {
      return {
        health: {
          state: "unhealthy",
          detail: error instanceof Error ? error.message : String(error),
          latencyMs: null
        },
        installedModels: [],
        loadedModels: []
      };
    }
  }

  private buildProviderStatuses(ollamaHealth: ModelProviderHealth): readonly ModelProviderStatus[] {
    return PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      endpoint: provider.id === "ollama" ? this.ollamaBaseUrl : provider.endpoint,
      enabled: provider.enabled,
      privacyBoundary: provider.privacyBoundary,
      requiresApiKey: provider.requiresApiKey,
      health: provider.id === "ollama"
        ? ollamaHealth
        : provider.kind === "local-artifact"
          ? {
              state: "unknown",
              detail: "Manual local runtime model source is registered; install and adapter detection are not automated yet.",
              latencyMs: null
            }
          : {
              state: "unknown",
              detail: "Adapter is registered but disabled until privacy and cost policy is configured.",
              latencyMs: null
            }
    }));
  }

  private buildModelRegistry(ollama: OllamaSnapshot): readonly ModelRegistryEntry[] {
    const installed = new Set(ollama.installedModels);
    const loaded = new Set(ollama.loadedModels);
    return SEED_MODELS.map((model) => ({
      ...model,
      installed: model.providerId === "ollama" ? installed.has(model.model) : false,
      loaded: model.providerId === "ollama" ? loaded.has(model.model) : false
    }));
  }

  private buildMarketplace(models: readonly ModelRegistryEntry[]): readonly ModelMarketplaceEntry[] {
    const modelById = new Map(models.map((model) => [model.id, model]));
    return SEED_MODELS.map((seed) => {
      const model = modelById.get(seed.id);
      const installed = model?.installed ?? false;
      const loaded = model?.loaded ?? false;
      const downloadState: ModelMarketplaceDownloadState = !seed.downloadSupported
        ? "source-only"
        : loaded
          ? "loaded"
          : installed
            ? "installed"
            : "available";
      return {
        id: marketplaceEntryId(seed.id),
        modelId: seed.id,
        providerId: seed.providerId,
        model: seed.model,
        label: seed.label,
        description: seed.notes,
        roles: seed.roles,
        lifecycle: seed.lifecycle,
        contextLength: seed.contextLength,
        capabilities: seed.capabilities,
        parameterCountB: seed.parameterCountB,
        marketplaceRank: seed.marketplaceRank,
        recommendedTaskProfileIds: seed.recommendedTaskProfileIds,
        sourceUrl: seed.sourceUrl,
        installCommand: buildInstallCommand(seed),
        runtimeKind: seed.runtimeKind,
        downloadSupported: seed.downloadSupported,
        preloadRecommended: seed.preloadRecommended,
        installed,
        loaded,
        downloadState,
        notes: seed.notes
      };
    }).sort((left, right) => {
      if (left.marketplaceRank !== null && right.marketplaceRank !== null) {
        return left.marketplaceRank - right.marketplaceRank;
      }
      if (left.marketplaceRank !== null) {
        return -1;
      }
      if (right.marketplaceRank !== null) {
        return 1;
      }
      return left.label.localeCompare(right.label);
    });
  }

  private buildTaskRoutePresets(
    models: readonly ModelRegistryEntry[],
    providers: readonly ModelProviderStatus[]
  ): readonly ModelTaskRoutePreset[] {
    return MODEL_TASK_PROFILES.map((profile) => {
      const overrides = this.taskRouteOverrides.get(profile.id);
      const assignments = uniqueModelRoles([profile.orchestratorRole, ...profile.specialistRoles]).map((role) => {
        const route = this.routeWithRegistry(models, providers, {
          role,
          privacyPreset: DEFAULT_PRIVACY_PRESET,
          overrideModelId: overrides?.get(role) ?? this.routeOverrides.get(role) ?? null
        });
        const selectedModel = route.selectedModelId
          ? models.find((model) => model.id === route.selectedModelId) ?? null
          : null;
        return {
          taskProfileId: profile.id,
          role,
          selectedModelId: route.selectedModelId,
          selectedModelLabel: selectedModel?.label ?? null,
          overrideModelId: route.overrideModelId,
          providerId: route.providerId,
          routeReason: route.reason
        };
      });

      return {
        taskProfileId: profile.id,
        taskProfileLabel: profile.label,
        assignments
      };
    });
  }

  private buildResourceSnapshot(ollama: OllamaSnapshot): ModelResourceSnapshot {
    return {
      checkedAt: this.now().toISOString(),
      totalMemoryBytes: totalmem(),
      freeMemoryBytes: freemem(),
      ollamaInstalledModels: ollama.installedModels,
      ollamaLoadedModels: ollama.loadedModels
    };
  }

  private async getOllama<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.ollamaBaseUrl}${path}`, {
      method: "GET"
    });
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  private async postOllama<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.ollamaBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  private pushBenchmark(result: ModelBenchmarkResult): void {
    this.benchmarks.push(result);
    if (this.benchmarks.length > 20) {
      this.benchmarks.splice(0, this.benchmarks.length - 20);
    }
  }
}

export function buildOllamaGenerateRequest(
  model: string,
  prompt: string,
  keepAlive: string | number
): { readonly model: string; readonly prompt: string; readonly stream: false; readonly keep_alive: string | number } {
  return {
    model,
    prompt,
    stream: false,
    keep_alive: keepAlive
  };
}

export function isModelRoleAlias(value: unknown): value is ModelRoleAlias {
  return typeof value === "string" && ROLE_SET.has(value);
}

export function isPrivacyPreset(value: unknown): value is ModelPrivacyPreset {
  return value === "offline-secure" ||
    value === "local-preferred" ||
    value === "balanced-hybrid" ||
    value === "best-quality" ||
    value === "lowest-cost" ||
    value === "manual";
}

export function isModelTaskProfileId(value: unknown): value is ModelTaskProfileId {
  return value === "computer-control" ||
    value === "knowledge-research" ||
    value === "code-change" ||
    value === "creative-media" ||
    value === "conversation" ||
    value === "voice-assistant";
}

function removeTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function marketplaceEntryId(modelId: string): string {
  return `market:${modelId}`;
}

function buildInstallCommand(model: SeedModel): string {
  if (model.runtimeKind === "ollama") {
    return `ollama pull ${model.model}`;
  }
  return `huggingface-cli download ${model.model}`;
}

function uniqueModelRoles(roles: readonly ModelRoleAlias[]): readonly ModelRoleAlias[] {
  return [...new Set(roles)];
}

function extractOllamaModelNames(models: readonly { readonly name?: string; readonly model?: string }[]): readonly string[] {
  return models
    .map((model) => model.name ?? model.model ?? "")
    .filter((model) => model.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function getModelRejection(
  model: ModelRegistryEntry,
  provider: ModelProviderStatus | undefined,
  privacyPreset: ModelPrivacyPreset
): string | null {
  if (!provider) {
    return "Provider is not registered.";
  }
  if (!provider.enabled) {
    return "Provider is disabled.";
  }
  if (!model.enabled) {
    return "Model is disabled.";
  }
  if (privacyPreset === "offline-secure" && provider.privacyBoundary !== "local") {
    return "Offline Secure allows local providers only.";
  }
  if (model.local && !model.installed) {
    return "Local model is not installed.";
  }
  if (provider.health.state === "unhealthy") {
    return "Provider health is unhealthy.";
  }
  return null;
}

function scoreModel(model: ModelRegistryEntry): number {
  let score = 0;
  if (model.local) {
    score += 40;
  }
  if (model.loaded) {
    score += 25;
  }
  if (model.installed) {
    score += 20;
  }
  if (model.lifecycle === "pinned") {
    score += 15;
  }
  if (model.lifecycle === "warm") {
    score += 10;
  }
  score += Math.min(model.contextLength / 8192, 10);
  return score;
}

function buildRouteReason(model: ModelRegistryEntry, isOverride: boolean): string {
  const source = isOverride ? "User override selected" : "Selected by local-first score";
  const loaded = model.loaded ? "loaded" : "not loaded";
  return `${source}: ${model.label} (${model.lifecycle}, ${loaded}).`;
}

function buildMemoryRecommendation(resources: ModelResourceSnapshot): ModelMemoryRecommendation {
  const loadedModelCount = resources.ollamaLoadedModels.length;
  const freeRatio = resources.totalMemoryBytes > 0
    ? resources.freeMemoryBytes / resources.totalMemoryBytes
    : 0;
  if (freeRatio < 0.12 || loadedModelCount >= 4) {
    return {
      status: "critical",
      loadedModelCount,
      freeMemoryBytes: resources.freeMemoryBytes,
      recommendation: "Unload on-demand and exclusive specialists before loading another task model."
    };
  }
  if (freeRatio < 0.25 || loadedModelCount >= 2) {
    return {
      status: "constrained",
      loadedModelCount,
      freeMemoryBytes: resources.freeMemoryBytes,
      recommendation: "Keep the orchestrator warm and load one specialist at a time for the active task."
    };
  }
  return {
    status: "ok",
    loadedModelCount,
    freeMemoryBytes: resources.freeMemoryBytes,
    recommendation: "Keep the orchestrator warm; specialists can be loaded on demand."
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isDirectOsToolRole(role: string): boolean {
  return DIRECT_OS_TOOL_PREFIXES.some((prefix) => role.startsWith(prefix));
}

function invalidResult(errors: readonly ModelPlanValidationError[]): ModelPlanValidationResult {
  return {
    valid: false,
    errors,
    acceptedStageIds: [],
    blockedStageIds: []
  };
}
