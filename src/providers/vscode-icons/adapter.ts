import { getCatalog } from '../../catalog/catalog';
import type { ProviderFoundation } from '../types';
import { describeVscodeIconsMatch } from './matching';
import { vscodeIconsDefinition } from './policy';

export const vscodeIconsFoundation: ProviderFoundation = Object.freeze({
  definition: vscodeIconsDefinition,
  describeMatch: describeVscodeIconsMatch,
  loadCatalog: () => getCatalog('vscode-icons').data,
});
