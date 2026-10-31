// App shell: sign-in, routing between screens, tab bar, live updates.
import { sb, state, loadProfile, loadAll, startRealtime, onChange, joinWithInvite, isStaff } from './store.js';
import { icon, toast, esc } from './util.js';
import { processQueue } from './uploads.js';
import { refreshPush } from './push.js';
import { resumeSharingIfOn } from './position.js';

import welcome from './views/welcome.js';
import login from './views/login.js';
import today from './views/today.js';
import voyage from './views/voyage.js';
import photos from './views/photos.js';
import dining from './views/dining.js';
import aboard from './views/aboard.js';
import safety from './views/safety.js';
import alerts from './views/alerts.js';
import prefs from './views/prefs.js';
import requests from './views/requests.js';
import host from './views/host.js';
import crew from './views/crew.js';
import tv from './views/tv.js';

const routes = { welcome, login, today, voyage, photos, dining, aboard, safety, alerts, prefs, requests, host, crew, tv };

const TABS = [
  ['today', 'Today', 'today'],
  ['voyage', 'Voyage', 'voyage'],
  ['photos', 'Photos', 'photos'],
  ['dining', 'Dining', 'dining'],
  ['aboard', 'Aboard', 'aboard']
];

const viewEl = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
let current = { name: null, params: [], cleanup: null };

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, ...params] = h.split('/').filter(Boolean);
  return { name: name || 'today', params };
}

export function go(path) {
  if (location.hash === `#/${path}`) render();
  else location.hash = `#/${path}`;
}
window.go = go;

function guard(name) {
  if (!state.user) return name === 'login' ? 'login' : 'welcome';
  if (name === 'welcome' || name === 'login') return 'today';
  if ((name === 'host') && state.staff?.role !== 'host') return 'today';
  if (name === 'crew' && !isStaff()) return 'today';
  return name;
}

function renderTabs(active) {
  const view = routes[active];
  const show = state.user && view?.tab;
  tabbar.hidden = !show;
  document.body.classList.toggle('has-tabs', !!show);
  if (!show) return;
  tabbar.innerHTML = TABS.map(
    ([key, label, ic]) =>
      `<a href="#/${key}" class="tab${view.tab === key ? ' on' : ''}"${view.tab === key ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`
  ).join('');
}

export async function render() {
  let { name, params } = parseHash();
  const target = guard(routes[name] ? name : 'today');
  if (target !== name) {
    history.replaceState(null, '', `#/${target}`);
    name = target;
    params = [];
  }
  if (current.cleanup) {
    try {
      current.cleanup();
    } catch (e) {
      console.error(e);
    }
  }
  const view = routes[name];
  const sameView = current.name === name && current.params.join('/') === params.join('/');
  current = { name, params, cleanup: null };
  renderTabs(name);
  document.title = view.title ? `${view.title} · Delusha` : 'Delusha';
  try {
    const scroll = sameView ? window.scrollY : 0;
    current.cleanup = (await view.render(viewEl, params)) || null;
    window.scrollTo(0, scroll);
  } catch (e) {
    console.error(e);
    viewEl.innerHTML = `<div class="page pad-top"><div class="card"><h2>Something went wrong</h2><p class="muted">${esc(e.message)}</p><a class="btn" href="#/today">Back to Today</a></div></div>`;
  }
}

// Re-render the open screen when data it shows changes, unless someone is typing.
let rerenderTimer = null;
onChange((key) => {
  const view = routes[current.name];
  if (!view?.deps) return;
  const relevant = view.deps.includes(key) || (key === 'online' && view.deps.includes('online'));
  if (!relevant) return;
  const active = document.activeElement;
  if (active && viewEl.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;
  if (document.querySelector('.sheet.open')) return;
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(render, 120);
});

// In-app banner for alerts that arrive while the app is open.
onChange((key) => {
  if (!key.startsWith('newAlert:')) return;
  const id = key.slice(9);
  setTimeout(() => {
    const a = state.alerts.find((x) => x.id === id);
    if (a && a.created_by !== state.user?.id) toast(`${a.title}${a.body ? ' — ' + a.body : ''}`, 'alert');
  }, 700);
});

function offlineBadge() {
  const el = document.getElementById('offline');
  el.hidden = state.online;
}
onChange((k) => k === 'online' && offlineBadge());

async function boot() {
  offlineBadge();
  // Personal invite links look like .../?invite=TOKEN or #/join/TOKEN
  const url = new URL(location.href);
  const token = url.searchParams.get('invite') || (location.hash.match(/^#\/join\/([a-f0-9]+)/) || [])[1];
  if (token) {
    viewEl.innerHTML = '<div class="page center-page"><div class="spinner" aria-label="Loading"></div><p class="muted">Opening your invite…</p></div>';
    try {
      const { data } = await sb.auth.getSession();
      const signedInAsStaff = data.session && (await sb.from('staff').select('id').eq('user_id', data.session.user.id).maybeSingle()).data;
      if (!signedInAsStaff) {
        if (data.session) await sb.auth.signOut();
        await joinWithInvite(token);
      }
      history.replaceState(null, '', `${url.pathname}#/today`);
    } catch (e) {
      history.replaceState(null, '', `${url.pathname}#/welcome`);
      toast(e.message, 'error');
    }
  }

  await loadProfile();
  if (state.user) {
    await loadAll();
    startRealtime();
    processQueue();
    refreshPush();
    resumeSharingIfOn();
  }
  window.addEventListener('hashchange', render);
  await render();
}

sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    state.user = null;
    render();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'open' && e.data.url) location.hash = e.data.url.replace(/^\.?\/?/, '');
  });
}

// Refresh data when the app comes back to the foreground.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.user && state.trip) loadAll();
});

boot();
