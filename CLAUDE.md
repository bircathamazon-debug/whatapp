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
  - ✅ **Google Calendar conectado — CONFIGURADO Y DESPLEGADO.** El código
    ya estaba construido desde antes (`functions/src/googleCalendar.ts` +
    `oauth.ts`); esta sesión el usuario creó las credenciales OAuth en
    Google Cloud (proyecto "BOT PARA PELUQUERIA", mismo proyecto de
    Firebase) y las pasó — cargadas en `functions/.env`
    (`GOOGLE_OAUTH_CLIENT_ID`/`SECRET`) y **las 29 funciones redesplegadas**
    (no solo `googleCalendarConnect`/`Callback`: también hacía falta
    redesplegar las que crean citas —`botCreateAppointment`,
    `adminCreateAppointment`, `generateRecurringAppointments`, etc.— para
    que tomen la variable nueva, porque cada función de 2ª gen. congela su
    propio entorno al desplegarse). **Falta**: que cada peluquero apriete
    "Conectar Google Calendar" en Ajustes (ya existe el botón) y probar
    que una cita nueva aparezca sola en su calendario.
- ✅ **App del panel publicada como página web (Firebase Hosting) —
  CONFIGURADO, DESPLEGADO Y PROBADO.** El usuario preguntó cómo descarga
  el peluquero la app (agenda/calendario/ajustes) — hasta ahora nunca se
  había armado una versión instalable, solo se probó corriendo el
  proyecto en una computadora. Se explicaron las 2 opciones (página web
  vs. apps nativas en App Store/Google Play, con sus costos: Apple
  U$S99/año, Google Play U$S25 una vez, más revisión de cada tienda) y
  el usuario eligió empezar con la página web.
  - **URL en producción: https://bot-para-peluqueria.web.app** — el
    peluquero la abre desde cualquier navegador (celular o compu) y
    puede "agregar a la pantalla de inicio" para que quede como un
    ícono, sin pasar por ninguna tienda de aplicaciones.
  - Técnicamente: `npx expo export --platform web` genera un sitio
    estático en `app/dist` (una página HTML por pantalla: agenda, login,
    finanzas, ajustes, etc.), y `firebase.json` ahora tiene un bloque
    `hosting` que lo sirve con `cleanUrls` (para que las direcciones
    queden lindas, sin `.html`) y un `predeploy` que corre el export
    solo, así no hay que acordarse de generarlo a mano antes de cada
    `firebase deploy --only hosting`.
  - Se encontró que faltaban los íconos/splash de `app.json`
    (`./assets/icon.png` y compañía no existían) — el export igual
    funcionó (son opcionales para la versión web), pero **es un
    pendiente de diseño** si más adelante se quiere un ícono propio en
    vez del genérico, y necesario si se pasa a apps nativas.
  - ✅ **Probado en vivo de punta a punta** (navegador real, con
    capturas): login con el usuario real (`flow613@gmail.com`) funciona,
    redirige al panel (Sucursales/Peluqueros/Servicios/Horarios/
    Finanzas/Ajustes, todo en hebreo), y la agenda en línea de tiempo
    carga bien con datos reales de Firestore.
  - Nota para el futuro: cada vez que se cambie algo en `app/`, hay que
    volver a correr `firebase deploy --only hosting` (o el predeploy lo
    hace solo) para que la página web se actualice — no se actualiza
    sola como el bot de Railway.
