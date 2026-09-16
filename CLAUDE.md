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
  - 🎯 Ronda de pedidos del usuario (probando en vivo), todos implementados
    y desplegados:
    - Se sacó el menú principal después de "cita confirmada" (queda solo
      la confirmación).
    - Se agregó un recordatorio de "escribí el número" en cada pantalla
      con opciones numeradas (servicio, peluquero, día, cancelar) — los
      emojis 1️⃣2️⃣3️⃣ no se entendían como algo para escribir.
    - Nuevo recordatorio 30 minutos antes de la cita (además de 24h/2h).
    - Nuevo aviso automático al mes de una cita completada, invitando a
      reservar de nuevo (`sendComebackReminders`, cron diario 10:00,
      controla `comebackReminderSentAt` para no repetirse).
    - Confirmado: el reconocimiento de clientes por teléfono ya existía
      (colección `clients` en Firestore, indexada por `phone`), no hizo
      falta tocar nada ahí.
  - ✅ `functions/src/notify.ts` y el nombre por defecto de `ivr.ts` ya
    traducidos a hebreo — esa parte del checklist de traducción quedó
    cerrada.
  - ⬜ **Siguiente paso ofrecido, no confirmado todavía**: conectar Google
    Calendar (ya está construido en `functions/src/googleCalendar.ts` +
    `oauth.ts`) para que las citas confirmadas aparezcan solas en el
    calendario del peluquero. Requiere crear credenciales OAuth en Google
    Cloud (`GOOGLE_OAUTH_CLIENT_ID`/`SECRET` en `functions/.env`, hoy
    vacíos).
  - ✅ **Traducción a hebreo de todo el sistema — COMPLETA** (decisión del
    usuario: "todo en hebreo, panel incluido", el código/comentarios quedan
    en español):
    - ✅ `bot/conversation.js` — mensajes del bot de WhatsApp en hebreo.
    - ✅ `functions/src/notify.ts` (templates) y `functions/src/ivr.ts`
      (nombre por defecto) — en hebreo, desplegado.
    - ✅ `app/` (toda la app del panel) — todas las pantallas traducidas
      (agenda, lista de espera, clientes, campañas, login, panel, sucursales,
      servicios, peluqueros, horarios, ajustes) y RTL activado
      (`I18nManager.forceRTL(true)` en `app/app/_layout.tsx`).
- ✅ **Rediseño visual de `app/` — PROGRAMADO** (antes solo maquetas/Artifacts,
  ahora en el código real, rama `claude/salon-appointment-app-cg11sw`):
  - Agenda (`app/app/(tabs)/index.tsx`) reescrita como **línea de tiempo**:
    horas del día en un costado (08:00-20:00), citas chicas junto a su
    horario, muestra los bloqueos de horario del día.
  - `app/lib/theme.ts`: paleta clara **"gris niebla"** y oscura **"oscuro
    premium"**, azul **zafiro** (`#1d4ed8` claro / `#5b9dff` oscuro) como
    acento, colores de estado vivos (verde esmeralda/naranja/gris-azulado/
    rojo). El modo se guarda en `branch.themeMode` y se elige con un
    interruptor (☀️/🌙) en Ajustes — no hizo falta descartar ninguna opción
    de fondo, quedan las dos disponibles.
  - Nota: no se cargó la tipografía Manrope/Assistant de las maquetas (para
    eso hay que empaquetar fuentes con `expo-font`, se dejó para más
    adelante) — por ahora usa la fuente del sistema, con el mismo esquema
    de colores y layout.
  - ✅ **Bloquear horarios / cerrar el día — PROGRAMADO**: nuevo modelo
    `BlockedTime` en Firestore (`shared/types.ts` /
    `functions/src/types.ts`), CRUD en `app/lib/blockedTimes.ts`, pantalla
    en Ajustes para bloquear una franja horaria o el día completo (por
    peluquero o para todo el equipo), y el motor de disponibilidad
    (`bot/availability.js` + `functions/src/availability.ts`, y los 4
    puntos que ofrecen horarios: `getAvailability`, `botGetAvailability`,
    el IVR y el bot de WhatsApp) ya respeta esos bloqueos.
