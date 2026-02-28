// ──────────────────────────────────────────────
// Connection Service — Orchestrates Connection Lifecycle
// ──────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectionParams,
  ConnectionStatus,
  ConnectorType,
  SchemaMetadata,
} from '../common/types';
import { MCPService } from '../mcp/mcp.service';
import { MCPSession } from '../mcp/types';
import { SchemaService } from '../schema/schema.service';

export interface ConnectionState {
  sessionId: string;
  status: ConnectionStatus;
  connectorType: ConnectorType;
  database: string;
  host: string;
  port: number;
  connectedAt: Date;
}

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);

  /** Active connection state by sessionId */
  private readonly connections: Map<string, ConnectionState> = new Map();

  constructor(
    private readonly mcpService: MCPService,
    private readonly schemaService: SchemaService,
  ) {}

  /** Test connection without persisting */
  async testConnection(params: ConnectionParams): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Testing connection: ${params.connectorType}@${params.host}:${params.port}`);

    const result = await this.mcpService.testConnection(params);

    return {
      success: result.success,
      message: result.success
        ? `Connection successful (${result.executionTimeMs}ms)`
        : `Connection failed: ${result.error}`,
    };
  }

  /** Establish connection — full pipeline */
  async connect(
    params: ConnectionParams,
  ): Promise<{ session: MCPSession; schema: SchemaMetadata }> {
    this.logger.log(`Connecting: ${params.connectorType}@${params.host}:${params.port}/${params.database}`);

    // 1. Create MCP session (tests connection, verifies read-only)
    const session = await this.mcpService.createSession(params);

    // 2. Retrieve schema metadata through MCP
    const schemaResult = await this.mcpService.describeSchema(session.sessionId);
    if (!schemaResult.success || !schemaResult.data) {
      await this.mcpService.destroySession(session.sessionId);
      throw new Error(`Schema retrieval failed: ${schemaResult.error}`);
    }

    // 3. Build SchemaGraph
    this.schemaService.buildGraph(session.sessionId, schemaResult.data);

    // 4. Store connection state
    this.connections.set(session.sessionId, {
      sessionId: session.sessionId,
      status: ConnectionStatus.CONNECTED,
      connectorType: params.connectorType,
      database: params.database,
      host: params.host,
      port: params.port,
      connectedAt: new Date(),
    });

    this.logger.log(
      `Connected successfully: ${session.sessionId} — ${schemaResult.data.tables.length} tables discovered`,
    );

    return { session, schema: schemaResult.data };
  }

  /** Get connection status */
  getStatus(sessionId: string): ConnectionState | null {
    return this.connections.get(sessionId) ?? null;
  }

  /** Get all active connections */
  getActiveConnections(): ConnectionState[] {
    return Array.from(this.connections.values()).filter(
      (c) => c.status === ConnectionStatus.CONNECTED,
    );
  }

  /** Disconnect */
  async disconnect(sessionId: string): Promise<void> {
    await this.mcpService.destroySession(sessionId);
    this.schemaService.removeGraph(sessionId);
    this.connections.delete(sessionId);
    this.logger.log(`Disconnected: ${sessionId}`);
  }
}
