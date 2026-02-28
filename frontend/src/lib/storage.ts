// ──────────────────────────────────────────────
// Storage Helpers — localStorage / sessionStorage
// ──────────────────────────────────────────────

import type { ConnectionParams, ConnectionResponse, ChatMessage } from './types';

const CONN_KEY = 'sqli_connection';
const PARAMS_KEY = 'sqli_params';
const MESSAGES_KEY = 'sqli_messages';
const SETTINGS_KEY = 'sqli_settings';

export interface PersistedSettings {
  showSQL: boolean;
  rowLimit?: number;
}

// ── Connection Persistence ──────────────────

export function saveConnection(connection: ConnectionResponse): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(CONN_KEY, JSON.stringify(connection)); } catch { /* noop */ }
}

export function loadConnection(): ConnectionResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONN_KEY);
    return raw ? (JSON.parse(raw) as ConnectionResponse) : null;
  } catch { return null; }
}

export function clearPersistedConnection(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONN_KEY);
  localStorage.removeItem(PARAMS_KEY);
  sessionStorage.removeItem(MESSAGES_KEY);
}

// ── Credential Persistence ──────────────────
// Stored locally for session restore after tab/browser refresh.
// This is a dev tool — credentials are plain-text localhost credentials.

export function saveParams(params: ConnectionParams): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PARAMS_KEY, JSON.stringify(params)); } catch { /* noop */ }
}

export function loadParams(): ConnectionParams | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PARAMS_KEY);
    return raw ? (JSON.parse(raw) as ConnectionParams) : null;
  } catch { return null; }
}

// ── Message Persistence (tab-scoped) ───────

export function saveMessages(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages)); } catch { /* noop */ }
}

export function loadMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp as string),
    })) as ChatMessage[];
  } catch { return []; }
}

// ── Settings Persistence ────────────────────

export function saveSettings(settings: PersistedSettings): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* noop */ }
}

export function loadSettings(): PersistedSettings {
  if (typeof window === 'undefined') return { showSQL: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { showSQL: true, ...JSON.parse(raw) } : { showSQL: true };
  } catch { return { showSQL: true }; }
}

// ── Connection History ──────────────────────

const CONN_HISTORY_KEY = 'sqli_conn_history';
const MAX_CONN_HISTORY = 5;

export interface ConnectionHistoryEntry {
  id: string;
  connectorType: string;
  host: string;
  port: number;
  username: string;
  database: string;
  savedAt: string;
}

export function saveConnectionHistory(params: ConnectionParams): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadConnectionHistory();
    // Remove duplicate (same host+port+db+user)
    const filtered = existing.filter(
      (e) =>
        !(
          e.host === params.host &&
          e.port === params.port &&
          e.database === params.database &&
          e.username === params.username
        ),
    );
    const entry: ConnectionHistoryEntry = {
      id: `${Date.now()}`,
      connectorType: params.connectorType ?? 'mysql',
      host: params.host,
      port: params.port,
      username: params.username,
      database: params.database,
      savedAt: new Date().toISOString(),
    };
    const updated = [entry, ...filtered].slice(0, MAX_CONN_HISTORY);
    localStorage.setItem(CONN_HISTORY_KEY, JSON.stringify(updated));
  } catch { /* noop */ }
}

export function loadConnectionHistory(): ConnectionHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CONN_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ConnectionHistoryEntry[]) : [];
  } catch { return []; }
}

// ── Pinned Queries ──────────────────────────

const PINNED_KEY = 'sqli_pinned';

export interface PinnedQuery {
  id: string;
  text: string;
  pinnedAt: string;
}

export function savePinnedQuery(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadPinnedQueries();
    if (existing.some((q) => q.text === text)) return; // no duplicate
    const entry: PinnedQuery = { id: `pin-${Date.now()}`, text, pinnedAt: new Date().toISOString() };
    localStorage.setItem(PINNED_KEY, JSON.stringify([entry, ...existing]));
  } catch { /* noop */ }
}

export function removePinnedQuery(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const updated = loadPinnedQueries().filter((q) => q.id !== id);
    localStorage.setItem(PINNED_KEY, JSON.stringify(updated));
  } catch { /* noop */ }
}

export function loadPinnedQueries(): PinnedQuery[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? (JSON.parse(raw) as PinnedQuery[]) : [];
  } catch { return []; }
}
