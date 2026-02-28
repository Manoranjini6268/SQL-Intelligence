'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SQLBlockProps {
  sql: string;
}

export function SQLBlock({ sql }: SQLBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Basic SQL syntax highlighting
  const highlighted = highlightSQL(sql);

  return (
    <div className="group relative rounded-lg border bg-muted/50">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">Validated SQL</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

function highlightSQL(sql: string): string {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'ON', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
    'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'CASE', 'WHEN',
    'THEN', 'ELSE', 'END', 'ASC', 'DESC', 'CROSS', 'FULL',
  ];

  let result = sql
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Highlight strings
  result = result.replace(
    /'[^']*'/g,
    (match) => `<span class="text-emerald-400">${match}</span>`,
  );

  // Highlight numbers
  result = result.replace(
    /\b(\d+)\b/g,
    '<span class="text-amber-400">$1</span>',
  );

  // Highlight keywords
  for (const kw of keywords) {
    const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
    result = result.replace(
      regex,
      `<span class="text-blue-400 font-semibold">$1</span>`,
    );
  }

  return result;
}
