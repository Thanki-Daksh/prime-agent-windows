#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$ScriptDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not (Test-Path (Join-Path $ScriptDir "packages/coding-agent"))) {
    $FallbackDir = Join-Path $HOME "prime-agent"
    if (Test-Path (Join-Path $FallbackDir "packages/coding-agent")) {
        $ScriptDir = $FallbackDir
    }
}
$env:PRIME_AGENT_LAUNCHER_PATH = "$PSScriptRoot/prime-agent.ps1"

try {
    $BuildId = (git -C "$ScriptDir" describe --tags --always --dirty 2>$null)
    if ($BuildId) {
        $env:PRIME_AGENT_BUILD_ID = $BuildId.Trim()
    }
} catch {
}

$NoEnv = $false
$UseDist = $false
$PassthroughArgs = @()

foreach ($arg in $args) {
    if ($arg -eq "--no-env") {
        $NoEnv = $true
    } elseif ($arg -eq "--dist") {
        $UseDist = $true
    } else {
        $PassthroughArgs += $arg
    }
}

if ($NoEnv) {
    $KeysToUnset = @(
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_OAUTH_TOKEN",
        "OPENAI_API_KEY",
        "PRIME_API_KEY",
        "GEMINI_API_KEY",
        "GROQ_API_KEY",
        "CEREBRAS_API_KEY",
        "XAI_API_KEY",
        "OPENROUTER_API_KEY",
        "ZAI_API_KEY",
        "MISTRAL_API_KEY",
        "MINIMAX_API_KEY",
        "MINIMAX_CN_API_KEY",
        "AI_GATEWAY_API_KEY",
        "OPENCODE_API_KEY",
        "COPILOT_GITHUB_TOKEN",
        "GH_TOKEN",
        "GITHUB_TOKEN",
        "HF_TOKEN",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GOOGLE_CLOUD_PROJECT",
        "GCLOUD_PROJECT",
        "GOOGLE_CLOUD_LOCATION",
        "AWS_PROFILE",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
        "AWS_BEARER_TOKEN_BEDROCK",
        "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
        "AWS_CONTAINER_CREDENTIALS_FULL_URI",
        "AWS_WEB_IDENTITY_TOKEN_FILE",
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_BASE_URL",
        "AZURE_OPENAI_RESOURCE_NAME"
    )
    foreach ($key in $KeysToUnset) {
        Remove-Item "env:$key" -ErrorAction SilentlyContinue
    }
    Write-Host "Running Prime Agent without API keys..."
} else {
    $envFile = if (Test-Path ".env") { ".env" } elseif (Test-Path (Join-Path $ScriptDir ".env")) { Join-Path $ScriptDir ".env" } else { $null }
    if ($envFile) {
        Get-Content $envFile | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $parts = $line.Split("=", 2)
                $k = $parts[0].Trim()
                $v = $parts[1].Trim()
                if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
                elseif ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Substring(1, $v.Length - 2) }
                if ($v) {
                    [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
                }
            }
        }
    }
}

if ($UseDist) {
    $Bundle = Join-Path $ScriptDir "packages/coding-agent/dist/bundle/cli.js"
    if (-not (Test-Path $Bundle)) {
        [Console]::Error.WriteLine("Bundle not found at $Bundle. Run npm run build first.")
        exit 1
    }
    node $Bundle @PassthroughArgs
    exit $LASTEXITCODE
}

$TsxBin = Join-Path $ScriptDir "node_modules/.bin/tsx.cmd"
if (-not (Test-Path $TsxBin)) {
    $TsxBin = Join-Path $ScriptDir "node_modules/.bin/tsx"
}
if (-not (Test-Path $TsxBin)) {
    [Console]::Error.WriteLine("tsx not found at $TsxBin. Run npm install from the repo root first.")
    exit 1
}

$CliTs = Join-Path $ScriptDir "packages/coding-agent/src/cli.ts"
$TsConfig = Join-Path $ScriptDir "tsconfig.json"
& $TsxBin --tsconfig $TsConfig $CliTs @PassthroughArgs
exit $LASTEXITCODE
