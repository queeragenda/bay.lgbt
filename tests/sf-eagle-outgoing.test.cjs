// node --test tests/sf-eagle-outgoing.test.cjs
// Use the declared TypeScript/Vue compilers; no Node TypeScript stripping or new dependency.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { parse, compileScript } = require('@vue/compiler-sfc');
const { createSSRApp, defineComponent, h } = require('vue');
const { renderToString } = require('vue/server-renderer');
const fixture = require('./fixtures/sf-eagle.json');
const repo = path.resolve(__dirname, '..');

function loadTs(filename, source = fs.readFileSync(filename, 'utf8')) {
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (id) => id.endsWith('.css') ? {} : Module.prototype.require.call(mod, id);
  mod._compile(compiled, filename);
  return mod.exports;
}
const { sfEagleOutgoingUrl, SF_EAGLE_API } = loadTs(path.join(repo, 'server/utils/sf-eagle-outgoing.ts'));
const source = { sourceType: 'wordpress-tribe', url: SF_EAGLE_API };
const indexUrl = 'https://sf-eagle.com/events/';
const clone = (value) => JSON.parse(JSON.stringify(value));
function scenario(record = fixture.occurrences[0]) {
  const api = clone(record.api);
  const schema = { '@context': 'https://schema.org', '@type': 'Event', url: record.href, startDate: record.startDate, endDate: record.endDate };
  return {
    event: { url: api.url, start: new Date(api.utc_start_date.replace(' ', 'T') + 'Z'), end: new Date(api.utc_end_date.replace(' ', 'T') + 'Z') },
    api: { events: [api] },
    index: `<a href="${record.href}">event</a>`,
    canonical: record.href, schema, destination: record.href,
  };
}
function pages(s) {
  return new Map([
    [SF_EAGLE_API, JSON.stringify(s.api)],
    [indexUrl, s.index],
    [s.destination, `<link rel="canonical" href="${s.canonical}"><script type="application/ld+json">${JSON.stringify(s.schema)}</script>`],
  ]);
}
function fetchFixture(s, mutate) {
  const content = pages(s), calls = [];
  const fetch = async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    assert.ok(content.has(url), `Only the three expected fixed-origin URLs may be fetched: ${url}`);
    const response = new Response(content.get(url));
    Object.defineProperty(response, 'url', { value: url });
    return mutate ? mutate(response, url, options) : response;
  };
  return { fetch, calls };
}
for (const record of fixture.occurrences) {
  test(`verified current API-ID ${record.api.id} selects its exact UTC occurrence`, async () => {
    const s = scenario(record), original = clone(s.event), f = fetchFixture(s);
    assert.equal(await sfEagleOutgoingUrl(s.event, source, f.fetch), s.destination);
    assert.deepEqual(f.calls, [SF_EAGLE_API, indexUrl, s.destination]);
    assert.equal(s.event.url, original.url, 'Resolver never mutates storage identity');
  });
}
const cases = {
  'missing original URL': s => { s.api.events[0].url += '?different'; },
  'duplicate original URL': s => { s.api.events.push(clone(s.api.events[0])); },
  'reused API ID': s => { s.api.events.push({ ...s.api.events[0], url: 'https://wp.sf-eagle.com/event/other/' }); },
  'changed API start': s => { s.api.events[0].utc_start_date = '2026-11-04 04:00:00'; },
  'changed API end': s => { s.api.events[0].utc_end_date = '2026-11-04 09:00:00'; },
  'unpublished API occurrence': s => { s.api.events[0].status = 'draft'; },
  'missing index href': s => { s.index = ''; },
  'unsuffixed recurring href': s => { s.index = '<a href="/events/karaoke-with-dana/">earlier occurrence</a>'; },
  'ambiguous indexed ID': s => { s.index += `<a href="/events/another-${s.api.events[0].id}/">other</a>`; },
  'untrusted origin': s => { s.index = `<a href="https://evil.invalid/events/karaoke-${s.api.events[0].id}/">bad</a>`; },
  'query-bearing destination': s => { s.index = `<a href="${s.destination}?other=1">bad</a>`; },
  'wrong canonical (homepage 200)': s => { s.canonical = 'https://sf-eagle.com/'; },
  'wrong structured URL': s => { s.schema.url = 'https://sf-eagle.com/events/karaoke-with-dana/'; },
  'earlier recurring occurrence': s => { s.schema.startDate = '2026-10-26T20:00:00-07:00'; s.schema.endDate = '2026-10-27T01:00:00-07:00'; },
  'wrong end time': s => { s.schema.endDate = '2026-11-03T02:00:00-08:00'; },
  'offsetless dates': s => { s.schema.startDate = '2026-11-02T20:00:00'; },
  'stale daylight-saving offset': s => { s.schema.startDate = '2026-11-02T20:00:00-07:00'; },
  'multiple structured Events': s => { s.schema = [s.schema, clone(s.schema)]; },
  'missing structured Event': s => { s.schema = { '@type': 'WebPage' }; },
};
for (const [name, mutate] of Object.entries(cases)) {
  test(`falls back unchanged: ${name}`, async () => {
    const s = scenario(); mutate(s); const f = fetchFixture(s);
    assert.equal(await sfEagleOutgoingUrl(s.event, source, f.fetch), s.event.url);
    assert.ok(f.calls.length <= 3);
  });
}
test('other sources never fetch', async () => {
  const s = scenario();
  for (const other of [{ ...source, sourceType: 'ical' }, { ...source, url: source.url + '&other=1' }]) {
    assert.equal(await sfEagleOutgoingUrl(s.event, other, () => { throw new Error('must not fetch'); }), s.event.url);
  }
});
for (const [name, change] of Object.entries({
  'redirect': response => new Response('', { status: 302, headers: { location: 'https://evil.invalid/' } }),
  'network failure': () => { throw new Error('offline'); },
  'malformed JSON': response => { const bad = new Response('{bad'); Object.defineProperty(bad, 'url', { value: SF_EAGLE_API }); return bad; },
  'oversize body': response => { const big = new Response('x'.repeat(2 * 1024 * 1024 + 1)); Object.defineProperty(big, 'url', { value: SF_EAGLE_API }); return big; },
})) {
  test(`bounded failure fallback: ${name}`, async () => {
    const s = scenario(), f = fetchFixture(s, change);
    assert.equal(await sfEagleOutgoingUrl(s.event, source, f.fetch), s.event.url);
    assert.equal(f.calls.length, 1);
  });
}
test('one timeout covers response body consumption', async () => {
  const s = scenario(); let signal;
  const started = Date.now();
  const hangingBody = async (url, options) => {
    signal = options.signal;
    const response = new Response(new ReadableStream({ start(controller) { signal.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true }); } }));
    Object.defineProperty(response, 'url', { value: url }); return response;
  };
  assert.equal(await sfEagleOutgoingUrl(s.event, source, hangingBody), s.event.url);
  assert.equal(signal.aborted, true);
  assert.ok(Date.now() - started < 6000);
});
test('revalidates every click instead of reusing a previously good redirect', async () => {
  const s = scenario();
  assert.equal(await sfEagleOutgoingUrl(s.event, source, fetchFixture(s).fetch), s.destination);
  s.index = '';
  assert.equal(await sfEagleOutgoingUrl(s.event, source, fetchFixture(s).fetch), s.event.url);
});
for (const where of ['API', 'JSON-LD']) {
  test(`rejects normalized invalid calendar dates in ${where}`, async () => {
    const s = scenario();
    s.event.start = new Date('2026-03-02T04:00:00Z');
    s.event.end = new Date('2026-03-02T09:00:00Z');
    s.api.events[0].utc_start_date = '2026-03-02 04:00:00';
    s.api.events[0].utc_end_date = '2026-03-02 09:00:00';
    s.schema.startDate = '2026-03-02T04:00:00Z';
    s.schema.endDate = '2026-03-02T09:00:00Z';
    if (where === 'API') s.api.events[0].utc_start_date = '2026-02-30 04:00:00';
    else s.schema.startDate = '2026-02-30T04:00:00Z';
    assert.equal(await sfEagleOutgoingUrl(s.event, source, fetchFixture(s).fetch), s.event.url);
  });
}
test('compiled UI passes native-navigation external contract only to View Original', async () => {
  function vueComponent(name) {
    const filename = path.join(repo, 'components', name + '.vue');
    const { descriptor } = parse(fs.readFileSync(filename, 'utf8'), { filename });
    return loadTs(filename, compileScript(descriptor, { id: name, inlineTemplate: true }).content).default;
  }
  const seen = [];
  const NuxtLink = defineComponent({ props: ['to', 'external'], setup(props, { slots }) { seen.push({ ...props }); return () => h('a', { href: typeof props.to === 'string' ? props.to : props.to.path }, slots.default()); } });
  const app = createSSRApp(vueComponent('SingleEvent'), { event: {
    title: 'Fixture', start: '2026-11-03T04:00:00Z', end: '2026-11-03T09:00:00Z',
    extendedProps: { outgoingUrl: '/api/events/123/outgoing', originalUrl: 'https://wp.sf-eagle.com/event/original/', organizer: 'SF Eagle', organizerId: 7 },
  } });
  app.component('NuxtLink', NuxtLink);
  app.component('OldSchoolButton', vueComponent('OldSchoolButton'));
  app.component('OldSchoolWindow', { setup: (_, { slots }) => () => h('div', slots.default()) });
  app.component('EventLocation', { render: () => null });
  const html = await renderToString(app);
  assert.equal((html.match(/href="\/api\/events\/123\/outgoing"/g) || []).length, 2);
  assert.equal(seen[0].to, '/api/events/123/outgoing');
  assert.equal(seen[0].external, true, 'NuxtLink must bypass RouterLink for the relative API redirect');
  assert.equal(seen[1].external, false, 'Organizer button keeps app navigation');
  // This checks the compiled components' NuxtLink contract, not a browser click;
  // the native H3 integration separately checks the real redirect response.
});
