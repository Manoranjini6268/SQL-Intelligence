// ──────────────────────────────────────────────
// ES Rule: Query Structure — Validate query clause structure
// ──────────────────────────────────────────────
// Ensures the 'query' key contains valid ES query clause types.

import { ESValidationRule, ESRuleResult } from '../types';

const VALID_QUERY_TYPES = new Set([
  // Full text queries
  'match', 'match_phrase', 'match_phrase_prefix', 'multi_match',
  'match_bool_prefix', 'combined_fields', 'query_string',
  'simple_query_string', 'intervals',
  // Term-level queries
  'term', 'terms', 'terms_set', 'range', 'exists', 'prefix',
  'wildcard', 'regexp', 'fuzzy', 'type', 'ids',
  // Compound queries
  'bool', 'boosting', 'constant_score', 'dis_max', 'function_score',
  // Joining queries
  'nested', 'has_child', 'has_parent', 'parent_id',
  // Geo queries
  'geo_bounding_box', 'geo_distance', 'geo_polygon', 'geo_shape',
  // Shape queries
  'shape',
  // Specialized queries
  'distance_feature', 'more_like_this', 'percolate', 'rank_feature',
  'wrapper', 'pinned', 'rule',
  // Match all
  'match_all', 'match_none',
]);

export class QueryStructureRule implements ESValidationRule {
  readonly name = 'query-structure';

  validate(dsl: Record<string, unknown>): ESRuleResult {
    const query = dsl.query as Record<string, unknown> | undefined;
    if (!query) {
      // No query = match_all implicit, that's fine
      return { passed: true };
    }

    if (typeof query !== 'object' || Array.isArray(query)) {
      return {
        passed: false,
        reason: 'Query must be a JSON object',
      };
    }

    return this.validateQueryNode(query, 0);
  }

  private validateQueryNode(node: Record<string, unknown>, depth: number): ESRuleResult {
    if (depth > 10) {
      return {
        passed: false,
        reason: 'Query nesting exceeds maximum depth of 10',
      };
    }

    for (const [key, value] of Object.entries(node)) {
      if (!VALID_QUERY_TYPES.has(key)) {
        // Unknown query type
        return {
          passed: false,
          reason: `Unknown query type: '${key}'. Only standard Elasticsearch query types are allowed.`,
        };
      }

      // Validate compound query children (bool)
      if (key === 'bool' && typeof value === 'object' && value !== null) {
        const boolQuery = value as Record<string, unknown>;
        const validKeys = new Set(['must', 'must_not', 'should', 'filter', 'minimum_should_match', 'boost']);
        for (const boolKey of Object.keys(boolQuery)) {
          if (!validKeys.has(boolKey)) {
            return {
              passed: false,
              reason: `Unknown bool query clause: '${boolKey}'`,
            };
          }
          // Validate nested clauses
          const clauses = boolQuery[boolKey];
          if (Array.isArray(clauses)) {
            for (const clause of clauses) {
              if (typeof clause === 'object' && clause !== null) {
                const result = this.validateQueryNode(clause as Record<string, unknown>, depth + 1);
                if (!result.passed) return result;
              }
            }
          } else if (typeof clauses === 'object' && clauses !== null && boolKey !== 'minimum_should_match' && boolKey !== 'boost') {
            const result = this.validateQueryNode(clauses as Record<string, unknown>, depth + 1);
            if (!result.passed) return result;
          }
        }
      }

      // Validate inner queries of compound/joining types
      if (
        ['nested', 'has_child', 'has_parent', 'constant_score'].includes(key) &&
        typeof value === 'object' &&
        value !== null
      ) {
        const inner = value as Record<string, unknown>;
        // 'nested' → inner.query, 'constant_score' → inner.filter
        const innerQuery = (inner.query || inner.filter) as Record<string, unknown> | undefined;
        if (innerQuery && typeof innerQuery === 'object') {
          const result = this.validateQueryNode(innerQuery, depth + 1);
          if (!result.passed) return result;
        }
      }

      // dis_max → validate each query in queries array
      if (key === 'dis_max' && typeof value === 'object' && value !== null) {
        const dmQueries = (value as Record<string, unknown>).queries;
        if (Array.isArray(dmQueries)) {
          for (const q of dmQueries) {
            if (typeof q === 'object' && q !== null) {
              const result = this.validateQueryNode(q as Record<string, unknown>, depth + 1);
              if (!result.passed) return result;
            }
          }
        }
      }

      // function_score → validate inner query
      if (key === 'function_score' && typeof value === 'object' && value !== null) {
        const fsQuery = (value as Record<string, unknown>).query as Record<string, unknown> | undefined;
        if (fsQuery && typeof fsQuery === 'object') {
          const result = this.validateQueryNode(fsQuery, depth + 1);
          if (!result.passed) return result;
        }
      }
    }

    return { passed: true };
  }
}
