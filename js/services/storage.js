// Espacio del navegador y almacenamiento persistente.

// Pide al navegador que NO borre nuestros datos si falta espacio.
export async function requestPersistence() {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}

export async function getUsage() {
  if (navigator.storage?.estimate) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota, supported: true };
    } catch { /* sigue */ }
  }
  return { usage: 0, quota: 0, supported: false };
}

// Valora si cabe lo que vamos a guardar (needed = bytes).
// Devuelve level: 'ok' | 'low' (queda poco) | 'full' (no cabe) | 'unknown'
export function assessSpace({ usage, quota, supported }, needed = 0) {
  if (!supported || !quota) return { level: 'unknown' };
  const free = quota - usage;
  if (free - needed < 0) return { level: 'full', free };
  if (free - needed < 200 * 1024 * 1024 || (usage + needed) / quota > 0.85) return { level: 'low', free };
  return { level: 'ok', free };
}
