export const METHODS: string[];
export const READINESS_TITLE: string;
export const READINESS_ACTION: string;
export function received(events: any[], cursor?: number): any[];
export function onlyV(events: any[], cursor?: number): any;
export function vBeforeMutation(events: any[], cursor?: number): void;
export function auditCursor(entries: any[]): { line: number; bootLine: number; bootTrace: unknown };
export function auditWindow(entries: any[], cursor: ReturnType<typeof auditCursor>,
  answer: { traceId: string; status: number }, method: string, connectionId: string,
  count: number, grantId?: string): any[];
