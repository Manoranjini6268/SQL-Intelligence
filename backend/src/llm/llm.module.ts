// ──────────────────────────────────────────────
// LLM Module
// ──────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  providers: [LLMService, PromptBuilderService],
  exports: [LLMService, PromptBuilderService],
})
export class LLMModule {}
