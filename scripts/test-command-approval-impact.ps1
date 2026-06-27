Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux20"
$OutputPath = Join-Path $Artifacts "command-approval-impact.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux20/command-approval-impact.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandApprovalImpact");
const functionEnd = appSource.indexOf("function summarizeCommandDecision", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandApprovalImpactTone = "ready" | "blocked" | "approved" | "rejected"'), "Renderer must define typed approval impact tones.");
check(appSource.includes("type CommandApprovalImpact"), "Renderer must define approval impact shape.");
check(appSource.includes("readonly approval: string"), "Approval impact must include approval effect.");
check(appSource.includes("readonly execution: string"), "Approval impact must include execution effect.");
check(appSource.includes("function buildCommandApprovalImpact("), "Renderer must build approval impact locally.");
check(functionBlock.includes('const execution = policy?.silentExecutionAllowed ? "Silent execution allowed by policy" : "No automatic execution"'), "Approval impact must explain silent execution policy.");
check(functionBlock.includes('approval: "Approval unlocks handoff"'), "Draft approval impact must explain approval effect.");
check(functionBlock.includes("handoff: `User opens ${handoffWorkspace}`"), "Draft approval impact must keep user handoff explicit.");
check(functionBlock.includes('audit: "Decision will be recorded"'), "Draft approval impact must explain audit outcome.");
check(functionBlock.includes('approval: "Approval blocked"'), "Blocked approval impact must explain blocked approval.");
check(functionBlock.includes("handoff: `Open ${handoffWorkspace}`"), "Approved approval impact must show open handoff.");
check(functionBlock.includes('execution: "No handoff"'), "Rejected approval impact must avoid handoff.");
check(!functionBlock.includes("createCommandPlan("), "Approval impact helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Approval impact helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Approval impact helper must not open a workspace.");
check(appSource.includes("const selectedCommandApprovalImpact = selectedCommandPlan ? buildCommandApprovalImpact(selectedCommandPlan, commandPolicy) : null"), "Renderer must derive selected approval impact.");
check(appSource.includes('aria-label="Command approval impact"'), "Approval impact must be accessible.");
check(appSource.includes("selectedCommandApprovalImpact.approval"), "Approval impact must render approval effect.");
check(appSource.includes("selectedCommandApprovalImpact.execution"), "Approval impact must render execution effect.");
check(appSource.includes("selectedCommandApprovalImpact.handoff"), "Approval impact must render handoff effect.");
check(appSource.includes("selectedCommandApprovalImpact.audit"), "Approval impact must render audit effect.");
check(appSource.indexOf('aria-label="Command step summary"') > -1 && appSource.indexOf('aria-label="Command step summary"') < appSource.indexOf('aria-label="Command approval impact"'), "Approval impact must render after step summary.");
check(appSource.indexOf('aria-label="Command approval impact"') > -1 && appSource.indexOf('aria-label="Command approval impact"') < appSource.indexOf('aria-label="Command approval checklist"'), "Approval impact must render before approval checklist.");
check(styleSource.includes(".command-approval-impact"), "Approval impact CSS missing.");
check(styleSource.includes(".command-approval-impact.blocked"), "Blocked approval impact CSS missing.");
check(styleSource.includes(".command-approval-impact.approved"), "Approved approval impact CSS missing.");
check(styleSource.includes(".command-approval-impact.rejected"), "Rejected approval impact CSS missing.");
check(preloadSource.includes("reviewCommandPlan"), "Approval impact must leave review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  impact: ["approval", "execution", "handoff", "audit"],
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
            errors = @("Command approval impact validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
