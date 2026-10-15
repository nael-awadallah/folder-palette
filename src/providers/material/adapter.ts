import { getCatalog } from '../../catalog/catalog';
import type { ProviderFoundation } from '../types';
import { describeMaterialMatch } from './matching';
import { materialDefinition } from './policy';

export const materialFoundation: ProviderFoundation = Object.freeze({
  definition: materialDefinition,
  describeMatch: describeMaterialMatch,
  loadCatalog: () => getCatalog('material').data,
});
