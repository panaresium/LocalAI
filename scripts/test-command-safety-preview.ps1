Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux7"
$OutputPath = Join-Path $Artifacts "command-safety-preview.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux7/command-safety-preview.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes("function commandContainsBlockedTerm(command: string, term: string): boolean"), "Renderer must define local blocked-term preview helper.");
check(appSource.includes("commandPolicy = commandCenterState?.policy ?? null"), "Preview must use Command Center policy from state.");
check(appSource.includes("commandLengthLimit = commandPolicy?.maxCommandChars ?? 600"), "Preview must use policy command length limit.");
check(appSource.includes("commandCharsRemaining"), "Preview must show remaining command characters.");
check(appSource.includes("commandIsTooLong"), "Preview must track over-limit commands.");
check(appSource.includes("blockedCommandTerms"), "Preview must derive blocked terms.");
check(appSource.includes("commandContainsBlockedTerm(commandText, term)"), "Preview must use local blocked-term matcher.");
check(appSource.includes('className="command-safety-preview"'), "Renderer must render safety preview.");
check(appSource.includes('aria-label="Command safety preview"'), "Safety preview must be accessible.");
check(appSource.includes("maxLength={commandLengthLimit}"), "Command input must use policy length limit.");
check(appSource.includes("blockedCommandTerms.join(\", \")"), "Safety preview must show blocked terms.");
check(appSource.includes("A plan can be created for review, but it cannot be approved."), "Safety preview must preserve draft-plan review while warning approval is blocked.");
check(!appSource.includes("disabled={blockedCommandTerms"), "Safety preview must not silently block draft plan creation.");
check(styleSource.includes(".command-safety-preview"), "Safety preview CSS missing.");
check(styleSource.includes(".command-safety-note"), "Safety note CSS missing.");
check(preloadSource.includes("createCommandPlan"), "Preview must keep using existing createCommandPlan bridge.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  safetyPreview: {
    localPolicyDriven: true,
    showsBlockedTerms: true,
    usesLengthLimit: true,
    preservesDraftPlanReview: true
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
            errors = @("Command safety preview validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
