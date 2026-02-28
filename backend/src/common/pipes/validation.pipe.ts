// ──────────────────────────────────────────────
// Validation Pipe — DTO Enforcement
// ──────────────────────────────────────────────

import { BadRequestException, ValidationPipe as NestValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export const StrictValidationPipe = new NestValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
  exceptionFactory: (errors: ValidationError[]) => {
    const messages = errors.map((error) => {
      const constraints = error.constraints
        ? Object.values(error.constraints).join(', ')
        : 'Validation failed';
      return `${error.property}: ${constraints}`;
    });

    return new BadRequestException({
      type: 'ValidationRejection',
      message: 'Request validation failed',
      details: { violations: messages },
      timestamp: new Date().toISOString(),
    });
  },
});
