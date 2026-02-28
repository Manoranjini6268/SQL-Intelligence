// ──────────────────────────────────────────────
// Validation Types
// ──────────────────────────────────────────────

import { SchemaGraph } from '../../schema/schema-graph';

export interface ValidationRule {
  readonly name: string;
  validate(ast: unknown, sql: string, schema?: SchemaGraph): RuleResult;
}

export interface RuleResult {
  passed: boolean;
  reason?: string;
  /** Optional replacement SQL when a rule auto-patches instead of rejecting */
  patchedSql?: string;
}

export interface FullValidationResult {
  verdict: 'ACCEPT' | 'REJECT';
  sql: string;
  reasons: string[];
  rulesChecked: string[];
  ast?: unknown;
}
