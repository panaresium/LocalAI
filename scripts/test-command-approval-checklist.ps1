Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux11"
$OutputPath = Join-Path $Artifacts "command-approval-checklist.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux11/command-approval-checklist.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandApprovalCheckState = "pass" | "pending" | "blocked"'), "Renderer must define typed approval checklist states.");
check(appSource.includes("type CommandApprovalCheck"), "Renderer must define approval checklist item shape.");
check(appSource.includes("function buildCommandApprovalChecklist("), "Renderer must build approval checklist locally.");
check(appSource.includes('policy: CommandCenterState["policy"] | null'), "Approval checklist must use typed Command Center policy.");
check(appSource.includes('id: "review-state"'), "Checklist must include review state.");
check(appSource.includes('id: "blockers"'), "Checklist must include blockers.");
check(appSource.includes('id: "approval-policy"'), "Checklist must include approval policy.");
check(appSource.includes('id: "silent-execution"'), "Checklist must include silent execution policy.");
check(appSource.includes('id: "handoff-target"'), "Checklist must include handoff readiness.");
check(appSource.includes('policy?.requiresApproval && !reviewComplete ? "pending" : "pass"'), "Checklist must mark approval policy pending until review completes.");
check(appSource.includes('policy?.silentExecutionAllowed ? "blocked" : "pass"'), "Checklist must mark silent execution policy as blocked when enabled.");
check(appSource.includes("plan.blockedReasons.length > 0"), "Checklist must inspect blocked reasons.");
check(appSource.includes("const commandPolicy = commandCenterState?.policy ?? null"), "Renderer must derive command policy before checklist.");
check(appSource.includes("const selectedCommandApprovalChecklist = selectedCommandPlan ? buildCommandApprovalChecklist(selectedCommandPlan, commandPolicy) : []"), "Renderer must derive selected approval checklist.");
check(appSource.includes('className="command-approval-checklist"'), "Renderer must render approval checklist.");
check(appSource.includes('aria-label="Command approval checklist"'), "Approval checklist must be accessible.");
check(appSource.includes("selectedCommandApprovalChecklist.map"), "Approval checklist must render all checks.");
check(appSource.includes("className={check.state}"), "Approval checklist items must expose state class.");
check(!appSource.includes("buildCommandApprovalChecklist(selectedCommandPlan.id"), "Approval checklist must not review or mutate plans.");
check(styleSource.includes(".command-approval-checklist"), "Approval checklist CSS missing.");
check(styleSource.includes(".command-approval-checklist li.pass"), "Pass checklist CSS missing.");
check(styleSource.includes(".command-approval-checklist li.pending"), "Pending checklist CSS missing.");
check(styleSource.includes(".command-approval-checklist li.blocked"), "Blocked checklist CSS missing.");
check(preloadSource.includes("reviewCommandPlan"), "Approval checklist must leave existing review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  checklistStates: ["pass", "pending", "blocked"],
  gates: ["review-state", "blockers", "approval-policy", "silent-execution", "handoff-target"],
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
            errors = @("Command approval checklist validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
