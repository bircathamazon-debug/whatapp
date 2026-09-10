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
  - ⬜ **Bloqueado esperando al usuario**: comprar la línea nueva dedicada
    para el bot (distinta del número personal del peluquero) y conectarla
    escaneando el QR de WhatsApp.
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
