Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux2"
$OutputPath = Join-Path $Artifacts "workspace-navigation.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux2/workspace-navigation.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];
const workspaceIds = ["command", "control", "knowledge", "creation", "automation", "admin", "services"];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes("type WorkspaceId"), "Renderer must define typed workspace ids.");
check(appSource.includes("const WORKSPACES"), "Renderer must define workspace tab metadata.");
check(appSource.includes('useState<WorkspaceId>("command")'), "Renderer must default to the Command workspace.");
check(appSource.includes("workspaceBadges: Record<WorkspaceId, number>"), "Renderer must expose typed workspace badge counts.");
check(appSource.includes("workspace-${activeWorkspace}"), "Studio shell must include active workspace class.");
check(appSource.includes('className="workspace-nav"'), "Renderer must include workspace navigation.");
check(appSource.includes('aria-label="Studio workspace"'), "Workspace navigation must be named for accessibility.");
check(appSource.includes("aria-current"), "Active workspace must be exposed with aria-current.");
check(appSource.includes("setActiveWorkspace(workspace.id)"), "Workspace buttons must switch active workspace.");
check(appSource.includes("command-workspace"), "Command Center workspace must remain present.");

for (const id of workspaceIds) {
  check(appSource.includes(`id: "${id}"`), `Workspace metadata missing ${id}.`);
  check(styleSource.includes(`workspace-${id}`), `Workspace CSS missing ${id}.`);
}

check(styleSource.includes(".workspace-nav"), "Workspace navigation CSS missing.");
check(styleSource.includes(".workspace-nav button.active"), "Active workspace button CSS missing.");
check(styleSource.includes(".studio-shell.workspace-command"), "Command workspace grouping CSS missing.");
check(styleSource.includes(".studio-shell.workspace-services"), "Services workspace grouping CSS missing.");
check(styleSource.includes("display: none;"), "Workspace grouping must hide inactive modules.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  workspaceIds,
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
            errors = @("Workspace navigation validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
