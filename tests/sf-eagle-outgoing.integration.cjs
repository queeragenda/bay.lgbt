// After npm run prisma-generate && npm run build:
// node tests/sf-eagle-outgoing.integration.cjs
// Runs the real built Nitro/H3 routes and Prisma against disposable SQLite.
// Only the three venue reads are fixture-controlled; no provider jobs are run.
// Requires the application's normal startup environment (see README). Scraping
// stays disabled and the preload rejects all non-fixture external requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const fixture = require('./fixtures/sf-eagle.json').occurrences[0];
const repo = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'bay-outgoing-test-'));
  const database = 'file:' + path.join(work, 'events.db');
  const mode = path.join(work, 'mode');
  const fetchLog = path.join(work, 'fetch.log');
  const serverLog = path.join(work, 'server.log');
  fs.writeFileSync(mode, 'current'); fs.writeFileSync(fetchLog, '');
  const env = { ...process.env, DATABASE_PRISMA_URL: database, SKIP_SCRAPE: 'true', SKIP_INSTAGRAM_SCRAPE: 'true', BAY_TEST_MODE: mode, BAY_TEST_FETCH_LOG: fetchLog };
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { cwd: repo, env, stdio: 'pipe' });
  const prisma = new PrismaClient({ datasources: { db: { url: database } } });
  let child;
  try {
    const source = await prisma.urlSource.create({ data: { sourceName: 'SF Eagle', sourceCity: 'sf', sourceType: 'wordpress-tribe', url: 'https://wp.sf-eagle.com/wp-json/tribe/events/v1/events?per_page=50', lastScraped: new Date(0) } });
    const dates = { start: new Date(fixture.api.utc_start_date.replace(' ', 'T') + 'Z'), end: new Date(fixture.api.utc_end_date.replace(' ', 'T') + 'Z') };
    const stored = await prisma.urlEvent.create({ data: { sourceId: source.id, title: 'Karaoke with Dana', ...dates, url: fixture.api.url, extendedProps: JSON.stringify({ outgoingUrl: 'https://evil.invalid/', originalUrl: 'https://evil.invalid/spoof' }) } });
    const otherSource = await prisma.urlSource.create({ data: { sourceName: 'Other', sourceCity: 'sf', sourceType: 'wordpress-tribe', url: 'https://example.invalid/source', lastScraped: new Date(0) } });
    const other = await prisma.urlEvent.create({ data: { sourceId: otherSource.id, title: 'Other event', ...dates, url: 'https://example.invalid/original', extendedProps: JSON.stringify({ outgoingUrl: 'https://evil.invalid/' }) } });
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    const fd = fs.openSync(serverLog, 'w');
    child = spawn(process.execPath, ['--require', path.join(__dirname, 'fixtures/sf-eagle-fetch.cjs'), '.output/server/index.mjs'], { cwd: repo, env: { ...env, NODE_ENV: 'production', NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', fd, fd] });
    fs.closeSync(fd);
    for (let i = 0; ; i++) {
      if (child.exitCode !== null || i === 100) throw new Error('Nitro did not become ready: ' + fs.readFileSync(serverLog, 'utf8'));
      try { await fetch(origin + `/api/events/${stored.id}`); break; } catch { await sleep(100); }
    }
    const detail = (await (await fetch(origin + `/api/events/${stored.id}`)).json()).body;
    const outgoing = `/api/events/${stored.id}/outgoing`;
    assert.equal(detail.extendedProps.originalUrl, fixture.api.url);
    assert.equal(detail.extendedProps.outgoingUrl, outgoing, 'Server-owned DB ID beats untrusted JSON');
    assert.equal(detail.id, undefined, 'No nonexistent top-level event.id is needed');
    const full = await (await fetch(origin + '/api/events/list?format=full')).json();
    assert.equal(full.find(e => e.url === detail.url).extendedProps.outgoingUrl, outgoing);
    const compact = await (await fetch(origin + '/api/events/list')).json();
    assert.equal(compact.find(e => e.url === detail.url).extendedProps, undefined);
    const otherDetail = (await (await fetch(origin + `/api/events/${other.id}`)).json()).body;
    assert.equal(otherDetail.extendedProps.outgoingUrl, undefined);
    const ssrResponse = await fetch(origin + detail.url);
    assert.equal(ssrResponse.status, 200);
    const html = await ssrResponse.text();
    assert.equal((html.match(new RegExp(`href="${outgoing}"`, 'g')) || []).length, 2, 'Both rendered links reach the outgoing route');
    assert.equal(fs.readFileSync(fetchLog, 'utf8'), '', 'Rendering does not make venue/provider requests');
    const click = () => fetch(origin + outgoing, { redirect: 'manual' });
    const first = await click();
    assert.equal(first.status, 302); assert.equal(first.headers.get('location'), fixture.href);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    fs.writeFileSync(mode, 'missing');
    const missing = await click();
    assert.equal(missing.headers.get('location'), fixture.api.url, 'A formerly good redirect is revalidated, not cached');
    fs.writeFileSync(mode, 'stale');
    assert.equal((await click()).headers.get('location'), fixture.api.url);
    for (const [id, status] of [['invalid', 400], ['0', 400], ['999999999', 404]]) {
      assert.equal((await fetch(origin + `/api/events/${id}/outgoing`, { redirect: 'manual' })).status, status);
    }
    const reads = fs.readFileSync(fetchLog, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(reads.length, 8, 'Three + two + three bounded venue fixture reads, no other external I/O');
    assert.ok(reads.every(item => item.redirect === 'manual' && !item.unexpected));
    assert.equal((await prisma.urlEvent.findUnique({ where: { id: stored.id } })).url, fixture.api.url);
    for (let i = 0; i < 100 && !fs.readFileSync(serverLog, 'utf8').includes('Skipping all scrapes due to SKIP_SCRAPE env var'); i++) await sleep(100);
    assert.ok(fs.readFileSync(serverLog, 'utf8').includes('Skipping all scrapes due to SKIP_SCRAPE env var'));
    console.log(JSON.stringify({ passed: true, realBuiltNitro: true, realPrismaSQLite: true, detailAndLists: true, ssrOutgoingLinks: 2, invalid400: true, unknown404: true, storedIdentityRetained: true, current302: true, staleAndMissingFallback: true, noPositiveCache: true, fixtureVenueReads: reads.length, otherExternalReads: 0, browserExecuted: false }));
  } finally {
    if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited; }
    await prisma.$disconnect();
    if (process.env.BAY_KEEP_TEST_ARTIFACTS) console.log('Test artifacts: ' + work);
    else fs.rmSync(work, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
