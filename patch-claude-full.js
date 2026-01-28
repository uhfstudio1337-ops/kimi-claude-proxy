// ПОЛНЫЙ Патч Claude Code CLI для работы с Kimi API
// Версия 3.0 - Блокирует ВСЮ телеметрию и связь с Anthropic

const fs = require('fs');

const CLI_PATH = process.argv[2] || process.env.APPDATA + '/npm/node_modules/@anthropic-ai/claude-code/cli.js';
const PROXY = 'http://localhost:8787';
const DEAD = 'http://0.0.0.0:1';

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         Claude Code FULL Patcher v3.0                    ║');
console.log('║         Блокирует ВСЮ телеметрию и связь с Anthropic     ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log(`CLI:   ${CLI_PATH}`);
console.log(`Proxy: ${PROXY}`);
console.log(`Dead:  ${DEAD}`);
console.log('');

if (!fs.existsSync(CLI_PATH)) {
    console.error('ОШИБКА: cli.js не найден!');
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
        return count;
    }
    return 0;
}

function replaceRegex(pattern, repl, desc) {
    const matches = code.match(pattern);
    if (matches) {
        code = code.replace(pattern, repl);
        console.log(`  [${matches.length}x] ${desc}`);
        changes += matches.length;
        return matches.length;
    }
    return 0;
}

// ═══════════════════════════════════════════════════════════
// 1. API ENDPOINTS → PROXY
// ═══════════════════════════════════════════════════════════
console.log('1. API endpoints → proxy:');

// Основной API
replace('"https://api.anthropic.com"', `"${PROXY}"`, 'api.anthropic.com (double)');
replace("'https://api.anthropic.com'", `'${PROXY}'`, 'api.anthropic.com (single)');
replace('`https://api.anthropic.com`', `\`${PROXY}\``, 'api.anthropic.com (template)');

// Staging API → dead
replace('https://api-staging.anthropic.com', DEAD, 'api-staging.anthropic.com');

// ═══════════════════════════════════════════════════════════
// 2. CLAUDE.AI / PLATFORM.CLAUDE.COM → PROXY или DEAD
// ═══════════════════════════════════════════════════════════
console.log('\n2. Claude endpoints → proxy/dead:');

// OAuth → proxy (нужен для mock авторизации)
replace('https://platform.claude.com/oauth', `${PROXY}/oauth`, 'platform.claude.com/oauth');
replace('https://platform.claude.com/v1/oauth', `${PROXY}/v1/oauth`, 'platform.claude.com/v1/oauth');
replace('https://claude.ai/oauth', `${PROXY}/oauth`, 'claude.ai/oauth');

// Остальные claude.ai → dead
replace('https://claude.ai/admin-settings', DEAD, 'claude.ai/admin-settings');
replace('https://claude.ai/settings/data-privacy-controls', DEAD, 'claude.ai/settings/data-privacy');
replace('https://claude.ai/settings/usage', DEAD, 'claude.ai/settings/usage');

// Staging → dead
replace('https://staging.claude.ai', DEAD, 'staging.claude.ai');
replace('https://console.staging.ant.dev', DEAD, 'console.staging.ant.dev');

// ═══════════════════════════════════════════════════════════
// 3. MCP PROXY → DEAD (или оставить если используешь MCP)
// ═══════════════════════════════════════════════════════════
console.log('\n3. MCP proxy → dead:');
replace('https://mcp-proxy.anthropic.com', DEAD, 'mcp-proxy.anthropic.com');

// ═══════════════════════════════════════════════════════════
// 4. ТЕЛЕМЕТРИЯ / АНАЛИТИКА → DEAD
// ═══════════════════════════════════════════════════════════
console.log('\n4. Телеметрия → dead:');

const telemetry = [
    // Sentry
    'https://e531a1d9ec1de9064fae9d4affb0b0f4@o1158394.ingest.us.sentry.io/4508259541909504',
    'https://mcp.sentry.dev',

    // Statsig
    'https://api.statsigcdn.com',
    'https://statsigapi.net',
    'https://statsig.anthropic.com',
    'https://docs.statsig.com',

    // Segment
    'https://api.segment.io',
    'https://cdn.segment.com',

    // Datadog
    'https://http-intake.logs.us5.datadoghq.com',

    // GrowthBook
    'https://cdn.growthbook.io',
    'https://featureassets.org',
    'https://prodregistryv2.org',
];

telemetry.forEach(url => replace(url, DEAD, url.substring(8, 50)));

// ═══════════════════════════════════════════════════════════
// 5. АВТООБНОВЛЕНИЯ → DEAD
// ═══════════════════════════════════════════════════════════
console.log('\n5. Автообновления → dead:');
replace('https://storage.googleapis.com/claude-code-dist', DEAD, 'storage.googleapis.com/claude-code-dist');
replace('https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md', DEAD, 'CHANGELOG автообновление');
replace('https://raw.githubusercontent.com/anthropics/claude-plugins-official', DEAD, 'plugins-official');

// ═══════════════════════════════════════════════════════════
// 6. SENTRY CAPTURE FUNCTIONS → NO-OP
// ═══════════════════════════════════════════════════════════
console.log('\n6. Sentry capture → no-op:');

