@echo off
setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
set "ARGS="
set "FIRST=1"

for %%A in (%*) do (
    if "!FIRST!"=="1" (
        set "FIRST=0"
        if not "%%~A"=="agent" (
            set "ARGS=%%A"
        )
    ) else (
        if defined ARGS (
            set "ARGS=!ARGS! %%A"
        ) else (
            set "ARGS=%%A"
        )
    )
)

if defined ARGS (
    call "%SCRIPT_DIR%prime-agent.cmd" !ARGS!
) else (
    call "%SCRIPT_DIR%prime-agent.cmd"
)
exit /b %errorlevel%
