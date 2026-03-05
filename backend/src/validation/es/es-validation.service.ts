// ──────────────────────────────────────────────
// ES Validation Service — Elasticsearch DSL Validation Engine
// ──────────────────────────────────────────────
//
// Parallel to ValidationService (SQL), this engine validates
// Elasticsearch query DSL through deterministic rule evaluation.
// No query executes without passing all rules.
//

import { Injectable, Logger } from '@nestjs/common';
import { SchemaGraph } from '../../schema/schema-graph';
import { ESValidationRule, FullESValidationResult } from './types';
import {
  ValidJsonRule,
  SearchOnlyRule,
  NoPlaceholdersRule,
  IndexExistsRule,
  FieldExistsRule,
  SizeLimitRule,
  AggregationCorrectnessRule,
  QueryStructureRule,
  TimeRangeBoundedRule,
} from './rules';

@Injectable()
export class ESValidationService {
  private readonly logger = new Logger(ESValidationService.name);
  private readonly rules: ESValidationRule[];

  constructor() {
    // Rule execution order: cheapest checks first
    this.rules = [
      new ValidJsonRule(),
      new SearchOnlyRule(),
      new NoPlaceholdersRule(),
      new QueryStructureRule(),
      new SizeLimitRule(),
      new IndexExistsRule(),
      new FieldExistsRule(),
      new AggregationCorrectnessRule(),
      new TimeRangeBoundedRule(),
    ];

    this.logger.log(
      `ES Validation engine initialized with ${this.rules.length} rules`,
    );
  }

  /**
   * Validate Elasticsearch DSL through deterministic rule analysis.
   * Returns structured ACCEPT/REJECT verdict.
   * Handles both single-query and multi-step (_steps) formats.
   */
  validate(queryDslString: string, schema?: SchemaGraph): FullESValidationResult {
    const reasons: string[] = [];
    const rulesChecked: string[] = [];

    // Step 1: Parse JSON
    let dsl: Record<string, unknown>;
    try {
      dsl = JSON.parse(queryDslString);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      this.logger.warn(`ES DSL parse failed: ${message}`);
      return {
        verdict: 'REJECT',
        queryDsl: queryDslString,
        reasons: [`Invalid JSON: ${message}`],
        rulesChecked: ['json-parse'],
      };
    }

    // ── Multi-step query (_steps) ───────────────────────────────────
    if (dsl._steps && Array.isArray(dsl._steps)) {
      const steps = dsl._steps as Array<Record<string, unknown>>;

      if (steps.length < 2) {
        return {
          verdict: 'REJECT',
          queryDsl: queryDslString,
          reasons: ['Multi-step query must have at least 2 steps'],
          rulesChecked: ['multi-step-min-steps'],
        };
      }
      if (steps.length > 3) {
        return {
          verdict: 'REJECT',
          queryDsl: queryDslString,
          reasons: ['Multi-step query must not exceed 3 steps'],
          rulesChecked: ['multi-step-max-steps'],
        };
      }

      // Validate each step independently — run all applicable rules
      const stepRules = this.rules.filter((r) =>
        [
          'search-only',
          'no-placeholders',
          'query-structure',
          'size-limit',
          'index-exists',
          'field-exists',
          'aggregation-correctness',
          'time-range-bounded',
        ].includes(r.name),
      );

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step._index || typeof step._index !== 'string') {
          reasons.push(`Step ${i + 1} must have a string "_index" field`);
          continue;
        }
        // Strip metadata, validate the body
        const { _index, _label, _join_key, ...stepBody } = step;
        void _index; void _label; void _join_key;
        let currentStepBody = stepBody as Record<string, unknown>;
        let stepBodyStr = JSON.stringify(currentStepBody);

        for (const rule of stepRules) {
          try {
            const r = rule.validate(currentStepBody, stepBodyStr, schema);
            if (!r.passed) {
              reasons.push(`Step ${i + 1} [${rule.name}]: ${r.reason}`);
            } else if (r.patchedDsl) {
              // Apply patches (e.g. size limit, min_doc_count injection)
              currentStepBody = r.patchedDsl;
              stepBodyStr = JSON.stringify(currentStepBody);
              // Update the step in-place so the patched version is used
              Object.keys(step).forEach((k) => {
                if (!['_index', '_label', '_join_key'].includes(k)) delete step[k];
              });
              Object.assign(step, currentStepBody);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Rule error';
            reasons.push(`Step ${i + 1} [${rule.name}]: ${message}`);
          }
        }
        rulesChecked.push(`step-${i + 1}`);
      }

      const verdict = reasons.length === 0 ? 'ACCEPT' : 'REJECT';
      // Re-serialize the DSL since step bodies may have been patched (size limit, min_doc_count)
      const finalMultiStepDsl = JSON.stringify(dsl, null, 2);
      if (verdict === 'REJECT') {
        this.logger.warn(`ES Multi-step REJECTED: ${reasons.join('; ')}`);
      } else {
        this.logger.log(`ES Multi-step ACCEPTED: ${steps.length} steps`);
      }
      return { verdict, queryDsl: finalMultiStepDsl, reasons, rulesChecked, parsed: verdict === 'ACCEPT' ? dsl : undefined };
    }

    // ── Single-query validation ─────────────────────────────────────
    // Step 2: Run all validation rules
    for (const rule of this.rules) {
      rulesChecked.push(rule.name);

      try {
        const result = rule.validate(dsl, queryDslString, schema);
        if (!result.passed) {
          reasons.push(`[${rule.name}] ${result.reason}`);
        } else if (result.patchedDsl) {
          // Rule auto-patched the DSL (e.g., injected size limit)
          dsl = result.patchedDsl;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rule execution error';
        reasons.push(`[${rule.name}] Rule execution error: ${message}`);
      }
    }

    // Step 3: Update the serialized DSL with any patches
    const finalDsl = JSON.stringify(dsl, null, 2);

    // Step 4: Produce verdict
    const verdict = reasons.length === 0 ? 'ACCEPT' : 'REJECT';

    if (verdict === 'REJECT') {
      this.logger.warn(`ES Validation REJECTED: ${reasons.join('; ')}`);
    } else {
      this.logger.log(`ES Validation ACCEPTED: ${finalDsl.substring(0, 80)}...`);
    }

    return {
      verdict,
      queryDsl: finalDsl,
      reasons,
      rulesChecked,
      parsed: verdict === 'ACCEPT' ? dsl : undefined,
    };
  }

  /**
   * Extract target indices from an ES DSL query (single or multi-step).
   */
  extractIndicesFromDSL(queryDslString: string): string[] {
    try {
      const dsl = JSON.parse(queryDslString);
      // Multi-step format
      if (dsl._steps && Array.isArray(dsl._steps)) {
        const indices = new Set<string>();
        for (const step of dsl._steps as Array<Record<string, unknown>>) {
          if (step._index) {
            (step._index as string).split(',').forEach((i: string) => indices.add(i.trim()));
          }
        }
        return Array.from(indices);
      }
      // Single-index or comma-separated multi-index
      if (dsl._index) {
        return (dsl._index as string).split(',').map((i: string) => i.trim());
      }
      return [];
    } catch {
      return [];
    }
  }
}
