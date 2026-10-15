import { describe, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({
  inspect: vi.fn(() => ({ globalValue: { user: 'images' }, workspaceValue: { local: 'video' }, defaultValue: { inherited: 'ignored' } })),
  update: vi.fn(async () => undefined),
  get: vi.fn((key: string) => key === 'workbench.iconTheme' ? 'material-icon-theme' : undefined),
  stat: vi.fn(async () => ({ type: 2 })),
}));
vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => api, fs: { stat: api.stat } },
  extensions: { getExtension: () => ({ id: 'PKief.material-icon-theme', packageJSON: { version: '5.39.0' } }) },
  commands: { getCommands: async () => [], executeCommand: async () => undefined },
  ConfigurationTarget: { Global: 1, Workspace: 2 }, FileType: { Directory: 2 },
}));
import { createVSCodeMutationHost } from '../../../src/vscode/configuration';
import { ProviderSessionTracker } from '../../../src/providers/session';
import { NativeAdapter } from '../../../src/configuration/adapter';
import { WriteCoordinator } from '../../../src/configuration/writeCoordinator';

describe('VS Code configuration boundary (controlled API, not Extension Host)', () => {
  it('reads raw inspected layers, ignoring effective/default values', async () => {
    const tracker = new ProviderSessionTracker({ activeThemeId: 'material-icon-theme', extensions: [{ id: 'PKief.material-icon-theme', version: '5.39.0' }] });
    const host = createVSCodeMutationHost(tracker, tracker.capture()!, { scheme: 'file' } as never);
    expect(await host.read('material-icon-theme.folders.associations')).toEqual({ user: { user: 'images' }, workspace: { local: 'video' } });
    const adapter = new NativeAdapter('material');
    const plan = adapter.plan({}, { scope: 'workspace', key: 'src', icon: 'images' });
    await expect(new WriteCoordinator(host).commit(adapter, plan)).rejects.toThrow('gate');
    expect(api.update).not.toHaveBeenCalled();
  });
  it('keeps stored-rule management writes gated even without a directory target', async () => {
    api.stat.mockClear();
    const tracker = new ProviderSessionTracker({ activeThemeId: 'material-icon-theme', extensions: [{ id: 'PKief.material-icon-theme', version: '5.39.0' }] });
    const host = createVSCodeMutationHost(tracker, tracker.capture()!);
    const adapter = new NativeAdapter('material');
    const layers = { user: { src: 'images' } };
    const plan = adapter.planRemove(adapter.describeRules(layers)[0]!, layers);
    await expect(new WriteCoordinator(host).commit(adapter, plan)).rejects.toThrow('gate');
    expect(api.stat).not.toHaveBeenCalled(); expect(api.update).not.toHaveBeenCalled();
  });
});
