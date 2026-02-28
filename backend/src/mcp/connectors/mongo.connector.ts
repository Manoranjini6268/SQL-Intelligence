// ──────────────────────────────────────────────
// MongoDB MCP Connector — Read-Only Aggregation
// ──────────────────────────────────────────────

import { MongoClient, Document } from 'mongodb';
import {
  ConnectionParams,
  ConnectorCapabilities,
  ConnectorType,
  SchemaMetadata,
  TableColumn,
  TableSchema,
} from '../../common/types';
import { MCPQueryResult, MCPToolResult } from '../types';
import { BaseMCPConnector } from './base.connector';

export class MongoDBConnector extends BaseMCPConnector {
  readonly connectorType = ConnectorType.MONGODB;

  constructor() {
    super('MongoDBConnector');
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      readOnly: true,
      supportsTransactions: false,
      supportsSchemaIntrospection: true,
      maxResultRows: 500,
      supportedOperations: ['AGGREGATE', 'FIND'],
    };
  }

  async testConnection(params: ConnectionParams): Promise<MCPToolResult<boolean>> {
    return this.executeWithResult(async () => {
      const client = this.createClient(params);
      try {
        await client.connect();
        await client.db(params.database).command({ ping: 1 });
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
        await client.connect();
        const db = client.db(params.database);
        const collections = await db.listCollections().toArray();
        const tableSchemas: TableSchema[] = [];

        for (const col of collections) {
          const collection = db.collection(col.name);
          // Sample documents to infer schema
          const sample = await collection.find().limit(100).toArray();
          const columns = this.inferColumnsFromDocuments(sample);

          tableSchemas.push({
            name: col.name,
            columns,
            primaryKeys: ['_id'],
            foreignKeys: [],
            indexes: [],
          });
        }

        return {
          database: params.database,
          connectorType: ConnectorType.MONGODB,
          tables: tableSchemas,
          extractedAt: new Date(),
        };
      } finally {
        await client.close();
      }
    });
  }

  async executeReadQuery(
    params: ConnectionParams,
    sql: string,
    timeoutMs: number,
  ): Promise<MCPToolResult<MCPQueryResult>> {
    return this.executeWithResult(async () => {
      // For MongoDB, "sql" is expected to be a JSON string describing the aggregation
      // Format: { "collection": "name", "pipeline": [...] }
      let queryDef: { collection: string; pipeline: Document[] };
      try {
        queryDef = JSON.parse(sql);
      } catch {
        throw new Error('MongoDB queries must be JSON format: { collection, pipeline }');
      }

      const client = this.createClient(params);
      try {
        await client.connect();
        const db = client.db(params.database);
        const collection = db.collection(queryDef.collection);

        // Add $limit to pipeline for safety
        const pipeline = [...queryDef.pipeline];
        const hasLimit = pipeline.some((stage) => '$limit' in stage);
        if (!hasLimit) {
          pipeline.push({ $limit: 500 });
        }

        const rows = await Promise.race([
          collection.aggregate(pipeline, { maxTimeMS: timeoutMs }).toArray(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Query execution timeout')), timeoutMs),
          ),
        ]);

        const columns =
          rows.length > 0 ? Object.keys(rows[0]).filter((k) => k !== '_id') : [];

        return {
          rows: rows.map((r) => {
            const clean: Record<string, unknown> = {};
            for (const key of Object.keys(r)) {
              clean[key] = r[key];
            }
            return clean;
          }),
          columns: ['_id', ...columns],
          rowCount: rows.length,
          executionTimeMs: 0,
        };
      } finally {
        await client.close();
      }
    });
  }

  async dispose(): Promise<void> {
    this.logger.log('MongoDB connector disposed');
  }

  // ── Private Helpers ──────────────────────────

  private createClient(params: ConnectionParams): MongoClient {
    const uri = `mongodb://${params.username}:${encodeURIComponent(params.password)}@${params.host}:${params.port}/${params.database}`;
    return new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
  }

  private inferColumnsFromDocuments(documents: Document[]): TableColumn[] {
    const fieldMap = new Map<string, { types: Set<string>; nullable: boolean }>();

    for (const doc of documents) {
      for (const [key, value] of Object.entries(doc)) {
        if (!fieldMap.has(key)) {
          fieldMap.set(key, { types: new Set(), nullable: false });
        }
        const field = fieldMap.get(key)!;
        if (value === null || value === undefined) {
          field.nullable = true;
        } else {
          field.types.add(typeof value);
        }
      }
    }

    return Array.from(fieldMap.entries()).map(([name, info]) => ({
      name,
      type: Array.from(info.types).join(' | ') || 'unknown',
      nullable: info.nullable,
      isPrimaryKey: name === '_id',
      defaultValue: null,
    }));
  }
}
