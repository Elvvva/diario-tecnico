// Sincronización: local primero. Todo se guarda en el dispositivo y, si hay sesión, se sube/baja de la nube.
//
// Idea:
//  1) Cada cambio local se anota en la "bandeja de salida" (outbox) — ver db.js.
//  2) Sincronizar = BAJAR lo nuevo de la nube → SUBIR la bandeja de salida.
//  3) Si el mismo elemento cambió en dos dispositivos, gana el cambio más reciente (updatedAt).
//  4) Los borrados viajan como "lápidas" (deleted = true) para que los demás dispositivos también borren.
//  5) Los vídeos se suben al sincronizar y se bajan al abrir un clip que no está en ese dispositivo.
import { run, req, getAll, getOne, queue } from '../db.js';
import { getSetting, setSetting } from '../settings.js';
import { getVideoBlob } from './clips.js';
import { deleteSection } from './sections.js';
import * as cloud from './cloud.js';

export const KIND_STORE = { section: 'sections', clip: 'clips', note: 'notes', comparison: 'comparisons' };
const PAGE = 500;

// Regla de conflicto: se aplica lo de la nube solo si es más reciente que lo local.
export function shouldApplyRemote(remoteTs, localTs) { return remoteTs > localTs; }

// ---------- Estado visible en la interfaz ----------
let state = { status: 'idle', message: '', error: '', lastSyncAt: null };
let again = false, timer = null, running = null;
const emit = () => window.dispatchEvent(new CustomEvent('sync-state', { detail: { ...state } }));
const setState = (patch) => { state = { ...state, ...patch }; emit(); };
export const getSyncState = () => ({ ...state });
export const isLoggedIn = () => cloud.cloudConfigured() && Boolean(cloud.currentUser());
export async function pendingCount() { return (await getAll('outbox')).length; }
export async function loadLastSync() { state.lastSyncAt = await getSetting('syncLastAt', null); }

function friendly(e) {
  if (e instanceof cloud.AuthError) return e.message;
  if (e instanceof TypeError) return 'No hay conexión con el servidor.';
  return e.message || 'Error desconocido';
}

// ---------- Disparadores ----------
export function scheduleSync(delay = 4000) {
  if (!isLoggedIn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => { syncNow().catch(() => {}); }, delay);
}

export function syncNow() {
  if (!isLoggedIn()) return Promise.resolve(null);
  if (running) { again = true; return running; }
  running = doSync().finally(() => { running = null; if (again) { again = false; scheduleSync(500); } });
  return running;
}

async function doSync() {
  if (!navigator.onLine) { setState({ status: 'offline', message: '' }); return null; }
  setState({ status: 'syncing', message: 'Sincronizando…', error: '' });
  try {
    const user = cloud.currentUser();
    await enqueueAllIfNeeded(user.id);
    const applied = await pull();
    await mergeDuplicateSections();
    const pushed = await push(user.id, (message) => setState({ message }));
    const ts = Date.now();
    await setSetting('syncLastAt', ts);
    setState({ status: 'idle', message: '', lastSyncAt: ts });
    if (applied) window.dispatchEvent(new CustomEvent('data-synced', { detail: { applied } }));
    return { applied, pushed };
  } catch (e) {
    console.error(e);
    setState({ status: 'error', message: '', error: friendly(e) });
    throw e;
  }
}

// ---------- Primera vez con una cuenta: subir también lo que ya había en este dispositivo ----------
async function enqueueAllIfNeeded(userId) {
  if ((await getSetting('syncEnqueued', null)) === userId) return;
  await run(['sections', 'clips', 'notes', 'videos', 'outbox'], 'readwrite', async (sections, clips, notes, videos, o) => {
    const ts = Date.now();
    for (const [store, kind] of [[sections, 'section'], [clips, 'clip'], [notes, 'note']]) {
      for (const rec of await req(store.getAll())) {
        if (!rec.updatedAt) { rec.updatedAt = rec.createdAt || ts; store.put(rec); } // datos de la Fase 1
        if (!(await req(o.get(`${kind}:${rec.id}`)))) queue(o, kind, rec.id, 'put', rec.updatedAt);
      }
    }
    for (const k of await req(videos.getAllKeys())) {
      if (!(await req(o.get(`video:${k}`)))) queue(o, 'video', k, 'put', ts);
    }
  }, { silent: true });
  await setSetting('syncEnqueued', userId);
}

