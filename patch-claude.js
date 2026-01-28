// Патч Claude Code CLI для работы с Kimi API
// Версия 2.0

const fs = require('fs');

const CLI_PATH = process.argv[2] || process.env.APPDATA + '/npm/node_modules/@anthropic-ai/claude-code/cli.js';
const PROXY = 'http://localhost:8787';
const DEAD = 'http://0.0.0.0:1';

console.log('╔══════════════════════════════════════════════════╗');
console.log('║         Claude Code Patcher v2.0                 ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');
console.log(`CLI:   ${CLI_PATH}`);
console.log(`Proxy: ${PROXY}`);
console.log('');

// Проверка существования файла
if (!fs.existsSync(CLI_PATH)) {
    console.error('ОШИБКА: cli.js не найден!');
    console.error('Проверьте путь или установите: npm install -g @anthropic-ai/claude-code');
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

// ═══════════════════════════════════════════════════════════
// 1. ТЕЛЕМЕТРИЯ → DEAD
// ═══════════════════════════════════════════════════════════
console.log('1. Блокировка телеметрии:');

const telemetry = [
    // Sentry DSN
    'https://e531a1d9ec1de9064fae9d4affb0b0f4@o1158394.ingest.us.sentry.io/4508259541909504',
    // Statsig
    'https://api.statsigcdn.com',
    'https://statsigapi.net',
    'https://statsig.anthropic.com',
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

telemetry.forEach(url => replace(url, DEAD, url.substring(0, 50)));

// ═══════════════════════════════════════════════════════════
// 2. API ENDPOINT → PROXY
// ═══════════════════════════════════════════════════════════
console.log('\n2. API endpoint → proxy:');

replace('"https://api.anthropic.com"', `"${PROXY}"`, 'api.anthropic.com (double quoted)');
replace("'https://api.anthropic.com'", `'${PROXY}'`, 'api.anthropic.com (single quoted)');

// OAuth URLs → proxy
replace('https://platform.claude.com/oauth', `${PROXY}/oauth`, 'platform.claude.com/oauth');
replace('https://platform.claude.com/v1/oauth', `${PROXY}/v1/oauth`, 'platform.claude.com/v1/oauth');

// ═══════════════════════════════════════════════════════════
// 3. SENTRY CAPTURE → NO-OP
// ═══════════════════════════════════════════════════════════
console.log('\n3. Sentry capture → no-op:');

const sentryPatterns = [
    [/this\._client\.captureException\(/g, '((x)=>{})(' ],
    [/this\._client\.captureMessage\(/g, '((x)=>{})(' ],
    [/this\._client\.captureEvent\(/g, '((x)=>{})(' ],
];

sentryPatterns.forEach(([pattern, repl]) => {
    const matches = code.match(pattern);
    if (matches) {
        code = code.replace(pattern, repl);
        console.log(`  [${matches.length}x] ${pattern.toString().slice(0, 35)}...`);
        changes += matches.length;
    }
});

// ═══════════════════════════════════════════════════════════
// 4. LOGEVENT → OPTIONAL CHAINING
// ═══════════════════════════════════════════════════════════
console.log('\n4. logEvent → optional chaining:');

const logPatterns = [
    [/\.logEvent\(/g, '?.logEvent?.('],
    [/\.logEventAsync\(/g, '?.logEventAsync?.('],
    [/\.track\(/g, '?.track?.('],
];

logPatterns.forEach(([pattern, repl]) => {
    const matches = code.match(pattern);
    if (matches) {
        code = code.replace(pattern, repl);
        console.log(`  [${matches.length}x] ${pattern.toString().slice(1, 15)}`);
        changes += matches.length;
    }
});

// ═══════════════════════════════════════════════════════════
// СОХРАНЕНИЕ
// ═══════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════');
fs.writeFileSync(CLI_PATH, code);
console.log(`Файл:      ${CLI_PATH}`);
console.log(`Изменений: ${changes}`);
console.log(`Размер:    ${originalSize} → ${code.length}`);

// ═══════════════════════════════════════════════════════════
// ПРОВЕРКА
// ═══════════════════════════════════════════════════════════
console.log('\nПроверка:');
const verify = fs.readFileSync(CLI_PATH, 'utf8');

const checkUrls = ['api.anthropic.com', 'statsig.anthropic', 'api.segment.io', 'sentry.io'];
checkUrls.forEach(url => {
    const found = verify.includes(`https://${url}`);
    console.log(`  ${found ? 'ОСТАЛОСЬ:' : 'OK:'} ${url}`);
});

const proxyCount = (verify.match(new RegExp(PROXY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`  Прокси URL: ${proxyCount}`);

console.log('\n═══════════════════════════════════════════════════');
console.log('Готово! Теперь запустите прокси и claude-kimi');
console.log('═══════════════════════════════════════════════════');
