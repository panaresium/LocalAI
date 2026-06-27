Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux21"
$OutputPath = Join-Path $Artifacts "command-plan-preview.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux21/command-plan-preview.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandPlanPreview");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const intentIndex = appSource.indexOf('aria-label="Command intent checklist"');
const previewIndex = appSource.indexOf('aria-label="Command plan preview"');
const blockedIndex = appSource.indexOf("Blocked terms:");

check(appSource.includes('type CommandPlanPreviewStepState = "ready" | "pending" | "blocked"'), "Renderer must define typed plan preview states.");
check(appSource.includes("type CommandPlanPreviewStep"), "Renderer must define plan preview shape.");
check(appSource.includes('readonly id: "confirm" | "approval" | "handoff"'), "Plan preview must use a fixed step id union.");
check(appSource.includes("readonly state: CommandPlanPreviewStepState"), "Plan preview must expose typed step state.");
check(appSource.includes("function buildCommandPlanPreview("), "Renderer must build command plan preview locally.");
check(functionBlock.includes("const hasCommand = command.trim().length > 0"), "Plan preview must detect empty command state.");
check(functionBlock.includes("const targetWorkspace = workspaceLabel(routePreview.workspace)"), "Plan preview must show target workspace.");
check(functionBlock.includes("const hasBlockers = blockedTerms.length > 0"), "Plan preview must detect blockers.");
check(functionBlock.includes('label: "Confirm"'), "Plan preview must include confirm step.");
check(functionBlock.includes('label: "Approval"'), "Plan preview must include approval step.");
check(functionBlock.includes('label: "Handoff"'), "Plan preview must include handoff step.");
check(functionBlock.includes("detail: hasCommand ? `${routePreview.intentLabel} intent` : \"Enter a command first\""), "Confirm step must preview intent.");
check(functionBlock.includes('"User approves before handoff"'), "Approval step must keep user approval explicit.");
check(functionBlock.includes('"Blocked plan stays review-only"'), "Approval step must explain blocked plans.");
check(functionBlock.includes('"No handoff until revised"'), "Handoff step must block unsafe handoff.");
check(functionBlock.includes("`Open ${targetWorkspace} after approval`"), "Handoff step must show target workspace after approval.");
check(functionBlock.includes('state: hasBlockers ? "blocked" : requiresApproval ? "pending" : "blocked"'), "Approval state must reflect policy and blockers.");
check(!functionBlock.includes("createCommandPlan("), "Plan preview helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Plan preview helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Plan preview helper must not open a workspace.");
check(appSource.includes("const commandPlanPreview = buildCommandPlanPreview("), "Renderer must derive command plan preview.");
check(appSource.includes('aria-label="Command plan preview"'), "Plan preview must be accessible.");
check(appSource.includes("commandPlanPreview.map((step) =>"), "Renderer must render preview steps.");
check(intentIndex >= 0 && previewIndex > intentIndex, "Plan preview must render after intent checklist.");
check(previewIndex >= 0 && blockedIndex > previewIndex, "Plan preview must render before blocked-term warning.");
check(styleSource.includes(".command-plan-preview"), "Plan preview CSS missing.");
check(styleSource.includes(".command-plan-preview li.ready"), "Ready plan preview CSS missing.");
check(styleSource.includes(".command-plan-preview li.pending"), "Pending plan preview CSS missing.");
check(styleSource.includes(".command-plan-preview li.blocked"), "Blocked plan preview CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  preview: ["confirm", "approval", "handoff"],
  states: ["ready", "pending", "blocked"],
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
            errors = @("Command plan preview validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
