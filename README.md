# Diario técnico

App web personal (PWA) para guardar clips de mi técnica de nado y compararlos a lo largo de las temporadas.
HTML + CSS + JavaScript sin frameworks, sin npm, sin compilación. Todo se guarda en el propio dispositivo (IndexedDB).

> **Estado: Fase 1 de 3** — secciones editables, subida con etiquetas y miniaturas, biblioteca, reproductor
> (velocidad, fotograma a fotograma, bucle, pantalla completa), comentarios y mejoras, evolución total, temas claro/oscuro.
> Pendiente: Fase 2 (comparador sincronizado) y Fase 3 (comparaciones guardadas, observaciones, protocolo, copia de seguridad, ajustes).

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

## Datos y copia de seguridad
Los datos del móvil y los del ordenador son **independientes**. La copia de seguridad (Fase 3) será la forma de pasarlos de uno a otro.
Hasta entonces, **los datos viven solo en este navegador**: si borras los datos del sitio, se pierden.

## Consejos para los vídeos
- Clips de 5–10 s (2–3 ciclos). Mejor 1080p que 4K; 30 o 60 fps. Un clip de 8 s en 1080p suele pesar 10–40 MB.
- Formato **MP4 H.264**. Los HEVC/.mov de iPhone y algunos de Insta360 pueden no reproducirse en todos los navegadores: en iPhone, Ajustes › Cámara › Formatos › *Más compatible*.
- Recorta antes de subir (Fotos/Galería) y, si pesa mucho, comprímelo con HandBrake (preset "Fast 1080p30").
- iPhone/Safari tiene límites de espacio más estrictos: sube con moderación y haz copias.

## Privacidad
Todo se guarda localmente; no se envía nada a ningún servidor y no hay analíticas ni servicios de terceros.
Esta versión es solo para mis propios vídeos. **Si en el futuro se guardan vídeos de otras personas (sobre todo menores)
hará falta autorización escrita de las familias y revisar el RGPD antes de usarlo o de añadir cuentas o servidor.**
