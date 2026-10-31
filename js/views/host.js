import { sb, state, load, prefsFor, myName, resetStaffPassword, currentStop } from '../store.js';
import { esc, icon, toast, isoDate, fmtDate, initials, tripDay, timeAgo } from '../util.js';
import { CABINS } from '../config.js';
import { notify } from '../push.js';
import { sharing, startSharing, stopSharing, onSharing } from '../position.js';
import { switchTrip } from '../session.js';
import { busy, openSheet, confirmSheet, qrSvg, segHtml, bindChips } from './ui.js';

const TEMPLATES = [
  ['Tender in 15 min', 'Tender leaves in 15 minutes', 'Meet at the stern swim platform.'],
  ['Meal is served', 'Dinner is served', 'Please join us on deck.'],
  ['Swim stop', 'Swim stop', 'The swim flag is up. Enjoy!'],
  ['Weather', 'Weather update', 'Wind is picking up. Please secure loose items on deck.']
];

const AV = ['#9FD3DD', '#E8D3A8', '#BFE3CD', '#F2C9B3', '#D6CDE6'];

function head(title, back = '#/host', backLabel = 'Host') {
  return `<div class="dark-head">
    <div class="between"><a class="back" style="margin:0;padding:0" href="${back}">${icon('back', 20)}${esc(backLabel)}</a>
    <div class="tiny muted">${esc(myName())}</div></div>
    <h1 class="h1" style="margin-top:8px">${esc(title)}</h1>
    ${state.trip ? `<div class="small muted mt8">${esc(state.trip.title)}</div>` : ''}
  </div>`;
}

const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export function inviteUrl(token) {
  return `${location.origin}${location.pathname}?invite=${token}`;
}

export default {
  title: 'Host',
  deps: ['guests', 'allPrefs', 'allAcks', 'requests', 'stops', 'trip', 'plan', 'logbook', 'staffList', 'settings', 'position'],
  async render(el, params) {
    const sub = params[0] || 'home';
    if (!state.trip && !['trips', 'team', 'yacht'].includes(sub)) return renderTrips(el);
    const views = { home: renderHome, guests: renderGuests, plan: renderPlan, route: renderRoute, log: renderLog, team: renderTeam, yacht: renderYacht, trips: renderTrips };
    return (views[sub] || renderHome)(el, params.slice(1));
  }
};

// ---------------------------------------------------------------- home

