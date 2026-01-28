// Kimi Proxy Server v2.0 - Anthropic API → Kimi K2.5
// Полная поддержка tools

const http = require('http');
const https = require('https');

const PORT = 8787;
const KIMI_API_KEY = process.env.KIMI_API_KEY || 'YOUR_KIMI_API_KEY_HERE';
const KIMI_API_BASE = 'api.moonshot.ai';

// ═══════════════════════════════════════════════════════════
// МАППИНГ МОДЕЛЕЙ
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// КОНВЕРТАЦИЯ: Anthropic → OpenAI
// ═══════════════════════════════════════════════════════════

// Anthropic tools → OpenAI tools
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

// Anthropic messages → OpenAI messages
function convertMessages(anthropicMessages) {
    const messages = [];

    for (const msg of (anthropicMessages || [])) {
        if (msg.role === 'user') {
            if (Array.isArray(msg.content)) {
                const textParts = [];
                const toolResults = [];

                for (const block of msg.content) {
                    if (block.type === 'text') {
                        textParts.push(block.text);
                    } else if (block.type === 'tool_result') {
                        let resultContent = block.content;
                        if (Array.isArray(resultContent)) {
                            resultContent = resultContent
                                .filter(c => c.type === 'text')
                                .map(c => c.text)
                                .join('\n');
                        }
                        toolResults.push({
                            role: 'tool',
                            tool_call_id: block.tool_use_id,
                            content: typeof resultContent === 'string' ? resultContent : JSON.stringify(resultContent)
                        });
                    }
                }

                // ВАЖНО: Tool results ПЕРЕД user text (отвечают на предыдущий tool_call)
                toolResults.forEach(tr => messages.push(tr));

                if (textParts.length > 0) {
                    messages.push({ role: 'user', content: textParts.join('\n') });
                }
            } else {
                messages.push({ role: 'user', content: msg.content || '' });
            }
        } else if (msg.role === 'assistant') {
            if (Array.isArray(msg.content)) {
                let textContent = '';
                const toolCalls = [];

                for (const block of msg.content) {
                    if (block.type === 'text') {
                        textContent += block.text;
                    } else if (block.type === 'tool_use') {
                        toolCalls.push({
                            id: block.id,
                            type: 'function',
                            function: {
                                name: block.name,
                                arguments: JSON.stringify(block.input)
                            }
                        });
                    }
                }

                const assistantMsg = {
                    role: 'assistant',
                    content: textContent || null
                };
                if (toolCalls.length > 0) {
                    assistantMsg.tool_calls = toolCalls;
                    // Kimi K2.5 thinking mode требует reasoning_content
                    assistantMsg.reasoning_content = 'Executing tool call.';
                }
                messages.push(assistantMsg);
            } else {
                messages.push({ role: 'assistant', content: msg.content || '' });
            }
        }
    }

    return messages;
}

// Полная конвертация запроса
function convertRequest(anthropicReq) {
    const messages = [];

    // System prompt
    if (anthropicReq.system) {
        let systemText = anthropicReq.system;
        if (Array.isArray(systemText)) {
            systemText = systemText.map(s => s.text || String(s)).join('\n');
        }
        messages.push({ role: 'system', content: systemText });
    }

    messages.push(...convertMessages(anthropicReq.messages));

    const model = anthropicReq.model || 'claude-sonnet-4-20250514';

    const openaiReq = {
        model: MODEL_MAP[model] || 'kimi-k2.5',
        messages,
        max_tokens: anthropicReq.max_tokens || 4096,
        temperature: 1.0, // Kimi K2.5 требует temperature=1.0
        stream: anthropicReq.stream || false,
    };

    // Конвертируем tools
    let tools = convertTools(anthropicReq.tools) || [];

    // ВАЖНО: Добавляем $web_search builtin_function для поддержки веб-поиска
    // Kimi выполняет поиск автоматически на сервере
    tools.push({
        type: 'builtin_function',
        function: { name: '$web_search' }
    });

    if (tools.length > 0) {
        openaiReq.tools = tools;
        openaiReq.tool_choice = 'auto';
    }

    return openaiReq;
}

// ═══════════════════════════════════════════════════════════
// КОНВЕРТАЦИЯ: OpenAI → Anthropic
// ═══════════════════════════════════════════════════════════

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

    if (message.content) {
        content.push({ type: 'text', text: message.content });
    }

    if (message.tool_calls && Array.isArray(message.tool_calls)) {
        for (const tc of message.tool_calls) {
            let args = {};
            try {
                args = JSON.parse(tc.function.arguments);
            } catch (e) {
                args = { _raw: tc.function.arguments };
            }

            content.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.function.name,
                input: args
            });
        }
    }

    if (content.length === 0) {
        content.push({ type: 'text', text: '' });
    }

    return {
        id: openaiResp.id || 'msg_' + Date.now(),
        type: 'message',
        role: 'assistant',
        content: content,
        model: originalModel,
        stop_reason: convertStopReason(choice.finish_reason),
        stop_sequence: null,
        usage: {
            input_tokens: openaiResp.usage?.prompt_tokens || 0,
            output_tokens: openaiResp.usage?.completion_tokens || 0,
        }
    };
}

// ═══════════════════════════════════════════════════════════
// STREAMING
// ═══════════════════════════════════════════════════════════

