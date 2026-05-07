# אנשי קשר — Yeshiva Contacts App

App móvil en hebreo para menahalim de yeshivot. Extrae contactos de un grupo de WhatsApp y los presenta clasificados por categoría y zona.

## Estructura del proyecto

```
whatapp/
├── app/          # Aplicación Expo (React Native) — RTL Hebrew
├── bot/          # Bot de WhatsApp (Baileys) — Node.js
├── shared/       # Tipos TypeScript compartidos
├── firestore.rules
└── firebase.json
```

## Configuración inicial

### 1. Firebase
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Activa **Firestore**, **Authentication** (email/password)
3. Crea un usuario admin en Authentication
4. Descarga la Service Account para el bot (Project Settings → Service Accounts)

### 2. Bot de WhatsApp (`bot/`)
```bash
cd bot
cp .env.example .env   # completa las variables
npm install
node index.js          # escanea el QR con el teléfono admin
```
La primera ejecución mostrará los IDs de todos los grupos. Copia el ID del grupo en `WA_GROUP_ID`.

### 3. App Expo (`app/`)
```bash
cd app
cp .env.example .env   # completa las variables de Firebase
npm install
npx expo start
```

## Flujo de datos

```
Grupo de WhatsApp → Bot Baileys → Firestore (approved:false)
                                        ↓
                              Admin revisa y aprueba
                                        ↓
                              App Expo muestra contactos
```

## Categorías incluidas
חשמלאים · אינסטלטורים · רופאים · שיפוצניקים · תחבורה · עורכי דין · רואי חשבון · מסעדות

## Zonas incluidas
בית שמש · ירושלים · מודיעין עילית · ביתר עילית · אשדוד · בני ברק · ארצי
