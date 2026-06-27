Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone0"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

function Convert-Command {
    param([string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        return [ordered]@{
            found = $false
            source = $null
            version = $null
        }
    }

    return [ordered]@{
        found = $true
        source = $command.Source
        version = if ($null -ne $command.Version) { $command.Version.ToString() } else { $null }
    }
}

function Convert-EffectiveCommand {
    param(
        [string]$Name,
        [object]$FallbackProbe
    )

    $command = Convert-Command $Name
    if ($command.found) {
        return [ordered]@{
            found = $true
            source = $command.source
            version = $command.version
            sourceKind = "path"
        }
    }

    if ($null -ne $FallbackProbe -and $FallbackProbe.found) {
        return [ordered]@{
            found = $true
            source = $FallbackProbe.source
            version = $null
            sourceKind = "fallback"
        }
    }

    return [ordered]@{
        found = $false
        source = $null
        version = $null
        sourceKind = "missing"
    }
}

function Convert-ExecutableProbe {
    param([string[]]$Paths)

    foreach ($candidate in $Paths) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        if (Test-Path -LiteralPath $candidate) {
            return [ordered]@{
                found = $true
                source = $candidate
            }
        }
    }

    return [ordered]@{
        found = $false
        source = $null
    }
}

function Invoke-VersionProbe {
    param(
        [string]$Executable,
        [string[]]$Arguments
    )

    try {
        $output = & $Executable @Arguments 2>&1 | Out-String
        return [ordered]@{
            ok = $LASTEXITCODE -eq 0
            exitCode = $LASTEXITCODE
            output = $output.Trim()
        }
    }
    catch {
        return [ordered]@{
            ok = $false
            exitCode = $null
            output = $_.Exception.Message
        }
    }
}

function Get-MemoryInfo {
    try {
        Add-Type -AssemblyName Microsoft.VisualBasic
        $computerInfo = [Microsoft.VisualBasic.Devices.ComputerInfo]::new()
        return [ordered]@{
            totalPhysicalBytes = [uint64]$computerInfo.TotalPhysicalMemory
            availablePhysicalBytes = [uint64]$computerInfo.AvailablePhysicalMemory
            source = "Microsoft.VisualBasic.Devices.ComputerInfo"
        }
    }
    catch {
        return [ordered]@{
            totalPhysicalBytes = $null
            availablePhysicalBytes = $null
            source = "unavailable"
            error = $_.Exception.Message
        }
    }
}

function Get-CimSafe {
    param([string]$ClassName)

    try {
        return [ordered]@{
            ok = $true
            value = Get-CimInstance $ClassName -ErrorAction Stop
            error = $null
        }
    }
    catch {
        return [ordered]@{
            ok = $false
            value = $null
            error = $_.Exception.Message
        }
    }
}

$localAppData = $env:LOCALAPPDATA
$pnpmPathProbe = Convert-ExecutableProbe @(
    (Join-Path $env:APPDATA "npm\pnpm.cmd"),
    (Join-Path $localAppData "pnpm\pnpm.cmd"),
    (Join-Path $env:ProgramFiles "nodejs\pnpm.cmd"),
    (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd")
)
$hermesPathProbe = Convert-ExecutableProbe @(
    (Join-Path $localAppData "hermes\hermes-agent\venv\Scripts\hermes.exe"),
    (Join-Path $localAppData "hermes\hermes-agent\venv\Scripts\hermes.cmd")
)
$ollamaPathProbe = Convert-ExecutableProbe @(
    (Join-Path $localAppData "Programs\Ollama\ollama.exe"),
    "C:\Program Files\Ollama\ollama.exe"
)
$edgeProbe = Convert-ExecutableProbe @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$chromeProbe = Convert-ExecutableProbe @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

$computerSystem = Get-CimSafe "Win32_ComputerSystem"
$processor = Get-CimSafe "Win32_Processor"
$video = Get-CimSafe "Win32_VideoController"

$dotnetCommand = Convert-Command "dotnet"
$pnpmCommand = Convert-EffectiveCommand "pnpm" $pnpmPathProbe
$hermesCommand = Convert-EffectiveCommand "hermes" $hermesPathProbe
$ollamaCommand = Convert-EffectiveCommand "ollama" $ollamaPathProbe

$result = [ordered]@{
    checkedAt = (Get-Date).ToString("o")
    root = $Root.Path
    os = [ordered]@{
        versionString = [System.Environment]::OSVersion.VersionString
        is64Bit = [System.Environment]::Is64BitOperatingSystem
        machineName = [System.Environment]::MachineName
    }
    commands = [ordered]@{
        node = Convert-Command "node"
        npm = Convert-Command "npm"
        pnpm = $pnpmCommand
        python = Convert-Command "python"
        py = Convert-Command "py"
        dotnet = $dotnetCommand
        git = Convert-Command "git"
        ollama = $ollamaCommand
        hermes = $hermesCommand
        rg = Convert-Command "rg"
        ffmpeg = Convert-Command "ffmpeg"
    }
    fallbackPaths = [ordered]@{
        pnpm = $pnpmPathProbe
        hermes = $hermesPathProbe
        ollama = $ollamaPathProbe
        edge = $edgeProbe
        chrome = $chromeProbe
    }
    versions = [ordered]@{
        dotnet = if ($dotnetCommand.found) { Invoke-VersionProbe $dotnetCommand.source @("--info") } else { $null }
        pnpm = if ($pnpmCommand.found) { Invoke-VersionProbe $pnpmCommand.source @("--version") } else { $null }
        hermes = if ($hermesCommand.found) { Invoke-VersionProbe $hermesCommand.source @("--version") } else { $null }
        ollama = if ($ollamaCommand.found) { Invoke-VersionProbe $ollamaCommand.source @("--version") } else { $null }
    }
    hardware = [ordered]@{
        processorCount = [System.Environment]::ProcessorCount
        processorIdentifier = $env:PROCESSOR_IDENTIFIER
        memory = Get-MemoryInfo
        computerSystemCim = [ordered]@{
            ok = $computerSystem.ok
            error = $computerSystem.error
        }
        processorCim = [ordered]@{
            ok = $processor.ok
            error = $processor.error
        }
        videoControllerCim = [ordered]@{
            ok = $video.ok
            error = $video.error
        }
    }
}

if ($computerSystem.ok) {
    $result.hardware.computerSystem = $computerSystem.value | Select-Object Manufacturer,Model,SystemType,TotalPhysicalMemory
}
if ($processor.ok) {
    $result.hardware.processor = $processor.value | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors
}
if ($video.ok) {
    $result.hardware.videoController = $video.value | Select-Object Name,AdapterRAM,DriverVersion,DriverDate
}

$outputPath = Join-Path $Artifacts "environment.json"
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $outputPath -Encoding UTF8
$result | ConvertTo-Json -Depth 8
