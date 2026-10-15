import { describe, expect, it } from 'vitest';
import { detectProvider } from '../../../src/providers/registry';

const material = { id: 'PKief.material-icon-theme', version: '5.39.0', isActive: false };
const icons = { id: 'vscode-icons-team.vscode-icons', version: '13.0.0', isActive: false };

describe('active provider routing', () => {
  it.each([
    ['material-icon-theme', 'material'],
    ['vscode-icons', 'vscode-icons'],
  ])('routes %s by active theme with both providers installed', (activeThemeId, providerId) => {
    expect(detectProvider({ activeThemeId, extensions: [material, icons] })).toMatchObject({
      status: 'available', providerId, writesEnabled: false,
    });
  });

  it('does not require the other provider or mistake activation for enablement', () => {
    expect(detectProvider({ activeThemeId: 'material-icon-theme', extensions: [material] })).toMatchObject({
      status: 'available', providerId: 'material', version: '5.39.0',
    });
  });

  it.each([null, undefined, '', 'vs-seti', 'some-material-icon-theme', 42])(
    'does not select an installed provider for unsupported active theme %s', activeThemeId => {
      expect(detectProvider({ activeThemeId, extensions: [material, icons] })).toMatchObject({ status: 'unsupported', writesEnabled: false });
    },
  );

  it('reports the selected provider unavailable rather than falling back to an installed other provider', () => {
    expect(detectProvider({ activeThemeId: 'vscode-icons', extensions: [material] })).toMatchObject({
      status: 'unavailable', providerId: 'vscode-icons', writesEnabled: false,
    });
  });

  it.each(['12.18.0', '13.0.1', '13.0.0-beta.1', 'invalid'])('gates untested vscode-icons version %s', version => {
    expect(detectProvider({ activeThemeId: 'vscode-icons', extensions: [{ ...icons, version }] })).toMatchObject({
      status: 'untested-version', writesEnabled: false,
    });
  });

  it('accepts extension identifier casing without loosening theme-ID matching', () => {
    expect(detectProvider({ activeThemeId: 'material-icon-theme', extensions: [{ ...material, id: 'pkief.material-icon-theme' }] })).toMatchObject({ status: 'available', providerId: 'material' });
  });

  it.each([
    ['material-icon-theme', 'material-icon-theme.folders.theme', 'none'],
    ['vscode-icons', 'vsicons.presets.hideFolders', true],
    ['vscode-icons', 'vsicons.presets.foldersAllDefaultIcon', true],
  ])('explains icon suppression for %s / %s', (activeThemeId, key, value) => {
    expect(detectProvider({ activeThemeId, extensions: [material, icons], settings: { [key]: value } })).toMatchObject({ status: 'suppressed', writesEnabled: false });
  });
});
