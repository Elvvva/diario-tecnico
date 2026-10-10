// Clips: la ficha de cada vídeo (ligera) y su vídeo (Blob, en otra caja).
import { run, req, uid, getAll, getOne, queue } from '../db.js';
import { newNote } from './notes.js';
import { seasonOf } from '../utils/dates.js';
import { DEFAULT_SWIMMER } from './sections.js';

// ---------- Funciones puras (sin base de datos, fáciles de probar) ----------

export function filterClips(clips, { sectionId = '', plane = '' } = {}) {
  return clips.filter((c) => (!sectionId || c.sectionId === sectionId) && (!plane || c.plane === plane));
}
// Más nuevo primero; a igual fecha, el último subido primero.
export function sortClips(clips) {
  return [...clips].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}
// [{ season: '2025-2026', clips: [...] }, ...] con la temporada más reciente primero
export function groupBySeason(clips) {
  const map = new Map();
  for (const c of sortClips(clips)) {
    if (!map.has(c.season)) map.set(c.season, []);
    map.get(c.season).push(c);
  }
  return [...map].map(([season, list]) => ({ season, clips: list })).sort((a, b) => b.season.localeCompare(a.season));
}

// ---------- Con base de datos ----------

export async function listClips(filters = {}) {
  return sortClips(filterClips(await getAll('clips'), filters));
}
export const getClip = (id) => getOne('clips', id);
export async function getVideoBlob(id) { return (await getOne('videos', id))?.blob || null; }

export async function addClip({ file, sectionId, plane, date, mark = '', comment = '', duration = 0, thumb = null, width = 0, height = 0 }) {
  const id = uid();
  const ts = Date.now();
  const clip = {
    id, swimmerId: DEFAULT_SWIMMER, sectionId, plane, date, season: seasonOf(date),
    mark: mark.trim(), duration, width, height, size: file.size, mime: file.type, fileName: file.name,
    thumb, createdAt: ts, updatedAt: ts
  };
  await run(['clips', 'videos', 'notes', 'outbox'], 'readwrite', (clips, videos, notes, o) => {
    clips.put(clip);
    videos.put({ id, blob: file });
    queue(o, 'clip', id, 'put', ts);
    queue(o, 'video', id, 'put', ts);
    if (comment.trim()) {
      const n = newNote({ clipId: id, type: 'comentario', text: comment });
      notes.put(n); queue(o, 'note', n.id, 'put', n.updatedAt);
    }
  });
  return clip;
}

// Cambia sección, plano, fecha o marca. Si cambia la fecha, se recalcula la temporada.
export async function updateClip(id, patch) {
  return run(['clips', 'outbox'], 'readwrite', async (clips, o) => {
    const clip = await req(clips.get(id));
    if (!clip) throw new Error('El vídeo no existe.');
    for (const k of ['sectionId', 'plane', 'date', 'mark']) if (patch[k] !== undefined) clip[k] = patch[k];
    if (patch.date) clip.season = seasonOf(patch.date);
    clip.updatedAt = Date.now();
    clips.put(clip);
    queue(o, 'clip', id, 'put', clip.updatedAt);
    return clip;
  });
}

// Borra el clip, su vídeo, sus notas y las comparaciones donde aparezca (y lo anota para borrarlo en la nube).
export async function deleteClip(id) {
  await run(['clips', 'videos', 'notes', 'comparisons', 'outbox'], 'readwrite', async (clips, videos, notes, comparisons, o) => {
    const ts = Date.now();
    clips.delete(id); videos.delete(id);
    queue(o, 'clip', id, 'delete', ts); queue(o, 'video', id, 'delete', ts);
    for (const k of await req(notes.index('clipId').getAllKeys(id))) { notes.delete(k); queue(o, 'note', k, 'delete', ts); }
    for (const c of await req(comparisons.getAll())) {
      if (c.clipAId === id || c.clipBId === id) { comparisons.delete(c.id); queue(o, 'comparison', c.id, 'delete', ts); }
    }
  });
}
