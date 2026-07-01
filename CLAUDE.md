# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

UIGen is an AI-powered React component generator with a live preview. A user chats
with Claude, which uses tool calls to create/edit files in an in-memory virtual
file system; the result is rendered live in a sandboxed iframe without ever
touching disk or running a bundler.

## Commands

```bash
npm run setup       # install deps, generate Prisma client, run migrations — do this first
npm run dev          # start dev server (Next.js + Turbopack) at localhost:3000
npm run dev:daemon   # start dev server in background, logs to logs.txt
npm run build        # production build
npm run lint         # next lint
npm test             # run vitest test suite once
npm run db:reset      # reset the SQLite dev database (destructive)
```

Run a single test file or test case with vitest directly:

```bash
npx vitest run src/lib/__tests__/file-system.test.ts
npx vitest run -t "test name substring"
```

No Anthropic API key is required to develop: if `ANTHROPIC_API_KEY` in `.env` is
unset or left as `your-api-key-here`, `getLanguageModel()` in `src/lib/provider.ts`
falls back to `MockLanguageModel`, which returns canned tool calls/components so
the chat → file system → preview pipeline can be exercised end-to-end offline.

**Never run `npm audit fix`** — dependency versions are intentionally pinned to
combinations known to work together; `audit fix` can bump past compatible
versions and break the app. Security patches are applied by bumping the pinned
version directly instead.

## Architecture

### Virtual file system is the source of truth

`VirtualFileSystem` (`src/lib/file-system.ts`) is an in-memory tree (`Map<path, FileNode>`)
with its own path normalization, and text-editor-style operations (`viewFile`,
`createFileWithParents`, `replaceInFile`, `insertInFile`, `rename`, `deleteFile`).
Nothing is ever written to the real disk. It exists in two places that must stay
in sync:

- **Server**: reconstructed per-request in `src/app/api/chat/route.ts` from the
  `files` payload the client sends, mutated by the AI SDK tools during
  `streamText`, then re-serialized into `Project.data` in `onFinish`.
- **Client**: held in React state by `FileSystemProvider`
  (`src/lib/contexts/file-system-context.tsx`), which drives the file tree,
  code editor, and preview.

The client does not receive file contents back from the server directly — the
AI SDK streams the same **tool calls** the server executed (`onToolCall` in
`ChatProvider`, `src/lib/contexts/chat-context.tsx`), and `handleToolCall` in
`FileSystemProvider` replays each `str_replace_editor`/`file_manager` call
against the client-side `VirtualFileSystem` to reproduce the same result. When
adding a new file-system tool or command, both the tool's server-side
`execute()` (`src/lib/tools/str-replace.ts`, `src/lib/tools/file-manager.ts`)
and the client's `handleToolCall` switch statement need to handle it.

### Chat / generation flow

`POST /api/chat` (`src/app/api/chat/route.ts`) prepends the system prompt
(`src/lib/prompts/generation.tsx`) with prompt caching enabled, deserializes the
posted virtual file system, and calls `streamText` with `str_replace_editor`
and `file_manager` tools bound to that file system instance. `maxSteps` is
lower for the mock provider to avoid it looping. If a `projectId` is present
and the user has a valid session, the finished conversation + serialized file
system are persisted to `Project.messages` / `Project.data` in `onFinish`.

### In-browser preview (no bundler)

`src/lib/transform/jsx-transformer.ts` transpiles each JS/JSX/TS/TSX file with
`@babel/standalone` individually, wraps each transpiled module in a blob URL,
and builds a browser-native [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)
mapping import specifiers (including the `@/` alias and extensionless paths)
to those blob URLs. Third-party packages resolve to `esm.sh`. Unresolvable
local imports get a placeholder module so a single missing import doesn't
break the whole preview. `createPreviewHTML` assembles this into a full HTML
document (with an error-boundary/syntax-error UI) that's set as an `<iframe
srcdoc>` in `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`), sandboxed
with `allow-scripts allow-same-origin allow-forms`.

### Auth & persistence

- Sessions are JWTs (via `jose`) in an `httpOnly` `auth-token` cookie, issued/verified
  in `src/lib/auth.ts`. `src/middleware.ts` only hard-blocks `/api/projects` and
  `/api/filesystem`; page routes (e.g. `src/app/[projectId]/page.tsx`) check
  `getUser()` themselves and redirect.
- Data layer is Prisma + SQLite (`prisma/schema.prisma`): `User` and `Project`,
  where `Project.messages` and `Project.data` are JSON-serialized blobs (chat
  history and virtual file system respectively), not relational data.
- The Prisma client is generated to `src/generated/prisma` (custom `output`,
  not `node_modules`) — import it via `src/lib/prisma.ts`, not directly from
  `@prisma/client`.
- Anonymous (signed-out) users' work is tracked client-side only, in
  `sessionStorage` (`src/lib/anon-work-tracker.ts`), until/unless they sign up.

### Providers and models

`src/lib/provider.ts` chooses between the real Anthropic provider
(`claude-haiku-4-5` via `@ai-sdk/anthropic`) and `MockLanguageModel`, a hand-written
`LanguageModelV1` implementation that streams scripted text + tool calls based
on keywords in the user's prompt and how many tool round-trips have happened.
When changing tool schemas or the system prompt, keep in mind the mock
provider's canned responses are shape-matched against them and can silently
drift out of sync.

### Misc

- `node-compat.cjs` is imported at the top of `next.config.ts` to delete
  `globalThis.localStorage`/`sessionStorage` on the server — Node 25+ exposes
  non-functional Web Storage globals by default, which breaks SSR guards
  (`typeof localStorage === "undefined"`) in dependencies.
- Path alias `@/*` → `src/*` (see `tsconfig.json`); shadcn/ui components live
  in `src/components/ui` (style "new-york", Radix primitives, `src/lib/utils.ts`
  for `cn()`).
- Tests use Vitest with `jsdom` + `@testing-library/react`, colocated in
  `__tests__` directories next to the code they cover.
