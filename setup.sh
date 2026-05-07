#!/bin/bash
# Script de configuración de Yeshiva Contacts App
# Ejecutar: bash setup.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Yeshiva Contacts App — Setup         ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ── Firebase Web App credentials (for Expo app) ──────────────────────────────
echo -e "${YELLOW}PASO 1: Credenciales Firebase (App Web)${NC}"
echo "  Ve a: Firebase Console → Project Settings → General → Tu app web"
echo ""

read -p "  Firebase API Key:        " FIREBASE_API_KEY
read -p "  Firebase Auth Domain:    " FIREBASE_AUTH_DOMAIN
read -p "  Firebase Project ID:     " FIREBASE_PROJECT_ID
read -p "  Firebase App ID:         " FIREBASE_APP_ID

cat > app/.env <<EOF
EXPO_PUBLIC_FIREBASE_API_KEY=$FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_APP_ID=$FIREBASE_APP_ID
EOF

echo -e "  ${GREEN}✓ app/.env creado${NC}"
echo ""

# ── Firebase Admin SDK (for bot) ─────────────────────────────────────────────
echo -e "${YELLOW}PASO 2: Credenciales Firebase Admin (Bot)${NC}"
echo "  Ve a: Firebase Console → Project Settings → Service Accounts → Generate new private key"
echo "  Abre el JSON descargado y copia los campos:"
echo ""

read -p "  client_email:    " BOT_CLIENT_EMAIL
read -p "  Project ID:      " BOT_PROJECT_ID
echo "  private_key (pega todo el texto entre comillas, Enter al terminar):"
read -p "  > " BOT_PRIVATE_KEY

cat > bot/.env <<EOF
FIREBASE_PROJECT_ID=$BOT_PROJECT_ID
FIREBASE_CLIENT_EMAIL=$BOT_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY="$BOT_PRIVATE_KEY"
WA_GROUP_ID=
EOF

echo -e "  ${GREEN}✓ bot/.env creado${NC}"
echo ""

# ── Deploy Firestore rules ────────────────────────────────────────────────────
echo -e "${YELLOW}PASO 3: Desplegando reglas de Firestore...${NC}"
if command -v firebase &> /dev/null; then
  firebase use "$FIREBASE_PROJECT_ID" --non-interactive 2>/dev/null || true
  firebase deploy --only firestore:rules --project "$FIREBASE_PROJECT_ID"
  echo -e "  ${GREEN}✓ Reglas de Firestore desplegadas${NC}"
else
  echo -e "  ${YELLOW}⚠ Firebase CLI no instalado. Ejecuta luego:${NC}"
  echo "     npx firebase-tools deploy --only firestore:rules --project $FIREBASE_PROJECT_ID"
fi
echo ""

# ── Done ─────────────────────────────────────────────────────────────────────
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ¡Configuración completada!            ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Próximos pasos:"
echo ""
echo -e "  ${BLUE}1. Arrancar el bot (escanea el QR con tu teléfono):${NC}"
echo "     cd bot && node index.js"
echo "     → Cuando veas los IDs de grupos, copia el correcto en bot/.env (WA_GROUP_ID=)"
echo "     → Luego reinicia: node index.js"
echo ""
echo -e "  ${BLUE}2. Arrancar la app:${NC}"
echo "     cd app && npx expo start"
echo "     → Escanea el QR con Expo Go en tu teléfono"
echo ""
