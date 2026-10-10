// Formatos de números para mostrar: "12,4 MB", "0:07", "0:03.42".

export function formatBytes(n) {
  if (n == null || isNaN(n)) return '–';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  const txt = i === 0 ? String(Math.round(n)) : n.toFixed(n >= 100 ? 0 : 1).replace('.', ',');
  return `${txt} ${units[i]}`;
}

export function formatDuration(s) {
  if (!isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// Con centésimas, para el reproductor
export function formatTime(s) {
  if (!isFinite(s)) s = 0;
  const total = Math.floor(s * 100 + 1e-6); // el 1e-6 evita errores de redondeo (3,42 → 3,41)
  const m = Math.floor(total / 6000);
  const sec = Math.floor(total / 100) % 60;
  const cs = total % 100;
  return `${m}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
