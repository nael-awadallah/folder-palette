// Explicit development-only network action. Ordinary generate/check/build/runtime never fetch sources.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const commit = '866d4f48701ba71e39d309e9e519bcf2eaf1c3e2';
const repository = 'vscode-icons/vscode-icons';
const directory = new URL('../../catalog/vscode-icons/source/', import.meta.url);
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'FolderPalette-catalog-maintenance' } });
  if (!response.ok) throw new Error(`Source request failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const tree = JSON.parse((await download(`https://api.github.com/repos/${repository}/git/trees/${commit}?recursive=1`)).toString());
if (tree.truncated) throw new Error('Refusing truncated upstream asset index');
await mkdir(directory, { recursive: true });
for (const [upstream, local] of [['src/iconsManifest/supportedFolders.ts', 'supportedFolders.ts'], ['LICENSE', 'LICENSE.upstream']]) {
  const entry = tree.tree.find(item => item.path === upstream && item.type === 'blob');
  if (!entry) throw new Error('Pinned source missing from tree');
  const bytes = await download(`https://raw.githubusercontent.com/${repository}/${commit}/${upstream}`);
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (blob !== entry.sha) throw new Error('Pinned source Git blob integrity mismatch');
  await writeFile(new URL(local, directory), bytes);
}
const files = tree.tree.filter(item => item.type === 'blob' && /^icons\/folder_type_.*\.svg$/.test(item.path))
  .map(item => ({ path: item.path, gitBlobSha: item.sha, size: item.size })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
await writeFile(new URL('asset-index.json', directory), JSON.stringify({ repository, commit, files }, null, 2) + '\n');
console.log(`Pinned vscode-icons sources and ${files.length} asset records saved to ${fileURLToPath(directory)}.`);
