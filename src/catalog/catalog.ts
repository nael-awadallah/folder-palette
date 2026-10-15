import materialData from '../../catalog/material/icons.json';
import vscodeIconsData from '../../catalog/vscode-icons/icons.json';
import { getProviderDefinition } from '../providers/registry';
import type { CatalogData, CatalogEntry, ProviderId } from '../providers/types';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export class Catalog {
  readonly data: CatalogData;
  readonly entries: readonly CatalogEntry[];
  #byId = new Map<string, CatalogEntry>();

  constructor(providerId: ProviderId, data: unknown) {
    const definition = getProviderDefinition(providerId);
    if (!isRecord(data) || data.schemaVersion !== 1 || data.providerId !== providerId) throw new Error('Invalid catalog provider/schema');
    if (data.providerVersion !== definition.catalogVersion) throw new Error('Invalid catalog version');
    if (!Array.isArray(data.entries) || !data.entries.length) throw new Error('Invalid or empty catalog');
    const entries: CatalogEntry[] = [];
    for (const value of data.entries) {
      if (!isRecord(value) || typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(value.id)) throw new Error('Invalid catalog identifier');
      if (this.#byId.has(value.id)) throw new Error('Duplicate catalog identifier');
      if (typeof value.label !== 'string' || !value.label.trim() || !Array.isArray(value.keywords) || value.keywords.some(keyword => typeof keyword !== 'string')) throw new Error('Invalid catalog search metadata');
      const native = value.native;
      if (!isRecord(native) || native.icon !== value.id || Object.keys(native).some(key => !['icon', 'format', 'light'].includes(key))) throw new Error('Invalid native catalog payload');
      if (providerId === 'vscode-icons' && (native.format !== 'svg' || typeof native.light !== 'boolean')) throw new Error('Invalid native vscode-icons descriptor');
      if (providerId === 'material' && (native.format !== undefined || native.light !== undefined)) throw new Error('Invalid native Material descriptor');
      const entry: CatalogEntry = Object.freeze({ id: value.id, label: value.label, keywords: Object.freeze([...value.keywords] as string[]), native: Object.freeze(providerId === 'material'
        ? { icon: value.id } : { icon: value.id, format: 'svg', light: native.light as boolean }) });
      entries.push(entry);
      this.#byId.set(entry.id, entry);
    }
    this.entries = Object.freeze(entries);
    this.data = Object.freeze({ schemaVersion: 1, providerId, providerVersion: definition.catalogVersion, entries: this.entries });
    Object.freeze(this);
  }

  get(id: string): CatalogEntry | undefined { return this.#byId.get(id); }
}

const loaded = new Map<ProviderId, Catalog>();
export function getCatalog(providerId: ProviderId): Catalog {
  const existing = loaded.get(providerId);
  if (existing) return existing;
  const data = providerId === 'material' ? materialData : vscodeIconsData;
  const catalog = new Catalog(providerId, data);
  loaded.set(providerId, catalog);
  return catalog;
}

export function searchCatalog(catalog: Catalog, query: string): readonly CatalogEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return catalog.entries;
  return catalog.entries.filter(entry => {
    const text = [entry.id, entry.label, ...entry.keywords].join(' ').toLowerCase();
    return terms.every(term => text.includes(term));
  });
}
