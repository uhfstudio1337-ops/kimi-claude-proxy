# Патч cli.js: что изменено и зачем

Версия патчера: 3.0 | Дата: 29.01.2026
Файл: `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\cli.js`
Изменений: **239** | Размер: 11,629,303 -> 11,627,220

---

## Зачем нужен патч

Claude Code CLI при каждом запуске и во время работы обращается к серверам Anthropic:
- Отправляет **телеметрию** (каждое действие, ошибки, метрики)
- Проверяет **обновления** и скачивает новые версии
- Проходит **OAuth авторизацию** через claude.ai
- Отправляет **аналитику** в Sentry, Statsig, Segment, Datadog, GrowthBook
- Проверяет **лицензию** и feature-флаги

Патч решает две задачи:
1. **Все запросы через Smart Proxy** (localhost:8787) — прокси решает куда направить:
   - `claude-pro` → прозрачный проброс на Anthropic (подписка Max/Pro)
   - `claude-kimi` → конвертация и отправка в Kimi K2.5
2. **Телеметрия заблокирована** — для обоих режимов

---

## 1. API Endpoints -> Proxy (17 замен)

**Что:** Все обращения к `https://api.anthropic.com` перенаправлены на `http://localhost:8787` (Smart Proxy).

**Зачем:** Smart Proxy v3.0 определяет режим по заголовку `x-api-key`:
- `sk-kimi-proxy` → конвертирует в OpenAI формат и отправляет в Kimi K2.5
- Любой другой / OAuth → прозрачно пробрасывает на `api.anthropic.com`

| Было | Стало | Кол-во |
|------|-------|--------|
| `"https://api.anthropic.com"` | `"http://localhost:8787"` | 5x |
| `https://api.anthropic.com` (все остальные) | `http://localhost:8787` | 12x |

**Результат — 16 proxy-URL в cli.js:**

| URL | Назначение | claude-pro | claude-kimi |
|-----|------------|-----------|-------------|
| `localhost:8787` | Базовый API endpoint | → api.anthropic.com | → api.moonshot.ai |
| `localhost:8787/oauth/authorize` | OAuth авторизация | → platform.claude.com | Mock |
| `localhost:8787/v1/oauth/token` | Получение токена | → platform.claude.com | Mock |
| `localhost:8787/v1/oauth/hello` | Проверка токена | → platform.claude.com | Mock |
| `localhost:8787/api/oauth/claude_cli/create_api_key` | Создание API ключа | → claude.ai | Mock |
| `localhost:8787/api/oauth/claude_cli/roles` | Роли пользователя | → claude.ai | Mock |
| `localhost:8787/oauth/code/success` | OAuth callback | → platform.claude.com | Mock |
| `localhost:8787/oauth/code/callback` | OAuth redirect | → platform.claude.com | Mock |
| `localhost:8787/api/hello` | Health check | → claude.ai | Mock |
| `localhost:8787/api/organization/.../access` | Проверка доступа | → claude.ai | Mock |
| `localhost:8787/api/claude_code/organizations/metrics_enabled` | Метрики | → claude.ai | Mock |
| `localhost:8787/api/claude_code/metrics` | Отправка метрик | → claude.ai | Mock |
| `localhost:8787/api/claude_code/link_vcs_account` | Привязка VCS | → claude.ai | Mock |
| `localhost:8787/api/web/domain_info` | Проверка домена (WebFetch) | → claude.ai | Mock (always allowed) |
| `localhost:8787/api/claude_cli_feedback` | Фидбек | → claude.ai | Mock |

---

## 2. Staging API -> Dead (2 замены)

**Что:** `https://api-staging.anthropic.com` -> `http://0.0.0.0:1`

**Зачем:** Staging-сервер Anthropic для тестирования. Не нужен ни в одном режиме.

---

## 3. OAuth/Claude.ai -> Proxy или Dead (14 замен)

**Что:** Эндпоинты авторизации перенаправлены на прокси, остальные заблокированы.

| Было | Стало | Зачем |
|------|-------|-------|
| `platform.claude.com/oauth` | `localhost:8787/oauth` (3x) | Прокси форвардит на platform.claude.com (Pro) или мокает (Kimi) |
| `platform.claude.com/v1/oauth` | `localhost:8787/v1/oauth` (2x) | Аналогично |
| `claude.ai/oauth` | `localhost:8787/oauth` (1x) | Аналогично |
| `claude.ai/admin-settings` | Dead (1x) | UI ссылка, не нужна |
| `claude.ai/settings/data-privacy-controls` | Dead (4x) | UI ссылка, не нужна |
| `claude.ai/settings/usage` | Dead (1x) | UI ссылка, не нужна |
| `staging.claude.ai` | Dead (1x) | Staging, не нужен |
| `console.staging.ant.dev` | Dead (1x) | Staging консоль, не нужна |

