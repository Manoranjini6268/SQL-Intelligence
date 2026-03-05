// ──────────────────────────────────────────────
// ES Validation Types
// ──────────────────────────────────────────────

import { SchemaGraph } from '../../schema/schema-graph';

/** ES validation rule interface — parallel to SQL ValidationRule */
export interface ESValidationRule {
  readonly name: string;
  validate(dsl: Record<string, unknown>, raw: string, schema?: SchemaGraph): ESRuleResult;
}

export interface ESRuleResult {
  passed: boolean;
  reason?: string;
  patchedDsl?: Record<string, unknown>; // optional auto-repair
}

export interface FullESValidationResult {
  verdict: 'ACCEPT' | 'REJECT';
  queryDsl: string;
  reasons: string[];
  rulesChecked: string[];
  parsed?: Record<string, unknown>;
}