- 📞 **Hablar con una persona real (WhatsApp y teléfono) — PROGRAMADO.**
  - ✅ **WhatsApp**: opción **4️⃣ "לדבר ישירות עם הספר"** en el menú
    principal de `bot/conversation.js` — el bot le pasa al cliente el
    número personal del peluquero (`staff.phone`) y un link directo de
    WhatsApp (`wa.me/...`).
  - ✅ **Teléfono (IVR)**: ya existía — al presionar **0**,
    `functions/src/ivr.ts` transfiere la llamada a `branch.phone` (hoy el
    mismo número personal del peluquero).
  - ⬜ **Voz natural en el IVR, entrenada para responder cualquier
    pregunta** — el usuario decidió **seguir por ahora con el menú
    robótico actual** ("apretá 1, apretá 2") y no avanzar con esto todavía.
    Queda anotado para cuando se retome: requiere elegir un proveedor de
    voz IA de pago (ej. ElevenLabs Conversational AI, Realtime API de
    OpenAI) que cambiaría el presupuesto mensual (hoy ~$50-150/mes) —
    explicar costo y opciones antes de programarlo, como se hizo con
    Firebase/Railway/Twilio.
- ✅ **Despliegue de esta ronda de cambios — COMPLETO.**
  1. ✅ Firebase: reglas de Firestore (`blockedTimes`) y las 26 funciones
     actualizadas, publicadas en `bot-para-peluqueria` sin errores.
  2. ✅ Railway: bot redesplegado (`railway up`), reconectado a WhatsApp
     limpio, con la opción de hablar con el peluquero y el respeto a
     horarios bloqueados ya en producción.
  3. ✅ App del panel: se corrió de verdad con `npx expo start --web` (la
     primera vez que se llega a ejecutar, no solo compilar) y se probó
     con el login real (`flow613@gmail.com`) — capturas de pantalla
     enviadas al usuario (agenda en línea de tiempo, clientes, ajustes
     con el interruptor claro/oscuro y el bloqueo de horarios), todo
     andando con datos reales de Firestore.
  - 🐛 **Se encontraron y corrigieron 2 bugs reales al hacer esto**, que
    existían desde antes de esta sesión y nunca se habían detectado
    porque nadie había llegado a correr `expo start` (solo se verificaba
    con `tsc`, que no los detecta):
    1. Metro (el empaquetador de la app) no dejaba importar
       `../../../shared/types` por estar fuera de la carpeta `app/` —
       se agregó `app/metro.config.js` con `watchFolders` apuntando al
       monorepo.
    2. `app/lib/branchContext.tsx` pedía las sucursales a Firestore antes
       de que Firebase Auth confirmara la sesión, y como las reglas
       exigen usuario autenticado tiraba "Missing or insufficient
       permissions" en cualquier pantalla — ahora espera a que haya
       sesión iniciada.
  - Para previsualizar en navegador se agregaron `react-native-web` y
    `react-dom` (dependencias que pide Expo para el modo web); no afectan
    la app real en el celular.
  - Nota: la tipografía Manrope/Assistant de las maquetas no se cargó
    (usa la fuente del sistema por ahora) — pendiente si se quiere ese
    detalle más adelante, requiere empaquetar fuentes con `expo-font`.
- ✅ **Soporte multi-idioma (hebreo/inglés/español) — PROGRAMADO Y
  DESPLEGADO.** Pedido del usuario pensando en vender a otros países más
  adelante. Se armó ahora, aprovechando que el código estaba fresco.
  - Nuevo campo `branch.language` (`'he'` por defecto, también `'en'` y
    `'es'`) controla el idioma del bot de WhatsApp, el IVR de Twilio, las
    notificaciones y toda la app del panel — un solo interruptor para
    todo el sistema.
  - Diccionarios por idioma, uno por carpeta desplegable (mismo patrón
    que `availability.js`): `bot/i18n.js`, `functions/src/notify.ts`
    (plantillas) + `functions/src/ivrStrings.ts` (IVR), y
    `app/lib/i18n.ts` (toda la app, con hook `useT()`).
  - Nueva opción en Ajustes (`app/app/admin/settings.tsx`): selector
    עברית / English / Español. Cambia el texto al instante; si cambia
    el sentido de lectura (hebreo RTL ↔ inglés/español LTR) avisa que
    hay que reabrir la app para que el diseño se acomode bien —
    limitación de React Native, no de la implementación.
  - De paso se corrigió un bug real preexistente: `functions/src/campaigns.ts`
    tenía un mensaje de error que había quedado en español sin traducir
    nunca (aunque el resto del sistema ya estaba en hebreo).
  - Probado en vivo con capturas reales cambiando el idioma desde la app
    (agenda, clientes y ajustes en los tres idiomas) — ya desplegado en
    Firebase Functions y Railway.
  - Nota para el futuro: si se agrega otro idioma, solo hace falta sumar
    una entrada más a cada uno de los 3 diccionarios (no hay que tocar
    las pantallas ni la lógica).
