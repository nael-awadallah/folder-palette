import { expect, it } from 'vitest';
import { runManage, type ManagementHost } from '../../../src/commands/manage';
import { runReset } from '../../../src/commands/reset';
import { NativeAdapter } from '../../../src/configuration/adapter';
import { WriteCoordinator } from '../../../src/configuration/writeCoordinator';
import { getProviderDefinition } from '../../../src/providers/registry';
import type { DetectionResult, ProviderId } from '../../../src/providers/types';
import type { Step } from '../../../src/ui/workflow';

function fixture(provider: ProviderId = 'material') {
  const definition = getProviderDefinition(provider);
  const verified = { enabled: true, evidence: 'runtime-verified' as const, reason: 'Controlled fixture only' };
  let detection: DetectionResult = { status: 'available', providerId: provider, themeId: definition.themeId, version: definition.catalogVersion, writesEnabled: true, reason: 'fixture',
    definition: { ...definition, capabilities: { matching: { 'folder-name': verified, 'parent-name': verified, 'root-name': verified }, storage: { user: verified, workspace: verified, 'workspace-folder': verified }, apply: verified } } };
  const families: Record<string, { user?: unknown; workspace?: unknown }> = provider === 'material'
    ? { folder: { user: { Src: 'unknown', other: 'video' }, workspace: { src: 'images' } }, root: { user: { project: 'video' } } }
    : { folder: { user: [{ icon: 'unknown', extensions: ['Src', 'lib'] }] } };
  let revision = 0; let writes = 0; let stats = 0; const settings: string[] = []; const steps: Step[] = []; const messages: string[] = [];
  const answers = new Map<string, (string | undefined)[]>([['rule-action', ['remove']], ['review-removal', ['apply']]]);
  const host: ManagementHost = {
    pick: async step => { steps.push(step); return step.id === 'rules' ? step.items[0]?.value : answers.get(step.id)?.shift(); },
    roots: () => ['file:///project/backend/src'], browse: async () => undefined,
    inspectTarget: async uri => { stats++; return { uri, name: 'src', parentName: 'backend', displayName: 'src', isRoot: false }; },
    context: () => ({ detection, ...(detection.status === 'available' ? { session: { providerId: provider, themeId: definition.themeId, version: definition.catalogVersion, revision } } : {}) }),
    isCurrent: session => session.revision === revision,
    canChooseTheme: () => false, chooseTheme: async () => undefined, openProvider: async () => undefined,
    openSettings: async setting => { settings.push(setting); },
    read: async (_adapter, intent) => structuredClone(families[intent.root ? 'root' : 'folder'] ?? {}),
    commit: async (adapter, plan) => new WriteCoordinator({
      read: async () => families[plan.intent.root ? 'root' : 'folder']!,
      update: async (_setting, scope, value) => { writes++; families[plan.intent.root ? 'root' : 'folder']![scope] = value; },
      validate: async () => revision === 0, permitted: () => detection.writesEnabled,
      commands: async () => ['vscode-icons.regenerateIcons'], execute: async () => undefined,
    }).commit(adapter, plan), notify: async message => { messages.push(message); },
  };
  return { host, families, answers, steps, messages, settings, get writes() { return writes; }, get stats() { return stats; },
    closeGate() { detection = { ...detection, writesEnabled: false }; },
    switchTheme() { revision++; detection = { status: 'unsupported', themeId: 'other', writesEnabled: false, reason: 'Theme changed' }; } };
}

