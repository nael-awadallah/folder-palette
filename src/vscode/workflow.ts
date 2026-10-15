import * as vscode from 'vscode';
import type { ManagementHost } from '../commands/manage';
import { WriteCoordinator } from '../configuration/writeCoordinator';
import { providerDefinitions } from '../providers/registry';
import { ProviderSessionTracker } from '../providers/session';
import { createVSCodeMutationHost } from './configuration';
import { createVSCodeProviderHost } from './host';
import { pickStep } from './picker';
import { inspectLocalTarget } from './target';

/** Public command boundary: no workspace scan, theme activation or installation. */
export async function withVSCodeWorkflow(run: (host: ManagementHost, candidates: readonly string[]) => Promise<void>, management: boolean, primary?: unknown, selected?: unknown): Promise<void> {
  const providerHost = createVSCodeProviderHost();
  const tracker = new ProviderSessionTracker(providerHost.readSnapshot());
  const subscription = providerHost.onDidChange(() => tracker.update(providerHost.readSnapshot()));
  let selectedTarget: vscode.Uri | undefined;
  let queue: WriteCoordinator | undefined;
  const host: ManagementHost = {
    pick: step => pickStep(step, hide => {
      const session = tracker.capture();
      return providerHost.onDidChange(() => { tracker.update(providerHost.readSnapshot()); if (!tracker.isCurrent(session)) hide(); });
    }),
    roots: () => vscode.workspace.workspaceFolders?.map(folder => folder.uri.toString()) ?? [],
    async browse() {
      const result = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Choose Folder', title: 'FolderPalette: Choose one local folder' });
      return result?.[0]?.toString();
    },
    async inspectTarget(value) {
      const result = await inspectLocalTarget(value);
      if (result) selectedTarget = vscode.Uri.parse(result.uri);
      return result;
    },
    context() {
      tracker.update(providerHost.readSnapshot());
      const detection = tracker.detection;
      const session = tracker.capture();
      queue = undefined;
      return { detection: !vscode.workspace.isTrusted || vscode.env.remoteName
        ? { ...detection, writesEnabled: false, reason: 'Customization requires a trusted local desktop workspace; remote hosts remain unverified.' } : detection,
        ...(session ? { session } : {}) };
    },
    isCurrent(session) { tracker.update(providerHost.readSnapshot()); return tracker.isCurrent(session); },
    canChooseTheme: () => providerDefinitions.some(definition => !!vscode.extensions.getExtension(definition.extensionId)),
    chooseTheme: async () => { await vscode.commands.executeCommand('workbench.action.selectIconTheme'); },
    openProvider: async provider => { await vscode.commands.executeCommand('extension.open', providerDefinitions.find(item => item.id === provider)!.extensionId); },
    openSettings: async setting => { await vscode.commands.executeCommand('workbench.action.openSettings', `@id:${setting}`); },
    async read(adapter, intent) {
      const session = tracker.capture();
      if (!session || !management && !selectedTarget) throw new Error('No reviewed target/session');
      return createVSCodeMutationHost(tracker, session, selectedTarget).read(adapter.setting(intent));
    },
    async commit(adapter, plan) {
      const session = tracker.capture();
      if (!session || !management && !selectedTarget) throw new Error('No reviewed target/session');
      queue ??= new WriteCoordinator(createVSCodeMutationHost(tracker, session, selectedTarget));
      return queue.commit(adapter, plan);
    },
    notify: async message => { await vscode.window.showInformationMessage(message); },
  };
  try {
    const supplied = Array.isArray(selected) && selected.length ? selected : primary === undefined ? [] : [primary];
    const uris = supplied.filter((item): item is vscode.Uri => item instanceof vscode.Uri);
    if (uris.length !== supplied.length) { await host.notify('Choose an explicit folder from Explorer or run Change Folder Icon from the Command Palette.'); return; }
    await run(host, uris.map(uri => uri.toString()));
  } finally { subscription.dispose(); }
}

