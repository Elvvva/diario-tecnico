// Reproductor: play/pausa, barra de progreso, velocidad 0,25x/0,5x/1x,
// fotograma a fotograma (atrás/adelante), bucle y pantalla completa.
//
// Sobre el fotograma a fotograma: el navegador no dice cuántos fps tiene el vídeo.
// Se estima al reproducir (requestVideoFrameCallback) y, si no se puede, se asume 30.
// Al saltar se apunta al CENTRO del fotograma para evitar redondeos del navegador.
import { h, icon } from '../utils/dom.js';
import { formatTime } from '../utils/format.js';

const COMMON_FPS = [24, 25, 30, 48, 50, 60, 100, 120, 240];
// Acerca una estimación a un valor habitual (29,97 → 30)
export function snapFps(f) {
  return COMMON_FPS.find((c) => Math.abs(c - f) / c < 0.03) || Math.round(f);
}

export function createPlayer(blob) {
  const url = URL.createObjectURL(blob);
  let fps = 30, fpsKnown = false, raf = 0, dragging = false;

  const video = h('video', { playsinline: '', preload: 'auto', src: url });
  const msg = h('div', { class: 'player-msg', hidden: true });
  const range = h('input', { type: 'range', min: '0', max: '1000', value: '0', class: 'seek', 'aria-label': 'Posición del vídeo' });
  const time = h('span', { class: 'time' }, '0:00.00 / 0:00.00');

  const btnPlay = h('button', { class: 'btn btn-primary big', type: 'button', 'aria-label': 'Reproducir o pausar', onclick: toggle });
  const btnBack = h('button', { class: 'btn big', type: 'button', 'aria-label': 'Fotograma anterior', onclick: () => step(-1) }, icon('stepBack', 24));
  const btnFwd = h('button', { class: 'btn big', type: 'button', 'aria-label': 'Fotograma siguiente', onclick: () => step(1) }, icon('stepFwd', 24));
  const btnLoop = h('button', { class: 'btn big', type: 'button', 'aria-label': 'Repetir en bucle', onclick: toggleLoop }, icon('loop', 24));
  const btnFs = h('button', { class: 'btn big', type: 'button', 'aria-label': 'Pantalla completa', onclick: fullscreen }, icon('fullscreen', 24));
  const speedBtns = [0.25, 0.5, 1].map((r) => h('button', {
    class: 'chip' + (r === 1 ? ' on' : ''), type: 'button', 'data-rate': r, onclick: () => setRate(r)
  }, String(r).replace('.', ',') + 'x'));

  const el = h('div', { class: 'player' },
    h('div', { class: 'stage' }, video, msg),
    h('div', { class: 'seekrow' }, range, time),
    h('div', { class: 'controls' }, btnBack, btnPlay, btnFwd, h('div', { class: 'speeds' }, speedBtns), btnLoop, btnFs));
  if (!el.requestFullscreen && !video.webkitEnterFullscreen) btnFs.hidden = true;
  syncPlayIcon();

  function toggle() { if (video.paused) video.play().catch(() => {}); else video.pause(); }
  function syncPlayIcon() { btnPlay.replaceChildren(icon(video.paused ? 'play' : 'pause', 28)); }
  function setRate(r) {
    video.playbackRate = r;
    speedBtns.forEach((b) => b.classList.toggle('on', Number(b.dataset.rate) === r));
  }
  function toggleLoop() { video.loop = !video.loop; btnLoop.classList.toggle('on', video.loop); }
  function fullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iPhone: pantalla completa nativa
  }
  function step(dir) {
    video.pause();
    const frame = Math.round(video.currentTime * fps) + dir;
    video.currentTime = Math.min(Math.max((frame + 0.5) / fps, 0), video.duration || 0);
  }
  function update() {
    if (!video.duration) return;
    if (!dragging) range.value = Math.round((video.currentTime / video.duration) * 1000);
    time.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)} · fotograma ${Math.round(video.currentTime * fps)}`;
  }
  function tick() { update(); if (!video.paused) raf = requestAnimationFrame(tick); }

  // Estima los fps midiendo el tiempo entre fotogramas mostrados
  function estimateFps() {
    if (fpsKnown || !('requestVideoFrameCallback' in video)) return;
    const times = [];
    const cb = (_now, meta) => {
      times.push(meta.mediaTime);
      if (times.length < 14 && !video.paused) video.requestVideoFrameCallback(cb); else finish();
    };
    const finish = () => {
      const d = [];
      for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > 0) d.push(times[i] - times[i - 1]);
      if (d.length >= 5) {
        d.sort((a, b) => a - b);
        const f = 1 / d[d.length >> 1];
        if (f >= 10 && f <= 240) { fps = snapFps(f); fpsKnown = true; update(); }
      }
    };
    video.requestVideoFrameCallback(cb);
  }

  range.addEventListener('pointerdown', () => { dragging = true; });
  range.addEventListener('pointerup', () => { dragging = false; });
  range.addEventListener('input', () => { video.currentTime = (range.value / 1000) * (video.duration || 0); update(); });
  video.addEventListener('play', () => { syncPlayIcon(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
  video.addEventListener('playing', estimateFps);
  video.addEventListener('pause', syncPlayIcon);
  video.addEventListener('ended', syncPlayIcon);
  ['timeupdate', 'seeked', 'loadedmetadata'].forEach((ev) => video.addEventListener(ev, update));
  video.addEventListener('error', () => {
    msg.hidden = false;
    msg.textContent = 'Este navegador no puede reproducir este vídeo (suele pasar con HEVC/.mov). Conviértelo a MP4 H.264 y vuelve a subirlo.';
  });

  return {
    el, video, getFps: () => fps,
    destroy() {
      cancelAnimationFrame(raf);
      video.pause(); video.removeAttribute('src'); video.load();
      URL.revokeObjectURL(url);
    }
  };
}