function renderHome(el) {
  const hosts = state.staffList.filter((s) => s.role === 'host');
  const guests = state.guests;
  const safetyTotal = state.safety.length;
  const safetyDone = guests.filter((g) => state.allAcks.filter((a) => a.guest_id === g.id).length >= safetyTotal && safetyTotal > 0);
  const waitingSafety = guests.filter((g) => !safetyDone.includes(g));
  const prefsDone = guests.filter((g) => {
    const p = prefsFor(g.id);
    return p?.food_done && p?.cabin_done;
  });
  const allergic = guests.map((g) => ({ g, p: prefsFor(g.id) })).filter((x) => x.p?.allergies);
  const diets = {};
  for (const g of guests) for (const d of prefsFor(g.id)?.diet || []) if (d !== 'No restrictions') diets[d] = (diets[d] || 0) + 1;
  const openReq = state.requests.filter((r) => r.status !== 'done').length;
  const day = tripDay(state.trip);
  const pos = state.position;
  let tplIndex = 0;

  el.innerHTML = `
    <div class="dark-head">
      <div class="between">
        <a class="back" style="margin:0;padding:0" href="#/today">${icon('back', 20)}Guest view</a>
        <div class="tiny muted">Signed in · ${esc(myName())}</div>
      </div>
      <h1 class="h1" style="margin-top:8px">Host</h1>
      <button class="btn sm ghost mt8" id="trip">${esc(state.trip.title)} · ${day.before ? `starts ${esc(fmtDate(state.trip.start_date))}` : day.after ? 'ended' : `day ${day.n} of ${day.total}`} ▾</button>
      <div class="row mt16" style="gap:10px">
        <div class="stack-avatars">${hosts.map((h, i) => `<div class="avatar" style="background:${AV[i % AV.length]}">${esc(initials(h.name))}</div>`).join('')}</div>
        <div class="small muted">${esc(hosts.map((h) => h.name).join(', ').replace(/, ([^,]*)$/, ' and $1'))} can manage</div>
      </div>
    </div>
    <div class="page wrap stack" style="padding-top:16px;padding-bottom:40px">
      <a class="card row" href="#/host/guests" style="text-decoration:none;color:inherit">
        <div class="grow"><div class="h3">Guests and cabins</div><div class="small muted">${guests.length} aboard · ${guests.filter((g) => !g.user_id).length} invite${guests.filter((g) => !g.user_id).length === 1 ? '' : 's'} not opened yet</div></div>${icon('chev', 18, 'style="color:#9AA1A8"')}
      </a>

      <div class="card">
        <h2 class="h3">Send an alert</h2>
        <div class="chips mt12" id="tpl">${TEMPLATES.map((t, i) => `<button type="button" class="chip" data-t="${i}" aria-pressed="false">${esc(t[0])}</button>`).join('')}</div>
        <label class="lbl" for="at">Title</label>
        <input class="field" id="at" placeholder="e.g. Tender leaves in 15 minutes">
        <label class="lbl" for="ab">Message (optional)</label>
        <textarea class="field" id="ab" rows="2"></textarea>
        <button class="btn accent block lg mt12" id="send">Send to ${guests.length} ${guests.length === 1 ? 'person' : 'people'}</button>
      </div>

      <div class="grid2">
        <div class="card"><div class="tiny muted">Safety briefing</div><div style="font-size:26px;font-weight:600">${safetyDone.length} / ${guests.length}</div>
          <div class="tiny" style="color:${waitingSafety.length ? 'var(--warn)' : 'var(--live-ink)'}">${waitingSafety.length ? `Waiting: ${esc(waitingSafety.slice(0, 3).map((g) => g.name).join(', '))}${waitingSafety.length > 3 ? '…' : ''}` : guests.length ? 'Everyone done' : '–'}</div></div>
        <div class="card"><div class="tiny muted">Preferences in</div><div style="font-size:26px;font-weight:600">${prefsDone.length} / ${guests.length}</div>
          <div class="tiny" style="color:${prefsDone.length < guests.length ? 'var(--warn)' : 'var(--live-ink)'}">${prefsDone.length < guests.length ? `${guests.length - prefsDone.length} to go` : guests.length ? 'All guests done' : '–'}</div></div>
      </div>

      <div class="card">
        <div class="between"><h2 class="h3">For the galley</h2><a class="small" href="#/crew/guests" style="font-weight:600;text-decoration:none">All details</a></div>
        <div class="stack-s mt12">
          ${allergic.map((x) => `<div class="card warn small" style="padding:10px 12px"><strong>${esc((x.p.allergy_severity || '').toUpperCase())}</strong> ${esc(x.g.name)} · ${esc(x.p.allergies)}</div>`).join('')}
          <div class="card flat small" style="padding:10px 12px">${Object.keys(diets).length ? esc(Object.entries(diets).map(([d, n]) => `${n} ${d.toLowerCase()}`).join(' · ')) : 'No special diets yet'}</div>
        </div>
      </div>

      <div class="card tight">
        <a class="list-row" href="#/host/plan"><div class="grow"><div class="t">Today's plan</div><div class="s">${state.plan?.plan_date === isoDate() ? `${(state.plan.schedule || []).length} items · ${esc(state.plan.headline || '')}` : 'Not set for today'}</div></div>${state.plan?.plan_date === isoDate() ? '<span class="badge live">Live</span>' : '<span class="badge warn">To do</span>'}</a>
        <a class="list-row" href="#/host/route"><div class="grow"><div class="t">Itinerary and tender points</div><div class="s">${state.stops.length} stops · today: ${esc(currentStop()?.name || '–')}</div></div>${icon('chev', 16, 'style="color:#9AA1A8"')}</a>
        <a class="list-row" href="#/crew/menu-list"><div class="grow"><div class="t">Menus</div><div class="s">Post or edit daily menus</div></div>${icon('chev', 16, 'style="color:#9AA1A8"')}</a>
        <a class="list-row" href="#/crew/requests"><div class="grow"><div class="t">Requests</div><div class="s">Laundry, cabin issues, chef notes</div></div>${openReq ? `<span class="badge warn">${openReq} open</span>` : '<span class="badge">None open</span>'}</a>
        <a class="list-row" href="#/host/log"><div class="grow"><div class="t">Logbook</div><div class="s">${state.logbook.length} entr${state.logbook.length === 1 ? 'y' : 'ies'}</div></div>${icon('chev', 16, 'style="color:#9AA1A8"')}</a>
        <div class="list-row"><div class="grow"><div class="t">Share position</div><div class="s" id="shs">${sharingText(pos)}</div></div>
          <button class="switch" role="switch" aria-checked="${sharing.on}" aria-label="Share this phone's position" id="share"></button></div>
      </div>

      <div class="card tight">
        <a class="list-row" href="#/host/trips"><div class="grow"><div class="t">Trips</div><div class="s">Create, switch or edit trips</div></div>${icon('chev', 16, 'style="color:#9AA1A8"')}</a>
        <a class="list-row" href="#/host/team"><div class="grow"><div class="t">Hosts and crew logins</div><div class="s">${state.staffList.length} people</div></div>${icon('chev', 16, 'style="color:#9AA1A8"')}</a>
        <a class="list-row" href="#/host/yacht"><div class="grow"><div class="t">Wi-Fi, crew list and toys</div><div class="s">What guests see on the Aboard tab</div></div>${icon('chev', 16, 'style="color:#9AA1A8"')}</a>
      </div>
    </div>`;

  el.querySelector('#trip').onclick = () => (location.hash = '#/host/trips');
  el.querySelector('#tpl').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    tplIndex = Number(b.dataset.t);
    el.querySelectorAll('#tpl [data-t]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    el.querySelector('#at').value = TEMPLATES[tplIndex][1];
    el.querySelector('#ab').value = TEMPLATES[tplIndex][2];
  });
  el.querySelector('#send').onclick = async (e) => {
    const title = el.querySelector('#at').value.trim();
    const body = el.querySelector('#ab').value.trim();
    if (!title) return toast('Add a title first.');
    const btn = e.currentTarget;
    busy(btn, true, 'Sending…');
    const { data, error } = await sb.from('alerts').insert({ trip_id: state.trip.id, title, body: body || null, sender_name: myName() }).select().single();
    busy(btn, false);
    if (error) return toast('Could not send. Check signal.', 'error');
    el.querySelector('#at').value = '';
    el.querySelector('#ab').value = '';
    notify('alert', data.id);
    load('alerts');
    toast('Alert sent');
  };
  el.querySelector('#share').onclick = (e) => {
    if (sharing.on) stopSharing();
    else startSharing();
    e.currentTarget.setAttribute('aria-checked', String(sharing.on));
  };
  const off = onSharing(() => {
    const s = el.querySelector('#shs');
    if (s) s.textContent = sharingText(state.position);
    el.querySelector('#share')?.setAttribute('aria-checked', String(sharing.on));
  });
  return off;
}

function sharingText(pos) {
  if (sharing.error) return sharing.error;
  if (sharing.on) return `From this phone · every 2 min${sharing.last ? ` · sent ${timeAgo(sharing.last)}` : ' · waiting for GPS'}`;
  return pos ? `Off on this phone · last update ${timeAgo(pos.recorded_at)}` : 'Off · keep this screen open on the bridge to share';
}

// ---------------------------------------------------------------- guests and cabins

