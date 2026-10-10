// Cliente mínimo de Supabase por HTTP (sin librerías): inicio de sesión, tabla de documentos y almacén de vídeos.
// Solo "habla" con la nube; la lógica de qué subir y bajar está en sync.js.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const SESSION_KEY = 'dt-session';

export const cloudConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export class AuthError extends Error {}

// ---------- Sesión (se guarda en el navegador de cada dispositivo) ----------
function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function saveSession(s) {
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch { /* sin almacenamiento */ }
}
export const currentUser = () => loadSession()?.user || null;

function toSession(r) {
  return {
    access_token: r.access_token, refresh_token: r.refresh_token,
    expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600),
    user: { id: r.user.id, email: r.user.email }
  };
}

async function authRequest(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = json.error_description || json.msg || json.message || `Error ${res.status}`;
    throw new AuthError(/invalid login/i.test(raw) ? 'Correo o contraseña incorrectos.' : raw);
  }
  return json;
}

export async function signIn(email, password) {
  const s = toSession(await authRequest('token?grant_type=password', { email: email.trim(), password }));
  saveSession(s);
  return s.user;
}

export async function signOut() {
  const s = loadSession();
  saveSession(null);
  if (s) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access_token}` } });
    } catch { /* sin conexión: la sesión local ya está cerrada */ }
  }
}

let refreshing = null;
function refreshSession() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const s = loadSession();
    if (!s) throw new AuthError('Inicia sesión para sincronizar.');
    try {
      const n = toSession(await authRequest('token?grant_type=refresh_token', { refresh_token: s.refresh_token }));
      saveSession(n);
      return n;
    } catch (e) {
      if (e instanceof AuthError) saveSession(null); // el servidor la rechaza: hay que volver a entrar
      throw e;                                        // si solo falla la red, se mantiene la sesión
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function accessToken() {
  let s = loadSession();
  if (!s) throw new AuthError('Inicia sesión para sincronizar.');
  if (s.expires_at - 60 < Date.now() / 1000) s = await refreshSession();
  return s.access_token;
}

async function api(path, { method = 'GET', headers = {}, body, expect = 'json' } = {}, retried = false) {
  const token = await accessToken();
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method, body, headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, ...headers }
  });
  if (res.status === 401 && !retried) { await refreshSession(); return api(path, { method, headers, body, expect }, true); }
  if (res.status === 401) throw new AuthError('La sesión ha caducado. Vuelve a iniciar sesión.');
  if (!res.ok) {
    let msg = '';
    try { const j = await res.json(); msg = j.message || j.error || ''; } catch { /* sin cuerpo */ }
    const e = new Error(msg || `Error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  if (expect === 'blob') return res.blob();
  if (expect === 'none') return null;
  return res.json();
}

// ---------- Documentos (secciones, clips, notas) ----------
export async function upsertDocs(rows) {
  await api('/rest/v1/docs?on_conflict=user_id,kind,id', {
    method: 'POST', expect: 'none', body: JSON.stringify(rows),
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
}

// Pide los documentos cambiados DESPUÉS de "since" (hora del servidor), más antiguos primero.
export function fetchDocs(since, limit = 500) {
  const after = since ? `&synced_at=gt.${encodeURIComponent(since)}` : '';
  return api(`/rest/v1/docs?select=kind,id,data,deleted,updated_at,synced_at&order=synced_at.asc&limit=${limit}${after}`);
}

// ---------- Vídeos ----------
export async function uploadVideo(userId, clipId, blob) {
  await api(`/storage/v1/object/videos/${userId}/${clipId}`, {
    method: 'POST', expect: 'none', body: blob,
    headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true' }
  });
}

export async function downloadVideo(userId, clipId) {
  try {
    return await api(`/storage/v1/object/authenticated/videos/${userId}/${clipId}`, { expect: 'blob' });
  } catch (e) {
    if (e.status === 400 || e.status === 404) throw new Error('El vídeo todavía no está en la nube (el otro dispositivo aún no lo ha subido).');
    throw e;
  }
}

export async function deleteVideo(userId, clipId) {
  try { await api(`/storage/v1/object/videos/${userId}/${clipId}`, { method: 'DELETE', expect: 'none' }); }
  catch (e) { if (e.status !== 400 && e.status !== 404) throw e; } // si ya no existe, da igual
}
