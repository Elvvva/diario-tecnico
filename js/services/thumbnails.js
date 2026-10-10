// Analiza un vídeo en el navegador: duración, tamaño en píxeles y miniatura (con canvas).
// Si el navegador no puede abrirlo (p. ej. algunos HEVC/.mov) devuelve { ok:false }.

export function analyzeVideo(file, { timeoutMs = 10000, thumbWidth = 320 } = {}) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'metadata';
    v.setAttribute('playsinline', '');
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true; clearTimeout(timer);
      v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);
    v.onerror = () => finish({ ok: false, reason: 'error' });
    v.onloadedmetadata = () => {
      if (!isFinite(v.duration) || !v.videoWidth) return finish({ ok: false, reason: 'metadata' });
      v.currentTime = Math.min(Math.max(v.duration * 0.1, 0.05), Math.max(v.duration - 0.05, 0));
    };
    v.onseeked = () => {
      try {
        const w = thumbWidth, hgt = Math.round((w * v.videoHeight) / v.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = hgt;
        canvas.getContext('2d').drawImage(v, 0, 0, w, hgt);
        finish({
          ok: true, duration: v.duration, width: v.videoWidth, height: v.videoHeight,
          thumb: canvas.toDataURL('image/jpeg', 0.7)
        });
      } catch { finish({ ok: false, reason: 'canvas' }); }
    };
    v.src = url;
  });
}
