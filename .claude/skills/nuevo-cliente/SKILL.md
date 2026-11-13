---
name: nuevo-cliente
description: Da de alta una barbería/manicurista nueva que compró el bot, de punta a punta — cuenta del panel con mes gratis, peluquero y servicios, número de teléfono propio en Telnyx con el IVR, el mismo número en la API oficial de WhatsApp, y el mensaje de bienvenida listo para mandarle. Usar cuando el usuario diga "tengo un nuevo cliente", "dar de alta una barbería", "/nuevo-cliente", o pase los datos de un negocio nuevo.
---

# /nuevo-cliente — alta completa de una barbería

El usuario (dueño del sistema, NO técnico) dice "tengo un nuevo cliente" y
pasa los datos. Esta skill arma todo. Seguir las reglas de CLAUDE.md:
explicar en simple antes de cada paso, verificar después.

**Nunca sin permiso explícito del usuario en ESTA conversación:**
comprar un número (cuesta plata), cambiar la configuración de un número o
app de Telnyx que ya atiende llamadas, o mandarle algo a la barbería.
Nunca pedir que peguen claves en el chat: van en Railway (Variables).

## 0. Datos a juntar (preguntar solo lo que falte, todo en un mensaje)

| Dato | Ejemplo | Obligatorio |
|---|---|---|
| Nombre del negocio (como lo verán los clientes) | המספרה של דני | sí |
| Mail del dueño (para entrar al panel) | dani@gmail.com | sí |
| Nombre del peluquero principal | דני | sí |
| Celular personal del peluquero (recibe avisos) | 972501234567 | sí |
| Servicios: nombre, minutos, precio | תספורת 20 min ₪60 | sí, al menos 1 |
| Horario semanal | dom-jue 9-19, vie 9-14 | no (usa ese por defecto, sábado cerrado) |
| Idioma | he / es / en | no (he) |

Si el usuario solo da "el número" (como pidió), pedir el resto en una sola
pregunta corta. Guardar los datos en un JSON en el scratchpad (nunca en el
repo: tiene datos personales).

## 1. Cuenta del panel + mes gratis + peluquero + servicios

```bash
cd /home/user/whatapp/bot && npm ci --silent   # solo si falta node_modules
node ../.claude/skills/nuevo-cliente/crear-cuenta.mjs <datos.json> --dry-run   # mostrar y confirmar
railway run --service bot-peluqueria node ../.claude/skills/nuevo-cliente/crear-cuenta.mjs <datos.json>
```

`datos.json`: `{ "name", "email", "ownerName", "ownerPhone", "language"?, "hours"?, "services": [{"name","minutes","price"}] }`
(`hours` como `WeeklyHours` de `shared/types.ts`: `{"0":{"start":"09:00","end":"19:00"}, ..., "6":null}`).

Imprime `LISTO branchId=...`, el mail y una **contraseña provisoria**. La
barbería la tiene que cambiar al entrar (pantalla obligatoria del panel).
La contraseña va SOLO en el mensaje de bienvenida (paso 5), no en commits
ni en CLAUDE.md.

Verificar: que la barbería aparezca en el panel → Más → "Mis clientes"
(estado "mes gratis").

## 2. Número de teléfono en Telnyx (llamadas / IVR) — CUESTA PLATA

Requiere `TELNYX_API_KEY` en Railway (servicio `bot-oficial-prueba`). Si
no está, pedirle al usuario que la cargue en Railway → Variables (no en el
chat). Leerla así, sin imprimirla:
`KEY=$(cd bot && railway variables --service bot-oficial-prueba --kv | grep '^TELNYX_API_KEY=' | cut -d= -f2-)`

1. Saldo: `GET https://api.telnyx.com/v2/balance`. Un número de Israel
   cuesta ~US$3 de alta + ~US$3/mes. Si queda poco saldo, avisar (si llega a
   0 el IVR de TODAS las barberías deja de atender).
2. Buscar: `GET /v2/available_phone_numbers?filter[country_code]=IL&filter[features][]=voice&filter[limit]=5`
   (los de Israel no se pueden elegir por ciudad: vienen con prefijo
   072/073/076/077).
3. **Mostrar el número y el precio, y pedir permiso con AskUserQuestion.**
4. Comprar: `POST /v2/number_orders {"phone_numbers":[{"phone_number":"+9727..."}]}`.
   Si queda "pending" pidiendo documentos de EMPRESA: es el mismo error del
   piloto — se resolvió por el chat de soporte de Telnyx pidiendo pasarlo a
   "individuo". Explicárselo al usuario.
5. IVR propio de la barbería (NO tocar la app TeXML del piloto,
   `3074130028892522349`):
   `POST /v2/texml_applications {"friendly_name":"IVR <nombre>","voice_url":"https://us-central1-bot-para-peluqueria.cloudfunctions.net/ivrIncomingCall?branchId=<branchId>","voice_method":"post"}`
   y asignarla al número: `PATCH /v2/phone_numbers/<id> {"connection_id":"<id de la app>"}`.
