<#
.SYNOPSIS
  Pull baseline Ollama models for Hermes Local AI Studio prototype.

.PARAMETER IncludeOptional
  Also pull optional low-resource/stronger/future models.

.NOTES
  This script does not install Ollama. Install Ollama first from:
  https://ollama.com/download/windows
#>
param(
    [switch]$IncludeOptional
)

$ErrorActionPreference = "Stop"

function Assert-CommandExists {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found. Install Ollama first."
    }
}

Assert-CommandExists -Name "ollama"

Write-Host "Ollama version:" -ForegroundColor Cyan
ollama --version

$baseline = @(
    "qwen3.5:4b",
    "qwen3.5:9b",
    "qwen3-vl:4b",
    "qwen3-embedding:0.6b"
)

$optional = @(
    "qwen3.5:2b",
    "qwen3-vl:8b",
    "qwen3:0.6b",
    "qwen3.6"
)

$models = @()
$models += $baseline
if ($IncludeOptional) { $models += $optional }

foreach ($model in $models) {
    Write-Host "\nPulling $model ..." -ForegroundColor Green
    ollama pull $model
}

Write-Host "\nInstalled models:" -ForegroundColor Cyan
ollama list

Write-Host "\nTesting load/unload with qwen3.5:4b ..." -ForegroundColor Cyan
$bodyLoad = @{ model = "qwen3.5:4b"; prompt = ""; keep_alive = "1m" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:11434/api/generate" -Body $bodyLoad -ContentType "application/json" | Out-Null

Write-Host "Loaded models:" -ForegroundColor Cyan
Invoke-RestMethod -Method Get -Uri "http://localhost:11434/api/ps" | ConvertTo-Json -Depth 8

$bodyUnload = @{ model = "qwen3.5:4b"; prompt = ""; keep_alive = 0 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:11434/api/generate" -Body $bodyUnload -ContentType "application/json" | Out-Null

Write-Host "\nUnload command sent. Current loaded models:" -ForegroundColor Cyan
Invoke-RestMethod -Method Get -Uri "http://localhost:11434/api/ps" | ConvertTo-Json -Depth 8

Write-Host "\nDone." -ForegroundColor Green
