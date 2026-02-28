// ──────────────────────────────────────────────
// Query DTOs
// ──────────────────────────────────────────────

import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateQueryDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;
}

export class ExecuteQueryDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  sql!: string;

  @IsBoolean()
  @IsNotEmpty()
  approved!: boolean;

  @IsOptional()
  @IsString()
  prompt?: string;
}

export class AskDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;
}
