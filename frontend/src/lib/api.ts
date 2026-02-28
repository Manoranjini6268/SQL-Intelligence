// ──────────────────────────────────────────────
// API Client — Backend Communication Layer
// ──────────────────────────────────────────────

import type {
  ConnectionParams,
  ConnectionResponse,
  QueryPlanResult,
  QueryExecutionResult,
  QueryAskResult,
  StreamEvent,
  StructuredError,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

class APIError extends Error {
  constructor(
    public readonly status: number,
    public readonly structured: StructuredError,
  ) {
    super(structured.message);
    this.name = 'APIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let structured: StructuredError;
    try {
      structured = await response.json();
    } catch {
      structured = {
        type: 'InternalError',
        message: `HTTP ${response.status}: ${response.statusText}`,
        timestamp: new Date().toISOString(),
      };
    }
    throw new APIError(response.status, structured);
  }
  return response.json();
}

// ── Connection API ──────────────────────────

export async function testConnection(
  params: ConnectionParams,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/connection/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse(response);
}

export async function connect(params: ConnectionParams): Promise<ConnectionResponse> {
  const response = await fetch(`${API_BASE}/connection/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse(response);
}

export async function getConnectionStatus(
  sessionId: string,
): Promise<{ connected: boolean }> {
  const response = await fetch(`${API_BASE}/connection/status/${sessionId}`);
  return handleResponse(response);
}

export async function disconnect(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/connection/disconnect/${sessionId}`, {
    method: 'POST',
  });
}

// ── Query API ──────────────────────────────

export async function generatePlan(
  sessionId: string,
  prompt: string,
): Promise<QueryPlanResult> {
  const response = await fetch(`${API_BASE}/query/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, prompt }),
  });
  return handleResponse(response);
}

export async function executeQuery(
  sessionId: string,
  sql: string,
  prompt?: string,
): Promise<QueryExecutionResult> {
  const response = await fetch(`${API_BASE}/query/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, sql, approved: true, prompt }),
  });
  return handleResponse(response);
}

export async function ask(
  sessionId: string,
  prompt: string,
): Promise<QueryAskResult> {
  const response = await fetch(`${API_BASE}/query/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, prompt }),
  });
  return handleResponse(response);
}

export async function* streamQuery(
  sessionId: string,
  prompt: string,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, prompt }),
  });

  if (!response.ok) {
    throw new Error(`Stream failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          const event = JSON.parse(trimmed.slice(6)) as StreamEvent;
          yield event;
        } catch {
          // Skip malformed events
        }
      }
    }
  }
}

export async function getQueryHistory(
  sessionId: string,
): Promise<{ queries: string[] }> {
  const response = await fetch(`${API_BASE}/query/history/${sessionId}`);
  return handleResponse(response);
}

export async function getSchema(
  sessionId: string,
): Promise<import('./types').SchemaTopology> {
  const response = await fetch(`${API_BASE}/connection/schema/${sessionId}`);
  return handleResponse(response);
}

export async function explainSchema(
  schemaSummary: string,
  databaseName: string,
): Promise<{ explanation: string }> {
  const response = await fetch(`${API_BASE}/query/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schemaSummary, databaseName }),
  });
  return handleResponse(response);
}

export { APIError };
