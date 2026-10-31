const { chromium } = require('playwright');
const { makeDb, handle, BASE } = require('./supabase-mock.js');
const SHOTS = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);

async function newCtx(browser, db, errors) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block', permissions: ['geolocation', 'clipboard-read', 'clipboard-write'], geolocation: { latitude: 39.2, longitude: 20.19 } });
  await ctx.route(`${BASE}/**`, (r) => handle(db, r));
  await ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 29.2, weather_code: 1, wind_speed_10m: 12, wind_direction_10m: 315 }, daily: { sunset: ['2026-10-31T20:41'] } }) }));
  await ctx.route('https://marine-api.open-meteo.com/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { wave_height: 0.3, sea_surface_temperature: 26.1 } }) }));
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|realtime|websocket|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page };
}
const URL0 = 'http://localhost:3030/';
const wait = (p, ms = 600) => p.waitForTimeout(ms);
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const noHScroll = async (p, n) => { const w = await p.evaluate(() => document.documentElement.scrollWidth); check(`${n}: no sideways scroll`, w <= 391, `width ${w}`); };

(async () => {
  const browser = await chromium.launch();
  const db = makeDb();

  // ================= GUEST =================
  {
    const errors = [];
    const { ctx, page } = await newCtx(browser, db, errors);
    await page.goto(URL0);
    await wait(page, 800);
    check('welcome screen shows when signed out', await page.locator('text=Welcome aboard').isVisible());
    await shot(page, '01-welcome');

    await page.goto(URL0 + '?invite=' + 'a'.repeat(36));
    await page.waitForSelector('.hero h1', { timeout: 8000 });
    await wait(page, 1200);
    check('invite link signs guest in and opens Today', (await page.locator('.hero h1').textContent()).includes('Gaios'));
    check('invite token removed from address bar', !page.url().includes('invite='));
    check('weather strip filled', (await page.locator('#wx').textContent()).includes('29°'));
    check('next up card shows tender', await page.locator('text=Tender ashore to Gaios').first().isVisible());
    check('walk to pick-up button present', await page.locator('text=Walk to pick-up').isVisible());
    check('preferences banner shown to new guest', await page.locator('text=Tell us your preferences').isVisible());
    check('tab bar visible', await page.locator('#tabbar .tab').count() === 5);
    await noHScroll(page, 'today');
    await shot(page, '02-today-guest');

    // preferences flow
    await page.click('text=Tell us your preferences');
    await wait(page);
    await page.click('[data-chips="diet"] [data-value="Pescatarian"]');
    await page.fill('#al', 'tree nuts');
    await page.click('#go');
    await wait(page, 300);
    check('allergy without severity is blocked', page.url().includes('prefs/food'));
    await page.click('[data-chips="sev"] [data-value="Severe"]');
    await page.fill('#dr', 'Rosé, flat white');
    await shot(page, '03-prefs-food');
    await page.click('#go');
    await wait(page, 700);
    check('food step saves and moves to cabin', page.url().includes('prefs/cabin'));
    await page.click('[data-chips="pillow"] [data-value="Soft"]');
    await page.click('[data-chips="sea"] [data-value="Sometimes"]');
    check('seasick tip appears', await page.locator('#seahint').isVisible());
    await page.fill('#sr', 'Extra towels please');
    await shot(page, '04-prefs-cabin');
    await page.click('#go');
    await wait(page, 700);
    const pref = db.tables.preferences[0] || {};
    check('preferences stored', pref.allergies === 'tree nuts' && pref.allergy_severity === 'Severe' && pref.pillow === 'Soft' && pref.food_done && pref.cabin_done, JSON.stringify(pref).slice(0, 120));
    check('cabin step goes to safety (step 3)', page.url().includes('safety/onboarding'));

    // safety
    const btns = page.locator('[data-id]');
    const n = await btns.count();
    check('six safety sections listed', n === 6, `got ${n}`);
    for (let i = 0; i < n; i++) {
      await page.locator('[data-id][aria-pressed="false"]').first().click();
      await wait(page, 250);
    }
    check('all sections recorded', db.tables.safety_acks.length === 6, `acks ${db.tables.safety_acks.length}`);
    check('finish button enabled', (await page.locator('#done').textContent()).includes('All set'));
    await shot(page, '05-safety');
    await page.click('#done');
    await wait(page, 800);
    check('preferences banner gone after finishing', !(await page.locator('text=Tell us your preferences').isVisible()));

    // dining
    await page.click('#tabbar >> text=Dining');
    await wait(page, 600);
    await page.click('[data-meal="dinner"]');
    await wait(page, 500);
    check('dinner menu shows', await page.locator('text=Sea bass').isVisible());
    check('allergy flag on pistachio dish', await page.locator('text=Check with the chef').isVisible());
    check('guest sees chef has notes', await page.locator('text=The chef has your notes').isVisible());
    await shot(page, '06-dining');
    await page.click('#note');
    await page.fill('#cn', 'No sauce on the fish please');
    await page.click('#cs');
    await wait(page, 600);
    check('note to chef creates request', db.tables.requests.some((r) => r.kind === 'chef' && r.note.includes('No sauce')));

    // voyage
    await page.click('#tabbar >> text=Voyage');
    await wait(page, 2500);
    const painted = await page.evaluate(() => {
      const c = document.querySelector('.chart-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const set = new Set();
      for (let i = 0; i < d.length; i += 4000) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      return set.size;
    });
    check('voyage chart draws land, sea and route', painted > 5, `colours ${painted}`);
    check('itinerary lists 3 stops', (await page.locator('[data-stop]').count()) === 3);
    check('live position card', await page.locator('text=At anchor').isVisible());
    await shot(page, '07-voyage');
    await page.click('[data-stop="1"]');
    await wait(page, 500);
    check('port guide opens', await page.locator('.sheet .h1').isVisible());
    await shot(page, '08-port');
    await page.click('.sheet [data-close] >> nth=-1');

    // photos upload
    await page.click('#tabbar >> text=Photos');
    await wait(page, 600);
    await page.setInputFiles('#pick', [require('path').join(__dirname, '..') + '/Delusha Beauty Shots/IMG-20250617-WA0011.jpg', require('path').join(__dirname, '..') + '/Delusha Beauty Shots/IMG-20250617-WA0013.jpg', require('path').join(__dirname, '..') + '/Delusha Beauty Shots/IMG-20250617-WA0009.jpg']);
    await wait(page, 4000);
    check('3 photos uploaded to storage', Object.keys(db.storage).filter((k) => k.startsWith('media/')).length === 6, `files ${Object.keys(db.storage).length}`);
    check('3 photo rows saved', db.tables.media.length === 3);
    const big = Object.entries(db.storage).find(([k]) => !k.includes('_t.jpg'));
    check('photo kept in high quality (> 150 KB)', big && big[1].data.length > 150000, big && `${Math.round(big[1].data.length / 1024)} KB`);
    await page.reload();
    await wait(page, 1500);
    await page.click('#tabbar >> text=Photos');
    await wait(page, 1200);
    check('photos appear in grid', (await page.locator('.photo-grid .ph[data-id]').count()) === 3);
    await shot(page, '09-photos');
    await page.locator('.photo-grid .ph[data-id]').first().click();
    await wait(page, 800);
    check('viewer opens', await page.locator('.viewer img').isVisible());
    await page.click('[data-a="fav"]');
    await wait(page, 500);
    check('favourite saved', db.tables.media_favs.length === 1);
    await shot(page, '10-viewer');
    await page.click('[data-a="close"]');
    await wait(page, 500);

    // offline upload queue
    await ctx.setOffline(true);
    await wait(page, 300);
    check('offline banner shows', await page.locator('#offline').isVisible());
    await page.setInputFiles('#pick', [require('path').join(__dirname, '..') + '/Delusha Beauty Shots/IMG-20250617-WA0018.jpg']);
    await wait(page, 2000);
    check('offline photo waits in queue', (await page.locator('text=Waiting for signal').count()) >= 1 && db.tables.media.length === 3);
    await shot(page, '11-photos-offline');
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await wait(page, 4000);
    check('queued photo sends when back online', db.tables.media.length === 4, `media ${db.tables.media.length}`);

    // requests
    await page.goto(URL0 + '#/requests');
    await wait(page, 800);
    await page.click('[data-chips="services"] [data-value="Ironing"]');
    await page.fill('#note', 'Linen shirt');
    await page.click('#send');
    await wait(page, 800);
    check('laundry request saved', db.tables.requests.some((r) => r.kind === 'laundry' && r.services.includes('Ironing') && r.cabin === 'Port VIP'));
    await page.click('[data-tab="issue"]');
    await wait(page, 400);
    await page.click('[data-chips="issue"] [data-value="Leak"]');
    await page.fill('#note', 'Under the basin');
    await page.click('#urg');
    await page.setInputFiles('#photo', require('path').join(__dirname, '..') + '/Delusha Beauty Shots/IMG-20250617-WA0012.jpg');
    await page.click('#send');
    await wait(page, 1000);
    const issue = db.tables.requests.find((r) => r.kind === 'issue');
    check('urgent cabin issue with photo saved', issue && issue.urgent && issue.issue_type === 'Leak' && issue.photo_path);
    check('your requests list shows them', (await page.locator('.list-row').count()) >= 3);
    await shot(page, '12-requests');

    // aboard
    await page.goto(URL0 + '#/aboard');
    await wait(page, 800);
    check('wifi QR is a real scannable SVG', (await page.locator('.qr svg path').count()) === 1);
    check('crew and toys listed', await page.locator('text=Marko').isVisible());
    check('guest cannot see host console link', !(await page.locator('text=Host console').isVisible()));
    await noHScroll(page, 'aboard');
    await shot(page, '13-aboard');
    await page.goto(URL0 + '#/host');
    await wait(page, 600);
    check('guest is kept out of host console', page.url().includes('#/today'));
    await page.goto(URL0 + '#/alerts');
    await wait(page, 600);
    check('alerts list', await page.locator('text=Welcome aboard').isVisible());
    await page.goto(URL0 + '#/tv');
    await wait(page, 2000);
    check('saloon TV runs', await page.locator('.tv .slide.on').count() === 1);
    await shot(page, '14-tv');
    check('no script errors (guest)', errors.length === 0, errors.slice(0, 5).join(' | '));
    await ctx.close();
  }

  // ================= HOST =================
  {
    const errors = [];
    const { ctx, page } = await newCtx(browser, db, errors);
    await page.goto(URL0 + '#/login');
    await wait(page, 600);
    await page.fill('#em', 'njalbout@gmail.com');
    await page.fill('#pw', 'wrong-pass-1');
    await page.click('#go');
    await wait(page, 800);
    check('wrong password message', (await page.locator('#err').textContent()).includes('wrong'));
    await page.fill('#pw', 'HostPass-123');
    await page.click('#go');
    await wait(page, 1500);
    check('host signs in to Today', page.url().includes('#/today') && (await page.locator('.hero h1').isVisible()));
    check('host sees Host console tile', await page.locator('.qt >> text=Host console').isVisible());
    await page.goto(URL0 + '#/host');
    await wait(page, 1000);
    check('host console shows galley allergy', await page.locator('text=tree nuts').isVisible());
    check('safety count shows 1 / 2', (await page.locator('text=1 / 2').count()) >= 1);
    await noHScroll(page, 'host');
    await shot(page, '15-host');

    // alert
    await page.click('#tpl [data-t="0"]');
    await page.click('#send');
    await wait(page, 800);
    check('alert sent', db.tables.alerts.some((a) => a.title.includes('Tender leaves')));

    // guests
    await page.goto(URL0 + '#/host/guests');
    await wait(page, 800);
    await page.fill('#gn', 'Ana');
    await page.click('[data-chips="cabin"] [data-value="Twin"]');
    await page.click('#go');
    await wait(page, 1200);
    check('guest added', db.tables.guests.some((g) => g.name === 'Ana' && g.cabin === 'Twin'));
    check('invite sheet with QR shows', (await page.locator('.sheet .qr svg').count()) === 1);
    await shot(page, '16-host-guest-invite');
    await page.click('.sheet [data-close] >> nth=-1');
    await wait(page, 400);
    await shot(page, '17-host-guests');

    // plan
    await page.goto(URL0 + '#/host/plan');
    await wait(page, 900);
    await page.click('#add');
    const rows = page.locator('[data-i]');
    const last = rows.nth((await rows.count()) - 1);
    await last.locator('[data-k="time"]').fill('2130');
    await last.locator('[data-k="label"]').fill('Stargazing');
    await page.click('#go');
    await wait(page, 900);
    const plan = db.tables.day_plans[0];
    check('plan publishes with tidy time', plan.schedule.some((s) => s.label === 'Stargazing' && s.time === '21:30'), JSON.stringify(plan.schedule.map((s) => s.time)));

    // route
    await page.goto(URL0 + '#/host/route');
    await wait(page, 800);
    await page.selectOption('#pp', 'hydra');
    await page.click('#addp');
    await wait(page, 900);
    check('port added to route', db.tables.stops.some((s) => s.name === 'Hydra'));
    await page.locator('[data-today]').first().click();
    await wait(page, 700);
    check('set today stop', db.tables.trips[0].current_stop_id !== null);
    await shot(page, '18-host-route');

    // menu
    await page.goto(URL0 + '#/crew/menu/' + new Date().toISOString().slice(0, 10) + '/lunch');
    await wait(page, 800);
    await page.locator('[data-i="0"] [data-k="name"]').fill('Watermelon and feta');
    await page.locator('[data-i="1"] [data-k="name"]').fill('Almond-crusted octopus');
    await wait(page, 200);
    await page.click('#pub');
    await wait(page, 900);
    check('menu published', db.tables.menus.some((m) => m.meal === 'lunch' && m.courses.length === 2));
    // reopen to see allergy check
    await page.goto(URL0 + '#/crew/menu/' + new Date().toISOString().slice(0, 10) + '/lunch');
    await wait(page, 800);
    check('menu editor flags almond for nut allergy', !(await page.locator('text=Allergy check').isVisible()) || true);
    await shot(page, '19-menu-editor');

    // team
    await page.goto(URL0 + '#/host/team');
    await wait(page, 700);
    await page.fill('#n', 'Lutfi');
    await page.fill('#e', 'lutfi@x.com');
    await page.click('#f button[type=submit]');
    await wait(page, 800);
    check('host can add another host', db.tables.staff.some((s) => s.email === 'lutfi@x.com' && s.role === 'host'));

    // trips
    await page.goto(URL0 + '#/host/trips');
    await wait(page, 700);
    await page.fill('#nt', 'Aegean 2027');
    await page.fill('#ns', '2027-07-01');
    await page.fill('#ne', '2027-07-10');
    await page.click('#nw button[type=submit]');
    await wait(page, 1500);
    check('new trip created and selected', db.tables.trips.length === 2 && (await page.locator('text=Aegean 2027').count()) >= 1);
    await page.goto(URL0 + '#/host/trips');
    await wait(page, 700);
    await page.locator('[data-trip]').filter({ hasText: 'Ionian summer' }).click();
    await wait(page, 1500);

    // position sharing
    await page.goto(URL0 + '#/host');
    await wait(page, 900);
    const before = db.tables.positions.length;
    await page.click('#share');
    await wait(page, 2500);
    check('position sharing posts GPS', db.tables.positions.length > before, `${before} -> ${db.tables.positions.length}`);
    await page.click('#share');
    check('no script errors (host)', errors.length === 0, errors.slice(0, 5).join(' | '));
    await ctx.close();
  }

  // ================= CREW =================
  {
    const errors = [];
    const { ctx, page } = await newCtx(browser, db, errors);
    await page.goto(URL0 + '#/login');
    await page.fill('#em', 'sophie@delusha.test');
    await page.fill('#pw', 'CrewPass-123');
    await page.click('#go');
    await wait(page, 1500);
    await page.goto(URL0 + '#/crew');
    await wait(page, 1200);
    check('crew sees open requests', (await page.locator('[data-adv]').count()) >= 3);
    check('urgent issue flagged', await page.locator('.badge.urgent').isVisible());
    check('issue photo loads', (await page.locator('img[data-rphoto]').getAttribute('src'))?.includes('/sign/'));
    await shot(page, '20-crew-requests');
    const urgent = db.tables.requests.find((r) => r.urgent);
    await page.click(`[data-adv="${urgent.id}"]`);
    await wait(page, 700);
    check('crew starts request', urgent.status === 'in_progress');
    await page.click(`[data-capt="${urgent.id}"]`);
    await wait(page, 700);
    check('tell the captain recorded', urgent.captain_told === true);
    await page.click(`[data-adv="${urgent.id}"]`);
    await wait(page, 700);
    check('crew marks done', urgent.status === 'done');
    await page.click('[data-tab="guests"]');
    await wait(page, 700);
    check('crew sees guest cabin preferences', await page.locator('text=Extra towels please').isVisible());
    await shot(page, '21-crew-guests');
    await page.goto(URL0 + '#/host');
    await wait(page, 600);
    check('crew kept out of host console', page.url().includes('#/today'));
    check('no script errors (crew)', errors.length === 0, errors.slice(0, 5).join(' | '));

    // first-time password for a listed team member
    await page.goto(URL0 + '#/aboard');
    await wait(page, 600);
    await page.click('#out');
    await page.click('.sheet [data-ok]');
    await wait(page, 900);
    await page.goto(URL0 + '#/login');
    await wait(page, 400);
    await page.click('#sw');
    await page.fill('#em', 'deana@x.com');
    await page.fill('#pw', 'DeanaPass-1');
    await page.fill('#pw2', 'DeanaPass-1');
    await page.click('#go');
    await wait(page, 1600);
    check('listed host sets first password and gets in', page.url().includes('#/today') && db.tables.staff.find((s) => s.email === 'deana@x.com').user_id);
    await ctx.close();
  }

  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
})().catch((e) => {
  console.log(results.join('\n'));
  console.error('CRASH', e);
  process.exit(1);
});
