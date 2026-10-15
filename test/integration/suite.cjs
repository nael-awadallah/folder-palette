const assert = require('node:assert/strict');
const { readFile, writeFile, readdir } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { join, resolve, sep } = require('node:path');
const vscode = require('vscode');

exports.run = async function () {
  const config = JSON.parse(await readFile(process.env.FOLDER_PALETTE_TEST_CASE, 'utf8'));
  const checks = [];
  const record = (name, detail) => checks.push({ name, status: 'passed', detail });
  const settingsPath = join(config.userData, 'User', 'settings.json');
  const before = await readFile(settingsPath, 'utf8');
  try {
    const product = vscode.extensions.getExtension('nael-awadallah.folder-palette');
    assert.ok(product, 'Installed artifact is discoverable');
    assert.ok(resolve(product.extensionPath).startsWith(resolve(config.extensions) + sep));
    assert.notEqual(resolve(product.extensionPath), resolve(__dirname, '../..'), 'Product must be installed, not the source development extension');
    assert.equal(product.packageJSON.version, config.version);
    const hash = createHash('sha256').update(await readFile(join(product.extensionPath, 'dist', 'extension.cjs'))).digest('hex');
    assert.equal(hash, config.bundleSha256);
    record('installed-artifact', 'Exact inspected bundle found in isolated extensions directory; only the separate harness is loaded through extensionDevelopmentPath.');
    await product.activate();
    assert.equal(product.isActive, true);
    record('activation', 'Installed product activated in real VS Code Extension Host.');
    const commands = await vscode.commands.getCommands(true);
    for (const id of ['changeFolderIcon', 'resetFolderIcon', 'manageAssociations']) assert.ok(commands.includes(`folderPalette.${id}`));
    record('commands', 'All three public product commands registered.');
    for (const [id, version] of Object.entries(config.providers)) {
      assert.equal(vscode.extensions.getExtension(id)?.packageJSON.version, version);
    }
    for (const id of ['PKief.material-icon-theme', 'vscode-icons-team.vscode-icons']) {
      if (!Object.keys(config.providers).some(key => key.toLowerCase() === id.toLowerCase())) assert.equal(vscode.extensions.getExtension(id), undefined);
    }
    record('provider-inventory', JSON.stringify(config.providers));
    for (const [provider, count] of [['material', 267], ['vscode-icons', 199]]) {
      const data = JSON.parse(await readFile(join(product.extensionPath, 'catalog', provider, 'icons.json'), 'utf8'));
      assert.equal(data.entries.length, count);
    }
    record('offline-catalogs', 'Both installed catalog files have expected provider-specific counts. No network is used by these checks.');
    // Change hits prerequisites; Reset/Manage may inspect seeded native rules
    // read-only. Native Escape closes the picker without monkeypatching APIs.
    for (const id of ['changeFolderIcon', 'resetFolderIcon', 'manageAssociations']) {
      const command = vscode.commands.executeCommand(`folderPalette.${id}`, vscode.Uri.file(join(config.workspace, 'src')));
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(done => setTimeout(done, 300));
        await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
      }
      await Promise.race([command, new Promise((_, reject) => setTimeout(() => reject(new Error(`${id} did not finish after native Escape`)), 5000))]);
    }
    assert.equal(await readFile(settingsPath, 'utf8'), before);
    record('prerequisite-cancel-no-write', 'Change prerequisites and Reset/Manage native rule inspection returned after native Quick Pick dismissal; isolated User settings bytes unchanged.');
    const findOutput = async directory => {
      let text = '';
      for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) text += await findOutput(path);
        else if (entry.name.includes('FolderPalette')) text += await readFile(path, 'utf8');
      }
      return text;
    };
    let output = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      output = await findOutput(join(config.userData, 'logs'));
      if (output.includes(config.expectedDiagnostic)) break;
      await new Promise(done => setTimeout(done, 100));
    }
    assert.ok(output.includes(config.expectedDiagnostic), `Expected provider diagnostic: ${config.expectedDiagnostic}; got ${output}`);
    record('active-theme-routing', output.trim());
    if (config.name.startsWith('both-')) {
      const configuration = vscode.workspace.getConfiguration();
      const nativeBefore = JSON.stringify(['material-icon-theme.folders.associations', 'vsicons.associations.folders'].map(key => configuration.inspect(key)));
      const theme = config.theme === 'material-icon-theme' ? 'vscode-icons' : 'material-icon-theme';
      const pending = vscode.commands.executeCommand('folderPalette.changeFolderIcon', vscode.Uri.file(join(config.workspace, 'src')));
      await new Promise(done => setTimeout(done, 300));
      await configuration.update('workbench.iconTheme', theme, vscode.ConfigurationTarget.Global);
      await Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error('Theme switch failed to invalidate the open prerequisite picker')), 5000))]);
      assert.equal(JSON.stringify(['material-icon-theme.folders.associations', 'vsicons.associations.folders'].map(key => configuration.inspect(key))), nativeBefore);
      const expected = theme === 'material-icon-theme' ? 'material 5.39.0: available. 267 offline catalog choices.' : 'vscode-icons 13.0.0: available. 199 offline catalog choices.';
      for (let attempt = 0; attempt < 30; attempt++) {
        output = await findOutput(join(config.userData, 'logs'));
        if (output.includes(expected)) break;
        await new Promise(done => setTimeout(done, 100));
      }
      assert.ok(output.includes(expected), 'New active provider must be detected after the switch');
      record('theme-switch-mid-prerequisite', 'Harness changed only the disposable theme via public configuration API; picker invalidated, new provider/catalog diagnostic appeared, both raw association configurations stayed unchanged. No full review/Apply path was exercised.');
    }
    await writeFile(config.result, JSON.stringify({ name: config.name, status: 'passed', vscode: vscode.version, platform: process.platform, checks }, null, 2) + '\n');
  } catch (error) {
    await writeFile(config.result, JSON.stringify({ name: config.name, status: 'failed', vscode: vscode.version, checks, error: String(error.stack ?? error) }, null, 2) + '\n');
    throw error;
  }
};
