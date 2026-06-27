Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux15"
$OutputPath = Join-Path $Artifacts "command-revision-draft.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux15/command-revision-draft.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function useCommandRevisionDraft");
const functionEnd = appSource.indexOf("useEffect", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandRevisionDraftSource = "review-note" | "blockers" | "reviewed-note" | "default"'), "Renderer must define typed revision draft sources.");
check(appSource.includes("type CommandRevisionDraft"), "Renderer must define revision draft shape.");
check(appSource.includes("readonly sourcePlanId: string"), "Revision draft must retain source plan id.");
check(appSource.includes("readonly ready: boolean"), "Revision draft must expose readiness.");
check(appSource.includes("function limitCommandDraft(value: string, maxChars: number): string"), "Revision draft must be length limited.");
check(appSource.includes("function buildCommandRevisionDraft("), "Renderer must build command revision drafts locally.");
check(appSource.includes("const trimmedReviewNote = reviewNote.trim()"), "Revision draft must prefer current review note.");
check(appSource.includes('const blockedFeedback = plan.blockedReasons.join("; ")'), "Revision draft must use blocked reasons as fallback.");
check(appSource.includes('const reviewedNote = plan.reviewNote?.trim() ?? ""'), "Revision draft must use reviewed note as fallback.");
check(appSource.includes("Original command: ${plan.command}\\nFeedback: ${feedback}"), "Revision draft must preserve original command and feedback.");
check(appSource.includes('ready: source !== "default"'), "Revision draft must only become ready with real feedback.");
check(appSource.includes("const selectedCommandRevisionDraft = selectedCommandPlan"), "Renderer must derive selected revision draft.");
check(appSource.includes('aria-label="Command revision draft"'), "Revision draft must be accessible.");
check(appSource.includes("Use note for revision"), "Revision draft action missing.");
check(appSource.indexOf('className="text-field command-review-note"') > -1 && appSource.indexOf('className="text-field command-review-note"') < appSource.indexOf('aria-label="Command revision draft"'), "Revision draft must render below review note.");
check(functionBlock.includes("setCommandText(revisionDraft.command)"), "Revision action must fill command text.");
check(functionBlock.includes('setCommandPlanFilter("all")'), "Revision action must reset queue filter.");
check(functionBlock.includes("Press Make Plan to review it."), "Revision action must point user to Make Plan.");
check(!functionBlock.includes("window.hermesStudio.createCommandPlan"), "Revision action must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Revision action must not approve or reject a plan.");
check(styleSource.includes(".command-revision-draft"), "Revision draft CSS missing.");
check(styleSource.includes(".command-revision-draft.ready"), "Ready revision draft CSS missing.");
check(styleSource.includes(".command-revision-draft.idle"), "Idle revision draft CSS missing.");
check(preloadSource.includes("createCommandPlan"), "Revision draft must leave existing create bridge intact.");
check(preloadSource.includes("reviewCommandPlan"), "Revision draft must leave existing review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  sources: ["review-note", "blockers", "reviewed-note", "default"],
  localOnly: true,
  approvalUnchanged: true,
  createsPlan: false,
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
            errors = @("Command revision draft validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
