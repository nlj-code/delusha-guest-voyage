import { sb, state, load, prefsFor, flagDish, myName, isHost } from '../store.js';
import { esc, icon, toast, timeAgo, isoDate, fmtDate } from '../util.js';
import { notify } from '../push.js';
import { busy, segHtml, bindChips, confirmSheet } from './ui.js';
import { requestTitle, statusBadge } from './requests.js';

let tab = 'requests';
let showDone = false;

export default {
  title: 'Crew',
  deps: ['requests', 'allPrefs', 'guests', 'menus'],
  async render(el, params) {
    if (params[0] === 'menu') return renderMenuEditor(el, params[1] || isoDate(), params[2] || 'dinner');
    if (['requests', 'guests', 'menu-list'].includes(params[0])) tab = params[0];

    const open = state.requests.filter((r) => r.status !== 'done');
    const done = state.requests.filter((r) => r.status === 'done');

    el.innerHTML = `
      <div class="dark-head">
        <div class="between">
          <a class="back" style="margin:0;padding:0" href="#/today">${icon('back', 20)}Guest view</a>
          <div class="tiny muted">${esc(myName())}${state.staff?.title ? ` · ${esc(state.staff.title)}` : ''}</div>
        </div>
        <h1 class="h1" style="margin-top:8px">Crew</h1>
        <div class="seg dark mt16" role="tablist" aria-label="Crew sections">
          <button role="tab" aria-selected="${tab === 'requests'}" data-tab="requests">Requests${open.length ? ` · ${open.length}` : ''}</button>
          <button role="tab" aria-selected="${tab === 'guests'}" data-tab="guests">Guests</button>
          <button role="tab" aria-selected="${tab === 'menu-list'}" data-tab="menu-list">Menu</button>
        </div>
      </div>
      <div class="page wrap" style="padding-top:16px;padding-bottom:40px" id="body"></div>`;

    const body = el.querySelector('#body');
    if (tab === 'requests') {
      const card = (r) => `
        <div class="card" style="${r.urgent && r.status !== 'done' ? 'border:1px solid #F2C9B3' : ''}">
          <div class="between" style="align-items:center">
            <div class="row" style="gap:6px">
              <span class="badge ${r.kind === 'issue' ? 'warn' : r.kind === 'chef' ? 'brass' : 'accent'}">${r.kind === 'issue' ? 'CABIN ISSUE' : r.kind === 'chef' ? 'CHEF' : 'LAUNDRY'}</span>
              ${r.urgent && r.status !== 'done' ? '<span class="badge urgent">URGENT</span>' : ''}
            </div>
            <div class="tiny muted">${esc(timeAgo(r.created_at))}</div>
          </div>
          <div class="h3 mt12" style="font-size:16px">${esc(requestTitle(r))}</div>
          <div class="small muted">${esc([r.requester_name, r.cabin].filter(Boolean).join(' · '))}</div>
          ${r.note ? `<p class="small mt8">${esc(r.note)}</p>` : ''}
          ${r.photo_path ? `<img data-rphoto="${esc(r.photo_path)}" alt="Photo of the issue" style="margin-top:10px;border-radius:12px;max-height:180px;object-fit:cover;width:100%">` : ''}
          <div class="row mt12" style="gap:8px;flex-wrap:wrap">
            ${
              r.status === 'done'
                ? statusBadge('done')
                : `<button class="btn sm ${r.status === 'in_progress' ? 'accent' : ''}" data-adv="${r.id}">${r.status === 'new' ? 'Start' : 'Mark done'}</button>`
            }
            ${
              r.kind === 'issue' && r.status !== 'done'
                ? r.captain_told
                  ? '<span class="badge live">Captain told</span>'
                  : `<button class="btn sm light" data-capt="${r.id}">Tell the captain</button>`
                : ''
            }
          </div>
        </div>`;
      body.innerHTML = `
        <div class="stack">${open.length ? open.map(card).join('') : '<div class="card"><div class="empty">No open requests.</div></div>'}</div>
        ${
          done.length
            ? `<button class="btn light block mt16" id="toggleDone">${showDone ? 'Hide' : 'Show'} ${done.length} finished</button>
               ${showDone ? `<div class="stack mt12">${done.map(card).join('')}</div>` : ''}`
            : ''
        }`;
      const photos = [...body.querySelectorAll('[data-rphoto]')];
      if (photos.length) {
        const { data } = await sb.storage.from('request-photos').createSignedUrls(photos.map((p) => p.dataset.rphoto), 3600);
        for (const row of data || []) {
          const img = body.querySelector(`[data-rphoto="${CSS.escape(row.path)}"]`);
          if (img && row.signedUrl) img.src = row.signedUrl;
        }
      }
      body.querySelector('#toggleDone')?.addEventListener('click', () => {
        showDone = !showDone;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      body.addEventListener('click', async (e) => {
        const adv = e.target.closest('[data-adv]');
        const capt = e.target.closest('[data-capt]');
        if (adv) {
          const r = state.requests.find((x) => x.id === adv.dataset.adv);
          const next = r.status === 'new' ? 'in_progress' : 'done';
          busy(adv, true, '…');
          const { error } = await sb.from('requests').update({ status: next }).eq('id', r.id);
          if (error) {
            busy(adv, false);
            return toast('Could not update. Check signal.', 'error');
          }
          r.status = next;
          notify('request_status', r.id);
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
        if (capt) {
          const r = state.requests.find((x) => x.id === capt.dataset.capt);
          const { error } = await sb.from('requests').update({ captain_told: true }).eq('id', r.id);
          if (error) return toast('Could not update.', 'error');
          r.captain_told = true;
          toast('Marked as passed to the captain');
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      });
    }

    if (tab === 'guests') {
      const allergic = state.guests
        .map((g) => ({ g, p: prefsFor(g.id) }))
        .filter((x) => x.p?.allergies);
      body.innerHTML = `
        ${allergic.map((x) => `<div class="card warn small" style="padding:12px 14px;margin-bottom:8px"><strong>Allergy:</strong> ${esc(x.g.name)}, ${esc(x.p.allergies)}${x.p.allergy_severity ? ` (${esc(x.p.allergy_severity.toLowerCase())})` : ''}</div>`).join('')}
        <div class="stack">
          ${
            state.guests.length
              ? state.guests
                  .map((g) => {
                    const p = prefsFor(g.id);
                    const cell = (k, v) => `<div class="stat" style="padding:8px"><div class="k">${k}</div><div class="small" style="font-weight:600">${esc(v || '–')}</div></div>`;
                    return `<div class="card">
                      <div class="between"><div class="h3">${esc(g.name)}</div><div class="tiny muted">${esc(g.cabin || 'No cabin')}</div></div>
                      ${
                        p
                          ? `<div class="grid3 mt12">${cell('Pillow', p.pillow)}${cell('Cabin', p.cabin_temp)}${cell('Seasick', p.seasickness)}</div>
                             <div class="small mt12"><strong>Food:</strong> ${esc((p.diet || []).join(', ') || 'No answer')}</div>
                             ${p.drinks ? `<div class="small mt8"><strong>Drinks:</strong> ${esc(p.drinks)}</div>` : ''}
                             ${p.health_notes ? `<div class="small mt8"><strong>Health:</strong> ${esc(p.health_notes)}</div>` : ''}
                             ${p.special_requests ? `<div class="small mt8"><strong>Requests:</strong> ${esc(p.special_requests)}</div>` : ''}`
                          : '<p class="small muted mt8">No preferences yet.</p>'
                      }
                    </div>`;
                  })
                  .join('')
              : '<div class="card"><div class="empty">No guests on this trip yet.</div></div>'
          }
        </div>`;
    }

    if (tab === 'menu-list') {
      const days = [0, 1, 2].map((d) => isoDate(new Date(Date.now() + d * 86400000)));
      body.innerHTML = `<div class="stack">${days
        .map(
          (d) => `<div class="card tight">
            <div class="eyebrow brass" style="padding-top:12px">${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' }))}</div>
            ${['breakfast', 'lunch', 'dinner']
              .map((m) => {
                const menu = state.menus.find((x) => x.menu_date === d && x.meal === m);
                return `<a class="list-row" href="#/crew/menu/${d}/${m}">
                  <div class="grow"><div class="t">${m.charAt(0).toUpperCase() + m.slice(1)}</div><div class="s">${menu ? esc((menu.courses || []).map((c) => c.name).filter(Boolean).join(' · ') || 'No dishes yet') : 'Not posted'}</div></div>
                  ${menu ? '<span class="badge live">Posted</span>' : '<span class="badge">Add</span>'}
                </a>`;
              })
              .join('')}
          </div>`
        )
        .join('')}</div>`;
    }

    el.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        location.hash = `#/crew/${tab}`;
      })
    );
  }
};

// ---------------------------------------------------------------- menu editor

function renderMenuEditor(el, date, meal) {
  const existing = state.menus.find((m) => m.menu_date === date && m.meal === meal);
  let courses = existing?.courses?.length
    ? existing.courses.map((c) => ({ ...c }))
    : meal === 'breakfast'
    ? [{ course: 'Fresh', name: '', desc: '', tags: '' }, { course: 'Warm', name: '', desc: '', tags: '' }]
    : [
        { course: 'To start', name: '', desc: '', tags: '' },
        { course: 'Main', name: '', desc: '', tags: '' },
        { course: 'Dessert', name: '', desc: '', tags: '' }
      ];
  const defaults = { breakfast: ['08:30', 'Aft deck'], lunch: ['13:00', 'Under the bimini'], dinner: ['21:00', 'On deck'] }[meal];

  const draw = () => {
    el.innerHTML = `
      <div class="page">
        <a class="back" href="#/crew/menu-list">${icon('back', 20)}Crew</a>
        <div class="wrap">
          <h1 class="h1">${existing ? 'Edit' : 'Post'} ${meal}</h1>
          <form id="f" class="stack mt16" novalidate>
            <div class="card">
              <label class="lbl" for="dt" style="margin-top:0">Day</label>
              <input class="field" id="dt" type="date" value="${esc(date)}">
              <div class="lbl">Meal</div>
              ${segHtml(['Breakfast', 'Lunch', 'Dinner'], meal.charAt(0).toUpperCase() + meal.slice(1), 'meal')}
              <div class="grid2">
                <div><label class="lbl" for="at">Time</label><input class="field" id="at" value="${esc(existing?.served_at ?? defaults[0])}"></div>
                <div><label class="lbl" for="loc">Where</label><input class="field" id="loc" value="${esc(existing?.location ?? defaults[1])}"></div>
              </div>
              <label class="lbl" for="nt">Note for guests (optional)</label>
              <textarea class="field" id="nt" rows="2" placeholder="e.g. Tonight's fish came off a Gaios boat at four.">${esc(existing?.note || '')}</textarea>
            </div>
            <div id="courses" class="stack">
              ${courses
                .map((c, i) => {
                  const hits = flagDish(c);
                  return `<div class="card" data-i="${i}">
                    <div class="between"><input class="field" data-k="course" value="${esc(c.course)}" aria-label="Course name" style="min-height:40px;font-weight:600;max-width:60%">
                      <button type="button" class="icon-btn plain" data-rm="${i}" aria-label="Remove dish">${icon('trash', 18)}</button></div>
                    <label class="lbl">Dish</label><input class="field" data-k="name" value="${esc(c.name)}" placeholder="e.g. Whole grilled sea bass">
                    <label class="lbl">Description</label><input class="field" data-k="desc" value="${esc(c.desc)}" placeholder="e.g. Lemon potatoes, wild greens">
                    <label class="lbl">Labels</label><input class="field" data-k="tags" value="${esc(c.tags)}" placeholder="e.g. Gluten-free · Vegetarian">
                    ${hits.length ? `<div class="badge warn mt12">Allergy check: ${esc(hits.map((h) => `${h.word} (${state.guests.find((g) => g.id === h.guestId)?.name || 'guest'})`).join(', '))}</div>` : ''}
                  </div>`;
                })
                .join('')}
            </div>
            <button type="button" class="btn light" id="add">${icon('plus', 18)}Add a dish</button>
            <div class="form-foot" style="margin:0 -16px">
              ${existing ? `<button type="button" class="btn danger" id="del" style="width:110px">Delete</button>` : ''}
              <button class="btn accent lg grow" id="pub" type="submit">Publish to guests</button>
            </div>
          </form>
        </div>
      </div>`;
    const form = el.querySelector('#f');
    const get = bindChips(form);
    const collect = () => {
      form.querySelectorAll('[data-i]').forEach((card) => {
        const c = courses[Number(card.dataset.i)];
        card.querySelectorAll('[data-k]').forEach((inp) => (c[inp.dataset.k] = inp.value.trim()));
      });
    };
    form.querySelector('#add').onclick = () => {
      collect();
      courses.push({ course: 'Course', name: '', desc: '', tags: '' });
      draw();
    };
    form.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => {
        collect();
        courses.splice(Number(b.dataset.rm), 1);
        draw();
      })
    );
    form.querySelector('#del')?.addEventListener('click', async () => {
      if (!(await confirmSheet('Delete this menu?', 'Guests will no longer see it.', 'Delete', true))) return;
      const { error } = await sb.from('menus').delete().eq('id', existing.id);
      if (error) return toast('Could not delete.', 'error');
      await load('menus');
      location.hash = '#/crew/menu-list';
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      collect();
      const list = courses.filter((c) => c.name);
      if (!list.length) return toast('Add at least one dish.');
      const btn = form.querySelector('#pub');
      busy(btn, true, 'Publishing…');
      const newDate = form.querySelector('#dt').value || date;
      const newMeal = (get('meal') || meal).toLowerCase();
      const row = {
        trip_id: state.trip.id,
        menu_date: newDate,
        meal: newMeal,
        served_at: form.querySelector('#at').value.trim() || null,
        location: form.querySelector('#loc').value.trim() || null,
        note: form.querySelector('#nt').value.trim() || null,
        courses: list,
        author_name: `${myName()}${state.staff?.title && !isHost() ? `, ${state.staff.title}` : ''}`
      };
      if (existing && (existing.menu_date !== newDate || existing.meal !== newMeal)) {
        await sb.from('menus').delete().eq('id', existing.id);
      }
      const { error } = await sb.from('menus').upsert(row, { onConflict: 'trip_id,menu_date,meal' });
      if (error) {
        busy(btn, false);
        return toast('Could not publish. Check signal.', 'error');
      }
      await load('menus');
      toast('Menu published');
      location.hash = '#/dining';
    };
  };
  draw();
}