replaceRegex(/this\._client\.captureException\(/g, '((x)=>{})(' , 'captureException');
replaceRegex(/this\._client\.captureMessage\(/g, '((x)=>{})(' , 'captureMessage');
replaceRegex(/this\._client\.captureEvent\(/g, '((x)=>{})(' , 'captureEvent');

// ═══════════════════════════════════════════════════════════
// 7. LOG/TRACK FUNCTIONS → OPTIONAL CHAINING
// ═══════════════════════════════════════════════════════════
console.log('\n7. logEvent/track → optional chaining:');

replaceRegex(/\.logEvent\(/g, '?.logEvent?.(', 'logEvent');
replaceRegex(/\.logEventAsync\(/g, '?.logEventAsync?.(', 'logEventAsync');
replaceRegex(/\.track\(/g, '?.track?.(', 'track');

// ═══════════════════════════════════════════════════════════
// 8. ДОПОЛНИТЕЛЬНЫЕ ANTHROPIC ДОМЕНЫ → DEAD
// ═══════════════════════════════════════════════════════════
console.log('\n8. Дополнительные anthropic домены → dead:');

replace('https://www.anthropic.com', DEAD, 'www.anthropic.com');
replace('https://anthropic.com/legal', DEAD + '/legal', 'anthropic.com/legal');
replace('https://anthropic.com/supported-countries', DEAD, 'anthropic.com/supported-countries');
replace('https://docs.anthropic.com', DEAD, 'docs.anthropic.com');
replace('https://support.claude.com', DEAD, 'support.claude.com');

// ═══════════════════════════════════════════════════════════
// 9. СТАТИЧЕСКИЕ ССЫЛКИ CLAUDE → DEAD (полная изоляция)
// ═══════════════════════════════════════════════════════════
console.log('\n9. Статические ссылки claude → dead:');

// claude.ai/api → proxy (нужен для domain_info и других API)
replace('https://claude.ai/api', `${PROXY}/api`, 'claude.ai/api → proxy');

// claude.ai UI ссылки → dead
replace('https://claude.ai/chrome', DEAD, 'claude.ai/chrome');
replace('https://claude.ai/code', DEAD, 'claude.ai/code');
replace('https://claude.ai/upgrade', DEAD, 'claude.ai/upgrade');
replace('https://claude.ai"', DEAD + '"', 'claude.ai base');
replace("https://claude.ai'", DEAD + "'", 'claude.ai base single');

// code.claude.com документация
replace('https://code.claude.com', DEAD, 'code.claude.com');

// docs.claude.com
replace('https://docs.claude.com', DEAD, 'docs.claude.com');

// platform.claude.com (кроме oauth который уже на proxy)
replace('https://platform.claude.com/buy_credits', DEAD, 'platform.claude.com/buy_credits');
replace('https://platform.claude.com/settings', DEAD, 'platform.claude.com/settings');
replace('https://platform.claude.com/docs', DEAD, 'platform.claude.com/docs');
replace('https://platform.claude.com/llms', DEAD, 'platform.claude.com/llms');

// clau.de короткие ссылки
replace('https://clau.de', DEAD, 'clau.de');

// play.google.com/apple apps
replace('https://play.google.com/store/apps/details?id=com.anthropic', DEAD, 'play.google.com anthropic');
replace('https://apps.apple.com/app/claude', DEAD, 'apps.apple.com claude');

// ═══════════════════════════════════════════════════════════
// СОХРАНЕНИЕ
// ═══════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════');
fs.writeFileSync(CLI_PATH, code);
console.log(`Файл:      ${CLI_PATH}`);
console.log(`Изменений: ${changes}`);
console.log(`Размер:    ${originalSize} → ${code.length}`);

// ═══════════════════════════════════════════════════════════
// ПРОВЕРКА
// ═══════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════');
console.log('ПРОВЕРКА - оставшиеся anthropic/claude URL:');
console.log('═══════════════════════════════════════════════════════════');

const verify = fs.readFileSync(CLI_PATH, 'utf8');

// Ищем оставшиеся подозрительные URL
const suspicious = [
    'api.anthropic.com',
    'api-staging.anthropic.com',
    'statsig',
    'segment.io',
    'sentry.io',
    'datadoghq',
    'growthbook',
    'mcp-proxy.anthropic',
    'staging.claude',
];

let foundIssues = false;
suspicious.forEach(pattern => {
    if (verify.includes(`https://${pattern}`)) {
        console.log(`  [!] ОСТАЛОСЬ: https://${pattern}`);
        foundIssues = true;
    } else {
        console.log(`  [OK] ${pattern}`);
    }
});

// Считаем прокси URL
const proxyMatches = verify.match(/http:\/\/localhost:8787/g) || [];
const deadMatches = verify.match(/http:\/\/0\.0\.0\.0:1/g) || [];

console.log(`\n  Proxy URLs: ${proxyMatches.length}`);
console.log(`  Dead URLs:  ${deadMatches.length}`);

if (foundIssues) {
    console.log('\n[!] ВНИМАНИЕ: Некоторые URL не были заменены!');
    console.log('    Запустите скрипт ещё раз или проверьте вручную.');
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('Готово! Запустите прокси и claude-kimi');
console.log('═══════════════════════════════════════════════════════════');
