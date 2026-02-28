// ──────────────────────────────────────────────
// MCP Types — JSON-RPC Protocol Contracts
// ──────────────────────────────────────────────

import {
  ConnectionParams,
  ConnectorCapabilities,
  SchemaMetadata,
  ConnectorType,
} from '../../common/types';

/** MCP Connector session state */
export interface MCPSession {
  sessionId: string;
  connectorId: string;
  connectorType: ConnectorType;
  params: Omit<ConnectionParams, 'password'>;
  capabilities: ConnectorCapabilities;
  isActive: boolean;
  createdAt: Date;
}

// ── JSON-RPC 2.0 Protocol Framing ──────────

/** JSON-RPC 2.0 Request envelope */
export interface MCPJsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 Success Response */
export interface MCPJsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: MCPJsonRpcError;
}

/** JSON-RPC 2.0 Error object */
export interface MCPJsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ── MCP Tool Protocol ──────────────────────

/** MCP tool definition (tools/list response) */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** MCP tools/list response payload */
export interface MCPToolsListResult {
  tools: MCPToolDefinition[];
}

/** MCP tools/call request parameters */
export interface MCPToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

/** MCP tools/call response payload */
export interface MCPToolCallResult<T = unknown> {
  content: Array<{
    type: 'text' | 'json';
    text?: string;
    json?: T;
  }>;
  isError?: boolean;
}

/** MCP Tool invocation result (internal) */
export interface MCPToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
}

/** MCP Query execution result */
export interface MCPQueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  executionTimeMs: number;
}

/** Base connector interface — every MCP connector must implement this */
export interface IMCPConnector {
  readonly connectorType: ConnectorType;

  testConnection(params: ConnectionParams): Promise<MCPToolResult<boolean>>;

  describeSchema(params: ConnectionParams): Promise<MCPToolResult<SchemaMetadata>>;

  executeReadQuery(
    params: ConnectionParams,
    sql: string,
    timeoutMs: number,
  ): Promise<MCPToolResult<MCPQueryResult>>;

  getCapabilities(): ConnectorCapabilities;

  dispose(): Promise<void>;
}