async function renderGuests(el) {
  const byCabin = [...CABINS, null].map((c) => ({ cabin: c, guests: state.guests.filter((g) => (g.cabin || null) === c) }));
  el.innerHTML = `${head('Guests and cabins')}
    <div class="page wrap stack" style="padding-top:16px;padding-bottom:40px">
      ${byCabin
        .filter((c) => c.cabin || c.guests.length)
        .map(
          (c) => `<div class="card" style="padding:14px 16px">
            <div class="eyebrow brass">${esc(c.cabin || 'No cabin yet')}</div>
            ${
              c.guests.length
                ? c.guests
                    .map((g) => {
                      const p = prefsFor(g.id);
                      const done = p?.food_done && p?.cabin_done;
                      return `<button class="list-row" data-g="${g.id}">
                        <div class="avatar">${esc(initials(g.name))}</div>
                        <div class="grow"><div class="t">${esc(g.name)}</div>
                          <div class="s" style="color:${done ? 'var(--muted)' : 'var(--warn)'}">${g.is_host ? 'Host · ' : ''}${g.user_id ? (done ? 'Preferences done' : 'Joined · preferences pending') : 'Invite not opened yet'}</div></div>
                        ${icon('chev', 16, 'style="color:#9AA1A8"')}
                      </button>`;
                    })
                    .join('')
                : '<div class="small muted mt8">Empty</div>'
            }
          </div>`
        )
        .join('')}

      <form class="card" id="add" novalidate style="box-shadow:var(--shadow)">
        <h2 class="h3">Add a guest</h2>
        <label class="lbl" for="gn">Name</label>
        <input class="field" id="gn" autocomplete="off" required>
        <div class="lbl">Cabin</div>
        <div class="chips" data-chips="cabin" data-multi="0">${CABINS.map((c) => `<button type="button" class="chip" data-value="${c}" aria-pressed="false">${c}</button>`).join('')}</div>
        <label class="row mt16" style="gap:10px;font-size:14px"><input type="checkbox" id="gh" style="width:20px;height:20px"> This is one of the hosts</label>
        <button class="btn block lg mt16" id="go" type="submit">Add and share invite link</button>
        <p class="tiny muted mt8" style="text-align:center">Shares a personal link by WhatsApp, iMessage or email</p>
      </form>
    </div>`;

  const form = el.querySelector('#add');
  const get = bindChips(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = el.querySelector('#gn').value.trim();
    if (!name) return toast('Type a name first.');
    const btn = el.querySelector('#go');
    busy(btn, true, 'Adding…');
    const { data, error } = await sb
      .from('guests')
      .insert({ trip_id: state.trip.id, name, cabin: get('cabin'), is_host: el.querySelector('#gh').checked })
      .select()
      .single();
    busy(btn, false);
    if (error) return toast('Could not add. Check signal.', 'error');
    await load('guests', 'allPrefs', 'allAcks');
    openGuest(data);
  };
  el.querySelectorAll('[data-g]').forEach((b) =>
    b.addEventListener('click', () => openGuest(state.guests.find((g) => g.id === b.dataset.g)))
  );
}

async function openGuest(g) {
  const { data: inv } = await sb.from('guest_invites').select('token').eq('guest_id', g.id).maybeSingle();
  const url = inv ? inviteUrl(inv.token) : null;
  const meLinked = g.user_id === state.user.id;
  const { el: s, close } = openSheet(
    `<h2 class="h2">${esc(g.name)}</h2>
     <p class="small muted mt8">${esc(g.cabin || 'No cabin')}${g.is_host ? ' · Host' : ''} · ${g.user_id ? 'Has joined' : 'Invite not opened yet'}</p>
     ${
       url
         ? `<div class="card row mt16" style="gap:14px"><div class="qr" style="width:96px;height:96px">${qrSvg(url, 80)}</div>
             <div class="grow"><div class="h3">Personal invite</div><p class="tiny muted mt8">Only for ${esc(g.name)}. Anyone with this link can see the trip as them.</p></div></div>
           <div class="btn-row mt12"><button class="btn" id="sh">${icon('share', 18)}Share link</button><button class="btn light" id="cp">Copy</button></div>`
         : ''
     }
     <div class="card mt12">
       <label class="lbl" for="en" style="margin-top:0">Name</label>
       <input class="field" id="en" value="${esc(g.name)}">
       <div class="lbl">Cabin</div>
       <div class="chips" data-chips="cabin" data-multi="0">${CABINS.map((c) => `<button type="button" class="chip" data-value="${c}" aria-pressed="${g.cabin === c}">${c}</button>`).join('')}</div>
       <button class="btn block mt16" id="sv">Save</button>
     </div>
     ${
       g.is_host && !g.user_id
         ? `<button class="btn soft block mt12" id="me">This is me: link to my account</button>`
         : meLinked
         ? '<p class="tiny muted mt12" style="text-align:center">Linked to your account. Fill in your preferences from the Aboard tab.</p>'
         : ''
     }
     <div class="btn-row mt12"><button class="btn light" id="nl">New link</button><button class="btn danger" id="rm">Remove</button></div>
     <button class="btn light block mt12" data-close>Close</button>`,
    { label: g.name }
  );
  const get = bindChips(s);
  const shareText = `Welcome aboard Delusha, ${g.name}! Your personal link for the trip: ${url}`;
  s.querySelector('#sh')?.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Delusha', text: shareText });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      /* closed */
    }
  });
  s.querySelector('#cp')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast(url);
    }
  });
  s.querySelector('#sv').onclick = async () => {
    const name = s.querySelector('#en').value.trim();
    if (!name) return toast('Name cannot be empty.');
    const { error } = await sb.from('guests').update({ name, cabin: get('cabin') }).eq('id', g.id);
    if (error) return toast('Could not save.', 'error');
    await load('guests');
    close();
    refresh();
    toast('Saved');
  };
  s.querySelector('#me')?.addEventListener('click', async () => {
    if (state.guests.some((x) => x.user_id === state.user.id)) return toast('Your account is already linked to another guest on this trip.');
    const { error } = await sb.from('guests').update({ user_id: state.user.id }).eq('id', g.id);
    if (error) return toast('Could not link.', 'error');
    await load('guests', 'prefs', 'acks');
    close();
    refresh();
    toast('Linked. Your preferences are under Aboard.');
  });
  s.querySelector('#nl').onclick = async () => {
    if (!(await confirmSheet('Make a new link?', `The old link stops working. Send the new one to ${g.name}.`, 'New link'))) return;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
    const { error } = await sb.from('guest_invites').update({ token }).eq('guest_id', g.id);
    if (error) return toast('Could not change the link.', 'error');
    close();
    openGuest(g);
  };
  s.querySelector('#rm').onclick = async () => {
    if (!(await confirmSheet(`Remove ${g.name}?`, 'Their preferences and safety answers are deleted. Photos they shared stay.', 'Remove', true))) return;
    const { error } = await sb.from('guests').delete().eq('id', g.id);
    if (error) return toast('Could not remove.', 'error');
    await load('guests', 'allPrefs', 'allAcks');
    close();
    refresh();
  };
}

