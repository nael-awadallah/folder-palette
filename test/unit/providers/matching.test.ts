import { describe, expect, it } from 'vitest';
import { describeMaterialMatch } from '../../../src/providers/material/matching';
import { describeVscodeIconsMatch } from '../../../src/providers/vscode-icons/matching';

describe('provider-specific matching', () => {
  it('normalizes a new Material key and explains all generated name aliases', () => {
    expect(describeMaterialMatch('folder-name', 'SRC')).toMatchObject({
      valid: true, key: 'src', matches: ['src', '.src', '_src', '-src', '__src__'], evidence: 'runtime-verified',
    });
  });

  it('models Material qualification as whole-key expansion, not child alias expansion', () => {
    expect(describeMaterialMatch('parent-name', 'Backend/SRC')).toMatchObject({
      valid: true, key: 'backend/src', matches: ['backend/src', '.backend/src', '_backend/src', '-backend/src', '__backend/src__'],
    });
  });

  it('does not give vscode-icons Material aliases or certify its renderer', () => {
    expect(describeVscodeIconsMatch('folder-name', 'SRC')).toMatchObject({
      valid: true, key: 'src', matches: ['src'], evidence: 'source-inspected',
    });
    expect(describeVscodeIconsMatch('parent-name', 'Backend/SRC')).toMatchObject({ valid: true, key: 'backend/src', matches: ['backend/src'], evidence: 'source-inspected' });
  });

  it('accepts named roots only for Material', () => {
    expect(describeMaterialMatch('root-name', 'Backend')).toMatchObject({ valid: true, key: 'backend' });
    expect(describeVscodeIconsMatch('root-name', 'Backend')).toMatchObject({ valid: false });
  });

  it.each(['', 'a/b/c', '/src', 'C:/src', 'a\\src', '*.src', 'src?', '.', '..', 'src\nother', 'src\u0000'])('rejects unsupported folder key %j', key => {
    expect(describeMaterialMatch('folder-name', key)).toMatchObject({ valid: false });
    expect(describeVscodeIconsMatch('folder-name', key)).toMatchObject({ valid: false });
  });

  it.each(['.src', '_src', 'my folder', 'مصادر', 'src[old]', 'src#1'])('retains literal names %s without inventing globs', key => {
    expect(describeVscodeIconsMatch('folder-name', key)).toMatchObject({ valid: true, key });
  });

  it.each(['a//src', './src', '../src', '/src', 'a/src/', 'a/b/src'])('rejects invalid direct-parent key %s', key => {
    expect(describeMaterialMatch('parent-name', key)).toMatchObject({ valid: false });
    expect(describeVscodeIconsMatch('parent-name', key)).toMatchObject({ valid: false });
  });
});
