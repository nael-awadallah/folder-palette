export type ProviderId = 'material' | 'vscode-icons';
export type MatchMode = 'folder-name' | 'parent-name' | 'root-name';
export type StorageScope = 'user' | 'workspace' | 'workspace-folder';
export type EvidenceStatus = 'documented' | 'source-inspected' | 'runtime-verified' | 'unsupported' | 'unverified';

export interface Capability {
  readonly enabled: boolean;
  readonly evidence: EvidenceStatus;
  readonly reason: string;
}

export interface ProviderCapabilities {
  readonly matching: Readonly<Record<MatchMode, Capability>>;
  readonly storage: Readonly<Record<StorageScope, Capability>>;
  readonly apply: Capability;
}

export interface ProviderDefinition {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly themeId: string;
  readonly extensionId: string;
  readonly catalogVersion: string;
  readonly capabilities: ProviderCapabilities;
}

export interface ExtensionMetadata {
  readonly id: string;
  readonly version: string;
  /** Activation is deliberately not used to infer enabled/disabled status. */
  readonly isActive?: boolean;
}

export interface HostSnapshot {
  readonly activeThemeId: unknown;
  /** Extensions visible through the public API in this host. Absence is not a precise disablement diagnosis. */
  readonly extensions: readonly ExtensionMetadata[];
  readonly settings?: Readonly<Record<string, unknown>>;
}

export interface DetectionResult {
  readonly status: 'available' | 'unsupported' | 'unavailable' | 'untested-version' | 'suppressed';
  readonly themeId: string | null;
  readonly providerId?: ProviderId;
  readonly version?: string;
  readonly definition?: ProviderDefinition;
  readonly reason: string;
  /** No settings writes are permitted until the compatibility gate is resolved. */
  readonly writesEnabled: boolean;
}

export interface MatchDescription {
  readonly valid: boolean;
  readonly key?: string;
  readonly matches: readonly string[];
  readonly evidence: EvidenceStatus;
  readonly reason: string;
}

export interface CatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly keywords: readonly string[];
  readonly native: Readonly<{ icon: string; format?: 'svg'; light?: boolean }>;
}

export interface CatalogData {
  readonly schemaVersion: 1;
  readonly providerId: ProviderId;
  readonly providerVersion: string;
  readonly entries: readonly CatalogEntry[];
}

/** Provider metadata, matching semantics and bundled catalog access. */
export interface ProviderFoundation {
  readonly definition: ProviderDefinition;
  describeMatch(mode: MatchMode, key: string): MatchDescription;
  loadCatalog(): CatalogData;
}
