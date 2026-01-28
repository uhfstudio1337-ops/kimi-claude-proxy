// Поиск всех URL в cli.js
const fs = require('fs');

const CLI_PATH = process.env.APPDATA + '/npm/node_modules/@anthropic-ai/claude-code/cli.js';
const code = fs.readFileSync(CLI_PATH, 'utf8');

// Ищем все https:// URL
const urls = code.match(/https:\/\/[a-zA-Z0-9.-]+[a-zA-Z0-9/._\-?=&%]*/g);
const unique = [...new Set(urls)].sort();

console.log('Найдено уникальных URL:', unique.length);
console.log('\n=== ВСЕ НАЙДЕННЫЕ URL ===\n');

// Группируем по домену
const byDomain = {};
unique.forEach(url => {
    try {
        const domain = url.match(/https:\/\/([^/]+)/)[1];
        if (!byDomain[domain]) byDomain[domain] = [];
        byDomain[domain].push(url);
    } catch (e) {}
});

// Подозрительные домены (телеметрия, аналитика)
const suspicious = [
    'anthropic', 'claude', 'sentry', 'statsig', 'segment', 'datadog',
    'growthbook', 'google', 'analytics', 'telemetry', 'tracking', 'mixpanel',
    'amplitude', 'heap', 'hotjar', 'fullstory', 'logrocket', 'newrelic',
    'bugsnag', 'rollbar', 'raygun', 'errorception', 'airbrake'
];

console.log('=== ПОДОЗРИТЕЛЬНЫЕ (телеметрия/аналитика) ===\n');
let foundSuspicious = false;
Object.keys(byDomain).sort().forEach(domain => {
    const isSuspicious = suspicious.some(s => domain.toLowerCase().includes(s));
    if (isSuspicious) {
        foundSuspicious = true;
        console.log(`[!] ${domain}:`);
        byDomain[domain].forEach(url => console.log(`    ${url}`));
        console.log('');
    }
});

if (!foundSuspicious) {
    console.log('(нет подозрительных URL)\n');
}

console.log('=== ОСТАЛЬНЫЕ ДОМЕНЫ ===\n');
Object.keys(byDomain).sort().forEach(domain => {
    const isSuspicious = suspicious.some(s => domain.toLowerCase().includes(s));
    if (!isSuspicious) {
        console.log(`${domain}: ${byDomain[domain].length} URL`);
    }
});

console.log('\n=== ПОЛНЫЙ СПИСОК ===\n');
unique.forEach(url => console.log(url));
