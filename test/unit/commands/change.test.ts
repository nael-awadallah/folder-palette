import { describe, it, expect } from 'vitest';
import { runChange, type ChangeHost } from '../../../src/commands/change';
import { WriteCoordinator } from '../../../src/configuration/writeCoordinator';
import { getProviderDefinition } from '../../../src/providers/registry';
import type { DetectionResult, ProviderId } from '../../../src/providers/types';
import type { NativeLayers } from '../../../src/configuration/adapter';
import type { Step } from '../../../src/ui/workflow';

function fixture(provider: ProviderId = 'material') {
  const definition = getProviderDefinition(provider);
  const verified = { enabled: true, evidence: 'runtime-verified' as const, reason: 'Controlled test proof only' };
  let detection: DetectionResult = { status: 'available', providerId: provider, themeId: definition.themeId, version: definition.catalogVersion, writesEnabled: true, reason: 'fixture',
    definition: { ...definition, capabilities: { matching: { 'folder-name': verified, 'parent-name': verified, 'root-name': provider === 'material' ? verified : definition.capabilities.matching['root-name'] }, storage: { user: verified, workspace: verified, 'workspace-folder': definition.capabilities.storage['workspace-folder'] }, apply: verified } } };
  let layers: NativeLayers = provider === 'material' ? { workspace: {} } : { workspace: [] };
  let writes = 0;
  let revision = 0;
  let exists = true;
  const steps: Step[] = [];
  const messages: string[] = [];
  const answers = new Map<string, (string | undefined)[]>([['matching', ['folder-name']], ['storage', ['workspace']], ['icon', ['images']], ['review', ['apply']]]);
  const target = { uri: 'file:///project/backend/src', name: 'src', parentName: 'backend', displayName: 'src', isRoot: false };
  const mutationHost = {
    read: async () => structuredClone(layers),
    update: async (_setting: string, scope: 'user' | 'workspace', value: unknown) => { writes++; layers = { ...layers, [scope]: value }; },
    validate: async () => exists && revision === 0,
    permitted: () => detection.writesEnabled,
    commands: async () => ['vscode-icons.regenerateIcons'], execute: async () => undefined,
  };
  const queue = new WriteCoordinator(mutationHost);
  const host: ChangeHost = {
    pick: async step => { steps.push(step); return answers.get(step.id)?.shift(); },
    roots: () => [target.uri], browse: async () => undefined,
    inspectTarget: async uri => exists && uri.startsWith('file:') ? { ...target, uri } : undefined,
    context: () => ({ detection, session: { providerId: provider, themeId: definition.themeId, version: definition.catalogVersion, revision } }),
    isCurrent: session => revision === session.revision,
    canChooseTheme: () => true, chooseTheme: async () => undefined, openProvider: async () => undefined,
    read: async () => structuredClone(layers), commit: (adapter, plan) => queue.commit(adapter, plan),
    notify: async message => { messages.push(message); },
  };
  return { host, steps, messages, answers, target, get writes() { return writes; }, get layers() { return layers; },
    set layers(value: NativeLayers) { layers = value; }, set detection(value: DetectionResult) { detection = value; },
    switchTheme() { revision++; detection = { status: 'unsupported', themeId: 'other', writesEnabled: false, reason: 'changed' }; },
    deleteTarget() { exists = false; } };
}

