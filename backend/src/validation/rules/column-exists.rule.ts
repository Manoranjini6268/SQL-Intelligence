// ──────────────────────────────────────────────
// Rule: Column Exists in Schema
// ──────────────────────────────────────────────

import { SchemaGraph } from '../../schema/schema-graph';
import { ValidationRule, RuleResult } from '../types';

export class ColumnExistsRule implements ValidationRule {
  readonly name = 'column-exists';

  validate(ast: unknown, _sql: string, schema?: SchemaGraph): RuleResult {
    if (!schema) {
      return { passed: true }; // Skip if no schema
    }

    // Build alias→realTable map and real table list from the FROM clause
    const { aliasMap, realTables } = this.extractFromInfo(ast);

    // Collect SELECT-level computed aliases (e.g. SUM(...) AS total_sold)
    // so we don't try to validate them as real schema columns in ORDER BY / GROUP BY
    const selectAliases = this.extractSelectAliases(ast);

    const references = this.extractColumnReferences(ast);
    const missing: string[] = [];

    for (const ref of references) {
      if (ref.column === '*') continue;

      if (ref.table) {
        // Resolve alias to real table name
        const realTable = aliasMap.get(ref.table) ?? ref.table;
        if (!schema.validateColumnExists(realTable, ref.column)) {
          missing.push(`${ref.table}.${ref.column}`);
        }
      } else {
        // Skip if it's a known SELECT-level computed alias
        if (selectAliases.has(ref.column)) continue;

        // Unqualified reference: resolve against all FROM-clause real tables
        const found = realTables.some((tableName) =>
          schema.validateColumnExists(tableName, ref.column),
        );
        if (!found && realTables.length > 0) {
          missing.push(`<unqualified>.${ref.column} (not found in tables: ${realTables.join(', ')})`);
        }
      }
    }

    if (missing.length > 0) {
      return {
        passed: false,
        reason: `Columns not found in schema: ${missing.join(', ')}`,
      };
    }

    return { passed: true };
  }

  /**
   * Build alias→realTable map and the list of real table names from FROM clause.
   * Handles: FROM table, FROM table AS alias, FROM table t, JOINs.
   */
  private extractFromInfo(node: unknown): {
    aliasMap: Map<string, string>;
    realTables: string[];
  } {
    const aliasMap = new Map<string, string>();
    const realTables: string[] = [];

    if (!node || typeof node !== 'object') return { aliasMap, realTables };
    const obj = node as Record<string, unknown>;

    if (Array.isArray(obj.from)) {
      for (const fromItem of obj.from) {
        const item = fromItem as Record<string, unknown>;
        if (typeof item.table === 'string') {
          const realName = item.table;
          realTables.push(realName);
          // Map alias (if any) → real table name
          if (typeof item.as === 'string' && item.as) {
            aliasMap.set(item.as, realName);
          }
          // Also map the real name to itself for convenience
          aliasMap.set(realName, realName);
        }
      }
    }

    return { aliasMap, realTables };
  }

  /**
   * Collect the AS aliases defined at the SELECT column level.
   * e.g. SUM(quantity) AS total_sold  →  'total_sold'
   */
  private extractSelectAliases(node: unknown): Set<string> {
    const aliases = new Set<string>();
    if (!node || typeof node !== 'object') return aliases;
    const obj = node as Record<string, unknown>;

    if (Array.isArray(obj.columns)) {
      for (const col of obj.columns) {
        if (col === '*') continue;
        const colObj = col as Record<string, unknown>;
        if (typeof colObj.as === 'string' && colObj.as) {
          aliases.add(colObj.as);
        }
      }
    }
    return aliases;
  }

  private extractColumnReferences(
    node: unknown,
  ): { table: string | null; column: string }[] {
    const refs: { table: string | null; column: string }[] = [];
    if (!node || typeof node !== 'object') return refs;

    const obj = node as Record<string, unknown>;

    // Extract from SELECT columns
    if (Array.isArray(obj.columns)) {
      for (const col of obj.columns) {
        if (col === '*') continue;
        const colObj = col as Record<string, unknown>;
        const expr = colObj.expr as Record<string, unknown> | undefined;
        if (expr && expr.type === 'column_ref') {
          refs.push({
            table: (expr.table as string) || null,
            column: expr.column as string,
          });
        }
      }
    }

    // Extract from WHERE clause
    if (obj.where) {
      refs.push(...this.extractFromExpression(obj.where));
    }

    // Extract from ORDER BY
    if (Array.isArray(obj.orderby)) {
      for (const item of obj.orderby) {
        const orderExpr = (item as Record<string, unknown>).expr as Record<string, unknown>;
        if (orderExpr && orderExpr.type === 'column_ref') {
          refs.push({
            table: (orderExpr.table as string) || null,
            column: orderExpr.column as string,
          });
        }
      }
    }

    // Extract from GROUP BY
    if (Array.isArray(obj.groupby)) {
      for (const item of obj.groupby) {
        const groupExpr = (item as Record<string, unknown>).expr
          ? ((item as Record<string, unknown>).expr as Record<string, unknown>)
          : (item as Record<string, unknown>);
        if (groupExpr && groupExpr.type === 'column_ref') {
          refs.push({
            table: (groupExpr.table as string) || null,
            column: groupExpr.column as string,
          });
        }
      }
    }

    return refs;
  }

  private extractFromExpression(
    node: unknown,
  ): { table: string | null; column: string }[] {
    const refs: { table: string | null; column: string }[] = [];
    if (!node || typeof node !== 'object') return refs;

    const obj = node as Record<string, unknown>;

    if (obj.type === 'column_ref') {
      refs.push({
        table: (obj.table as string) || null,
        column: obj.column as string,
      });
    }

    if (obj.left) refs.push(...this.extractFromExpression(obj.left));
    if (obj.right) refs.push(...this.extractFromExpression(obj.right));
    if (Array.isArray(obj.args)) {
      for (const arg of obj.args) {
        refs.push(...this.extractFromExpression(arg));
      }
    }
    if (obj.args && typeof obj.args === 'object' && !Array.isArray(obj.args)) {
      const argsObj = obj.args as Record<string, unknown>;
      if (Array.isArray(argsObj.value)) {
        for (const v of argsObj.value) {
          refs.push(...this.extractFromExpression(v));
        }
      }
    }

    return refs;
  }
}
