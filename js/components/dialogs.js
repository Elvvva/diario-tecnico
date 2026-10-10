// Diálogos (confirmar, avisar, pedir texto, elegir) y avisos breves.
import { h, field } from '../utils/dom.js';

// Base: abre un <dialog>, deja que "build" lo rellene y devuelve una promesa con el resultado.
export function modal(build) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dlg' });
    const close = (value = null) => { dlg.close(); dlg.remove(); resolve(value); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); }); // tecla Esc
    build(dlg, close);
    document.body.append(dlg);
    dlg.showModal();
  });
}

const actions = (...buttons) => h('div', { class: 'dlg-actions' }, buttons);
const btn = (text, cls, onclick) => h('button', { class: `btn ${cls}`, type: 'button', onclick }, text);

export async function confirmDialog({ title, message, okText = 'Aceptar', cancelText = 'Cancelar', danger = false }) {
  const r = await modal((dlg, close) => dlg.append(
    h('h2', {}, title), h('p', {}, message),
    actions(btn(cancelText, '', () => close(false)), btn(okText, danger ? 'btn-danger' : 'btn-primary', () => close(true)))
  ));
  return r === true;
}

export function alertDialog({ title, message, okText = 'Entendido' }) {
  return modal((dlg, close) => dlg.append(
    h('h2', {}, title), h('p', {}, message), actions(btn(okText, 'btn-primary', () => close(true)))
  ));
}

// Devuelve el texto escrito, o null si se cancela.
export function promptDialog({ title, label, value = '', placeholder = '' }) {
  return modal((dlg, close) => {
    const input = h('input', { type: 'text', value, placeholder, maxlength: '40' });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); close(input.value); } });
    dlg.append(h('h2', {}, title), field(label, input),
      actions(btn('Cancelar', '', () => close(null)), btn('Aceptar', 'btn-primary', () => close(input.value))));
    setTimeout(() => input.focus(), 50);
  });
}

// Devuelve el valor elegido, o null si se cancela.
export function choiceDialog({ title, message, label = 'Elegir', options, okText = 'Aceptar', danger = false }) {
  return modal((dlg, close) => {
    const sel = h('select', { value: options[0].value }, options.map((o) => h('option', { value: o.value }, o.label)));
    dlg.append(h('h2', {}, title), h('p', {}, message), field(label, sel),
      actions(btn('Cancelar', '', () => close(null)), btn(okText, danger ? 'btn-danger' : 'btn-primary', () => close(sel.value))));
  });
}

export function toast(message) {
  const t = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 2400);
  setTimeout(() => t.remove(), 2800);
}
