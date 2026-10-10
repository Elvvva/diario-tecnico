// Tarjeta de un clip (miniatura + fecha + etiquetas) para las cuadrículas.
import { h, icon } from '../utils/dom.js';
import { formatDate } from '../utils/dates.js';
import { formatDuration } from '../utils/format.js';

export function clipCard(clip, sectionName = '') {
  return h('a', { class: 'clip-card', href: `#/clip/${clip.id}` },
    h('div', { class: 'thumb' },
      clip.thumb ? h('img', { src: clip.thumb, alt: '', loading: 'lazy' }) : icon('video', 32),
      h('span', { class: 'dur' }, formatDuration(clip.duration))),
    h('div', { class: 'meta' },
      h('strong', {}, formatDate(clip.date)),
      h('span', { class: 'sub' }, [sectionName, clip.plane].filter(Boolean).join(' · ')),
      clip.mark ? h('span', { class: 'mark' }, clip.mark) : null));
}
