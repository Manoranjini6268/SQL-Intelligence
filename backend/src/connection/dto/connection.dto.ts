// ──────────────────────────────────────────────
// Connection DTOs — Request Validation
// ──────────────────────────────────────────────

import { IsEnum, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { ConnectorType } from '../../common/types';

export class TestConnectionDto {
  @IsString()
  @IsNotEmpty()
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  database!: string;

  @IsEnum(ConnectorType)
  connectorType!: ConnectorType;
}

export class ConnectDto extends TestConnectionDto {}
