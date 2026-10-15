import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import yauzl from 'yauzl';

export const packageFiles = Object.freeze([
  'package.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'NOTICES.md',
  'dist/extension.cjs', 'catalog/NOTICE.md',
  'catalog/material/icons.json', 'catalog/material/provenance.json', 'catalog/material/LICENSE.upstream',
  'catalog/vscode-icons/icons.json', 'catalog/vscode-icons/provenance.json', 'catalog/vscode-icons/LICENSE.upstream',
  'documentation/compatibility.md', 'documentation/catalog-maintenance.md',
]);
// vsce deliberately normalizes these three well-known documentation assets.
export const archiveName = file => ({ 'README.md': 'readme.md', 'CHANGELOG.md': 'changelog.md', LICENSE: 'LICENSE.txt' })[file] ?? file;
export const requiredMembers = Object.freeze(['[Content_Types].xml', 'extension.vsixmanifest', ...packageFiles.map(file => `extension/${archiveName(file)}`)]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function inspectMembers(members) {
  for (const name of members.keys()) {
    if (name.includes('\\') || name.split('/').some(part => part === '..' || part === '.') || name.startsWith('/')) throw new Error(`Unsafe ZIP member: ${name}`);
    if (!requiredMembers.includes(name)) throw new Error(`Unexpected ZIP member: ${name}`);
  }
  for (const name of requiredMembers) if (!members.has(name)) throw new Error(`Missing ZIP member: ${name}`);
  const manifest = JSON.parse(members.get('extension/package.json').toString());
  if (manifest.name !== 'folder-palette' || manifest.publisher !== 'nael-awadallah' || manifest.license !== 'MIT'
    || manifest.private !== true || manifest.extensionDependencies || manifest.extensionPack || manifest.dependencies
    || manifest.contributes?.iconThemes || manifest.main !== './dist/extension.cjs') throw new Error('Invalid local-only package manifest');
  const catalogs = {};
  for (const [id, version, count] of [['material', '5.39.0', 267], ['vscode-icons', '13.0.0', 199]]) {
    const bytes = members.get(`extension/catalog/${id}/icons.json`);
    const catalog = JSON.parse(bytes.toString());
    const provenance = JSON.parse(members.get(`extension/catalog/${id}/provenance.json`).toString());
    if (catalog.providerId !== id || catalog.providerVersion !== version || catalog.entries.length !== count
      || provenance.catalogSha256 !== sha256(bytes) || provenance.providerVersion !== version || provenance.assetsRedistributed !== false) throw new Error(`Invalid ${id} catalog/provenance`);
    catalogs[id] = { version, choices: count, sha256: sha256(bytes) };
  }
  return { files: members.size, catalogs, members: [...members.keys()].sort() };
}

export function readMembers(path) {
  return new Promise((resolveMembers, reject) => {
    yauzl.open(path, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(error);
      const members = new Map();
      zip.on('error', reject);
      zip.on('entry', entry => {
        if (entry.uncompressedSize > 5_000_000 || members.size >= 100 || members.has(entry.fileName)) { zip.close(); reject(new Error('Unsafe ZIP size or duplicate member')); return; }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) { zip.close(); reject(streamError); return; }
          const chunks = [];
          stream.on('data', chunk => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => { members.set(entry.fileName, Buffer.concat(chunks)); zip.readEntry(); });
        });
      });
      zip.on('end', () => resolveMembers(members));
      zip.readEntry();
    });
  });
}

export async function inspectVSIX(path) {
  const archive = await readFile(path);
  return { path: resolve(path), bytes: archive.length, sha256: sha256(archive), ...inspectMembers(await readMembers(path)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/package/inspect.mjs path.vsix');
  const report = await inspectVSIX(process.argv[2]);
  await writeFile(`${process.argv[2]}.inspection.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
