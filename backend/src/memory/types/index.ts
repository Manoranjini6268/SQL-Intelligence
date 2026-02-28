// ──────────────────────────────────────────────
// Memory Types
// ──────────────────────────────────────────────

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    sql?: string;
    tables_used?: string[];
    confidence?: number;
  };
}

export interface SessionState {
  sessionId: string;
  messages: StoredMessage[];
  summary: string | null;
  referencedTables: string[];
  previousQueries: string[];
  derivedMetrics: Record<string, string>;
  connectorId: string | null;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface ContextWindow {
  summary: string | null;
  recentMessages: { role: 'user' | 'assistant'; content: string }[];
}
