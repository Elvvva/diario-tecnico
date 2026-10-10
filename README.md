# Diario técnico

App web personal (PWA) para guardar clips de mi técnica de nado y compararlos a lo largo de las temporadas.
HTML + CSS + JavaScript sin frameworks, sin npm, sin compilación. Todo se guarda en el propio dispositivo (IndexedDB).

> **Estado: Fase 1 + cuentas y sincronización** — secciones editables, subida con etiquetas y miniaturas, biblioteca,
> reproductor (velocidad, fotograma a fotograma, bucle, pantalla completa), comentarios y mejoras, evolución total,
> temas claro/oscuro e **inicio de sesión con sincronización entre móvil y ordenador (Supabase)**.
> Pendiente: comparador sincronizado y línea temporal por gesto; comparaciones guardadas, observaciones, protocolo,
> copia de seguridad y ajustes.

## Probar en local
1. Abre una terminal en la carpeta `diario-tecnico/`.
2. Ejecuta `python3 -m http.server 8000` (en Windows: `py -m http.server 8000`).
3. Abre `http://localhost:8000` en el ordenador.
4. Pruebas automáticas: `http://localhost:8000/tests/tests.html` (deben salir todas en ✅).

Para ver los cambios al editar código: recarga con Ctrl+Shift+R. Si algo parece "pegado", en DevTools › Application › Service Workers marca *Update on reload* o pulsa *Unregister*.

## Probar en el móvil
El service worker y la instalación como app solo funcionan con **https** (o localhost), así que lo más fácil es publicar en GitHub Pages y abrir esa dirección en el móvil.

## Publicar en GitHub Pages (gratis)
1. Crea un repositorio en GitHub y sube todo el contenido de esta carpeta (que `index.html` quede en la raíz).
2. En el repositorio: *Settings › Pages › Build and deployment › Deploy from a branch › main / (root) › Save*.
3. En un minuto estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.
4. Instálala: en Chrome/Android "Instalar app"; en iPhone/Safari, Compartir › "Añadir a pantalla de inicio".

Si cambias archivos y quieres forzar que los dispositivos se actualicen, sube el número de `VERSION` en `sw.js`.

## Cuenta y sincronización (Supabase)
Sin cuenta, la app funciona igual pero solo en ese dispositivo. Con cuenta, los vídeos, secciones y notas se sincronizan entre el móvil y el ordenador.
Todo se guarda primero en el dispositivo (puedes trabajar sin conexión) y se sube solo al volver el internet.

**Configuración (una sola vez):**
1. Entra en https://supabase.com › *Start your project* › inicia sesión con GitHub.
2. *New project*: nombre `diario-tecnico`, una contraseña de base de datos (guárdala), región de Europa y plan gratuito. Espera 1–2 minutos.
3. Menú izquierdo › **SQL Editor** › *New query* › pega TODO el contenido de `supabase/schema.sql` › **Run**. Debe decir "Success".
4. **Authentication › Users › Add user › Create new user**: tu correo y una contraseña, y marca **Auto Confirm User**.
5. Bloquea los registros públicos para que nadie más use tu espacio: **Authentication › Sign In / Providers** › desactiva **Allow new users to sign up**. (Los nombres exactos del menú pueden variar un poco.)
6. **Project Settings › API** (o *API Keys*): copia la **Project URL** y la clave **anon** (o *publishable*) y pégalas en `js/config.js`. No son secretas: la seguridad la dan las reglas del SQL, que hacen que cada cuenta solo vea lo suyo.
7. Sube los cambios a GitHub (`git add .`, `git commit -m "Nube"`, `git push`), espera a que se actualice Pages y abre la app: menú › **Iniciar sesión**.
8. En cada dispositivo (móvil y ordenador) inicia sesión con la misma cuenta. La primera vez se sube lo que ya tuvieras en ese dispositivo.

**Cómo funciona y límites:**
- Si el mismo elemento se cambia en dos dispositivos, gana el cambio más reciente. Los borrados también se sincronizan.
- Si dos dispositivos crearon una sección con el mismo nombre, se unen en una.
- Los vídeos de otro dispositivo se descargan la primera vez que abres el clip (y se guardan ahí).
- **Máximo 50 MB por vídeo** (límite del plan gratuito). Comprime los clips más pesados.
- El plan gratuito de Supabase tiene poco espacio de archivos (entre 0,5 y 1 GB según la fuente; compruébalo en supabase.com/pricing) y **pausa el proyecto tras una semana sin actividad** (se reactiva desde el panel). Para un archivo de varias temporadas probablemente necesitarás el plan Pro (unos 25 $/mes).

## Datos y copia de seguridad
Aunque haya cuenta, cada dispositivo guarda su copia local. La copia de seguridad en archivo (JSON + vídeos) llegará más adelante y seguirá siendo útil como seguro extra.

## Consejos para los vídeos
- Clips de 5–10 s (2–3 ciclos). Mejor 1080p que 4K; 30 o 60 fps. Un clip de 8 s en 1080p suele pesar 10–40 MB.
- Formato **MP4 H.264**. Los HEVC/.mov de iPhone y algunos de Insta360 pueden no reproducirse en todos los navegadores: en iPhone, Ajustes › Cámara › Formatos › *Más compatible*.
- Recorta antes de subir (Fotos/Galería) y, si pesa mucho, comprímelo con HandBrake (preset "Fast 1080p30").
- iPhone/Safari tiene límites de espacio más estrictos: sube con moderación y haz copias.

## Privacidad
- Sin cuenta, todo se guarda localmente y no se envía nada a ningún servidor.
- Con cuenta, tus datos y vídeos se guardan **también en Supabase** (servidor de terceros), en una carpeta privada que solo tu cuenta puede leer. No hay analíticas ni otros servicios de terceros.
- Esta versión es solo para mis propios vídeos. **Si en el futuro se guardan vídeos de otras personas (sobre todo menores)
hará falta autorización escrita de las familias y revisar el RGPD antes de usarlo o de añadir más cuentas.**
