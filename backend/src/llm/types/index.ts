// ──────────────────────────────────────────────
// LLM Types
// ──────────────────────────────────────────────

export interface LLMContext {
  systemPrompt: string;
  compressedSchema: string;
  conversationSummary: string | null;
  recentMessages: { role: 'user' | 'assistant'; content: string }[];
  userPrompt: string;
}

export interface LLMResponse {
  sql: string;
  explanation: string;
  tables_used: string[];
  confidence: number;
}

export interface LLMStreamChunk {
  type: 'explanation' | 'complete';
  content: string;
  data?: LLMResponse;
}
