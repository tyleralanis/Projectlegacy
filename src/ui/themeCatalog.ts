import type { VisualThemeId } from '@/engine/types';

export type AmbientEffectKind = 'none' | 'petals' | 'shooting-star' | 'forest-wildlife' | 'soft-glow';

export const lightColors = {
  canvas: '#F8F4EC', surface: '#FFFDFC', secondary: '#EEF4F1', text: '#20282B', textSecondary: '#69757A', border: '#DFE5E2', accent: '#287B78', accentSoft: '#DDF1EC', legacy: '#D09A3F', success: '#3F7657', danger: '#A84A4A', warning: '#9A6B24', shadow: '#142126',
};
export type AppColors = typeof lightColors;

export const darkColors: AppColors = {
  canvas: '#101719', surface: '#182124', secondary: '#223033', text: '#F5F4EF', textSecondary: '#AAB5B6', border: '#304044', accent: '#78C4BF', accentSoft: '#24413E', legacy: '#E0B366', success: '#78B28F', danger: '#DB7777', warning: '#E0B366', shadow: '#000000',
};
export const highContrastLightColors: AppColors = { ...lightColors, canvas: '#FFFFFF', surface: '#FFFFFF', secondary: '#E8E8E8', text: '#000000', textSecondary: '#343434', border: '#505050', accent: '#004E59', accentSoft: '#E6F7FA', legacy: '#744C00', success: '#005B32', danger: '#8A0000', warning: '#684600', shadow: '#000000' };
export const highContrastDarkColors: AppColors = { ...darkColors, canvas: '#000000', surface: '#000000', secondary: '#1E1E1E', text: '#FFFFFF', textSecondary: '#E0E0E0', border: '#B8B8B8', accent: '#8CEAF4', accentSoft: '#14383D', legacy: '#FFD271', success: '#83E6AE', danger: '#FF8B8B', warning: '#FFD271', shadow: '#000000' };

const cherryColors: AppColors = {
  canvas: '#FFF9F7', surface: '#FFFEFC', secondary: '#FCEDEF', text: '#33292A', textSecondary: '#846F73', border: '#F1CCD2', accent: '#E85D75', accentSoft: '#FCE4E9', legacy: '#C98A6A', success: '#5F9C78', danger: '#C75664', warning: '#B77B48', shadow: '#7C4A55',
};
const midnightColors: AppColors = {
  canvas: '#06131F', surface: '#0B1B27', secondary: '#102A38', text: '#F5F2EA', textSecondary: '#A9BAC5', border: '#244758', accent: '#38D5DA', accentSoft: '#103C47', legacy: '#D7A74B', success: '#75C98F', danger: '#E06E78', warning: '#E0B258', shadow: '#000000',
};
const forestColors: AppColors = {
  canvas: '#F2EBD9', surface: '#FCF5E5', secondary: '#E5E7D1', text: '#2D3E2E', textSecondary: '#66705B', border: '#D5D0B9', accent: '#526C48', accentSoft: '#DDE4CE', legacy: '#C69244', success: '#5D7C51', danger: '#A65B4D', warning: '#A57D42', shadow: '#4C4A37',
};
const minimalColors: AppColors = {
  canvas: '#F7F9FC', surface: '#FFFFFF', secondary: '#EFF4FA', text: '#13223B', textSecondary: '#6E7C90', border: '#DDE5EF', accent: '#3973D1', accentSoft: '#E8F0FC', legacy: '#8B78C5', success: '#3E9F89', danger: '#C95E69', warning: '#B5813E', shadow: '#3B4A64',
};

export interface ThemePreset {
  id: VisualThemeId;
  name: string;
  description: string;
  appearance: 'system' | 'light' | 'dark';
  light: AppColors;
  dark?: AppColors;
  backgroundGradient: readonly [string, string, string];
  motif: 'none' | 'sakura' | 'stars' | 'forest' | 'geometry';
  ambient: { kind: AmbientEffectKind; label: string; detail: string };
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 'classic', name: 'Classic Legacy', description: 'The original warm, editorial Project Legacy look. Follows your device light or dark appearance.', appearance: 'system', light: lightColors, dark: darkColors, backgroundGradient: ['#F8F4EC', '#F6F4EE', '#EEF4F1'], motif: 'none', ambient: { kind: 'none', label: 'No ambient scene', detail: 'Classic stays still and focused.' } },
  { id: 'cherry-blossom', name: 'Cherry Blossom', description: 'Warm white, blush pink, soft rose, and elegant spring details.', appearance: 'light', light: cherryColors, backgroundGradient: ['#FFFDFC', '#FFF6F5', '#FDECEF'], motif: 'sakura', ambient: { kind: 'petals', label: 'Falling sakura petals', detail: 'A quiet petal drift crosses the screen about every 3–4 minutes.' } },
  { id: 'midnight-luxe', name: 'Midnight Luxe', description: 'Deep navy glass, cyan light, and restrained gold for a richer late-night feel.', appearance: 'dark', light: midnightColors, backgroundGradient: ['#06131F', '#081A27', '#04101A'], motif: 'stars', ambient: { kind: 'shooting-star', label: 'Shooting stars', detail: 'A subtle streak crosses the background about every 3–4 minutes.' } },
  { id: 'forest-ledger', name: 'Forest Ledger', description: 'Pine, sage, cream, and paper-warm tones with a quiet outdoors feel.', appearance: 'light', light: forestColors, backgroundGradient: ['#F6F0DF', '#EEE8D3', '#E3E6D4'], motif: 'forest', ambient: { kind: 'forest-wildlife', label: 'Forest visitors', detail: 'Every few minutes a fox may trot across the bottom or a bird may pass through.' } },
  { id: 'minimal-light', name: 'Minimal Light', description: 'Bright white, cool gray, dusty blue, and mint with extra visual breathing room.', appearance: 'light', light: minimalColors, backgroundGradient: ['#FFFFFF', '#F8FAFD', '#EEF5FA'], motif: 'geometry', ambient: { kind: 'soft-glow', label: 'Soft light sweep', detail: 'A faint light sweep appears occasionally without adding visual clutter.' } },
] as const;

export function getThemePreset(id?: VisualThemeId): ThemePreset {
  return THEME_PRESETS.find((theme) => theme.id === id) ?? THEME_PRESETS[0];
}

/** Choose the higher-contrast text color for an opaque six-digit theme color. */
export function contrastText(background: string): '#000000' | '#FFFFFF' {
  const channels = [1, 3, 5].map((offset) => parseInt(background.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#FFFFFF';
}
