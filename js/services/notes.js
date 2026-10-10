// Notas: "comentario" (lo que observas) o "mejora" (algo que trabajar, pendiente/conseguida).
import { uid, run, req, getOne, getByIndex, queue } from '../db.js';

// Una nota pertenece a un clip (clipId) o, más adelante, a una comparación (comparisonId).
export function newNote({ clipId = null, comparisonId = null, type, text }) {
  const ts = Date.now();
  return {
    id: uid(), clipId, comparisonId, type,
    status: type === 'mejora' ? 'pendiente' : null,
    text: text.trim(), tags: [], createdAt: ts, updatedAt: ts
  };
}
export async function addNote(data) {
  const n = newNote(data);
  await run(['notes', 'outbox'], 'readwrite', (notes, o) => { notes.put(n); queue(o, 'note', n.id, 'put', n.updatedAt); });
  return n;
}
export async function listNotes(clipId) {
  return (await getByIndex('notes', 'clipId', clipId)).sort((a, b) => b.createdAt - a.createdAt);
}
export async function toggleNoteStatus(id) {
  return run(['notes', 'outbox'], 'readwrite', async (notes, o) => {
    const n = await req(notes.get(id));
    if (!n || n.type !== 'mejora') return null;
    n.status = n.status === 'conseguida' ? 'pendiente' : 'conseguida';
    n.updatedAt = Date.now();
    notes.put(n); queue(o, 'note', id, 'put', n.updatedAt);
    return n;
  });
}
export async function deleteNote(id) {
  await run(['notes', 'outbox'], 'readwrite', (notes, o) => { notes.delete(id); queue(o, 'note', id, 'delete'); });
}
export { getOne };
