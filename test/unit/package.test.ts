import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { archiveName, inspectMembers, packageFiles, requiredMembers } from '../../scripts/package/inspect.mjs';

async function fixture() {
  const members = new Map<string, Buffer>();
  for (const file of packageFiles) members.set(`extension/${archiveName(file)}`, file === 'dist/extension.cjs' ? Buffer.from('runtime fixture') : await readFile(file));
  for (const name of ['[Content_Types].xml', 'extension.vsixmanifest']) members.set(name, Buffer.from('<xml/>'));
  return members;
}

describe('VSIX release boundary', () => {
  it('accepts the complete explicit runtime/catalog/notices set', async () => {
    expect(inspectMembers(await fixture())).toMatchObject({ files: requiredMembers.length });
  });
  it.each(['extension/.env', 'extension/private/notes.md', 'extension/dist/extension.cjs.map', 'extension/test/probe.cjs',
    'extension/node_modules/secret/index.js', 'extension/catalog/vscode-icons/source/supportedFolders.ts', '../escape'])('rejects unexpected member %s', async name => {
    const members = await fixture(); members.set(name, Buffer.from('unwanted'));
    expect(() => inspectMembers(members)).toThrow(/unexpected|unsafe/i);
  });
  it('rejects missing runtime and attribution', async () => {
    for (const name of ['extension/dist/extension.cjs', 'extension/catalog/material/LICENSE.upstream']) {
      const members = await fixture(); members.delete(name);
      expect(() => inspectMembers(members)).toThrow(/missing/i);
    }
  });
  it('rejects mismatched catalog bytes rather than trusting filenames', async () => {
    const members = await fixture();
    members.set('extension/catalog/material/icons.json', Buffer.from('{"entries":[]}'));
    expect(() => inspectMembers(members)).toThrow(/catalog/i);
  });
  it('rejects provider dependency installation and a replaced owner-supplied namespace', async () => {
    for (const patch of [{ extensionDependencies: ['PKief.material-icon-theme'] }, { publisher: 'some-real-publisher' }]) {
      const members = await fixture();
      members.set('extension/package.json', Buffer.from(JSON.stringify({ ...JSON.parse(members.get('extension/package.json')!.toString()), ...patch })));
      expect(() => inspectMembers(members)).toThrow(/manifest/i);
    }
  });
});
