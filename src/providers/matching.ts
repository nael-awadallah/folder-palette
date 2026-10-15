import type { MatchMode } from './types';

/** Grammar only. Provider capabilities separately decide whether this mode may be offered. */
export function normalizeMatchKey(mode: MatchMode, raw: string): string | undefined {
  const parts = raw.split('/');
  const length = mode === 'parent-name' ? 2 : 1;
  if (parts.length !== length || parts.some(part => !part || part === '.' || part === '..' || /[\\:*?\u0000-\u001f\u007f]/u.test(part))) return undefined;
  return raw.toLowerCase();
}
