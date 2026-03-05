// ──────────────────────────────────────────────
// Query Types
// ──────────────────────────────────────────────

import type { UIHint } from '../../llm/types';

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
  validationVerdict: 'ACCEPT' | 'REJECT' | 'CONVERSATIONAL';
  validationReasons: string[];
  requiresApproval: boolean;
  ui_hint?: UIHint;
  follow_up_questions?: string[];
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
  /** Total matching documents (ES only) — may be larger than rowCount */
  totalHits?: number;
  /** Generative UI — recommended frontend component */
  ui_hint?: UIHint;
  /** Suggested follow-up questions for non-technical users */
  follow_up_questions?: string[];
}

export interface QueryStreamEvent {
  type: 'explanation' | 'plan' | 'validation' | 'executing' | 'result' | 'error';
  data: unknown;
}

export interface DashboardWidget {
  id: string;
  title: string;
  prompt: string;
  ui_hint: UIHint;
  size: 'sm' | 'md' | 'lg';
}
