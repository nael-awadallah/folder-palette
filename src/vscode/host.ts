import * as vscode from 'vscode';
import { providerDefinitions } from '../providers/registry';
import type { ProviderHost } from '../providers/monitor';
import type { ExtensionMetadata, HostSnapshot } from '../providers/types';

const settings = ['material-icon-theme.folders.theme', 'vsicons.presets.hideFolders', 'vsicons.presets.foldersAllDefaultIcon'] as const;

export function createVSCodeProviderHost(): ProviderHost {
  return {
    readSnapshot(): HostSnapshot {
      const configuration = vscode.workspace.getConfiguration();
      const extensions: ExtensionMetadata[] = [];
      for (const definition of providerDefinitions) {
        const extension = vscode.extensions.getExtension(definition.extensionId);
        const version: unknown = extension?.packageJSON.version;
        if (extension && typeof version === 'string') extensions.push({ id: extension.id, version, isActive: extension.isActive });
      }
      return {
        activeThemeId: configuration.get('workbench.iconTheme'), extensions,
        settings: Object.fromEntries(settings.map(key => [key, configuration.get(key)])),
      };
    },
    onDidChange(callback) {
      return vscode.Disposable.from(
        vscode.workspace.onDidChangeConfiguration(event => {
          if (event.affectsConfiguration('workbench.iconTheme') || settings.some(key => event.affectsConfiguration(key))) callback();
        }),
        vscode.extensions.onDidChange(callback),
      );
    },
  };
}