describe('Change Folder Icon workflow', () => {
  it.each(['material', 'vscode-icons'] as const)('saves one reviewed %s selection and reports limited apply status', async provider => {
    const f = fixture(provider);
    await runChange(f.host, [f.target.uri]);
    expect(f.writes).toBe(1);
    expect(f.steps.map(step => step.id)).toEqual(['matching', 'storage', 'icon', 'review']);
    expect(f.steps.find(step => step.id === 'review')?.detail).toContain(provider === 'material' ? '.src' : 'src');
    expect(f.messages.at(-1)).toContain(provider === 'material' ? 'automatic' : 'unconfirmed');
  });
  it.each(['matching', 'storage', 'icon', 'review'])('cancels at %s without a write', async stage => {
    const f = fixture(); f.answers.set(stage, [undefined]);
    await runChange(f.host, [f.target.uri]); expect(f.writes).toBe(0);
  });
  it('goes Back without writing and rebuilds the review', async () => {
    const f = fixture(); f.answers.set('review', ['back', 'apply']); f.answers.set('icon', ['images', 'video']);
    await runChange(f.host, [f.target.uri]);
    expect(f.writes).toBe(1); expect(f.layers.workspace).toEqual({ src: 'video' });
  });
  it('blocks unsupported providers and closed compatibility gates before opening the catalog', async () => {
    for (const state of ['unsupported', 'untested-version', 'unavailable', 'suppressed', 'available'] as const) {
      const f = fixture(); f.detection = { status: state, themeId: 'x', writesEnabled: false, reason: 'Blocked proof' };
      await runChange(f.host, [f.target.uri]);
      expect(f.steps.map(step => step.id)).toEqual(['prerequisite']); expect(f.writes).toBe(0);
    }
  });
  it.each(['matching', 'storage', 'icon', 'review'])('invalidates provider selections on a theme change at %s', async stage => {
    const f = fixture(); const pick = f.host.pick;
    f.host.pick = async step => { const value = await pick(step); if (step.id === stage) f.switchTheme(); return value; };
    await runChange(f.host, [f.target.uri]);
    expect(f.writes).toBe(0); expect(f.steps.at(-1)?.id).toBe('prerequisite');
  });
  it('rechecks a deleted directory before committing', async () => {
    const f = fixture(); const pick = f.host.pick;
    f.host.pick = async step => { const value = await pick(step); if (step.id === 'review') f.deleteTarget(); return value; };
    await runChange(f.host, [f.target.uri]); expect(f.writes).toBe(0); expect(f.messages.at(-1)).toContain('directory');
  });
  it('does not treat a no-op as saved', async () => {
    const f = fixture(); f.layers = { workspace: { src: 'images' } };
    await runChange(f.host, [f.target.uri]); expect(f.writes).toBe(0); expect(f.messages.at(-1)).toContain('No settings changed');
  });
  it('surfaces write failures without claiming save success', async () => {
    const f = fixture(); f.host.commit = async () => { throw new Error('failure'); };
    await runChange(f.host, [f.target.uri]); expect(f.messages.at(-1)).toContain('not saved');
  });
  it('replaces one grouped vscode-icons member through its adapter identity', async () => {
    const f = fixture('vscode-icons'); f.layers = { workspace: [{ icon: 'video', extensions: ['src', 'lib'] }] };
    await runChange(f.host, [f.target.uri]);
    expect(f.writes).toBe(1); expect(f.layers.workspace).toEqual([{ icon: 'video', extensions: ['lib'] }, { icon: 'images', format: 'svg', light: false, extensions: ['src'] }]);
  });
  it('requires renewed review when settings change during review', async () => {
    const f = fixture(); const pick = f.host.pick;
    f.host.pick = async step => { const value = await pick(step); if (step.id === 'review') f.layers = { workspace: { src: 'video' } }; return value; };
    await runChange(f.host, [f.target.uri]); expect(f.writes).toBe(0); expect(f.messages.at(-1)).toContain('not saved');
  });
});


