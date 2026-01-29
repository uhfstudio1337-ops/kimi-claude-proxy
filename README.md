# Claude Code Smart Proxy: Полный гайд (v4.0)

Настроено: 29.01.2026

---

## Что это

**Smart Proxy v3.0** — локальный прокси-сервер, который позволяет использовать Claude Code CLI в двух режимах через один пропатченный cli.js:

| Режим | Команда | API | Цена |
|-------|---------|-----|------|
| **Claude Max** | `claude-pro` | Anthropic (подписка) | По подписке |
| **Kimi K2.5** | `claude-kimi` | Moonshot AI | ~$15/5ч |

Телеметрия вырезана в обоих режимах.

---

## Архитектура

```
                         ┌──────────────────────┐
claude-pro  ────────────▶│                      │────▶ api.anthropic.com
(подписка Max/Pro)       │   Smart Proxy :8787  │     (прозрачный проброс)
                         │                      │
claude-kimi ────────────▶│   Роутинг по ключу:  │────▶ api.moonshot.ai
(API_KEY=sk-kimi-proxy)  │   sk-kimi-proxy→Kimi │     (конвертация формата)
                         │   иначе → Anthropic  │
                         └──────────────────────┘
                          Телеметрия: убита в cli.js
```

---

## Быстрый старт

### 1. Запуск прокси (Терминал 1)
```cmd
start-kimi-proxy
```

### 2. Запуск Claude (Терминал 2)
```cmd
claude-pro       REM Claude Max по подписке (без телеметрии)
claude-kimi      REM Kimi K2.5 (дешёвый)
```

### 3. Проверка
```cmd
curl http://localhost:8787/health
```

---

## Файлы

| Файл | Назначение |
|------|------------|
| `%USERPROFILE%\.local\bin\kimi-proxy.js` | Smart Proxy v3.0 (dual mode) |
| `%USERPROFILE%\.local\bin\patch-claude-full.js` | Патч cli.js (телеметрия + redirect) |
| `%USERPROFILE%\.local\bin\start-kimi-proxy.cmd` | Запуск прокси |
| `%USERPROFILE%\.local\bin\claude-pro.cmd` | Claude Max по подписке |
| `%USERPROFILE%\.local\bin\claude-kimi.cmd` | Claude через Kimi K2.5 |
| `%USERPROFILE%\.local\bin\find-urls.js` | Сканер URL в cli.js |
| `%USERPROFILE%\.claude\commands\kimi.md` | Skill /kimi |
| Tavily MCP | Веб-поиск (замена WebSearch, для Kimi) |

---

## Как работает роутинг

Прокси определяет режим по заголовку `x-api-key`:

| Заголовок | Режим | Действие |
|-----------|-------|----------|
| `x-api-key: sk-kimi-proxy` | Kimi | Конвертация Anthropic→OpenAI, отправка в Moonshot |
| Любой другой / OAuth | Anthropic | Прозрачный проброс на api.anthropic.com |

Маршрутизация Anthropic-режима по URL path:

| Path | Целевой хост |
|------|-------------|
| `/v1/messages`, `/v1/*` | `api.anthropic.com` |
| `/oauth/*`, `/v1/oauth/*` | `platform.claude.com` |
| `/api/*` | `claude.ai` |

---

## Kimi K2.5 API Features

### Builtin Functions (server-side)

| Функция | Описание |
|---------|----------|
| `$web_search` | Веб-поиск (автоматический) |
| `$code_interpreter` | Выполнение кода (в разработке) |
| `$file_read` | Чтение файлов через File API |

### Capabilities

- **256K контекст** — в 2 раза больше Claude
- **Tool Calling** — OpenAI/Anthropic совместимый формат
- **Vision** — понимание изображений
- **Agent Swarm** — до 100 параллельных суб-агентов

### Модели

| Модель | Описание | Цена |
|--------|----------|------|
| `kimi-k2.5` | Топовая, мультимодальная | ~0.002¥/1K |
| `kimi-k2-0905` | Улучшенный K2 | ~0.001¥/1K |

Смена модели — в `kimi-proxy.js` → `MODEL_MAP`.

---

## Патч cli.js

### Что делает патч (239 изменений)

| Категория | Замен | Результат |
|-----------|-------|-----------|
| API endpoints → proxy | 17 | Все запросы идут через localhost:8787 |
| OAuth → proxy | 6 | Авторизация через прокси |
| Телеметрия → dead | 12 | Sentry, Statsig, Segment, Datadog, GrowthBook |
| Автообновления → dead | 4 | CLI не обновляется |
| Sentry capture → no-op | 3 | Error reporting отключён |
| logEvent/track → safe | 7 | Трекинг отключён |
| Домены Anthropic → dead | 14 | Сайты заблокированы |
| Ссылки Claude → dead | 162 | UI/документация заблокированы |
| **Итого** | **239** | **Полная изоляция** |

Подробности: см. `CLI_PATCH_DETAILS.md`

### Защита от слёта патча (4 уровня)

| Уровень | Механизм | Описание |
|---------|----------|----------|
| 1 | `autoUpdates: false` | CLI не проверяет обновления |
| 2 | `attrib +R` на cli.js | Файл read-only |
| 3 | Автопатч в `claude-pro.cmd` / `claude-kimi.cmd` | При запуске проверяет и патчит |
| 4 | Фиксация версии npm | `npm install -g @anthropic-ai/claude-code@2.1.23` |

---

## API ключ Kimi

Текущий ключ в `kimi-proxy.js`:
```
sk-IveN1uypGMTqTnjkCIBOv64c1kN1JSMprZ7EYVbCi9I1H4RA
```

Получить новый:
1. https://platform.moonshot.cn/
2. Пополнить баланс
3. Создать API key

---

## Tavily MCP (веб-поиск для Kimi)

WebSearch в Claude Code — `server_tool_use` (Anthropic server-side). Не работает через Kimi.
Замена: **Tavily MCP** — 1000 запросов/мес бесплатно.

### Установка
```bash
claude mcp add tavily-search -- npx -y tavily-mcp@latest
```

Добавь API ключ в `~/.claude.json` → `projects` → `mcpServers`:
```json
{
  "tavily-search": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "tavily-mcp@latest"],
    "env": { "TAVILY_API_KEY": "tvly-xxx" }
  }
}
```

---

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| WebFetch: "Unable to verify domain" | Перезапусти прокси |
| "Invalid Authentication" | Проверь API ключ / баланс Moonshot |
| "thinking is enabled but reasoning_content is missing" | Новая сессия (`/exit` → `claude-kimi`) |
| Патч слетел | Запусти `claude-pro` или `claude-kimi` — автопатч |
| Прокси не запущен | `start-kimi-proxy` |

---

## Что работает

| Инструмент | claude-pro | claude-kimi |
|------------|-----------|-------------|
| Bash, Read, Write, Edit | OK | OK |
| Glob, Grep | OK | OK |
| WebFetch | OK | OK (domain_info mock) |
| WebSearch | OK | Нет (замена: Tavily MCP) |
| Tavily Search (MCP) | OK | OK |
| Tool Calling | OK | OK (конвертация) |
| Streaming | OK (passthrough) | OK (SSE конвертация) |
| Подписка/OAuth | OK | Нет (API ключ Kimi) |

---

*Документ: v4.0 | 29.01.2026*
