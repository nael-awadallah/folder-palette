import { describe, expect, it } from 'vitest';
import { availableMatchingModes, availableStorageScopes } from '../../../src/providers/capabilities';
import { detectProvider } from '../../../src/providers/registry';

const extensions = [{ id: 'PKief.material-icon-theme', version: '5.39.0' }, { id: 'vscode-icons-team.vscode-icons', version: '13.0.0' }];

describe('capability-based option filtering', () => {
  it('exposes only the observed Material matching modes without granting writes', () => {
    const current = detectProvider({ activeThemeId: 'material-icon-theme', extensions });
    expect(availableMatchingModes(current)).toEqual(['folder-name', 'parent-name', 'root-name']);
    expect(availableStorageScopes(current)).toEqual([]);
    expect(current.writesEnabled).toBe(false);
  });

  it('withholds vscode-icons source-only modes and all unverified storage options', () => {
    const current = detectProvider({ activeThemeId: 'vscode-icons', extensions });
    expect(availableMatchingModes(current)).toEqual([]);
    expect(availableStorageScopes(current)).toEqual([]);
  });

  it.each(['vs-seti', 'material-icon-theme'])('offers no matching choices when theme/provider is unavailable: %s', activeThemeId => {
    expect(availableMatchingModes(detectProvider({ activeThemeId, extensions: [] }))).toEqual([]);
  });
});
