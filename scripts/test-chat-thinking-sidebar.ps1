Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux41"
$OutputPath = Join-Path $Artifacts "chat-thinking-sidebar.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
Set-Location $Root

$output = node --test "tests\post-milestone-ux\chat-thinking-sidebar.test.mjs" 2>&1 | Out-String
$exitCode = $LASTEXITCODE
$summary = [ordered]@{
    checkedAt = (Get-Date).ToString("o")
    test = "chat-thinking-sidebar"
    exitCode = $exitCode
    output = $output.Trim()
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output ($summary | ConvertTo-Json -Depth 8)
exit $exitCode
