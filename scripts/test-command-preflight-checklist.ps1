Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux27"
$OutputPath = Join-Path $Artifacts "command-preflight-checklist.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux27/command-preflight-checklist.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandPreflightChecklist");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const readinessIndex = appSource.indexOf('aria-label="Command readiness meter"');
const preflightIndex = appSource.indexOf('aria-label="Command preflight checklist"');
const draftIndex = appSource.indexOf('aria-label="Command draft summary"');

check(appSource.includes('type CommandPreflightTone = "ready" | "attention" | "blocked"'), "Renderer must define typed preflight tones.");
check(appSource.includes("type CommandPreflightItem"), "Renderer must define preflight item shape.");
check(appSource.includes('readonly id: "objective" | "route" | "safety" | "approval" | "execution"'), "Preflight checklist must use fixed ids.");
check(appSource.includes("function buildCommandPreflightChecklist("), "Renderer must define preflight checklist helper.");
check(appSource.includes("): readonly CommandPreflightItem[]"), "Preflight helper must return typed readonly items.");
check(functionBlock.includes('id: "objective"'), "Preflight checklist must include objective.");
check(functionBlock.includes('label: "Objective"'), "Preflight checklist must label objective.");
check(functionBlock.includes('"Add target or outcome"'), "Preflight checklist must guide target detail.");
check(functionBlock.includes('id: "route"'), "Preflight checklist must include route.");
check(functionBlock.includes('routePreview.confidence === "matched"'), "Preflight checklist must inspect local route confidence.");
check(functionBlock.includes('"Manual review route"'), "Preflight checklist must explain manual route state.");
check(functionBlock.includes('id: "safety"'), "Preflight checklist must include safety.");
check(functionBlock.includes('"No blocked terms"'), "Preflight checklist must explain clear safety state.");
check(functionBlock.includes('id: "approval"'), "Preflight checklist must include approval.");
check(functionBlock.includes('"User approval required"'), "Preflight checklist must explain approval requirement.");
check(functionBlock.includes('id: "execution"'), "Preflight checklist must include execution.");
check(functionBlock.includes('"Draft only before handoff"'), "Preflight checklist must explain draft-only execution.");
check(functionBlock.includes('silentExecutionAllowed ? "blocked" : "ready"'), "Preflight checklist must block silent execution.");
check(!functionBlock.includes("createCommandPlan("), "Preflight checklist helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Preflight checklist helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Preflight checklist helper must not open a workspace.");
check(appSource.includes("const commandPreflightChecklist = buildCommandPreflightChecklist("), "Renderer must derive preflight checklist.");
check(appSource.includes('aria-label="Command preflight checklist"'), "Preflight checklist must be accessible.");
check(appSource.includes("commandPreflightChecklist.map((item) =>"), "Renderer must render preflight items.");
check(readinessIndex >= 0 && preflightIndex > readinessIndex, "Preflight checklist must render after readiness meter.");
check(preflightIndex >= 0 && draftIndex > preflightIndex, "Preflight checklist must render before draft summary.");
check(styleSource.includes(".command-preflight-checklist"), "Preflight checklist CSS missing.");
check(styleSource.includes(".command-preflight-checklist li.ready"), "Ready preflight CSS missing.");
check(styleSource.includes(".command-preflight-checklist li.attention"), "Attention preflight CSS missing.");
check(styleSource.includes(".command-preflight-checklist li.blocked"), "Blocked preflight CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  gates: ["objective", "route", "safety", "approval", "execution"],
  tones: ["ready", "attention", "blocked"],
  localOnly: true,
  displayOnly: true,
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
            errors = @("Command preflight checklist validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
