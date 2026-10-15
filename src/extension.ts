import * as vscode from 'vscode';
import { executeChange } from './vscode/change';
import { executeReset, executeManage } from './vscode/management';
import { availableMatchingModes, availableStorageScopes } from './providers/capabilities';
import { getProviderFoundation } from './providers/foundations';
import { observeProviderHost } from './providers/monitor';
import type { DetectionResult } from './providers/types';
import { createVSCodeProviderHost } from './vscode/host';

/** Detection and all three commands activate without provider activation or configuration writes. */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('FolderPalette');
  let pending = Promise.resolve();
  let disposed = false;
  async function publish(result: DetectionResult): Promise<void> {
    if (disposed) return;
    const catalog = result.status === 'available' && result.providerId ? getProviderFoundation(result.providerId).loadCatalog() : undefined;
    const canCustomize = result.writesEnabled && availableMatchingModes(result).length > 0 && availableStorageScopes(result).length > 0;
    await Promise.all([
      vscode.commands.executeCommand('setContext', 'folderPalette.provider', result.providerId ?? ''),
      vscode.commands.executeCommand('setContext', 'folderPalette.providerStatus', result.status),
      vscode.commands.executeCommand('setContext', 'folderPalette.canCustomize', canCustomize),
    ]);
    output.appendLine(`${result.providerId ?? 'unsupported'} ${result.version ?? ''}: ${result.status}. ${catalog?.entries.length ?? 0} offline catalog choices. ${result.reason}`);
  }
  const monitor = observeProviderHost(createVSCodeProviderHost(), result => {
    pending = pending.then(() => publish(result)).catch(() => { if (!disposed) output.appendLine('Provider foundation initialization failed; customization remains unavailable.'); });
  });
  context.subscriptions.push(vscode.commands.registerCommand('folderPalette.changeFolderIcon', executeChange),
    vscode.commands.registerCommand('folderPalette.resetFolderIcon', executeReset),
    vscode.commands.registerCommand('folderPalette.manageAssociations', executeManage), output, monitor, { dispose() { disposed = true; } });
  await pending;
}

