Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux18"
$OutputPath = Join-Path $Artifacts "command-intent-checklist.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux18/command-intent-checklist.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandIntentChecklist");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandIntentCheckState = "pass" | "hint" | "blocked"'), "Renderer must define typed intent checklist states.");
check(appSource.includes("type CommandIntentCheck"), "Renderer must define intent checklist shape.");
check(appSource.includes('readonly id: "intent" | "target" | "approval" | "safety"'), "Intent checklist must expose typed ids.");
check(appSource.includes("function buildCommandIntentChecklist("), "Renderer must build intent checklist locally.");
check(functionBlock.includes("const trimmedCommand = command.trim()"), "Intent checklist must trim command text.");
check(functionBlock.includes("const wordCount = trimmedCommand ? trimmedCommand.split(/\\s+/u).length : 0"), "Intent checklist must compute word count.");
check(functionBlock.includes('id: "intent"'), "Intent checklist must include intent gate.");
check(functionBlock.includes('routePreview.confidence === "matched"'), "Intent gate must use route preview confidence.");
check(functionBlock.includes('id: "target"'), "Intent checklist must include target gate.");
check(functionBlock.includes("wordCount >= 4"), "Target gate must ask for enough detail.");
check(functionBlock.includes('id: "approval"'), "Intent checklist must include approval gate.");
check(functionBlock.includes('requiresApproval ? "User approval required" : "Approval policy unavailable"'), "Approval gate must reflect approval policy.");
check(functionBlock.includes('id: "safety"'), "Intent checklist must include safety gate.");
check(functionBlock.includes('blockedTerms.length > 0 ? pluralize(blockedTerms.length, "blocked term", "blocked terms") : "No blocked terms"'), "Safety gate must reflect blocked terms.");
check(!functionBlock.includes("createCommandPlan("), "Intent checklist helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Intent checklist helper must not approve or reject a plan.");
check(appSource.includes("const commandIntentChecklist = buildCommandIntentChecklist("), "Renderer must derive command intent checklist.");
check(appSource.includes('aria-label="Command intent checklist"'), "Intent checklist must be accessible.");
check(appSource.includes("commandIntentChecklist.map((check) =>"), "Intent checklist must render each check.");
check(appSource.indexOf('aria-label="Command route preview"') > -1 && appSource.indexOf('aria-label="Command route preview"') < appSource.indexOf('aria-label="Command intent checklist"'), "Intent checklist must render after route preview.");
check(appSource.indexOf('aria-label="Command intent checklist"') > -1 && appSource.indexOf('aria-label="Command intent checklist"') < appSource.indexOf("Blocked terms:"), "Intent checklist must render before blocked-term details.");
check(styleSource.includes(".command-intent-checklist"), "Intent checklist CSS missing.");
check(styleSource.includes(".command-intent-checklist li.pass"), "Pass intent checklist CSS missing.");
check(styleSource.includes(".command-intent-checklist li.hint"), "Hint intent checklist CSS missing.");
check(styleSource.includes(".command-intent-checklist li.blocked"), "Blocked intent checklist CSS missing.");
check(preloadSource.includes("createCommandPlan"), "Intent checklist must leave create bridge intact.");
check(preloadSource.includes("reviewCommandPlan"), "Intent checklist must leave review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  checks: ["intent", "target", "approval", "safety"],
  states: ["pass", "hint", "blocked"],
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
            errors = @("Command intent checklist validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
