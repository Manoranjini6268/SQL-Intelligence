'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Code2, Database, RefreshCw, Keyboard, BarChart2, Layers, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { loadSettings, saveSettings, clearPersistedConnection } from '@/lib/storage';
import type { PersistedSettings } from '@/lib/storage';

const ROW_LIMIT_OPTIONS = [100, 250, 500] as const;
type RowLimit = (typeof ROW_LIMIT_OPTIONS)[number];

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], description: 'Focus chat input' },
  { keys: ['Enter'], description: 'Send query' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Dismiss modal / clear input' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [showSQL, setShowSQL] = useState(true);
  const [rowLimit, setRowLimit] = useState<RowLimit>(500);
  const [dashboardEnabled, setDashboardEnabled] = useState(true);
  const [autoApprove, setAutoApprove] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setShowSQL(s.showSQL);
    setRowLimit((s.rowLimit as RowLimit) ?? 500);
    setDashboardEnabled(s.dashboardEnabled !== false);
    setAutoApprove(s.autoApprove !== false);
    setLoaded(true);
  }, []);

  const save = (patch: Partial<PersistedSettings>) => {
    const next: PersistedSettings = { showSQL, rowLimit, dashboardEnabled, autoApprove, ...patch };
    saveSettings(next);
  };

  const handleToggleSQL = () => {
    const next = !showSQL;
    setShowSQL(next);
    save({ showSQL: next });
  };

  const handleRowLimit = (v: RowLimit) => {
    setRowLimit(v);
    save({ rowLimit: v });
  };

  const handleToggleDashboard = () => {
    const next = !dashboardEnabled;
    setDashboardEnabled(next);
    save({ dashboardEnabled: next });
  };

  const handleToggleAutoApprove = () => {
    const next = !autoApprove;
    setAutoApprove(next);
    save({ autoApprove: next });
  };

  const handleClearSession = () => {
    clearPersistedConnection();
    router.push('/connect');
  };

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-3"
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-6"
        >
          {/* Query Display */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Query Display
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card">
              <SettingRow
                icon={<Code2 className="h-4 w-4 text-primary" />}
                title="Show Generated Query"
                description="Display the generated SQL or ES DSL alongside results"
                checked={showSQL}
                onToggle={handleToggleSQL}
              />
              <SettingRow
                icon={<ShieldCheck className="h-4 w-4 text-primary" />}
                title="Auto-Approve Query Execution"
                description="Automatically run validated queries without waiting for manual approval"
                checked={autoApprove}
                onToggle={handleToggleAutoApprove}
              />
            </div>
          </section>

          {/* Dashboard */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Dashboard
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card">
              <SettingRow
                icon={<LayoutDashboard className="h-4 w-4 text-primary" />}
                title="Enable Dashboard"
                description="Show the dashboard page for drag-and-drop analytics widgets"
                checked={dashboardEnabled}
                onToggle={handleToggleDashboard}
              />
            </div>
          </section>

          {/* Result Limit */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Result Limit
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Max rows per query</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    LIMIT injected into every generated query
                  </p>
                  <div className="mt-3 flex gap-2">
                    {ROW_LIMIT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleRowLimit(opt)}
                        className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                          rowLimit === opt
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Keyboard Shortcuts
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Keyboard className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 space-y-2.5">
                  {SHORTCUTS.map((s) => (
                    <div key={s.description} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{s.description}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k) => (
                          <kbd
                            key={k}
                            className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium"
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
          </section>

          {/* Session */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Session
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Clear Saved Session</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Remove stored credentials and disconnect
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClearSession}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>
          </section>

          {/* About */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              About
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold">Data Intelligence Platform</span>
                <span className="ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  v1.0 MVP
                </span>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">AI Model</dt>
                  <dd className="font-mono text-xs">gpt-oss-120b</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd className="text-xs">Cerebras</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Execution</dt>
                  <dd className="text-xs">Read-Only · MCP Isolated</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Validation</dt>
                  <dd className="text-xs">AST Engine · 9 rules</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Backend</dt>
                  <dd className="text-xs">NestJS · port 3001</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Frontend</dt>
                  <dd className="text-xs">Next.js 14 · port 3000</dd>
                </div>
              </dl>
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        aria-label={`Toggle ${title}`}
        onClick={onToggle}
        className={`relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