---

## 4. MCP Proxy -> Dead (1 замена)

**Что:** `https://mcp-proxy.anthropic.com` -> `http://0.0.0.0:1`

**Зачем:** Anthropic-овский MCP прокси. Мы используем свои MCP (Tavily), поэтому блокируем.

---

## 5. Телеметрия -> Dead (12 замен)

**Что:** Все URL-адреса сервисов аналитики заблокированы.

**Зачем:** CLI отправляет подробную телеметрию. Блокируем в обоих режимах:
- Утечка данных о работе
- Лишний трафик
- Ошибки при недоступности серверов

| Сервис | URL | Что собирает |
|--------|-----|-------------|
| **Sentry** | `e531a1d9ec1de9064fae9d4affb0b0f4@o1158394.ingest.us.sentry.io` | Crash reports, exceptions, stack traces |
| **Sentry MCP** | `mcp.sentry.dev` | MCP-специфичные ошибки |
| **Statsig CDN** | `api.statsigcdn.com` | Feature flags, A/B тесты, конфигурации |
| **Statsig API** | `statsigapi.net` | Отправка событий для A/B тестов |
| **Statsig Anthropic** | `statsig.anthropic.com` | Anthropic-специфичные feature flags |
| **Statsig Docs** | `docs.statsig.com` | Ссылка на документацию (строка в коде) |
| **Segment** | `api.segment.io` | Пользовательская аналитика, tracking events |
| **Segment CDN** | `cdn.segment.com` | Загрузка Segment SDK |
| **Datadog** | `http-intake.logs.us5.datadoghq.com` | Логи, APM трейсы, метрики производительности |
| **GrowthBook** | `cdn.growthbook.io` | Feature flags, эксперименты |
| **GrowthBook alt** | `featureassets.org` | Альтернативный CDN для GrowthBook |
| **GrowthBook alt** | `prodregistryv2.org` | Альтернативный CDN для GrowthBook |

---

## 6. Автообновления -> Dead (4 замены)

**Что:** Заблокированы URL, через которые CLI проверяет и скачивает обновления.

**Зачем:** Обновление заменяет cli.js свежей версией, и наш патч слетает.

| URL | Что делает |
|-----|-----------|
| `storage.googleapis.com/claude-code-dist` (2x) | Скачивание бинарников обновления |
| `raw.githubusercontent.com/anthropics/claude-code/.../CHANGELOG.md` | Проверка новых версий |
| `raw.githubusercontent.com/anthropics/claude-plugins-official` | Скачивание официальных плагинов |

---

## 7. Sentry Capture -> No-op (3 замены)

**Что:** Функции отправки ошибок в Sentry заменены на пустые функции.

```
this._client.captureException(  ->  ((x)=>{})(
this._client.captureMessage(    ->  ((x)=>{})(
this._client.captureEvent(      ->  ((x)=>{})(
```

**Зачем:** Даже если URL Sentry заблокирован, SDK всё равно пытается сериализовать и отправить данные. Замена на no-op полностью убирает эту работу, экономит CPU и предотвращает ошибки.

---

## 8. LogEvent/Track -> Optional Chaining (7 замен)

**Что:** Вызовы функций логирования событий обёрнуты в optional chaining.

```
.logEvent(       ->  ?.logEvent?.(       (3x)
.logEventAsync(  ->  ?.logEventAsync?.(  (2x)
.track(          ->  ?.track?.(          (2x)
```

**Зачем:** Если объект-логгер не инициализирован (а он не инициализируется без Statsig/Segment), вызов `.logEvent()` вызовет crash. Optional chaining `?.` безопасно пропускает вызов если объект `null/undefined`.

---

## 9. Домены Anthropic -> Dead (14 замен)

**Что:** Все ссылки на сайты Anthropic заблокированы.

| URL | Кол-во | Контекст |
|-----|--------|----------|
| `www.anthropic.com` | 4x | Главный сайт |
| `anthropic.com/legal` | 4x | Юридические документы (ToS, AUP) |
| `anthropic.com/supported-countries` | 1x | Список поддерживаемых стран |
| `docs.anthropic.com` | 3x | Документация API |
| `support.claude.com` | 2x | Поддержка (статьи о guest passes и т.д.) |

