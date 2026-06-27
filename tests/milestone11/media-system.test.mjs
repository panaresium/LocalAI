import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/media-manager.js")).href;

function writeFixtures(suffix) {
  const fixtureDir = path.resolve("artifacts", "milestone11", `node-test-${suffix}`);
  fs.mkdirSync(fixtureDir, { recursive: true });
  const imagePath = path.join(fixtureDir, "local-image-probe.png");
  const videoPath = path.join(fixtureDir, "local-video-probe.mp4");
  fs.writeFileSync(imagePath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"));
  fs.writeFileSync(path.join(fixtureDir, "local-image-probe.ocr.txt"), "Thai label สวัสดี\n", "utf8");
  fs.writeFileSync(videoPath, Buffer.from("controlled local video fixture"));
  fs.writeFileSync(path.join(fixtureDir, "local-video-probe.video.json"), JSON.stringify({
    durationSeconds: 14.25,
    hasAudio: true,
    width: 1920,
    height: 1080,
    container: "mp4"
  }, null, 2));
  return { imagePath, videoPath };
}

test("Milestone 11 media contracts define local selected-file policy", () => {
  const source = fs.readFileSync("packages/contracts/src/media.ts", "utf8");
  assert.match(source, /MILESTONE11_MEDIA_POLICY/);
  assert.match(source, /localOnly:\s*true/);
  assert.match(source, /selectedFilesOnly:\s*true/);
  assert.match(source, /treatsMediaAsUntrusted:\s*true/);
  assert.match(source, /externalVisionEnabled:\s*false/);
  assert.match(source, /externalGenerationEnabled:\s*false/);
  assert.match(source, /comfyUiEndpoint:\s*"http:\/\/127\.0\.0\.1:8188"/);
  assert.match(source, /supportedImageExtensions/);
  assert.match(source, /supportedVideoExtensions/);
  assert.match(source, /VideoKeyframe/);
});

test("media manager handles image OCR, ComfyUI workflow, video probe, audio, keyframes, and summary", async () => {
  const { MediaManager } = await import(managerModulePath);
  const { imagePath, videoPath } = writeFixtures("pipeline");
  const manager = new MediaManager(path.resolve("."));

  let state = manager.getState();
  assert.equal(state.policy.milestone, 11);
  assert.equal(state.policy.localOnly, true);

  state = manager.importAssets({ filePaths: [imagePath, videoPath] });
  const image = state.assets.find((asset) => asset.kind === "image");
  const video = state.assets.find((asset) => asset.kind === "video");
  assert.ok(image, "expected image asset");
  assert.ok(video, "expected video asset");
  assert.equal(image.dimensions?.width, 1);
  assert.equal(image.dimensions?.height, 1);

  state = manager.understandImage({ assetId: image.id });
  assert.match(state.imageResults[0]?.summary ?? "", /local-image-probe\.png/);
  assert.equal(state.imageResults[0]?.warnings[0]?.includes("untrusted"), true);

  state = manager.runOcr({ assetId: image.id });
  assert.equal(state.ocrResults[0]?.source, "sidecar");
  assert.match(state.ocrResults[0]?.text ?? "", /สวัสดี/);

  state = await manager.probeComfyUi();
  assert.equal(state.comfyUi?.endpointUrl, "http://127.0.0.1:8188");

  state = manager.createImageGeneration({
    mode: "generate",
    prompt: "Clean local storyboard"
  });
  assert.equal(fs.existsSync(state.generationResults[0]?.workflowPath ?? ""), true);
  assert.equal(fs.existsSync(state.generationResults[0]?.previewPath ?? ""), true);
  assert.match(fs.readFileSync(state.generationResults[0]?.workflowPath ?? "", "utf8"), /externalGenerationEnabled/);

  state = manager.createImageGeneration({
    mode: "edit",
    prompt: "Improve selected screenshot",
    sourceAssetId: image.id
  });
  assert.equal(state.generationResults[0]?.sourceAssetId, image.id);

  state = manager.probeVideo({ assetId: video.id });
  assert.equal(state.videoProbes[0]?.durationSeconds, 14.25);
  assert.equal(state.videoProbes[0]?.dimensions?.width, 1920);
  assert.equal(state.videoProbes[0]?.hasAudio, true);

  state = manager.extractAudio({ assetId: video.id });
  assert.equal(fs.existsSync(state.audioExtractions[0]?.outputPath ?? ""), true);

  state = manager.sampleKeyframes({ assetId: video.id, count: 3 });
  assert.equal(state.keyframes.filter((keyframe) => keyframe.assetId === video.id).length, 3);
  assert.equal(state.keyframes.every((keyframe) => fs.existsSync(keyframe.imagePath)), true);

  state = manager.summarizeVideo({ assetId: video.id });
  assert.match(state.videoSummaries[0]?.summary ?? "", /3 sampled keyframe/);
  assert.equal(state.videoSummaries[0]?.audioExtracted, true);

  assert.throws(
    () => manager.createImageGeneration({ mode: "generate", prompt: "include password page" }),
    /Sensitive prompt/
  );
  assert.throws(
    () => manager.importAssets({ filePaths: [path.resolve("package.json")] }),
    /Unsupported media extension/
  );
});

test("Studio exposes typed media IPC without renderer filesystem or shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(preloadSource, /getMediaState/);
  assert.match(preloadSource, /selectMediaFiles/);
  assert.match(preloadSource, /createImageGeneration/);
  assert.match(preloadSource, /sampleVideoKeyframes/);
  assert.match(mainSource, /MediaManager/);
  assert.match(mainSource, /parseImageGenerationRequest/);
  assert.match(mainSource, /parseSampleVideoKeyframesRequest/);
  assert.match(rendererSource, /media-workspace/);
  assert.match(rendererSource, /Select Media/);
  assert.match(rendererSource, /Probe ComfyUI/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(rendererSource, /fs\.|readFile|writeFile|require\(/);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
});

test("Milestone 11 runner and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone11.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-media-system.ps1"), true);
  assert.equal(fs.existsSync("apps/studio-desktop/src/main/media-manager.ts"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json",
    "services/browser-control/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:1[1-9]|[2-9][0-9]+)$/, `${packagePath} should be a current milestone version`);
  }
});
