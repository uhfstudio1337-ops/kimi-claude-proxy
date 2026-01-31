# Claude Code + Kimi K2.5: Полное руководство от А до Я

**Версия:** 4.0 | **Дата:** 29.01.2026

---

## Что это и зачем

**Claude Code CLI** — терминальный AI-агент от Anthropic (как Cursor, но в консоли).
**Kimi K2.5** — модель от Moonshot AI, по качеству на уровне Claude Opus 4.5.

| Параметр | Claude Opus 4.5 | Kimi K2.5 |
|----------|-----------------|-----------|
| Контекст | 200K | **256K** |
| Цена за 5 часов работы | ~$100 | **~$15** |
| Качество | Топ | На уровне Opus |
| Tools | Да | Да |

**Суть:** мы патчим Claude Code CLI и ставим прокси чтобы вместо API Anthropic использовался Kimi K2.5. Вся телеметрия блокируется.

### Архитектура

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Code    │────▶│  Kimi Proxy     │────▶│  Kimi K2.5 API  │
│  CLI (патченый) │     │  localhost:8787 │     │  api.moonshot.ai│
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Anthropic              Конвертер              OpenAI
     формат                 форматов               формат
```

---

## Требования

- **OS:** Windows 10/11 / Linux / macOS
- **Node.js:** 18+
- **npm:** включён в Node.js
- **VPN:** может потребоваться для api.moonshot.ai

---

## Шаг 1: Получение API ключей

### Kimi API Key (обязательно)

1. Зарегистрируйтесь на https://platform.moonshot.cn/
2. Пополните баланс
3. Создайте API ключ → сохраните (формат: `sk-...`)

### Tavily API Key (для веб-поиска)

1. Зарегистрируйтесь на https://tavily.com/
2. Получите API ключ (формат: `tvly-...`)
3. Бесплатно 1000 запросов/мес

---

## Шаг 2: Установка Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Проверка:
```bash
claude --version
```

Путь к cli.js:
```
Windows: %APPDATA%\npm\node_modules\@anthropic-ai\claude-code\cli.js
Linux:   ~/.npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js
macOS:   /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js
```

---

## Шаг 3: Деобфускация cli.js (опционально)

cli.js минифицирован (~17 MB в одну строку). Для анализа:

### Способ 1: webcrack (полная деобфускация)

```bash
npm install -g webcrack
cd <путь к claude-code>
npx webcrack cli.js -o deobfuscated
```

### Способ 2: prettier (только форматирование)

```bash
npm install -g prettier
cd <путь к claude-code>
cp cli.js cli.js.backup
npx prettier --write cli.js
```

Результат: ~580 000 строк с отступами, но обфусцированные имена.

### Что искать

```javascript
"https://api.anthropic.com"     // API endpoint
"statsig"                        // Feature flags
"sentry"                         // Error tracking
"segment"                        // Analytics
"datadog"                        // Logging
"growthbook"                     // A/B testing
```

---

## Шаг 4: Создание файлов

### Создайте папку

**Windows:**
```cmd
mkdir %USERPROFILE%\.local\bin
```

**Linux/macOS:**
```bash
mkdir -p ~/.local/bin
```

---

### 4.1 Скрипт патча: `patch-claude-full.js`

Сохраните в `~/.local/bin/patch-claude-full.js`:

```javascript
// ПОЛНЫЙ Патч Claude Code CLI для работы с Kimi API
// Версия 3.0 - Блокирует ВСЮ телеметрию и связь с Anthropic

const fs = require('fs');

