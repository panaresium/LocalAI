Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux38"
$OutputPath = Join-Path $Artifacts "instruction-window-execution.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
Set-Location $Root

$output = node --test "tests\post-milestone-ux\instruction-window-execution.test.mjs" 2>&1 | Out-String
$exitCode = $LASTEXITCODE
$summary = [ordered]@{
    checkedAt = (Get-Date).ToString("o")
    test = "instruction-window-execution"
    exitCode = $exitCode
    output = $output.Trim()
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output ($summary | ConvertTo-Json -Depth 8)
exit $exitCode
