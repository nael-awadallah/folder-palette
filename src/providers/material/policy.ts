import { capability } from '../capability';
import type { ProviderDefinition } from '../types';

export const materialDefinition: ProviderDefinition = Object.freeze({
  id: 'material',
  displayName: 'Material Icon Theme',
  themeId: 'material-icon-theme',
  extensionId: 'PKief.material-icon-theme',
  catalogVersion: '5.39.0',
  capabilities: Object.freeze({
    matching: Object.freeze({
      'folder-name': capability('runtime-verified', 'Name and generated variants observed with 5.39.0.', true),
      'parent-name': capability('runtime-verified', 'One direct parent segment; repeated pairs are not unique paths.', true),
      'root-name': capability('runtime-verified', 'Separate root-name associations match the workspace root basename.', true),
    }),
    storage: Object.freeze({
      user: capability('unverified', 'User writes observed, but safe storage and cross-window isolation are not yet verified.'),
      workspace: capability('unsupported', 'Shared generated-theme interference reproduced across workspace windows.'),
      'workspace-folder': capability('unsupported', 'Not a resource-scoped provider setting.'),
    }),
    apply: capability('runtime-verified', 'Automatic refresh observed; all product writes remain gated.'),
  }),
});
