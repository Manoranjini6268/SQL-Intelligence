'use client';

import type { QueryExecutionResult } from '@/lib/types';

interface ListCardProps {
  execution: QueryExecutionResult;
  title?: string;
}

export function ListCard({ execution, title }: ListCardProps) {
  const { rows, columns } = execution;
  if (!rows || rows.length === 0) return null;

  // Use first 1-2 columns for the list display
  const primaryCol = columns[0];
  const secondaryCol = columns.length > 1 ? columns[1] : null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
      {title && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {title} <span className="text-zinc-600">· {rows.length} items</span>
        </p>
      )}
      <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-zinc-800/60"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-500">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-200">
                {String(row[primaryCol] ?? '—')}
              </p>
              {secondaryCol && (
                <p className="truncate text-[11px] text-zinc-500">
                  {String(row[secondaryCol] ?? '')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
