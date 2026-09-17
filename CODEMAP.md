# CODEMAP - V-Homework Vocabulary Learning Platform

Last updated: 2026-09-16

## 1. Project Overview

This project is a full-stack vocabulary learning web app for students, teachers, and super admins.

Core capabilities:

- Student login/register and vocabulary learning portal.
- Long-lived student learning history for vocabulary and grammar; the UI always ships while API/projector availability uses the Release B server runtime flag.
- Teacher/admin dashboard for vocabulary sets, classes, assignments, results, and AI generation.
- Teacher-reviewed managed vocabulary images from external providers, stored locally before student use.
- Game engine with flashcards, quiz, fill-blank, matching, and memory games.
- Firebase Authentication plus Firestore data storage.
- Express backend API with Firebase Admin and explicit Firebase, SQLite, or local JSON storage modes.
- Gemini-powered IPA and vocabulary generation, with local fallback output when API key/service is unavailable.
- Production hosting through bundled Node server and static Vite build.

Primary stack:

- React 19 + Vite 6 + TypeScript.
- Tailwind CSS v4 via `@tailwindcss/vite`.
- Express 4 backend in `server.ts`.
- Firebase client SDK in frontend.
- Firebase Admin SDK in backend.
- `@google/genai` for Gemini.
- `lucide-react` icons and `motion/react` animation.

### 1.1. Version And Environment Registry

Verified: 2026-08-03. Update this registry whenever Node, npm, the lockfile,
the native SQLite driver, the cPanel runtime, or the deployed artifact changes.
Do not put secret values in this file.

Runtime compatibility matrix:

| Component | Local development/build | cPanel production host |
| --- | --- | --- |
| Operating system | Windows 10 `10.0.19045`, x64/AMD64 | Linux x64 on cPanel; exact distribution not recorded |
| Node.js | Active shell `v24.15.0`; release target remains Node 22 | `v22.16.0` |
| Node release policy | `package.json` requires `22.x`; use Node 22 for the final release gate | cPanel application configured for Node 22 |
| Node ABI | Active shell `137`; installed native module currently targets `127` | `127` |
| npm | Active shell `11.12.1`; release baseline `10.9.2` | `10.9.2` |
| Node executable | Active workstation installation; do not hardcode its path | `/opt/alt/alt-nodejs22/root/usr/bin/node` |
| Platform/architecture | `win32` / `x64` | `linux` / `x64` |
| glibc | Not applicable on Windows | `2.28` |
| Native build Python | Not required by the verified local install | Python `3.11.13`, `/opt/alt/python311/bin/python3.11` |
| Native C/C++ toolchain | Not part of the local runtime contract | GCC/G++ `8.5.0` with C++17 |
| `better-sqlite3` | `10.1.0` exact pin | `10.1.0` exact pin, built from source |
| SQLite bundled runtime | `3.46.0` | `3.46.0` |
| SQLite journal mode | WAL verified in isolated/local tests | WAL active on production `app.sqlite` |
| Process manager | Local Node process | cPanel/Passenger `lsnode` worker |

The exact application dependency baseline from the current
`package-lock.json`/local install is:

| Package/tool | Exact resolved version | Runtime role |
| --- | --- | --- |
| React / React DOM | `19.2.7` / `19.2.7` | Client UI |
| Vite | `6.4.3` | Local production client build |
| TypeScript | `5.8.3` | Typecheck |
| `tsx` | `4.22.4` | Development/test runner |
| esbuild | `0.25.12` | Production server bundle |
| Tailwind CSS / `@tailwindcss/vite` | `4.3.2` / `4.3.2` | Client styling |
| Express | `4.22.2` | HTTP server |
| Firebase client / Admin | `12.15.0` / `14.1.0` | Authentication/Firestore modes |
| `better-sqlite3` | `10.1.0` | Primary production SQLite driver |
| `sql.js` | `1.14.1` | Explicit emergency rollback driver only |
| `@google/genai` | `2.10.0` | Gemini integration |
| `dotenv` | `17.4.2` | Environment loading |
| `lucide-react` | `0.546.0` | Icons |
| Motion | `12.42.0` | Client animation |
| `pdfjs-dist` | `6.2.108` | Lazy browser-side PDF rendering for Listening import |

Current source/build/deployment ledger:

- Current Git baseline before the uncommitted Mover Reading & Writing pass:
  `5127a31`. The working tree contains the additive implementation described
  in section 37 below.
- Current local release build (generated 2026-08-31 with canonical
  `npm run build` under the release Node 22.16.0 runtime):
  `dist/client/assets/index-CjfByv84.js` (494,981 bytes,
  128.19 kB gzip) and `dist/client/assets/index-DLnO1PxT.css` (212,548 bytes,
  29.57 kB gzip). The exam-library admin ships in the lazy
  `ListeningLibraryAdmin-BLXYIlCo.js` chunk. Screen, admin, Firestore,
  Listening, and individual game code continue to ship as lazy chunks.
- Current local server bundle: `dist/server.cjs` (1,043,182 bytes before Git
  transport compression).
- Last independently confirmed production UI artifact from the host terminal:
  `index-gODK9tEe.js` and `index-C7ymBAj4.css`.
- Therefore the current local artifact remains **pending host
  confirmation** until cPanel deploy, one Node restart, and a fresh
  `curl`/browser smoke show `index-CjfByv84.js` plus `index-DLnO1PxT.css`.
- The host ran `npm ci --omit=dev` successfully with 439 packages. Its install
  audit snapshot reported 11 findings (1 low, 7 moderate, 3 high). Review
  `npm audit`; never run `npm audit fix --force` blindly on production.

Native-driver update constraints:

- Keep `better-sqlite3@10.1.0` exact until a replacement passes on the exact
  Passenger Node ABI, glibc 2.28, Python 3.11, and GCC 8.5 toolchain.
- `better-sqlite3@12.4.1` was evaluated and rejected for this host: its Linux
  prebuild requires `GLIBC_2.29`, while its source path expects a newer C++20
  compiler flag/toolchain than the available GCC 8.5 setup.
- A Node upgrade changes the native ABI risk. Re-run
  `npm run storage:preflight`, reopen/read/write/WAL checks, `quick_check`, and
  the full quality gate before changing the cPanel Node version.
- Build frontend artifacts locally with Node 22.16.0. The host should run
  production dependencies/server artifacts, not become the primary Vite build
  machine.

Version refresh commands:

```bash
node -p "JSON.stringify({node:process.version,abi:process.versions.modules,execPath:process.execPath,platform:process.platform,arch:process.arch,glibc:process.report?.getReport?.().header?.glibcVersionRuntime||null},null,2)"
npm -v
npm ls better-sqlite3
npm run storage:preflight -- --db /absolute/path/to/isolated-preflight.sqlite
```

For a future upgrade, record the verification date, Git commit, local result,
host result, new client asset names, database `quick_check`, journal mode, and
rollback point in this section before calling the upgrade complete.

## 2. Important Files

### Root

- `quytac.md`: quy tắc bắt buộc về phạm vi thay đổi, chẩn đoán, kiểm thử, an toàn dữ liệu, AI, build và deploy dành cho AI agent/lập trình viên.
- `package.json`: scripts and dependencies.
- `server.ts`: Express API server, auth middleware, seed logic, Gemini routes, CRUD routes, static/Vite serving.
- `app.js`: production entry that imports `./dist/server.cjs`.
- `vite.config.ts`: Vite config, React plugin, Tailwind plugin, alias `@` to repo root, output `dist/client`.
- `tsconfig.json`: TS config; `allowJs`, `noEmit`, bundler module resolution.
- `index.html`: Vite HTML entry.
- `src/main.tsx`: React root; wraps app in `AuthProvider` and the shared lazy-screen `Suspense` boundary.
- `src/App.tsx`: top-level screen routing and home portal.
- `src/index.css`: global dark/glass theme and broad Tailwind utility overrides.
- `db.json`: local fallback database used by backend fallback layer.
- `firestore.rules`: Firestore security rules.
- `firebase.json`: Firestore rules config only.
- `firebase-blueprint.json`: AI Studio data blueprint; partly stale compared with current `src/types.ts`.
- `.cpanel.yml`: cPanel deployment copy tasks.
- `.env.example`: required public Firebase and server Firebase env keys.
- `.env.production`: real production env file exists locally; do not expose contents.
- `dist/`: generated production output; do not edit manually.
- `node_modules/`: installed dependencies; do not edit.

### Frontend Source

- `src/types.ts`: shared app domain types.
- `src/context/AuthContext.tsx`: client auth state, login/register, profile sync.
- `src/lib/firebase.ts`: Firebase client app/auth initialization; it intentionally excludes Firestore from the startup bundle.
- `src/lib/firebaseDb.ts`: lazy Firestore initialization used only by direct-client fallback paths.
- `src/lib/firebaseAdmin.ts`: backend Firebase Admin initialization plus local fallback Firestore compatibility layer.
- `src/lib/authErrors.ts`: maps Firebase auth errors to user-facing messages.
- `src/lib/game-engine/gameList.ts`: registry of game modes.
- `src/lib/game-engine/speech.ts`: browser Web Speech API wrapper.
- `src/components/Login.tsx`: email/phone/Google login UI.
- `src/components/Register.tsx`: email registration UI.
- `src/components/admin/AdminDashboard.tsx`: large admin/teacher dashboard.
- `src/components/games/StudentLearningArea.tsx`: student game shell/session manager.
- `src/components/games/*Game.tsx`: individual game implementations.
- `src/components/games/GameControlPanel.tsx`: shared control panel for games.
- `src/components/grammar/GrammarLearningArea.tsx`: student grammar practice and review screen.
- `src/components/history/`: Release B student history page, filters, summary, list/cards, grouping, and detail modal.
- `src/lib/api/learningHistory.ts`: defensive History API client and auth/guest capability headers.
- `src/server/learning-history/`: actor resolution, validation, SQL repository, service, router, and atomic projectors.
- `src/server/publicStudentIdentity.ts`: HMAC pseudonymization and public result/leaderboard identity sanitizer.
- `scripts/db-backfill-learning-history.mjs`: explicit legacy projection backfill/reconcile CLI.
- `scripts/activity-prune.mjs`: explicit detail-only retention CLI with verified online backup.
- `docs/listening-smart-editor-plan.md`: kế hoạch kiến trúc và sổ trạng thái triển khai Smart Editor theo Editor Shell, module definition và Part Handler; code Mover Parts 1-5 đã được triển khai, còn UAT thủ công và cấu hình môi trường production trước khi mở cho người dùng.
- `docs/listening-smart-editor-mover-spec.md`: đặc tả nghiệp vụ Smart Editor đủ Parts 1-5 của Mover đã được xác nhận; Part 5 kế thừa vùng cố định/đáp án random cần giáo viên xác nhận của Part 1, dùng catalog 20 màu tiếng Anh thay color picker tự do và chỉ gồm năm câu `colour`, không thêm `write`. Mọi Part cấm dùng audio để trích đáp án.

## 3. Runtime Architecture

### Development

Command:

```bash
npm run dev
```

`npm run dev` runs:

```bash
tsx server.ts
```

In non-production mode, `server.ts` creates a Vite middleware server and mounts it into Express. The same Express process serves API routes and frontend dev assets.

### Production

Command:

```bash
npm run build
npm start
```

Build script:

```bash
node -e "require('fs').rmSync('dist',{recursive:true,force:true})" && vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs
```

Output:

- Client: `dist/client`.
- Server bundle: `dist/server.cjs`.
- Entry: `app.js` imports `./dist/server.cjs`.

In production, `server.ts` serves `dist/client` statically and returns `index.html` for SPA fallback routes. Hashed files under `/assets` use a one-year immutable cache; `index.html` remains revalidated so new deploys resolve the new hashes.

### cPanel Deploy

`.cpanel.yml` copies:

- `dist/client/*` to `/home/qzmivzbj/app.msdieu.com`.
- full `dist` folder.
- `app.js`, `package.json`, `package-lock.json`.
- `scripts/*.mjs` maintenance/preflight tools.

The host must have production env vars available to Node. Static-only hosting will show the React app, but API-backed features need the Node server running.

## 4. Authentication And User Model

### Client Auth

`src/context/AuthContext.tsx` owns:

- `user`: app profile from Firestore/backend.
- `firebaseUser`: Firebase Auth user.
- `token`: Firebase ID token.
- `loading`: auth restore/loading flag.
- login/register/logout methods.

Supported auth flows:

- Email/password login via Firebase Auth.
- Google popup login via Firebase Auth.
- Phone + password login implemented as:
  - `Login.tsx` calls `AuthContext.loginWithPhonePassword`.
  - Backend endpoint `/api/auth/login-by-phone` normalizes the phone number, rate-limits attempts, resolves the account server-side, verifies the password through Firebase Auth REST, then returns a Firebase custom token.
  - The old `/api/auth/email-by-phone` endpoint is deprecated and intentionally does not return account email.
- Phone numbers are normalized toward E.164-style format (`0...` -> `+84...`) and user profiles can carry `phoneVerified`.
- Phone OTP helper methods exist in `AuthContext`; `sendPhoneOtp` normalizes the phone number before calling Firebase.

Profile sync behavior:

1. `onIdTokenChanged` fetches the Firebase ID token on initial restore and on
   every background token refresh.
2. Client verifies the profile through backend `/api/me`; the global loading
   boundary is used only for initial restore, not hourly background refresh.
3. Protected UI uses the backend-verified profile while long-lived tabs receive
   the newest token without requiring a page reload.
4. Registration calls backend `/api/register` and requires that backend profile sync succeeds.

Important: direct client Firestore profile write fallback was removed in the Phase 1 security hardening pass. Backend Admin SDK is the profile write path.

Phase 2 authorization hardening:

- `/api/results` is role-scoped: super admin can view all completed activity, teachers only view activity tied to vocab/grammar/classes/assignments they manage, and students only view their own authenticated activity.
- Teacher write actions now go through ownership helpers for vocab sets, classes, class members, assignments, grammar sets, and TTS actions.
- Assignment private links must use random `shareToken`/`assignmentSlug`; the server no longer treats a predictable assignment id as a valid share token.
- Vocabulary private links have two explicit access contexts: an assignment token binds the session to that assignment/game/class, while a direct vocab-set token opens the private set without guessing an assignment and uses the set/grade class metadata. `GET /api/vocab-sets/share/:token` and `POST /api/game-sessions` share the same token resolver, and guest session creation revalidates the token.
- New assignment/private-set share tokens are created only by the owning write
  flows. Student GET/read paths never generate or persist a token. Existing
  stored `shareToken`/`assignmentSlug` values are projected into indexed SQLite
  columns by the additive startup migration described in section 83.
- Starting a vocabulary game rejects draft or unavailable vocab sets unless a valid assignment context makes the lesson eligible.

### Backend Auth

`server.ts` middleware:

- `authenticateUser`: requires `Authorization: Bearer <Firebase ID token>`.
- Verifies token with `adminAuth.verifyIdToken`.
- Loads/creates `users/{uid}` profile.
- Token verification failures return 401; profile/storage resolution failures
  are handled separately as 500/503 and are not mislabeled as expired login
  sessions. Logs contain only safe error metadata, never the bearer token.
- Assigns `super_admin` role automatically for:
  - `linyi8901@gmail.com`
  - `admin@vocabulary.edu.vn`
- Accepts `super_admin` only from a Firebase custom claim or the bootstrap admin email list.
- Blocks API access unless user status is `active`.
- Adds `req.user`.

`requireRole([...])` restricts teacher/super_admin/admin-only endpoints.

Local test authentication:

- `npm run dev:local` starts the source app with SQL.js data under `.data/` and
  injects a fixed `Local Test Super Admin` profile, so Firebase login is not
  required while testing `http://localhost:3000`.
- The bypass contract lives in `src/lib/localAuthBypass.ts`. Backend acceptance
  requires all of: explicit local flag, `NODE_ENV !== production`, the fixed
  local token, a loopback hostname, and a loopback socket address.
- `server.ts` refuses to start if `LOCAL_AUTH_BYPASS_ENABLED=true` under
  production. Normal `npm run dev`, build, `npm start`, and hosted Firebase auth
  behavior are unchanged.
- `scripts/start-local-test.mjs` is the only supported launcher for this mode;
  local SQLite/media output is ignored through `.gitignore` and never shares
  production storage.

### Roles

Current active roles in backend and auth context:

- `student`
- `teacher`
- `super_admin`

Note: `src/types.ts` now uses `Role = 'super_admin' | 'teacher' | 'student'`.

### Statuses

Current statuses:

- `active`
- `pending`
- `blocked`
- `deleted`

`App.tsx` blocks UI if `user.status === 'blocked'`.

## 5. Data Model And Firestore Collections

Canonical runtime collections:

- `users`
- `vocab_sets`
- `classes`
- `class_members`
- `assignments`
- `game_sessions`
- `game_session_actions`
- `grammar_sets`
- `grammar_attempts`
- `audit_logs`
- `guest_profiles`

### User Profile

Fields used:

- `id`
- `name`
- `email`
- `phone?`
- `role`: `student | teacher | super_admin`
- `status`: `active | pending | blocked | deleted`
- `createdAt`

### Guest Profile

Name-only learners are stored separately from Firebase accounts in `guest_profiles`:

- `id` / `guestId`
- `displayName` and `normalizedName`
- fixed `role: student`
- `status: active | blocked`
- optional `classId` / `className`
- `createdAt`, `updatedAt`, `lastActiveAt`

Guest profiles never contain passwords or synthetic email addresses and cannot be promoted to teacher or super admin. Display names are normalized with Unicode NFKC and must contain 2-20 letters/marks plus spaces, apostrophes, or hyphens.

### VocabSet

Fields:

- `id`
- `title`
- `description`
- `subject`
- `tags`
- `gradeLevel`
- `createdAt`
- `createdBy`
- `creatorName`
- `status`: `draft | public | private`
- `items: VocabItem[]`

### VocabItem

Fields:

- `id`
- `term`
- `meaning`
- `ipa`
- `pos`
- `example`
- `exampleMeaning`
- `imageUrl?`
- `audioUrl?`
- `notes?`
- `displayOrder`

### Class

Fields:

- `id`
- `name`
- `code`
- `teacherId`
- `createdAt?`

### ClassMember

Fields:

- `id`
- `classId`
- `studentName`

Currently this is name-based roster data, not strongly linked to Firebase user IDs.

### Assignment

Fields:

- `id`
- `classId`
- `className`
- `vocabSetId`
- `vocabSetTitle`
- `gameId`
- `dueDate`
- `createdAt`
- `createdBy`
- `title`

### GameSession

Fields:

- `id`
- `assignmentId?`
- `vocabSetId`
- `vocabSetTitle`
- `gameId`
- `studentName`
- `startedAt`
- `completedAt?`
- `score`
- `totalQuestions`
- `correctAnswers`
- `incorrectAnswers`

Some fallback client writes also add `status: 'started' | 'completed'`.

## 6. Backend API Map

All routes are in `server.ts`.

Unauthenticated:

- `GET /api/auth/debug`: checks backend DB access/debug info.
- `POST /api/auth/email-by-phone`: maps phone number to email for phone + password login.
- `POST /api/guest-profiles/resolve`: resolves an existing learner by `guestId`, or validates a new 2-20 character name before creating the browser guest profile.
- `POST /api/guest-profiles/identify`: read-only lookup by stable `guestId`; returns the canonical existing profile name or a legacy name snapshot without creating, renaming, or deleting data.

Authenticated:

- `GET /api/me`: current user profile.
- `POST /api/register`: sync registration profile fields.
- `POST /api/ai/ipa`: generate IPA for one word.
- `GET /api/vocab-sets`: list vocab sets; students only receive `public`.
- `GET /api/classes`: list classes.
- `GET /api/class-members`: list class members.
- `GET /api/assignments`: list assignments.
- `POST /api/game-sessions`: start game session.
- `POST /api/game-sessions/lazy-complete`: idempotently create and complete a short-game session in one logical batch. The immutable key is actor + vocabulary set + game + `clientRunId`; retries with the same run secret return the existing completed result.
- `POST /api/game-sessions/activate`: lazily create/resume a Speaking AI session at the first recording interaction.
- `PUT /api/game-sessions/:id`: complete/update game session.
- `GET /api/results`: list completed vocabulary/grammar/listening activity. `view=summary&limit=N` returns a bounded detail-free feed for dashboard lists; the legacy/default shape remains available to existing authenticated callers.
- `GET /api/results/:sourceType/:resultId`: authorized lazy detail for one `vocabulary`, `grammar`, or `listening` result. It applies the same student/teacher/super-admin scope before returning answer detail.

Teacher or super admin:

- `POST /api/ai/generate`: generate vocab items by topic/grade/count.
- `POST /api/vocab-sets`: create vocab set.
- `PUT /api/vocab-sets/:id`: update vocab set.
- `DELETE /api/vocab-sets/:id`: delete vocab set and related assignments.
- `POST /api/vocab-sets/:id/clone`: clone vocab set as draft.
- `GET /api/admin/vocab-sets/:id/results`: teacher/admin completed game sessions for one managed vocabulary set, newest first; response omits session token hashes and does not apply recent-activity deletion/cleanup.
- `GET /api/admin/accounts`: super admin receives the unified account directory; teachers receive only guest students with activity in classes they manage.
- `POST /api/classes`: create class.
- `DELETE /api/classes/:id`: delete class, members, and assignments.
- `POST /api/classes/:classId/members`: add class member.
- `DELETE /api/classes/:classId/members/:memberId`: delete class member.
- `POST /api/assignments`: create assignment.
- `DELETE /api/assignments/:id`: delete assignment.
- `POST /api/admin/grammar-sets`: create grammar set.
- `PUT /api/admin/grammar-sets/:id`: update grammar set.
- `DELETE /api/admin/grammar-sets/:id`: delete grammar set.
- `POST /api/admin/grammar-sets/:id/clone`: clone grammar set.
- `GET /api/admin/grammar-sets/:id/results`: teacher/admin grammar results for one set.

Grammar:

- `GET /api/public/grammar-sets`: public grammar lessons for guest/student home without Firebase auth.
- `GET /api/grammar-sets`: list grammar sets; students only receive public sets.
- `GET /api/grammar-sets/share/:token`: open a private grammar lesson by generated share token.
- `GET /api/grammar-sets/:id`: read one grammar set with student-safe shape.
- `POST /api/grammar-sets/:id/attempts`: create a grammar attempt and persist shuffled question/option order. Accepts authenticated users or guest body/query identity (`guestId`, `studentName`); private grammar links must include the share token.
- `POST /api/grammar-sets/:id/attempts/prepare`: validate access/attempt limits and return deterministic question order without writing a `grammar_attempts` row.
- `POST /api/grammar-sets/:id/attempts/activate`: create the prepared attempt and its first answer together. The deterministic `clientRunId` key and hashed run secret make retries idempotent.
- `POST /api/grammar-attempts/:attemptId/answers`: save one selected option; server grades by option ID. Accepts the same authenticated/guest identity as attempt creation.
- `POST /api/grammar-attempts/:attemptId/submit`: finalize and score attempt. Accepts the same authenticated/guest identity as attempt creation.
- `GET /api/grammar-attempts/:attemptId/review`: review own attempt or teacher/admin-authorized attempt. Guests can review their own attempt using the same `msdieu_guest_id`.
- `GET /api/grammar-sets/:id/my-attempts`: current user's or current guest's attempt history for one grammar set.
- Completed `grammar_attempts` are normalized into activity-like rows in `/api/results` and `/api/public/results` with `sourceType: "grammar"`, `gameId: "grammar-practice"`, and `vocabSetId: "grammar:<grammarSetId>"`.
- `/api/results` includes grammar answer details for authenticated admin/review UI; `/api/public/results` omits answer details.

Super admin only:

- `GET /api/admin/users`: list all users.
- `PUT /api/admin/users/:userId/role`: change role and Firebase custom claims.
- `PUT /api/admin/users/:userId/status`: lock/unlock/change status.
- `GET /api/admin/audit-logs`: list audit logs ordered by timestamp desc.
- `PUT /api/admin/users/:userId/display-name`: validate and rename a registered account; Firebase Auth sync is best effort.
- `PUT /api/admin/guest-profiles/:guestId/display-name`: validate and rename a guest profile. Super admin can manage all guest profiles; a teacher is limited to students with activity in a class managed by that teacher.
- `PUT /api/admin/guest-profiles/:guestId/status`: block or reactivate a guest profile; guest role remains student.

Account/result identity behavior:

- New vocabulary/grammar guest registration, registered-account sign-up, and explicit admin/teacher rename inputs share the 2-20 character display-name validator.
- Existing registered users and existing guests are resolved by stable `userId`/`guestId` first. Their stored canonical name remains accepted even when a legacy name is longer than 20 characters.
- A browser `localStorage` name is never sufficient proof of an existing identity. The frontend calls the read-only guest identity endpoint before enabling vocabulary or grammar learning.
- If no guest profile exists, the backend may resolve a legacy guest by the same stable `guestId` in `game_sessions` or `grammar_attempts`. This compatibility lookup does not rewrite the historical record or create a replacement profile.
- Existing `game_sessions`, `grammar_attempts`, and `leaderboard_events` retain their original name snapshots.
- Result and leaderboard APIs resolve the current name from `users` or `guest_profiles`, then fall back to the stored snapshot.
- Legacy activities with a `guestId` can be backfilled additively into `guest_profiles` using the explicit `db:backfill-hot-read-models` maintenance command. Request/read paths never run this migration. Activities without a stable user/guest id are left untouched and marked `legacyUnlinked` in enriched API output.

## 7. Backend Fallback DB Layer

`src/lib/firebaseAdmin.ts` exports:

- `adminDb`: custom Firestore-like facade.
- `adminAuth`: Firebase Admin Auth.
- `firebaseDiagnosticReady`: startup diagnostic promise.

Behavior:

1. Tries to initialize Firebase Admin from env:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
2. Runs diagnostic write/read/delete.
3. If missing credentials or diagnostic fails, switches to local fallback.
4. Local fallback reads/writes `db.json`.
5. When Firestore works, writes also sync to local DB for resilience.

Collection name mapping for `db.json`:

- `class_members` -> `classMembers`
- `vocab_sets` -> `vocabSets`
- `game_sessions` -> `gameSessions`
- `audit_logs` -> `auditLogs`

Important implementation risk:

- `FallbackDoc.collectionName` is private but batch code accesses it through `any`; works at runtime but is fragile.
- Local fallback supports basic `where`, `orderBy`, `limit`, not full Firestore semantics.

## 8. Frontend Screen Flow

`src/main.tsx`:

- Creates React root.
- Wraps app with `AuthProvider`.
- Provides the shared `Suspense` fallback for lazy top-level screens.

`src/App.tsx` decides which screen to show:

1. Loading screen while auth restores.
2. Login/Register if no authenticated user.
3. Blocked account screen if status is `blocked`.
4. `StudentLearningArea` if a vocab set is selected.
5. `AdminDashboard` if user is `teacher` or `super_admin` and not in student-view mode.
6. Student home portal otherwise.

The top-level Admin, student game shell, grammar, Listening, and History screens
are lazy-loaded without changing their route or props. `StudentLearningArea`
also lazy-loads each game implementation, and the Admin Listening library loads
only when its tab is rendered. Firestore stays outside the startup bundle and
loads only if a direct-client fallback is actually needed.

Home portal:

- Loads vocab sets, assignments, classes after token exists.
- First attempts backend API.
- Falls back to direct Firestore reads.
- Students see `public` vocab sets.
- Assignment cards find matching `vocabSetId`, then open selected game with `assignmentId` and `gameId`.

Teacher/super admin:

- Admin dashboard is default.
- Can switch to student view.
- Can preview any vocab set/game as student.

## 9. Admin Dashboard Responsibilities

`src/components/admin/AdminDashboard.tsx` is the largest frontend file and combines many responsibilities:

- Dashboard summary.
- Vocab set listing/filtering.
- Vocab set editor.
- Batch import terms/meanings/IPAs.
- AI generation for vocab items.
- AI IPA generation for individual/all rows.
- Class creation/deletion.
- Class member add/delete.
- Assignment creation/deletion.
- Results table.
- Recent activity view.
- Grammar set directory/editor/results view.
- Super admin user management.
- Super admin audit logs.

Key state groups:

- Data lists: `vocabSets`, per-set `vocabResults`, `classes`, `classMembers`, `assignments`, `results`, `usersList`, `auditLogs`.
- Filters: vocab search/grade/status; grammar search/grade/status; user search/role/status; recent activity student-name search; leaderboard period/category/class/vocab-set filters.
- Editor state: title, description, subject, grade, status, tags, items.
- Batch import: terms, meanings, IPAs.
- AI generation: topic, grade, count, loading.
- Assignment form state.
- Notifications.

API wrapper:

- `authFetch(url, options)` injects `Authorization: Bearer ${token}` and JSON content type.
- `authFetchJson<T>(url, options)` wraps `authFetch`, parses JSON, and throws on non-2xx responses so admin handlers do not silently ignore backend errors.

When extending admin features, consider extracting smaller modules before large changes:

- Vocab editor panel.
- Classes panel.
- Assignments panel.
- Results panel.
- Grammar sets panel.
- Grammar editor panel.
- Users panel.
- Audit logs panel.

Grammar module notes:

- Grammar data is stored separately from vocabulary data.
- Runtime collections/tables include `grammar_sets` and `grammar_attempts`; SQLite migration also creates separate grammar tables for questions/options/attempt details.
- Admin UI adds `grammar-sets` and `grammar-editor` tabs in `AdminDashboard.tsx`.
- `grammar_sets.questionType` supports `multiple_choice` and `rewrite`. Existing records without this field are always treated as `multiple_choice`, so the original grammar quiz flow remains backward compatible.
- The admin menu exposes `Soạn bài ngữ pháp` for multiple choice and `Soạn bài tự luận` for text answers. Both save into the same grammar library and retain the existing edit, clone, delete, share, result, recent-activity, and leaderboard flows.
- Rewrite bulk import accepts blocks containing `QUESTION`, `ANSWER`, and `EXPLANATION`. Rewrite questions store `correctAnswer`; they do not create A/B/C/D options.
- `parseBulkGrammarText()` accepts 2-4 answer options per block: `QUESTION`, `A`, `B`, `ANSWER`, and `EXPLANATION` are required; `C` and `D` are optional but must remain contiguous. `ANSWER` must reference an option present in that block, and explanation may span multiple lines.
- Correct answers are stored and checked by stable option IDs, not by A/B/C/D labels after shuffle.
- Server validation accepts 2-4 non-empty, uniquely identified answer options. Existing 4-option questions remain compatible, while student attempt/review screens render only the dynamic `optionsSnapshot` stored for each question.
- Rewrite attempt snapshots store `questionType`, `correctAnswerSnapshot`, optional `acceptedAnswersSnapshot`, and the student's `textAnswer` in `grammar_attempts`. Text grading version 2 normalizes Unicode, letter case, leading/trailing/repeated whitespace, spacing around common punctuation, invisible mobile formatting characters, and straight/typographic apostrophes before exact comparison.
- Rewrite questions may define up to 20 explicit `acceptedAnswers`. These alternatives are additive, de-duplicated against the primary answer after normalization, snapshotted when an attempt starts, and never exposed before review. Equivalent contractions such as `it's` and `it is` are accepted only when the teacher explicitly lists both; the grader does not use fuzzy matching or guess grammatical equivalence.
- Student attempts persist question order and option order snapshots, so reload/review does not reshuffle completed work.
- Server APIs grade answers and reject updates after submit; students may only review their own attempts.
- Answer-save responses do not expose `correctOptionId`/`correctAnswer` unless `showExplanationImmediately` is enabled. When enabled, `GrammarLearningArea` stores feedback per question, marks the correct/wrong response, shows the correct answer and explanation immediately, and locks that question after the response is saved. Submit/review responses only expose correct answers and explanations to students/guests when `showReviewAfterSubmit` is enabled; staff with manage permission can review full details.
- Before deploying storage/schema changes to production SQLite, backup `/home/qzmivzbj/app-data/vhomework/app.sqlite`. The grammar migration must remain additive/idempotent and must not delete or rewrite existing vocabulary/game/user tables.
- The rewrite extension requires no destructive SQLite migration: grammar records remain in the existing `data_json` columns and all new fields are additive.

Vocabulary result history:

- The vocabulary and grammar directories use compact, sortable-by-created-date-first link lists instead of large card grids. The title is a link-like Play control, while each row still exposes `Play`, `Sửa`, `Sao chép`, `Kết quả`, and `Xóa`.
- Rows show class/grade, subject/topic, item or question count, visibility, creation time, and a compact private-link copy control. Full URLs are no longer rendered as large card blocks.
- Both directories paginate on the client with a default of 10 rows per page and options for 20 or 50. The pagination displays numbered pages with ellipses, previous/next controls, and resets to page 1 when search/filter/page-size changes.
- `Kết quả` calls `GET /api/admin/vocab-sets/:id/results` and expands `vocab-results-panel` below the vocabulary list.
- The result table shows student, game, score, correct/wrong/unanswered counts, duration, completion time, and a `Xem` action.
- `Xem` reuses the existing `selectedActivity` detail modal and the compact `answerDetails` already stored in `game_sessions`; legacy rows without answer details remain visible as summaries.
- This history is read-only. It must not delete, rewrite, or expire `game_sessions`; the 7-day filter remains specific to Recent Activity APIs/UI.
- Legacy vocabulary sessions remain readable as schema v1/v2. Lazy short-game sessions use `schemaVersion: 3`: opening a lesson, switching games, or starting without answering creates no database row. Actions stay in browser memory and `POST /api/game-sessions/lazy-complete` calculates the authoritative result, writes the completed session, and writes its deterministic leaderboard event in one batch.
- `clientRunId` plus a random run secret identifies one immutable attempt. The server stores only the secret hash. A repeated request returns the existing result and cannot create a second leaderboard event. `Chơi lại` creates a new `clientRunId`.
- A bounded 24-hour browser retry queue stores only failed completed short-game submissions. Reloading the same tab retries with the same immutable key. There is no direct Firestore fallback and no automatic cleanup of server records.
- Speaking AI is the exception: it activates a schema-v3 session at the first recording interaction, then keeps incremental action/pronunciation durability because the backend session protects the speech API.
- Canonical scores use 0-100. Millionaire additionally stores its prize-ladder value in `gameScore`/`rawScore` with `maxScore: 1000000` so cross-game leaderboard comparisons remain normalized.
- Per-set results include completed, in-progress, and interrupted sessions. Sessions without completion after 24 hours display as interrupted but are not deleted and never enter score/leaderboard calculations.

Grammar directory behavior:

- `grammar-sets` uses the same compact list pattern and action set as vocabulary, with grammar-specific question count and topic metadata.
- Grammar search, grade, and visibility filters are client-side and use the same 10/20/50 pagination component.
- `Kết quả` calls `GET /api/admin/grammar-sets/:id/results` and expands `grammar-results-panel` below the grammar list. Existing result-detail behavior remains unchanged.
- Missing legacy `createdAt` values display as `--` and sort after dated records; no backfill or database write is performed by the directory UI.

Recent activity behavior:

- Source data is `results`, loaded from `/api/results`.
- `/api/results` is expected to return completed game sessions within the display window, currently 7 days.
- Dashboard overview shows the 30 newest completed sessions only.
- The dashboard "Xem tất cả" button expands `dashboard-activity-expanded` inline under the overview cards instead of navigating to the results tab. It shows all returned sessions from the 7-day window, sorted newest first.
- `dashboard-activity-expanded` filters by student name on the client, using accent-insensitive search.
- The duplicate `activity-results-sheet` inside the dedicated Results/Bang vang tab is hidden; the Results tab now focuses on leaderboard filters, podium, and ranking table only. Recent-activity review remains in the Dashboard expansion.
- Clicking an activity opens the existing `selectedActivity` detail modal with summary and answer details.
- Do not implement recent activity by deleting records from `game_sessions`; old records should be hidden by API/query/display filtering unless an explicit, backed-up maintenance cleanup is approved.

## 10. Game Engine Map

### Registry

`src/lib/game-engine/gameList.ts` defines `GAMES_LIST`.

`src/lib/game-engine/quizContracts.ts` is the shared quiz contract used by both the browser and `server.ts`. It owns current question/answer modes, legacy snapshot fallback, item eligibility, and question/answer value selection so the client and authoritative grader cannot silently diverge.

Current game modes:

- `flashcard-en-vi`
- `flashcard-vi-en`
- `flashcard-sound`
- `quiz-en-vi`
- `quiz-vi-en`
- `quiz-sound`
- `fill-meaning`
- `fill-missing`
- `matching-word-meaning`
- `memory-match`