// ---------------------------------------------------------------- today's plan

async function renderPlan(el, params) {
  const date = params[0] || isoDate();
  const { data: plan } = await sb.from('day_plans').select('*').eq('trip_id', state.trip.id).eq('plan_date', date).maybeSingle();
  let rows = (plan?.schedule || []).map((r) => ({ ...r }));
  if (!rows.length) rows = [{ time: '08:30', label: 'Breakfast on the aft deck', note: '' }];
  const stop = currentStop();

  const draw = () => {
    el.innerHTML = `${head("Day's plan")}
      <div class="page wrap" style="padding-top:16px">
        <form id="f" class="stack" novalidate>
          <div class="card">
            <label class="lbl" for="d" style="margin-top:0">Day</label>
            <input class="field" type="date" id="d" value="${esc(date)}" min="${esc(state.trip.start_date)}" max="${esc(state.trip.end_date)}">
            <label class="lbl" for="h">Headline</label>
            <input class="field" id="h" value="${esc(plan?.headline || '')}" placeholder="${esc(stop?.name || 'e.g. Gaios, Paxos')}">
            <label class="lbl" for="s">Line under it (optional)</label>
            <input class="field" id="s" value="${esc(plan?.subline || '')}" placeholder="e.g. Ionian Sea · lazy day at anchor">
          </div>
          <div class="h3" style="margin:8px 4px 0">Schedule</div>
          ${rows
            .map(
              (r, i) => `<div class="card" data-i="${i}">
                <div class="row" style="gap:8px">
                  <input class="field" data-k="time" value="${esc(r.time || '')}" placeholder="18:30" aria-label="Time" style="width:90px;flex:none" inputmode="numeric">
                  <input class="field" data-k="label" value="${esc(r.label || '')}" placeholder="What's happening" aria-label="What's happening">
                  <button type="button" class="icon-btn plain" data-rm="${i}" aria-label="Remove">${icon('trash', 18)}</button>
                </div>
                <input class="field mt8" data-k="note" value="${esc(r.note || '')}" placeholder="Detail (optional), e.g. Meet at the stern platform" aria-label="Detail">
              </div>`
            )
            .join('')}
          <button type="button" class="btn light" id="add">${icon('plus', 18)}Add a line</button>
          <p class="tiny muted" style="margin:0 4px">Lines mentioning the tender or going ashore get a "Walk to pick-up" button for guests.</p>
          <div class="form-foot" style="margin:0 -16px"><button class="btn accent lg block" id="go" type="submit">Publish</button></div>
        </form>
      </div>`;
    const f = el.querySelector('#f');
    const collect = () => {
      f.querySelectorAll('[data-i]').forEach((c) => {
        const r = rows[Number(c.dataset.i)];
        c.querySelectorAll('[data-k]').forEach((inp) => (r[inp.dataset.k] = inp.value.trim()));
      });
    };
    f.querySelector('#d').onchange = (e) => (location.hash = `#/host/plan/${e.target.value}`);
    f.querySelector('#add').onclick = () => {
      collect();
      rows.push({ time: '', label: '', note: '' });
      draw();
    };
    f.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => {
        collect();
        rows.splice(Number(b.dataset.rm), 1);
        draw();
      })
    );
    f.onsubmit = async (e) => {
      e.preventDefault();
      collect();
      const schedule = rows
        .filter((r) => r.label)
        .map((r) => ({ time: normTime(r.time), label: r.label, note: r.note || undefined }))
        .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      const btn = f.querySelector('#go');
      busy(btn, true, 'Publishing…');
      const { error } = await sb.from('day_plans').upsert(
        { trip_id: state.trip.id, plan_date: date, headline: f.querySelector('#h').value.trim() || null, subline: f.querySelector('#s').value.trim() || null, schedule },
        { onConflict: 'trip_id,plan_date' }
      );
      busy(btn, false);
      if (error) return toast('Could not publish. Check signal.', 'error');
      await load('plan');
      toast('Plan published');
      location.hash = '#/host';
    };
  };
  draw();
}

function normTime(t) {
  const m = /^(\d{1,2})[:.h]?(\d{2})?$/.exec((t || '').trim());
  if (!m) return t || '';
  return `${m[1].padStart(2, '0')}:${m[2] || '00'}`;
}

// ---------------------------------------------------------------- itinerary

