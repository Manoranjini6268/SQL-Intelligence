// ──────────────────────────────────────────────
// Rule: LIMIT Required (≤ 500) — auto-injects LIMIT 500 if absent
// ──────────────────────────────────────────────

import { ValidationRule, RuleResult } from '../types';

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 500;

export class LimitRequiredRule implements ValidationRule {
  readonly name = 'limit-required';

  validate(ast: unknown, sql: string): RuleResult {
    const node = ast as Record<string, unknown>;

    // Check for LIMIT clause in AST
    const limit = node.limit as
      | { seperator: string; value: { type: string; value: number }[] }
      | undefined;

    if (!limit || !limit.value || limit.value.length === 0) {
      // Auto-inject LIMIT 500 rather than failing — return the patched SQL
      const patched = sql.trimEnd().replace(/;\s*$/, '') + ` LIMIT ${DEFAULT_LIMIT}`;
      return { passed: true, patchedSql: patched };
    }

    // Extract limit value
    const limitValue = limit.value[limit.value.length - 1];
    if (limitValue && typeof limitValue.value === 'number' && limitValue.value > MAX_LIMIT) {
      // Clamp to MAX_LIMIT instead of rejecting
      const patched = sql.trimEnd().replace(
        /LIMIT\s+\d+/i,
        `LIMIT ${MAX_LIMIT}`,
      );
      return { passed: true, patchedSql: patched };
    }

    return { passed: true };
  }
}
