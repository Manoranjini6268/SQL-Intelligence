// ──────────────────────────────────────────────
// ES Rule: No Placeholders — Reject fabricated literal values
// ──────────────────────────────────────────────
// Detects when the LLM has inserted placeholder text instead of a real
// value (e.g. "PLACEHOLDER_EMAIL", "top_customer@example.com",
// "your_value_here") into term/match query filters.
// These queries will always return 0 results and mislead the user.

import { ESValidationRule, ESRuleResult } from '../types';

const PLACEHOLDER_PATTERNS = [
  /PLACEHOLDER/i,
  /YOUR[_\s]/i,
  /EXAMPLE\.(COM|ORG|NET)/i,
  /TEST\.(COM|ORG|NET)/i,
  /SAMPLE[_\s]/i,
  /\bFOO\b/i,
  /\bBAR\b/i,
  /\bQUX\b/i,
  /_HERE$/i,
  /_VALUE$/i,
  /<[A-Z_]+>/,           // <CUSTOMER_EMAIL>
  /\[.*\]/,              // [customer email]
  /\{.*\}/,              // {customer_id}
  /CUSTOMER_ID_\d*/i,
  /ORDER_ID_\d*/i,
  /TOP_CUSTOMER/i,
  /SPECIFIC_/i,
];

export class NoPlaceholdersRule implements ESValidationRule {
  readonly name = 'no-placeholders';

  validate(dsl: Record<string, unknown>): ESRuleResult {
    const found = this.findPlaceholders(dsl);
    if (found.length > 0) {
      return {
        passed: false,
        reason: `Query contains placeholder value(s) instead of real data: ${found.slice(0, 3).join(', ')}. Ask the user to specify the exact value.`,
      };
    }
    return { passed: true };
  }

  private findPlaceholders(obj: unknown, depth = 0): string[] {
    if (depth > 12 || obj === null || obj === undefined) return [];
    const found: string[] = [];

    if (typeof obj === 'string') {
      if (PLACEHOLDER_PATTERNS.some((re) => re.test(obj))) {
        found.push(`"${obj.substring(0, 60)}"`);
      }
      return found;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        found.push(...this.findPlaceholders(item, depth + 1));
      }
      return found;
    }

    if (typeof obj === 'object') {
      for (const val of Object.values(obj as Record<string, unknown>)) {
        found.push(...this.findPlaceholders(val, depth + 1));
      }
    }

    return found;
  }
}
