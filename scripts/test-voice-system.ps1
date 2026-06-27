Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone10"
$OutputPath = Join-Path $Artifacts "voice-system.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputPath = path.resolve("artifacts/milestone10/voice-system.json");
const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/voice-manager.js")).href;
const { VoiceManager } = await import(managerModulePath);
const manager = new VoiceManager();
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

let state = manager.getState();
check(state.policy.milestone === 10, "Voice policy milestone is not 10.");
check(state.policy.localOnly === true, "Voice policy must be local-only.");
check(state.policy.externalAsrEnabled === false, "External ASR must be disabled.");
check(state.policy.externalTtsEnabled === false, "External TTS must be disabled.");

try {
  manager.startCapture({ mode: "push-to-talk", language: "en" });
  errors.push("Voice capture started without microphone permission.");
} catch (error) {
  check(String(error.message || error).includes("Microphone permission"), "Unexpected microphone permission error.");
}

state = manager.setMicrophonePermission({ permission: "granted", deviceLabel: "Default microphone" });
check(state.microphone.permission === "granted", "Microphone permission was not granted.");

state = manager.speak({ text: "Voice system ready", language: "en" });
check(state.session.status === "speaking", "TTS did not enter speaking state.");
state = manager.startCapture({ mode: "push-to-talk", language: "en" });
check(state.session.bargeInCount === 1, "Barge-in did not interrupt active TTS.");
check(state.ttsQueue[0]?.status === "interrupted", "Active TTS was not interrupted.");

state = manager.submitUtterance({
  text: "Summarize this project",
  language: "en",
  rms: 0.32,
  durationMs: 1200
});
check(state.transcripts[0]?.status === "accepted", "English utterance was not accepted.");
check(state.transcripts[0]?.commandDraft === "Summarize this project", "English command draft mismatch.");

state = manager.configure({ wakeWordEnabled: true, wakeWord: "เฮอร์มีส" });
state = manager.startCapture({ mode: "wake-word", language: "th" });
state = manager.submitUtterance({
  text: "เฮอร์มีส สรุปโครงการนี้",
  language: "th",
  rms: 0.31,
  durationMs: 1300
});
check(state.transcripts[0]?.status === "accepted", "Thai wake-word utterance was not accepted.");
check(state.transcripts[0]?.wakeWordDetected === true, "Thai wake word was not detected.");

state = manager.submitUtterance({
  text: "enter my password",
  language: "en",
  rms: 0.4,
  durationMs: 900
});
check(state.transcripts[0]?.status === "blocked", "Sensitive voice command was not blocked.");

state = manager.runSelfTest();
check(state.lastSelfTest?.status === "passed", "Voice self-test did not pass.");

const result = {
  checkedAt: new Date().toISOString(),
  root,
  policy: state.policy,
  microphone: state.microphone,
  session: state.session,
  latestTranscript: state.transcripts[0] ?? null,
  lastSelfTest: state.lastSelfTest,
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
            errors = @("Voice system validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
