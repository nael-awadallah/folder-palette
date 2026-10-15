import { materialDefinition } from './material/policy';
import { vscodeIconsDefinition } from './vscode-icons/policy';
import type { DetectionResult, HostSnapshot, ProviderDefinition, ProviderId } from './types';

export const providerDefinitions: readonly ProviderDefinition[] = Object.freeze([
  materialDefinition, vscodeIconsDefinition,
]);

export function getProviderDefinition(id: ProviderId): ProviderDefinition {
  return id === 'material' ? materialDefinition : vscodeIconsDefinition;
}

export function detectProvider(snapshot: HostSnapshot): DetectionResult {
  const themeId = typeof snapshot.activeThemeId === 'string' ? snapshot.activeThemeId : null;
  const definition = providerDefinitions.find(provider => provider.themeId === themeId);
  if (!definition) {
    return Object.freeze({ status: 'unsupported', themeId, writesEnabled: false,
      reason: 'Choose Material Icon Theme or vscode-icons using the native File Icon Theme picker.' });
  }
  const base = { themeId, providerId: definition.id, definition, writesEnabled: false } as const;
  const extension = snapshot.extensions.find(item => item.id.toLowerCase() === definition.extensionId.toLowerCase());
  if (!extension) {
    return Object.freeze({ ...base, status: 'unavailable', reason: 'The selected provider is unavailable in this window. It may be missing, disabled, or inaccessible in this host.' });
  }
  const installed = { ...base, version: extension.version };
  if (extension.version !== definition.catalogVersion) {
    return Object.freeze({ ...installed, status: 'untested-version', reason: `The bundled catalog targets ${definition.catalogVersion}; installed version ${extension.version} has no verified policy.` });
  }
  const settings = snapshot.settings ?? {};
  const suppressed = definition.id === 'material'
    ? settings['material-icon-theme.folders.theme'] === 'none'
    : settings['vsicons.presets.hideFolders'] === true || settings['vsicons.presets.foldersAllDefaultIcon'] === true;
  if (suppressed) {
    return Object.freeze({ ...installed, status: 'suppressed', reason: 'The provider configuration suppresses custom folder icons. FolderPalette does not change these preferences.' });
  }
  return Object.freeze({ ...installed, status: 'available', reason: 'Provider identity and catalog version recognized. Compatibility proof is incomplete; customization writes are disabled.' });
}
