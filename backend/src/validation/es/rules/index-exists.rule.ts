// ──────────────────────────────────────────────
// ES Rule: Index Exists — Target indices must exist in schema
// ──────────────────────────────────────────────

import { SchemaGraph } from '../../../schema/schema-graph';
import { ESValidationRule, ESRuleResult } from '../types';

export class IndexExistsRule implements ESValidationRule {
  readonly name = 'index-exists';

  validate(dsl: Record<string, unknown>, _raw: string, schema?: SchemaGraph): ESRuleResult {
    if (!schema) return { passed: true }; // Skip if no schema available

    // Check if _index is specified and exists
    const targetIndex = dsl._index as string | undefined;
    if (!targetIndex) return { passed: true }; // Will use default index pattern

    // Handle wildcard patterns — always pass
    if (targetIndex.includes('*') || targetIndex.includes('?')) {
      return { passed: true };
    }

    // Handle comma-separated indices
    const indices = targetIndex.split(',').map((i) => i.trim());
    const missingIndices = indices.filter((idx) => !schema.validateTableExists(idx));

    if (missingIndices.length > 0) {
      return {
        passed: false,
        reason: `Target indices not found: ${missingIndices.join(', ')}. Available: ${schema.getTableNames().join(', ')}`,
      };
    }

    return { passed: true };
  }
}
