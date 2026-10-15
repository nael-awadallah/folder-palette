import type { NativeAdapter, MutationPlan, NativeLayers } from './adapter';

export interface MutationHost {
  read(setting: string): Promise<NativeLayers>;
  update(setting: string, scope: 'user' | 'workspace', value: unknown): Promise<void>;
  /** Must recheck captured session, version, catalog, local directory and capability snapshot. */
  validate(plan: MutationPlan): Promise<boolean>;
  /** Runtime proof gate, independently enforced by the host; never supplied by UI intent. */
  permitted(plan: MutationPlan): boolean;
  commands(): Promise<readonly string[]>;
  execute(command: string): Promise<unknown>;
}
export interface SaveResult {
  readonly saved: boolean;
  readonly providerId: MutationPlan['providerId'];
  readonly apply: 'not-needed' | 'automatic-handoff' | 'completion-unconfirmed' | 'pending' | 'failed';
}
export class WriteCoordinator {
  static #tail: Promise<unknown> = Promise.resolve();
  #submitted = new WeakSet<MutationPlan>();
  constructor(private readonly host: MutationHost) {}

  commit(adapter: NativeAdapter, plan: MutationPlan): Promise<SaveResult> {
    const operation = WriteCoordinator.#tail.then(async (): Promise<SaveResult> => {
      const result = (saved: boolean, apply: SaveResult['apply']): SaveResult => ({ saved, apply, providerId: plan.providerId });
      if (this.#submitted.has(plan)) return result(false, 'not-needed');
      if (!this.host.permitted(plan) || !await this.host.validate(plan)) throw new Error('Provider, target or runtime capability gate changed');
      const latest = await this.host.read(plan.setting);
      const mutation = adapter.reconcile(plan, latest);
      if (!mutation.changed) return result(false, 'not-needed');
      if (!this.host.permitted(plan) || !await this.host.validate(plan)) throw new Error('Provider, target or capability changed before save');
      await this.host.update(plan.setting, plan.intent.scope, mutation.value);
      this.#submitted.add(plan);
      try {
        if (!await this.host.validate(plan)) return result(true, 'pending');
        if (adapter.id === 'material') return result(true, 'automatic-handoff');
        const command = 'vscode-icons.regenerateIcons';
        if (!(await this.host.commands()).includes(command)) return result(true, 'failed');
        if (!await this.host.validate(plan)) return result(true, 'pending');
        await this.host.execute(command);
        return result(true, 'completion-unconfirmed');
      } catch { return result(true, 'failed'); }
    });
    WriteCoordinator.#tail = operation.catch(() => undefined);
    return operation;
  }
}

