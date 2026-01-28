@echo off
REM Claude Code через Kimi K2.5

set ANTHROPIC_BASE_URL=http://localhost:8787
set ANTHROPIC_API_KEY=sk-kimi-proxy

"%APPDATA%\npm\claude.cmd" %*
