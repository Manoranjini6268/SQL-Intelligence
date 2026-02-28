// ──────────────────────────────────────────────
// Frontend Type Contracts
// ──────────────────────────────────────────────

export type ConnectorType = 'mysql' | 'postgres' | 'mongodb';

export interface ConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectorType: ConnectorType;
}

export interface ConnectionResponse {
  sessionId: string;
  connectorType: ConnectorType;
  database: string;
  host: string;
  port: number;
  capabilities: {
    readOnly: boolean;
    maxResultRows: number;
  };
  tables: {
    name: string;
    columnCount: number;
    primaryKeys: string[];
    foreignKeyCount: number;
  }[];
}

export interface TableInfo {
  name: string;
  columnCount: number;
  primaryKeys: string[];
  foreignKeyCount: number;
}

export interface QueryPlanResult {
  sql: string;
  explanation: string;
  tables_used: string[];
  confidence: number;
  validationVerdict: 'ACCEPT' | 'REJECT';
  validationReasons: string[];
  requiresApproval: boolean;
}

export interface QueryExecutionResult {
  sql: string;
  explanation: string;
  tables_used: string[];
  confidence: number;
  executionTime: number;
  rowCount: number;
  rows: Record<string, unknown>[];
  columns: string[];
  insight?: string;
}

export interface QueryAskResult {
  plan: QueryPlanResult;
  execution?: QueryExecutionResult;
}

export interface StreamEvent {
  type: 'explanation' | 'plan' | 'validation' | 'executing' | 'result' | 'error' | 'done';
  data: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  plan?: QueryPlanResult;
  execution?: QueryExecutionResult;
  isStreaming?: boolean;
}

export interface StructuredError {
  type: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ── Schema Topology ────────────────────────

export interface SchemaColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  nullable: boolean;
}

export interface SchemaForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface SchemaReferencedBy {
  fromTable: string;
  fromColumn: string;
  toColumn: string;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  primaryKeys: string[];
  foreignKeys: SchemaForeignKey[];
  referencedBy: SchemaReferencedBy[];
}

export interface SchemaTopology {
  database: string;
  hash: string;
  extractedAt: string;
  tables: SchemaTable[];
  relationships: { from: string; to: string }[];
  stats: {
    totalTables: number;
    totalColumns: number;
    totalRelationships: number;
  };
}
