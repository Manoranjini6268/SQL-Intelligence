// ──────────────────────────────────────────────
// ES Rule: Search Only — No Index Modification
// ──────────────────────────────────────────────
// Rejects any DSL that attempts to modify indices, create, update, or delete documents.

import { ESValidationRule, ESRuleResult } from '../types';

const FORBIDDEN_PATTERNS = [
  'script',
  'update',
  'delete',
  'index',
  'create',
  'bulk',
  'reindex',
  'update_by_query',
  'delete_by_query',
];

export class SearchOnlyRule implements ESValidationRule {
  readonly name = 'search-only';

  validate(dsl: Record<string, unknown>, raw: string): ESRuleResult {
    // Deep-scan the raw JSON for forbidden patterns in key positions
    const rawLower = raw.toLowerCase();

    // Check for _bulk, _update, _delete, _reindex endpoints (shouldn't appear)
    for (const pattern of ['_bulk', '_update', '_delete', '_reindex', '_create']) {
      if (rawLower.includes(`"${pattern}"`)) {
        return {
          passed: false,
          reason: `Forbidden operation detected: ${pattern}. Only search operations are allowed.`,
        };
      }
    }

    // Deep-scan object for 'script' fields (script queries/aggs are dangerous)
    if (this.containsScript(dsl)) {
      return {
        passed: false,
        reason: 'Script execution is not allowed. No script queries, script fields, or scripted aggregations.',
      };
    }

    return { passed: true };
  }

  private containsScript(obj: unknown, depth = 0): boolean {
    if (depth > 10) return false; // prevent infinite recursion
    if (!obj || typeof obj !== 'object') return false;

    if (Array.isArray(obj)) {
      return obj.some((item) => this.containsScript(item, depth + 1));
    }

    for (const [key, value] of Object.entries(obj)) {
      // Reject any 'script' key at any level
      if (key === 'script' || key === 'script_fields' || key === 'scripted_metric') {
        return true;
      }
      if (typeof value === 'object' && value !== null) {
        if (this.containsScript(value, depth + 1)) return true;
      }
    }

    return false;
  }
}
