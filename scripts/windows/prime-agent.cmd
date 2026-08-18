@echo off
setlocal enabledelayedexpansion

set "THIS_DIR=%~dp0"
for %%I in ("%THIS_DIR%..\..") do set "SCRIPT_DIR=%%~fI"

if not exist "%SCRIPT_DIR%\packages\coding-agent" (
    if exist "%USERPROFILE%\prime-agent\packages\coding-agent" (
        set "SCRIPT_DIR=%USERPROFILE%\prime-agent"
    )
)
set "PRIME_AGENT_LAUNCHER_PATH=%THIS_DIR%prime-agent.cmd"

for /f "tokens=*" %%i in ('git -C "%SCRIPT_DIR%" describe --tags --always --dirty 2^>nul') do (
    set "PRIME_AGENT_BUILD_ID=%%i"
)

set "NO_ENV=false"
set "USE_DIST=false"
set "ARGS="

:parse_args
if "%~1"=="" goto after_parse
if "%~1"=="--no-env" (
    set "NO_ENV=true"
    shift
    goto parse_args
)
if "%~1"=="--dist" (
    set "USE_DIST=true"
    shift
    goto parse_args
)
set "ARG=%~1"
set "ARG=%ARG:"=\"%"
if not defined ARGS (
    set "ARGS="%ARG%""
) else (
    set "ARGS=!ARGS! "%ARG%""
)
shift
goto parse_args

:after_parse
if "%NO_ENV%"=="true" (
    set "ANTHROPIC_API_KEY="
    set "ANTHROPIC_OAUTH_TOKEN="
    set "OPENAI_API_KEY="
    set "PRIME_API_KEY="
    set "GEMINI_API_KEY="
    set "GROQ_API_KEY="
    set "CEREBRAS_API_KEY="
    set "XAI_API_KEY="
    set "OPENROUTER_API_KEY="
    set "ZAI_API_KEY="
    set "MISTRAL_API_KEY="
    set "MINIMAX_API_KEY="
    set "MINIMAX_CN_API_KEY="
    set "AI_GATEWAY_API_KEY="
    set "OPENCODE_API_KEY="
    set "COPILOT_GITHUB_TOKEN="
    set "GH_TOKEN="
    set "GITHUB_TOKEN="
    set "HF_TOKEN="
    set "GOOGLE_APPLICATION_CREDENTIALS="
    set "GOOGLE_CLOUD_PROJECT="
    set "GCLOUD_PROJECT="
    set "GOOGLE_CLOUD_LOCATION="
    set "AWS_PROFILE="
    set "AWS_ACCESS_KEY_ID="
    set "AWS_SECRET_ACCESS_KEY="
    set "AWS_SESSION_TOKEN="
    set "AWS_REGION="
    set "AWS_DEFAULT_REGION="
    set "AWS_BEARER_TOKEN_BEDROCK="
    set "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI="
    set "AWS_CONTAINER_CREDENTIALS_FULL_URI="
    set "AWS_WEB_IDENTITY_TOKEN_FILE="
    set "AZURE_OPENAI_API_KEY="
    set "AZURE_OPENAI_BASE_URL="
    set "AZURE_OPENAI_RESOURCE_NAME="
    echo Running Prime Agent without API keys...
) else (
    if exist ".env" (
        for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
            if not "%%b"=="" set "%%a=%%b"
        )
    ) else if exist "%SCRIPT_DIR%\.env" (
        for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%SCRIPT_DIR%\.env") do (
            if not "%%b"=="" set "%%a=%%b"
        )
    )
)

if "%USE_DIST%"=="true" (
    set "BUNDLE=%SCRIPT_DIR%\packages\coding-agent\dist\bundle\cli.js"
    if not exist "!BUNDLE!" (
        echo Bundle not found at !BUNDLE!. Run npm run build first. >&2
        exit /b 1
    )
    if defined ARGS (
        node "!BUNDLE!" !ARGS!
    ) else (
        node "!BUNDLE!"
    )
    exit /b %errorlevel%
)

set "TSX_CMD=%SCRIPT_DIR%\node_modules\.bin\tsx.cmd"
if not exist "%TSX_CMD%" (
    echo tsx not found at %TSX_CMD%. Run npm install from the repo root first. >&2
    exit /b 1
)

if defined ARGS (
    call "%TSX_CMD%" --tsconfig "%SCRIPT_DIR%\tsconfig.json" "%SCRIPT_DIR%\packages\coding-agent\src\cli.ts" !ARGS!
) else (
    call "%TSX_CMD%" --tsconfig "%SCRIPT_DIR%\tsconfig.json" "%SCRIPT_DIR%\packages\coding-agent\src\cli.ts"
)
exit /b %errorlevel%
