# Citas Peluquería — memoria del proyecto

## Qué es esto
Sistema de citas para peluquerías en Israel. Los clientes reservan solos por
WhatsApp o por teléfono (IVR en hebreo, para quienes tienen teléfono kasher),
sin que el peluquero tenga que atender cada llamada. Ver `README.md` para el
detalle técnico completo de arquitectura y setup.

## Cómo está armado (resumen)
- `app/` — app Expo (React Native) para el peluquero: agenda, clientes, lista
  de espera, campañas, horarios, sucursales, servicios, configuración.
- `bot/` — bot de WhatsApp (Baileys, no oficial) que lleva la conversación de
  reserva.
- `functions/` — Cloud Functions de Firebase: motor de reservas (con
  transacción anti-doble-reserva), recordatorios, no-show, fidelidad,
  cumpleaños, campañas, IVR de Twilio, sincronización opcional con Google
  Calendar, modo Shabat.
- `shared/` — tipos y lógica de disponibilidad compartidos entre `bot/` y
  `functions/`.

## Dónde estamos (actualizar esto a medida que avanzamos)
- **Fase actual: Fase 0 — Piloto.** El código del piloto ya está construido
  y compila limpio (TypeScript de `functions/` y `app/`, sintaxis del bot
  verificada). Falta desplegarlo con credenciales reales y probarlo con
  clientes de verdad en una peluquería real (la del usuario o un familiar).
- **Plan completo acordado:**
  1. Fase 0 — Piloto (~2 semanas): desplegar, conectar WhatsApp real, probar
     con clientes reales.
  2. Fase 1 — Multi-tenant + venta (~5-6 semanas): convertir el proyecto de
     "una sola peluquería" a SaaS multi-cliente con registro propio, cobro
     (Stripe) y migración de WhatsApp de Baileys (gratis, no oficial, riesgo
     de bloqueo) a la API oficial de WhatsApp Business (Meta Cloud API).
  3. Fase 2 — Lanzamiento: primeros clientes de pago, iterar.
