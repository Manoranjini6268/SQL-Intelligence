// ──────────────────────────────────────────────
// Schema Types
// ──────────────────────────────────────────────

export interface CompressedSchema {
  database: string;
  tables: CompressedTable[];
  relationships: CompressedRelationship[];
}

export interface CompressedTable {
  name: string;
  columns: string; // comma-separated "name:type" pairs
  primaryKeys: string[];
}

export interface CompressedRelationship {
  from: string; // table.column
  to: string; // table.column
  type: 'foreign_key';
}

export interface JoinValidation {
  valid: boolean;
  reason?: string;
}
