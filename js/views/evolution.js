// Evolución total: todos tus vídeos por temporada, con filtro por sección y plano.
// (En la Fase 2 se añadirá enviar dos vídeos al comparador desde aquí.)
import { h } from '../utils/dom.js';
import { listSections } from '../services/sections.js';
import { listClips, filterClips, groupBySeason } from '../services/clips.js';
import { clipCard } from '../components/clip-card.js';
import { chipPicker } from '../components/chip-picker.js';

export default async function evolutionView(_params, container) {
  const [sections, clips] = await Promise.all([listSections(), listClips()]);
  const names = Object.fromEntries(sections.map((s) => [s.id, s.name]));
  const planes = [...new Set(clips.map((c) => c.plane))];
  let sectionId = '', plane = '';
  const results = h('div', {});

  const draw = () => {
    const groups = groupBySeason(filterClips(clips, { sectionId, plane }));
    results.replaceChildren(...(groups.length ? groups.map((g) => h('div', {},
      h('h2', { class: 'season-title' }, `Temporada ${g.season} · ${g.clips.length}`),
      h('div', { class: 'grid' }, g.clips.map((c) => clipCard(c, names[c.sectionId]))))) :
      [h('div', { class: 'empty' }, clips.length ? 'No hay vídeos con esos filtros.' : 'Aún no has subido vídeos. Cuando lo hagas, aquí verás tu evolución completa.')]));
  };

  const filters = h('div', { class: 'filters' });
  if (clips.length) {
    filters.append(
      chipPicker({ options: [{ value: '', label: 'Todas las secciones' }, ...sections.map((s) => ({ value: s.id, label: s.name }))], value: '', onChange: (v) => { sectionId = v; draw(); } }).el,
      chipPicker({ options: [{ value: '', label: 'Todos los planos' }, ...planes.map((p) => ({ value: p, label: p }))], value: '', onChange: (v) => { plane = v; draw(); } }).el);
  }
  container.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Evolución total'), h('p', { class: 'muted' }, `${clips.length} vídeos en total, de la última temporada a la primera`))),
    filters, results));
  draw();
}
