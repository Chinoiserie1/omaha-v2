# Chat Flow

> AI-powered chat with session isolation, portfolio proposals, and vault deployment actions.

## Overview

The chat system provides a conversational AI assistant that helps users with crypto trading strategy. It supports **multiple isolated sessions** so users can start fresh conversations with clean LLM context. Quants get a specialized portfolio strategist; regular users get a general crypto assistant.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Mobile App                                                  │
│                                                              │
│  ChatScreen ──→ useChatWs (WebSocket) ──→ Backend WS        │
│       │                                       │              │
│       └──→ useChatHistory (REST) ──→ GET /api/chat/history   │
│                                                              │
│  Header "New Chat" button ──→ DeviceEventEmitter ──→         │
│       useChatWs.createNewSession()                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Backend                                                     │
│                                                              │
│  /ws/chat (WebSocket)                                        │
│       │                                                      │
│       ├── quantId? → streamPortfolioChat (portfolio-chat.service)
│       └── no quant → streamChat (chat.service)               │
│                                                              │
│  /api/chat/history     GET   (REST, paginated)               │
│  /api/chat/sessions    POST  (REST, create new session)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Database                                                    │
│                                                              │
│  ChatSession (id, userId, title?, createdAt)                 │
│       │                                                      │
│       └──→ ChatMessage (id, sessionId, userId, role, content)│
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### ChatSession

Each user can have multiple sessions. Messages are scoped to a session for isolated LLM context.

| Field     | Type     | Description                          |
|-----------|----------|--------------------------------------|
| id        | String   | CUID primary key                     |
| userId    | String   | FK to User                           |
| title     | String?  | Optional session title (future use)  |
| createdAt | DateTime | Session creation timestamp            |

### ChatMessage

| Field     | Type     | Description                                    |
|-----------|----------|------------------------------------------------|
| id        | String   | CUID primary key                               |
| sessionId | String   | FK to ChatSession (cascade delete)             |
| userId    | String   | FK to User (cascade delete)                    |
| role      | String   | `"user"` or `"assistant"`                      |
| content   | String   | Message text (may contain structured blocks)   |
| createdAt | DateTime | Message timestamp                              |

**Indexes**: `[sessionId, createdAt]`, `[userId, createdAt]`

## Session Lifecycle

1. **First connection**: If user has no sessions, one is auto-created
2. **Reconnect**: Server resolves the most recent session and sends its ID
3. **New session**: User taps "New Chat" button → `chat:new_session` event → server creates session → client clears messages and shows empty state
4. **User always lands on latest session** — no session picker/switcher needed

## WebSocket Protocol

**Endpoint**: `ws://<host>/ws/chat?token=<privy_auth_token>`

**Authentication**: Privy JWT passed as `token` query param. Invalid → close with code `4001`. User not found → close with code `4002`.

**Heartbeat**: Server pings every 30 seconds.

### Events

#### Client → Server

| Event              | Payload                  | Description              |
|--------------------|--------------------------|--------------------------|
| `chat:message`     | `{ content: string }`    | Send a user message      |
| `chat:new_session` | `{}`                     | Request a new session    |

#### Server → Client

| Event                    | Payload                                              | Description                                |
|--------------------------|------------------------------------------------------|--------------------------------------------|
| `chat:session`           | `{ sessionId: string }`                              | Current session ID (sent on connect)       |
| `chat:session_created`   | `{ sessionId: string }`                              | New session created (response to new_session) |
| `chat:chunk`             | `{ content: string }`                                | Streaming text chunk                       |
| `chat:done`              | `{ messageId: string, content: string }`             | Complete response (display text, blocks stripped) |
| `chat:portfolio_proposal`| `{ thesisSummary, allocations[], changes[] }`        | Structured portfolio change proposal       |
| `chat:vault_deploy`      | `{ action: "create_vault" }`                         | Vault deployment action                    |
| `chat:error`             | `{ error: string }`                                  | Error message                              |

### Message Flow

```
Client                          Server
  │                                │
  │──── connect ──────────────────→│ verify token, resolve latest session
  │←── chat:session ──────────────│ { sessionId }
  │                                │
  │──── chat:message ─────────────→│ save user msg, load session context (20 msgs)
  │←── chat:chunk ────────────────│ streaming...
  │←── chat:chunk ────────────────│ streaming...
  │←── chat:done ─────────────────│ { messageId, content }
  │←── chat:portfolio_proposal ───│ (if portfolio changes detected)
  │                                │
  │──── chat:new_session ─────────→│ create new session
  │←── chat:session_created ──────│ { sessionId } — client clears messages
```

