'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { QueryExecutionResult } from '@/lib/types';

const COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981',
  '#f43f5e', '#a78bfa', '#34d399', '#fb923c',
];

interface BarChartCardProps {
  execution: QueryExecutionResult;
  title?: string;
}

function isNumeric(rows: Record<string, unknown>[], col: string): boolean {
  return rows.slice(0, 20).filter((r) => r[col] != null).every((r) => !isNaN(Number(r[col])));
}

function truncate(label: string, max = 14): string {
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

export function BarChartCard({ execution, title }: BarChartCardProps) {
  const { rows, columns } = execution;

  const schema = useMemo(() => {
    if (!rows || rows.length === 0 || columns.length < 2) return null;
    const numericCols = columns.filter((c) => isNumeric(rows, c));
    if (numericCols.length === 0) return null;
    const labelCol = columns.find((c) => !numericCols.includes(c)) || columns[0];
    const chosen = numericCols.slice(0, 4);
    const data = rows.slice(0, 30).map((row) => {
      const point: Record<string, unknown> = { _label: truncate(String(row[labelCol] ?? '')) };
      chosen.forEach((c) => { point[c] = Number(row[c]); });
      return point;
    });
    return { labelCol, numericCols: chosen, data };
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
        <BarChart data={schema.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="_label" tick={axisStyle} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {schema.numericCols.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
          )}
          {schema.numericCols.map((col, i) => (
            <Bar
              key={col}
              dataKey={col}
              fill={COLORS[i % COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
