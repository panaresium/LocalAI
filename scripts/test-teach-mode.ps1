Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone12"
$OutputPath = Join-Path $Artifacts "teach-mode.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputPath = path.resolve("artifacts/milestone12/teach-mode.json");
const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/teach-mode-manager.js")).href;
const { TeachModeManager } = await import(managerModulePath);
const manager = new TeachModeManager();
const errors = [];
function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}
function selector(name, automationId = name.replace(/\s+/g, "")) {
  return {
    appProcess: "excel",
    windowTitle: "Quarterly workbook",
    automationId,
    name,
    controlType: "Button",
    bounds: null,
    semanticPath: ["excel", "Quarterly workbook", name]
  };
}

let state = manager.getState();
check(state.policy.milestone === 12, "Teach Mode policy milestone is not 12.");
check(state.policy.semanticSelectorsPreferred === true, "Semantic selector preference is missing.");
check(state.policy.replayRequiresApproval === true, "Replay approval policy is missing.");
check(state.policy.skillConversionRequiresApproval === true, "Skill conversion approval policy is missing.");

state = manager.startSession({ name: "Export report to PDF" });
const sessionId = state.activeSessionId;
check(Boolean(sessionId), "Teach Mode session did not start.");
manager.recordEvent({ kind: "app.focus", selector: selector("Excel app"), note: "Focus Excel." });
manager.recordEvent({ kind: "file.opened", selector: selector("Open workbook"), filePath: "D:\\Reports\\quarterly.xlsx", note: "Open approved workbook." });
manager.recordEvent({ kind: "ui.invoke", selector: selector("File"), note: "Open File menu." });
manager.recordEvent({ kind: "ui.set_value", selector: selector("Output folder"), text: "D:\\Exports", note: "Set output folder." });
manager.recordEvent({ kind: "file.created", selector: selector("Created PDF"), filePath: "D:\\Exports\\quarterly.pdf", note: "PDF output expected." });
state = manager.recordEvent({ kind: "final.state", selector: selector("Export complete"), text: "Export complete", note: "Final state observed." });
check(state.sessions[0]?.events.length === 6, "Expected six recorded events.");

state = manager.stopSession();
check(state.sessions[0]?.status === "stopped", "Teach Mode session did not stop.");

state = manager.generateWorkflow({ sessionId, name: "Export report to PDF" });
const workflow = state.workflows[0];
check(Boolean(workflow), "Workflow was not generated.");
check(workflow.yaml.includes("inputs:"), "Workflow YAML missing inputs.");
check(workflow.yaml.includes("verification:"), "Workflow YAML missing verification.");
check(workflow.parameters.length >= 2, "Workflow parameters were not extracted.");
check(workflow.verification.some((rule) => rule.kind === "file-exists"), "Workflow file verification missing.");
check(workflow.reliabilityScore >= 0.7, "Workflow reliability is too low.");

state = manager.createReplay({ workflowId: workflow.id });
const replay = state.replayPlans[0];
check(replay.requiresApproval === true && replay.dryRun === true, "Replay plan is not approval-gated dry-run.");
check(replay.blockedReasons.length === 0, "Semantic replay should not have blocked reasons.");
state = manager.reviewReplay({ replayId: replay.id, decision: "approve", reviewNote: "Controlled test approval." });
check(state.replayPlans[0]?.status === "approved", "Replay approval failed.");

state = manager.convertToSkill({ workflowId: workflow.id });
const skill = state.skillCandidates[0];
check(skill.status === "pending-approval", "Skill conversion should create a pending candidate.");
check(skill.body.includes("Workflow:"), "Skill body missing workflow.");
state = manager.reviewSkillCandidate({ candidateId: skill.id, decision: "approve", reviewNote: "Controlled test approval." });
check(state.skillCandidates[0]?.status === "approved", "Skill candidate approval failed.");

try {
  const blocked = new TeachModeManager();
  blocked.startSession({ name: "Blocked demo" });
  blocked.recordEvent({
    kind: "keyboard.input",
    selector: selector("Password field"),
    text: "my password"
  });
  errors.push("Sensitive Teach Mode content was not blocked.");
} catch (error) {
  check(String(error.message || error).includes("Blocked sensitive"), "Unexpected sensitive Teach Mode error.");
}

const result = {
  checkedAt: new Date().toISOString(),
  policy: state.policy,
  session: state.sessions[0] ?? null,
  workflow: state.workflows[0] ?? null,
  replay: state.replayPlans[0] ?? null,
  skillCandidate: state.skillCandidates[0] ?? null,
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
            errors = @("Teach Mode validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
