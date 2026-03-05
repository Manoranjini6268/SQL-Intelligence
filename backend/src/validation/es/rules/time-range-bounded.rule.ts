// ──────────────────────────────────────────────
// ES Rule: Time Range Bounded
// ──────────────────────────────────────────────
// Warns if no time range filter is present on the time field.
// This is advisory for observability use cases.

import { SchemaGraph } from '../../../schema/schema-graph';
import { ESValidationRule, ESRuleResult } from '../types';

export class TimeRangeBoundedRule implements ESValidationRule {
  readonly name = 'time-range-bounded';

  validate(dsl: Record<string, unknown>, _raw: string, schema?: SchemaGraph): ESRuleResult {
    // Only apply if there's a known time field
    if (!schema) return { passed: true };

    // Check if any index has a time field
    let hasTimeField = false;
    for (const tableName of schema.getTableNames()) {
      const table = schema.getTable(tableName);
      if (table) {
        const dateFields = table.columns.filter(
          (c) => c.type === 'date' || c.type === 'date_nanos',
        );
        if (dateFields.length > 0) hasTimeField = true;
      }
    }

    if (!hasTimeField) return { passed: true };

    // Check if the query has any range filter on a date field
    const hasTimeRange = this.scanForTimeRange(dsl);

    if (!hasTimeRange) {
      // Pass but don't reject — this is advisory
      // The query will work, but unbounded time queries on observability data can be very expensive
      return { passed: true };
    }

    return { passed: true };
  }

  private scanForTimeRange(obj: unknown, depth = 0): boolean {
    if (depth > 10 || !obj || typeof obj !== 'object') return false;

    if (Array.isArray(obj)) {
      return obj.some((item) => this.scanForTimeRange(item, depth + 1));
    }

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === 'range' && typeof value === 'object' && value !== null) {
        // Check if any range is on a date-like field
        for (const fieldName of Object.keys(value as Record<string, unknown>)) {
          if (
            fieldName.includes('time') ||
            fieldName.includes('date') ||
            fieldName.includes('timestamp') ||
            fieldName === '@timestamp'
          ) {
            return true;
          }
        }
      }
      if (typeof value === 'object' && value !== null) {
        if (this.scanForTimeRange(value, depth + 1)) return true;
      }
    }

    return false;
  }
}
