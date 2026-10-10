// Añadir vídeos: elegir archivos → sección + plano (+ fecha, marca, nota) → guardar. Objetivo: < 30 s.
import { h, icon, field } from '../utils/dom.js';
import { listSections } from '../services/sections.js';
import { addClip } from '../services/clips.js';
import { analyzeVideo } from '../services/thumbnails.js';
import { getUsage, assessSpace, requestPersistence } from '../services/storage.js';
import { getPlanes, getSetting, setSetting } from '../settings.js';
import { chipPicker } from '../components/chip-picker.js';
import { confirmDialog, alertDialog, toast } from '../components/dialogs.js';
import { notifySectionsChanged, newSectionFlow } from '../components/section-actions.js';
import { todayStr, toDateStr } from '../utils/dates.js';
import { formatBytes } from '../utils/format.js';
import { go } from '../router.js';

export default async function addView(_params, container, query) {
  const sections = await listSections();
  if (!sections.length) {
    container.append(h('div', { class: 'page narrow' }, h('h1', {}, 'Añadir vídeo'),
      h('p', { class: 'muted' }, 'Primero crea una sección (por ejemplo "Braza").'),
      h('button', { class: 'btn btn-primary big', type: 'button', onclick: newSectionFlow }, 'Nueva sección')));
    return;
  }
  const planes = await getPlanes();
  const lastSection = await getSetting('lastSectionId');
  const lastPlane = await getSetting('lastPlane');
  const startSection = [query.seccion, lastSection].find((id) => sections.some((s) => s.id === id)) || sections[0].id;
  const startPlane = planes.includes(lastPlane) ? lastPlane : planes[0];

  let files = [];
  const secPicker = chipPicker({ options: sections.map((s) => ({ value: s.id, label: s.name })), value: startSection });
  const planePicker = chipPicker({ options: planes.map((p) => ({ value: p, label: p })), value: startPlane });
  const dateInput = h('input', { type: 'date', value: todayStr(), max: todayStr() });
  const markInput = h('input', { type: 'text', placeholder: 'Ej. 1:02.3 en 100 braza', maxlength: '60' });
  const noteInput = h('textarea', { rows: '3', placeholder: 'Qué ves o qué quieres mejorar (se añade a cada vídeo)' });
  const status = h('p', { class: 'hint' }, '');
  const fileList = h('ul', { class: 'filelist' });
  const fileDateBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick: () => {
    if (files[0]) dateInput.value = toDateStr(new Date(files[0].lastModified));
  } }, 'Usar la fecha del archivo');
  const saveBtn = h('button', { class: 'btn btn-primary big', type: 'button', onclick: save }, icon('check', 22), 'Guardar');

  const setFiles = (list) => {
    files = list.filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(f.name));
    fileList.replaceChildren(...files.map((f) => h('li', {}, h('span', {}, f.name), h('span', {}, formatBytes(f.size)))));
    fileDateBtn.hidden = !files.length;
    if (list.length && !files.length) toast('Eso no parece un vídeo');
  };
  const onPick = (input) => () => { setFiles([...input.files]); input.value = ''; };
  const fileInput = h('input', { type: 'file', accept: 'video/*', multiple: true, class: 'hidden' });
  const camInput = h('input', { type: 'file', accept: 'video/*', capture: 'environment', class: 'hidden' });
  fileInput.addEventListener('change', onPick(fileInput));
  camInput.addEventListener('change', onPick(camInput));

  async function save() {
    if (!files.length) { toast('Elige al menos un vídeo'); return; }
    saveBtn.disabled = true;
    try {
      const total = files.reduce((a, f) => a + f.size, 0);
      const space = assessSpace(await getUsage(), total);
      if (space.level === 'full') {
        await alertDialog({ title: 'No hay espacio suficiente', message: `Estos vídeos ocupan ${formatBytes(total)} y en el dispositivo solo quedan ${formatBytes(space.free)}. Prueba con menos vídeos o clips más cortos/comprimidos.` });
        return;
      }
      if (space.level === 'low' && !(await confirmDialog({ title: 'Queda poco espacio', message: `Tras guardar quedará poco espacio libre (${formatBytes(space.free - total)}). ¿Guardar igualmente?`, okText: 'Guardar' }))) return;
      await requestPersistence();

      let saved = 0;
      for (const [i, file] of files.entries()) {
        status.textContent = `Guardando ${i + 1} de ${files.length}…`;
        const info = await analyzeVideo(file);
        if (!info.ok) {
          const ok = await confirmDialog({
            title: 'Formato dudoso',
            message: `Este navegador no puede abrir "${file.name}" (suele pasar con HEVC/.mov de iPhone o cámaras 360). Se puede guardar, pero quizá no se vea. Mejor conviértelo a MP4 H.264 (en iPhone: Ajustes › Cámara › Formatos › Más compatible).`,
            okText: 'Guardar igualmente', cancelText: 'Saltar este'
          });
          if (!ok) continue;
        }
        await addClip({
          file, sectionId: secPicker.value, plane: planePicker.value, date: dateInput.value || todayStr(),
          mark: markInput.value, comment: noteInput.value,
          duration: info.duration || 0, thumb: info.thumb || null, width: info.width || 0, height: info.height || 0
        });
        saved++;
      }
      await setSetting('lastSectionId', secPicker.value);
      await setSetting('lastPlane', planePicker.value);
      notifySectionsChanged();
      if (saved) { toast(saved === 1 ? 'Vídeo guardado' : `${saved} vídeos guardados`); go('/seccion/' + secPicker.value); }
    } catch (e) {
      console.error(e);
      await alertDialog({ title: 'No se pudo guardar', message: e.name === 'QuotaExceededError' ? 'El navegador se ha quedado sin espacio. Libera espacio o sube clips más pequeños.' : e.message });
    } finally {
      saveBtn.disabled = false; status.textContent = '';
    }
  }

  container.append(h('div', { class: 'page narrow' },
    h('h1', {}, 'Añadir vídeo'),
    h('div', { class: 'pick-area' },
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary big', type: 'button', onclick: () => fileInput.click() }, icon('video', 22), 'Elegir vídeos'),
        h('button', { class: 'btn big', type: 'button', onclick: () => camInput.click() }, icon('camera', 22), 'Grabar')),
      fileList, fileDateBtn, fileInput, camInput),
    h('div', { class: 'section-block' }, h('h2', {}, 'Sección'), secPicker.el),
    h('div', { class: 'section-block' }, h('h2', {}, 'Plano'), planePicker.el),
    h('details', { class: 'more' }, h('summary', {}, 'Más opciones (fecha, marca, nota)'),
      field('Fecha de grabación', dateInput), field('Marca o resultado', markInput), field('Nota', noteInput)),
    status, saveBtn));
}
