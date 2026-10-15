import { describeMaterialMatch } from './matching';

function map(raw: unknown): Record<string, unknown> {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Malformed Material association map');
  return raw as Record<string, unknown>;
}

/** Explanation only: observed 5.39.0 provider precedence, not VS Code effective configuration. */
export function materialView(user: unknown, workspace: unknown): Record<string, unknown> {
  return { ...map(workspace), ...map(user) };
}

export function materialMutation(raw: unknown, key: string, icon: string | undefined): Record<string, unknown> {
  const current = map(raw);
  if (icon !== undefined) {
    const match = describeMaterialMatch(key.includes('/') ? 'parent-name' : 'folder-name', key);
    if (!match.valid) throw new Error('Unsupported Material match');
    const aliases = new Set(match.matches.map(name => name.toLowerCase()));
    for (const existing of Object.keys(current)) {
      if (existing === key) continue;
      const other = describeMaterialMatch(existing.includes('/') ? 'parent-name' : 'folder-name', existing);
      if (other.matches.some(name => aliases.has(name.toLowerCase()))) throw new Error('Material alias or case conflict');
    }
  }
  const next = { ...current };
  if (icon === undefined) delete next[key];
  else Object.defineProperty(next, key, { value: icon, enumerable: true, writable: true, configurable: true });
  return next;
}

