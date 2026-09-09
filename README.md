# Citas Peluquería — reserva automática por WhatsApp y teléfono

Sistema de citas para una peluquería en Israel. Los clientes reservan solos,
sin que el peluquero tenga que atender el teléfono para cada cita:

- **WhatsApp**: bot conversacional que agenda, cancela, confirma recordatorios y ofrece huecos liberados.
- **Teléfono (IVR)**: para clientes con teléfono kasher que no usan WhatsApp — llaman y agendan con el teclado, con voz en hebreo.
- **Sin dobles reservas**: WhatsApp, teléfono y la app de administración comparten el mismo motor de reservas con transacciones atómicas en Firestore.
- **App del peluquero**: agenda del día, ajuste de horarios/días bloqueados por peluquero, sucursales, servicios, clientes, lista de espera y campañas.

## Funciones incluidas

| Función | Dónde vive |
|---|---|
| Reserva por WhatsApp (menú conversacional) | `bot/` |
| Reserva por teléfono (IVR en hebreo, Twilio) | `functions/src/ivr.ts` |
| Anti-doble-reserva (transacción Firestore) | `functions/src/booking.ts` |
| Recordatorio 24h/2h + confirmar con "1" o cancelar con "2" | `functions/src/crons.ts`, `functions/src/notify.ts` |
| Aviso al peluquero cuando alguien cancela | `functions/src/booking.ts` (`cancelledByClient`) |
| Lista de espera con oferta automática del hueco liberado | `functions/src/waitlist.ts` |
| Depósito previo para clientes con historial de inasistencias | `functions/src/booking.ts` (`pending_deposit`) |
| Clasificación de no-show | `functions/src/booking.ts` (`markNoShow`) |
| Reserva recurrente ("todos los jueves a las 18:00") | `functions/src/crons.ts` (`generateRecurringAppointments`) |
| Fidelidad: descuento cada 10 cortes | `functions/src/loyalty.ts` |
| Mensaje de cumpleaños | `functions/src/crons.ts` (`sendBirthdayMessages`) |
| Campaña de horas vacías | `functions/src/campaigns.ts`, tab "Campañas" en la app |
| Sincronización opcional con Google Calendar | `functions/src/googleCalendar.ts` |
| Varias sucursales | `branches` en Firestore, un bot por número de WhatsApp |
| Modo Shabat (cerrado / silencioso / desactivado) | `functions/src/shabbat.ts` (horarios reales vía Hebcal) |

## Estructura del proyecto

```
whatapp/
├── app/          # App Expo (React Native) — panel del peluquero
├── bot/          # Bot de WhatsApp (Baileys) — Node.js
├── functions/    # Cloud Functions — motor de reservas, crons, IVR, notificaciones
├── shared/       # Tipos y lógica de disponibilidad compartidos
├── firestore.rules
├── firestore.indexes.json
└── firebase.json
```

## Cómo funciona el flujo de una reserva

```
Cliente escribe por WhatsApp / llama por teléfono
                    │
                    ▼
     bot/ (Baileys)  o  functions/src/ivr.ts (Twilio)
                    │
                    ▼
     functions/src/booking.ts → transacción Firestore
     (comprueba que el peluquero esté libre en ese horario)
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   Cita confirmada      Horario ocupado → se ofrece
   + WhatsApp al         otro horario / lista de espera
   cliente y al
   peluquero
                    │
                    ▼
   functions/src/crons.ts: recordatorio 24h/2h antes,
   marca no-show, libera depósitos vencidos, cumpleaños,
   genera las próximas reservas recurrentes
```

La app de administración (`app/`) lee y escribe sobre la misma base de datos,
así que una cita creada a mano por el peluquero bloquea igual el horario para
WhatsApp y teléfono.

## Configuración inicial

Puedes usar `bash setup.sh` para el asistente interactivo, o configurar a mano:

### 1. Firebase
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Activa **Firestore**, **Authentication** (email/password) y **Functions** (plan Blaze, necesario para llamadas salientes a Twilio/Hebcal)
3. Crea un usuario admin en Authentication (será quien entra a la app del peluquero)
4. Descarga la Service Account (Project Settings → Service Accounts) para `bot/.env`

### 2. Cloud Functions (`functions/`)
```bash
cd functions
cp .env.example .env   # completa Twilio, Google Calendar y BOT_SHARED_SECRET
npm install
npm run deploy
```
`BOT_SHARED_SECRET` es un secreto propio (genera uno con `openssl rand -hex 32`)
que debe coincidir exactamente con el de `bot/.env` — así el bot puede pedirle
al backend que cree/cancele citas sin ser un usuario de Firebase Auth.

Twilio y Google Calendar son **opcionales**: sin ellos, todo sigue funcionando
por WhatsApp; simplemente no habrá línea telefónica ni sincronización de
calendario hasta que se configuren.

### 3. Bot de WhatsApp (`bot/`)
```bash
cd bot
cp .env.example .env   # completa las variables (incluye BRANCH_ID)
npm install
node index.js          # escanea el QR con el teléfono de la sucursal
```
Cada número de WhatsApp corresponde a una sucursal (`BRANCH_ID`). Para varias
sucursales, corre una instancia del bot por cada número.

### 4. App Expo (`app/`)
```bash
cd app
cp .env.example .env   # completa las variables de Firebase y EXPO_PUBLIC_FUNCTIONS_BASE_URL
npm install
npx expo start
```
Desde el "Panel del peluquero" se crean la sucursal, los peluqueros (con su
horario semanal y días bloqueados), los servicios y se configura el modo
Shabat, los depósitos y la conexión con Google Calendar.

### 5. Teléfono / IVR (opcional, Twilio)
1. Compra un número en [Twilio](https://www.twilio.com/console/phone-numbers).
2. En "A CALL COMES IN" configura el webhook:
   `https://<region>-<proyecto>.cloudfunctions.net/ivrIncomingCall?branchId=<id de la sucursal>`
3. Ese número es el que se le da a los clientes con teléfono kasher.

## Límites conocidos / próximos pasos

- El link de pago del depósito (`templates.depositRequired`) hoy es solo un
  aviso; falta conectar una pasarela de pago real (ej. Tranzila, Cardcom,
  Stripe) para cobrar y confirmar automáticamente.
- El IVR asume un solo servicio "principal" por sucursal al agendar por
  teléfono (agenda el próximo hueco libre); para elegir servicio por voz
  se necesitaría un menú de voz adicional.
- Twilio "Say" en `he-IL` depende de qué voces tenga habilitadas la cuenta de
  Twilio en esa región; conviene probarlo antes de dar el número a clientes.
