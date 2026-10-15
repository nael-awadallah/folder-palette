import { describe, it, expect } from 'vitest';
import { NativeAdapter } from '../../../src/configuration/adapter';
import { WriteCoordinator } from '../../../src/configuration/writeCoordinator';

function fixture(provider: 'material' | 'vscode-icons' = 'material') {
  let layers: { user?: unknown; workspace?: unknown } = { user: {}, workspace: {} };
  let current = true;
  let permitted = true;
  let writes = 0;
  let commands = 0;
  const adapter = new NativeAdapter(provider);
  const host = {
    read: async () => structuredClone(layers),
    update: async (_setting: string, _scope: string, value: unknown) => { writes++; layers.workspace = value; },
    validate: async () => current,
    permitted: () => permitted,
    commands: async () => ['vscode-icons.regenerateIcons'],
    execute: async () => { commands++; },
  };
  return { adapter, host, get layers() { return layers; }, set layers(value) { layers = value; },
    set current(value: boolean) { current = value; }, set permitted(value: boolean) { permitted = value; },
    get writes() { return writes; }, get commands() { return commands; } };
}

describe('reviewed writes and truthful apply', () => {
  it('merges unrelated edits, serializes writes and avoids duplicate apply', async () => {
    const f = fixture();
    const plan = f.adapter.plan(f.layers, { scope: 'workspace', key: 'src', icon: 'images' });
    f.layers = { user: {}, workspace: { unrelated: 'video' } };
    const queue = new WriteCoordinator(f.host);
    expect(await queue.commit(f.adapter, plan)).toMatchObject({ saved: true, apply: 'automatic-handoff' });
    expect(f.layers.workspace).toEqual({ unrelated: 'video', src: 'images' });
    expect(await queue.commit(f.adapter, plan)).toMatchObject({ saved: false });
    expect(f.writes).toBe(1);
  });
  it('rejects stale selected values, inheritance, target/session changes and closed gates', async () => {
    for (const kind of ['selected', 'inherited', 'session', 'gate']) {
      const f = fixture();
      const plan = f.adapter.plan(f.layers, { scope: 'workspace', key: 'src', icon: 'images' });
      if (kind === 'selected') f.layers.workspace = { src: 'video' };
      if (kind === 'inherited') f.layers.user = { src: 'video' };
      if (kind === 'session') f.current = false;
      if (kind === 'gate') f.permitted = false;
      await expect(new WriteCoordinator(f.host).commit(f.adapter, plan)).rejects.toThrow();
      expect(f.writes).toBe(0);
    }
  });
  it('keeps root settings separate and does not invoke apply after no-op', async () => {
    const f = fixture();
    const plan = f.adapter.plan({ workspace: { src: 'images' } }, { scope: 'workspace', key: 'src', icon: 'images', root: true });
    expect(plan.setting).toBe('material-icon-theme.rootFolders.associations');
    f.layers.workspace = { src: 'images' };
    expect(await new WriteCoordinator(f.host).commit(f.adapter, plan)).toMatchObject({ saved: false, apply: 'not-needed' });
  });
  it('reports command resolution as unconfirmed and command failures separately from save', async () => {
    for (const mode of ['resolve', 'missing', 'throw', 'switched']) {
      const f = fixture('vscode-icons');
      f.layers = { workspace: [] };
      const plan = f.adapter.plan(f.layers, { scope: 'workspace', key: 'src', icon: 'images' });
      if (mode === 'missing') f.host.commands = async () => [];
      if (mode === 'throw') f.host.execute = async () => { throw new Error('provider failed'); };
      if (mode === 'switched') f.host.update = async () => { f.current = false; };
      const result = await new WriteCoordinator(f.host).commit(f.adapter, plan);
      expect(result).toMatchObject({ saved: true, apply: mode === 'resolve' ? 'completion-unconfirmed' : mode === 'switched' ? 'pending' : 'failed' });
    }
  });
  it('does not apply on failed writes and the queue recovers', async () => {
    const f = fixture();
    const plan = f.adapter.plan(f.layers, { scope: 'workspace', key: 'src', icon: 'images' });
    f.host.update = async () => { throw new Error('write failed'); };
    const queue = new WriteCoordinator(f.host);
    await expect(queue.commit(f.adapter, plan)).rejects.toThrow('write failed');
    await expect(queue.commit(f.adapter, plan)).rejects.toThrow('write failed');
    expect(f.commands).toBe(0);
  });
});

it('rejects reviewed array reorder and concurrent duplicate introduction', () => {
  const adapter = new NativeAdapter('vscode-icons');
  const initial = { workspace: [{ icon: 'old', extensions: ['src'] }, { icon: 'x', extensions: ['lib'] }] };
  const plan = adapter.plan(initial, { scope: 'workspace', key: 'src', index: 0, icon: 'images' });
  expect(() => adapter.reconcile(plan, { workspace: [...initial.workspace].reverse() })).toThrow('stale');
});

it('does not create an empty override while removing a missing rule', async () => {
  const f = fixture();
  f.layers = {};
  const plan = f.adapter.plan(f.layers, { scope: 'workspace', key: 'missing' });
  expect(await new WriteCoordinator(f.host).commit(f.adapter, plan)).toMatchObject({ saved: false });
  expect(f.writes).toBe(0);
});

it('runs queued reviews against the latest state and preserves distinct edits', async () => {
  const f = fixture();
  const first = f.adapter.plan(f.layers, { scope: 'workspace', key: 'src', icon: 'images' });
  const second = f.adapter.plan(f.layers, { scope: 'workspace', key: 'lib', icon: 'video' });
  const queue = new WriteCoordinator(f.host);
  await Promise.all([queue.commit(f.adapter, first), queue.commit(f.adapter, second)]);
  expect(f.layers.workspace).toEqual({ src: 'images', lib: 'video' });
  expect(f.writes).toBe(2);
});

it('serializes distinct command coordinators in the same extension host', async () => {
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = f.host.update;
  let reads = 0;
  f.host.read = async () => { reads++; return structuredClone(f.layers); };
  f.host.update = async (setting, scope, value) => { await gate; await original(setting, scope, value); };
  const first = f.adapter.plan(f.layers, { scope: 'workspace', key: 'src', icon: 'images' });
  const second = f.adapter.plan(f.layers, { scope: 'workspace', key: 'lib', icon: 'video' });
  const writes = [new WriteCoordinator(f.host).commit(f.adapter, first), new WriteCoordinator(f.host).commit(f.adapter, second)];
  await new Promise(resolve => setTimeout(resolve, 0));
  const beforeRelease = reads;
  release(); await Promise.all(writes);
  expect(beforeRelease).toBe(1);
  expect(f.layers.workspace).toEqual({ src: 'images', lib: 'video' });
});
