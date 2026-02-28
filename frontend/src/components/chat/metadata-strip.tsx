'use client';

import { Clock, Rows3, Table2, Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { QueryExecutionResult } from '@/lib/types';

interface MetadataStripProps {
  execution: QueryExecutionResult;
}

export function MetadataStrip({ execution }: MetadataStripProps) {
  const confidenceColor =
    execution.confidence >= 0.9
      ? 'success'
      : execution.confidence >= 0.7
        ? 'warning'
        : 'destructive';

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        <span>{execution.executionTime}ms</span>
      </div>

      <div className="flex items-center gap-1">
        <Rows3 className="h-3.5 w-3.5" />
        <span>{execution.rowCount} rows</span>
      </div>

      {execution.tables_used.length > 0 && (
        <div className="flex items-center gap-1">
          <Table2 className="h-3.5 w-3.5" />
          <span>{execution.tables_used.join(', ')}</span>
        </div>
      )}

      {execution.confidence > 0 && execution.confidence !== undefined && (
        <Badge variant={confidenceColor as 'success' | 'warning' | 'destructive'} className="text-[10px]">
          <Gauge className="mr-1 h-3 w-3" />
          {Math.round(execution.confidence * 100)}% confidence
        </Badge>
      )}
    </div>
  );
}
