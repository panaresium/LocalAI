Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone13"
$OutputPath = Join-Path $Artifacts "app-adapters.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputPath = path.resolve("artifacts/milestone13/app-adapters.json");
const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/app-adapter-manager.js")).href;
const { AppAdapterManager } = await import(managerModulePath);
const manager = new AppAdapterManager(path.resolve("."));
const errors = [];
function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

let state = manager.getState();
check(state.policy.milestone === 13, "App adapter policy milestone is not 13.");
check(state.policy.actionsRequireApproval === true, "Adapter approval policy is missing.");
check(state.policy.genericWindowsFallbackEnabled === true, "Generic Windows fallback policy is missing.");
check(state.adapters.length === 7, "Expected seven registered app adapters.");
check(state.adapters.some((adapter) => adapter.id === "file-explorer"), "File Explorer adapter missing.");
check(state.adapters.some((adapter) => adapter.id === "microsoft-office"), "Microsoft Office adapter missing.");
check(state.adapters.some((adapter) => adapter.id === "vscode-codex"), "VS Code/Codex adapter missing.");
check(state.adapters.some((adapter) => adapter.id === "browser"), "Browser adapter missing.");
check(state.adapters.some((adapter) => adapter.id === "powershell"), "PowerShell adapter missing.");
check(state.adapters.some((adapter) => adapter.id === "generic-windows"), "Generic Windows adapter missing.");
check(state.adapters.some((adapter) => adapter.id === "bambu-studio"), "Bambu Studio adapter missing.");

state = manager.probeAdapters({});
check(Boolean(state.lastProbedAt), "Adapter probe timestamp missing.");
const generic = state.adapters.find((adapter) => adapter.id === "generic-windows");
const bambu = state.adapters.find((adapter) => adapter.id === "bambu-studio");
check(generic?.detection.status === "fallback", "Generic Windows adapter should be fallback.");
check(bambu?.detection.status === "future", "Bambu Studio adapter should be future-only.");

const safePlan = manager.createPlan({
  adapterId: "file-explorer",
  action: "open-path",
  target: "D:\\LocalAI",
  intent: "Open the project folder for review.",
  context: [{ key: "source", value: "Milestone 13 validation" }]
});
check(safePlan.requiresApproval === true, "Safe adapter plan should require approval.");
check(safePlan.blockedReasons.length === 0, "Safe File Explorer plan should not be blocked.");
check(safePlan.steps.every((step) => typeof step.description === "string" && step.description.length > 0), "Plan steps missing descriptions.");

state = manager.reviewPlan({ planId: safePlan.id, decision: "approve", reviewNote: "Controlled validation approval." });
check(state.actionPlans[0]?.status === "approved", "Safe adapter plan approval failed.");

const blockedPlan = manager.createPlan({
  adapterId: "powershell",
  action: "run-command",
  target: "D:\\LocalAI",
  intent: "Delete generated files recursively.",
  context: []
});
check(blockedPlan.risk === "high", "Destructive PowerShell plan should be high risk.");
check(blockedPlan.blockedReasons.length > 0, "Destructive PowerShell plan should be blocked.");
try {
  manager.reviewPlan({ planId: blockedPlan.id, decision: "approve" });
  errors.push("Blocked adapter plan was approved.");
} catch (error) {
  check(String(error.message || error).includes("blocked reasons"), "Unexpected blocked-plan approval error.");
}

try {
  manager.createPlan({
    adapterId: "browser",
    action: "browser-inspect",
    target: "password manager",
    intent: "Inspect saved password settings.",
    context: []
  });
  errors.push("Credential-like adapter request was not blocked.");
} catch (error) {
  check(String(error.message || error).includes("credential-like"), "Unexpected credential blocking error.");
}

const bambuPlan = manager.createPlan({
  adapterId: "bambu-studio",
  action: "bambu-placeholder",
  target: "Bambu Studio",
  intent: "Prepare future printer workflow planning.",
  context: []
});
check(bambuPlan.blockedReasons.some((reason) => reason.includes("future")), "Bambu plan should be future-blocked.");

state = manager.getState();
const result = {
  checkedAt: new Date().toISOString(),
  policy: state.policy,
  adapters: state.adapters,
  safePlan,
  blockedPlan,
  bambuPlan,
  actionPlans: state.actionPlans,
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
            errors = @("App adapter validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
