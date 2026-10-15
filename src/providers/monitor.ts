import { ProviderSessionTracker } from './session';
import type { DetectionResult, HostSnapshot } from './types';

export interface ProviderHost {
  readSnapshot(): HostSnapshot;
  onDidChange(callback: () => void): { dispose(): void };
}

export function observeProviderHost(host: ProviderHost, listener: (result: DetectionResult) => void) {
  const tracker = new ProviderSessionTracker(host.readSnapshot());
  let disposed = false;
  const subscription = host.onDidChange(() => {
    if (disposed) return;
    const before = JSON.stringify(tracker.detection);
    const next = tracker.update(host.readSnapshot());
    if (JSON.stringify(next) !== before) listener(next);
  });
  listener(tracker.detection);
  return { tracker, dispose() { disposed = true; subscription.dispose(); } };
}
