Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux8"
$OutputPath = Join-Path $Artifacts "command-queue-filters.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux8/command-queue-filters.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];
const filterIds = ["all", "draft", "approved", "rejected", "blocked"];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes("type CommandPlanFilter"), "Renderer must define typed command plan filters.");
check(appSource.includes("const COMMAND_PLAN_FILTERS"), "Renderer must define command plan filter metadata.");
for (const id of filterIds) {
  check(appSource.includes(`id: "${id}"`), `Command plan filter missing ${id}.`);
}
check(appSource.includes("function commandPlanMatchesFilter(plan: CommandPlan, filter: CommandPlanFilter): boolean"), "Renderer must filter plans through a typed helper.");
check(appSource.includes('filter === "blocked"'), "Renderer must support blocked plan filter.");
check(appSource.includes('plan.blockedReasons.length > 0'), "Blocked filter must use blocked reasons.");
check(appSource.includes('useState<CommandPlanFilter>("all")'), "Plan filter must default to all.");
check(appSource.includes("filteredCommandPlans = recentCommandPlans.filter"), "Renderer must derive filtered plans.");
check(appSource.includes("commandPlanFilterCounts: Record<CommandPlanFilter, number>"), "Renderer must derive typed filter counts.");
check(appSource.includes('className="command-plan-filter"'), "Renderer must render plan filter controls.");
check(appSource.includes('aria-label="Command plan filters"'), "Plan filter controls must be accessible.");
check(appSource.includes("setCommandPlanFilter(filter.id)"), "Plan filter controls must update local filter state.");
check(appSource.includes("filteredCommandPlans.map"), "Plan list must render filtered plans.");
check(appSource.includes("filteredCommandPlans.length === 0"), "Renderer must handle empty filtered results.");
check(!appSource.includes("reviewCommandPlan(filter"), "Plan filters must not review plans.");
check(styleSource.includes(".command-plan-filter"), "Command plan filter CSS missing.");
check(preloadSource.includes("reviewCommandPlan"), "Plan filters must leave existing review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  filterIds,
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
            errors = @("Command queue filter validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
