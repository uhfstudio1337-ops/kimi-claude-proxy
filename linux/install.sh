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
    echo "   [!] Node.js не найден."
    echo "   Установите:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -"
    echo "   sudo apt install -y nodejs"
    exit 1
fi
echo "   [OK] Node.js $(node -v)"

if ! command -v npm &>/dev/null; then
    echo "   [!] npm не найден."
    exit 1
fi
echo "   [OK] npm $(npm -v)"

if ! command -v git &>/dev/null; then
    echo "   [!] git не найден. Установите: sudo apt install git"
    exit 1
fi
echo "   [OK] git"

# ══════════════════════════════════════════════════════════
# 2. Установка Claude Code CLI
# ══════════════════════════════════════════════════════════
echo ""
echo "2. Установка Claude Code CLI..."

if command -v claude &>/dev/null; then
    echo "   [OK] Claude Code уже установлен: $(claude --version 2>/dev/null || echo 'installed')"
else
    echo "   Установка @anthropic-ai/claude-code..."
    # npm install -g требует sudo на Ubuntu
    if [ -w "$(npm root -g)" ] 2>/dev/null; then
        npm install -g @anthropic-ai/claude-code
    else
        echo "   (нужен sudo для глобальной установки npm)"
        sudo npm install -g @anthropic-ai/claude-code
    fi
    echo "   [OK] Установлено"
fi

# Сохраняем путь к cli.js
CLI_PATH="$(npm root -g)/@anthropic-ai/claude-code/cli.js"
echo "   cli.js: $CLI_PATH"

# ══════════════════════════════════════════════════════════
# 3. Копирование файлов
# ══════════════════════════════════════════════════════════
echo ""
echo "3. Копирование файлов в ~/.local/bin/..."

mkdir -p "$HOME/.local/bin"

# Определяем корень репо (где лежит install.sh)
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Прокси
cp "$REPO_DIR/kimi-proxy.js" "$HOME/.local/bin/kimi-proxy.js"
echo "   [OK] kimi-proxy.js"

# Патчеры
cp "$REPO_DIR/patch-claude.js" "$HOME/.local/bin/patch-claude.js"
cp "$REPO_DIR/patch-claude-full.js" "$HOME/.local/bin/patch-claude-full.js"
echo "   [OK] patch-claude.js, patch-claude-full.js"

# Linux-скрипты
cp "$REPO_DIR/linux/claude-kimi" "$HOME/.local/bin/claude-kimi"
cp "$REPO_DIR/linux/claude-pro" "$HOME/.local/bin/claude-pro"
cp "$REPO_DIR/linux/start-kimi-proxy" "$HOME/.local/bin/start-kimi-proxy"
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
    SHELL_RC="$HOME/.bashrc"
    if [ -f "$HOME/.zshrc" ] && [ "$SHELL" = "/bin/zsh" ]; then
        SHELL_RC="$HOME/.zshrc"
    fi
    read -p "   ~/.local/bin не в PATH. Добавить в $SHELL_RC? [Y/n] " answer
    if [ "$answer" != "n" ] && [ "$answer" != "N" ]; then
        echo '' >> "$SHELL_RC"
        echo '# Claude Code + Kimi K2.5' >> "$SHELL_RC"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
        echo "   [OK] Добавлено в $SHELL_RC"
        export PATH="$HOME/.local/bin:$PATH"
    fi
fi

# ══════════════════════════════════════════════════════════
# 5. Патч CLI
# ══════════════════════════════════════════════════════════
echo ""
echo "5. Патч cli.js..."

if [ -f "$CLI_PATH" ]; then
    # Снимаем защиту если есть
    sudo chmod u+w "$CLI_PATH" 2>/dev/null || chmod u+w "$CLI_PATH" 2>/dev/null || true
    node "$HOME/.local/bin/patch-claude-full.js" "$CLI_PATH"
    sudo chmod a-w "$CLI_PATH" 2>/dev/null || chmod a-w "$CLI_PATH" 2>/dev/null || true
    echo "   [OK] cli.js пропатчен и защищён от перезаписи"
    echo "   (если npm update сломает — просто перезапустите install.sh)"
else
    echo "   [!] cli.js не найден: $CLI_PATH"
    echo "   Патч будет применён автоматически при первом запуске claude-kimi"
fi

# ══════════════════════════════════════════════════════════
# 6. Systemd (опционально)
# ══════════════════════════════════════════════════════════
echo ""
echo "6. Systemd-сервис (опционально)..."

# Создаём user-unit (не требует sudo, правильно раскрывает %h)
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"
cat > "$SYSTEMD_USER_DIR/kimi-proxy.service" << 'UNIT'
[Unit]
Description=Kimi K2.5 Smart Proxy for Claude Code
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node %h/.local/bin/kimi-proxy.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
UNIT

echo "   [OK] Создан ~/.config/systemd/user/kimi-proxy.service"
echo "   Для автозапуска: systemctl --user enable --now kimi-proxy"

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
echo " Автозапуск прокси:"
echo "   systemctl --user enable --now kimi-proxy"
echo "══════════════════════════════════════════════════════════"
