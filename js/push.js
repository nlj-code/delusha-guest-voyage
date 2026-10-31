// Phone notifications (Web Push). On iPhone this only works once the app is added to the home screen.
import { sb, state } from './store.js';
import { VAPID_PUBLIC_KEY } from './config.js';

export function pushSupport() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return { supported, ios, standalone, needsInstall: ios && !standalone, permission: supported ? Notification.permission : 'unsupported' };
}

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function isSubscribed() {
  if (!pushSupport().supported) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return !!sub && Notification.permission === 'granted';
}

export async function enablePush() {
  const s = pushSupport();
  if (s.needsInstall) throw new Error('On iPhone, first tap Share, then "Add to Home Screen", and open the app from there.');
  if (!s.supported) throw new Error('This browser cannot receive notifications.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them in your phone settings.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert({
    endpoint: j.endpoint,
    user_id: state.user.id,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth
  });
  if (error) throw error;
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}

// Re-save the subscription on start in case it was rotated by the browser.
export async function refreshPush() {
  try {
    if (state.user && (await isSubscribed())) await enablePush();
  } catch {
    /* ignore */
  }
}

// Ask the server to notify the right people. Failures never block the main action.
export async function notify(type, id) {
  try {
    await sb.functions.invoke('notify', { body: { type, id } });
  } catch {
    /* offline: the in-app list still shows it */
  }
}
