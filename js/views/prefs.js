import { sb, state, load } from '../store.js';
import { esc, toast, fmtDate } from '../util.js';
import { DIETS } from '../config.js';
import { chipsHtml, segHtml, bindChips, busy, backLink, PHOTOS } from './ui.js';

async function save(fields) {
  const row = { guest_id: state.guest.id, ...fields };
  const { data, error } = await sb.from('preferences').upsert(row).select().single();
  if (error) throw new Error(navigator.onLine ? 'Could not save. Please try again.' : "You're offline. Try again with signal.");
  state.prefs = data;
  load('prefs');
}

export default {
  title: 'Preferences',
  async render(el, params) {
    const step = params[0] === 'cabin' ? 'cabin' : 'food';
    if (!state.guest) {
      el.innerHTML = `<div class="page">${backLink('#/aboard', 'Aboard')}<div class="wrap"><h1 class="h1">Preferences</h1>
        <p class="muted mt8">Preferences are filled in by each guest from their own link. Hosts who are aboard can link themselves to a guest in Host console → Guests and cabins.</p></div></div>`;
      return;
    }
    const p = state.prefs || {};
    const trip = state.trip;

    if (step === 'food') {
      el.innerHTML = `
        <div class="small-hero" style="height:200px">
          <img src="${PHOTOS.bow}" alt="Delusha at anchor seen from above the bow">
          <div class="scrim"></div>
          <div class="bottom">
            <div style="font-size:13px;opacity:.9">${trip ? `Boarding ${esc(fmtDate(trip.start_date, { weekday: 'long', day: 'numeric', month: 'long' }))}` : ''}</div>
            <h1 class="h1" style="color:#fff;font-size:34px;margin-top:4px">Welcome, ${esc(state.guest.name)}</h1>
          </div>
        </div>
        <div class="page">
          <div class="wrap mt16">
            <div class="steps"><div class="on"></div><div></div><div></div></div>
            <div class="tiny muted mt8">Step 1 of 3 · Food and drink</div>
            <p class="mt12" style="color:var(--ink-2)">The chef plans every menu around these answers. Only the hosts and crew can see them.</p>
          </div>
          <form id="f" novalidate class="wrap stack mt16">
            <div class="card">
              <h2 class="h3">How do you eat?</h2>
              <div class="mt12">${chipsHtml(DIETS, p.diet || [], 'diet')}</div>
            </div>
            <div class="card">
              <label class="h3" for="al" style="display:block">Allergies or intolerances</label>
              <input class="field mt12" id="al" type="text" value="${esc(p.allergies || '')}" placeholder="e.g. tree nuts, shellfish (leave empty if none)">
              <div class="small muted mt12">How serious is it?</div>
              <div class="mt8">${segHtml(['Mild', 'Moderate', 'Severe'], p.allergy_severity || '', 'sev')}</div>
            </div>
            <div class="card">
              <label class="h3" for="dr" style="display:block">Any specific drinks you enjoy?</label>
              <textarea class="field mt12" id="dr" rows="2" placeholder="e.g. Whispering Angel rosé, oat milk flat white">${esc(p.drinks || '')}</textarea>
            </div>
            <div class="form-foot" style="margin:0 -16px">
              <a class="btn light" href="#/today" style="width:110px">Later</a>
              <button class="btn lg grow" id="go" type="submit">Continue to cabin</button>
            </div>
          </form>
        </div>`;
      const form = el.querySelector('#f');
      const get = bindChips(form, (name, btn) => {
        // "No restrictions" excludes the other diet choices.
        if (name !== 'diet') return;
        const group = form.querySelector('[data-chips="diet"]');
        const last = btn?.dataset?.value;
        if (last === 'No restrictions' && btn.getAttribute('aria-pressed') === 'true') {
          group.querySelectorAll('[data-value]').forEach((b) => b.dataset.value !== 'No restrictions' && b.setAttribute('aria-pressed', 'false'));
        } else if (last && last !== 'No restrictions') {
          group.querySelector('[data-value="No restrictions"]')?.setAttribute('aria-pressed', 'false');
        }
      });
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = el.querySelector('#go');
        const allergies = el.querySelector('#al').value.trim();
        const sev = get('sev');
        if (allergies && !sev) return toast('Please choose how serious the allergy is.');
        busy(btn, true);
        try {
          await save({ diet: get('diet'), allergies: allergies || null, allergy_severity: allergies ? sev : null, drinks: el.querySelector('#dr').value.trim() || null, food_done: true });
          location.hash = '#/prefs/cabin';
        } catch (x) {
          toast(x.message, 'error');
          busy(btn, false);
        }
      };
      return;
    }

    el.innerHTML = `
      <div class="page">
        <div class="wrap pad-top">
          <div class="steps"><div class="on"></div><div class="on"></div><div></div></div>
          <div class="tiny muted mt8">Step 2 of 3 · Your cabin${state.guest.cabin ? ` · ${esc(state.guest.cabin)}` : ''}</div>
          <h1 class="h1 mt16">Make your cabin yours</h1>
          <p class="mt8" style="color:var(--ink-2)">The crew will have it ready when you arrive.</p>
        </div>
        <form id="f" novalidate class="wrap stack mt16">
          <div class="card"><h2 class="h3">Pillow</h2><div class="mt12">${segHtml(['Soft', 'Medium', 'Firm'], p.pillow || '', 'pillow')}</div></div>
          <div class="card"><h2 class="h3">Cabin temperature</h2><div class="mt12">${segHtml(['Cool', 'Medium', 'Warm'], p.cabin_temp || '', 'temp')}</div></div>
          <div class="card"><h2 class="h3">Do you get seasick?</h2><div class="mt12">${segHtml(['Never', 'Sometimes', 'Often'], p.seasickness || '', 'sea')}</div>
            <p class="tiny muted mt8" id="seahint" ${p.seasickness && p.seasickness !== 'Never' ? '' : 'hidden'}>We'll leave remedies in your cabin and warn you before rough passages.</p></div>
          <div class="card">
            <label class="h3" for="hn" style="display:block">Health needs <span class="muted" style="font-weight:400">(optional)</span></label>
            <textarea class="field mt12" id="hn" rows="3" placeholder="Medication to keep cold, mobility, anything the crew should know">${esc(p.health_notes || '')}</textarea>
            <p class="tiny muted mt8">Only the hosts and the chief stewardess can see this.</p>
          </div>
          <div class="card">
            <label class="h3" for="sr" style="display:block">Any specific requests? <span class="muted" style="font-weight:400">(optional)</span></label>
            <textarea class="field mt12" id="sr" rows="3" placeholder="Anything that would make your stay more comfortable">${esc(p.special_requests || '')}</textarea>
          </div>
          <div class="form-foot" style="margin:0 -16px">
            <a class="btn light" href="#/prefs/food" style="width:110px">Back</a>
            <button class="btn lg grow" id="go" type="submit">Continue to safety</button>
          </div>
        </form>
      </div>`;
    const form = el.querySelector('#f');
    const get = bindChips(form, (name) => {
      if (name === 'sea') el.querySelector('#seahint').hidden = !get('sea') || get('sea') === 'Never';
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = el.querySelector('#go');
      busy(btn, true);
      try {
        await save({
          pillow: get('pillow'),
          cabin_temp: get('temp'),
          seasickness: get('sea'),
          health_notes: el.querySelector('#hn').value.trim() || null,
          special_requests: el.querySelector('#sr').value.trim() || null,
          cabin_done: true
        });
        location.hash = '#/safety/onboarding';
      } catch (x) {
        toast(x.message, 'error');
        busy(btn, false);
      }
    };
  }
};
