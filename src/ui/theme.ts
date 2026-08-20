import { useColorScheme } from 'react-native';

import { useGame } from '@/state/GameProvider';
import { getThemePreset, highContrastDarkColors, highContrastLightColors, type AppColors } from '@/ui/themeCatalog';

export { darkColors, lightColors, highContrastDarkColors, highContrastLightColors } from '@/ui/themeCatalog';
export { THEME_PRESETS, getThemePreset } from '@/ui/themeCatalog';
export type { AppColors, AmbientEffectKind, ThemePreset } from '@/ui/themeCatalog';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { sm: 10, md: 14, card: 18, pill: 999 } as const;

export function useAppTheme(): { dark: boolean; colors: AppColors; theme: ReturnType<typeof getThemePreset> } {
  const scheme = useColorScheme();
  const { world } = useGame();
  const theme = getThemePreset(world?.settings.visualTheme);
  const dark = theme.appearance === 'dark' || (theme.appearance === 'system' && scheme === 'dark');
  const highContrast = world?.settings.highContrast ?? false;
  const themedColors = dark && theme.dark ? theme.dark : theme.light;
  return {
    dark,
    theme,
    colors: highContrast ? (dark ? highContrastDarkColors : highContrastLightColors) : themedColors,
  };
}
