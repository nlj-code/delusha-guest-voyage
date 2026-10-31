// Steps that run after someone signs in or switches trip.
import { loadProfile, loadAll, startRealtime, setTrip, state } from './store.js';
import { processQueue } from './uploads.js';
import { refreshPush } from './push.js';
import { resumeSharingIfOn, stopSharing } from './position.js';

export async function afterSignIn() {
  await loadProfile();
  await loadAll();
  startRealtime();
  processQueue();
  refreshPush();
  resumeSharingIfOn();
}

export async function switchTrip(id) {
  stopSharing(false);
  setTrip(id);
  await loadProfile();
  await loadAll();
  startRealtime();
  resumeSharingIfOn();
  return state.trip;
}
