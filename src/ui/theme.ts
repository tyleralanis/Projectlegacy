import { useColorScheme } from 'react-native';

import { useGame } from '@/state/GameProvider';

export const lightColors = {
  canvas: '#F8F4EC',
  surface: '#FFFDFC',
  secondary: '#EEF4F1',
  text: '#20282B',
  textSecondary: '#69757A',
  border: '#DFE5E2',
  accent: '#287B78',
  accentSoft: '#DDF1EC',
  legacy: '#D09A3F',
  success: '#3F7657',
  danger: '#A84A4A',
  warning: '#9A6B24',
  shadow: '#142126',
};

export const darkColors = {
  canvas: '#101719',
  surface: '#182124',
  secondary: '#223033',
  text: '#F5F4EF',
  textSecondary: '#AAB5B6',
  border: '#304044',
  accent: '#78C4BF',
  accentSoft: '#24413E',
  legacy: '#E0B366',
  success: '#78B28F',
  danger: '#DB7777',
  warning: '#E0B366',
  shadow: '#000000',
};

export const highContrastLightColors = { ...lightColors, canvas: '#FFFFFF', surface: '#FFFFFF', secondary: '#E8E8E8', text: '#000000', textSecondary: '#343434', border: '#505050', accent: '#004E59', legacy: '#744C00', success: '#005B32', danger: '#8A0000', warning: '#684600' };
export const highContrastDarkColors = { ...darkColors, canvas: '#000000', surface: '#000000', secondary: '#1E1E1E', text: '#FFFFFF', textSecondary: '#E0E0E0', border: '#B8B8B8', accent: '#8CEAF4', legacy: '#FFD271', success: '#83E6AE', danger: '#FF8B8B', warning: '#FFD271' };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { sm: 10, md: 14, card: 18, pill: 999 } as const;

export function useAppTheme() {
  const scheme = useColorScheme();
  const { world } = useGame();
  const dark = scheme === 'dark';
  const highContrast = world?.settings.highContrast ?? false;
  return { dark, colors: highContrast ? (dark ? highContrastDarkColors : highContrastLightColors) : (dark ? darkColors : lightColors) };
}

export type AppColors = typeof lightColors;
