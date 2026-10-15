export interface Choice { readonly value: string; readonly label: string; readonly description?: string; readonly detail?: string; readonly picked?: boolean }
export interface Step {
  readonly id: string;
  readonly title: string;
  readonly placeholder: string;
  readonly items: readonly Choice[];
  readonly detail?: string;
  readonly back?: boolean;
}
export interface FolderTarget {
  readonly uri: string;
  readonly name: string;
  readonly parentName: string;
  readonly displayName: string;
  readonly isRoot: boolean;
}
export interface TargetHost {
  pick(step: Step): Promise<string | undefined>;
  roots(): readonly string[];
  browse(): Promise<string | undefined>;
  inspectTarget(uri: string): Promise<FolderTarget | undefined>;
  notify(message: string): Promise<void>;
}
