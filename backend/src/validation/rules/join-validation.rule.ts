// ──────────────────────────────────────────────
// Rule: Join Validation (FK match, no Cartesian)
// ──────────────────────────────────────────────

import { SchemaGraph } from '../../schema/schema-graph';
import { ValidationRule, RuleResult } from '../types';

export class JoinValidationRule implements ValidationRule {
  readonly name = 'join-validation';

  validate(ast: unknown, _sql: string, schema?: SchemaGraph): RuleResult {
    if (!schema) {
      return { passed: true };
    }

    const node = ast as Record<string, unknown>;
    if (!Array.isArray(node.from)) {
      return { passed: true };
    }

    const fromItems = node.from as Record<string, unknown>[];

    // Build alias → real table name map from all FROM items
    const aliasMap = new Map<string, string>();
    for (const item of fromItems) {
      if (typeof item.table === 'string') {
        const realName = item.table;
        aliasMap.set(realName, realName);
        if (typeof item.as === 'string' && item.as) {
          aliasMap.set(item.as, realName);
        }
      }
    }

    // Check for Cartesian joins (multiple tables without ON clause)
    const tablesWithoutJoin: string[] = [];
    const joinedTables: { left: string; right: string; on: unknown }[] = [];

    for (const item of fromItems) {
      if (item.join) {
        // This is a JOIN clause
        joinedTables.push({
          left: '', // Will be determined from context
          right: item.table as string,
          on: item.on,
        });

        // Validate ON clause exists
        if (!item.on) {
          return {
            passed: false,
            reason: `JOIN on table '${item.table}' is missing ON clause — Cartesian joins are not allowed`,
          };
        }
      } else if (typeof item.table === 'string') {
        tablesWithoutJoin.push(item.table);
      }
    }

    // If more than one table in FROM without JOIN, it's a Cartesian product
    if (tablesWithoutJoin.length > 1) {
      return {
        passed: false,
        reason: `Cartesian join detected between tables: ${tablesWithoutJoin.join(', ')}. Use explicit JOIN with ON clause.`,
      };
    }

    // Validate join conditions match foreign keys (resolve aliases first)
    for (const join of joinedTables) {
      const onClause = join.on as Record<string, unknown> | undefined;
      if (!onClause) continue;

      const joinRefs = this.extractJoinReferences(onClause);
      for (const ref of joinRefs) {
        if (ref.leftTable && ref.rightTable && ref.leftColumn && ref.rightColumn) {
          // Resolve aliases to real table names before schema lookup
          const leftReal = aliasMap.get(ref.leftTable) ?? ref.leftTable;
          const rightReal = aliasMap.get(ref.rightTable) ?? ref.rightTable;

          const validation = schema.validateJoin(
            leftReal,
            ref.leftColumn,
            rightReal,
            ref.rightColumn,
          );
          if (!validation.valid) {
            return {
              passed: false,
              reason: validation.reason || 'Join validation failed',
            };
          }
        }
      }
    }

    return { passed: true };
  }

  private extractJoinReferences(
    node: unknown,
  ): {
    leftTable: string | null;
    leftColumn: string | null;
    rightTable: string | null;
    rightColumn: string | null;
  }[] {
    const refs: {
      leftTable: string | null;
      leftColumn: string | null;
      rightTable: string | null;
      rightColumn: string | null;
    }[] = [];

    if (!node || typeof node !== 'object') return refs;
    const obj = node as Record<string, unknown>;

    if (obj.type === 'binary_expr' && obj.operator === '=') {
      const left = obj.left as Record<string, unknown> | undefined;
      const right = obj.right as Record<string, unknown> | undefined;

      if (left?.type === 'column_ref' && right?.type === 'column_ref') {
        refs.push({
          leftTable: (left.table as string) || null,
          leftColumn: (left.column as string) || null,
          rightTable: (right.table as string) || null,
          rightColumn: (right.column as string) || null,
        });
      }
    }

    // Recurse for AND/OR conditions
    if (obj.type === 'binary_expr' && (obj.operator === 'AND' || obj.operator === 'OR')) {
      refs.push(...this.extractJoinReferences(obj.left));
      refs.push(...this.extractJoinReferences(obj.right));
    }

    return refs;
  }
}
