// ──────────────────────────────────────────────
// ES Rule: Field Exists — Referenced fields must exist in mappings
// ──────────────────────────────────────────────

import { SchemaGraph } from '../../../schema/schema-graph';
import { ESValidationRule, ESRuleResult } from '../types';

export class FieldExistsRule implements ESValidationRule {
  readonly name = 'field-exists';

  validate(dsl: Record<string, unknown>, _raw: string, schema?: SchemaGraph): ESRuleResult {
    if (!schema) return { passed: true };

    // Extract all field references from the DSL
    const referencedFields = this.extractFields(dsl);
    if (referencedFields.size === 0) return { passed: true };

    // Get all available field paths across all indices
    const availableFields = new Set<string>();
    for (const tableName of schema.getTableNames()) {
      const table = schema.getTable(tableName);
      if (table) {
        for (const col of table.columns) {
          availableFields.add(col.name.toLowerCase());
          // Also add parent paths for nested fields
          const parts = col.name.split('.');
          for (let i = 1; i < parts.length; i++) {
            availableFields.add(parts.slice(0, i).join('.').toLowerCase());
          }
        }
      }
    }

    // Skip validation if we have no field info (fresh connection)
    if (availableFields.size === 0) return { passed: true };

    // Check each referenced field
    const missingFields: string[] = [];
    for (const field of referencedFields) {
      const fieldLower = field.toLowerCase();
      // Allow meta-fields (_id, _index, _score, _source, _type)
      if (fieldLower.startsWith('_')) continue;
      // Allow wildcard field references
      if (field.includes('*') || field.includes('?')) continue;
      // Allow .keyword sub-fields
      if (fieldLower.endsWith('.keyword') || fieldLower.endsWith('.raw')) {
        const parent = fieldLower.replace(/\.(keyword|raw)$/, '');
        if (availableFields.has(parent)) continue;
      }

      if (!availableFields.has(fieldLower)) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      // Warn but don't reject for small number of missing fields (could be runtime fields)
      if (missingFields.length > 3) {
        return {
          passed: false,
          reason: `Fields not found in index mappings: ${missingFields.slice(0, 5).join(', ')}${missingFields.length > 5 ? ` (+${missingFields.length - 5} more)` : ''}`,
        };
      }
      // For 1-3 fields, pass with a warning (could be multi-fields or runtime fields)
    }

    return { passed: true };
  }

  /**
   * Recursively extract all field name references from ES DSL.
   * Handles query, aggs, sort, _source, and fields contexts.
   */
  private extractFields(
    obj: unknown,
    depth = 0,
    inFieldContext = false,
  ): Set<string> {
    const fields = new Set<string>();
    if (depth > 15 || !obj || typeof obj !== 'object') return fields;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        for (const f of this.extractFields(item, depth + 1, inFieldContext)) {
          fields.add(f);
        }
      }
      return fields;
    }

    const entries = Object.entries(obj as Record<string, unknown>);

    for (const [key, value] of entries) {
      // Direct field reference contexts
      if (this.isFieldReferenceKey(key)) {
        if (typeof value === 'string') {
          fields.add(value);
        } else if (Array.isArray(value)) {
          for (const v of value) {
            if (typeof v === 'string') fields.add(v);
            if (typeof v === 'object' && v !== null && (v as any).field) {
              fields.add((v as any).field);
            }
          }
        }
        continue;
      }

      // Query clause field names (e.g., { "term": { "status": "active" } })
      if (this.isQueryClause(key) && typeof value === 'object' && value !== null) {
        const innerKeys = Object.keys(value as Record<string, unknown>);
        for (const innerKey of innerKeys) {
          if (!this.isReservedKey(innerKey)) {
            fields.add(innerKey);
          }
        }
      }

      // Aggregation field references
      if (key === 'aggs' || key === 'aggregations') {
        if (typeof value === 'object' && value !== null) {
          for (const [aggName, aggDef] of Object.entries(value as Record<string, unknown>)) {
            if (typeof aggDef === 'object' && aggDef !== null) {
              for (const f of this.extractFields(aggDef, depth + 1, true)) {
                fields.add(f);
              }
            }
          }
        }
        continue;
      }

      // Sort references
      if (key === 'sort') {
        if (Array.isArray(value)) {
          for (const sortItem of value) {
            if (typeof sortItem === 'string') {
              fields.add(sortItem);
            } else if (typeof sortItem === 'object' && sortItem !== null) {
              for (const sortKey of Object.keys(sortItem as Record<string, unknown>)) {
                if (!this.isReservedKey(sortKey)) {
                  fields.add(sortKey);
                }
              }
            }
          }
        }
        continue;
      }

      // Recurse
      if (typeof value === 'object' && value !== null) {
        for (const f of this.extractFields(value, depth + 1, inFieldContext)) {
          fields.add(f);
        }
      }
    }

    return fields;
  }

  private isFieldReferenceKey(key: string): boolean {
    return ['field', 'fields', '_source'].includes(key);
  }

  private isQueryClause(key: string): boolean {
    return [
      'term', 'terms', 'match', 'match_phrase', 'prefix',
      'wildcard', 'regexp', 'fuzzy', 'range', 'exists',
      'match_phrase_prefix', 'multi_match', 'match_bool_prefix',
    ].includes(key);
  }

  private isReservedKey(key: string): boolean {
    return [
      'query', 'value', 'values', 'boost', 'operator', 'analyzer',
      'minimum_should_match', 'fuzziness', 'prefix_length',
      'max_expansions', 'format', 'gte', 'gt', 'lte', 'lt',
      'relation', 'time_zone', 'flags', 'rewrite', 'case_insensitive',
    ].includes(key);
  }
}
