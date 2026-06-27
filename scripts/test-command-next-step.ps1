Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux29"
$OutputPath = Join-Path $Artifacts "command-next-step.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux29/command-next-step.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandNextStep");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const starterIndex = appSource.indexOf('aria-label="Command starter actions"');
const nextStepIndex = appSource.indexOf('aria-label="Command next step"');
const safetyIndex = appSource.indexOf('aria-label="Command safety preview"');

check(appSource.includes('type CommandNextStepTone = "idle" | "attention" | "blocked" | "ready"'), "Renderer must define typed next-step tones.");
check(appSource.includes("type CommandNextStep"), "Renderer must define next-step shape.");
check(appSource.includes("readonly action: string"), "Next-step summary must include action.");
check(appSource.includes("readonly guard: string"), "Next-step summary must include guard.");
check(appSource.includes("function buildCommandNextStep("), "Renderer must define next-step helper.");
check(appSource.includes("): CommandNextStep"), "Next-step helper must return typed summary.");
check(functionBlock.includes('label: "Choose a starter"'), "Next-step summary must cover idle state.");
check(functionBlock.includes('action: "No plan yet"'), "Next-step summary must explain idle action.");
check(functionBlock.includes('guard: "No automatic execution"'), "Next-step summary must explain idle guard.");
check(functionBlock.includes('label: "Revise blocked terms"'), "Next-step summary must cover blocked terms.");
check(functionBlock.includes('action: "Review-only draft"'), "Next-step summary must explain review-only draft.");
check(functionBlock.includes('label: "Restore approval policy"'), "Next-step summary must cover approval policy gaps.");
check(functionBlock.includes('guard: "No handoff"'), "Next-step summary must block handoff without approval.");
check(functionBlock.includes('tone: "attention"'), "Next-step summary must cover attention state.");
check(functionBlock.includes('label: "Make Plan"'), "Next-step summary must cover ready state.");
check(functionBlock.includes('guard: "No handoff before approval"'), "Next-step summary must preserve approval before handoff.");
check(!functionBlock.includes("createCommandPlan("), "Next-step helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Next-step helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Next-step helper must not open a workspace.");
check(appSource.includes("const commandNextStep = buildCommandNextStep("), "Renderer must derive next-step summary.");
check(appSource.includes('aria-label="Command next step"'), "Next-step summary must be accessible.");
check(appSource.includes("commandNextStep.action"), "Renderer must render next-step action.");
check(appSource.includes("commandNextStep.guard"), "Renderer must render next-step guard.");
check(starterIndex >= 0 && nextStepIndex > starterIndex, "Next-step summary must render after starter actions.");
check(nextStepIndex >= 0 && safetyIndex > nextStepIndex, "Next-step summary must render before safety preview.");
check(styleSource.includes(".command-next-step"), "Next-step CSS missing.");
check(styleSource.includes(".command-next-step.ready"), "Ready next-step CSS missing.");
check(styleSource.includes(".command-next-step.attention"), "Attention next-step CSS missing.");
check(styleSource.includes(".command-next-step.blocked"), "Blocked next-step CSS missing.");
check(styleSource.includes(".command-next-step.idle"), "Idle next-step CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  tones: ["idle", "attention", "blocked", "ready"],
  fields: ["label", "detail", "action", "guard"],
  displayOnly: true,
  approvalUnchanged: true,
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
            errors = @("Command next-step validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
