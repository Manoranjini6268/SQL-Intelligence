// ──────────────────────────────────────────────
// Rule: Single Statement
// ──────────────────────────────────────────────

import { ValidationRule, RuleResult } from '../types';

export class SingleStatementRule implements ValidationRule {
  readonly name = 'single-statement';

  validate(_ast: unknown, sql: string): RuleResult {
    // Check for multiple statements (semicolons that aren't inside strings)
    const cleaned = sql.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
    const statements = cleaned.split(';').filter((s) => s.trim().length > 0);

    if (statements.length > 1) {
      return {
        passed: false,
        reason: `Multi-statement queries are not allowed. Found ${statements.length} statements.`,
      };
    }

    return { passed: true };
  }
}
