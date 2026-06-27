Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux22"
$OutputPath = Join-Path $Artifacts "command-readiness-meter.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux22/command-readiness-meter.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandReadinessMeter");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const briefIndex = appSource.indexOf('aria-label="Command composer brief"');
const meterIndex = appSource.indexOf('aria-label="Command readiness meter"');
const routeIndex = appSource.indexOf('aria-label="Command route preview"');

check(appSource.includes('type CommandReadinessTone = "empty" | "needs-detail" | "blocked" | "ready"'), "Renderer must define typed readiness tones.");
check(appSource.includes("type CommandReadinessMeter"), "Renderer must define readiness meter shape.");
check(appSource.includes("readonly score: number"), "Readiness meter must expose a numeric score.");
check(appSource.includes("readonly nextStep: string"), "Readiness meter must expose the next step.");
check(appSource.includes("function buildCommandReadinessMeter("), "Renderer must build readiness locally.");
check(functionBlock.includes("const trimmedCommand = command.trim()"), "Readiness must trim command text.");
check(functionBlock.includes("const wordCount = trimmedCommand ? trimmedCommand.split(/\\s+/u).length : 0"), "Readiness must measure target detail.");
check(functionBlock.includes("const withinLimit = command.length <= maxChars"), "Readiness must respect the command length limit.");
check(functionBlock.includes('const hasMatchedRoute = routePreview.confidence === "matched"'), "Readiness must include route confidence.");
check(functionBlock.includes("const hasBlockers = blockedTerms.length > 0"), "Readiness must include blocker state.");
check(functionBlock.includes("const score = Math.min(100, Math.max(0,"), "Readiness must clamp score from local signals.");
check(functionBlock.includes('tone: "empty"'), "Readiness must cover empty commands.");
check(functionBlock.includes('label: "Too long"'), "Readiness must cover over-limit commands.");
check(functionBlock.includes('label: "Review only"'), "Readiness must cover blocked commands.");
check(functionBlock.includes('label: "Policy check"'), "Readiness must cover approval policy gaps.");
check(functionBlock.includes('label: "Needs target"'), "Readiness must ask for target detail.");
check(functionBlock.includes('label: "Needs route"'), "Readiness must ask for routing detail.");
check(functionBlock.includes('label: "Ready"'), "Readiness must cover ready commands.");
check(functionBlock.includes('nextStep: "Make Plan for approval"'), "Ready state must point to approval-gated planning.");
check(!functionBlock.includes("createCommandPlan("), "Readiness helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Readiness helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Readiness helper must not open a workspace.");
check(appSource.includes("const commandReadinessMeter = buildCommandReadinessMeter("), "Renderer must derive readiness meter.");
check(appSource.includes('aria-label="Command readiness meter"'), "Readiness meter must be accessible.");
check(appSource.includes("commandReadinessMeter.score"), "Readiness meter must render the score.");
check(appSource.includes('aria-label={`Readiness score ${commandReadinessMeter.score} percent`}'), "Readiness score must be accessible.");
check(appSource.includes("style={{ width: `${commandReadinessMeter.score}%` }}"), "Readiness meter must render progress width.");
check(briefIndex >= 0 && meterIndex > briefIndex, "Readiness meter must render after composer brief.");
check(meterIndex >= 0 && routeIndex > meterIndex, "Readiness meter must render before route preview.");
check(styleSource.includes(".command-readiness-meter"), "Readiness meter CSS missing.");
check(styleSource.includes(".command-readiness-meter.ready"), "Ready readiness CSS missing.");
check(styleSource.includes(".command-readiness-meter.needs-detail"), "Needs-detail readiness CSS missing.");
check(styleSource.includes(".command-readiness-meter.blocked"), "Blocked readiness CSS missing.");
check(styleSource.includes(".command-readiness-track"), "Readiness track CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  tones: ["empty", "needs-detail", "blocked", "ready"],
  score: "0-100",
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
            errors = @("Command readiness meter validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