// Автоопределение пути к cli.js
function findCliJs() {
    const paths = [
        process.env.APPDATA + '/npm/node_modules/@anthropic-ai/claude-code/cli.js',  // Windows
        process.env.HOME + '/.npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js',  // Linux
        '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',  // macOS/Linux
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

const CLI_PATH = process.argv[2] || findCliJs();
const PROXY = 'http://localhost:8787';
const DEAD = 'http://0.0.0.0:1';

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         Claude Code FULL Patcher v3.0                    ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`\nCLI: ${CLI_PATH}\nProxy: ${PROXY}\n`);

if (!CLI_PATH || !fs.existsSync(CLI_PATH)) {
    console.error('ОШИБКА: cli.js не найден! Укажите путь: node patch-claude-full.js /path/to/cli.js');
    process.exit(1);
}

let code = fs.readFileSync(CLI_PATH, 'utf8');
const originalSize = code.length;
let changes = 0;

function replace(search, repl, desc) {
    if (code.includes(search)) {
        const count = code.split(search).length - 1;
        code = code.split(search).join(repl);
        console.log(`  [${count}x] ${desc}`);
        changes += count;
    }
}

function replaceRegex(pattern, repl, desc) {
    const matches = code.match(pattern);
    if (matches) {
        code = code.replace(pattern, repl);
        console.log(`  [${matches.length}x] ${desc}`);
        changes += matches.length;
    }
}

// 1. API ENDPOINTS → PROXY
console.log('1. API endpoints → proxy:');
replace('"https://api.anthropic.com"', `"${PROXY}"`, 'api.anthropic.com (double)');
replace("'https://api.anthropic.com'", `'${PROXY}'`, 'api.anthropic.com (single)');
replace('`https://api.anthropic.com`', `\`${PROXY}\``, 'api.anthropic.com (template)');
replace('https://api-staging.anthropic.com', DEAD, 'api-staging.anthropic.com');

// 2. CLAUDE ENDPOINTS → PROXY/DEAD
console.log('\n2. Claude endpoints:');
replace('https://platform.claude.com/oauth', `${PROXY}/oauth`, 'platform.claude.com/oauth');
replace('https://platform.claude.com/v1/oauth', `${PROXY}/v1/oauth`, 'platform.claude.com/v1/oauth');
replace('https://claude.ai/oauth', `${PROXY}/oauth`, 'claude.ai/oauth');
replace('https://claude.ai/api', `${PROXY}/api`, 'claude.ai/api → proxy');
replace('https://claude.ai/admin-settings', DEAD, 'claude.ai/admin-settings');
replace('https://claude.ai/settings/data-privacy-controls', DEAD, 'claude.ai/settings/data-privacy');
replace('https://claude.ai/settings/usage', DEAD, 'claude.ai/settings/usage');
replace('https://staging.claude.ai', DEAD, 'staging.claude.ai');
replace('https://console.staging.ant.dev', DEAD, 'console.staging.ant.dev');

// 3. MCP PROXY → DEAD
console.log('\n3. MCP proxy:');
replace('https://mcp-proxy.anthropic.com', DEAD, 'mcp-proxy.anthropic.com');

// 4. ТЕЛЕМЕТРИЯ → DEAD
console.log('\n4. Телеметрия:');
const telemetry = [
    'https://e531a1d9ec1de9064fae9d4affb0b0f4@o1158394.ingest.us.sentry.io/4508259541909504',
    'https://mcp.sentry.dev',
    'https://api.statsigcdn.com', 'https://statsigapi.net', 'https://statsig.anthropic.com',
    'https://docs.statsig.com',
    'https://api.segment.io', 'https://cdn.segment.com',
    'https://http-intake.logs.us5.datadoghq.com',
    'https://cdn.growthbook.io', 'https://featureassets.org', 'https://prodregistryv2.org',
];
telemetry.forEach(url => replace(url, DEAD, url.substring(8, 50)));

// 5. АВТООБНОВЛЕНИЯ → DEAD
console.log('\n5. Автообновления:');
replace('https://storage.googleapis.com/claude-code-dist', DEAD, 'claude-code-dist');
replace('https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md', DEAD, 'CHANGELOG');
replace('https://raw.githubusercontent.com/anthropics/claude-plugins-official', DEAD, 'plugins');

// 6. SENTRY CAPTURE → NO-OP
console.log('\n6. Sentry capture:');
replaceRegex(/this\._client\.captureException\(/g, '((x)=>{})(', 'captureException');
replaceRegex(/this\._client\.captureMessage\(/g, '((x)=>{})(', 'captureMessage');
replaceRegex(/this\._client\.captureEvent\(/g, '((x)=>{})(', 'captureEvent');

// 7. LOG/TRACK → OPTIONAL CHAINING
console.log('\n7. logEvent/track:');
replaceRegex(/\.logEvent\(/g, '?.logEvent?.(', 'logEvent');
replaceRegex(/\.logEventAsync\(/g, '?.logEventAsync?.(', 'logEventAsync');
replaceRegex(/\.track\(/g, '?.track?.(', 'track');

// 8. ДОПОЛНИТЕЛЬНЫЕ ДОМЕНЫ → DEAD
console.log('\n8. Дополнительные домены:');
replace('https://www.anthropic.com', DEAD, 'www.anthropic.com');
replace('https://anthropic.com/legal', DEAD + '/legal', 'anthropic.com/legal');
replace('https://anthropic.com/supported-countries', DEAD, 'anthropic.com/supported-countries');
replace('https://docs.anthropic.com', DEAD, 'docs.anthropic.com');
replace('https://support.claude.com', DEAD, 'support.claude.com');

// 9. СТАТИЧЕСКИЕ ССЫЛКИ → DEAD
console.log('\n9. Статические ссылки:');
replace('https://claude.ai/chrome', DEAD, 'claude.ai/chrome');
replace('https://claude.ai/code', DEAD, 'claude.ai/code');
replace('https://claude.ai/upgrade', DEAD, 'claude.ai/upgrade');
replace('https://claude.ai"', DEAD + '"', 'claude.ai base');
replace("https://claude.ai'", DEAD + "'", 'claude.ai base single');
replace('https://code.claude.com', DEAD, 'code.claude.com');
replace('https://docs.claude.com', DEAD, 'docs.claude.com');
replace('https://platform.claude.com/buy_credits', DEAD, 'platform.claude.com/buy_credits');
replace('https://platform.claude.com/settings', DEAD, 'platform.claude.com/settings');
replace('https://platform.claude.com/docs', DEAD, 'platform.claude.com/docs');
replace('https://platform.claude.com/llms', DEAD, 'platform.claude.com/llms');
replace('https://clau.de', DEAD, 'clau.de');
replace('https://play.google.com/store/apps/details?id=com.anthropic', DEAD, 'play.google.com');
replace('https://apps.apple.com/app/claude', DEAD, 'apps.apple.com');

// СОХРАНЕНИЕ
console.log('\n' + '='.60);
fs.writeFileSync(CLI_PATH, code);
console.log(`Файл:      ${CLI_PATH}`);
console.log(`Изменений: ${changes}`);
console.log(`Размер:    ${originalSize} → ${code.length}`);
console.log('Готово!');
```

---

### 4.2 Прокси-сервер: `kimi-proxy.js`

Сохраните в `~/.local/bin/kimi-proxy.js`:

```javascript
// Kimi Proxy Server v2.1 - Anthropic API → Kimi K2.5
const http = require('http');
const https = require('https');

const PORT = 8787;
const KIMI_API_KEY = process.env.KIMI_API_KEY || 'YOUR_KIMI_API_KEY_HERE';  // ← ВСТАВЬ СВОЙ КЛЮЧ
const KIMI_API_BASE = 'api.moonshot.ai';

const MODEL_MAP = {
    'claude-sonnet-4-20250514': 'kimi-k2.5',
    'claude-3-5-sonnet-20241022': 'kimi-k2.5',
    'claude-opus-4-20250514': 'kimi-k2.5',
    'claude-opus-4-5-20251101': 'kimi-k2.5',
    'claude-3-opus-20240229': 'kimi-k2.5',
    'claude-3-5-haiku-20241022': 'kimi-k2.5',
    'claude-3-haiku-20240307': 'kimi-k2.5',
    'claude-haiku-4-5-20251001': 'kimi-k2.5',
};

// ═══ КОНВЕРТАЦИЯ: Anthropic → OpenAI ═══

function convertTools(anthropicTools) {
    if (!anthropicTools || !Array.isArray(anthropicTools)) return undefined;
    return anthropicTools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description || '',
            parameters: tool.input_schema || { type: 'object', properties: {} }
        }
    }));
}

function convertMessages(anthropicMessages) {
    const messages = [];
    for (const msg of (anthropicMessages || [])) {
        if (msg.role === 'user') {
            if (Array.isArray(msg.content)) {
                const textParts = [];
                const toolResults = [];
                for (const block of msg.content) {
                    if (block.type === 'text') textParts.push(block.text);
                    else if (block.type === 'tool_result') {
                        let resultContent = block.content;
                        if (Array.isArray(resultContent)) {
                            resultContent = resultContent.filter(c => c.type === 'text').map(c => c.text).join('\n');
                        }
                        toolResults.push({
                            role: 'tool',
                            tool_call_id: block.tool_use_id,
                            content: typeof resultContent === 'string' ? resultContent : JSON.stringify(resultContent)
                        });
                    }
                }
                toolResults.forEach(tr => messages.push(tr));
                if (textParts.length > 0) messages.push({ role: 'user', content: textParts.join('\n') });
            } else {
                messages.push({ role: 'user', content: msg.content || '' });
            }
        } else if (msg.role === 'assistant') {
            if (Array.isArray(msg.content)) {
                let textContent = '';
                let reasoningContent = '';
                const toolCalls = [];
                for (const block of msg.content) {
                    if (block.type === 'text') textContent += block.text;
                    else if (block.type === 'tool_use') {
                        toolCalls.push({
                            id: sanitizeToolId(block.id), type: 'function',
                            function: { name: block.name, arguments: JSON.stringify(block.input) }
                        });
                    } else if (block.type === 'thinking' && block.thinking) {
                        reasoningContent += block.thinking;
                    }
                }
                const assistantMsg = { role: 'assistant', content: textContent || null };
                if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
                // RESUME FIX v2: reasoning_content on ALL assistant msgs
                if (reasoningContent) assistantMsg.reasoning_content = reasoningContent;
                else if (toolCalls.length > 0) assistantMsg.reasoning_content = 'Executing tool call.';
                else if (textContent) assistantMsg.reasoning_content = 'Thinking...';
                messages.push(assistantMsg);
            } else {
                const assistantMsg = { role: 'assistant', content: msg.content || '' };
                assistantMsg.reasoning_content = 'Thinking...';
                messages.push(assistantMsg);
            }
        }
    }
    return messages;
}

function convertRequest(anthropicReq) {
    const messages = [];
    if (anthropicReq.system) {
        let systemText = anthropicReq.system;
        if (Array.isArray(systemText)) systemText = systemText.map(s => s.text || String(s)).join('\n');
        messages.push({ role: 'system', content: systemText });
    }
    messages.push(...convertMessages(anthropicReq.messages));

    const model = anthropicReq.model || 'claude-sonnet-4-20250514';
    const openaiReq = {
        model: MODEL_MAP[model] || 'kimi-k2.5',
        messages,
        max_tokens: anthropicReq.max_tokens || 4096,
        temperature: 1.0,
        stream: anthropicReq.stream || false,
    };

    let tools = convertTools(anthropicReq.tools) || [];
    // Встроенный веб-поиск Kimi
    tools.push({ type: 'builtin_function', function: { name: '$web_search' } });
    if (tools.length > 0) {
        openaiReq.tools = tools;
        openaiReq.tool_choice = 'auto';
    }
    return openaiReq;
}

// ═══ КОНВЕРТАЦИЯ: OpenAI → Anthropic ═══

function convertStopReason(finishReason) {
    switch (finishReason) {
        case 'tool_calls': return 'tool_use';
        case 'stop': return 'end_turn';
        case 'length': return 'max_tokens';
        default: return 'end_turn';
    }
}

function convertResponse(openaiResp, originalModel) {
    const choice = (openaiResp.choices || [{}])[0];
    const message = choice.message || {};
    const content = [];

    if (message.content) content.push({ type: 'text', text: message.content });
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
        for (const tc of message.tool_calls) {
            let args = {};
            try { args = JSON.parse(tc.function.arguments); } catch (e) { args = { _raw: tc.function.arguments }; }
            content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: args });
        }
    }
    if (content.length === 0) content.push({ type: 'text', text: '' });

    return {
        id: openaiResp.id || 'msg_' + Date.now(),
        type: 'message', role: 'assistant', content,
        model: originalModel,
        stop_reason: convertStopReason(choice.finish_reason),
        stop_sequence: null,
        usage: {
            input_tokens: openaiResp.usage?.prompt_tokens || 0,
            output_tokens: openaiResp.usage?.completion_tokens || 0,
        }
    };
}

