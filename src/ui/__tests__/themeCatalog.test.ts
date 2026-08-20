import { describe, expect, it } from 'vitest';

import { THEME_PRESETS, getThemePreset } from '../themeCatalog';

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
