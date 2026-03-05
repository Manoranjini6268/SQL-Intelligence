'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { QueryExecutionResult } from '@/lib/types';

const COLORS = [
  { stroke: '#6366f1', fill: '#6366f130' },
  { stroke: '#22d3ee', fill: '#22d3ee30' },
  { stroke: '#f59e0b', fill: '#f59e0b30' },
  { stroke: '#10b981', fill: '#10b98130' },
];

interface AreaChartCardProps {
  execution: QueryExecutionResult;
  title?: string;
}

function isNumeric(rows: Record<string, unknown>[], col: string): boolean {
  return rows.slice(0, 20).filter((r) => r[col] != null).every((r) => !isNaN(Number(r[col])));
}

function truncate(label: string, max = 12): string {
  return label != null && String(label).length > max
    ? String(label).slice(0, max) + '…'
    : String(label ?? '');
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-xs shadow-xl">
      <p className="mb-1.5 font-medium text-zinc-300">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex gap-2">
          <span className="text-zinc-400">{p.name}:</span>
          <span className="font-medium">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

export function AreaChartCard({ execution, title }: AreaChartCardProps) {
  const { rows, columns } = execution;

  const schema = useMemo(() => {
    if (!rows || rows.length < 2 || columns.length < 2) return null;
    const numericCols = columns.filter((c) => isNumeric(rows, c));
    if (numericCols.length === 0) return null;
    const labelCol = columns.find((c) => !numericCols.includes(c)) || columns[0];
    const chosen = numericCols.slice(0, 4);
    const data = rows.slice(0, 100).map((row) => {
      const point: Record<string, unknown> = { _label: truncate(String(row[labelCol] ?? '')) };
      chosen.forEach((c) => { point[c] = Number(row[c]); });
      return point;
    });
    return { numericCols: chosen, data };
  }, [rows, columns]);

  if (!schema) return null;

  const axisStyle = { fill: '#71717a', fontSize: 11 };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
      {title && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={schema.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="_label" tick={axisStyle} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {schema.numericCols.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
          )}
          {schema.numericCols.map((col, i) => (
            <Area
              key={col}
              type="monotone"
              dataKey={col}
              stroke={COLORS[i % COLORS.length].stroke}
              fill={COLORS[i % COLORS.length].fill}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
