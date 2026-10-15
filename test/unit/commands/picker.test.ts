import { it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ picks: [] as FakePicker[] }));
type Callback = () => void;
class FakePicker {
  title = ''; placeholder = ''; matchOnDescription = false; matchOnDetail = false;
  items: { label: string; value?: string }[] = []; selectedItems: { label: string; value?: string }[] = [];
  activeItems: { label: string; value?: string }[] = []; buttons: unknown[] = []; canSelectMany = false;
  accept?: Callback; hidden?: Callback; button?: (button: unknown) => void; disposed = false;
  show() {} hide() { this.hidden?.(); } dispose() { this.disposed = true; }
  onDidAccept(cb: Callback) { this.accept = cb; return { dispose() {} }; }
  onDidHide(cb: Callback) { this.hidden = cb; return { dispose() {} }; }
  onDidTriggerButton(cb: (button: unknown) => void) { this.button = cb; return { dispose() {} }; }
}
vi.mock('vscode', () => ({ window: { createQuickPick: () => { const picker = new FakePicker(); state.picks.push(picker); return picker; } }, QuickInputButtons: { Back: 'back-button' } }));
import { pickStep } from '../../../src/vscode/picker';

it('enables readable text search and resolves Escape while disposing the picker', async () => {
  const promise = pickStep({ id: 'icon', title: 'Provider icons', placeholder: 'Search', items: [{ value: 'images', label: 'Images', description: 'images', detail: 'photo media' }] });
  const picker = state.picks.at(-1)!;
  expect(picker.matchOnDescription && picker.matchOnDetail).toBe(true);
  picker.hide(); expect(await promise).toBeUndefined(); expect(picker.disposed).toBe(true);
});
it('returns Back, displays every review line, and never accepts informational rows as Apply', async () => {
  const promise = pickStep({ id: 'review', title: 'Review', placeholder: 'Apply', detail: 'Provider: Material\nStorage: User', back: true, items: [{ value: 'apply', label: 'Apply' }] });
  const picker = state.picks.at(-1)!;
  expect(picker.items.some(item => item.label.includes('Provider'))).toBe(true);
  picker.selectedItems = [picker.items.find(item => !item.value)!]; picker.accept?.();
  expect(picker.disposed).toBe(false);
  picker.button?.('back-button'); expect(await promise).toBe('back'); expect(picker.disposed).toBe(true);
});
it('returns an explicit accepted action and disposes invalidation watchers', async () => {
  const dispose = vi.fn();
  const promise = pickStep({ id: 'review', title: 'Review', placeholder: 'Apply', items: [{ value: 'apply', label: 'Apply' }] }, () => ({ dispose }));
  const picker = state.picks.at(-1)!; picker.selectedItems = [picker.items[0]!]; picker.accept?.();
  expect(await promise).toBe('apply'); expect(dispose).toHaveBeenCalledOnce();
});
