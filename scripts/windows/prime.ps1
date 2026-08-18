#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$ForwardArgs = @()
$SkipFirst = $true

foreach ($arg in $args) {
    if ($SkipFirst -and $arg -eq "agent") {
        $SkipFirst = $false
        continue
    }
    $SkipFirst = $false
    $ForwardArgs += $arg
}

& "$PSScriptRoot/prime-agent.ps1" @ForwardArgs
exit $LASTEXITCODE
