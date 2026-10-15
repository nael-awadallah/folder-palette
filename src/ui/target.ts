import type { FolderTarget, TargetHost } from './workflow';

/** Explicit candidates only: no directory enumeration or workspace traversal. */
export async function selectTarget(host: TargetHost, candidates: readonly string[], forcePicker = false): Promise<FolderTarget | undefined> {
  const unique = [...new Set(candidates)];
  let uri: string | undefined;
  if (unique.length === 1 && !forcePicker) uri = unique[0];
  else {
    const choices = unique.length ? unique : [...host.roots()];
    const value = await host.pick({ id: 'target', title: 'FolderPalette: Choose one folder', placeholder: 'Choose one folder; matching can affect other folders with the same name.',
      items: [...choices.map((item, index) => ({ value: String(index), label: item, description: 'Select this folder' })),
        { value: 'browse', label: 'Browse for Folder…' }] });
    if (value === undefined) return undefined;
    uri = value === 'browse' ? await host.browse() : choices[Number(value)];
  }
  if (!uri) return undefined;
  const target = await host.inspectTarget(uri);
  if (!target) await host.notify('Choose an existing local directory. Remote, virtual, and file targets are unavailable.');
  return target;
}
