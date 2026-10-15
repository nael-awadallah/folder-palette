import type { ProviderSession, ProviderSessionTracker } from '../providers/session';
import type { CatalogEntry } from '../providers/types';
import { getCatalog } from './catalog';

export interface CatalogChoice extends ProviderSession {
  readonly iconId: string;
}

/** Read-only browsing is allowed; this is not authorization to write settings. */
export function chooseIcon(tracker: ProviderSessionTracker, id: string): CatalogChoice | undefined {
  const session = tracker.capture();
  if (!session || !getCatalog(session.providerId).get(id)) return undefined;
  return Object.freeze({ ...session, iconId: id });
}

export function resolveChoice(tracker: ProviderSessionTracker, choice: CatalogChoice | undefined): CatalogEntry | undefined {
  if (!choice || !tracker.isCurrent(choice)) return undefined;
  return getCatalog(choice.providerId).get(choice.iconId);
}
