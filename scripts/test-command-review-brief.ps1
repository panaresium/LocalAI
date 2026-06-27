Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux13"
$OutputPath = Join-Path $Artifacts "command-review-brief.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux13/command-review-brief.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandReviewBriefTone = "ready" | "blocked" | "approved" | "rejected"'), "Renderer must define typed review brief tones.");
check(appSource.includes("type CommandReviewBrief"), "Renderer must define review brief shape.");
check(appSource.includes("readonly primaryAction: string"), "Review brief must include primary action.");
check(appSource.includes("function buildCommandReviewBrief(plan: CommandPlan): CommandReviewBrief"), "Renderer must build the review brief locally.");
check(appSource.includes('headline: "Ready for your decision"'), "Review brief must cover ready draft plans.");
check(appSource.includes('primaryAction: "Approve or reject"'), "Ready brief must state primary action.");
check(appSource.includes('headline: "Revise before approval"'), "Review brief must cover blocked plans.");
check(appSource.includes('primaryAction: "Reject or re-plan"'), "Blocked brief must state primary action.");
check(appSource.includes('headline: "Approved for handoff"'), "Review brief must cover approved plans.");
check(appSource.includes('primaryAction: "Open workspace"'), "Approved brief must state primary action.");
check(appSource.includes('headline: "Plan rejected"'), "Review brief must cover rejected plans.");
check(appSource.includes('primaryAction: "Make a revised plan"'), "Rejected brief must state primary action.");
check(appSource.includes("const selectedCommandReviewBrief = selectedCommandPlan ? buildCommandReviewBrief(selectedCommandPlan) : null"), "Renderer must derive selected review brief.");
check(appSource.includes('aria-label="Command review brief"'), "Review brief must be accessible.");
check(appSource.includes("selectedCommandReviewBrief.primaryAction"), "Review brief must render primary action.");
check(appSource.includes("command-review-brief ${selectedCommandReviewBrief.tone}"), "Review brief must render tone class.");
check(!appSource.includes("buildCommandReviewBrief(selectedCommandPlan.id"), "Review brief must not review or mutate plans.");
check(styleSource.includes(".command-review-brief"), "Review brief CSS missing.");
check(styleSource.includes(".command-review-brief.ready"), "Ready review brief CSS missing.");
check(styleSource.includes(".command-review-brief.blocked"), "Blocked review brief CSS missing.");
check(styleSource.includes(".command-review-brief.approved"), "Approved review brief CSS missing.");
check(styleSource.includes(".command-review-brief.rejected"), "Rejected review brief CSS missing.");
check(preloadSource.includes("reviewCommandPlan"), "Review brief must leave existing review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  tones: ["ready", "blocked", "approved", "rejected"],
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
            errors = @("Command review brief validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
