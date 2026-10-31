import { sb, state, load, myName } from '../store.js';
import { esc, icon, toast, fmtTime, dayLabel } from '../util.js';
import { LAUNDRY_SERVICES, BACK_BY, ISSUE_TYPES } from '../config.js';
import { notify } from '../push.js';
import { backLink, chipsHtml, bindChips, busy } from './ui.js';

export async function createRequest(fields) {
  if (!state.trip) throw new Error('No trip selected.');
  if (!navigator.onLine) throw new Error("You're offline. Try again when there's signal.");
  const row = {
    trip_id: state.trip.id,
    guest_id: state.guest?.id || null,
    requester_name: myName(),
    cabin: state.guest?.cabin || null,
    created_by: state.user.id,
    ...fields
  };
  const { data, error } = await sb.from('requests').insert(row).select().single();
  if (error) throw new Error('Could not send. Please try again.');
  notify('request', data.id);
  load('requests');
  return data;
}

export function statusBadge(s) {
  if (s === 'done') return '<span class="badge live">Done</span>';
  if (s === 'in_progress') return '<span class="badge accent">In progress</span>';
  return '<span class="badge">Received</span>';
}

export function requestTitle(r) {
  if (r.kind === 'laundry') return `${r.services?.length ? r.services.join(' & ') : 'Laundry'}${r.back_by ? ` · ${r.back_by.toLowerCase()}` : ''}`;
  if (r.kind === 'chef') return 'Note for the chef';
  return `${r.issue_type || 'Cabin issue'}`;
}

let tab = 'laundry';

export default {
  title: 'Requests',
  deps: ['requests'],
  async render(el) {
    const mine = state.requests.filter((r) => r.created_by === state.user?.id);
    el.innerHTML = `
      <div class="page">
        ${backLink('#/aboard', 'Aboard')}
        <div class="wrap">
          <h1 class="h1">How can we help?</h1>
          <p class="muted mt8">Goes straight to the chief stewardess.</p>
          <div class="seg mt16" role="tablist" aria-label="Request type">
            <button role="tab" aria-selected="${tab === 'laundry'}" data-tab="laundry">Laundry & ironing</button>
            <button role="tab" aria-selected="${tab === 'issue'}" data-tab="issue">Cabin issue</button>
          </div>
          <form class="card mt12" id="f" novalidate>
            ${
              tab === 'laundry'
                ? `<div class="h3">What do you need?</div>
                   <div class="mt12">${chipsHtml(LAUNDRY_SERVICES, ['Laundry'], 'services')}</div>
                   <div class="h3 mt16">Back by</div>
                   <div class="mt12">${chipsHtml(BACK_BY, 'Tomorrow', 'back', false)}</div>
                   <label class="lbl" for="note">Note (optional)</label>
                   <textarea class="field" id="note" rows="2" placeholder="e.g. White linen shirt for dinner tonight"></textarea>
                   <div class="card flat small mt12" style="padding:10px 12px">Leave items in the laundry bag in your wardrobe. The crew will collect them.</div>
                   <button class="btn block lg mt16" id="send" type="submit">Send</button>`
                : `<div class="h3">What's wrong?</div>
                   <div class="tile-grid mt12" data-chips="issue" data-multi="0">
                     ${ISSUE_TYPES.map((t) => `<button type="button" class="chip" data-value="${t}" aria-pressed="false">${t}</button>`).join('')}
                   </div>
                   <label class="lbl" for="note">Tell us a little more</label>
                   <textarea class="field" id="note" rows="2" placeholder="e.g. The toilet in the cabin bathroom won't flush"></textarea>
                   <div class="btn-row mt12">
                     <label class="btn light" style="min-height:44px">${icon('camera', 18)}<span id="phl">Add photo</span><input type="file" id="photo" accept="image/*" hidden></label>
                     <button type="button" class="btn light" role="switch" aria-checked="false" id="urg" style="min-height:44px">Not urgent</button>
                   </div>
                   <p class="tiny muted mt8">Mark it urgent for leaks, smells or anything unsafe. The crew are alerted straight away.</p>
                   <button class="btn block lg mt16" id="send" type="submit">Report to the crew</button>`
            }
          </form>
        </div>

        <div class="section-head"><h2 class="eyebrow">Your requests</h2></div>
        <div class="card tight" style="margin:0 16px">
          ${
            mine.length
              ? mine
                  .map(
                    (r) => `<div class="list-row">
                      <div class="grow"><div class="t">${esc(requestTitle(r))}</div><div class="s">${esc(dayLabel(r.created_at))} ${esc(fmtTime(r.created_at))}${r.note ? ` · ${esc(r.note)}` : ''}</div></div>
                      ${statusBadge(r.status)}
                    </div>`
                  )
                  .join('')
              : '<div class="empty">Nothing yet.</div>'
          }
        </div>
      </div>`;

    el.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      })
    );
    const get = bindChips(el.querySelector('#f'));
    let photo = null;
    el.querySelector('#photo')?.addEventListener('change', (e) => {
      photo = e.target.files[0] || null;
      el.querySelector('#phl').textContent = photo ? 'Photo added' : 'Add photo';
    });
    const urg = el.querySelector('#urg');
    urg?.addEventListener('click', () => {
      const on = urg.getAttribute('aria-checked') !== 'true';
      urg.setAttribute('aria-checked', String(on));
      urg.textContent = on ? 'Urgent' : 'Not urgent';
      urg.className = on ? 'btn danger' : 'btn light';
      urg.style.minHeight = '44px';
    });

    el.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const btn = el.querySelector('#send');
      const note = el.querySelector('#note').value.trim();
      try {
        if (tab === 'laundry') {
          const services = get('services');
          if (!services.length) return toast('Pick laundry, ironing or dry clean.');
          busy(btn, true, 'Sending…');
          await createRequest({ kind: 'laundry', services, back_by: get('back'), note: note || null });
          toast('Sent. The crew will collect your items.');
        } else {
          const issue = get('issue');
          if (!issue) return toast("Pick what's wrong first.");
          busy(btn, true, 'Sending…');
          let photo_path = null;
          if (photo) {
            photo_path = `${state.trip.id}/${crypto.randomUUID()}.jpg`;
            const up = await sb.storage.from('request-photos').upload(photo_path, photo, { contentType: photo.type || 'image/jpeg' });
            if (up.error) photo_path = null;
          }
          await createRequest({ kind: 'issue', issue_type: issue, note: note || null, urgent: urg.getAttribute('aria-checked') === 'true', photo_path });
          toast('Reported. The crew have been told.');
        }
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (x) {
        toast(x.message, 'error');
        busy(btn, false);
      }
    };
  }
};
