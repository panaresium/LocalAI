Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux3"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

function Resolve-PnpmRunner {
    $pnpm = Get-Command "pnpm" -ErrorAction SilentlyContinue
    if ($null -ne $pnpm) {
        return [ordered]@{
            FilePath = $pnpm.Source
            ArgsPrefix = @()
            Label = $pnpm.Source
        }
    }

    $bundledPnpm = (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd")
    if (Test-Path -LiteralPath $bundledPnpm) {
        return [ordered]@{
            FilePath = $bundledPnpm
            ArgsPrefix = @()
            Label = $bundledPnpm
        }
    }

    if ($null -ne (Get-Command "corepack" -ErrorAction SilentlyContinue)) {
        return [ordered]@{
            FilePath = "corepack"
            ArgsPrefix = @("pnpm")
            Label = "corepack pnpm"
        }
    }

    throw "pnpm 11.7.0 is required but was not found."
}

$nodeModules = (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules")
if (Test-Path -LiteralPath $nodeModules) {
    $env:NODE_PATH = $nodeModules
}

$pnpmRunner = Resolve-PnpmRunner

function Invoke-CapturedProcess {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = ($Arguments | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\"') + '"'
        }
        else {
            $_
        }
    }) -join " "
    $startInfo.WorkingDirectory = $Root.Path
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    $startInfo.StandardOutputEncoding = $Utf8NoBom
    $startInfo.StandardErrorEncoding = $Utf8NoBom

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return [ordered]@{
        exitCode = $process.ExitCode
        output = ($stdout.Trim(), $stderr.Trim() | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join "`n"
    }
}

function Limit-CapturedOutput {
    param(
        [string]$Output,
        [int]$MaxChars = 24000
    )

    if ([string]::IsNullOrEmpty($Output) -or $Output.Length -le $MaxChars) {
        return $Output
    }

    $headLength = [Math]::Floor($MaxChars / 2)
    $tailLength = $MaxChars - $headLength
    return $Output.Substring(0, $headLength) + "`n... output truncated by run-post-milestone-ux3.ps1 ...`n" + $Output.Substring($Output.Length - $tailLength)
}

$checks = @(
    @{ name = "post-milestone-ux2-regression"; command = "powershell"; args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\run-post-milestone-ux2.ps1") },
    @{ name = "desktop-build"; command = $pnpmRunner.FilePath; args = @($pnpmRunner.ArgsPrefix + @("--filter", "@hermes-local-ai/studio-desktop", "build")) },
    @{ name = "command-handoff"; command = "powershell"; args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\test-command-handoff.ps1") },
    @{ name = "command-handoff-node-tests"; command = "node"; args = @("--test", "tests\post-milestone-ux\*.test.mjs") }
)

$results = @()
foreach ($check in $checks) {
    Write-Host "Running $($check.name) ..."
    $capture = Invoke-CapturedProcess $check.command $check.args
    $results += [ordered]@{
        name = $check.name
        exitCode = $capture.exitCode
        output = Limit-CapturedOutput $capture.output
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
    pnpmRunner = $pnpmRunner.Label
    results = $results
    failed = $failed
}

$summaryPath = Join-Path $Artifacts "run-summary.json"
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$summary | ConvertTo-Json -Depth 8

if ($summary.failed.Count -gt 0) {
    exit 1
}
