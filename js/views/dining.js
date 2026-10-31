import { state, isStaff, menusFor, flagDish } from '../store.js';
import { esc, icon, isoDate, fmtDate, toast } from '../util.js';
import { PHOTOS, openSheet, busy } from './ui.js';
import { createRequest } from './requests.js';

let meal = null;
let dayOffset = 0;

function defaultMeal() {
  const h = new Date().getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : 'dinner';
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default {
  title: 'Dining',
  tab: 'dining',
  deps: ['menus', 'prefs', 'allPrefs'],
  async render(el) {
    meal = meal || defaultMeal();
    const date = isoDate(new Date(Date.now() + dayOffset * 86400000));
    const menus = menusFor(date);
    const m = menus.find((x) => x.meal === meal);
    const myAllergy = state.prefs?.allergies;

    el.innerHTML = `
      <div class="small-hero">
        <img src="${PHOTOS.dining}" alt="Dining table set in the deckhouse saloon">
        <div class="scrim"></div>
        <div class="bottom">
          <div style="font-size:13px;opacity:.9">${esc(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
          <h1 class="h1" style="color:#fff;font-size:40px;margin-top:4px">Dining</h1>
        </div>
      </div>
      <div class="page">
        <div class="wrap mt16 stack">
          <div class="seg" role="tablist" aria-label="Day">
            <button role="tab" aria-selected="${dayOffset === 0}" data-day="0">Today</button>
            <button role="tab" aria-selected="${dayOffset === 1}" data-day="1">Tomorrow</button>
          </div>
          <div class="seg" role="tablist" aria-label="Meal">
            ${['breakfast', 'lunch', 'dinner'].map((x) => `<button role="tab" aria-selected="${x === meal}" data-meal="${x}">${cap(x)}</button>`).join('')}
          </div>
        </div>

        ${
          m
            ? `
          <div class="card" style="margin:12px 16px 0">
            <div class="row">
              <div class="avatar" style="background:var(--ink);color:#fff">${esc((m.author_name || 'C').charAt(0))}</div>
              <div class="grow"><div class="h3">${esc(m.author_name || 'From the galley')}</div><div class="tiny muted">${esc([m.served_at, m.location].filter(Boolean).join(' · '))}</div></div>
            </div>
            ${m.note ? `<p class="quote">“${esc(m.note)}”</p>` : ''}
          </div>
          ${
            myAllergy
              ? `<div class="card ok row" style="margin:12px 16px 0;padding:12px 14px">${icon('check', 20)}<div class="small"><strong>The chef has your notes:</strong> ${esc(myAllergy)}${state.prefs.allergy_severity ? ` (${esc(state.prefs.allergy_severity.toLowerCase())})` : ''}.</div></div>`
              : ''
          }
          <div class="card tight" style="margin:12px 16px 0;padding:4px 20px">
            ${(m.courses || [])
              .map((c) => {
                const hits = flagDish(c);
                return `<div class="dish">
                  <div class="eyebrow brass">${esc(c.course || '')}</div>
                  <div class="name">${esc(c.name || '')}</div>
                  ${c.desc ? `<div class="desc">${esc(c.desc)}</div>` : ''}
                  ${c.tags ? `<div class="tags">${esc(c.tags)}</div>` : ''}
                  ${hits.length ? `<div class="badge warn mt8">Check with the chef: ${esc([...new Set(hits.map((h) => h.word))].join(', '))}</div>` : ''}
                </div>`;
              })
              .join('') || '<div class="empty">No dishes listed yet.</div>'}
          </div>`
            : `<div class="card" style="margin:12px 16px 0"><div class="empty">The ${esc(meal)} menu for ${dayOffset ? 'tomorrow' : 'today'} isn't posted yet.</div></div>`
        }

        <div class="btn-row" style="margin:12px 16px 0">
          ${
            isStaff()
              ? `<a class="btn block" href="#/crew/menu/${date}/${meal}">${icon('edit', 18)}${m ? 'Edit this menu' : 'Post this menu'}</a>`
              : `<button class="btn light" id="note">Note for the chef</button>
                 <button class="btn" id="skip">I'll skip this meal</button>`
          }
        </div>
      </div>`;

    el.querySelectorAll('[data-meal]').forEach((b) =>
      b.addEventListener('click', () => {
        meal = b.dataset.meal;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      })
    );
    el.querySelectorAll('[data-day]').forEach((b) =>
      b.addEventListener('click', () => {
        dayOffset = Number(b.dataset.day);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      })
    );

    const send = async (text, btn) => {
      busy(btn, true, 'Sending…');
      try {
        await createRequest({ kind: 'chef', note: text });
        toast('Sent to the chef');
        return true;
      } catch (e) {
        toast(e.message || 'Could not send.', 'error');
        return false;
      } finally {
        busy(btn, false);
      }
    };
    el.querySelector('#skip')?.addEventListener('click', (e) =>
      send(`${state.guest?.name || 'A guest'} will skip ${meal} on ${fmtDate(date)}.`, e.currentTarget)
    );
    el.querySelector('#note')?.addEventListener('click', () => {
      const { el: s, close } = openSheet(
        `<h2 class="h2">Note for the chef</h2>
         <label class="lbl" for="cn">Your note</label>
         <textarea class="field" id="cn" rows="3" placeholder="e.g. Could I have the fish without sauce tonight?"></textarea>
         <div class="btn-row mt16"><button class="btn light" data-close>Cancel</button><button class="btn" id="cs">Send</button></div>`,
        { label: 'Note for the chef' }
      );
      s.querySelector('#cs').onclick = async (e) => {
        const text = s.querySelector('#cn').value.trim();
        if (!text) return toast('Write a short note first.');
        if (await send(`${cap(meal)} ${fmtDate(date)}: ${text}`, e.currentTarget)) close();
      };
    });
  }
};
