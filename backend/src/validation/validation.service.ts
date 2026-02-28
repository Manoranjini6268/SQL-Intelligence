// ──────────────────────────────────────────────
// Validation Service — SQL AST Validation Engine
// ──────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { Parser } from 'node-sql-parser';
import { SchemaGraph } from '../schema/schema-graph';
import { ValidationRule, FullValidationResult } from './types';
import {
  SelectOnlyRule,
  SingleStatementRule,
  LimitRequiredRule,
  NoCommentsRule,
  NoUnionRule,
  SubqueryDepthRule,
  TableExistsRule,
  ColumnExistsRule,
  JoinValidationRule,
} from './rules';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);
  private readonly parser: Parser;
  private readonly rules: ValidationRule[];

  constructor() {
    this.parser = new Parser();

    // Rule execution order matters — cheapest checks first
    this.rules = [
      new SingleStatementRule(),
      new NoCommentsRule(),
      new SelectOnlyRule(),
      new NoUnionRule(),
      new LimitRequiredRule(),
      new SubqueryDepthRule(),
      new TableExistsRule(),
      new ColumnExistsRule(),
      new JoinValidationRule(),
    ];

    this.logger.log(`Validation engine initialized with ${this.rules.length} rules`);
  }

  /**
   * Validate SQL through deterministic AST analysis.
   * Returns structured ACCEPT/REJECT — never repairs SQL.
   */
  validate(sql: string, schema?: SchemaGraph): FullValidationResult {
    let trimmedSql = sql.trim().replace(/;$/, '').trim();
    const reasons: string[] = [];
    const rulesChecked: string[] = [];

    // Step 1: Parse SQL to AST
    let ast: unknown;
    try {
      const parsed = this.parser.astify(trimmedSql, { database: 'MySQL' });
      ast = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      this.logger.warn(`SQL parse failed: ${message}`);
      return {
        verdict: 'REJECT',
        sql: trimmedSql,
        reasons: [`SQL parse error: ${message}`],
        rulesChecked: ['parse'],
      };
    }

    // Step 2: Run all validation rules
    for (const rule of this.rules) {
      rulesChecked.push(rule.name);

      try {
        const result = rule.validate(ast, trimmedSql, schema);
        if (!result.passed) {
          reasons.push(`[${rule.name}] ${result.reason}`);
        } else if (result.patchedSql) {
          // Rule auto-patched the SQL (e.g. injected LIMIT 500) — use patched version
          trimmedSql = result.patchedSql;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rule execution error';
        reasons.push(`[${rule.name}] Rule execution error: ${message}`);
      }
    }

    // Step 3: Produce verdict
    const verdict = reasons.length === 0 ? 'ACCEPT' : 'REJECT';

    if (verdict === 'REJECT') {
      this.logger.warn(`Validation REJECTED: ${reasons.join('; ')}`);
    } else {
      this.logger.log(`Validation ACCEPTED: ${trimmedSql.substring(0, 80)}...`);
    }

    return {
      verdict,
      sql: trimmedSql,
      reasons,
      rulesChecked,
      ast: verdict === 'ACCEPT' ? ast : undefined,
    };
  }

  /** Extract table names from validated SQL AST */
  extractTablesFromSQL(sql: string): string[] {
    try {
      const tableList = this.parser.tableList(sql, { database: 'MySQL' });
      // Format is "operation::database::table"
      return tableList.map((t: string) => {
        const parts = t.split('::');
        return parts[parts.length - 1];
      });
    } catch {
      return [];
    }
  }

  /** Get column list from validated SQL AST */
  extractColumnsFromSQL(sql: string): string[] {
    try {
      const columnList = this.parser.columnList(sql, { database: 'MySQL' });
      return columnList.map((c: string) => {
        const parts = c.split('::');
        return parts[parts.length - 1];
      });
    } catch {
      return [];
    }
  }
}