- **Progreso del despliegue (Fase 0):**
  - ✅ Proyecto de Firebase creado. Nombre: "BOT PARA PELUQUERIA". Project ID:
    `bot-para-peluqueria`. Plan actual: Spark (gratis).
  - ✅ Firestore activado (base de datos creada en `me-west1`, Tel Aviv;
    `firestore.rules` y `firestore.indexes.json` ya desplegados).
  - ✅ Authentication activado (Email/Password). Usuario admin creado:
    `flow613@gmail.com` (login real de acceso al panel del peluquero).
  - ✅ App web registrada en Firebase (App ID
    `1:1017514154625:web:e894e2af37d94deb6b8b80`) y `app/.env` ya configurado
    con las credenciales reales (no se sube a git).
  - ✅ Plan Blaze activo (facturación vinculada: "My Billing Account 1",
    ₪891 de crédito de prueba gratis de Google por 90 días).
  - ✅ `functions/` desplegado (25 funciones activas en
    `bot-para-peluqueria`). URL base:
    `https://us-central1-bot-para-peluqueria.cloudfunctions.net`.
  - ✅ Secreto compartido y Service Account generados y verificados
    (`bot/.env` y `functions/.env` configurados; probado con curl: sin
    secreto da 401, con secreto pasa la autenticación).
  - ✅ Datos reales cargados en Firestore: sucursal "Peluquería"
    (BRANCH_ID `lvR7XmCtJEFm1FDxW7r7`, Jerusalén/`me-west1`, modo Shabat
    silencioso), peluquero יעקב אמסלם (número personal +972543147000, para
    avisos — NO es el número del bot), servicio "Corte de pelo" (15 min,
    ₪60). `bot/.env` ya tiene el `BRANCH_ID` cargado.
  - ✅ Línea nueva de WhatsApp comprada por el usuario (número dedicado
    para el bot, distinto del personal).
  - 🐛 Se encontró y corrigió un bug real: `bot/index.js` llamaba
    `makeWASocket.default(...)` pero la versión instalada de Baileys
    (6.7.21) exporta la función directamente — corregido a
    `makeWASocket(...)`. También se agregó generación de QR como imagen
    PNG (`bot/whatsapp-qr.png`, vía el paquete `qrcode`) además del ASCII
    en consola, para poder mandar el QR como archivo en vez de depender de
    leerlo en una terminal.
  - ✅ ~~Hallazgo de red~~ **CORREGIDO — no era la red.** La falla
    "Connection Failure" en el handshake de Baileys pasaba tanto en este
    sandbox como en Railway (servidor real) — no era una restricción de
    red, era que `@whiskeysockets/baileys` estaba en una versión (6.7.21)
    ya incompatible con el protocolo actual de WhatsApp. Se actualizó a
    `7.0.0-rc14` (única serie 7.x publicada, son release candidates pero
    es lo que exige conectar hoy) y la conexión llegó bien hasta generar
    el QR. También se detectó y arregló que `bot/conversation.js`
    importaba `../shared/availability.js` (afuera de `bot/`), lo que
    rompía el despliegue a Railway porque solo se sube la carpeta `bot/`
    — se movió la lógica a `bot/availability.js` (copia local, ESM) y se
    borró `shared/availability.js` (quedó sin uso, cada carpeta
    desplegable tiene su propia copia: `bot/availability.js` y
    `functions/src/availability.ts`).
  - ✅ Hosting elegido y configurado: **Railway** (proyecto
    "bot-peluqueria", servicio `bot-peluqueria`, project id
    `ef14404f-be0f-471f-bbb5-baf64fd2f064`). Variables de entorno de
    `bot/.env` cargadas correctamente en Railway (ojo: al cargarlas por
    script hay que sacar las comillas que `FIREBASE_PRIVATE_KEY` trae en
    el archivo, si no rompe la clave — ya corregido).
  - ✅ **¡Bot conectado y en producción!** Verificado en los logs de
    Railway: `"Conectado a WhatsApp para la sucursal lvR7XmCtJEFm1FDxW7r7"`.
    La línea nueva de WhatsApp ya está vinculada y el bot corre 24/7.
    Notas para el futuro:
    - Los QR de emparejamiento vencen en ~20s; hay que tener el mail/QR
      generado y a la persona con la cámara YA lista antes de mandarlo
      (aprendido tras varios intentos fallidos por timeout).
    - Si algún día hay que re-vincular (número perdido, sesión corrupta),
      el proceso es: `railway volume delete` + `railway volume add
      --mount-path /app/auth_info_baileys` (sesión limpia) + `railway up`
      para redesplegar, y volver a extraer el QR de los logs con
      `railway logs --service bot-peluqueria | grep QR_DATA` (la app
      también imprime el dato crudo del QR en el log, no solo el ASCII,
      así se puede generar la imagen desde afuera sin necesitar acceso a
      archivos del contenedor — `railway service files`/`railway ssh` no
      funcionaron bien en este entorno).
  - ✅ **Reserva real de punta a punta probada por el usuario** — funcionó.
  - 🐛 Se encontró y corrigió: WhatsApp está migrando chats personales a
    direccionamiento por "LID" (`@lid`) en vez de número de teléfono
    (`@s.whatsapp.net`); el bot ignoraba esos mensajes en silencio. Ahora
    resuelve el número real vía `msg.key.remoteJidAlt`.
  - 🎯 Mejora de UX pedida por el usuario, ya implementada: en la pantalla
    de horarios, el cliente puede escribir la hora directamente (ej.
    "9:30", "930") en vez de tocar un número — si esa hora está ocupada,
    el bot ofrece las 3 más cercanas de todo el día (no solo lo último
    mostrado). También se puede escribir 0️⃣ para volver a elegir otro día
    en vez de quedar trabado con "opción inválida".
  - 📌 Aclarado con el usuario: si abre WhatsApp en el teléfono con la
    línea del bot, va a ver toda la conversación con cada cliente — es el
    comportamiento normal de WhatsApp (dispositivo vinculado). El número
    personal del peluquero solo recibe el aviso corto de "nueva cita",
    salvo que se use el mismo número para probar como cliente y como
    peluquero a la vez (como en las pruebas).
  - 🎯 Más ajustes de UX pedidos por el usuario, ya implementados:
    - Se sacó la pregunta de "¿querés que se repita cada semana?" después
      de confirmar — ahora va directo al menú principal.
    - La lista de servicios muestra solo el precio (con ✂️), no la
      duración.
    - En la pantalla de horarios ahora se invita primero a escribir la
      hora directamente, y recién después se muestra la lista numerada.
    - Se corrigió el nombre del servicio de prueba en Firestore: estaba
      en español ("Corte de pelo"), ahora dice "תספורת (corte de pelo)".
  - ⬜ **Siguiente paso ofrecido, no confirmado todavía**: conectar Google
    Calendar (ya está construido en `functions/src/googleCalendar.ts` +
    `oauth.ts`) para que las citas confirmadas aparezcan solas en el
    calendario del peluquero. Requiere crear credenciales OAuth en Google
    Cloud (`GOOGLE_OAUTH_CLIENT_ID`/`SECRET` en `functions/.env`, hoy
    vacíos).
  - 🔄 **EN CURSO — traducción a hebreo de todo el sistema** (decisión del
    usuario: "todo en hebreo, panel incluido", el código/comentarios quedan
    en español). Estado:
    - ✅ `bot/conversation.js` — todos los mensajes del bot de WhatsApp ya
      están en hebreo (verificado: sintaxis OK con `node --check`).
    - ⬜ `functions/src/notify.ts` — el objeto `templates` (recordatorios,
      confirmaciones, cumpleaños, fidelidad, etc.) todavía está en español.
      Falta traducir y volver a desplegar `functions/`.
    - ⬜ `functions/src/ivr.ts` — el `<Say>` ya estaba en hebreo; falta
      revisar el nombre por defecto `'Cliente telefónico'` → hebreo.
    - ⬜ `app/` (toda la app del panel) — falta traducir TODOS los textos
      (botones, menús, alertas, placeholders) y volver a activar RTL
      (`I18nManager.forceRTL(true)` en `app/app/_layout.tsx`, como tenía el
      proyecto original antes de reescribirlo). Es el bloque más grande que
      falta.
    - **Próximo paso al retomar**: seguir con `functions/src/notify.ts`,
      después `app/`, y al final volver a desplegar `functions/` y avisar
      al usuario para que revise cómo quedó.
