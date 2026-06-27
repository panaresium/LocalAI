Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ManifestPath = Join-Path $Root "ai_model_download_manifest.json"
$CheckpointDir = Join-Path $Root "artifacts\checkpoints"
$CheckpointPath = Join-Path $CheckpointDir "ollama-baseline.json"
New-Item -ItemType Directory -Force -Path $CheckpointDir | Out-Null

function Resolve-Ollama {
    $command = Get-Command "ollama" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
        "C:\Program Files\Ollama\ollama.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    throw "Ollama executable was not found. Install Ollama for Windows before pulling models."
}

function Read-Checkpoint {
    if (Test-Path -LiteralPath $CheckpointPath) {
        return Get-Content -LiteralPath $CheckpointPath -Raw | ConvertFrom-Json
    }

    return [pscustomobject]@{
        updatedAt = $null
        pulled = @()
        failed = @()
    }
}

function Write-Checkpoint {
    param(
        [string[]]$Pulled,
        [object[]]$Failed
    )

    [ordered]@{
        updatedAt = (Get-Date).ToString("o")
        pulled = $Pulled | Sort-Object -Unique
        failed = $Failed
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $CheckpointPath -Encoding UTF8
}

$ollama = Resolve-Ollama
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$checkpoint = Read-Checkpoint
$pulled = @($checkpoint.pulled)
$failed = @()

Write-Host "Using Ollama: $ollama"
& $ollama --version
if ($LASTEXITCODE -ne 0) {
    throw "ollama --version failed."
}

foreach ($entry in $manifest.ollama_models_baseline) {
    $model = [string]$entry.model
    if ($pulled -contains $model) {
        Write-Host "Skipping $model because checkpoint says it was already pulled."
        continue
    }

    Write-Host "Pulling $model ..."
    & $ollama pull $model
    if ($LASTEXITCODE -eq 0) {
        $pulled += $model
        Write-Checkpoint -Pulled $pulled -Failed $failed
        continue
    }

    $failure = [ordered]@{
        model = $model
        exitCode = $LASTEXITCODE
        at = (Get-Date).ToString("o")
    }
    $failed += $failure
    Write-Checkpoint -Pulled $pulled -Failed $failed
    throw "ollama pull $model failed with exit code $LASTEXITCODE."
}

Write-Checkpoint -Pulled $pulled -Failed $failed
Write-Host "Baseline Ollama pull checkpoint updated: $CheckpointPath"
