<h1 align="center">SQL Intelligence</h1>
<p align="center">
  Ask your database in plain English.
</p>

![NestJS](https://img.shields.io/badge/NestJS-10.4-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Ready-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)

<br/>

> **MySQL Intelligence** is a production-grade, read-only SQL assistant.  
> Type a question in plain English. Get validated SQL, executed results, interactive charts, and an AI-generated insight — all in seconds.

<br/>

[✨ Features](#-features) &nbsp;·&nbsp; [🏗 Architecture](#-architecture) &nbsp;·&nbsp; [⚡ Quick Start](#-quick-start) &nbsp;·&nbsp; [🔒 Security](#-security-model) &nbsp;·&nbsp; [📡 API](#-api-reference) &nbsp;·&nbsp; [📚 Docs](#-documentation)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🧠 AI-Powered Queries
- Natural language → validated SQL via **Cerebras gpt-oss-120b**
- Schema-aware prompts (compressed to ~400 tokens)
- Confidence scoring on every generated query
- AI-written result insights in **markdown**
- Multi-turn conversation with **auto-compacting memory**

</td>
<td width="50%" valign="top">

### 🛡️ Enterprise-Grade Safety
- **9-rule deterministic AST engine** — never relies on the LLM to be safe
- Read-only enforcement at connection, validator, and connector levels
- **AES-256-CBC** in-memory credential encryption
- Human-in-the-loop approval before any execution
- Re-validation on execute (**defence in depth**)

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📊 Rich Result Visualisation
- Sortable, paginated **results table** (TanStack Table v8)
- Auto-detected **bar / line / pie charts** (recharts)
- CSV and JSON **one-click export**
- Execution time · row count · confidence **metadata strip**
- Syntax-highlighted **SQL block** with copy button

</td>
<td width="50%" valign="top">

### 🗺️ Schema Intelligence
- Interactive **ERD diagram** (@xyflow/react + dagre auto-layout)
- Full **schema browser** with search filtering
- **"Explain DB"** — AI prose walkthrough of your database topology
- One-click table name transfer to chat input
- FK relationship visualisation with directed edges

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🔗 Multi-Database Support
- ✅ **MySQL** — fully tested, mysql2 connection pools
- 🔄 **PostgreSQL** — connector implemented
- 🔄 **MongoDB** — connector implemented
- Pluggable **IMCPConnector** interface for custom databases

</td>
<td width="50%" valign="top">

### 💾 Seamless UX
- Recent connections panel (last 5 hosts, zero passwords stored)
- ⭐ **Pinned queries** sidebar with star/unstar
- Keyboard shortcuts (`Ctrl+K` · `?` · `Esc`)
- Per-tab session isolation via sessionStorage
- Dark-first Tailwind UI with Framer Motion animations

</td>
</tr>
</table>

---

## 🏗 Architecture

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                         BROWSER  (Next.js 14)                             ║
║                                                                           ║
║   ┌──────────┐  ┌───────────────────┐  ┌──────────────┐  ┌───────────┐    ║
║   │ /connect │  │  /chat            │  │  /schema     │  │ /settings │    ║
║   │ form +   │  │  messages ·       │  │  browser +   │  │ toggles + │    ║
║   │ history  │  │  table · chart    │  │  explain·erd │  │ row limit │    ║
║   └────┬─────┘  └──────┬────────────┘  └──────┬───────┘  └───────────┘    ║
║        │               │                      │                           ║
║   useSyncExternalStore─┴─── appStore ──────────┘                          ║
║                                    ↕  localStorage / sessionStorage       ║
╚════════════════════════════════════╤══════════════════════════════════════╝
                                     │  HTTP / JSON  (fetch)
╔════════════════════════════════════▼═════════════════════════════════════╗
║                       NESTJS 10  API SERVER  (port 3001)                 ║
║                                                                          ║
║  ┌─────────────────────┐        ┌───────────────────────────────────┐    ║
║  │  ConnectionModule   │        │         QueryModule               │    ║
║  │  test · connect     │        │  ask() → validate → plan          │    ║
║  │  status · schema    │        │  execute() → revalidate → run     │    ║
║  │  disconnect         │        │  explainSchema() · history        │    ║
║  └──────────┬──────────┘        └─────────────────┬─────────────────┘    ║
║             │                                     │                      ║
║             └──────────────────┬──────────────────┘                      ║
║                                │                                         ║
║  ┌─────────────────────────────▼──────────────────────────────────────┐  ║
║  │                    ValidationService  (Global)                     │  ║
║  │  node-sql-parser AST ──► 9 deterministic rules                     │  ║
║  │  ① single-stmt  ② no-comments     select-only   no-union           │  ║
║  │  ⑤ limit-req    ⑥ subq-depth      table-exists   col-exists        │  ║
║  │  ⑨ join-valid                   auto-patches LIMIT 500             │  ║
║  └────────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  ┌──────────────────┐   ┌────────────────┐   ┌─────────────────────────┐ ║
║  │   LLMModule      │   │  MemoryModule  │   │   SchemaModule  (Global)│ ║
║  │  Cerebras AI     │   │  20-msg window │   │   SchemaGraph O(1) index│ ║
║  │  generateSQL     │   │  auto-compact  │   │   FK edge map · compress│ ║
║  │  interpretResults│   │  4000 tok limit│   │   → LLM token savings   │ ║
║  │  generateFreeText│   └────────────────┘   └─────────────────────────┘ ║
║  └──────────────────┘                                                    ║
║                                                                          ║
║  ┌────────────────────────────────────────────────────────────────────┐  ║
║  │                  MCPService  (Global)  —  Execution Boundary       │  ║
║  │  sessions Map · AES-256-CBC credentials · JSON-RPC 2.0 dispatch    │  ║
║  │  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────┐  │  ║
║  │  │MySQLConnector│   │PostgresConnector │   │MongoDBConnector    │  │  ║
║  │  │mysql2 pools  │   │pg library        │   │mongodb driver      │  │  ║
║  │  └──────┬───────┘   └────────┬─────────┘   └─────────┬──────────┘  │  ║
║  └─────────┼───────────────────-┼──────────────────────-┼─────────────┘  ║
╚════════════╪════════════════════╪═════════════════════════╪══════════════╝
             ▼                    ▼                         ▼
         MySQL DB            PostgreSQL DB             MongoDB
```

---

### 🔄 Query Pipeline — End to End

```
  You: "Top 5 customers by total order value this year?"
        │
        ▼
  ┌──────────────────┐   compressed   ┌──────────────────┐   JSON plan
  │  PromptBuilder   │  schema string │  Cerebras LLM    │───────────────┐
  │  memory window   │──────────────▶│  gpt-oss-120b    │              n│
  │  schema context  │                │  temperature 0.1 │              ▼
  └──────────────────┘                └──────────────────┘    ┌─────────────────────┐
                                                              │  ValidationService  │
                                                              │  9 AST rules        │
                                                              │  ACCEPT / REJECT    │
                                                              └────────┬────────────┘
                                                                       │ ACCEPT
                       Frontend shows SQL + explanation                ▼
   ┌──────────────────────────────┐              ┌─────────────────────────────┐
   │  ResultsTable  ←──────────── │              │  MCPService                 │
   │  ResultChart   ←── rows      │              │  decrypt AES-256 password   │
   │  MetadataStrip ←── time/conf │              │  mysql2 pool.query(sql)     │
   │  AI Insight    ←── markdown  │◀─────────────│  → rows[]                  │
   └──────────────────────────────┘  interpret   └─────────────────────────────┘
                                        ↑
                                  LLM.interpretResults()
                                  markdown insight paragraph
```

---

## ⚡ Quick Start

### Prerequisites

| Requirement | Version |
|---|---|
| **Node.js** | 18 or higher |
| **npm** | 9 or higher |
| **MySQL** | Any accessible instance |
| **Cerebras API Key** | [platform.cerebras.ai](https://platform.cerebras.ai) |

### 1 — Clone & Install

```bash
git clone <repo-url>
cd MySQL_Intelligence

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2 — Configure Environment

Create `backend/.env`:

```env
# ── Required ──────────────────────────────────────────────────
CEREBRAS_API_KEY=csk-xxxxxxxxxxxxxxxxxxxx

# ── Optional (defaults shown) ─────────────────────────────────
PORT=3001
CEREBRAS_API_URL=https://api.cerebras.ai/v1
CEREBRAS_MODEL=gpt-oss-120b
MCP_EXECUTION_TIMEOUT_MS=30000
MCP_MAX_RESULT_ROWS=500
MEMORY_SLIDING_WINDOW_SIZE=20
MEMORY_SUMMARY_TOKEN_THRESHOLD=4000
```

### 3 — Run

```bash
# Terminal 1 — Backend  (watch mode)
cd backend
npm run start:dev
# ✔  Server running on http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm run dev
# ✔  Ready on http://localhost:3000
```

Open **http://localhost:3000**, fill in your MySQL credentials, and start querying.

### 4 — Docker Compose

```bash
docker-compose up --build
# Frontend → http://localhost:3000
# Backend  → http://localhost:3001
```

---

## 🗂 Project Structure

```
MySQL_Intelligence/
│
├── 📁 backend/                         NestJS 10 API server
│   └── src/
│       ├── main.ts                     Bootstrap · port 3001 · CORS
│       ├── app.module.ts               Root module (assembles all modules)
│       │
│       ├── 📁 common/                  Cross-cutting concerns
│       │   ├── config/                 Startup env validation (class-validator)
│       │   ├── filters/                GlobalExceptionFilter
│       │   ├── interceptors/           LoggingInterceptor (method · URL · ms)
│       │   ├── pipes/                  Global ValidationPipe (whitelist: true)
│       │   └── types/                  Shared interfaces & enums
│       │
│       ├── 📁 mcp/                     MCP connector layer  [GLOBAL]
│       │   ├── mcp.service.ts          Session map · AES-256 · JSON-RPC 2.0
│       │   └── connectors/
│       │       ├── mysql.connector.ts  mysql2 pools · info_schema introspection
│       │       ├── postgres.connector.ts
│       │       └── mongo.connector.ts
│       │
│       ├── 📁 schema/                  Schema indexing  [GLOBAL]
│       │   ├── schema-graph.ts         Hash-indexed O(1) table/column/FK lookups
│       │   └── schema.service.ts       Session → SchemaGraph cache
│       │
│       ├── 📁 validation/              AST rules engine  [GLOBAL]
│       │   ├── validation.service.ts   Orchestrates 9 rules, collects all failures
│       │   └── rules/                  One file per rule (9 total)
│       │
│       ├── 📁 llm/                     AI orchestration
│       │   ├── llm.service.ts          generateSQL · interpretResults · freeText
│       │   └── prompt-builder.service.ts System prompt · schema injection
│       │
│       ├── 📁 memory/                  Conversation memory  [GLOBAL]
│       │   └── memory.service.ts       Sliding window · auto-compaction at 4000 tokens
│       │
│       ├── 📁 connection/              Connection HTTP endpoints
│       │   └── connection.controller.ts test · connect · status · schema · disconnect
│       │
│       └── 📁 query/                   Query HTTP endpoints
│           ├── query.controller.ts      ask · execute · explain · stream · history
│           └── query.service.ts         Full pipeline orchestration
│
├── 📁 frontend/                        Next.js 14 App Router
│   └── src/
│       ├── 📁 app/                     File-system routing
│       │   ├── connect/page.tsx        DB form + recent connections
│       │   ├── chat/page.tsx           Conversational interface
│       │   ├── schema/page.tsx         Schema browser + Explain DB
│       │   ├── schema/erd/page.tsx     Interactive ERD diagram
│       │   └── settings/page.tsx       Preferences (SQL toggle · row limit)
│       │
│       ├── 📁 components/
│       │   ├── chat/
│       │   │   ├── results-table.tsx   TanStack Table · CSV/JSON export
│       │   │   ├── result-chart.tsx    recharts · auto-detect chart type
│       │   │   ├── sql-block.tsx       Syntax highlight · clipboard copy
│       │   │   └── metadata-strip.tsx  Time · rows · tables · confidence
│       │   └── schema/
│       │       └── schema-graph.tsx    @xyflow/react + dagre layout
│       │
│       └── 📁 lib/
│           ├── api.ts                  Typed fetch wrappers (all endpoints)
│           ├── store.ts                useSyncExternalStore singleton
│           ├── use-session.ts          Domain hook (connect · disconnect · messages)
│           ├── storage.ts              localStorage / sessionStorage helpers
│           └── types.ts                ChatMessage · ConnectionResponse · QueryPlan
│
├── docker-compose.yml
├── README.md                           This file
├── DOCS.md                             Full implementation reference
└── STUDY_GUIDE.md                      Deep module-by-module study guide
```

---

## 🔒 Security Model

### The 9 Validation Rules

Every AI-generated SQL passes through `node-sql-parser` AST analysis. Cheap checks run first; all failures are collected before returning.

| # | Rule | What It Blocks |
|:-:|---|---|
| ① | **single-statement** | `SELECT 1; DROP TABLE users` — semicolon injection |
| ② | **no-comments** | `SELECT * -- bypass` — comment-based predicate removal |
| ③ | **select-only** | Any DML/DDL: INSERT · UPDATE · DELETE · DROP · CREATE |
| ④ | **no-union** | `UNION SELECT password FROM credentials` — cross-table exfiltration |
| ⑤ | **limit-required** | Unbounded full-table scans — *auto-patches `LIMIT 500`* |
| ⑥ | **subquery-depth** | Deeply nested obfuscation (max nesting depth: 2) |
| ⑦ | **table-exists** | Hallucinated tables, cross-session table guessing |
| ⑧ | **column-exists** | Hallucinated column names, unqualified ambiguous refs |
| ⑨ | **join-validation** | Invalid JOINs not backed by FK relationships in schema |

### Credential Encryption

```
  User password (plaintext)
          │
          ▼  createCipheriv('aes-256-cbc', runtimeKey, randomIV)
  encryptedPassword  ←──  stored in activeParams Map (heap only)
          │
          └─── runtimeKey  ←  scryptSync(randomSecret, randomSalt, 32)
                               ↑ generated ONCE on process start
                               ↑ NEVER logged · NEVER persisted · heap only

  On query execution:
  createDecipheriv(runtimeKey, storedIV) → plaintext password in-scope only
```

### Layered Defence Architecture

```
  Incoming request
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ ① ValidationPipe  whitelist:true — strips unknown DTO fields    │
  │ ② /ask endpoint   — generate + validate (never auto-execute)    │
  │ ③ HUMAN APPROVAL  — user must explicitly click Execute          │
  │ ④ /execute endpoint — re-validate SQL as untrusted input        │
  │ ⑤ MCPService      — capability check · timeout · row cap        │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 📡 API Reference

### Connection Endpoints

| Method | Endpoint | Description |
|:---:|---|---|
| `POST` | `/api/connection/test` | Test credentials without creating a session |
| `POST` | `/api/connection/connect` | Create session, introspect schema, return `sessionId` |
| `GET` | `/api/connection/status/:id` | `{ connected: boolean }` |
| `GET` | `/api/connection/schema/:id` | Full `SchemaTopology` (tables, columns, FKs) |
| `POST` | `/api/connection/disconnect/:id` | Destroy session, wipe encrypted credentials |

### Query Endpoints

| Method | Endpoint | Description |
|:---:|---|---|
| `POST` | `/api/query/ask` | NL → SQL plan. **Never auto-executes.** |
| `POST` | `/api/query/generate` | Alias for `/ask` |
| `POST` | `/api/query/execute` | Execute approved plan (requires `approved: true`) |
| `POST` | `/api/query/explain` | Schema prose explanation (bypasses SQL pipeline) |
| `GET` | `/api/query/stream` | SSE token stream |
| `GET` | `/api/query/history/:id` | Query history for session |

<details>
<summary><strong>📋 Full request / response examples</strong></summary>

```jsonc
// POST /api/connection/connect
{
  "host": "localhost",
  "port": 3306,
  "username": "root",
  "password": "••••••••",
  "database": "shop",
  "connectorType": "mysql"
}
// → 200
{
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "database": "shop",
  "tables": ["orders", "products", "users", "categories"],
  "connectedAt": "2026-02-28T10:00:00.000Z"
}
```

```jsonc
// POST /api/query/ask
{
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "question": "Top 5 customers by total order value this year"
}
// → 200
{
  "plan": {
    "sql": "SELECT u.name, SUM(o.total) AS total_value FROM users u JOIN orders o ON u.id = o.user_id WHERE YEAR(o.created_at) = YEAR(NOW()) GROUP BY u.id, u.name ORDER BY total_value DESC LIMIT 5",
    "explanation": "Joins users and orders, filters to current year, sums order totals, ranks by value",
    "confidence": 0.93,
    "tablesUsed": ["users", "orders"],
    "approved": false,
    "validationVerdict": "ACCEPT",
    "validationReasons": []
  }
}
```

```jsonc
// POST /api/query/execute
{
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "plan": { "sql": "SELECT ...", "approved": false },
  "approved": true
}
// → 200
{
  "rows": [
    { "name": "Alice Johnson", "total_value": 12450.00 },
    { "name": "Bob Martinez",  "total_value":  9900.50 }
  ],
  "insight": "**Alice Johnson** leads all customers with **$12,450** in orders this year, nearly 26% ahead of second place...",
  "executionTimeMs": 234,
  "rowCount": 5,
  "columns": ["name", "total_value"]
}
```

</details>

---

## 🧰 Tech Stack

<table>
<tr>
<th>Layer</th>
<th>Technology</th>
<th>Version</th>
<th>Role</th>
</tr>
<tr>
<td>🖥️ Backend</td>
<td><strong>NestJS</strong></td>
<td><code>10.4</code></td>
<td>Modular API framework, dependency injection, pipes &amp; filters</td>
</tr>
<tr>
<td>🌐 Frontend</td>
<td><strong>Next.js</strong> App Router</td>
<td><code>14.2</code></td>
<td>React meta-framework, file-system routing, client components</td>
</tr>
<tr>
<td>🤖 LLM</td>
<td><strong>Cerebras</strong> gpt-oss-120b</td>
<td>—</td>
<td>Natural language → SQL · result interpretation · schema explain</td>
</tr>
<tr>
<td>🔌 LLM SDK</td>
<td><strong>openai</strong> SDK</td>
<td><code>4.60</code></td>
<td>API client with custom Cerebras baseURL</td>
</tr>
<tr>
<td>🔍 SQL Parse</td>
<td><strong>node-sql-parser</strong></td>
<td><code>5.3</code></td>
<td>AST-based deterministic SQL validation (9 rules)</td>
</tr>
<tr>
<td>📊 Charts</td>
<td><strong>recharts</strong></td>
<td><code>2.x</code></td>
<td>Auto-detected bar / line / pie result visualisation</td>
</tr>
<tr>
<td>📋 Tables</td>
<td><strong>TanStack Table</strong></td>
<td><code>v8</code></td>
<td>Sortable, paginated results with CSV/JSON export</td>
</tr>
<tr>
<td>🗺️ ERD</td>
<td><strong>@xyflow/react</strong> + dagre</td>
<td>latest</td>
<td>Interactive FK relationship diagram with auto-layout</td>
</tr>
<tr>
<td>🎨 UI</td>
<td><strong>Tailwind CSS</strong> + Radix UI</td>
<td><code>3.4</code></td>
<td>Utility-first dark theme, accessible headless primitives</td>
</tr>
<tr>
<td>✨ Motion</td>
<td><strong>Framer Motion</strong></td>
<td><code>11</code></td>
<td>Page transitions and element animations</td>
</tr>
<tr>
<td>🐳 Deploy</td>
<td><strong>Docker Compose</strong></td>
<td>latest</td>
<td>Multi-container production deployment</td>
</tr>
</table>

---

## ⌨️ Keyboard Shortcuts

| Keys | Action |
|:---:|---|
| `Ctrl` + `K` | Focus chat input |
| `Enter` | Send query |
| `?` | Open keyboard shortcuts reference |
| `Esc` | Dismiss modal |

---

## 🌍 Environment Variables

### Backend `backend/.env`

| Variable | Default | Required | Description |
|---|---|:---:|---|
| `CEREBRAS_API_KEY` | — | ✅ | Your Cerebras platform API key |
| `PORT` | `3001` | — | API server port |
| `CEREBRAS_API_URL` | `https://api.cerebras.ai/v1` | — | Cerebras API base URL |
| `CEREBRAS_MODEL` | `gpt-oss-120b` | — | Model identifier |
| `MCP_EXECUTION_TIMEOUT_MS` | `30000` | — | Max query execution time (ms) |
| `MCP_MAX_RESULT_ROWS` | `500` | — | Maximum rows returned per query |
| `MEMORY_SLIDING_WINDOW_SIZE` | `20` | — | Conversation context window size |
| `MEMORY_SUMMARY_TOKEN_THRESHOLD` | `4000` | — | Token count that triggers auto-compaction |

### Frontend `frontend/.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | Backend API URL |

---

## 📚 Documentation

| Document | Description |
|---|---|
| **[DOCS.md](DOCS.md)** | Complete implementation reference — all modules, endpoints, types, storage strategy, and data flow diagrams |
| **[STUDY_GUIDE.md](STUDY_GUIDE.md)** | Deep module-by-module study guide — every design decision, algorithm, and pattern explained with code examples |

---

<div align="center">

---

Made with ☕ and too many late nights.

**NestJS** &nbsp;·&nbsp; **Next.js 14** &nbsp;·&nbsp; **Cerebras AI** &nbsp;·&nbsp; **TypeScript**

---

[DOCS.md](DOCS.md) &nbsp;·&nbsp; [STUDY_GUIDE.md](STUDY_GUIDE.md)

</div>
