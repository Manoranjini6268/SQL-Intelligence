// ──────────────────────────────────────────────
// LLM Service — Cerebras Inference Orchestration
// ──────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PromptBuilderService } from './prompt-builder.service';
import { LLMContext, LLMResponse, LLMStreamChunk } from './types';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxRetries = 1;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptBuilder: PromptBuilderService,
  ) {
    const apiKey = this.configService.get<string>('CEREBRAS_API_KEY');
    const baseURL = this.configService.get<string>('CEREBRAS_API_URL');

    if (!apiKey) {
      throw new Error('CEREBRAS_API_KEY is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });

    this.model = this.configService.get<string>('CEREBRAS_MODEL') ?? 'llama-4-scout-17b-16e-instruct';
    this.logger.log(`LLM Service initialized — model: ${this.model}`);
  }

  /**
   * Generate SQL from natural language.
   * Retries once on JSON parse failure. Never repairs output.
   */
  async generateSQL(context: LLMContext): Promise<LLMResponse> {
    const messages = this.promptBuilder.contextToMessages(context);
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const messagesForApi = attempt === 0
          ? messages
          : [
              ...messages,
              {
                role: 'system' as const,
                content: 'Your previous response was not valid JSON. Respond with ONLY a valid JSON object, no markdown or code fences.',
              },
            ];

        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages: messagesForApi,
          temperature: 0.1,
          max_tokens: 2048,
          top_p: 0.95,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from LLM');
        }

        // Parse and validate JSON response
        const parsed = this.parseResponse(content);
        this.logger.log(
          `SQL generated (attempt ${attempt + 1}): confidence=${parsed.confidence}, tables=${parsed.tables_used.join(',')}`,
        );
        return parsed;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`LLM generation attempt ${attempt + 1} failed: ${lastError}`);

        if (attempt === this.maxRetries) {
          break;
        }
      }
    }

    // All retries exhausted — reject, never repair
    throw new Error(`LLM format violation after ${this.maxRetries + 1} attempts: ${lastError}`);
  }

  /**
   * Stream explanation narrative.
   * Only streams the explanation portion — SQL is never streamed before validation.
   */
  async *streamExplanation(context: LLMContext): AsyncGenerator<LLMStreamChunk> {
    const messages = this.promptBuilder.contextToMessages(context);

    // First, get the full response
    const response = await this.generateSQL(context);

    // Stream the explanation character by character for progressive rendering
    const words = response.explanation.split(' ');
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      accumulated += (i > 0 ? ' ' : '') + words[i];
      yield {
        type: 'explanation',
        content: accumulated,
      };
    }

    // Final chunk with complete data
    yield {
      type: 'complete',
      content: response.explanation,
      data: response,
    };
  }

  /**
   * Interpret query results in natural language.
   * Called post-execution to produce a conversational AI response about the data.
   */
  async interpretResults(
    originalPrompt: string,
    sql: string,
    columns: string[],
    rows: Record<string, unknown>[],
    rowCount: number,
  ): Promise<string> {
    const systemPrompt = `You are an expert data analyst AI assistant embedded in a MySQL query tool.

Your job: given a user's question and the SQL query results, answer the question directly and conversationally.

Rules:
- Answer the user's original question using the actual data returned
- Be specific — cite real numbers, names, and values from the results
- Keep it concise: 2–4 sentences maximum
- Highlight the most important finding first
- If zero rows were returned, explain that clearly and suggest why
- Never describe or explain the SQL query itself
- Never say "the query returned" — just answer the question like a knowledgeable analyst`;

    // Limit rows sent to LLM to avoid token overflow
    const sampleRows = rows.slice(0, 20);
    const userContent = [
      `User question: "${originalPrompt}"`,
      ``,
      `SQL executed:`,
      sql,
      ``,
      `Results (${rowCount} total row${rowCount !== 1 ? 's' : ''}, showing up to 20):`,
      JSON.stringify(sampleRows, null, 2),
    ].join('\n');

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.4,
        max_tokens: 256,
      });

      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('Empty insight response');
      this.logger.log(`Result interpretation generated (${text.length} chars)`);
      return text;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`interpretResults failed: ${msg}`);
      // Graceful fallback — never throw, insight is non-critical
      return rowCount === 0
        ? 'No results were found matching your criteria.'
        : `Found ${rowCount} result${rowCount !== 1 ? 's' : ''}.`;
    }
  }

  /**
   * Generate plain free-text response — no SQL, no JSON parsing.
   * Used for schema explanation, contextual summaries, etc.
   */
  async generateFreeText(
    systemPrompt: string,
    userContent: string,
    maxTokens = 512,
  ): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.5,
        max_tokens: maxTokens,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('Empty response');
      return text;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`generateFreeText failed: ${msg}`);
      throw new Error(`AI explanation failed: ${msg}`);
    }
  }

  /** Parse LLM response — strict JSON only */
  private parseResponse(content: string): LLMResponse {
    // Strip markdown code fences if present
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`LLM output is not valid JSON: ${cleaned.substring(0, 200)}`);
    }

    // Validate required fields
    if (typeof parsed.sql !== 'string') {
      throw new Error('LLM response missing "sql" field');
    }
    if (typeof parsed.explanation !== 'string') {
      throw new Error('LLM response missing "explanation" field');
    }
    if (!Array.isArray(parsed.tables_used)) {
      throw new Error('LLM response missing "tables_used" array');
    }
    if (typeof parsed.confidence !== 'number') {
      throw new Error('LLM response missing "confidence" number');
    }

    return {
      sql: parsed.sql as string,
      explanation: parsed.explanation as string,
      tables_used: parsed.tables_used as string[],
      confidence: parsed.confidence as number,
    };
  }
}
