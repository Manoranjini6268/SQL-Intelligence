// ──────────────────────────────────────────────
// Rule: No Placeholders — Reject fabricated literal values in SQL
// ──────────────────────────────────────────────
// Detects when the LLM has inserted placeholder text instead of a real
// value in WHERE clause string literals — e.g. 'PLACEHOLDER_EMAIL',
// 'top_customer@example.com', 'your_id_here'.
// These queries will always return 0 results and mislead the user.

import { ValidationRule, RuleResult } from '../types';

const PLACEHOLDER_PATTERNS = [
  /PLACEHOLDER/i,
  /YOUR[_\s]/i,
  /EXAMPLE\.(COM|ORG|NET)/i,
  /TEST\.(COM|ORG|NET)/i,
  /SAMPLE[_\s]/i,
  /_HERE\b/i,
  /_VALUE\b/i,
  /<[A-Z_]+>/,           // <CUSTOMER_EMAIL>
  /\[.*?\]/,             // [customer id]
  /TOP_CUSTOMER/i,
  /SPECIFIC_/i,
];

export class NoPlaceholdersRule implements ValidationRule {
  readonly name = 'no-placeholders';

  validate(_ast: unknown, sql: string): RuleResult {
    // Extract single-quoted string literals from the SQL
    const literals = [...sql.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    const found: string[] = [];

    for (const literal of literals) {
      if (PLACEHOLDER_PATTERNS.some((re) => re.test(literal))) {
        found.push(`'${literal.substring(0, 60)}'`);
      }
    }

    if (found.length > 0) {
      return {
        passed: false,
        reason: `Query contains placeholder value(s) instead of real data: ${found.slice(0, 3).join(', ')}. Ask the user to specify the exact value.`,
      };
    }

    return { passed: true };
  }
}