`quiz-sound` keeps its stable game ID but uses contract version 2 for newly created snapshots: the prompt is English audio (`term`) and the selectable/correct answer is the Vietnamese `meaning`. Stored legacy snapshots with `answerType: term`, or without a contract version, remain contract version 1 and continue to grade against the English term. Completed history is never migrated or regraded.

Each game config includes:

- `gameId`
- `title`
- `description`
- `category`
- `icon`
- `color`
- `componentName`
- `requiredFields`
- `config`

To add a new game:

1. Create new component in `src/components/games`.
2. Add component import and switch case in `StudentLearningArea.tsx`.
3. Add config entry in `GAMES_LIST`.
4. Ensure game calls `onComplete(score, correct, incorrect)`.
5. Decide whether it needs linear controls or board controls.

### StudentLearningArea

Responsibilities:

- Accepts `vocabSet`, optional `assignmentId`, optional `initialGameId`.
- Manages selected game, active item order, shuffle, fullscreen, mute, current session, result overlay.
- Creates only a local `clientRunId`/run secret when a short game is selected; no server session is created until completion.
- Completes short games through one `/api/game-sessions/lazy-complete` request when the game calls `onComplete`.
- Direct Firestore write/update fallback was removed. If backend session persistence fails, the game can continue but that attempt is not written through a client-side bypass.
- The lazy APIs derive deterministic server IDs from actor/lesson/game/`clientRunId`; the secret is hashed at rest and is required for guest retry/resume.
- Replay and switching games increment `gameRunId`, remount the child game, clear the result overlay, and create a fresh local run. Merely switching creates no abandoned database session.
- Failed completed submissions are retained in a bounded local retry queue and expose `Thử lưu lại`; successful responses remove the pending item.
- `SpeakingAIGame` calls `ensureGameSession` at the first recording interaction and passes the returned session token to `/api/pronunciation-attempts`.

### Game Components

Shared props pattern:

- `items`
- `config`
- `onComplete`
- `isMuted`
- `setIsMuted`
- `isRandomized`
- `onToggleRandom`
- `isFullscreen`
- `onToggleFullscreen`

`FlashcardGame.tsx`:

- Linear card flip.
- Can mark known/unknown.
- Auto-pronounces word on change when sound is on.
- Auto-next mode flips then advances every 4 seconds.
- Score: known count / total. Unmarked cards are treated as unknown; there is no all-correct fallback.

`QuizGame.tsx`:

- Linear multiple choice.
- Generates up to 3 distractors from other items.
- Supports term, meaning, and sound question modes.
- Filters out items missing a field required by the active quiz contract; `quiz-sound` therefore requires both `term` and `meaning` in new sessions.
- `quiz-sound` is displayed as `Nghe và chọn nghĩa`: audio still reads the English term while options and newly stored answer details use Vietnamese meanings.
- Score: correct / total.
- Answer details are replaced by `wordId`; returning to a previous question cannot duplicate score rows.
- Final result builds one row per item so unanswered questions are counted as incorrect.

`FillBlankGame.tsx`:

- Linear text input.
- Modes: full word or missing letters.
- Case-insensitive exact match.
- Score: correct / total.
- Answer details are replaced by `wordId`; returning to a previous question cannot duplicate score rows.
- Final result builds one row per item so unanswered questions are counted as incorrect.
- Native form Enter checks the current answer. After feedback appears, focus
  moves to the existing `TIẾP THEO`/`XEM KẾT QUẢ` button so Enter invokes the
  same `handleNext` path as a click; the next question returns focus to its text
  input. No global keyboard listener or duplicate index mutation is used.
- The student answer input rejects clipboard paste, paste-style `beforeinput`
  insertion, and dragged text while retaining normal typed/composition input.
  A blocked attempt leaves the existing answer unchanged and displays an
  accessible typed-only message below the field.

`MatchingGame.tsx`:

- Board game with max 8 vocab items.
- Cards are term/meaning pairs.
- Timer counts elapsed seconds.
- Score: `max(50, 100 - mistakes * 5)`.
- Interval and short-lived failed-card timeout are stored in refs and cleared on restart/unmount.
- The first selected card uses a light amber selected state. A correct pair keeps
  the established emerald matched state; an incorrect pair keeps the established
  temporary rose failed state before returning to neutral.

`MemoryGame.tsx`:

- Board game with max 6 vocab items.
- Cards are term/meaning pairs.
- Score: `max(50, 100 - excessMoves * 4)`.
- `incorrect` sent to `onComplete` is failed match attempts, not total moves.
- Match/flip-back timeouts and elapsed-time interval are stored in refs and cleared on restart/unmount.

`MillionaireGame.tsx`:

- Answer resolution and next-step timeouts are stored in refs and cleared on restart/unmount.
- Elapsed-time interval is cleared before a new interval starts.

`GameControlPanel.tsx`:

- Shared previous/next/sound/random/auto-next/fullscreen controls.
- Board games pass `showLinearControls={false}`.

### Speech

`src/lib/game-engine/speech.ts`:

- Uses browser `window.speechSynthesis`.
- Cancels ongoing speech before speaking new word.
- Strips slash/backslash/hash symbols.
- Uses `en-US` voice if available.
- Rate is `0.9`.

## 11. AI Integration

Backend Gemini client in `server.ts`:

- Env var: `GEMINI_API_KEY`.
- Client: `new GoogleGenAI({ apiKey })`.

Routes:

- `/api/ai/ipa`: asks Gemini for IPA only.
- `/api/ai/generate`: asks Gemini for JSON vocab items.

Current model string:

- `gemini-3.5-flash`

Fallbacks:

- Missing key or AI error returns basic generated IPA or hardcoded vocab fallback lists for animals/school/topic.

When changing AI behavior:

- Keep backend proxy pattern; do not call Gemini directly from frontend.
- Validate JSON shape from Gemini before merging into editor state.
- Keep fallback behavior so hosted app remains usable without AI.

## 12. Styling And UI Notes

`src/index.css` applies very broad global overrides:

- Dark mesh background.
- Glassmorphic conversion of `.bg-white`, `.bg-gray-50`, many text and border utilities.
- Broad button override using `button:not(...)`.
- Input/select/textarea dark glass styles.
- Table and scrollbar overrides.
- Card flip utilities.

This means local Tailwind class changes may be visually overridden globally.

Before adjusting visual UI:

- Inspect `src/index.css` first.
- Test login, home, admin, and at least one game screen because global overrides affect all.
- Be careful with new utility classes; global CSS may force colors/backgrounds unexpectedly.

Known frontend design risk:

- Some UI files still contain large visible Vietnamese strings. Terminal output shows mojibake for many strings. Verify actual browser rendering before editing text-heavy sections. If source files are truly corrupted, fix encoding deliberately in a separate pass.

## 13. Firestore Rules

`firestore.rules` was tightened during the Phase 1 security hardening pass:

- `users/{userId}`: client can read only its own profile; client writes are denied.
- `vocab_sets`: authenticated client reads are still allowed for legacy fallback/read-only use; client writes are denied.
- `classes`, `class_members`, `assignments`, `game_sessions`, `grammar_sets`, `grammar_attempts`, `pronunciation_attempts`, and `audit_logs`: client read/write is denied.
- Backend Firebase Admin SDK remains the write path and bypasses Firestore client rules.

Remaining security concern:

- Some frontend read fallbacks still exist and may fail under tightened rules when backend is unavailable. This is intentional for P0; remove or replace these read fallbacks in a later cleanup pass.
- Full anti-cheat still requires server-side answer validation/scoring in a later phase.

## 14. Seed Data

`server.ts` `preSeedDb()` runs after server listen and Firebase diagnostic.

Seeds if collections are empty:

- Users:
  - `teacher-1`
  - `admin-1`
- Classes:
  - `class-1`
  - `class-2`
- Class members:
  - `member-1` to `member-5`
- Vocab sets:
  - `set-1`: Ordinal Numbers.
  - `set-2`: Animals - Basic.
- Assignments:
  - `assign-1`
  - `assign-2`

Seed IDs are static except newly created app data uses timestamp-based IDs.

## 15. Known Inconsistencies And Risks

- `firebase-blueprint.json` is partly stale compared with actual runtime schema. For example it uses fields like `topic`, `creatorId`, `gameType`, `studentId`, while runtime uses `subject`, `createdBy`, `gameId`, and name-based sessions.
- Firestore client writes are now much stricter than the old backend role model; backend APIs should remain the only write path for managed data.
- Client direct Firestore write fallbacks for profile and game sessions were removed.
- `/api/game-sessions` accepts authenticated users or guest identity, creates a server-random session ID, stores owner metadata, and requires owner/session token to complete. Client-submitted score is still trusted until the later server-side scoring phase.
- `App.tsx` imports unused icons/states such as `classes`, `homeSearch`, etc. Some UI/filter state appears incomplete.
- `AdminDashboard.tsx` is large and hard to maintain; high risk for merge conflicts and accidental UI regressions.
- ID generation uses `Date.now()` plus random suffix in some places, not a central ID helper.
- `QuizGame` and `FillBlankGame` now compute final score from normalized answer-detail rows instead of async counter state; each question contributes one row.
- `src/index.css` broad overrides can cause unexpected design changes.
- Production deploy copies `db.json`; if local fallback is active on host, server writes to the deployed JSON file. Persistence depends on host filesystem behavior.
- Terminal output shows mojibake for Vietnamese strings; verify encoding/rendering before text changes.

## 16. Safe Extension Guidelines

When adding backend features:

- Add route in `server.ts`.
- Decide auth level: unauthenticated, authenticated, teacher/super_admin, or super_admin.
- Update frontend call path.
- Consider whether direct Firestore fallback is needed or should be removed/tightened.
- Add/adjust Firestore rules if direct client access remains.
- Add audit log for admin/teacher write actions.

When adding frontend data:

- Update `src/types.ts`.
- Update backend schema construction and CRUD payloads.
- Update `firebase-blueprint.json` only if still used by AI Studio tooling.
- Update local fallback `db.json` shape if needed.

When adding a game:

- Keep `StudentLearningArea` as game shell.
- Keep game component pure: it should render gameplay and call `onComplete`.
- Add metadata to `GAMES_LIST`.
- If assignment can target it, ensure `gameId` is saved in assignments.
- Test session creation and result update.

When changing auth/roles:

- Update `AuthContext.tsx`, `server.ts`, `src/types.ts`, admin UI filters, and Firestore rules together.
- Keep default super admin bootstrap emails clear and documented.
- Be careful with custom claims: frontend currently relies mainly on Firestore profile, not claims.

When changing deploy:

- Keep `npm run build` output contract: `dist/client` and `dist/server.cjs`.
- Keep `app.js` aligned with server output path.
- Update `.cpanel.yml` if files needed at runtime change.

## 17. Recommended Future Refactors

Priority 1:

- Fix `src/types.ts` role mismatch to use `super_admin`.
- Make `StudentLearningArea` send `Authorization` header to game session APIs or intentionally make those endpoints public with validation.
- Tighten Firestore rules to match roles, especially `audit_logs`, `vocab_sets`, `classes`, and `assignments`.
- Verify and fix Vietnamese encoding if browser shows corrupted text.

Priority 2:

- Split `AdminDashboard.tsx` into smaller tab components.
- Centralize API client so token handling and error handling are consistent.
- Centralize ID generation.
- Align `firebase-blueprint.json` with real runtime types.

Priority 3:

- Add tests for backend auth/role routes and game scoring.
- Add schema validation for API payloads.
- Add analytics fields such as duration, attempts, per-word mistakes.
- Add class membership linked to authenticated student user IDs instead of names only.

## 18. Quick Orientation For Next Session

If improving UI:

1. Read `src/index.css`.
2. Read the target component.
3. Check whether global overrides affect the component.

If improving admin:

1. Read `src/components/admin/AdminDashboard.tsx`.
2. Find the relevant handler near the top.
3. Find the matching JSX section by tab name or visible IDs.
4. Confirm backend route in `server.ts`.

If improving games:

1. Read `src/lib/game-engine/gameList.ts`.
2. Read `src/components/games/StudentLearningArea.tsx`.
3. Read the target game component.
4. Check `onComplete` scoring and session update.

If improving data/security:

1. Read `server.ts` auth middleware and target API route.
2. Read `src/lib/firebaseAdmin.ts` fallback behavior.
3. Read `firestore.rules`.
4. Search frontend for direct `firebase/firestore` calls.

## 19. Current State Addendum - 2026-07-05

This section records important changes made after the original 2026-07-02 codemap.

### Branding And Static Assets

- Browser tab title is now `Tiếng Anh Cô Diệu`.
- `index.html` includes:
  - `<link rel="icon" type="image/png" href="/logo.png" />`
  - `<link rel="apple-touch-icon" href="/logo.png" />`
- `public/logo.png` is the current favicon/logo source.
- Production build copies it to `dist/client/logo.png`.

### Storage Architecture

The backend now supports multiple storage modes:

- `firebase`: use Firebase/Firestore. This is the default when `STORAGE_MODE` is omitted.
- `local-json`: use local JSON storage only when explicitly configured. It is not an automatic fallback.
- SQLite mode through the facade in `src/lib/sqliteStorage.ts` and driver modules in `src/lib/storage/` when `STORAGE_MODE=sqlite`.
- Legacy `firebase-first` is normalized to `firebase`; Firestore read/write failure returns a storage-unavailable API error instead of switching to local data.

SQLite notes:

- `src/lib/sqliteStorage.ts` stores normalized tables plus `data_json`.
- `vocab_items.audio_url` already exists and maps from `audioUrl`.
- `vocab_sets` are saved with nested `items`, and items are also upserted into `vocab_items`.
- `game_sessions` include `guestId` through JSON/data fields and are used for leaderboard identity.
- `leaderboard_events` stores compact completed-attempt summaries for longer-lived leaderboard calculations.
- Primary SQLite driver: pinned `better-sqlite3@10.1.0`, one native connection per process, real transactions, and WAL. This exact compatibility pin passed production Node 22.16/glibc 2.28/GCC 8.5 preflight.
- `sql.js` is an explicit emergency rollback driver only. It refuses startup when a non-empty `app.sqlite-wal` exists.
- Production must explicitly set the driver/path and deny implicit creation/import/seed. Storage integrity and migrations finish before `app.listen()`.
- Additive migration `native-hot-query-columns-v2` backfills normalized game/grammar completion fields without rewriting `data_json`.
- Host maintenance commands live in `scripts/*.mjs`: preflight, diagnostics, online backup, checkpoint, and WAL-to-DELETE rollback preparation.

### Data Loss Incident Note - 2026-07-08

Incident:

- After deploying the recent activity/detail-history changes, production appeared to lose all data: vocabulary sets, users, classes, leaderboard/game results, and logs.
- The visible failure was caused by production startup and storage configuration, not by `git push` itself.

Root causes found:

- Automatic cleanup for recent activity was implemented as a physical delete against `game_sessions` and was called during server startup and result reads. This made old game session data disappear instead of only hiding it from the "recent activity" view.
- Production could fall back to local JSON storage when Firebase Admin diagnostics failed. The old fallback path was `process.cwd()/db.json`, which is inside the deploy directory and is not a safe persistent database location.
- The production host had an existing SQLite database at `/home/qzmivzbj/app-data/vhomework/app.sqlite`; the app had to be configured with `STORAGE_MODE=sqlite` and `SQLITE_DB_PATH=/home/qzmivzbj/app-data/vhomework/app.sqlite`.
- SQLite migration for the new `expires_at` field created indexes on `expires_at` before adding that column to old databases, causing startup crash: `no such column: expires_at`.
- `.env.production` with real secrets existed locally. Secrets must not be committed or exposed, and any exposed service account key must be rotated.

Fixes applied:

- Removed automatic physical cleanup calls from server startup and results endpoints. Recent activity now filters old records for display instead of deleting database rows automatically.
- Moved local JSON fallback to a persistent path: `LOCAL_DB_PATH` or `/home/qzmivzbj/app-data/vhomework/db.json`.
- Fixed SQLite migration order so legacy databases add `expires_at` before creating indexes that reference it.
- Phase 4 storage hardening removed automatic fallback from Firestore mode. If Firestore is configured and unavailable, backend APIs return 503 instead of writing to local JSON.
- Production should use these environment variables when SQLite is the data source:
  - `STORAGE_MODE=sqlite`
  - `SQLITE_DRIVER=better-sqlite3`
  - `SQLITE_DB_PATH=/home/qzmivzbj/app-data/vhomework/app.sqlite`
  - `SQLITE_ALLOW_CREATE=false`
  - `SQLITE_ALLOW_JSON_IMPORT=false`
  - `SEED_DATA_ENABLED=false`
  - `LOCAL_DB_PATH=/home/qzmivzbj/app-data/vhomework/db.json`
  - `DIAGNOSTIC_SECRET=<host-only secret>`

Mandatory rules to prevent repeat incidents:

- Never add automatic physical deletes on production data during app startup, login, page load, or read endpoints.
- "Recent" UI requirements must be implemented with query/filter limits first. Physical cleanup must be a separate, explicit maintenance task with backup and confirmation.
- Never point production fallback storage at the deploy directory. Runtime data must live under a persistent data directory such as `/home/qzmivzbj/app-data/vhomework`.
- Do not depend on implicit local JSON. If local JSON is intentionally used for development or emergency recovery, set `STORAGE_MODE=local-json` and `LOCAL_DB_PATH` explicitly.
- Before changing storage schema, test migrations against an existing production-shaped database, not only a new empty database.
- When adding a SQLite column used by indexes or inserts, migration order must be: create base tables, `ALTER TABLE` old tables if missing columns, then create indexes, then write new data.
- Before deploys that touch storage, auth, migration, cleanup, or result/session persistence, take a backup of the active DB file.
- Do not rely on cPanel Git deploy as a database migration/backup mechanism. Git deploy should only move code/build artifacts.
- Do not commit or expose `.env`, `.env.production`, service account private keys, API secrets, or host-only diagnostic secrets. Rotate any key that may have been exposed.
- If production shows empty data after deploy, first check `/api/diagnostics/storage?secret=...` and verify the active storage mode/path before creating, deleting, or reseeding anything.

### Auth And Student Identity

- Firebase Auth remains the login layer for teachers/admins.
- Student free-learning flow uses guest identity:
  - localStorage key `msdieu_guest_id`
  - localStorage key `msdieu_student_name`
- `GameSession` has optional `guestId`.
- Grammar learning uses the same guest keys. New grammar students enter a name in `GrammarLearningArea`; students who already entered a vocabulary name can start grammar immediately.
- `GrammarLearningArea` and `StudentLearningArea` use `checking -> ready | needs_name` identity states. They only treat a guest as ready after `/api/guest-profiles/identify` confirms the stored `guestId`, or after `/api/guest-profiles/resolve` creates a new 2-20 character profile.
- Authenticated account names are kept separate from guest local storage. Existing authenticated names are accepted from the server profile even if they predate the 20-character rule.
- Guest grammar attempts store `userId/studentId` as the guest id plus `guestId`, `studentName`, and best-available `classId/className`.
- New guest grammar attempts also receive a server-issued `attemptToken`; the server stores only `attemptTokenHash`. Guest answer/submit/review requests for new attempts must send the matching token, which the frontend stores in localStorage by attempt id.
- For legacy grammar attempts created before attempt tokens existed, the server keeps guest-id compatibility so old completed work remains reviewable.
- Do not send `studentName` in HTTP headers. Browser `fetch` rejects Unicode header values, so grammar GET requests pass guest identity through encoded query params and POST requests pass it through JSON body.
- This prevents leaderboard grouping by `studentName` alone.
- Registration is intended for teachers/admins at `/reg`, not required for students to learn.

### Sharing / Assignment Visibility

Vocabulary set visibility now has three meanings:

- `public`: appears on student home/public lists.
- `assignment`: private by public listing, accessible through generated assignment/share link.
- `draft`: admin-only editing state.

Fields in use:

- `visibility?: 'public' | 'assignment' | 'draft'`
- `shareToken?`
- `assignmentSlug?`

Student public lists should only show `visibility === 'public'` or legacy public status after compatibility handling.

Grammar set visibility mirrors vocabulary visibility:

- `public`: appears in the student grammar directory.
- `assignment`: hidden from public grammar lists, accessible by generated private grammar link.
- `draft`: admin-only editing state.

Private grammar links use `shareToken` / `assignmentSlug` and route through `/grammar/private/<token>`. Tokens are stored/displayed without a `grammar-` prefix because the route already carries the grammar namespace. The backend route `/api/grammar-sets/share/:token` still accepts legacy stored tokens that include `grammar-`, and only resolves records whose normalized visibility is `assignment`.

Grammar leaderboard/activity behavior:

- Grammar attempts stay in `grammar_attempts`; do not delete them as part of recent-activity cleanup.
- Recent activity shows completed grammar attempts alongside vocabulary game sessions for the 7-day activity window.
- Recent activity detail modal must tolerate older/malformed `answerDetails` rows (null rows, missing `questionIndex`, or non-array `options`) so opening the full 7-day list does not crash the admin UI.
- Leaderboard scoring treats each completed grammar attempt as a normalized 0-100 activity score based on accuracy.
- Existing leaderboard de-duplication uses `student + class + vocabSetId + gameId`; because grammar uses `vocabSetId = grammar:<grammarSetId>` and `gameId = grammar-practice`, only the best attempt per student per grammar lesson counts toward the leaderboard period.

### Games

Current visible game categories:

- `flashcard`
- `quiz`
- `fill`
- `matching`
- `memory`
- `millionaire`

Current hidden/experimental category:

- `speaking`

New or changed game files:

- `src/components/games/MillionaireGame.tsx`
  - `gameId`: `millionaire-vocab`
  - category: `millionaire`
  - max 15 questions
  - uses `audioUrl`/alternate audio fields for learning audio when available
  - game-show SFX paths under `/sounds/millionaire/*.mp3`, safely ignored if missing
- `src/components/games/SpeakingAIGame.tsx`
  - `gameId`: `speaking-ai`
  - currently hidden in `GAMES_LIST`
  - Web Speech recognition for pronunciation practice
  - uses item audio if available, otherwise `speakEnglish`
  - saves pronunciation attempts through backend only; guest attempts require the active game session token and server timestamps are used.

Registry:

- `src/lib/game-engine/gameList.ts` has `hidden?: boolean` support.
- `StudentLearningArea.tsx` derives `VISIBLE_GAMES_LIST = GAMES_LIST.filter(game => !game.hidden)`.

### Leaderboard / Bảng Vàng

- `src/lib/leaderboard.ts` computes honor score from completed game sessions.
- Leaderboard source is now separated from recent activity:
  - `/api/results` and `/api/public/results` remain the 7-day recent activity feed.
  - `/api/leaderboard-results` and `/api/public/leaderboard-results` use compact `leaderboard_events` as the primary read model after the durable `leaderboard-read-model-v1` readiness marker is set. Before the explicit backfill, a read-only legacy session/attempt fallback preserves compatibility without writing or marking readiness from a request.
  - New completed vocabulary sessions and grammar attempts write a compact `leaderboard_events` row; this does not include `answerDetails` or heavy media data.
- Current concept:
  - best result per student/vocab set/game mode
  - completed lessons
  - average accuracy
  - study days
  - improvement bonus
- Improvement bonus is only awarded when a previous-period baseline exists; newcomers do not get improvement points from a zero baseline.
- Leaderboard identity prefers `userId`, then server `ownerKey`, then `guestId`, then `studentId`, then normalized name. Class snapshot remains part of the student leaderboard key.
- Student home, Admin dashboard inline expansion, and Admin results tab all use leaderboard-derived rows.
- Admin dashboard "Xem bảng vàng" expands `dashboard-leaderboard-expanded` inline under the overview cards instead of navigating away from Tổng quan.
- Dashboard leaderboard expansion reuses the same period/category/class/set filters as the full results tab.
- `StudentLearningArea.tsx` also uses the total leaderboard, not per-vocab-set ranking.
- The in-game leaderboard supports a class filter beside the week/month filter.
- Student names in the in-game leaderboard and admin leaderboard display a class suffix when class data exists, e.g. `Nguyen Van A - Lop 3`.
- `/api/public/results` and `/api/results` return `classId`/`className`; old sessions are backfilled at read time from `assignmentId` or lesson `gradeLevel`, and new sessions store class metadata when created.
- Assignment links use assignment-level random tokens (`assignments.shareToken` / `assignmentSlug`), never predictable assignment ids. Direct private-set links continue to use the set token and return `accessType: vocab_set`; assignment-token links return `accessType: assignment` plus `assignmentId`, `assignmentGameId`, `classId`, and `className`.
- `StudentLearningArea` sends the private token in `X-Vocab-Share-Token` when creating a session. Guest assignment sessions require a matching assignment token; direct-set sessions require a matching set token. A set token is never converted to an assignment merely because exactly one assignment currently references that set.
- Legacy assignments missing a token are assigned a new random token when assignment/share routes read them; clients should not construct `/assignment/<assignmentId>` links.
- `StudentLearningArea` sends the assignment class snapshot into `/api/game-sessions`; when no assignment class exists, it falls back to the vocab set `gradeLevel` as a grade-level class bucket. This makes class leaderboard filtering stable when a student later moves to another class or completes work assigned to multiple classes.
- Legacy sessions without `assignmentId` and without `classId`/`className` cannot be reliably class-filtered. Do not infer class only from `studentName`, because names can duplicate and students can move classes.
- `/api/public/results` enriches class data safely for old sessions: direct session class first, then assignment class, then unique assignment class by vocab set, then lesson `gradeLevel`, then unique class member by normalized student name. Ambiguous matches stay blank. The client Firestore fallback mirrors this rule where local data is available.
- Activity detail modals must treat `answerDetails` defensively: old/grammar rows may omit details or return a non-array shape, so the UI should show an empty detail state instead of throwing a blank page.

### UI Theme

The app has been moved from dark/glass to light mode.

Important file:

- `src/index.css`

Important CSS regions:

- global light theme override
- admin product UI
- game category pastel palette
- contrast/accessibility final pass
- student home polish

Current UI constraints:

- Keep white/light backgrounds.
- Use dark readable text: `#111827`, `#1F2937`, `#4B5563`, `#6B7280`.
- Avoid white text on pastel/light backgrounds.
- Disabled UI should remain visible around opacity `0.68 - 0.72`.
- Game categories use pastel identity colors via CSS variables.

## 20. Current Audio / Speech Map

### Current Implementation

The default pronunciation path is managed cached audio first, browser Web Speech fallback:

- `src/lib/game-engine/speech.ts`
  - exports `speakEnglish(text: string)`
  - exports `playAudioUrl(audioUrl, fallbackText?)`
  - exports `playVocabAudio(item, fallbackText?)`
  - keeps one managed `HTMLAudioElement` and stops previous audio/speech before starting a new pronunciation
  - uses `window.speechSynthesis`
  - chooses a US English browser voice if available
  - rate is `0.9`

Current callers:

- `FlashcardGame.tsx`
- `QuizGame.tsx`
- `FillBlankGame.tsx`
- `MatchingGame.tsx`
- `MemoryGame.tsx`
- `StudentLearningArea.tsx`
- `AdminDashboard.tsx` TTS row preview/playback
- `SpeakingAIGame.tsx` fallback

Current direct audio URL support:

- `VocabItem.audioUrl?: string`
- `MillionaireGame.tsx` can play `item.audioUrl` or alternate fields through the shared player:
  - `audio`
  - `sound`
  - `pronunciationAudio`
- `SpeakingAIGame.tsx` can play `audioUrl` when target text is the term through the shared player.
- AI vocab detail routes still return `audioUrl: ""`; real pronunciation audio is generated through the TTS endpoints in section 21.

### Problem With Current Web Speech Path

Browser speech is fast and free but inconsistent:

- Voice quality depends on device/browser/OS.
- Some browsers have poor or missing English voices.
- Pronunciation may differ between machines.
- It cannot be cached centrally.
- It cannot guarantee teacher-approved voice quality.

## 21. TTS Audio Architecture

Current implementation:

- Backend-only provider adapters support AI33 v3 Text To Speech and YupVox asynchronous TTS.
- Frontend never sends provider API keys and never calls AI33/YupVox directly.
- Audio files are cached under the persistent host path:

```text
/home/qzmivzbj/app-data/vhomework/audio/
```

- Express serves cached files through:

```text
/audio/{audioHash}.mp3
```

- `audioHash` is deterministic. AI33 includes provider-rendered speed; YupVox
  uses generation speed `1.0` because speed is applied during browser playback:

```text
provider + lang + voice + generationSpeed + normalizedText
```

- `normalizedText` preserves case and is produced from sanitized TTS text, not raw row text.
- TTS input cleanup uses the first non-empty line, removes trailing notes/IPA, removes text after a separator like `word - meaning`, collapses whitespace, and caps text at 120 chars. The returned metadata includes `ttsText` plus `audioWarnings` so teachers can see what was actually sent to TTS.
- Cached audio is reused when the hash/file already exists. A forced regenerate bypasses the existing cache file and returns a cache-busted `/audio/{hash}.mp3?v=...` URL.
- Backend TTS calls use an abort timeout (`TTS_FETCH_TIMEOUT_MS`), downloaded audio is capped (`TTS_MAX_AUDIO_BYTES`), and cache writes use a temp file followed by atomic rename.
- In-flight generation is deduped by `audioHash` so concurrent requests for the same raw provider audio do not create duplicate provider jobs in the same server process.
- `normalizeTtsSettings` accepts `ai33` and `yupvox`. Existing sets remain on AI33 unless a teacher explicitly changes the provider.
- YupVox uses `POST /v1/tts` followed by bounded polling of `GET /v1/tts/{jobId}`. The adapter reads only `data.jobId`, `data.status`, and `data.audioUrl`, validates the returned HTTPS URL, and reuses the existing local cache/download limits.
- The supplied YupVox contract does not define a speed field. The editor now
  accepts and persists `0.8`-`1.2` for YupVox, while the shared browser player
  applies that value with `HTMLAudioElement.playbackRate`. The adapter payload
  remains exactly `{ voiceId, text }`, `voice` defaults to `EBF147`, and raw
  YupVox files are shared across playback speeds instead of duplicating cache
  entries.
- `src/lib/game-engine/speech.ts` is the playback authority. `playVocabAudio`
  applies saved YupVox `ttsSpeed`; AI33 audio plays at `1.0` because AI33 already
  renders its requested speed. Admin preview, Flashcard, Quiz, Fill Blank,
  Matching, Memory, Millionaire and Speaking AI use the same rule. Matching and
  Memory resolve the original `VocabItem` from each card's stable `itemId`, so a
  term-card click retains `audioUrl`, `ttsProvider`, and `ttsSpeed`; direct
  `speakEnglish(card.text)` calls are forbidden because they bypass generated
  audio completely.
- Changing the English term in the editor clears stale audio metadata for that row so old files are not reused for new text.
- Vocab item metadata stores only lightweight public references:
  - `audioUrl`
  - `audioHash`
  - `audioStatus`
  - `audioError`
  - `audioWarnings`
  - `ttsText`
  - `ttsProvider`
  - `ttsVoice`
  - `ttsLang`
  - `ttsSpeed`
  - `audioGeneratedAt`
- Audio binary/base64 must never be stored in Firestore/SQLite JSON.
- Absolute local `audioPath` is private server state and must not be stored in vocab items or returned to the client.
- Teachers can generate TTS audio before saving a vocab set. The editor stores returned `audioUrl`/`audioHash` metadata on each row, then saves that metadata with the vocab set.
- Optional post-save generation still exists for missing audio when `ttsSettings.autoGenerate` is enabled, but the preferred workflow is generate/check audio first, then save the set.
- TTS failure marks the item as `audioStatus: "failed"` and preserves the vocab set.

Current backend endpoints:

- `GET /api/tts/voices`: backend proxy for AI33 Voice Library only. YupVox Voice IDs are entered in the shared editor field because no YupVox voice-list contract is currently defined in the project.
- `POST /api/tts/preview`: generates/plays a cached short preview.
- `POST /api/tts/batch-preview`: generates editor batch audio before save. Backend dedupes by `audioHash` and runs up to 5 concurrent TTS jobs by default (`TTS_CONCURRENCY`, clamped 1-10).
- `GET /api/vocab-sets/:id/audio/status`: returns per-item audio metadata.
- `POST /api/vocab-sets/:id/audio/generate-missing`: queues missing/retry audio generation. Queue processing groups duplicate hashes and runs up to 5 concurrent TTS jobs while keeping DB writes batched to status phases.

Required production env vars for TTS:

```text
AI33_API_KEY=<host-only key>
YUPVOX_API_KEY=<host-only key; required only when provider=yupvox>
YUPVOX_BASE_URL=https://api.yupvox.com
YUPVOX_TTS_POLL_ATTEMPTS=40
YUPVOX_TTS_POLL_INTERVAL_MS=1500
TTS_AUDIO_DIR=/home/qzmivzbj/app-data/vhomework/audio
AI33_TASK_STATUS_URL_TEMPLATE=https://api.ai33.pro/v1/task/{taskId}
TTS_CONCURRENCY=5
TTS_FETCH_TIMEOUT_MS=30000
TTS_MAX_AUDIO_BYTES=3145728
```

Keep Web Speech as the final fallback only when cached audio is missing or browser playback fails.

Regression gate: `npm run test:vocab-games` includes
`VocabBoardAudio.contract.test.ts`, which prevents the Matching and Memory board
games from reverting to direct Web Speech and verifies that they pass the
original vocabulary item into `playVocabAudio`.

### Earlier Recommended TTS Audio Architecture

Goal: replace browser-only pronunciation with generated TTS files while keeping Web Speech as the last fallback.

### Recommended Audio Priority On Client

Create a single audio helper, for example `src/lib/game-engine/audio.ts`:

1. If item has `audioUrl`, play that file.
2. Else call backend endpoint to generate/get cached TTS:
   - `POST /api/tts/vocab-item`
   - payload: `{ vocabSetId, itemId, text, kind: 'term' | 'example', voice?, lang? }`
3. Backend returns `{ audioUrl, cached: boolean }`.
4. Client plays returned `audioUrl`.
5. If backend/TTS/storage fails, fallback to `speakEnglish(text)`.

All games should call the helper instead of calling `speakEnglish` directly.

### Suggested File Storage

Use Firebase Storage for audio binary files.

Recommended paths:

```text
tts/
  vocab-sets/{vocabSetId}/items/{itemId}/term-en-US-{voice}-{hash}.mp3
  vocab-sets/{vocabSetId}/items/{itemId}/example-en-US-{voice}-{hash}.mp3
```

Alternative path for dedupe across sets:

```text
tts/cache/en-US/{voice}/{sha256(normalizedText)}.mp3
```

Recommended hybrid:

- Store canonical file by text hash for dedupe.
- Save the generated URL/reference back to the vocab item for fast lookup.

### Suggested Metadata Fields

Extend `VocabItem` carefully:

```ts
audioUrl?: string;
exampleAudioUrl?: string;
audioStoragePath?: string;
exampleAudioStoragePath?: string;
audioGeneratedAt?: string;
audioVoice?: string;
audioProvider?: 'openai' | 'google' | 'azure' | 'firebase' | 'other';
audioTextHash?: string;
```

For SQLite:

- Existing `vocab_items.audio_url` can continue storing `audioUrl`.
- Additional fields can stay in `data_json` first.
- Add normalized columns later only if querying/filtering by audio state is needed.

For Firestore:

- Add fields directly to each item object inside `vocab_sets.items`.
- Optionally maintain separate metadata collection:

```text
tts_assets/{hash}
```

Fields:

- `text`
- `normalizedText`
- `lang`
- `voice`
- `provider`
- `storagePath`
- `downloadUrl`
- `createdAt`
- `lastUsedAt`

### Backend API Shape

Recommended endpoints:

- `POST /api/tts/generate`
  - teacher/admin only for batch generation and editor actions.
- `POST /api/tts/resolve`
  - authenticated or public-safe depending on student access model.
  - returns cached/generated URL for one text.
- `POST /api/vocab-sets/:id/audio/generate-missing`
  - teacher/admin only.
  - generates all missing term/example audio in a set.

Response:

```json
{
  "audioUrl": "https://...",
  "storagePath": "tts/cache/en-US/voice/hash.mp3",
  "cached": true,
  "provider": "openai",
  "textHash": "..."
}
```

### Performance Strategy For Fast Student Playback

Best user experience:

