// ──────────────────────────────────────────────
// ES Rule: Valid JSON Structure
// ──────────────────────────────────────────────
// Ensures the DSL is a valid JSON object with recognized top-level keys.

import { ESValidationRule, ESRuleResult } from '../types';

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'query',
  'aggs',
  'aggregations',
  'size',
  'from',
  'sort',
  '_source',
  'fields',
  'highlight',
  'post_filter',
  'track_total_hits',
  'timeout',
  'runtime_mappings',
  'collapse',
  'search_after',
  'pit',
  'suggest',
  'stored_fields',
  'docvalue_fields',
  'indices_boost',
  'min_score',
  'track_scores',
  'version',
  'seq_no_primary_term',
  'explain',
  '_index', // our custom: target index
]);

export class ValidJsonRule implements ESValidationRule {
  readonly name = 'valid-json';

  validate(dsl: Record<string, unknown>): ESRuleResult {
    if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
      return { passed: false, reason: 'Query DSL must be a JSON object' };
    }

    const keys = Object.keys(dsl);
    if (keys.length === 0) {
      return { passed: false, reason: 'Query DSL is empty' };
    }

    // Check for unexpected top-level keys
    const unknownKeys = keys.filter((k) => !ALLOWED_TOP_LEVEL_KEYS.has(k));
    if (unknownKeys.length > 0) {
      return {
        passed: false,
        reason: `Unknown top-level keys: ${unknownKeys.join(', ')}. Only search operations are allowed.`,
      };
    }

    return { passed: true };
  }
}