it('rejects named-root edits for vscode-icons before any icon picker opens', async () => {
  const f = fixture('vscode-icons'); f.target.isRoot = true;
  await runChange(f.host, [f.target.uri]); expect(f.writes).toBe(0); expect(f.steps.some(step => step.id === 'icon')).toBe(false);
  expect(f.messages.at(-1)).toContain('Named roots');
});
it('offers only the root mode for Material roots and reviews basename separately from display alias', async () => {
  const f = fixture(); f.target.isRoot = true; f.target.displayName = 'Display alias'; f.answers.set('matching', ['root-name']);
  await runChange(f.host, [f.target.uri]);
  expect(f.steps.find(step => step.id === 'matching')?.items.map(item => item.value)).toEqual(['root-name']);
  expect(f.steps.find(step => step.id === 'review')?.detail).toContain('Target: Display alias');
  expect(f.steps.find(step => step.id === 'review')?.detail).toContain('Exact match: src'); expect(f.writes).toBe(1);
});
it('shows only the active provider catalog and searches native metadata', async () => {
  const f = fixture('vscode-icons'); await runChange(f.host, [f.target.uri]);
  const entries = f.steps.find(step => step.id === 'icon')!.items;
  expect(entries).toHaveLength(199); expect(entries.every(item => !!item.description && typeof item.detail === 'string')).toBe(true);
});
it('re-resolves the actual active theme after an explicitly chosen native picker', async () => {
  const f = fixture(); const ready = f.host.context().detection;
  f.detection = { status: 'unsupported', themeId: null, writesEnabled: false, reason: 'Choose a supported theme' };
  f.answers.set('prerequisite', ['choose']);
  let choices = 0; f.host.chooseTheme = async () => { choices++; f.detection = ready; };
  await runChange(f.host, [f.target.uri]); expect(choices).toBe(1); expect(f.writes).toBe(1);
});
it('opens provider details only through an explicit prerequisite action', async () => {
  const f = fixture(); f.detection = { status: 'unavailable', themeId: 'material-icon-theme', writesEnabled: false, reason: 'Unavailable' };
  f.answers.set('prerequisite', ['vscode-icons']); let opened = '';
  f.host.openProvider = async provider => { opened = provider; };
  await runChange(f.host); expect(opened).toBe('vscode-icons'); expect(f.writes).toBe(0);
});
it('reports apply pending/failure without losing the successful save status', async () => {
  for (const apply of ['pending', 'failed'] as const) {
    const f = fixture(); f.host.commit = async () => ({ saved: true, providerId: 'material', apply });
    await runChange(f.host, [f.target.uri]); expect(f.messages.at(-1)).toContain('customization saved');
    expect(f.messages.at(-1)).toContain(apply === 'pending' ? 'pending' : 'failed');
  }
});

it('restarts provider resolution if a theme change dismisses the target chooser', async () => {
  const f = fixture(); const pick = f.host.pick;
  f.host.pick = async step => { const value = await pick(step); if (step.id === 'target') { f.switchTheme(); return undefined; } return value; };
  await runChange(f.host); expect(f.writes).toBe(0); expect(f.steps.at(-1)?.id).toBe('prerequisite');
});
it('requires renewed matching when workspace root classification changes during review', async () => {
  const f = fixture('vscode-icons'); const pick = f.host.pick;
  f.host.pick = async step => { const value = await pick(step); if (step.id === 'review') f.target.isRoot = true; return value; };
  await runChange(f.host, [f.target.uri]); expect(f.writes).toBe(0); expect(f.messages.at(-1)).toContain('changed');
});

it('reviews direct-parent matching independently from storage scope', async () => {
  const f = fixture(); f.answers.set('matching', ['parent-name']); f.answers.set('storage', ['user']);
  await runChange(f.host, [f.target.uri]);
  expect(f.layers.user).toEqual({ 'backend/src': 'images' });
  const detail = f.steps.find(step => step.id === 'review')!.detail!;
  expect(detail).toContain('Exact match: backend/src'); expect(detail).toContain('Storage: User settings');
  expect(detail).toContain('direct-parent/name pairs wherever they occur');
});
it('clears selections and returns to prerequisites on version/capability session revision', async () => {
  const f = fixture(); const pick = f.host.pick;
  f.host.pick = async step => { const value = await pick(step); if (step.id === 'review') {
    f.switchTheme(); f.detection = { status: 'untested-version', themeId: 'material-icon-theme', writesEnabled: false, reason: 'Provider version changed' };
  } return value; };
  await runChange(f.host, [f.target.uri]); expect(f.writes).toBe(0); expect(f.steps.at(-1)?.placeholder).toContain('version changed');
});