1. Generate audio when teacher saves or edits a vocab set.
2. Store permanent/cacheable file in Firebase Storage.
3. Save `audioUrl`/`exampleAudioUrl` in vocab item metadata.
4. Student page preloads only nearby/current audio:
   - current word
   - next word
   - current example if visible
5. Browser plays static file directly from CDN/Storage URL.
6. Runtime generation should be fallback only, not default for every click.

This avoids slow first-play latency during games.

### Firebase Storage Fit

Firebase Storage is a good fit for this app if configured correctly:

- It stores binary MP3/WAV files separately from Firestore/SQLite data.
- It does not conflict with existing Firestore/Auth usage.
- It matches the existing Firebase project and service-account model.
- It gives CDN-like download URLs and browser caching.
- It avoids bloating Firestore documents with base64/audio data.

Important: do not store audio binary in Firestore documents.

### Required Firebase Changes

Current code imports:

- frontend `firebase/app`, `firebase/auth`, `firebase/firestore`
- backend `firebase-admin/app`, `firebase-admin/firestore`, `firebase-admin/auth`

To use Firebase Storage:

- Add backend Admin Storage import:

```ts
import { getStorage } from 'firebase-admin/storage';
```

- Initialize app with `storageBucket` if needed:

```ts
initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});
```

- Add env:

