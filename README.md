# Claude Code + Kimi K2.5: Полный гайд (v3.1)

Настроено: 28.01.2026

---

## Что это

**Kimi K2.5** — китайская модель от Moonshot AI, работающая через Claude Code CLI.

| Параметр | Claude Opus 4.5 | Kimi K2.5 |
|----------|-----------------|-----------|
| Контекст | 200K | **256K** |
| Цена | ~$100/5ч | **~$15/5ч** |
| Качество | Топ | На уровне Opus |
| Tools | Да | Да + $web_search |

---

## Архитектура

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Code    │────▶│  Kimi Proxy     │────▶│  Kimi K2.5 API  │
│  CLI (патченый) │     │  localhost:8787 │     │  api.moonshot.ai│
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Anthropic              Конвертер              OpenAI
     формат                 форматов               формат
```

---

## Быстрый старт

### 1. Запуск прокси (Терминал 1)
```cmd
start-kimi-proxy
```
или
```cmd
node %USERPROFILE%\.local\bin\kimi-proxy.js
```

### 2. Запуск Claude Code (Терминал 2)
```cmd
claude-kimi
```

### 3. Проверка
```cmd
curl http://localhost:8787/health
```

---

## Файлы

| Файл | Назначение |
|------|------------|
| `%USERPROFILE%\.local\bin\kimi-proxy.js` | Прокси сервер |
| `%USERPROFILE%\.local\bin\patch-claude-full.js` | Патч cli.js |
| `%USERPROFILE%\.local\bin\start-kimi-proxy.cmd` | Запуск прокси |
| `%USERPROFILE%\.local\bin\claude-kimi.cmd` | Запуск Claude+Kimi |
| `%USERPROFILE%\.local\bin\find-urls.js` | Сканер URL |
| `%USERPROFILE%\.claude\commands\kimi.md` | Skill /kimi |

---

## Kimi K2.5 API Features

### Builtin Functions (server-side автоматические)

| Функция | Описание | Формат |
|---------|----------|--------|
| `$web_search` | Веб-поиск | `{"type": "builtin_function", "function": {"name": "$web_search"}}` |
| `$code_interpreter` | Выполнение кода | В разработке |
| `$file_read` | Чтение файлов | Через File API |

### Capabilities

- **256K контекст** — в 2 раза больше Claude
- **Tool Calling** — OpenAI/Anthropic совместимый формат
- **Vision** — понимание изображений, UI→код
- **File Upload** — PDF, DOCX, images (до 1000 файлов)
- **Context Caching** — кэширование для повторных запросов
- **Agent Swarm** — до 100 параллельных суб-агентов, 1500 tool calls

### Modes

| Режим | Temperature | Описание |
|-------|-------------|----------|
| Thinking | 1.0 | С reasoning traces |
| Instant | 0.6 | Быстрые ответы |

---

## Модели

| Модель | Описание | Цена |
|--------|----------|------|
| `kimi-k2.5` | Топовая, мультимодальная, agentic | ~0.002¥/1K |
| `kimi-k2-0905` | Улучшенный K2 | ~0.001¥/1K |
| `kimi-k2-0711-preview` | Preview, подтверждённо работает web_search | ~0.001¥/1K |

Смена модели — в `kimi-proxy.js` → `MODEL_MAP`.

---

## Патч cli.js

### Что заблокировано (206 URL)

| Сервис | Статус |
|--------|--------|
| api.anthropic.com | → proxy |
| api-staging.anthropic.com | → dead |
| sentry.io | → dead |
| statsig.anthropic.com | → dead |
| api.segment.io | → dead |
| datadoghq.com | → dead |
| growthbook.io | → dead |
| mcp-proxy.anthropic.com | → dead |
| claude.ai/* | → dead/proxy |
| code.claude.com/* | → dead |
| platform.claude.com/* | → dead |
| storage.googleapis.com/claude-code-dist | → dead |

### Применение патча

```cmd
node %USERPROFILE%\.local\bin\patch-claude-full.js
```

### После обновления Claude Code

Патч слетит — применить заново.

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

## Skill /kimi

Используй в Claude Code:
```
/kimi status    — проверить прокси
/kimi start     — инструкция запуска
/kimi config    — показать конфигурацию
/kimi models    — список моделей
/kimi help      — справка по API
```

---

## Известные ограничения

### WebSearch НЕ РАБОТАЕТ

**Проблема:** WebSearch в Claude Code — это `server_tool_use`, специальная фича где сервер Anthropic сам выполняет поиск. CLI ожидает `server_tool_use.web_search_requests` в ответе API.

Kimi `$web_search` работает иначе — через tool_calls. Это разные механизмы, которые нельзя полностью эмулировать через прокси.

**Решения:**

1. **WebFetch работает!** Используй для конкретных URL:
   ```
   Скачай https://reuters.com и расскажи новости
   ```

2. **MCP сервер для поиска** — добавить Tavily или Brave Search:
   ```json
   {
     "mcpServers": {
       "tavily": {
         "command": "npx",
         "args": ["-y", "tavily-mcp"],
         "env": { "TAVILY_API_KEY": "tvly-xxx" }
       }
     }
   }
   ```

3. **Kimi CLI** — использовать родной CLI от Moonshot:
   ```
   npm install -g @anthropic-ai/kimi-cli
   ```

---

## Troubleshooting

### WebFetch: "Unable to verify domain"
- `domain_info` endpoint замокан в прокси
- Перезапусти прокси

### "Invalid Authentication"
- Проверь API ключ в kimi-proxy.js
- Проверь баланс на moonshot

### "thinking is enabled but reasoning_content is missing"
- Начни новую сессию (`/exit` → `claude-kimi`)

### Нужен VPN?
- Да, для api.moonshot.ai может потребоваться VPN

---

## Источники

- [Moonshot AI Platform](https://platform.moonshot.ai/)
- [Kimi K2.5 HuggingFace](https://huggingface.co/moonshotai/Kimi-K2.5)
- [Kimi K2 GitHub](https://github.com/MoonshotAI/Kimi-K2)
- [Kimi CLI](https://github.com/MoonshotAI/kimi-cli)
- [Go Moonshot SDK](https://github.com/northes/go-moonshot)

---

*Документ: v3.2 | 28.01.2026*
