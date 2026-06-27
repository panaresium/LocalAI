import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/voice-manager.js")).href;

test("Milestone 10 voice contracts define local explicit-capture policy", () => {
  const source = fs.readFileSync("packages/contracts/src/voice.ts", "utf8");
  assert.match(source, /MILESTONE10_VOICE_POLICY/);
  assert.match(source, /microphoneRequiresExplicitGrant:\s*true/);
  assert.match(source, /defaultCaptureMode:\s*"push-to-talk"/);
  assert.match(source, /wakeWordRequiresOptIn:\s*true/);
  assert.match(source, /bargeInEnabled:\s*true/);
  assert.match(source, /localOnly:\s*true/);
  assert.match(source, /externalAsrEnabled:\s*false/);
  assert.match(source, /externalTtsEnabled:\s*false/);
  assert.match(source, /supportedLanguages:\s*\["en", "th"\]/);
  assert.match(source, /thresholdRms:\s*0\.08/);
  assert.match(source, /password/);
  assert.match(source, /รหัสผ่าน/);
});

test("voice manager enforces microphone grant, VAD, ASR, TTS, wake word, and barge-in", async () => {
  const { VoiceManager } = await import(managerModulePath);
  const manager = new VoiceManager();
  assert.equal(manager.getState().policy.milestone, 10);

  assert.throws(
    () => manager.startCapture({ mode: "push-to-talk", language: "en" }),
    /Microphone permission must be granted/
  );

  let state = manager.setMicrophonePermission({ permission: "granted", deviceLabel: "Default microphone" });
  assert.equal(state.microphone.permission, "granted");

  state = manager.speak({ text: "Voice system ready", language: "en" });
  assert.equal(state.session.status, "speaking");
  assert.ok(state.activeTtsId);

  state = manager.startCapture({ mode: "push-to-talk", language: "en" });
  assert.equal(state.session.status, "listening");
  assert.equal(state.session.bargeInCount, 1);
  assert.equal(state.ttsQueue[0]?.status, "interrupted");
  assert.equal(state.ttsQueue[0]?.interruptReason, "barge-in");

  state = manager.submitUtterance({
    text: "Summarize this project",
    language: "en",
    rms: 0.32,
    durationMs: 1200
  });
  assert.equal(state.transcripts[0]?.status, "accepted");
  assert.equal(state.transcripts[0]?.commandDraft, "Summarize this project");
  assert.ok((state.transcripts[0]?.confidence ?? 0) >= 0.8);

  state = manager.submitUtterance({
    text: "quiet",
    language: "en",
    rms: 0.01,
    durationMs: 100
  });
  assert.equal(state.transcripts[0]?.status, "rejected");
  assert.match(state.transcripts[0]?.reason ?? "", /Voice activity detection/);

  state = manager.submitUtterance({
    text: "enter my password",
    language: "en",
    rms: 0.4,
    durationMs: 900
  });
  assert.equal(state.transcripts[0]?.status, "blocked");
  assert.match(state.transcripts[0]?.reason ?? "", /password/);

  state = manager.configure({ wakeWordEnabled: true, wakeWord: "เฮอร์มีส" });
  assert.equal(state.wakeWordEnabled, true);
  state = manager.startCapture({ mode: "wake-word", language: "th" });
  assert.equal(state.session.mode, "wake-word");

  state = manager.submitUtterance({
    text: "สรุปโครงการนี้",
    language: "th",
    rms: 0.31,
    durationMs: 1300
  });
  assert.equal(state.transcripts[0]?.status, "rejected");
  assert.match(state.transcripts[0]?.reason ?? "", /Wake word/);

  state = manager.submitUtterance({
    text: "เฮอร์มีส สรุปโครงการนี้",
    language: "th",
    rms: 0.31,
    durationMs: 1300
  });
  assert.equal(state.transcripts[0]?.status, "accepted");
  assert.equal(state.transcripts[0]?.wakeWordDetected, true);
  assert.equal(state.transcripts[0]?.commandDraft, "สรุปโครงการนี้");

  state = manager.runSelfTest();
  assert.equal(state.lastSelfTest?.status, "passed");
  assert.equal(state.lastSelfTest?.items.some((item) => item.language === "en"), true);
  assert.equal(state.lastSelfTest?.items.some((item) => item.language === "th"), true);
});

test("Studio exposes typed voice IPC without renderer shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(preloadSource, /getVoiceState/);
  assert.match(preloadSource, /startVoiceCapture/);
  assert.match(preloadSource, /submitVoiceUtterance/);
  assert.match(preloadSource, /speakVoice/);
  assert.match(preloadSource, /interruptVoice/);
  assert.match(mainSource, /VoiceManager/);
  assert.match(mainSource, /parseSubmitVoiceUtteranceRequest/);
  assert.match(mainSource, /parseStartVoiceCaptureRequest/);
  assert.match(rendererSource, /voice-workspace/);
  assert.match(rendererSource, /getUserMedia/);
  assert.match(rendererSource, /Submit Utterance/);
  assert.match(rendererSource, /Self-Test/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
});

test("Milestone 10 runner and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone10.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-voice-system.ps1"), true);
  assert.equal(fs.existsSync("apps/studio-desktop/src/main/voice-manager.ts"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json",
    "services/browser-control/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:1[0-9]|[2-9][0-9]+)$/, `${packagePath} should be a current milestone version`);
  }
});
