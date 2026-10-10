// Acciones sobre secciones con sus diálogos: crear, renombrar y borrar (moviendo los vídeos).
import { createSection, renameSection, deleteSection, listSections, sectionClipCount } from '../services/sections.js';
import { promptDialog, confirmDialog, choiceDialog, alertDialog, toast } from './dialogs.js';
import { go } from '../router.js';

// Avisa al menú lateral de que la lista de secciones (o sus contadores) ha cambiado.
export function notifySectionsChanged() { document.dispatchEvent(new Event('sections-changed')); }

export async function newSectionFlow() {
  const name = await promptDialog({ title: 'Nueva sección', label: 'Nombre', placeholder: 'Ej. Salida braza' });
  if (name === null) return null;
  try {
    const s = await createSection(name);
    notifySectionsChanged();
    go('/seccion/' + s.id);
    return s;
  } catch (e) { toast(e.message); return null; }
}

export async function renameFlow(section) {
  const name = await promptDialog({ title: 'Renombrar sección', label: 'Nombre', value: section.name });
  if (name === null) return false;
  try { await renameSection(section.id, name); notifySectionsChanged(); return true; }
  catch (e) { toast(e.message); return false; }
}

// Borrar: si tiene vídeos, pregunta a qué sección moverlos. Nunca se pierden vídeos sin querer.
export async function deleteFlow(section) {
  const n = await sectionClipCount(section.id);
  if (n === 0) {
    const ok = await confirmDialog({ title: 'Borrar sección', message: `¿Borrar la sección "${section.name}"?`, okText: 'Borrar', danger: true });
    if (!ok) return false;
    await deleteSection(section.id);
    notifySectionsChanged();
    return true;
  }
  const others = (await listSections()).filter((s) => s.id !== section.id);
  if (!others.length) {
    await alertDialog({ title: 'Todavía no se puede borrar', message: `"${section.name}" tiene ${n} vídeo(s) y es tu única sección. Crea otra sección y podrás moverlos allí.` });
    return false;
  }
  const target = await choiceDialog({
    title: `Borrar "${section.name}"`, label: 'Mover los vídeos a',
    message: `Tiene ${n} vídeo(s). Los vídeos NO se borran: se mueven a la sección que elijas.`,
    options: others.map((s) => ({ value: s.id, label: s.name })), okText: 'Mover y borrar', danger: true
  });
  if (!target) return false;
  await deleteSection(section.id, target);
  notifySectionsChanged();
  toast(`Sección borrada. ${n} vídeo(s) movidos.`);
  return true;
}
