import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Network,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const featureCards = [
  {
    icon: MessageSquare,
    title: 'Ask in plain English',
    description:
      'No SQL required. Ask questions naturally and get the exact data you need in seconds.',
  },
  {
    icon: Lock,
    title: 'Built-in safety',
    description:
      'Every generated query is validated through strict deterministic rules before execution.',
  },
  {
    icon: LayoutDashboard,
    title: 'Instant visual answers',
    description:
      'Get charts, metric cards, and clear business insights automatically from query results.',
  },
  {
    icon: Database,
    title: 'Works with your stack',
    description:
      'Connect MySQL, PostgreSQL, MongoDB, and Elasticsearch from one unified workspace.',
  },
];

const steps = [
  {
    title: 'Connect your data source',
    text: 'Add your connection once. DataIntel maps your schema and prepares context automatically.',
  },
  {
    title: 'Ask your business question',
    text: 'Type naturally like you would ask a teammate: revenue, trends, top customers, or anomalies.',
  },
  {
    title: 'Approve and get results',
    text: 'Review generated query, run it safely, and receive table output plus a human-friendly insight.',
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pb-20 pt-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">DataIntel</p>
              <p className="text-[11px] text-zinc-400">Ask your database in plain English</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-zinc-300 hover:bg-zinc-800 hover:text-white">
              <Link href="/schema">See Schema Explorer</Link>
            </Button>
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-500">
              <Link href="/connect">Get Started</Link>
            </Button>
          </div>
        </header>

        <section className="mx-auto mt-20 max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Built for non-technical teams who need answers, not SQL
          </div>

          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Turn business questions into
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent"> clear data insights</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            DataIntel translates plain-English questions into validated queries, executes them safely,
            and returns results with charts and concise AI explanations your team can act on.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-emerald-600 px-7 text-white hover:bg-emerald-500">
              <Link href="/connect" className="gap-2">
                Connect your data
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-zinc-700 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-800 hover:text-white"
            >
              <Link href="/chat">Open chat workspace</Link>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-zinc-400 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Human-in-the-loop approval
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Deterministic query validation
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Multi-database ready
            </span>
          </div>
        </section>

        <section className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature) => (
            <Card key={feature.title} className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
                  <feature.icon className="h-5 w-5 text-emerald-300" />
                </div>
                <CardTitle className="text-lg text-white">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-zinc-300">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-16 grid gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 lg:grid-cols-2 lg:p-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">How it works</p>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              A guided flow anyone can trust
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
              Designed for non-technical users: simple prompts, safe execution guardrails, and visual output
              that explains itself.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">MySQL</span>
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">PostgreSQL</span>
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">MongoDB</span>
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">Elasticsearch</span>
            </div>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-300">
                    {index + 1}
                  </span>
                  {step.title}
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 flex flex-col items-center justify-between gap-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-indigo-500/10 p-8 text-center sm:flex-row sm:text-left">
          <div>
            <p className="text-sm font-semibold text-emerald-300">Ready to impress your team?</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Launch your first AI-assisted data workflow</h3>
            <p className="mt-2 text-sm text-zinc-200">
              Start with your existing database and generate trusted insights in minutes.
            </p>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline" className="border-zinc-700 bg-zinc-900/50 text-zinc-200 hover:bg-zinc-800">
              <Link href="/schema" className="gap-2">
                <Network className="h-4 w-4" />
                Explore schema
              </Link>
            </Button>
            <Button asChild className="bg-white text-zinc-950 hover:bg-zinc-200">
              <Link href="/connect" className="gap-2">
                <Bot className="h-4 w-4" />
                Start now
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
