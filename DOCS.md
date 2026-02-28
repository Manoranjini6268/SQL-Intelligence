# MySQL Intelligence — Complete Implementation Documentation

> A natural-language-to-SQL query interface powered by Cerebras AI (gpt-oss-120b), NestJS, and Next.js 14 App Router.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Feature Catalogue](#2-feature-catalogue)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Environment Setup](#5-environment-setup)
6. [Running the Application](#6-running-the-application)
7. [Backend Architecture](#7-backend-architecture)
   - 7.1 [Module Graph](#71-module-graph)
   - 7.2 [MCPService — Connection Lifecycle](#72-mcpservice--connection-lifecycle)
   - 7.3 [SchemaService & SchemaGraph](#73-schemaservice--schemagraph)
   - 7.4 [ValidationService — AST Rules Engine](#74-validationservice--ast-rules-engine)
   - 7.5 [LLMService — AI Layer](#75-llmservice--ai-layer)
   - 7.6 [PromptBuilderService](#76-promptbuilderservice)
   - 7.7 [MemoryService — Sliding Window Context](#77-memoryservice--sliding-window-context)
   - 7.8 [QueryService — Full Pipeline](#78-queryservice--full-pipeline)
   - 7.9 [ConnectionController](#79-connectioncontroller)
   - 7.10 [QueryController](#710-querycontroller)
8. [AI Query Pipeline (end-to-end)](#8-ai-query-pipeline-end-to-end)
9. [API Reference](#9-api-reference)
10. [Frontend Architecture](#10-frontend-architecture)
    - 10.1 [Pages](#101-pages)
    - 10.2 [State Management — Store & useSession](#102-state-management--store--usesession)
    - 10.3 [Key Components](#103-key-components)
    - 10.4 [localStorage / sessionStorage Strategy](#104-localstorage--sessionstorage-strategy)
11. [Frontend Page Walkthrough](#11-frontend-page-walkthrough)
    - 11.1 [/connect](#111-connect)
    - 11.2 [/chat](#112-chat)
    - 11.3 [/schema](#113-schema)
    - 11.4 [/schema/erd](#114-schemaerd)
    - 11.5 [/settings](#115-settings)
12. [Data Flow Diagrams](#12-data-flow-diagrams)
13. [Security Model](#13-security-model)
14. [Keyboard Shortcuts Reference](#14-keyboard-shortcuts-reference)

---

## 1. Project Overview

**MySQL Intelligence** is a full-stack read-only query assistant for MySQL databases. Users connect to any MySQL instance, then chat with it in plain English. The AI translates natural-language questions into validated SQL, executes them, and returns both raw results and an AI-generated interpretation.

### Core capabilities
| Capability | Description |
|---|---|
| NL → SQL | Cerebras gpt-oss-120b translates questions to validated SELECT queries |
| Safety validation | 9-rule AST engine rejects mutations, unbounded scans, injection attempts |
| Schema awareness | Full schema compressed into every LLM prompt — tables, columns, FKs |
| Conversation memory | Sliding 20-message window with automatic compaction |
| Result visualisation | Auto-detected bar / line / pie charts via recharts |
| ERD diagram | Interactive @xyflow/react force-directed graph of tables and FK edges |
| Schema explain | AI prose walkthrough of the entire database topology |
| Pinned queries | Star any query to pin in the history sidebar |
| Recent connections | Last 5 connections stored locally for one-click re-connect |
| Settings | Row-limit selector, SQL visibility toggle, session reset |
| Streaming | SSE endpoint for real-time token streaming (schema explain) |

---

## 2. Feature Catalogue

### Connection
- MySQL host/port/user/password/database form with test-before-connect
- AES-256 in-memory credential encryption (never written to disk on backend)
- Recent connections panel — last 5 entries, click to pre-fill form
- Connection status indicator persisted in localStorage

### Chat
- Conversational NL query interface
- Per-message states: `pending` → `streaming` → `done` / `error`
- SQL block for each response with syntax highlighting + one-click copy
- Results table: sortable columns, row count, CSV/JSON export
- AI insight paragraph below the table
- Metadata strip: query time, row count, affected tables, confidence score
- Auto-detected charts (bar/line/pie) with chart-type toggle
- Pinned queries sidebar with star/unstar
- History sidebar showing previous queries
- `?` keyboard shortcut modal
- `Ctrl+K` focus shortcut

### Schema Explorer
- Searchable table list with column type pills
- "Explain DB" button — AI prose summary of schema design
- One-click transfer of a table name to chat pre-fill
- Link to ERD view

### ERD Diagram
- @xyflow/react canvas with dagre auto-layout
- Table nodes coloured by relationship type
- FK edges with arrowheads
- Minimap, pan, zoom controls

### Settings
- Show SQL toggle (persisted)
- Row limit selector: 100 / 250 / 500 (persisted)
- Keyboard shortcuts reference
- Version / stack info card
- Clear session button (wipes localStorage + redirects to /connect)

---

## 3. Tech Stack

### Backend — `backend/`
| Technology | Version | Role |
|---|---|---|
| NestJS | 10.4 | Framework, DI, module system |
| TypeScript | 5.x | Type safety |
| openai SDK | latest | Cerebras AI calls (custom baseURL) |
| node-sql-parser | latest | SQL AST parsing for validation |
| @anthropic-ai/sdk | (installed) | Reserved / future use |
| ConfigModule | built-in | .env loading + validation |

### Frontend — `frontend/`
| Technology | Version | Role |
|---|---|---|
| Next.js | 14.2 (App Router) | React meta-framework |
| React | 18 | UI rendering |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| Framer Motion | 11 | Page / element animations |
| @xyflow/react | latest | ERD canvas |
| dagre | latest | ERD auto-layout |
| recharts | latest | Bar / line / pie charts |
| @tanstack/react-table | v8 | Results table |
| react-markdown + remark-gfm | latest | AI insight rendering |
| Radix UI | latest | Headless UI primitives |
| lucide-react | latest | Icons |
| openai SDK | latest | (imported for types) |

---

## 4. Repository Structure

```
MySQL_Intelligence/
├── backend/
│   ├── src/
│   │   ├── main.ts                   # Bootstrap — port 3001, CORS
│   │   ├── app.module.ts             # Root module — wires all modules
│   │   ├── connection/
│   │   │   ├── connection.controller.ts
│   │   │   └── connection.module.ts
│   │   ├── mcp/
│   │   │   ├── mcp.service.ts        # Connector registry + session map
│   │   │   └── mcp.module.ts
│   │   ├── schema/
│   │   │   ├── schema.service.ts     # Session → SchemaGraph map
│   │   │   ├── schema-graph.ts       # In-memory schema index
│   │   │   └── schema.module.ts
│   │   ├── validation/
│   │   │   ├── validation.service.ts # 9-rule AST engine
│   │   │   └── validation.module.ts
│   │   ├── llm/
│   │   │   ├── llm.service.ts        # AI calls (SQL, interpret, free text)
│   │   │   ├── prompt-builder.service.ts
│   │   │   └── llm.module.ts
│   │   ├── memory/
│   │   │   ├── memory.service.ts     # Sliding window, auto-compact
│   │   │   └── memory.module.ts
│   │   └── query/
│   │       ├── query.service.ts      # Orchestrates full pipeline
│   │       ├── query.controller.ts   # All /query/* endpoints
│   │       └── query.module.ts
│   ├── .env                          # CEREBRAS_API_KEY etc.
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Redirects → /connect
│   │   │   ├── connect/page.tsx      # Connection form
│   │   │   ├── chat/page.tsx         # Main chat interface
│   │   │   ├── schema/
│   │   │   │   ├── page.tsx          # Schema browser
│   │   │   │   └── erd/page.tsx      # ERD diagram
│   │   │   └── settings/page.tsx     # Settings
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── results-table.tsx
│   │   │   │   ├── result-chart.tsx
│   │   │   │   ├── sql-block.tsx
│   │   │   │   └── metadata-strip.tsx
│   │   │   └── schema/
│   │   │       └── schema-graph.tsx  # ERD @xyflow canvas
│   │   ├── lib/
│   │   │   ├── api.ts                # All fetch wrappers
│   │   │   ├── storage.ts            # localStorage / sessionStorage helpers
│   │   │   ├── store.ts              # Global singleton store
│   │   │   ├── use-session.ts        # React hook over store
│   │   │   └── types.ts              # Shared TypeScript types
│   │   └── hooks/
│   └── package.json
│
└── DOCS.md                           # This file
```

---

## 5. Environment Setup

### Backend `.env`

```env
# Required
CEREBRAS_API_KEY=your_cerebras_api_key_here

# Optional overrides (defaults shown)
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1
LLM_MODEL=gpt-oss-120b
PORT=3001
```

### Frontend `.env.local` (optional)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

If not set, `api.ts` defaults to `http://localhost:3001`.

### Prerequisites

- Node.js 18+
- npm 9+
- A running MySQL instance accessible from your machine

---

## 6. Running the Application

### Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Start both servers

```bash
# Terminal 1 — Backend (watch mode, auto-restart on file save)
cd backend
npm run start:dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

### Available scripts

| Location | Script | Effect |
|---|---|---|
| backend | `npm run start:dev` | NestJS watch mode on port 3001 |
| backend | `npm run build` | Compile to `dist/` |
| backend | `npm run start:prod` | Run compiled dist |
| frontend | `npm run dev` | Next.js dev server on port 3000 |
| frontend | `npm run build` | Production build |
| frontend | `npm run start` | Serve production build |

---

## 7. Backend Architecture

### 7.1 Module Graph

```
AppModule
├── ConfigModule (global)          # .env → ConfigService
├── MCPModule (global)             # Connection registry + session lifecycle
├── SchemaModule (global)          # Per-session in-memory schema index
├── ValidationModule (global)      # SQL AST rules engine
├── MemoryModule (global)          # Conversation memory per session
├── LLMModule                      # AI service + prompt builder
├── ConnectionModule               # REST: /api/connection/*
└── QueryModule                    # REST: /api/query/*
```

Modules marked `global: true` can be injected anywhere without re-importing their module.

---

### 7.2 MCPService — Connection Lifecycle

**File:** `backend/src/mcp/mcp.service.ts`

MCPService is the central gatekeeper for database connectivity.

#### Responsibilities
- Maintains a `Map<sessionId, ConnectionSession>` — one entry per connected user
- Supports connector types: `mysql`, `postgres`, `mongodb` (mysql used in this project)
- Password handling: The raw password is AES-256-CBC encrypted using a server-side ephemeral key and only the ciphertext is kept in the session map. The key never leaves process memory.
- Exposes `executeReadQuery(sessionId, sql)` — the single exit point through which ALL user SQL passes

#### Key Methods
| Method | Description |
|---|---|
| `testConnection(params)` | Creates a temporary connector, runs `SELECT 1`, then destroys it |
| `connect(params)` → `sessionId` | Creates a permanent session, encrypts credentials |
| `disconnect(sessionId)` | Removes session, closes pool |
| `getStatus(sessionId)` | Returns `{ connected: boolean }` |
| `executeReadQuery(sessionId, sql)` | Decrypts credentials on-demand, executes SQL, returns rows |
| `getConnectionParams(sessionId)` | Returns params (password redacted) |

#### Session object shape
```typescript
interface ConnectionSession {
  params: ConnectionParams;           // host, port, user, database
  encryptedPassword: string;          // AES-256-CBC ciphertext
  encryptionKey: Buffer;              // 32-byte ephemeral key (in memory only)
  iv: Buffer;                         // 16-byte IV
  connectedAt: Date;
}
```

---

### 7.3 SchemaService & SchemaGraph

**Files:** `backend/src/schema/schema.service.ts`, `backend/src/schema/schema-graph.ts`

#### SchemaService
- Maintains `Map<sessionId, SchemaGraph>`
- `loadSchema(sessionId)` — queries `information_schema.COLUMNS` and `information_schema.KEY_COLUMN_USAGE` to build a full schema graph, then caches it
- `getCompressedSchema(sessionId)` — returns a compact string representation suitable for LLM prompts (`tableName(col1:type, col2:type FK→other.id)`)
- `getStructuredSchema(sessionId)` — returns `SchemaTopology` JSON for the frontend schema browser and ERD

#### SchemaGraph
An in-memory indexed data structure:

```typescript
class SchemaGraph {
  private tables: Map<string, TableNode>;         // tableName → node
  private columnIndex: Map<string, ColumnInfo[]>; // tableName → columns
  private fkIndex: Map<string, FKEdge[]>;         // tableName → outgoing FKs
  private reverseFkIndex: Map<string, FKEdge[]>;  // tableName → incoming FKs
}
```

- `compressToString()` — produces minimal schema string for LLM context window
- `getStructuredSchema()` — full topology for frontend consumption
- Supports `tableExists(name)`, `columnExists(table, col)`, `getFKs(table)`, `getReverseFKs(table)`

---

### 7.4 ValidationService — AST Rules Engine

**File:** `backend/src/validation/validation.service.ts`

Uses `node-sql-parser` to parse SQL into an AST, then applies 9 sequential rules. A rule failure returns a `ValidationResult` with `{ valid: false, reason: string }`. All rules must pass for approval.

#### The 9 Rules (applied in order)

| # | Rule | Description |
|---|---|---|
| 1 | **SingleStatement** | Only one SQL statement allowed. Blocks `; DROP TABLE` style attacks. |
| 2 | **NoComments** | Strips and rejects SQL containing `--` or `/* */` comments that could be used for injection. |
| 3 | **SelectOnly** | The parsed AST root must be a `SELECT` statement. Blocks any DML (INSERT, UPDATE, DELETE, DROP, etc.). |
| 4 | **NoUnion** | UNION queries are blocked to prevent data exfiltration across unrelated tables. |
| 5 | **LimitRequired** | Every query must have a LIMIT clause. If absent, ValidationService **auto-patches** with `LIMIT 500`. |
| 6 | **SubqueryDepth** | Subqueries are permitted but maximum nesting depth is 2. Blocks complex obfuscation chains. |
| 7 | **TableExists** | Every referenced table must exist in the SchemaGraph for the current session. |
| 8 | **ColumnExists** | Every referenced column must exist in its respective table. `*` is whitelisted. |
| 9 | **JoinValidation** | JOIN conditions must reference columns that actually exist and form valid FK relationships. |

#### ValidationResult
```typescript
interface ValidationResult {
  valid: boolean;
  reason?: string;     // human-readable rejection reason
  patchedSQL?: string; // SQL with auto-added LIMIT if rule 5 triggered
}
```

---

### 7.5 LLMService — AI Layer

**File:** `backend/src/llm/llm.service.ts`

All AI calls go through this service. Uses the `openai` SDK pointed at `https://api.cerebras.ai/v1` with model `gpt-oss-120b`.

#### Methods

**`generateSQL(messages, schema, database)`** → `QueryPlan`
- Sends conversation history + compressed schema
- Expects structured JSON response: `{ sql, explanation, confidence, tables_used }`
- Parses JSON from response content
- Retries once if JSON parsing fails
- Returns `QueryPlan`

**`interpretResults(sql, results, question, database)`** → `string`
- Post-execution insight generation
- System prompt instructs it to be a data analyst explaining the result set
- Returns plain markdown string

**`generateFreeText(systemPrompt, userContent, maxTokens?)`** → `string`
- General-purpose text generation (no JSON expectation)
- Used for schema explain and potentially other narrative features
- `maxTokens` defaults to 2048

**`streamExplanation(prompt, onChunk)`** → `void`
- SSE-style streaming using the OpenAI SDK's stream mode
- Calls `onChunk(deltaText)` for each token as it arrives

---

### 7.6 PromptBuilderService

**File:** `backend/src/llm/prompt-builder.service.ts`

Constructs the system prompt handed to the LLM on every query generation call.

#### System prompt components

1. **Role declaration** — "You are an expert SQL assistant for a MySQL database…"
2. **Hard rules** — 9 absolute rules the model must follow (mirrors the validation layer):
   - Output only valid SELECT statements
   - Never use DML
   - Always include LIMIT ≤ 500
   - Use only tables/columns from the provided schema
   - No UNION queries
   - No comments in SQL
   - Prefer JOINs over subqueries where possible
   - Subquery nesting max depth 2
   - JSON output format only
3. **Schema block** — compressed schema string injected here
4. **Output format** — strict JSON: `{ "sql": "...", "explanation": "...", "confidence": 0.0-1.0, "tables_used": ["..."] }`

**`contextToMessages(history)`**
Converts `MemoryEntry[]` from MemoryService into the `messages` array format for the OpenAI SDK, interleaving user/assistant turns.

---

### 7.7 MemoryService — Sliding Window Context

**File:** `backend/src/memory/memory.service.ts`

Provides per-session conversation context for multi-turn queries.

#### Strategy
- Session map: `Map<sessionId, MemoryEntry[]>`
- Maximum window size: **20 messages**
- Auto-compaction threshold: **~4000 estimated tokens**

#### Auto-compaction
When the estimated token count of the window exceeds the threshold:
1. The oldest 75% of messages are summarised by the LLM into a single summary entry
2. The summary replaces those messages in the window
3. The most recent messages are preserved verbatim

This allows indefinitely long sessions without hitting context limits.

#### Methods
| Method | Description |
|---|---|
| `addMessage(sessionId, role, content)` | Append to window, trigger compaction check |
| `getContext(sessionId)` | Return full window as `MemoryEntry[]` |
| `clearSession(sessionId)` | Wipe memory for session |

---

### 7.8 QueryService — Full Pipeline

**File:** `backend/src/query/query.service.ts`

Orchestrates the complete NL→SQL→execute→interpret cycle.

#### `ask(sessionId, question)` — main entry point

```
1. MemoryService.getContext(sessionId)
2. SchemaService.getCompressedSchema(sessionId)
3. PromptBuilder.buildSystemPrompt(schema)
4. LLMService.generateSQL(messages, schema, db)  →  QueryPlan
5. ValidationService.validate(plan.sql, sessionId) →  ValidationResult
   ├─ if invalid: return { valid: false, reason }
   └─ if valid (or patched): approve plan
6. MemoryService.addMessage(sessionId, 'user', question)
7. Return approved QueryPlan to controller
```

#### `executeApproved(sessionId, plan)` — execute after frontend confirms

```
1. Re-validate SQL (defence in depth — prevents tampered payloads)
2. MCPService.executeReadQuery(sessionId, sql)  →  rows[]
3. LLMService.interpretResults(sql, rows, question, db)  →  insight
4. MemoryService.addMessage(sessionId, 'assistant', insight)
5. Return { rows, insight, executionTime, rowCount }
```

#### `explainSchema(schemaSummary, databaseName)` — schema prose

Bypasses the SQL pipeline entirely.
```
1. Build system prompt for "database documentation expert"
2. LLMService.generateFreeText(systemPrompt, schemaSummary, 2048)
3. Return { explanation }
```

#### Query History
- Stores last N executed queries per session in a `Map<sessionId, QueryRecord[]>`
- Retrieved via `GET /api/query/history/:sessionId`

---

### 7.9 ConnectionController

**File:** `backend/src/connection/connection.controller.ts`

All routes under `/api/connection`.

| Method | Route | Handler |
|---|---|---|
| POST | `/api/connection/test` | `testConnection(dto)` |
| POST | `/api/connection/connect` | `connect(dto)` → creates session |
| GET | `/api/connection/status/:id` | `getStatus(id)` |
| GET | `/api/connection/schema/:id` | `getSchema(id)` → SchemaTopology |
| POST | `/api/connection/disconnect/:id` | `disconnect(id)` |

---

### 7.10 QueryController

**File:** `backend/src/query/query.controller.ts`

All routes under `/api/query`.

| Method | Route | Handler |
|---|---|---|
| POST | `/api/query/ask` | Generate SQL plan (no execution) |
| POST | `/api/query/generate` | Alias for ask |
| POST | `/api/query/execute` | Execute an approved plan |
| POST | `/api/query/explain` | Schema explanation (free text) |
| GET | `/api/query/stream` | SSE streaming endpoint |
| GET | `/api/query/history/:id` | Retrieve query history |

---

## 8. AI Query Pipeline (end-to-end)

```
User types question in chat
         │
         ▼
frontend/api.ts  →  POST /api/query/ask
         │
         ▼
QueryService.ask()
  ├── Load conversation history (MemoryService)
  ├── Load compressed schema (SchemaService)
  ├── Build system prompt (PromptBuilderService)
  ├── Call LLM (LLMService.generateSQL)
  │     └── Returns: { sql, explanation, confidence, tables_used }
  └── Validate SQL (ValidationService)
        ├── Rule 1: Single statement?          ✓/✗
        ├── Rule 2: No comments?               ✓/✗
        ├── Rule 3: SELECT only?               ✓/✗
        ├── Rule 4: No UNION?                  ✓/✗
        ├── Rule 5: Has LIMIT? (auto-patch)    ✓/patch
        ├── Rule 6: Subquery depth ≤ 2?        ✓/✗
        ├── Rule 7: Tables exist in schema?    ✓/✗
        ├── Rule 8: Columns exist in table?    ✓/✗
        └── Rule 9: JOIN columns valid?        ✓/✗
         │
         ▼ (if valid)
Frontend receives QueryPlan
  └── Shows SQL + explanation to user
  └── User clicks "Execute" (or auto-executes)
         │
         ▼
frontend/api.ts  →  POST /api/query/execute  { plan, approved: true }
         │
         ▼
QueryService.executeApproved()
  ├── Re-validate SQL (defence-in-depth)
  ├── MCPService.executeReadQuery()  →  rows[]
  ├── LLMService.interpretResults()  →  insight paragraph
  └── MemoryService.addMessage()
         │
         ▼
Frontend receives { rows, insight, executionTime, rowCount }
  └── Renders: ResultsTable + ResultChart + MetadataStrip + AI insight
```

---

## 9. API Reference

### Connection endpoints

#### `POST /api/connection/test`
```json
// Request
{ "host": "localhost", "port": 3306, "user": "root", "password": "...", "database": "shop" }

// Response
{ "success": true, "message": "Connection successful" }
```

#### `POST /api/connection/connect`
```json
// Request (same as test)
{ "host": "...", "port": 3306, "user": "...", "password": "...", "database": "..." }

// Response
{
  "sessionId": "uuid-v4",
  "database": "shop",
  "tables": ["orders", "products", "users"],
  "connectedAt": "2025-01-01T00:00:00.000Z"
}
```

#### `GET /api/connection/status/:sessionId`
```json
{ "connected": true }
```

#### `GET /api/connection/schema/:sessionId`
```json
{
  "tables": [
    {
      "name": "orders",
      "columns": [
        { "name": "id", "type": "int", "nullable": false, "isPrimaryKey": true },
        { "name": "user_id", "type": "int", "nullable": false, "isForeignKey": true }
      ],
      "foreignKeys": [
        { "column": "user_id", "referencedTable": "users", "referencedColumn": "id" }
      ]
    }
  ]
}
```

#### `POST /api/connection/disconnect/:sessionId`
```json
{ "success": true }
```

---

### Query endpoints

#### `POST /api/query/ask`
```json
// Request
{ "sessionId": "...", "question": "How many orders were placed this month?" }

// Response — QueryPlan
{
  "sql": "SELECT COUNT(*) AS order_count FROM orders WHERE MONTH(created_at) = MONTH(NOW()) LIMIT 500",
  "explanation": "Counts orders created in the current calendar month",
  "confidence": 0.95,
  "tablesUsed": ["orders"],
  "approved": false
}
```

#### `POST /api/query/execute`
```json
// Request
{
  "sessionId": "...",
  "plan": { "sql": "...", "explanation": "...", "confidence": 0.95, "tablesUsed": ["orders"] },
  "approved": true
}

// Response — QueryExecutionResult
{
  "rows": [{ "order_count": 142 }],
  "insight": "There have been **142 orders** this month...",
  "executionTimeMs": 23,
  "rowCount": 1
}
```

#### `POST /api/query/explain`
```json
// Request
{ "schemaSummary": "orders(id:int, user_id:int FK→users.id, ...) ...", "databaseName": "shop" }

// Response
{ "explanation": "This database models an e-commerce platform..." }
```

#### `GET /api/query/history/:sessionId`
```json
{
  "queries": [
    { "sql": "SELECT ...", "question": "...", "executedAt": "...", "rowCount": 5 }
  ]
}
```

---

## 10. Frontend Architecture

### 10.1 Pages

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Redirect → `/connect` |
| `/connect` | `app/connect/page.tsx` | DB connection form + recent connections |
| `/chat` | `app/chat/page.tsx` | Main conversational query interface |
| `/schema` | `app/schema/page.tsx` | Schema browser + Explain DB |
| `/schema/erd` | `app/schema/erd/page.tsx` | Interactive ERD diagram |
| `/settings` | `app/settings/page.tsx` | App settings |

---

### 10.2 State Management — Store & useSession

#### `store.ts` — Global Singleton

A lightweight alternative to Redux/Zustand using React's built-in `useSyncExternalStore`.

```typescript
// Pattern
const store = createStore(initialState);

// Components subscribe via
const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
```

- Hydrates from `localStorage` on module load (runs once)
- Exposes `dispatch(action)` for mutations
- All subscribers re-render on any state change

#### `use-session.ts` — React Hook

Thin wrapper around the store, providing ergonomic methods to pages and components:

```typescript
const {
  connection,      // ConnectionResponse | null
  messages,        // ChatMessage[]
  connect,         // (params) => Promise<void>
  disconnect,      // () => void
  pushMessage,     // (msg: ChatMessage) => void
  patchLastMessage // (patch: Partial<ChatMessage>) => void
} = useSession();
```

`patchLastMessage` is used for streaming updates — the assistant message starts as `{ status: 'pending' }` then gets progressively updated.

---

### 10.3 Key Components

#### `ResultsTable` — `components/chat/results-table.tsx`
- Built on `@tanstack/react-table` v8
- Sortable columns (click header)
- Truncates long cell content with title tooltip
- Export toolbar: CSV (downloads file) and JSON (downloads file)
- Styled with Tailwind; respects dark mode

#### `ResultChart` — `components/chat/result-chart.tsx`
- Auto-detects numeric columns in the result set
- Chooses chart type heuristically (1 category + 1 number → bar; time series → line; ≤ 8 rows single value → pie)
- Toggle buttons to switch between bar / line / pie manually
- Dark-themed recharts tooltips
- Only renders if at least one numeric column is found

#### `SQLBlock` — `components/chat/sql-block.tsx`
- Syntax-highlighted SQL display
- One-click copy-to-clipboard button with "Copied!" flash feedback
- Collapsible (hidden if `showSQL` setting is false)

#### `MetadataStrip` — `components/chat/metadata-strip.tsx`
- Displays: execution time (ms), row count, tables used (as pills), AI confidence (percentage with colour coding)
- Confidence colour: green ≥ 0.8, amber ≥ 0.6, red < 0.6

#### `SchemaGraph` — `components/schema/schema-graph.tsx`
- @xyflow/react canvas
- `dagre` for automatic left-to-right layout
- Table nodes show name + column count
- FK edges connect source.column → target.column
- Controls: zoom in/out, fit view, minimap toggle

---

### 10.4 localStorage / sessionStorage Strategy

All persistence is handled by helper functions in `storage.ts`.

#### localStorage keys (survive page refresh AND tab close)

| Key | Type | Content |
|---|---|---|
| `sqli_connection` | `ConnectionResponse` | Active connection info (sessionId, database, tables) |
| `sqli_params` | `ConnectionParams` | Last connection params (no password) |
| `sqli_settings` | `PersistedSettings` | showSQL toggle, rowLimit |
| `sqli_conn_history` | `ConnectionHistoryEntry[]` | Last 5 connections (no passwords), for recent-connections UI |
| `sqli_pinned` | `PinnedQuery[]` | User's starred queries |

#### sessionStorage keys (cleared when tab closes)

| Key | Type | Content |
|---|---|---|
| `sqli_messages` | `ChatMessage[]` | Full chat history for current tab |
| `sqli_prefill` | `string` | Table name transferred from schema page to chat input |

#### `PersistedSettings` shape
```typescript
interface PersistedSettings {
  showSQL: boolean;     // show/hide SQL block in chat
  rowLimit?: number;    // 100 | 250 | 500 — UI preference (not yet enforced backend-side)
}
```

---

## 11. Frontend Page Walkthrough

### 11.1 `/connect`

**Purpose:** Establish a new database connection.

**Flow:**
1. User fills in host, port, user, password, database
2. "Test Connection" → `POST /api/connection/test` — shows green/red feedback inline
3. "Connect" → `POST /api/connection/connect` → on success, saves `ConnectionResponse` + `ConnectionParams` to localStorage, saves entry to connection history, pushes to `/chat`

**Recent Connections panel:**
- Loads `sqli_conn_history` from localStorage (up to 5 entries)
- Each card shows host + database name + timestamp
- Clicking a card pre-fills the form fields

---

### 11.2 `/chat`

**Purpose:** Ask questions in natural language and receive SQL results.

**Layout:**
```
┌─────────────────────────────────────────┐
│  Header: DB name + nav links            │
├──────────────┬──────────────────────────┤
│   Sidebar    │   Messages area          │
│              │                          │
│  History     │  [User question]         │
│  Pinned ★    │  [Assistant response]    │
│  queries     │   ├── SQL block          │
│              │   ├── Results table      │
│              │   ├── Result chart       │
│              │   ├── AI insight         │
│              │   └── Metadata strip     │
│              │                          │
│              ├──────────────────────────┤
│              │  Input bar               │
│              │  [text input] [? btn] [→]│
└──────────────┴──────────────────────────┘
```

**Message lifecycle:**
```
User submits → pushMessage({ role:'user', content })
             → pushMessage({ role:'assistant', status:'pending' })
             → POST /ask  →  patchLastMessage({ plan, status:'streaming' })
             → POST /execute  →  patchLastMessage({ rows, insight, status:'done' })
```

**Pinning a query:**
- Star icon on each assistant message
- Saves to `sqli_pinned` in localStorage via `savePinnedQuery()`
- Pinned queries appear in sidebar with ★ icon

---

### 11.3 `/schema`

**Purpose:** Browse database tables and columns; trigger AI explanation.

**Features:**
- Search box filters table list in real time
- Each table card shows: table name, column count, column list with type pills
- Clicking a column name copies it to `sqli_prefill` (sessionStorage) then navigates to `/chat` — the chat input auto-fills with a relevant question template
- "Explain DB" button (violet, Sparkles icon):
  1. Builds a formatted schema summary string from loaded topology state
  2. Calls `POST /api/query/explain` with that summary
  3. Opens a modal with the AI's markdown prose explanation

---

### 11.4 `/schema/erd`

**Purpose:** Visualise table relationships as an interactive diagram.

**Implementation:**
- Loads schema via `GET /api/connection/schema/:sessionId`
- Converts topology into `ReactFlow` nodes and edges
- `dagre` auto-layouts the graph with left-to-right direction
- Each table is a node; FK relationships are directed edges
- Controls panel: zoom in, zoom out, fit view
- Minimap in corner for large schemas

---

### 11.5 `/settings`

**Purpose:** Configure app behaviour.

**Settings & persistence:**

| Setting | Storage key | Default |
|---|---|---|
| Show SQL | `sqli_settings.showSQL` | `true` |
| Row limit | `sqli_settings.rowLimit` | `500` |

**Sections:**
1. **Query Display** — Show SQL toggle
2. **Result Limit** — Button group: 100 / 250 / 500 rows
3. **Keyboard Shortcuts** — Reference table (see §14)
4. **About** — Model, provider, mode, backend/frontend versions
5. **Session** — "Clear Saved Session" button → wipes `sqli_connection`, `sqli_params`, `sqli_settings` and redirects to `/connect`

---

## 12. Data Flow Diagrams

### Connection establish
```
Browser              Frontend             Backend (NestJS)       MySQL
  │                      │                      │                   │
  │─── fill form ────────►│                      │                   │
  │                      │── POST /connect ──────►│                   │
  │                      │                      │── pool.connect() ──►│
  │                      │                      │◄─── success ────────│
  │                      │                      │                   │
  │                      │                      │ encrypt password  │
  │                      │                      │ store session     │
  │                      │                      │                   │
  │                      │◄── { sessionId } ─────│                   │
  │◄─ redirect /chat ─────│                      │                   │
```

### NL Query
```
Chat input  →  ask()  →  LLM (Cerebras)  →  ValidationService
                                             ↓
                            approved plan returned to frontend
                                             ↓
                         execute()  →  MCPService.executeQuery()  →  MySQL
                                             ↓
                              rows  →  LLM.interpretResults()
                                             ↓
                              rendered to user (table + chart + insight)
```

---

## 13. Security Model

| Concern | Mitigation |
|---|---|
| Credential storage | Passwords are **never** stored in localStorage, sessionStorage, or any backend persistence. Encrypted in-memory with AES-256-CBC using an ephemeral key per process. |
| SQL injection | All SQL is LLM-generated; the schema prompt doesn't let users embed raw SQL. Even if they tried, the validation layer re-parses before execution. |
| Data mutation | ValidationService rule 3 (SelectOnly) hard-blocks anything that isn't a SELECT at the AST level, regardless of how it's phrased. |
| Unbounded queries | LimitRequired rule auto-patches or rejects any query without LIMIT. |
| Cross-table exfiltration | NoUnion rule prevents UNION-based data merges. |
| Schema guessing | Column/table validation ensures SQL only references actual tables in the connected session's schema. |
| CORS | Backend configured with an explicit allow-list (localhost:3000 in dev). |
| Replay attacks | Each session uses a UUID; the session map is in-memory and lost on server restart. |

---

## 14. Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Focus chat input |
| `Enter` | Send query |
| `?` | Show keyboard shortcuts modal |
| `Esc` | Dismiss modal / clear input focus |

> Available in the chat interface. The `?` shortcut does not trigger when focus is inside a text input or textarea.

---

*End of documentation.*
