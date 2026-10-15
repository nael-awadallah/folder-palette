import { beforeEach, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({ type: 2, roots: [] as { name: string; uri: { toString(): string } }[], stat: vi.fn(async () => ({ type: 2 })) }));
vi.mock('vscode', () => ({
  Uri: { parse: (value: string) => { const parsed = new URL(value); return { scheme: parsed.protocol.slice(0, -1), authority: parsed.host, query: parsed.search, fragment: parsed.hash, path: decodeURIComponent(parsed.pathname), toString: () => value }; } },
  FileType: { Directory: 2 }, workspace: { get workspaceFolders() { return api.roots; }, fs: { stat: api.stat } },
}));
import { inspectLocalTarget } from '../../../src/vscode/target';
beforeEach(() => { api.stat.mockReset(); api.stat.mockResolvedValue({ type: 2 }); api.roots = []; });
it('stats only one explicit local URI and derives direct parent and basename', async () => {
  expect(await inspectLocalTarget('file:///C:/project/backend/my%20folder')).toMatchObject({ name: 'my folder', parentName: 'backend', isRoot: false });
  expect(api.stat).toHaveBeenCalledOnce();
});
it('rejects remote schemes and network shares before a filesystem request', async () => {
  expect(await inspectLocalTarget('vscode-remote://host/src')).toBeUndefined();
  expect(await inspectLocalTarget('file://server/share/src')).toBeUndefined();
  expect(api.stat).not.toHaveBeenCalled();
});
it('rejects a file or deleted directory and accepts a directory symlink', async () => {
  api.stat.mockResolvedValueOnce({ type: 1 }); expect(await inspectLocalTarget('file:///project/src')).toBeUndefined();
  api.stat.mockRejectedValueOnce(new Error('missing')); expect(await inspectLocalTarget('file:///project/src')).toBeUndefined();
  api.stat.mockResolvedValueOnce({ type: 66 }); expect(await inspectLocalTarget('file:///project/src')).toMatchObject({ isRoot: false });
});
it('retains root basename independently of workspace display alias', async () => {
  api.roots = [{ name: 'Friendly alias', uri: { toString: () => 'file:///project/src' } }];
  expect(await inspectLocalTarget('file:///project/src')).toMatchObject({ name: 'src', displayName: 'Friendly alias', isRoot: true });
});

it('recognizes a workspace root even when its URI has a trailing separator', async () => {
  api.roots = [{ name: 'Root', uri: { toString: () => 'file:///project/src/' } }];
  expect(await inspectLocalTarget('file:///project/src')).toMatchObject({ isRoot: true });
});

it('rejects query/fragment URIs that could hide workspace-root identity', async () => {
  expect(await inspectLocalTarget('file:///project/src?value=1')).toBeUndefined();
  expect(await inspectLocalTarget('file:///project/src#alias')).toBeUndefined();
  expect(api.stat).not.toHaveBeenCalled();
});
