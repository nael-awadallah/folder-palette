import { runManage } from '../commands/manage';
import { runReset } from '../commands/reset';
import { withVSCodeWorkflow } from './workflow';

export async function executeReset(primary?: unknown, selected?: unknown): Promise<void> {
  await withVSCodeWorkflow(runReset, false, primary, selected);
}
export async function executeManage(): Promise<void> { await withVSCodeWorkflow(runManage, true); }
