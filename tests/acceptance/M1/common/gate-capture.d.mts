export function armCapture(control: {
  setRules(rules: Record<string, any>[]): Promise<void>;
  readEvents(): Promise<Record<string, any>[]>;
}, options?: {
  faults?: Record<string, any>[];
  action?: string;
  idPrefix?: string;
}): Promise<number>;
