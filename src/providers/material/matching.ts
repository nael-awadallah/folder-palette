import { normalizeMatchKey } from '../matching';
import type { MatchDescription, MatchMode } from '../types';

export function describeMaterialMatch(mode: MatchMode, raw: string): MatchDescription {
  const key = normalizeMatchKey(mode, raw);
  if (key === undefined) return { valid: false, matches: [], evidence: 'unsupported', reason: 'Use a literal name or exactly one direct-parent/name pair; paths and globs are unsupported.' };
  return { valid: true, key, matches: [key, `.${key}`, `_${key}`, `-${key}`, `__${key}__`], evidence: 'runtime-verified',
    reason: mode === 'root-name' ? 'Matches root basenames and provider variants, not workspace display aliases.' : 'Matches these names or direct-parent/name pairs wherever they occur.' };
}
