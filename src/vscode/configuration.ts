import * as vscode from 'vscode';
import type { MutationPlan } from '../configuration/adapter';
import type { MutationHost } from '../configuration/writeCoordinator';
import type { ProviderSession, ProviderSessionTracker } from '../providers/session';
import { createVSCodeProviderHost } from './host';
import { sameLocalUri } from './target';

/** One reviewed workflow owns this bridge and its captured provider session/target. */
export function createVSCodeMutationHost(tracker: ProviderSessionTracker, session: ProviderSession, target?: vscode.Uri): MutationHost {
  const providerHost = createVSCodeProviderHost();
  const permitted = (plan: MutationPlan): boolean => {
    tracker.update(providerHost.readSnapshot());
    const detection = tracker.detection;
    const mode = plan.intent.root ? 'root-name' : plan.intent.key.includes('/') ? 'parent-name' : 'folder-name';
    const capabilities = detection.definition?.capabilities;
    return vscode.workspace.isTrusted && !vscode.env?.remoteName && tracker.isCurrent(session) && plan.providerId === session.providerId && detection.writesEnabled
      && !!capabilities?.storage[plan.intent.scope].enabled && !!capabilities.matching[mode].enabled
      && !!capabilities.apply.enabled && capabilities.apply.evidence === 'runtime-verified'
      && capabilities.storage[plan.intent.scope].evidence === 'runtime-verified' && capabilities.matching[mode].evidence === 'runtime-verified';
  };
  return {
    async read(setting) {
      const inspected = vscode.workspace.getConfiguration().inspect<unknown>(setting);
      return { user: inspected?.globalValue, workspace: inspected?.workspaceValue };
    },
    async update(setting, scope, value) {
      await vscode.workspace.getConfiguration().update(setting, value,
        scope === 'user' ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace);
    },
    async validate(plan) {
      // Management operates on a reviewed stored rule; its original directory may be gone.
      if (!target) return permitted(plan);
      if (target.scheme !== 'file' || target.authority || target.query || target.fragment || !permitted(plan)) return false;
      try {
        const stat = await vscode.workspace.fs.stat(target);
        const root = vscode.workspace.workspaceFolders?.some(folder => sameLocalUri(folder.uri, target)) ?? false;
        return (stat.type & vscode.FileType.Directory) !== 0 && root === !!plan.intent.root && permitted(plan);
      } catch { return false; }
    },
    permitted,
    commands: () => Promise.resolve(vscode.commands.getCommands(true)),
    execute: command => Promise.resolve(vscode.commands.executeCommand(command)),
  };
}




