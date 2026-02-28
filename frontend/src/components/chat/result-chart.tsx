'use client';

// ──────────────────────────────────────────────
// ResultChart — auto-detects numeric columns &
// renders bar / line / pie chart via recharts
// ──────────────────────────────────────────────

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarChart2, LineChart as LineIcon, PieChart as PieIcon } from 'lucide-react';
import type { QueryExecutionResult } from '@/lib/types';

// ── Colour palette ──────────────────────────────

const CHART_COLORS = [
  '#6366f1', // indigo-500
  '#22d3ee', // cyan-400
  '#f59e0b', // amber-400
  '#10b981', // emerald-500
  '#f43f5e', // rose-500
  '#a78bfa', // violet-400
  '#34d399', // emerald-400
  '#fb923c', // orange-400
];

// ── Helpers ─────────────────────────────────────

function isNumericCol(rows: Record<string, unknown>[], col: string): boolean {
  const sample = rows.slice(0, 20).filter((r) => r[col] != null);
  if (sample.length === 0) return false;
  return sample.every((r) => !isNaN(Number(r[col])));
}

function isDateLike(col: string): boolean {
  return /date|time|created|updated|at|year|month|day/i.test(col);
}

function truncateLabel(label: string, max = 14): string {
  return label != null && String(label).length > max
    ? String(label).slice(0, max) + '…'
    : String(label ?? '');
}

type ChartType = 'bar' | 'line' | 'pie';

interface DetectedSchema {
  labelCol: string;
  numericCols: string[];
  preferredType: ChartType;
  data: Record<string, unknown>[];
}

function detectSchema(execution: QueryExecutionResult): DetectedSchema | null {
  const { rows, columns } = execution;
  if (!rows || rows.length === 0 || columns.length < 2) return null;

  const numericCols = columns.filter((c) => isNumericCol(rows, c));
  if (numericCols.length === 0) return null;

  const stringCols = columns.filter((c) => !numericCols.includes(c));
  const dateCols = stringCols.filter(isDateLike);
  const labelCol = stringCols[0] ?? columns[0];

  // Choose up to 4 numeric columns for readability
  const chosenNumeric = numericCols.slice(0, 4);

  const data = rows.slice(0, 40).map((row) => {
    const point: Record<string, unknown> = { _label: truncateLabel(String(row[labelCol] ?? '')) };
    chosenNumeric.forEach((c) => {
      point[c] = Number(row[c]);
    });
    return point;
  });

  const preferredType: ChartType =
    dateCols.length > 0 ? 'line' : numericCols.length === 1 && rows.length <= 12 ? 'pie' : 'bar';

  return { labelCol, numericCols: chosenNumeric, preferredType, data };
}

// ── Custom Tooltip ──────────────────────────────

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

// ── Component ───────────────────────────────────

export function ResultChart({ execution }: { execution: QueryExecutionResult }) {
  const schema = useMemo(() => detectSchema(execution), [execution]);
  const [chartType, setChartType] = useState<ChartType | null>(null);

  if (!schema) return null;

  const activeType = chartType ?? schema.preferredType;

  const sharedAxisProps = {
    tick: { fill: '#71717a', fontSize: 11 },
    axisLine: { stroke: '#3f3f46' },
    tickLine: false,
  };

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-4 mt-1">
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Chart view · {execution.rowCount} rows
        </p>
        <div className="flex gap-1">
          {(['bar', 'line', 'pie'] as ChartType[]).map((t) => {
            const Icon = t === 'bar' ? BarChart2 : t === 'line' ? LineIcon : PieIcon;
            return (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`rounded-md p-1.5 transition-colors ${
                  activeType === t
                    ? 'bg-indigo-600/30 text-indigo-300'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                }`}
                title={`${t.charAt(0).toUpperCase() + t.slice(1)} chart`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        {activeType === 'bar' ? (
          <BarChart data={schema.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="_label" {...sharedAxisProps} />
            <YAxis {...sharedAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            {schema.numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />}
            {schema.numericCols.map((col, i) => (
              <Bar
                key={col}
                dataKey={col}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        ) : activeType === 'line' ? (
          <LineChart data={schema.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="_label" {...sharedAxisProps} />
            <YAxis {...sharedAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            {schema.numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />}
            {schema.numericCols.map((col, i) => (
              <Line
                key={col}
                type="monotone"
                dataKey={col}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={schema.data}
              dataKey={schema.numericCols[0]}
              nameKey="_label"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={40}
              paddingAngle={2}
            >
              {schema.data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
