import { selectTarget } from '../ui/target';
import { prerequisite } from './change';
import { runAssociations, type ManagementHost } from './manage';

export async function runReset(host: ManagementHost, candidates: readonly string[] = []): Promise<void> {
  try {
    while (true) {
      const { detection, session } = host.context();
      if (!session || detection.status !== 'available') { if (await prerequisite(host, detection)) continue; return; }
      const target = await selectTarget(host, candidates);
      if (!host.isCurrent(session)) continue;
      if (!target) return;
      await runAssociations(host, target);
      return;
    }
  } catch { await host.notify('Reset not saved. Review the target, provider and stored settings before trying again.'); }
}
