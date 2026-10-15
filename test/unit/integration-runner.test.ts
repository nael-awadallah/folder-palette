import { expect, it } from 'vitest';
import { resolveWindowsCliScript } from '../../scripts/integration/local-cli.mjs';

it('resolves the installed Windows launcher including versioned VS Code layouts', () => {
  expect(resolveWindowsCliScript('C:/Code/bin/code.cmd', '"%~dp0..\\Code.exe" "%~dp0..\\6d62\\resources\\app\\out\\cli.js" %*'))
    .toBe('C:\\Code\\6d62\\resources\\app\\out\\cli.js');
  expect(resolveWindowsCliScript('C:/Code/bin/code.cmd', '"%~dp0..\\Code.exe" "%~dp0..\\resources\\app\\out\\cli.js" %*'))
    .toBe('C:\\Code\\resources\\app\\out\\cli.js');
  expect(() => resolveWindowsCliScript('C:/Code/bin/code.cmd', 'echo changed launcher')).toThrow(/launcher/i);
});