function renderRoute(el) {
  const stops = state.stops;
  const cur = currentStop();
  const ports = self.DELUSHA_DATA?.PRESET_PORTS || [];
  el.innerHTML = `${head('Itinerary')}
    <div class="page wrap stack" style="padding-top:16px;padding-bottom:40px">
      <div class="card tight">
        ${
          stops.length
            ? stops
                .map(
                  (s, i) => `<div class="list-row">
                    <div class="num ${s.id === cur?.id ? 'cur' : ''}">${i + 1}</div>
                    <button class="grow" data-edit="${s.id}" style="background:none;border:0;text-align:left;padding:0">
                      <div class="t">${esc(s.name)}</div><div class="s">${esc([s.arrive_on ? fmtDate(s.arrive_on) : '', s.tender_name || ''].filter(Boolean).join(' · ') || 'Tap to set date and tender point')}</div></button>
                    ${s.id === cur?.id ? '<span class="badge live">Today</span>' : `<button class="btn sm light" data-today="${s.id}">Today</button>`}
                    <div style="display:flex;flex-direction:column">
                      <button class="icon-btn plain" style="height:26px" data-up="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
                      <button class="icon-btn plain" style="height:26px" data-down="${i}" aria-label="Move down" ${i === stops.length - 1 ? 'disabled' : ''}>▼</button>
                    </div>
                  </div>`
                )
                .join('')
            : '<div class="empty">No stops yet. Add the first one below.</div>'
        }
      </div>
      <div class="card">
        <h2 class="h3">Add a stop</h2>
        <label class="lbl" for="pp">Mediterranean port</label>
        <select class="field" id="pp"><option value="">Choose a port…</option>${ports.map((p) => `<option value="${p.id}">${esc(p.name)}, ${esc(p.country)}</option>`).join('')}</select>
        <button class="btn block mt12" id="addp">Add port</button>
        <details class="mt12"><summary class="small" style="cursor:pointer;color:var(--accent);font-weight:600">Or add any anchorage by coordinates</summary>
          <label class="lbl" for="cn">Name</label><input class="field" id="cn" placeholder="e.g. Lakka Bay">
          <div class="grid2"><div><label class="lbl" for="cla">Latitude</label><input class="field" id="cla" inputmode="decimal" placeholder="39.24"></div>
          <div><label class="lbl" for="clo">Longitude</label><input class="field" id="clo" inputmode="decimal" placeholder="20.13"></div></div>
          <div class="btn-row mt12"><button class="btn light" id="here" type="button">${icon('locate', 16)}Use my GPS</button><button class="btn" id="addc" type="button">Add</button></div>
        </details>
      </div>
      <div class="card row"><div class="grow"><div class="h3">Route through the Corinth Canal</div><div class="tiny muted">When sailing between the Ionian and the Aegean</div></div>
        <button class="switch" role="switch" aria-checked="${state.trip.allow_corinth}" id="cor" aria-label="Allow Corinth Canal"></button></div>
    </div>`;

  const saveOrder = async (list) => {
    const updates = list.map((s, i) => sb.from('stops').update({ seq: i }).eq('id', s.id));
    const res = await Promise.all(updates);
    if (res.some((r) => r.error)) toast('Could not reorder.', 'error');
    await load('stops');
    refresh();
  };
  const addStop = async (row) => {
    const { error } = await sb.from('stops').insert({ trip_id: state.trip.id, seq: stops.length, ...row });
    if (error) return toast('Could not add.', 'error');
    await load('stops');
    if (!state.trip.current_stop_id && state.stops[0]) {
      await sb.from('trips').update({ current_stop_id: state.stops[0].id }).eq('id', state.trip.id);
      await load('trip');
    }
    toast(`Added ${row.name}`);
    refresh();
  };

  el.querySelectorAll('[data-up],[data-down]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = Number(b.dataset.up ?? b.dataset.down);
      const j = b.dataset.up !== undefined ? i - 1 : i + 1;
      const list = [...stops];
      [list[i], list[j]] = [list[j], list[i]];
      saveOrder(list);
    })
  );
  el.querySelectorAll('[data-today]').forEach((b) =>
    b.addEventListener('click', async () => {
      const { error } = await sb.from('trips').update({ current_stop_id: b.dataset.today }).eq('id', state.trip.id);
      if (error) return toast('Could not update.', 'error');
      await load('trip');
      refresh();
    })
  );
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editStop(stops.find((s) => s.id === b.dataset.edit))));
  el.querySelector('#addp').onclick = () => {
    const p = ports.find((x) => x.id === el.querySelector('#pp').value);
    if (!p) return toast('Choose a port first.');
    addStop({ port_id: p.id, name: p.name, lat: p.lat, lon: p.lon, tender_name: p.tenderName || null, tender_lat: p.tenderLat ?? null, tender_lon: p.tenderLon ?? null });
  };
  el.querySelector('#here').onclick = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        el.querySelector('#cla').value = p.coords.latitude.toFixed(5);
        el.querySelector('#clo').value = p.coords.longitude.toFixed(5);
      },
      () => toast('Allow location access first.'),
      { enableHighAccuracy: true, timeout: 20000 }
    );
  el.querySelector('#addc').onclick = () => {
    const name = el.querySelector('#cn').value.trim();
    const lat = parseFloat(el.querySelector('#cla').value);
    const lon = parseFloat(el.querySelector('#clo').value);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return toast('Add a name and valid coordinates.');
    addStop({ name, lat, lon });
  };
  el.querySelector('#cor').onclick = async (e) => {
    const on = e.currentTarget.getAttribute('aria-checked') !== 'true';
    const { error } = await sb.from('trips').update({ allow_corinth: on }).eq('id', state.trip.id);
    if (error) return toast('Could not save.', 'error');
    await load('trip');
    refresh();
  };
}

