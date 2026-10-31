import { state } from '../store.js';
import { esc, fmtTime, dayLabel, icon, toast } from '../util.js';
import { pushSupport, isSubscribed, enablePush, disablePush } from '../push.js';
import { backLink } from './ui.js';

export default {
  title: 'Alerts',
  deps: ['alerts'],
  async render(el) {
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(`delusha:seenAlerts:${state.trip?.id}`) || 0);
      localStorage.setItem(`delusha:seenAlerts:${state.trip?.id}`, String(Date.now()));
    } catch {
      /* ignore */
    }
    const push = pushSupport();
    const on = await isSubscribed().catch(() => false);
    const byDay = {};
    for (const a of state.alerts) (byDay[dayLabel(a.created_at)] ||= []).push(a);

    el.innerHTML = `
      <div class="page">
        ${backLink('#/today', 'Today')}
        <div class="wrap">
          <h1 class="h1">Alerts</h1>
          <div class="card row mt16">
            <div class="grow"><div class="h3">Notifications</div><div class="tiny muted">${
              push.needsInstall ? 'On iPhone: tap Share, then "Add to Home Screen", then open Delusha from your home screen.' : !push.supported ? 'Not available in this browser. Alerts still show here.' : 'Tender times, meals and weather from the hosts'
            }</div></div>
            <button class="switch" role="switch" aria-checked="${on}" aria-label="Notifications" id="push" ${!push.supported || push.needsInstall ? 'disabled' : ''}></button>
          </div>
          ${
            state.alerts.length
              ? Object.entries(byDay)
                  .map(
                    ([day, items]) => `<h2 class="eyebrow" style="margin:24px 4px 10px">${esc(day)}</h2>
                <div class="stack-s">${items
                  .map((a) => {
                    const fresh = new Date(a.created_at).getTime() > lastSeen;
                    return `<div class="card row-top" style="padding:14px 16px;${fresh ? 'border:1px solid #BFD8DE' : ''}">
                      <div class="avatar" style="${fresh ? 'background:var(--accent);color:#fff' : ''}">${icon('bell', 18)}</div>
                      <div class="grow">
                        <div class="between"><div class="h3" style="font-size:15px">${esc(a.title)}</div><div class="tiny muted" style="flex:none">${esc(fmtTime(a.created_at))}</div></div>
                        ${a.body ? `<p class="small mt8" style="color:var(--ink-2)">${esc(a.body)}</p>` : ''}
                        ${a.sender_name ? `<div class="tiny muted mt8">${esc(a.sender_name)}</div>` : ''}
                      </div>
                    </div>`;
                  })
                  .join('')}</div>`
                  )
                  .join('')
              : '<div class="card mt16"><div class="empty">No alerts yet.</div></div>'
          }
        </div>
      </div>`;

    el.querySelector('#push')?.addEventListener('click', async (e) => {
      const b = e.currentTarget;
      try {
        if (b.getAttribute('aria-checked') === 'true') {
          await disablePush();
          b.setAttribute('aria-checked', 'false');
        } else {
          await enablePush();
          b.setAttribute('aria-checked', 'true');
          toast('Notifications on');
        }
      } catch (x) {
        toast(x.message, 'error');
      }
    });
  }
};