// ═══ STREAMING ═══

function createStreamingHandler(res, originalModel) {
    let isFirstChunk = true, buffer = '', messageId = 'msg_' + Date.now();
    let toolCalls = {}, textBlockStarted = false;

    function sendEvent(event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }

    function processChunk(chunk) {
        const choice = (chunk.choices || [{}])[0];
        const delta = choice.delta || {};
        const finishReason = choice.finish_reason;

        if (isFirstChunk) {
            isFirstChunk = false;
            sendEvent('message_start', {
                type: 'message_start',
                message: { id: messageId, type: 'message', role: 'assistant', content: [],
                    model: originalModel, stop_reason: null, stop_sequence: null,
                    usage: { input_tokens: 0, output_tokens: 0 } }
            });
            sendEvent('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
            textBlockStarted = true;
        }

        if (delta.content) {
            sendEvent('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: delta.content } });
        }

        if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCalls[idx]) toolCalls[idx] = { id: '', name: '', arguments: '' };
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments;
            }
        }

        if (finishReason) {
            if (textBlockStarted) sendEvent('content_block_stop', { type: 'content_block_stop', index: 0 });
            if (finishReason === 'tool_calls') {
                Object.values(toolCalls).forEach((tc, i) => {
                    const blockIndex = i + 1;
                    let args = {};
                    try { args = JSON.parse(tc.arguments); } catch (e) { args = { _raw: tc.arguments }; }
                    sendEvent('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'tool_use', id: tc.id, name: tc.name, input: {} } });
                    sendEvent('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'input_json_delta', partial_json: JSON.stringify(args) } });
                    sendEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
                });
            }
            sendEvent('message_delta', { type: 'message_delta', delta: { stop_reason: convertStopReason(finishReason) }, usage: { output_tokens: 0 } });
            sendEvent('message_stop', { type: 'message_stop' });
        }
    }

    return {
        processData: (data) => {
            buffer += data;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (jsonStr === '[DONE]') return;
                try { processChunk(JSON.parse(jsonStr)); } catch (e) {}
            }
        },
        finish: () => {
            if (buffer.trim()) {
                const line = buffer.trim();
                if (line.startsWith('data: ') && line.slice(6).trim() !== '[DONE]') {
                    try { processChunk(JSON.parse(line.slice(6))); } catch (e) {}
                }
            }
            res.end();
        }
    };
}

