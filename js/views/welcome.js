import { HERO } from './ui.js';

export default {
  title: 'Welcome',
  async render(el) {
    el.innerHTML = `
      <div class="hero" style="height:100vh;min-height:560px">
        <img src="${HERO}" alt="SY Delusha under sail beside a rocky headland at sunset">
        <div class="scrim"></div>
        <div class="top"><div class="wordmark">DELUSHA</div></div>
        <div class="bottom" style="bottom:calc(40px + env(safe-area-inset-bottom,0px))">
          <h1>Welcome aboard</h1>
          <p style="opacity:.9;font-size:15px;max-width:340px">Open the personal link your host sent you to see your trip, the plan for the day, menus and shared photos.</p>
          <a class="btn light block lg mt24" href="#/login">Host or crew sign in</a>
        </div>
      </div>`;
  }
};
