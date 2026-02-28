// ──────────────────────────────────────────────
// Schema Service — Graph Lifecycle Management
// ──────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { SchemaMetadata } from '../common/types';
import { SchemaGraph } from './schema-graph';

@Injectable()
export class SchemaService {
  private readonly logger = new Logger(SchemaService.name);

  /** Session → SchemaGraph mapping */
  private readonly graphs: Map<string, SchemaGraph> = new Map();

  /** Build and store SchemaGraph for a session */
  buildGraph(sessionId: string, metadata: SchemaMetadata): SchemaGraph {
    const graph = new SchemaGraph(metadata);
    this.graphs.set(sessionId, graph);
    this.logger.log(
      `SchemaGraph built for session ${sessionId}: ${graph.getTableNames().length} tables, hash=${graph.getSchemaHash()}`,
    );
    return graph;
  }

  /** Get SchemaGraph for a session */
  getGraph(sessionId: string): SchemaGraph | undefined {
    return this.graphs.get(sessionId);
  }

  /** Remove SchemaGraph */
  removeGraph(sessionId: string): void {
    this.graphs.delete(sessionId);
    this.logger.log(`SchemaGraph removed for session ${sessionId}`);
  }

  /** Check if graph exists for session */
  hasGraph(sessionId: string): boolean {
    return this.graphs.has(sessionId);
  }

  /** Get compressed schema string for LLM context */
  getCompressedSchema(sessionId: string): string | null {
    const graph = this.graphs.get(sessionId);
    return graph ? graph.compressToString() : null;
  }

  /** Get schema hash for audit */
  getSchemaHash(sessionId: string): string | null {
    const graph = this.graphs.get(sessionId);
    return graph ? graph.getSchemaHash() : null;
  }

  /** Get full structured schema for the topology API */
  getStructuredSchema(sessionId: string) {
    const graph = this.graphs.get(sessionId);
    return graph ? graph.getStructuredSchema() : null;
  }
}
