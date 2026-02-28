// ──────────────────────────────────────────────
// Query Types
// ──────────────────────────────────────────────

export interface QueryRequest {
  sessionId: string;
  prompt: string;
  executeImmediately?: boolean; // Requires explicit frontend approval
}

export interface QueryPlanResult {
  sql: string;
  explanation: string;
  tables_used: string[];
  confidence: number;
  validationVerdict: 'ACCEPT' | 'REJECT';
  validationReasons: string[];
  requiresApproval: boolean;
}

export interface QueryExecutionResponse {
  sql: string;
  explanation: string;
  tables_used: string[];
  confidence: number;
  executionTime: number;
  rowCount: number;
  rows: Record<string, unknown>[];
  columns: string[];
  insight?: string;
}

export interface QueryStreamEvent {
  type: 'explanation' | 'plan' | 'validation' | 'executing' | 'result' | 'error';
  data: unknown;
}
