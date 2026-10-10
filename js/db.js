// ÚNICO archivo que habla directamente con IndexedDB (la base de datos del navegador).
// El resto de la app usa las funciones de aquí y de js/services/.
//
// "Cajas" (stores): swimmers, sections, clips, videos, notes, comparisons, settings.
// Los vídeos van en su propia caja (videos) para que listar clips sea rápido.

let dbName = 'diario-tecnico';
let dbPromise = null;

// Solo para las pruebas: usar otra base de datos distinta de la real.
export function useDatabase(name) { dbName = name; dbPromise = null; }

export async function dropDatabase() {
  if (dbPromise) { (await dbPromise).close(); dbPromise = null; }
  await new Promise((res, rej) => {
    const r = indexedDB.deleteDatabase(dbName);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res();
  });
}

// Identificador único. randomUUID solo existe en https/localhost, por eso hay alternativa.
export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('swimmers', { keyPath: 'id' });
      db.createObjectStore('sections', { keyPath: 'id' });
      db.createObjectStore('clips', { keyPath: 'id' }).createIndex('sectionId', 'sectionId');
      db.createObjectStore('videos', { keyPath: 'id' });
      db.createObjectStore('notes', { keyPath: 'id' }).createIndex('clipId', 'clipId');
      db.createObjectStore('comparisons', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}

// Convierte una petición de IndexedDB en una promesa.
export function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Ejecuta varias operaciones en UNA transacción (o todo o nada).
// run(['clips','videos'], 'readwrite', async (clips, videos) => { ... })
export async function run(storeNames, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result, failure = null;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error('Transacción cancelada'));
    tx.onerror = () => { failure = failure || tx.error; };
    (async () => fn(...storeNames.map((s) => tx.objectStore(s))))()
      .then((r) => { result = r; })
      .catch((e) => { failure = e; try { tx.abort(); } catch { /* ya cerrada */ } });
  });
}

export const getAll = (store) => run([store], 'readonly', (s) => req(s.getAll()));
export const getOne = (store, key) => run([store], 'readonly', (s) => req(s.get(key)));
export const putOne = (store, value) => run([store], 'readwrite', (s) => req(s.put(value)));
export const removeOne = (store, key) => run([store], 'readwrite', (s) => req(s.delete(key)));
export const getByIndex = (store, index, key) => run([store], 'readonly', (s) => req(s.index(index).getAll(key)));
