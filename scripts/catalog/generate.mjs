import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { generateManifest, availableIconPacks } from 'material-icon-theme';
import { buildMaterialCatalog, buildVscodeIconsCatalog } from './extract.mjs';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('material-icon-theme/package.json'));
const materialPackage = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
if (materialPackage.version !== '5.39.0') throw new Error('Material generator package version drift');
const lock = JSON.parse(await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'));
const integrity = 'sha512-6dUQXJgNBlklaILIOlCZXhSBTsBmLkt11XMoTY7Uyb4ZikelGgZHOY4AdOWBA+SXz51cVWfOVnTHrTwGM91eYw==';
if (lock.packages['node_modules/material-icon-theme']?.integrity !== integrity) throw new Error('Material package integrity drift');
const vscodeDirectory = new URL('../../catalog/vscode-icons/source/', import.meta.url);
const source = await readFile(new URL('supportedFolders.ts', vscodeDirectory), 'utf8');
const indexText = await readFile(new URL('asset-index.json', vscodeDirectory), 'utf8');
const index = JSON.parse(indexText);
if (index.commit !== '866d4f48701ba71e39d309e9e519bcf2eaf1c3e2' || index.repository !== 'vscode-icons/vscode-icons') throw new Error('vscode-icons source version drift');
const material = buildMaterialCatalog(availableIconPacks.map(activeIconPack => generateManifest({ activeIconPack })), await readdir(join(packageRoot, 'icons')));
const icons = buildVscodeIconsCatalog(source, index.files.map(file => basename(file.path)));
if (!material.entries.length || !icons.entries.length) throw new Error('Refusing empty catalog');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const materialLicense = await readFile(join(packageRoot, 'LICENSE'), 'utf8');
const iconsLicense = await readFile(new URL('LICENSE.upstream', vscodeDirectory), 'utf8');
const outputs = [
  ['material/icons.json', JSON.stringify(material, null, 2) + '\n'],
  ['material/LICENSE.upstream', materialLicense],
  ['material/provenance.json', JSON.stringify({ schemaVersion: 1, providerId: 'material', providerVersion: '5.39.0', repository: 'https://github.com/material-extensions/vscode-material-icon-theme', commit: '92a9c5b25a5f4ae4c6a475fb99e434caffef5871', source: 'material-icon-theme@5.39.0 documented generateManifest', packageIntegrity: integrity, generatorVersion: 1, license: 'MIT', assetsRedistributed: false, exclusions: 'Built-in clones, custom clones/paths, file icons, default-only and variant definitions are not selectable.', catalogSha256: sha256(JSON.stringify(material, null, 2) + '\n') }, null, 2) + '\n'],
  ['vscode-icons/icons.json', JSON.stringify(icons, null, 2) + '\n'],
  ['vscode-icons/LICENSE.upstream', iconsLicense],
  ['vscode-icons/provenance.json', JSON.stringify({ schemaVersion: 1, providerId: 'vscode-icons', providerVersion: '13.0.0', repository: 'https://github.com/vscode-icons/vscode-icons', commit: index.commit, source: 'src/iconsManifest/supportedFolders.ts', sourceSha256: sha256(source), assetIndexSha256: sha256(indexText), generatorVersion: 1, license: 'MIT', assetsRedistributed: false, catalogSha256: sha256(JSON.stringify(icons, null, 2) + '\n') }, null, 2) + '\n'],
];
const providerArgument = process.argv.find(argument => argument.startsWith('--provider='));
const provider = providerArgument?.slice('--provider='.length);
if (provider && !['material', 'vscode-icons'].includes(provider)) throw new Error('Unknown catalog provider');
for (const [relative, contents] of outputs) {
  if (provider && !relative.startsWith(`${provider}/`)) continue;
  const url = new URL(`../../catalog/${relative}`, import.meta.url);
  if (process.argv.includes('--check')) {
    if (await readFile(url, 'utf8') !== contents) throw new Error(`Catalog drift: ${relative}; run npm run catalog:generate`);
  } else {
    await mkdir(new URL('./', url), { recursive: true });
    await writeFile(url, contents);
  }
}
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Generated'} ${provider === 'material' ? `${material.entries.length} Material` : provider === 'vscode-icons' ? `${icons.entries.length} vscode-icons` : `${material.entries.length} Material and ${icons.entries.length} vscode-icons`} choices offline.`);
