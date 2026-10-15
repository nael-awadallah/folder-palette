import { describe, expect, it } from 'vitest';
import { NativeAdapter } from '../../../src/configuration/adapter';

describe('native management identities', () => {
  it('lists unknown Material icons and removes one original key in its root family', () => {
    const adapter = new NativeAdapter('material');
    const layers = { user: { Src: 'unknown-native', other: { future: true } }, workspace: { Src: 'video' } };
    const rules = adapter.describeRules(layers, true);
    const rule = rules.find(item => item.scope === 'user' && item.matchText === 'Src')!;
    expect(rule.icon).toBe('unknown-native'); expect(rule.removable).toBe(true);
    expect(rule.explanations.join(' ')).toContain('Workspace');
    expect(rules.find(item => item.scope === 'workspace')?.status).toContain('Masked');
    expect(adapter.reconcile(adapter.planRemove(rule, layers), layers).value).toEqual({ other: { future: true } });
    expect(adapter.planRemove(rule, layers).setting).toBe('material-icon-theme.rootFolders.associations');
    expect(rules.find(item => item.matchText === 'other')?.removable).toBe(false);
    expect(layers.user.Src).toBe('unknown-native');
  });
  it('removes just one duplicate native array member and preserves surrounding descriptors', () => {
    const adapter = new NativeAdapter('vscode-icons');
    const layers = { user: [{ icon: 'unknown', extensions: ['src', 'src', 'lib'] }, { icon: 'images', extensions: ['src'] }] };
    const rules = adapter.describeRules(layers);
    expect(rules).toHaveLength(4);
    expect(rules[1]?.identity).toContain('member 2');
    const plan = adapter.planRemove(rules[1]!, layers);
    expect(adapter.reconcile(plan, layers).value).toEqual([{ icon: 'unknown', extensions: ['src', 'lib'] }, layers.user[1]]);
    expect(rules[1]?.explanations.join(' ')).toContain('duplicate');
    expect(rules[1]?.status).toContain('duplicate');
    expect(() => adapter.reconcile(plan, { user: [...layers.user].reverse() })).toThrow('stale');
  });
  it('keeps advanced, empty and malformed native descriptors visible and read-only', () => {
    const adapter = new NativeAdapter('vscode-icons');
    const rules = adapter.describeRules({ workspace: [
      { icon: 'native', extensions: ['src'], overrides: 'other' },
      { icon: 'native', extensions: [], disabled: true }, { future: true },
    ] });
    expect(rules).toHaveLength(3); expect(rules.every(rule => !rule.removable)).toBe(true);
    expect(() => adapter.planRemove(rules[0]!, { workspace: [] })).toThrow();
  });
  it('filters Reset by provider aliases and direct-parent matching without mixing root settings', () => {
    const adapter = new NativeAdapter('material');
    const layers = { user: { src: 'images', 'backend/.src': 'video', unrelated: 'images' } };
    const target = { name: '.src', parentName: 'backend', isRoot: false };
    expect(adapter.describeRules(layers, false, target).map(rule => rule.matchText)).toEqual(['src', 'backend/.src']);
    expect(adapter.describeRules(layers, true, target)).toEqual([]);
  });
  it('removes unsupported literal native keys exactly and rejects changed inherited fallback', () => {
    const adapter = new NativeAdapter('material');
    const layers = { user: { 'old/full/path': 'native' }, workspace: { 'old/full/path': 'images' } };
    const rule = adapter.describeRules(layers)[0]!;
    const plan = adapter.planRemove(rule, layers);
    expect(adapter.reconcile(plan, layers).value).toEqual({});
    expect(() => adapter.reconcile(plan, { ...layers, workspace: { 'old/full/path': 'video' } })).toThrow('stale');
  });
  it('identifies same-layer case and generated-alias collisions by original native keys', () => {
    const adapter = new NativeAdapter('material');
    const rules = adapter.describeRules({ user: { src: 'images', Src: 'video', '.src': 'unknown' } });
    const src = rules.find(rule => rule.matchText === 'src')!;
    expect(src.status).toContain('case-equivalent'); expect(src.status).toContain('generated-alias');
    expect(src.status).toContain('key "Src"'); expect(src.status).toContain('key ".src"');
    expect(src.status).toContain('ordering unverified');
    expect(src.removable).toBe(true); expect(src.replaceable).toBe(false);
  });
  it('distinguishes generated-alias cross-layer overlap from observed same-key masking', () => {
    const adapter = new NativeAdapter('material');
    const rules = adapter.describeRules({ user: { src: 'images' }, workspace: { src: 'video', '.src': 'video' } });
    const alias = rules.find(rule => rule.scope === 'workspace' && rule.matchText === '.src')!;
    expect(alias.status).toContain('User key "src"'); expect(alias.status).toContain('generated-alias');
    expect(alias.status).toContain('masking/ordering unverified');
    expect(rules.find(rule => rule.scope === 'workspace' && rule.matchText === 'src')?.status).toContain('Masked');
    expect(rules.find(rule => rule.scope === 'user')?.status).toContain('Workspace key ".src"');
  });
  it('fingerprints target-specific dependencies without treating an unrelated rule as a Reset conflict', () => {
    const adapter = new NativeAdapter('material'); const layers = { user: { src: 'images' }, workspace: {} };
    const rule = adapter.describeRules(layers, false, { name: 'src', parentName: 'backend', isRoot: false })[0]!;
    const plan = adapter.planRemove(rule, layers);
    expect(() => adapter.reconcile(plan, { ...layers, workspace: { 'backend/src': 'video' } })).toThrow('stale');
    expect(adapter.reconcile(plan, { ...layers, workspace: { unrelated: 'video' } }).value).toEqual({});
  });
});
