import { signIn, claimStaffAccount } from '../store.js';
import { afterSignIn } from '../session.js';
import { toast } from '../util.js';
import { backLink, busy } from './ui.js';

export default {
  title: 'Sign in',
  async render(el) {
    let mode = 'signin';
    const draw = () => {
      el.innerHTML = `
        <div class="page">
          ${backLink('#/welcome', 'Back')}
          <div class="wrap">
            <h1 class="h1 mt8">${mode === 'signin' ? 'Host and crew' : 'Set your password'}</h1>
            <p class="muted mt8">${
              mode === 'signin'
                ? 'Sign in with the email a host added you with.'
                : 'First time? Use the email a host added you with and choose a password (at least 8 characters).'
            }</p>
            <form class="card mt16" id="f" novalidate>
              <label class="lbl" for="em" style="margin-top:0">Email</label>
              <input class="field" id="em" type="email" autocomplete="email" inputmode="email" required>
              <label class="lbl" for="pw">Password</label>
              <input class="field" id="pw" type="password" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" minlength="8" required>
              ${mode === 'claim' ? '<label class="lbl" for="pw2">Repeat password</label><input class="field" id="pw2" type="password" autocomplete="new-password" required>' : ''}
              <p class="small" id="err" role="alert" style="color:var(--danger);min-height:20px;margin-top:10px"></p>
              <button class="btn block lg" type="submit" id="go">${mode === 'signin' ? 'Sign in' : 'Create my account'}</button>
            </form>
            <button class="btn light block mt12" id="sw" type="button">${mode === 'signin' ? 'First time? Set your password' : 'I already have a password'}</button>
          </div>
        </div>`;
      el.querySelector('#sw').onclick = () => {
        mode = mode === 'signin' ? 'claim' : 'signin';
        draw();
      };
      el.querySelector('#f').onsubmit = async (e) => {
        e.preventDefault();
        const em = el.querySelector('#em').value.trim();
        const pw = el.querySelector('#pw').value;
        const err = el.querySelector('#err');
        err.textContent = '';
        if (!/^\S+@\S+\.\S+$/.test(em)) return (err.textContent = 'Enter a valid email.');
        if (pw.length < 8) return (err.textContent = 'Passwords need at least 8 characters.');
        if (mode === 'claim' && pw !== el.querySelector('#pw2').value) return (err.textContent = "The passwords don't match.");
        const btn = el.querySelector('#go');
        busy(btn, true, 'Please wait…');
        try {
          if (mode === 'signin') await signIn(em, pw);
          else await claimStaffAccount(em, pw);
          await afterSignIn();
          toast('Signed in');
          location.hash = '#/today';
        } catch (x) {
          err.textContent = x.message || 'Could not sign in.';
          busy(btn, false);
        }
      };
    };
    draw();
  }
};
