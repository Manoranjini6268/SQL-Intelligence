// ──────────────────────────────────────────────
// ES Rule: Aggregation Correctness
// ──────────────────────────────────────────────
// Validates aggregation structure: proper nesting, known agg types,
// field/type compatibility, and nested-vs-object correctness.

import { SchemaGraph } from '../../../schema/schema-graph';
import { ESValidationRule, ESRuleResult } from '../types';

const VALID_BUCKET_AGGS = new Set([
  'terms', 'date_histogram', 'histogram', 'range', 'date_range',
  'filter', 'filters', 'global', 'missing', 'nested', 'reverse_nested',
  'children', 'parent', 'sampler', 'diversified_sampler', 'significant_terms',
  'significant_text', 'composite', 'variable_width_histogram', 'multi_terms',
  'rare_terms', 'adjacency_matrix', 'auto_date_histogram', 'ip_range',
  'ip_prefix', 'geohash_grid', 'geotile_grid', 'geo_distance',
]);

const VALID_METRIC_AGGS = new Set([
  'avg', 'sum', 'min', 'max', 'value_count', 'stats', 'extended_stats',
  'cardinality', 'percentiles', 'percentile_ranks', 'median_absolute_deviation',
  'geo_bounds', 'geo_centroid', 'geo_line', 'top_hits', 'top_metrics',
  'weighted_avg', 'matrix_stats', 'boxplot', 'rate', 't_test', 'string_stats',
]);

const VALID_PIPELINE_AGGS = new Set([
  'avg_bucket', 'sum_bucket', 'min_bucket', 'max_bucket', 'stats_bucket',
  'extended_stats_bucket', 'percentiles_bucket', 'moving_avg', 'moving_fn',
  'cumulative_sum', 'cumulative_cardinality', 'derivative', 'serial_diff',
  'bucket_sort', 'bucket_selector', 'bucket_script', 'normalize',
  'inference',
]);

const ALL_VALID_AGGS = new Set([
  ...VALID_BUCKET_AGGS,
  ...VALID_METRIC_AGGS,
  ...VALID_PIPELINE_AGGS,
]);

export class AggregationCorrectnessRule implements ESValidationRule {
  readonly name = 'aggregation-correctness';

  validate(dsl: Record<string, unknown>, _raw: string, schema?: SchemaGraph): ESRuleResult {
    const aggs = (dsl.aggs || dsl.aggregations) as Record<string, unknown> | undefined;
    if (!aggs) return { passed: true };

    try {
      const result = this.validateAggs(aggs, 0, schema, null);
      return result;
    } catch (error) {
      return {
        passed: false,
        reason: `Aggregation validation error: ${error instanceof Error ? error.message : 'unknown'}`,
      };
    }
  }

  /**
   * @param nestedPath — tracks the current nested context (e.g. "items").
   * null means we are at root level; set when entering a nested agg,
   * cleared when entering a reverse_nested agg.
   */
  private validateAggs(
    aggs: Record<string, unknown>,
    depth: number,
    schema?: SchemaGraph,
    nestedPath?: string | null,
  ): ESRuleResult {
    if (depth > 5) {
      return {
        passed: false,
        reason: 'Aggregation nesting exceeds maximum depth of 5',
      };
    }

    for (const [aggName, aggDef] of Object.entries(aggs)) {
      if (typeof aggDef !== 'object' || aggDef === null) {
        return {
          passed: false,
          reason: `Aggregation '${aggName}' must be an object`,
        };
      }

      const aggObj = aggDef as Record<string, unknown>;
      let hasValidType = false;

      // Determine nested context for child aggs
      let childNestedPath = nestedPath;

      for (const key of Object.keys(aggObj)) {
        if (key === 'aggs' || key === 'aggregations') continue;
        if (key === 'meta') continue;

        if (ALL_VALID_AGGS.has(key)) {
          hasValidType = true;

          // Track nested context transitions
          if (key === 'nested') {
            const nestedConfig = aggObj[key] as Record<string, unknown>;
            if (nestedConfig && nestedConfig.path) {
              childNestedPath = nestedConfig.path as string;

              // Validate nested agg correctness against schema
              if (schema) {
                const isActuallyNested = this.isNestedField(childNestedPath, schema);
                if (!isActuallyNested) {
                  return {
                    passed: false,
                    reason: `Field '${childNestedPath}' is not a nested type — do not use a nested aggregation. Query sub-fields directly (e.g. "${childNestedPath}.subfield").`,
                  };
                }
              }
            }
          } else if (key === 'reverse_nested') {
            // Escaping back to root context
            childNestedPath = null;
          }

          // ── Validate field references respect nested context ──
          if (schema) {
            const aggConfig = aggObj[key] as Record<string, unknown> | undefined;
            if (aggConfig && typeof aggConfig === 'object') {
              // Direct field reference (terms, sum, avg, etc.)
              if (aggConfig.field) {
                const fieldName = aggConfig.field as string;
                // Skip meta-fields and wildcards
                if (!fieldName.startsWith('_') && !fieldName.includes('*')) {
                  // Check if field belongs to the current nested path
                  if (nestedPath && !fieldName.startsWith(nestedPath + '.')) {
                    return {
                      passed: false,
                      reason: `Field '${fieldName}' is a root-level field but is used inside a nested aggregation on '${nestedPath}'. To access root fields from inside a nested agg, wrap them in a reverse_nested aggregation: { "reverse_nested": {}, "aggs": { ... "field": "${fieldName}" ... } }`,
                      patchedDsl: undefined,
                    };
                  }
                }
              }

              // Filter agg query body — check field references inside the query respect nested context
              if (key === 'filter' && nestedPath) {
                const rootFieldInFilter = this.findRootFieldInQuery(aggConfig, nestedPath);
                if (rootFieldInFilter) {
                  return {
                    passed: false,
                    reason: `Filter aggregation references root-level field '${rootFieldInFilter}' inside nested context '${nestedPath}'. Fields inside a nested aggregation must belong to the nested path. Use a query on '${nestedPath}.*' fields instead, or use reverse_nested to escape to root level first.`,
                    patchedDsl: undefined,
                  };
                }
              }
            }
          }
        }
      }

      // Validate sub-aggregations with the updated nested context
      for (const key of Object.keys(aggObj)) {
        if (key === 'aggs' || key === 'aggregations') {
          const subAggs = aggObj[key] as Record<string, unknown>;
          const subResult = this.validateAggs(subAggs, depth + 1, schema, childNestedPath);
          if (!subResult.passed) return subResult;
        }
      }

      if (!hasValidType) {
        // Check if any key looks like an aggregation type
        const aggKeys = Object.keys(aggObj).filter(
          (k) => k !== 'aggs' && k !== 'aggregations' && k !== 'meta',
        );
        if (aggKeys.length > 0) {
          const unknownTypes = aggKeys.filter((k) => !ALL_VALID_AGGS.has(k));
          if (unknownTypes.length > 0 && aggKeys.length === unknownTypes.length) {
            return {
              passed: false,
              reason: `Unknown aggregation type(s) in '${aggName}': ${unknownTypes.join(', ')}`,
            };
          }
        }
      }
    }

    return { passed: true };
  }

