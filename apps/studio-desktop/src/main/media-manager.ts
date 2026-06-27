import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

import type {
  ComfyUiProbeResult,
  ImageGenerationMode,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageOcrResult,
  ImageUnderstandingResult,
  ImportMediaAssetsRequest,
  MediaAsset,
  MediaAssetKind,
  MediaAssetRequest,
  MediaDimensions,
  MediaPolicy,
  MediaState,
  SampleVideoKeyframesRequest,
  SelectMediaAssetRequest,
  VideoAudioExtractionResult,
  VideoKeyframe,
  VideoProbeResult,
  VideoSummaryResult
} from "@hermes-local-ai/contracts";

const MILESTONE11_MEDIA_POLICY: MediaPolicy = {
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

type VideoSidecar = {
  readonly durationSeconds?: number;
  readonly hasAudio?: boolean;
  readonly width?: number;
  readonly height?: number;
  readonly container?: string;
};

export class MediaManager {
  private readonly artifactDir: string;
  private readonly generatedDir: string;
  private readonly keyframeDir: string;
  private readonly audioDir: string;
  private readonly assets: MediaAsset[] = [];
  private selectedAssetId: string | null = null;
  private readonly imageResults: ImageUnderstandingResult[] = [];
  private readonly ocrResults: ImageOcrResult[] = [];
  private comfyUi: ComfyUiProbeResult | null = null;
  private readonly generationResults: ImageGenerationResult[] = [];
  private readonly videoProbes: VideoProbeResult[] = [];
  private readonly audioExtractions: VideoAudioExtractionResult[] = [];
  private readonly keyframes: VideoKeyframe[] = [];
  private readonly videoSummaries: VideoSummaryResult[] = [];
  private nextAssetId = 1;
  private nextImageResultId = 1;
  private nextOcrId = 1;
  private nextGenerationId = 1;
  private nextVideoProbeId = 1;
  private nextAudioId = 1;
  private nextKeyframeId = 1;
  private nextSummaryId = 1;

  public constructor(private readonly root: string) {
    this.artifactDir = join(root, "artifacts", "milestone11");
    this.generatedDir = join(this.artifactDir, "generated");
    this.keyframeDir = join(this.artifactDir, "keyframes");
    this.audioDir = join(this.artifactDir, "audio");
    mkdirSync(this.generatedDir, { recursive: true });
    mkdirSync(this.keyframeDir, { recursive: true });
    mkdirSync(this.audioDir, { recursive: true });
  }

  public getState(): MediaState {
    return {
      policy: MILESTONE11_MEDIA_POLICY,
      assets: [...this.assets],
      selectedAssetId: this.selectedAssetId,
      imageResults: [...this.imageResults],
      ocrResults: [...this.ocrResults],
      comfyUi: this.comfyUi,
      generationResults: [...this.generationResults],
      videoProbes: [...this.videoProbes],
      audioExtractions: [...this.audioExtractions],
      keyframes: [...this.keyframes],
      videoSummaries: [...this.videoSummaries]
    };
  }

  public importAssets(request: ImportMediaAssetsRequest): MediaState {
    if (!Array.isArray(request.filePaths) || request.filePaths.length === 0) {
      throw new Error("At least one media file path is required.");
    }
    for (const filePath of request.filePaths) {
      this.importAssetPath(filePath);
    }
    this.selectedAssetId ??= this.assets[0]?.id ?? null;
    return this.getState();
  }

  public selectAsset(request: SelectMediaAssetRequest): MediaState {
    this.findAsset(request.assetId);
    this.selectedAssetId = request.assetId;
    return this.getState();
  }

  public understandImage(request: MediaAssetRequest): MediaState {
    const asset = this.findAsset(request.assetId);
    if (asset.kind !== "image") {
      throw new Error("Image understanding requires an image asset.");
    }
    const labels = buildImageLabels(asset);
    const warnings = [
      "Image-derived text and labels are untrusted. Verify before acting."
    ];
    const result: ImageUnderstandingResult = {
      id: `image-understanding-${this.nextImageResultId}`,
      assetId: asset.id,
      status: "completed",
      summary: buildImageSummary(asset, labels),
      labels,
      dimensions: asset.dimensions,
      warnings,
      createdAt: new Date().toISOString()
    };
    this.nextImageResultId += 1;
    this.imageResults.unshift(result);
    this.imageResults.splice(12);
    this.selectedAssetId = asset.id;
    return this.getState();
  }

  public runOcr(request: MediaAssetRequest): MediaState {
    const asset = this.findAsset(request.assetId);
    if (asset.kind !== "image") {
      throw new Error("OCR requires an image asset.");
    }
    const sidecar = readOcrSidecar(asset.sourcePath);
    const result: ImageOcrResult = {
      id: `image-ocr-${this.nextOcrId}`,
      assetId: asset.id,
      status: "completed",
      text: sidecar?.text ?? "",
      source: sidecar ? "sidecar" : "none",
      confidence: sidecar ? 0.91 : 0,
      warning: sidecar ? "OCR sidecar text is untrusted content." : "No OCR sidecar was found for this image.",
      createdAt: new Date().toISOString()
    };
    this.nextOcrId += 1;
    this.ocrResults.unshift(result);
    this.ocrResults.splice(12);
    this.selectedAssetId = asset.id;
    return this.getState();
  }

  public async probeComfyUi(): Promise<MediaState> {
    this.comfyUi = await probeLocalComfyUi(MILESTONE11_MEDIA_POLICY.comfyUiEndpoint);
    return this.getState();
  }

  public createImageGeneration(request: ImageGenerationRequest): MediaState {
    const mode = normalizeGenerationMode(request.mode);
    const prompt = normalizePrompt(request.prompt);
    const sourceAssetId = request.sourceAssetId ?? null;
    if (mode === "edit") {
      if (!sourceAssetId) {
        throw new Error("Image editing requires a source image asset.");
      }
      const source = this.findAsset(sourceAssetId);
      if (source.kind !== "image") {
        throw new Error("Image editing source must be an image asset.");
      }
    }

    const id = `image-generation-${this.nextGenerationId}`;
    const workflowPath = join(this.generatedDir, `${id}.comfy-workflow.json`);
    const previewPath = join(this.generatedDir, `${id}.png`);
    const workflow = {
      milestone: 11,
      localOnly: true,
      mode,
      prompt,
      sourceAssetId,
      comfyUiEndpoint: MILESTONE11_MEDIA_POLICY.comfyUiEndpoint,
      externalGenerationEnabled: false,
      note: "Workflow artifact only. Submit manually to a local ComfyUI instance after review."
    };
    writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`, "utf8");
    writeFileSync(previewPath, createPng(640, 360, prompt));

    const result: ImageGenerationResult = {
      id,
      mode,
      prompt,
      sourceAssetId,
      status: "completed",
      workflowPath,
      previewPath,
      previewUrl: pathToFileURL(previewPath).href,
      detail: "Created a local ComfyUI workflow and deterministic preview artifact; no external generation call was made.",
      createdAt: new Date().toISOString()
    };
    this.nextGenerationId += 1;
    this.generationResults.unshift(result);
    this.generationResults.splice(12);
    return this.getState();
  }

  public probeVideo(request: MediaAssetRequest): MediaState {
    const asset = this.findAsset(request.assetId);
    if (asset.kind !== "video") {
      throw new Error("Video probe requires a video asset.");
    }
    const sidecar = readVideoSidecar(asset.sourcePath);
    const dimensions = dimensionsFromSidecar(sidecar);
    const result: VideoProbeResult = {
      id: `video-probe-${this.nextVideoProbeId}`,
      assetId: asset.id,
      status: "completed",
      durationSeconds: normalizeOptionalDuration(sidecar?.durationSeconds) ?? asset.durationSeconds,
      hasAudio: sidecar?.hasAudio ?? false,
      dimensions,
      container: sidecar?.container ?? asset.extension.slice(1),
      metadataSource: sidecar ? "sidecar" : "extension",
      warnings: sidecar
        ? ["Video metadata sidecar is untrusted content."]
        : ["No ffprobe dependency is pinned yet; only extension-level metadata is available."],
      createdAt: new Date().toISOString()
    };
    this.nextVideoProbeId += 1;
    this.videoProbes.unshift(result);
    this.videoProbes.splice(12);
    this.selectedAssetId = asset.id;
    return this.getState();
  }

  public extractAudio(request: MediaAssetRequest): MediaState {
    const asset = this.findAsset(request.assetId);
    if (asset.kind !== "video") {
      throw new Error("Audio extraction requires a video asset.");
    }
    const id = `video-audio-${this.nextAudioId}`;
    const outputPath = join(this.audioDir, `${id}.wav`);
    writeFileSync(outputPath, createSilentWav());
    const result: VideoAudioExtractionResult = {
      id,
      assetId: asset.id,
      status: "completed",
      outputPath,
      detail: "Created a local silent WAV placeholder for the audio extraction contract; no external media tool was invoked.",
      createdAt: new Date().toISOString()
    };
    this.nextAudioId += 1;
    this.audioExtractions.unshift(result);
    this.audioExtractions.splice(12);
    this.selectedAssetId = asset.id;
    return this.getState();
  }

  public sampleKeyframes(request: SampleVideoKeyframesRequest): MediaState {
    const asset = this.findAsset(request.assetId);
    if (asset.kind !== "video") {
      throw new Error("Keyframe sampling requires a video asset.");
    }
    const count = normalizeKeyframeCount(request.count);
    const duration = this.latestVideoProbe(asset.id)?.durationSeconds ?? 12;
    for (let index = 0; index < count; index += 1) {
      const id = `video-keyframe-${this.nextKeyframeId}`;
      const timestampSeconds = Number((((index + 1) * duration) / (count + 1)).toFixed(2));
      const imagePath = join(this.keyframeDir, `${id}.png`);
      writeFileSync(imagePath, createPng(480, 270, `${asset.sha256}-${index}`));
      this.keyframes.unshift({
        id,
        assetId: asset.id,
        index,
        timestampSeconds,
        imagePath,
        imageUrl: pathToFileURL(imagePath).href
      });
      this.nextKeyframeId += 1;
    }
    this.keyframes.splice(24);
    this.selectedAssetId = asset.id;
    return this.getState();
  }

  public summarizeVideo(request: MediaAssetRequest): MediaState {
    const asset = this.findAsset(request.assetId);
    if (asset.kind !== "video") {
      throw new Error("Video summarization requires a video asset.");
    }
    const probe = this.latestVideoProbe(asset.id);
    const keyframeCount = this.keyframes.filter((keyframe) => keyframe.assetId === asset.id).length;
    const audioExtracted = this.audioExtractions.some((audio) => audio.assetId === asset.id && audio.status === "completed");
    const warnings = [
      "Video summary is based on local metadata, generated keyframe placeholders, and untrusted sidecar data."
    ];
    const result: VideoSummaryResult = {
      id: `video-summary-${this.nextSummaryId}`,
      assetId: asset.id,
      status: "completed",
      summary: buildVideoSummary(asset, probe, keyframeCount, audioExtracted),
      keyframeCount,
      audioExtracted,
      warnings,
      createdAt: new Date().toISOString()
    };
    this.nextSummaryId += 1;
    this.videoSummaries.unshift(result);
    this.videoSummaries.splice(12);
    this.selectedAssetId = asset.id;
    return this.getState();
  }

  private importAssetPath(filePath: string): MediaAsset {
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new Error("Invalid media file path.");
    }
    const sourcePath = resolve(filePath);
    if (!existsSync(sourcePath)) {
      throw new Error(`Media file does not exist: ${sourcePath}`);
    }
    const stats = statSync(sourcePath);
    if (!stats.isFile()) {
      throw new Error("Media asset path must be a file.");
    }
    const extension = extname(sourcePath).toLowerCase();
    const kind = mediaKindForExtension(extension);
    if (!kind) {
      throw new Error(`Unsupported media extension: ${extension}`);
    }
    const existing = this.assets.find((asset) => asset.sourcePath === sourcePath);
    if (existing) {
      this.selectedAssetId = existing.id;
      return existing;
    }
    const data = readFileSync(sourcePath);
    const dimensions = kind === "image" ? parseImageDimensions(extension, data) : null;
    const asset: MediaAsset = {
      id: `media-asset-${this.nextAssetId}`,
      kind,
      sourcePath,
      name: basename(sourcePath),
      extension,
      mimeType: mimeTypeForExtension(extension),
      sizeBytes: stats.size,
      sha256: createHash("sha256").update(data).digest("hex"),
      dimensions,
      durationSeconds: null,
      previewUrl: kind === "image" ? pathToFileURL(sourcePath).href : null,
      importedAt: new Date().toISOString()
    };
    this.nextAssetId += 1;
    this.assets.unshift(asset);
    this.assets.splice(24);
    this.selectedAssetId = asset.id;
    return asset;
  }

  private findAsset(assetId: string): MediaAsset {
    if (typeof assetId !== "string") {
      throw new Error("Invalid media asset id.");
    }
    const asset = this.assets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      throw new Error("Unknown media asset.");
    }
    return asset;
  }

  private latestVideoProbe(assetId: string): VideoProbeResult | null {
    return this.videoProbes.find((probe) => probe.assetId === assetId) ?? null;
  }
}

function mediaKindForExtension(extension: string): MediaAssetKind | null {
  if (MILESTONE11_MEDIA_POLICY.supportedImageExtensions.includes(extension)) {
    return "image";
  }
  if (MILESTONE11_MEDIA_POLICY.supportedVideoExtensions.includes(extension)) {
    return "video";
  }
  if (MILESTONE11_MEDIA_POLICY.supportedAudioExtensions.includes(extension)) {
    return "audio";
  }
  return null;
}

function mimeTypeForExtension(extension: string): string {
  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".mkv":
      return "video/x-matroska";
    case ".webm":
      return "video/webm";
    case ".avi":
      return "video/x-msvideo";
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".flac":
      return "audio/flac";
    case ".ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

function parseImageDimensions(extension: string, data: Buffer): MediaDimensions | null {
  if (extension === ".png" && data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return {
      width: data.readUInt32BE(16),
      height: data.readUInt32BE(20)
    };
  }
  if (extension === ".bmp" && data.length >= 26) {
    return {
      width: Math.abs(data.readInt32LE(18)),
      height: Math.abs(data.readInt32LE(22))
    };
  }
  return null;
}

function readOcrSidecar(sourcePath: string): { readonly text: string } | null {
  const base = sourcePath.slice(0, -extname(sourcePath).length);
  for (const candidate of [`${base}.ocr.txt`, `${base}.txt`]) {
    if (existsSync(candidate)) {
      return { text: readFileSync(candidate, "utf8").trim() };
    }
  }
  return null;
}

function readVideoSidecar(sourcePath: string): VideoSidecar | null {
  const base = sourcePath.slice(0, -extname(sourcePath).length);
  const candidate = `${base}.video.json`;
  if (!existsSync(candidate)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(candidate, "utf8")) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  return parsed as VideoSidecar;
}

function dimensionsFromSidecar(sidecar: VideoSidecar | null): MediaDimensions | null {
  if (
    sidecar &&
    typeof sidecar.width === "number" &&
    typeof sidecar.height === "number" &&
    Number.isInteger(sidecar.width) &&
    Number.isInteger(sidecar.height) &&
    sidecar.width > 0 &&
    sidecar.height > 0
  ) {
    return {
      width: sidecar.width,
      height: sidecar.height
    };
  }
  return null;
}

function normalizeOptionalDuration(value: number | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Number(value.toFixed(2));
}

function buildImageLabels(asset: MediaAsset): readonly string[] {
  const tokens = asset.name
    .replace(asset.extension, "")
    .split(/[^a-z0-9ก-๙]+/iu)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 1)
    .slice(0, 5);
  return [...new Set(["local-image", asset.extension.slice(1), ...tokens])];
}

function buildImageSummary(asset: MediaAsset, labels: readonly string[]): string {
  const size = asset.dimensions ? `${asset.dimensions.width} x ${asset.dimensions.height}` : "unknown dimensions";
  return `Local image ${asset.name} has ${size}, ${asset.sizeBytes} bytes, and labels: ${labels.join(", ")}.`;
}

function normalizeGenerationMode(value: unknown): ImageGenerationMode {
  if (value !== "generate" && value !== "edit") {
    throw new Error("Invalid image generation mode.");
  }
  return value;
}

function normalizePrompt(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Invalid image prompt.");
  }
  const prompt = value.trim();
  if (!prompt || prompt.length > 600) {
    throw new Error("Invalid image prompt.");
  }
  if (/password|passcode|mfa|otp|payment|credit card/iu.test(prompt)) {
    throw new Error("Sensitive prompt content is not allowed for image generation.");
  }
  return prompt;
}

function normalizeKeyframeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 6) {
    throw new Error("Keyframe count must be an integer from 1 to 6.");
  }
  return value;
}

async function probeLocalComfyUi(endpointUrl: string): Promise<ComfyUiProbeResult> {
  if (!endpointUrl.startsWith("http://127.0.0.1:") && !endpointUrl.startsWith("http://localhost:")) {
    throw new Error("ComfyUI endpoint must be localhost.");
  }

  return new Promise((resolveProbe) => {
    const checkedAt = new Date().toISOString();
    const request = http.get(`${endpointUrl}/system_stats`, { timeout: 800 }, (response) => {
      response.resume();
      resolveProbe({
        endpointUrl,
        available: response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 500,
        checkedAt,
        detail: `ComfyUI responded with HTTP ${response.statusCode ?? "unknown"}.`
      });
    });
    request.on("timeout", () => {
      request.destroy();
      resolveProbe({
        endpointUrl,
        available: false,
        checkedAt,
        detail: "ComfyUI probe timed out."
      });
    });
    request.on("error", (error) => {
      resolveProbe({
        endpointUrl,
        available: false,
        checkedAt,
        detail: error.message
      });
    });
  });
}

function buildVideoSummary(asset: MediaAsset, probe: VideoProbeResult | null, keyframeCount: number, audioExtracted: boolean): string {
  const duration = probe?.durationSeconds === null || probe?.durationSeconds === undefined ? "unknown duration" : `${probe.durationSeconds}s`;
  const dimensions = probe?.dimensions ? `${probe.dimensions.width} x ${probe.dimensions.height}` : "unknown frame size";
  return `Local video ${asset.name} has ${duration}, ${dimensions}, ${keyframeCount} sampled keyframe(s), and audio ${audioExtracted ? "extracted" : "not extracted"}.`;
}

function createSilentWav(): Buffer {
  const sampleRate = 16000;
  const samples = sampleRate;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function createPng(width: number, height: number, seed: string): Buffer {
  const rows: Buffer[] = [];
  const hash = createHash("sha256").update(seed).digest();
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + (width * 4));
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = 1 + (x * 4);
      row[offset] = (hash[0] ?? 80) ^ (x % 255);
      row[offset + 1] = (hash[8] ?? 120) ^ (y % 255);
      row[offset + 2] = (hash[16] ?? 180) ^ ((x + y) % 255);
      row[offset + 3] = 255;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", createIhdr(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createIhdr(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_value, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});
