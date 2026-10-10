// Selector de una opción con botones grandes (chips). Sirve para formularios y filtros.
// const p = chipPicker({ options:[{value,label}], value, onChange }); p.el → elemento; p.value → elegido
import { h } from '../utils/dom.js';

export function chipPicker({ options, value, onChange }) {
  let current = value;
  const el = h('div', { class: 'chips', role: 'radiogroup' });
  const render = () => {
    el.replaceChildren(...options.map((o) => h('button', {
      type: 'button', class: 'chip' + (o.value === current ? ' on' : ''),
      role: 'radio', 'aria-checked': String(o.value === current),
      onclick: () => { current = o.value; render(); if (onChange) onChange(current); }
    }, o.label)));
  };
  render();
  return { el, get value() { return current; }, set(v) { current = v; render(); } };
}
