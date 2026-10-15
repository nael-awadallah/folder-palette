import type { CatalogEntry } from '../types';

type Descriptor = Record<string, unknown> & { icon: string; extensions: string[] };
function descriptors(raw: unknown): Descriptor[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some(item => !item || typeof item !== 'object' || typeof item.icon !== 'string'
    || !Array.isArray(item.extensions) || item.extensions.some((name: unknown) => typeof name !== 'string'))) {
    throw new Error('Malformed vscode-icons association array');
  }
  return raw as Descriptor[];
}

/** Source-inspected workspace-first union; no rendering/collision acknowledgment implied. */
export function combineVscodeIconsLayers(user: unknown, workspace: unknown): readonly Descriptor[] {
  return [...descriptors(workspace), ...descriptors(user)].filter((entry, index, all) =>
    all.findIndex(other => JSON.stringify(other) === JSON.stringify(entry)) === index);
}

export function vscodeIconsMutation(raw: unknown, index: number, name: string, replacement?: CatalogEntry['native'], memberIndex?: number): Descriptor[] {
  const current = descriptors(raw);
  const selected = current[index];
  if (!selected || !selected.extensions.includes(name)) throw new Error('Stale descriptor identity');
  if (Object.keys(selected).some(key => !['icon', 'extensions', 'format', 'light'].includes(key))
    || (selected.format !== undefined && selected.format !== 'svg')
    || (selected.light !== undefined && typeof selected.light !== 'boolean')) throw new Error('Advanced descriptor is read-only');
  const occurrences = current.flatMap(entry => entry.extensions).filter(value => value.toLowerCase() === name.toLowerCase());
  if (memberIndex !== undefined && selected.extensions[memberIndex] !== name) throw new Error('Stale member identity');
  if (occurrences.length !== 1 && (replacement || memberIndex === undefined)) throw new Error('Duplicate or case-equivalent match');
  if (replacement && selected.icon === replacement.icon && selected.format === replacement.format
    && selected.light === replacement.light) return [...current];
  const remaining = selected.extensions.filter((value, position) => memberIndex === undefined ? value !== name : position !== memberIndex);
  const next = [...current];
  const items: Descriptor[] = remaining.length ? [{ ...selected, extensions: remaining }] : [];
  if (replacement) items.push({ ...replacement, extensions: [name] });
  next.splice(index, 1, ...items);
  return next;
}