function editStop(s) {
  const { el: sh, close } = openSheet(
    `<h2 class="h2">${esc(s.name)}</h2>
     <label class="lbl" for="sn">Name</label><input class="field" id="sn" value="${esc(s.name)}">
     <label class="lbl" for="sd">Date</label><input class="field" type="date" id="sd" value="${esc(s.arrive_on || '')}">
     <div class="card mt16">
       <div class="h3">Tender pick-up point</div>
       <label class="lbl" for="tn">Description</label><input class="field" id="tn" value="${esc(s.tender_name || '')}" placeholder="e.g. Stone quay by the church">
       <p class="tiny muted mt8" id="tp">${s.tender_lat ? `Pin at ${(+s.tender_lat).toFixed(5)}, ${(+s.tender_lon).toFixed(5)}` : 'No pin yet. Guests get directions to the anchorage.'}</p>
       <button class="btn soft block mt8" id="gps" type="button">${icon('pin', 16)}Drop my GPS as the pick-up pin</button>
     </div>
     <div class="btn-row mt16"><button class="btn danger" id="del">Delete stop</button><button class="btn" id="sv">Save</button></div>`,
    { label: s.name }
  );
  let tlat = s.tender_lat;
  let tlon = s.tender_lon;
  sh.querySelector('#gps').onclick = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        tlat = p.coords.latitude;
        tlon = p.coords.longitude;
        sh.querySelector('#tp').textContent = `Pin at ${tlat.toFixed(5)}, ${tlon.toFixed(5)} (±${Math.round(p.coords.accuracy)} m). Tap Save.`;
      },
      () => toast('Allow location access first.'),
      { enableHighAccuracy: true, timeout: 20000 }
    );
  sh.querySelector('#sv').onclick = async () => {
    const { error } = await sb
      .from('stops')
      .update({ name: sh.querySelector('#sn').value.trim() || s.name, arrive_on: sh.querySelector('#sd').value || null, tender_name: sh.querySelector('#tn').value.trim() || null, tender_lat: tlat ?? null, tender_lon: tlon ?? null })
      .eq('id', s.id);
    if (error) return toast('Could not save.', 'error');
    await load('stops');
    close();
    refresh();
  };
  sh.querySelector('#del').onclick = async () => {
    if (!(await confirmSheet(`Delete ${s.name}?`, 'It is removed from the route.', 'Delete', true))) return;
    const { error } = await sb.from('stops').delete().eq('id', s.id);
    if (error) return toast('Could not delete.', 'error');
    await load('stops', 'trip');
    close();
    refresh();
  };
}

// ---------------------------------------------------------------- logbook

function renderLog(el) {
  el.innerHTML = `${head('Logbook')}
    <div class="page wrap stack" style="padding-top:16px;padding-bottom:40px">
      <form class="card" id="f" novalidate>
        <h2 class="h3">New entry</h2>
        <label class="lbl" for="d">Day</label><input class="field" type="date" id="d" value="${isoDate()}">
        <label class="lbl" for="r">Route</label><input class="field" id="r" placeholder="e.g. Corfu → Paxos">
        <div class="grid2"><div><label class="lbl" for="nm">Miles (nm)</label><input class="field" id="nm" inputmode="decimal"></div>
        <div><label class="lbl" for="pk">Peak speed (kn)</label><input class="field" id="pk" inputmode="decimal"></div></div>
        <label class="lbl" for="w">Wind</label><input class="field" id="w" placeholder="e.g. NW Maestro 14 kn">
        <label class="lbl" for="n">Note</label><textarea class="field" id="n" rows="2"></textarea>
        <button class="btn block lg mt16" id="go" type="submit">Add to logbook</button>
      </form>
      ${state.logbook
        .slice()
        .reverse()
        .map(
          (l) => `<div class="card"><div class="between"><div class="eyebrow brass">${esc(fmtDate(l.entry_date))}</div><button class="icon-btn plain" data-del="${l.id}" aria-label="Delete entry">${icon('trash', 18)}</button></div>
            <div class="h3">${esc(l.route || '')}</div><div class="small muted">${esc([l.distance_nm && `${l.distance_nm} nm`, l.peak_kn && `peak ${l.peak_kn} kn`, l.wind].filter(Boolean).join(' · '))}</div>
            ${l.note ? `<p class="small mt8">${esc(l.note)}</p>` : ''}</div>`
        )
        .join('')}
    </div>`;
  el.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const num = (id) => {
      const v = parseFloat(el.querySelector(id).value.replace(',', '.'));
      return Number.isFinite(v) ? v : null;
    };
    const row = { trip_id: state.trip.id, entry_date: el.querySelector('#d').value || isoDate(), route: el.querySelector('#r').value.trim() || null, distance_nm: num('#nm'), peak_kn: num('#pk'), wind: el.querySelector('#w').value.trim() || null, note: el.querySelector('#n').value.trim() || null };
    if (!row.route && !row.note) return toast('Add a route or a note.');
    const { error } = await sb.from('logbook').insert(row);
    if (error) return toast('Could not save.', 'error');
    await load('logbook');
    toast('Logbook updated');
    refresh();
  };
  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!(await confirmSheet('Delete this entry?', '', 'Delete', true))) return;
      await sb.from('logbook').delete().eq('id', b.dataset.del);
      await load('logbook');
      refresh();
    })
  );
}

// ---------------------------------------------------------------- team

