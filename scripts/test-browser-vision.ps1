Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone9"
$OutputPath = Join-Path $Artifacts "browser-vision.json"
$Runner = Join-Path $Root "services\browser-control\browser-vision-runner.mjs"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$result = [ordered]@{
    checkedAt = (Get-Date).ToString("o")
    runner = $Runner
    inspect = $null
    domGrounding = $null
    fallbackGrounding = $null
    errors = @()
}

function Invoke-NodeJson {
    param([string[]]$Arguments)
    $output = & node @Arguments 2>&1 | Out-String
    return [ordered]@{
        exitCode = $LASTEXITCODE
        output = $output.Trim()
    }
}

function Write-ResultAndExit {
    param([int]$ExitCode)
    $result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    $result | ConvertTo-Json -Depth 10
    exit $ExitCode
}

if (-not (Test-Path -LiteralPath $Runner)) {
    $result.errors += "Browser vision runner is missing."
    Write-ResultAndExit 1
}

$result.inspect = Invoke-NodeJson -Arguments @($Runner, "inspect", "--engine", "edge")
if ($result.inspect.exitCode -ne 0) {
    $result.errors += "Browser inspection command failed."
}
else {
    $inspectPayload = $result.inspect.output | ConvertFrom-Json
    if ($inspectPayload.command -ne "browser.inspect" -or $inspectPayload.engine -ne "edge" -or $inspectPayload.elements.Count -lt 3) {
        $result.errors += "Browser inspection returned invalid metadata."
    }
    if (-not (Test-Path -LiteralPath $inspectPayload.screenshotPath)) {
        $result.errors += "Browser inspection screenshot is missing."
    }
}

$result.domGrounding = Invoke-NodeJson -Arguments @($Runner, "ground", "--engine", "edge", "--query", "Run Browser Probe")
if ($result.domGrounding.exitCode -ne 0) {
    $result.errors += "DOM grounding command failed."
}
else {
    $groundPayload = $result.domGrounding.output | ConvertFrom-Json
    $selected = $groundPayload.candidates | Where-Object { $_.id -eq $groundPayload.selectedCandidateId } | Select-Object -First 1
    if ($groundPayload.command -ne "browser.ground" -or $groundPayload.requiresApproval -ne $false -or $null -eq $selected) {
        $result.errors += "DOM grounding did not select a high-confidence candidate."
    }
    elseif ($selected.confidence -lt 0.72 -or $selected.source -ne "dom") {
        $result.errors += "DOM grounding candidate confidence/source is invalid."
    }
    if (-not (Test-Path -LiteralPath $groundPayload.overlayPath)) {
        $result.errors += "DOM grounding overlay is missing."
    }
}

$result.fallbackGrounding = Invoke-NodeJson -Arguments @($Runner, "ground", "--engine", "edge", "--query", "zebra coordinate")
if ($result.fallbackGrounding.exitCode -ne 0) {
    $result.errors += "Fallback grounding command failed."
}
else {
    $fallbackPayload = $result.fallbackGrounding.output | ConvertFrom-Json
    $selected = $fallbackPayload.candidates | Where-Object { $_.id -eq $fallbackPayload.selectedCandidateId } | Select-Object -First 1
    if ($fallbackPayload.command -ne "browser.ground" -or $fallbackPayload.requiresApproval -ne $true -or $null -eq $selected) {
        $result.errors += "Fallback grounding did not require low-confidence approval."
    }
    elseif ($selected.confidence -ge 0.72) {
        $result.errors += "Fallback grounding confidence was not low."
    }
    if (-not (Test-Path -LiteralPath $fallbackPayload.overlayPath)) {
        $result.errors += "Fallback grounding overlay is missing."
    }
}

if ($result.errors.Count -gt 0) {
    Write-ResultAndExit 1
}

Write-ResultAndExit 0
