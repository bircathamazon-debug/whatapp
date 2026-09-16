/**
 * Tema visual de la app (claro/oscuro), acordado con el usuario: línea de
 * tiempo compacta, fondo "gris niebla" en claro / "oscuro premium" en
 * oscuro, azul zafiro como acento y colores de estado vivos (no pasteles).
 * El modo se guarda en branch.themeMode (Firestore) y se controla desde
 * Ajustes con un switch — así el peluquero elige, no queda fijo.
 */
import { useBranch } from './branchContext';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  statusConfirmed: string;
  statusPending: string;
  statusCompleted: string;
  statusCancelled: string;
  statusNoShow: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
}

const light: ThemeColors = {
  bg: '#eef0f4',
  surface: '#ffffff',
  surfaceMuted: '#e4e7ec',
  border: '#e1e4ea',
  text: '#1c1f24',
  textMuted: '#71767d',
  accent: '#1d4ed8',
  accentSoft: '#e3ebfd',
  statusConfirmed: '#12915c',
  statusPending: '#e08e0b',
  statusCompleted: '#6b7280',
  statusCancelled: '#a39c85',
  statusNoShow: '#d1293d',
  danger: '#d1293d',
  dangerSoft: '#fdeaec',
  success: '#12915c',
  successSoft: '#e6f4ea',
};

const dark: ThemeColors = {
  bg: '#14161a',
  surface: '#1c1f25',
  surfaceMuted: '#23262c',
  border: '#2a2e35',
  text: '#eceef1',
  textMuted: '#8a8f98',
  accent: '#5b9dff',
  accentSoft: '#1c2c42',
  statusConfirmed: '#1fb673',
  statusPending: '#f0a63a',
  statusCompleted: '#9aa0a8',
  statusCancelled: '#5a5f66',
  statusNoShow: '#ef5350',
  danger: '#ef5350',
  dangerSoft: '#33201f',
  success: '#1fb673',
  successSoft: '#173226',
};

export function useTheme(): { mode: 'light' | 'dark'; colors: ThemeColors } {
  const { branches, branchId } = useBranch();
  const branch = branches.find((b) => b.id === branchId);
  const mode = branch?.themeMode === 'dark' ? 'dark' : 'light';
  return { mode, colors: mode === 'dark' ? dark : light };
}

/** Radios consistentes en toda la app — look de app nativa, no de web plana. */
export const RADIUS = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

/**
 * Sombra "flotante" consistente para tarjetas/botones (más marcada que el
 * borde plano anterior) — el detalle que hace que se sienta como una app
 * de celular top y no como una página web con recuadros.
 */
export function cardShadow(mode: 'light' | 'dark', level: 'sm' | 'md' | 'lg' = 'md') {
  const levels = {
    sm: { shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
    md: { shadowOffset: { width: 0, height: 4 }, shadowRadius: 14, elevation: 5 },
    lg: { shadowOffset: { width: 0, height: 10 }, shadowRadius: 24, elevation: 9 },
  } as const;
  return {
    shadowColor: '#000',
    shadowOpacity: mode === 'dark' ? 0.4 : 0.1,
    ...levels[level],
  };
}

/** Sombra de color debajo de botones primarios (efecto "glow") — un truco
 * típico de apps top para que el botón principal resalte más que un botón
 * plano gris/blanco. */
export function accentGlow(colors: ThemeColors, mode: 'light' | 'dark') {
  return {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: mode === 'dark' ? 0.45 : 0.3,
    shadowRadius: 14,
    elevation: 6,
  };
}
