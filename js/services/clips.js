// Clips: la ficha de cada vídeo (ligera) y su vídeo (Blob, en otra caja).
import { run, req, uid, getAll, getOne } from '../db.js';
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
  const clip = {
    id, swimmerId: DEFAULT_SWIMMER, sectionId, plane, date, season: seasonOf(date),
    mark: mark.trim(), duration, width, height, size: file.size, mime: file.type, fileName: file.name,
    thumb, createdAt: Date.now()
  };
  await run(['clips', 'videos', 'notes'], 'readwrite', (clips, videos, notes) => {
    clips.put(clip);
    videos.put({ id, blob: file });
    if (comment.trim()) notes.put(newNote({ clipId: id, type: 'comentario', text: comment }));
  });
  return clip;
}

// Cambia sección, plano, fecha o marca. Si cambia la fecha, se recalcula la temporada.
export async function updateClip(id, patch) {
  return run(['clips'], 'readwrite', async (clips) => {
    const clip = await req(clips.get(id));
    if (!clip) throw new Error('El vídeo no existe.');
    for (const k of ['sectionId', 'plane', 'date', 'mark']) if (patch[k] !== undefined) clip[k] = patch[k];
    if (patch.date) clip.season = seasonOf(patch.date);
    clips.put(clip);
    return clip;
  });
}

// Borra el clip, su vídeo, sus notas y las comparaciones donde aparezca.
export async function deleteClip(id) {
  await run(['clips', 'videos', 'notes', 'comparisons'], 'readwrite', async (clips, videos, notes, comparisons) => {
    clips.delete(id);
    videos.delete(id);
    for (const k of await req(notes.index('clipId').getAllKeys(id))) notes.delete(k);
    for (const c of await req(comparisons.getAll())) {
      if (c.clipAId === id || c.clipBId === id) comparisons.delete(c.id);
    }
  });
}
