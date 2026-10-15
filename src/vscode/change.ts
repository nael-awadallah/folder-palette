import { runChange } from '../commands/change';
import { withVSCodeWorkflow } from './workflow';

export async function executeChange(primary?: unknown, selected?: unknown): Promise<void> {
  await withVSCodeWorkflow(runChange, false, primary, selected);
}
