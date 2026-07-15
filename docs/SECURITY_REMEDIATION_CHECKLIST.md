# Security And Quality Remediation Checklist

This checklist tracks the security, data-safety, game-result, and stability issues found during the July 2026 review.

Data safety rule: production data is more important than code changes. Before deploying changes that touch auth, storage, migrations, cleanup, result/session persistence, or leaderboard logic, back up the active production database:

```text
/home/qzmivzbj/app-data/vhomework/app.sqlite
```

## Status Legend

- `pending`: not started.
- `fixing`: code changes in progress.
- `fixed`: implemented locally.
- `verified`: checked by build/test/manual review.
- `deferred`: intentionally moved to a later phase.

## Phase 1 - Security P0

| ID | Group | Issue | Before Fix | Target Fix | Status |
| --- | --- | --- | --- | --- | --- |
| C1 | Auth/roles | User can self-edit profile fields and escalate to `super_admin`. | Firestore lets a user write their own full `users/{uid}` doc; backend trusts `role/status` from profile. | Client cannot write sensitive profile fields; backend only updates safe fields; inactive statuses are denied. | verified |
| C2 | Firestore rules | Authenticated users can write admin-managed collections. | `vocab_sets`, `classes`, `class_members`, `assignments`, `game_sessions`, `audit_logs` allow broad authenticated writes. | Default-deny admin-managed client writes; route writes through backend Admin SDK. | verified |
| C3 | Game sessions | Game session API can be used to forge score/session data. | Start/update routes do not require a verified actor and accept broad client payload. | Server-generated session ID, immutable owner/context, authenticated or guest-capable session ownership. | verified |
| C4 | Game sessions | Session IDs are timestamp-based and predictable. | `session-${Date.now()}` style IDs. | Use `crypto.randomUUID()`/server random ID. | verified |
| C5 | Leaderboard integrity | Public leaderboard consumes potentially forged sessions. | Public results derive from client-written session data. | Only include completed, non-expired sessions with server-managed ownership/context; remove direct Firestore write fallback. | verified |
| C6 | Results privacy | Authenticated users can read detailed results beyond their scope. | `/api/results` authenticates but does not scope by role/owner/class. | Scope result detail by role: student/self, teacher-owned resources, super admin/all. | verified |
| C7 | Teacher ownership | Teachers may mutate other teachers' data. | Several routes check role but not owner. | Add ownership helpers for vocab/class/assignment operations. | verified |
| C9 | Firestore fallback | Client/server fallback can bypass backend policy or split data sources. | Frontend has direct Firestore fallback reads/writes. | Remove write fallbacks first; review read fallbacks after rules are tightened. | verified |
| D1 | Auth status | `pending`/`deleted` users can still use app. | Only `blocked` is denied. | Allow only `status === "active"`. | verified |
| D2 | Auth frontend | Blocked/inactive users may temporarily see active UI. | Client sets fallback profile before backend authority finishes. | Backend profile is authoritative for protected UI. | verified |
| D3 | Registration | Registration can appear successful without backend profile sync. | Client keeps local profile if backend sync fails. | Backend profile sync is required or UI stays unauthenticated/error. | verified |

## Phase 2 - Ownership, Private Links, And Result Privacy

| ID | Group | Issue | Target Fix | Status |
| --- | --- | --- | --- | --- |
| C6 | Results privacy | Cross-student result detail exposure. | Role-scoped `/api/results` and detail endpoints. | verified |
| C7 | Teacher ownership | Teacher can mutate resources not owned by them. | `canManageVocabSet`, `canManageClass`, `canManageAssignment`. | verified |
| D9 | Private links | Assignment link falls back to predictable ID. | Server-generated random token only; backfill legacy missing tokens. | verified |
| D10 | Private links | Assignment link can open draft/ineligible set. | Check assignment/set visibility and active state. | verified |
| D27 | Grammar guest | Guest ownership is only client-supplied string. | Server-issued guest capability or signed guest session. | verified |
| D28 | Grammar answers | Correct answer can be exposed before submit. | Hide correct answer unless feedback policy allows it. | verified |

## Phase 3 - Game Scoring And Session Lifecycle

| ID | Group | Issue | Target Fix | Status |
| --- | --- | --- | --- | --- |
| D15 | Flashcard | Last-card scoring can overcount. | Compute final map synchronously; remove all-correct fallback. | verified |
| D16 | Memory | Move count is sent as incorrect count. | Track failed attempts separately. | verified |
| D17 | Quiz/Fill | Same question can be counted multiple times. | Replace one answer record per question ID. | verified |
| D18 | Replay | Replay does not create a new session. | Parent creates new attempt/session and remounts game. | verified |
| D19 | Race | Switching game can let stale session response win. | AbortController or generation token. | verified |
| D20 | Timer | Timeout cleanup is incomplete. | Store/clear timer refs on unmount/restart. | verified |
| D21 | Pronunciation | Speaking attempt API can be forged. | Attach to authenticated user or guest capability; server timestamps. | verified |

## Phase 4 - Storage, Retention, And Leaderboard Integrity

| ID | Group | Issue | Target Fix | Status |
| --- | --- | --- | --- | --- |
| C8 | SQLite/sql.js | In-memory DB persistence can lose writes on crash/multi-worker. | Short-term single-worker/atomic writes; long-term native SQLite. | verified |
| C9 | Storage fallback | Automatic fallback can create split-brain data. | Choose storage at startup; return 503 on backend storage failure. | verified |
| D11 | Retention | Seven-day cleanup is not physical. | Keep display filtering; physical cleanup only as backed-up maintenance task. | deferred |
| D12 | Leaderboard month | Monthly board cannot rely only on 7-day raw activity. | Persist aggregate leaderboard longer than activity feed. | verified |
| D13 | Improvement | New users can get inflated improvement bonus. | No baseline means no improvement bonus or newcomer state. | verified |
| D14 | Identity | Leaderboard identity can merge/split students. | Prefer UID/server guest capability and class snapshot. | verified |

