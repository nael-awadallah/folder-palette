import { detectProvider } from './registry';
import type { DetectionResult, HostSnapshot, ProviderId } from './types';

export interface ProviderSession {
  readonly providerId: ProviderId;
  readonly themeId: string;
  readonly version: string;
  readonly revision: number;
}

export class ProviderSessionTracker {
  #revision = 0;
  #detection: DetectionResult;

  constructor(snapshot: HostSnapshot) {
    this.#detection = detectProvider(snapshot);
  }

  get detection(): DetectionResult { return this.#detection; }

  update(snapshot: HostSnapshot): DetectionResult {
    const next = detectProvider(snapshot);
    if (JSON.stringify(next) !== JSON.stringify(this.#detection)) this.#revision++;
    this.#detection = next;
    return next;
  }

  capture(): ProviderSession | undefined {
    const current = this.#detection;
    if (current.status !== 'available' || !current.providerId || !current.themeId || !current.version) return undefined;
    return Object.freeze({ providerId: current.providerId, themeId: current.themeId, version: current.version, revision: this.#revision });
  }

  isCurrent(session: ProviderSession | undefined): boolean {
    const current = this.capture();
    return !!current && !!session && current.revision === session.revision && current.providerId === session.providerId
      && current.themeId === session.themeId && current.version === session.version;
  }
}
