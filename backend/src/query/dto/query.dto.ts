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

export class ExplainSchemaDto {
  @IsString()
  @IsNotEmpty()
  schemaSummary!: string;

  @IsString()
  @IsNotEmpty()
  databaseName!: string;

  @IsOptional()
  @IsString()
  connectorFamily?: string;
}

export class DashboardQueryDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}

export class DashboardWidgetDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;
}
