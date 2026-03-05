// ──────────────────────────────────────────────
// ES Rule: Size Limit — Enforce result size cap
// ──────────────────────────────────────────────
// Auto-patches: injects or clamps 'size' to 500 max.
// Also auto-patches date_histogram to add min_doc_count:1.

import { ESValidationRule, ESRuleResult } from '../types';

const MAX_SIZE = 500;

export class SizeLimitRule implements ESValidationRule {
  readonly name = 'size-limit';

  validate(dsl: Record<string, unknown>): ESRuleResult {
    let patched = { ...dsl };
    let wasPatched = false;

    const currentSize = patched.size as number | undefined;

    // If aggregation-only query (no hits needed), size=0 is fine
    if ((patched.aggs || patched.aggregations) && currentSize === 0) {
      // ok
    } else if (currentSize === undefined) {
      patched = { ...patched, size: MAX_SIZE };
      wasPatched = true;
    } else if (currentSize > MAX_SIZE) {
      patched = { ...patched, size: MAX_SIZE };
      wasPatched = true;
    } else if (currentSize < 0) {
      return {
        passed: false,
        reason: 'Query size cannot be negative',
      };
    }

    // Auto-patch date_histogram aggs to include min_doc_count: 1
    const aggObj = (patched.aggs || patched.aggregations) as Record<string, unknown> | undefined;
    if (aggObj) {
      const patchedAggs = this.patchDateHistograms(aggObj);
      if (patchedAggs) {
        if (patched.aggs) {
          patched = { ...patched, aggs: patchedAggs };
        } else {
          patched = { ...patched, aggregations: patchedAggs };
        }
        wasPatched = true;
      }
    }

    return wasPatched ? { passed: true, patchedDsl: patched } : { passed: true };
  }

  /**
   * Recursively patch date_histogram aggregations to include min_doc_count: 1
   * when not already present. This prevents returning hundreds of empty buckets.
   */
  private patchDateHistograms(aggs: Record<string, unknown>): Record<string, unknown> | null {
    let changed = false;
    const result: Record<string, unknown> = {};

    for (const [aggName, aggDef] of Object.entries(aggs)) {
      if (typeof aggDef !== 'object' || aggDef === null) {
        result[aggName] = aggDef;
        continue;
      }

      const aggObj = { ...(aggDef as Record<string, unknown>) };

      // Patch date_histogram if min_doc_count is missing
      if (aggObj.date_histogram && typeof aggObj.date_histogram === 'object') {
        const dh = aggObj.date_histogram as Record<string, unknown>;
        if (dh.min_doc_count === undefined) {
          aggObj.date_histogram = { ...dh, min_doc_count: 1 };
          changed = true;
        }
      }

      // Recurse into sub-aggregations
      const subAggs = (aggObj.aggs || aggObj.aggregations) as Record<string, unknown> | undefined;
      if (subAggs) {
        const patchedSub = this.patchDateHistograms(subAggs);
        if (patchedSub) {
          if (aggObj.aggs) aggObj.aggs = patchedSub;
          else aggObj.aggregations = patchedSub;
          changed = true;
        }
      }

      result[aggName] = aggObj;
    }

    return changed ? result : null;
  }
}
