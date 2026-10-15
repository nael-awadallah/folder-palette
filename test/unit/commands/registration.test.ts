import { it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({
  registerCommand: vi.fn<(command: string, handler: unknown) => { dispose(): void }>(() => ({ dispose() {} })),
  executeCommand: vi.fn<(command: string, ...args: unknown[]) => Promise<unknown>>(async () => undefined), update: vi.fn(async () => undefined),
  listenerDispose: vi.fn(), pickerDispose: vi.fn(), targetStat: vi.fn(async () => ({ type: 2 })),
  activeTheme: 'unsupported-theme',
  inspect: vi.fn((setting: string) => setting === 'material-icon-theme.folders.associations' ? { globalValue: { src: 'images' } } : {}),
}));
vi.mock('vscode', () => {
  class Uri {
    constructor(readonly value: string) {} static parse(value: string) { return new Uri(value); }
    get scheme() { return this.value.split(':')[0]; } get authority() { return ''; } get path() { return '/project/src'; }
    toString() { return this.value; }
  }
  return {
    Uri, FileType: { Directory: 2 }, QuickInputButtons: { Back: 'back' },
    Disposable: { from: (...items: { dispose(): void }[]) => ({ dispose: () => items.forEach(item => item.dispose()) }) },
    ConfigurationTarget: { Global: 1, Workspace: 2 }, env: {},
    workspace: { isTrusted: true, workspaceFolders: [], fs: { stat: api.targetStat },
      getConfiguration: () => ({ get: (key: string) => key === 'workbench.iconTheme' ? api.activeTheme : undefined, inspect: api.inspect, update: api.update }),
      onDidChangeConfiguration: () => ({ dispose: api.listenerDispose }) },
    extensions: { getExtension: (id: string) => id === 'PKief.material-icon-theme' ? { id, packageJSON: { version: '5.39.0' } } : undefined, onDidChange: () => ({ dispose: api.listenerDispose }) },
    commands: { registerCommand: api.registerCommand, executeCommand: api.executeCommand },
    window: {
      createOutputChannel: () => ({ appendLine() {}, dispose() {} }), showInformationMessage: async () => undefined,
      createQuickPick: () => {
        let hidden: (() => void) | undefined;
        return { items: [], selectedItems: [], show: () => { queueMicrotask(() => hidden?.()); }, hide: () => hidden?.(), dispose: api.pickerDispose,
          onDidAccept: () => ({ dispose() {} }), onDidHide: (cb: () => void) => { hidden = cb; return { dispose() {} }; }, onDidTriggerButton: () => ({ dispose() {} }) };
      },
    },
  };
});

it('enumerates recognized active-provider rules under closed production gates without folder existence checks', async () => {
  api.activeTheme = 'material-icon-theme'; api.inspect.mockClear(); api.update.mockClear(); api.targetStat.mockClear();
  await executeManage();
  expect(api.inspect.mock.calls.map(call => call[0])).toEqual(['material-icon-theme.folders.associations', 'material-icon-theme.rootFolders.associations']);
  expect(api.update).not.toHaveBeenCalled(); expect(api.targetStat).not.toHaveBeenCalled();
  expect(api.executeCommand.mock.calls.some(call => String(call[0]).includes('regenerate') || String(call[0]).includes('restore'))).toBe(false);
  api.activeTheme = 'unsupported-theme';
});
import { activate } from '../../../src/extension';
import { executeChange } from '../../../src/vscode/change';
import { executeReset, executeManage } from '../../../src/vscode/management';

it('registers Change and keeps unavailable-theme invocation free of writes and provider activation', async () => {
  const subscriptions: { dispose(): void }[] = [];
  await activate({ subscriptions } as never);
  expect(api.registerCommand).toHaveBeenCalledWith('folderPalette.changeFolderIcon', expect.any(Function));
  expect(api.registerCommand).toHaveBeenCalledWith('folderPalette.resetFolderIcon', expect.any(Function));
  expect(api.registerCommand).toHaveBeenCalledWith('folderPalette.manageAssociations', expect.any(Function));
  await executeChange();
  await executeReset();
  await executeManage();
  expect(api.update).not.toHaveBeenCalled();
  expect(api.targetStat).not.toHaveBeenCalled();
  expect(api.executeCommand.mock.calls.some(call => String(call[0]).includes('regenerate') || String(call[0]).includes('activate'))).toBe(false);
  expect(api.pickerDispose).toHaveBeenCalled(); expect(api.listenerDispose).toHaveBeenCalled();
  subscriptions.forEach(item => item.dispose());
});

