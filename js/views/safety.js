import { sb, state, load } from '../store.js';
import { esc, toast } from '../util.js';
import { backLink } from './ui.js';

export default {
  title: 'Safety briefing',
  deps: ['acks', 'safety'],
  async render(el, params) {
    const fromPrefs = params[0] === 'onboarding';
    const read = new Set(state.acks.map((a) => a.section_id));
    const total = state.safety.length;
    const count = state.safety.filter((s) => read.has(s.id)).length;
    const all = total > 0 && count === total;
    const canAck = !!state.guest;

    el.innerHTML = `
      <div class="page">
        ${fromPrefs ? `<div class="wrap pad-top"><div class="steps"><div class="on"></div><div class="on"></div><div class="on"></div></div><div class="tiny muted mt8">Step 3 of 3 · Safety</div></div>` : backLink('#/today', 'Today')}
        <div class="wrap">
          <h1 class="h1 ${fromPrefs ? 'mt16' : ''}">Safety briefing</h1>
          <p class="muted mt8">${canAck ? 'Please finish before your first swim or tender ride. About 4 minutes.' : 'This is what guests read and confirm.'}</p>
          ${
            canAck
              ? `<div class="card mt16">
                  <div class="between"><div class="h3">${count} of ${total} read</div><div class="small muted">${all ? 'All done, thank you' : `${total - count} left`}</div></div>
                  <div class="steps mt12">${state.safety.map((s) => `<div class="${read.has(s.id) ? 'on' : ''}" style="${read.has(s.id) ? 'background:var(--live)' : ''}"></div>`).join('')}</div>
                </div>`
              : ''
          }
          <div class="stack mt12">
            ${state.safety
              .map((s, i) => {
                const on = read.has(s.id);
                return `<div class="card row-top">
                  <div class="check ${on ? 'on' : ''}" aria-hidden="true">${on ? '✓' : i + 1}</div>
                  <div class="grow">
                    <div class="h3">${esc(s.title)}</div>
                    <p class="small muted mt8">${esc(s.body)}</p>
                    ${canAck ? `<button class="btn sm ${on ? 'ok' : 'light'} mt12" data-id="${s.id}" aria-pressed="${on}">${on ? 'Read' : 'Mark as read'}</button>` : ''}
                  </div>
                </div>`;
              })
              .join('')}
          </div>
        </div>
        ${
          canAck
            ? `<div class="form-foot"><a class="btn block lg ${all ? '' : 'light'}" href="#/today" ${all ? '' : 'aria-disabled="true"'} id="done">${all ? (fromPrefs ? "All set. See today's plan" : 'Done') : `Read all ${total} sections`}</a></div>`
            : '<div style="height:40px"></div>'
        }
      </div>`;

    el.querySelectorAll('[data-id]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const on = b.getAttribute('aria-pressed') === 'true';
        // optimistic update
        if (on) state.acks = state.acks.filter((a) => a.section_id !== id);
        else state.acks = [...state.acks, { section_id: id }];
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        const res = on
          ? await sb.from('safety_acks').delete().eq('guest_id', state.guest.id).eq('section_id', id)
          : await sb.from('safety_acks').insert({ guest_id: state.guest.id, section_id: id });
        if (res.error && res.error.code !== '23505') {
          toast('Could not save. Check your signal.', 'error');
          load('acks');
        }
      })
    );
    el.querySelector('#done')?.addEventListener('click', (e) => {
      if (!all) {
        e.preventDefault();
        toast('Please read every section first.');
      }
    });
  }
};
