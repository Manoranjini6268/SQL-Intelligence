// ──────────────────────────────────────────────
// Memory Service — Deterministic Session Memory Engine
// ──────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContextWindow, SessionState, StoredMessage } from './types';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  /** Session state store — keyed by sessionId */
  private readonly sessions: Map<string, SessionState> = new Map();

  private readonly slidingWindowSize: number;
  private readonly summaryTokenThreshold: number;

  constructor(private readonly configService: ConfigService) {
    this.slidingWindowSize =
      this.configService.get<number>('MEMORY_SLIDING_WINDOW_SIZE') ?? 20;
    this.summaryTokenThreshold =
      this.configService.get<number>('MEMORY_SUMMARY_TOKEN_THRESHOLD') ?? 4000;

    this.logger.log(
      `Memory engine initialized — window: ${this.slidingWindowSize}, threshold: ${this.summaryTokenThreshold}`,
    );
  }

  /** Initialize a new session */
  createSession(sessionId: string, connectorId: string | null = null): SessionState {
    const state: SessionState = {
      sessionId,
      messages: [],
      summary: null,
      referencedTables: [],
      previousQueries: [],
      derivedMetrics: {},
      connectorId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    this.sessions.set(sessionId, state);
    this.logger.log(`Memory session created: ${sessionId}`);
    return state;
  }

  /** Add a user message */
  addUserMessage(sessionId: string, content: string): void {
    const state = this.getOrCreateSession(sessionId);
    state.messages.push({
      role: 'user',
      content,
      timestamp: new Date(),
    });
    state.lastAccessedAt = new Date();
    this.maybeCompact(sessionId);
  }

  /** Add an assistant message with optional metadata */
  addAssistantMessage(
    sessionId: string,
    content: string,
    metadata?: { sql?: string; tables_used?: string[]; confidence?: number },
  ): void {
    const state = this.getOrCreateSession(sessionId);
    state.messages.push({
      role: 'assistant',
      content,
      timestamp: new Date(),
      metadata,
    });

    // Track referenced tables
    if (metadata?.tables_used) {
      for (const table of metadata.tables_used) {
        if (!state.referencedTables.includes(table)) {
          state.referencedTables.push(table);
        }
      }
    }

    // Track previous queries
    if (metadata?.sql) {
      state.previousQueries.push(metadata.sql);
    }

    state.lastAccessedAt = new Date();
    this.maybeCompact(sessionId);
  }

  /** Get context window for LLM injection */
  getContextWindow(sessionId: string): ContextWindow {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return { summary: null, recentMessages: [] };
    }

    // Sliding window: take the most recent N messages
    const recentMessages = state.messages
      .slice(-this.slidingWindowSize)
      .map((m) => ({ role: m.role, content: m.content }));

    return {
      summary: state.summary,
      recentMessages,
    };
  }

  /** Get session state */
  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /** Set connector ID for session */
  setConnectorId(sessionId: string, connectorId: string): void {
    const state = this.getOrCreateSession(sessionId);
    state.connectorId = connectorId;
  }

  /** Add a derived metric definition */
  addDerivedMetric(sessionId: string, name: string, definition: string): void {
    const state = this.getOrCreateSession(sessionId);
    state.derivedMetrics[name] = definition;
  }

  /** Get all previous queries for a session */
  getPreviousQueries(sessionId: string): string[] {
    const state = this.sessions.get(sessionId);
    return state?.previousQueries ?? [];
  }

  /** Get referenced tables for a session */
  getReferencedTables(sessionId: string): string[] {
    const state = this.sessions.get(sessionId);
    return state?.referencedTables ?? [];
  }

  /** Destroy session */
  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.logger.log(`Memory session destroyed: ${sessionId}`);
  }

  /** Check if session exists */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  // ── Private Methods ──────────────────────────

  private getOrCreateSession(sessionId: string): SessionState {
    if (!this.sessions.has(sessionId)) {
      return this.createSession(sessionId);
    }
    return this.sessions.get(sessionId)!;
  }

  /**
   * Compact memory when token threshold is exceeded.
   * Summarizes older messages while preserving metrics and structural context.
   */
  private maybeCompact(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    const estimatedTokens = this.estimateTokens(state.messages);

    if (estimatedTokens > this.summaryTokenThreshold && state.messages.length > this.slidingWindowSize) {
      const messagesToSummarize = state.messages.slice(
        0,
        state.messages.length - this.slidingWindowSize,
      );

      // Build deterministic summary
      const summaryParts: string[] = [];

      if (state.summary) {
        summaryParts.push(state.summary);
      }

      // Summarize conversation topics
      const topics: string[] = [];
      for (const msg of messagesToSummarize) {
        if (msg.role === 'user') {
          topics.push(msg.content.substring(0, 100));
        }
        if (msg.metadata?.sql) {
          topics.push(`Query executed: ${msg.metadata.sql.substring(0, 80)}`);
        }
      }

      if (topics.length > 0) {
        summaryParts.push(`Previous topics: ${topics.join('; ')}`);
      }

      // Preserve metrics
      if (Object.keys(state.derivedMetrics).length > 0) {
        const metricStr = Object.entries(state.derivedMetrics)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        summaryParts.push(`Derived metrics: ${metricStr}`);
      }

      // Preserve referenced tables
      if (state.referencedTables.length > 0) {
        summaryParts.push(`Referenced tables: ${state.referencedTables.join(', ')}`);
      }

      state.summary = summaryParts.join('\n');

      // Remove summarized messages from window
      state.messages = state.messages.slice(-this.slidingWindowSize);

      this.logger.log(
        `Memory compacted for session ${sessionId}: ${messagesToSummarize.length} messages summarized`,
      );
    }
  }

  /** Rough token estimation (~4 chars per token) */
  private estimateTokens(messages: StoredMessage[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }
}
