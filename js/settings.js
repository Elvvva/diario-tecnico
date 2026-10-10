// Ajustes sencillos: tema (claro/oscuro/automático) y preferencias guardadas.
import { getOne, putOne } from './db.js';

// Planos por defecto. En la Fase 3 podrás editar esta lista desde Ajustes.
export const DEFAULT_PLANES = [
  'Lateral exterior', 'Frontal exterior', 'Lateral subacuático', 'Frontal subacuático', 'Aéreo', 'Otro'
];

export async function getSetting(key, fallback) {
  const r = await getOne('settings', key);
  return r ? r.value : fallback;
}
export async function setSetting(key, value) { await putOne('settings', { key, value }); }
export async function getPlanes() { return getSetting('planes', DEFAULT_PLANES); }

// El tema va en localStorage (no en IndexedDB) para poder aplicarlo antes de pintar la página.
export function getTheme() {
  try { return localStorage.getItem('dt-theme') || 'auto'; } catch { return 'auto'; }
}
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme; else delete root.dataset.theme;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#071a20' : '#0891b2');
}
export function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(getTheme()) + 1) % order.length];
  try { localStorage.setItem('dt-theme', next); } catch { /* sin almacenamiento */ }
  applyTheme(next);
  return next;
}
