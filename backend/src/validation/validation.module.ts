// ──────────────────────────────────────────────
// Validation Module
// ──────────────────────────────────────────────

import { Global, Module } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { ESValidationService } from './es/es-validation.service';

@Global()
@Module({
  providers: [ValidationService, ESValidationService],
  exports: [ValidationService, ESValidationService],
})
export class ValidationModule {}
