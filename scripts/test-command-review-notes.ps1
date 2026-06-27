Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux5"
$OutputPath = Join-Path $Artifacts "command-review-notes.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux5/command-review-notes.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes("commandReviewNote"), "Renderer must track a command review note.");
check(appSource.includes("setCommandReviewNote(\"\")"), "New plans must reset the command review note.");
check(appSource.includes("const selectedReviewNote = selectedCommandPlanId === planId ? commandReviewNote.trim() : \"\""), "Review flow must use the note only for the selected plan.");
check(appSource.includes("reviewNote: selectedReviewNote || defaultReviewNote"), "Review flow must send the selected note through review IPC.");
check(appSource.includes("setCommandReviewNote(reviewedPlan?.reviewNote ?? \"\")"), "Reviewed plans must show the stored review note.");
check(appSource.includes("setCommandReviewNote(plan.reviewNote ?? \"\")"), "Selecting a plan must load its stored review note.");
check(appSource.includes("className=\"text-field command-review-note\""), "Review panel must render the review note field.");
check(appSource.includes("maxLength={240}"), "Review note input must match command manager length limit.");
check(appSource.includes("disabled={selectedCommandPlan.status !== \"draft\"}"), "Review note must be read-only after review.");
check(styleSource.includes(".command-review-note"), "Review note CSS missing.");
check(mainSource.includes("value.reviewNote !== undefined && typeof value.reviewNote !== \"string\""), "Main process must validate reviewNote type.");
check(preloadSource.includes("reviewCommandPlan"), "Preload must expose only the typed review command bridge.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  reviewNotes: {
    localOnly: true,
    maxLength: 240,
    selectedPlanOnly: true,
    readOnlyAfterReview: true
  },
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
            errors = @("Command review note validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
