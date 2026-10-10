// Un vídeo: reproductor + ficha editable + comentarios y mejoras.
import { h, icon, field } from '../utils/dom.js';
import { getClip, getVideoBlob, updateClip, deleteClip } from '../services/clips.js';
import { listSections } from '../services/sections.js';
import { listNotes, addNote, toggleNoteStatus, deleteNote } from '../services/notes.js';
import { getPlanes } from '../settings.js';
import { createPlayer } from '../components/player.js';
import { chipPicker } from '../components/chip-picker.js';
import { modal, confirmDialog, toast } from '../components/dialogs.js';
import { notifySectionsChanged } from '../components/section-actions.js';
import { formatDate, formatDateTime } from '../utils/dates.js';
import { formatBytes, formatDuration } from '../utils/format.js';
import { go, refresh } from '../router.js';

function editDialog(clip, sections, planes) {
  return modal((dlg, close) => {
    const planeList = [...new Set([...planes, clip.plane])];
    const sec = h('select', { value: clip.sectionId }, sections.map((s) => h('option', { value: s.id }, s.name)));
    const plane = h('select', { value: clip.plane }, planeList.map((p) => h('option', { value: p }, p)));
    const date = h('input', { type: 'date', value: clip.date });
    const mark = h('input', { type: 'text', value: clip.mark, maxlength: '60', placeholder: 'Ej. 1:02.3 en 100 braza' });
    dlg.append(h('h2', {}, 'Editar vídeo'),
      field('Sección', sec), field('Plano', plane), field('Fecha', date), field('Marca o resultado', mark),
      h('div', { class: 'dlg-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Cancelar'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => close({ sectionId: sec.value, plane: plane.value, date: date.value || clip.date, mark: mark.value.trim() }) }, 'Guardar')));
  });
}

export default async function clipView({ id }, container) {
  const clip = await getClip(id);
  if (!clip) {
    container.append(h('div', { class: 'page' }, h('p', {}, 'Este vídeo ya no existe.'), h('a', { class: 'btn', href: '#/' }, 'Volver')));
    return;
  }
  const [sections, planes, blob] = await Promise.all([listSections(), getPlanes(), getVideoBlob(id)]);
  const section = sections.find((s) => s.id === clip.sectionId);
  const player = blob ? createPlayer(blob) : null;

  // --- Notas ---
  let type = 'comentario';
  const typePicker = chipPicker({ options: [{ value: 'comentario', label: 'Comentario' }, { value: 'mejora', label: 'Mejora' }], value: type, onChange: (v) => { type = v; } });
  const text = h('textarea', { rows: '3', placeholder: 'Qué observas o qué quieres mejorar…' });
  const notesBox = h('div', {});

  const noteItem = (n) => h('div', { class: 'note' },
    h('div', { class: 'note-top' },
      h('span', { class: 'badge ' + (n.type === 'mejora' ? (n.status === 'conseguida' ? 'ok' : 'mejora') : '') }, n.type === 'mejora' ? `Mejora · ${n.status}` : 'Comentario'),
      h('span', { class: 'hint' }, formatDateTime(n.createdAt)),
      h('div', { class: 'note-actions' },
        n.type === 'mejora' ? h('button', { class: 'btn', type: 'button', onclick: async () => { await toggleNoteStatus(n.id); loadNotes(); } }, n.status === 'conseguida' ? 'Volver a pendiente' : 'Marcar conseguida') : null,
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': 'Borrar nota', onclick: async () => { await deleteNote(n.id); loadNotes(); } }, icon('trash', 16)))),
    h('div', { class: 'note-text' }, n.text));

  async function loadNotes() {
    const notes = await listNotes(id);
    notesBox.replaceChildren(...(notes.length ? notes.map(noteItem) : [h('p', { class: 'muted' }, 'Aún no hay notas.')]));
  }
  async function saveNote() {
    if (!text.value.trim()) { toast('Escribe algo primero'); return; }
    await addNote({ clipId: id, type, text: text.value });
    text.value = '';
    loadNotes();
  }

  // --- Acciones ---
  async function edit() {
    const patch = await editDialog(clip, sections, planes);
    if (!patch) return;
    await updateClip(id, patch);
    notifySectionsChanged();
    refresh();
  }
  async function remove() {
    const ok = await confirmDialog({ title: 'Borrar vídeo', message: 'Se borrará el vídeo con sus notas. No se puede deshacer.', okText: 'Borrar', danger: true });
    if (!ok) return;
    await deleteClip(id);
    notifySectionsChanged();
    toast('Vídeo borrado');
    go(section ? '/seccion/' + section.id : '/');
  }

  const facts = h('dl', { class: 'facts' },
    h('dt', {}, 'Sección'), h('dd', {}, section ? section.name : '—'),
    h('dt', {}, 'Plano'), h('dd', {}, clip.plane),
    h('dt', {}, 'Fecha'), h('dd', {}, formatDate(clip.date)),
    h('dt', {}, 'Temporada'), h('dd', {}, clip.season),
    clip.mark ? [h('dt', {}, 'Marca'), h('dd', {}, clip.mark)] : null,
    h('dt', {}, 'Duración'), h('dd', {}, formatDuration(clip.duration)),
    h('dt', {}, 'Tamaño'), h('dd', {}, formatBytes(clip.size)));

  container.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('a', { class: 'btn', href: section ? '#/seccion/' + section.id : '#/' }, icon('back', 18), section ? section.name : 'Volver'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: edit }, icon('edit', 18), 'Editar'),
        h('button', { class: 'btn', type: 'button', onclick: remove }, icon('trash', 18), 'Borrar'))),
    h('div', { class: 'clip-layout' },
      player ? player.el : h('div', { class: 'card' }, 'No se encontró el archivo de vídeo.'),
      h('div', { class: 'card' }, facts,
        h('h2', { style: 'margin-top:8px' }, 'Comentarios y mejoras'),
        typePicker.el, h('div', { style: 'height:10px' }), text,
        h('div', { style: 'margin:10px 0 6px' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: saveNote }, icon('plus', 18), 'Añadir nota')),
        notesBox))));
  loadNotes();
  return () => player && player.destroy();
}
