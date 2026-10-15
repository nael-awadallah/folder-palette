import { describe, expect, it } from 'vitest';
import { ProviderSessionTracker } from '../../../src/providers/session';

const material = { id: 'PKief.material-icon-theme', version: '5.39.0' };
const icons = { id: 'vscode-icons-team.vscode-icons', version: '13.0.0' };
const snapshot = (activeThemeId: unknown) => ({ activeThemeId, extensions: [material, icons] });

describe('provider session invalidation', () => {
  it('invalidates a captured session on a theme change, including away and back', () => {
    const tracker = new ProviderSessionTracker(snapshot('material-icon-theme'));
    const session = tracker.capture();
    expect(session).toMatchObject({ providerId: 'material', version: '5.39.0' });
    expect(tracker.isCurrent(session)).toBe(true);
    tracker.update(snapshot('vscode-icons'));
    expect(tracker.isCurrent(session)).toBe(false);
    tracker.update(snapshot('material-icon-theme'));
    expect(tracker.isCurrent(session)).toBe(false);
    expect(tracker.isCurrent(tracker.capture())).toBe(true);
  });

  it('invalidates the session if the selected extension disappears, changes version, or suppresses icons', () => {
    const tracker = new ProviderSessionTracker(snapshot('vscode-icons'));
    const session = tracker.capture();
    tracker.update({ activeThemeId: 'vscode-icons', extensions: [] });
    expect(tracker.isCurrent(session)).toBe(false);
    expect(tracker.capture()).toBeUndefined();
    tracker.update(snapshot('vscode-icons'));
    const second = tracker.capture();
    tracker.update({ activeThemeId: 'vscode-icons', extensions: [{ ...icons, version: '13.0.1' }] });
    expect(tracker.isCurrent(second)).toBe(false);
    tracker.update(snapshot('vscode-icons'));
    const third = tracker.capture();
    tracker.update({ ...snapshot('vscode-icons'), settings: { 'vsicons.presets.hideFolders': true } });
    expect(tracker.isCurrent(third)).toBe(false);
  });

  it('retains a session across irrelevant inactive-provider changes and identical refresh events', () => {
    const tracker = new ProviderSessionTracker(snapshot('material-icon-theme'));
    const session = tracker.capture();
    tracker.update({ activeThemeId: 'material-icon-theme', extensions: [material] });
    expect(tracker.isCurrent(session)).toBe(true);
    tracker.update({ activeThemeId: 'material-icon-theme', extensions: [material], settings: { unrelated: 'changed' } });
    expect(tracker.isCurrent(session)).toBe(true);
  });

  it.each([null, 'vs-seti'])('cannot capture a session for unsupported theme %s', theme => {
    const tracker = new ProviderSessionTracker(snapshot(theme));
    expect(tracker.capture()).toBeUndefined();
    expect(tracker.isCurrent(undefined)).toBe(false);
  });
});
