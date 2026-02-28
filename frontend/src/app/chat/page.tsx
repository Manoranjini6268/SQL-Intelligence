'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Database,
  Table2,
  LogOut,
  Loader2,
  AlertTriangle,
  Zap,
  Settings,
  Network as NetworkIcon,
  Star,
  X,
  BarChart2,
  TableIcon,
  HelpCircle,
  Keyboard,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSession } from '@/hooks/use-session';
import {
  ask,
  executeQuery,
  disconnect as disconnectApi,
  connect as connectApi,
  getConnectionStatus,
} from '@/lib/api';
import { SQLBlock } from '@/components/chat/sql-block';
import { ResultsTable } from '@/components/chat/results-table';
import { MetadataStrip } from '@/components/chat/metadata-strip';
import {
  loadSettings,
  loadParams,
  savePinnedQuery,
  loadPinnedQueries,
  removePinnedQuery,
} from '@/lib/storage';
import type { PinnedQuery } from '@/lib/storage';
import { ResultChart } from '@/components/chat/result-chart';
import type { ChatMessage } from '@/lib/types';

export default function ChatPage() {
  const router = useRouter();
  const {
    sessionId,
    connection,
    tables,
    messages,
    isConnected,
    pushMessage,
    patchLastMessage,
    disconnect,
    connect: setConnected,
  } = useSession();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSQL, setShowSQL] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'tables' | 'history'>('tables');
  const [pinnedQueries, setPinnedQueries] = useState<PinnedQuery[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load pinned queries from localStorage
  useEffect(() => {
    setPinnedQueries(loadPinnedQueries());
  }, []);

  // Pick up prefill from schema explorer "Ask in Chat" button
  useEffect(() => {
    const prefill = sessionStorage.getItem('sqli_prefill');
    if (prefill) {
      setInput(prefill);
      sessionStorage.removeItem('sqli_prefill');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    const s = loadSettings();
    setShowSQL(s.showSQL);
  }, []);

  // Refresh settings when returning from settings page
  useEffect(() => {
    const onFocus = () => {
      const s = loadSettings();
      setShowSQL(s.showSQL);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // On mount: verify backend session is still alive, reconnect if expired
  useEffect(() => {
    if (!sessionId) {
      router.push('/connect');
      return;
    }
    (async () => {
      try {
        const status = await getConnectionStatus(sessionId);
        if (!status.connected) {
          const params = loadParams();
          if (params) {
            try {
              const result = await connectApi(params);
              setConnected(result);
            } catch {
              disconnect();
              router.push('/connect');
            }
          } else {
            disconnect();
            router.push('/connect');
          }
        }
      } catch {
        disconnect();
        router.push('/connect');
      } finally {
        setSessionChecked(true);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll on new messages — use a bottom anchor for reliable scroll inside Radix ScrollArea
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Ctrl+K global shortcut — focus chat input
  // ? global shortcut — show keyboard shortcuts modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === '?' && !isTyping) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const prompt = input.trim();
    setInput('');
    setIsLoading(true);

    pushMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    });

    pushMessage({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    });

    try {
      const { plan } = await ask(sessionId, prompt);

      if (plan.validationVerdict === 'REJECT') {
        patchLastMessage({ content: '', plan, isStreaming: false });
        return;
      }

      // Auto-execute — no user approval gate
      const result = await executeQuery(sessionId, plan.sql, prompt);

      patchLastMessage({
        content: '',
        plan,
        execution: {
          ...result,
          confidence: plan.confidence,
          tables_used: result.tables_used.length ? result.tables_used : plan.tables_used,
        },
        isStreaming: false,
      });
    } catch (err) {
      patchLastMessage({
        content: err instanceof Error ? err.message : 'Something went wrong',
        isStreaming: false,
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, sessionId, isLoading, pushMessage, patchLastMessage]);

  const handleDisconnect = useCallback(async () => {
    if (sessionId) await disconnectApi(sessionId).catch(() => {});
    disconnect();
    router.push('/connect');
  }, [sessionId, disconnect, router]);

  if (!isConnected || !sessionChecked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-60 flex-col border-r bg-card lg:flex">
        <div className="border-b p-4">
          <div className="flex items-start justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">SQL Intelligence</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {connection?.database}@{connection?.host}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/settings')}
              className="ml-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              Connected
            </span>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
              {connection?.connectorType}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b">
            <button
              onClick={() => setSidebarTab('tables')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                sidebarTab === 'tables'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tables
            </button>
            <button
              onClick={() => setSidebarTab('history')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                sidebarTab === 'history'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              History
            </button>
          </div>

          {sidebarTab === 'tables' ? (
            <>
              <div className="px-4 pb-1.5 pt-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Database className="h-3 w-3" />
                  {tables.length} tables
                </p>
              </div>
              <ScrollArea className="h-[calc(100vh-260px)]">
                <div className="space-y-px px-2 pb-4">
                  {tables.map((table) => (
                    <div
                      key={table.name}
                      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                    >
                      <Table2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-[13px]">{table.name}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {table.columnCount}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <ScrollArea className="h-[calc(100vh-210px)]">
              <div className="px-2 py-2">
                {/* Pinned queries */}
                {pinnedQueries.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500/80 flex items-center gap-1">
                      <Star className="h-2.5 w-2.5 fill-amber-500/80" />
                      Pinned
                    </p>
                    <div className="space-y-px">
                      {pinnedQueries.map((pq) => (
                        <div key={pq.id} className="group flex items-start gap-1 rounded-md px-1 py-1 hover:bg-accent">
                          <button
                            onClick={() => {
                              setInput(pq.text);
                              setSidebarTab('tables');
                              setTimeout(() => inputRef.current?.focus(), 50);
                            }}
                            className="flex-1 text-left"
                          >
                            <p className="text-[12px] text-foreground line-clamp-2 leading-snug px-1.5">
                              {pq.text}
                            </p>
                          </button>
                          <button
                            onClick={() => {
                              removePinnedQuery(pq.id);
                              setPinnedQueries(loadPinnedQueries());
                            }}
                            className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-400"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="my-2 border-t border-zinc-800" />
                  </div>
                )}

                {/* Session history */}
                <div className="space-y-px">
                  {messages
                    .filter((m) => m.role === 'user')
                    .slice()
                    .reverse()
                    .map((m) => {
                      const isPinned = pinnedQueries.some((pq) => pq.text === m.content);
                      return (
                        <div key={m.id} className="group flex items-start gap-1 rounded-md px-1 py-1 hover:bg-accent">
                          <button
                            onClick={() => {
                              setInput(m.content);
                              setSidebarTab('tables');
                              setTimeout(() => inputRef.current?.focus(), 50);
                            }}
                            className="flex-1 text-left pl-1.5"
                          >
                            <p className="text-[12px] text-foreground line-clamp-2 leading-snug">
                              {m.content}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {new Date(m.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </button>
                          <button
                            onClick={() => {
                              if (isPinned) {
                                const pq = pinnedQueries.find((p) => p.text === m.content);
                                if (pq) removePinnedQuery(pq.id);
                              } else {
                                savePinnedQuery(m.content);
                              }
                              setPinnedQueries(loadPinnedQueries());
                            }}
                            className={`mt-0.5 shrink-0 rounded p-0.5 transition-colors ${
                              isPinned
                                ? 'text-amber-400'
                                : 'text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                            }`}
                            title={isPinned ? 'Unpin' : 'Pin query'}
                          >
                            <Star className={`h-3 w-3 ${isPinned ? 'fill-amber-400' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  {messages.filter((m) => m.role === 'user').length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      No queries yet
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="border-t p-3">
          <button
            onClick={() => router.push('/schema')}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground mb-1"
          >
            <NetworkIcon className="h-3.5 w-3.5" />
            Schema Explorer
          </button>
          <button
            onClick={handleDisconnect}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl space-y-6 p-6">
            {messages.length === 0 && (
              <EmptyState onSuggestion={(s) => setInput(s)} tables={tables.map((t) => t.name)} />
            )}

            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {msg.role === 'user' ? (
                    <UserMessage content={msg.content} />
                  ) : (
                    <AssistantMessage message={msg} showSQL={showSQL} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {/* Bottom anchor for reliable autoscroll inside Radix ScrollArea */}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t bg-background/80 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              placeholder="Ask anything about your data… (Ctrl+K)"
              disabled={isLoading}
              className="flex-1"
              autoFocus
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Keyboard shortcuts (?)"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Keyboard className="h-3.5 w-3.5 text-primary" />
              </div>
              <h2 className="font-semibold">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {[
                { keys: ['Ctrl', 'K'], label: 'Focus input' },
                { keys: ['Enter'], label: 'Send query' },
                { keys: ['?'], label: 'Show this modal' },
                { keys: ['Esc'], label: 'Dismiss modal' },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <div className="flex gap-1">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] font-medium"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

const SUGGESTIONS = [
  'Top 10 customers by revenue',
  'Orders placed last month',
  'Best selling products',
  'Products with low stock',
];

function EmptyState({
  onSuggestion,
  tables,
}: {
  onSuggestion: (s: string) => void;
  tables: string[];
}) {
  // Generate context-aware suggestions from actual table names
  const suggestions = useMemo(() => {
    if (tables.length === 0) return SUGGESTIONS;
    const picked = tables.slice(0, 4);
    return [
      `Show me the top 10 rows from ${picked[0]}`,
      picked[1] ? `How many records are in ${picked[1]}?` : `Count all rows in ${picked[0]}`,
      picked[2] ? `Show recent entries in ${picked[2]}` : `Show columns of ${picked[0]}`,
      picked[3] ? `Summarize data across ${picked[3]}` : `Find duplicates in ${picked[0]}`,
    ];
  }, [tables]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Zap className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">Ask your database anything</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Natural language queries, instant answers.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {content}
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  showSQL,
}: {
  message: ChatMessage;
  showSQL: boolean;
}) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  // Loading state
  if (message.isStreaming) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-3 w-3 text-primary" />
        </div>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="flex gap-1"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        </motion.div>
      </div>
    );
  }

  // Validation rejection
  if (message.plan?.validationVerdict === 'REJECT') {
    return (
      <div className="flex gap-2.5">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-3 w-3 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-destructive">
            Couldn&apos;t run that query
          </p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {message.plan.validationReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Generic error
  if (message.content && !message.execution) {
    return (
      <div className="flex gap-2.5">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-3 w-3 text-destructive" />
        </div>
        <p className="text-sm text-muted-foreground">{message.content}</p>
      </div>
    );
  }

  // Execution result
  if (message.execution) {
    return (
      <div className="space-y-3">
        {/* AI insight with markdown rendering */}
        {message.execution.insight && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-3 w-3 text-primary" />
            </div>
            <div className="flex-1 text-sm leading-relaxed text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic">{children}</em>,
                  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                  ul: ({ children }) => (
                    <ul className="ml-4 mt-1.5 list-disc space-y-0.5">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="ml-4 mt-1.5 list-decimal space-y-0.5">{children}</ol>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      {children}
                    </code>
                  ),
                }}
              >
                {message.execution.insight}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* SQL block — shown only when enabled in settings */}
        {showSQL && message.plan?.sql && <SQLBlock sql={message.plan.sql} />}

        {/* Metadata row + chart/table toggle */}
        <div className="flex items-center justify-between gap-2">
          <MetadataStrip execution={message.execution} />
          {message.execution.rowCount > 1 && message.execution.columns.length >= 2 && (
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <TableIcon className="h-3 w-3" />
                Table
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <BarChart2 className="h-3 w-3" />
                Chart
              </button>
            </div>
          )}
        </div>

        {/* Data display — table or chart */}
        {viewMode === 'chart' ? (
          <ResultChart execution={message.execution} />
        ) : (
          <ResultsTable execution={message.execution} />
        )}
      </div>
    );
  }

  return null;
}