import { describe, it, expect } from 'vitest';
import { materialMutation, materialView } from '../../../src/providers/material/configuration';
import { vscodeIconsMutation, combineVscodeIconsLayers } from '../../../src/providers/vscode-icons/configuration';

describe('Material native mutations', () => {
  it('changes only the exact raw key, retaining unknown values and original case', () => {
    expect(materialMutation({ Src: 'old', other: { custom: true } }, 'Src', 'images')).toEqual({ Src: 'images', other: { custom: true } });
  });
  it('rejects case and generated alias collisions', () => {
    expect(() => materialMutation({ SRC: 'old' }, 'src', 'images')).toThrow();
    expect(() => materialMutation({ '.src': 'old' }, 'src', 'images')).toThrow();
  });
  it('removes exactly one key, keeps empty containers and rejects malformed maps', () => {
    expect(materialMutation({ src: 'old' }, 'src', undefined)).toEqual({});
    expect(() => materialMutation([], 'src', 'images')).toThrow();
  });
  it('models observed User precedence without copying inherited entries', () => {
    expect(materialView({ src: 'user' }, { src: 'workspace', other: 'local' })).toEqual({ src: 'user', other: 'local' });
    expect(materialMutation(undefined, 'other', 'images')).toEqual({ other: 'images' });
  });
});

describe('vscode-icons native mutations', () => {
  it('splits one grouped member, preserving order and unrelated native data', () => {
    const raw = [{ icon: 'old', extensions: ['src', 'lib'], format: 'svg' }, { icon: 'native', extensions: ['x'], future: 7 }];
    expect(vscodeIconsMutation(raw, 0, 'src', { icon: 'images', format: 'svg' })).toEqual([
      { icon: 'old', extensions: ['lib'], format: 'svg' }, { icon: 'images', format: 'svg', extensions: ['src'] }, raw[1],
    ]);
    expect(raw[0]?.extensions).toEqual(['src', 'lib']);
  });
  it('resets a member rather than its entire grouped descriptor', () => {
    expect(vscodeIconsMutation([{ icon: 'old', extensions: ['src', 'lib'] }], 0, 'src')).toEqual([{ icon: 'old', extensions: ['lib'] }]);
    expect(vscodeIconsMutation([{ icon: 'old', extensions: ['src'] }], 0, 'src')).toEqual([]);
  });
  it('rejects duplicate matches, unsafe modifiers, unknown fields and malformed data', () => {
    for (const raw of [null, {}, [{ icon: 'x', extensions: ['src', 'SRC'] }], [{ icon: 'x', extensions: ['src'], disabled: true }], [{ icon: 'x', extensions: ['src'], future: true }]]) {
      expect(() => vscodeIconsMutation(raw, 0, 'src')).toThrow();
    }
  });
  it('preserves workspace-first raw descriptors and does not materialize User values', () => {
    expect(combineVscodeIconsLayers([{ icon: 'u', extensions: ['src'] }], [{ icon: 'w', extensions: ['src'] }])).toEqual([{ icon: 'w', extensions: ['src'] }, { icon: 'u', extensions: ['src'] }]);
  });
});

it('keeps a grouped descriptor intact when the selected native icon is unchanged', () => {
  const raw = [{ icon: 'images', format: 'svg', light: true, extensions: ['src', 'lib'] }];
  expect(vscodeIconsMutation(raw, 0, 'src', { icon: 'images', format: 'svg', light: true })).toEqual(raw);
});
