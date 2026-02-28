// ──────────────────────────────────────────────
// MCP Module — Connector Registration
// ──────────────────────────────────────────────

import { Global, Module } from '@nestjs/common';
import { MCPService } from './mcp.service';

@Global()
@Module({
  providers: [MCPService],
  exports: [MCPService],
})
export class MCPModule {}