  /**
   * Check if a given field path is actually a nested type in the schema.
   * Looks for 'nested' in the column type or comment for any index.
   */
  private isNestedField(path: string, schema: SchemaGraph): boolean {
    for (const tableName of schema.getTableNames()) {
      const table = schema.getTable(tableName);
      if (!table) continue;
      for (const col of table.columns) {
        if (col.name === path || col.name.startsWith(path + '.')) {
          // Check if the type or comment indicates nested
          const typeStr = (col.type || '').toLowerCase();
          const commentStr = (col.comment || '').toLowerCase();
          if (typeStr.includes('nested') || commentStr.includes('nested')) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Recursively scan a query object (inside a filter agg) for field references
   * that don't belong to the current nested path.
   * Returns the first offending field name, or null if all fields are valid.
   */
  private findRootFieldInQuery(query: Record<string, unknown>, nestedPath: string, depth = 0): string | null {
    if (depth > 10 || !query || typeof query !== 'object') return null;

    const QUERY_CLAUSES = new Set([
      'term', 'terms', 'match', 'match_phrase', 'prefix',
      'wildcard', 'regexp', 'fuzzy', 'range', 'exists',
      'match_phrase_prefix', 'multi_match', 'match_bool_prefix',
    ]);

    for (const [key, value] of Object.entries(query)) {
      if (QUERY_CLAUSES.has(key) && typeof value === 'object' && value !== null) {
        // e.g. { "term": { "status": "active" } } — "status" is the field name
        if (key === 'exists') {
          const fieldVal = (value as Record<string, unknown>).field;
          if (typeof fieldVal === 'string' && !fieldVal.startsWith('_') && !fieldVal.startsWith(nestedPath + '.')) {
            return fieldVal;
          }
        } else {
          for (const innerKey of Object.keys(value as Record<string, unknown>)) {
            // Skip reserved keys (boost, value, etc.)
            if (['boost', 'value', 'values', 'operator', 'analyzer', 'minimum_should_match',
                 'fuzziness', 'format', 'gte', 'gt', 'lte', 'lt', 'relation', 'time_zone',
                 'flags', 'rewrite', 'case_insensitive', 'query', 'type', 'fields'].includes(innerKey)) continue;
            if (!innerKey.startsWith('_') && !innerKey.startsWith(nestedPath + '.')) {
              return innerKey;
            }
          }
        }
      }

      // Recurse into bool, nested structures
      if (key === 'bool' && typeof value === 'object' && value !== null) {
        for (const [boolKey, clauses] of Object.entries(value as Record<string, unknown>)) {
          if (['must', 'must_not', 'should', 'filter'].includes(boolKey)) {
            if (Array.isArray(clauses)) {
              for (const clause of clauses) {
                if (typeof clause === 'object' && clause !== null) {
                  const found = this.findRootFieldInQuery(clause as Record<string, unknown>, nestedPath, depth + 1);
                  if (found) return found;
                }
              }
            } else if (typeof clauses === 'object' && clauses !== null) {
              const found = this.findRootFieldInQuery(clauses as Record<string, unknown>, nestedPath, depth + 1);
              if (found) return found;
            }
          }
        }
      }

      // Generic recursion for other nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !QUERY_CLAUSES.has(key) && key !== 'bool') {
        const found = this.findRootFieldInQuery(value as Record<string, unknown>, nestedPath, depth + 1);
        if (found) return found;
      }
    }

    return null;
  }
}
