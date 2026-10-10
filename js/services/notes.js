// Notas: "comentario" (lo que observas) o "mejora" (algo que trabajar, pendiente/conseguida).
import { uid, putOne, removeOne, getOne, getByIndex } from '../db.js';

// Una nota pertenece a un clip (clipId) o, en la Fase 3, a una comparación (comparisonId).
export function newNote({ clipId = null, comparisonId = null, type, text }) {
  return {
    id: uid(), clipId, comparisonId, type,
    status: type === 'mejora' ? 'pendiente' : null,
    text: text.trim(), tags: [], createdAt: Date.now()
  };
}
export async function addNote(data) {
  const n = newNote(data);
  await putOne('notes', n);
  return n;
}
export async function listNotes(clipId) {
  return (await getByIndex('notes', 'clipId', clipId)).sort((a, b) => b.createdAt - a.createdAt);
}
export async function toggleNoteStatus(id) {
  const n = await getOne('notes', id);
  if (!n || n.type !== 'mejora') return null;
  n.status = n.status === 'conseguida' ? 'pendiente' : 'conseguida';
  await putOne('notes', n);
  return n;
}
export async function deleteNote(id) { await removeOne('notes', id); }
