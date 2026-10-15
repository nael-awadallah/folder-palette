import type { Capability, EvidenceStatus } from './types';

export function capability(evidence: EvidenceStatus, reason: string, enabled = false): Capability {
  return Object.freeze({ enabled, evidence, reason });
}
