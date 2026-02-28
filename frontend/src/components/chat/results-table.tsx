'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QueryExecutionResult } from '@/lib/types';

function downloadCSV(columns: string[], rows: Record<string, unknown>[]) {
  const escape = (v: unknown) =>
    JSON.stringify(v === null || v === undefined ? '' : String(v));
  const csv = [
    columns.join(','),
    ...rows.map((r) => columns.map((c) => escape(r[c])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(rows: Record<string, unknown>[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'results.json';
  a.click();
  URL.revokeObjectURL(url);
}

interface ResultsTableProps {
  execution: QueryExecutionResult;
}

export function ResultsTable({ execution }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!execution.columns || execution.columns.length === 0) return [];
    return execution.columns.map((col) => ({
      accessorKey: col,
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 font-semibold hover:text-foreground transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {col}
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        </button>
      ),
      cell: ({ getValue }) => {
        const val = getValue();
        if (val === null || val === undefined) {
          return <span className="text-muted-foreground italic">NULL</span>;
        }
        if (typeof val === 'object') {
          return (
            <span className="font-mono text-xs text-muted-foreground">
              {JSON.stringify(val)}
            </span>
          );
        }
        return <span className="truncate max-w-[300px] block">{String(val)}</span>;
      },
    }));
  }, [execution.columns]);

  const data = useMemo(() => execution.rows ?? [], [execution.rows]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  if (!data.length) {
    return (
      <div className="rounded-md border border-border p-6 text-center text-muted-foreground text-sm">
        Query executed successfully but returned no rows.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => downloadCSV(execution.columns, execution.rows ?? [])}
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => downloadJSON(execution.rows ?? [])}
        >
          <Download className="h-3.5 w-3.5" />
          JSON
        </Button>
      </div>
      <div className="rounded-md border border-border overflow-auto max-h-[400px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs text-muted-foreground border-b border-border whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-border/50 hover:bg-muted/40 transition-colors ${
                  idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ({data.length} rows)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
