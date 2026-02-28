// ──────────────────────────────────────────────
// App Module — Root Module Assembly
// ──────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './common/config/env.validation';
import { MCPModule } from './mcp/mcp.module';
import { SchemaModule } from './schema/schema.module';
import { ValidationModule } from './validation/validation.module';
import { MemoryModule } from './memory/memory.module';
import { ConnectionModule } from './connection/connection.module';
import { QueryModule } from './query/query.module';

@Module({
  imports: [
    // Environment configuration with validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: '.env',
    }),

    // Core infrastructure modules (Global)
    MCPModule,
    SchemaModule,
    ValidationModule,
    MemoryModule,

    // Feature modules
    ConnectionModule,
    QueryModule,
  ],
})
export class AppModule {}
