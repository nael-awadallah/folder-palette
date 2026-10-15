import { it, expect } from 'vitest';
import { NativeAdapter } from '../../../src/configuration/adapter';

it('includes broader fallback rules in a parent-qualified review fingerprint', () => {
  const adapter = new NativeAdapter('material');
  const plan = adapter.plan({ user: { src: 'video' } }, { scope: 'workspace', key: 'backend/src', icon: 'images' });
  expect(() => adapter.reconcile(plan, { user: { src: 'images' } })).toThrow('stale');
});
it('preserves exact case of an existing native key in review preparation', () => {
  const adapter = new NativeAdapter('material');
  const state = adapter.describeChange({ workspace: { SRC: 'video' } }, { scope: 'workspace', key: 'src' });
  expect(state.key).toBe('SRC'); expect(state.currentIcon).toBe('video');
});
it('describes a masked workspace edit and both provider layers', () => {
  const adapter = new NativeAdapter('material');
  const state = adapter.describeChange({ user: { src: 'video' }, workspace: { src: 'images' } }, { scope: 'workspace', key: 'src' });
  expect(state.explanations.join(' ')).toContain('User-over-Workspace');
  expect(state.explanations.join(' ')).toContain('src → "video"');
  expect(state.explanations.join(' ')).toContain('src → "images"');
});
