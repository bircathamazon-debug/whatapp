import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Que la sesión quede guardada en el navegador (no hay que ingresar el
// usuario/contraseña cada vez que se abre la página) — importante: esto NO
// guarda la contraseña en ningún lado, solo mantiene la sesión ya iniciada,
// igual que "recordar sesión" en cualquier app. No funciona en pestañas de
// incógnito/privadas, que por diseño no guardan nada — eso es normal.
setPersistence(auth, browserLocalPersistence).catch(() => {});
