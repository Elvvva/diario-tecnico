// Arranque de la app: tema, menú (lateral en ordenador, cajón + barra inferior en móvil), rutas.
import { h, icon } from './utils/dom.js';
import { route, startRouter, go, parseHash } from './router.js';
import { applyTheme, getTheme, cycleTheme } from './settings.js';
import { ensureSwimmer, listSections, sectionCounts } from './services/sections.js';
import { getUsage } from './services/storage.js';
import { formatBytes } from './utils/format.js';
import { newSectionFlow } from './components/section-actions.js';
import welcome from './views/welcome.js';
import addView from './views/add.js';
import sectionView from './views/section.js';
import clipView from './views/clip.js';
import evolutionView from './views/evolution.js';
import compareView from './views/compare.js';

applyTheme(getTheme());

// Service worker (funciona en https y en localhost)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

route('/', async (p, c) => {
  const sections = await listSections();
  if (sections.length) { go('/seccion/' + sections[0].id, { replace: true }); return; }
  return welcome(p, c);
});
route('/anadir', addView);
route('/comparar', compareView);
route('/evolucion', evolutionView);
route('/seccion/:id', sectionView);
route('/clip/:id', clipView);

const sidebar = document.getElementById('sidebar');
const topbar = document.getElementById('topbar');
const tabbar = document.getElementById('tabbar');
const setDrawer = (open) => document.body.classList.toggle('drawer-open', open);
document.getElementById('scrim').addEventListener('click', () => setDrawer(false));

const THEME_TEXT = { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: oscuro' };
const THEME_ICON = { auto: 'auto', light: 'sun', dark: 'moon' };

function sideLink(path, ico, label, { primary = false, count } = {}) {
  return h('a', { class: 'side-link' + (primary ? ' primary' : ''), href: '#' + path, 'data-path': path },
    ico ? icon(ico, 20) : null, label, count != null ? h('span', { class: 'count' }, count) : null);
}

async function refreshNav() {
  const sections = await listSections();
  const counts = await sectionCounts();
  const theme = getTheme();
  const themeBtn = h('button', {
    class: 'side-link', type: 'button',
    onclick: () => { cycleTheme(); refreshNav(); }
  }, icon(THEME_ICON[theme], 20), THEME_TEXT[theme]);
  const usage = h('span', { class: 'hint' }, '');

  sidebar.replaceChildren(
    h('div', { class: 'brand' }, icon('wave', 26), 'Diario técnico'),
    h('nav', { class: 'side-nav' },
      sideLink('/anadir', 'plus', 'Añadir vídeo', { primary: true }),
      sideLink('/comparar', 'compare', 'Comparar'),
      sideLink('/evolucion', 'evolution', 'Evolución total')),
    h('div', { class: 'side-title' }, 'Mis secciones'),
    h('nav', { class: 'side-nav' }, sections.map((s) => sideLink('/seccion/' + s.id, null, s.name, { count: counts[s.id] || 0 }))),
    h('button', { class: 'side-link add', type: 'button', onclick: newSectionFlow }, icon('plus', 18), 'Nueva sección'),
    h('div', { class: 'side-foot' }, themeBtn, usage));

  getUsage().then((u) => {
    usage.textContent = u.supported ? `Espacio usado: ${formatBytes(u.usage)} de ${formatBytes(u.quota)}` : '';
  });
  markActive();
}

function buildBars() {
  topbar.replaceChildren(
    h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': 'Abrir menú', onclick: () => setDrawer(true) }, icon('menu', 22)),
    h('div', { class: 'title' }, icon('wave', 22), 'Diario técnico'));
  const tab = (path, ico, label) => h('a', { class: 'tab', href: '#' + path, 'data-path': path }, icon(ico, 24), label);
  tabbar.replaceChildren(
    tab('/anadir', 'plus', 'Añadir'),
    tab('/comparar', 'compare', 'Comparar'),
    tab('/evolucion', 'evolution', 'Evolución'),
    h('button', { class: 'tab', type: 'button', onclick: () => setDrawer(true) }, icon('sections', 24), 'Secciones'));
}

function markActive() {
  const { path } = parseHash();
  document.querySelectorAll('[data-path]').forEach((a) => a.classList.toggle('active', a.dataset.path === path));
}

document.addEventListener('sections-changed', refreshNav);
window.addEventListener('route-changed', () => { markActive(); setDrawer(false); });

(async function init() {
  const view = document.getElementById('view');
  try {
    await ensureSwimmer();
    buildBars();
    await refreshNav();
    startRouter(view);
  } catch (e) {
    console.error(e);
    view.replaceChildren(h('div', { class: 'page narrow' },
      h('h1', {}, 'No se pudo abrir el almacenamiento'),
      h('p', { class: 'muted' }, 'La app guarda tus vídeos en el navegador (IndexedDB). Si estás en modo privado o el navegador lo bloquea, ábrela en una ventana normal. Detalle: ' + e.message)));
  }
})();
