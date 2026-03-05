// ──────────────────────────────────────────────
// Elasticsearch MCP Connector — Read-Only ES Access
// ──────────────────────────────────────────────
//
// Maps the MCP connector contract to Elasticsearch operations.
// All access is read-only: only _search, _cat, and _mapping APIs.
// Index mappings are translated to the SchemaMetadata contract
// so the rest of the system treats indices like tables.
//

import { Client, ClientOptions } from '@elastic/elasticsearch';
import {
  ConnectionParams,
  ConnectorCapabilities,
  ConnectorType,
  ESFieldMapping,
  SchemaMetadata,
  TableColumn,
  TableSchema,
} from '../../common/types';
import { MCPQueryResult, MCPToolResult } from '../types';
import { BaseMCPConnector } from './base.connector';

export class ElasticsearchConnector extends BaseMCPConnector {
  readonly connectorType = ConnectorType.ELASTICSEARCH;

  constructor() {
    super('ElasticsearchConnector');
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      readOnly: true,
      supportsTransactions: false,
      supportsSchemaIntrospection: true,
      maxResultRows: 500,
      supportedOperations: ['_search', '_count', '_msearch'],
    };
  }

  async testConnection(params: ConnectionParams): Promise<MCPToolResult<boolean>> {
    return this.executeWithResult(async () => {
      const client = this.createClient(params);
      try {
        const health = await client.cluster.health();
        if (health.status === 'red') {
          throw new Error(`Cluster health is RED — ${health.cluster_name}`);
        }
        this.logger.log(
          `ES cluster: ${health.cluster_name}, status: ${health.status}, nodes: ${health.number_of_nodes}`,
        );
        return true;
      } finally {
        await client.close();
      }
    });
  }

  async describeSchema(params: ConnectionParams): Promise<MCPToolResult<SchemaMetadata>> {
    return this.executeWithResult(async () => {
      const client = this.createClient(params);
      try {
        // Use the 'database' field as the index pattern (e.g., 'logs-*', 'my-index', or '*')
        const indexPattern = params.database || '*';

        // Get all matching indices
        const catResult = await client.cat.indices({
          index: indexPattern,
          format: 'json',
          h: 'index,docs.count,store.size,status,health',
        });

        // Filter out system/hidden indices (those starting with '.')
        const catEntries = (catResult as Array<Record<string, string>>)
          .filter((idx) => !idx.index?.startsWith('.'));
        const indices = catEntries.map((idx) => idx.index!).filter(Boolean);

        // Map index name → doc count from cat/indices response
        const docCountMap = new Map<string, number>();
        for (const entry of catEntries) {
          if (entry.index && entry['docs.count']) {
            docCountMap.set(entry.index, parseInt(entry['docs.count'], 10) || 0);
          }
        }

        if (indices.length === 0) {
          throw new Error(`No indices found matching pattern: ${indexPattern}`);
        }

        // Get mappings for all discovered indices
        const mappings = await client.indices.getMapping({
          index: indices.join(','),
        });

        const tableSchemas: TableSchema[] = [];

        for (const [indexName, mapping] of Object.entries(mappings)) {
          const properties = (mapping as any).mappings?.properties || {};
          const fields = this.flattenMappings(properties, '');
          const columns = this.fieldsToColumns(fields);

          // Detect time field
          const timeField = this.inferTimeField(fields);

          tableSchemas.push({
            name: indexName,
            columns,
            primaryKeys: ['_id'], // ES documents always have _id
            foreignKeys: [], // ES has no foreign key concept
            indexes: timeField
              ? [{ name: 'time_field', columns: [timeField], unique: false }]
              : [],
            rowCountEstimate: docCountMap.get(indexName),
          });
        }

        return {
          database: indexPattern,
          connectorType: ConnectorType.ELASTICSEARCH,
          tables: tableSchemas,
          extractedAt: new Date(),
        };
      } finally {
        await client.close();
      }
    });
  }

  /**
   * Execute an Elasticsearch search query.
   * The 'sql' parameter contains either:
   * - A JSON string of the ES DSL query body
   * - A JSON string with { index, body } for multi-index queries
   */
  async executeReadQuery(
    params: ConnectionParams,
    queryJson: string,
    timeoutMs: number,
  ): Promise<MCPToolResult<MCPQueryResult>> {
    return this.executeWithResult(async () => {
      const client = this.createClient(params);
      try {
        let parsedQuery: Record<string, unknown>;
        try {
          parsedQuery = JSON.parse(queryJson);
        } catch {
          throw new Error('Invalid query: expected valid JSON DSL');
        }

        // ── Multi-step cross-index query ─────────────────────────────
        if (parsedQuery._steps && Array.isArray(parsedQuery._steps)) {
          const merged = await this.executeMultiStepQuery(
            client,
            parsedQuery._steps as Array<Record<string, unknown>>,
            params,
            timeoutMs,
          );
          return {
            rows: merged.rows,
            columns: merged.columns,
            rowCount: merged.rows.length,
            executionTimeMs: 0,
            totalHits: merged.rows.length,
          };
        }

        // ── Single-index query ───────────────────────────────────────
        // Determine target index and query body
        let targetIndex: string;
        let queryBody: Record<string, unknown>;

        if (parsedQuery._index) {
          // Explicit index specified; supports comma-separated multi-index ("idx1,idx2")
          targetIndex = parsedQuery._index as string;
          const { _index: _, ...rest } = parsedQuery;
          queryBody = rest;
        } else {
          // Use the default index pattern from connection
          targetIndex = params.database || '*';
          queryBody = parsedQuery;
        }

        // Enforce size limit — preserve size:0 for aggregation-only queries
        if (queryBody.size === undefined || queryBody.size === null) {
          queryBody.size = 500;
        } else if ((queryBody.size as number) > 500) {
          queryBody.size = 500;
        }
        // size: 0 is intentional for aggregation-only queries — do NOT override

        // Execute the search with timeout
        const result = await Promise.race([
          client.search(
            {
              index: targetIndex,
              body: queryBody,
            },
            { requestTimeout: timeoutMs },
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Query execution timeout')), timeoutMs),
          ),
        ]);

        // Extract hits and convert to tabular format
        const hits = (result as any).hits?.hits || [];
        const aggregations = (result as any).aggregations;
        const totalHitsValue =
          typeof (result as any).hits?.total === 'number'
            ? (result as any).hits.total
            : (result as any).hits?.total?.value ?? 0;

        let rows: Record<string, unknown>[];
        let columns: string[];

        if (aggregations && Object.keys(aggregations).length > 0) {
          // Handle aggregation results — flatten to tabular format
          const { aggRows, aggColumns } = this.flattenAggregations(aggregations);
          rows = aggRows;
          columns = aggColumns;
        } else if (hits.length === 0 && queryBody.size === 0) {
          // Pure document-count query (size:0, no aggs) — synthesize a count row
          // so the result isn't empty. totalHitsValue holds the real count.
          rows = [{ document_count: totalHitsValue }];
          columns = ['document_count'];
        } else {
          // Handle regular search hits
          rows = hits.map((hit: any) => {
            const source = hit._source || {};
            return {
              _id: hit._id,
              _index: hit._index,
              _score: hit._score,
              ...this.flattenObject(source),
            };
          });

          // Derive columns from all rows
          const columnSet = new Set<string>();
          rows.forEach((row) => Object.keys(row).forEach((k) => columnSet.add(k)));
          columns = Array.from(columnSet);
        }

        return {
          rows,
          columns,
          rowCount: rows.length,
          executionTimeMs: 0, // Outer wrapper handles timing
          totalHits: totalHitsValue || rows.length,
        };
      } finally {
        await client.close();
      }
    });
  }

  async dispose(): Promise<void> {
    this.logger.log('Elasticsearch connector disposed');
  }

  // ── Private Helpers ──────────────────────────

  /**
   * Execute multiple independent ES queries and merge the results on a common key.
   * Used for cross-index analytics where a single query cannot span multiple indices
   * with incompatible mappings or different field paths.
   *
   * Each step may contain:
   *   _index   — target index (required)
   *   _label   — short label used as column prefix (e.g., "catalog", "orders")
   *   _join_key — column in THIS step's result to join on (defaults to first string col)
   *   + any valid ES search body (query, aggs, size, etc.)
   */
  private async executeMultiStepQuery(
    client: Client,
    steps: Array<Record<string, unknown>>,
    params: ConnectionParams,
    timeoutMs: number,
  ): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
    const stepResults: Array<{
      label: string;
      joinKey: string;
      rows: Record<string, unknown>[];
    }> = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const label = (step._label as string) || `step${i + 1}`;
      const joinKey = (step._join_key as string) || '';
      const stepIndex = (step._index as string) || params.database || '*';

      // Strip step-metadata fields from the query body
      const { _index, _label, _join_key, ...stepBody } = step;
      void _index; void _label; void _join_key; // silence unused warnings

      // Enforce size limit (preserve size:0 for agg-only steps)
      if ((stepBody as any).size === undefined || (stepBody as any).size === null) {
        (stepBody as any).size = 500;
      } else if ((stepBody.size as number) > 500) {
        (stepBody as any).size = 500;
      }

      const stepResult = await Promise.race([
        client.search({ index: stepIndex, body: stepBody }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Step ${i + 1} timeout`)), timeoutMs),
        ),
      ]);

      const aggs = (stepResult as any).aggregations;
      let stepRows: Record<string, unknown>[];

      if (aggs && Object.keys(aggs).length > 0) {
        const { aggRows } = this.flattenAggregations(aggs);
        stepRows = aggRows;
      } else {
        const hits = (stepResult as any).hits?.hits || [];
        stepRows = hits.map((hit: any) => ({
          ...this.flattenObject(hit._source || {}),
        }));
      }

      this.logger.log(`Multi-step [${label}] → ${stepRows.length} rows from ${stepIndex}`);
      stepResults.push({ label, joinKey, rows: stepRows });
    }

    return this.mergeStepResults(stepResults);
  }

  /**
   * Merge tabular results from multiple steps on a common key column.
   * Non-join-key columns are prefixed with the step label to prevent collisions.
   */
  private mergeStepResults(
    steps: Array<{ label: string; joinKey: string; rows: Record<string, unknown>[] }>,
  ): { rows: Record<string, unknown>[]; columns: string[] } {
    if (steps.length === 0) return { rows: [], columns: [] };
    if (steps.length === 1) {
      const { rows } = steps[0];
      return { rows, columns: rows.length > 0 ? Object.keys(rows[0]) : [] };
    }

    // Identify the join column in each step (first string-valued column)
    const stepJoinCols: string[] = steps.map((s) => {
      if (!s.rows.length) return '';
      const firstRow = s.rows[0];
      if (s.joinKey && Object.prototype.hasOwnProperty.call(firstRow, s.joinKey)) {
        return s.joinKey;
      }
      return (
        Object.keys(firstRow).find((k) => typeof firstRow[k] === 'string') ||
        Object.keys(firstRow)[0] ||
        ''
      );
    });

    // The canonical join key column name comes from the first step
    const joinColName = stepJoinCols[0] || 'key';

    // Build merge map: joinValue → merged row
    const mergeMap = new Map<string, Record<string, unknown>>();
    const columnSet = new Set<string>([joinColName]);

    for (let i = 0; i < steps.length; i++) {
      const { label, rows } = steps[i];
      const joinCol = stepJoinCols[i];

      for (const row of rows) {
        const keyVal = String(row[joinCol] ?? '');
        if (!mergeMap.has(keyVal)) {
          mergeMap.set(keyVal, { [joinColName]: keyVal });
        }
        const merged = mergeMap.get(keyVal)!;

        for (const [col, val] of Object.entries(row)) {
          if (col === joinCol) continue;
          const colName = `${label}_${col}`;
          merged[colName] = val;
          columnSet.add(colName);
        }
      }
    }

    const rows = Array.from(mergeMap.values());
    const columns = Array.from(columnSet);
    return { rows, columns };
  }


  /**
   * Create an Elasticsearch client from ConnectionParams.
   *
   * Mapping:
   * - host → ES endpoint hostname
   * - port → ES port (default 9200)
   * - username → Basic auth username (empty = no auth / API key mode)
   * - password → Basic auth password or API key
   * - database → Default index pattern
   */
  private createClient(params: ConnectionParams): Client {
    const protocol = params.port === 443 ? 'https' : 'http';
    const node = `${protocol}://${params.host}:${params.port}`;

    const options: ClientOptions = {
      node,
      requestTimeout: 15000,
      maxRetries: 1,
    };

    // Auth: if username is provided, use basic auth; otherwise try API key
    if (params.username && params.username !== '' && params.username !== 'apikey') {
      options.auth = {
        username: params.username,
        password: params.password,
      };
    } else if (params.password) {
      // API key auth — password field holds the API key
      options.auth = {
        apiKey: params.password,
      };
    }

    // Disable TLS verification in development for self-signed certs
    if (protocol === 'https') {
      options.tls = { rejectUnauthorized: false };
    }

    return new Client(options);
  }

  /**
   * Recursively flatten ES mapping properties to ESFieldMapping array.
   * Handles nested objects, multi-fields, and deep structures.
   */
  private flattenMappings(
    properties: Record<string, any>,
    parentPath: string,
  ): ESFieldMapping[] {
    const fields: ESFieldMapping[] = [];

    for (const [name, mapping] of Object.entries(properties)) {
      const path = parentPath ? `${parentPath}.${name}` : name;
      const type = mapping.type || 'object';
      const isNested = type === 'nested';

      const field: ESFieldMapping = {
        name,
        type,
        path,
        isNested,
      };

      // Multi-fields (e.g., text field with .keyword sub-field)
      if (mapping.fields) {
        field.fields = {};
        for (const [subName, subMapping] of Object.entries(mapping.fields)) {
          field.fields[subName] = { type: (subMapping as any).type };
        }
      }

      fields.push(field);

      // Recurse into nested/object properties
      if (mapping.properties) {
        const subFields = this.flattenMappings(mapping.properties, path);
        fields.push(...subFields);
      }
    }

    return fields;
  }

  /**
   * Convert ES field mappings to the TableColumn contract
   * so the rest of the system can treat ES like a database.
   */
  private fieldsToColumns(fields: ESFieldMapping[]): TableColumn[] {
    return fields.map((f) => ({
      name: f.path, // Use full dot-path as column name
      type: f.type,
      nullable: true, // ES fields are always optional
      isPrimaryKey: f.path === '_id',
      defaultValue: null,
      comment: f.isNested
        ? 'nested object'
        : f.fields
          ? `multi-field: ${Object.keys(f.fields).join(', ')}`
          : undefined,
    }));
  }

  /**
   * Infer the primary time field from mappings.
   * Checks for @timestamp, timestamp, created_at, date, etc.
   */
  private inferTimeField(fields: ESFieldMapping[]): string | undefined {
    const dateFields = fields.filter(
      (f) => f.type === 'date' || f.type === 'date_nanos',
    );

    if (dateFields.length === 0) return undefined;

    // Priority: @timestamp > timestamp > date > first date field
    const priorities = ['@timestamp', 'timestamp', 'date', 'created_at', 'createdAt'];
    for (const name of priorities) {
      const found = dateFields.find(
        (f) => f.path === name || f.path.endsWith(`.${name}`),
      );
      if (found) return found.path;
    }

    return dateFields[0].path;
  }

  /**
   * Flatten a nested object to dot-notation keys for tabular output.
   * { a: { b: 1 } } → { "a.b": 1 }
   */
  private flattenObject(
    obj: Record<string, unknown>,
    prefix = '',
    maxDepth = 3,
    depth = 0,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        depth < maxDepth
      ) {
        Object.assign(
          result,
          this.flattenObject(value as Record<string, unknown>, fullKey, maxDepth, depth + 1),
        );
      } else if (Array.isArray(value)) {
        // Handle arrays: primitives → join, objects → JSON.stringify
        if (value.length === 0) {
          result[fullKey] = '[]';
        } else if (typeof value[0] === 'object' && value[0] !== null) {
          result[fullKey] = JSON.stringify(value);
        } else {
          result[fullKey] = value.join(', ');
        }
      } else {
        result[fullKey] = value;
      }
    }

    return result;
  }

  /**
   * Flatten ES aggregation results into tabular format.
   *
   * Handles:
   * - Bucket aggs: terms, date_histogram, histogram, range, date_range, filters
   * - Metric aggs: sum, avg, min, max, value_count, cardinality, stats, extended_stats, percentiles
   * - Wrapper aggs: nested, reverse_nested, filter, global (unwrapped transparently)
   * - Nested bucket sub-aggs inside buckets (recursive)
   * - top_hits (embedded docs)
   * - composite aggs (after_key + buckets)
   * - Multi-value keys (composite)
   */
  private flattenAggregations(
    aggregations: Record<string, any>,
  ): { aggRows: Record<string, unknown>[]; aggColumns: string[] } {
    const rows: Record<string, unknown>[] = [];
    const columnSet = new Set<string>();

    this.walkAggs(aggregations, {}, rows, columnSet);

    return { aggRows: rows, aggColumns: Array.from(columnSet) };
  }

  /**
   * Recursively walk an aggregation result tree, collecting tabular rows.
   * `parentRow` carries columns accumulated from outer bucket levels.
   */
  private walkAggs(
    aggs: Record<string, any>,
    parentRow: Record<string, unknown>,
    rows: Record<string, unknown>[],
    columnSet: Set<string>,
  ): void {
    // Separate entries into wrappers, buckets, and metrics
    for (const [aggName, aggResult] of Object.entries(aggs)) {
      if (aggResult == null || typeof aggResult !== 'object') continue;

      // ── Wrapper aggs (nested, reverse_nested, filter, global) ──
      // These have a doc_count and inner sub-aggs but NO buckets array.
      if (this.isWrapperAgg(aggResult)) {
        const innerAggs = this.extractSubAggs(aggResult);
        if (Object.keys(innerAggs).length > 0) {
          this.walkAggs(innerAggs, parentRow, rows, columnSet);
        }
        continue;
      }

      // ── Bucket aggs (terms, date_histogram, histogram, range, etc.) ──
      // Also covers composite aggs (which have Array buckets + after_key)
      if (Array.isArray(aggResult.buckets)) {
        for (const bucket of aggResult.buckets) {
          const row: Record<string, unknown> = { ...parentRow };

          // Composite agg: bucket.key is an object { field1: val, field2: val }
          if (bucket.key && typeof bucket.key === 'object' && !Array.isArray(bucket.key)) {
            Object.assign(row, bucket.key as Record<string, unknown>);
          } else {
            row[aggName] = this.formatBucketKey(bucket);
          }
          row.doc_count = bucket.doc_count;

          // Collect metric sub-aggs and detect child bucket sub-aggs
          const childBucketAggs: Record<string, any> = {};

          for (const [subKey, subVal] of Object.entries(bucket)) {
            if (!subVal || typeof subVal !== 'object') continue;
            if (['key', 'key_as_string', 'doc_count', 'from', 'to', 'from_as_string', 'to_as_string'].includes(subKey)) continue;

            const sub = subVal as any;

            // Wrapper sub-aggs inside buckets (nested, filter, etc.)
            if (this.isWrapperAgg(sub)) {
              const innerAggs = this.extractSubAggs(sub);
              // Merge inner metric results into this row
              for (const [innerName, innerVal] of Object.entries(innerAggs)) {
                if (innerVal && typeof innerVal === 'object') {
                  if ((innerVal as any).buckets) {
                    childBucketAggs[innerName] = innerVal;
                  } else {
                    this.mergeSingleAgg(row, innerName, innerVal);
                  }
                }
              }
              continue;
            }

            // Bucket sub-agg inside a bucket (will need recursive walk)
            if (sub.buckets) {
              childBucketAggs[subKey] = sub;
              continue;
            }

            // top_hits sub-agg
            if (sub.hits && sub.hits.hits) {
              const topDocs = sub.hits.hits.map((h: any) => this.flattenObject(h._source || {}));
              if (topDocs.length > 0) {
                row[subKey] = JSON.stringify(topDocs.slice(0, 3));
              }
              continue;
            }

            // Metric / stats / percentiles sub-agg
            this.mergeSingleAgg(row, subKey, sub);
          }

          // If there are child bucket sub-aggs, recurse — each child bucket generates its own rows
          if (Object.keys(childBucketAggs).length > 0) {
            this.walkAggs(childBucketAggs, row, rows, columnSet);
          } else {
            // Leaf bucket — emit a row
            Object.keys(row).forEach((k) => columnSet.add(k));
            rows.push(row);
          }
        }
        continue;
      }

      // ── Named-bucket `filters` agg (buckets is an OBJECT, not array) ──
      // e.g. { buckets: { "high_value": { doc_count: 10, ... }, "low_value": { doc_count: 5, ... } } }
      if (
        aggResult.buckets &&
        typeof aggResult.buckets === 'object' &&
        !Array.isArray(aggResult.buckets)
      ) {
        for (const [filterName, filterBucket] of Object.entries(
          aggResult.buckets as Record<string, any>,
        )) {
          if (!filterBucket || typeof filterBucket !== 'object') continue;
          const row: Record<string, unknown> = {
            ...parentRow,
            [aggName]: filterName,
            doc_count: filterBucket.doc_count,
          };

          const childBucketAggs: Record<string, any> = {};
          for (const [subKey, subVal] of Object.entries(filterBucket)) {
            if (subKey === 'doc_count' || subKey === 'doc_count_error_upper_bound') continue;
            if (!subVal || typeof subVal !== 'object') continue;
            const sub = subVal as any;
            if (this.isWrapperAgg(sub)) {
              const innerAggs = this.extractSubAggs(sub);
              for (const [innerName, innerVal] of Object.entries(innerAggs)) {
                if (innerVal && typeof innerVal === 'object') {
                  if ((innerVal as any).buckets) {
                    childBucketAggs[innerName] = innerVal;
                  } else {
                    this.mergeSingleAgg(row, innerName, innerVal);
                  }
                }
              }
              continue;
            }
            if (sub.buckets) {
              childBucketAggs[subKey] = sub;
              continue;
            }
            this.mergeSingleAgg(row, subKey, sub);
          }

          if (Object.keys(childBucketAggs).length > 0) {
            this.walkAggs(childBucketAggs, row, rows, columnSet);
          } else {
            Object.keys(row).forEach((k) => columnSet.add(k));
            rows.push(row);
          }
        }
        continue;
      }

      // ── Single metric / stats / percentiles at top level ──
      if (aggResult.value !== undefined) {
        const row: Record<string, unknown> = {
          ...parentRow,
          metric: aggName,
          value: aggResult.value ?? 0,
        };
        if (aggResult.value_as_string) row.value_formatted = aggResult.value_as_string;
        Object.keys(row).forEach((k) => columnSet.add(k));
        rows.push(row);
        continue;
      }

      if (aggResult.count !== undefined && aggResult.avg !== undefined) {
        // stats / extended_stats
        const row: Record<string, unknown> = {
          ...parentRow,
          metric: aggName,
          count: aggResult.count,
          min: aggResult.min,
          max: aggResult.max,
          avg: aggResult.avg,
          sum: aggResult.sum,
        };
        if (aggResult.std_deviation !== undefined) row.std_deviation = aggResult.std_deviation;
        if (aggResult.variance !== undefined) row.variance = aggResult.variance;
        Object.keys(row).forEach((k) => columnSet.add(k));
        rows.push(row);
        continue;
      }

      if (aggResult.values !== undefined && typeof aggResult.values === 'object') {
        // percentiles or percentile_ranks
        const row: Record<string, unknown> = { ...parentRow, metric: aggName };
        for (const [pctKey, pctVal] of Object.entries(aggResult.values as Record<string, unknown>)) {
          row[`p${pctKey}`] = pctVal;
        }
        Object.keys(row).forEach((k) => columnSet.add(k));
        rows.push(row);
        continue;
      }

      // ── Top-level top_hits — flatten embedded documents ──
      if (aggResult.hits && aggResult.hits.hits && Array.isArray(aggResult.hits.hits)) {
        for (const hit of aggResult.hits.hits) {
          const source = hit._source || {};
          const row: Record<string, unknown> = {
            ...parentRow,
            ...this.flattenObject(source),
          };
          if (hit._id) row._id = hit._id;
          if (hit._score !== null && hit._score !== undefined) row._score = hit._score;
          Object.keys(row).forEach((k) => columnSet.add(k));
          rows.push(row);
        }
        continue;
      }

      // ── Orphan doc_count — single-bucket agg (filter, global, missing) with no sub-aggs ──
      if (typeof aggResult.doc_count === 'number') {
        const row: Record<string, unknown> = {
          ...parentRow,
          metric: aggName,
          doc_count: aggResult.doc_count,
        };
        Object.keys(row).forEach((k) => columnSet.add(k));
        rows.push(row);
        continue;
      }
    }
  }

  /**
   * Detect wrapper aggregations (nested, reverse_nested, filter, global).
   * These have doc_count but NO buckets array; their real content is in sub-aggs.
   */
  private isWrapperAgg(agg: any): boolean {
    if (!agg || typeof agg !== 'object') return false;
    // Has doc_count, no buckets, and at least one sub-key that is an object with value/buckets/doc_count
    if (typeof agg.doc_count !== 'number') return false;
    if (agg.buckets) return false;
    const subKeys = Object.keys(agg).filter((k) => k !== 'doc_count' && k !== 'meta');
    return subKeys.some((k) => agg[k] && typeof agg[k] === 'object');
  }

  /**
   * Extract the inner sub-aggregations from a wrapper agg result.
   */
  private extractSubAggs(wrapper: any): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(wrapper)) {
      if (key === 'doc_count' || key === 'meta') continue;
      if (val && typeof val === 'object') {
        result[key] = val;
      }
    }
    return result;
  }

  /**
   * Merge a single metric/stats/percentiles agg result into a row.
   */
  private mergeSingleAgg(row: Record<string, unknown>, name: string, agg: any): void {
    if (agg.value !== undefined) {
      row[name] = agg.value ?? 0;
    } else if (agg.count !== undefined && agg.avg !== undefined) {
      // stats / extended_stats
      row[`${name}_avg`] = agg.avg;
      row[`${name}_min`] = agg.min;
      row[`${name}_max`] = agg.max;
      row[`${name}_sum`] = agg.sum;
      row[`${name}_count`] = agg.count;
    } else if (agg.values && typeof agg.values === 'object') {
      // percentiles
      for (const [pctKey, pctVal] of Object.entries(agg.values as Record<string, unknown>)) {
        row[`${name}_p${pctKey}`] = pctVal;
      }
    } else if (agg.doc_count !== undefined) {
      // single-bucket sub-agg like filter
      row[`${name}_doc_count`] = agg.doc_count;
    }
  }

  /**
   * Format a bucket key for human-readable display.
   * Handles date_histogram ISO strings, range buckets, and composite keys.
   */
  private formatBucketKey(bucket: any): string | number {
    if (bucket.key_as_string) {
      // Clean up ISO dates: "2024-03-07T00:00:00.000Z" → "2024-03-07"
      const k = bucket.key_as_string as string;
      if (/^\d{4}-\d{2}-\d{2}T00:00:00/.test(k)) return k.substring(0, 10);
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(k)) return k.replace('T', ' ').replace(/\.000Z?$/, '');
      return k;
    }
    // Range bucket
    if (bucket.from !== undefined || bucket.to !== undefined) {
      const from = bucket.from_as_string ?? bucket.from ?? '*';
      const to = bucket.to_as_string ?? bucket.to ?? '*';
      return `${from}–${to}`;
    }
    return bucket.key;
  }
}
