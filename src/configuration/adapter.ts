import { getCatalog } from '../catalog/catalog';
import { materialMutation } from '../providers/material/configuration';
import { describeMaterialMatch } from '../providers/material/matching';
import { describeVscodeIconsMatch } from '../providers/vscode-icons/matching';
import { vscodeIconsMutation } from '../providers/vscode-icons/configuration';
import type { ProviderId } from '../providers/types';

export interface NativeLayers { readonly user?: unknown; readonly workspace?: unknown }
export interface MutationIntent {
  readonly scope: 'user' | 'workspace';
  readonly key: string;
  readonly icon?: string;
  readonly root?: boolean;
  readonly index?: number;
  readonly memberIndex?: number;
  /** Adapter-owned Reset dependencies; never persisted into provider settings. */
  readonly reviewKeys?: readonly string[];
}
export interface MutationPlan {
  readonly providerId: ProviderId;
  readonly setting: string;
  readonly intent: MutationIntent;
  readonly fingerprint: string;
}
export interface NativeRule {
  readonly id: string;
  readonly matchText: string;
  readonly icon: string;
  readonly scope: 'user' | 'workspace';
  readonly root: boolean;
  readonly identity: string;
  readonly status: string;
  readonly removable: boolean;
  readonly replaceable: boolean;
  readonly explanations: readonly string[];
  /** Opaque reviewed native identity; shared UI must not construct or modify it. */
  readonly removal?: MutationPlan;
}
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export class NativeAdapter {
  constructor(readonly id: ProviderId) {}

  setting(intent: MutationIntent): string {
    if (this.id === 'material') return intent.root ? 'material-icon-theme.rootFolders.associations' : 'material-icon-theme.folders.associations';
    if (intent.root) throw new Error('Named roots are unsupported');
    return 'vsicons.associations.folders';
  }

  fingerprint(layers: NativeLayers, intent: MutationIntent): string {
    if (this.id === 'vscode-icons') return stable(layers); // Index alone cannot survive reordering.
    const aliases = new Set(describeMaterialMatch(intent.key.includes('/') ? 'parent-name' : 'folder-name', intent.key).matches.map(key => key.toLowerCase()));
    aliases.add(intent.key.toLowerCase());
    for (const key of intent.reviewKeys ?? []) {
      aliases.add(key.toLowerCase());
      for (const alias of describeMaterialMatch(key.includes('/') ? 'parent-name' : 'folder-name', key).matches) aliases.add(alias.toLowerCase());
    }
    if (intent.key.includes('/')) {
      for (const name of describeMaterialMatch('folder-name', intent.key.split('/').at(-1)!).matches) aliases.add(name.toLowerCase());
    }
    return stable(Object.fromEntries(['user', 'workspace'].map(scope => {
      const raw = layers[scope as keyof NativeLayers];
      if (raw === undefined) return [scope, {}];
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Malformed Material map');
      return [scope, Object.fromEntries(Object.entries(raw).filter(([key]) => {
        const match = describeMaterialMatch(key.includes('/') ? 'parent-name' : 'folder-name', key);
        return aliases.has(key.toLowerCase()) || match.matches.some(alias => aliases.has(alias.toLowerCase()));
      }))];
    })));
  }

  plan(layers: NativeLayers, intent: MutationIntent): MutationPlan {
    const copy = Object.freeze({ ...intent, ...(intent.reviewKeys ? { reviewKeys: Object.freeze([...intent.reviewKeys]) } : {}) });
    this.mutate(layers, copy); // Validate before presenting review, including catalog and native identity.
    return Object.freeze({ providerId: this.id, setting: this.setting(copy), intent: copy, fingerprint: this.fingerprint(layers, copy) });
  }

  mutate(layers: NativeLayers, intent: MutationIntent): unknown {
    this.setting(intent);
    const catalog = getCatalog(this.id).data;
    const entry = intent.icon === undefined ? undefined : catalog.entries.find(item => item.id === intent.icon);
    if (intent.icon !== undefined && !entry) throw new Error('Icon is not in this provider catalog');
    const raw = layers[intent.scope];
    if (this.id === 'material') return materialMutation(raw, intent.key, entry?.native.icon);
    if (entry && !describeVscodeIconsMatch(intent.key.includes('/') ? 'parent-name' : 'folder-name', intent.key).valid) throw new Error('Unsupported match');
    if (intent.index !== undefined) return vscodeIconsMutation(raw, intent.index, intent.key, entry?.native, intent.memberIndex);
    if (!entry) throw new Error('Removal requires exact descriptor identity');
    if (raw !== undefined && !Array.isArray(raw)) throw new Error('Malformed association array');
    // Validate new arrays through the same mutation validator; no duplicate match may be introduced.
    const next = [...(raw as unknown[] | undefined ?? []), { ...entry.native, extensions: [intent.key] }];
    vscodeIconsMutation(next, next.length - 1, intent.key);
    return next;
  }

  describeRules(layers: NativeLayers, root = false, target?: { name: string; parentName: string; isRoot: boolean }): NativeRule[] {
    if (root && this.id !== 'material' || target && root !== target.isRoot) return [];
    const rules: NativeRule[] = [];
    const add = (scope: 'user' | 'workspace', key: string, icon: unknown, identity: string, intent?: MutationIntent): void => {
      if (target) {
        const match = this.id === 'material' ? describeMaterialMatch(root ? 'root-name' : key.includes('/') ? 'parent-name' : 'folder-name', key)
          : describeVscodeIconsMatch(key.includes('/') ? 'parent-name' : 'folder-name', key);
        const candidates = [target.name, ...(!root ? [`${target.parentName}/${target.name}`] : [])].map(name => name.toLowerCase());
        if (!match.matches.some(name => candidates.includes(name.toLowerCase()))) return;
      }
      let removal: MutationPlan | undefined;
      if (intent && typeof icon === 'string') {
        try { removal = this.plan(layers, { ...intent, ...(target ? { reviewKeys: [target.name, ...(!root ? [`${target.parentName}/${target.name}`] : [])] } : {}) }); }
        catch { /* Unsafe native data remains visible. */ }
      }
      const known = typeof icon === 'string' && getCatalog(this.id).data.entries.some(entry => entry.native.icon === icon);
      let replaceable = false;
      if (removal) {
        try { this.plan(layers, { ...removal.intent, icon: getCatalog(this.id).data.entries[0]!.id }); replaceable = true; } catch { /* Exact removal can be safer than replacement. */ }
      }
      const context = ['User', 'Workspace'].map((label, index) => `${label} stored rules: ${JSON.stringify(layers[index ? 'workspace' : 'user'] ?? (this.id === 'material' ? {} : []))}.`);
      let status = scope === 'user' ? 'User rule; inherited in Workspace' : 'Workspace rule';
      if (this.id === 'material') {
        const names = (rawKey: string): string[] => [rawKey.toLowerCase(), ...describeMaterialMatch(root ? 'root-name' : rawKey.includes('/') ? 'parent-name' : 'folder-name', rawKey).matches.map(name => name.toLowerCase())];
        const selectedNames = new Set(names(key));
        for (const otherScope of ['user', 'workspace'] as const) {
          const raw = layers[otherScope];
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
          for (const otherKey of Object.keys(raw)) {
            if (otherScope === scope && otherKey === key || !names(otherKey).some(name => selectedNames.has(name))) continue;
            const nativeIdentity = `${otherScope === 'user' ? 'User' : 'Workspace'} key ${JSON.stringify(otherKey)}`;
            const equivalent = otherKey.toLowerCase() === key.toLowerCase();
            if (otherScope === scope) {
              status += `; ${equivalent ? 'case-equivalent' : 'generated-alias'} collision with ${nativeIdentity}; same-layer ordering unverified`;
            } else if (equivalent) {
              status += scope === 'workspace' ? `; Masked by ${nativeIdentity} under observed User precedence` : `; Masks ${nativeIdentity} under observed User precedence`;
            } else {
              status += `; generated-alias overlap with ${nativeIdentity}; masking/ordering unverified`;
            }
          }
        }
      } else {
        const count = [layers.user, layers.workspace].flatMap(raw => Array.isArray(raw) ? raw : []).flatMap((raw: unknown) =>
          raw && typeof raw === 'object' && 'extensions' in raw && Array.isArray(raw.extensions) ? raw.extensions : [])
          .filter((name: unknown) => typeof name === 'string' && name.toLowerCase() === key.toLowerCase()).length;
        if (count > 1) status += '; duplicate/case-equivalent rules remain; precedence unverified';
      }
      if (!removal) status += '; unsupported native mutation, read-only';
      const explanations = [
        ...context,
        this.id === 'material'
          ? 'Material 5.39.0 observed User-over-Workspace precedence: User rules can mask Workspace rules. Removing this rule may expose inherited, broader or alias rules, then provider defaults. Rendering isolation remains unproven.'
          : 'vscode-icons combines Workspace then User arrays; inherited, duplicate/case-equivalent members and broader rules may remain after removal. Collision/rendering precedence is unverified. Provider defaults apply when no customization remains.',
        known ? 'Catalog icon recognized.' : 'Unknown/native icon or advanced value; preserved verbatim.',
        removal ? 'Remove only this exact stored customization; retain the container even when empty. Empty containers do not guarantee blocked inheritance.' : 'Read-only: native semantics or malformed data cannot be safely mutated. Open Settings to inspect.',
      ];
      rules.push(Object.freeze({ id: `${root ? 'root' : 'folder'}:${scope}:${identity}`, matchText: key, icon: typeof icon === 'string' ? icon : JSON.stringify(icon) ?? 'unknown', scope, root, identity, status,
        removable: !!removal, replaceable, explanations: Object.freeze(explanations), ...(removal ? { removal } : {}) }));
    };
    for (const scope of ['user', 'workspace'] as const) {
      const raw = layers[scope];
      if (raw === undefined) continue;
      if (this.id === 'material') {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { add(scope, '(malformed association setting)', raw, 'setting'); continue; }
        for (const [key, icon] of Object.entries(raw)) add(scope, key, icon, `key ${JSON.stringify(key)}`, { scope, key, root });
      } else {
        if (!Array.isArray(raw)) { add(scope, '(malformed association setting)', raw, 'setting'); continue; }
        raw.forEach((value: unknown, index) => {
          const descriptor = value && typeof value === 'object' ? value as Record<string, unknown> : {};
          const members = descriptor.extensions;
          if (!Array.isArray(members) || !members.length) { add(scope, '(advanced or empty descriptor)', descriptor.icon ?? value, `descriptor ${index + 1}`); return; }
          members.forEach((key: unknown, memberIndex) => add(scope, typeof key === 'string' ? key : '(malformed member)', descriptor.icon,
            `descriptor ${index + 1}, member ${memberIndex + 1}`, typeof key === 'string' ? { scope, key, index, memberIndex } : undefined));
        });
      }
    }
    return rules;
  }

  planRemove(rule: NativeRule, layers: NativeLayers): MutationPlan {
    if (!rule.removal || !rule.removable) throw new Error('Native rule is read-only');
    this.reconcile(rule.removal, layers);
    return rule.removal;
  }

  planReplace(rule: NativeRule, layers: NativeLayers, icon: string): MutationPlan {
    if (!rule.replaceable || !rule.removal) throw new Error('Native replacement is read-only');
    this.reconcile(rule.removal, layers);
    return this.plan(layers, { ...rule.removal.intent, icon });
  }

  describeChange(layers: NativeLayers, intent: MutationIntent): { key: string; index?: number; currentIcon?: string; explanations: string[] } {
    const explanations: string[] = [];
    let key = intent.key;
    let index: number | undefined;
    let currentIcon: string | undefined;
    for (const scope of ['user', 'workspace'] as const) {
      const raw = layers[scope];
      if (raw === undefined) { explanations.push(`${scope}: no stored association setting; provider defaults or other layers may apply.`); continue; }
      if (this.id === 'material') {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Malformed Material map');
        const entries = Object.entries(raw);
        const exact = entries.filter(([name]) => name.toLowerCase() === intent.key.toLowerCase());
        if (exact.length > 1) throw new Error('Case-equivalent native keys require Settings review');
        if (scope === intent.scope && exact[0]) {
          key = exact[0][0];
          if (typeof exact[0][1] === 'string') currentIcon = exact[0][1];
        }
        const relevant = entries.filter(([name]) => {
          const test = { [scope]: Object.fromEntries(entries.filter(([candidate]) => candidate === name)) };
          return this.fingerprint(test, intent) !== this.fingerprint({}, intent);
        });
        explanations.push(`${scope} relevant stored rules: ${relevant.length ? relevant.map(([name, icon]) => `${name} → ${JSON.stringify(icon)}`).join('; ') : 'none'}.`);
      } else {
        if (!Array.isArray(raw)) throw new Error('Malformed vscode-icons array');
        const matches = raw.flatMap((item: unknown, itemIndex) => {
          if (!item || typeof item !== 'object' || !('extensions' in item) || !Array.isArray(item.extensions)) throw new Error('Malformed native descriptor');
          return item.extensions.filter((name: unknown) => typeof name === 'string' && name.toLowerCase() === intent.key.toLowerCase())
            .map((name: string) => ({ item, itemIndex, name }));
        });
        if (scope === intent.scope) {
          if (matches.length > 1) throw new Error('Duplicate native matches require Settings review');
          if (matches[0]) {
            index = matches[0].itemIndex; key = matches[0].name;
            const item = matches[0].item;
            if ('icon' in item && typeof item.icon === 'string') currentIcon = item.icon;
          }
        }
        explanations.push(`${scope} relevant native descriptors: ${matches.length ? matches.map(match => JSON.stringify(match.item)).join('; ') : 'none'}.`);
      }
    }
    explanations.push(this.id === 'material'
      ? 'Material 5.39.0 observed User-over-Workspace precedence: a User rule can mask a Workspace edit. Generated aliases and broader rules can also affect rendering. Multi-window rendering isolation is unproven.'
      : 'vscode-icons combines Workspace then User descriptors independently of VS Code effective arrays. Inherited, duplicate and broader rules may still apply; rendering precedence and multi-window isolation require provider proof.');
    return { key, ...(index === undefined ? {} : { index }), ...(currentIcon === undefined ? {} : { currentIcon }), explanations };
  }
  reconcile(plan: MutationPlan, latest: NativeLayers): { value: unknown; changed: boolean } {
    if (plan.providerId !== this.id || plan.setting !== this.setting(plan.intent)
      || plan.fingerprint !== this.fingerprint(latest, plan.intent)) throw new Error('Review is stale; review again');
    const value = this.mutate(latest, plan.intent);
    const absentRemoval = latest[plan.intent.scope] === undefined && plan.intent.icon === undefined;
    return { value, changed: !absentRemoval && stable(value) !== stable(latest[plan.intent.scope]) };
  }
}