- ✅ **Rediseño "look de app nativa" — PROGRAMADO, DESPLEGADO Y PROBADO.**
  Al ver la página recién publicada, el usuario dijo que no le gustó cómo
  se veía y pidió que se sienta como una app de celular top (referencia:
  Booksy/Fresha, ya investigadas en el estudio de mercado). Cambios:
  - Íconos reales (`@expo/vector-icons`/Ionicons) en vez de emoji: la
    barra de pestañas de abajo (con versión rellena cuando la pestaña
    está activa) y el menú del panel (círculo de color + ícono, estilo
    Ajustes de iOS, con flecha que respeta la dirección RTL).
  - Pantalla de login nueva: insignia circular de marca (tijera), campos
    con ícono, botón redondeado tipo píldora con sombra de color ("efecto
    glow") en vez del botón plano de antes.
  - Nuevos tokens compartidos en `app/lib/theme.ts`: `RADIUS` (radios
    consistentes: sm/md/lg/xl/pill) y `cardShadow()`/`accentGlow()`
    (sombras "flotantes" reutilizables) — todas las tarjetas pasaron de
    borde plano a sombra real, que es lo que hace que se sienta como app
    y no como página web.
  - Se aplicó ya a: barra de pestañas, menú del panel, login, agenda
    (línea de tiempo). **Pendiente**: pasar el mismo tratamiento visual a
    las pantallas más chicas (Sucursales, Peluqueros, Servicios,
    Horarios, Ajustes, Finanzas, Clientes, Lista de espera, Campañas,
    Preguntas) — hoy funcionan bien pero todavía con el estilo de tarjeta
    plana anterior.
  - 🐛 **Bug real encontrado y corregido de paso**: la pantalla de
    Finanzas no tenía título registrado en el Stack de navegación de
    `admin/_layout.tsx` (se agregó).
  - 🐛 **Bug de dependencias encontrado y corregido**: al agregar
    `@expo/vector-icons`, npm instaló la versión 14.1.0, que trae una
    versión de `expo-font` (55.x) incompatible con este Expo SDK 51 —
    rompía el export a la página web con un error de módulos. Se fijó
    `@expo/vector-icons` en la versión exacta `14.0.4` (compatible) y se
    agregó `expo-font ~12.0.10` como dependencia directa del proyecto
    (antes quedaba como dependencia indirecta sin resolver bien para el
    export estático) — con eso volvió a funcionar.
  - ✅ **Probado en vivo con capturas reales** (login, menú del panel,
    agenda) — se ve y funciona como se pidió.
  - **Pendiente de diseño futuro** (no bloquea nada): sigue faltando un
    ícono/logo propio de la app (`app/assets/icon.png` y compañía no
    existen, se usa el genérico) — hace falta si más adelante se pasa a
    apps nativas de verdad en las tiendas.
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
- ✅ **Reestructuración de navegación (5 pestañas) — PROGRAMADA, DESPLEGADA
  Y VERIFICADA.** El usuario reportó un bug real: al entrar a la app desde
  el celular veía el calendario, pero no había forma de llegar a Ajustes
  (los grupos de navegación `(tabs)` y `admin` no estaban enlazados entre
  sí una vez que ya existía una sucursal). Antes de tocar código se le
  presentaron 3 opciones de rediseño; eligió la más completa (un nuevo
  dashboard "Inicio") y especificó él mismo la barra de abajo que quería:
  **Inicio / Calendario / Ajustes / Finanzas / Más**.
  - **Inicio** (`app/app/(tabs)/index.tsx`, pantalla nueva): dashboard con
    ingresos y cantidad de citas de hoy, alerta si hay preguntas sin
    responder (con acceso directo), próxima cita, accesos rápidos
    (Calendario/Finanzas/Campañas/Ajustes) y vista previa de las próximas
    citas del día. Pedido explícito del usuario: **colores vivos, fondo
    claro — nada de pantalla oscura**; se armó con el acento zafiro y los
    colores de estado (verde/naranja) ya existentes en `app/lib/theme.ts`
    sobre el fondo claro "gris niebla", no con el tema oscuro.
  - **Calendario**: la agenda de siempre, renombrada de `index.tsx` a
    `agenda.tsx` (mismo contenido, solo cambia el archivo/pestaña).
  - **Ajustes**: nueva pestaña con su propio submenú (Sucursales,
    Peluqueros, Servicios, Horarios, Configuración general) — las
    pantallas que antes vivían sueltas en `admin/` se movieron a
    `app/app/(tabs)/settings/`.
  - **Más**: nueva pestaña con Lista de espera, Clientes, Campañas,
    Preguntas y Cerrar sesión, movidas a `app/app/(tabs)/more/`.
  - **Finanzas**: pasó de estar escondida dentro de Ajustes a ser una
    pestaña directa (`app/app/(tabs)/finance.tsx`).
  - `admin/_layout.tsx` quedó reducido a solo envolver `login.tsx`; al
    iniciar sesión ahora redirige a `/` (Inicio) en vez de `/admin`.
  - Nuevas traducciones (hebreo/inglés/español) para las pestañas nuevas y
    los textos del dashboard en `app/lib/i18n.ts`.
  - 🐛 **Detalle técnico aprendido de paso**: expo-router necesita los
    "tipos de rutas" (`.expo/types/router.d.ts`) actualizados para que
    `tsc` reconozca las pantallas nuevas — ese archivo solo se regenera
    corriendo el servidor de desarrollo (`expo start`), no con
    `expo export`. Se corrió brevemente antes de verificar.
  - ✅ **Verificado**: `tsc` sin errores, `expo export --platform web`
    compila las 27 rutas sin errores, y se probó en el navegador real que
    cada ruta nueva (`/`, `/agenda`, `/settings`, `/settings/branches`,
    `/finance`, `/more`, `/more/questions`) carga sin errores de consola y
    redirige correctamente al login si no hay sesión iniciada. **Falta**
    una verificación visual con sesión iniciada de verdad (el asistente no
    tiene ni debe buscar la contraseña real del usuario) — pendiente que
    el usuario la revise él mismo en su celular.
  - ✅ **Desplegado** en Firebase Hosting
    (https://bot-para-peluqueria.web.app).
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
- ✅ **Ronda de 4 mejoras pedidas por el usuario — PROGRAMADA Y DESPLEGADA.**
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
  - ✅ **Agrupar mensajes seguidos (pedido antes de desplegar)**: si el
    cliente escribe su mensaje dividido en varias burbujas seguidas (ej.
    "Hola" / "quiero reservar" / "un corte para mañana"), el bot
    (`bot/index.js`) ahora espera 4 segundos de silencio desde el último
    mensaje y las junta en una sola consulta, en vez de procesar y
    responder cada una por separado.
  - ✅ **Entender notas de voz (pedido antes de desplegar)**: si el cliente
    manda un audio por WhatsApp, el bot lo descarga y lo transcribe a
    texto con la API de Whisper de OpenAI (`bot/transcribe.js`), y lo
    procesa igual que si lo hubiera escrito. **Requiere una clave nueva,
    `OPENAI_API_KEY`, en `bot/.env` (hoy vacía en Railway)** — se genera en
    platform.openai.com/api-keys, es pago por uso y muy barato (~$0.006 por
    minuto de audio, centavos por mes para el volumen de una peluquería).
    Sin esa clave configurada, el audio no se pierde en silencio: el bot
    simplemente cae en el flujo de "no entendí" que ya existe y le ofrece
    al cliente hablar directo con el peluquero. **Falta que el usuario
    cree la cuenta/clave en OpenAI y la cargue en Railway** para que la
    transcripción funcione de verdad.
  - ✅ **Desplegado** (Firebase Functions + Firestore rules, y Railway
    reconectó a WhatsApp sin pedir QR nuevo, usando la sesión guardada).
  - ✅ **`OPENAI_API_KEY` cargada en Railway y bot redesplegado** (el
    usuario creó la clave en platform.openai.com y la pasó; se cargó con
    `railway variable set --stdin` para no dejarla en el historial de
    comandos, y el bot se reconectó a WhatsApp sin problemas). La
    transcripción de notas de voz ya está activa de verdad — falta
    probarla en vivo mandándole un audio real al bot.
- 🐛 **Bug real encontrado y corregido: el bot tardaba mucho en responder a
  los números del menú.** El usuario probó en vivo: al pedir una cita "en
  el número 1" pareció que la cita se confirmó sola, sin preguntar día y
  hora, y en general notó que tardaba mucho en responder a cualquier
  mensaje o botón. Causa real: el "agrupar mensajes seguidos" de la ronda
  anterior (`bot/index.js`, esperar 4 segundos antes de procesar, pensado
  para cuando alguien escribe una frase en varios globos) se aplicaba a
  **todos** los mensajes, incluidos los números sueltos del menú (1, 2,
  3...) que son respuestas cerradas a una pregunta que el bot ya hizo —
  no había nada que "esperar a que termine de escribir". Con esa demora
  de 4 segundos en cada paso, si el cliente perdía la paciencia y volvía
  a tocar "1" (que en realidad iba avanzando el flujo: servicio → día →
  hora), las respuestas llegaban todas juntas y con retraso, dando la
  sensación de que se había saltado los pasos.
  - ✅ **Corregido**: ahora un mensaje que es un solo dígito (0-9) se
    procesa al instante, sin esperar. La espera de 4 segundos se mantiene
    solo para mensajes que no son un número suelto (texto libre escrito
    en varios globos), que es el caso para el que se había pensado.
  - ✅ **Desplegado** en Railway (`railway up`), el bot se reconectó a
    WhatsApp sin pedir QR nuevo.
- 🐛 **Segundo bug real encontrado y corregido, relacionado con el
  anterior: el bot siempre volvía al menú principal, sin importar lo que
  el cliente escribiera.** El usuario lo notó apenas se probó el arreglo
  de la demora. Causa: al hacer que los números sueltos se procesen al
  instante (sin esperar los 4 segundos), quedó abierta la posibilidad de
  que **dos mensajes seguidos del mismo cliente se procesaran al mismo
  tiempo** (por ejemplo, dos números tocados muy rápido uno después del
  otro). Cuando eso pasa, los dos leen el mismo estado guardado de la
  conversación en Firestore (por ejemplo "esperando que elija un día"),
  cada uno lo procesa por su cuenta, y el que termina de guardar último
  pisa el avance del otro — el cliente ve que el bot "se pierde" y
  siempre termina mostrando el menú principal de nuevo, sin importar qué
  haya escrito.
  - ✅ **Corregido**: ahora los mensajes de un mismo cliente (sea la vía
    rápida de un solo número o el agrupado de texto libre) se encadenan
    y se procesan siempre **uno por vez, en el orden en que llegaron**
    (`runSerialized` en `bot/index.js`) — nunca dos al mismo tiempo para
    el mismo número de teléfono.
  - ✅ **Desplegado** en Railway.
  - ⬜ **Falta que el usuario pruebe de nuevo en vivo** una reserva
    completa (varios números seguidos, rápido) para confirmar que ahora
    el bot no pierde el hilo y responde rápido.
- ✅ **Finanzas (ingresos, gastos y suscripción de pago) — PROGRAMADA Y
  DESPLEGADA, FALTA CONFIGURAR STRIPE DE VERDAD.** El
  usuario pidió explícitamente cobro automático real con tarjeta (no un
  simple recordatorio), sabiendo que implica crear una cuenta de negocio
  en Stripe.
  - ✅ **Resumen de ingresos**: nueva pantalla "Finanzas" (menú del panel,
    ícono 💰) muestra los ingresos de hoy y del mes, calculados como
    citas completadas × precio del servicio — ya funciona con los datos
    reales de Firestore, no depende de Stripe.
  - ✅ **Gastos**: se pueden cargar gastos (alquiler, agua/luz, empleados,
    insumos, otro) con fecha y descripción; la pantalla muestra el total
    del mes y la ganancia neta (ingresos menos gastos) — nueva colección
    `expenses` en Firestore.
  - ✅ **Suscripción de pago (Stripe) — código construido, NO configurado
    todavía**: `functions/src/stripe.ts` crea una sesión de pago
    hospedada por Stripe (Checkout) para suscribirse, y un portal de
    Stripe para gestionar o cancelar la tarjeta; un webhook
    (`stripeWebhook`) mantiene actualizado el estado en Firestore
    (activa / vencida / cancelada, próximo cobro) cada vez que Stripe
    cobra, falla un cobro, o se cancela. Por seguridad, el campo
    `branch.subscription` ahora solo lo puede escribir el webhook (SDK de
    administrador) — ningún usuario del panel puede marcarse a sí mismo
    como "pagado" sin pagar de verdad.
  - ⬜ **Falta que el usuario cree la cuenta de Stripe y configure 3
    cosas** (no lo puedo hacer yo, requiere datos reales del negocio):
    1. Crear la cuenta en stripe.com (datos del negocio + cuenta bancaria
       para recibir los pagos).
    2. En el Dashboard: Developers → API keys → copiar la "Secret key" →
       pegarla en `STRIPE_SECRET_KEY` (functions/.env).
    3. Crear el producto de la suscripción (Product catalog → Add
       product), con un precio recurrente mensual (ej. ₪X/mes) → copiar
       el "API ID" del precio (empieza con `price_...`) → pegarlo en
       `STRIPE_PRICE_ID`.
    4. Developers → Webhooks → Add endpoint, apuntando a
       `https://us-central1-bot-para-peluqueria.cloudfunctions.net/stripeWebhook`,
       con los eventos `checkout.session.completed`, `invoice.paid`,
       `invoice.payment_failed`, `customer.subscription.deleted` → copiar
       el "Signing secret" (empieza con `whsec_...`) → pegarlo en
       `STRIPE_WEBHOOK_SECRET`.
    5. Cargar también `FUNCTIONS_BASE_URL` (la misma URL base de siempre,
       sin slash final) en `functions/.env` — la usa Stripe para volver a
       una página de "listo" después de pagar.
    Sin esto configurado, el botón "Suscribirse" de la pantalla de
    Finanzas muestra un aviso claro ("los pagos todavía no están
    configurados") en vez de fallar en silencio.
  - ✅ **Desplegado** (las 4 Cloud Functions de Stripe ya están activas en
    `bot-para-peluqueria`: `stripeCreateCheckoutSession`,
    `stripeCustomerPortal`, `stripeCheckoutDone`, `stripeWebhook`).
    Falta cargar las 4 variables de Stripe cuando el usuario tenga su
    cuenta lista, y probar una suscripción de verdad (Stripe tiene modo
    de prueba con tarjetas falsas antes de pasar a cobros reales).
  - ✅ **Resuelto — Tranzila agregado para Israel.** Confirmado en
    stripe.com/global que Stripe no está disponible en Israel ni Venezuela
    (solo México), así que se agregó **Tranzila** (`functions/src/tranzila.ts`)
    como pasarela alternativa:
    - `branch.subscription.provider` (`'stripe'` | `'tranzila'`) decide
      cuál se usa; la pantalla de Finanzas elige sola según el idioma de
      la sucursal (hebreo → Tranzila, el resto → Stripe).
    - `tranzilaCreateCheckoutUrl` arma la página de pago alojada por
      Tranzila (ahí se valida la tarjeta, se cobra el primer mes y se
      genera un token); `tranzilaNotify` recibe el resultado y guarda el
      token; `tranzilaCancelSubscription` cancela.
    - Como Tranzila no gestiona el calendario de cobros solo en la cuenta
      base (eso es un módulo pago aparte, "My Billing"), se armó un cron
      propio (`chargeTranzilaSubscriptions`, diario 08:00) que cobra el
      token guardado cada vez que vence el mes — el "cobro recurrente" lo
      arma el sistema, no Tranzila.
    - ✅ **Ya desplegado** en `bot-para-peluqueria` (5 funciones nuevas).
    - ⚠️ **Se armó con la documentación pública de Tranzila** (algunas
      páginas de su documentación oficial no estaban indexadas al momento
      de programarlo) — **hay que probarlo primero en el terminal de
      pruebas (sandbox) que Tranzila da al crear la cuenta**, antes de
      confiar en él para cobros reales.
    - ⬜ **Falta que el usuario cree la cuenta en tranzila.com** y cargue 3
      variables nuevas en `functions/.env`: `TRANZILA_TERMINAL_NAME`
      (nombre del terminal), `TRANZILA_PASSWORD` (la "contraseña de
      transacciones" del panel del terminal, no la contraseña de acceso),
      y `TRANZILA_SUBSCRIPTION_SUM` (precio mensual en shéquels, sin
      símbolo). `FUNCTIONS_BASE_URL` es la misma que ya se usa para Stripe.
    - Ver el estudio de mercado completo (artifact "Radar Competitivo")
      para el detalle país por país.
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
  - ⬜ **CRM — base de datos completa de clientes con sus datos** (pedido
    explícito del usuario, todavía sin arrancar). Ojo: ya existe una base
    de esto — la colección `clients` en Firestore (teléfono, nombre,
    cumpleaños, cortes completados, ausencias) y la pestaña "Clientes" del
    panel — pero hay que revisar con el usuario qué le falta para que sea
    un CRM de verdad (¿historial completo de citas por cliente?, ¿notas
    del peluquero sobre cada cliente?, ¿exportar la lista?, ¿algo más?)
    antes de construir nada nuevo.
  - ⬜ **Plan de respuesta ante errores** (pedido explícito del usuario,
    todavía sin arrancar): tener listas las herramientas para detectar y
    arreglar un problema lo antes posible si el sistema falla. Ya existe
    una pieza suelta de esto (el "Modo mantenimiento" en Ajustes, que
    pausa el bot/IVR a mano y deriva todo al peluquero), pero falta lo
    importante: **algo que avise automáticamente** cuando algo se cae
    (ej. el bot se desconecta de WhatsApp, una Cloud Function empieza a
    fallar) en vez de enterarse porque un cliente se queja. Pensar con el
    usuario: ¿alertas por mail/WhatsApp al propio peluquero o al
    desarrollador?, ¿qué tan rápido hay que reaccionar?, ¿alcanza con los
    logs de Firebase/Railway o conviene un servicio de monitoreo aparte?
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