**Зачем:** CLI может открывать эти URL в браузере или использовать для проверок. Блокируем для полной изоляции от телеметрии.

---

## 10. Статические ссылки Claude -> Dead (162 замены)

**Что:** Все ссылки на claude.ai, code.claude.com, docs.claude.com, platform.claude.com, clau.de, магазины приложений.

| URL | Кол-во | Контекст |
|-----|--------|----------|
| `claude.ai/api` -> **proxy** | - | API-запросы (domain_info для WebFetch) |
| `claude.ai/chrome` | 4x | Chrome extension ссылки |
| `claude.ai/code` | 3x | Claude Code промо |
| `claude.ai/upgrade` | 2x | Призыв обновить подписку |
| `claude.ai` (base) | 1x | Базовая ссылка |
| `code.claude.com` | **141x** | Документация Claude Code (самый частый!) |
| `docs.claude.com` | 2x | Docs портал |
| `platform.claude.com/buy_credits` | 1x | Покупка кредитов |
| `platform.claude.com/settings` | 2x | Настройки аккаунта |
| `platform.claude.com/docs` | 2x | Документация платформы |
| `platform.claude.com/llms` | 1x | Информация о моделях |
| `clau.de` | 5x | Короткие ссылки |
| `play.google.com/.../com.anthropic` | 1x | Android приложение |
| `apps.apple.com/app/claude` | 1x | iOS приложение |

**Зачем:** UI/промо ссылки. Блокировка не ломает функциональность CLI.

**Исключение:** `claude.ai/api` перенаправлен на прокси — CLI проверяет `domain_info` перед WebFetch, прокси форвардит на claude.ai (Pro) или мокает (Kimi).

---

## Итого

| Категория | Замен | claude-pro | claude-kimi |
|-----------|-------|-----------|-------------|
| API -> Proxy | 17 | → api.anthropic.com | → api.moonshot.ai |
| Staging -> Dead | 2 | Заблокирован | Заблокирован |
| OAuth -> Proxy | 6 | → platform.claude.com | Mock |
| OAuth UI -> Dead | 8 | Заблокирован | Заблокирован |
| MCP Proxy -> Dead | 1 | Заблокирован | Заблокирован |
| Телеметрия -> Dead | 12 | Заблокирована | Заблокирована |
| Автообновления -> Dead | 4 | Заблокированы | Заблокированы |
| Sentry -> No-op | 3 | Отключён | Отключён |
| LogEvent -> Safe | 7 | Отключён | Отключён |
| Домены Anthropic -> Dead | 14 | Заблокированы | Заблокированы |
| Ссылки Claude -> Dead | 162 | Заблокированы | Заблокированы |
| **claude.ai/api -> Proxy** | 3 | → claude.ai | Mock |
| **Всего** | **239** | **Работает по подписке** | **Работает через Kimi** |

---

## Что НЕ затронуто патчем

| Элемент | Почему не трогаем |
|---------|-------------------|
| Statsig SDK код (классы, переменные) | Это код библиотеки, а не URL. Без URL он просто не отправляет данные |
| GrowthBook SDK код | Аналогично — код без рабочих URL безвреден |
| GitHub ссылки (`github.com/anthropics/...`) | Статические ссылки на репозитории, не отправляют данные |
| `npmjs.com` ссылки | Информационные ссылки |
| Локальные MCP серверы | Нужны для Tavily Search и других MCP |

---

## Известные ограничения

| Ограничение | Режим | Причина |
|-------------|-------|---------|
| WebSearch не работает | claude-kimi | `server_tool_use` — Anthropic server-side. Замена: Tavily MCP |
| `/resume` — большие сессии | claude-kimi | Сессии >200K токенов могут не уместиться в контекст Kimi (256K). Работает с v3.3 для обычных сессий |
| Feature flags не загружаются | Оба | Statsig/GrowthBook заблокированы. Используются кэшированные значения из `.claude.json` |

---

## Защита от слёта патча

| Уровень | Механизм | Описание |
|---------|----------|----------|
| 1 | `autoUpdates: false` | В `.claude.json`, CLI не проверяет обновления |
| 2 | `attrib +R` на cli.js | Windows read-only флаг, файл нельзя перезаписать |
| 3 | Автопатч в `claude-pro.cmd` / `claude-kimi.cmd` | При запуске проверяет патч, если слетел — автоматически применяет заново |
| 4 | Фиксация версии npm | `npm install -g @anthropic-ai/claude-code@2.1.23` |

---

*Документ: v2.1 | 30.01.2026*
