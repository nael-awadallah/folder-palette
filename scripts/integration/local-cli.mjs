import { win32 } from 'node:path';

export function resolveWindowsCliScript(launcherPath, contents) {
  const relative = contents.match(/"%~dp0([^"%]+cli\.js)"/i)?.[1];
  if (!relative) throw new Error('Unrecognized installed VS Code Windows launcher; refusing a guessed CLI or automatic download');
  return win32.resolve(win32.dirname(launcherPath), relative);
}
