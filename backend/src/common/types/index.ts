// ──────────────────────────────────────────────
// Common Types — System-Wide Contracts
// ──────────────────────────────────────────────

/** Supported database connector types */
export enum ConnectorType {
  MYSQL = 'mysql',
  POSTGRES = 'postgres',
  MONGODB = 'mongodb',
}

/** Connection parameters collected from frontend */
export interface ConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectorType: ConnectorType;
}

/** Connection status */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/** MCP Connector capabilities */
export interface ConnectorCapabilities {
  readOnly: boolean;
  supportsTransactions: boolean;
  supportsSchemaIntrospection: boolean;
  maxResultRows: number;
  supportedOperations: string[];
}

/** Schema types */
export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string | null;
  comment?: string;
}

export interface ForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName: string;
}

export interface TableIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface TableSchema {
  name: string;
  columns: TableColumn[];
  primaryKeys: string[];
  foreignKeys: ForeignKey[];
  indexes: TableIndex[];
  rowCountEstimate?: number;
}

export interface SchemaMetadata {
  database: string;
  connectorType: ConnectorType;
  tables: TableSchema[];
  extractedAt: Date;
}

/** Validation result */
export enum ValidationVerdict {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export interface ValidationResult {
  verdict: ValidationVerdict;
  sql: string;
  reasons: string[];
  ast?: unknown;
}

/** LLM generation output */
export interface LLMGenerationResult {
  sql: string;
  explanation: string;
  tables_used: string[];
  confidence: number;
  reasoning?: string;
}

/** Query execution result — the system contract */
export interface QueryExecutionResult {
  sql: string;
  explanation: string;
  tables_used: string[];
  confidence: number;
  executionTime: number;
  rowCount: number;
  rows: Record<string, unknown>[];
  columns?: string[];
}

/** Structured error types */
export enum ErrorType {
  CONNECTION_FAILURE = 'ConnectionFailure',
  VALIDATION_REJECTION = 'ValidationRejection',
  EXECUTION_TIMEOUT = 'ExecutionTimeout',
  SCHEMA_MISMATCH = 'SchemaMismatch',
  LLM_FORMAT_VIOLATION = 'LLMFormatViolation',
  INTERNAL_ERROR = 'InternalError',
  UNAUTHORIZED = 'Unauthorized',
}

export interface StructuredError {
  type: ErrorType;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/** Memory types */
export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    sql?: string;
    tables_used?: string[];
    confidence?: number;
  };
}

export interface SessionMemory {
  sessionId: string;
  messages: MemoryMessage[];
  summary: string | null;
  referencedTables: Set<string>;
  previousQueries: string[];
  derivedMetrics: Map<string, string>;
  connectorId: string | null;
  createdAt: Date;
  lastAccessedAt: Date;
}

/** Audit log entry */
export interface AuditLogEntry {
  timestamp: Date;
  sessionId: string;
  prompt: string;
  generatedSql: string;
  validationResult: ValidationVerdict;
  validationReasons: string[];
  executionTimeMs?: number;
  rowCount?: number;
  schemaHash: string;
  connectorId: string;
}
