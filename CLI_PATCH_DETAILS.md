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

Для работы через Kimi K2.5 API нужно:
1. Перенаправить API-запросы на локальный прокси
2. Заблокировать всю телеметрию (иначе ошибки и утечка данных)
3. Заблокировать автообновления (иначе патч слетит)

---

## 1. API Endpoints -> Proxy (17 замен)

**Что:** Все обращения к `https://api.anthropic.com` перенаправлены на `http://localhost:8787` (локальный прокси).

**Зачем:** Прокси конвертирует формат Anthropic API в формат OpenAI API, который понимает Kimi K2.5. Без этого CLI не сможет общаться с Kimi.

| Было | Стало | Кол-во |
|------|-------|--------|
| `"https://api.anthropic.com"` | `"http://localhost:8787"` | 5x |
| `https://api.anthropic.com` (все остальные) | `http://localhost:8787` | 12x |

**Результат — 16 proxy-URL в cli.js:**

| URL | Назначение |
|-----|------------|
| `localhost:8787` | Базовый API endpoint |
| `localhost:8787/oauth/authorize` | Mock OAuth авторизация |
| `localhost:8787/v1/oauth/token` | Mock получение токена |
| `localhost:8787/v1/oauth/hello` | Mock проверка токена |
| `localhost:8787/api/oauth/claude_cli/create_api_key` | Mock создание API ключа |
| `localhost:8787/api/oauth/claude_cli/roles` | Mock роли пользователя |
| `localhost:8787/oauth/code/success` | Mock OAuth callback |
| `localhost:8787/oauth/code/callback` | Mock OAuth redirect |
| `localhost:8787/api/hello` | Mock health check |
| `localhost:8787/api/organization/.../claude_code_sonnet_1m_access` | Mock проверка доступа |
| `localhost:8787/api/claude_code/organizations/metrics_enabled` | Mock метрики |
| `localhost:8787/api/claude_code/metrics` | Mock отправка метрик |
| `localhost:8787/api/claude_code/link_vcs_account` | Mock привязка VCS |
| `localhost:8787/api/web/domain_info` | Mock проверка домена (для WebFetch) |
| `localhost:8787/api/claude_cli_feedback` | Mock фидбек |

---

## 2. Staging API -> Dead (2 замены)

**Что:** `https://api-staging.anthropic.com` -> `http://0.0.0.0:1`

**Зачем:** Staging-сервер Anthropic для тестирования. Не нужен, блокируем чтобы не было ошибок при попытке подключения.

---

## 3. OAuth/Claude.ai -> Proxy или Dead (14 замен)

**Что:** Эндпоинты авторизации перенаправлены на прокси, остальные заблокированы.

| Было | Стало | Зачем |
|------|-------|-------|
| `platform.claude.com/oauth` | `localhost:8787/oauth` (3x) | Прокси отдает mock-токен |
| `platform.claude.com/v1/oauth` | `localhost:8787/v1/oauth` (2x) | Прокси отдает mock-токен |
| `claude.ai/oauth` | `localhost:8787/oauth` (1x) | Прокси отдает mock-токен |
| `claude.ai/admin-settings` | Dead (1x) | UI ссылка, не нужна |
| `claude.ai/settings/data-privacy-controls` | Dead (4x) | UI ссылка, не нужна |
| `claude.ai/settings/usage` | Dead (1x) | UI ссылка, не нужна |
| `staging.claude.ai` | Dead (1x) | Staging, не нужен |
| `console.staging.ant.dev` | Dead (1x) | Staging консоль, не нужна |

---

## 4. MCP Proxy -> Dead (1 замена)

**Что:** `https://mcp-proxy.anthropic.com` -> `http://0.0.0.0:1`

**Зачем:** Anthropic-овский MCP прокси для подключения к их MCP серверам. Мы используем свои MCP (Tavily), поэтому блокируем.

---

## 5. Телеметрия -> Dead (12 замен)

**Что:** Все URL-адреса сервисов аналитики заблокированы.

**Зачем:** CLI отправляет подробную телеметрию о каждом действии, каждой ошибке, каждом вызове инструмента. Это:
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

**Зачем:** CLI может открывать эти URL в браузере или использовать для проверок. Блокируем для полной изоляции.

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

**Зачем:** Эти URL используются в:
- Сообщениях пользователю ("подробнее: code.claude.com/docs/...")
- Проверках (Chrome extension, мобильные приложения)
- Upsell-сообщениях ("обновите подписку")

Блокировка не ломает функциональность CLI, просто ссылки ведут в никуда.

**Исключение:** `claude.ai/api` перенаправлен на прокси, потому что через него CLI проверяет `domain_info` перед WebFetch.

---

## Итого

| Категория | Замен | Результат |
|-----------|-------|-----------|
| API -> Proxy | 17 | Запросы идут через Kimi прокси |
| Staging -> Dead | 2 | Тестовый API заблокирован |
| OAuth -> Proxy/Dead | 14 | Авторизация через mock |
| MCP Proxy -> Dead | 1 | Anthropic MCP заблокирован |
| Телеметрия -> Dead | 12 | Никакой аналитики |
| Автообновления -> Dead | 4 | CLI не обновляется |
| Sentry -> No-op | 3 | Error reporting отключён |
| LogEvent -> Safe | 7 | Трекинг событий отключён |
| Домены Anthropic -> Dead | 14 | Сайты Anthropic заблокированы |
| Ссылки Claude -> Dead | 162 | Все UI/документация ссылки заблокированы |
| **claude.ai/api -> Proxy** | - | domain_info для WebFetch работает |
| **Всего** | **239** | **Полная изоляция от Anthropic** |

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

## Защита от слёта патча

| Уровень | Механизм | Описание |
|---------|----------|----------|
| 1 | `autoUpdates: false` | В `.claude.json`, CLI не проверяет обновления |
| 2 | `attrib +R` на cli.js | Windows read-only флаг, файл нельзя перезаписать |
| 3 | Автопатч в `claude-kimi.cmd` | При запуске проверяет патч, если слетел — автоматически применяет заново |
| 4 | Фиксация версии npm | `npm install -g @anthropic-ai/claude-code@2.1.23` |

---

*Документ: v1.0 | 29.01.2026*