function renderTeam(el) {
  el.innerHTML = `${head('Hosts and crew')}
    <div class="page wrap stack" style="padding-top:16px;padding-bottom:40px">
      <p class="small muted" style="margin:0 4px">People added here sign in with their email. The first time, they tap "Set your password" on the sign-in screen. Crew can see requests and guest preferences and post menus.</p>
      <div class="card tight">
        ${state.staffList
          .map(
            (s) => `<button class="list-row" data-s="${s.id}">
              <div class="avatar">${esc(initials(s.name))}</div>
              <div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc(s.email)} · ${s.role === 'host' ? 'Host' : esc(s.title || 'Crew')}${s.user_id ? '' : ' · not signed in yet'}</div></div>
              ${icon('chev', 16, 'style="color:#9AA1A8"')}
            </button>`
          )
          .join('')}
      </div>
      <form class="card" id="f" novalidate>
        <h2 class="h3">Add someone</h2>
        <label class="lbl" for="n">Name</label><input class="field" id="n" placeholder="e.g. Deana">
        <label class="lbl" for="e">Email</label><input class="field" id="e" type="email" inputmode="email" autocomplete="off">
        <div class="lbl">Role</div>${segHtml(['Host', 'Crew'], 'Host', 'role')}
        <label class="lbl" for="t">Job title (crew)</label><input class="field" id="t" placeholder="e.g. Chief Stewardess, Chef">
        <button class="btn block lg mt16" type="submit">Add</button>
      </form>
    </div>`;
  const f = el.querySelector('#f');
  const get = bindChips(f);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const name = f.querySelector('#n').value.trim();
    const email = f.querySelector('#e').value.trim().toLowerCase();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return toast('Add a name and a valid email.');
    const role = get('role') === 'Crew' ? 'crew' : 'host';
    const { error } = await sb.from('staff').insert({ name, email, role, title: f.querySelector('#t').value.trim() || (role === 'host' ? 'Host' : 'Crew') });
    if (error) return toast(error.code === '23505' ? 'That email is already on the list.' : 'Could not add.', 'error');
    await load('staffList');
    toast(`${name} added. They can now set their password.`);
    refresh();
  };
  el.querySelectorAll('[data-s]').forEach((b) =>
    b.addEventListener('click', () => {
      const s = state.staffList.find((x) => x.id === b.dataset.s);
      const me = s.user_id === state.user.id;
      const { el: sh, close } = openSheet(
        `<h2 class="h2">${esc(s.name)}</h2><p class="small muted mt8">${esc(s.email)}</p>
         <label class="lbl" for="n2">Name</label><input class="field" id="n2" value="${esc(s.name)}">
         <label class="lbl" for="t2">Job title</label><input class="field" id="t2" value="${esc(s.title || '')}">
         <div class="lbl">Role</div>${segHtml(['Host', 'Crew'], s.role === 'host' ? 'Host' : 'Crew', 'role')}
         <button class="btn block mt16" id="sv">Save</button>
         <div class="card mt16"><div class="h3">Set a new password</div><p class="tiny muted mt8">Use this if they forget it. Tell them the new one in person.</p>
           <input class="field mt8" id="pw" type="text" autocomplete="off" placeholder="At least 8 characters"><button class="btn light block mt8" id="rp">Set password</button></div>
         ${me ? '' : '<button class="btn danger block mt12" id="rm">Remove access</button>'}`,
        { label: s.name }
      );
      const g2 = bindChips(sh);
      sh.querySelector('#sv').onclick = async () => {
        const role = g2('role') === 'Crew' ? 'crew' : 'host';
        if (me && role !== 'host') return toast("You can't remove your own host access.");
        const { error } = await sb.from('staff').update({ name: sh.querySelector('#n2').value.trim() || s.name, title: sh.querySelector('#t2').value.trim() || null, role }).eq('id', s.id);
        if (error) return toast('Could not save.', 'error');
        await load('staffList');
        close();
        refresh();
      };
      sh.querySelector('#rp').onclick = async (e) => {
        const pw = sh.querySelector('#pw').value;
        if (pw.length < 8) return toast('At least 8 characters.');
        busy(e.currentTarget, true);
        try {
          await resetStaffPassword(s.id, pw);
          toast('Password set');
          close();
          load('staffList');
        } catch (x) {
          toast(x.message, 'error');
          busy(e.currentTarget, false);
        }
      };
      sh.querySelector('#rm')?.addEventListener('click', async () => {
        if (!(await confirmSheet(`Remove ${s.name}?`, 'They can no longer sign in as host or crew.', 'Remove', true))) return;
        const { error } = await sb.from('staff').delete().eq('id', s.id);
        if (error) return toast('Could not remove.', 'error');
        await load('staffList');
        close();
        refresh();
      });
    })
  );
}

// ---------------------------------------------------------------- yacht settings

function renderYacht(el) {
  const s = state.settings || { crew: [], toys: [] };
  let crew = (s.crew || []).map((c) => ({ ...c }));
  let toys = (s.toys || []).map((t) => ({ ...t }));
  const draw = () => {
    el.innerHTML = `${head('Aboard tab')}
      <div class="page wrap stack" style="padding-top:16px">
        <form id="f" class="stack" novalidate>
          <div class="card"><h2 class="h3">Wi-Fi</h2>
            <label class="lbl" for="ss">Network name</label><input class="field" id="ss" value="${esc(s.wifi_ssid || '')}">
            <label class="lbl" for="pw">Password</label><input class="field" id="pw" value="${esc(s.wifi_password || '')}" autocomplete="off">
            <p class="tiny muted mt8">Only signed-in guests and crew can see it.</p></div>
          <div class="card"><h2 class="h3">Crew shown to guests</h2>
            ${crew.map((c, i) => `<div class="row mt8" data-c="${i}"><input class="field" data-k="name" value="${esc(c.name)}" placeholder="Name" aria-label="Name"><input class="field" data-k="role" value="${esc(c.role || '')}" placeholder="Role" aria-label="Role"><button type="button" class="icon-btn plain" data-rc="${i}" aria-label="Remove">${icon('trash', 18)}</button></div>`).join('')}
            <button type="button" class="btn light sm mt12" id="ac">${icon('plus', 16)}Add crew member</button></div>
          <div class="card"><h2 class="h3">Water toys</h2>
            ${toys.map((t, i) => `<div class="row mt8" data-t="${i}"><input class="field" data-k="name" value="${esc(t.name)}" placeholder="Toy" aria-label="Toy"><input class="field" data-k="meta" value="${esc(t.meta || '')}" placeholder="Detail" aria-label="Detail"><button type="button" class="icon-btn plain" data-rt="${i}" aria-label="Remove">${icon('trash', 18)}</button></div>`).join('')}
            <button type="button" class="btn light sm mt12" id="at">${icon('plus', 16)}Add toy</button></div>
          <div class="form-foot" style="margin:0 -16px"><button class="btn accent lg block" type="submit" id="go">Save</button></div>
        </form>
      </div>`;
    const f = el.querySelector('#f');
    const collect = () => {
      f.querySelectorAll('[data-c]').forEach((r) => r.querySelectorAll('[data-k]').forEach((i) => (crew[Number(r.dataset.c)][i.dataset.k] = i.value.trim())));
      f.querySelectorAll('[data-t]').forEach((r) => r.querySelectorAll('[data-k]').forEach((i) => (toys[Number(r.dataset.t)][i.dataset.k] = i.value.trim())));
      s.wifi_ssid = f.querySelector('#ss').value.trim();
      s.wifi_password = f.querySelector('#pw').value;
    };
    f.querySelector('#ac').onclick = () => (collect(), crew.push({ name: '', role: '' }), draw());
    f.querySelector('#at').onclick = () => (collect(), toys.push({ name: '', meta: '' }), draw());
    f.querySelectorAll('[data-rc]').forEach((b) => (b.onclick = () => (collect(), crew.splice(Number(b.dataset.rc), 1), draw())));
    f.querySelectorAll('[data-rt]').forEach((b) => (b.onclick = () => (collect(), toys.splice(Number(b.dataset.rt), 1), draw())));
    f.onsubmit = async (e) => {
      e.preventDefault();
      collect();
      const { error } = await sb.from('yacht_settings').upsert({ id: 1, wifi_ssid: s.wifi_ssid || null, wifi_password: s.wifi_password || null, crew: crew.filter((c) => c.name), toys: toys.filter((t) => t.name) });
      if (error) return toast('Could not save.', 'error');
      await load('settings');
      toast('Saved');
      location.hash = '#/host';
    };
  };
  draw();
}

