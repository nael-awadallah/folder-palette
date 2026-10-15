import { getCatalog } from '../catalog/catalog';
import { NativeAdapter, type MutationIntent, type MutationPlan, type NativeLayers } from '../configuration/adapter';
import type { SaveResult } from '../configuration/writeCoordinator';
import { availableMatchingModes, availableStorageScopes } from '../providers/capabilities';
import { getProviderFoundation } from '../providers/foundations';
import type { ProviderSession } from '../providers/session';
import type { DetectionResult, MatchMode, ProviderId } from '../providers/types';
import { selectTarget } from '../ui/target';
import type { TargetHost } from '../ui/workflow';

export interface ChangeHost extends TargetHost {
  context(): { detection: DetectionResult; session?: ProviderSession };
  isCurrent(session: ProviderSession): boolean;
  canChooseTheme(): boolean;
  chooseTheme(): Promise<void>;
  openProvider(provider: ProviderId): Promise<void>;
  read(adapter: NativeAdapter, intent: MutationIntent): Promise<NativeLayers>;
  commit(adapter: NativeAdapter, plan: MutationPlan): Promise<SaveResult>;
}
const modeLabels: Record<MatchMode, string> = { 'folder-name': 'Folder name', 'parent-name': 'Immediate parent / folder name', 'root-name': 'Workspace root basename' };

export async function prerequisite(host: ChangeHost, detection: DetectionResult): Promise<boolean> {
  const limitations = detection.definition ? Object.values(detection.definition.capabilities.storage).map(item => item.reason).join(' ') : '';
  const action = await host.pick({ id: 'prerequisite', title: 'FolderPalette: Customization unavailable',
    placeholder: detection.reason, detail: `${detection.reason}\n${limitations}`, items: [
      ...(host.canChooseTheme() ? [{ value: 'choose', label: 'Choose File Icon Theme…', detail: 'Select a theme yourself in VS Code.' }] : []),
      { value: 'material', label: 'View Material Icon Theme' }, { value: 'vscode-icons', label: 'View vscode-icons' }, { value: 'cancel', label: 'Cancel' },
    ] });
  if (action === 'choose') { await host.chooseTheme(); return true; }
  if (action === 'material' || action === 'vscode-icons') await host.openProvider(action);
  return false;
}

export function saveMessage(result: SaveResult): string {
  if (!result.saved) return 'No settings changed.';
  const prefix = `${result.providerId === 'material' ? 'Material Icon Theme' : 'vscode-icons'} customization saved; `;
  switch (result.apply) {
    case 'automatic-handoff': return prefix + 'automatic provider refresh handed off. Rendering completion is unconfirmed.';
    case 'completion-unconfirmed': return prefix + 'provider apply requested. Completion is unconfirmed; provider prompts or reload may still be required.';
    case 'pending': return prefix + 'apply pending because the provider or target changed. Return to the saved provider before applying.';
    case 'failed': return prefix + 'provider apply failed or is unavailable. The saved settings remain; use the provider’s Apply Icons Customization action or inspect its output.';
    case 'not-needed': return prefix + 'no provider apply requested.';
  }
}

