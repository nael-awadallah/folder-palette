import { describe, expect, it } from 'vitest';
import { Catalog, getCatalog, searchCatalog } from '../../src/catalog/catalog';
import { chooseIcon, resolveChoice } from '../../src/catalog/selection';
import { ProviderSessionTracker } from '../../src/providers/session';

const sample = { schemaVersion: 1, providerId: 'material', providerVersion: '5.39.0', entries: [
  { id: 'src', label: 'Source', keywords: ['code', 'sources'], native: { icon: 'src' } },
  { id: 'api', label: 'API', keywords: ['backend'], native: { icon: 'api' } },
] };
const extensions = [{ id: 'PKief.material-icon-theme', version: '5.39.0' }, { id: 'vscode-icons-team.vscode-icons', version: '13.0.0' }];

describe('offline catalog boundaries', () => {
  it('loads real provider-specific data with distinct native shapes even for the same ID', () => {
    expect(getCatalog('material').get('src')).toMatchObject({ native: { icon: 'src' } });
    expect(getCatalog('vscode-icons').get('src')).toMatchObject({ native: { icon: 'src', format: 'svg' } });
    expect(getCatalog('material').get('folder-src')).toBeUndefined();
    expect(getCatalog('vscode-icons').get('folder_type_src')).toBeUndefined();
  });

  it('rejects wrong provider/version, duplicates, malformed IDs, and mismatched native payloads', () => {
    expect(() => new Catalog('vscode-icons', sample)).toThrow(/provider/i);
    expect(() => new Catalog('material', { ...sample, providerVersion: '5.40.0' })).toThrow(/version/i);
    expect(() => new Catalog('material', { ...sample, entries: [sample.entries[0], sample.entries[0]] })).toThrow(/duplicate/i);
    expect(() => new Catalog('material', { ...sample, entries: [{ ...sample.entries[0], id: '../src' }] })).toThrow(/identifier/i);
    expect(() => new Catalog('material', { ...sample, entries: [{ ...sample.entries[0], native: { icon: 'wrong' } }] })).toThrow(/native/i);
    expect(() => new Catalog('material', { ...sample, entries: [] })).toThrow(/empty/i);
  });

  it('searches across labels, IDs, and keywords with AND terms and stable order', () => {
    const catalog = new Catalog('material', sample);
    expect(searchCatalog(catalog, '  CODE   src ').map(item => item.id)).toEqual(['src']);
    expect(searchCatalog(catalog, 'backend').map(item => item.id)).toEqual(['api']);
    expect(searchCatalog(catalog, 'not-present')).toEqual([]);
    expect(searchCatalog(catalog, '').map(item => item.id)).toEqual(['src', 'api']);
  });

  it('does not allow UI consumers to mutate cached catalog metadata', () => {
    const catalog = new Catalog('material', sample);
    const entry = catalog.get('src');
    expect(entry).toBeDefined();
    expect(() => Object.assign(entry!, { id: 'overwritten' })).toThrow();
    expect(() => (entry!.keywords as string[]).push('changed')).toThrow();
    expect(sample.entries[0]?.id).toBe('src');
  });
});

describe('catalog selections are bound to provider sessions', () => {
  it('resolves a valid local choice and rejects unknown identifiers', () => {
    const tracker = new ProviderSessionTracker({ activeThemeId: 'material-icon-theme', extensions });
    const choice = chooseIcon(tracker, 'src');
    expect(choice).toMatchObject({ providerId: 'material', iconId: 'src', version: '5.39.0' });
    expect(resolveChoice(tracker, choice)).toMatchObject({ id: 'src' });
    expect(chooseIcon(tracker, 'not-an-icon')).toBeUndefined();
  });

  it('clears a choice on theme change, even if the other provider also has that icon name', () => {
    const tracker = new ProviderSessionTracker({ activeThemeId: 'material-icon-theme', extensions });
    const choice = chooseIcon(tracker, 'src');
    tracker.update({ activeThemeId: 'vscode-icons', extensions });
    expect(resolveChoice(tracker, choice)).toBeUndefined();
    const next = chooseIcon(tracker, 'src');
    expect(next).toMatchObject({ providerId: 'vscode-icons' });
    expect(resolveChoice(tracker, next)).toMatchObject({ native: { format: 'svg' } });
    tracker.update({ activeThemeId: 'material-icon-theme', extensions });
    expect(resolveChoice(tracker, choice)).toBeUndefined();
  });

  it('does not offer a catalog choice for unsupported or untested provider states', () => {
    expect(chooseIcon(new ProviderSessionTracker({ activeThemeId: 'vs-seti', extensions }), 'src')).toBeUndefined();
    expect(chooseIcon(new ProviderSessionTracker({ activeThemeId: 'vscode-icons', extensions: [{ id: 'vscode-icons-team.vscode-icons', version: '12.18.0' }] }), 'src')).toBeUndefined();
  });
});