// ═══ HTTP SERVER ═══

const server = http.createServer((req, res) => {
    const url = req.url;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Mocks
    if (url.includes('/statsig') || url.includes('statsig')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: {} })); return;
    }
    if (url.includes('/oauth')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ access_token: 'mock_' + Date.now(), token_type: 'bearer', expires_in: 3600 })); return;
    }
    if (url.includes('/api/web/domain_info') || url.includes('domain_info')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ can_fetch: true, status: 'allowed' }));
        console.log('[MOCK] domain_info → allowed'); return;
    }
    if (req.method === 'GET' && (url === '/' || url === '/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', proxy: 'kimi-k2.5', version: '2.1' })); return;
    }

    // Messages API
    if (req.method === 'POST' && url.includes('/messages')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const anthropicReq = JSON.parse(body);
                const originalModel = anthropicReq.model;
                const isStream = anthropicReq.stream;
                const openaiReq = convertRequest(anthropicReq);
                console.log(`[API] ${originalModel} → ${openaiReq.model}, stream=${isStream}, tools=${openaiReq.tools?.length || 0}`);

                const postData = JSON.stringify(openaiReq);
                const options = {
                    hostname: KIMI_API_BASE, port: 443, path: '/v1/chat/completions', method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIMI_API_KEY}`, 'Content-Length': Buffer.byteLength(postData) }
                };

                const kimiReq = https.request(options, (kimiRes) => {
                    if (isStream) {
                        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
                        const handler = createStreamingHandler(res, originalModel);
                        kimiRes.on('data', (chunk) => handler.processData(chunk.toString()));
                        kimiRes.on('end', () => handler.finish());
                    } else {
                        let data = '';
                        kimiRes.on('data', chunk => { data += chunk; });
                        kimiRes.on('end', () => {
                            try {
                                const openaiResp = JSON.parse(data);
                                if (openaiResp.error) {
                                    res.writeHead(400, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: openaiResp.error.message } })); return;
                                }
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify(convertResponse(openaiResp, originalModel)));
                            } catch (e) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: e.message } }));
                            }
                        });
                    }
                });
                kimiReq.on('error', (e) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: e.message } }));
                });
                kimiReq.write(postData);
                kimiReq.end();
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: e.message } }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'Not found' } }));
});

server.listen(PORT, () => {
    console.log(`\n  Kimi K2.5 Proxy v2.1 | Port: ${PORT} | API: ${KIMI_API_BASE}\n`);
});
```

**ВАЖНО:** замените `YOUR_KIMI_API_KEY_HERE` на свой ключ, или установите переменную окружения:
```bash
export KIMI_API_KEY=sk-ваш-ключ       # Linux/macOS
set KIMI_API_KEY=sk-ваш-ключ          # Windows
```

---

### 4.3 Скрипты запуска

**Windows — `start-kimi-proxy.cmd`:**
```cmd
@echo off
echo Starting Kimi Proxy on port 8787...
node "%USERPROFILE%\.local\bin\kimi-proxy.js"
```

**Windows — `claude-kimi.cmd`:**
```cmd
@echo off
set ANTHROPIC_BASE_URL=http://localhost:8787
set ANTHROPIC_API_KEY=sk-kimi-proxy
"%APPDATA%\npm\claude.cmd" %*
```

**Linux/macOS — добавьте в `~/.bashrc` или `~/.zshrc`:**
```bash
alias start-kimi-proxy='node ~/.local/bin/kimi-proxy.js'
alias claude-kimi='ANTHROPIC_BASE_URL=http://localhost:8787 ANTHROPIC_API_KEY=sk-kimi-proxy claude'
```

---

### 4.4 Добавление в PATH

**Windows:**
```powershell
[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + $env:USERPROFILE + '\.local\bin', 'User')
```

**Linux/macOS:**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

## Шаг 5: Патчинг

```bash
node ~/.local/bin/patch-claude-full.js
```

Ожидаемый результат: ~200+ заблокированных URL, ~20+ перенаправленных на прокси.

### Что блокируется

| Сервис | Назначение | Статус |
|--------|------------|--------|
| api.anthropic.com | API | → proxy |
| sentry.io | Error tracking | → dead |
| statsig.anthropic.com | Feature flags | → dead |
| api.segment.io | Analytics | → dead |
| datadoghq.com | Logging | → dead |
| growthbook.io | A/B testing | → dead |
| storage.googleapis.com/claude-code-dist | Автообновления | → dead |
| claude.ai, code.claude.com | UI ссылки | → dead |

---

## Шаг 6: Настройка Tavily MCP (веб-поиск)

WebSearch (встроенный в Claude Code) не работает через Kimi — это серверная функция Anthropic.

**Замена: Tavily MCP** — 1000 запросов/мес бесплатно.

```bash
# Установка
npm install -g tavily-mcp@latest

# Добавление в Claude Code
claude mcp add tavily-search -- npx -y tavily-mcp@latest
```

Добавьте API ключ в `~/.claude.json` → найдите `mcpServers` и добавьте `env`:

```json
{
  "tavily-search": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "tavily-mcp@latest"],
    "env": {
      "TAVILY_API_KEY": "tvly-ваш-ключ"
    }
  }
}
```

---

## Шаг 7: Запуск

**Терминал 1 — Прокси:**
```bash
start-kimi-proxy
```

**Терминал 2 — Claude Code:**
```bash
claude-kimi
```

### Первый запуск

1. Если спросит про API key — выберите **"Yes, use environment variable"**
2. Если "Auth conflict": `claude /logout` → затем `claude-kimi`

### Проверка

```bash
curl http://localhost:8787/health
# Ответ: {"status":"ok","proxy":"kimi-k2.5","version":"2.1"}
```

---

## Что работает

| Инструмент | Статус | Примечание |
|------------|--------|------------|
| Bash, Read, Write, Edit | ✅ | Инструменты CLI |
| Glob, Grep | ✅ | Поиск по файлам |
| WebFetch | ✅ | domain_info замокан в прокси |
| Tavily Search (MCP) | ✅ | Замена WebSearch |
| Tool Calling | ✅ | Через прокси конвертер |
| Streaming | ✅ | SSE конвертация |
| WebSearch | ❌ | server_tool_use Anthropic, заменён Tavily |

---

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| Invalid Authentication | Проверь API ключ и баланс на moonshot |
| thinking...reasoning_content missing | Исправлено в v3.3. Перезапусти прокси. Если повторяется — начни новую сессию |
| tool_calls must be followed by tool | Начни новую сессию |
| WebFetch: Unable to verify domain | Перезапусти прокси |
| Auth conflict | `claude /logout` → `claude-kimi` |
| После обновления Claude Code | `claude-kimi.cmd` автоматически пропатчит при запуске |

---

## Модели Kimi

| Модель | Описание | Цена |
|--------|----------|------|
| `kimi-k2.5` | Топовая, мультимодальная | ~0.002¥/1K |
| `kimi-k2-0905` | Улучшенный K2, дешевле | ~0.001¥/1K |
| `kimi-k2-0711-preview` | Preview версия | ~0.001¥/1K |

Смена модели — в `kimi-proxy.js` → `MODEL_MAP`.

---

## Технические детали

### Форматы API

| Anthropic | OpenAI/Kimi |
|-----------|-------------|
| `tools[].input_schema` | `tools[].function.parameters` |
| `tool_use` (content block) | `tool_calls[]` |
| `tool_result` (content block) | `role: "tool"` message |
| `stop_reason: "tool_use"` | `finish_reason: "tool_calls"` |

### Kimi K2.5 особенности

- **Temperature:** обязательно `1.0` (thinking mode)
- **API URL:** `https://api.moonshot.ai/v1/chat/completions`
- **Формат:** OpenAI-совместимый
- **Контекст:** 256K токенов

---

## Источники

- [Moonshot AI Platform](https://platform.moonshot.ai/)
- [Kimi K2.5 HuggingFace](https://huggingface.co/moonshotai/Kimi-K2.5)
- [Kimi K2 GitHub](https://github.com/MoonshotAI/Kimi-K2)
- [Tavily](https://tavily.com/)
- [GitHub Repo](https://github.com/uhfstudio1337-ops/kimi-claude-proxy)

---

*Версия: 4.0 | 29.01.2026*
