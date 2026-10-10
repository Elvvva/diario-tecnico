// Primera vez (sin secciones): elegir un punto de partida. Todo se puede cambiar después.
import { h } from '../utils/dom.js';
import { createSection } from '../services/sections.js';
import { newSectionFlow, notifySectionsChanged } from '../components/section-actions.js';
import { go } from '../router.js';

const PRESETS = [
  { name: 'Solo braza', items: ['Braza', 'Salida braza', 'Viraje braza', 'Subacuático braza'] },
  { name: 'Los cuatro estilos', items: ['Mariposa', 'Espalda', 'Braza', 'Crol', 'Subacuático'] }
];

export default async function welcome(_params, container) {
  container.append(h('div', { class: 'page narrow' },
    h('h1', {}, 'Bienvenido a Diario técnico'),
    h('p', { class: 'muted' }, 'Empieza eligiendo tus secciones. Luego puedes renombrarlas, reordenarlas, añadir más o borrarlas cuando quieras.'),
    PRESETS.map((pr) => h('button', {
      class: 'card preset', type: 'button',
      onclick: async () => {
        let first = null;
        for (const name of pr.items) { const s = await createSection(name); first = first || s; }
        notifySectionsChanged();
        go('/seccion/' + first.id);
      }
    }, h('strong', {}, pr.name), h('span', { class: 'muted' }, pr.items.join(' · ')))),
    h('button', { class: 'card preset', type: 'button', onclick: newSectionFlow },
      h('strong', {}, 'Empezar vacío'), h('span', { class: 'muted' }, 'Crearás tus propias secciones una a una'))));
}
