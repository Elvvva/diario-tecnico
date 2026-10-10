// Cuenta: iniciar sesión, estado de la sincronización y cerrar sesión.
import { h, icon, field } from '../utils/dom.js';
import { cloudConfigured, currentUser, signIn, signOut } from '../services/cloud.js';
import { syncNow, getSyncState, pendingCount, loadLastSync } from '../services/sync.js';
import { getSetting, setSetting } from '../settings.js';
import { getAll } from '../db.js';
import { confirmDialog, toast } from '../components/dialogs.js';
import { timeAgo } from '../utils/dates.js';
import { notifySectionsChanged } from '../components/section-actions.js';

export default async function accountView(_params, container) {
  await loadLastSync();
  const page = h('div', { class: 'page narrow' });
  container.append(page);

  async function login(email, password, btn, msg) {
    btn.disabled = true; msg.textContent = '';
    try {
      const user = await signIn(email, password);
      const prev = await getSetting('syncUserId', null);
      if (prev && prev !== user.id) {
        if ((await getAll('clips')).length) {
          const ok = await confirmDialog({
            title: 'Este dispositivo tiene datos de otra cuenta',
            message: 'Los vídeos y secciones que hay aquí se subirán a ESTA cuenta, junto con los que ya tenga. ¿Continuar?',
            okText: 'Continuar'
          });
          if (!ok) { await signOut(); btn.disabled = false; return; }
        }
        await setSetting('syncLastPull', null); // cuenta nueva: se baja todo desde cero
      }
      await setSetting('syncUserId', user.id);
      notifySectionsChanged();
      toast('Sesión iniciada');
      render();
      syncNow().catch(() => {});
    } catch (e) {
      msg.textContent = e instanceof TypeError ? 'No hay conexión con el servidor.' : e.message;
      btn.disabled = false;
    }
  }

  async function render() {
    if (!cloudConfigured()) {
      page.replaceChildren(h('h1', {}, 'Cuenta'),
        h('div', { class: 'card' },
          h('p', {}, h('strong', {}, 'La nube aún no está configurada.')),
          h('p', { class: 'muted' }, 'La app funciona igual, pero los vídeos solo se guardan en este dispositivo. Para entrar desde el móvil y el ordenador, sigue la sección "Cuenta y sincronización" del README y rellena js/config.js.')));
      return;
    }
    const user = currentUser();
    if (!user) {
      const email = h('input', { type: 'email', autocomplete: 'username', placeholder: 'tu@correo.com', required: true });
      const pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Contraseña', required: true });
      const msg = h('p', { class: 'error' }, '');
      const btn = h('button', { class: 'btn btn-primary big', type: 'submit' }, 'Iniciar sesión');
      const form = h('form', { onsubmit: (e) => { e.preventDefault(); login(email.value, pass.value, btn, msg); } },
        field('Correo', email), field('Contraseña', pass), msg, btn);
      page.replaceChildren(h('h1', {}, 'Iniciar sesión'),
        h('p', { class: 'muted' }, 'Entra con tu cuenta para tener los mismos vídeos en el móvil y en el ordenador. Tus datos siguen guardándose también en este dispositivo.'),
        h('div', { class: 'card' }, form),
        h('p', { class: 'hint', style: 'margin-top:12px' }, 'La cuenta se crea una sola vez en el panel de Supabase (ver README); aquí no hay registro público.'));
      return;
    }
    const st = getSyncState();
    const pending = await pendingCount();
    const statusText = st.status === 'syncing' ? (st.message || 'Sincronizando…')
      : st.status === 'error' ? `Error: ${st.error}`
      : st.status === 'offline' ? 'Sin conexión. Se sincronizará al volver.'
      : st.lastSyncAt ? `Sincronizado ${timeAgo(st.lastSyncAt)}` : 'Aún no se ha sincronizado';
    page.replaceChildren(h('h1', {}, 'Cuenta'),
      h('div', { class: 'card' },
        h('dl', { class: 'facts' },
          h('dt', {}, 'Sesión'), h('dd', {}, user.email),
          h('dt', {}, 'Estado'), h('dd', {}, statusText),
          h('dt', {}, 'Pendiente de subir'), h('dd', {}, pending ? `${pending} cambio(s)` : 'Nada')),
        h('div', { class: 'actions-row' },
          h('button', { class: 'btn btn-primary', type: 'button', disabled: st.status === 'syncing', onclick: () => syncNow().catch((e) => toast(e.message)) }, icon('evolution', 18), 'Sincronizar ahora'),
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            if (!(await confirmDialog({ title: 'Cerrar sesión', message: 'Tus vídeos y datos seguirán en este dispositivo, pero dejarán de sincronizarse hasta que vuelvas a entrar.', okText: 'Cerrar sesión' }))) return;
            await signOut(); notifySectionsChanged(); render();
          } }, 'Cerrar sesión'))),
      h('h2', {}, 'Cómo funciona'),
      h('p', { class: 'muted' }, 'Todo se guarda primero en este dispositivo, así que puedes trabajar sin conexión. Al volver a haber internet, los cambios se suben solos. Los vídeos de otros dispositivos se descargan la primera vez que abres cada clip.'));
  }

  const onState = () => render();
  window.addEventListener('sync-state', onState);
  await render();
  return () => window.removeEventListener('sync-state', onState);
}
