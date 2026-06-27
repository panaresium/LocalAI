export type MediaAssetKind = "image" | "video" | "audio";
export type MediaOperationStatus = "ready" | "completed" | "failed";
export type ImageGenerationMode = "generate" | "edit";

export interface MediaPolicy {
  readonly milestone: 11;
  readonly localOnly: true;
  readonly selectedFilesOnly: true;
  readonly treatsMediaAsUntrusted: true;
  readonly externalVisionEnabled: false;
  readonly externalGenerationEnabled: false;
  readonly comfyUiEndpoint: "http://127.0.0.1:8188";
  readonly comfyUiRequiresLocalhost: true;
  readonly supportedImageExtensions: readonly string[];
  readonly supportedVideoExtensions: readonly string[];
  readonly supportedAudioExtensions: readonly string[];
  readonly artifactRoot: "artifacts/milestone11";
}

export const MILESTONE11_MEDIA_POLICY: MediaPolicy = {
  milestone: 11,
  localOnly: true,
  selectedFilesOnly: true,
  treatsMediaAsUntrusted: true,
  externalVisionEnabled: false,
  externalGenerationEnabled: false,
  comfyUiEndpoint: "http://127.0.0.1:8188",
  comfyUiRequiresLocalhost: true,
  supportedImageExtensions: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"],
  supportedVideoExtensions: [".mp4", ".mov", ".mkv", ".webm", ".avi"],
  supportedAudioExtensions: [".wav", ".mp3", ".m4a", ".flac", ".ogg"],
  artifactRoot: "artifacts/milestone11"
};

export interface MediaDimensions {
  readonly width: number;
  readonly height: number;
}

export interface MediaAsset {
  readonly id: string;
  readonly kind: MediaAssetKind;
  readonly sourcePath: string;
  readonly name: string;
  readonly extension: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly dimensions: MediaDimensions | null;
  readonly durationSeconds: number | null;
  readonly previewUrl: string | null;
  readonly importedAt: string;
}

export interface ImageUnderstandingResult {
  readonly id: string;
  readonly assetId: string;
  readonly status: MediaOperationStatus;
  readonly summary: string;
  readonly labels: readonly string[];
  readonly dimensions: MediaDimensions | null;
  readonly warnings: readonly string[];
  readonly createdAt: string;
}

export interface ImageOcrResult {
  readonly id: string;
  readonly assetId: string;
  readonly status: MediaOperationStatus;
  readonly text: string;
  readonly source: "sidecar" | "none";
  readonly confidence: number;
  readonly warning: string | null;
  readonly createdAt: string;
}

export interface ComfyUiProbeResult {
  readonly endpointUrl: string;
  readonly available: boolean;
  readonly checkedAt: string;
  readonly detail: string;
}

export interface ImageGenerationResult {
  readonly id: string;
  readonly mode: ImageGenerationMode;
  readonly prompt: string;
  readonly sourceAssetId: string | null;
  readonly status: MediaOperationStatus;
  readonly workflowPath: string;
  readonly previewPath: string;
  readonly previewUrl: string;
  readonly detail: string;
  readonly createdAt: string;
}

export interface VideoProbeResult {
  readonly id: string;
  readonly assetId: string;
  readonly status: MediaOperationStatus;
  readonly durationSeconds: number | null;
  readonly hasAudio: boolean;
  readonly dimensions: MediaDimensions | null;
  readonly container: string;
  readonly metadataSource: "sidecar" | "extension";
  readonly warnings: readonly string[];
  readonly createdAt: string;
}

export interface VideoAudioExtractionResult {
  readonly id: string;
  readonly assetId: string;
  readonly status: MediaOperationStatus;
  readonly outputPath: string;
  readonly detail: string;
  readonly createdAt: string;
}

export interface VideoKeyframe {
  readonly id: string;
  readonly assetId: string;
  readonly index: number;
  readonly timestampSeconds: number;
  readonly imagePath: string;
  readonly imageUrl: string;
}

export interface VideoSummaryResult {
  readonly id: string;
  readonly assetId: string;
  readonly status: MediaOperationStatus;
  readonly summary: string;
  readonly keyframeCount: number;
  readonly audioExtracted: boolean;
  readonly warnings: readonly string[];
  readonly createdAt: string;
}

export interface MediaState {
  readonly policy: MediaPolicy;
  readonly assets: readonly MediaAsset[];
  readonly selectedAssetId: string | null;
  readonly imageResults: readonly ImageUnderstandingResult[];
  readonly ocrResults: readonly ImageOcrResult[];
  readonly comfyUi: ComfyUiProbeResult | null;
  readonly generationResults: readonly ImageGenerationResult[];
  readonly videoProbes: readonly VideoProbeResult[];
  readonly audioExtractions: readonly VideoAudioExtractionResult[];
  readonly keyframes: readonly VideoKeyframe[];
  readonly videoSummaries: readonly VideoSummaryResult[];
}

export interface ImportMediaAssetsRequest {
  readonly filePaths: readonly string[];
}

export interface SelectMediaAssetRequest {
  readonly assetId: string;
}

export interface MediaAssetRequest {
  readonly assetId: string;
}

export interface ImageGenerationRequest {
  readonly mode: ImageGenerationMode;
  readonly prompt: string;
  readonly sourceAssetId?: string | null;
}

export interface SampleVideoKeyframesRequest {
  readonly assetId: string;
  readonly count: number;
}
