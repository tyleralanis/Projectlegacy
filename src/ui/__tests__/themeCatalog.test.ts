import { describe, expect, it } from 'vitest';

import { THEME_PRESETS, contrastText, getThemePreset, highContrastLightColors, highContrastDarkColors } from '../themeCatalog';

describe('visual theme catalog', () => {
  it('ships the five intended visual presets', () => {
    expect(THEME_PRESETS.map((theme) => theme.id)).toEqual([
      'classic',
      'cherry-blossom',
      'midnight-luxe',
      'forest-ledger',
      'minimal-light',
    ]);
  });

  it('keeps ambient scenes rare and theme-specific', () => {
    expect(getThemePreset('cherry-blossom').ambient.kind).toBe('petals');
    expect(getThemePreset('midnight-luxe').ambient.kind).toBe('shooting-star');
    expect(getThemePreset('forest-ledger').ambient.kind).toBe('forest-wildlife');
    expect(getThemePreset('minimal-light').ambient.kind).toBe('soft-glow');
    expect(getThemePreset('classic').ambient.kind).toBe('none');
  });

  it('falls back to Classic Legacy for older saves without a theme setting', () => {
    expect(getThemePreset(undefined).id).toBe('classic');
  });
});

 it('keeps primary and danger button labels above 4.5:1 across every palette', () => {
  const palettes = [...THEME_PRESETS.flatMap((theme) => [theme.light, ...(theme.dark ? [theme.dark] : [])]), highContrastLightColors, highContrastDarkColors];
  for (const palette of palettes) {
    for (const background of [palette.accent, palette.danger]) {
      const rgb = background.match(/[0-9a-f]{2}/gi)!.map((channel) => parseInt(channel, 16) / 255);
      const linear = rgb.map((channel) => channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4));
      const luminance = linear.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const ratio = contrastText(background) === '#FFFFFF' ? 1.05 / (luminance + 0.05) : (luminance + 0.05) / 0.05;
      expect(ratio, background).toBeGreaterThanOrEqual(4.5);
    }
  }
});