function createStreamingHandler(res, originalModel) {
    let isFirstChunk = true;
    let buffer = '';
    let messageId = 'msg_' + Date.now();
    let toolCalls = {};
    let textBlockStarted = false;

    function sendEvent(event, data) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    function processChunk(chunk) {
        const choice = (chunk.choices || [{}])[0];
        const delta = choice.delta || {};
        const finishReason = choice.finish_reason;

        if (isFirstChunk) {
            isFirstChunk = false;
            sendEvent('message_start', {
                type: 'message_start',
                message: {
                    id: messageId,
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: originalModel,
                    stop_reason: null,
                    stop_sequence: null,
                    usage: { input_tokens: 0, output_tokens: 0 }
                }
            });

            sendEvent('content_block_start', {
                type: 'content_block_start',
                index: 0,
                content_block: { type: 'text', text: '' }
            });
            textBlockStarted = true;
        }

        if (delta.content) {
            sendEvent('content_block_delta', {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: delta.content }
            });
        }

        if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCalls[idx]) {
                    toolCalls[idx] = { id: '', name: '', arguments: '' };
                }
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments;
            }
        }

        if (finishReason) {
            if (textBlockStarted) {
                sendEvent('content_block_stop', { type: 'content_block_stop', index: 0 });
            }

            if (finishReason === 'tool_calls') {
                const toolCallsArray = Object.values(toolCalls);

                for (let i = 0; i < toolCallsArray.length; i++) {
                    const tc = toolCallsArray[i];
                    const blockIndex = i + 1;

                    let args = {};
                    try { args = JSON.parse(tc.arguments); } catch (e) { args = { _raw: tc.arguments }; }

                    sendEvent('content_block_start', {
                        type: 'content_block_start',
                        index: blockIndex,
                        content_block: { type: 'tool_use', id: tc.id, name: tc.name, input: {} }
                    });

                    sendEvent('content_block_delta', {
                        type: 'content_block_delta',
                        index: blockIndex,
                        delta: { type: 'input_json_delta', partial_json: JSON.stringify(args) }
                    });

                    sendEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
                }
            }

            sendEvent('message_delta', {
                type: 'message_delta',
                delta: { stop_reason: convertStopReason(finishReason) },
                usage: { output_tokens: 0 }
            });

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

                try {
                    processChunk(JSON.parse(jsonStr));
                } catch (e) {}
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

// ═══════════════════════════════════════════════════════════
// HTTP SERVER
// ═══════════════════════════════════════════════════════════

const server = http.createServer((req, res) => {
    const url = req.url;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Statsig mock
    if (url.includes('/statsig') || url.includes('statsig')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: {} }));
        return;
    }

    // OAuth mock
    if (url.includes('/oauth')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            access_token: 'mock_token_' + Date.now(),
            token_type: 'bearer',
            expires_in: 3600
        }));
        return;
    }

    // Health check
    if (req.method === 'GET' && (url === '/' || url === '/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            proxy: 'kimi-k2.5',
            version: '2.0',
            tools: true,
            streaming: true
        }));
        return;
    }

    // Domain info mock - разрешаем все домены для WebFetch
    if (url.includes('/api/web/domain_info') || url.includes('domain_info')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            can_fetch: true,
            status: 'allowed'
        }));
        console.log('[MOCK] domain_info → allowed');
        return;
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

                const toolCount = openaiReq.tools?.length || 0;
                console.log(`[API] ${originalModel} → ${openaiReq.model}, stream=${isStream}, tools=${toolCount}`);

                const postData = JSON.stringify(openaiReq);

                const options = {
                    hostname: KIMI_API_BASE,
                    port: 443,
                    path: '/v1/chat/completions',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${KIMI_API_KEY}`,
                        'Content-Length': Buffer.byteLength(postData),
                    }
                };

                const kimiReq = https.request(options, (kimiRes) => {
                    if (isStream) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        });

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
                                    console.log(`[ERROR] Kimi: ${openaiResp.error.message}`);
                                    res.writeHead(400, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({
                                        type: 'error',
                                        error: { type: 'api_error', message: openaiResp.error.message }
                                    }));
                                    return;
                                }

                                const anthropicResp = convertResponse(openaiResp, originalModel);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify(anthropicResp));
                            } catch (e) {
                                console.log(`[ERROR] Parse: ${e.message}`);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    type: 'error',
                                    error: { type: 'api_error', message: e.message }
                                }));
                            }
                        });
                    }
                });

                kimiReq.on('error', (e) => {
                    console.log(`[ERROR] Request: ${e.message}`);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        type: 'error',
                        error: { type: 'api_error', message: e.message }
                    }));
                });

                kimiReq.write(postData);
                kimiReq.end();

            } catch (e) {
                console.log(`[ERROR] ${e.message}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    type: 'error',
                    error: { type: 'invalid_request_error', message: e.message }
                }));
            }
        });
        return;
    }

    // Unknown
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'Not found' } }));
});

server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║     Kimi K2.5 Proxy Server v2.0                  ║');
    console.log('║     Anthropic API → OpenAI API Converter         ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Port:      ${PORT}                                  ║`);
    console.log(`║  API:       ${KIMI_API_BASE}                     ║`);
    console.log('║  Model:     kimi-k2.5                            ║');
    console.log('║  Tools:     ENABLED                              ║');
    console.log('║  Streaming: ENABLED                              ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
});