it.each(['material', 'vscode-icons'] as const)('manages %s raw rules without statting an original folder', async provider => {
  const f = fixture(provider); await runManage(f.host);
  expect(f.stats).toBe(0); expect(f.writes).toBe(1);
  expect(f.families.folder!.user).toEqual(provider === 'material' ? { other: 'video' } : [{ icon: 'unknown', extensions: ['lib'] }]);
  expect(f.steps.find(step => step.id === 'review-removal')?.detail).toContain('inherited');
  expect(f.messages.at(-1)).toContain('customization saved');
});
it('Reset lists only applicable native rules and preserves case and inherited settings', async () => {
  const f = fixture(); await runReset(f.host, ['file:///project/backend/src']);
  expect(f.steps.find(step => step.id === 'rules')?.items).toHaveLength(2);
  expect(f.families.folder!.user).toEqual({ other: 'video' }); expect(f.families.folder!.workspace).toEqual({ src: 'images' });
});
it('lists both Material setting families and removes a root without requiring its folder', async () => {
  const f = fixture(); const pick = f.host.pick;
  f.host.pick = async step => step.id === 'rules' ? (f.steps.push(step), step.items.find(item => item.value.startsWith('root:'))?.value) : pick(step);
  await runManage(f.host); expect(f.families.root!.user).toEqual({}); expect(f.stats).toBe(0);
});
it('keeps production-gated management read-only with an explicit Settings action', async () => {
  const f = fixture(); f.closeGate(); f.answers.set('rule-action', ['settings']); await runManage(f.host);
  expect(f.steps.find(step => step.id === 'rules')?.items.length).toBeGreaterThan(0);
  expect(f.steps.find(step => step.id === 'rule-action')?.items.some(item => item.value === 'remove')).toBe(false);
  expect(f.settings).toEqual(['material-icon-theme.folders.associations']); expect(f.writes).toBe(0);
});
it.each(['rules', 'rule-action', 'review-removal'])('cancels management at %s with zero writes', async stage => {
  const f = fixture(); const pick = f.host.pick; f.host.pick = step => step.id === stage ? Promise.resolve(undefined) : pick(step);
  await runManage(f.host); expect(f.writes).toBe(0);
});
it('invalidates a reviewed removal when the theme changes', async () => {
  const f = fixture(); const pick = f.host.pick;
  f.host.pick = async step => { const value = await pick(step); if (step.id === 'review-removal') f.switchTheme(); return value; };
  await runManage(f.host); expect(f.writes).toBe(0); expect(f.steps.at(-1)?.id).toBe('prerequisite');
});
it('rejects a stale selected descriptor before saving', async () => {
  const f = fixture('vscode-icons'); const pick = f.host.pick;
  f.host.pick = async step => { const value = await pick(step); if (step.id === 'review-removal') f.families.folder!.user = [{ icon: 'video', extensions: ['Src'] }]; return value; };
  await runManage(f.host); expect(f.writes).toBe(0); expect(f.messages.at(-1)).toContain('not saved');
});
it('shows advanced native modifiers read-only and preserves them', async () => {
  const f = fixture('vscode-icons'); f.families.folder!.user = [{ icon: 'custom', extensions: ['src'], overrides: 'native', future: 7 }];
  f.answers.set('rule-action', ['settings']); await runManage(f.host);
  expect(f.steps.find(step => step.id === 'rule-action')?.items.map(item => item.value)).toEqual(['settings', 'cancel']);
  expect(f.writes).toBe(0); expect(f.settings).toEqual(['vsicons.associations.folders']);
});
it('replaces a catalog-backed grouped member without losing its sibling', async () => {
  const f = fixture('vscode-icons'); f.answers.set('rule-action', ['replace']); f.answers.set('replacement-icon', ['images']); f.answers.set('review-replacement', ['apply']);
  await runManage(f.host);
  expect(f.families.folder!.user).toEqual([{ icon: 'unknown', extensions: ['lib'] }, { icon: 'images', format: 'svg', light: false, extensions: ['Src'] }]);
});
it('renews review when a selected identity changes before choosing an action', async () => {
  const f = fixture(); const pick = f.host.pick;
  f.host.pick = async step => { const value = await pick(step); if (step.id === 'rule-action') f.families.folder!.user = { Src: 'video' }; return value; };
  await runManage(f.host); expect(f.writes).toBe(0); expect(f.messages.at(-1)).toContain('not saved');
});
it('rejects Reset when a target-specific direct-parent fallback is added after review', async () => {
  const f = fixture(); f.families.folder!.workspace = {};
  const pick = f.host.pick;
  f.host.pick = async step => { const value = await pick(step); if (step.id === 'review-removal') f.families.folder!.workspace = { 'backend/src': 'video' }; return value; };
  await runReset(f.host, ['file:///project/backend/src']);
  expect(f.writes).toBe(0); expect(f.families.folder!.user).toEqual({ Src: 'unknown', other: 'video' });
  expect(f.messages.at(-1)).toContain('not saved');
});
// The real adapter remains the authority: workflows never invent setting identities.
it('rejects cross-provider reviewed identities', () => {
  const material = new NativeAdapter('material'); const layers = { user: { src: 'images' } };
  expect(() => new NativeAdapter('vscode-icons').planRemove(material.describeRules(layers)[0]!, layers)).toThrow();
});
