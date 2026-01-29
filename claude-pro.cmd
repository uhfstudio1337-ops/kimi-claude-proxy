@echo off
REM Claude Code Pro — подписка через Smart Proxy v3.0
REM Прозрачный проброс на Anthropic API, без телеметрии

set ANTHROPIC_BASE_URL=http://localhost:8787
set CLI_PATH=%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\cli.js

REM ══════════════════════════════════════════════════════════
REM Проверка патча
REM ══════════════════════════════════════════════════════════
findstr /C:"localhost:8787" "%CLI_PATH%" >nul 2>&1
if errorlevel 1 (
    echo ══════════════════════════════════════════════════════════
    echo  [!] cli.js НЕ пропатчен — автопатч...
    echo ══════════════════════════════════════════════════════════
    attrib -R "%CLI_PATH%" >nul 2>&1
    node "%USERPROFILE%\.local\bin\patch-claude-full.js"
    if errorlevel 1 (
        echo [ОШИБКА] Патч не удался!
        pause
        exit /b 1
    )
    attrib +R "%CLI_PATH%"
    echo [OK] cli.js пропатчен и защищён
    echo ══════════════════════════════════════════════════════════
) else (
    echo [OK] cli.js пропатчен
)

REM ══════════════════════════════════════════════════════════
REM Проверка прокси
REM ══════════════════════════════════════════════════════════
curl -s http://localhost:8787/health >nul 2>&1
if errorlevel 1 (
    echo [!] Прокси не запущен! Запусти: start-kimi-proxy
    pause
    exit /b 1
)

echo [MODE] Anthropic Pro (transparent proxy, no telemetry)
"%APPDATA%\npm\claude.cmd" %*
