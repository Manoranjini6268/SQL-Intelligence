// ──────────────────────────────────────────────
// Rule: SELECT Only
// ──────────────────────────────────────────────

import { ValidationRule, RuleResult } from '../types';

export class SelectOnlyRule implements ValidationRule {
  readonly name = 'select-only';

  validate(ast: unknown): RuleResult {
    const node = ast as Record<string, unknown>;
    const type = node.type as string | undefined;

    if (type && type.toLowerCase() !== 'select') {
      return { passed: false, reason: `Only SELECT statements are allowed. Found: ${type}` };
    }

    return { passed: true };
  }
}
