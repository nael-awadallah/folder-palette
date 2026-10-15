import { materialFoundation } from './material/adapter';
import { vscodeIconsFoundation } from './vscode-icons/adapter';
import type { ProviderFoundation, ProviderId } from './types';

export function getProviderFoundation(id: ProviderId): ProviderFoundation {
  switch (id) {
    case 'material': return materialFoundation;
    case 'vscode-icons': return vscodeIconsFoundation;
    default: throw new Error('Unsupported FolderPalette provider');
  }
}

export { NativeAdapter } from '../configuration/adapter';
