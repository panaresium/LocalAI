Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux3"
$OutputPath = Join-Path $Artifacts "command-handoff.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux3/command-handoff.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes("CommandPlanRoute"), "Renderer must use typed command plan routes.");
check(appSource.includes("function workspaceForCommandRoute(route: CommandPlanRoute): WorkspaceId"), "Renderer must map routes to workspaces.");
check(appSource.includes('route === "computer-control" || route === "app-adapters"'), "Control routes must map together.");
check(appSource.includes('route === "automation" || route === "packaging-hardening"'), "Automation and packaging routes must map together.");
check(appSource.includes('if (route === "chat")') && appSource.includes('return "chat";'), "Chat routes must map to the Chat workspace.");
check(appSource.includes('if (route === "profile-config")') && appSource.includes('return "admin";'), "Profile routes must map to Admin.");
check(appSource.includes("setCommandHandoffMessage"), "Renderer must track command handoff status.");
check(appSource.includes("workspaceForCommandRoute(reviewedPlan.route)"), "Approval flow must resolve a target workspace.");
check(appSource.includes("setActiveWorkspace(nextWorkspace)"), "Approval flow must open the target workspace.");
check(appSource.includes('disabled={plan.status !== "approved"}'), "Open handoff button must require approved plans.");
check(appSource.includes("Opens {workspaceLabel(workspaceForCommandRoute(plan.route))}"), "Plan list must show the target workspace.");
check(appSource.includes("command-handoff"), "Renderer must render command handoff status.");
check(styleSource.includes(".command-handoff"), "Command handoff styling missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  mappedRoutes: {
    control: ["computer-control", "app-adapters"],
    automation: ["automation", "packaging-hardening"],
    chat: ["chat"],
    admin: ["profile-config"],
    knowledge: ["knowledge"],
    command: ["manual-review"]
  },
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
            errors = @("Command handoff validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