6. Guardar el número en la barbería: `branches/<branchId>.phone` sigue siendo
   el celular del peluquero (a donde transfiere el "0" del IVR); el número del
   IVR va en el texto de bienvenida. Verificar llamando o con
   `GET /v2/phone_numbers/<id>` (status active, connection_id correcto).

## 3. El mismo número en la API oficial de WhatsApp

Datos fijos (ver CLAUDE.md): cuenta de WhatsApp "Azulay Digital"
`992568343309292`, app "BOT DE CITAS". Token: `WA_ACCESS_TOKEN` de
`bot-oficial-prueba`, leído igual que la clave de Telnyx.

**Límites que hay que avisarle al usuario antes de empezar:**
- Mientras el negocio "Azulay Digital" no tenga la **verificación del
  negocio** de Meta, la cuenta admite como máximo **2 números** y 250
  destinatarios por día. Con el 076 del piloto ya se usa 1.
- Mientras la cuenta esté en revisión (`account_review_status: PENDING`),
  Meta no deja hacer el `register` (paso 3.4). Consultar:
  `GET /992568343309292?fields=account_review_status`.

1. Agregar: `POST /992568343309292/phone_numbers {"cc":"972","phone_number":"<sin 0 inicial>","verified_name":"<nombre del negocio>"}`
   → devuelve el `phone_number_id`. (Si la API no deja, hacerlo desde el
   Administrador de WhatsApp como con el 076, y leer el id con
   `GET /992568343309292/phone_numbers`.)
2. Código por llamada: Meta llama al número nuevo, que atiende el IVR. Para
   escuchar el código, desviar la llamada un rato — **pedir permiso**:
   cambiar el `voice_url` de la app TeXML DE ESTA BARBERÍA (nunca la del
   piloto) a un XML estático con `<Response><Dial>+972...celular del
   usuario</Dial></Response>` publicado en Firebase Hosting
   (`website/<nombre-al-azar>.xml`, `voice_method: get`, agregar `?v=1`
   para evitar caché). Después: `POST /<pnid>/request_code {"code_method":"VOICE","language":"he"}`,
   el usuario dice el código, `POST /<pnid>/verify_code {"code":"..."}`.
   **Restaurar el `voice_url` del IVR (POST) y borrar el XML.** Verificar
   que el IVR vuelva a atender.
3. Nombre visible: el `verified_name` queda en revisión de Meta.
4. Registrar (necesita la cuenta APROBADA): PIN de 6 dígitos nuevo, guardado
   en Railway como `WA_PIN_<branchId>` en `bot-oficial-prueba` (pedirle al
   usuario que lo cargue, o con `railway variable set --stdin`), y
   `POST /<pnid>/register {"messaging_product":"whatsapp","pin":"<pin>"}`.
   Verificar `GET /<pnid>?fields=status` → `CONNECTED`.
5. La cuenta ya está suscrita a la app (`subscribed_apps`), así que los
   mensajes llegan solos al mismo webhook.

## 4. Conectar el número a la barbería

```bash
cd /home/user/whatapp/bot && railway run --service bot-peluqueria node ../.claude/skills/nuevo-cliente/conectar-whatsapp.mjs <branchId> <phoneNumberId>
```

El bot oficial (`bot-oficial-prueba`) lee `branches.whatsappPhoneNumberId`
en vivo y empieza a atender ese número sin redesplegar (log de Railway:
`[bot] números atendidos: {...}`). Ese campo está bloqueado en
`firestore.rules`: solo se cambia con este script.

Probar: mandar "שלום" al número nuevo desde un celular de prueba → debe
responder con el nombre de la barbería nueva (no la del piloto). Cancelar
desde el panel cualquier cita de prueba.

## 5. Mensaje de bienvenida (para que el usuario se lo mande)

Armarlo en el idioma de la barbería, para copiar y pegar. NO mandarlo uno
mismo. Incluye:
- Link del panel: https://bot-para-peluqueria.web.app (se puede "agregar a
  la pantalla de inicio" para usarlo como app).
- Mail y contraseña provisoria (pide cambiarla al entrar).
- Número del bot para WhatsApp y teléfono (el mismo).
- Mes gratis hasta <fecha>; después Básico ₪99/mes (250 citas) o Pro ₪150;
  se elige y se carga la tarjeta en Ajustes → "Mi plan".
- Para pedir cambios (cortes, peluqueros, horarios): Ajustes → "Pedidos de
  cambio".

## 6. Cerrar

- Anotar en CLAUDE.md (sección de clientes): nombre, branchId, número,
  fecha de alta, fin del mes gratis — SIN mail ni contraseña.
- Hacer commit solo de cambios de código/documentación (nunca el JSON de
  datos).
- Resumirle al usuario qué quedó listo y qué falta (por ejemplo, el
  `register` si la cuenta de Meta sigue en revisión).