- **Ideas para el backlog (feedback del usuario, no bloquean el piloto):**
  - Los servicios hoy son una sola línea plana (nombre+duración+precio). El
    usuario pidió poder tener "variantes" dentro de un mismo servicio (ej.
    corte adulto/niño/con barba) en vez de crear servicios sueltos por cada
    combinación. Repensar el modelo de datos (categorías + variantes) antes
    de escalar a Fase 1 — también dejaría la puerta abierta a otros rubros
    (uñas, etc.) más adelante.
  - Separar el número personal del peluquero (recibe avisos) del número de
    WhatsApp del bot (línea de trabajo nueva, la que hablan los clientes) —
    ya soportado por el modelo de datos actual (`staff.phone` vs el número
    conectado al bot), confirmado como el enfoque correcto para el piloto.
- **Decisiones ya tomadas con el usuario:**
  - El piloto se hace en la peluquería propia o de un familiar.
  - Se arranca con Baileys (gratis) y se migra a la API oficial de WhatsApp
    antes de vender a muchas peluquerías.
  - Mercado inicial: solo peluquerías (no barberías/spas todavía).
  - Dedicación: medio tiempo, presupuesto moderado (~$50-150/mes) para
    herramientas de pago (Twilio, dominio, Stripe, hosting) desde el piloto.

## Cómo trabajar con este usuario (importante, pedido explícito)
El usuario no tiene mucho conocimiento técnico. Reglas fijas para cada paso
del proyecto, sin excepción:
1. **Antes** de hacer algo, explicar en simple qué se va a hacer y para qué
   sirve — sin dar por sabido nada técnico.
2. Hacerlo (o guiar al usuario paso a paso si requiere que él haga algo,
   como crear una cuenta o pegar una clave).
3. **Después**, verificar/confirmar que quedó bien hecho antes de pasar al
   siguiente paso — nunca acumular pasos sin confirmar.
4. Si conviene agregar una skill de Claude Code o ajustar el flujo de
   trabajo para evitar errores futuros, proponerlo sin esperar a que lo
   pida.
