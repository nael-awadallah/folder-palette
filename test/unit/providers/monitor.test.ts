import { describe, expect, it } from 'vitest';
import { observeProviderHost } from '../../../src/providers/monitor';
import { chooseIcon, resolveChoice } from '../../../src/catalog/selection';
import type { HostSnapshot } from '../../../src/providers/types';

function hostFixture() {
  let state: HostSnapshot = { activeThemeId: 'material-icon-theme', extensions: [
    { id: 'PKief.material-icon-theme', version: '5.39.0' }, { id: 'vscode-icons-team.vscode-icons', version: '13.0.0' },
  ] };
  const subscribers = new Set<() => void>();
  return {
    readSnapshot: () => state,
    onDidChange: (callback: () => void) => { subscribers.add(callback); return { dispose: () => { subscribers.delete(callback); } }; },
    change: (next: HostSnapshot) => { state = next; for (const callback of subscribers) callback(); },
    current: () => state,
  };
}

describe('provider host monitoring', () => {
  it('publishes initial provider state, invalidates a choice before notifying a theme change, and disposes listeners', () => {
    const host = hostFixture();
    const received: string[] = [];
    const monitor = observeProviderHost(host, result => { received.push(result.providerId ?? result.status); });
    const choice = chooseIcon(monitor.tracker, 'src');
    expect(received).toEqual(['material']);
    host.change({ ...host.current(), activeThemeId: 'vscode-icons' });
    expect(received).toEqual(['material', 'vscode-icons']);
    expect(resolveChoice(monitor.tracker, choice)).toBeUndefined();
    monitor.dispose();
    host.change({ ...host.current(), activeThemeId: 'vs-seti' });
    expect(received).toEqual(['material', 'vscode-icons']);
  });

  it('does not spam state changes for irrelevant configuration/extension events', () => {
    const host = hostFixture();
    const received: string[] = [];
    const monitor = observeProviderHost(host, result => { received.push(result.status); });
    host.change({ ...host.current(), settings: { unrelated: true } });
    host.change({ ...host.current(), extensions: [{ id: 'PKief.material-icon-theme', version: '5.39.0' }] });
    expect(received).toEqual(['available']);
    monitor.dispose();
  });
});
