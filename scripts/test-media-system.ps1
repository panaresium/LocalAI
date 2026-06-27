Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone11"
$OutputPath = Join-Path $Artifacts "media-system.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputPath = path.resolve("artifacts/milestone11/media-system.json");
const fixtureDir = path.resolve("artifacts/milestone11/test-media");
fs.mkdirSync(fixtureDir, { recursive: true });

const imagePath = path.join(fixtureDir, "local-image-probe.png");
const imageOcrPath = path.join(fixtureDir, "local-image-probe.ocr.txt");
const videoPath = path.join(fixtureDir, "local-video-probe.mp4");
const videoSidecarPath = path.join(fixtureDir, "local-video-probe.video.json");
fs.writeFileSync(imagePath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"));
fs.writeFileSync(imageOcrPath, "Invoice total 42 THB\n", "utf8");
fs.writeFileSync(videoPath, Buffer.from("controlled local video fixture"));
fs.writeFileSync(videoSidecarPath, JSON.stringify({
  durationSeconds: 8.5,
  hasAudio: true,
  width: 1280,
  height: 720,
  container: "mp4"
}, null, 2));

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/media-manager.js")).href;
const { MediaManager } = await import(managerModulePath);
const manager = new MediaManager(root);
const errors = [];
function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

let state = manager.getState();
check(state.policy.milestone === 11, "Media policy milestone is not 11.");
check(state.policy.localOnly === true, "Media policy must be local-only.");
check(state.policy.selectedFilesOnly === true, "Media policy must require selected files.");
check(state.policy.externalVisionEnabled === false, "External vision must be disabled.");

state = manager.importAssets({ filePaths: [imagePath, videoPath] });
const image = state.assets.find((asset) => asset.kind === "image");
const video = state.assets.find((asset) => asset.kind === "video");
check(Boolean(image), "Image fixture was not imported.");
check(Boolean(video), "Video fixture was not imported.");
check(image?.dimensions?.width === 1 && image?.dimensions?.height === 1, "PNG dimensions were not parsed.");

state = manager.understandImage({ assetId: image.id });
check(state.imageResults[0]?.labels.includes("local-image"), "Image labels did not include local-image.");
state = manager.runOcr({ assetId: image.id });
check(state.ocrResults[0]?.source === "sidecar", "OCR sidecar was not used.");
check(state.ocrResults[0]?.text.includes("Invoice total"), "OCR text mismatch.");

state = await manager.probeComfyUi();
check(Boolean(state.comfyUi), "ComfyUI probe did not record a result.");

state = manager.createImageGeneration({
  mode: "generate",
  prompt: "Clean local concept art"
});
check(fs.existsSync(state.generationResults[0]?.workflowPath ?? ""), "Generation workflow is missing.");
check(fs.existsSync(state.generationResults[0]?.previewPath ?? ""), "Generation preview is missing.");

state = manager.createImageGeneration({
  mode: "edit",
  prompt: "Sharpen local screenshot",
  sourceAssetId: image.id
});
check(state.generationResults[0]?.sourceAssetId === image.id, "Edit workflow did not retain source image.");

state = manager.probeVideo({ assetId: video.id });
check(state.videoProbes[0]?.durationSeconds === 8.5, "Video duration sidecar mismatch.");
check(state.videoProbes[0]?.hasAudio === true, "Video audio sidecar mismatch.");
state = manager.extractAudio({ assetId: video.id });
check(fs.existsSync(state.audioExtractions[0]?.outputPath ?? ""), "Audio extraction artifact is missing.");
state = manager.sampleKeyframes({ assetId: video.id, count: 3 });
check(state.keyframes.filter((keyframe) => keyframe.assetId === video.id).length === 3, "Keyframe count mismatch.");
state = manager.summarizeVideo({ assetId: video.id });
check(state.videoSummaries[0]?.summary.includes("3 sampled keyframe"), "Video summary did not include keyframe count.");

try {
  manager.createImageGeneration({ mode: "generate", prompt: "show my password" });
  errors.push("Sensitive image prompt was not blocked.");
} catch (error) {
  check(String(error.message || error).includes("Sensitive prompt"), "Unexpected sensitive prompt error.");
}

const result = {
  checkedAt: new Date().toISOString(),
  root,
  fixtureDir,
  policy: state.policy,
  importedAssets: state.assets,
  latestImageResult: state.imageResults[0] ?? null,
  latestOcrResult: state.ocrResults[0] ?? null,
  latestGeneration: state.generationResults[0] ?? null,
  latestVideoProbe: state.videoProbes[0] ?? null,
  latestAudioExtraction: state.audioExtractions[0] ?? null,
  keyframes: state.keyframes.filter((keyframe) => keyframe.assetId === video.id),
  latestVideoSummary: state.videoSummaries[0] ?? null,
  comfyUi: state.comfyUi,
  errors
};

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) {
  process.exitCode = 1;
}
'@

$output = $nodeScript | node --input-type=module 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    if (-not (Test-Path -LiteralPath $OutputPath)) {
        [ordered]@{
            checkedAt = (Get-Date).ToString("o")
            errors = @("Media system validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