- ⬜ **Ronda de 4 mejoras pedidas por el usuario — CÓDIGO LISTO, VERIFICADO
  Y SUBIDO A GITHUB, PERO TODAVÍA NO DESPLEGADO** (esta sesión corrió en un
  entorno remoto sin las sesiones de Firebase CLI / Railway CLI que se
  habían iniciado antes en el sandbox interactivo — falta el paso de
  `firebase deploy` y `railway up` desde ahí, o volver a loguearse):
  - ✅ **Reintento automático cuando el horario se ocupa**: al elegir una
    hora que resulta ocupada, el primer intento del día solo avisa
    ("esa hora está ocupada, elegí otra") sin más — recién desde el
    **segundo** intento seguido el bot busca automáticamente y ofrece las
    3 horas libres más cercanas a lo que pidió (o pasa a lista de espera
    si ese día ya no queda nada). Pensado para el estrés de fin de día
    cuando casi todo está lleno, pero sin saturar de mensajes al primer
    intento (el usuario pidió específicamente este matiz).
  - ✅ **Preguntas que el bot no entiende**: si el cliente escribe algo que
    no coincide con ninguna opción esperada, el bot le ofrece hablar
    directo con el peluquero (mismo mecanismo que la opción 4️⃣ del menú)
    y además guarda el mensaje en una colección nueva de Firestore
    (`unansweredMessages`) para que el peluquero la revise — así el
    sistema se va "retroalimentando" con el tiempo. Nueva pestaña
    **"Preguntas"** en la app del panel para verlas y marcarlas como
    resueltas.
  - ✅ **Duración de corte configurable por peluquero**: cada peluquero
    puede tener un tiempo distinto para el mismo servicio (ej. un corte
    le toma 20 min a uno y 30 a otro). Se configura en la pantalla de
    Peluqueros (botón "⏱️ Duración por servicio" en cada tarjeta); si se
    deja vacío, usa la duración por defecto del servicio. El motor de
    disponibilidad ya lo respeta en los 4 lugares que ofrecen horarios:
    bot de WhatsApp, IVR, panel (`getAvailability`/`adminCreateAppointment`)
    y citas recurrentes.
  - ✅ **Modo mantenimiento (botón de emergencia)**: nuevo interruptor en
    Ajustes ("🚨 Modo mantenimiento") que, ante un problema técnico, pausa
    todo el sistema automático — el bot de WhatsApp responde con un aviso
    y pasa el contacto directo del peluquero, y las llamadas por teléfono
    (IVR) se transfieren directo sin pasar por el menú — hasta que se
    desactive el interruptor a mano.
  - Nota: la idea de "nombre del peluquero configurable" que también pidió
    el usuario en el mismo pedido **ya existía** (el campo "Nombre" en la
    pantalla de Peluqueros, ya usado en todos los mensajes) — no hizo
    falta construir nada nuevo ahí.
  - **Siguiente paso pendiente**: desplegar de verdad — `firebase deploy
    --only firestore:rules,functions` en el proyecto `bot-para-peluqueria`
    y `railway up` en el servicio `bot-peluqueria` (rama
    `claude/salon-appointment-app-cg11sw`, ya pusheada a GitHub) — y
    después probar en vivo con clientes reales, igual que las rondas
    anteriores.
- **Ideas para el backlog (más adelante, el usuario lo aclaró
  explícitamente — no bloquean el piloto):**
  - Página web y video publicitario explicando el ahorro de tiempo/dinero
    del sistema para el peluquero, más una campaña de publicidad y
    marketing "aprendiendo de los mejores" (competidores/casos de éxito).
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
