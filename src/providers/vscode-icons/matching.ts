import { normalizeMatchKey } from '../matching';
import type { MatchDescription, MatchMode } from '../types';

export function describeVscodeIconsMatch(mode: MatchMode, raw: string): MatchDescription {
  if (mode === 'root-name') return { valid: false, matches: [], evidence: 'unsupported', reason: 'Named workspace roots are not supported; all-roots defaults are outside this release.' };
  const key = normalizeMatchKey(mode, raw);
  if (key === undefined) return { valid: false, matches: [], evidence: 'unsupported', reason: 'Use a literal name or exactly one direct-parent/name pair; paths and globs are unsupported.' };
  return { valid: true, key, matches: [key], evidence: 'source-inspected', reason: 'The provider maps this descriptor name as supplied. Runtime matching proof is pending.' };
}
