// ──────────────────────────────────────────────
// Base Connector — Abstract MCP Connector
// ──────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import {
  ConnectionParams,
  ConnectorCapabilities,
  ConnectorType,
  SchemaMetadata,
} from '../../common/types';
import { IMCPConnector, MCPQueryResult, MCPToolResult } from '../types';

export abstract class BaseMCPConnector implements IMCPConnector {
  protected readonly logger: Logger;
  abstract readonly connectorType: ConnectorType;

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  abstract testConnection(params: ConnectionParams): Promise<MCPToolResult<boolean>>;
  abstract describeSchema(params: ConnectionParams): Promise<MCPToolResult<SchemaMetadata>>;
  abstract executeReadQuery(
    params: ConnectionParams,
    sql: string,
    timeoutMs: number,
  ): Promise<MCPToolResult<MCPQueryResult>>;
  abstract getCapabilities(): ConnectorCapabilities;
  abstract dispose(): Promise<void>;

  /** Measure execution time of an async operation */
  protected async withTiming<T>(
    operation: () => Promise<T>,
  ): Promise<{ result: T; executionTimeMs: number }> {
    const start = performance.now();
    const result = await operation();
    const executionTimeMs = Math.round(performance.now() - start);
    return { result, executionTimeMs };
  }

  /** Wrap operation in MCPToolResult */
  protected async executeWithResult<T>(
    operation: () => Promise<T>,
  ): Promise<MCPToolResult<T>> {
    try {
      const { result, executionTimeMs } = await this.withTiming(operation);
      return { success: true, data: result, executionTimeMs };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown connector error';
      this.logger.error(`Connector operation failed: ${message}`);
      return { success: false, error: message, executionTimeMs: 0 };
    }
  }
}
