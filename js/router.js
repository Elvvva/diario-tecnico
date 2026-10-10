// Router: cambia de pantalla según la dirección (#/seccion/abc, #/anadir, ...).
import { h } from './utils/dom.js';

const routes = [];
let cleanup = null;
let container = null;
let token = 0;

// route('/clip/:id', handler) — handler(params, container, query) puede devolver una función de limpieza
export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ re, keys, handler });
}

export function go(path, { replace = false } = {}) {
  if (replace) location.replace('#' + path); else location.hash = path;
}
export function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}
export function refresh() { render(); }

async function render() {
  const my = ++token;
  const { path, query } = parseHash();
  if (cleanup) { try { cleanup(); } catch { /* nada */ } cleanup = null; }
  container.replaceChildren();
  const found = routes.find((r) => r.re.test(path));
  if (!found) { go('/', { replace: true }); return; }
  const m = path.match(found.re);
  const params = {};
  found.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
  try {
    const c = await found.handler(params, container, query);
    if (my !== token) { if (typeof c === 'function') c(); return; } // el usuario ya se fue a otra pantalla
    cleanup = typeof c === 'function' ? c : null;
  } catch (e) {
    console.error(e);
    container.replaceChildren(h('div', { class: 'page' }, h('p', {}, 'Algo ha fallado: ' + e.message)));
  }
  window.scrollTo(0, 0);
  window.dispatchEvent(new CustomEvent('route-changed', { detail: { path } }));
}

export function startRouter(el) {
  container = el;
  window.addEventListener('hashchange', render);
  render();
}
