// Secciones: tus "pestañas" (Braza, Salida braza, Viraje braza, Subacuático...).
// Tú las creas, renombras, reordenas y borras.
import { run, req, uid, getAll, getOne, putOne } from '../db.js';

export const DEFAULT_SWIMMER = 'yo';

// Puerta abierta al modo entrenador: cada sección y clip pertenece a un nadador.
export async function ensureSwimmer() {
  if (!(await getOne('swimmers', DEFAULT_SWIMMER))) {
    await putOne('swimmers', { id: DEFAULT_SWIMMER, name: 'Yo', createdAt: Date.now() });
  }
}

export function sortSections(list) { return [...list].sort((a, b) => a.order - b.order); }
export async function listSections() { return sortSections(await getAll('sections')); }

function cleanName(name, others = []) {
  const n = (name || '').trim();
  if (!n) throw new Error('Escribe un nombre para la sección.');
  if (n.length > 40) throw new Error('El nombre es demasiado largo (máximo 40 letras).');
  if (others.some((s) => s.name.toLowerCase() === n.toLowerCase())) throw new Error(`Ya existe una sección llamada "${n}".`);
  return n;
}

export async function createSection(name) {
  const all = await getAll('sections');
  const clean = cleanName(name, all);
  const order = all.length ? Math.max(...all.map((s) => s.order)) + 1 : 0;
  const section = { id: uid(), swimmerId: DEFAULT_SWIMMER, name: clean, order, createdAt: Date.now() };
  await putOne('sections', section);
  return section;
}

export async function renameSection(id, name) {
  const all = await getAll('sections');
  const section = all.find((s) => s.id === id);
  if (!section) throw new Error('La sección no existe.');
  section.name = cleanName(name, all.filter((s) => s.id !== id));
  await putOne('sections', section);
  return section;
}

// dir = -1 sube, +1 baja
export async function moveSection(id, dir) {
  const list = await listSections();
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const a = list[i], b = list[j];
  [a.order, b.order] = [b.order, a.order];
  await run(['sections'], 'readwrite', (s) => { s.put(a); s.put(b); });
}

export async function sectionCounts() {
  const secs = await getAll('sections');
  return run(['clips'], 'readonly', async (clips) => {
    const out = {};
    for (const s of secs) out[s.id] = await req(clips.index('sectionId').count(s.id));
    return out;
  });
}
export async function sectionClipCount(id) { return (await sectionCounts())[id] || 0; }

// Si la sección tiene vídeos hay que indicar a qué sección moverlos (moveToId).
// Todo ocurre en una sola transacción: o se hace entero o no se hace nada.
export async function deleteSection(id, moveToId = null) {
  await run(['sections', 'clips'], 'readwrite', async (sections, clips) => {
    const list = await req(clips.index('sectionId').getAll(id));
    if (list.length) {
      if (!moveToId || moveToId === id) throw new Error('La sección tiene vídeos: indica a qué sección moverlos.');
      for (const c of list) { c.sectionId = moveToId; clips.put(c); }
    }
    sections.delete(id);
  });
}
