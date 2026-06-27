Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux24"
$OutputPath = Join-Path $Artifacts "command-composer-suggestions.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux24/command-composer-suggestions.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandComposerSuggestions");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const summaryIndex = appSource.indexOf('aria-label="Command draft summary"');
const suggestionsIndex = appSource.indexOf('aria-label="Command composer suggestions"');
const routeIndex = appSource.indexOf('aria-label="Command route preview"');

check(appSource.includes('type CommandComposerSuggestionTone = "info" | "warning" | "success"'), "Renderer must define typed suggestion tones.");
check(appSource.includes("type CommandComposerSuggestion"), "Renderer must define suggestion shape.");
check(appSource.includes('readonly id: "outcome" | "target" | "route" | "safety" | "length" | "approval" | "plan"'), "Suggestions must use fixed ids.");
check(appSource.includes("function buildCommandComposerSuggestions("), "Renderer must build suggestions locally.");
check(functionBlock.includes("const suggestions: CommandComposerSuggestion[] = []"), "Suggestion helper must build a local list.");
check(functionBlock.includes('label: "Describe outcome"'), "Suggestions must cover empty command outcome.");
check(functionBlock.includes('label: "Name a target"'), "Suggestions must cover empty command target.");
check(functionBlock.includes('label: "Shorten command"'), "Suggestions must cover over-limit commands.");
check(functionBlock.includes('label: "Revise blocked terms"'), "Suggestions must cover blocked terms.");
check(functionBlock.includes('label: "Restore approval"'), "Suggestions must cover approval policy gaps.");
check(functionBlock.includes('label: "Add target detail"'), "Suggestions must cover under-specified commands.");
check(functionBlock.includes('label: "Clarify route"'), "Suggestions must cover manual route commands.");
check(functionBlock.includes('label: "Make Plan"'), "Suggestions must cover ready commands.");
check(functionBlock.includes('if (suggestions.length === 0 && readiness.tone === "ready")'), "Ready suggestions must depend on readiness state.");
check(functionBlock.includes("return suggestions.slice(0, 3)"), "Suggestions must stay compact.");
check(!functionBlock.includes("createCommandPlan("), "Suggestion helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Suggestion helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Suggestion helper must not open a workspace.");
check(appSource.includes("const commandComposerSuggestions = buildCommandComposerSuggestions("), "Renderer must derive suggestions.");
check(appSource.includes('aria-label="Command composer suggestions"'), "Suggestions must be accessible.");
check(appSource.includes("commandComposerSuggestions.map((suggestion) =>"), "Renderer must render suggestions.");
check(summaryIndex >= 0 && suggestionsIndex > summaryIndex, "Suggestions must render after draft summary.");
check(suggestionsIndex >= 0 && routeIndex > suggestionsIndex, "Suggestions must render before route preview.");
check(styleSource.includes(".command-composer-suggestions"), "Suggestions CSS missing.");
check(styleSource.includes(".command-composer-suggestions li.warning"), "Warning suggestions CSS missing.");
check(styleSource.includes(".command-composer-suggestions li.success"), "Success suggestions CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  suggestions: ["outcome", "target", "route", "safety", "length", "approval", "plan"],
  tones: ["info", "warning", "success"],
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
            errors = @("Command composer suggestions validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