## Phase 5 - Validation, TTS, Audio, And Maintainability

| ID | Group | Issue | Target Fix | Status |
| --- | --- | --- | --- | --- |
| D4 | Phone auth | Phone lookup leaks email/account existence. | Rate limit and no direct email disclosure. | verified |
| D5 | Phone auth | Phone is not verified/normalized consistently. | E.164 normalization and `phoneVerified`. | verified |
| D6 | Import | Bulk import parser is rigid and under-validated. | Better parser and line-level errors. | verified |
| D7 | Vocab validation | Vocab save lacks server-side schema. | Validate terms/items/audio metadata server-side. | verified |
| D8 | Admin UI | Some admin handlers ignore `response.ok`. | Shared `authFetchJson` error handling. | verified |
| D22 | TTS | TTS requests lack timeout/size cap. | Abort timeout, byte cap, temp file. | verified |
| D23 | TTS | Same audio hash can race. | In-flight dedupe and atomic rename. | verified |
| D24 | Audio path | Absolute audio path can leak to client. | Store/return public URL/hash only. | verified |
| D25 | TTS provider | Provider field is not fully dispatched. | Restrict to AI33 or implement adapters. | verified |
| D26 | Game audio | Audio playback is inconsistent across games. | Shared managed audio player. | verified |

## Verification Notes

- Run lint/build after each phase when possible.
- Re-check `firestore.rules` with the intended Firebase deployment rules before production deploy.
- Re-check production env points to `/home/qzmivzbj/app-data/vhomework/app.sqlite` after deploy.
- Do not add startup/read-route physical cleanup.

Phase 3 local notes:

- `npm run lint` passed after the game scoring/session lifecycle changes.
- `npm run build` passed after Phase 3. Vite emitted only existing bundle-size/dynamic-import warnings.
- Phase 3 touched gameplay/session code only; it does not add database cleanup or physical delete logic.

Phase 4 local notes:

- `npm run lint`: passed.
- `npm run build`: passed. Vite emitted only existing bundle-size/dynamic-import warnings.
- SQLite sql.js persistence now writes through a temp file + fsync + rename instead of overwriting the DB file directly.
- Storage mode is fixed at startup. Firestore mode no longer auto-falls back to local JSON on read/write failure; storage failure returns 503 through API error handling.
- `leaderboard_events` stores compact completed-attempt summaries for longer-lived leaderboard calculations. Recent activity remains filtered to 7 days.
- New users receive `isNewcomer` state and no improvement bonus until a previous-period baseline exists.
- Leaderboard identity prefers `userId`, `ownerKey`, `guestId`, then `studentId`, with class snapshot still included in the leaderboard key.
- No physical cleanup, database reset, reseed, or broad delete logic was added.

## Phase 1 Verification

- `npm run build`: passed.
- `npm run lint`: passed.
- No physical database cleanup, migration, reseed, reset, or delete command was added.
- Firestore client writes to admin-managed collections are denied; backend Admin SDK remains the write path.
- Direct client Firestore write fallback for profile registration and game session create/update was removed.
- Game session create/update now uses server-generated IDs, owner metadata, and a session token for guest completion.

Remaining follow-up: Phase 1 hardens ownership and write paths, but full anti-cheat still requires Phase 3 server-side answer validation/scoring.

## Phase 2 Verification

- `npm run lint`: passed.
- `npm run build`: passed.
- No physical database cleanup, migration, reseed, reset, or delete command was added.
- `/api/results` is scoped by role: super admin can see all, teachers only see resources they manage, students only see their own authenticated results.
- Teacher-managed resources now use ownership checks for vocab sets, classes, class members, assignments, grammar sets, TTS status, and TTS generation actions.
- Assignment private links no longer fall back to predictable assignment IDs. Legacy assignments without tokens are backfilled with random `shareToken`/`assignmentSlug` when listed/opened.
- Assignment/private game start now rejects draft or unavailable vocab sets unless the assignment and vocab set are eligible.
- Grammar guest attempts now receive a server-issued attempt token; new guest answer/submit/review actions require that token.
- Grammar answers no longer expose `correctOptionId` before submit unless immediate feedback is enabled, and review details depend on `showReviewAfterSubmit` for students/guests.

Phase 1 carry-over reconciliation:

- C6/C7 were duplicated in Phase 1 and Phase 2. Code review on 2026-07-15 confirmed the Phase 2 fixes cover both rows:
  - `/api/results` and `/api/leaderboard-results` route through `canViewResultSession` / `canViewGrammarActivity`.
  - Teacher-managed vocab/class/assignment/grammar/TTS routes use `canManageVocabSet`, `canManageClass`, `canManageAssignment`, or `canManageGrammarSet`.
- No new cleanup, delete, reset, reseed, or migration logic was added for this reconciliation.

## Phase 5 Verification

- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.
- Phone lookup no longer returns account email; phone/password login uses a server endpoint and Firebase custom token.
- Phone values are normalized to E.164-style format and profiles carry `phoneVerified`.
- Bulk vocabulary import validates line count, separators, required fields, and field lengths.
- Vocabulary save validates item/audio metadata server-side and strips private `audioPath` before saving or returning client data.
- TTS generation now has fetch timeout, audio byte cap, atomic cache write, in-flight hash dedupe, and AI33-only provider restriction.
- Game/editor pronunciation now uses a shared managed audio player.
