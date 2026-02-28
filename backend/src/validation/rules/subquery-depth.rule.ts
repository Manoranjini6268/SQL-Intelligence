// ──────────────────────────────────────────────
// Rule: Subquery Depth ≤ 2
// ──────────────────────────────────────────────

import { ValidationRule, RuleResult } from '../types';

const MAX_DEPTH = 2;

export class SubqueryDepthRule implements ValidationRule {
  readonly name = 'subquery-depth';

  validate(ast: unknown): RuleResult {
    const depth = this.measureDepth(ast, 0);

    if (depth > MAX_DEPTH) {
      return {
        passed: false,
        reason: `Subquery depth exceeds maximum of ${MAX_DEPTH}. Found depth: ${depth}`,
      };
    }

    return { passed: true };
  }

  private measureDepth(node: unknown, currentDepth: number): number {
    if (!node || typeof node !== 'object') return currentDepth;

    let maxDepth = currentDepth;
    const obj = node as Record<string, unknown>;

    // Check if this node is a subquery (has type 'select' in a nested position)
    if (obj.type === 'select' && currentDepth > 0) {
      // This is a nested SELECT
    }

    // Traverse FROM clause for subqueries
    if (Array.isArray(obj.from)) {
      for (const fromItem of obj.from) {
        const item = fromItem as Record<string, unknown>;
        if (item.expr && (item.expr as Record<string, unknown>).type === 'select') {
          maxDepth = Math.max(
            maxDepth,
            this.measureDepth(item.expr, currentDepth + 1),
          );
        }
      }
    }

    // Traverse WHERE clause for subqueries
    if (obj.where) {
      maxDepth = Math.max(maxDepth, this.findSubqueryDepth(obj.where, currentDepth));
    }

    // Traverse HAVING clause
    if (obj.having) {
      maxDepth = Math.max(maxDepth, this.findSubqueryDepth(obj.having, currentDepth));
    }

    return maxDepth;
  }

  private findSubqueryDepth(node: unknown, currentDepth: number): number {
    if (!node || typeof node !== 'object') return currentDepth;

    let maxDepth = currentDepth;
    const obj = node as Record<string, unknown>;

    if (obj.type === 'select') {
      return this.measureDepth(obj, currentDepth + 1);
    }

    // Recurse into all properties
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          maxDepth = Math.max(maxDepth, this.findSubqueryDepth(item, currentDepth));
        }
      } else if (typeof value === 'object' && value !== null) {
        maxDepth = Math.max(maxDepth, this.findSubqueryDepth(value, currentDepth));
      }
    }

    return maxDepth;
  }
}
