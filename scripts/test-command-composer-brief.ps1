Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux16"
$OutputPath = Join-Path $Artifacts "command-composer-brief.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux16/command-composer-brief.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandComposerBrief");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandComposerBriefTone = "empty" | "ready" | "blocked" | "limit"'), "Renderer must define typed composer brief tones.");
check(appSource.includes("type CommandComposerBrief"), "Renderer must define composer brief shape.");
check(appSource.includes("readonly nextAction: string"), "Composer brief must include next action.");
check(appSource.includes("readonly canPlan: boolean"), "Composer brief must include plan readiness.");
check(appSource.includes("function buildCommandComposerBrief("), "Renderer must build composer brief locally.");
check(functionBlock.includes("const trimmedCommand = command.trim()"), "Composer brief must trim command text.");
check(functionBlock.includes('tone: "empty"'), "Composer brief must cover empty state.");
check(functionBlock.includes('nextAction: "Enter a command"'), "Empty composer brief must guide command entry.");
check(functionBlock.includes('tone: "limit"'), "Composer brief must cover length limit state.");
check(functionBlock.includes('nextAction: "Shorten command"'), "Limit composer brief must guide shortening.");
check(functionBlock.includes('tone: "blocked"'), "Composer brief must cover blocked state.");
check(functionBlock.includes('nextAction: "Plan can be created but not approved"'), "Blocked composer brief must preserve review-only behavior.");
check(functionBlock.includes('tone: "ready"'), "Composer brief must cover ready state.");
check(functionBlock.includes('nextAction: "Make Plan"'), "Ready composer brief must point to plan creation.");
check(functionBlock.includes("canPlan: false"), "Composer brief must block empty or over-limit plan creation.");
check(functionBlock.includes("canPlan: true"), "Composer brief must allow ready and review-only plan creation.");
check(!functionBlock.includes("createCommandPlan("), "Composer brief helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Composer brief helper must not review a plan.");
check(appSource.includes("const commandComposerBrief = buildCommandComposerBrief(commandText, blockedCommandTerms, commandLengthLimit)"), "Renderer must derive command composer brief from command text and policy.");
check(appSource.includes('aria-label="Command composer brief"'), "Composer brief must be accessible.");
check(appSource.includes("command-composer-brief ${commandComposerBrief.tone}"), "Composer brief must render tone class.");
check(appSource.indexOf('aria-label="Command safety preview"') > -1 && appSource.indexOf('aria-label="Command safety preview"') < appSource.indexOf('aria-label="Command composer brief"'), "Composer brief must render after safety preview.");
check(appSource.indexOf('aria-label="Command composer brief"') > -1 && appSource.indexOf('aria-label="Command composer brief"') < appSource.indexOf('aria-label="Command presets"'), "Composer brief must render before presets.");
check(appSource.includes("disabled={!commandComposerBrief.canPlan}"), "Make Plan must use composer brief readiness.");
check(styleSource.includes(".command-composer-brief"), "Composer brief CSS missing.");
check(styleSource.includes(".command-composer-brief.ready"), "Ready composer brief CSS missing.");
check(styleSource.includes(".command-composer-brief.blocked"), "Blocked composer brief CSS missing.");
check(styleSource.includes(".command-composer-brief.limit"), "Limit composer brief CSS missing.");
check(styleSource.includes(".command-composer-brief.empty"), "Empty composer brief CSS missing.");
check(preloadSource.includes("createCommandPlan"), "Composer brief must leave create bridge intact.");
check(preloadSource.includes("reviewCommandPlan"), "Composer brief must leave review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  tones: ["empty", "ready", "blocked", "limit"],
  localOnly: true,
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
            errors = @("Command composer brief validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
