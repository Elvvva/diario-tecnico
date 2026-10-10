// Fechas como texto "AAAA-MM-DD" (así se ordenan bien y no hay líos de zonas horarias).

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayStr() { return toDateStr(new Date()); }

// Temporada: de septiembre a agosto. "2025-09-01" → "2025-2026"; "2026-01-10" → "2025-2026".
export function seasonOf(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function formatDateTime(ts) {
  return new Date(ts).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
