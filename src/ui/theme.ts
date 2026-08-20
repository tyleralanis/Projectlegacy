import { useColorScheme } from 'react-native';

import { useGame } from '@/state/GameProvider';

export const lightColors = {
  canvas: '#F6F4EF',
  surface: '#FFFFFF',
  secondary: '#EEF2F1',
  text: '#182126',
  textSecondary: '#667279',
  border: '#DDE3E4',
  accent: '#1D5C63',
  accentSoft: '#DCE9E8',
  legacy: '#C18C37',
  success: '#2F6B4F',
  danger: '#A33A3A',
  warning: '#956A1E',
  shadow: '#142126',
};

export const darkColors = {
  canvas: '#0F1417',
  surface: '#171E22',
  secondary: '#20292E',
  text: '#F4F6F6',
  textSecondary: '#A5B0B5',
  border: '#2B373D',
  accent: '#6AA8AE',
  accentSoft: '#263D40',
  legacy: '#D5AA62',
  success: '#70A988',
  danger: '#D16A6A',
  warning: '#D5AA62',
  shadow: '#000000',
};

export const highContrastLightColors = { ...lightColors, canvas: '#FFFFFF', surface: '#FFFFFF', secondary: '#E8E8E8', text: '#000000', textSecondary: '#343434', border: '#505050', accent: '#004E59', legacy: '#744C00', success: '#005B32', danger: '#8A0000', warning: '#684600' };
export const highContrastDarkColors = { ...darkColors, canvas: '#000000', surface: '#000000', secondary: '#1E1E1E', text: '#FFFFFF', textSecondary: '#E0E0E0', border: '#B8B8B8', accent: '#8CEAF4', legacy: '#FFD271', success: '#83E6AE', danger: '#FF8B8B', warning: '#FFD271' };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { sm: 8, md: 12, card: 14, pill: 999 } as const;

export function useAppTheme() {
  const scheme = useColorScheme();
  const { world } = useGame();
  const dark = scheme === 'dark';
  const highContrast = world?.settings.highContrast ?? false;
  return { dark, colors: highContrast ? (dark ? highContrastDarkColors : highContrastLightColors) : (dark ? darkColors : lightColors) };
}

export type AppColors = typeof lightColors;
