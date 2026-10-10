// Una sección con sus vídeos (del más nuevo al más antiguo) y filtro por plano.
import { h, icon } from '../utils/dom.js';
import { listSections, moveSection } from '../services/sections.js';
import { listClips, filterClips } from '../services/clips.js';
import { clipCard } from '../components/clip-card.js';
import { chipPicker } from '../components/chip-picker.js';
import { renameFlow, deleteFlow, notifySectionsChanged } from '../components/section-actions.js';
import { go, refresh } from '../router.js';

const iconBtn = (name, label, onclick, disabled = false) =>
  h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': label, title: label, disabled, onclick }, icon(name, 20));

export default async function sectionView({ id }, container) {
  const sections = await listSections();
  const section = sections.find((s) => s.id === id);
  if (!section) {
    container.append(h('div', { class: 'page' }, h('p', {}, 'Esta sección ya no existe.'), h('a', { class: 'btn', href: '#/' }, 'Volver')));
    return;
  }
  const index = sections.indexOf(section);
  const clips = await listClips({ sectionId: id });
  const planes = [...new Set(clips.map((c) => c.plane))];
  let plane = '';

  const grid = h('div', { class: 'grid' });
  const filters = h('div', { class: 'filters' });
  const draw = () => {
    const list = filterClips(clips, { plane });
    grid.replaceChildren(...(list.length ? list.map((c) => clipCard(c)) : [
      h('div', { class: 'empty' },
        h('p', {}, clips.length ? 'No hay vídeos con ese plano.' : 'Todavía no hay vídeos en esta sección.'),
        clips.length ? null : h('a', { class: 'btn btn-primary', href: `#/anadir?seccion=${id}` }, icon('plus', 18), 'Añadir el primero'))
    ]));
  };
  if (planes.length > 1) {
    filters.append(chipPicker({
      options: [{ value: '', label: 'Todos' }, ...planes.map((p) => ({ value: p, label: p }))],
      value: '', onChange: (v) => { plane = v; draw(); }
    }).el);
  }

  const reorder = async (dir) => { await moveSection(id, dir); notifySectionsChanged(); refresh(); };

  container.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, section.name),
        h('p', { class: 'muted' }, `${clips.length} ${clips.length === 1 ? 'vídeo' : 'vídeos'}`)),
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn-primary', href: `#/anadir?seccion=${id}` }, icon('plus', 18), 'Añadir vídeo'),
        iconBtn('edit', 'Renombrar sección', async () => { if (await renameFlow(section)) refresh(); }),
        iconBtn('up', 'Subir en el menú', () => reorder(-1), index === 0),
        iconBtn('down', 'Bajar en el menú', () => reorder(1), index === sections.length - 1),
        iconBtn('trash', 'Borrar sección', async () => { if (await deleteFlow(section)) go('/'); }))),
    filters, grid));
  draw();
}
