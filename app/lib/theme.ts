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
