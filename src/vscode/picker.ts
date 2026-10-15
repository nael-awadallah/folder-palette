import * as vscode from 'vscode';
import type { Step } from '../ui/workflow';
interface Item extends vscode.QuickPickItem { readonly value?: string }

/** Native controls inherit high contrast, keyboard navigation and screen-reader support. */
export function pickStep(step: Step, watch?: (hide: () => void) => { dispose(): void }): Promise<string | undefined> {
  return new Promise(resolve => {
    const picker = vscode.window.createQuickPick<Item>();
    const subscriptions: { dispose(): void }[] = [];
    let finished = false;
    const finish = (value?: string): void => {
      if (finished) return;
      finished = true;
      for (const subscription of subscriptions) subscription.dispose();
      picker.dispose(); resolve(value);
    };
    picker.title = step.title;
    picker.placeholder = step.placeholder;
    picker.matchOnDescription = true;
    picker.matchOnDetail = true;
    picker.canSelectMany = false;
    const information: Item[] = step.detail?.split('\n').map(line => { const separator = line.indexOf(':'); return separator > 0 ? { label: line.slice(0, separator + 1), detail: line.slice(separator + 1).trim() } : { label: 'Matching / apply', detail: line }; }) ?? [];
    picker.items = [...information, ...step.items.map(item => ({ ...item }))];
    const active = picker.items.find(item => item.picked) ?? picker.items.find(item => item.value !== undefined);
    if (active) picker.activeItems = [active];
    picker.buttons = step.back ? [vscode.QuickInputButtons.Back] : [];
    subscriptions.push(
      picker.onDidAccept(() => { const value = picker.selectedItems[0]?.value; if (value !== undefined) finish(value); }),
      picker.onDidHide(() => finish()),
      picker.onDidTriggerButton(button => { if (button === vscode.QuickInputButtons.Back) finish('back'); }),
    );
    if (watch) subscriptions.push(watch(() => picker.hide()));
    picker.show();
  });
}

