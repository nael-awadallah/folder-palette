import { capability } from '../capability';
import type { ProviderDefinition } from '../types';

export const vscodeIconsDefinition: ProviderDefinition = Object.freeze({
  id: 'vscode-icons',
  displayName: 'vscode-icons',
  themeId: 'vscode-icons',
  extensionId: 'vscode-icons-team.vscode-icons',
  catalogVersion: '13.0.0',
  capabilities: Object.freeze({
    matching: Object.freeze({
      'folder-name': capability('source-inspected', 'Descriptor names map into folder names; runtime proof pending.'),
      'parent-name': capability('source-inspected', 'Direct-parent keys pass through the generator; runtime proof pending.'),
      'root-name': capability('unsupported', 'No supported named-root format; all-roots defaults are outside v1.'),
    }),
    storage: Object.freeze({
      user: capability('unverified', 'Native array merging and runtime behavior require proof.'),
      workspace: capability('unverified', 'Array precedence and shared generated-theme isolation require proof.'),
      'workspace-folder': capability('unsupported', 'No resource-scoped read established for the provider.'),
    }),
    apply: capability('source-inspected', 'Documented regenerateIcons command; runtime completion and failures unverified.'),
  }),
});
