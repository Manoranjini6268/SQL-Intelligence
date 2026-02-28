// ──────────────────────────────────────────────
// Prompt Builder — Structured LLM Context Assembly
// ──────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { LLMContext } from './types';

@Injectable()
export class PromptBuilderService {
  /** Build the system prompt with SQL constraints */
  buildSystemPrompt(): string {
    return `You are a precise SQL query generator for a read-only database analytics system.

ABSOLUTE RULES — VIOLATION MEANS REJECTION:
1. Generate ONLY SELECT statements
2. Every query MUST include a LIMIT clause (maximum 500). DEFAULT LIMIT RULE: unless the user explicitly asks for a specific number of rows (e.g. "top 10", "last 5"), always use LIMIT 500 so all matching rows are returned.
3. Only single statements — no semicolons separating multiple queries
4. No comments in SQL (no --, /*, or #)
5. No UNION, INTERSECT, or EXCEPT
6. Maximum subquery depth: 2 levels
7. All table and column names MUST exist in the provided schema
8. All JOINs must use explicit ON clauses matching foreign key relationships
9. No Cartesian joins (cross joins without conditions)

OUTPUT FORMAT — STRICT JSON ONLY:
You must respond with ONLY a valid JSON object. No markdown, no code fences, no explanation outside JSON.

{
  "sql": "SELECT ... FROM ... LIMIT ...",
  "explanation": "Clear explanation of what this query does and why",
  "tables_used": ["table1", "table2"],
  "confidence": 0.95
}

CONFIDENCE SCORING:
- 0.9-1.0: Query directly answers the question using available schema
- 0.7-0.89: Query approximates the answer, some assumptions made
- 0.5-0.69: Significant assumptions about user intent
- Below 0.5: Do not generate — explain why instead

If you cannot generate a valid query, respond with:
{
  "sql": "",
  "explanation": "Reason why the query cannot be generated",
  "tables_used": [],
  "confidence": 0
}`;
  }

  /** Assemble full LLM context */
  assembleContext(params: {
    compressedSchema: string;
    conversationSummary: string | null;
    recentMessages: { role: 'user' | 'assistant'; content: string }[];
    userPrompt: string;
  }): LLMContext {
    return {
      systemPrompt: this.buildSystemPrompt(),
      compressedSchema: params.compressedSchema,
      conversationSummary: params.conversationSummary,
      recentMessages: params.recentMessages,
      userPrompt: params.userPrompt,
    };
  }

  /** Convert context to messages array for LLM API */
  contextToMessages(
    context: LLMContext,
  ): { role: 'system' | 'user' | 'assistant'; content: string }[] {
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

    // System prompt
    messages.push({ role: 'system', content: context.systemPrompt });

    // Schema context
    messages.push({
      role: 'system',
      content: `DATABASE SCHEMA:\n${context.compressedSchema}`,
    });

    // Conversation summary (if exists)
    if (context.conversationSummary) {
      messages.push({
        role: 'system',
        content: `CONVERSATION CONTEXT:\n${context.conversationSummary}`,
      });
    }

    // Recent message window
    for (const msg of context.recentMessages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Current user prompt
    messages.push({ role: 'user', content: context.userPrompt });

    return messages;
  }
}
