// Pruebas ejecutables en el navegador. Abre tests/tests.html con el servidor local.
import { useDatabase, dropDatabase, getAll, getOne } from '../js/db.js';
import { seasonOf } from '../js/utils/dates.js';
import { formatBytes, formatDuration, formatTime } from '../js/utils/format.js';
import { filterClips, sortClips, groupBySeason, addClip, listClips, updateClip, deleteClip, getVideoBlob } from '../js/services/clips.js';
import { createSection, renameSection, moveSection, listSections, deleteSection, sectionCounts, ensureSwimmer } from '../js/services/sections.js';
import { addNote, listNotes, toggleNoteStatus } from '../js/services/notes.js';
import { assessSpace } from '../js/services/storage.js';
import { snapFps } from '../js/components/player.js';

const out = document.getElementById('out');
let pass = 0, fail = 0;
async function test(name, fn) {
  const li = document.createElement('li');
  try { await fn(); pass++; li.textContent = '✅ ' + name; }
  catch (e) { fail++; li.textContent = '❌ ' + name + ' → ' + e.message; }
  out.append(li);
}
function eq(actual, expected, what = '') {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what} esperaba ${b} y salió ${a}`);
}
const fakeFile = (name = 'a.mp4') => new File([new Uint8Array(1000)], name, { type: 'video/mp4' });
const clip = (o) => ({ id: o.id, sectionId: 'A', plane: 'Lateral', date: '2026-01-01', season: '2025-2026', createdAt: 1, ...o });

// ---------- Funciones puras ----------
await test('Temporada: septiembre empieza una nueva', () => {
  eq(seasonOf('2025-09-01'), '2025-2026'); eq(seasonOf('2025-08-31'), '2024-2025'); eq(seasonOf('2026-01-15'), '2025-2026');
});
await test('Formatos: bytes y duración', () => {
  eq(formatBytes(0), '0 B'); eq(formatBytes(1536), '1,5 KB'); eq(formatBytes(5 * 1024 * 1024), '5,0 MB');
  eq(formatDuration(7.9), '0:07'); eq(formatTime(3.42), '0:03.42');
});
await test('Filtros: por sección y plano', () => {
  const l = [clip({ id: 1 }), clip({ id: 2, sectionId: 'B' }), clip({ id: 3, plane: 'Frontal' })];
  eq(filterClips(l, { sectionId: 'A' }).map((c) => c.id), [1, 3]);
  eq(filterClips(l, { plane: 'Frontal' }).map((c) => c.id), [3]);
  eq(filterClips(l, { sectionId: 'A', plane: 'Frontal' }).map((c) => c.id), [3]);
  eq(filterClips(l).length, 3);
});
await test('Orden: más nuevo primero, empate por último subido', () => {
  const l = [clip({ id: 1, date: '2025-05-01' }), clip({ id: 2, date: '2026-01-01', createdAt: 1 }), clip({ id: 3, date: '2026-01-01', createdAt: 9 })];
  eq(sortClips(l).map((c) => c.id), [3, 2, 1]);
});
await test('Agrupar por temporada: la más reciente primero', () => {
  const l = [clip({ id: 1, season: '2024-2025', date: '2025-01-01' }), clip({ id: 2, season: '2025-2026' }), clip({ id: 3, season: '2024-2025', date: '2025-03-01' })];
  const g = groupBySeason(l);
  eq(g.map((x) => x.season), ['2025-2026', '2024-2025']); eq(g[1].clips.map((c) => c.id), [3, 1]);
});
await test('Espacio: ok / poco / lleno / desconocido', () => {
  const GB = 1024 ** 3, MB = 1024 ** 2;
  eq(assessSpace({ usage: 0, quota: 10 * GB, supported: true }, 100 * MB).level, 'ok');
  eq(assessSpace({ usage: 9.9 * GB, quota: 10 * GB, supported: true }, 10 * MB).level, 'low');
  eq(assessSpace({ usage: 9.9 * GB, quota: 10 * GB, supported: true }, 1 * GB).level, 'full');
  eq(assessSpace({ usage: 0, quota: 0, supported: false }).level, 'unknown');
});
await test('Fotogramas: se ajusta a fps habituales (29,97 → 30)', () => {
  eq(snapFps(29.97), 30); eq(snapFps(59.94), 60); eq(snapFps(119.9), 120);
});

// ---------- Con IndexedDB (base de datos de pruebas) ----------
useDatabase('diario-tecnico-test');
await dropDatabase();
await ensureSwimmer();

await test('Secciones: crear, orden, renombrar y nombres repetidos', async () => {
  const a = await createSection('Braza'), b = await createSection('Salida braza'), c = await createSection('Viraje');
  eq((await listSections()).map((s) => s.name), ['Braza', 'Salida braza', 'Viraje']);
  await moveSection(c.id, -1);
  eq((await listSections()).map((s) => s.name), ['Braza', 'Viraje', 'Salida braza']);
  await moveSection(a.id, -1); // ya es la primera: no cambia nada
  eq((await listSections())[0].name, 'Braza');
  await renameSection(b.id, 'Salida');
  let error = false; try { await createSection('braza'); } catch { error = true; }
  eq(error, true, 'nombre repetido');
});

await test('Clips: añadir, listar, editar (la temporada se recalcula)', async () => {
  const [s1] = await listSections();
  const c = await addClip({ file: fakeFile(), sectionId: s1.id, plane: 'Lateral exterior', date: '2026-02-10', mark: ' 1:02.3 ', comment: 'Buena entrada' });
  eq(c.season, '2025-2026'); eq(c.mark, '1:02.3');
  eq((await getVideoBlob(c.id)).size, 1000, 'tamaño del vídeo guardado');
  eq((await listNotes(c.id)).length, 1, 'la nota inicial existe');
  const u = await updateClip(c.id, { date: '2025-06-01' });
  eq(u.season, '2024-2025');
  eq((await listClips({ sectionId: s1.id })).length, 1);
});

await test('Notas: la mejora pasa de pendiente a conseguida y vuelve', async () => {
  const [c] = await listClips();
  const n = await addNote({ clipId: c.id, type: 'mejora', text: 'Subir codos' });
  eq(n.status, 'pendiente');
  eq((await toggleNoteStatus(n.id)).status, 'conseguida');
  eq((await toggleNoteStatus(n.id)).status, 'pendiente');
});

await test('Borrar sección con vídeos: exige destino y mueve los vídeos', async () => {
  const [s1, s2] = await listSections();
  let error = false; try { await deleteSection(s1.id); } catch { error = true; }
  eq(error, true, 'sin destino debe fallar');
  eq((await listSections()).length, 3, 'no se borró nada');
  await deleteSection(s1.id, s2.id);
  eq((await listSections()).length, 2);
  eq((await sectionCounts())[s2.id], 1, 'el vídeo se movió');
  eq((await listClips())[0].sectionId, s2.id);
});

await test('Borrar clip: se borran también su vídeo y sus notas', async () => {
  const [c] = await listClips();
  await deleteClip(c.id);
  eq((await getAll('clips')).length, 0); eq(await getOne('videos', c.id), undefined, 'vídeo'); eq((await getAll('notes')).length, 0, 'notas');
});

await dropDatabase();
document.getElementById('sum').textContent = fail ? `❌ ${fail} fallo(s), ${pass} correctas` : `✅ Todo correcto (${pass} pruebas)`;
