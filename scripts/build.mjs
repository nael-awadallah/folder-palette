import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';

const result = await build({ entryPoints: ['src/extension.ts'], bundle: true, platform: 'node', target: 'node22', format: 'cjs', outfile: 'dist/extension.cjs', external: ['vscode'], sourcemap: true, metafile: true, logLevel: 'info' });
for (const output of Object.values(result.metafile.outputs)) {
  if (output.imports.some(item => item.external && item.path !== 'vscode')) throw new Error('Unexpected runtime dependency in extension bundle');
}
if (Object.keys(result.metafile.inputs).some(input => input.startsWith('node_modules/'))) throw new Error('Development dependencies must not enter the runtime bundle');
await mkdir('dist', { recursive: true });
await writeFile('dist/meta.json', JSON.stringify(result.metafile, null, 2) + '\n');
