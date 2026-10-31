// Shared bits for screens.
import { esc, icon } from '../util.js';

export function backLink(href, label) {
  return `<a class="back" href="${href}">${icon('back', 20)}${esc(label)}</a>`;
}

export function qrSvg(text, size = 76) {
  if (!window.qrcode) return '';
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#0E1B26"/></svg>`;
}

// Bottom sheet. Returns { el, close }.
export function openSheet(html, { onClose, label = 'Dialog' } = {}) {
  const el = document.createElement('div');
  el.className = 'sheet open';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', label);
  el.innerHTML = `<div class="bg" data-close></div><div class="panel"><div class="grabber"></div>${html}</div>`;
  document.body.appendChild(el);
  const prevFocus = document.activeElement;
  const close = () => {
    el.remove();
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus?.();
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });
  setTimeout(() => el.querySelector('input, textarea, select, button:not([data-close])')?.focus?.(), 50);
  return { el, close };
}

export function confirmSheet(title, body, okLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    let ok = false;
    const { el, close } = openSheet(
      `<h2 class="h2">${esc(title)}</h2><p class="muted mt8">${esc(body)}</p>
       <div class="btn-row mt16"><button class="btn light" data-close>Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(okLabel)}</button></div>`,
      { onClose: () => resolve(ok), label: title }
    );
    el.querySelector('[data-ok]').addEventListener('click', () => {
      ok = true;
      close();
    });
  });
}

export function chipsHtml(options, selected, name, multi = true) {
  const sel = new Set(Array.isArray(selected) ? selected : [selected]);
  return `<div class="chips" data-chips="${esc(name)}" data-multi="${multi ? 1 : 0}">${options
    .map((o) => `<button type="button" class="chip" aria-pressed="${sel.has(o)}" data-value="${esc(o)}">${esc(o)}</button>`)
    .join('')}</div>`;
}

export function segHtml(options, selected, name) {
  return `<div class="seg" data-chips="${esc(name)}" data-multi="0">${options
    .map((o) => `<button type="button" aria-pressed="${o === selected}" data-value="${esc(o)}">${esc(o)}</button>`)
    .join('')}</div>`;
}

// Wires up chips/segments inside root. Returns a getter for the current values.
export function bindChips(root, onChange) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-chips] [data-value]');
    if (!b) return;
    const group = b.closest('[data-chips]');
    if (group.dataset.multi === '1') {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    } else {
      group.querySelectorAll('[data-value]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }
    onChange?.(group.dataset.chips, b);
  });
  return (name) => {
    const group = root.querySelector(`[data-chips="${name}"]`);
    if (!group) return null;
    const vals = [...group.querySelectorAll('[aria-pressed="true"]')].map((x) => x.dataset.value);
    return group.dataset.multi === '1' ? vals : vals[0] || null;
  };
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = label || 'Saving…';
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

export const HERO = './Delusha%20Beauty%20Shots/IMG-20250617-WA0015.jpg';
export const PHOTOS = {
  aerial: './Delusha%20Beauty%20Shots/IMG-20250617-WA0011.jpg',
  sailing: './Delusha%20Beauty%20Shots/IMG-20250617-WA0009.jpg',
  dining: './Delusha%20Beauty%20Shots/IMG-20250617-WA0013.jpg',
  bow: './Delusha%20Beauty%20Shots/IMG-20250617-WA0018.jpg',
  saloon: './Delusha%20Beauty%20Shots/IMG-20250617-WA0008.jpg',
  deck: './Delusha%20Beauty%20Shots/IMG-20250617-WA0012.jpg',
  sunset: './Delusha%20Beauty%20Shots/IMG-20250617-WA0016.jpg'
};
