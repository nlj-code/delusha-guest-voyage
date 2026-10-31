const { chromium } = require('playwright');
const { makeDb, handle, BASE } = require('./supabase-mock.js');
(async () => {
  const db = makeDb();
  const out = [];
  const check = (n, ok, x = '') => out.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 39.53, longitude: 2.6 } });
  await ctx.route(`${BASE}/**`, (r) => handle(db, r));
  await ctx.route('https://**open-meteo.com/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('https://photon.komoot.io/api/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ features: [
    { geometry: { coordinates: [3.1884, 39.3496] }, properties: { name: 'Platja de s\'Amarador', osm_key: 'natural', osm_value: 'beach', city: 'Santanyí', state: 'Balearic Islands' } },
    { geometry: { coordinates: [3.1905, 39.3505] }, properties: { name: 'Cala Mondragó', osm_key: 'natural', osm_value: 'bay', city: 'Santanyí', state: 'Balearic Islands' } },
    { geometry: { coordinates: [3.19, 39.35] }, properties: { name: 'Restaurant Playa Mondragó', osm_key: 'amenity', osm_value: 'restaurant' } } ] }) }));
  await ctx.route('https://photon.komoot.io/reverse**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ features: [{ geometry: { coordinates: [20.19, 39.2] }, properties: { name: 'Gaios', osm_key: 'place', osm_value: 'village' } }] }) }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:3030/#/login');
  await p.fill('#em', 'njalbout@gmail.com');
  await p.fill('#pw', 'HostPass-123');
  await p.click('#go');
  await p.waitForTimeout(1500);
  const land = await p.evaluate(async () => { const m = await import('./js/map.js'); return [m.isLand(39.60, 2.95), m.isLand(39.45, 2.60), m.isLand(39.3505, 3.1905)]; });
  check('land/sea check: Mallorca interior=land, Bay of Palma=water', land[0] === true && land[1] === false, JSON.stringify(land));
  await p.goto('http://localhost:3030/#/host/route');
  await p.waitForTimeout(800);
  await p.click('#addstop');
  await p.fill('#q', 'Cala Mond');
  await p.waitForTimeout(1200);
  check('search shows results', (await p.locator('[data-r]').count()) === 3);
  await p.screenshot({ path: require('path').join(__dirname, 'shots', 'addstop-1.png') });
  await p.locator('[data-r]').filter({ hasText: 'Cala Mondragó' }).first().click();
  await p.waitForTimeout(800);
  check('confirm screen prefilled', (await p.inputValue('#nm')) === 'Cala Mondragó');
  check('cove maps to Anchorage', (await p.locator('#kinds [aria-pressed="true"]').textContent()) === 'Anchorage');
  await p.selectOption('#pos', '1');
  await p.screenshot({ path: require('path').join(__dirname, 'shots', 'addstop-2.png') });
  await p.click('#add');
  await p.waitForTimeout(1200);
  const stops = db.tables.stops.filter((s) => s.trip_id === db.tables.trips[0].id).sort((a, b) => a.seq - b.seq).map((s) => s.name);
  check('stop inserted after first stop, others shifted', stops[1] === 'Cala Mondragó' && stops.length === 4, stops.join(' > '));
  check('kind saved', db.tables.stops.find((s) => s.name === 'Cala Mondragó').kind === 'Anchorage');
  // map mode
  await p.click('#addstop');
  await p.click('[data-mode="map"]');
  await p.waitForTimeout(1500);
  check('map mode describes spot', (await p.locator('#pn').textContent()).includes('Gaios'));
  await p.screenshot({ path: require('path').join(__dirname, 'shots', 'addstop-3.png') });
  await p.click('#use');
  await p.waitForTimeout(600);
  await p.fill('#nm', 'Lakka Bay');
  await p.click('#add');
  await p.waitForTimeout(1200);
  check('pin-dropped stop added', db.tables.stops.some((s) => s.name === 'Lakka Bay'));
  // gps
  await p.click('#addstop');
  await p.click('[data-mode="gps"]');
  await p.waitForTimeout(1500);
  check('GPS goes to confirm', await p.locator('#nm').isVisible());
  check('no script errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
