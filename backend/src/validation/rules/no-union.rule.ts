// ──────────────────────────────────────────────
// Rule: No UNION (MVP)
// ──────────────────────────────────────────────

import { ValidationRule, RuleResult } from '../types';

export class NoUnionRule implements ValidationRule {
  readonly name = 'no-union';

  validate(ast: unknown): RuleResult {
    const node = ast as Record<string, unknown>;

    // node-sql-parser represents UNION as _next property or union type
    if (node._next || node.union) {
      return {
        passed: false,
        reason: 'UNION queries are not supported in the current version',
      };
    }

    // Also check set operations
    if (node.set_op) {
      return {
        passed: false,
        reason: 'Set operations (UNION, INTERSECT, EXCEPT) are not supported',
      };
    }

    return { passed: true };
  }
}
