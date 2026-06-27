Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux25"
$OutputPath = Join-Path $Artifacts "command-approval-gate.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux25/command-approval-gate.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandApprovalGate");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const gateIndex = appSource.indexOf('aria-label="Command approval gate"');
const buttonIndex = appSource.indexOf("Make Plan", gateIndex);

check(appSource.includes('type CommandApprovalGateTone = "disabled" | "blocked" | "ready"'), "Renderer must define typed approval gate tones.");
check(appSource.includes("type CommandApprovalGate"), "Renderer must define approval gate shape.");
check(appSource.includes("readonly approval: string"), "Approval gate must expose approval state.");
check(appSource.includes("readonly execution: string"), "Approval gate must expose execution posture.");
check(appSource.includes("readonly action: string"), "Approval gate must expose action state.");
check(appSource.includes("function buildCommandApprovalGate("), "Renderer must build approval gate locally.");
check(functionBlock.includes("const trimmedCommand = command.trim()"), "Approval gate must trim command text.");
check(functionBlock.includes('const execution = silentExecutionAllowed ? "Silent execution allowed by policy" : "No automatic execution"'), "Approval gate must explain execution posture.");
check(functionBlock.includes('label: "Waiting for command"'), "Approval gate must cover empty commands.");
check(functionBlock.includes('action: "Add command"'), "Approval gate must direct empty command input.");
check(functionBlock.includes("if (!composerBrief.canPlan)"), "Approval gate must respect Make Plan disabled state.");
check(functionBlock.includes('label: "Cannot create plan"'), "Approval gate must cover invalid command state.");
check(functionBlock.includes("detail: readiness.nextStep"), "Approval gate must reuse readiness guidance.");
check(functionBlock.includes('label: "Review-only plan"'), "Approval gate must cover blocked terms.");
check(functionBlock.includes('approval: "Approval blocked until revised"'), "Approval gate must explain blocked approval.");
check(functionBlock.includes('label: "Approval unavailable"'), "Approval gate must cover policy gaps.");
check(functionBlock.includes('approval: "Restore approval policy"'), "Approval gate must direct approval policy repair.");
check(functionBlock.includes('label: "Ready for draft"'), "Approval gate must cover ready state.");
check(functionBlock.includes('detail: "Make Plan creates a local draft only."'), "Approval gate must explain Make Plan effect.");
check(functionBlock.includes('approval: "User approval required before handoff"'), "Approval gate must keep approval explicit.");
check(!functionBlock.includes("createCommandPlan("), "Approval gate helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Approval gate helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Approval gate helper must not open a workspace.");
check(appSource.includes("const commandApprovalGate = buildCommandApprovalGate("), "Renderer must derive approval gate.");
check(appSource.includes('aria-label="Command approval gate"'), "Approval gate must be accessible.");
check(appSource.includes("commandApprovalGate.approval"), "Approval gate must render approval state.");
check(appSource.includes("commandApprovalGate.execution"), "Approval gate must render execution posture.");
check(appSource.includes("commandApprovalGate.action"), "Approval gate must render action state.");
check(gateIndex >= 0 && buttonIndex > gateIndex, "Approval gate must render before Make Plan button.");
check(styleSource.includes(".command-approval-gate"), "Approval gate CSS missing.");
check(styleSource.includes(".command-approval-gate.ready"), "Ready approval gate CSS missing.");
check(styleSource.includes(".command-approval-gate.blocked"), "Blocked approval gate CSS missing.");
check(styleSource.includes(".command-approval-gate.disabled"), "Disabled approval gate CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  gate: ["approval", "execution", "action"],
  tones: ["disabled", "blocked", "ready"],
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
            errors = @("Command approval gate validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
