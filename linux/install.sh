#!/bin/bash
# Установка Claude Code + Kimi K2.5 на Linux
# Запуск: cd kimi-claude-proxy && bash linux/install.sh

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Claude Code + Kimi K2.5 — Установка для Linux         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ══════════════════════════════════════════════════════════
# 1. Проверка зависимостей
# ══════════════════════════════════════════════════════════
echo "1. Проверка зависимостей..."

if ! command -v node &>/dev/null; then
    echo "   [!] Node.js не найден. Установите: https://nodejs.org/"
    exit 1
fi
echo "   [OK] Node.js $(node -v)"

if ! command -v npm &>/dev/null; then
    echo "   [!] npm не найден."
    exit 1
fi
echo "   [OK] npm $(npm -v)"

if ! command -v curl &>/dev/null; then
    echo "   [!] curl не найден. Установите: sudo apt install curl"
    exit 1
fi
echo "   [OK] curl"

# ══════════════════════════════════════════════════════════
# 2. Установка Claude Code CLI
# ══════════════════════════════════════════════════════════
echo ""
echo "2. Установка Claude Code CLI..."

if command -v claude &>/dev/null; then
    echo "   [OK] Claude Code уже установлен: $(claude --version 2>/dev/null || echo 'installed')"
else
    echo "   Установка @anthropic-ai/claude-code..."
    npm install -g @anthropic-ai/claude-code
    echo "   [OK] Установлено"
fi

# ══════════════════════════════════════════════════════════
# 3. Копирование файлов
# ══════════════════════════════════════════════════════════
echo ""
echo "3. Копирование файлов в ~/.local/bin/..."

mkdir -p "$HOME/.local/bin"

# Прокси
cp kimi-proxy.js "$HOME/.local/bin/kimi-proxy.js"
echo "   [OK] kimi-proxy.js"

# Патчеры
cp patch-claude.js "$HOME/.local/bin/patch-claude.js"
cp patch-claude-full.js "$HOME/.local/bin/patch-claude-full.js"
echo "   [OK] patch-claude.js, patch-claude-full.js"

# Linux-скрипты
cp linux/claude-kimi "$HOME/.local/bin/claude-kimi"
cp linux/claude-pro "$HOME/.local/bin/claude-pro"
cp linux/start-kimi-proxy "$HOME/.local/bin/start-kimi-proxy"
chmod +x "$HOME/.local/bin/claude-kimi"
chmod +x "$HOME/.local/bin/claude-pro"
chmod +x "$HOME/.local/bin/start-kimi-proxy"
echo "   [OK] claude-kimi, claude-pro, start-kimi-proxy"

# ══════════════════════════════════════════════════════════
# 4. PATH
# ══════════════════════════════════════════════════════════
echo ""
echo "4. Проверка PATH..."

if echo "$PATH" | grep -q "$HOME/.local/bin"; then
    echo "   [OK] ~/.local/bin уже в PATH"
else
    echo "   [!] Добавьте в ~/.bashrc или ~/.zshrc:"
    echo '   export PATH="$HOME/.local/bin:$PATH"'
    echo ""
    # Пробуем добавить автоматически
    SHELL_RC="$HOME/.bashrc"
    if [ -f "$HOME/.zshrc" ] && [ "$SHELL" = "/bin/zsh" ]; then
        SHELL_RC="$HOME/.zshrc"
    fi
    read -p "   Добавить автоматически в $SHELL_RC? [Y/n] " answer
    if [ "$answer" != "n" ] && [ "$answer" != "N" ]; then
        echo '' >> "$SHELL_RC"
        echo '# Claude Code + Kimi K2.5' >> "$SHELL_RC"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
        echo "   [OK] Добавлено в $SHELL_RC"
        echo "   Выполните: source $SHELL_RC"
    fi
fi

# ══════════════════════════════════════════════════════════
# 5. Патч CLI
# ══════════════════════════════════════════════════════════
echo ""
echo "5. Патч cli.js..."

CLI_PATH="$(npm root -g)/@anthropic-ai/claude-code/cli.js"
if [ -f "$CLI_PATH" ]; then
    chmod u+w "$CLI_PATH" 2>/dev/null || true
    node "$HOME/.local/bin/patch-claude-full.js" "$CLI_PATH"
    chmod a-w "$CLI_PATH"
    echo "   [OK] cli.js пропатчен и защищён"
else
    echo "   [!] cli.js не найден: $CLI_PATH"
    echo "   Патч будет применён автоматически при первом запуске claude-kimi"
fi

# ══════════════════════════════════════════════════════════
# ГОТОВО
# ══════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════════"
echo " Установка завершена!"
echo ""
echo " Использование:"
echo "   start-kimi-proxy     # запустить прокси (в отдельном терминале)"
echo "   claude-kimi           # Claude Code через Kimi K2.5"
echo "   claude-pro            # Claude Code через подписку Anthropic"
echo ""
echo " Или как systemd-сервис:"
echo "   sudo cp linux/kimi-proxy.service /etc/systemd/system/"
echo "   sudo systemctl enable --now kimi-proxy"
echo "══════════════════════════════════════════════════════════"
