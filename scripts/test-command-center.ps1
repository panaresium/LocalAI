Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux1"
$OutputPath = Join-Path $Artifacts "command-center.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputPath = path.resolve("artifacts/post-milestone-ux1/command-center.json");
const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/command-center-manager.js")).href;
const { CommandCenterManager } = await import(managerModulePath);
const manager = new CommandCenterManager();
const errors = [];
function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

let state = manager.getState();
check(state.policy.localPlanningOnly === true, "Command Center must plan locally.");
check(state.policy.externalAiPlanningAllowed === false, "External AI planning must be disabled.");
check(state.policy.requiresApproval === true, "Command Center must require approval.");
check(state.policy.silentExecutionAllowed === false, "Silent execution must be blocked.");

state = manager.createPlan({ command: "Create a backup and prepare a restore plan" });
let backupPlan = state.plans[0];
check(backupPlan.intent === "backup", "Backup command was not classified.");
check(backupPlan.route === "profile-config", "Backup command route mismatch.");
check(backupPlan.status === "draft", "New command plan should be draft.");
check(backupPlan.requiresApproval === true, "Command plan must require approval.");
check(backupPlan.steps.some((step) => step.requiresApproval), "Command plan should contain approval step.");

state = manager.reviewPlan({
  planId: backupPlan.id,
  decision: "approve",
  reviewNote: "Approved from validation."
});
backupPlan = state.plans.find((plan) => plan.id === backupPlan.id);
check(backupPlan?.status === "approved", "Approved command plan status mismatch.");

state = manager.createPlan({ command: "Package the app and generate installer checksums" });
check(state.plans[0]?.intent === "package", "Package command was not classified.");
check(state.plans[0]?.route === "packaging-hardening", "Package command route mismatch.");

state = manager.createPlan({ command: "Schedule a file trigger automation for STATUS.md" });
check(state.plans[0]?.intent === "automation", "Automation command was not classified.");
check(state.plans[0]?.route === "automation", "Automation route mismatch.");

state = manager.createPlan({ command: "Search local knowledge for packaging notes" });
check(state.plans[0]?.intent === "knowledge", "Knowledge command was not classified.");

state = manager.createPlan({ command: "Click the save button in the active window" });
check(state.plans[0]?.intent === "computer-control", "Computer-control command was not classified.");
check(state.plans[0]?.risk === "high", "Computer-control risk should be high.");

state = manager.createPlan({ command: "Enter password into administrator prompt" });
const blocked = state.plans[0];
check(blocked.blockedReasons.length > 0, "Sensitive command was not blocked.");
check(blocked.risk === "high", "Blocked command should be high risk.");
try {
  manager.reviewPlan({ planId: blocked.id, decision: "approve" });
  errors.push("Blocked command plan was approved.");
} catch (error) {
  check(String(error.message || error).includes("blocked"), "Unexpected blocked approval error.");
}

state = manager.reviewPlan({
  planId: blocked.id,
  decision: "reject",
  reviewNote: "Rejected blocked validation command."
});
check(state.plans[0]?.status === "rejected", "Blocked command was not rejected.");

const result = {
  checkedAt: new Date().toISOString(),
  policy: state.policy,
  plans: state.plans,
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
            errors = @("Command Center validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
