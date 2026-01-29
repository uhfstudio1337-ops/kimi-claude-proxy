@echo off
REM Claude Code + Kimi K2.5 с автопатчем v2.0
REM Автоматически проверяет и патчит cli.js при каждом запуске

set ANTHROPIC_BASE_URL=http://localhost:8787
set ANTHROPIC_API_KEY=sk-kimi-proxy
set CLI_PATH=%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\cli.js

REM ══════════════════════════════════════════════════════════
REM Проверка: пропатчен ли cli.js (ищем localhost:8787)
REM ══════════════════════════════════════════════════════════
findstr /C:"localhost:8787" "%CLI_PATH%" >nul 2>&1
if errorlevel 1 (
    echo ══════════════════════════════════════════════════════════
    echo  [!] cli.js НЕ пропатчен — автопатч...
    echo ══════════════════════════════════════════════════════════

    REM Снимаем защиту если была
    attrib -R "%CLI_PATH%" >nul 2>&1

    REM Запускаем патчер
    node "%USERPROFILE%\.local\bin\patch-claude-full.js"
    if errorlevel 1 (
        echo.
        echo [ОШИБКА] Патч не удался!
        pause
        exit /b 1
    )

    REM Ставим защиту от перезаписи
    attrib +R "%CLI_PATH%"
    echo.
    echo [OK] cli.js пропатчен и защищён от записи
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
    echo.
    pause
    exit /b 1
)

REM Запуск Claude Code
"%APPDATA%\npm\claude.cmd" %*
