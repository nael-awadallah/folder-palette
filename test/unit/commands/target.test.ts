import { describe, it, expect } from 'vitest';
import { selectTarget } from '../../../src/ui/target';
import type { TargetHost } from '../../../src/ui/workflow';

describe('explicit target resolution', () => {
  function fixture() {
    const inspected: string[] = []; const messages: string[] = []; const values: (string | undefined)[] = [];
    const host: TargetHost = {
      pick: async () => values.shift(), roots: () => ['file:///root'], browse: async () => 'file:///browsed',
      inspectTarget: async uri => { inspected.push(uri); return uri.startsWith('file:') ? { uri, name: 'src', parentName: 'backend', displayName: 'src', isRoot: false } : undefined; },
      notify: async text => { messages.push(text); },
    };
    return { host, inspected, values, messages };
  }
  it('requires choosing one member of ambiguous Explorer selection', async () => {
    const f = fixture(); f.values.push('1');
    expect((await selectTarget(f.host, ['file:///a', 'file:///b']))?.uri).toBe('file:///b');
    expect(f.inspected).toEqual(['file:///b']);
  });
  it('offers workspace roots and Browse without enumerating directories', async () => {
    const f = fixture(); f.values.push('0', 'browse');
    expect((await selectTarget(f.host, []))?.uri).toBe('file:///root');
    expect((await selectTarget(f.host, []))?.uri).toBe('file:///browsed');
    expect(f.inspected).toEqual(['file:///root', 'file:///browsed']);
  });
  it('cancels target selection without reading any directories', async () => {
    const f = fixture(); expect(await selectTarget(f.host, [])).toBeUndefined(); expect(f.inspected).toEqual([]);
  });
  it('rejects unsupported schemes rather than falling back to a workspace root', async () => {
    const f = fixture(); expect(await selectTarget(f.host, ['vscode-remote://host/src'])).toBeUndefined(); expect(f.messages).toHaveLength(1);
  });
});
