import type { DetectionResult, MatchMode, StorageScope } from './types';

export function availableMatchingModes(result: DetectionResult): MatchMode[] {
  if (result.status !== 'available' || !result.definition) return [];
  return (['folder-name', 'parent-name', 'root-name'] as const).filter(mode => {
    const capability = result.definition!.capabilities.matching[mode];
    return capability.enabled && capability.evidence === 'runtime-verified';
  });
}

export function availableStorageScopes(result: DetectionResult): StorageScope[] {
  if (result.status !== 'available' || !result.writesEnabled || !result.definition) return [];
  return (['user', 'workspace', 'workspace-folder'] as const).filter(scope => {
    const capability = result.definition!.capabilities.storage[scope];
    return capability.enabled && capability.evidence === 'runtime-verified';
  });
}