```text
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

The frontend already has `VITE_FIREBASE_STORAGE_BUCKET` in `src/lib/firebase.ts`, but TTS upload should be backend-only because provider API keys must stay server-side.

### Security Rules Recommendation

For easiest playback:

- Store generated audio under a path that can be publicly read, or use long-lived signed download URLs saved in data.
- Writes must be backend/admin only.

Recommended:

- backend uploads audio
- backend sets metadata/contentType
- app saves `downloadUrl`
- students only read URL; no client write permissions

### Provider Strategy

Recommended provider order if you already have OpenAI:

1. OpenAI TTS for high quality paid generation.
2. Optional cheaper/free provider as first layer if desired.
3. Web Speech API fallback only when TTS generation fails.

Keep provider hidden behind server abstraction:

```ts
generateTtsAudio({ text, voice, format }): Promise<Buffer>
```

This prevents game components from depending on a vendor.

### Migration Plan

Phase 1 - safe foundation:

- Add `src/lib/game-engine/audio.ts`.
- Replace game `speakEnglish(term)` calls with `playLearningAudio(item, 'term')`.
- Keep current behavior by falling back to `speakEnglish`.

Phase 2 - backend TTS cache:

- Add Firebase Storage initialization to backend.
- Add `/api/tts/resolve`.
- Add hash-based cache lookup.
- Add provider call only on cache miss.

Phase 3 - editor/batch generation:

- Add admin button: `Tạo audio còn thiếu`.
- On save, optionally enqueue/generate audio for missing terms.
- Save `audioUrl` and `exampleAudioUrl`.

Phase 4 - optimization:

- Preload current/next audio in `StudentLearningArea`.
- Add diagnostics for Storage and TTS provider quota.
- Add cleanup script for unused audio if needed.

### Risk Notes

- Firebase Storage itself will not conflict with current app.
- The biggest risks are billing/quota and making runtime generation too slow.
- Avoid generating audio on every student click.
- Avoid storing signed URLs that expire too soon unless the app can refresh them.
- Prefer deterministic hash paths to prevent duplicate audio files.

## 16. Game And Grammar Performance Hardening - 2026-07-24

Original bottlenecks:

- The previous production SQLite path used `sql.js`. Every standalone write exported the whole database, wrote a temporary file, called `fsync`, and renamed it over the active file.
- The old `SQLiteQuery.get()` always loaded a full table and filtered in JavaScript, so SQL indexes were not used.
- Grammar attempt creation/history scanned all `grammar_attempts`.
- Each incremental game action scanned all `game_session_actions`, wrote the action, then persisted the session separately.
- Game completion resent every action before submit even when each action had already been saved.

Implemented behavior:

- Release A uses `better-sqlite3` + WAL; native writes no longer export/replace the full database.
- Slow game/grammar APIs return a `Server-Timing` header and log `[PERF]` when total duration exceeds `SLOW_API_LOG_MS` (default 500 ms). SQLite metrics now come from request-scoped `AsyncLocalStorage` context and include query time/count, rows read/written, transaction time, and busy errors.
- `SQLiteQuery.get()` now pushes supported filters/order/limit into real SQL for normalized fields. Unsupported fields retain the compatibility in-memory fallback.
- Additive migration `grammar-attempt-query-columns-v1` adds/backfills `grammar_set_id`, `user_id`, `guest_id`, and `status` without changing `data_json`, then creates composite indexes for attempt limits/history.
- Grammar attempt limits, personal history, and admin result lists query only the relevant set/student rows.
- `SQLiteBatch.commit()` already wraps operations in `withTransaction()`; game action+session updates and completed result+leaderboard writes now use batches so sql.js persists once per logical operation.
- New action IDs use `sessionId + sequence`. Existing legacy action IDs are checked directly for rolling-deploy compatibility; no sequence full scan is used.
- Short games (up to `GAME_ACTION_BATCH_MAX_ITEMS`, default 50; Millionaire uses its effective 15-question limit) collect actions client-side and submit once. Speaking AI and longer games keep incremental durability.
- Incremental games retry only unsaved actions. The normal submit path no longer resends every action.
- Submit reads actions by `sessionId` using SQL/Firestore query filtering and deduplicates legacy/canonical actions by sequence.
- Share-token revalidation reads assignment/vocabulary documents directly when their IDs are known. Full token scans remain only for the initial token-only URL resolution.
- Existing guest `lastActiveAt` writes are throttled by `GUEST_ACTIVITY_TOUCH_INTERVAL_MS` (default 5 minutes), while class changes still persist immediately.
- Grammar history loading is delayed and aborted when the student starts an attempt; duplicate start requests are blocked. Game session creation is aborted when switching games, and duplicate completion submits are blocked while a submit is in flight.

Lazy-session v3 rollout (2026-07-27):

- Controlled by matching frontend/backend flags `VITE_LAZY_SESSION_V3` and `LAZY_SESSION_V3_ENABLED`. Setting both to `false` preserves the legacy eager-session paths for rollback.
- Short vocabulary games no longer create an empty session or write per answer. They submit compact actions once at completion; server timing covers identity/access/read/idempotency/persist phases.
- Grammar uses `prepare -> activate`: Begin validates and returns deterministic shuffled content without persistence; the first answer creates the attempt and answer in the same write. Opening then leaving before an answer creates no attempt.
- Deterministic server document IDs and leaderboard IDs provide natural idempotency. Tests in `learningRuns.test.ts` and `serverLearningRuns.test.ts` cover client credential uniqueness, local pending restore/removal, stable retry IDs, and bounded client start timestamps.
- `schemaVersion`, `clientRunId`, `activatedAt`, and `submissionStatus` are additive JSON fields. Existing schema-v1/v2 game sessions and legacy grammar attempts remain readable and are not rewritten.

Data-safety boundaries:

- No game session, grammar attempt, action, leaderboard event, vocabulary set, account, or class is deleted by these optimizations.
- Batch-mode actions are held client-side only while a short game is in progress; the completed result and leaderboard event are persisted atomically at submit.
- Long games retain incremental progress writes.
- Before deploying the additive grammar query migration, back up `/home/qzmivzbj/app-data/vhomework/app.sqlite` and test startup against a production-shaped copy.
- Native `better-sqlite3@10.1.0`/WAL passed cPanel preflight and Release A production cutover on 2026-07-31.

## 22. Release B Learning History - 2026-07-31

Release status:

- Steps 2.1-2.12 are complete. Release B was deployed API-first, backfilled and
  reconciled, API-enabled, then deployed UI-on.
- Production History API returned the expected protected response without a
  credential and returned owner-scoped data with a valid credential.
- The host storage diagnostic confirmed `storageMode=sqlite`,
  `sqliteDriver=better-sqlite3`, `quickCheck=ok`, `journalMode=wal`,
  `foreignKeys=1`, `synchronous=1` (`NORMAL`), busy timeout 10,000 ms, and WAL
  auto-checkpoint 1,000 pages.
- The first UI-on production artifact was confirmed as `index-gODK9tEe.js`.
- Application baseline `6548c8e` contains the follow-up History control contrast,
  hidden advanced filter panel, readable selected/correct grammar answers, and
  a new UI-on artifact `index-B0ssBTt7.js`. This follow-up is pending host
  confirmation as recorded in the version registry.

Data model:

- `learning_attempts` is the long-lived, queryable summary projection.
- `attempt_details` stores bounded review detail and review-policy snapshots.
- `learning_history_backfill_state` is reserved in the additive schema; the
  current CLI does not read/write it and resumes by scanning missing deterministic
  source identities.
- `pronunciation_attempts` stores new Speaking AI pronunciation events without
  audio binary/base64.
- Migration IDs are `learning-history-schema-v1` and
  `guest-capability-physical-v1`; migrations are additive/idempotent and do not
  run the legacy backfill at startup.
- Vocabulary source remains physical `game_results`; grammar source remains
  `grammar_attempts`. Initial compatibility APIs continue reading their existing
  sources.

Write and read flow:

- Vocabulary completion and grammar submit persist source, deterministic
  leaderboard event, summary, and detail in a short atomic transaction.
- Grammar activation creates an `in_progress` summary; answer/submit update the
  same immutable attempt. Speaking AI projects the parent session and stores
  pronunciation events separately.
- Attempt identity is deterministic from source type/record for backfill and
  projector compatibility. Retry cannot change immutable owner/run/source fields.
- `GET /api/my-learning-history` performs owner-scoped SQL filter/count/aggregate
  and stable pagination by `activity_at DESC, attempt_id DESC`.
- `GET /api/my-learning-history/:attemptId` verifies ownership before loading
  detail. Cross-owner lookup returns 404.
- An `in_progress` attempt older than 24 hours is exposed as `interrupted`
  read-only; no cleanup/update occurs during list reads.

Identity and security:

- Authenticated ownership comes only from the verified Firebase actor.
- Guest history requires both `X-Guest-Id` and `X-Guest-Access-Token`; SQLite
  stores only the token hash/version/time in physical columns.
- Legacy guest profiles without a capability require staff recovery through
  `POST /api/admin/guest-profiles/:guestId/history-capability`.
- Public result/leaderboard responses remove raw student/guest IDs and use an
  HMAC pseudonymous key. Production must set a stable host-only
  `GUEST_PUBLIC_ID_SECRET`.
- Detail responses apply the snapshotted review policy and recursively redact
  correct/accepted answers and explanations when review is not allowed.

Frontend:

- `src/App.tsx` always ships the `/history` route and
  `student-history-nav-btn`. Student History is no longer compiled out by
  `VITE_LEARNING_HISTORY_ENABLED`, so a normal deploy cannot silently remove the
  button.
- `npm run build` is the canonical release command. `npm run build:history-ui`
  remains only as a backwards-compatible wrapper and produces the same UI.
- `StudentHistoryAvailability.contract.test.ts` prevents reintroducing the
  build-time condition and verifies that the route, page and navigation hook are
  present. Backend availability remains a runtime concern controlled by
  `LEARNING_HISTORY_ENABLED` with `STORAGE_MODE=sqlite`.
- The page supports summary, responsive desktop/mobile layouts, abortable
  pagination, and an accessible detail modal. The API retains owner-scoped
  backend filters, but the advanced filter panel is intentionally hidden from
  the current student UI; this is presentation-only and does not mutate history.
- Grammar detail resolves stored selected/correct option IDs against the
  snapshotted option list, so existing backfilled attempts show lettered answer
  text while correct-answer visibility still follows the captured review policy.
- Examples: a stored `grammar-question-...-option-3` is displayed as `D. go`;
  an allowed `correctOptionId` pointing to option 2 is displayed as
  `C. goes`, not as an internal database identifier.
- New grammar projections also persist readable `selectedAnswer`, `userAnswer`,
  and `correctAnswer` text. Existing backfilled detail does not need a rewrite
  because the client resolves its immutable option IDs against `optionSnapshots`.
- Global legacy glass-button CSS previously made the History entry, back button,
  detail button, and modal close icon low-contrast. Feature-scoped selectors at
  the end of `src/index.css` now provide explicit accessible foreground,
  background, border, hover, and focus-visible states without changing unrelated
  screens.
- The advanced `HistoryFilters` API/backend capability remains implemented, but
  the student filter panel is intentionally not rendered. This is a UI-only
  decision and does not delete, update, or hide records at the database layer.
- Opening History never creates a new guest identity. Vocabulary/grammar resolve
  flows persist newly issued guest capability tokens.

Operations:

- Backend history flag: `LEARNING_HISTORY_ENABLED`; it gates both History API
  and projector writes and is only effective with `STORAGE_MODE=sqlite`. If it
  is disabled while learning continues, backfill must catch up missing
  projections before re-enable.
- Backfill is dry-run by default. Execute/resume require a distinct verified
  pre-backfill backup and fail reconciliation on duplicate/deterministic/ordinal
  mismatch.
- Retention is dry-run by default. Execute creates and verifies an online backup,
  deletes only expired `attempt_details`, updates matching summary status, and
  never deletes source/summary/leaderboard rows or runs `VACUUM`.
- Main gate: `npm run test:phase2`.
- `src/server/legacyContracts.integration.test.ts` starts the real Express server
  against a temporary native SQLite database and a minimal local Auth emulator.
  It locks representative shapes/order/auth/scope for the eight legacy endpoint
  groups in plan section 13.4.
- Real Firebase/Passenger, production-shaped data, browser interaction, flag
  rollback, super-admin, and exhaustive guest-token variants remain production
  smoke/manual gates.
- Contracts and runbooks:
  `docs/student-learning-history.md`,
  `docs/app-sqlite-data-structure.md`,
  `docs/activity-retention-maintenance.md`, and
  `docs/release-b-cpanel-deployment.md`.

Production rollout evidence:

- Release A preflight: Node `v22.16.0`, ABI `127`, Linux x64, glibc `2.28`,
  Python `3.11.13`, GCC/G++ `8.5.0`, `better-sqlite3@10.1.0`, and SQLite
  `3.46.0`; isolated insert/read/reopen/WAL/`quick_check` all passed.
- Release B pre-backfill verified backup:
  `/home/qzmivzbj/app-data/vhomework/release-b-backups/app-2026-07-30T18-46-32-929Z.sqlite`.
- Backfill inserted exactly 4,920 attempts: 4,192 vocabulary and 728 grammar.
  Post-run reconciliation reported `missing=0`, duplicate source groups `0`,
  deterministic ID mismatches `0`, attempt-number mismatches `0`, and source
  mutation `none`.
- Idempotency dry-run after execute reported `plannedInserts=0` and
  `plannedAttemptNumberUpdates=0`.
- Production diagnostics after backfill reported `learning_attempts=4920`,
  `game_results=9714`, `grammar_attempts=1747`, `leaderboard_events=2452`,
  `migrations=7`, `quickCheck=ok`, WAL active, and database size `126849024`
  bytes at that checkpoint.
- The active database remains
  `/home/qzmivzbj/app-data/vhomework/app.sqlite`; generated audio remains under
  `/home/qzmivzbj/app-data/vhomework/audio`. Neither path is inside the deploy
  directory.
- Deploying the latest commit that contains application baseline `6548c8e`
  requires the normal cPanel update/deploy and one Node restart because
  `dist/server.cjs` changed. It does **not** require a new migration or
  re-running the 4,920-row backfill.

## 23. Listening 5-Part Test Builder and Player - 2026-07-31

Scope and invariants:

- Listening is an independent learning resource, not a `VocabSet`. Each
  published test contains exactly five parts, five scored questions per part,
  and 25 scored questions total. The final score is normalized to 0-100.
- Parts 1 and 5 contain six draggable choices for five target regions, leaving
  exactly one distractor. Part 2 accepts normalized written answers; Part 3 maps
  five objects to lettered places; Part 4 is three-option multiple choice; Part
  5 combines drag/drop names or colours with picture regions.
- Every part owns one audio asset. The editor stores questions, answers, media
  references, and normalized picture-region coordinates as data; no exercise
  content or answer key is hard-coded in the rendering components.
- Published versions are immutable. Updating a published set edits its working
  copy; publishing creates a new numbered snapshot and retains earlier versions
  for attempts and review.

Frontend map:

- `src/features/listening/types.ts` is the shared content, answer, result,
  version, asset, access, and validation contract.
- `src/features/listening/api.ts` is the typed HTTP client for public learning
  flow and authenticated administration.
- `src/features/listening/admin/ListeningAdminModule.tsx` implements the
  `General -> Parts 1-5 -> Preview -> Publish` wizard, set library, validation
  summary, visibility control, archive flow, and result list.
- `ListeningAssetPicker.tsx` provides upload/library selection. Image-AI is
  capability-gated and remains explicitly disabled until a real provider is
  configured; audio never exposes that image-only action.
- `ListeningRegionEditor.tsx` edits normalized percentage-based target regions
  so coordinates remain stable across responsive image sizes.
- `src/features/listening/student/ListeningLearningArea.tsx` resolves public or
  assignment access, prepares a version-bound run, restores local progress,
  retries pending submissions, enforces an optional timer, and submits once.
  The completed screen offers owner-only answer review and a new-attempt action;
  retrying creates a fresh client run/ticket while preserving the completed row.
- `ListeningPartViews.tsx` contains the five responsive part renderers and uses
  native pointer/drag interactions with click/tap fallbacks.
- `src/App.tsx` keeps `/listening/:setId` as the legacy Mover entry, adds the
  registry-driven Listening Library routes, renders the four-module directory
  on the home page, and routes Listening assignments directly to their test.

Backend and security:

- `src/server/listening/listeningRouter.ts` owns `/api/listening`. Public routes
  list accessible published sets, prepare signed runs, and submit answers.
  Admin routes manage assets, working sets, publishing, archiving, usages, and
  results under the existing verified teacher/admin middleware.
- Prepare returns a signed, expiring, version-bound ticket and a sanitized
  student snapshot without answer keys. Submit verifies actor/access/version,
  grades only on the server, and uses deterministic run identity plus a secret
  hash to make retries idempotent.
- `GET /api/listening/sets/:id/attempts/:attemptId/review` returns display-ready
  answer rows only after completion, only to the owning user/guest, and only
  when the immutable detail policy has `showReviewAfterSubmit=true`. Cross-owner
  requests remain 404, and guest review additionally requires the matching run
  secret; playable, prepare, submit-summary, and public result
  responses do not carry the answer key.
- `listeningGrader.ts` performs Unicode NFKC, whitespace, case, and apostrophe
  normalization, validates the exact 25-question contract, and emits bounded
  0-100 scores. `listeningValidation.ts` enforces publish-time structure,
  required media, valid references, region bounds, and overlap limits.
- Raw upload endpoints validate MIME allowlists, size limits, and file magic.
  Files are named by SHA-256 and written atomically. SQLite stores metadata and
  URLs only; it never stores uploaded binary/base64 content.
- Production requires `LISTENING_TICKET_SECRET` or the existing stable
  `GUEST_PUBLIC_ID_SECRET`. `LISTENING_MEDIA_DIR` defaults to
  `/home/qzmivzbj/app-data/vhomework/listening-media` in production and is
  exposed read-only at `/listening-media`.

SQLite and history integration:

- Additive/idempotent migration `listening-five-part-schema-v1` creates
  `listening_sets`, `listening_set_versions`, `listening_assets`,
  `listening_asset_usages`, `listening_attempts`, and
  `listening_attempt_details`, with lookup and idempotency indexes.
- Existing `assignments` receives additive `resource_type`, `resource_id`, and
  `resource_title` columns. Legacy vocabulary assignments remain the default
  and retain their existing fields and behavior.
- Listening attempts stay in their dedicated tables. Learning History reads a
  union projection, filters `sourceType=listening`, and loads bounded review
  detail from `listening_attempt_details`; legacy history rows are not rewritten.
- The admin Recent Activity path follows the same split-storage contract:
  `/api/results?view=summary` reads bounded summaries from `listening_attempts`
  without joining detail. `GET /api/results/listening/:resultId` joins
  `listening_attempt_details` only after an authorized teacher or super admin
  explicitly opens one result. The default/full `/api/results` compatibility
  shape retains the prior staff-only join behavior for existing callers.
  When an older detail row contains raw answers/questions but not display-ready
  rows, the server reconstructs its 25 `answerDetails` from that attempt's
  immutable `listening_set_versions/{versionId}` snapshot. New submissions store
  the same display-ready rows at write time. Student and public result paths do
  not receive this joined answer key.
- `reviewPresentation.ts` is the shared presentation boundary for Listening
  review screens. Stable target/choice/blank UUIDs remain internal grading keys;
  Part 1/5 receive human ordinal labels and Part 2 `{{blank-*}}` tokens render as
  `_____`. Admin and Student History also suppress internal IDs defensively when
  an immutable legacy version cannot be reconstructed.
- `src/features/listening/review/ListeningVisualReview.tsx` is the shared visual
  result renderer for the post-submit screen and Learning History. New submits
  persist a versioned `visualReview` presentation snapshot inside bounded
  attempt `extraDetails`; legacy completed attempts rebuild it from their raw
  answers plus immutable published version at read time without rewriting old
  rows. The renderer reuses original images, marks correct work with a green
  check, marks wrong work with a red X, and places the correct answer directly
  below a wrong or unanswered response across Parts 1-5.
- Visual review snapshots contain only display-safe normalized geometry. Part 1
  includes exactly five scored targets and excludes the printed example. Part 3
  excludes the locked example overlay. Part 5 Draw stores only a derived safe
  display anchor for the correct icon and never stores or returns private
  `targetRegion`. Playable/prepare/submit-summary/public results never include
  `visualReview`; when captured review policy denies answers, History strips the
  whole snapshot recursively.
- The owner of a completed Listening attempt can review `correctAnswer` in
  Student History. New attempt details persist the standardized
  `showReviewAfterSubmit=true` policy; the read adapter applies the same policy
  to existing completed Listening attempts without rewriting stored rows.
  Cross-owner requests remain 404 and public result APIs remain summary-only.
- Public recent activity uses the existing pseudonymous identity boundary and
  never exposes raw user or guest identifiers.

Resilience and operations:

- Browser progress is keyed by owner, set, immutable version, and access token.
  It includes the run ID/secret, answers, current part, and deadline. Successful
  submit clears it; a failed submit remains retryable without creating a second
  attempt. Optional timeout triggers the same idempotent submit path.
- Back up the active SQLite file before first production startup. The migration
  is additive and performs no destructive cleanup or legacy-data rewrite.
- Keep `LISTENING_MEDIA_DIR` outside every deploy/release directory and include
  it in the host backup policy together with `app.sqlite`. Ensure the Passenger
  user has read/write permission before restart.
- Validation commands are `npm run lint`, `npm run test:listening`, and
  `npm run build`. The focused test suite covers text normalization, exact
  scoring, Part 2 all-blanks semantics, publish invariants, immutable version
  persistence, and the Learning History union.
- The current workstation runs Node 24/ABI 137 while the checked-in
  `better-sqlite3` binary targets the deployment baseline Node 22/ABI 127.
  Native SQLite suites therefore require the project Node 22 runtime; focused
  Listening storage tests use the existing `sqljs` test driver and pass without
  rebuilding the production native dependency.

## 24. Listening Library Module Shell - 2026-07-31

Architecture:

- `src/features/listening-library/registry.ts` is the browser/server-safe source
  of truth for module identity, display metadata, status, schema version, part
  manifest, and capabilities. Registry order is `starter`, `mover`, `flyer`,
  `ket`; only Mover is active. The other three modules expose no speculative
  part definitions, components, or scoring logic.
- Runtime registrations are deliberately split to preserve the client/server
  security boundary. `clientRegistry.ts` owns React component adapters, while
  `src/server/listening-library/registry.ts` owns server validation, sanitizing,
  routing, and grading adapters. Server graders and answer handling are never
  imported into the frontend bundle.
- `modules/mover/module.tsx` reuses `ListeningLearningArea`,
  `ListeningAdminModule`, and the existing typed API client. It is an adapter,
  not a rewritten Mover implementation. The backend Mover adapter likewise
  re-exports the existing router, validator, sanitizer, and grader.
- Generic exam contracts standardize only module/exam identity, labels,
  visibility/status, schema version, timestamps, creator, and an open generic
  Part payload. They do not impose Mover question types on later modules.

Student and admin routes:

- `/listening` is the four-module student directory.
- `/listening/modules/:moduleId` is a registry-dispatched module directory.
- `/listening/modules/:moduleId/exams/:examId` is the canonical exam route.
- `/listening/:setId?accessToken=...` remains valid and resolves to the Mover
  adapter without changing set/version/question IDs or share tokens.
- `ListeningLibraryHome`, `ListeningModulePage`, and `ListeningExamPage` own the
  student gateway. Starter, Flyer, and KET render a configuration-driven
  `coming_soon` state and cannot start an invented exercise.
- `ListeningLibraryAdmin` is the small Admin Dashboard gateway. Teachers choose
  a module first; Mover then opens the unchanged management workflow. The large
  dashboard contains no new editor, grader, or module-switching business logic.

Backend and compatibility:

- `/api/listening-library/modules` returns safe public manifest metadata;
  `/api/listening-library/modules/:moduleId` reports whether a server adapter is
  available. `/api/listening/*` remains the exact Mover API surface through
  `createMoverLegacyRouter`.
- Legacy records with no `moduleId` or new schema markers are interpreted as
  Mover at read time. New or newly saved Mover sets, published versions, Part
  payloads, signed run tickets, attempts, and history projections receive
  additive schema/module metadata. No identifier, answer, coordinate, asset
  reference, local browser run key, `clientRunId`, or grading version changes.
- No database migration or startup backfill is needed for this shell. Existing
  rows are not rewritten, reset, or deleted; an old draft receives additive
  metadata only when a teacher explicitly saves or publishes it.
- Mover keeps its existing create/edit/publish, published student preview,
  share-link copy, results, and recoverable archive actions. No clone action,
  physical delete, or unpublished full student preview was invented during this
  structural refactor because those actions were not present in the preserved
  Mover baseline.

Validation:

- `npm run lint` passes.
- `npm run test:listening` runs 10 focused contracts. They cover the registry,
  canonical and legacy routes, safe module API, exact Mover validation/scoring,
  immutable storage/history, legacy answer sanitizing, and idempotent replay.
- `npm run build` passes. The existing Vite warnings about Firebase import
  chunking and the large main bundle remain non-blocking. Generated `dist`
  artifacts were restored/removed after validation, so this source change does
  not directly modify `dist`.
- A temporary SQL.js development server smoke test returned HTTP 200 for the
  Listening Library page, Mover module page, and legacy `/api/listening/sets`;
  the registry API returned all four IDs with only Mover active and five Parts.
  The temporary server and database directory were removed afterward.

## 25. Listening Smart Editor - 2026-08-02

Architecture and ownership:

- `src/features/listening-editor/` owns the reusable editor contracts, shell,
  bounded draft history, revision-aware autosave, fixed-size region dragger,
  Resource Tray, staged Smart Import UI, browser crop helper, and crop preview.
- `src/features/listening/shared/FileDropPasteInput.tsx` is the shared media
  intake control. Image pickers accept file selection, drag/drop, focused
  `Ctrl+V`, and an explicit clipboard-read button; batch trays retain their
  existing file limits and upload paths.
- `src/features/listening-library/modules/mover/editor/` owns the Mover module
  definition plus independent handlers for Parts 1-5. A handler can only merge
  its own Part. `moverDraft.test.ts` guards sibling Parts byte-for-byte.
- `ListeningAdminModule.tsx` remains the Mover admin entry point. It coordinates
  assets, candidate state, autosave status, shell navigation, and the existing
  set/version/publish flow. Parts 1-5 import validated analysis directly into the
  matching editable working draft; the main Part form is the review surface.
- The whole-exam Resource Tray implementation remains in source as a rollback
  path, but `SHOW_WHOLE_EXAM_RESOURCE_TRAY=false` hides it from the General tab.
  Per-Part Smart Import is the only visible import workflow. Its compact source
  picker shows only attached images as removable chips; the X action detaches an
  image from the current analysis and never archives the shared media asset.
- `src/server/listening-smart-import/service.ts` owns role-aware prompt
  construction, local text parsing, untrusted provider JSON normalization,
  safe unresolved values, geometry hints, warnings, and Part-specific
  candidates. Technical IDs are created only by application merge code; no
  provisional/random correct-answer mapping remains.
- `server.ts` supplies Gemini multimodal analysis with OpenAI Responses image
  fallback. Only backend-held keys are used. `LISTENING_SMART_IMPORT_ENABLED`
  is the rollback switch.

API and safety:

- `GET /api/listening/capabilities` advertises upload and Smart Import state to
  staff clients without exposing keys.
- `POST /api/listening/admin/smart-import/analyze` requires staff auth and
  verifies module, Part, `basePartHash`, asset ownership, active image type,
  media path, per-image/aggregate size, quota, and timeout. It rejects audio;
  no audio/transcript enters provider prompts or payloads.
- The endpoint allows local pasted-text parsing only for Parts 2 and 3. Part 3
  deliberately removes source image 1 (the A-F board) before the provider call.
- Requests are limited to 20 per user per 10 minutes and 45 seconds. Timeout
  aborts the provider request where supported. Audit rows contain candidate and
  provider metadata, never the internal prompt or raw answer payload.
- `POST /api/listening/admin/sets/:id/draft/autosave` uses `baseRevision`; stale
  tabs receive `409 LISTENING_DRAFT_REVISION_CONFLICT` instead of overwriting a
  newer draft.
- Derived Part 2/4 uploads include server-validated `derivedFromAssetId` and
  normalized crop metadata. Public set summaries omit both draft content and
  internal draft revision.

Mover behavior:

- Parts 1/5 use normalized rounded rectangles. Part 1 stays `0.12 x 0.055`;
  the manual Part 5 editor uses `0.12 x 0.11` so its five numbered targets are
  twice as tall without becoming resizable.
  Each rectangle is itself directly draggable (or movable with arrow keys), so
  there is no separate active-region selector. The teacher can move but cannot
  resize. Code randomizes five unique provisional answers. Part 1 imports them
  into editable dropdowns for teacher correction; Part 5 also imports into its
  editable answer table without a separate candidate-confirmation click.
- Part 2 extracts a heading, optional example, five prompts, and bold answer
  variants split by `|` directly into the editable Part form. Its optional
  illustration crop uses a full-source-image mouse editor (draw, move and resize)
  before creating a traceable derived asset; numeric crop inputs are not exposed.
- Part 3 adds `displayMode: composite` plus one `boardAssetId`; old content with
  no display mode stays `split`. Source image 1 is always the untouched A-F board
  and is never sent to AI; source image 2 or pasted OCR text supplies the five
  labels. Analysis imports the board and detected labels directly into the Part 3
  form; missing labels preserve current editable values. Six option IDs, answer
  mappings and grader behavior are unchanged.
- Part 4 keeps the existing three-image option schema. AI reads prompt/order and
  provides initial crop hints. Browser pixel code detects neutral dark picture
  frames, orders them top-to-bottom/left-to-right, groups each A/B/C triple and
  snaps crops inside the frame edge. The local five-question fixture is detected
  as 15/15 frames, including one picture with a faint bottom edge. Each crop also
  has a full-image mouse editor fallback. After review, Canvas crops and uploads
  15 derived images; an answer is preselected only for an explicit source marker.
- Part 5 uses the exact 20-name English catalog in
  `editor/colourCatalog.ts`. The editor no longer exposes a free color picker,
  while saved custom legacy colors remain readable. Its manual form hides the
  unused target-name inputs and labels the five selectors `Đáp án màu 1` through
  `Đáp án màu 5`; stored labels remain compatible with existing content. The
  student player displays these target markers only as `1` through `5`, while
  preserving stored labels for backward-compatible grading and editor data.
  Parts 1/5 treat tray choices as single-use movable answers: an assigned choice
  disappears from the tray, replacing/removing it returns the previous choice,
  and six choices across five targets leave one distractor visible. Part 5 scales
  only the student target height to 50% around the same center; stored editor
  geometry and grading coordinates are unchanged. Assigned Part 1 names render
  in a dedicated high-contrast pill above the target overlay.

Validation ledger:

- `npm run lint` passes.
- `npm run test:listening` passes 42/42 contracts covering draft isolation,
  module compatibility, Parts 1-5, asset/security checks, autosave conflicts,
  grading, immutable storage/history, human-readable review presentation,
  owner-only correct-answer review, staff-only recent-activity detail, and
  idempotent legacy replay.
- Canonical `npm run build` passes and regenerates production client/server
  assets. The resulting `index-BgPPh9tA.js` contains
  `student-history-nav-btn` and contains no
  `VITE_LEARNING_HISTORY_ENABLED` build condition. Existing Vite Firebase
  import and bundle-size warnings remain.
- TTS verification passes: `npm run test:vocab-games` 8/8,
  `npm run test:tts` 5/5, and `npm run lint`. The History availability contract
  passes inside `test:history:unit`; the remaining seven native History API
  tests cannot start on this workstation because installed `better-sqlite3`
  targets ABI 127 while the active Node targets ABI 137.
- The current workstation cannot start `test:legacy-contracts` because its
  installed `better-sqlite3` binary targets Node ABI 127 while the active Node
  requires ABI 137. This is a pre-test native dependency mismatch; rebuild or
  reinstall it under the repository's Node 22 runtime before the release gate.
- Deployment and manual UAT steps are in
  `docs/listening-smart-editor-deploy.md`.

## 26. Listening Smart Editor five-Part role upgrade - 2026-08-08

This section supersedes the Smart Import behavior notes in section 25 where they
conflict. As updated on 2026-08-09, all five Parts direct-import validated output
into their matching editable working Part; none of these flows auto-publishes.

Source-role contract and flow:

- `src/features/listening-editor/smart-import/types.ts` defines explicit
  `question`, `answer_key`, and `position_key` sources. The visible UI uses the
  fixed labels `Ảnh đề bài`, `Ảnh đáp án`, and, for Parts 1/5,
  `Ảnh đáp án + vị trí`. Part 5 requires all three image roles; the other declared
  role slots are required unless the supported Part 2/3 text fallback replaces
  only the answer-key role.
- `SmartImportPanel.tsx` gives every role its own library selector and
  `FileDropPasteInput`. Replacing/removing a role only detaches it from the
  analysis and never archives/deletes its asset. A single asset cannot occupy
  multiple roles.
- `POST /api/listening/admin/smart-import/analyze` validates role uniqueness,
  required roles, unique owned active image assets, MIME/path/size/quota and
  `basePartHash`. Provider adapters in `server.ts` place an explicit role label
  immediately before each image. Audio and transcripts are never inputs.
- Provider output contains logical labels, numbers, regions, actions and
  warnings only. `service.ts` discards provider IDs; application merge code
  preserves matching IDs or creates editor IDs when an entity is new.
- Parts 1-5 merge validated results directly into the matching working Part. The panel
  rechecks `basePartHash` after analysis, and draft autosave still enforces
  `baseRevision`. Part 4 performs frame detection, crop and derived-asset upload
  before committing the result. No flow publishes automatically, and
  `moverDraft.test.ts` guards sibling Parts.

Part behavior:

- Part 1 reads all visible names from `question`, separates the example, and
  requires six remaining draggable choices (five scored plus one distractor).
  `answer_key` supplies label mappings; `position_key` supplies picture-side
  line endpoints. Geometry is transformed into the canonical question scene.
  No provisional/random answer mapping remains.
- Part 2 reads heading/instruction/example and five numbered prompts only from
  `question`, then maps numbered answers 1-5 from `answer_key`. Single answers
  remain one `acceptedAnswers` entry; explicitly supplied alternatives keep the
  existing variants array/`|` editing contract. Missing, duplicate or malformed
  answers preserve the existing question answer and emit warnings; partial
  numbering never collapses indexes.
- Part 3 adds the versioned `displayMode: connect-image` branch while preserving
  the legacy split/composite schema. It stores seven middle answers, six picture
  regions (`left|right` x rows 1-3), one unscored example connection, five
  private scored connections and one distractor answer. Anchors are derived from
  the correct region edge and only expose a clamped vertical offset. The default
  example overlay line is off because the book image may already contain it.
  The player makes every free unlocked picture eligible and never reads the
  correct mapping to highlight a destination. The picture side determines the
  final answer anchor: dragging or tapping a left picture automatically moves
  the connection origin to the answer's left edge, and a right picture moves it
  to the right edge, regardless of which half of the answer started the gesture.
  Board images at least 400 px wide keep their intrinsic width (subject to
  viewport downscaling). Smaller boards alone may upscale to
  `min(naturalWidth * 1.5, 480px)`, preventing the previous unconditional
  stretch to the full 5xl container.
- Part 4 retains the three-option question/player/grader contract. Smart Import
  uses `question` for text and crop detection and `answer_key` only for numbered
  A/B/C answers. The crop review supports six blocks when present: one example
  triple plus five scored triples, producing 18 derived images; older/no-example
  input still supports the existing 15 scored crops. Numbered mapping is strict;
  ordered fallback requires exactly five values plus explicit row/column
  evidence. The public example is rendered locked and is not scored.
- Part 5 adds the versioned `displayMode: scene-colour-draw` branch while keeping
  the legacy five-region colour branch readable/playable/gradable. The new
  v2 branch stores the full 20-colour teacher catalog, exactly six public
  palette colours (including a distractor), exactly three teacher-uploaded PNG
  icons (including a distractor), public colour masks, five staff questions,
  and a dynamic action list per question. Colour masks are normalized polygons;
  private Draw drop-zones are normalized rectangles derived by GPT-5.6 Sol
  from `position_key` into `question` coordinates. The main editor renders an
  AI-filled five-question/action answer table; each action opens one inline
  region editor. Colour uses a rough lasso whose background flood-fill joins
  enclosed compartments, ignores internal dividers, and offers inner/outer
  contours. Draw uses only a teacher-confirmed rectangle/square. Correct colour/icon
  choices and compact icon upload live in each answer row; a final distractor row
  edits the unused colour and PNG object. Re-analysis appends unmatched old
  actions for review instead of deleting them; AI geometry is accepted only for
  private Draw placement and never for Colour masks.
- Part 5 `colour_object` checks both object and colour. `place_object` checks the
  selected palette item plus backend containment of the submitted icon anchor
  in its private rectangular target. A multi-action question is correct only when every action is
  correct, so the exam still produces exactly five Part 5 results and 25 total.
  New attempts use grading version `listening-five-part-v2`; existing immutable
  content and legacy answer branches remain readable and gradeable.
- The Part 5 v2 student player no longer exposes question/action selectors. Six
  colour swatches and three PNG tokens share one fixed answer dock, while only
  the source image scrolls. Used answers leave the dock and return when their
  painted object/token is removed. Empty colour masks are transparent hitboxes;
  a submitted colour alone renders a clipped translucent fill, and Draw never
  renders the private target region. New submissions are keyed by the interacted
  public object/token; the backend grader also accepts the older action-keyed
  shape and resolves both against private published mappings.

Geometry, player and security:

- `src/features/listening/geometry.ts` owns normalized region validation,
  self-intersection rejection, point containment and scene-to-scene transforms.
  `ListeningRegionEditor.tsx` supports rect/ellipse/polygon creation, undo and
  direct dragging of existing polygon vertices.
- Part 5 answers are structured objects for colour/place actions. The answer
  sanitizer validates IDs and normalized anchors without stringifying objects
  to `[object Object]`; malformed submissions are dropped.
- Student sanitization removes Part 3 scored connections/distractor and removes
  Part 5 staff prompts, correct object/colour/token mappings, relation labels and
  all `targetRegion` values. Public render geometry and palette choices remain,
  but public geometry never identifies the requested correct object.
- Asset collection/resolution understands the two versioned branches and Part 5
  token assets. Staff activity formatting produces readable new-mode answers;
  published legacy content and immutable versions are not migrated on read.

Primary implementation files are the Smart Import types/panel/service/router,
Mover `directImport.ts` and Part 1-5 handlers, `ListeningPartViews.tsx`,
`listeningValidation.ts`, `listeningGrader.ts`, `listeningActivity.ts`, and the
versioned types in `src/features/listening/types.ts`.

Validation ledger for this change:

- `npm run lint`: passes.
- `npm run test:listening`: passes 52/52, including explicit role routing,
  numbered answer mapping, example separation, Part 3 side/row mapping, Part 4
  A/B/C/fallback behavior, variable Part 5 actions, structured sanitization,
  new/legacy grading, stale hash/revision and sibling-Part isolation.
- `npm run build`: passes. Vite still reports the existing Firebase mixed
  static/dynamic-import notices and large-chunk warning; generated `dist`
  output was produced only by the build and was not edited manually.
- `git diff --check`: passes.

## 27. Listening Smart Import provider/reliability pass - 2026-08-08

This pass addresses failures observed with real Gemini responses while keeping
the five-Part role and security contracts from section 26.

- `SmartImportPanel.tsx` now renders a capability-driven AI selector. Parts 2-5
  default to `Stali · GPT 5.6 Sol` whenever that Vision provider is configured,
  while Part 1 currently defaults to the validated local `Thông số bên ngoài`
  mode described in section 30. AI selections otherwise keep the safe
  available-provider fallback. The registry still
  exposes `Tự động · Gemini → ChatGPT`, Gemini, ChatGPT and configured Stali models;
  explicit selection is sent as `preferredProvider` and is never silently
  changed to another provider. `/api/listening/capabilities` returns provider
  IDs, labels, configured state and model names so another adapter/model can be
  added without hard-coding UI options.
- Every Part supplies a concrete JSON Schema to the vision adapter. Gemini uses
  `responseJsonSchema`; OpenAI Responses uses a JSON-schema text format. Invalid
  JSON is retried once. A second syntax/provider failure now fails closed with a
  safe 502/503 response; timeout/abort returns 504. No candidate is created, no
  direct import runs and the working draft remains unchanged. Parseable output
  with individual uncertain fields still uses the existing unresolved/warning
  behavior. Candidate/audit provider metadata is assigned only after valid JSON
  is received, so an explicitly requested provider is not recorded as a false
  success. The total request deadline defaults to 90 seconds and can be set with
  `LISTENING_SMART_IMPORT_TIMEOUT_MS` (default 180 seconds, clamped to 15-180 seconds).
  Diagnostics log request/Part/schema/provider/attempt, response length and a
  short SHA-256 fingerprint. Raw output is logged only when the non-production
  opt-in `LISTENING_SMART_IMPORT_DEBUG_RAW=true` is set.
- Part 1 parses answer mappings independently from endpoint geometry. A missing
  scene transform can no longer erase five valid numbered name mappings.
  `coordinateRole=question` uses the point directly; only `position_key`
  requires the two scene regions. Real-image reliability now uses three bounded
  provider stages: `question + answer_key` extracts names/example/numbered
  mappings; a question-only verification stage independently proves the printed
  example and tightly locates five primary-subject/action landmarks; the final
  stage receives all three role-labelled images and traces completed lines.
  The example is accepted only with a label point outside `questionScene` and
  the target end of the already-printed sample line inside it. Two physical line
  endpoints plus `positionScene -> questionScene` provide cross-validation; the unique
  endpoint inside the illustrated scene is the picture/person end, regardless
  of whether it is visually above or below the printed name. A contradictory
  trace never replaces the canonical question-image localization: when that localization has
  a description, a valid subject region/point and confidence >= 0.85 it is kept
  with an explicit teacher-review warning; otherwise the target remains
  unresolved. A failed geometry pass preserves
  the valid content pass and existing draft regions with diagnostic warnings.
  Region normalization treats `shape=rect`/`ellipse` as authoritative even when
  an OpenAI structured response also includes an empty `points: []`; previously
  that harmless field caused both scene rectangles to be rejected as empty
  polygons. An end-to-end smoke run with the reported three Part 1 assets and
  explicit ChatGPT selection now preserves all six choices, maps all five names
  and resolves 5/5 target endpoints into question-image coordinates. The
  independent example verifier also corrects a first-pass Daisy/Fred confusion;
  conflicting
  traced lines remain visible as review warnings rather than silently moving a
  node to the wrong subject. The Part 1 region editor now renders only the five
  scored target regions and never adds the printed example as a sixth region.
  Direct import also removes the verified example
  label from incoming choices, so Fred cannot remain in the six draggable cards.
- The Part 1 student view separates a non-scrolling, horizontally scrollable
  answer dock from the vertical scene scroller. Target hitboxes remain fully
  transparent at rest; selection/drag shows the same neutral outline on all
  eligible regions, and a placed answer renders only its high-contrast label
  pill. The legacy global glass-button selector explicitly excludes the
  transparent Part 1, Part 3 and Part 5 scene hitboxes; feature-scoped CSS also
  keeps their background, border and filters neutral. This source-level
  exclusion is required because the production CSS optimizer may collapse a
  later `backdrop-filter: none` reset while retaining the global blur. No target
  tint or UI state consults the private answer mapping.
- Part 2 always opens manual illustration cropping after analysis. AI crop is
  only an initial hint; without it the editor starts from the full question
  image.
- Part 3 accepts normalized regions plus common Gemini `box_2d`/0-1000 geometry,
  case-normalizes side values, and keeps current answer/picture/mapping slots
  with warnings when AI fields are unusable. Vision analysis uses two bounded
  passes: `question` alone must prove the unique printed example line with
  `answerLabel + pictureSide + pictureRow + confidence`; endpoints are neither
  requested nor validated because the runtime derives nodes from regions and
  edge offsets. `answer_key` alone reads
  the three-row/two-column grid and cannot select or replace the example. The
  backend trusts the printed-line example, reconciles a deterministic one-to-one
  key swap with a review warning, and preserves draft mappings for any unresolved
  conflict. Text fallback requires an explicit
  left/right row or three-row/two-column layout and never flattens six labels.
  Its primary editor is now a two-image analyze/direct-import flow: validated
  output enters the main form, which shows a human-readable example, five
  row-major mappings and the distractor. Technical labels, 13 regions and edge
  offsets remain available only under a collapsed advanced editor. Structural
  validation blocks direct import until the 7-answer/6-picture/example/
  5-mapping/distractor invariants are complete. The student overlay renders curved Bezier
  connections while preserving side-only eligibility and answer-key secrecy.
  The board image stays visually untouched: answer/picture regions are transparent
  hitboxes and no endpoint dots or example overlay are rendered. Pointer Events
  support tap-tap plus live drag preview; visible lines use a 3px stroke and an
  invisible wider hit path so students can remove and reconnect before submit.
- Part 4 no longer requests the 18 image crops from AI. AI reads prompts and the
  small numbered A/B/C key; browser pixel detection remains the source of crop
  geometry and automatically creates/merges derived images after validation.
- Part 5 analysis is one bounded GPT-5.6 Sol pass containing `question` +
  `answer_key` + `position_key`. The provider extracts logical Colour/Draw
  actions and private Draw `targetRegion` values in complete question-image
  coordinates, but never generates Colour masks. Teachers upload three PNG
  palette objects inline beside Draw answers and create Colour masks with edge
  snapping. One final row edits the colour/object distractors. Old unmatched
  actions remain protected, and valid output is merged without an apply click.

Regression ledger for this pass: `npm run lint` passes,
`npm run test:listening` passes 70/70, `npm run build` passes and
`git diff --check` passes. Existing Vite Firebase mixed-import and large-chunk
warnings remain.

## 28. Stali Smart Import model registry - 2026-08-08

- `src/server/listening-smart-import/staliProvider.ts` is the backend-only
  OpenAI-compatible Stali adapter. It calls `POST /v1/chat/completions` with a
  bearer key, role-labelled base64 `image_url` content and the Part-specific
  JSON Schema embedded in the text instruction. Provider output still passes
  through the existing JSON retry, normalization and validation boundary before
  any candidate or direct import can be produced.
- The capability registry exposes stable selection IDs for
  `deepseek-v4-pro`, `gpt-5.6-luna`, `gpt-5.6-sol` and `gpt-5.6-terra`.
  Luna, Sol and Terra are selectable when `STALI_API_KEY` is configured. DeepSeek V4 Pro remains
  visible but disabled because the current Stali documentation does not mark it
  as Vision-capable; Smart Import never offers a text-only model for image
  analysis.
- Explicit Stali selection never silently falls back to Gemini or OpenAI.
  Existing `auto` behavior remains Gemini then OpenAI, so adding Stali does not
  change prior billing/fallback behavior. Client-supplied provider/model names
  must match the server allowlist; the model name is never accepted directly
  from the analyze request.
- Backend configuration is `STALI_API_KEY` plus
  `STALI_BASE_URL=https://api.stali.vn/v1`. No Stali key is returned by
  capabilities, sent to the browser or logged. The adapter enforces HTTPS and
  rejects a serialized request larger than Stali's documented 8 MB limit.
- `ListeningSmartImportProviderDefinition` now carries optional
  `visionEnabled` and `reason` metadata. The existing capability-driven select
  uses these fields to explain a missing key or an unsupported Vision model;
  there is no hard-coded Stali option in the component.
- Focused regression coverage lives in
  `src/server/listening-smart-import/staliProvider.test.ts` and is included in
  `npm run test:listening`. It locks model availability, role-labelled images,
  schema transmission, endpoint/auth/model mapping, response extraction and
  refusal of the non-Vision DeepSeek model without making a network request.
- Part 1 has a narrowly scoped `stali:gpt-5.6-sol` geometry path. Content/name/
  answer mapping remains on the existing passes, while the independent example
  check no longer asks Sol to localize five scored action regions. The final
  geometry pass receives `question`, `answer_key`, and `position_key` in that
  fixed order and uses a short direct-point schema: verified target number/name,
  normalized `questionTargetPoint`, confidence, unresolved numbers and warnings.
  Sol coordinates are taken from this three-image pass instead of being
  overwritten by the earlier question-only localization. Other providers retain
  the existing line-endpoint/scene cross-validation path.
- Validation for this addition: `npm run lint` passes,
  `npm run test:listening` passes 75/75, `npm run build` passes and
  `git diff --check` passes. The existing Vite Firebase mixed-import and
  large-chunk warnings remain non-blocking.
- Validation for the Part 1 Sol direct-coordinate adjustment on 2026-08-09:
  `npm run lint` passes, `npm run test:listening` passes 76/76, and
  `npm run build` passes with only the existing Firebase mixed-import and
  large-chunk warnings.

## 29. Shared Grammar/Listening library row controls - 2026-08-10

- `src/components/admin/LibraryRowControls.tsx` is the shared presentation
  contract for resource-library row actions and link state. Grammar and every
  active/future Listening admin adapter must render the fixed action order:
  `Play`, `Sửa`, `Sao chép`, `Kết quả`, `Xóa`.
- The shared link cell has three explicit states. `assignment` renders a
  copyable `Link riêng` button only when a token-backed URL exists; `public`
  renders the non-copyable label `Công khai`; `draft` renders
  `Chưa xuất bản` and exposes no student URL.
- Mover Listening adds `POST /api/listening/admin/sets/:id/clone`. It creates a
  new owner-scoped draft from the source working content, or from the immutable
  published snapshot for a legacy set without `draftContent`. Internal content
  and asset reference IDs are preserved so references remain coherent, while
  the new set receives a fresh set ID and no published version, share token,
  assignment slug, attempt, history or result row.
- Listening's visible `Xóa` action continues to call the recoverable archive
  endpoint. It changes only the set status to `archived`; immutable versions,
  attempts, details and asset files are not deleted.
- UI/static regression coverage lives in
  `src/features/listening-library/admin/ListeningLibraryAdmin.contract.test.ts`;
  clone, module isolation and recoverable archive behavior are covered by
  `src/server/listening/listeningRouterCompatibility.test.ts`.
- Validation for this pass: `npm run lint` passes,
  `npm run test:listening` passes 91/91, and `npm run build` passes. The build
  generated `index-GNOHXLht.js` and retains the existing Firebase mixed-import
  and large-chunk warnings.

## 30. Part 1 external-parameters direct import - 2026-08-14

- Part 1 Smart Import temporarily defaults to `Thông số bên ngoài`, displayed
  before the AI providers. This mode shows only the existing `question` image
  role, uses the current asset picker/FileDropPasteInput path, and never calls
  Gemini, OpenAI or Stali. Switching back to an AI provider restores the three
  existing Part 1 image roles without deleting or archiving selected assets.
- The accepted contract is strict JSON `mover-part1-external-v1`: explicit
  `coordinateSpace`, optional/required `imageSize` as appropriate, exactly seven
  unique people with points, one sample, five unique numbered answers and one
  explicit distractor. Markdown-fenced JSON is accepted; free-form prose and
  unknown/technical ID fields are rejected.
- Pixel coordinates are divided by the declared real image width and height.
  They are never implicitly treated as a 0-1000 scale. When asset dimensions
  are available they must match `imageSize`; normalized coordinates must remain
  in 0..1. The parser creates the existing 0.12 x 0.055 normalized Part 1 target
  regions around each point.
- Valid external data is converted to the existing Part 1
  `choices + anchors + targetChoiceLabels + example` contract and passed through
  `importPart1Analysis`. The selected question asset becomes the scene image;
  existing choice/target IDs are preserved and application code creates missing
  IDs. Sample is excluded from the six draggable choices, the distractor is
  forced to the sixth slot, and only the five numbered answers become scored
  targets. The merge checks `basePartHash`, changes only the working Part 1
  draft and never publishes.
- Parser and merge regression coverage lives in
  `src/features/listening-editor/smart-import/part1ExternalImport.test.ts`; UI
  wiring is locked by `SmartImportPanel.contract.test.ts`.

## 31. Parts 2-5 external-parameters direct import - 2026-08-14

- `Thông số bên ngoài` is now the first and temporary default Smart Import
  source for every Mover Part. In this mode `SmartImportPanel` shows only the
  existing `question` image role plus strict versioned JSON, creates a local
  candidate with provider `external-parameters`, and never calls the Smart
  Import API. Selecting an AI provider restores the normal Part-specific image
  roles; detaching a role never deletes or archives its asset.
- `externalParametersImport.ts` dispatches strict contracts
  `mover-part2-external-v1` through `mover-part5-external-v1`. It strips an
  optional Markdown JSON fence, rejects unknown/technical ID fields, normalizes
  text and coordinates, validates numbered mappings, and emits bounded root
  cause errors plus non-destructive warnings. The panel rechecks `basePartHash`
  before passing the local candidate into the existing direct-import callback.
- Part 2 external data contains heading/instruction/example plus exactly five
  numbered prompts and accepted-answer variants. It never supplies an internal
  blank ID or illustration crop. `importPart2Analysis` preserves IDs and the
  existing Part 2 handler still opens `VisualCropEditor` on the selected
  question image.
- Part 3 external data contains seven unique answer labels/regions, all six
  left/right row slots, the printed example, five scored mappings and the one
  set-difference distractor. Fresh drafts require valid pixel/normalized
  regions. Re-import may omit a region only when a unique matching answer or
  picture slot already exists in the current connect-image draft; that geometry
  is then preserved with a warning. Edge anchor offsets are never requested
  from the external source and default to/preserve the application value.
- Part 4 external data contains only the optional example and five numbered
  prompt + A/B/C answers. Crop arrays start empty and the existing black-frame
  detector remains authoritative for 15/18 derived crops. If frame detection
  cannot produce valid groups, external import merges only the logical content
  and answer mapping while preserving every existing option image for manual
  correction; it never uploads guessed default crops.
- Part 5 external data contains the Draw palette descriptions and five numbered
  questions with variable `colour_object`/`place_object` actions. Colours must
  resolve to the existing 20-colour catalog. External Colour geometry is not
  accepted; the teacher still paints edge-snapped masks. Draw `targetRegion` is
  optional normalized data, while missing regions keep old geometry or remain
  unconfirmed for the existing rectangle editor. Icon PNG upload and teacher
  confirmation remain in the current Part 5 editor, and unmatched old actions
  remain reviewable instead of being deleted.
- Regression coverage is in
  `src/features/listening-editor/smart-import/externalParametersImport.test.ts`
  plus `SmartImportPanel.contract.test.ts`, alongside the existing per-Part
  direct-import, crop, legacy, grader and student-sanitizer tests.
- `externalParametersModelInstructions(part)` composes a model-facing prompt
  from the same per-Part help, strict rules and versioned JSON template used by
  the external parser. `SmartImportPanel` exposes it through a visible copy
  button for every Part, with Clipboard API, legacy copy fallback, manual-copy
  fallback and transient success feedback. Copying never edits the JSON input,
  candidate, selected assets or working draft.

## 32. DevQuota and restricted Smart Import provider registry - 2026-08-14

- The Smart Import source selector is intentionally restricted to exactly three
  entries, in order: `Thông số bên ngoài`, `Stali · ChatGPT 5.6 Sol`, and
  `DevQuota · ChatGPT 5.6 Sol`. The older `auto`, Gemini, direct OpenAI,
  DeepSeek, Luna, and Terra choices are no longer advertised or accepted by the
  Listening Smart Import route. Explicit provider selection never falls back to
  another provider.
- `src/server/listening-smart-import/devQuotaProvider.ts` is the backend-only
  DevQuota adapter. It uses the documented Responses-compatible base URL
  `https://sv.devquote.shop/v1`, calls `POST /responses`, sends role-labelled
  `input_text`/`input_image` content, and requests the same Part-specific JSON
  Schema used by the existing validation pipeline. Only model
  `gpt-5.6-sol` is allowlisted.
- DevQuota configuration is `DEVQUOTA_API_KEY` plus optional
  `DEVQUOTA_BASE_URL`; Stali remains `STALI_API_KEY` plus `STALI_BASE_URL`.
  Both keys stay on the server and capability responses contain only provider
  IDs, labels, enabled state, reason, and model metadata. Both adapters require
  HTTPS and preserve the shared timeout, abort, quota, image-role, JSON retry,
  normalize/validate, stale-hash, and direct-import boundaries.
- Part 1 treats either allowlisted GPT 5.6 Sol provider as the same direct-point
  geometry class, so switching from Stali to DevQuota does not fall back to the
  older endpoint/scene-transform prompt contract. Parts 2-5 retain their
  existing provider-independent parse and merge flows.
- Focused coverage is in `devQuotaProvider.test.ts`, `staliProvider.test.ts`,
  `listeningSmartImportRouter.test.ts`, and `SmartImportPanel.contract.test.ts`.

## 33. Listening visual-review navigation and Part 3/5 corrections - 2026-08-14

- `ListeningVisualReview.tsx` remains the shared renderer for the immediate
  post-submit screen and Learning History. Its Part tabs and new previous/next
  side-arrow buttons use feature-scoped contrast hooks in `index.css`, after
  the legacy global button overrides, so active and inactive labels cannot fade
  into the background. The arrows change the same `activePart` state as the
  tabs and are disabled at Part 1/Part 5 boundaries.
- Connect-image Part 3 review no longer overlays status icons or answer labels
  on a small source image. A correct student connection remains blue; an
  incorrect connection is red and the corresponding correct connection is a
  green dashed curve. An unanswered connection renders only the green dashed
  correct curve. Each left/right corridor is split into three deterministic
  routing lanes; the wrong and correct paths for one question prefer different
  lanes, while reused lanes receive alternating micro-offsets. The printed
  example remains untouched.
- Part 5 now resolves structured submissions through one backend helper shared
  by grading and review projection. It accepts direct `actionId` submissions
  and the player’s natural `objectId`/`paletteItemId` keys. For Draw, an item
  placed inside the action target is associated with that action even when the
  palette item is wrong; it is therefore `incorrect`, never `unanswered`.
  Question-level review text is built from the resolved colour/object choices,
  while the client can also summarize action data for compatibility. Draw
  coordinates remain in the structured submission for grading but are removed
  from display strings; Part 5 cards do not repeat `correctAnswer` because the
  staff prompt already states the required colour/object.
- The review tabs and arrows are excluded from the high-specificity legacy
  glass-button selector itself, in addition to their feature-scoped rules.
  Inactive tabs now use a solid pale-blue surface and dark-blue label; active
  tabs use a raised dark-blue surface, white label and explicit selected ring.
  Enabled arrows use larger solid-blue controls in reserved left/right gutters
  outside the Part content, so they never cover an image or answer card.
  Disabled boundary arrows remain opaque and visible rather than disappearing.
- The presentation snapshot is now `schemaVersion: 2`. Stored v1 snapshots are
  rejected by the normalizer and rebuilt from the immutable published version,
  stored answers and grade rows. No attempt, score, published content or image
  asset is rewritten during this compatibility rebuild.
- `scripts/start-local-test.mjs` supplies harmless Firebase client placeholders
  only when the developer shell has no Firebase environment. Firebase modules
  can therefore initialize before the loopback-only auth bypass takes over,
  instead of leaving `#root` blank with `auth/invalid-api-key`. Real configured
  values still win, and production startup is unchanged.
- Validation for this pass: `npm run lint` passes, `npm run test:listening`
  passes 120/120, the focused Learning History normalizer suite passes 7/7,
  `npm run test:local-auth` passes 3/3, and `npm run build` passes. The existing
  Firebase mixed-import and large-chunk build warnings remain non-blocking.

## 34. Frontend initial-load bundle split - 2026-08-20

- This pass changes loading boundaries only. It does not change API routes,
  authentication decisions, role checks, database schema, storage paths,
  lesson/result payloads, or any create/update/delete behavior.
- `src/App.tsx` lazy-loads the Admin dashboard, vocabulary game shell, grammar
  learning screen, Listening library/module/exam screens, and Student History.
  Their existing routes, props, callbacks, state ownership, and business logic
  remain unchanged. `src/main.tsx` provides the shared top-level `Suspense`
  loading fallback.
- `src/components/games/StudentLearningArea.tsx` lazy-loads each individual
  vocabulary game behind a game-stage `Suspense` boundary. Selecting,
  restarting, completing, scoring, and persisting a game continue through the
  existing component props and session handlers.
- `src/components/admin/AdminDashboard.tsx` lazy-loads
  `ListeningLibraryAdmin` only when the Listening tab renders. No Admin data
  loader or mutation handler changed.
- `src/lib/firebase.ts` now initializes only the Firebase client app and Auth.
  `src/lib/firebaseDb.ts` owns Firestore initialization and is dynamically
  imported only by the existing direct-client fallback paths. Auth startup and
  fallback query semantics are unchanged, while Firestore no longer belongs to
  the initial browser bundle.
- Production static serving gives hashed `/assets/*` files a one-year
  `immutable` cache. `index.html` continues to use `max-age=0`, so every deploy
  can advertise new asset hashes without retaining an old application entry.
- The canonical production build replaces the previous single
  `index-CGvX1SCS.js` bundle (1,825.79 kB, 476.06 kB gzip) with entry
  `index-DUjS3JkO.js` (455.65 kB, 118.01 kB gzip) plus on-demand screen,
  Firestore, Listening, and game chunks. This reduces the initial JavaScript
  entry by about 75%; it does not claim that the sum of every optional chunk is
  75% smaller.
- Validation for this pass: `npm run lint` passes; vocabulary game tests pass
  8/8; Listening tests pass 120/120; identity, grammar, TTS, and learning-run
  suites pass; `npm run build` passes; production HTTP smoke returns 200 for
  `/`, `/listening`, the entry chunk, Admin chunk, and game chunk; asset cache
  headers are `public, max-age=31536000, immutable`; and `git diff --check`
  passes. The full Phase 1 gate reaches storage but cannot finish in the active
  Node 24 shell because the installed `better-sqlite3` binary targets ABI 127
  while the shell requires ABI 137. No native rebuild or database change was
  performed because storage is outside this pass.

## 35. Movers Listening PDF draft importer - 2026-08-20

- The Listening admin library now exposes `Nhập từ PDF`. A single drop/select
  accepts exactly one scanned Movers book PDF and one answer-key PDF, maps the
  complete Tests and their Parts, shows the detected 1-based PDF page map, and
  creates only the selected working drafts. It never publishes, never derives
  answers from audio, and reminds the teacher to review Parts and attach audio.
- `src/features/listening-pdf-import/pdfProcessing.ts` uses `pdfjs-dist` in the
  browser. It renders compact page-header contact sheets for manifest mapping,
  renders only the mapped Part/key pages for extraction, and never uploads the
  original PDFs or full PDF-page collection. The dialog and PDF engine are
  separate dynamic chunks: the release build emits a 19.17 kB dialog chunk,
  a 479.34 kB PDF engine chunk and a 1,262.40 kB worker that are not loaded by
  the initial page entry.
- `POST /api/listening/admin/pdf-import/sources` accepts only authenticated
  staff JPEG/PNG/WebP images up to the existing 10 MB image limit. Sources live
  outside the asset database under the dedicated temporary media directory,
  use owner-bound HMAC tokens, expire after ten minutes, and are deleted before
  an analysis response is returned (with an exact-path expiry timer as an
  abandoned-upload fallback). File magic, token signature, owner, expiry,
  resolved path and aggregate request size are validated server-side.
- `POST /api/listening/admin/pdf-import/manifest` sends only labelled contact
  sheets through the explicitly selected Stali or DevQuota Vision provider.
  Provider JSON is parsed, normalized and runtime-validated against the strict
  Mover manifest contract; Part 4 must have two consecutive book pages, all
  test pages must be ordered/non-overlapping, and answer-summary pages must be
  ordered and in range. One corrected provider attempt is allowed for malformed
  output; an invalid manifest creates no draft.
- Existing `/api/listening/admin/smart-import/analyze` remains backward
  compatible with persisted `assetId` sources and additionally accepts a
  mutually exclusive `transientToken` for this workflow. It resolves temporary
  images under the same auth, MIME, size, provider, timeout, strict-schema and
  `basePartHash` checks, returns the existing candidate contract, then removes
  the temporary files. Provider selection is explicit and never falls back.
- Each selected Test gets one normal Listening working draft. Parts run in
  order within a Test and at most two Tests run concurrently. Every successful
  Part is merged with the existing direct-import helpers and saved with the
  current `baseRevision`; a failed Part does not block later Parts and can be
  retried from the same browser session without rerunning completed Parts.
- Persistent storage is limited to assets the draft actually needs: the Part 1,
  Part 3 and Part 5 scenes, an optional cropped Part 2 illustration, and the
  detected 15/18 Part 4 option crops. Part 4's pixel detector remains
  authoritative; if it cannot find enough frames, logical content is imported
  while existing option images are preserved for manual correction. Part 5 is
  always marked `Cần xem lại` because masks, interaction confirmation and icon
  assets remain teacher-authored.
- Regression coverage includes the verified three-Test page fixture, malformed
  manifest retry/range/order rejection, owner-bound signed temporary sources,
  route-level transient Smart Import, manifest analysis and proof that the
  temporary directory is empty before each response. The canonical build and
  typecheck pass; the complete Listening suite remains the release gate.
- Local PDF document disposal uses the pdfjs v6 loading-task lifecycle rather
  than the removed document-level `destroy()` method, so selecting the same two
  files again after a failed manifest does not fail before rendering. Manifest
  and Part errors surface the first sanitized provider detail (for example a
  transport failure) without exposing API keys, prompts or answer payloads.

## 36. Mover post-submit listening transcript - 2026-08-21

- Every Mover Part may carry an optional `audioTranscript` plain-text field of
  at most 20,000 characters. The shared Part editor accepts direct paste or a
  local `.txt` file; the browser reads the file into the same editable field,
  so no separate text asset or binary upload is persisted.
- Transcript text is stored once with the working draft and immutable published
  version. It is not copied into `listening_attempts` or
  `listening_attempt_details`, does not affect grading, and needs no database
  migration. Direct Part 3/5 import preserves an existing transcript.
- `sanitizeListeningContentForStudent()` removes every Part transcript from
  playable and prepare payloads. Submit summaries, public result lists and
  stored attempt presentation snapshots remain transcript-free.
- The owner-only post-submit review endpoint resolves the attempt's exact
  immutable `versionId` after the existing completion, review-policy and guest
  run-secret checks, then returns only non-empty Part transcripts. Learning
  History derives the same bounded presentation data at read time and removes
  it whenever the captured review policy denies answer review.
- `ListeningVisualReview` remains the shared post-submit/History renderer. For
  the selected Part it exposes a native collapsed `Nội dung bài nghe` section,
  preserves speaker line breaks with plain escaped text, and renders nothing
  for legacy versions without a transcript.
- Regression coverage verifies student-payload redaction, authorized review,
  no per-attempt transcript copy, History projection/policy stripping, editor
  `.txt` support, direct-import preservation and legacy optionality.
- Validation: `npm run lint` and `npm run build` pass; the complete Listening
  suite passes 127/127. The History unit command passes its 20 portable tests;
  its seven native API cases remain blocked on this Node 24 shell because the
  checked-in `better-sqlite3` binary targets the documented Node 22 ABI.

## 37. Mover Reading & Writing paper and Smart Import - 2026-08-22

Scope and compatibility:

- Mover now exposes two explicit paper manifests under the same module:
  `Listening` remains the unchanged five-Part/25-question implementation, and
  `Reading & Writing` is a separate six-Part/40-question domain. Starter,
  Flyer and KET remain coming-soon. Legacy `/listening/:setId` and every
  `/api/listening/*` contract remain Listening-only and backward compatible.
- Canonical Reading & Writing routes are
  `/listening/modules/mover/papers/reading-writing` and
  `/listening/modules/mover/papers/reading-writing/exams/:setId`. Assignment
  links use the same exam route with `accessToken`; the registry and route
  parser own these paths rather than adding ad-hoc App state.
- The scored contract is fixed at Parts `[6, 6, 6, 7, 10, 5]`: Part 1 text
  matching, Part 2 Yes/No, Part 3 one-of-three A/B/C, Part 4 six word gaps plus
  one title choice, Part 5 three picture/story groups with ten answers of one
  to three words, and Part 6 five one-word passage gaps supported by a visible
  word-bank image. Examples are
  display-only and never enter the 40-question score.

Ownership and code boundaries:

- `src/features/mover-reading-writing/` owns the versioned types, safe default
  draft, client API, six admin Part editors, paper library and responsive
  student player. The player uses the requested picture-left/writer-right
  layout on desktop and stacks safely on narrow screens. It persists an
  in-progress run locally by owner/set/version/token and submits idempotently.
- `src/server/mover-reading-writing/` owns strict publish validation, student
  payload sanitizing, server-only grading and the isolated Express router.
  Unicode NFKC, whitespace, case and apostrophe variants are normalized for
  text answers; Part 5 enforces the one-to-three-word limit at grading time.
  Student playable/prepare responses contain no accepted answers, correct
  Yes/No values or correct option IDs.
- The editor reuses the existing Listening asset library/picker, generic draft
  undo/redo state, editor shell, canonical library link status and row action
  order. Draft autosave uses `baseRevision`, a per-set server lock and HTTP 409
  conflict handling, so another browser tab cannot silently overwrite a newer
  draft. Publish creates a new immutable version; archive remains recoverable.
- Every Part editor now owns one `Smart Import · Reading & Writing · Part N`
  panel. The source selector is deliberately limited to `Thông số bên ngoài`,
  `Stali · ChatGPT 5.6 Sol`, and `DevQuota · ChatGPT 5.6 Sol`; a selected API
  provider is called explicitly and never falls back silently. External mode
  parses the versioned Part-specific external JSON contract locally (`v2` for
  the inline-template Parts 1, 5 and 6; the existing version for other Parts) and
  does not call an AI API. Its copy action derives its instructions and sample
  JSON from the same runtime contract used by validation.
- API mode labels every image with a Part-specific role. Parts 1-4 reuse the
  persistent student-facing asset already selected in the main Part editor;
  OCR-only question/story/answer pages and all Part 5/6 source pages use
  owner-bound transient tokens. The backend accepts only JPEG/PNG/WebP magic,
  limits each file to 10 MB, all sources to 30 MB and four images, enforces a
  180-second timeout plus a 20/10-minute staff quota, and removes every
  resolved transient source before completing the response. Provider keys and
  raw source images are never returned to the browser or stored in the paper.
- `answer_key` is the sole authority for accepted/correct answers. The prompt
  forbids solving or inferring an unreadable answer; provider output receives
  a structured-response schema and still passes the same strict runtime
  parser as external JSON. One bounded correction attempt is allowed. Unknown
  values generate review warnings and preserve the current field instead of
  fabricating a complete answer key. Transport, authentication, quota and
  provider-availability failures are surfaced immediately with bounded,
  sanitized provider details; they are never mislabeled as invalid JSON and do
  not consume the JSON-correction retry.
- Successful output is tied to a SHA-256 hash of the current Part, merged only
  into that Part, and preserves all application-owned question/gap/option IDs.
  Public `[[n]]` story markers are converted to existing private gap IDs only
  after validation. The merged result is one undoable draft change and is
  saved immediately through the revision-aware draft API; a new paper is
  created as a draft automatically when necessary. A stale hash or revision
  conflict is rejected, and Smart Import never publishes a paper.

Storage and APIs:

- Additive idempotent migration `mover-reading-writing-schema-v1` creates only
  `mover_reading_sets`, `mover_reading_set_versions`,
  `mover_reading_asset_usages`, `mover_reading_attempts` and
  `mover_reading_attempt_details`, plus bounded indexes and foreign keys. It
  does not alter, backfill or delete Listening/vocabulary/grammar data.
- The router is mounted at `/api/mover-reading-writing`. Staff CRUD, autosave,
  clone, publish, archive and results stay under `/admin/sets`; public play,
  prepare, idempotent submit and owner-bound review stay under `/sets`.
  Published versions resolve existing owned `listening_assets` once and record
  separate Reading & Writing usages, so shared media cannot be archived while
  an immutable paper still references it.
- Staff Smart Import capability discovery is `GET /capabilities`; temporary
  image upload and analysis are `POST /admin/smart-import/sources` and
  `POST /admin/smart-import/analyze`. The analysis request binds module, paper,
  Part, exact role list, current Part snapshot, base hash and provider. No
  schema migration or new persistent binary storage is required.
- Attempt tickets are HMAC-signed and bind set, immutable version, owner,
  assignment, client run ID and a hashed run secret. Guest review additionally
  requires the original run secret. Summary and per-question detail remain in
  separate tables; the public submit response never carries answer keys.
- Assignment resource type `mover_reading_writing` is supported end to end in
  the Admin scheduler and assignment API. Learning History projects it as the
  separate source `reading_writing`, game `mover-reading-writing`, preserving
  its 40-question counts and applying the captured review policy before answer
  details are returned.

UI and verification:

- Stable roots `#mover-reading-writing-admin`,
  `#mover-reading-writing-wizard`, `#mover-reading-writing-player` and semantic
  action hooks receive feature-scoped CSS after the legacy global overrides.
  Primary, submit, secondary, selected and disabled controls remain visible;
  the contrast contract verifies WCAG-AA text/background pairs. Review UI is
  absent when the immutable paper policy denies post-submit answers.
- `npm run test:mover-reading` covers the exact 6/40 schema, all six versioned
  import contracts, malformed/technical-ID rejection, ID-preserving one-Part
  merge, marker conversion, provider correction, staff/role/hash/transient
  route contract, provider-error classification, direct draft persistence,
  immutable publish, sanitization, grading, assignment wiring and UI contrast:
  17/17 pass. The unchanged
  Listening suite remains 127/127, proving the generalized provider image-role
  type did not change Listening behavior. `npm run lint`, `git diff --check`
  and `npm run build` pass.
- The broader History unit command passes its 20 portable cases. Its seven
  native SQLite API cases cannot start in the active Node 24 shell because the
  installed `better-sqlite3` binary targets Node ABI 127; this is the existing
  environment mismatch documented above, not a Reading & Writing assertion
  failure. The new end-to-end History coverage uses the explicit SQL.js test
  driver and passes without touching the local application database.

## 38. Mover Reading & Writing Part 5/6 image and answer-key correction - 2026-08-22

> Historical implementation note: the Part 6 A/B/C interaction described in
> this section was superseded by the schema-v2 one-word text-gap flow in §41.

- Part 6 Smart Import now uses `mover-rw-part6-external-v2`. The provider and
  external-JSON contract return the exact word printed in the answer key as
  `correctAnswer`; the runtime normalizer compares that word with the three
  options after NFKC/case/space/apostrophe normalization and maps the unique
  match to A/B/C. It never asks the model to convert the key to a letter or to
  solve the sentence. Missing, duplicate or non-matching words produce a
  warning and preserve the existing correct option.
- Part 6 public marker validation rejects non-numeric leftovers such as
  `[[Example]]`; the prompt keeps the printed example in the separate example
  field. The student renderer also replaces that one legacy marker from the
  example answer so an already-published draft cannot show the raw token.
- Part 5 `scene_1`, `scene_2` and `scene_3` are persistent display assets. An
  image uploaded inside Smart Import is attached to the corresponding scene
  immediately and the same stored asset is sent for OCR, avoiding a duplicate
  display upload. Only the answer-key image remains owner-bound temporary data.
- Part 6 stores an authoring source page, a derived cropped passage image and a
  separate options-table image. The crop UI reuses Listening Part 2's
  normalized visual crop and derived-asset upload pipeline. Students receive
  only the crop and options images; the full authoring source reference/URL is
  removed from the playable response. Published asset usage protects all
  referenced images from archival.
- The Part 2 player groups all printed examples in one shared card. Part 5
  retains the one-to-three-word grading rule but no longer shows the
  `Nhập tối đa 3 từ` placeholder. Part 6 stacks the cropped passage and options
  table in the left column and keeps the interactive gap controls in the right
  column. Grading, question counts, attempt storage and Listening behavior are
  unchanged.
- Regression coverage now includes the real Part 6 key pattern
  `and / than / sometimes / with / in`, ambiguous-word preservation, stray
  marker rejection, two-image student payload and the Part 2/5 UI contracts.
  `npm run test:mover-reading` passes 21/21, `npm run test:listening` remains
  127/127, and both `npm run lint` and `npm run build` pass. Local HTTP remains
  available on loopback with a 200 response.

## 39. Mover Reading & Writing visual answer review - 2026-08-22

> Historical implementation note: the Part 6 A/B/C review described in this
> section remains supported for old snapshots and is superseded for new
> attempts by the inline text review in §41.

- The Reading & Writing post-submit screen and Student Learning History now
  share `MoverReadingWritingVisualReview`. The renderer follows the immutable
  six-Part paper structure instead of presenting one generic forty-card list:
  Part 1 text answers with picture-word references, Part 2 grouped examples
  and Yes/No choices, Part 3 A/B/C dialogue choices, Part 4 inline story gaps
  plus title choice, Part 5 three scene/story groups, and Part 6 the two source
  images with passage gaps and A/B/C choices.
- Every scored item has one display-only state: correct, incorrect or
  unanswered. Text answers show the submitted answer and reveal the correct
  answer only when needed. Choice answers keep all visible options and mark
  both the selected wrong option and the correct option. Part tabs plus
  previous/next controls reuse the Listening review navigation pattern, while
  feature-scoped CSS keeps active, disabled and focus states legible after the
  legacy global button overrides.
- `buildMoverReadingWritingVisualReviewSnapshot()` derives the bounded review
  at read time from the attempt's exact immutable version and its stored forty
  grading rows. It deliberately omits application question/option IDs,
  accepted-answer arrays, authoring source assets and private Part 4/6 marker
  IDs. Nothing is copied into attempt storage, no image is duplicated, and no
  database migration or grading change is required.
- The owner-only attempt review endpoint builds this presentation only after
  the existing owner/run-secret and captured review-policy checks. Learning
  History uses the same builder for canonical and fallback Reading & Writing
  rows, then removes the entire visual review whenever answer review is not
  allowed. Malformed or unavailable legacy version content falls back to the
  existing generic result cards instead of blocking the attempt result.
- Regression coverage verifies the exact six-Part/forty-item snapshot,
  correct/incorrect/unanswered states, display-only payload, endpoint policy,
  Learning History projection/stripping and shared renderer/CSS contract.
  `npm run test:mover-reading` passes 22/22, the unchanged Listening suite
  passes 127/127, `npm run lint` passes and the production build succeeds. The
  broader History command still passes its 20 portable cases; its seven native
  cases remain unable to start under the documented local Node ABI mismatch.

## 40. Cambridge & IELTS exam directory and canonical routes - 2026-08-22

Scope and module registry:

- The public-facing area is now `Cambridge & IELTS / Kho đề luyện thi`, not a
  Listening-only directory. The manifest registry exposes seven stable module
  IDs in progression order: `starter`, `mover`, `flyer`, `ket`, `pet`, `fce`
  and `ielts`. Only Mover remains active. The other six modules are explicit
  coming-soon shells with no fake Parts, scoring, editor or assignment
  capability; activating one still requires its own paper manifests and
  client/server adapters.
- Each module owns a short display name and a separate qualification label:
  Pre A1, A1, A2, A2 Key, B1 Preliminary, B2 First or Academic & General.
  `ExamModuleId` and `ExamPaperId` are the generic shell types, while the old
  `ListeningModuleId` and `ListeningPaperId` names remain aliases so this UI
  refactor does not force storage/API migrations.

Student directory behavior:

- Selecting Mover opens one list immediately. The previous mandatory
  Listening-vs-Reading-&-Writing choice screen is no longer part of the main
  navigation. `listExamModuleEntries()` loads every active paper adapter in
  parallel, tolerates one failed source when another succeeds, includes only
  `published + public` rows, deduplicates by
  `moduleId:paperId:examId`, and sorts by the latest update with deterministic
  title/paper/ID tie breakers.
- Each list row displays a Listening or Reading & Writing badge above the
  direct exam title, plus Part/question count and duration. `All`, `Listening`
  and `Reading & Writing` filters do not add a required navigation step. The
  home CTA is `Xem danh sách`; it deliberately no longer shows the old
  Listening-only count that could say zero while Reading & Writing papers
  existed. Partial-source warnings, loading, error and empty states are kept
  separate.

Canonical URL and compatibility contract:

- New public links are `/exams`, `/exams/:moduleId`,
  `/exams/:moduleId/:paperId`, and
  `/exams/:moduleId/:paperId/:examId`. Current examples are
  `/exams/mover/listening/:examId` and
  `/exams/mover/reading-writing/:examId`. The paper segment is required to
  avoid collisions between independent stores that may use the same exam ID.
- `examLibraryPath`, `examModulePath`, `examPaperPath` and
  `examPaperExamPath` are the only canonical link builders. Student rows,
  Listening preview/private links, Reading & Writing preview/private links
  and Admin assignment links all use them. Assignment `accessToken` remains a
  query parameter and is encoded by the shared builder.
- Every released `/listening` alias remains parseable, including
  `/listening/:setId`, `/listening/modules/:moduleId/exams/:examId`, and the
  paper routes under `/listening/modules/:moduleId/papers/...`. They resolve
  through the same players without rewriting IDs or stored assignments. The
  existing `/api/listening`, `/api/mover-reading-writing`, SQLite collections,
  graders, immutable versions and attempts are unchanged.

Verification:

- Route/registry tests cover all seven modules, short URL round trips, both
  legacy URL generations, access/share token preservation and invalid module
  rejection. Combined-list tests cover cross-paper ID safety, duplicate rows,
  public-only visibility, labels, counts and sorting. A static navigation
  contract prevents reintroducing hand-built `/listening` links in the three
  Admin link producers.
- `npm run lint` passes, `npm run test:listening` passes 131/131,
  `npm run test:mover-reading` passes 22/22, and `npm run build` succeeds.
  Local SPA requests for `/exams`, module, exam and legacy paths return HTTP
  200. Browser-controlled visual capture was unavailable in the active tool
  session; the existing Vite instance does serve the updated seven-module
  frontend source.

## 41. Reading & Writing inline text-gap schema v2 - 2026-08-22

- The text-entry Parts now share the Part 4 interaction model. Part 1 renders
  its six definitions in one flowing answer panel; each Part 5 scene renders
  its picture beside one story/question panel; Part 4 keeps its six inline
  story gaps and title choice; Part 6 keeps the cropped reading image plus the
  word-bank image but replaces A/B/C dropdowns with one-word inline inputs.
  Part 2 Yes/No, Part 3 A/B/C and Part 4 question 7 are unchanged.
- Content schema v2 stores Part 1/5 question text as an internal template with
  one stable `{{questionId}}` marker and stores Part 6 gaps as text answer keys.
  The authoring UI exposes only numbered `[[n]]` markers, shows an inline
  preview, and maps them back to stable internal IDs. The player uses one
  shared `InlineAnswerInput` for Parts 1, 4, 5 and 6, including the existing
  Part 5 three-word limit and the Part 6 one-word limit.
- Smart Import contracts `mover-rw-part1-external-v2`,
  `mover-rw-part5-external-v2` and `mover-rw-part6-external-v2` require the
  printed inline marker. Part 6 now accepts only `gapNumber + acceptedAnswers`
  from the official answer-key image; it no longer asks either provider or
  application code to infer an A/B/C option. Empty/unreadable answers continue
  to warn and preserve the current draft value.
- Published schema-v1 data is never rewritten. A compatibility adapter clones
  and upgrades it in memory, appends/replaces missing Part 1/5 markers and
  derives each legacy Part 6 text key from its immutable correct option. New
  drafts, clones, versions and attempts use schema v2. Student sanitization
  still removes every accepted-answer array before returning playable content.
- Visual review now overlays Part 1/5/6 submitted text directly into the same
  inline templates as the player. Correct, incorrect and unanswered states
  preserve the existing semantic colours, while old `passage-options` review
  snapshots remain readable.
- Part 2 examples now share one uninterrupted presentation panel without an
  internal divider. The common example renderer inserts a supplied answer at
  the printed blank when one exists, so Part 6 renders `They` between
  `Dolphins live in the sea.` and `can swim very quickly` instead of appending
  it to the end of the sentence.
- Verification: `npm run lint`, `npm run test:mover-reading` (24/24),
  `npm run test:listening` (131/131) and `npm run build` pass. The production entry is
  `dist/client/assets/index-D3eH0-bY.js`; the server bundle is regenerated from
  source. No database migration, binary duplication or bulk data rewrite is
  introduced.

## 42. Initial-load request amplification and hot read-model pass - 2026-08-23

Frontend ownership and navigation:

- `AuthContext` keeps its global loading boundary active until both the Firebase
  token and canonical `/api/me` profile are ready. `App` therefore never starts
  an anonymous Home load during authenticated-session restoration.
- `App` owns Home data only on `/`. It does not run that loader for Admin,
  History, Exam, private-link, game, grammar, login or registration screens.
  Staff Admin uses only `AdminDashboard.refreshData`; switching explicitly to
  the student preview activates the Home owner.
- Home requests are independent `Promise.allSettled` tasks behind one
  `AbortController` and monotonically increasing generation ID. A route/auth
  change aborts the old generation and late Firestore/API responses cannot
  overwrite newer state. The redundant Home `/api/results` call was removed;
  Home consumes the dedicated leaderboard feed.
- Admin's initial loader has the same abort/generation boundary and requests the
  bounded summary feed at `/api/results?view=summary&limit=500`. Result detail is
  loaded only when a row is opened. Canonical `/exams` module/paper/exam links
  now use App-owned `history.pushState` navigation, while modified anchor clicks
  retain normal new-tab behavior and legacy URLs remain parseable.

Results, leaderboard and observability:

- Public/authenticated results and leaderboard routes emit `Server-Timing` and
  slow-request storage metrics. Independent source/map reads are parallelized
  after request amplification was removed.
- Summary mode strips answer details, private snapshots and run/session secrets,
  applies a server-clamped maximum of 500 rows, pushes `completedAt` ordering and
  limit into each source query, merges the three source streams, and returns the
  newest global slice. Public results accept the same optional bounded `limit`.
- `GET /api/results/:sourceType/:resultId` performs a point lookup and the same
  role/ownership checks before resolving one detail. Listening version/detail
  reconstruction is no longer multiplied by every dashboard row.
- Canonical `users`/`guest_profiles` name maps use a 60-second process cache with
  concurrent-load deduplication and explicit invalidation after account/profile
  creation or rename. No name-enrichment request performs historical backfill.
- Leaderboard first reads retained `leaderboard_events` plus the durable
  `settings/leaderboard-read-model-v1` marker. When `ready=true, version=1`, it
  returns the compact read model directly. Missing marker keeps a read-only
  compatibility scan so an upgrade cannot silently drop old scores.

Storage and safe rollout:

- Additive/idempotent migration `activity-read-indexes-v1` creates standalone
  descending `completed_at` indexes for `game_results`, `grammar_attempts`,
  `listening_attempts`, and `mover_reading_attempts`. These match recent-feed
  queries that do not constrain the leading columns of older composite indexes.
- `npm run db:backfill-hot-read-models -- --db <path>` is dry-run by default. It
  reports missing guest profiles and retained leaderboard events without any
  write. `--execute` first creates and quick-checks a SQLite backup, inserts only
  missing rows in bounded idempotent batches, verifies source table counts are
  unchanged, reconciles zero missing events, and only then writes the readiness
  marker. It never updates or deletes game/grammar source records.
- Production order is mandatory: stop/quiesce writers, back up the active DB,
  run preflight and the dry-run report, deploy the additive index migration,
  execute the explicit read-model backfill, verify its reconciliation output,
  then restart and inspect `Server-Timing`/`[PERF]` logs. Do not set the readiness
  marker manually and do not execute the maintenance command against an active
  database without the host backup window.

Verification:

- `npm run lint` passes. `npm run test:performance` passes 7/7, including a real
  SQL.js temporary-database migration/query-plan check; no local application DB
  is opened. Mover Reading & Writing passes 24/24. The Listening contract changed
  from eager staff detail to summary-then-detail; its updated full suite passes
  131/131.
- Learning History portable coverage passes 20/20. Its seven native API cases
  still cannot start in the current Node 24/ABI 137 shell because the installed
  `better-sqlite3` binary targets the required Node 22/ABI 127. No native rebuild,
  production data migration, deploy, commit or push was performed in this pass.
- The canonical production build passes and regenerates `dist/server.cjs` plus
  client entry `dist/client/assets/index-DbQ90nbv.js`; the artifact contains
  `student-history-nav-btn`, the bounded Admin summary URL, SPA Exam navigation,
  and the lazy result-detail route in the server bundle. Existing PDF/ESM chunk
  size warnings remain non-blocking.

## 43. Mover Part 6 image choices and Listening Part 5 flexible palettes - 2026-08-23

Reading & Writing Part 6:

- Content schema v3 supersedes the new-draft Part 6 text-gap flow in §41 while
  retaining schemas v1/v2 as immutable read/play/grade compatibility formats.
  New Part 6 drafts use `displayMode: image-multiple-choice`: one persistent
  student image contains the reading and numbered blanks, one persistent
  options-table image is authoring-only, and questions 1–5 each own exactly
  three stable application options plus `correctOptionId`.
- Smart Import uses only ROLE `options` and ROLE `answer_key`. The options image
  is OCR input for the three visible choices; the official key image is the
  sole authority for A/B/C. The prompt explicitly forbids reading/reconstructing
  the passage or solving a blank. If the key is unreadable, merge preserves the
  current teacher choice; the editor always exposes a correct-answer radio so
  the teacher can set or correct it manually before publish. The authoring-only
  options image picker is rendered only inside the Smart Import block; it is not
  duplicated beside the persistent student-image picker.
- Student sanitization removes the options-source asset and every
  `correctOptionId`. The player shows only the single reading image and five
  three-option radio groups; each question lays out A/B/C in one horizontal row
  with wrapping contained inside each option cell. Grading and visual review
  compare stable option IDs, while legacy passage-text Part 6 content and old
  review snapshots remain supported. Converting a legacy Part 6 is an explicit
  working-draft action and never rewrites an immutable published version.

Listening Part 5:

- Nested interaction schema v3 removes the v2 publish invariants of exactly six
  public colours, exactly three Draw icons, and one unused distractor of each
  kind. The 20-colour master catalog and five numbered scored questions remain;
  each question may contain any Colour/Draw action mix. Publish validation is
  relational: visible colours must be unique catalog colours and include every
  Colour answer; Draw items must have a label/type/uploaded PNG and include
  every referenced Draw answer. Geometry still requires teacher confirmation.
- New drafts start with empty visible-colour and object palettes. AI/direct and
  external-parameter imports create only the colours/icons supported by their
  actions, accept more than three icons (bounded to 20 only at the external JSON
  trust boundary), and never pad or invent distractors. Draft autosave remains
  available while content is incomplete; publish continues to reject missing
  prompts/actions/assets/geometry.
- The teacher editor toggles any catalog colours and adds/removes any number of
  Draw items. A colour/icon currently referenced by an action cannot be removed,
  preventing dangling answer keys. Adding the first Colour or Draw action also
  creates the minimum editable palette entry when needed. Old v1/v2 scenes stay
  playable and gradeable unchanged, with an explicit draft-only conversion to
  v3; the converter no longer rejects drafts with more than two correct icons.
- The v3 student player keeps colours reusable across multiple objects, while
  v1/v2 retain their released single-use colour behavior. Draw tokens remain
  individual single-use palette items. Student payload sanitization applies the
  public-colour filter to both v2 and v3 and continues to remove prompts, answer
  mappings and private Draw target regions.

Verification and rollout:

- `npm run lint` passes. `npm run test:mover-reading` passes 26/26 and
  `npm run test:listening` passes 133/133, including official-key-only Part 6,
  one-image/15-radio rendering, legacy schema compatibility, a valid v3 Part 5
  with two colours plus four fully used Draw icons and no distractor, import of
  more than three Draw items, and v3 reusable-colour player contracts.
- `npm run build` passes and regenerates `dist/server.cjs` plus client entry
  `dist/client/assets/index-CuyiVRCD.js`. Existing PDF/ESM chunk-size warnings
  remain non-blocking. This is an additive JSON-schema rollout: no SQL migration,
  production database write, bulk rewrite, deploy, commit or push is required or
performed. The loopback app started successfully with the SQL.js local-test
driver, but no in-app/external browser session was available for visual
capture; the local listener was stopped afterward.

## 44. Shared Cambridge & IELTS exam platform - 2026-08-23

Activation and paper manifests:

- This section supersedes the coming-soon activation statement in §40. Starters,
  Flyers, KET, PET, FCE and IELTS are active beside Movers and reuse one generic
  exam platform. The student and admin display labels are `Starters`, `Movers`
  and `Flyers`; stable module IDs remain `starter`, `mover` and `flyer`. Movers
  keeps its released dedicated Listening and Reading &
  Writing adapters, stores, schemas, 40-question contract and URLs unchanged.
- Paper definitions are data-driven in
  `src/features/exam-platform/definitions.ts`: Pre A1 Starters and A2 Flyers
  expose Listening plus Reading & Writing; A2 Key exposes Listening plus
  Reading & Writing; B1 Preliminary exposes Reading, Writing and Listening; B2
  First exposes Reading & Use of English, Writing and Listening. IELTS exposes
  only Academic Listening, Academic Reading and Academic Writing; General
  Training and Speaking are deliberately not registered.
- Every paper manifest owns its Part/Section count, allowed task types, time,
  question distribution and scoring weight. IELTS Academic Reading keeps three
  sections and exactly 40 questions while allowing the per-section split to
  vary. Writing tasks enter `pending_review` and use teacher scoring; objective
  papers remain backend-graded on the immutable published version.

Shared teacher and student flow:

- `src/features/exam-platform/admin/GenericExamAdmin.tsx` provides the common
  module/paper hub, draft editor, revision-aware autosave, preview, visibility,
  publish, clone, recoverable archive, per-set results and manual Writing
  grading. Parts support common passage, question and choice images, per-Part
  audio, objective answer keys, accepted text variants and Writing rubrics.
- JSON Smart Import is a bounded external-data contract. It accepts content,
  options and official answers through public labels/indexes, rejects injected
  IDs/media URLs/internal answer IDs, preserves application-owned identifiers,
  and returns warnings when a key is missing. Publishing remains blocked until
  a teacher supplies every objective key. This keeps the official-answer-image
  rule compatible with the existing Mover vision workflow without letting AI
  invent technical state.
- `GenericExamLearningArea.tsx` implements guest/authenticated identity,
  assignment/private access, resume, timer, per-Part navigation, submissions,
  pending Writing state, result and permitted answer review. Playable payloads
  contain no `correctOptionIds`, accepted answers, model answers or run secrets;
  displayed answers are human-readable labels/text rather than internal IDs.

Backend, storage and cross-feature integration:

- `/api/exam-platform` owns public/admin lists, draft revision checks,
  immutable version publish, signed prepare tickets, deterministic idempotent
  attempts, backend grading, review authorization and owner-only staff result
  access. Assignment tokens are resolved before public fallback so a public set
  launched from a class assignment still records its class/assignment context.
- Additive migration `exam-platform-schema-v1` creates `exam_sets`,
  `exam_set_versions`, `exam_asset_usages`, `exam_attempts` and
  `exam_attempt_details` with module/paper scoping, foreign keys and bounded-read
  indexes. Published media usage prevents a referenced shared image/audio from
  being archived. Existing Movers data and tables are neither copied nor
  rewritten.
- Admin assignment scheduling accepts generic exam sets and emits canonical
  `/exams/:moduleId/:paperId/:setId?accessToken=...` links. Completed generic
  attempts are unioned from their source table into Learning History as
  `sourceType=exam`/`lessonType=exam_set`; pending Writing attempts appear only
  after teacher grading. Teachers may inspect history detail only for owned or
  authorized assigned sets.

Verification:

- `npm run test:exam-platform` passes 10/10, covering all manifests, Academic-
  only IELTS, validation, Smart Import ID ownership, answer-key sanitization,
  weighted/manual grading, immutable versions, assignment attribution,
  idempotent submission, review authorization, media usage, archive/clone and
  Learning History. `npm run test:listening` passes 133/133 and
  `npm run test:mover-reading` passes 26/26, confirming Mover compatibility.
- `npm run lint`, `npm run test:performance` (7/7) and the production build pass.
  HTTP smoke checks return 200 for `/exams`, Starters, IELTS Academic Reading,
  module metadata, public paper lists and authenticated generic Admin lists.
  No in-app browser instance was connected for visual capture. Native storage/
  history tests remain blocked only by the pre-existing local Node 24 ABI 137
  versus installed Node 22 ABI 127 `better-sqlite3` mismatch; SQL.js lifecycle
  and migration coverage pass.

## 45. Admin quick-import prompt copy helpers - 2026-08-23

- Vocabulary and Grammar authoring keep their existing parsers, textarea state,
  save paths and backend contracts. `src/lib/adminBulkImportPrompts.ts` only
  builds bounded plain-text instructions for use in ChatGPT web and never calls
  an AI API or sends form data outside the browser.
- The Vocabulary quick-paste card copies the strict
  `word | meaning | ipa | partOfSpeech` contract with the current title, grade,
  subject, tags and description as optional context. The Grammar quick-import
  card switches between the existing multiple-choice
  `QUESTION/A/B[/C/D]/ANSWER/EXPLANATION` contract and the rewrite
  `QUESTION/ANSWER/[ACCEPTED]/EXPLANATION` contract. Rewrite prompts explicitly
  keep one accepted alternative per line and exclude open-ended essay tasks
  because current grading is normalized text matching.
- Both controls are non-submit buttons, do not edit either quick-import
  textarea, show a temporary `Đã sao chép` state, use Clipboard API first, then
  the scoped legacy copy fallback, and finally open a manual copy prompt if the
  browser blocks both automatic paths.
- `npm run test:grammar` now includes the pure prompt and Admin UI contracts and
  passes 13/13. `npm run test:vocab-games` passes 8/8, `npm run lint` passes and
  the production build contains all three prompt labels in the AdminDashboard
  chunk. No schema, storage, API, grading or existing content migration changed.

## 46. Starter Smart JSON Import and visual interaction authoring - 2026-08-25

- Scope is additive and limited to module `starter` inside the existing generic
  exam platform. Movers and the other generic modules retain their released
  import, storage, player and grading paths. No database migration or automatic
  content rewrite is introduced.
- `src/features/exam-platform/starterImport.ts` is the bounded external JSON
  boundary. Whole-paper input uses `exam-bundle-import-v1`; single-Part input
  accepts the same bundle, a `section` wrapper, or the section object itself.
  Sections keep the three-level interaction descriptor
  `family/subtype/variant`. The importer rejects technical IDs, URLs, base64 and
  file paths, creates/preserves application-owned IDs, and accepts private
  answers only when marked `official-answer-key` or `teacher-supplied`.
- Whole import applies each Part independently. A missing or invalid Part stays
  byte-for-byte on its current working draft while valid siblings are imported;
  each Part gets its own status, question count, warnings and errors. Import
  never publishes.
- Starter Listening enforces four Parts and five scored questions per Part.
  Part 1 is image-to-image one-to-one matching with exactly seven items on each
  side (five scored, one example and one distractor). Part 2 is one short text
  input per question. Part 3 is single choice with exactly three image options.
  Part 4 is scene colouring with one colour action and one teacher-confirmed
  target mask per question.
- `StarterAuthoring.tsx` keeps the initial Starter editor compact: metadata,
  whole JSON, image paste/upload, MP3 upload and Part selection. Part tabs appear
  only after import or explicit blank-draft creation. Each revealed Part also
  supports independent JSON replacement. Changing a scene/source image clears
  geometry or crop confirmations tied to the old pixels. Every Starter image
  slot (cover, Part source, question, option and crop replacement) reuses the
  Movers `FileDropPasteInput`, so teachers can choose, drag/drop or paste an
  image from the clipboard without changing the shared media upload contract.
- JSON owns logical content only. The application owns media IDs and normalized
  geometry. Part 1 reuses `ListeningRegionEditor` for teacher-confirmed image
  anchors; Part 3 reuses `VisualCropEditor` plus `cropListeningImage` to persist
  each A/B/C crop as a derived image asset; Part 4 uses edge-snapped freehand
  polygons for teacher-confirmed colour masks. Publish validation blocks missing
  media, crops, examples, one-to-one mappings or geometry confirmations.
- `StarterInteractions.tsx` supplies the released student interactions: Part 1
  tap-to-connect lines with one-to-one answer movement and a non-scored example;
  Part 4 colour palette plus clickable SVG masks. Part 2 and Part 3 continue
  through the generic text/choice renderer. Backend grading remains on immutable
  published content, and the existing student sanitizer removes every official
  answer while preserving public interaction layout.
- `npm run test:exam-platform` now includes Starter import and UI contracts and
  passes 19/19. It covers whole/single import, independent Part failure, ID
  ownership, one-to-one matching, stale crop invalidation, publish blockers and
  answer sanitization. `npm run lint` passes; the wider Listening 133/133 and
  Movers Reading & Writing 26/26 suites confirm compatibility. Production
  client/server builds pass, and local route, module metadata and authenticated
  Starter Admin API smoke checks return 200. The in-app browser had no connected
  instance, so desktop/mobile screenshots and computed-style capture remain a
  manual verification item.

## 47. Starter Listening Part 1 true connections and Part 3 batch crop - 2026-08-26

- This section supersedes the Part 1 region/player details in §46. New and
  re-authored Starter Listening Part 1 content uses nested interaction schema
  `starter-image-matching-v2`: seven semantic `sourceNodes`, seven
  `targetNodes`, one locked printed example and at most five scored
  source-to-target connections. The external Smart JSON contract accepts the
  new `sourceNodes/targetNodes/exampleConnection/correctConnections` names and
  still accepts the released `leftItems/rightItems/exampleMappings/mappings`
  names; both normalize to the application-owned v2 model.
- Part 1 authoring now uses fourteen small, teacher-confirmed hitboxes and
  explicit anchor points over the source page instead of large labelled answer
  rectangles. The student player renders those hitboxes fully transparent at
  rest, supports tap-tap and drag connections between any non-example nodes,
  enforces one source and one target per line, and leaves the printed example
  untouched. Labels exist for teacher editing and accessibility but are not
  drawn on top of the exam image.
- Part 1 answers are stored as one bounded connection set under a Part-owned
  response key. The student content sanitizer removes the private
  question-to-source mapping and official targets; the answer sanitizer accepts
  only public, non-example, one-to-one node pairs. Backend grading compares the
  submitted set with the five private official pairs and emits human-readable
  review labels. Grading version is `exam-platform-objective-v2`. Released v1
  layouts remain playable, and their legacy per-question answers remain
  gradeable through the compatibility adapter; no database rewrite is needed.
- Starter Listening Part 3 reuses the Movers Listening Part 4 black-frame
  detector. One teacher action detects and uploads all fifteen A/B/C crops for
  five questions. When eighteen frames are found, the first A/B/C group is
  treated as the printed example and skipped; fifteen-frame pages map directly.
  Existing manual crop and per-option image replacement remain available as the
  correction fallback. A source-image change aborts the batch before the draft
  is overwritten.
- `npm run lint`, `npm run test:exam-platform` (23/23) and
  `npm run test:listening` (133/133) pass. Coverage includes v1/v2 imports,
  connection sanitization/grading, released-answer compatibility, eighteen-
  frame example skipping, the shared Movers detector and feature-scoped
  transparent hitbox styling. The production build passes and loopback smoke
  checks return 200 for the app, Starter Listening route and Starter module
  metadata. No browser instance was connected for desktop/mobile capture. No
  SQL migration or automatic published-content rewrite is introduced.

## 48. Starter Listening Part 2 fixed text-entry experience - 2026-08-26

- Starter Listening Part 2 is now a fixed five-question `short-answer` Part,
  matching the released Movers Listening Part 2 interaction. Its definition no
  longer offers the generic choice/matching type menu. The specialized teacher
  editor shows only one optional Part illustration, required audio, one optional
  unscored example, and five prompt/accepted-answer pairs. Per-question context,
  image, type, points and choice controls are not rendered.
- Prompts may place `____`, `{{answer}}` or `{{blank}}` where the single answer
  field belongs; if no marker is present the field is appended. Accepted answer
  variants remain separated by `|` in authoring and continue through the same
  private backend answer list and normalized objective grader.
- The student player follows the Movers two-column presentation: optional
  illustration/example on the left and five numbered question cards with
  inline answer fields on the right. On narrow screens the same content stacks
  vertically. Generic modules and all released Movers editor/player code remain
  unchanged.
- No content schema, database, API or grading migration is required. Legacy
  Starter Part 2 JSON still imports through `single-input`; stale per-question
  context/images/options are not displayed and are removed when that question
  is edited in the specialized form. `npm run test:exam-platform` passes 25/25,
  including the fixed definition, simplified editor contract and Movers-style
  player contract.

## 49. Starter whole-JSON ChatGPT prompt copy - 2026-08-26

- `starterImportPrompt.ts` is the single source for the Starter Listening
  whole-bundle extraction prompt. It describes the fixed four-Part/20-question
  paper and the exact three-layer `family/subtype/variant` descriptor for every
  Part. The prompt emits the current draft title/description as optional context
  and includes one complete `exam-bundle-import-v1` shape using Part 1 v2 node
  labels, Part 2 single gaps, Part 3 A/B/C image choices and Part 4 colour
  actions.
- The prompt explicitly prohibits application-owned IDs, URLs, base64, file
  paths, crop/anchor/hitbox/mask coordinates and Markdown wrappers. It tells the
  external model to use `official-answer-key` only for directly verified keys,
  to mark uncertain answers `unverified`, and to exclude every printed example
  from the twenty scored questions.
- `StarterWholeImportPanel` exposes `Sao chép prompt gửi ChatGPT` directly above
  the whole-JSON textarea. It uses Clipboard API with the scoped legacy/manual
  fallback, never edits the textarea, and reports a temporary copied state plus
  the next step to attach source pages and the official answer key in ChatGPT
  Web. No AI request is made by the application.
- `npm run lint` and `npm run test:exam-platform` (26/26) pass, including prompt
  schema and UI-copy contracts. No content schema, API, storage or grading
  migration is introduced.

## 50. Universal Exam JSON v2, dynamic Parts and multi-block authoring - 2026-08-26

- This section supersedes the fixed-paper import/editor assumptions in sections
  46 and 49. The released Starter `exam-bundle-import-v1` parser remains as a
  compatibility adapter, but the primary authoring boundary is now
  `exam-bundle-import-v2` for every generic exam module. It does not impose the
  Cambridge Starter four-Part template.
- `ExamPaperContent` schema v2 adds `structureMode: dynamic` and optional
  `ExamPartContent.blocks[]`. The JSON owns the ordered number of Parts, blocks
  inside each Part, and questions inside each block. Each block declares the
  three-level `interaction.family/subtype/variant` descriptor and references
  application-owned canonical questions by generated IDs. Schema-v1 published
  content and definition-shaped drafts still validate, play and grade without
  a database rewrite.
- `universalImport.ts` is the untrusted external-data boundary. It accepts up to
  20 Parts, 20 blocks per Part and 200 questions per block, rejects technical
  IDs/media URLs/base64/file paths, generates all internal IDs after parsing,
  and accepts official answers only when their source is
  `official-answer-key` or `teacher-supplied`. Whole JSON is scoped to the
  currently opened module and paper; a Part-only import changes only that Part.
- Interaction geometry is no longer categorically banned. Optional
  `geometryHints` may use normalized coordinates, or pixel coordinates together
  with the exact source `imageSize`; pixel values are normalized at the import
  boundary. Hints are stored as `suggested`, seed supported image matching,
  scene and image text-entry layouts, remain publish blockers until the teacher
  confirms the actual regions, and are completely removed from student
  playable content.
- `UniversalAuthoring.tsx` exposes the whole-JSON and per-Part input for all
  generic modules. Its copy button builds one Universal JSON v2 prompt that
  tells ChatGPT Web to infer the real Part/block/question counts and permits
  bounded coordinate suggestions. The Starter v1 import remains callable from
  the same surface when an old bundle is pasted.
- Admin tabs are generated from `content.parts`, not the paper definition.
  Dynamic Parts render one editor card per block with its declared interaction,
  media and canonical questions. The existing Starter visual editors are reused
  for matching, image options, single-input and scene interactions; the new
  `image-text-entry-v1` overlay supports teacher-confirmed answer fields on an
  image.
- Student rendering, answer sanitization and backend grading iterate projected
  block units through `examStructure.ts`. Matching connection response keys use
  each block ID, so two different interactions inside the same Part are handled
  independently. Official answers remain server-private. Block-level image and
  audio references are included in the existing ownership, media-resolution and
  immutable-version usage path.
- Regression coverage includes a six-Part bundle, a Part containing two task
  types, pixel-to-normalized geometry, teacher confirmation, student geometry
  stripping, multi-block answer sanitization and grading, Universal prompt
  contracts, per-Part promotion of untouched legacy content, and Starter v1
  compatibility. `npm run lint`, `npm run test:exam-platform` (30/30),
  `npm run test:listening` (133/133), the
  production build and loopback HTTP smoke pass. The in-app Browser reported no
  connected browser instance, so desktop/mobile visual and computed-style QA
  remains a manual test item at `http://localhost:3000/exams/starter/listening`.

## 51. Per-Part prompts, editable colour keys and scene draw actions - 2026-08-26

- Every Universal per-Part JSON panel now has its own prompt-copy action. The
  generated prompt keeps the complete `exam-bundle-import-v2` envelope but
  requests exactly the selected `partNumber`; full envelopes containing only a
  non-first Part are resolved by `partNumber`, not by array position.
- The shared prompt explicitly distinguishes painting an existing object from
  drawing/adding a new object. `scene / colour-object / paint` questions carry
  an official colour from the ten-colour catalog, while verbs such as draw,
  add and make produce a separate `scene / draw-object / draw` block with
  `drawObject`, `targetDescription` and an optional suggested `draw-region`.
  The prompt includes the concrete Cambridge-style example “Draw a flower on
  the dog's head” so it cannot be rewritten as a colour instruction.
- Scene-colour import normalizes every question onto one application-owned
  catalog: red, blue, green, yellow, orange, purple, pink, brown, black and
  white. The specialized teacher editor always shows all ten values, including
  when AI omitted or misread the answer, and lets the teacher replace or clear
  the official colour before publishing.
- Scene draw is a separate typed interaction (`scene-draw-v1`), not a fake
  colour option. The teacher reviews the object and location description and
  confirms a private target region. The student selects the instruction and
  clicks the scene to place the requested symbol. Answer sanitization accepts
  only the public action/object and normalized point; backend grading checks
  the point against the private region. `targetRegion`, geometry hints and
  teacher-confirmation state are removed from playable student content.
- Regression coverage verifies the focused Part 4 envelope, colour/draw prompt
  rules, the ten-colour contract, colour and placement grading, out-of-region
  rejection and private-region stripping. `npm run lint` and
  `npm run test:exam-platform` (32/32), `npm run test:listening` (133/133) and
  the production build pass. Loopback smoke returns HTTP 200 for
  `http://localhost:3000/exams/starter/listening`; visual QA remains manual
  because no in-app Browser session is connected.

## 52. Starter Part 4 Draw tokens and schema-v2 draft revalidation - 2026-08-27

- Starter Part 4 keeps Colour and Draw as separate schema-v2 blocks inside the
  same Part. A Draw target now owns one teacher-selected PNG token in addition
  to its object label and private target region. The editor reuses the Movers
  Part 5 media picker: the teacher may select an active PNG from the library or
  upload a new transparent token next to the Draw action. Publishing is blocked
  until every Draw target has a token and confirmed region.
- The student Draw player now follows the Movers Part 5 interaction instead of
  drawing an emoji placeholder. Available PNG tokens appear in a dock, support
  drag-and-drop or select-then-click placement, keyboard arrow positioning plus
  Enter, disappear after use, and return when the placed token is removed.
  Submitted answers remain the bounded action/object/normalized-anchor tuple;
  backend grading still checks the private target region.
- Exam media ownership/versioning now resolves and usage-tracks Draw tokens with
  role `draw-token`. The playable sanitizer retains the resolved public token
  URL but removes `targetRegion` and teacher confirmation. Reimport preserves a
  teacher token only when the semantic Draw object is unchanged, preventing a
  stale flower icon from being silently reused for a different object.
- Saving or autosaving a draft now synchronizes the parent set's
  `schemaVersion` with `draftContent.schemaVersion`. The reported local failure
  came from a long-running pre-v2 backend: the stored draft was already numeric
  schema 2, dynamic, and contained Colour plus Draw blocks, while its saved
  validation list came from the old validator. Restarting from current source
  and revalidating revision 3 removed both false errors (`schema unsupported`
  and `Part 4 question 5 type unsupported`); the only remaining publish blocker
  is the intentional missing Draw PNG.
- The local launcher resolves `tsx/cli` through Node package resolution, so a
  worktree can reuse the parent dependency installation. Regression coverage
  includes focused Part 4 schema/type validation, schema synchronization,
  Draw-token media resolution/usage, playable token URLs, private-region
  stripping and the drag/drop UI contract. `npm run lint`,
  `npm run test:local-auth` (3/3), `npm run test:exam-platform` (32/32),
  `npm run test:listening` (133/133) and the production build pass. Fresh
  localhost source and API smoke return HTTP 200.

## 53. Fixed Starters Listening four-Part authoring and Movers view adapters - 2026-08-27

- Starters Listening is now an explicit fixed-paper exception on top of the
  Universal JSON v2 platform: the authoring screen reveals Part 1-4 immediately,
  whole import must return exactly four ordered Parts, and each Part must contain
  five canonical scored questions. Other generic modules retain the dynamic
  Part/block pipeline described in section 50.
- The whole-paper panel and every Part panel keep independent JSON inputs and
  prompt-copy actions. `universalImportPrompt.ts` emits a Starters-specific
  prompt for this paper: Part 1 keeps image-to-image line matching, Part 2 maps
  to Movers Listening Part 2, Part 3 maps to Movers Listening Part 4, and Part 4
  maps to Movers Listening Part 5 with separate Colour and Draw blocks. Geometry
  may be suggested only through unconfirmed `geometryHints`; application IDs,
  media URLs and teacher confirmation cannot be supplied by external JSON.
- Part 1 retains its existing dedicated matching authoring and student
  interaction. Part 2 uses the exported `ListeningPart2View` through a bounded
  answer adapter. Released Part 2 blocks using the earlier `inline-gap` variant
  are routed through the same adapter as new `single-input` blocks, so changing
  the renderer does not require recreating or republishing an existing set.
  Part 3 uses `ListeningPart4View` with the shared fifteen-frame crop workflow.
  It has two explicit media roles: the Part-level illustration is shown to the
  student, while the image-options block owns a separate teacher-only crop
  source that produces the fifteen student-visible A/B/C assets. The crop source
  is removed from playable payloads, crop completeness is shown explicitly, and
  the manual crop canvas stays closed until the teacher chooses
  `Crop lại / thay ảnh`.
  Part 4 combines colour and draw units into the exported
  `ListeningPart5View`, including teacher-selected draggable PNG tokens. The
  released Movers components and data paths are not modified.
- Part 4 authoring now presents Colour and Draw as one unified surface backed
  by the existing two typed blocks. All five actions share the Part-level scene
  and audio; teachers edit the ordered actions, required Draw PNG, Colour masks
  and private Draw target regions without switching between separate block
  cards. Each Colour row owns a `Chọn vùng để tô` action immediately after its
  answer colour, and each Draw row owns a `Chọn vùng đặt vật` action. Only the
  currently selected row opens the shared scene editor, so the authoring page
  never renders separate Colour and Draw copies of the source image. Colour
  uses a freehand edge-snapped mask; Draw uses a private rectangular grading
  region whose centre-point rule matches Movers Listening Part 5. This is a UI
  projection only, so existing schema-v2 drafts and grading contracts need no
  migration.
- The playable sanitizer derives one public, Part-level colour palette from the
  unique official answer colours plus exactly one unused basic colour. It does
  not expose which colour belongs to which target. The Starters adapter uses
  stable semantic colour IDs in the Movers Part 5 view and maps a selection
  back to each question's application-owned option ID for grading. The Draw
  dock contains only the required targets, with no distractor object.
- Starters Listening has a dedicated Movers-style run shell and result flow.
  Detailed review shows Part tabs and visual evidence: matching lines on the
  Part 1 scene, text responses for Part 2, selected/correct A/B/C images for
  Part 3, and colour masks plus placed Draw tokens for Part 4. Private grading
  regions and official answer keys remain server-only.
- `npm run lint`, `npm run test:exam-platform` (35/35),
  `npm run test:listening` (133/133), and the production build pass. The change
  is isolated to the Starter Smart Import worktree and introduces no database
  migration or automatic rewrite of published Movers content.

## 54. Generic exam review safety, transcript release and responsive images - 2026-08-28

- Starters Listening result controls now have feature-scoped, high-contrast
  styles for the home, review, retry, Part-tab, previous/next and summary-back
  actions. The same protection is applied to the shared generic player used by
  Flyers, KET, PET, FCE and IELTS. The released Movers players and review CSS
  are not changed.
- Starters visual review follows the corresponding Movers presentation: Part 1
  omits the printed example connection and uses thinner submitted/correct
  strokes; Part 2 uses the two-column illustration/example plus answer-card
  layout; Part 4 uses one scene with colour overlays, placed Draw tokens and a
  dashed correct Draw target when the student's placement is missing or wrong.
  The private Draw target is copied into the completed attempt detail and is
  released only through the authorized review endpoint.
- Every Listening Part in the generic admin now has a 20,000-character
  `audioTranscript` editor and optional `.txt` loader under “Nội dung bài nghe /
  hội thoại”. Universal and legacy imports preserve teacher-entered transcript
  text. `sanitizeExamContentForStudent()` always removes it from playable
  content; the submit transaction snapshots non-empty Part transcripts, and
  the review endpoint returns them only after completion and only when the
  existing answer-review policy permits access. Starters and the generic result
  screen render the transcript inside a collapsed Part-labelled disclosure.
- `ExamImageViewer.tsx` is the exam-platform-only responsive image boundary. It
  constrains large paper/scene images to the available viewport while retaining
  aspect ratio and normalized overlay coordinates, and supplies an accessible
  modal with zoom, reset, fullscreen and Escape-to-close controls. It is used by
  generic cover/Part/question images plus Starters matching, text-entry,
  image-options, colour and Draw views. Movers source components remain
  untouched; Starters adapters add their own zoom trigger around reused views.
- `npm run lint` and `npm run test:exam-platform` (36/36) pass. The router test
  verifies that a transcript is absent from the playable payload and present in
  the permitted completed-attempt review.

## 55. Fixed Starters Reading & Writing five-Part workflow - 2026-08-28

- Starters Reading & Writing is a fixed Cambridge-paper projection on the
  shared exam platform: five ordered Parts, five scored questions per Part and
  25 questions in total. Its five Part tabs are visible as soon as a draft is
  created. Both the whole-paper JSON panel and every Part keep an independent
  prompt-copy/import panel; the Starters-specific prompt fixes the required
  interaction variant for each Part while leaving all IDs and media under
  application/teacher ownership.
- `StarterReadingWritingAuthoring.tsx` is the dedicated teacher surface. Part 1
  owns a separate example image above a two-column task image plus Yes/No
  statements. Part 2 follows Movers Reading & Writing Part 2. Part 3 uses one
  complete source page as the left student image and five one-word answer rows
  on the right. Part 4 follows the Movers story-gap layout with a word-bank
  image and exactly one `[[1]]` through `[[5]]` marker. Part 5 follows the
  Movers scene-story layout with three teacher-owned images. Scene 1 owns two
  printed examples and one scored question; scenes 2 and 3 own two scored
  questions each, giving a fixed 1+2+2 distribution. All image pickers accept library selection, upload or
  clipboard paste; a per-question generic type/media editor is not shown.
- `ExamDisplayExample` and `ExamReadingScene` are public presentation records on
  Parts/blocks. Universal import creates application-owned scene IDs and
  canonical question references, preserves existing teacher media on a Part
  reimport and flattens scene questions into the single canonical grading list.
  Media resolution, ownership checks and immutable-version usage tracking now
  include example and reading-scene images.
- `StarterReadingWritingViews.tsx` renders the five student layouts using the
  same two-column and inline-input patterns as the corresponding Movers Parts.
  Part 1 places its printed example image above the task; Part 3 deliberately
  uses the simple full-page-left/input-right option selected by the product
  owner. Every source image goes through `ExamImageViewer`, so large scans fit
  the viewport and retain zoom/fullscreen controls.
- `StarterReadingWritingResult.tsx` provides the same result sequence as the
  reviewed Movers flow: high-contrast summary actions, five Part tabs,
  previous/next controls and layout-aware visual review. Yes/No selections,
  one-word answers, story gaps and the three scene groups show the student's
  response and the authorized correct answer. Official keys remain absent from
  playable content and are released only by the existing post-submit review
  endpoint.
- Server validation blocks publishing unless every Part has its exact variant,
  question count and required images; Part 5 must cover each canonical question
  exactly once in a 1+2+2 split, with exactly two unscored examples displayed
  inside scene 1. Regression coverage includes whole and
  per-Part prompt contracts, import/media preservation, 25-question grading,
  playable answer-key stripping, layout contracts and the API workflow.
  `npm run lint` and `npm run test:exam-platform` (38/38) pass. Movers Reading &
  Writing source components are reference-only and remain unchanged.

## 56. Admin exam-directory quick module navigation - 2026-08-28

- `ListeningLibraryAdmin.tsx` reuses the single visible-module registry to show
  seven compact quick-access buttons in the directory header: Starters, Movers,
  Flyers, KET, PET, FCE and IELTS. Each button opens the same module admin
  router as its full directory card, so capability/status routing cannot drift.
- The quick navigation collapses from seven columns to four and then two on
  narrower screens, keeps visible keyboard focus and exposes an accessible
  navigation label. It remains mounted above `ListeningModuleRouter` while a
  module is open; the current module uses a selected high-contrast state, so
  staff can switch directly between modules. The full module cards remain
  unchanged on the directory overview.
- The quick buttons use the stable `exam-module-quick-link` hook rather than
  Tailwind colour utilities. A final `#listening-library-admin` contrast block
  in `index.css` wins over the legacy high-specificity admin button selector
  and defines default, hover, focus-visible and `aria-pressed=true` colours.
  The navigation contract verifies cascade order and WCAG-AA colour pairs.

## 57. Shared responsive exam-image presentation profiles - 2026-08-31

- `src/features/exam-media/imageProfiles.ts` is the presentation-only registry
  for cover, split-page, illustration, page-scan, story-scene, word-bank,
  interactive-scene and option images. Pixel dimensions from an uploaded asset
  never become layout dimensions: every profile supplies a responsive maximum
  width and a `dvh`-aware maximum height. These values are not stored in drafts,
  published versions or attempts, so no schema/data migration is required.
- `ExamImageViewer.tsx` consumes those profiles while retaining its explicit
  `maxWidth`/`maxHeight` escape hatches. `data-exam-image-stage` remains the
  exact rendered image box, and matching/colour/Draw SVG or hitbox overlays are
  children of that stage. This prevents normalized coordinates from drifting
  because of an empty letterboxed slot. Zoom, fullscreen and Escape-to-close
  behavior is unchanged; modal sizing now uses the dynamic viewport unit.
- `ExamSplitTaskLayout.tsx` is the shared picture-left/task-right shell. Its
  `47fr / 53fr` tracks divide the width remaining after the 24px gap, replacing
  the previous `44% + 56% + gap` overflow pattern. It stacks on narrow screens
  and keeps only the media column sticky on desktop.
- The generic player resolves profiles from media role, paper and interaction
  family. Flyers Reading & Writing Part 3 selects the split-page/two-column
  presentation; generic question and choice images use illustration and option
  profiles. Starters Reading & Writing student/review Parts and Movers Reading
  & Writing student/review Parts select profiles by semantic role rather than
  uploading resolution or per-Part CSS.
- Starters Listening continues to reuse the released Movers Part 2/4/5 views,
  but stable image hooks plus feature-scoped CSS make its A/B/C images compact
  without changing the Movers Listening presentation. Matching and Colour/Draw
  scenes use the large interactive profile, with their overlay geometry bound
  to the same responsive stage. Student review images use the same profiles as
  their corresponding task views.
- Contract coverage locks the profile registry, dynamic viewport bounds,
  overflow-safe split tracks, Flyers Part 3 resolver and Starters-only option
  sizing. Verification requires TypeScript, exam-platform, Listening and Movers
  Reading tests plus a production build and desktop/mobile visual smoke.

## 58. Fixed Flyers Listening five-Part workflow - 2026-08-29

- Flyers Listening is now a fixed five-Part, 25-question projection on the
  shared exam platform. Whole-paper and per-Part Universal JSON prompts lock
  the reviewed interaction for each Part, preserve application-owned IDs and
  teacher-owned media, and reject any import that does not contain exactly
  five scored questions per requested Part. Other papers retain the dynamic
  multi-Part/multi-block Universal JSON behavior.
- Part 1 projects to the public Movers Listening Part 1 interaction: six
  reusable name cards, five scored scene regions and one unscored printed
  example. `flyer-name-placement-v1` stores only public hit regions and
  question references; official name mappings stay in private question answer
  keys. `FlyerListeningAuthoring.tsx` edits the shared names and keys and makes
  every region a publish prerequisite. The prompt now returns exactly five
  normalized rectangles numbered 1-5; import locks them to the Movers Part 1
  target size (12% x 5.5%), and the
  editor uses `FixedRegionEditor` so teachers only review or drag them. A valid
  AI region or a teacher drag establishes the geometry without a separate
  confirmation button. Part 2 projects to
  Movers Listening Part 2: one shared optional illustration, one example area
  and five short-answer prompts with a single inline word/number input.
- Part 3 uses `two-image-letter-input`: the Part image is the A-H option board,
  the first reading-scene image is the people/name board, and the five compact
  A-H inputs form a narrow third column. The player and review use three fixed,
  edge-to-edge frames with the original wide/wide/narrow ratio. Both images use
  `ExamImageViewer.fillFrame`, so large images shrink and small images enlarge
  with `object-fit: contain` while zoom/fullscreen remains available. Small
  viewports use horizontal overflow instead of changing the task to a vertical
  layout. The editor provides a separate upload/library/clipboard field for the
  second image and exactly one public unscored example.
- Part 4 reuses the Movers Part 4 image-option player and the existing batch
  crop/manual-crop authoring adapter. A separate public reading-scene asset is
  uploaded/pasted as the common student display image and is rendered in both
  the task and detailed review. The full-page crop source is removed from
  playable content; students receive the public display image plus only the
  fifteen derived A/B/C images.
  Part 5 reuses the Movers Part 5 Colour/Draw player and the unified scene
  authoring surface, including teacher-confirmed colour masks, private Draw
  grading regions and teacher-owned transparent Draw tokens. Flyers Part 5
  enables both upload and clipboard paste for each required PNG Draw token.
- `FlyerListeningViews.tsx` supplies the fixed student adapters, while the
  established listening result shell now adds Flyers-specific visual review:
  placed names on the scene for Part 1, the two-column Movers text-entry review
  for Part 2, the two-image letter layout for Part 3, image choices for Part 4
  and scene Colour/Draw review for Part 5. The same
  high-contrast result/home/retry, Part tabs, previous/next controls, protected
  transcript disclosures and responsive image rules used by Starters remain in
  force. Movers source files are reference-only and were not modified.
- Server validation enforces the five-Part structure, required audio/media,
  the Part 1 six-name/five-region contract, Part 2 short answers, A-H letter
  answers, fifteen Part 4 crops and the complete Part 5 Colour/Draw mapping.
  Student sanitization removes every
  official answer, transcript, private Draw target and the Part 4 crop source.
  Regression coverage includes the fixed prompt, whole import normalization,
  answer sanitization, 25-question grading and authoring/player/review source
  contracts. Legacy Flyer drafts automatically replace the old Part 2
  name-placement shape with the Movers Part 2 short-answer shape on edit.
  `npm run lint` and `npm run test:exam-platform` cover these contracts.

## 59. Flyers Reading & Writing seven-Part, flexible-count workflow - 2026-08-29

- Flyers Reading & Writing keeps exactly seven ordered Part types, while the
  scored question count of every Part comes from the printed source or imported
  JSON. The common `10–7–5–6–7–10–5` distribution is only the default for a new
  draft and a prompt example; neither whole-paper import, focused Part import nor
  publication validation treats it as a schema limit. Printed examples are
  stored separately and never count toward the scored total.
- `flyerReadingWritingMigration.ts` preserves every non-empty imported question
  list and normalizes only the seven interaction shapes: definitions, Yes/No,
  two-image A-H conversation matching, story gaps plus a final title choice,
  story sentence completion, A/B/C multiple-choice cloze and one-word open
  cloze. `universalImportPrompt.ts` tells the model to read the actual count in
  each Part heading and not pad or truncate content to match the sample JSON.
- `FlyerReadingWritingAuthoring.tsx` exposes add/remove controls for the scored
  rows in every Part. Part 2 keeps two unscored examples; Part 3 keeps one
  example and the Flyers Listening wide/wide/narrow image layout; Part 4 creates
  one marker per fill gap and reserves its last scored row for the A/B/C title;
  Part 5 owns one complete printed-page image plus the scored sentence answers,
  and Part 6 follows the Movers Part 6 image-choice authoring shape: one public
  printed-page image and a compact numbered A/B/C answer row for each scored
  item. Neither Part 5 nor Part 6 stores or regenerates a duplicate passage.
  Part 7 owns an optional image, one example and exactly one word at every
  marker. Image fields use the shared upload/library/clipboard picker.
- `FlyerReadingWritingViews.tsx` and `FlyerReadingWritingResult.tsx` render the
  same structures for taking and reviewing the paper. Part 3's narrow third
  frame contains only `number + letter input` rows because the left image already
  contains the conversation. Part 5 keeps the complete printed page on the left
  and only scored answer inputs on the right. Part 6 keeps the printed page on
  the left and renders each question number with all three A/B/C choices on the
  same row on the right, matching the established Movers image-choice workflow.
  Part 7 places its one-word controls/results at the passage markers, and Part 4
  numbers its title dynamically. Images use `ExamImageViewer` size limits plus
  zoom/fullscreen. Review keeps all seven persistent Part tabs and previous/next
  controls.
- Server validation requires seven ordered Parts, at least one scored question
  in each, the correct interaction and exact unscored-example count, but no
  fixed question distribution. It derives marker counts only for Parts 4 and 7,
  requires the final Part 4 title choice, validates A-H in Part 3 and three A/B/C
  choices in Part 6, and allows only Part 7's image to be omitted. Regression
  coverage verifies flexible whole/per-Part import,
  application-owned media/IDs, publication, sanitization, grading and the three
  dedicated author/player/review cloze layouts. Movers source components remain
  reference-only.

## 60. KET Reading & Writing nine-Part workflow and AI Writing grade - 2026-08-29

- New KET Reading & Writing drafts use `templateVersion:
  ket-reading-writing-9-v1` and exactly nine ordered Part types. Parts 1-8 keep
  flexible scored-row counts; the initial `5-5-10-7-8-5-10-5` counts are only
  draft defaults. Part 3 always has two independent flexible blocks (A/B/C
  cloze plus the Flyers-style two-image letter task). Part 9 owns one long
  writing question worth exactly 10 integer points, with teacher-configurable
  minimum and maximum word counts.
- `ketReadingWritingMigration.ts` is the schema adapter. It normalizes only an
  explicitly versioned nine-Part KET paper. Existing released seven-Part KET
  content remains compatible and is never silently rewritten; its editor
  offers an explicit, confirmed conversion to a fresh nine-Part draft while
  preserving paper metadata and review settings.
- `KetReadingWritingAuthoring.tsx` provides dedicated editors for all nine
  formats. Images are teacher-owned only in Parts 1, 3A/3B, 4 and 5. Parts 2
  and 6-9 import their visible source/instruction/example text through JSON;
  Part 6 stores one
  visible initial letter plus the total answer length, Part 7 stores only
  printed numbers and answers (no generated `Gap n` labels), Part 8 has
  add/remove form rows, and Part 9 owns the public task, private task context,
  provider choice, rubric, grading instructions and a read-only prompt preview.
  The editor reads the backend provider-capability endpoint, labels configured
  models as ready, disables unavailable alternatives and warns when the model
  saved in an older draft currently has no server key.
  Whole-paper and focused-Part Universal JSON imports use the same normalized
  shape; `universalImportPrompt.ts` explicitly forbids padding or truncating the
  flexible Parts.
- `KetReadingWritingViews.tsx` projects those authoring shapes into the student
  paper: fixed adjacent wide/wide/narrow frames for Parts 1 and 3B; separate
  navigable pages for 3A and 3B; image-above layouts for 3A, 4 and 5; source
  text above exact character cells in Part 6; source text above two columns of
  number-only rows in Part 7; source text above form rows in Part 8; and task
  text above a lined word-page editor in Part 9. `KetReadingWritingResult.tsx`
  supplies a high-contrast summary and
  nine persistent review tabs, reusing the same visual structures and showing
  the final Writing score, sentence count, grammar issues, vocabulary issues
  and concise feedback.
- KET Part 2 is text-only, keeps one unscored text example, and renders every
  real prompt above one A/B/C row. Parts 4 and 5 omit the example panel and put
  their teacher image above the answer area. In Part 6, `answerLength` remains
  the full word length, while
  `acceptedAnswers` and the submitted response contain only the characters the
  student types after the fixed initial letter (`p` + `assport`). Part 8 has a
  single optional `answerPrefix` inside the answer region and no suffix field;
  grading compares only the continuation typed by the student.
- KET Part 3A keeps its source image above the work area, omits the separate
  example panel and renders each real question above its A/B/C row in
  authoring, taking and review. Part 3B preserves the printed question number returned as
  `questionNumber` (for example 16-20) in `displayNumber`; the shared narrow
  letter column uses that printed number instead of re-numbering rows 1-N.
- Part 9 grading is server-only. `writingGradingProvider.ts` supports the
  explicitly selected Stali or DevQuota adapter, wraps the essay as untrusted
  text, sends no student identity, validates a strict JSON result, accepts only
  an integer score from 0 to 10, and retries malformed output once on the same
  provider without silent fallback. `examRouter.ts` persists the attempt before
  calling the provider and records queued/processing/completed/failed states.
  A failed call never becomes an automatic zero: staff can retry the selected
  provider or apply the existing manual-grade fallback. The resulting 0-10
  Writing score is weighted like ten objective points in the overall /100.
- `examValidation.ts` requires images only for KET Parts 1, 3, 4 and 5; requires
  visible source text for Parts 6-9; and enforces choices, the Part 2 example,
  Part 3 block mapping, spelling lengths, Part 9 limits/provider configuration and the single
  10-point Writing task. Student sanitization removes answer keys and private
  grading configuration. Contract, import, grader, router integration and
  provider tests cover the complete authoring-to-history path; all KET CSS is
  scoped under dedicated authoring/player/result/review roots.
- `ListeningAssetPicker` now passes the freshly uploaded asset through its
  selection callback. Flyers Listening Draw tokens, Flyers Reading & Writing
  images and KET Reading & Writing images consume that fresh value instead of
  looking it up in the previous render's asset array, so clipboard paste is
  accepted on the first click rather than the second.

## 61. KET Listening five-Part, flexible-count workflow - 2026-08-30

- New KET Listening drafts use `templateVersion: ket-listening-5-v1` and five
  ordered interaction types, while every Part keeps a teacher-controlled,
  flexible scored-row count. `ketListeningMigration.ts` normalizes only that
  explicit version. Existing released generic KET Listening content remains
  unchanged until the teacher confirms the conversion shown by the admin.
- Part 1 reuses the Movers Listening three-picture choice player. Its private
  source page is analyzed by `ketListeningCrops.ts`, which groups detected
  frames by visual row and accepts only rows containing exactly three A/B/C
  frames. This prevents the single combined frame printed for question 3 from
  shifting later crops. Only printed questions 1, 2, 4 and 5 are batch-cropped;
  question 3 exposes one direct upload/library/clipboard picker for its single
  combined image, rendered above three A/B/C answer buttons. Extra
  teacher-added rows still expose three option-image pickers. A standard paper
  therefore publishes 12 derived crops plus one shared question-3 image. The
  private page source is removed from playable student content.
- Part 2 reuses the Flyers fixed adjacent wide/wide/narrow two-image letter
  layout. Part 3 is text-only, stores the generated task instruction in
  `passage`, and renders it above the example and each dialogue prompt with
  three A/B/C replies. Parts 4 and 5 store the complete printed instruction and
  example in `passage`, followed by compact numbered form fields with an
  optional prefix and suffix around the same answer input (`98 [answer] Road`).
  `KetListeningViews.tsx` uses
  the established high-contrast listening shell and `StarterListeningResult`
  now reviews all five KET shapes with the same summary, tabs, navigation and
  protected transcript disclosure as the other young-learner listening papers.
- Whole-paper and focused-Part Universal JSON prompts/imports require five
  ordered Parts, preserve actual flexible counts, keep examples unscored and
  preserve already attached teacher media when content is re-imported. Server
  validation requires audio for every Part, exact A/B/C images, both Part 2
  images, A-H letter answers, the Part 3 text dialogue contract and visible
  passage/form content for Parts 4-5. Answer keys and transcripts remain
  private. Regression tests cover prompt/import normalization, flexible counts,
  option-media preservation, source sanitization, special row grouping and the
  author/player/review contracts.

## 62. Timed practice submission resilience - 2026-08-30

- A configured deadline now ends the countdown and triggers one automatic
  submission, but it no longer invalidates the signed attempt. The attempt
  ticket keeps its independent security expiry, so a temporary network error
  can be retried with the same run ID instead of trapping the learner on the
  paper. Generic Starters/Flyers/KET attempts record `timedOut` when submitted
  at or after the deadline; Movers players use the same one-shot auto-submit
  guard. Empty and partially completed answer snapshots remain valid graded
  submissions, with unanswered items counted normally.

## 63. Generic exam ticket recovery - 2026-08-31

- Generic exam prepare tickets remain directly submittable for at least 24
  hours. Each new ticket also carries a fixed seven-day recovery boundary after
  that direct-submit expiry; a renewed ticket is valid for at most 15 minutes
  and cannot move the original recovery boundary forward.
- `POST /api/exam-platform/modules/:moduleId/papers/:paperId/sets/:setId/attempts/renew`
  accepts an expired signed ticket only to reissue it for the same immutable
  `clientRunId`, owner, run-secret hash, set and published version. It preserves
  `startedAt` and `deadlineAt`, so recovery never grants extra test time.
  Signed legacy tickets without expiry fields derive the same bounded window
  from their original `startedAt`; malformed, cross-route, cross-owner,
  wrong-secret, unavailable-version and over-age tickets are rejected.
- `GenericExamLearningArea.tsx` invokes renewal only after a submit returns
  HTTP 410, stores the renewed ticket with the existing answers, then retries
  submission once. Permanent client errors clear `submissionPending` to avoid
  reload loops while retaining the local answer snapshot; transient failures
  remain manually retryable with the same idempotent run.

## 64. KET Reading & Writing control contrast - 2026-08-31

- Part 3 player and review navigation uses stable
  `ket-part-three-tab` and `ket-part-three-page-nav` hooks. Selected, available
  and disabled states are styled only below the KET player/review roots so the
  legacy global button rules cannot wash out the 3A/3B controls.
- Result actions use `ket-reading-result-home` and
  `ket-reading-result-retry` hooks below `ket-reading-writing-result-screen`.
  Their explicit blue/green palettes, plus the readable disabled Part 3
  palette, meet the WCAG AA 4.5:1 text-contrast threshold and are protected by
  the exam-platform contract test.

## 65. KET Writing provider diagnostics - 2026-08-31

- The provider catalog's `enabled` flag means only that the corresponding API
  key is configured; the KET editor labels this state `đã cấu hình` instead of
  claiming that the remote service is currently ready.
- `describeWritingGradingFailure` converts connection, timeout, provider HTTP
  and invalid-response failures into teacher-safe messages without including
  an API key or essay. `examRouter.ts` persists that actionable message on the
  pending attempt and writes a structured server log containing only the
  attempt ID, provider ID and error name/message. Failed answers remain
  available through the paper's `Kết quả` action for AI retry or manual 0–10
  grading.

## 66. Viewport-fitted exam images and normalized interaction stages - 2026-08-31

- `src/features/exam-media/ExamImageViewer.tsx` is now the shared presentation
  boundary for both the generic exam platform and the released Movers players;
  the former student-local path remains a compatibility re-export. The inline
  stage shrink-wraps the rendered image, applies semantic profile width/height
  bounds and keeps overlays inside that exact box. Frames use only a thin,
  low-contrast border supplied by the caller.
- The interactive-scene profile is capped at 760px by 620px and reserves
  viewport height for the exam header, audio, answer dock and navigation. Large
  landscape or portrait assets therefore shrink into the working page while
  small assets keep their natural size. Source pixel dimensions are not stored
  as presentation dimensions and no content/attempt migration is required.
- Movers Listening Part 3 keeps its established natural-width exception:
  boards at least 400px wide retain their intrinsic width and only shrink for
  the available viewport; boards below 400px use `min(naturalWidth * 1.5,
  480px)`. Its SVG and hitboxes remain children of the same rendered stage.
- The image dialog opens fitted to the viewport, offers original 1:1 size,
  browser fullscreen and keyboard controls, and computes zoom multiplicatively
  without the former 50%-300% product clamp. Original/zoomed assets use their
  natural pixel width inside a two-axis scroll viewport. Escape closes the
  dialog and focus returns to the expand trigger.
- Movers Listening Parts 1, 2, 3 and 5, Flyers Listening Part 1, the reused
  Starters/Flyers Colour/Draw player, and Listening visual review now use the
  shared viewer. Part 1 regions, Part 3 lines/hitboxes and Part 5 Colour/Draw
  overlays remain normalized to 0..1 and are children of the same responsive
  stage used for pointer coordinate conversion. The previous adapter CSS that
  resized only the Part 5 image was removed to prevent letterbox drift.
- Movers Reading & Writing task and review images also use the shared viewer.
  Expand, modal tool and close buttons have explicit feature-scoped default,
  hover and focus-visible contrast rules under generic, Listening and Movers
  roots so legacy global glass-button rules cannot wash them out.

## 67. Long-lived Firebase session refresh - 2026-08-31

- `AuthContext.tsx` subscribes to `onIdTokenChanged` instead of only
  `onAuthStateChanged`. Firebase background refreshes therefore replace the ID
  token held in React context before protected API clients reuse an expired
  value. Initial restore still waits for `/api/me`, while later refresh events
  do not reopen the global loading boundary or temporarily render a guest UI.
- A transient 500/503 profile-sync failure during a background refresh
  preserves the existing authenticated UI and the newly obtained token;
  initial restore failures and a real backend 401 retain fail-closed behavior.
- `authenticateUser` verifies the bearer token in its own error boundary.
  Invalid/expired tokens keep the existing 401 contract, while authenticated
  profile or storage failures return a truthful 500/503 response. Diagnostic
  logs include only error code/name/message and never the token.
- No schema, published content or attempt migration is involved. Before the
  auth change, `.data/local-test.sqlite` was copied to a verified local backup;
  both source and backup passed `PRAGMA quick_check` and matched by SHA-256.

## 68. Direct admin exam-paper lists - 2026-08-31

- `ListeningModuleRouter.tsx` now owns the common module-level paper toolbar.
  Selecting Starters, Movers, Flyers, KET, PET, FCE or IELTS opens a paper list
  immediately; the previous intermediate paper-choice cards and the redundant
  `Chọn module khác` / `Chọn loại bài thi khác` actions are removed. The compact
  module navigation remains mounted above the list and is the single way to
  switch modules.
- Filter and authoring actions are generated from each module manifest rather
  than hard-coded. Starters, Movers, Flyers and KET expose Listening plus
  Reading & Writing, including `Soạn Listening` and `Soạn R&W`; modules with
  separate Reading, Writing or Academic papers expose their real paper set.
  Authoring requests enter the established paper-specific editor and preserve
  its existing APIs, validation, autosave, immutable publishing, result and
  recoverable archive behavior.
- `examAdminSearch.ts` provides shared title-only filtering for generic,
  Movers Listening and Movers Reading & Writing lists. Search ignores letter
  case, Vietnamese diacritics and surrounding spaces; it is presentation-only
  and does not change or migrate persisted sets.
- The common toolbar disables module-local search/filter/create controls while
  a paper editor is open, preventing an accidental unmount of unsaved work.
  Stable `exam-paper-*` hooks in the final `index.css` contract define opaque
  default, hover, selected, disabled and focus states after the legacy admin
  overrides. Navigation contracts cover the direct route, removal of the
  intermediate screen, search normalization and WCAG-AA colour pairs.
- The compact layout keeps the module/paper title, title search and paper-specific
  authoring actions on one desktop row. Listening/Reading & Writing filters form
  a separate sort row immediately above the list. The former Movers Listening
  `Nhập từ PDF` entry is no longer rendered; its underlying importer/server
  implementation remains intact but has no button in this admin surface. With
  no remaining browser entry import, the PDF engine/dialog chunks are also
  absent from the current production client manifest.
- `exam-module-admin-hub` and its list header explicitly opt out of the legacy
  `#admin-main-panel section`/global `header` surface rules. Their transparent
  background removes the square layer behind rounded list corners, while the
  shared `exam-paper-list-frame` clips each Listening, Movers R&W and generic
  paper table to one 24px rounded boundary. The search field also removes the
  global inner input border so it appears as one control rather than nested
  rectangular frames.

## 69. Starters Reading & Writing cropped-row layouts - 2026-08-31

- `StarterReadingWritingAuthoring.tsx` reuses the existing normalized
  `VisualCropEditor` and derived Listening-media upload path for two new fixed
  authoring contracts. Part 1 accepts one private page source and produces two
  example crops plus five scored-question crops. Part 3 accepts one private
  page source and produces one worked-example pair plus five scored left/right
  pairs. Replacing a source invalidates only its derived crops so stale images
  cannot remain attached to a newly uploaded page.
- Universal JSON v2 remains responsible only for recognized text and official
  answers. Its Starters Reading & Writing prompt now requires two Part 1
  examples, one Part 3 example and `answerLength` for every Part 3 word; import
  preserves teacher-owned crop media, keeps this paper in definition mode and
  rejects both primary and secondary technical media fields supplied by
  external JSON. A single-Part import does not promote untouched sibling Parts.
- `ExamQuestion` and `ExamDisplayExample` have additive optional secondary
  image references. The existing JSON content column needs no migration.
  `examRouter.ts` resolves, authorizes and usage-tracks both sides through the
  existing media library. Publish validation requires all 7 or 12 derived
  images for the new layouts and verifies Part 3 dash counts against official
  answers. Released legacy Part 1 and Part 3 page-image layouts remain valid.
- Student sanitization removes the private Part 1/3 source page once the full
  crop set is complete, while keeping the public derived images. Part 1 then
  renders one picture/statement/Yes-No row per item; Part 3 renders left image,
  spelling input and right image per row. Part 2 and Part 4 use taller fitted
  image frames, and Part 2 choices share a row with their wrapping statement.
  Result review mirrors both new crop layouts and retains the legacy fallback.
- New crop actions and inline Yes/No controls have feature-scoped opaque
  enabled, hover, focus, selected, disabled and loading contrast states under
  stable Starters/generic-exam hooks so legacy global CSS cannot wash them out.

## 70. Starters fixed Listening scale and smart page crop - 2026-09-01

- Starters Listening Parts 1, 3 and 4 now use a desktop working frame at 90%
  of the former width, height and minimum height. Parts 1 and 4 opt into a
  1.2x shared interactive-image stage with 912px/744px semantic caps. Image,
  SVG lines, hitboxes, Colour regions and Draw anchors remain children of the
  same normalized 0..1 stage, so presentation scaling does not change stored
  geometry or answer coordinates. Small-screen layouts keep the full available
  viewport and the existing fullscreen viewer remains available.
- Starters Listening Part 2 has one canonical two-example contract. The author
  enters exactly two separate lines; released one-line text is split when its
  two printed question/sentence boundaries can be recognized. The generic
  passage copy above the activity is suppressed and the single lower example
  panel renders exactly two labelled rows. Publish validation blocks a draft
  until both unscored examples are present.
- `starterReadingWritingCropDetection.ts` performs deterministic, browser-local
  pixel segmentation for the official Starters Reading & Writing page shapes.
  Part 1 detects seven top-to-bottom illustration rows while excluding the
  sentence column. Part 3 detects six paired rows and emits twelve crops in
  left/right order. It never asks AI to invent geometry and refuses incomplete
  or ambiguous detection instead of guessing.
- `StarterReadingWritingAuthoring.tsx` exposes one-click detection, a preview
  for every slot, per-slot correction through the existing normalized crop
  editor and an explicit batch confirmation. Derived media uploads are bounded
  in groups; the Part content receives all 7 or 12 references in one update
  only after every upload succeeds and only if the source page is unchanged.
  Universal JSON continues to own recognized text, answers and Part 3 word
  lengths while teacher-reviewed crop geometry stays application-owned.
- Verification: TypeScript lint passes; exam-platform tests pass 65/65;
  Listening tests pass 138/138; focused crop/layout contracts pass 22/22; and
  canonical `npm run build` produces `index-C1ElIRTG.js`,
  `index-CgWDhoKR.css`, `clientRegistry-CQMAA9q3.js` and `dist/server.cjs`.
  The native-only legacy integration suite cannot start in the active Node 24
  shell because installed `better-sqlite3` targets the documented production
  Node 22 ABI 127; no native rebuild or database/dependency mutation was made.

## 71. Flyers Listening Part 3 answer-name rows - 2026-09-01

- `FlyerLetterMatchingView` now labels each student answer field with the
  teacher/import-owned `question.prompt` person name instead of the internal
  display number 1–5. Empty legacy draft prompts use `Người 1` through
  `Người 5` only as a presentation fallback; question IDs, answer order,
  accepted A–H values and grading remain unchanged.
- The fixed third column grows from 180px to 220px and keeps a bounded 56px
  letter field so normal and wrapping person names remain readable. Stable
  `data-flyer-part3-answer-name` and name-based accessible labels are covered
  by the exam-platform presentation contract. Focused contracts pass 19/19,
  TypeScript lint passes and the canonical production build succeeds.

## 72. Flyers Reading & Writing Part 4 stacked student layout - 2026-09-01

- `FlyerReadingWritingViews.tsx` now presents Part 4 as one bounded vertical
  flow instead of the shared desktop split layout: the fitted illustration is
  centered first, followed by the unscored example, story with inline gaps and
  the final title-choice row. Mobile and desktop therefore keep the same visual
  reading order as the paper.
- This is presentation-only. Existing question IDs, `[[n]]` markers, answer
  state, one-word limits, title option IDs and grading remain unchanged. Stable
  `data-flyer-reading-part4-stacked` and `data-flyer-reading-part4-content`
  hooks protect the Part-specific contract without changing the other six
  Flyers Reading & Writing layouts. Focused contracts pass 19/19, TypeScript
  lint passes and the canonical production build succeeds.

## 73. Starters Reading Part 1 pastel-row crop detector - 2026-09-01

- Part 1 now uses the dedicated browser-local `pastel-row-v1` strategy instead
  of the mixed dark/colour illustration predicate. It scans only the official
  illustration column from normalized x=0.15 to x=0.65, converts each pixel to
  HSV saturation and activates pixels at S>=20/255. White/grey paper, black
  sentence text and checkboxes therefore do not participate in segmentation;
  coloured content outside the illustration ROI is ignored.
- A vertical projection smooths scan noise and closes only short gaps inside a
  pastel island. The closing limit is 0.8% of page height: on the 307x797
  official scan this bridges internal texture noise but preserves the 10px gap
  between the shoe and sofa cards. Within each row, an 8%-height horizontal
  density projection selects the dominant pastel island and rejects sparse
  coloured scan haze extending toward the sentence column. A restrained 3.5%
  margin keeps grey/black objects such as a camera, elephant or shoe inside the
  crop without restoring adjacent text. Candidates remain ordered top-to-bottom
  as two examples followed by five scored questions.
- Structural validation is fail-closed: both band count and usable crop count
  must equal seven. Six, eight, blank or otherwise ambiguous detections return
  no automatic crops and confidence zero; the teacher can use the existing
  normalized manual crop editor. Successful detection still requires preview
  and explicit batch confirmation before any Part references are updated.
- The Part 3 paired-column detector and the pre-existing black-frame A/B/C
  detector are unchanged. Regression coverage verifies grey objects on pastel
  backgrounds, coloured noise outside the ROI, rejection of eight/blank rows,
  the close shoe/sofa rows, six paired Part 3 rows and both black-frame grouping
  cases. Exam-platform tests pass 69/69, focused black-frame tests pass 2/2, TypeScript lint passes
  and the canonical production build succeeds. A direct run against the saved
  307x797 camera-to-sofa source returns seven ordered crops, confidence 0.96
  and no warnings; their right edges remain before normalized x=0.59.

## 74. Compact Starters Reading crop authoring previews - 2026-09-01

- `StarterReadingWritingAuthoring.tsx` keeps the seven/twelve crop slots in a
  compact auto-fit grid instead of stretching three preview cards across the
  full editor width. Both newly detected regions and already saved derived
  images use a bounded 128px thumbnail (108px on narrow screens); the duplicate
  caption under an auto-detected preview is hidden because the slot card already
  owns the accessible label.
- Thumbnail sizing is presentation-only. Normalized crop geometry, source and
  derived asset references, batch confirmation and student rendering are
  unchanged. The complete source image remains available only inside the
  existing `VisualCropEditor` after `Kiểm tra / chỉnh vùng tự dò`, `Crop lại` or
  `Chọn vùng crop` is activated. Focused presentation contracts pass 19/19 and
  TypeScript lint passes.

## 75. Starters Reading Part 3 paired-colour crop detector - 2026-09-01

- Part 3 now uses the dedicated browser-local `paired-colour-anchor-v1`
  strategy. It scans only normalized x=0.15..0.45 for object illustrations and
  x=0.63..0.92 for letter bags; the answer dashes and labels in the middle are
  outside both ROIs. The vertical scan begins at y=0.10 rather than the proposed
  y=0.16 because the worked-example ear and bag in the saved official-shaped
  source begin above 16%.
- HSV colour pixels are grouped with 8-connected components and filtered by
  scale-relative area, width and height. Exactly six substantial right-side
  bags are required and sorted by vertical centre as row anchors. Each valid
  left-side component is assigned only to its nearest anchor within a bounded
  tolerance; components in the same row are unioned before cropping, so the two
  separate feet become one illustration while short coloured answer dashes are
  rejected as noise.
- Detection remains fail-closed. Anything other than six right anchors or six
  completed left/right rows returns no crops, leaves Part data unchanged and
  keeps the existing `VisualCropEditor` fallback. Successful output is flattened
  as example-left/right followed by question 1..5 left/right, matching the
  existing twelve-slot authoring and batch-upload contract.
- A direct run against the saved 294x388 ear-to-mouth source returns 12 ordered
  crops, confidence 0.96 and no warnings. Regression coverage includes the
  split-feet union, ignored middle dashes and rejection of five right anchors;
  focused crop/presentation contracts pass 28/28, exam-platform tests pass
  71/71 and TypeScript lint passes.

## 76. Starters Reading Part 3 per-letter spelling cells - 2026-09-01

- The Part 3 student view now renders exactly `answerLength` letter cells rather
  than one tracked text input with a multi-dash placeholder. Each typed letter
  occupies its own underline; typing or pasting advances across cells, an empty
  Backspace removes the previous letter, and Left/Right arrows move keyboard
  focus. The worked example uses the same one-character-per-underline visual.
- This follows the KET Reading & Writing Part 6 interaction but deliberately
  keeps different storage semantics: KET stores only the characters after its
  supplied prefix, while Starters joins every visible cell into the complete
  word. Existing answer state, submission payload and backend short-answer
  grading therefore remain unchanged, and playable data continues to use the
  public `answerLength` without exposing accepted answers.
- The paired layout gives the spelling column enough desktop width for normal
  Starters words and wraps longer configured answers without overflowing on
  small screens. Feature-scoped CSS keeps every enabled/focused underline
  opaque and readable despite legacy input rules. Focused behavior/presentation
  contracts pass 20/20, exam-platform tests pass 72/72 and TypeScript lint
  passes.

## 77. Starters Reading Part 3 frameless paired rows - 2026-09-01

- The cropped Part 3 student layout keeps the containing Part panel and its
  three-column reading order, but removes the decorative border, background,
  corner radius and shadow from each paired row. The left/right image shells
  are also transparent and frameless; the source illustration pixels and the
  existing fullscreen image action remain unchanged.
- This styling is isolated by `data-starter-rw-part3-row` and
  `data-starter-rw-part3-image`. Part 1 and every other image layout continue
  to use the shared framed image presentation. Student spelling cells retain
  their opaque high-contrast surface and receive only a restrained 5px/3px
  corner radius, so the individual-letter interaction stays clear without a
  rigid rectangular appearance.
- This is presentation-only: crop references, image fit, answer state,
  submission payload, keyboard behavior and grading contracts are unchanged.
  The focused exam-platform presentation suite passes 20/20.

## 78. Exam-wide double-click image expansion - 2026-09-01

- The shared `ExamImageViewer` no longer renders its corner expand button by
  default. Every current practice-exam image that uses this boundary now opens
  the same fullscreen viewer by double-clicking its inline stage. The stage
  exposes a zoom cursor, a concise instruction and an Enter/Space keyboard
  equivalent; existing zoom, fit, original-size, browser-fullscreen and close
  controls inside the opened viewer are unchanged. `showExpandButton` remains
  an explicit opt-in for a future exceptional screen, and no current exam
  caller enables it.
- In the cropped Starters Reading & Writing Part 3 layout, the visible
  `Example` caption and question numbers 1-5 are removed. Image order, the
  unscored example, accessible answer labels, per-letter inputs, stored answer
  values and grading order remain intact. Stable double-click and label-free
  presentation hooks are covered by the focused 20/20 contract suite; the full
  exam-platform suite passes 72/72, the TypeScript gate passes and the
  canonical production build succeeds.

## 79. KET single-image matching, Part 5/8 media and Listening heading ownership - 2026-09-01

- KET Reading & Writing Part 1 and Part 3B, plus KET Listening Part 2, now
  opt into a KET-only single-image mode of the shared letter-matching view.
  The one task image stays on the left and the existing answer column stays on
  the right in the player and review screens. Flyers keeps its original
  two-image layout. The KET authoring screens expose one image picker; any
  legacy second-image reference is preserved in stored data for compatibility
  but is no longer required or rendered.
- KET Reading & Writing Part 5 now owns exactly one unscored text example in
  migration, authoring, player, review, import prompt and publish validation.
  Part 8 adds a teacher-owned upload/paste image field; the attached image is
  preserved across JSON re-import, published to students and displayed above
  the text source and form rows in both the live attempt and detailed review.
- KET Listening Part 3 no longer renders its legacy lower passage as a second
  title block. Parts 4 and 5 use the fixed main headings `Part 4 listening -
  Question 16–20.` and `Part 5 listening - Question 21–25.`. The import prompt
  assigns Part/range/instruction ownership only to the main heading and limits
  `content.passage` to the printed form content/example. A presentation adapter
  removes the duplicated first legacy paragraph when an existing set still
  contains the old heading/instruction prefix, without rewriting stored data.
- KET Reading & Writing result and history controls now have stable scoped
  hooks and explicit opaque active/inactive styling for the Home action, view-
  result action, Part tabs and return-to-summary action. The view-result loading
  state remains readable and announces `Đang tải kết quả…` instead of relying
  on low opacity. No answer values, scoring weights or grading semantics
  changed. TypeScript lint passes and the exam-platform suite passes 72/72. The
  canonical production build succeeds with
  `index-C1ElIRTG.js`, `index-CgWDhoKR.css`, `clientRegistry-CQMAA9q3.js` and
  `dist/server.cjs`.

## 80. External audit security, lifecycle and read-performance hardening - 2026-09-02

- The September external audit was rechecked against the current runtime before
  implementation. Browser API calls are same-origin, authentication uses an
  explicit Bearer token rather than cookies, and Express does not emit permissive
  CORS headers by default. For that reason no permissive CORS layer or unrelated
  CSRF cookie mechanism was added. Cross-origin browser access remains denied by
  default, while `firestore.rules` now closes the remaining direct client read of
  `vocab_sets` and the unused client Firestore database module was removed.
- `src/server/httpHardening.ts` owns explicit browser security headers, bounded
  trusted-proxy parsing, network-key resolution, timing-safe diagnostic-secret
  comparison and bounded in-memory fixed-window limits. `server.ts` explicitly
  retains the established 100 KB JSON boundary and applies targeted limits to
  guest identity, AI and weighted TTS routes. Phone throttling now uses the same
  bounded store and Express' trusted `req.ip`, never a raw client-supplied
  `X-Forwarded-For` value. Production 5xx responses no longer expose internal
  messages/details, and diagnostic routes require `x-diagnostic-secret` without
  putting the secret in a URL.
- `src/server/accessPolicy.ts` removes privileged email allowlists from runtime
  source. Firebase claims remain first priority; configured comma-separated
  `BOOTSTRAP_SUPER_ADMIN_EMAILS` are second; backend-only stored roles preserve
  existing administrators. Development seed identities use `.invalid` example
  addresses. Real credentials remain outside Git: `.env` is ignored, is not a
  tracked file and has no commit in repository history. `DEVQUOTA_API_KEYk` is
  accepted only as a warned transition alias; production operations must rename
  it and rotate provider credentials outside the repository.
- `src/server/legacySessionAccess.ts` constrains the old tokenless guest update
  path to an uncompleted, matching, recent session. Its compatibility window is
  `LEGACY_GUEST_SESSION_MAX_AGE_HOURS` (24 hours by default, 0 disables it).
  Optional invalid Bearer tokens remain guest-compatible but now produce bounded
  diagnostics without logging the token.
- Vocab sets, grammar sets, classes and assignments now use the shared
  `resourceLifecycle.ts` archive contract. The existing DELETE URLs remain for
  client compatibility, but they mark records archived, hide them from active
  lists, revoke private links and preserve content, members, attempts, learning
  history, leaderboard facts and published evidence. This deliberately rejects
  the audit's cascade-delete suggestion because it conflicts with the project's
  history and published-version invariants.
- `scripts/media-orphan-maintenance.mjs` provides an explicit Node 22 maintenance
  boundary for filesystem orphans. The default is read-only dry-run, only
  hash-named files older than seven days and absent from database references are
  candidates, and `--execute` first creates a verified SQLite backup before
  moving files to a recoverable quarantine directory. It deletes neither files
  nor database/history rows. Use `npm run maintenance:media-orphans -- ...`.
- Canonical result-name enrichment now point-reads only referenced user/guest IDs
  with a TTL cache and bounded concurrency rather than scanning both identity
  collections. The admin account directory computes a teacher's manageable guest
  IDs from one bulk snapshot set instead of calling the multi-query ownership
  check once per profile. `src/appRoutes.ts` centralizes stable shell-route parsing
  and safely rejects malformed encoded tokens, reducing routing state/regexes in
  `App.tsx` without a breaking router migration.
- Runtime filesystem locations are configuration-driven. Development defaults
  remain under `.data`; production fails closed unless the persistent directories
  and database path are configured. `.env.example` uses generic `/srv/vhomework`
  examples and documents proxy, bootstrap-role and legacy-session settings.
- Broad rewrites of `server.ts`, `sqliteStorage.ts`, `index.css`, all APIs or all
  frontend routing were intentionally not combined with this security release.
  API versioning/default pagination and further feature-router extraction require
  separate compatibility contracts and rollout work; the current aliases and
  storage adapter remain intentional backward compatibility.
- Regression gates: TypeScript lint passes; selected portable suites pass 297
  tests in total, including security/routes 14/14, performance 9/9, Listening
  138/138, exam-platform 72/72 and Mover Reading & Writing 26/26. The canonical
  production build and bundled artifact checks pass. Native SQLite/history/CLI
  and startup gates remain environment-blocked because the active workstation
  shell is Node 24 ABI 137 while the installed production-target driver is Node
  22 ABI 127; the driver was deliberately not rebuilt under the wrong Node ABI.

## 81. Standalone Writing library and flexible AI word policy - 2026-09-07

- `src/features/writing-library/` owns the separate Writing-library shell,
  focused one-task authoring view, student writing/result presentation and the
  shared word-range policy. The administrator menu exposes `Kho đề Writing`
  immediately below `Kho đề luyện thi`; the Cambridge/IELTS exam directory
  keeps the supporting `writing` module hidden so the feature is not duplicated.
- The directory reuses the immutable shared exam-set/version/attempt platform,
  archive-safe delete behavior, assignment resource contract and the standard
  Play -> Sửa -> Sao chép -> Kết quả -> Xóa row actions. Its dedicated table
  shows STT, set title, school grade, topic, one-writing count, status, creation
  date, link and actions, with title search plus grade/status filters and numeric
  grade sorting. Student links use `/writing/:setId`; existing canonical exam
  URLs remain compatible. Although the supporting manifest stays `hidden` from
  the Cambridge/IELTS directory, both the direct `/exams/writing` list and the
  `/writing/:setId` player explicitly remain active; the hidden flag must never
  send a standalone Writing link to the generic coming-soon screen.
- A set validates as exactly one long-writing question worth 10 points and
  persists the teacher-selected grade/topic, task context, rubric, grading
  provider and grading instructions with every immutable published version.
  AI output keeps the existing strict structured score/feedback boundary and
  provider-failure recovery, while standalone result and history surfaces show
  the pedagogical score directly as 0-10 rather than only the normalized 0-100
  score.
- Authored word counts are learning targets, not submission gates. The shared
  policy maps the common 25-30 target to an approximately 6-70-word guidance
  range, never adds a textarea `maxLength`, and accepts answers outside either
  range. The server-owned AI prompt explicitly rewards a longer response when
  it is relevant, coherent and linguistically strong, but criticizes repetition,
  off-topic content, weak clarity or excessive errors when a long response is
  poor. Word count alone must never determine the score.
- Writing-specific CSS is scoped to stable feature hooks for opaque controls,
  keyboard focus, responsive tables and a lined student textarea, without
  changing the established Cambridge, Movers, vocabulary or grammar screens.
  The textarea uses an exact 32px text line-height and 32px ruled-paper repeat
  with a baseline offset, so typed text remains seated on the rule at every
  wrapped line. Result actions have explicit opaque violet/green/blue states;
  the student-facing review action is labelled `Xem Nhận Xét`.

## 82. Student alias digits and stable vocabulary name prompt - 2026-09-07

- The shared student display-name contract continues to normalize Unicode and
  whitespace, enforce the existing 2-20 character boundary and reject arbitrary
  punctuation, while allowing Unicode digits used in classroom aliases such as
  `trang 2a`. Client and backend use the same validator, so the accepted value
  cannot be rejected again when the guest profile is persisted.
- The vocabulary name prompt keeps its validation message inside the input
  field column, with an accessible error relationship. The message therefore
  renders below the input instead of becoming a narrow flex column between the
  input and `Bắt đầu chơi`; mobile keeps a full-width action.

## 83. Student exercise entry hot path - 2026-09-08

Scope and observed cause:

- Production tracing showed that the vocabulary player eagerly downloaded the
  complete public leaderboard feed (about 17 MB in the measured database) even
  though the student had not opened the leaderboard. That response also entered
  the read-only legacy aggregation branch when the durable read-model marker was
  absent. This request was independent of lesson content but competed for the
  same network/process/SQLite resources and made the exercise appear stuck.
- Vocabulary share-token resolution also scanned every assignment and then every
  vocabulary set. During that GET it could generate and persist a missing token,
  coupling a read path to writes. Guest identity misses additionally scanned
  historical activity tables, and direct exam players waited for the complete
  Firebase token plus `/api/me` profile lifecycle before requesting playable
  content. These serial/global dependencies explain why delay varied by database
  size, host cold state, browser session and network.

Storage and token resolution:

- Additive/idempotent SQLite migration `student-entry-hot-path-v1` adds physical
  `share_token` columns to `assignments` and `vocab_sets`, copies only existing
  `shareToken`/`assignmentSlug` values from each record's `data_json`, and creates
  `idx_assignments_share_token` plus `idx_vocab_sets_share_token`. It neither
  invents tokens nor updates/deletes source JSON/history records. Non-unique
  indexes keep startup fail-safe for unexpected legacy collisions; the resolver
  rejects an ambiguous two-row match instead of selecting arbitrary content.
- The SQLite query map projects both `shareToken` and the legacy
  `assignmentSlug` alias onto the indexed column. Firestore keeps a bounded
  canonical query with one legacy-field fallback. Known assignment/set IDs still
  use point reads. `resolveVocabLearningAccess` no longer performs collection
  scans or calls `ensureAssignmentShareToken`, and `GET
  /api/vocab-sets/share/:token` now emits phase-level `Server-Timing`.
- Resource writes keep the physical token column synchronized. Archiving already
  removes token fields through the shared lifecycle contract, so the normalized
  column becomes NULL on the same upsert and revoked links cannot resolve.

Guest identity and auth/content concurrency:

- `guest_profiles/{guestId}` is the only normal identity lookup. Legacy
  `game_sessions`/`grammar_attempts` scans were removed from request paths; the
  existing explicit hot-read-model maintenance command remains the migration
  boundary. A freshly generated browser guest ID is marked locally as new, so
  the first exercise skips an expected identify 404 and opens the name form
  immediately. Resolve/identify routes emit `Server-Timing`.
- `AuthContext` exposes `authSessionKnown` separately from its full profile
  `loading` state. `App` releases direct private vocabulary/grammar and direct
  exam routes from the global `/api/me` render boundary. Generic Writing/exam,
  Listening and Movers players request playable content immediately and resolve
  identity in parallel; signed-in users still wait for verified auth before a
  run can start. Firebase display name may render the pre-start view while the
  canonical backend profile finishes. Name-submit buttons have an explicit
  in-flight state where implemented, preventing duplicate profile requests.

Leaderboard boundary:

- `StudentLearningArea` no longer requests `/api/public/leaderboard-results` on
  mount. The collapsed `Xem bảng vàng` control calls the new bounded endpoint
  `GET /api/public/leaderboard-summary?period=week|month&classId=...&limit=8`
  only on demand. The server pseudonymizes retained read-model events before
  aggregation and returns only ranked entries plus class filter options, with a
  30-second in-process/browser cache capped at 100 filter keys. Result writes
  invalidate the process cache.
- The summary endpoint is deliberately read-model-only. If
  `settings/leaderboard-read-model-v1` is not `ready=true, version=1`, it returns
  `503 LEADERBOARD_NOT_READY`; it never falls back to multi-table legacy scans.
  The lesson itself remains usable and only the optional leaderboard displays
  the preparation message. Existing full leaderboard endpoints remain for
  backward-compatible Home/Admin consumers and are not on the player critical
  path.

Rollout and verification:

- Production sequence remains mandatory: stop/quiesce writers; create and verify
  a backup; run storage preflight and `npm run db:backfill-hot-read-models --
  --db <path>` in dry-run mode; start the new bundle once to apply the additive
  `student-entry-hot-path-v1` schema migration; execute the explicit hot-read
  backfill against the quiesced database; verify zero missing rows and the
  readiness marker; restart; then inspect share/identity/summary
  `Server-Timing` plus slow-query logs. Never set the marker manually or run the
  execute backfill against active writers.
- Local gates after implementation: TypeScript lint passes; performance tests
  pass 11/11 including real SQL.js query plans for both new token indexes;
  identity tests pass 8/8; exam-platform tests pass 75/75; and the canonical Vite
  plus bundled-server build succeeds. The generated entry artifacts are
  `index-B-CCdwS-.js`, `index-BoFC8M7w.css`,
  `StudentLearningArea-D9AtPiMs.js`, `clientRegistry-BHEIhvot.js` and
  `dist/server.cjs`.
- The expanded `test:phase1` run passed every portable suite through the full
  75/75 exam-platform group, then stopped at native storage for the already
  documented environment mismatch: active Node 24 uses ABI 137 while the pinned
  production-target `better-sqlite3` binary uses Node 22 ABI 127. The native
  module was deliberately not rebuilt under Node 24. Run the remaining native
  storage/startup gates under release Node 22 before deployment. No production
  database, host process, commit or push was changed by this implementation pass.

## 84. Vocabulary board-game generated-audio routing - 2026-09-08

- `MemoryGame.tsx` and `MatchingGame.tsx` previously called
  `speakEnglish(card.text)` directly when an English term card was selected.
  That legacy call always entered browser Web Speech and therefore ignored a
  teacher-generated `VocabItem.audioUrl` even though the student vocabulary
  payload already retained `audioUrl`, `ttsProvider`, and `ttsSpeed`.
- Both games now build a memoized lookup from stable item ID to the original
  `VocabItem` and call `playVocabAudio(item, card.text)`. Generated AI33/YupVox
  audio is the primary path, saved YupVox playback speed is respected, and the
  existing Web Speech behavior remains the final fallback when the item/audio
  URL is missing or browser playback rejects the MP3.
- This is a client call-site correction only. It changes no vocabulary schema,
  persistence, student API, TTS generation endpoint, scoring rule, game order,
  mute behavior, or production audio storage.
- `VocabBoardAudio.contract.test.ts` covers both board games and is part of
  `npm run test:vocab-games`. Verification for this pass: TypeScript lint passes;
  vocabulary game tests pass 12/12; YupVox tests pass 5/5; the canonical build
  succeeds; and generated chunks `MatchingGame-CWvY_qsD.js` plus
  `MemoryGame-Cfm5OuFj.js` import and invoke the shared player from
  `speech-C25ltOH8.js` with the original item resolved by `card.itemId`.

## 85. Vocabulary fill keyboard flow and matching selection state - 2026-09-08

- `FillBlankGame.tsx` keeps its existing form submit and `handleNext` authorities.
  Enter in the active input checks an answer through `handleCheckAnswer`; once
  feedback is rendered, focus moves to the existing continue/result button so
  the browser's native Enter activation calls `handleNext`. On a non-final
  question, answer state resets and focus returns to the newly enabled input.
- This focus-driven implementation deliberately avoids a `window` keydown
  listener. Enter therefore cannot silently advance a question while focus is
  intentionally on the pronunciation button, game controls, or another
  interactive element. The feedback pronunciation and continue buttons also
  have explicit `type="button"` semantics.
- `MatchingGame.tsx` changes only the first-card presentation from indigo to
  light amber (`amber-50` with `amber-400` border/ring). Existing state priority
  remains selected, failed, then matched; successful/failed selection code clears
  `selectedCard` before the emerald/rose state is rendered, so correct pairs stay
  green and incorrect pairs stay temporarily red exactly as before.
- No scoring, answer persistence, session action, navigation, audio, API or data
  contract changed. `VocabGameInteraction.contract.test.ts` is included in
  `npm run test:vocab-games` and protects the keyboard-focus boundary plus all
  three matching colors. Verification: TypeScript lint passes, vocabulary game
  tests pass 12/12, the canonical build succeeds, and generated chunks
  `FillBlankGame-D5dwMZNs.js` and `MatchingGame-CWvY_qsD.js` contain the expected
  focus and amber/rose/emerald presentation paths.

## 86. Fill Blank typed-only answer entry - 2026-09-10

- Scope is limited to the student answer input in `FillBlankGame.tsx`; Writing,
  grammar, Listening and exam-platform answer controls are unchanged.
- Normal typing continues through the controlled input `onChange`, including
  browser composition used by physical keyboards, software keyboards and input
  methods. Clipboard paste is canceled with `onPaste`; dragged text is canceled
  with `onDrop`; and `beforeinput` also rejects the browser insertion types
  `insertFromPaste`, `insertFromPasteAsQuotation`, `insertFromDrop`, and
  `insertFromYank`. The implementation does not block all `beforeinput` events,
  because doing so would also break legitimate typing/composition.
- A blocked insertion does not clear text already typed. The input is refocused
  and an accessible `role="alert"` message asks the learner to type the answer;
  the message clears on the next genuine typed change or question transition.
- This is a browser interaction restriction, not a server-verifiable anti-cheat
  guarantee: a learner with developer tooling can still alter client state. No
  answer normalization, grading, session action, history, API, storage or schema
  contract changed.
- `VocabGameInteraction.contract.test.ts` protects the paste/drop/beforeinput
  handlers, the preserved typed `onChange` path and the visible alert. Local
  verification: TypeScript lint passes, vocabulary game tests pass 13/13, and
  the canonical build succeeds with `FillBlankGame-D5dwMZNs.js` containing the
  typed-only interaction boundary.

## 87. Standalone Writing typed-only answer entry - 2026-09-10

- The typed-only boundary now applies to the actual standalone Writing student
  textarea in `StandaloneWritingViews.tsx`. The earlier Fill Blank boundary did
  not cover `/writing/:setId`, which is why pasted text was still accepted in a
  private Writing assignment after that change.
- Normal keyboard typing and composition continue through the controlled
  `onChange` path. Clipboard paste, dragged text, paste-as-quotation and yank
  insertion are canceled through `paste`, `drop` and narrowly scoped
  `beforeinput` handlers. Existing typed text is preserved, focus remains in the
  answer field, and an accessible warning explains that the learner must type.
- This changes no word-count flexibility, autosaved answer state, submission,
  AI grading, attempt/history data, API or storage schema. It is a browser-side
  deterrent rather than a server-verifiable anti-cheat guarantee; developer
  tools can still alter client state.
- Private links keep the canonical `/writing/:setId?accessToken=...` form. The
  route parser already forwards the complete token to playable and prepare
  requests; a regression case now explicitly protects URL-safe tokens ending in
  `-` without recording a real assignment token.
- `examPlatform.contract.test.ts` protects the Writing-only input handlers and
  visible alert. `registry.test.ts` protects the private Writing route/token
  round trip. Local verification: TypeScript lint passes; the complete
  exam-platform suite passes 75/75; the canonical production build succeeds;
  the generated Writing player is in `clientRegistry-BjjsMsoi.js`; and the
  restarted `dev:local` server returns HTTP 200 while serving the new typed-only
  source boundary.

## 88. Absolute private exam links for existing sets - 2026-09-10

- Generic exam admin rows previously copied the canonical relative route such
  as `/writing/:setId?accessToken=...`. That route works inside the app but is
  incomplete when pasted into a message outside the site.
- The shared route helper now resolves the canonical path against
  `window.location.origin` before it reaches `LibraryLinkStatus` or the
  clipboard. Production therefore copies a complete
  `https://app.msdieu.com/writing/:setId?accessToken=...` URL, while localhost
  automatically uses `http://localhost:3000`.
- This is computed at copy time and therefore fixes existing and new sets
  without a database migration, republish or token change. The `accessToken`
  query remains mandatory for assignment-only access, and URL-safe tokens may
  validly end in `-`.
- Play navigation continues to use the canonical app path. No visibility,
  ownership, published version, attempt, result, token persistence or access
  validation behavior changed. Verification: TypeScript lint passes; the route
  and admin contracts pass 24/24; the complete exam-platform suite passes
  75/75; and the canonical build succeeds with the updated admin path in
  `GenericExamAdmin-CFbqGhtc.js`.

## 89. Stable actor mode for exam attempt submission - 2026-09-10

- Generic exam tickets already contain a server-signed `ownerKey` and a hash of
  the per-run secret. The player previously selected its optional Authorization
  header from the browser's current auth state on every request. A guest run
  could therefore be submitted as `user:*` if a login appeared later, or an
  authenticated run could fall through as `guest:*` after auth changed; the
  backend correctly rejected either transition as an owner mismatch.
- `examRunIdentity.ts` reads only the actor kind (`guest` or `authenticated`)
  from the ticket payload and pins renew, submit and post-submit review to that
  mode. Guest runs omit a bearer token even if one appears later; authenticated
  runs continue using the latest current bearer token. Existing saved tickets
  need no migration because actor kind is derived from their signed payload.
- After ticket signature validation, the exam router applies the same pinning
  when resolving the owner for renew, submit and learner review. This lets an
  already-open old client submit a guest ticket even if optional authentication
  later appears, while an authenticated ticket still resolves through the
  current account and must match its exact signed `user:*` owner.
- This client-side routing decision grants no authority. The backend continues
  to validate ticket signature, route/set/version, run-secret hash and exact
  owner. A malformed/unknown ticket never triggers a guest downgrade; changing
  from user A to user B, changing the guest ID, or mixing a ticket and secret
  from different tabs remains rejected.
- The change preserves current answers and retry state. It changes no private
  link token, database schema, grading, score, history or published content.
  Remaining real 401/403 responses are not auto-retried in a loop; the player
  tells the learner to keep the page and restore the original account before a
  manual submit retry instead of suggesting an immediate new run that would
  clear the visible answer.
  `examRunIdentity.test.ts` covers guest-to-auth drift, authenticated token
  refresh and malformed/unknown tickets; the exam-platform contract protects
  all renew/submit/review call sites. Router integration covers a guest ticket
  with a later bearer identity and still rejects account A → account B.
- Verification after both client and router changes: TypeScript lint passes;
  the complete exam-platform suite passes 78/78; and the canonical client plus
  bundled-server build succeeds. The generated exam player is in
  `clientRegistry-BP8rIS5Z.js`, the link-management UI is in
  `GenericExamAdmin-unYoGukm.js`, and the server authority is in
  `dist/server.cjs`.

## 90. Vietnamese Writing feedback contract - 2026-09-10

- The standalone Writing result heading is `Nhận Xét Chung`; the grammar and
  vocabulary headings remain `Ngữ pháp cần lưu ý` and `Từ vựng cần lưu ý`.
- `writingGradingProvider.ts` now requires the overall feedback and every
  grammar/vocabulary note to be natural Vietnamese with Vietnamese diacritics.
  Exact English mistakes and corrected English examples may remain in quotation
  marks so learners can compare them, but explanatory prose cannot be
  English-only. This provider-level contract is shared by standalone Writing
  and KET Reading & Writing Part 9.
- Language requirements are present in the provider system instruction, the
  user prompt and the strict JSON-schema descriptions. Provider output remains
  untrusted: runtime validation rejects English-only feedback or list items and
  makes the existing bounded second request to the same selected provider. It
  never silently falls back to another provider. Empty grammar/vocabulary arrays
  remain valid when no notable issue exists.
- Previously stored attempts are unchanged and continue to render their original
  feedback; a new grading/retry is required to generate Vietnamese feedback for
  an old attempt. No attempt, history, published-content or database schema was
  migrated.
- Verification: TypeScript lint passes; the complete exam-platform suite passes
  82/82 including prompt, runtime-language, same-provider retry, router and UI
  contracts; and the canonical production build succeeds. The generated Writing
  result UI is in `clientRegistry-BGRBePH6.js`, while the Vietnamese grading
  contract is bundled in `dist/server.cjs`.

## 91. Teacher library Play opens an isolated tab - 2026-09-11

- The five-action library row keeps `Play`, `Sửa`, `Sao chép`, `Kết quả`, and
  `Xóa` in the same order. Only `Play` is now a native anchor with
  `target="_blank"` and `rel="noopener noreferrer"`; the other four actions
  remain buttons with their existing callbacks. A disabled Play remains a
  disabled button, so unpublished exam sets cannot bypass the current rule.
- Listening, Movers Reading & Writing, standalone Writing, and every generic
  exam module reuse their existing stable student/share preview URL. No share
  token, assignment URL, publication policy, result action, or title-click
  behavior changed.
- Vocabulary and grammar previously depended on in-memory dashboard state, so
  they now use stable authenticated routes
  `/teacher-preview/vocabulary/:setId` and
  `/teacher-preview/grammar/:setId`. `TeacherLibraryPreview.tsx` point-loads
  exactly one set with the current bearer token and renders the existing
  student learning component in the new tab. The browser's existing login
  session is reused; there is no second login in the normal teacher flow.
- The matching backend point-read endpoints are staff-only, owner-scoped, hide
  a cross-owner set behind 404, reject archived records, and perform no write.
  Vocabulary preview responses continue to strip private filesystem audio
  paths. This adds no database field, migration, public content endpoint, or
  student authorization path.
- Regression coverage renders the shared action component to prove that Play
  alone is a safe new-tab link, checks every library call site, protects route
  parsing, and verifies the API authentication/ownership contract. Local
  verification: TypeScript lint passes; security 15/15, grammar 13/13,
  vocabulary games 13/13, Listening 139/139, Movers Reading & Writing 26/26,
  and exam platform 82/82 pass; the canonical production build succeeds. The
  generated preview chunk is `TeacherLibraryPreview-CGVOB-sA.js`, the shared
  actions are in `LibraryRowControls-D8Q9Jy9k.js`, and backend enforcement is
  bundled in `dist/server.cjs`. The native legacy integration file includes the
  owner/cross-owner endpoint cases, but cannot start under this workstation's
  active Node 24 ABI 137 because `better-sqlite3` is the production-baseline
  Node 22 ABI 127 build; it must be run in the documented Node 22 release lane.

## 92. Interaction-safe exam image coordinates and explicit zoom - 2026-09-11

- `ExamImageViewer` now distinguishes ordinary viewing from an
  `answer-surface`. Ordinary question/reference images keep the existing
  double-click and keyboard zoom behavior. Interactive answer images never use
  stage double-click zoom, never show a zoom cursor, and expose one explicit
  `Phóng to ảnh` button below and outside the answer surface instead.
- Answer surfaces also ignore `fillFrame`, so their stage shrink-wraps the
  rendered image rather than a larger responsive frame. Answer handlers keep
  their established click sequence: a later click may clear, replace or move
  an answer according to that exercise's existing rules. This deliberately
  preserves the observed double-click-to-remove behavior in legacy placement
  and colour tasks; only the unrelated image-zoom reaction is removed.
- `imageCoordinates.ts` is the shared coordinate boundary. It derives the
  actual rendered image content rectangle from the image element, intrinsic
  dimensions and `object-contain` scale, then converts pointer coordinates to
  normalized 0..1 image coordinates. Pointer events in letterbox padding are
  ignored for students and clamped to the nearest image edge while teachers
  author or drag regions. The inverse helper
  `examImageContentRectInStage(...)` projects stored normalized coordinates
  back into that exact same pixel rectangle.
- `ExamImageViewer` mounts every answer overlay (SVG lines, hitboxes, colour
  masks, placed objects and image-entry fields) in a dedicated
  `data-exam-image-content-layer`. The layer is offset and sized to the real
  image pixels, not the possibly letterboxed `<img>` element box, and is kept
  synchronized by `ResizeObserver` plus the window-resize fallback. This fixes
  the remaining curved-mirror-like drift where pointer input already used the
  contained image but overlays still used the full stage.
- Listening Part 1/3/5 and generic Starters matching, colour, draw and
  image-entry interactions opt into the answer-surface mode. Direct matching
  and placement coordinates use the inline image ref rather than the outer
  frame. `ListeningRegionEditor` and `FixedRegionEditor` use the same helper,
  so authored regions and student hit-testing share one coordinate system at
  every responsive size.
- Stored regions from both old and new exercises remain normalized coordinates
  and require no content or database migration. The authoring surfaces before
  this fix also stored coordinates against the displayed image itself, so old
  regions become aligned as soon as the corrected player is deployed. Region
  sizes, scoring, answer schemas and ordinary image presentation are unchanged.
- Regression coverage includes a letterboxed 600x400 element containing a
  2:1 image, verifies exact center mapping, rejects padding clicks, protects
  the authoring/player shared helper, and limits answer-surface mode to the
  intended interactive call sites. It additionally round-trips one unchanged
  legacy normalized point through both a portrait image with horizontal
  letterboxing and a landscape image with vertical letterboxing. Local
  verification: TypeScript lint passes; Listening passes 139/139; exam platform
  passes 86/86; and Movers Reading & Writing passes 26/26. The canonical
  production build succeeds; shared coordinate projection is emitted in
  `imageCoordinates-CmDxKtti.js` and the updated player/viewer bundle is
  `clientRegistry-BW_bGxxE.js`.

## 93. Durable asynchronous Writing grading - 2026-09-11

- Submitting an AI-enabled Writing answer now persists the immutable attempt,
  answer detail and grading queue state before returning. The submit endpoint
  responds immediately with `pending_review` + `queued`; it no longer keeps the
  student's HTTP request open while Stali/DevQuota grades the essay.
- Queue state is stored on the existing `exam_attempts` document (`cycle`,
  provider-attempt number, status, retry eligibility, cooldown and a private
  lease). This is a persistent job without a new table or schema migration.
  A startup/periodic recovery scan resumes queued work and reclaims an expired
  `processing`/`retrying` lease after a server restart. Public attempt summaries
  remove the private lease token and expiry.
- One grading cycle makes at most two HTTP requests to the explicitly selected
  provider. Transient network/timeout/408/425/429/5xx errors and invalid grading
  contracts receive one same-provider retry; configuration, authentication,
  unsupported-provider and unsafe-input errors stop immediately. There is no
  silent provider fallback. Each provider request has a 60-second timeout.
- After both bounded requests fail transiently, the attempt remains
  `pending_review`, the original answer remains unchanged, and the learner sees
  a safe overload message. The server enforces a five-minute cooldown before
  the authenticated owner can press `Chấm lại`. That action increments the
  grading cycle on the same attempt/version/essay; it never creates a second
  learning attempt. Permanent failures stay teacher-only for retry/configuration
  repair or manual grading.
- Student polling uses a narrow owner-protected status endpoint. Guest access
  requires the exact guest identity plus run secret; authenticated runs require
  their original account. Polls do not touch guest activity. The pending result
  and run credential stay in local storage, so reloading the tab while grading
  restores the same status screen. On success, standalone Writing loads the
  Vietnamese review automatically. While queued, processing or automatically
  retrying, the learner sees one friendly delivery message and no provider
  attempt counter or duplicated technical `aiGradingMessage`; those operational
  details remain available to the backend and teacher dashboard.
- The learner retry action has explicit feature-scoped styling for every state:
  cooldown/loading stays disabled with a pale amber background and dark text;
  after cooldown, the enabled `Chấm lại` action switches to an opaque dark-amber
  background with white text, plus a darker hover state. Both states disable the
  legacy global glass/blur treatment and meet WCAG AA instead of relying on
  Tailwind utility classes that global `!important` selectors can override.
- Teacher result rows distinguish queued, first request, automatic retry and
  failure, refresh while a job is active, and keep manual grading available.
  Per-attempt locking plus cycle/lease checks prevent a stale AI worker from
  overwriting a teacher grade in the same process.
- Failure logs contain only safe transport diagnostics (error name/message and
  nested cause code/message), provider ID and attempt ID. They expose neither
  API keys nor the student's essay, while making DNS/TLS/socket/permission
  failures distinguishable from a slow provider response.
- Regression coverage verifies immediate queued submission, protected status
  reads, background completion, transient failure, enforced cooldown, same-ID
  learner retry, maximum-two provider calls, no retry for HTTP 401, and the
  updated UI contracts. No answer, published set, learning-history schema or
  score formula changed.
- Verification: TypeScript lint passes; security passes 15/15; the complete
  exam-platform suite passes 86/86; and the canonical production build
  succeeds. The updated learner flow is emitted in
  `clientRegistry-B4FU7Re9.js`, the live teacher statuses are in
  `GenericExamAdmin-Cuxq3uRa.js`, the retry-button contrast is emitted in
  `index-BNpUlfNl.css`, and the persistent worker/provider policy is bundled in
  `dist/server.cjs`.

## 94. Managed vocabulary image provider pipeline - 2026-09-14

- Vocabulary images now follow a server-owned search, review, import and attach
  pipeline instead of persisting provider hotlinks. `VocabItem` has optional
  `imageAssetId`, `imageUrl`, `imageAttribution` and `imageAttachedAt` fields.
  Images remain optional and were not added to any game's `requiredFields`, so
  every existing set and every no-image learning flow remains playable.
- The backend implementation is isolated under `src/server/vocab-images/`.
  Wikimedia Commons is always available; Pixabay and Pexels appear only when
  their backend-only `PIXABAY_API_KEY` or `PEXELS_API_KEY` is configured. A
  request always names one provider and never silently falls back to another.
  Search results preserve title, author, license and source-page attribution;
  the private provider download URL is removed before candidates reach the
  browser. Pixabay search results use a 24-hour bounded in-process query cache.
- `GET /api/image-library/providers`, `GET /api/image-library/search`,
  `POST /api/image-library/batch-preview`, `POST /api/image-library/import` and
  `POST /api/image-library/batch-import` are authenticated staff-only routes
  behind a weighted fixed-window limit. Batch preview/import accepts at most
  100 rows with bounded concurrency and returns failures per row, so one
  provider error does not discard successful or pre-existing row state. Import
  and batch import write audit-log actions. `GET
  /api/vocab-sets/:id/images/status` is owner-scoped in the same manner as the
  existing TTS status endpoint.
- Search and import are deliberately separate. Candidate thumbnails may be
  shown from the selected provider during review; the selected provider and
  immutable external ID are then sent to the import endpoint. The backend
  resolves that ID again, downloads it and never trusts a browser-supplied
  source/download URL or attribution object.
- Provider downloads require HTTPS and an adapter-specific hostname allowlist.
  Every initial URL and redirect is revalidated, DNS results cannot resolve to
  loopback/private/link-local/special networks, redirects are bounded, and the
  response is subject to timeout, byte-size, MIME and magic-byte checks. Only
  JPEG, PNG, WebP and GIF are accepted; SVG is excluded from Wikimedia search
  candidates and rejected at download time. Files are written through a
  temporary file plus atomic rename and named by SHA-256.
- Imported files live under `VOCAB_IMAGE_DIR` and are served as immutable
  `/vocab-images/{sha256}.{ext}` resources. Production startup fails closed if
  `VOCAB_IMAGE_DIR` is absent; development falls back to
  `.data/vocab-images`. `.env.example` documents the persistent path, optional
  provider keys, download/search deadlines, byte cap and batch concurrency.
  Binary bytes never enter SQLite or Firestore.
- SQLite migration `vocab-image-assets-v1` additively creates the
  `vocab_image_assets` table plus provider/external-ID, SHA and creator indexes.
  The document facade stores full attribution/storage metadata in `data_json`
  and query columns, while `vocab_items` continues to carry only the selected
  item reference in its existing JSON payload. No table, row, legacy image or
  asset file is removed automatically. Asset reclamation remains a future
  explicit dry-run/quarantine maintenance task.
- Vocabulary create/update now resolves every non-empty `imageAssetId` from
  `vocab_image_assets` and supplies the canonical managed URL and attribution
  server-side. A missing or malformed asset is rejected, and a new arbitrary
  external `imageUrl` cannot be added directly. An unchanged image URL that was
  already stored before this pipeline remains readable/saveable for backward
  compatibility. Removing an image only detaches its item fields; it never
  deletes the shared asset. Cloning an existing set may keep the same validated
  immutable asset reference.
- `AdminDashboard` delegates image UI to
  `src/components/admin/vocab-images/`. The vocabulary table has a 72x72
  non-cropping thumbnail with find/replace/remove controls. The per-word dialog
  uses 96x96 candidates with source metadata. Batch review requests three
  candidates per non-empty term, preselects the first candidate for convenience
  but performs no download until the teacher confirms, and lets a teacher skip
  individual words. Partial import failures keep their row visible for retry.
  Changing the English term detaches stale image fields as well as stale TTS
  fields to prevent semantic mismatch.
- Student display is centralized in `VocabItemImage.tsx`: a square white/light
  `object-contain` frame at 128x128 on narrow screens and 160x160 from desktop,
  a neutral pre-answer alt label and a compact `Nguồn ảnh` attribution link.
  Broken image URLs fail closed without breaking the game. The existing
  Millionaire crop was replaced by this same non-cropping frame.
- Game timing is explicit in `gameList.ts`. Flashcard English→Vietnamese and
  Vietnamese→English show the image on the prompt face; sound flashcards show
  it only after flip. Text quizzes show it with the prompt, while sound quiz
  reveals it only after an answer. Both fill games show it in the question
  card. Millionaire shows it with the term. Matching, Memory and Speaking AI
  intentionally render no image because an image would either reveal pair
  identity, overload a dense board or distract from pronunciation.
- Regression coverage is split across provider adapters, SSRF/download
  security, content-addressed storage, authoritative save resolution, additive
  SQLite storage, staff/API contracts, editor workflow and the game matrix.
  Local verification: TypeScript lint passes; vocabulary games pass 16/16;
  vocabulary image tests pass 19/19; security passes 15/15; and Vite plus the
  bundled Express server build successfully into a disposable temporary output
  directory without touching tracked `dist`. The repository-wide storage suite
  cannot load this workstation's Node-22 ABI-127 `better-sqlite3` binary under
  the active Node-24 ABI-137 shell; the new migration itself passes through the
  explicit `sql.js` rollback driver and the native storage suite remains a Node
  22 release-lane check.

## 95. KET Reading & Writing Part 5 example and Part 8 image-led layout - 2026-09-14

- KET Reading & Writing Part 5 now models its unscored printed example as a
  choice row: the printed example number, three public A/B/C option texts and
  the official answer label. `ExamDisplayExample.options` is optional so every
  released module and legacy example remains readable. Universal Import parses
  the optional choices instead of discarding them, while Part 5 publish
  validation requires exactly A/B/C plus one matching official answer.
- The KET import prompt no longer asks the model to reconstruct the Part 5
  sentence already visible in the teacher-owned image. Its schema example and
  explicit Schnauzer regression case map official-key row `0` to A `with`, B
  `of`, C `in`, answer `B`. The Part 5 authoring surface exposes those same
  fields; live attempt and detailed review render the example as an A/B/C row.
  Existing examples without structured choices still use the prior text
  fallback until a teacher reviews or re-imports that Part.
- KET Reading & Writing Part 8 no longer exposes the duplicate `Nội dung hướng
  dẫn và example dạng chữ hiển thị phía trên` editor. Universal Import is told
  not to return `content.passage`, and publish validation no longer requires
  it. The teacher-owned image remains mandatory; question number, form label,
  optional prefix and accepted answer remain normal editable JSON/form data.
- Part 8 live attempt and detailed review now share the KET split presentation:
  the image is on the left and the form/result rows are on the right at the
  existing responsive 44/56 desktop ratio, collapsing naturally on narrow
  screens. Neither surface renders a duplicate text-source/example block.
- No database schema, stored answer, grading rule, image ownership or released
  content was rewritten. Focused regression coverage verifies the structured
  Part 5 import/prompt/UI contract, rejects the former sentence-only Part 5
  example at publish time, preserves the Part 8 teacher image across JSON
  import and permits Part 8 without `passage`. TypeScript lint and the complete
  exam-platform suite pass (86/86).

## 96. Wikimedia Commons thumbnail-host boundary - 2026-09-15

- Wikimedia search metadata serves normal resized JPEG/PNG previews from
  `thumb.wikimedia.org`, while original files remain on
  `upload.wikimedia.org`. The vocabulary image provider previously reused the
  original-download allowlist for preview filtering, so valid raster candidates
  such as `Red Apple` were silently removed even though the upstream API
  returned HTTP 200. Unscaled GIF previews happened to survive, which made the
  failure appear query-dependent.
- `VocabImageProvider` now owns separate `allowedPreviewHosts` and
  `allowedDownloadHosts`. Wikimedia previews allow the exact official
  `thumb.wikimedia.org` and `upload.wikimedia.org` hosts, while secure imports
  remain restricted to originals on `upload.wikimedia.org`. Pixabay and Pexels
  declare their existing preview hosts explicitly. Source-page and secure
  download validation are unchanged.
- The local `fetch failed` observed before this fix had a separate environment
  cause: the sandboxed development process received outbound TCP `EACCES`.
  Running `npm run dev:local` with outbound access returned Wikimedia HTTP 200;
  the real localhost batch endpoint then returned three candidates each for
  `apple` and `book` after the preview allowlist correction.
- Regression fixtures now use the real Wikimedia split-host shape and protect
  the narrower download boundary. Verification: TypeScript lint passes;
  vocabulary image tests pass 19/19; exam-platform tests pass 86/86; the live
  batch-preview endpoint succeeds; and both the Vite client and bundled Express
  server build successfully into a disposable output directory.

## 97. Pixabay/Pexels activation and Vietnamese batch balancing - 2026-09-15

- Pixabay and Pexels remain optional backend-only providers under the existing
  managed vocabulary image pipeline. `PIXABAY_API_KEY` is sent only by the
  Pixabay server adapter; `PEXELS_API_KEY` is sent only in Pexels' backend
  `Authorization` header. The browser continues to submit only a provider ID
  plus the immutable external image ID, and never receives the provider's
  private download URL or either credential.
- Pixabay search now enforces the documented 100-character query boundary,
  `safesearch=true` and `image_type=all`; it sends `lang=vi` or `lang=en` from
  the reviewed search language. Pexels likewise sends `locale=vi-VN` or
  `locale=en-US` and prefers the bounded `large2x` rendition for managed
  import. Both adapters reject non-numeric external IDs before making an
  upstream request.
- Search caching is 24 hours for both quota-backed providers. Wikimedia keeps
  its shorter five-minute cache. The cache is bounded in-process and does not
  change the import rule: every selected external ID is resolved again by the
  backend before download and storage.
- Both teacher review dialogs now list all registered sources. Unconfigured
  providers stay visible but disabled with a clear backend-configuration note,
  while configured providers remain selectable for per-word and batch review.
  `.env.example` documents the two official key sources and restart boundary;
  real credentials remain outside source control.
- Per-word review defaults to the item's Vietnamese `meaning` and exposes an
  explicit Vietnamese/English language switch. Batch review carries both
  `term` and `meaning`; the server prefers the Vietnamese meaning and falls
  back to the English term only when no meaning exists. The review card shows
  the exact query, language and provider used.
- Batches above ten rows default to the explicit `auto` strategy. Work is
  bounded by the existing concurrency limit and rotated across configured
  Wikimedia, Pixabay and Pexels adapters. A provider returning HTTP 429 enters
  a bounded cooldown (honouring `Retry-After` when supplied); only in this
  teacher-selected auto strategy may the row try the next configured source.
  Direct provider searches never silently fall back.
- Verification with local backend keys: TypeScript lint passes and vocabulary
  image tests pass 23/23, including credential transport, adaptive locale,
  malformed-ID rejection, Pexels cache expiry, Vietnamese query selection,
  automatic provider balancing and 429 cooldown. A live UTF-8 batch of 12
  vocabulary rows returned candidates for all rows at concurrency 3: Pixabay
  reported upstream HTTP 429, so the completed rows were served by Wikimedia
  (4) and Pexels (8). A selected Pexels candidate then resolved, downloaded and
  served from managed storage as HTTP 200 `image/webp` with author and licence
  metadata. The local key file remains untracked and no key value was logged.

## 98. Vocabulary image relevance, pagination and same-origin previews - 2026-09-16

- This section supersedes the default query and auto-provider behaviour recorded
  in section 97. Pixabay's official API documentation sets a default limit of
  100 requests per 60 seconds per key, requires 24-hour response caching and
  says the API is intended for human searches rather than systematic mass
  downloads. Pixabay therefore remains available in the single-word picker but
  is disabled and rejected for batch preview. A provider HTTP 429 starts a
  bounded local cooldown so repeated clicks do not keep spending upstream
  quota. Automatic batch work now rotates only across configured Pexels and
  Wikimedia adapters.
- Flashcard search now defaults to the English vocabulary term and carries the
  part of speech. Pexels/Pixabay receive a provider-appropriate visual qualifier
  such as `car isolated on white background`; verbs and adjectives use action
  or visual-concept qualifiers. Wikimedia keeps the exact term because Commons
  full-text search performs poorly with stock-photo qualifiers. Pexels requests
  square, medium-or-larger photos; Pixabay requests at least 800x600 horizontal
  images. The server fetches a bounded wider candidate pool, rejects avoidably
  small images when alternatives exist, then ranks title overlap, resolution,
  near-square composition and noisy `toy`/`poster`/`logo` metadata before
  returning the requested candidates.
- Provider adapters and the search cache are page-aware. The per-word picker
  exposes previous/next result pages, and every batch row exposes `3 ảnh khác`.
  Page is part of the 24-hour Pexels/Pixabay cache key, so moving forward returns
  different candidates while repeated viewing of the same page does not spend
  another provider request. The exact optimized query and current page remain
  visible to the teacher.
- Review thumbnails no longer depend on the browser reaching provider CDNs.
  Search responses replace the upstream preview URL with a one-hour opaque
  same-origin `/api/image-library/preview/{handle}` capability. The public
  preview route is separately rate-limited, accepts only handles registered by
  a validated search result, reuses the existing HTTPS/hostname/DNS/redirect/
  MIME/magic-byte/size protections and caches validated bytes privately for 30
  minutes. Download URLs and API credentials remain server-only. Pixabay uses
  its smaller dedicated preview rendition to reduce CDN throttling; selected
  imports still resolve and download the full managed rendition.
- Candidate tiles are larger in both review dialogs. Student games continue to
  share one `object-contain` component, now 160x160 on narrow screens and
  192x192 on desktop. The inline `Nguồn ảnh ...` caption has been removed from
  the student card as requested; canonical author, licence and source-page
  metadata remains attached to the managed asset and visible in the teacher
  editor/review workflow.
- Live verification against localhost: optimized Pexels `car` search returned a
  14173x14173 white-background car as the first candidate; pages 1 and 2 had
  disjoint IDs; three same-origin thumbnails returned HTTP 200 JPEG. A 12-word
  transport batch completed 12/12 rows with no error and an exact 6 Pexels / 6
  Wikimedia split; the sample proxy thumbnail returned HTTP 200. The Pixabay
  key worked after its prior window reset, then returned HTTP 429 again on new
  uncached queries, confirming that it must stay out of automated batch work.
  TypeScript lint passes, vocabulary-image tests pass 27/27, vocabulary-game
  tests pass 16/16, and both Vite client and bundled Express production builds
  pass in a disposable output directory without modifying tracked `dist`.

## 99. Education-oriented vocabulary image preprocessing - 2026-09-16

- `src/server/vocab-images/searchStrategy.ts` is now the pure, testable boundary
  between a teacher's vocabulary term and an external provider request. It was
  designed for this repository after reviewing the separate IOE implementation;
  no IOE source, hotlink behaviour, cache policy or weaker download boundary was
  copied. The existing same-origin preview proxy, managed import, attribution,
  SSRF/DNS/redirect checks and student image contract remain unchanged.
- Flashcard searches classify a term as `object-illustration`, `vehicle`,
  `action`, `concept`, `map` or `photo`, then build a provider-specific plan.
  Examples include Pexels `car side view isolated studio`, Pixabay illustration
  filters, Wikimedia `Australia country map outline`, human-action queries for
  verbs and a physical-book query that avoids document-page ambiguity. Pixabay
  remains single-search only and outside automatic batches.
- Provider adapters accept a bounded structured filter object. Flashcard search
  fetches a wider pool of at most 30 metadata records in one upstream request,
  then applies semantic/title evidence, educational composition, dimensions,
  aspect ratio, visual style and explicit noise penalties. Watermarks, logos,
  collages, toys/models, scanned book pages, thematic maps, non-human action
  subjects and context-heavy vehicle photos are demoted or removed. Returned
  candidates expose only review metadata: optimized query, intent, 0-100 score,
  `excellent|good|usable` quality, visual style and short reasons; provider
  download URLs remain private.
- Concurrent identical searches now share one in-flight provider request.
  Pexels/Pixabay still retain the required 24-hour response cache, Wikimedia
  keeps five minutes, page remains part of the key, and cached results can still
  be reviewed while a provider is in cooldown. `VOCAB_IMAGE_SEARCH_STRATEGY_V2`
  is a server-runtime rollback switch; it defaults on and can be set to `false`
  without changing stored assets or vocabulary records.
- Teacher dialogs show the optimized query, score, quality, style, dimensions
  and scoring reasons. Weak candidates are not returned. Batch review only
  preselects `good` or `excellent` candidates; `usable` candidates remain visible
  for an explicit teacher decision and no image is downloaded before approval.
  Empty/unsuitable results in automatic mode try the next bulk-safe provider.
- Live localhost verification with the configured keys found all three provider
  registrations, while Pixabay again returned HTTP 429 and correctly stayed out
  of batch work. A 12-word batch completed 12/12 across Pexels and Wikimedia.
  Follow-up regressions from real results now reject an unrelated Australia
  photo, a model-boat project, archival book scans, decorative book concepts and
  a dog for the verb `run`; the matching country map and human running action
  remain recommendable. Verification passes: vocabulary-image tests 36/36,
  vocabulary-game tests 16/16, TypeScript lint and the production client/server
  build. No database migration, existing managed asset or released set changed.

## 100. Managed AI vocabulary images and Seedvis native generation - 2026-09-17

- This section supersedes the external-image search/review implementation in
  sections 96-99. Vocabulary authoring no longer calls Wikimedia Commons,
  Pixabay or Pexels and no longer exposes search, preview or external-import
  routes. Teachers can generate one image, generate a batch for review, upload
  a local file, or paste an image from the browser clipboard. Generated and
  uploaded files still enter the same content-addressed managed storage before
  a vocabulary item may reference them.
- `src/server/vocab-images/generationProviders.ts` is the private provider
  boundary. Stali uses exactly `req/gpt-image-2`, DevQuota uses exactly
  `gpt-image-2`, and Seedvis exposes exactly two choices: Google Nano Banana 2
  (`NARWHAL`) and Google Nano Banana Pro (`GEM_PIX_2`). Provider API keys never
  reach the browser. Seedvis uses its native `POST /developer/generations`
  lifecycle with one UUID idempotency key, `aspect_ratio: "4:3"`, `count: 1`,
  and follows the returned long-poll URL without resubmitting the paid job.
- A completed Seedvis output is accepted only from the exact official
  `cdn.seedvis.com` HTTPS boundary. It is then downloaded through the existing
  DNS/private-address/redirect/MIME/magic-byte/size checks and stored locally;
  the transient CDN URL is not saved into the vocabulary set. Generation and
  download have separate bounded timeouts, while batch work keeps bounded
  concurrency and automatic fallback across configured model choices.
- `src/server/vocab-images/generationPrompt.ts` owns one normalized prompt for
  all generation paths. It carries the exact English term, Vietnamese meaning
  as semantic context and part of speech, including the short `v` verb marker.
  It requests one child-friendly, school-safe, non-graphic 3D educational
  scene with a clear focal subject/action, full-frame 4:3 composition and no
  explanation, spelling, pronunciation, text, labels, watermark, border,
  collage, gap, card mock-up, multiple panels or stacked visual layers.
- The staff-only surface is `GET /api/image-library/providers`, `POST
  /api/image-library/generate`, `POST /api/image-library/batch-generate`, and
  `POST /api/image-library/upload`. `VocabImageGenerateDialog` lets a teacher
  choose an enabled model and approve a generated image. The batch dialog
  shows consistent 4:3 thumbnails and only attaches reviewed rows. Per-row
  controls remain `Tạo`, `Dán`, and `Tải`; clipboard/local images require the
  existing rights confirmation before upload.
- SQLite migration `vocab-image-providers-seedvis-v3` rebuilds only the image
  metadata table inside the startup migration transaction, copies every row,
  and expands the provider check for the two Seedvis IDs. Historical
  Wikimedia/Pixabay/Pexels metadata stays readable so existing released sets
  are not rewritten or broken. Configure the backend-only `SEEDVIS_API_KEY`
  and optional official `SEEDVIS_BASE_URL`, then restart the server.
- Verification passes: TypeScript lint; vocabulary-image tests 27/27;
  vocabulary-game tests 16/16; security tests 15/15; storage/migration tests
  5/5 under the repository's declared Node 22 runtime; and the complete Vite
  client plus bundled Express production build. Localhost returns all four
  generation choices with the exact model IDs. With no `SEEDVIS_API_KEY` in
  the local environment, both Seedvis choices remain visibly disabled and a
  direct request fails closed with HTTP 503 before any paid upstream request.
- Clipboard/local-upload intent is now implicit in the teacher clicking `Dán`
  or choosing a file: the application no longer opens a second rights-confirm
  dialog and always sends the existing server-side rights flag. The browser's
  own clipboard permission prompt cannot be suppressed by application code;
  it normally appears once per origin and remains the browser's security
  boundary on both localhost and hosted HTTPS domains.
- Raw provider transport exceptions are translated to an actionable HTTP 502
  message naming server DNS/firewall/outbound access instead of exposing
  `fetch failed`. The screenshot failure was reproduced only while the local
  dev process was sandboxed from outbound TCP. After restarting localhost with
  outbound access, real end-to-end `book` generations succeeded through Stali
  `req/gpt-image-2` in 40.9 seconds and DevQuota `gpt-image-2` in 43.2 seconds.
  Both managed results serve as HTTP 200 `image/png`. Final verification passes
  TypeScript lint, vocabulary-image tests 28/28 and the production build.
- A later DevQuota response with `type: upstream_error` and request ID
  `20260917...` was diagnosed against both configured gateways. Each `/models`
  endpoint returned HTTP 200 and still listed its exact requested model. A
  rejected diagnostic request showed that DevQuota owns this timestamped
  request-ID format, whereas Stali returns a different error contract. The
  failure is therefore inside DevQuota's downstream `gpt-image-2` channel, not
  browser JSON, authentication, model spelling or local managed storage.
  Provider JSON errors are now unwrapped into one readable message prefixed by
  the provider label while retaining the upstream request ID for support. No
  automatic retry is issued for an explicitly selected paid provider.

## 101. High-throughput automatic vocabulary image batches - 2026-09-17

- The vocabulary editor batch action now mirrors the existing pre-save TTS
  batch workflow. One authenticated request contains every non-empty editor
  row (bounded by `VOCAB_IMAGE_BATCH_MAX_ITEMS`, default 500). There is no
  separate review/attach modal: every successful managed asset is applied
  directly to its matching draft row when the batch returns, failed rows keep
  their previous image, and the teacher still saves the vocabulary set to
  persist the new references.
- Backend scheduling uses an independent FIFO semaphore for each configured
  generation provider. `VOCAB_IMAGE_BATCH_CONCURRENCY_PER_PROVIDER` defaults
  to 50 and is clamped to 1-50. With the currently configured Stali and
  DevQuota providers, Auto assigns alternating preferred providers and permits
  up to 50 in-flight jobs on each service (100 total). A fallback attempt must
  acquire the destination provider's semaphore, so provider limits cannot be
  exceeded when failures cross over.
- The former global concurrency of 2 and the hard 100-row slice were removed.
  All rows are scheduled from the single batch request; additional rows wait
  only behind their provider semaphore. Explicit-provider batches still avoid
  fallback, while Auto preserves per-row fallback and per-row errors without
  cancelling successful rows.
- Generated bytes are validated and written to content-addressed backend
  storage before the result reaches the browser. The editor then fills the
  existing 4:3 thumbnail immediately from the managed URL. During the batch,
  image controls are disabled and the batch button shows a spinner. A row with
  an existing image exposes `Tạo lại`; the single-image dialog remains the
  teacher-controlled replacement path.
- Regression coverage verifies independent provider ceilings, alternating
  assignment, row-level failures, a 101-row batch beyond the old cutoff,
  automatic editor attachment, removal of the review modal and the regenerate
  control. Verification passes vocabulary-image tests 31/31, vocabulary-game
  tests 16/16 and TypeScript lint.

## 102. Teacher-editable prompt for single vocabulary images - 2026-09-17

- The single-image generation dialog now loads the server-owned default prompt
  through staff-only `POST /api/image-library/prompt` and displays it in an
  editable textarea before any paid provider call. Teachers can adjust the
  prompt, view its character count and restore the original generated prompt.
- `POST /api/image-library/generate` accepts the edited `prompt` only for the
  explicit single-image workflow. The backend requires text, normalizes line
  endings, trims outer whitespace and rejects empty input or more than 8,000
  characters before calling a provider. The exact accepted prompt is returned
  to the dialog and retained in managed asset metadata; it is not written to
  audit-log details.
- Batch generation deliberately continues to build the canonical prompt from
  each term, Vietnamese meaning and part of speech. A caller-supplied `prompt`
  field inside a batch row is ignored, preserving the automatic batch contract
  and preventing an accidental custom instruction from spreading across rows.
- The dialog disables generation while the default prompt is loading or while
  a paid request is active. It remains scrollable within the viewport and the
  prompt can be edited even if preview loading failed. Regression coverage
  verifies formatting preservation, validation, API wiring, UI controls and
  the batch-isolation rule.
