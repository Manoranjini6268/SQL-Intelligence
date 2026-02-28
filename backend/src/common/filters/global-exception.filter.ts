// ──────────────────────────────────────────────
// Global Exception Filter — Structured Error Responses
// ──────────────────────────────────────────────

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorType, StructuredError } from '../types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const structuredError = this.buildStructuredError(exception);
    const httpStatus = this.resolveHttpStatus(exception);

    this.logger.error(
      `[${structuredError.type}] ${structuredError.message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(httpStatus).json(structuredError);
  }

  private buildStructuredError(exception: unknown): StructuredError {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as Record<string, unknown>).message?.toString() || exception.message;

      return {
        type: this.mapHttpStatusToErrorType(exception.getStatus()),
        message,
        details:
          typeof response === 'object' ? (response as Record<string, unknown>) : undefined,
        timestamp: new Date().toISOString(),
      };
    }

    if (exception instanceof Error) {
      return {
        type: ErrorType.INTERNAL_ERROR,
        message: exception.message,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      type: ErrorType.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    };
  }

  private resolveHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private mapHttpStatusToErrorType(status: number): ErrorType {
    switch (status) {
      case 400:
        return ErrorType.VALIDATION_REJECTION;
      case 401:
        return ErrorType.UNAUTHORIZED;
      case 408:
        return ErrorType.EXECUTION_TIMEOUT;
      case 422:
        return ErrorType.LLM_FORMAT_VIOLATION;
      default:
        return ErrorType.INTERNAL_ERROR;
    }
  }
}
