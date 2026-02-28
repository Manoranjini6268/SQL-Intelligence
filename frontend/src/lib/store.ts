// ──────────────────────────────────────────────
// Session Store — Client-Side Session State
// ──────────────────────────────────────────────

'use client';

// Module-level singleton store using useSyncExternalStore pattern.
// Hydrates initial state from localStorage on first load.

import type { ConnectionResponse, TableInfo, ChatMessage } from './types';
import {
  saveConnection,
  loadConnection,
  clearPersistedConnection,
  saveMessages,
  loadMessages,
} from './storage';

interface SessionState {
  sessionId: string | null;
  connection: ConnectionResponse | null;
  tables: TableInfo[];
  messages: ChatMessage[];
  isConnected: boolean;
}

function initState(): SessionState {
  const connection = loadConnection();
  if (connection) {
    return {
      sessionId: connection.sessionId,
      connection,
      tables: connection.tables,
      messages: loadMessages(),
      isConnected: true,
    };
  }
  return {
    sessionId: null,
    connection: null,
    tables: [],
    messages: [],
    isConnected: false,
  };
}

// Hydrate from localStorage on module load
let state: SessionState = initState();

const listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function getSessionState(): SessionState {
  return state;
}

export function setConnection(connection: ConnectionResponse) {
  state = {
    ...state,
    sessionId: connection.sessionId,
    connection,
    tables: connection.tables,
    isConnected: true,
  };
  saveConnection(connection);
  notify();
}

export function clearConnection() {
  state = {
    sessionId: null,
    connection: null,
    tables: [],
    messages: [],
    isConnected: false,
  };
  clearPersistedConnection();
  notify();
}

export function addMessage(message: ChatMessage) {
  state = {
    ...state,
    messages: [...state.messages, message],
  };
  saveMessages(state.messages);
  notify();
}

export function updateLastMessage(update: Partial<ChatMessage>) {
  const messages = [...state.messages];
  if (messages.length > 0) {
    messages[messages.length - 1] = { ...messages[messages.length - 1], ...update };
    state = { ...state, messages };
    saveMessages(state.messages);
    notify();
  }
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
