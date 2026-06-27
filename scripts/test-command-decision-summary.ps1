Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux9"
$OutputPath = Join-Path $Artifacts "command-decision-summary.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux9/command-decision-summary.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandDecisionTone = "ready" | "blocked" | "approved" | "rejected"'), "Renderer must define typed command decision tones.");
check(appSource.includes("type CommandDecisionSummary"), "Renderer must define command decision summary shape.");
check(appSource.includes("function summarizeCommandDecision(plan: CommandPlan): CommandDecisionSummary"), "Renderer must summarize selected command decisions.");
check(appSource.includes("plan.steps.filter((step) => step.requiresApproval).length"), "Decision summary must count approval steps.");
check(appSource.includes("pluralize(plan.blockedReasons.length, \"blocker\", \"blockers\")"), "Blocked summary must count blockers.");
check(appSource.includes('tone: "blocked"'), "Decision summary must support blocked tone.");
check(appSource.includes('nextAction: "Reject or re-plan"'), "Blocked summary must state next action.");
check(appSource.includes('plan.status === "approved"'), "Decision summary must support approved plans.");
check(appSource.includes('nextAction: "Open workspace"'), "Approved summary must state next action.");
check(appSource.includes('plan.status === "rejected"'), "Decision summary must support rejected plans.");
check(appSource.includes('nextAction: "Make a revised plan"'), "Rejected summary must state next action.");
check(appSource.includes('tone: "ready"'), "Decision summary must support ready draft plans.");
check(appSource.includes('nextAction: "Approve or reject"'), "Draft summary must state next action.");
check(appSource.includes("const selectedCommandDecision = selectedCommandPlan ? summarizeCommandDecision(selectedCommandPlan) : null"), "Renderer must derive selected command decision summary.");
check(appSource.includes('aria-label="Command decision summary"'), "Decision summary must be accessible.");
check(appSource.includes("selectedCommandDecision.nextAction"), "Decision summary must render next action.");
check(appSource.includes("command-decision-summary ${selectedCommandDecision.tone}"), "Decision summary must render tone class.");
check(!appSource.includes("summarizeCommandDecision(selectedCommandPlan.id"), "Decision summary must not review or mutate plans.");
check(styleSource.includes(".command-decision-summary"), "Decision summary CSS missing.");
check(styleSource.includes(".command-decision-summary.blocked div"), "Blocked decision summary CSS missing.");
check(styleSource.includes(".command-decision-summary.approved div"), "Approved decision summary CSS missing.");
check(preloadSource.includes("reviewCommandPlan"), "Decision summary must leave existing review bridge intact.");
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
            errors = @("Command decision summary validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
