// ──────────────────────────────────────────────
// useSession Hook — React State Binding
// ──────────────────────────────────────────────

'use client';

import { useSyncExternalStore, useCallback } from 'react';
import {
  getSessionState,
  subscribeToSession,
  setConnection,
  clearConnection,
  addMessage,
  updateLastMessage,
} from '@/lib/store';
import type { ConnectionResponse, ChatMessage } from '@/lib/types';

export function useSession() {
  const state = useSyncExternalStore(subscribeToSession, getSessionState, getSessionState);

  const connect = useCallback((connection: ConnectionResponse) => {
    setConnection(connection);
  }, []);

  const disconnect = useCallback(() => {
    clearConnection();
  }, []);

  const pushMessage = useCallback((message: ChatMessage) => {
    addMessage(message);
  }, []);

  const patchLastMessage = useCallback((update: Partial<ChatMessage>) => {
    updateLastMessage(update);
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    pushMessage,
    patchLastMessage,
  };
}
