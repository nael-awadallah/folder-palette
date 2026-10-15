import * as vscode from 'vscode';
import type { FolderTarget } from '../ui/workflow';

export function sameLocalUri(a: vscode.Uri, b: vscode.Uri): boolean {
  const left = a.toString().replace(/\/+$/u, '');
  const right = b.toString().replace(/\/+$/u, '');
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

/** One URI stat only; workspace root metadata supplies display aliases, never folder scans. */
export async function inspectLocalTarget(value: string): Promise<FolderTarget | undefined> {
  try {
    const uri = vscode.Uri.parse(value);
    if (uri.scheme !== 'file' || uri.authority || uri.query || uri.fragment) return undefined;
    const stat = await vscode.workspace.fs.stat(uri);
    if (!(stat.type & vscode.FileType.Directory)) return undefined;
    const parts = uri.path.split('/').filter(Boolean);
    const root = vscode.workspace.workspaceFolders?.find(folder => sameLocalUri(folder.uri, uri));
    return { uri: uri.toString(), name: parts.at(-1) ?? '', parentName: parts.at(-2) ?? '', displayName: root?.name ?? parts.at(-1) ?? uri.toString(), isRoot: !!root };
  } catch { return undefined; }
}

