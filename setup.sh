#!/bin/bash
# Script de configuración del sistema de citas de la peluquería
# Ejecutar: bash setup.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Citas Peluquería — Setup             ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ── Firebase Web App credentials (app Expo) ─────────────────────────────────
echo -e "${YELLOW}PASO 1: Credenciales Firebase (App Web)${NC}"
echo "  Ve a: Firebase Console → Project Settings → General → Tu app web"
echo ""

read -p "  Firebase API Key:        " FIREBASE_API_KEY
read -p "  Firebase Auth Domain:    " FIREBASE_AUTH_DOMAIN
read -p "  Firebase Project ID:     " FIREBASE_PROJECT_ID
read -p "  Firebase App ID:         " FIREBASE_APP_ID
read -p "  URL de Cloud Functions (ej. https://us-central1-PROYECTO.cloudfunctions.net): " FUNCTIONS_BASE_URL

cat > app/.env <<EOF
EXPO_PUBLIC_FIREBASE_API_KEY=$FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_APP_ID=$FIREBASE_APP_ID
EXPO_PUBLIC_FUNCTIONS_BASE_URL=$FUNCTIONS_BASE_URL
EOF

echo -e "  ${GREEN}✓ app/.env creado${NC}"
echo ""

# ── Firebase Admin SDK (bot de WhatsApp) ─────────────────────────────────────
echo -e "${YELLOW}PASO 2: Credenciales Firebase Admin (bot de WhatsApp)${NC}"
echo "  Ve a: Firebase Console → Project Settings → Service Accounts → Generate new private key"
echo "  Abre el JSON descargado y copia los campos:"
echo ""

read -p "  client_email:    " BOT_CLIENT_EMAIL
echo "  private_key (pega todo el texto entre comillas, Enter al terminar):"
read -p "  > " BOT_PRIVATE_KEY
read -p "  BRANCH_ID (id del documento en la colección 'branches' de Firestore): " BRANCH_ID
BOT_SHARED_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "cambia-este-secreto")

cat > bot/.env <<EOF
FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL=$BOT_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY="$BOT_PRIVATE_KEY"
FUNCTIONS_BASE_URL=$FUNCTIONS_BASE_URL
BOT_SHARED_SECRET=$BOT_SHARED_SECRET
BRANCH_ID=$BRANCH_ID
EOF

echo -e "  ${GREEN}✓ bot/.env creado${NC}"
echo ""

# ── Cloud Functions (Twilio, Google Calendar, secreto del bot) ──────────────
echo -e "${YELLOW}PASO 3: Cloud Functions (Twilio y Google Calendar son opcionales)${NC}"
read -p "  Twilio Account SID (Enter para omitir): " TWILIO_ACCOUNT_SID
read -p "  Twilio Auth Token (Enter para omitir): " TWILIO_AUTH_TOKEN
read -p "  Twilio Phone Number (Enter para omitir): " TWILIO_PHONE_NUMBER
read -p "  Google OAuth Client ID (Enter para omitir): " GOOGLE_OAUTH_CLIENT_ID
read -p "  Google OAuth Client Secret (Enter para omitir): " GOOGLE_OAUTH_CLIENT_SECRET

cat > functions/.env <<EOF
BOT_SHARED_SECRET=$BOT_SHARED_SECRET
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER
TWILIO_IVR_BASE_URL=$FUNCTIONS_BASE_URL
GOOGLE_OAUTH_CLIENT_ID=$GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET=$GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI=$FUNCTIONS_BASE_URL/googleCalendarCallback
EOF

echo -e "  ${GREEN}✓ functions/.env creado${NC}"
echo ""

# ── Deploy Firestore rules/indexes y Cloud Functions ─────────────────────────
echo -e "${YELLOW}PASO 4: Desplegando Firestore y Cloud Functions...${NC}"
if command -v firebase &> /dev/null; then
  firebase use "$FIREBASE_PROJECT_ID" --non-interactive 2>/dev/null || true
  firebase deploy --only firestore:rules,firestore:indexes --project "$FIREBASE_PROJECT_ID"
  (cd functions && npm install && npm run deploy)
  echo -e "  ${GREEN}✓ Firestore y Cloud Functions desplegados${NC}"
else
  echo -e "  ${YELLOW}⚠ Firebase CLI no instalado. Ejecuta luego:${NC}"
  echo "     npx firebase-tools deploy --only firestore:rules,firestore:indexes --project $FIREBASE_PROJECT_ID"
  echo "     cd functions && npm install && npm run deploy"
fi
echo ""

# ── Done ─────────────────────────────────────────────────────────────────────
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ¡Configuración completada!            ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Próximos pasos:"
echo ""
echo -e "  ${BLUE}1. Crea la sucursal, peluqueros y servicios desde la app (Panel del peluquero).${NC}"
echo ""
echo -e "  ${BLUE}2. Arranca el bot de WhatsApp (escanea el QR con el teléfono de la sucursal):${NC}"
echo "     cd bot && npm install && node index.js"
echo ""
echo -e "  ${BLUE}3. Arranca la app:${NC}"
echo "     cd app && npm install && npx expo start"
echo "     → Escanea el QR con Expo Go, o npx expo start --web"
echo ""
echo -e "  ${BLUE}4. (Opcional) Configura el número de Twilio para el IVR telefónico:${NC}"
echo "     'A CALL COMES IN' → Webhook → \$FUNCTIONS_BASE_URL/ivrIncomingCall?branchId=<id de la sucursal>"
echo ""
