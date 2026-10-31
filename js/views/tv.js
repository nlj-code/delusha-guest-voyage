// Saloon TV slideshow: cycles through the trip's photos and videos, with a route slide.
import { state, currentStopIndex } from '../store.js';
import { icon, dayLabel } from '../util.js';
import { signedUrls } from '../uploads.js';
import { VoyageChart } from '../map.js';

const PHOTO_MS = 6000;

export default {
  title: 'Saloon TV',
  deps: [],
  async render(el) {
    const items = state.media.filter((m) => m.on_tv !== false).slice(0, 300);
    const slides = [{ kind: 'route' }, ...items];
    let i = 0;
    let playing = true;
    let timer = null;
    let chart = null;

    el.innerHTML = `
      <div class="tv" id="tv">
        <div class="slide" id="a"></div>
        <div class="slide" id="b"></div>
        <div class="brand">DELUSHA</div>
        <div class="caption" id="cap"></div>
        <div class="controls">
          <button class="icon-btn glass" id="prev" aria-label="Previous">${icon('prev', 20)}</button>
          <button class="icon-btn glass" id="pp" aria-label="Pause">${icon('pause', 20)}</button>
          <button class="icon-btn glass" id="next" aria-label="Next">${icon('next', 20)}</button>
          <button class="icon-btn glass" id="fs" aria-label="Full screen">${icon('fit', 20)}</button>
          <a class="icon-btn glass" href="#/photos" aria-label="Exit">${icon('close', 20)}</a>
        </div>
      </div>`;
    const tv = el.querySelector('#tv');
    const layers = [el.querySelector('#a'), el.querySelector('#b')];
    let front = 0;

    const urls = await signedUrls(items.map((m) => m.path), 4 * 3600);

    const schedule = (ms) => {
      clearTimeout(timer);
      if (playing) timer = setTimeout(() => show(i + 1), ms);
    };

    function show(n) {
      i = (n + slides.length) % slides.length;
      const s = slides[i];
      const back = layers[1 - front];
      if (chart) {
        chart.destroy();
        chart = null;
      }
      back.innerHTML = '';
      const cap = el.querySelector('#cap');
      if (s.kind === 'route') {
        const box = document.createElement('div');
        box.style.cssText = 'position:absolute;inset:0';
        back.appendChild(box);
        chart = new VoyageChart(box);
        chart.setData({ stops: state.stops, activeIdx: currentStopIndex(), corinth: state.trip?.allow_corinth, pins: [], boat: state.position ? { lat: state.position.lat, lon: state.position.lon, heading: NaN } : null });
        cap.textContent = state.trip?.title || '';
        schedule(PHOTO_MS * 1.5);
      } else if (s.kind === 'video') {
        const v = document.createElement('video');
        v.src = urls[s.path] || '';
        v.muted = true;
        v.autoplay = true;
        v.playsInline = true;
        v.onended = () => playing && show(i + 1);
        v.onerror = () => schedule(1000);
        back.appendChild(v);
        cap.textContent = [s.uploader_name, dayLabel(s.created_at)].filter(Boolean).join(' · ');
        clearTimeout(timer);
        if (playing) timer = setTimeout(() => show(i + 1), Math.min(60, (s.duration_s || 20) + 2) * 1000);
      } else {
        const img = document.createElement('img');
        img.src = urls[s.path] || '';
        img.alt = '';
        back.appendChild(img);
        cap.textContent = [s.uploader_name, dayLabel(s.created_at)].filter(Boolean).join(' · ');
        schedule(PHOTO_MS);
      }
      back.classList.add('on');
      layers[front].classList.remove('on');
      front = 1 - front;
    }

    el.querySelector('#prev').onclick = () => show(i - 1);
    el.querySelector('#next').onclick = () => show(i + 1);
    el.querySelector('#pp').onclick = (e) => {
      playing = !playing;
      e.currentTarget.innerHTML = icon(playing ? 'pause' : 'play', 20);
      e.currentTarget.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      if (playing) show(i + 1);
      else clearTimeout(timer);
    };
    el.querySelector('#fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : tv.requestFullscreen?.().catch(() => {}));
    let hideT = null;
    const wake = () => {
      tv.classList.add('show-controls');
      clearTimeout(hideT);
      hideT = setTimeout(() => tv.classList.remove('show-controls'), 3000);
    };
    tv.addEventListener('pointermove', wake);
    tv.addEventListener('pointerdown', wake);
    const onKey = (e) => {
      if (e.key === 'ArrowRight') show(i + 1);
      if (e.key === 'ArrowLeft') show(i - 1);
      if (e.key === 'Escape') location.hash = '#/photos';
    };
    document.addEventListener('keydown', onKey);
    let lock = null;
    try {
      lock = await navigator.wakeLock?.request('screen');
    } catch {
      lock = null;
    }
    show(0);
    wake();

    return () => {
      clearTimeout(timer);
      clearTimeout(hideT);
      document.removeEventListener('keydown', onKey);
      chart?.destroy();
      lock?.release?.().catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }
};
