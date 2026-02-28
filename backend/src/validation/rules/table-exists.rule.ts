// ──────────────────────────────────────────────
// Rule: Table Exists in Schema
// ──────────────────────────────────────────────

import { SchemaGraph } from '../../schema/schema-graph';
import { ValidationRule, RuleResult } from '../types';

export class TableExistsRule implements ValidationRule {
  readonly name = 'table-exists';

  validate(ast: unknown, _sql: string, schema?: SchemaGraph): RuleResult {
    if (!schema) {
      return { passed: true }; // Skip if no schema available
    }

    const tables = this.extractTables(ast);
    const missing: string[] = [];

    for (const table of tables) {
      if (!schema.validateTableExists(table)) {
        missing.push(table);
      }
    }

    if (missing.length > 0) {
      return {
        passed: false,
        reason: `Tables not found in schema: ${missing.join(', ')}`,
      };
    }

    return { passed: true };
  }

  private extractTables(node: unknown): string[] {
    const tables: string[] = [];
    if (!node || typeof node !== 'object') return tables;

    const obj = node as Record<string, unknown>;

    // Extract from FROM clause
    if (Array.isArray(obj.from)) {
      for (const fromItem of obj.from) {
        const item = fromItem as Record<string, unknown>;
        if (typeof item.table === 'string') {
          tables.push(item.table);
        }
        // Handle subqueries in FROM
        if (item.expr && typeof item.expr === 'object') {
          tables.push(...this.extractTables(item.expr));
        }
      }
    }

    // Extract from JOINs
    if (Array.isArray(obj.from)) {
      for (const fromItem of obj.from) {
        const item = fromItem as Record<string, unknown>;
        if (item.join && typeof item.table === 'string') {
          tables.push(item.table);
        }
      }
    }

    return [...new Set(tables)];
  }
}
