import { getCatalog } from '../catalog/catalog';
import { NativeAdapter, type NativeRule } from '../configuration/adapter';
import type { DetectionResult } from '../providers/types';
import type { FolderTarget } from '../ui/workflow';
import { prerequisite, saveMessage, type ChangeHost } from './change';

export interface ManagementHost extends ChangeHost { openSettings(setting: string): Promise<void> }

function canMutate(detection: DetectionResult, rule: NativeRule): boolean {
  const capabilities = detection.definition?.capabilities;
  const mode = rule.root ? 'root-name' : rule.matchText.includes('/') ? 'parent-name' : 'folder-name';
  return detection.writesEnabled && !!capabilities && capabilities.apply.enabled && capabilities.apply.evidence === 'runtime-verified'
    && capabilities.storage[rule.scope].enabled && capabilities.storage[rule.scope].evidence === 'runtime-verified'
    && capabilities.matching[mode].enabled && capabilities.matching[mode].evidence === 'runtime-verified';
}

/** Manage works from stored native settings, including associations whose folders no longer exist. */
export async function runManage(host: ManagementHost): Promise<void> { await runAssociations(host); }

/** Both workflows use adapter-owned identities and plans; no provider formats live in the UI. */
export async function runAssociations(host: ManagementHost, target?: FolderTarget): Promise<void> {
  try {
    provider: while (true) {
      const { detection, session } = host.context();
      if (!session || detection.status !== 'available' || !detection.providerId || !detection.definition) {
        if (await prerequisite(host, detection)) continue;
        return;
      }
      const adapter = new NativeAdapter(detection.providerId);
      const current = (): boolean => host.isCurrent(session);
      const rules: NativeRule[] = [];
      for (const root of detection.providerId === 'material' ? [false, true] : [false]) {
        if (target && root !== target.isRoot) continue;
        const layers = await host.read(adapter, { scope: 'user', key: '', root });
        if (!current()) continue provider;
        rules.push(...adapter.describeRules(layers, root, target));
      }
      if (!rules.length) { await host.notify(`${detection.definition.displayName}: No applicable stored customizations. Inherited/provider defaults may still apply.`); return; }
      const selected = await host.pick({ id: 'rules', title: `${detection.definition.displayName}: ${target ? 'Reset Folder Icon' : 'Manage Folder Associations'}`,
        placeholder: 'Choose one stored customization. Scope stores the rule; it does not limit its matching.',
        items: rules.map(rule => ({ value: rule.id, label: rule.matchText, description: `${rule.icon} · ${rule.scope} · ${rule.root ? 'root' : 'folder'}`,
          detail: `${rule.identity} · ${rule.status} · ${canMutate(detection, rule) && rule.removable ? 'Editable' : 'Read-only'} · ${rule.explanations.join(' ')}` })) });
      if (!current()) continue provider;
      const rule = rules.find(item => item.id === selected);
      if (!rule) return;
      while (true) {
        const writable = canMutate(detection, rule);
        const action = await host.pick({ id: 'rule-action', title: `${detection.definition.displayName}: ${rule.matchText}`, back: true,
          placeholder: writable && rule.removable ? 'Choose an action for this exact stored rule.' : 'Read-only: native semantics or runtime compatibility proof prevents writes.',
          detail: [`Provider: ${detection.definition.displayName} ${session.version}`, `Native identity: ${rule.identity}`, rule.status, ...rule.explanations, ...(!writable ? [detection.reason] : [])].join('\n'),
          items: [
            ...(writable && rule.removable ? [{ value: 'remove', label: 'Remove this stored customization', detail: 'Review remaining rules and fallback before Apply.' }] : []),
            ...(!target && writable && rule.replaceable ? [{ value: 'replace', label: 'Replace icon…', detail: 'Choose from this provider’s bundled catalog.' }] : []),
            { value: 'settings', label: 'Open Settings', detail: 'Inspect this provider’s native association setting.' }, { value: 'cancel', label: 'Cancel' },
          ] });
        if (!current()) continue provider;
        if (action === 'back') continue provider;
        if (action === 'settings') { await host.openSettings(adapter.setting({ scope: rule.scope, key: rule.matchText, root: rule.root })); return; }
        if (!writable || action !== 'remove' && action !== 'replace') return;
        const layers = await host.read(adapter, { scope: rule.scope, key: rule.matchText, root: rule.root });
        if (!current()) continue provider;
        let icon: string | undefined;
        if (action === 'replace') {
          const value = await host.pick({ id: 'replacement-icon', title: `${detection.definition.displayName}: Replacement icon`, back: true,
            placeholder: `Current native icon: ${rule.icon}. Search label, native ID or keywords.`,
            items: getCatalog(adapter.id).entries.map(entry => ({ value: entry.id, label: entry.label, description: entry.id, detail: entry.keywords.join(' ') })) });
          if (!current()) continue provider;
          if (value === 'back') continue;
          if (!value || !getCatalog(adapter.id).get(value)) return;
          icon = value;
        }
        const plan = icon === undefined ? adapter.planRemove(rule, layers) : adapter.planReplace(rule, layers, icon);
        const review = await host.pick({ id: icon === undefined ? 'review-removal' : 'review-replacement', title: `${detection.definition.displayName}: Review ${icon === undefined ? 'removal' : 'replacement'}`, back: true,
          placeholder: 'Apply saves exactly this customization. Escape cancels without saving.',
          detail: [`Provider: ${detection.definition.displayName} ${session.version}`, `Match text: ${rule.matchText}`, `Native identity: ${rule.identity}`, `Storage: ${rule.scope} settings`,
            `Setting family: ${rule.root ? 'named roots' : 'ordinary folders'}`, `Current native icon: ${rule.icon}`, rule.status, ...(icon ? [`Replacement icon: ${icon}`] : []), ...rule.explanations,
            'A saved setting does not confirm provider rendering. Automatic refresh or requested regeneration may remain pending/unconfirmed.'].join('\n'),
          items: [{ value: 'apply', label: 'Apply', detail: icon ? `Replace only this match with ${icon}` : 'Remove only this stored native identity; remaining rules may still apply.' }, { value: 'cancel', label: 'Cancel' }] });
        if (!current()) continue provider;
        if (review === 'back') continue;
        if (review !== 'apply') return;
        if (target) {
          const refreshed = await host.inspectTarget(target.uri);
          if (!refreshed || refreshed.isRoot !== target.isRoot || refreshed.name !== target.name || refreshed.parentName !== target.parentName) {
            await host.notify('Target directory or workspace-root classification changed. No settings changed; review Reset again.'); return;
          }
        }
        if (!current()) continue provider;
        await host.notify(saveMessage(await host.commit(adapter, plan)));
        return;
      }
    }
  } catch { await host.notify('Customization not saved or save could not be confirmed. Review the current provider and native settings before trying again.'); }
}
