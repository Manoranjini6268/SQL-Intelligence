// ──────────────────────────────────────────────
// Query Service — Full Orchestration Pipeline
// ──────────────────────────────────────────────
//
// Pipeline: NL → LLM → Validate → [Approve] → Execute via MCP → Respond
//

import { Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { LLMService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';
import { MCPService } from '../mcp/mcp.service';
import { MemoryService } from '../memory/memory.service';
import { SchemaService } from '../schema/schema.service';
import { ValidationService } from '../validation/validation.service';
import { AuditLogEntry, ErrorType, ValidationVerdict } from '../common/types';
import { QueryPlanResult, QueryExecutionResponse, QueryStreamEvent } from './types';

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  /** Audit log — append-only in memory for MVP */
  private readonly auditLog: AuditLogEntry[] = [];

  constructor(
    private readonly llmService: LLMService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly validationService: ValidationService,
    private readonly mcpService: MCPService,
    private readonly schemaService: SchemaService,
    private readonly memoryService: MemoryService,
  ) {}

  /**
   * STEP 1: Generate SQL plan from natural language.
   * Returns validated plan — awaits frontend approval before execution.
   */
  async generatePlan(sessionId: string, prompt: string): Promise<QueryPlanResult> {
    this.logger.log(`Generating plan for session ${sessionId}: "${prompt.substring(0, 80)}"`);

    // Validate prerequisites
    this.validateSession(sessionId);

    // Get schema context
    const compressedSchema = this.schemaService.getCompressedSchema(sessionId);
    if (!compressedSchema) {
      throw new BadRequestException('No schema available for this session');
    }

    // Get memory context
    const contextWindow = this.memoryService.getContextWindow(sessionId);

    // Add user message to memory
    this.memoryService.addUserMessage(sessionId, prompt);

    // Assemble LLM context
    const context = this.promptBuilder.assembleContext({
      compressedSchema,
      conversationSummary: contextWindow.summary,
      recentMessages: contextWindow.recentMessages,
      userPrompt: prompt,
    });

    // Generate SQL via LLM
    let llmResponse;
    try {
      llmResponse = await this.llmService.generateSQL(context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LLM generation failed';
      throw new HttpException(
        { type: ErrorType.LLM_FORMAT_VIOLATION, message },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // If LLM returned no SQL (can't generate), return immediately
    if (!llmResponse.sql) {
      this.memoryService.addAssistantMessage(sessionId, llmResponse.explanation, {
        confidence: llmResponse.confidence,
      });

      return {
        sql: '',
        explanation: llmResponse.explanation,
        tables_used: [],
        confidence: llmResponse.confidence,
        validationVerdict: 'REJECT',
        validationReasons: ['LLM could not generate a valid query'],
        requiresApproval: false,
      };
    }

    // Validate SQL through AST engine
    const graph = this.schemaService.getGraph(sessionId);
    const validationResult = this.validationService.validate(llmResponse.sql, graph);

    // Record in audit log
    this.recordAudit(sessionId, prompt, llmResponse.sql, validationResult.verdict, validationResult.reasons);

    // Store in memory
    this.memoryService.addAssistantMessage(sessionId, llmResponse.explanation, {
      sql: llmResponse.sql,
      tables_used: llmResponse.tables_used,
      confidence: llmResponse.confidence,
    });

    return {
      sql: validationResult.verdict === 'ACCEPT' ? llmResponse.sql : '',
      explanation: llmResponse.explanation,
      tables_used: llmResponse.tables_used,
      confidence: llmResponse.confidence,
      validationVerdict: validationResult.verdict,
      validationReasons: validationResult.reasons,
      requiresApproval: validationResult.verdict === 'ACCEPT',
    };
  }

  /**
   * STEP 2: Execute approved, validated SQL through MCP.
   * Requires explicit frontend approval.
   */
  async executeApproved(
    sessionId: string,
    sql: string,
    prompt?: string,
  ): Promise<QueryExecutionResponse> {
    this.logger.log(`Executing approved query for session ${sessionId}`);

    this.validateSession(sessionId);

    // Re-validate before execution (defense in depth)
    const graph = this.schemaService.getGraph(sessionId);
    const reValidation = this.validationService.validate(sql, graph);

    if (reValidation.verdict !== 'ACCEPT') {
      throw new HttpException(
        {
          type: ErrorType.VALIDATION_REJECTION,
          message: 'SQL re-validation failed before execution',
          details: { reasons: reValidation.reasons },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Execute through MCP tool boundary
    const result = await this.mcpService.executeReadQuery(sessionId, sql);

    if (!result.success || !result.data) {
      const errorMessage = result.error || 'Query execution failed';

      if (errorMessage.includes('timeout')) {
        throw new HttpException(
          { type: ErrorType.EXECUTION_TIMEOUT, message: errorMessage },
          HttpStatus.REQUEST_TIMEOUT,
        );
      }

      throw new HttpException(
        { type: ErrorType.INTERNAL_ERROR, message: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const tables = this.validationService.extractTablesFromSQL(sql);

    // Generate AI insight — interpret the results in natural language
    let insight: string | undefined;
    if (prompt) {
      insight = await this.llmService.interpretResults(
        prompt,
        sql,
        result.data.columns,
        result.data.rows,
        result.data.rowCount,
      );
    }

    return {
      sql,
      explanation: '', // Explanation was already provided in the plan step
      tables_used: tables,
      confidence: 0,
      executionTime: result.executionTimeMs,
      rowCount: result.data.rowCount,
      rows: result.data.rows,
      columns: result.data.columns,
      insight,
    };
  }

  /**
   * Combined pipeline: Generate → Validate → Return plan for approval.
   * NEVER auto-executes. Frontend must call /execute with explicit approval.
   */
  async ask(
    sessionId: string,
    prompt: string,
  ): Promise<{
    plan: QueryPlanResult;
  }> {
    const plan = await this.generatePlan(sessionId, prompt);
    return { plan };
  }

  /**
   * Stream query events for progressive UI rendering.
   */
  async *streamQuery(
    sessionId: string,
    prompt: string,
  ): AsyncGenerator<QueryStreamEvent> {
    this.validateSession(sessionId);

    const compressedSchema = this.schemaService.getCompressedSchema(sessionId);
    if (!compressedSchema) {
      yield { type: 'error', data: { message: 'No schema available' } };
      return;
    }

    const contextWindow = this.memoryService.getContextWindow(sessionId);
    this.memoryService.addUserMessage(sessionId, prompt);

    const context = this.promptBuilder.assembleContext({
      compressedSchema,
      conversationSummary: contextWindow.summary,
      recentMessages: contextWindow.recentMessages,
      userPrompt: prompt,
    });

    // Stream explanation
    let finalResponse;
    try {
      for await (const chunk of this.llmService.streamExplanation(context)) {
        if (chunk.type === 'explanation') {
          yield { type: 'explanation', data: { text: chunk.content } };
        }
        if (chunk.type === 'complete' && chunk.data) {
          finalResponse = chunk.data;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stream failed';
      yield { type: 'error', data: { message } };
      return;
    }

    if (!finalResponse || !finalResponse.sql) {
      yield {
        type: 'plan',
        data: {
          sql: '',
          explanation: finalResponse?.explanation || 'Could not generate query',
          validationVerdict: 'REJECT',
        },
      };
      return;
    }

    // Validate
    const graph = this.schemaService.getGraph(sessionId);
    const validation = this.validationService.validate(finalResponse.sql, graph);

    yield {
      type: 'validation',
      data: {
        verdict: validation.verdict,
        reasons: validation.reasons,
      },
    };

    yield {
      type: 'plan',
      data: {
        sql: validation.verdict === 'ACCEPT' ? finalResponse.sql : '',
        explanation: finalResponse.explanation,
        tables_used: finalResponse.tables_used,
        confidence: finalResponse.confidence,
        validationVerdict: validation.verdict,
        validationReasons: validation.reasons,
        requiresApproval: validation.verdict === 'ACCEPT',
      },
    };

    this.memoryService.addAssistantMessage(sessionId, finalResponse.explanation, {
      sql: finalResponse.sql,
      tables_used: finalResponse.tables_used,
      confidence: finalResponse.confidence,
    });

    this.recordAudit(
      sessionId,
      prompt,
      finalResponse.sql,
      validation.verdict,
      validation.reasons,
    );
  }

  /**
   * Explain schema — generates a plain-text AI summary of the database
   * from schema topology passed by the frontend. No SQL, no validation.
   */
  async explainSchema(
    schemaSummary: string,
    databaseName: string,
  ): Promise<{ explanation: string }> {
    const system = `You are an expert database architect and data analyst.
Given a database schema summary, explain:
1. What kind of application or business this database supports
2. The purpose of each major table
3. The most important relationships between tables
4. Any interesting observations about the data model

Format your response with clear sections using **bold headers**.
Be insightful, specific, and concise. Use bullet points where helpful.`;

    const user = `Database: ${databaseName}

Schema summary:
${schemaSummary}

Explain this database.`;

    const explanation = await this.llmService.generateFreeText(system, user, 600);
    return { explanation };
  }

  /** Get query history for a session */
  getQueryHistory(sessionId: string): string[] {
    return this.memoryService.getPreviousQueries(sessionId);
  }

  /** Get audit log (admin/debug) */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  // ── Private Methods ──────────────────────────

  private validateSession(sessionId: string): void {
    if (!this.mcpService.isSessionActive(sessionId)) {
      throw new BadRequestException('No active database session. Connect first.');
    }
  }

  private recordAudit(
    sessionId: string,
    prompt: string,
    sql: string,
    verdict: 'ACCEPT' | 'REJECT',
    reasons: string[],
  ): void {
    const schemaHash = this.schemaService.getSchemaHash(sessionId) ?? 'unknown';
    const session = this.mcpService.getSession(sessionId);

    this.auditLog.push({
      timestamp: new Date(),
      sessionId,
      prompt,
      generatedSql: sql,
      validationResult: verdict === 'ACCEPT' ? ValidationVerdict.ACCEPT : ValidationVerdict.REJECT,
      validationReasons: reasons,
      schemaHash,
      connectorId: session?.connectorId ?? 'unknown',
    });

    // Keep audit log bounded
    if (this.auditLog.length > 10000) {
      this.auditLog.splice(0, this.auditLog.length - 10000);
    }
  }
}
