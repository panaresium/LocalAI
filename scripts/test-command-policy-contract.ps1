Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux26"
$OutputPath = Join-Path $Artifacts "command-policy-contract.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux26/command-policy-contract.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandPolicyContract");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const safetyIndex = appSource.indexOf('aria-label="Command safety preview"');
const contractIndex = appSource.indexOf('aria-label="Command policy contract"');
const briefIndex = appSource.indexOf('aria-label="Command composer brief"');

check(appSource.includes('type CommandPolicyContractTone = "ready" | "warning" | "blocked"'), "Renderer must define typed policy contract tones.");
check(appSource.includes("type CommandPolicyContractItem"), "Renderer must define policy contract item shape.");
check(appSource.includes('readonly id: "planning" | "external-ai" | "approval" | "execution"'), "Policy contract must use fixed ids.");
check(appSource.includes('function buildCommandPolicyContract(policy: CommandCenterState["policy"] | null): readonly CommandPolicyContractItem[]'), "Renderer must build policy contract locally.");
check(functionBlock.includes('id: "planning"'), "Policy contract must include planning.");
check(functionBlock.includes('policy?.localPlanningOnly ? "Local deterministic planning" : "External planning may be used"'), "Policy contract must explain planning scope.");
check(functionBlock.includes('id: "external-ai"'), "Policy contract must include external AI calls.");
check(functionBlock.includes('policy?.externalAiPlanningAllowed ? "External AI planning allowed" : "No external AI planning"'), "Policy contract must explain external AI policy.");
check(functionBlock.includes('id: "approval"'), "Policy contract must include approval.");
check(functionBlock.includes('policy?.requiresApproval ? "User approval required" : "Approval policy unavailable"'), "Policy contract must explain approval policy.");
check(functionBlock.includes('id: "execution"'), "Policy contract must include execution.");
check(functionBlock.includes('policy?.silentExecutionAllowed ? "Silent execution allowed" : "No automatic execution"'), "Policy contract must explain execution policy.");
check(!functionBlock.includes("createCommandPlan("), "Policy contract helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Policy contract helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Policy contract helper must not open a workspace.");
check(appSource.includes("const commandPolicyContract = buildCommandPolicyContract(commandPolicy)"), "Renderer must derive policy contract.");
check(appSource.includes('aria-label="Command policy contract"'), "Policy contract must be accessible.");
check(appSource.includes("commandPolicyContract.map((item) =>"), "Renderer must render policy contract items.");
check(safetyIndex >= 0 && contractIndex > safetyIndex, "Policy contract must render after safety preview.");
check(contractIndex >= 0 && briefIndex > contractIndex, "Policy contract must render before composer brief.");
check(styleSource.includes(".command-policy-contract"), "Policy contract CSS missing.");
check(styleSource.includes(".command-policy-contract li.ready"), "Ready policy contract CSS missing.");
check(styleSource.includes(".command-policy-contract li.warning"), "Warning policy contract CSS missing.");
check(styleSource.includes(".command-policy-contract li.blocked"), "Blocked policy contract CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  contract: ["planning", "external-ai", "approval", "execution"],
  tones: ["ready", "warning", "blocked"],
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
            errors = @("Command policy contract validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
