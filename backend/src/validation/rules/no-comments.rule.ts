// ──────────────────────────────────────────────
// Rule: No Comments
// ──────────────────────────────────────────────

import { ValidationRule, RuleResult } from '../types';

export class NoCommentsRule implements ValidationRule {
  readonly name = 'no-comments';

  validate(_ast: unknown, sql: string): RuleResult {
    // Check for single-line comments
    if (/--/.test(sql)) {
      return { passed: false, reason: 'SQL comments (--) are not allowed' };
    }

    // Check for multi-line comments
    if (/\/\*/.test(sql) || /\*\//.test(sql)) {
      return { passed: false, reason: 'SQL block comments (/* */) are not allowed' };
    }

    // Check for hash comments (MySQL)
    if (/#/.test(sql)) {
      return { passed: false, reason: 'SQL hash comments (#) are not allowed' };
    }

    return { passed: true };
  }
}
