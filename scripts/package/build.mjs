import { createVSIX } from '@vscode/vsce';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectVSIX } from './inspect.mjs';

const manifest = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('artifacts', { recursive: true });
const path = `artifacts/folder-palette-${manifest.version}.vsix`;
await createVSIX({ packagePath: path, dependencies: false, skipLicense: false, allowMissingRepository: true });
const report = await inspectVSIX(path);
await writeFile(`${path}.inspection.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