## Chat Modes

### General Chat (no Quant profile)

- **Service**: `chat.service.ts` → `streamChat()`
- **LLM**: Claude Haiku 4.5, 2048 max tokens
- **System prompt**: General crypto/DeFi/Solana assistant
- **Context**: Last 20 messages from current session

### Portfolio Chat (Quant users)

- **Service**: `portfolio-chat.service.ts` → `streamPortfolioChat()`
- **LLM**: Claude Haiku 4.5, 2048 max tokens
- **System prompt**: Portfolio strategist with current allocations, vault status, and available assets (~155 curated)
- **Context**: Last 20 messages from current session + latest portfolio snapshot
- **Structured outputs**:
  - **Portfolio Proposal**: Parsed from `` ```portfolio `` block → sent as `chat:portfolio_proposal`
  - **Vault Deploy**: Parsed from `` ```vault_deploy `` block → sent as `chat:vault_deploy`
  - Both blocks are stripped from the display text in `chat:done`

## REST Endpoints

| Method | Endpoint              | Auth | Description                                   |
|--------|-----------------------|------|-----------------------------------------------|
| GET    | `/api/chat/history`   | Yes  | Get messages for a session (default: latest)  |
| POST   | `/api/chat/sessions`  | Yes  | Create a new chat session                     |

### GET /api/chat/history

**Query params**: `limit` (default 50, max 100), `cursor` (pagination), `sessionId` (optional, defaults to latest)

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "clx...",
    "messages": [
      { "id": "clx...", "role": "user", "content": "...", "createdAt": "..." },
      { "id": "clx...", "role": "assistant", "content": "...", "createdAt": "..." }
    ]
  }
}
```

Messages are returned newest-first. The client reverses them for chronological display.

### POST /api/chat/sessions

**Response**:
```json
{
  "success": true,
  "data": { "id": "clx...", "createdAt": "..." }
}
```

## Mobile App Components

### Route & Layout

- **Route**: `app/(app)/(chat)/index.tsx` → renders `<ChatScreen />`
- **Layout**: `app/(app)/(chat)/_layout.tsx` → Stack navigator with header (back button + "New Chat" icon)

### Components (`components/chat/`)

| Component               | Purpose                                                 |
|-------------------------|---------------------------------------------------------|
| `ChatScreen.tsx`        | Main container: gate (Quant check), history loading, session management |
| `ChatInput.tsx`         | Text input + send button (max 2000 chars)              |
| `ChatMessageBubble.tsx` | User/assistant message display                         |
| `ChatEmptyState.tsx`    | Suggestion chips for empty sessions                    |
| `ChatTypingIndicator.tsx` | Animated dots during streaming                       |
| `PortfolioProposalCard.tsx` | Accept/reject portfolio proposals                  |
| `VaultDeployCard.tsx`   | Vault deployment confirmation                          |
| `BecomeQuantScreen.tsx` | CTA for users without a Quant profile                  |
| `ChatBottomAccessory.tsx` | "Manage Portfolio" navigation button                 |

### Hooks

| Hook                      | Purpose                                                      |
|---------------------------|--------------------------------------------------------------|
| `use-chat-ws.ts`          | WebSocket connection, message state, session management      |
| `use-chat-history.ts`     | REST query for session messages (React Query)                |
| `use-chat-new-session.ts` | Event bridge: header button → ChatScreen via DeviceEventEmitter |

## Source Files

**Backend**:
- `src/infra/chat-websocket.ts` — WebSocket server, session resolution, event routing
- `src/services/chat.service.ts` — General chat streaming
- `src/services/portfolio-chat.service.ts` — Portfolio chat streaming + structured output parsing
- `src/store/chat.repository.ts` — Session and message persistence
- `src/routes/chat/` — REST endpoints (history, create-session)

**Native**:
- `components/chat/` — All UI components
- `hooks/use-chat-ws.ts` — WebSocket hook
- `hooks/queries/use-chat-history.ts` — History query hook
- `hooks/use-chat-new-session.ts` — New session event bridge
- `app/(app)/(chat)/` — Route and layout
