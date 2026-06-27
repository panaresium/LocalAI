Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux17"
$OutputPath = Join-Path $Artifacts "command-route-preview.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux17/command-route-preview.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandComposerRoutePreview");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandComposerRouteConfidence = "empty" | "matched" | "manual"'), "Renderer must define route preview confidence.");
check(appSource.includes("type CommandComposerRoutePreview"), "Renderer must define route preview shape.");
check(appSource.includes("readonly route: CommandPlanRoute"), "Route preview must expose typed route.");
check(appSource.includes("readonly workspace: WorkspaceId"), "Route preview must expose workspace target.");
check(appSource.includes('readonly risk: CommandPlan["risk"]'), "Route preview must expose typed risk.");
check(appSource.includes("function buildCommandComposerRoutePreview("), "Renderer must build route preview locally.");
check(functionBlock.includes("const text = command.toLowerCase()"), "Route preview must normalize command text.");
check(functionBlock.includes("blockedRisk"), "Route preview must account for blocked command risk.");
check(functionBlock.includes('route: "profile-config"') && functionBlock.includes('intentLabel: "Backup"'), "Route preview must cover backup/profile route.");
check(functionBlock.includes('route: "automation"') && functionBlock.includes('intentLabel: "Automation"'), "Route preview must cover automation route.");
check(functionBlock.includes('route: "knowledge"') && functionBlock.includes('intentLabel: "Knowledge"'), "Route preview must cover knowledge route.");
check(functionBlock.includes('route: "packaging-hardening"') && functionBlock.includes('intentLabel: "Packaging"'), "Route preview must cover packaging route.");
check(functionBlock.includes('route: "app-adapters"') && functionBlock.includes('intentLabel: "App adapter"'), "Route preview must cover app adapter route.");
check(functionBlock.includes('route: "computer-control"') && functionBlock.includes('intentLabel: "Computer control"'), "Route preview must cover computer control route.");
check(functionBlock.includes('route: "chat"') && functionBlock.includes('intentLabel: "Chat"'), "Route preview must cover chat route.");
check(functionBlock.includes('confidence: "manual"'), "Route preview must cover manual fallback.");
check(!functionBlock.includes("createCommandPlan("), "Route preview helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Route preview helper must not approve or reject a plan.");
check(appSource.includes("const commandComposerRoutePreview = buildCommandComposerRoutePreview(commandText, blockedCommandTerms)"), "Renderer must derive route preview from command text and blocked terms.");
check(appSource.includes('aria-label="Command route preview"'), "Route preview must be accessible.");
check(appSource.includes("command-route-preview ${commandComposerRoutePreview.confidence} risk-${commandComposerRoutePreview.risk}"), "Route preview must render confidence and risk classes.");
check(appSource.includes("workspaceLabel(commandComposerRoutePreview.workspace)"), "Route preview must render target workspace label.");
check(appSource.indexOf('aria-label="Command composer brief"') > -1 && appSource.indexOf('aria-label="Command composer brief"') < appSource.indexOf('aria-label="Command route preview"'), "Route preview must render after composer brief.");
check(appSource.indexOf('aria-label="Command route preview"') > -1 && appSource.indexOf('aria-label="Command route preview"') < appSource.indexOf('aria-label="Command presets"'), "Route preview must render before presets.");
check(styleSource.includes(".command-route-preview"), "Route preview CSS missing.");
check(styleSource.includes(".command-route-preview.empty"), "Empty route preview CSS missing.");
check(styleSource.includes(".command-route-preview.manual"), "Manual route preview CSS missing.");
check(styleSource.includes(".command-route-preview.risk-medium"), "Medium risk route preview CSS missing.");
check(styleSource.includes(".command-route-preview.risk-high"), "High risk route preview CSS missing.");
check(preloadSource.includes("createCommandPlan"), "Route preview must leave create bridge intact.");
check(preloadSource.includes("reviewCommandPlan"), "Route preview must leave review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  routes: ["profile-config", "automation", "knowledge", "packaging-hardening", "app-adapters", "computer-control", "chat", "manual-review"],
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
            errors = @("Command route preview validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
