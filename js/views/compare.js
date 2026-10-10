// Comparador: se construye en la Fase 2 (dos vídeos a la vez, sincronizados, con ajuste de desfase).
import { h } from '../utils/dom.js';

export default async function compareView(_params, container) {
  container.append(h('div', { class: 'page narrow' },
    h('h1', {}, 'Comparar'),
    h('div', { class: 'card' },
      h('p', {}, h('strong', {}, 'Llega en la Fase 2.')),
      h('p', { class: 'muted' }, 'Aquí verás el último vídeo junto al anterior de la misma sección y plano, con reproducción sincronizada y ajuste de desfase. Mientras tanto, abre cualquier vídeo para verlo con velocidad y fotograma a fotograma.'))));
}
