---
name: kimi
description: Управление Kimi K2.5 прокси и настройками
arguments:
  - name: action
    description: "Действие: status, start, stop, restart, config, test, models, help"
    required: false
---

# Kimi K2.5 Proxy Manager

Ты — менеджер Kimi прокси для Claude Code. Выполни запрошенное действие.

## Текущая конфигурация

- **Прокси:** `C:\Users\user\.local\bin\kimi-proxy.js`
- **Порт:** 8787
- **API:** api.moonshot.ai
- **Модель:** kimi-k2.5

## Действия

### `status` (по умолчанию)
Проверь статус прокси:
```bash
curl -s http://localhost:8787/health 2>/dev/null || echo "Proxy not running"
```

### `start`
Инструкция для запуска:
```
Терминал 1: node %USERPROFILE%\.local\bin\kimi-proxy.js
Терминал 2: claude-kimi
```

### `stop`
Инструкция: Нажми Ctrl+C в терминале с прокси.

### `restart`
1. Останови прокси (Ctrl+C)
2. Запусти заново: `node %USERPROFILE%\.local\bin\kimi-proxy.js`

### `config`
Покажи текущую конфигурацию прокси (прочитай kimi-proxy.js и покажи MODEL_MAP и настройки).

### `test`
Протестируй прокси:
```bash
curl -s http://localhost:8787/health
curl -X POST http://localhost:8787/v1/messages -H "Content-Type: application/json" -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"Say hi"}],"max_tokens":10}'
```

### `models`
Покажи доступные модели Kimi:
| Модель | Описание | Цена |
|--------|----------|------|
| kimi-k2.5 | Топовая, мультимодальная | ~0.002¥/1K |
| kimi-k2-0905 | Улучшенный K2 | ~0.001¥/1K |
| kimi-k2-0711-preview | Preview версия | ~0.001¥/1K |

### `help`
Покажи справку по Kimi API:

## Kimi K2.5 API Features

### Builtin Functions (server-side)
- `$web_search` - веб-поиск (автоматический)
- `$code_interpreter` - выполнение кода
- `$file_read` - чтение файлов

### Capabilities
- **256K контекст** — в 2 раза больше Claude
- **Tool Calling** — OpenAI/Anthropic совместимый формат
- **Vision** — понимание изображений, UI→код
- **File Upload** — PDF, DOCX, images
- **Context Caching** — кэширование для повторных запросов
- **Agent Swarm** — до 100 параллельных суб-агентов

### Modes
- **Thinking** (temperature=1.0) — с reasoning traces
- **Instant** (temperature=0.6) — быстрые ответы

### Стоимость
~$15 за 5 часов активной работы (vs $500 у Claude)

## Если `$arguments` пустой
Выполни `status` — проверь работает ли прокси.

## Аргумент: $arguments