/** Provider-native formats stay in adapters; cancellation before Apply never calls commit. */
export async function runChange(host: ChangeHost, candidates: readonly string[] = []): Promise<void> {
  try {
    provider: while (true) {
      const { detection, session } = host.context();
      const apply = detection.definition?.capabilities.apply;
      const modes = availableMatchingModes(detection);
      const scopes = availableStorageScopes(detection).filter(scope => scope !== 'workspace-folder');
      if (!session || detection.status !== 'available' || !detection.providerId || !detection.definition || !detection.writesEnabled
        || !apply?.enabled || apply.evidence !== 'runtime-verified' || !modes.length || !scopes.length) {
        if (await prerequisite(host, detection)) continue;
        return;
      }
      const adapter = new NativeAdapter(detection.providerId);
      const foundation = getProviderFoundation(detection.providerId);
      const catalog = getCatalog(detection.providerId);
      const current = (): boolean => host.isCurrent(session);
      let target = await selectTarget(host, candidates);
      if (!current()) continue provider;
      if (!target) return;
      let stage = 0;
      let mode: MatchMode | undefined;
      let scope: 'user' | 'workspace' | undefined;
      let icon: string | undefined;
      while (true) {
        if (!current()) { await host.notify('Provider changed. Previous icon selection cleared; start again with the active theme.'); continue provider; }
        const allowed = modes.filter(value => target!.isRoot ? value === 'root-name' : value !== 'root-name');
        if (!allowed.length) { await host.notify('This provider has no verified matching mode for this target. Named roots cannot be changed through an all-roots default.'); return; }
        if (stage === 0) {
          const value = await host.pick({ id: 'matching', title: `${detection.definition.displayName}: Matching`, placeholder: `Target: ${target.displayName}. Matching is independent of settings storage.`, back: true,
            items: allowed.map(value => ({ value, label: modeLabels[value], detail: value === 'parent-name' ? 'Matches this immediate parent/name pair wherever it occurs; not a full path.' : 'Matches repeated names wherever they occur.' })) });
          if (!current()) continue provider;
          if (value === undefined) return;
          if (value === 'back') { target = await selectTarget(host, candidates, true); if (!current()) continue provider; if (!target) return; mode = undefined; scope = undefined; icon = undefined; continue; }
          if (!allowed.includes(value as MatchMode)) return;
          mode = value as MatchMode; stage = 1; scope = undefined; icon = undefined;
        } else if (stage === 1) {
          const value = await host.pick({ id: 'storage', title: `${detection.definition.displayName}: Storage`, placeholder: 'Choose explicitly where to store the rule. Storage does not limit matching to this folder.', back: true,
            items: scopes.map(value => ({ value, label: value === 'user' ? 'User settings' : 'Workspace settings', detail: detection.definition!.capabilities.storage[value].reason })) });
          if (!current()) continue provider;
          if (value === undefined) return;
          if (value === 'back') { stage = 0; continue; }
          if (value !== 'user' && value !== 'workspace' || !scopes.includes(value)) return;
          scope = value; stage = 2; icon = undefined;
        } else {
          if (!mode || !scope) return;
          const rawKey = mode === 'parent-name' ? `${target.parentName}/${target.name}` : target.name;
          const match = foundation.describeMatch(mode, rawKey);
          if (!match.valid || !match.key) { await host.notify(match.reason); return; }
          const base: MutationIntent = { scope, key: match.key, root: mode === 'root-name' };
          const layers = await host.read(adapter, base);
          const state = adapter.describeChange(layers, base);
          if (stage === 2) {
            const value = await host.pick({ id: 'icon', title: `${detection.definition.displayName}: Folder icon`, placeholder: `Search label, native ID, or keywords. Current: ${state.currentIcon ?? 'inherited/provider default'}. No matches? Clear the search.`, back: true,
              items: catalog.entries.map(entry => ({ value: entry.id, label: entry.label, description: entry.id,
                detail: `${entry.keywords.join(' ')}${entry.id === state.currentIcon ? ' · Current stored choice' : ''}`, picked: entry.id === icon })) });
            if (!current()) continue provider;
            if (value === undefined) return;
            if (value === 'back') { stage = 1; continue; }
            if (!catalog.get(value)) return;
            icon = value; stage = 3;
          } else {
            if (!icon) return;
            const intent: MutationIntent = { ...base, key: state.key, ...(state.index === undefined ? {} : { index: state.index }), icon };
            const plan = adapter.plan(layers, intent);
            const detail = [
              `Provider: ${detection.definition.displayName} ${session.version}`,
              `Target: ${target.displayName}`,
              `Exact match: ${match.key}`,
              `Provider matches/aliases: ${match.matches.join(', ')}`,
              `Storage: ${scope === 'user' ? 'User' : 'Workspace'} settings`,
              `Icon: ${icon}`,
              match.reason, ...state.explanations,
              detection.providerId === 'material' ? 'Save hands off automatic refresh; completion cannot be confirmed.' : 'Save requests provider regeneration; prompts, cancellation or reload may leave completion unconfirmed.',
            ].join('\n');
            const value = await host.pick({ id: 'review', title: `${detection.definition.displayName}: Review change`, placeholder: 'Apply saves this one customization. Escape cancels without saving.', detail, back: true,
              items: [{ value: 'apply', label: 'Apply', detail: `Save ${icon} for ${match.key} in ${scope} settings` }, { value: 'cancel', label: 'Cancel' }] });
            if (!current()) continue provider;
            if (value === 'back') { stage = 2; continue; }
            if (value !== 'apply') return;
            const refreshed = await host.inspectTarget(target.uri);
            if (!refreshed) { await host.notify('The target directory is no longer available. No settings changed.'); return; }
            if (refreshed.uri !== target.uri || refreshed.isRoot !== target.isRoot || refreshed.name !== target.name || refreshed.parentName !== target.parentName) {
              await host.notify('The target folder or workspace-root classification changed. Start again to review matching. No settings changed.'); return;
            }
            if (!current()) continue provider;
            const result = await host.commit(adapter, plan);
            await host.notify(saveMessage(result));
            return;
          }
        }
      }
    }
  } catch { await host.notify('Customization not saved or save could not be confirmed. Review the current provider, directory and settings before trying again.'); }
}



