// Integration-only preload: serve explicit venue fixtures, reject other external
// I/O, and pass loopback requests through. Never loaded by the application itself.
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const fixtures = require('./sf-eagle.json');
const apiUrl = 'https://wp.sf-eagle.com/wp-json/tribe/events/v1/events?per_page=50';
const indexUrl = 'https://sf-eagle.com/events/';
const originalFetch = globalThis.fetch;
const isLocal = (url) => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname);
globalThis.fetch = async (input, options) => {
  const url = String(input instanceof Request ? input.url : input);
  if (isLocal(url)) return originalFetch(input, options);
  fs.appendFileSync(process.env.BAY_TEST_FETCH_LOG, JSON.stringify({ url, redirect: options?.redirect }) + '\n');
  const mode = fs.readFileSync(process.env.BAY_TEST_MODE, 'utf8');
  const record = fixtures.occurrences[0];
  let body;
  if (url === apiUrl) body = JSON.stringify({ events: fixtures.occurrences.map(item => item.api) });
  else if (url === indexUrl) body = mode === 'missing' ? '<h1>No current event</h1>' : `<a href="${record.href}">Current occurrence</a>`;
  else if (url === record.href) body = `<link rel="canonical" href="${record.href}"><script type="application/ld+json">${JSON.stringify({ '@type': 'Event', url: record.href, startDate: mode === 'stale' ? '2026-10-26T20:00:00-07:00' : record.startDate, endDate: record.endDate })}</script>`;
  else throw new Error('Unexpected external request: ' + url);
  const response = new Response(body);
  Object.defineProperty(response, 'url', { value: url });
  return response;
};
for (const transport of [http, https]) {
  for (const method of ['request', 'get']) {
    const original = transport[method];
    transport[method] = function(input, ...args) {
      const host = typeof input === 'string' || input instanceof URL ? new URL(input).hostname : (input.hostname || input.host || 'localhost');
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
        fs.appendFileSync(process.env.BAY_TEST_FETCH_LOG, JSON.stringify({ unexpected: true, host, method }) + '\n');
        throw new Error('External HTTP disabled in integration test');
      }
      return original.call(this, input, ...args);
    };
  }
}
