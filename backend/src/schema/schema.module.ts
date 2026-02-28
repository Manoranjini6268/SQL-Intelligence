// ──────────────────────────────────────────────
// Schema Module
// ──────────────────────────────────────────────

import { Global, Module } from '@nestjs/common';
import { SchemaService } from './schema.service';

@Global()
@Module({
  providers: [SchemaService],
  exports: [SchemaService],
})
export class SchemaModule {}
