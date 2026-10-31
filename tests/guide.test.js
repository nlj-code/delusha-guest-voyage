// Destination guide: written guide, automatic guide, tender times, host edits.
const { chromium } = require('playwright');
const path = require('path');
const { makeDb, handle, BASE } = require('./supabase-mock.js');
(async () => {
  const db = makeDb();
  const trip = db.tables.trips[0];
  const [s1, s2, s3] = db.tables.stops;
  const iso = (n) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  Object.assign(s1, { port_id: 'palma', name: 'Palma', lat: 39.5655, lon: 2.629, arrive_on: iso(0) });
  Object.assign(s2, { port_id: null, name: 'Cabrera National Park', lat: 39.153, lon: 2.932, arrive_on: iso(1), tender_name: 'Harbour jetty', tender_lat: 39.151, tender_lon: 2.933 });
  Object.assign(s3, { port_id: 'fiskardo', name: 'Fiskardo', lat: 38.459, lon: 20.577, arrive_on: iso(2) });
  db.tables.day_plans.push({ id: 'p2', trip_id: trip.id, plan_date: iso(1), headline: 'Cabrera', schedule: [{ time: '16:00', label: 'Tender ashore to walk up to the castle', note: 'Return pick-up 18:30 at the jetty' }] });
  const out = [];
  const check = (n, ok, x = '') => out.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route(`${BASE}/**`, (r) => handle(db, r));
  await ctx.route('https://**open-meteo.com/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ daily: { sunset: ['2026-11-01T17:28'], temperature_2m_max: [21.4] }, hourly: { sea_surface_temperature: [21.8, 22.1, 22.0] } }) }));
  await ctx.route('https://en.wikipedia.org/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'standard', extract: 'Fiskardo is a village on Kefalonia. It survived the 1953 earthquake.', thumbnail: { source: 'http://localhost:3030/icon-512.png' } }) }));
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:3030/#/login');
  await p.fill('#em', 'njalbout@gmail.com');
  await p.fill('#pw', 'HostPass-123');
  await p.click('#go');
  await p.waitForTimeout(1500);

  await p.goto(`http://localhost:3030/#/guide/${s2.id}`);
  await p.waitForTimeout(1500);
  check('written guide matched by name (Cabrera)', await p.locator('text=Climb to the castle').isVisible());
  check('tender out time from day plan', (await p.locator('#ashore').textContent()).includes('16:00'));
  check('back-aboard time from plan note', (await p.locator('#ashore').textContent()).includes('18:30'));
  check('sea temp and sunset filled', (await p.locator('#gsea').textContent()) === '22°' && (await p.locator('#gsun').textContent()) === '17:28');
  check('story shown', await p.locator('text=Peninsular War').isVisible());
  await p.screenshot({ path: path.join(__dirname, 'shots', 'guide-cabrera.png'), fullPage: true });

  await p.goto(`http://localhost:3030/#/guide/${s1.id}`);
  await p.waitForTimeout(1200);
  check('Palma guide by port id', await p.locator('text=La Seu at golden hour').isVisible());

  await p.goto(`http://localhost:3030/#/guide/${s3.id}`);
  await p.waitForTimeout(1500);
  check('automatic guide for unwritten port', await p.locator('text=Worth seeing').isVisible());
  check('country basics for Greece', await p.locator('text=Tavernas on islands').isVisible());
  check('Wikipedia story fills in', await p.locator('text=1953 earthquake').isVisible());

  // host edit
  await p.goto(`http://localhost:3030/#/guide/${s2.id}/edit`);
  await p.waitForTimeout(1200);
  await p.click('[data-add="picks"]');
  const last = p.locator('[data-list="picks"]').last();
  await last.locator('[data-k="title"]').fill('Sunset swim off the stern');
  await last.locator('[data-k="tag"]').fill('Swim');
  await p.click('#save');
  await p.waitForTimeout(1200);
  check('host edit saved to database', db.tables.guide_overrides?.some((o) => o.key === 'cabrera' && o.content.picks.some((x) => x.title === 'Sunset swim off the stern')));
  check('edit shows in guide', await p.locator('text=Sunset swim off the stern').isVisible());

  await p.goto('http://localhost:3030/#/today');
  await p.waitForTimeout(1000);
  check('Today has explore card', (await p.locator('a[href^="#/guide/"]').count()) >= 1);
  await p.goto('http://localhost:3030/#/voyage');
  await p.waitForTimeout(1000);
  await p.click('[data-stop="0"]');
  await p.waitForTimeout(800);
  check('Voyage stop opens guide', p.url().includes(`#/guide/${s1.id}`));
  check('no script errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
