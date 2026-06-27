Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone0"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeModules = (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules")
if (Test-Path -LiteralPath $nodeModules) {
    $env:NODE_PATH = $nodeModules
}

if ([string]::IsNullOrWhiteSpace($env:HERMES_MILESTONE0_RUN_CHAT)) {
    $env:HERMES_MILESTONE0_RUN_CHAT = "1"
}

$checks = @(
    @{ name = "environment"; command = "powershell"; args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\detect-environment.ps1") },
    @{ name = "node-tests"; command = "node"; args = @("--test", "tests\milestone0\*.test.mjs") },
    @{ name = "ollama-probe"; command = "node"; args = @("packages\ollama-client\src\probe.mjs") },
    @{ name = "browser-smoke"; command = "node"; args = @("services\browser-control\browser-smoke.mjs") },
    @{ name = "hermes-probe"; command = "node"; args = @("packages\hermes-client\src\probe.mjs") },
    @{ name = "windows-broker"; command = "powershell"; args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\test-windows-broker.ps1") }
)

$results = @()
foreach ($check in $checks) {
    Write-Host "Running $($check.name) ..."
    $output = & $check.command @($check.args) 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $results += [ordered]@{
        name = $check.name
        exitCode = $exitCode
        output = $output.Trim()
    }
}

$failed = @()
foreach ($result in $results) {
    if ($result["exitCode"] -ne 0) {
        $failed += $result["name"]
    }
}

$summary = [ordered]@{
    checkedAt = (Get-Date).ToString("o")
    results = $results
    failed = $failed
}

$summaryPath = Join-Path $Artifacts "run-summary.json"
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$summary | ConvertTo-Json -Depth 8

if ($summary.failed.Count -gt 0) {
    exit 1
}
