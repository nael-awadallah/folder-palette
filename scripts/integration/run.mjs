import { runTests } from '@vscode/test-electron';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectVSIX, readMembers } from '../package/inspect.mjs';
import { resolveWindowsCliScript } from './local-cli.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (process.argv[2] === '--worker') {
  const config = JSON.parse(await readFile(process.argv[3], 'utf8'));
  await runTests({ vscodeExecutablePath: config.code, extensionDevelopmentPath: join(root, 'test/integration/harness'),
    extensionTestsPath: join(root, 'test/integration/suite.cjs'), extensionTestsEnv: { FOLDER_PALETTE_TEST_CASE: process.argv[3] },
    launchArgs: [config.workspace, '--user-data-dir', config.userData, '--extensions-dir', config.extensions,
      '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust', '--disable-updates', '--disable-telemetry', '--new-window'] });
} else {
  if (!process.env.FOLDER_PALETTE_CODE_EXECUTABLE) throw new Error('Set FOLDER_PALETTE_CODE_EXECUTABLE to an existing desktop Code executable. No VS Code download is automatic.');
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const artifact = resolve(process.argv[2] ?? join(root, `artifacts/folder-palette-${manifest.version}-local-test.vsix`));
  const inspected = await inspectVSIX(artifact);
  const runRoot = await mkdtemp(join(tmpdir(), 'folder-palette-m6-'));
  const code = resolve(process.env.FOLDER_PALETTE_CODE_EXECUTABLE);
  if (process.platform !== 'win32') throw new Error('This installed-host runner is qualified only on Windows; other platforms remain unverified.');
  const launcher = join(dirname(code), 'bin/code.cmd');
  const cli = resolveWindowsCliScript(launcher, await readFile(launcher, 'utf8'));
  const bundleSha256 = createHash('sha256').update((await readMembers(artifact)).get('extension/dist/extension.cjs')).digest('hex');
  const cases = [
    { name: 'no-provider', providers: {}, theme: null, expectedDiagnostic: 'unsupported : unsupported.' },
    { name: 'unsupported-theme', providers: {}, theme: 'vs-seti', expectedDiagnostic: 'unsupported : unsupported.' },
    { name: 'missing-provider', providers: {}, theme: 'material-icon-theme', expectedDiagnostic: 'material : unavailable.' },
  ];
  const materialPath = process.env.FOLDER_PALETTE_MATERIAL_DIRECTORY;
  const iconsPath = process.env.FOLDER_PALETTE_VSCODE_ICONS_DIRECTORY;
  const valid = async (path, id, version) => {
    if (!path) return false;
    const metadata = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'));
    if (`${metadata.publisher}.${metadata.name}`.toLowerCase() !== id.toLowerCase() || metadata.version !== version) throw new Error(`Expected ${id}@${version}; refusing substituted provider`);
    return true;
  };
  const material = await valid(materialPath, 'PKief.material-icon-theme', '5.39.0');
  const icons = await valid(iconsPath, 'vscode-icons-team.vscode-icons', '13.0.0');
  if (material) cases.push({ name: 'material-only', providers: { 'PKief.material-icon-theme': '5.39.0' }, theme: 'material-icon-theme', expectedDiagnostic: 'material 5.39.0: available. 267 offline catalog choices.' });
  if (icons) cases.push({ name: 'vscode-icons-only', providers: { 'vscode-icons-team.vscode-icons': '13.0.0' }, theme: 'vscode-icons', expectedDiagnostic: 'vscode-icons 13.0.0: available. 199 offline catalog choices.' });
  if (material) cases.push({ name: 'material-suppressed', providers: { 'PKief.material-icon-theme': '5.39.0' }, theme: 'material-icon-theme', settings: { 'material-icon-theme.folders.theme': 'none' }, expectedDiagnostic: 'material 5.39.0: suppressed. 0 offline catalog choices.' });
  if (icons) cases.push({ name: 'vscode-icons-suppressed', providers: { 'vscode-icons-team.vscode-icons': '13.0.0' }, theme: 'vscode-icons', settings: { 'vsicons.presets.hideFolders': true }, expectedDiagnostic: 'vscode-icons 13.0.0: suppressed. 0 offline catalog choices.' });
  if (material && icons) for (const active of ['material', 'vscode-icons']) cases.push({ name: `both-${active}`, providers: { 'PKief.material-icon-theme': '5.39.0', 'vscode-icons-team.vscode-icons': '13.0.0' }, theme: active === 'material' ? 'material-icon-theme' : 'vscode-icons', expectedDiagnostic: `${active} ${active === 'material' ? '5.39.0: available. 267' : '13.0.0: available. 199'} offline catalog choices.` });
  const results = [];
  const selectedCases = process.env.FOLDER_PALETTE_TEST_SCENARIO ? cases.filter(scenario => scenario.name === process.env.FOLDER_PALETTE_TEST_SCENARIO) : cases;
  if (!selectedCases.length) throw new Error('Requested test scenario is unavailable; refusing an empty smoke pass');
  for (const scenario of selectedCases) {
    const directory = join(runRoot, scenario.name);
    const config = { ...scenario, code, version: manifest.version, bundleSha256, userData: join(directory, 'user-data'), extensions: join(directory, 'extensions'), workspace: join(directory, 'workspace'), result: join(directory, 'result.json') };
    for (const path of [join(config.userData, 'User'), config.extensions, join(config.workspace, 'src')]) await mkdir(path, { recursive: true });
    // Only disposable profile settings are initialized; provider preferences are untouched.
    await writeFile(join(config.userData, 'User/settings.json'), JSON.stringify({ 'workbench.iconTheme': scenario.theme, 'extensions.autoUpdate': 'off', 'extensions.autoCheckUpdates': false, 'update.mode': 'none', 'telemetry.telemetryLevel': 'off',
      'material-icon-theme.folders.associations': { src: 'images', untouched: 'book' },
      'vsicons.associations.folders': [{ icon: 'src', extensions: ['src', 'source'], format: 'svg' }],
      ...scenario.settings,
    }, null, 2) + '\n');
    for (const id of Object.keys(scenario.providers)) await cp(id.startsWith('PKief') ? materialPath : iconsPath, join(config.extensions, id.toLowerCase()), { recursive: true });
    try {
      const installed = spawnSync(code, [cli, '--user-data-dir', config.userData, '--extensions-dir', config.extensions, '--install-extension', artifact, '--force'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, encoding: 'utf8', timeout: 60000 });
      await writeFile(join(directory, 'install.log'), `${installed.stdout ?? ''}\n${installed.stderr ?? ''}`);
      if (installed.status !== 0) throw new Error(String(installed.error ?? installed.stderr));
    } catch (error) {
      await writeFile(join(directory, 'install.log'), String(error));
      results.push({ name: scenario.name, status: 'failed', reason: `VSIX installation failed: ${error}` }); continue;
    }
    const configPath = join(directory, 'case.json');
    await writeFile(configPath, JSON.stringify(config, null, 2));
    const result = await new Promise(done => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', configPath], { env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let log = '';
      child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
      const timer = setTimeout(() => {
        if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
        else child.kill('SIGKILL');
      }, 90000);
      child.on('error', error => { log += String(error); });
      child.on('close', async exitCode => {
        clearTimeout(timer);
        await writeFile(join(directory, 'host.log'), log);
        const recorded = await readFile(config.result, 'utf8').then(JSON.parse).catch(() => ({ name: scenario.name, status: 'failed', reason: 'Host did not produce a result; see host.log' }));
        if (exitCode !== 0) recorded.status = 'failed';
        done(recorded);
      });
    });
    results.push(result);
    console.log(`${scenario.name}: ${result.status}`);
  }
  for (const [name, available] of [['material-only', material], ['vscode-icons-only', icons], ['both-installed', material && icons]]) if (!available) results.push({ name, status: 'not-run', reason: 'Exact pinned provider directory not supplied; other versions do not qualify the target release.' });
  const report = { runRoot, artifact: inspected, results, limitations: ['Closed production gates: no settings mutation, provider apply, or Explorer rendering qualification.', 'Harness initialization writes only disposable User settings. Providers may activate automatically because their theme is selected; FolderPalette never calls activate.', 'No keyboard/screen-reader/high-contrast or multi-window acceptance inferred.'] };
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await writeFile(join(root, 'artifacts/integration.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Evidence: ${runRoot}`);
  if (results.some(result => result.status === 'failed')) process.exitCode = 1;
}