// ---------------------------------------------------------------- trips

function renderTrips(el) {
  const t = state.trip;
  el.innerHTML = `${head('Trips', state.trip ? '#/host' : '#/today', state.trip ? 'Host' : 'Today')}
    <div class="page wrap stack" style="padding-top:16px;padding-bottom:40px">
      ${
        state.trips.length
          ? `<div class="card tight">${state.trips
              .map(
                (x) => `<button class="list-row" data-trip="${x.id}">
                  <div class="grow"><div class="t">${esc(x.title)}</div><div class="s">${esc(fmtDate(x.start_date))} – ${esc(fmtDate(x.end_date, { day: 'numeric', month: 'short', year: 'numeric' }))}</div></div>
                  ${x.id === t?.id ? '<span class="badge live">Showing</span>' : '<span class="badge">Switch</span>'}
                </button>`
              )
              .join('')}</div>`
          : '<div class="card"><div class="empty">No trips yet. Create the first one.</div></div>'
      }
      ${
        t
          ? `<form class="card" id="ed" novalidate><h2 class="h3">Edit "${esc(t.title)}"</h2>
              <label class="lbl" for="et">Name</label><input class="field" id="et" value="${esc(t.title)}">
              <div class="grid2"><div><label class="lbl" for="es">Starts</label><input class="field" type="date" id="es" value="${esc(t.start_date)}"></div>
              <div><label class="lbl" for="ee">Ends</label><input class="field" type="date" id="ee" value="${esc(t.end_date)}"></div></div>
              <div class="btn-row mt16"><button type="button" class="btn danger" id="del">Delete trip</button><button class="btn" type="submit">Save</button></div></form>`
          : ''
      }
      <form class="card" id="nw" novalidate><h2 class="h3">New trip</h2>
        <label class="lbl" for="nt">Name</label><input class="field" id="nt" placeholder="e.g. Ionian summer 2027">
        <div class="grid2"><div><label class="lbl" for="ns">Starts</label><input class="field" type="date" id="ns"></div>
        <div><label class="lbl" for="ne">Ends</label><input class="field" type="date" id="ne"></div></div>
        <button class="btn block lg mt16" type="submit">Create trip</button></form>
    </div>`;

  el.querySelectorAll('[data-trip]').forEach((b) =>
    b.addEventListener('click', async () => {
      await switchTrip(b.dataset.trip);
      toast(`Showing ${state.trip.title}`);
      location.hash = '#/host';
    })
  );
  el.querySelector('#ed')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = el.querySelector('#et').value.trim();
    const s = el.querySelector('#es').value;
    const en = el.querySelector('#ee').value;
    if (!title || !s || !en || en < s) return toast('Check the name and dates.');
    const { error } = await sb.from('trips').update({ title, start_date: s, end_date: en }).eq('id', t.id);
    if (error) return toast('Could not save.', 'error');
    await switchTrip(t.id);
    toast('Saved');
    refresh();
  });
  el.querySelector('#del')?.addEventListener('click', async () => {
    if (!(await confirmSheet(`Delete "${t.title}"?`, 'Everything in it is deleted for good: guests, plans, menus, photos list and requests.', 'Delete trip', true))) return;
    const { data: files } = await sb.from('media').select('path, thumb_path').eq('trip_id', t.id);
    const paths = (files || []).flatMap((f) => [f.path, f.thumb_path]).filter(Boolean);
    for (let i = 0; i < paths.length; i += 100) await sb.storage.from('media').remove(paths.slice(i, i + 100));
    const { error } = await sb.from('trips').delete().eq('id', t.id);
    if (error) return toast('Could not delete.', 'error');
    try {
      localStorage.removeItem('delusha:tripId');
    } catch {
      /* ignore */
    }
    await switchTrip('');
    toast('Trip deleted');
    refresh();
  });
  el.querySelector('#nw').onsubmit = async (e) => {
    e.preventDefault();
    const title = el.querySelector('#nt').value.trim();
    const s = el.querySelector('#ns').value;
    const en = el.querySelector('#ne').value;
    if (!title || !s || !en) return toast('Add a name and both dates.');
    if (en < s) return toast('The end date is before the start.');
    const { data, error } = await sb.from('trips').insert({ title, start_date: s, end_date: en }).select().single();
    if (error) return toast('Could not create.', 'error');
    await switchTrip(data.id);
    toast('Trip created. Add stops and guests next.');
    location.hash = '#/host';
  };
}