// ---------- Bajar ----------
export async function applyRemoteDoc(doc) {
  const store = KIND_STORE[doc.kind];
  if (!store) return false;
  return run([store, 'videos', 'outbox'], 'readwrite', async (s, v, o) => {
    const local = await req(s.get(doc.id));
    const pending = await req(o.get(`${doc.kind}:${doc.id}`));
    const localTs = Math.max(local?.updatedAt || 0, pending?.updatedAt || 0);
    if (!shouldApplyRemote(doc.updated_at, localTs)) return false;
    if (doc.deleted) { s.delete(doc.id); if (doc.kind === 'clip') v.delete(doc.id); }
    else s.put({ ...doc.data, updatedAt: doc.updated_at });
    if (pending) o.delete(pending.key);
    return true;
  }, { silent: true });
}

async function pull() {
  let since = await getSetting('syncLastPull', null);
  let applied = 0;
  for (;;) {
    const rows = await cloud.fetchDocs(since, PAGE);
    for (const r of rows) if (await applyRemoteDoc(r)) applied++;
    if (rows.length) { since = rows[rows.length - 1].synced_at; await setSetting('syncLastPull', since); }
    if (rows.length < PAGE) break;
  }
  return applied;
}

// Si dos dispositivos crearon por separado una sección con el mismo nombre, se unen en una
// (gana la más antigua, igual en todos los dispositivos) y los vídeos se mueven a ella.
export async function mergeDuplicateSections() {
  const secs = (await getAll('sections')).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const winners = new Map();
  let merged = 0;
  for (const s of secs) {
    const key = s.name.trim().toLowerCase();
    if (!winners.has(key)) { winners.set(key, s); continue; }
    await deleteSection(s.id, winners.get(key).id);
    merged++;
  }
  return merged;
}

// ---------- Subir ----------
async function clearEntry(e) {
  await run(['outbox'], 'readwrite', async (o) => {
    const cur = await req(o.get(e.key));
    if (cur && cur.updatedAt === e.updatedAt && cur.op === e.op) o.delete(e.key); // si cambió mientras subía, se queda
  }, { silent: true });
}

async function push(userId, report) {
  let n = 0;
  const entries = await getAll('outbox');
  const videos = entries.filter((e) => e.kind === 'video');
  const docs = entries.filter((e) => e.kind !== 'video');

  // Primero los vídeos, para que otro dispositivo no vea un clip sin su vídeo.
  for (const [i, e] of videos.entries()) {
    if (e.op === 'put') {
      const blob = await getVideoBlob(e.id);
      if (blob) { report(`Subiendo vídeo ${i + 1} de ${videos.length}…`); await cloud.uploadVideo(userId, e.id, blob); }
    } else await cloud.deleteVideo(userId, e.id);
    await clearEntry(e); n++;
  }

  for (let i = 0; i < docs.length; i += 50) {
    const batch = docs.slice(i, i + 50);
    const rows = [];
    for (const e of batch) {
      if (e.op === 'put') {
        const rec = await getOne(KIND_STORE[e.kind], e.id);
        if (!rec) continue; // ya no existe
        rows.push({ user_id: userId, kind: e.kind, id: e.id, data: rec, deleted: false, updated_at: rec.updatedAt || e.updatedAt });
      } else rows.push({ user_id: userId, kind: e.kind, id: e.id, data: {}, deleted: true, updated_at: e.updatedAt });
    }
    if (rows.length) { report('Subiendo cambios…'); await cloud.upsertDocs(rows); }
    for (const e of batch) await clearEntry(e);
    n += batch.length;
  }
  return n;
}

// ---------- Vídeo de un clip que no está en este dispositivo ----------
export async function ensureVideoLocal(clipId) {
  const local = await getVideoBlob(clipId);
  if (local) return local;
  const user = cloud.cloudConfigured() && cloud.currentUser();
  if (!user) return null;
  const blob = await cloud.downloadVideo(user.id, clipId);
  await run(['videos'], 'readwrite', (v) => { v.put({ id: clipId, blob }); }, { silent: true });
  return blob;
}
