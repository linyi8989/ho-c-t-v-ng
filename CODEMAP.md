# CODEMAP - V-Homework Vocabulary Learning Platform

Last updated: 2026-10-08

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

- Current Git baseline before the scene-link and competition refinements: `37aab32`.
  The working tree contains the updates described in sections 185–187.
- Current local release build (generated 2026-10-07 with canonical
  `npm run build` under the release Node 22.16.0 runtime):
  `dist/client/assets/index-B63iFJlb.js` and `dist/client/assets/index-DjuOcoRm.css`.
  IOE/Violympic admin/student/review and exam-library admin ship as lazy chunks.
  Screen, admin, Firestore,
  Listening, and individual game code continue to ship as lazy chunks.
- Current local server bundle: `dist/server.cjs` (1,497,079 bytes), SHA-256
  `ce5e838d1fa2f2f3e4adf1c33ab6da83fea825e5095755776cace2741e9cad26`.
- Last independently confirmed production UI artifact from the host terminal:
  `index-gODK9tEe.js` and `index-C7ymBAj4.css`.
- Therefore the current local artifact remains **pending host
  confirmation** until cPanel deploy, one Node restart, and a fresh
  `curl`/browser smoke show the current entry assets above. Local validation:
  597 passing regression tests at section 158; the arched Reading & Writing sign in
  section 166 passes 19 scoped tests, typecheck/build, compiled desktop/mobile
  scene/admin/player/hover/sprite/numbering checks and a local 25-link-per-yard preview.
  Native startup and IOE/Speaking bundle smokes
  passed at section 161; the server bundle remains identical. Section 161 verified
  all 58 local tables / 1,330 rows retain hashes, quick_check=ok/WAL. All QA writes
  used fixtures or a production-shaped copy.
  The vocabulary storybook UI in section 172 passes 82 related tests,
  24 image/long-text layout cases, six-width/11-game browser checks and
  read-only local student/Starters/IOE/Speaking checks.
  The grammar/rewrite UI in section 173 passes 93 related tests,
  six-width browser answer/save/submit/review checks, typecheck/build/startup
  and read-only local checks; the server bundle remains identical.
  The seven exam village catalogs in section 174 pass 68 scoped tests and
  142 Listening regressions, five-width/seven-module browser checks,
  the compiled Starters admin/player flow, and native copy/live data checks.
  The new server bundle adds module/paper-scoped scene catalogs and layouts.
  No production deploy.
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

- hashed client assets additively to the root and `dist/client/assets` trees.
- staged root/dist client indexes and the staged server bundle, with `.previous`
  rollback snapshots for those application artifacts.
- `app.js`, `package.json`, `package-lock.json`.
- `scripts/*.mjs` maintenance/preflight tools.

The live `.htaccess` is host-managed state because cPanel/CloudLinux stores its
Passenger registration and environment blocks there. Deployment only verifies
that the Passenger marker exists; it never copies, snapshots or replaces this
file from Git.

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
- The summary endpoint always checks the compact read model first. If
  `settings/leaderboard-read-model-v1` is not `ready=true, version=1`, an
  on-demand, read-only compatibility branch derives the same summary from the
  retained legacy sources. This branch runs only after the student explicitly
  opens the board, keeps the bounded response and 30-second cache, and never
  writes source rows or marks the projection ready. The explicit production
  backfill remains required to remove the compatibility scan at scale.

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

## 103. PET Reading five-Part PE 1 workflow - 2026-09-18

- New PET Reading drafts now use `templateVersion: pet-reading-5-v1` and the
  five ordered structures in the supplied PE 1 source: notice/message image
  choice, people-to-text A-H matching, picture statements Yes/No, four-option
  reading comprehension and four-option multiple-choice cloze. The default
  scored distribution is `5-5-10-5-10`, while every Part remains flexible so
  teachers can add or remove rows to match the printed paper.
- `src/features/exam-platform/petReadingMigration.ts` is the compatibility
  boundary. It normalizes only explicitly versioned five-Part content, keeps
  printed `displayNumber` values, preserves teacher media and application-owned
  IDs, shares one eight-text bank across every Part 2 row and maintains Part 5
  `[[printedNumber]]` markers. Existing unversioned six-Part PET sets and
  immutable published versions remain unchanged. Their editor shows an
  explicit confirmed conversion action instead of rewriting them on read.
- `PetReadingAuthoring.tsx` owns all five teacher editors. Part 1 has one
  upload/library/clipboard image picker plus A/B/C key per notice. Part 2 has
  one editable A-H text bank and flexible person rows. Part 3 has one shared
  picture and flexible Yes/No statements. Parts 4 and 5 own the visible passage
  plus A-D questions; Part 5 updates/removes markers when a printed number or
  final row changes. Whole-paper and focused-Part Universal JSON import use the
  same fixed adapter, never import external media fields and preserve media
  already attached by the teacher.
- `PetReadingViews.tsx` renders the student contract. Part 1 uses equal-height
  image frames on the left with each question and A/B/C options on the right.
  Part 2 shows people at left, the eight text choices at right, then one simple
  A-H letter field per person. Part 3 keeps the source image left and Yes/No
  statements right. Parts 4 and 5 show the passage in a framed area above the
  A-D rows; Part 5 renders its numbered markers as visible gaps. Mobile layouts
  stack safely and every source image keeps the shared zoom/fullscreen viewer.
- Publication validation requires one image for every Part 1 row, one Part 3
  image, a single shared A-H bank with one-to-one official mappings, exact
  Yes/No and A-D option shapes, visible passages and one Part 5 marker per
  scored question. The existing backend objective grader remains authoritative;
  student payload sanitization removes every official key while retaining only
  public text and media. Generic post-submit review continues to show the
  backend result without adding a second grading path.
- Regression coverage verifies the five-Part UI dispatch, flexible Universal
  JSON import, media preservation, prompt contract, malformed structure
  blocking, student sanitization and an eight-row backend grading fixture.
  Verification passes TypeScript lint, the complete exam-platform suite 88/88
  and the production client/server build. Local HTTP smoke checks return 200
  for both the application shell and the PET Reading set API.

## 104. PET Reading Part 1 code-native notice frames - 2026-09-18

- This section supersedes only the Part 1 image requirements described in
  section 103. Part 1 no longer asks a teacher to upload, paste or select five
  notice images. `PetNoticeFrame.tsx` renders five deterministic code-native
  templates in rotation: hanging board, message screen, pinned note, taped
  letter and school plaque. They use light blue, teal, orange and cream tones,
  keep a consistent frame size and preserve selectable accessible text.
- Each Part 1 question stores the complete text printed inside the notice in
  the existing public `question.context` field. `question.prompt` remains the
  question shown on the right, followed by the three A/B/C choices. The same
  live frame preview and context textarea are shown in
  `PetReadingAuthoring.tsx`; the student player uses the identical shared frame
  component, so teachers no longer manage a presentation-only image asset.
- The whole-paper and focused-Part Universal JSON prompts both require Part 1
  `context`, retain line breaks, forbid media fields and continue to accept the
  same `notice-image-choice` interaction identifier for stored-data
  compatibility. The existing importer already treats `context` as public
  bounded text, so both authoring paths pass through the same parser,
  normalizer, sanitizer and backend grader.
- Publication validation now requires Part 1 notice text instead of a new
  image. A previously saved `pet-reading-5-v1` question that has no `context`
  but still owns an image remains publishable and the student view keeps a
  legacy image-only fallback; no released content or media reference is
  deleted. New blank rows receive editable placeholder notice text and use the
  code-native frame immediately. Part 3 remains the only PET Reading Part in
  this change that requires a teacher-owned source image.

## 105. Copyable ChatGPT JSON prompts in Kho đề luyện thi - 2026-09-18

- Every teacher-facing prompt that is copied from Kho đề luyện thi now ends
  with one shared response contract from
  `src/features/exam-platform/chatGptJsonOutput.ts`. ChatGPT is instructed to
  return exactly one Markdown code block labelled `json`, with no prose outside
  it. This keeps the existing JSON object/schema unchanged while making
  ChatGPT render its built-in Copy button.
- The Universal whole-paper and focused-Part builders cover 15 papers:
  Starters Listening and Reading & Writing; Flyers Listening and Reading &
  Writing; KET Listening and Reading & Writing; PET Reading, Writing and
  Listening; FCE Reading & Use of English, Writing and Listening; and IELTS
  Academic Listening, Reading and Writing. The legacy Starters Listening
  prompt uses the same output contract.
- Movers remains on its dedicated authoring pipelines, so both were updated
  explicitly: five per-Part Listening external-parameter prompts and six
  per-Part Reading & Writing external Smart Import prompts. Their existing
  strict parsers already accept either raw JSON or exactly one fenced JSON
  block, so copied output remains directly pasteable and keeps all technical-ID,
  unknown-field and answer-key validation.
- `UniversalAuthoring.tsx` accepts either raw JSON or one `json` code block for
  both whole-paper and focused-Part import. Surrounding prose is still rejected
  and application-owned IDs/media remain protected. The teacher success text
  and placeholders explain that the copied ChatGPT result can be pasted
  directly.
- Scope is intentionally limited to Kho đề luyện thi. The standalone Kho đề
  Writing, vocabulary image/audio generation, grammar prompts and other module
  prompts are unchanged. Regression coverage enumerates all 15 Universal
  papers plus every dedicated Movers Part and rejects conflicting old
  no-code-fence instructions.

## 106. PET Writing three-Part PE 1 workflow - 2026-09-18

- New PET Writing drafts use `templateVersion: pet-writing-3-v1` and the fixed
  `5-1-1` structure from the supplied PE 1 material. Part 1 has five sentence
  transformations, Part 2 has one guided email and Part 3 has one writing
  response selected from exactly two public tasks labelled 7 and 8. Existing
  unversioned two-Part PET Writing sets and immutable published versions remain
  untouched. The editor exposes an explicit confirmed conversion action for an
  old draft instead of rewriting it on load.
- `petWritingMigration.ts` is the compatibility boundary. It owns the three
  interaction variants, stable scoring (`1` point per Part 1 row and `10`
  points for each writing task), default flexible word targets, AI grading
  criteria and the two-choice task shape. Part 1 accepted answers remain a
  private string array. The existing backend normalization converts NFKC and
  smart/mobile apostrophes (`’`, `‘`, `` ` ``, `´`) to the straight apostrophe,
  so alternatives such as `have | 've` can be authored with `|` and graded
  consistently across keyboards.
- `PetWritingAuthoring.tsx` owns all teacher controls. Part 1 shows the original
  sentence, rewritten sentence and pipe-separated accepted answers for each of
  five fixed rows. Part 2 stores the visible email task separately from the
  teacher-owned mandatory-content framework used by the AI grader. Part 3
  stores two complete public question texts and one common rubric. Both writing
  Parts reuse the configured Writing providers, grammar/vocabulary feedback
  contract and flexible-length policy; a relevant, coherent answer may score
  highly beyond the recommended range, while rambling or genre errors reduce
  quality rather than triggering a mechanical word-count penalty.
- The specialized whole-paper and focused-Part Universal JSON prompts preserve
  the same `exam-bundle-import-v2` envelope and ChatGPT Copy-button contract.
  They require Part 1 `context`, rewritten `prompt` and official accepted-answer
  arrays; Part 2 full visible task plus numbered mandatory framework; and Part
  3 exactly two full options. External technical IDs and media remain rejected,
  while application-owned question/option IDs survive re-import.
- `PetWritingViews.tsx` renders the learner flow. Part 1 places the original
  sentence above the rewritten sentence and its input. Part 2 uses the typed-only
  flexible Writing surface. Part 3 presents two high-contrast task cards and
  opens one shared textarea only after a selection. The submitted Part 3 value
  contains the selected application-owned option ID and essay text; backend
  sanitization rejects unknown IDs, and the AI receives only the selected task.
- AI grading is now a durable sequential queue for attempts with multiple
  Writing questions. After Part 2 succeeds, the attempt remains queued and the
  worker automatically leases Part 3; only the final success marks the attempt
  completed. Each question keeps its own 0-10 score, Vietnamese feedback,
  sentence count and grammar/vocabulary notes. Provider failure keeps the
  remaining work in pending review for the existing retry or manual-grade path.
  The final PET result combines the five objective points and two ten-point
  Writing scores into the existing 0-100 attempt percentage.
- Publication validation locks the three variants, counts, answer shapes,
  visible email task, word ranges, provider configuration and Part 3 labels.
  Student payloads remove official answers and AI instructions while retaining
  the public two-task text. Regression coverage exercises smart apostrophes,
  malicious option IDs, JSON import, private-field sanitization, readable UI
  actions, legacy preservation and the real two-step backend worker.

## 107. PET Reading source headers, worked examples and inline review - 2026-09-18

- `petReadingMigration.ts` now owns and enforces the five canonical PE 1
  headings and instructions: Questions 1–5, 6–10, 11–20, 21–25 and 26–35.
  New drafts start with one editable example in Part 1 and Part 5. The current
  normalizer also supplies the same source-faithful default at read time when
  an older `pet-reading-5-v1` payload omitted it; imported/teacher-edited
  examples take precedence. Each example is public and display-only; examples
  never enter `questions`, the submission payload or the objective score.
- The PET Reading Universal whole-paper and focused-Part prompts require the
  canonical heading/instruction strings. Part 1 must return one notice example
  with A/B/C choices and its official answer; Part 5 must return one numbered
  A/B/C/D example and its official answer. The importer continues to generate
  application-owned IDs, preserve teacher-owned Part 3 media and pass every
  imported example through the existing bounded public-example parser.
- `PetReadingAuthoring.tsx` exposes editable example panels for Parts 1 and 5,
  including a live code-native notice preview and a visible official example
  answer. `PetReadingViews.tsx` renders those examples before scored rows. The
  redundant visible shell around the first notice template is transparent,
  while the Part 4/5 passage frame uses a restrained light-orange background
  that expands naturally with the source text.
- `PetReadingResult.tsx` is the dedicated post-submit review shell. It reuses
  the same five learner layouts and overlays backend review results directly
  on each question: official choices are green, an incorrect learner choice is
  red, unanswered rows are amber and every incorrect/unanswered row exposes
  the correct answer in context. The result API and authoritative backend
  grader are unchanged; answers remain available only through the existing
  owner-checked review endpoint and `showReviewAfterSubmit` policy.
- Regression coverage checks canonical prompt headings/instructions, imported
  Part 1/5 examples, zero impact on scored question counts, code-native
  authoring/player examples, transparent notice framing, orange passage frames
  and the dedicated inline review dispatch.

## 108. cPanel-safe asynchronous vocabulary image batches - 2026-09-18

- The former `POST /api/image-library/batch-generate` held one HTTP request open
  until every paid generation, image validation, managed-file write and asset
  metadata write had finished. At 50 in-flight calls per provider this also
  allowed many large base64 responses to coexist in one Passenger process.
  Provider jobs could therefore complete while the reverse proxy timed out or
  the hosting worker exhausted memory before the browser received any asset.
- Batch creation now returns HTTP 202 with an owner-scoped `jobId` immediately.
  Work continues through the existing provider/download/storage boundary, and
  each row result is persisted independently. Staff polling uses
  `GET /api/image-library/batch-generate/:jobId`, a separate bounded status
  limiter and a backend ownership check; another teacher receives 404 rather
  than job metadata. Audit failure cannot orphan an already-created job.
- `vocab-image-batch-jobs-v1` is an additive SQLite migration for job metadata
  and per-row results. It stores no image bytes or API keys, indexes actor/job
  and expiry fields, and leaves vocabulary sets and managed assets unchanged.
  The same collection contract remains compatible with Firestore deployments.
- The provider-specific ceiling remains configurable up to 50, but
  `VOCAB_IMAGE_BATCH_TOTAL_CONCURRENCY` now defaults to 8 and is clamped to
  1–100. This bounds aggregate base64/download memory on cPanel while preserving
  independent provider scheduling and automatic fallback. Higher-resource
  servers may explicitly raise the total ceiling after observing memory.
- The vocabulary editor polls with bounded retry, updates progress and attaches
  each managed 4:3 thumbnail as soon as its result is durable. A changed term
  is not overwritten by a stale background result. Partial successes remain in
  the draft, failed rows keep their previous image and expose the first useful
  provider/storage error in the final teacher notification.
- A running job owns a renewable 60-second worker lease. If cPanel/Passenger
  replaces the Node process, the next owner polling request detects the expired
  lease, reloads the durable row results and resumes only unfinished indexes.
  Already-downloaded assets are therefore attached without being regenerated,
  while a live worker is protected from a duplicate recovery runner.

## 109. PET Writing source-faithful examples and typed-only answers - 2026-09-19

- `pet-writing-3-v1` keeps its released compatibility boundary and scoring,
  while new/default Part 1 content now includes one public display-only worked
  example. Universal whole-paper and focused-Part prompts require ChatGPT to
  transcribe each source `title` and multiline `instruction`, extract the Part
  1 example plus printed answer and preserve the exact Question 7/8 guidance.
  The normalizer promotes an imported block example before removing import-only
  blocks, so it is no longer lost between JSON import and the learner view.
- Part 1 authoring exposes the example separately from the five scored rows.
  The learner view renders the answer directly at the `____` position for both
  the worked example and each scored transformation; it no longer creates a
  detached answer box. Part 2 hides the redundant generic heading and the
  prompt/word-target paragraph above the textarea. Part 3 retains its imported
  heading/instruction and uses a full-card selected state that survives the
  legacy global glass-button theme.
- PET Writing no longer exposes the unused per-task prompt field in Part 2/3
  authoring. Recommended word bounds remain teacher-owned grading metadata,
  but their inputs use an editable draft value so a teacher can select, clear
  and type a complete number before it is clamped and committed on blur.
- Student text-answer controls across the shared Exam Platform and Movers now
  block copy, cut, paste, drag/drop insertion and before-input paste variants.
  This applies only to learner answer inputs/textareas (including the standalone
  Writing surface), not teacher authoring or the learner-name form. Mobile smart
  apostrophes continue to be normalized by the authoritative backend grader.
- Submit, review, retry, home and PET task-selection controls use stable scoped
  hooks with opaque high-contrast colours, avoiding the legacy translucent
  global button override without changing unrelated game surfaces.

## 110. Listening authoring audio preview - 2026-09-19

- Every audio intake surface inside Kho đề luyện thi now uses the shared
  `AudioPreviewButton`: the generic Part/block audio field used by Starter,
  Flyer, KET, FCE and IELTS Listening, Starter's quick MP3 attachment panel,
  and the five Movers Listening Part editors through `ListeningAssetPicker`.
- A compact, opaque `Nghe thử` button sits directly beside the upload control.
  It previews the currently selected managed asset, including the asset returned
  immediately after an upload, and remains visibly disabled until an audio URL
  exists. The button toggles play/pause and starting another preview stops the
  previous Part's audio, preventing overlapping checks during authoring.
- Preview is browser-only and does not change upload, asset ownership, draft,
  publish or student playback contracts. The previous large inline audio control
  in the Movers asset summary is removed to avoid duplicate playback controls.

## 111. PET Reading example and compact answer rows - 2026-09-19

- The `pet-reading-5-v1` normalizer now supplies the source-faithful default
  worked example for Parts 1 and 5 when an older stored draft or published
  version has no `examples` field. An imported or teacher-edited example still
  takes precedence. This is a display-only normalization and does not add a
  scored question or rewrite an immutable published version.
- Part 1 renders its example before Question 1 and removes the redundant outer
  bordered shell from every scored notice row. All five code-native templates
  also use a transparent outer media shell; only the actual board, message,
  note, letter or plaque inside remains visible. The separate answer card stays,
  so review colouring continues to apply only to the actual answer area.
- Part 5 no longer prints generated labels such as `Gap 26`. Each printed
  question number is aligned on the same row as its four A–D choices, while the
  passage keeps the matching numbered placeholder in context.

## 112. PET result contrast and Writing paper controls - 2026-09-19

- PET Reading result and visual-review actions now use dedicated scoped hooks
  for Home, visual review, retry, Parts 1–5 and return-to-summary. Opaque blue,
  green and white states override the legacy glass-button theme without
  changing controls in unrelated modules; disabled loading remains readable.
- PET Writing Part 1 uses a transparent inline input with only a thin,
  light-orange dashed baseline. The redundant visible placeholder and boxed
  fill background are removed, while the same typed-only guards and backend
  accepted-answer normalization remain in force.
- PET Writing Parts 2 and 3 use a subtle 32px light-orange ruled-paper
  background aligned with the textarea line height. This is presentation-only;
  draft answers, no-paste guards and word counting are unchanged.
- PET Writing continues to share the Exam Platform's persisted AI-grading
  queue with the standalone Writing library: polling, safe pending state,
  retryable failure and owner-checked review use the same endpoints. Its retry
  button now exposes the server cooldown countdown, and completed attempts
  continue to appear through the existing `exam_attempts` Learning History
  adapter rather than a duplicate history store.

## 113. PET Listening four-Part exam workflow - 2026-09-19

- New PET Listening drafts use the explicit `pet-listening-4-v1` contract with
  four fixed Part types and teacher-adjustable scored-row counts. Older PET
  Listening papers remain on their released generic contract until a teacher
  deliberately converts the draft, so published attempts and history are not
  rewritten by the migration.
- Part 1 provides a source-page intake, automatic A/B/C frame grouping and the
  same manual crop editor used by established image-option listening tasks. It
  stores one display-only worked example plus three managed option images per
  scored row. Part 2 is a text A/B/C dialogue task without an example; Part 3
  is an audio form-completion task with accepted-answer aliases; Part 4 is a
  text-only Yes/No task without an image.
- PET-specific authoring and learner views plug into the shared Exam Platform
  shell rather than creating a second runtime. Audio upload/preview, immutable
  publish, timed attempts, backend answer-key protection, grading, visual
  green/red review, transcripts and Learning History continue to use the same
  endpoints and persistence as the other Kho đề luyện thi papers.
- Universal whole-paper and focused-Part prompts require ChatGPT to transcribe
  the source title and multiline instruction exactly, emit four Parts in the
  official order, include only the Part 1 worked example and return one
  copyable JSON block. Server validation checks every variant, official answer
  and managed crop before publishing, and strips the private full source image
  plus all answer keys from the learner payload.
- PET Listening editor and learner actions use scoped opaque contrast rules so
  upload, crop, navigation and answer controls stay readable despite the legacy
  global glass-button theme.

## 114. PET Listening tall-scan Part 1 crop fallback - 2026-09-19

- PET Listening Part 1 now has a module-scoped relaxed frame detector for pale,
  one-pixel PDF borders and source images made by vertically joining several
  complete pages. It preserves up to 3600 pixels while analysing the image and
  derives vertical frame limits from page width, so large blank gaps between
  pasted pages do not make valid A/B/C boxes look too small.
- The fallback bridges tiny antialiasing gaps but still requires at least three
  strong rectangle edges and neutral scan colours. Its candidates are merged
  with the existing conservative black-frame detector; KET, Movers and other
  crop workflows retain their previous detector behaviour.
- PET row grouping no longer rejects a question merely because an illustration
  contains extra rectangular objects such as a tray, table or clock. It selects
  the three largest regular, evenly spaced outer frames for A/B/C, orders rows
  from top to bottom and skips the first triplet when it is the printed example.
- Regression coverage reproduces an example plus seven questions over a tall
  three-page scan with pale broken borders and nested black rectangles. The
  expected result is seven complete A/B/C crop groups (21 learner images).

## 115. PET Listening Part 1 cropped worked example - 2026-09-19

- Part 1 crop grouping now returns the first detected A/B/C triplet separately
  as `exampleGroup` when the source contains an example plus all scored rows.
  Batch processing uploads these three Example crops before the 21 scored
  question crops. When no complete Example triplet is found, the scored rows
  still crop normally and the existing Example media is left untouched.
- `ExamDisplayExample.options` can now own three public managed image assets.
  Universal JSON continues to contain only labels/descriptions, but later JSON
  imports preserve teacher-created Example option images by label. Publish
  validation accepts the new three-image representation and retains support for
  immutable legacy papers that stored one combined Example image.
- The authoring screen exposes separate A/B/C Example image slots and reports
  progress as `Example 0/3` plus the scored-image count. Both the live learner
  view and post-submit visual review render the Example in the same three-card
  layout as a question, lock interaction, and mark the official option with an
  emerald border, selected radio and explicit correct-answer label.

## 116. PET Listening inline form and aligned Yes/No rows - 2026-09-20

- Part 3 learner content is now one form card. Explicit `[[questionNumber]]`
  markers and legacy printed blanks such as `(14) ....................` inside
  the teacher-owned passage are replaced by protected text inputs at their
  printed positions; the detached answer-card list has been removed. Papers
  whose blanks cannot be identified remain playable because unmatched
  questions are rendered as compact rows inside that same form card.
- The PET Listening ChatGPT prompt and teacher editor now document the marker
  contract, so newly imported forms preserve their printed line breaks and put
  each input in the actual blank. Post-submit review uses the same inline model
  and overlays the learner answer plus the correct answer when needed.
- Part 4 learner and review rows use one fixed three-column grid: the numbered
  statement on the left and aligned Yes/No controls on the right. This changes
  presentation only; existing question IDs, submitted option IDs, backend
  grading, immutable versions and Learning History remain unchanged.

## 117. Shared Cambridge learner answer line - 2026-09-20

- `StudentUnderlineInput` is the shared short-answer control modelled after PET
  Writing Part 1: transparent background, one thin dashed pale-orange baseline,
  no placeholder box and the existing copy/paste/drop guards. It is used by
  Starters Listening Part 2, Movers Listening Part 2, Starters Reading &
  Writing Parts 4/5, Movers Reading & Writing Parts 1/4/5 and Flyers Reading &
  Writing Parts 1/4/5/7.
- Starters Listening Part 2, Starters Reading & Writing Part 5 and Movers
  Reading & Writing Part 1 keep the prompt on the left and align equal-width
  answer lines to the right without creating a second answer panel.
- Movers Reading & Writing Part 2 now places each statement and its compact
  Yes/No controls on one fixed grid row. Part 6 image-choice mode places the
  printed question number and all three A/B/C answers on the same row. Answer
  IDs, grading data and stored submissions are unchanged.
- The shared control now owns an explicit final CSS reset after every legacy
  global input rule. Released papers therefore keep a transparent square
  input with no surrounding border, background, radius or placeholder. Its
  orange baseline is one shade stronger, the control is reduced to a 2rem
  line box and baseline-aligned so inline blanks sit level with printed text.
  PET Writing Part 1 also consumes this shared control instead of maintaining
  a second copy of the same visual rules.

## 132. Starters Listening learner layout balance - 2026-09-26

- Starters Listening Part 2 keeps its illustration alone in the left column.
  Its two unscored example lines now appear at the top of the right column,
  immediately above the heading and five right-aligned learner answer rows.
  Movers and every other consumer of the shared Part 2 renderer retain their
  existing example placement unless they explicitly request this layout.
- Starters Listening Part 3 now treats the combined printed example image as
  the first unscored card in the same responsive two-column grid as the five
  scored A/B/C image questions. The result is six balanced cards instead of a
  full-width example followed by an uneven five-card grid. Stored questions,
  answer IDs, grading and the teacher crop pipeline are unchanged. Its example
  card now matches the height of the adjacent learner question card. A second
  inner frame mirrors the exact height of one A/B/C answer card (`12.5rem`),
  and `object-contain` fits the complete example crop inside it without
  distortion. The card displays only the concise `Example` label.

## 133. Movers Reading & Writing learner layout balance - 2026-09-26

- Movers Reading & Writing Parts 1 and 4 opt into an equal-height split layout.
  On desktop the left image frame stretches to the complete height of the
  example and answer content on the right, while the image remains contained
  without distortion. Part 4's title-choice question stays last in the right
  column. Other users of the shared split layout retain the sticky natural-size
  image behavior unless they explicitly request stretching.
- Part 3 removes the separate example card from the learner surface and centers
  the scene image above the exercise. Its six scored questions then occupy a
  responsive two-column grid in reading order: 1/2, 3/4 and 5/6. On narrow
  screens the same questions collapse to one column. Answer IDs, grading and
  persisted attempts are unchanged.
- Part 6 image-choice mode opts into the same equal-height split mechanism used
  by Parts 1 and 4: its image frame stretches with the complete instruction and
  five-answer column, while the image stays fully contained and undistorted.

## 134. Movers Listening compact interactive layouts - 2026-09-26

- Movers Listening Parts 1 and 5 no longer force their outer student viewport
  to fill the remaining browser height. The viewport now follows the answer
  dock, interactive image and instruction content, with bounded scrolling only
  when that content exceeds the available screen. The shared image stage,
  normalized source-image coordinates and every drag/drop, colour and draw
  overlay remain unchanged.
- Part 2 opts into a balanced left media column. Its illustration frame grows
  to the height available beside the five answer cards and the unscored example
  stays directly below it at the same width. The shared renderer defaults to
  its previous behavior, so Starters and other explicit Part 2 presentations
  keep their existing example placement.

## 135. Flyers learner media balance and image-modal isolation - 2026-09-26

- Flyers Listening Parts 1 and 5 use the same explicit presentation-only image
  limits (`912px`, `1.2` scale and the same viewport-height cap). Their
  surrounding work area is content-fit with bounded viewport scrolling instead
  of a forced tall empty canvas. Drag, drop, colour and draw coordinates remain
  normalized against the rendered source image, so grading geometry and stored
  answers are unchanged.
- Flyers Reading & Writing Parts 1, 2 and 6 stretch their left image frame to
  the full height of the adjacent exercise column on desktop while preserving
  the whole image with `object-contain`. Part 6 no longer repeats the redundant
  blue A/B/C instruction card above its answer rows.
- The shared expanded-image dialog is rendered through a React portal directly
  under `document.body`. It therefore escapes per-card stacking contexts and
  always overlays sibling images in multi-image Parts such as Starters Reading
  & Writing Part 5.

## 136. Admin exam-directory current-position indicators - 2026-09-27

- The top Cambridge/IELTS module shortcuts and the Listening/Reading & Writing
  paper filters expose their selected state through `aria-pressed`,
  `aria-current="page"` and `data-active` together.
- The active module uses a dark-blue filled card, an outer focus-like ring and
  a visible check badge. The active paper uses the same filled treatment and a
  check icon in place of its normal paper icon. Final high-specificity styles
  are scoped under the admin dashboard so broad legacy button rules cannot
  wash out either current-position indicator.

## 118. Admin shell and Vocabulary presentation boundaries - 2026-09-21

- `src/components/admin/AdminDashboard.tsx` remains the compatibility entry and
  mounted controller for the Admin area. It still owns authentication-aware
  loading, every existing mutation, notifications, overlays and all unsaved
  Vocabulary editor state. Consequently a teacher can leave the editor tab and
  return without losing a draft; no API, storage, route or refresh contract was
  moved in this structural pass.
- `AdminShell.tsx` now owns the unchanged Admin frame: root, sidebar, role-aware
  navigation, user footer and main content container. Existing IDs, classes,
  labels, tab order and callbacks are preserved. `LibraryPagination.tsx` is the
  shared presentation-only pagination control used by both Vocabulary and
  Grammar directories.
- Vocabulary presentation is split into
  `vocabulary/VocabularyLibraryPanel.tsx`,
  `vocabulary/VocabularyResultsPanel.tsx` and
  `vocabulary/VocabularyEditorPanel.tsx`. These files receive state and actions
  through props and contain no fetch, effect or persistence logic. The
  Vocabulary action order remains `Play → Sửa → Sao chép → Kết quả → Xóa`, and
  semantic IDs used by tests and CSS remain unchanged.
- `AdminShell.contract.test.ts` locks the compatibility boundary, preserved DOM
  hooks, always-mounted draft ownership, presentation-only fetch rule, baseline
  Admin request inventory and Vocabulary action order. `test:admin` is part of
  `test:phase1`; existing Admin, image and Exam contracts now read UI hooks from
  their new owning files.
- Initial Admin loading is intentionally unchanged in this phase: 11 request
  groups for a teacher and 12 for a super-admin (the additional audit request).
  Dashboard summary, lazy domain fetch, server pagination and targeted refresh
  remain reserved for the separately approved second upgrade pass.

## 119. Admin lazy data boundary and paged domain APIs - 2026-09-22

- `src/server/admin-data/` is the Phase 2 modular-monolith boundary. Its
  `contracts.ts`, `repository.ts`, `service.ts` and `router.ts` layers parse a
  capped page request, enforce teacher/super-admin scope, query data and expose
  authenticated staff endpoints below `/api/admin`. `server.ts` remains the
  composition root and injects the existing authorization, sanitization,
  account, audit and result helpers. Existing legacy endpoints remain live.
- Initial Admin entry now calls only `GET /api/admin/dashboard-summary`.
  Against the local Phase 2 fixture, super-admin startup changed from 12
  requests/461,146 bytes to 1 request/1,831 bytes (91.7% fewer requests and
  about 99.6% less initial payload). The summary contains counts, at most 30
  recent activity summaries and five gold-table rows, never full domain lists.
- `GET /api/admin/vocab-sets` and `/grammar-sets` return scoped summary pages;
  `GET /api/admin/vocab-sets/:id` and `/grammar-sets/:id` are authorized point
  reads for editors/previews. Summary rows carry `itemCount`/`questionCount`
  instead of item/question bodies. The controller debounces search by 300 ms,
  aborts replaced requests and ignores stale generations.
- `/classes`, `/class-members`, `/assignments`, `/assignment-options`,
  `/accounts-page` and `/audit-logs-page` are lazy staff endpoints for their
  matching tabs. Assignment options are separate from the visible page so a
  dropdown is not truncated by pagination. Teacher assignment visibility and
  Dashboard counts both include records created by the teacher and records
  attached to a class managed by that teacher.
- `AdminDashboard.tsx` remains the compatibility controller, but each domain
  owns one lazy loader. Results/leaderboard and the existing versioned
  Listening, Movers, Writing and Exam APIs are not fetched until their surface
  needs them. The compatibility refresh function now invalidates Dashboard
  plus only the active/edited domain; it no longer reloads every Admin domain.
- `adminData.test.ts`, `AdminShell.contract.test.ts`, performance contracts and
  legacy integration tests lock the scope, summary/detail separation, lazy
  startup inventory and old API behavior. `test:phase2` runs the full Phase 1
  gate plus Admin data, History and legacy contracts under Node 22.
- Phase 2 deliberately does not change `App.tsx`, `appRoutes.ts`, database
  schema, storage contract, CSS, intended layout or user data. Visual redesign
  and App/Home extraction remain behind the separately approved Phase 3 gate.

## 120. Phase 3 App/Home, scoped visual theme and Classes boundary - 2026-09-22

- `src/App.tsx` is now the application composition gateway (378 lines instead
  of 1,038). `features/app-shell/useAppNavigation.ts` owns location state,
  existing `appRoutes.ts` parsing, `pushState`, `popstate` and scroll reset.
  The router framework and canonical/legacy URLs are unchanged.
- `features/home/HomePage.tsx` owns the existing Home DOM and semantic hooks;
  `useHomeController.ts` owns the one abortable route-scoped data generation;
  `homeSearch.ts` owns accent-insensitive metadata/item search and grade
  filtering; `homeContent.ts` owns static weekly copy. Presentational Home
  components do not fetch or persist data.
- Home deliberately keeps the existing full Vocab/Grammar endpoints because
  public search covers nested vocabulary term, meaning, IPA, part of speech,
  example, example meaning, notes and aliases. A future summary endpoint may
  replace it only after preserving that search contract server-side.
- The final block of `src/index.css`, marked `Phase 3 scoped visual theme`,
  defines reusable ink/brand/teal/coral/pastel/border/shadow tokens and applies
  them only below `#app-root`, `#admin-dashboard-container` and
  `#student-area-root`. It changes visual color/treatment only; a contract test
  forbids layout/grid/size/spacing mutations and protects Exam/Listening
  selectors. `#learning-golden-toggle` has explicit normal, hover and focus
  states meeting WCAG AA contrast.
- `src/server/classes/` is a modular-monolith vertical slice for the six legacy
  Classes/Class Members endpoints. `router.ts` preserves the exact `/api`
  routes and middleware; `service.ts` preserves role/ownership/status/audit
  behavior; `repository.ts` owns Firestore-compatible CRUD, class soft archive
  and transactional assignment archive/share-token revocation. `server.ts`
  only composes and injects the existing policy/storage helpers.
- Phase 3 introduces `test:home`, `test:classes` and aggregate `test:phase3`.
  Contracts lock App/Home ownership, route navigation, full search fields,
  stable Home DOM hooks, scoped CSS/contrast, unchanged class URLs and teacher
  scope. The Node 22 full gate passes lint, all Phase 1/2 suites, Home 9/9,
  Classes 2/2, Listening 139/139, production build and startup smoke.
- No database schema, storage contract, user data or production deployment is
  changed by Phase 3. Generated `dist/` output is excluded from the source
  change set after build verification.

## 121. Browser speech fallback and recoverable learning runs - 2026-09-23

- `src/lib/game-engine/speech.ts` is the single vocabulary playback boundary.
  Saved media remains preferred; missing or failed media falls back to Web
  Speech. It retains the active utterance and serializes Chromium cancellation
  so a new utterance is not silently discarded.
- `src/lib/attemptRecovery.ts` owns client error-code classification and a
  bounded local archive of expired answers. The archive excludes tickets and
  run secrets. Generic Exam, Movers Reading & Writing and Listening all use
  this contract.
- The three learning-run servers now share the same lifecycle semantics:
  active signed ticket -> bounded authenticated renewal -> submit, or explicit
  recovery-expired state. Movers and Listening add their matching existing-URL
  `attempts/renew` endpoint; no database migration or record rewrite is used.
- Submit remains idempotent after ticket expiry when the immutable attempt was
  already committed, which covers a lost HTTP response without creating a
  duplicate result. Guest-owned runs remain guest-owned if browser login state
  changes before retry.
- Recovery tests cover signature/owner/run-secret/version binding, successful
  renewal, expired recovery windows, idempotent replay and credential-free
  local answer archives.

## 122. Admin domain presentation boundaries - 2026-09-23

- `src/components/admin/AdminDashboard.tsx` remains the mounted Admin controller
  and compatibility entry. It owns every domain state, effect, lazy fetch,
  mutation, unsaved draft, notification and overlay so tab changes do not alter
  data lifetime. Moving the domain JSX reduced the file from about 4,470 to
  2,972 content lines (3,211 physical lines including blanks) without changing
  API, route, schema, storage or authorization.
- Dashboard, Grammar library/editor, Classes/Class Members, Assignments,
  Results/leaderboard, Accounts and Audit now render through presentation-only
  panels below `src/components/admin/{dashboard,grammar,classes,assignments,
  results,accounts,audit}/`. The panels receive typed controller props, render
  the existing DOM and emit events; they do not call `fetch`, `authFetchJson`,
  `useEffect` or persistence APIs.
- Existing semantic hooks, pagination, role guards and row-action ordering stay
  unchanged. Grammar draft state remains mounted in `AdminDashboard`; Accounts
  retains teacher/super-admin scope and Audit remains super-admin-only.
  Assignments was not added to the sidebar because that would be a separately
  approved layout change.
- `AdminShell.contract.test.ts` now locks all eight presentation boundaries and
  their no-fetch rule. Grammar and Listening contracts read shared library UI
  hooks from `GrammarLibraryPanel.tsx`, their current owner, rather than the old
  monolithic file.
- Browser QA confirmed the extracted tabs, lazy request inventory and a 390 px
  no-overflow viewport without writing application data. The Node 22
  `test:phase3` gate passes lint, all unit/integration/contract suites,
  production build and startup smoke; Listening passes 139/139.
- This step does not reorganize `server.ts` or the CSS generations. Those remain
  separate, gated steps so a structural regression can be attributed to one
  boundary at a time.

## 123. Server domain router/service/repository boundaries - 2026-09-24

- `server.ts` is now the backend composition root: it initializes Express,
  storage, middleware and provider/helper dependencies, mounts domain routers,
  serves the application and owns startup/shutdown. It contains no direct
  `app.get`, `app.post`, `app.put`, `app.patch` or `app.delete` declarations.
  The physical file decreased from the Step 3 baseline of about 6,659 lines to
  3,712 lines without changing the public URL set.
- The remaining direct-route domains now live below `src/server/` as explicit
  router/service/repository slices: `assignments`, `diagnostics`,
  `auth-profile`, `guest-identity`, `vocabulary-ai`, `vocabulary`, `tts`,
  `grammar`, `grammar-attempts`, `vocabulary-runs`, `results` and `accounts`.
  Routers own HTTP parsing/status mapping, services own policy and workflow,
  and repositories own Firebase/SQLite-compatible reads and writes. Provider
  boundaries are separate where external auth/TTS behavior is involved.
- Existing `admin-data`, `classes`, `learning-history`, `listening-library`,
  Movers, Exam and vocabulary-image routers remain mounted through their
  established boundaries. Shared legacy-compatible helpers are injected by the
  composition root instead of being duplicated in each domain.
- Existing endpoint paths, response/error schemas, authentication, role and
  ownership checks, audit behavior, archive/share-token semantics, atomic
  batches, idempotency, run secrets, grading snapshots and bounded result reads
  are preserved. This checkpoint performs no database migration, production
  data write, deployment, CSS change or layout change.
- `test:server-domains` runs 41 contract tests across all 12 newly extracted
  domain boundaries. `test:phase3` includes that suite and passes under the
  release Node 22 runtime together with lint, production build, startup/storage
  smoke, security, performance, legacy API, Admin, Home, Classes, Listening,
  Movers and Exam regression suites.
- Tests that previously inspected a route body inside `server.ts` now inspect
  the domain module that owns that behavior. Their assertions were retained;
  only the source-owner location changed. Generated `dist/` content was
  restored after build verification, and the existing localhost process was
  not stopped.

## 124. CSS surface ownership and Dark Glass retirement - 2026-09-24

- `src/index.css` is now an eight-line entrypoint with one deterministic cascade:
  Google Fonts, Tailwind, tokens/base, shared components, Home, Admin, Student,
  then Exam/Listening. It no longer contains component styling directly.
- CSS ownership lives below `src/styles/`: `tokens-base.css` owns tokens and true
  global primitives; `shared-components.css` owns the single light/accessibility
  normalization; `home.css`, `admin.css` and `student.css` own their surface
  roots; `exam-listening.css` owns the sensitive exam, authoring, player and
  image-hitbox contracts.
- The obsolete Dark Glass generation was removed, including its page pseudo
  layer, `glass-*` hooks and broad Glass button override. Surface contract tests
  forbid owner files from reaching into sibling roots and prevent Home/Admin
  rules from changing Exam/Listening hitboxes.
- `src/styles/cssTestUtils.ts` expands local CSS imports for source contracts, so
  splitting the physical files did not weaken existing contrast, interaction or
  feature assertions. `VisualTheme.contract.test.ts` additionally locks import
  order, import-only entrypoint, retired selectors and bounded override metrics.
- `scripts/css-browser-smoke.mjs` provides local, read-only computed-style and
  screenshot QA at 1440 px and 390 px for Home, Admin and Student. It checks
  horizontal overflow, button backdrop filters, page pseudo content, Home hero,
  Student game stage and Bảng vàng hover/focus. It is exposed as
  `npm run test:css-browser` and does not submit forms or mutate application data.
- The physical CSS decreased from a 4,823-line monolith to an eight-line entry
  plus about 3,902 owner lines. `!important` occurrences decreased from 1,945 to
  1,828 and backdrop declarations from 156 to 139. Remaining high-specificity
  rules are predominantly published Exam/Listening compatibility contracts and
  are retained until separately migrated with feature-level visual coverage.
- No DOM, layout, route, API, schema, storage, authorization or production data
  changed in this step. Node 22 lint, production build, startup/storage smoke,
  the complete `test:phase3` regression gate and desktop/mobile browser QA pass;
  generated `dist/` content was restored after verification.

## 125. Compact student exam-directory cards - 2026-09-24

- `ListeningLibraryHome.tsx` keeps the same seven visible registry modules,
  capability check, navigation callback and `examModulePath` behavior. Only the
  student card presentation changed: module title first, then level/exam label,
  a concise presentation-only description and the existing action.
- Active cards no longer render the redundant `Đang hoạt động` badge. Inactive
  capability behavior is unchanged and still renders the existing disabled
  `Chưa triển khai` action.
- `exam-listening.css` owns the scoped `exam-directory-module-*` hooks for both
  embedded Home and standalone library roots. Cards use one 13rem height,
  module accent colours and a bottom-aligned single-line 2.5rem action. Existing
  `sm:grid-cols-2` and `xl:grid-cols-4` breakpoints are unchanged.
- Registry manifests, module descriptions, APIs, routes, storage and data are
  not modified. Short card copy lives only in the student presentation layer.
- The navigation contract locks title/level/description/action ordering and the
  absence of the active badge. `css-browser-smoke.mjs` measures all seven cards
  at 1440px and 390px, including equal height/width, content overflow and action
  alignment, and captures dedicated desktop/mobile screenshots.

## 126. Student golden-board availability and contrast - 2026-09-24

- Root cause of the unavailable board was isolated at the summary API boundary:
  the local database had retained leaderboard source events but no
  `leaderboard-read-model-v1` readiness marker, so the summary endpoint returned
  `503 LEADERBOARD_NOT_READY` while the compatibility leaderboard endpoint
  returned the existing results correctly.
- `getPublicLeaderboardSummary` still attempts the compact ready projection
  first. When that projection is unavailable, it now calls the existing
  read-only legacy event loader, sanitizes and aggregates on the server, returns
  only the bounded summary, and stores that summary in the existing 30-second
  cache. No request-time migration, database write or readiness mutation was
  introduced.
- `StudentLearningArea` keeps lazy loading: no leaderboard request occurs before
  `Xem bảng vàng` is opened. The retry action now increments the existing refresh
  key instead of closing/reopening state through a timer, and the toggle exposes
  `aria-expanded` plus a test-only status data attribute for deterministic UI QA.
- `student.css` explicitly fixes the toggle to an opaque amber surface with
  white text and no inherited filter in both closed and open states. No layout,
  breakpoint, route, API URL, score data or storage schema changed.
- Server-domain, performance, identity, Home/theme and TypeScript gates pass.
  Browser QA at 1440px and 390px confirms `opacity: 1`, white text, no visual
  filter, successful `ready` state, one rendered local leaderboard entry and no
  preparation error.

## 127. Independent student Grammar search and grade filter - 2026-09-24

- The Home controller now owns separate `grammarSearch` and `grammarGrade`
  state. Vocabulary keeps its existing `search`/`grade` state, so filtering one
  student directory no longer changes the other directory.
- `getGrammarGradeOptions` combines the existing default grades, authenticated
  class names and grade levels present in loaded Grammar sets. Public visibility
  filtering and the existing accent-insensitive Grammar title/topic/description
  matching remain client-side; no API, route or record shape changed.
- `HomePage` renders a named Grammar search input and grade selector inside
  `#home-grammar-directory`, using emerald focus styling and accessible labels.
  The heading is protected from word wrapping when the count badge moves within
  a narrow desktop row.
- Home contracts pass 13/13 and TypeScript lint passes. Browser QA confirms both
  controls remain inside the 736px desktop content column, become equal 358px
  rows at a 390px viewport, and cause no horizontal overflow.

## 128. Shared student Vocabulary and Grammar lesson lists - 2026-09-24

- `HomePage` now presents public Vocabulary and Grammar records through one
  shared `HomeLessonList` view. Each row contains exactly the requested student
  fields: ordinal number, lesson name, grade, topic and the existing open action
  rendered as a Play icon plus `Học Bài`.
- The instructional subtitles below both section headings and the Grammar result
  count badge were removed. Empty-state messages remain so a directory with no
  matching public record still explains why no rows are shown.
- Existing controller filtering, public-visibility rules, record objects,
  `onOpenVocab`/`onOpenGrammar` callbacks, routes and APIs are unchanged. The
  redesign removes presentation-only card metadata; it does not alter stored
  lesson data.
- `home.css` owns the shared responsive list: five aligned desktop columns and a
  compact labelled mobile row at widths below the existing 640px breakpoint.
  Vocabulary actions are opaque blue, Grammar actions opaque emerald, with
  explicit white text and no inherited visual filter.
- Home source contracts lock the shared component, column names, CTA content and
  removal of the old subtitles/count. Browser QA additionally checks row cell
  count, Play action, computed action contrast and horizontal containment at
  1440px and 390px.

## 129. Home hero copy/media separation - 2026-09-24

- `HomePage.tsx` keeps the hero as one semantic header with two explicit layer
  owners: `#home-hero-copy` contains the badge, heading and copy above an
  absolute full-surface `#home-hero-media` image layer.
- `home.css` gives copy the higher stacking context and masks the image from a
  faint presence below copy to full visibility at the right. Below 1024px the
  same media layer stays full-surface while its 4:3 image anchors to the bottom
  and fades vertically into the copy area.
- The supplied 4:3 image is served from
  `public/home-classroom-achievement.png`. It has no independent card, border,
  background or shadow. There is no independent media outline or layout seam;
  the hero's outer border is the only visible container boundary.
- The old gamification badge and its `Sparkles` dependency are removed. The
  hero title now owns semantic lead/joy/promise/brand spans with a smaller
  fluid type scale, navy/coral/teal emphasis and a soft brand highlight. No
  title copy, route or behavior outside this presentation was changed.
- Routes, APIs, Home controller state, data records and student actions are
  unchanged. Home contracts and browser smoke lock region ownership, ordering,
  containment, layer order, integrated media styling and desktop/mobile
  overflow behavior.

## 130. Production remediation: bounded leaderboard, safe routing and rollout - 2026-09-25

- The raw leaderboard feeds are retired with HTTP 410. Home consumes only
  `/api/public/leaderboard-summary`; student learning uses the capability-scoped
  `/api/learning/leaderboard-summary`; staff uses the authenticated, role-scoped,
  filtered and paginated `/api/admin/leaderboard-summary`.
- Public leaderboard output is a bounded anonymous allowlist. It has a 30-second
  cache, cold-request single-flight, an IP fixed-window limiter, explicit
  Vietnam UTC+7 period boundaries and deterministic tie ordering. Production
  fails closed with `LEADERBOARD_NOT_READY`; legacy aggregation is development-only.
- `db-backfill-hot-read-models.mjs --target leaderboard` is dry-run first,
  creates a verified backup on execute, reconciles missing events, proves source
  counts unchanged, runs `quick_check`, and publishes readiness last. It does
  not create guest profiles in leaderboard-only mode.
- SQLite document patch read/merge/write is protected by one `BEGIN IMMEDIATE`
  transaction. The native driver test now includes two concurrent processes
  patching different fields of the same document and verifies neither update is lost.
- Production API/asset/SPA fallbacks now distinguish JSON 404, text 404 and
  allowlisted browser routes. API errors are `no-store`; fingerprinted
  `/assets/` are immutable while `index.html` is no-cache. Apache supplies the
  same security/compression policy and `index.html` declares Vietnamese.
- cPanel deployment copies hash assets additively before activation, stages and
  verifies `.next` artifacts, snapshots current runtime files as `.previous`,
  activates the root index last and never deletes the live asset tree during deploy.
  The host-managed live `.htaccess` is read-only to the pipeline: a Passenger-marker
  preflight fails closed before artifact activation, and a regression contract forbids
  `.htaccess.next`, `.htaccess.previous`, or any deploy `cp`/`mv` targeting it.
- Dependency lockfile was updated without `--force`; production audit reports
  zero advisories. Node 22 `test:phase3` passes 513/513 tests plus startup/history
  CLI, production build and browser smoke at 1440/390 px.
- The operator runbook is `docs/production-remediation-rollout-checklist.md`.
  Source is ready for a controlled rollout; no production deployment, restart,
  migration or database write was performed as part of this implementation turn.

## 128. cPanel Passenger configuration preservation hotfix - 2026-09-25

- A production deploy replaced the live cPanel-managed `.htaccess` with the
  repository static-policy file. LiteSpeed then returned its own HTML 404 for
  `/api/*`, so Firebase authentication could not complete `/api/me` profile
  verification. Restoring the live file and restarting through CloudLinux Node.js
  Selector returned `/api/me` to the expected unauthenticated JSON 401 and restored
  Admin login.
- `.cpanel.yml` now treats the live `.htaccess` as host-managed state. It performs
  only a read-only Passenger-marker preflight and never copies, snapshots or moves
  the file. Application rollback remains limited to server and root/dist index
  artifacts; database, persistent media and cPanel environment blocks are outside
  that operation.

## 131. Staff vocabulary-preview leaderboard routing - 2026-09-26

- The production remediation split leaderboard reads into public, capability and
  staff endpoints, but `StudentLearningArea` continued to call only the
  capability endpoint. An Admin/teacher assignment preview carries an assignment
  ID without a share token, so the backend correctly rejected its `Xem bảng vàng`
  request with HTTP 403 `A valid lesson or assignment capability is required.`
- `learningLeaderboardRequest.ts` is now the client routing boundary. A real
  assignment or private-set share token always takes precedence and continues to
  call `/api/learning/leaderboard-summary` with only
  `X-Vocab-Share-Token`. A verified teacher/super-admin preview without a share
  token calls `/api/admin/leaderboard-summary` with its Firebase bearer token and
  bounded `gold`, page 1, page-size 8, vocabulary-set and optional class filters.
  Staff state waits for its bearer token instead of falling through to a request
  that is guaranteed to be denied.
- Guest and student public lessons keep the capability-scoped learning route.
  Private assignments without a valid share token remain denied. No server role,
  ownership policy, public endpoint, response shape or cache rule was weakened.
- Regression coverage locks assignment preview, public staff preview, share-token
  precedence, student/guest behavior and the missing-bearer wait state. The full
  Node 22.16 `test:phase3` gate passes, including native SQLite storage, production
  client/server build and startup smoke. A local HTTP smoke returns 200 for the
  authenticated staff summary while the same fake private assignment without a
  capability remains 403; the temporary local server and database are removed.
- This fix adds no database migration, data backfill, persistent-data write,
  `.htaccess` change, runtime environment change or production restart/deploy.

## 137. Young Learner media-height and Listening-width alignment - 2026-09-27

- Starters Reading & Writing Parts 2 and 4 opt into the shared stretched split
  layout; Part 5 applies the same rule independently to every story scene. The
  left image frame now follows the full height of its adjacent example/task
  column on desktop while the complete image remains fitted with
  `object-contain`. Movers Reading & Writing Part 2 now opts into the same
  already-released balance mechanism used by its Parts 1, 4 and 6.
- Every Flyers Listening Part and Starters Listening Part uses the same outer
  student frame width (`90%`, capped at `1350px`). Movers Listening Parts 1–4
  use that width while Part 5 retains its previously tuned frame. These are
  presentation-only container changes: image stages, normalized rendered-image
  coordinate conversion, drag/drop targets, colour overlays, drawing geometry,
  submitted answers and grading remain unchanged.

## 138. Shared student attempt chrome for Listening and Reading & Writing - 2026-09-27

- `StudentExamAttemptShell.tsx` is the presentation-only boundary for the live
  attempt header, answered counter, timer, submit action, rectangular Part tabs
  and rectangular previous/next controls. It intentionally does not own Part
  content, answers, media, grading or coordinate conversion.
- `GenericExamLearningArea.tsx` now uses that shell for Reading & Writing and
  for the Young Learner/KET/PET Listening branch. Generic future Listening
  definitions (including FCE/IELTS when enabled) inherit the same shell without
  adding an exam-specific navigation implementation.
- `ListeningLearningArea.tsx` uses the same shell for Movers Listening while
  preserving its fullscreen and hint actions and the exact existing Part-view,
  audio, image-stage and normalized-coordinate hooks.
- The old Listening-only orange progress strip, oversized level badge, circular
  Part dots and circular edge arrows were removed from live attempts only.
  Authoring, preview/result/history screens, APIs, schemas and graders are not
  changed. Regression contracts lock the shared shell and the unchanged
  content-stage hooks.

## 139. Reading-width alignment for Listening attempt frames - 2026-09-27

- The shared attempt shell now gives its header, Part tabs and bottom
  previous/next controls the same `max-w-7xl` container and horizontal padding,
  so their left and right edges stay aligned at every supported viewport.
- Starters and Movers Listening Parts now share one Reading & Writing-width
  outer frame; Movers Part 5 no longer switches to the wider legacy container.
  Flyers, KET and PET Listening use the same thin Reading & Writing border and
  width, while future generic FCE/IELTS Listening papers inherit that frame from
  the common shell.
- Dedicated Movers Reading & Writing now also consumes
  `StudentExamAttemptShell`, eliminating its separate header/Part navigation
  implementation. Inner audio, images, Part views and normalized image-coordinate
  calculations remain unchanged, so drag/drop, colour and drawing targets keep
  their existing geometry.

## 140. Movers Listening Part 2 answer-line alignment - 2026-09-27

- The learner rows in Movers Listening Part 2 use a fixed three-column desktop
  grid for question number, prompt and answer area. Every dotted answer line now
  begins and ends on the same vertical guides, keeps the same gap from the prompt
  column and sits vertically centred inside an equal-height question row.
- On narrow screens the answer area wraps below the prompt instead of shrinking
  outside the card. Multiple blanks still share the same fixed answer area.
- The change is presentation-only and remains scoped through the existing Movers
  `balanceMediaColumn` path. Answer IDs, stored values, text-entry guards,
  submission and grading are unchanged; the Starter Part 2 layout is unaffected.

## 141. FCE Reading three-Part workflow - 2026-09-27

- New B2 First Reading drafts use `templateVersion: fce-reading-3-v1` and a fixed
  `8-7-15` structure. Part 1 is an article with eight four-choice questions;
  Part 2 is a seven-gap article using one shared A-H sentence bank; Part 3 is
  fifteen multiple-matching statements against a teacher-owned image containing
  the four source texts A-D. The previously released combined
  `reading-use-of-english` definition remains addressable for immutable legacy
  sets and old URLs, but it is hidden from new-paper directories.
- `fceReadingMigration.ts` is the compatibility boundary. It owns consecutive
  printed numbering 1-8, 9-15 and 16-30, the three interaction variants, shared
  option-bank normalization and one-point objective scoring. It only normalizes
  explicitly versioned FCE Reading content and never rewrites old combined sets.
- `FceReadingAuthoring.tsx` provides the teacher workflow: full passage and four
  options for Part 1, inline `[[9]]`-`[[15]]` markers plus one A-H bank for Part
  2, and a managed Part 3 image with shared A-D labels. The Universal whole-paper
  and focused-Part prompt/import paths lock the same counts and shapes, reject
  technical IDs/media from ChatGPT output, preserve teacher-owned media and
  require official answer-key provenance.
- `FceReadingViews.tsx` supplies the learner layouts. Part 1 shows the article and
  opaque four-choice controls; Part 2 replaces every marker inside the passage
  with a typed-only single-letter input and renders A-H below as read-only text;
  Part 3 keeps the source image on the left and fifteen numbered A-D entry rows
  on the right. Typed letters map back to application-owned option IDs before
  submission, so the authoritative generic backend grader remains unchanged.
- `FceReadingResult.tsx` reuses the same three layouts for owner-checked visual
  review. Correct choices/letters are green, incorrect learner answers are red,
  unanswered rows are amber and the official answer is shown in context. The
  existing `exam_attempts` persistence and Learning History adapter continue to
  store and retrieve FCE Reading attempts without a new database schema.
- Publication validation enforces the three variants, exact counts, consecutive
  printed numbers, required passages, the Part 2 marker/bank/one-use contract,
  the Part 3 managed image and shared A-D bank. Regression coverage exercises
  prompt generation, import normalization, private answer sanitization, backend
  grading, legacy-definition visibility and the complete authoring/player/result
  dispatch.


## 142. IOE/Violympic isolated business module in B — 2026-10-04

- `src/shared/competition` owns question/answer contracts, untrusted JSON normalization, the PDF/image-to-ChatGPT prompt, and explicit playable sanitization. The first flow is JSON authoring → direct valid bank save → immutable paper → signed student attempt → review in B Learning History.
- `src/server/ioe-violympic` owns additive schema-v1 migrations, ownership/revisions/import idempotency, distinct-question selection, IOE joint blueprint allocation with quota relaxation, snapshot versions and server-authoritative grading/deadlines. Attempts reuse B identities/guest capabilities and the existing signing secret; no account/guest/media provider/storage adapter is ported from A.
- Default grades 1–9: English 100 questions for grades 1–2 and 200 for grades 3–9; Math/Vietnamese 30 questions without knowledge/difficulty quotas; 30-minute duration. Inadequate distinct total blocks paper creation.
- Frontend `src/features/ioe-violympic` mounts in the existing admin shell and `/ioe-violympic[/paper/:id]`. Supports choice, text/numeric input, ordering, matching, and question/option image/audio. Media picker/upload/generation/TTS are B services. Autosave is revision-aware, compact, resumable, and preserves local answer backups on conflict. Navigation for 200 questions is bounded on mobile.
- B assignments accept `resourceType: competition`; server resolves class/assignment/name snapshots from B. Completed attempts join the existing history CTE/detail normalizer and use a dedicated review renderer in the existing modal. Archived question/paper versions retain media usages; B asset archive and dry-run maintenance protect these references.
- Runtime capability requires SQLite and `IOE_VIOLYMPIC_ENABLED` not false; existing History ships independently of that flag. Migration is additive/idempotent and tested with legacy B records; production DB was not touched.
- Verification: `test:phase3` 533 pass/0 fail, including 7 competition tests; isolated desktop/mobile browser flow, 200-question IOE/game flow, and production-bundle guest/history/media smoke. Existing baseline CSS-budget failure was corrected by consolidating 75 identical PET Writing/KET reset declarations; all computed properties of 978 fixture controls remain equal. No assertion was weakened; pre-existing FCE work is preserved.
- Details, file boundaries, operational requirements/rollback, fixture-only QA commands and limitations: `docs/ioe-violympic-module.md`; checklist: `docs/ioe-violympic-checklist.md`. No commit/push/deploy.

## 143. IOE/Violympic four subjects, overview and complete results — 2026-10-04

- `math` retains its identifier and now displays as Toán. New `math-english` is an independent subject using the Math import, numeric grading, media, 30-question selection and signed attempt engine; its source content and text normalization are English. All four subjects support school/district/province/national; IOE also retains practice. No existing bank/version/attempt is rewritten and no schema/provider is added.
- Admin tabs are Tổng quan, Soạn JSON, Ngân hàng and Kết quả. `Overview.tsx` shows four grade 1–9 inventory tables plus actual question/player/started-attempt/completion counts. The new owner-scoped `/admin/overview` computes a consistent read snapshot; cell navigation respects unsaved authoring scope.
- `Results.tsx` has independent, initially empty subject/grade/level filters, explicit apply/reset and 50-row pagination across all authorized completed attempts. `/admin/results-page` validates optional filters and keeps archived-paper results; the legacy result API and existing B assignment/student/history contracts remain intact.
- Regression tests cover a full English Math run, rational/unit/text grading, separate subject banks, zero inventory, distinct players, unstarted attempts, teacher/admin boundaries, 201 completed attempts, pagination/filtering and archived history. Browser QA retains B assignment coverage through its API after the removed authoring tabs, and verifies both Math subjects, overview and explicit result filters.
- Release verification: `test:phase3` 535 pass / 0 fail; final scoped mobile table fix passes typecheck/build and browser geometry/contrast checks, followed by production-bundle guest/media/history smoke. 68 JS/CSS artifacts have no missing references; B's 978 CSS fixture controls remain equivalent. No database schema, dependency, secret or production changes in this adjustment.

## 144. Speaking / Luyện đọc isolated module — 2026-10-04

- `src/shared/speaking` defines validated word/sentence/dialogue/passage content and normalized technical results; `src/server/speaking` owns additive schema, teacher ownership/revisions, frozen publications, signed B-identity attempts, immutable WAV uploads, quotas and durable jobs with guarded leases. Errors retain null grades; retries are explicit and bounded, with no paid cross-provider failover.
- Azure Speech SDK 1.52.0 is pinned: one-word assessment and continuous non-word file sessions; SpeechSuper uses its signed English HTTP APIs and preserves rhythm separately from Azure prosody. Global word alignment handles omitted/inserted/repeated tokens. Provider/version/rubric and nullable unsupported metrics are retained; reading-v1 scores require teacher calibration.
- AudioWorklet plus filtered resampling captures PCM16/16kHz mono, preserves pauses, rejects silence/clipping/duration errors, stops sample audio while recording, and supports playback/download. Recordings live privately beside B's SQLite database with hash integrity and authenticated owner/staff access; expiry gates playback, with no unsolicited cleanup job.
- `src/features/speaking` adds `/speaking[/lesson/:id]`, an existing-dashboard tab, paginated/searchable owned lessons, authoring/TTS/publish/archive and initially unfiltered paginated results. Completed results join B's History CTE/detail modal using source `speaking`; no account/class/storage provider is duplicated and the old vocabulary Speaking game is untouched.
- B TTS gains an optional reading input profile through the same generation/cache/provider pipeline, preserving full 6000-character text while retaining the original 120-character vocabulary cleanup and speed behavior. Speaking strips B's timestamp cache-busting query before persisting managed sample URLs. Media orphan dry-run protects draft/version/attempt sample references.
- B's Gemini client supplies an independent optional metrics/audio feedback job; technical grade never changes, and holistic audio feedback remains separate. Benchmark runner calls Azure/SpeechSuper only with an explicit --run flag, or imports Chivox/SpeechAce/ELSA results; no vendor results are fabricated.
- Release gates: 553 pass / 0 fail including 18 Speaking tests, native/SQL.js additive migration, Node 22 build/startup, production-bundle guest/private-audio/capability smoke and isolated compiled-client desktop/mobile microphone/History/contrast QA. Local migration kept hashes of all 51 old tables / 1226 rows, with quick_check=ok. Local runs native SQLite WAL; `dev:local:native` selects this via B's existing launcher without changing its SQL.js option.
- At the initial handoff the user had no provider keys; live voice quality, teacher calibration and paid vendor benchmark remain explicitly unverified. Operational/configuration/checklist/artifact details: `docs/speaking-setup.md`, `docs/speaking-checklist.md`, `docs/speaking-verification.md`, `.env.speaking.example`. No commit/push/production deploy; pre-existing IOE/FCE changes preserved.
## 145. Speaking feedback through B's DevQuota/Stali gateways (2026-10-04)

- `src/server/speaking/feedback.ts` now selects `devquota`, `stali`, `gemini` or `none` explicitly with `SPEAKING_FEEDBACK_PROVIDER`. It reuses B's resolved credentials/base URLs and existing Responses/Chat Completions text extractors; absent flag preserves the original Gemini path.
- DevQuota/Stali explain finalized pronunciation metrics and reference text only, without private WAV or student identity. Provider failures, invalid schemas, unsafe configuration and timed-out requests cannot change the Azure grade or silently cause another provider/paid retry. Gemini's explicitly configured audio mode remains compatible; gateway audio mode is reported unavailable.
- Safe public capability adds provider/model/reason, displayed in the existing Speaking configuration tab. `.env.speaking.example` and `docs/speaking-setup.md` document root `.env`, Azure Speech key/region, B's existing LLM keys, Node 22 native local restart, and the end-to-end test steps.
- Nine new feedback contract tests extend `test:speaking` to 27; final `test:phase3` has 562 pass / 0 fail, with typecheck, canonical build and startup. Production-bundle and compiled-client desktop/mobile/configuration/microphone/History/legacy IOE smoke passed; diff check passed. Current log: `.data/speaking-feedback-phase3.log`.
- Latest local build: client `index-DcTLxX-0.js` / `index-DxkJNmjV.css`; server SHA256 `78DDDBC5AA3AB864E9FA0FF2B03FDC1A01354CC67E0275C01778CAA2B1860F00`. Localhost restarted with Azure/DevQuota configured, SpeechSuper unconfigured; SQLite quick_check=ok. No real vendor call or live scoring performed. Details: `docs/speaking-verification.md`; no schema/auth/technical-grader change or production deployment.

## 146. Speaking vocabulary/sentence sets and actionable sample-TTS errors — 2026-10-04

- Word/sentence lessons accept 1–50 ordered items, server-generated canonical IDs, individually validated reference/audio/rate, and a 20,000-character set bound. Editor supports one-item-per-line paste, item editing/reordering/media and read-only copy from authorized B vocabulary sets; existing one-content lessons and dialogue/passage stay compatible.
- Schema v2 adds speaking_sessions and nullable speaking_attempts.session_id/item_id. Owner sessions freeze the published definitions, use B identities/class context and bound child signed attempts to their actual item; retries are idempotent and daily limits remain per reading attempt. The student restores its server session before fetching public content, so edits to draft do not block a previously started frozen session.
- Every item retains its own WAV/grade/feedback. Session completion atomically freezes the latest successfully graded attempt per item and its arithmetic mean (set-mean-v1); pending/later concurrent re-grades cannot rewrite that completed result. Selected practice starts a separate subset session from the source version. B History/admin results exclude child rows and show one row per completed session with the shared item-level review; partial sessions retain progress without fabricated grades.
- SampleAudio provides managed B audio or browser/device speech without creating a file. Missing AI33_API_KEY/TTS_API_KEY is reported in safe capabilities and disables cloud TTS controls; POST /admin/sample returns an actionable 503 before any provider call, and runtime provider failure returns sanitized 502. Azure pronunciation/LLM configuration remains independent; no new TTS provider/cache/storage is added.
- Media orphan maintenance protects nested item audio in drafts, immutable versions and session snapshots. Additive migration passed native copy/idempotency and SQL.js checks; actual local comparison preserves hashes of 56 old tables/1226 rows, quick_check=ok, no fixture writes to the user database.
- Final release gates: 571 pass/0 fail (36 Speaking), typecheck/canonical Node 22 build/startup, production-bundle B-guest set/child/private-audio/History/IOE smoke, and compiled-client desktop/mobile bulk/import/microphone/recording-protection/frozen-resume/selected-practice/review QA. Controls >=5.78:1; screenshots reviewed. Latest entry index-Cz1X57Mi.js, 73 JS/CSS assets; server SHA256 A53E7BB61109E9249E902E127F4A54D9CAF632AE38C85467F8A8A5C29B1C1D21.
- Localhost restarted with Azure/DevQuota configured and B TTS absent. The exact old failing TTS route now returns SAMPLE_TTS_UNAVAILABLE (503). Live voice scoring/key entitlement and teacher calibration remain unverified; automated providers only exist in isolated tests. Operational/checklist/verification details remain in docs/speaking-*.md. No commit, push, production deploy or unrelated IOE/FCE change.

## 147. Vocabulary flashcard image/text intrinsic layout — 2026-10-04

- FlashcardGame replaces its fixed 380px/absolute faces with one intrinsic grid row. Both faces contribute to the height, so prompt/answer images, long terms, meanings, examples and notes fit without internal scrolling or clipping when flipped. Motion owns the rotation; CSS transitions only the shadow.
- FlashcardGame.css is lazy-loaded with the game and scoped under #flashcard-game-root. Primary text is 20–32px, meanings 18–26px and IPA 14–18px; long unbroken text wraps. Image frames fit the image and constrain it to the available width/280px and 220px height while preserving its natural aspect ratio. Shared VocabItemImage, other games, scoring/audio handlers, APIs and stored data are unchanged.
- Baseline reproduced the reported sentence/image clipping: the old face had 376px available and 466px of content at 620px viewport width. Final test:flashcard-layout renders the real component with canonical global CSS and covers six fixtures at 1440/620/390/320px, both faces, pointer input, long text/notes, portrait/wide/square/broken/absent images and sound-only. All 24 cases pass; keyboard focus is 3px, minimum computed text contrast is 5.12:1, known/unknown completion stays 50/1/1, and no browser exception/overflow is reported.
- Final Node 22 test:phase3 gate: 571 pass/0 fail, typecheck/canonical build/startup pass. Post-build Speaking and IOE bundle smokes pass on isolated fixture databases; localhost serves the changed scoped CSS (200). Visual desktop/mobile screenshots and diff are reviewed; docs/flashcard-layout-checklist.md records the checks.
- Latest local build: index-BawVN84d.js / index-UiZPLWL7.css, 74 JS/CSS assets, including FlashcardGame-aKikmj7K.js / FlashcardGame-DgHIbkjy.css. Server remains 1,453,476 bytes with SHA256 A53E7BB61109E9249E902E127F4A54D9CAF632AE38C85467F8A8A5C29B1C1D21. No production deploy, commit/push, schema/media changes or writes to the user database.

## 148. Speaking editor persistence feedback and Azure sample TTS — 2026-10-04

- Speaking editor keeps Save draft and Publish. Shared validation now runs before saving, with visible error/focus beside the footer actions and preservation of entered items. Successful saves refresh the staff bank without stale search/page filters. Publish automatically saves new/changed valid content before publishing with the returned revision; unchanged published content cannot be republished. Word items still require one word; a twelve-question sentence list uses the Sentence kind.
- `src/server/tts/azureReadingProvider.ts` uses the existing pinned Speech SDK and Azure Speech key/region for sample MP3 synthesis. Explicit `SPEAKING_SAMPLE_TTS_PROVIDER=azure` selects this reading-only adapter; absent flag or `b` keeps B TTS. The existing B cache/hash/atomic-write/in-flight pipeline and TTS rate limiter are reused. Language/voice, key/region, timeout, MP3 and byte limits are checked; errors exclude raw SDK details. No paid failover or application retry, schema/auth/grader/History change, or new media store.
- Azure TTS defaults to en-US-JennyNeural/en-GB-SoniaNeural at synthesis speed 1.0. General vocabulary/game generation and voice listing remain on B providers. Safe capability reports selected provider/configuration and drives the editor controls. `.env.speaking.example` / docs/speaking-setup.md document selection and local restart.
- Final Node 22 gate: 578 pass/0 fail (43 Speaking), typecheck/canonical build/startup pass. Compiled browser regression covers long invalid input feedback, twelve-item draft persistence/reload, direct publication and republishing without duplicates, desktop/mobile/focus/contrast (>=5.78:1), recording/session/review/History. Post-build Speaking/IOE production-bundle smokes and all 24 flashcard layout cases pass; diff-check passes.
- Localhost restarted with Azure samples enabled. Live sample `apple` returns 200 and valid 15,264-byte MP3; a repeated request is cached. Real UI displays the working sample button/audio/success message and enabled Publish; browser decodes 1.908 seconds with no audio error. An initial sandbox outbound EACCES was resolved by running the authorized local server outside that network restriction. No test bank lessons written; 1,244 pre-existing rows remain byte-identical, with 61 concurrent additive IOE rows preserved. SQLite quick_check=ok/WAL. Live student grading/LLM/SpeechSuper were not exercised in this change.
- Latest local build: index-C384FLZ5.js / index-UiZPLWL7.css, 74 JS/CSS assets; server 1,459,701 bytes, SHA256 8E69F6860152040353129A4E5BBF08908F20B7813F1C59D41B89EF32C36BCBC8. Checklist/proof: docs/speaking-editor-azure-checklist.md and `.data/speaking-editor-*` logs. No production deployment or commit/push.

## 149. Compact, read-only IOE overview tables — 2026-10-04

- Overview inventory is a semantic table of plain counts: no buttons, cell borders, hover or drill-down callback. Zero/missing counts display an em dash; positive counts use Vietnamese number formatting. Scope labels stay accessible, with compact visible Trường/Phường/Tỉnh/Quốc gia headings. Subject summaries and metric cards have reduced spacing; the four subjects and nine grades remain.
- Only Overview.tsx, its Admin call site and feature-scoped overview CSS change product behavior. Inventory APIs, ownership, data, bank authoring, engine, grading and History are unchanged. Existing browser assertions now check read-only cells; an optional --overview-only path returns before fixture writes and compares every displayed count to the API.
- Verification: 9 competition tests, typecheck/canonical Node 22 build and production bundle smoke pass. Isolated compiled-browser full flow passes JSON/bank, Math/English Math 300/300, IOE 200-question games, review/History and desktop/mobile results; 0 browser exceptions. Final read-only localhost check at 1280/390/320px has no overflow/clipped cells and no interactive inventory elements; table height is 237/237/253px, down from 542px. Screenshots reviewed. Existing control CSS equivalence covers 978 controls. Checklist: docs/ioe-overview-compact-checklist.md.
- Latest local client entry index-DEMNDZ6K.js / index-UiZPLWL7.css, 74 JS/CSS artifacts. Server remains 1,459,701 bytes, SHA256 8E69F6860152040353129A4E5BBF08908F20B7813F1C59D41B89EF32C36BCBC8. Localhost 3000 serves current source; isolated QA servers are stopped. No database changes from localhost checks, commit/push or production deploy.

## 150. IOE student play directly from the shared bank — 2026-10-04

- The empty student directory was caused by listing only explicitly published fixed papers after the paper-authoring tab had been removed. `BankDirectory.tsx` now shows readiness for the shared subject/grade/level bank, initially empty filters, exact shortfall and a refresh action. Fixed public papers and their old URLs remain available separately. No publication step is needed for bank practice.
- Public `/api/ioe-violympic/bank-topics` reads 153 supported scopes with active stored and distinct-fingerprint counts; loading the catalog writes nothing and exposes no answers/owners. Stable `bank-{subject}-{grade}-{level}` IDs use the existing paper URL/prepare route. English requires 100 questions for grades 1–2 and 200 for grades 3–9, with the flexible IOE blueprint; Math/English Math/Vietnamese require 30 questions without difficulty/knowledge quotas. All use 30 minutes.
- New prepares select from all teachers' active questions within the scope, deduplicate, and atomically store a new frozen paper version/attempt in existing tables. The owner/clientRunId retry path runs before sampling; retries resume the original version even when the current bank is depleted. Old versions retain media, review and History after edits/archive. No schema/dependency/secret changes.
- Bank editing ownership remains B's. Shared-bank attempts appear in the student's own B History and super-admin results; contributing a question does not give a teacher access to unrelated students' shared-bank attempts. Fixed paper/class/assignment permissions stay intact. Assignments reject dynamic bank scopes to avoid creating a fixed-assignment link without a fixed publication.
- Verification: 10 competition tests and 5 assignment tests; full gate 581 pass/0 fail. Compiled browser checks ready/empty/loading/error, 1440/390/320px, Math/English Math 300/300, IOE 200 questions/games, autosave/reload/review/History and old fixed-paper assignments; zero browser errors. Production bundle guest flow from the bank scores 300/300 and retains media/History; local auth bypass is rejected in production.
- Read-only localhost proof: `bank-math-3-school` has 30 distinct questions, ready=true, 30 minutes. Before/after restart, all 58 tables/1,310 rows match the native checkpoint, quick_check=ok, WAL. Evidence/checklist: `docs/ioe-bank-start-checklist.md`, `docs/ioe-violympic-module.md`, `.data/ioe-speaking-{final-phase3,local-proof,preservation-report,artifact-report}` and `.data/ioe-bank-start-final-bundle.log`. No QA lessons/attempts written to the real local DB, commit/push or production deploy.

## 151. Speaking flashcards and automatic signed WAV upload — 2026-10-04

- `src/features/speaking/Student.tsx` displays one word/sentence card, compact progress and previous/next controls, instead of a grid of every item. The card uses the vocabulary game's visual pattern while retaining Speaking sessions/scoring. Feature-scoped CSS allows intrinsic card height and wrapping 20–32px text; dialogue/passage retain one-content presentation and full review.
- A completed, validated PCM16/16kHz WAV automatically uploads once after manual stop or the configured duration limit. A synchronous operation guard prevents double submission. On network failure the WAV remains available for playback/download/explicit retry; polling/rendering never resends it. No silence-triggered stopping, provider fallback or automatic paid retry is added.
- Recorder generation/open/stop guards protect identity/unmount and concurrent microphone operations; denied permission has a clear message. Navigation stays locked during recording/upload or while bytes remain unsent, with beforeunload protection. After server acceptance the student can move to another card or leave while the existing durable job grades. Points appear on the card and detailed phoneme/AI feedback opens in a disclosure.
- All existing B identity, signed attempt/audio upload, private recordings, frozen sessions/publications, result aggregation, History and Azure/DevQuota configuration remain. No Speaking server/provider/schema changes in this UI adjustment; the old vocabulary game is preserved.
- Final gate: 581 pass/0 fail including 43 Speaking tests, typecheck/canonical Node 22.16.0 build/startup. Compiled microphone/browser tests cover manual/max-duration automatic upload, network preservation, explicit double-click retry, accepted navigation, silence rejection, permission denial, missing provider, long text at 1440/390/320px, editor drafts/direct publish, frozen session resume, selected practice, results/review/History; 0 browser errors, computed contrast >=5.78:1 and keyboard focus 3px. Browser scoring responses are mock fixtures; no live pronunciation/LLM call was made.
- Both post-build production bundle smokes pass. Localhost is running Node 22/native SQLite WAL with Azure assessment/sample TTS and DevQuota metrics configured. Latest client entry `index-e7mfwfuZ.js` / `index-UiZPLWL7.css`, 74 JS/CSS; server 1,464,016 bytes, SHA256 `8DDE5557A4F48D43DEC1D4B4A54FA243A9BB62B40A1196D432BAC2A7D0CBA2B3`. Vite retains the existing large-chunk warning without build errors. Evidence: `docs/speaking-flashcard-checklist.md`, `docs/speaking-verification.md`, `.data/speaking-flashcard-final-{browser,bundle}.log`; shared artifact/database proofs are in section 150. No commit/push/deploy.

## 152. Interactive IOE question preview in the viewport — 2026-10-04

- Bank Xem trước previously rendered a disabled QuestionView after the 30-row table; the local reproduction placed it at y=3592px in an 853px viewport. `QuestionPreview.tsx` now opens a native modal immediately, using the same sanitized playable content and QuestionView renderer as the student. The valid draft preview opens the same modal; the old raw answer-spec JSON display is removed.
- Choice, text entry, ordering and matching hold a local answer state with a reset control; preview never prepares an attempt, grades, saves a response or writes History. Media remains B's existing question/option media. Closing/reopening clears the trial answer while leaving bank/draft content intact. Student/player/server/schema/providers are unchanged.
- The dialog has a labeled heading/description, autofocus, Tab/Shift-Tab bounds, Escape/backdrop/button close and trigger-focus restoration. Its close handler ignores an old queued cleanup event when React Strict Mode has reopened the dialog. Feature-scoped intrinsic/scrollable layout and sticky close header fit desktop/mobile, including 320px; global CSS overrides are verified through computed style.
- Verification: baseline 10 competition tests; after-change 61 scoped competition/admin/History/legacy tests pass, typecheck/canonical Node 22.16.0 build/startup pass. Compiled fixture browser exercises valid-draft and all four bank interaction types, media, selected/reset/reopen/close/focus, 1440/390/320px, no preview API writes, and the existing Math/English Math/IOE games/assignment/autosave/reload/review/History flows. Zero browser exceptions/overflow; preview control contrast >=6.70:1; all 978 legacy fixture controls retain computed style. Both IOE/Speaking production-bundle smokes pass.
- Local --preview-only regression passes against the real Math bank without fixture writes. All 58 tables/1,310 checkpoint rows retain hashes, quick_check=ok/WAL. Three additive rows for a live 30-question bank run were created at 15:07:30Z, before baseline browser QA at 15:09:33Z; these remain intact. No cleanup, commit/push or production deploy.
- Latest client `index-B8glmBUO.js` / `index-UiZPLWL7.css`, 74 JS/CSS; server unchanged at 1,464,016 bytes, SHA256 `8DDE5557A4F48D43DEC1D4B4A54FA243A9BB62B40A1196D432BAC2A7D0CBA2B3`. Evidence/checklist: `docs/ioe-preview-checklist.md`, `.data/ioe-preview-final-report.json`, `.data/ioe-preview-{compiled-browser,local-browser,final-build,final-bundle,speaking-bundle}.log`; module behavior docs: `docs/ioe-violympic-module.md`.

## 153. Enter advances answered IOE/Violympic questions — 2026-10-04

- `Student.tsx` opts the active question into `QuestionView` keyboard navigation. Enter in a nonblank text input or on the selected choice advances one question, bounded at the final question; it never invokes submit. Busy/conflicted/submitting/completed attempts cannot advance through this callback. Existing answersRef/local backup/autosave/signed API behavior is preserved.
- Focus moves to the next question's input or selected/first choice. Enter on an unselected choice retains native button activation, including changing a previous choice, before a later Enter advances. IME composition/keyCode 229, modified Enter and auto-repeat do not navigate; repeat also suppresses native activation on the next choice. Empty/whitespace text stays on the question. Preview/review omit onNext; media, ordering/matching and other controls keep their existing keyboard behavior. No CSS/server/schema/provider changes.
- Baseline 10 competition tests pass; after change 61 scoped competition/admin/History/legacy tests pass, TypeScript/canonical Node 22.16.0 build/startup pass. Compiled fixture browser verifies native choice selection/change, text/choice advancement/focus, guards, save/reload, final-question safety and a single submit. All 30 English Math questions are traversed with Enter and score 300/300; the old Math assignment, IOE 200-question games, preview/media/review/History/dashboard flows also pass.
- Desktop/mobile 1440/390/320px have zero overflow/browser exceptions, computed control contrast >=6.70:1 and visible 3px focus; screenshots reviewed. All 978 legacy controls retain computed style. Initial browser simulation omitted the Enter character, producing no native keypress/click; an isolated native-button probe demonstrated the issue, and the CDP helper was corrected without weakening assertions or changing product code for it.
- Both IOE/Speaking production-bundle smokes pass. Real localhost serves both changed source modules (HTTP 200); the real DB was inspected read-only and retains quick_check=ok/WAL. All QA writes target fresh fixture databases/copies. No commit/push/deploy.
- Artifact: `index-DjulWzQw.js` / `index-UiZPLWL7.css`, 74 JS/CSS; server unchanged at 1,464,016 bytes, SHA256 `8DDE5557A4F48D43DEC1D4B4A54FA243A9BB62B40A1196D432BAC2A7D0CBA2B3`. Checklist/evidence: `docs/ioe-enter-checklist.md`, `.data/ioe-enter-{browser-report,artifact-report}.json`, `.data/ioe-enter-{build,browser,startup,bundle,speaking-bundle,native-probe}.log`.

## 154. Student IOE subsystem, private wrong practice and Speaking signal gate — 2026-10-05

- Finish three pending authorized requests. `/ioe-violympic` now uses `StudentPortal.tsx`, inspired by A's StudentHomeView/MockExamHubView: hero/real stats/activity cards, Tổng quan/Thi thử/Luyện tập and the existing B History. Thi thử offers all four subjects and samples the shared bank by scope; existing 100/200/30 counts and 30-minute server timer remain. No published paper is required. Fixed public papers and old assignment links remain compatible.
- New `src/server/ioe-violympic/practice.ts` derives pending wrong questions from this owner's completed snapshots/review in B's existing competition tables, in completion insertion order. Skip unanswered questions; latest answered outcome per question ID determines pending/mastered. Frozen source content/answers/media survive bank edits/archive, all old History remains immutable. Owner-verified `GET /practice` gives stats/scoped metadata/previews without answer keys; private `mistakes-{subject}-{grade}-{level}` metadata and prepare never accept a browser question list or owner override.
- Wrong practice samples up to 10 in one scope, including a 1-question queue, through the existing signed engine/30-minute server timer/autosave/submit/review/History. Empty queues do not fall back to random bank questions. Immutable versions use `source: mistakes` and assignment visibility; dynamic scopes cannot be published as fixed catalog papers, deleted through the admin paper route, or assigned through B's assignment service. Same owner/clientRunId returns the existing snapshot before resampling, even after mastery. No new schema, table, profile, provider or migration.
- IOE authoring always displays Tải ảnh/Dán ảnh/Tải audio/Nghe thử via B's existing file/paste/upload/play components. Remove IOE AI-image/TTS-generation sections, source-number input and raw whole-question JSON editor. Preserve imported sourceNumber/game fields, advanced answer editor, original game/player/preview/media ownership and existing B providers. Editor locks during upload.
- Speaking's old global RMS gate diluted short readings by surrounding silence; a separate server fixed-amplitude sample quota rejected the same valid WAV. Shared `audioQuality.ts` uses 20ms PCM frames, DC removal and >=80ms active signal with RMS >=0.002. Raw PCM stays unchanged; silence/DC/one-sample clicks/near-inaudible/clipping remain rejected. `useRecorder.ts` requests supported auto gain, adds device selection/live meter/clearer errors and a stop timer alongside sample cap. Existing signed/private audio, provider grading, retry protection and flashcards remain.
- Verification: 584 pass / 0 fail in full test:phase3, including 11 competition and 45 Speaking tests; final typecheck/canonical Node 22.16.0 build/startup and both final production bundle smokes pass. Compiled fixture browser exercises the complete portal/bank/wrong/mastery/History flow (2 wrong + 28 unanswered -> 2 practice correct -> 0 pending), all four subjects, 30/200 question players, legacy assignment/Enter/autosave/preview/media/review/dashboard. Browser AudioWorklet accepts the previously rejected low-gain phrase on manual stop (4.05s/RMS0.001889) and timeout (8s/RMS0.001344), with explicit retry/no duplicates/silence/permission/missing-device gates. No real pronunciation call was made.
- Screenshots at 1440/390/320px reviewed; zero overflow/browser exceptions, controls >=6.70:1 IOE and >=5.78:1 Speaking, all 978 legacy controls retain computed CSS. Audio preview's browser QA now uses a trusted mouse gesture, matching Chrome's autoplay requirement; no product workaround. A final reset error guard keeps missing guest credentials in the visible error path.
- Native verified backup `.data/ioe-portal-before/local-test-2026-10-05T00-34-53-962Z.sqlite`; production-shaped copied-DB exercise retains all 58 tables/1,314 original rows and leaves live DB unchanged. QA uses isolated databases/media directories; unrelated user/FCE work preserved. Localhost restarted Node 22/native WAL, runtime Azure configured, DevQuota configured; new portal/media/microphone source GETs and owner practice endpoint return 200. No key printed/changed, cleanup, commit/push or deploy.
- Final artifact `index-C0GMsPY1.js` / `index-UiZPLWL7.css`, 76 JS/CSS; server 1,470,244 bytes, SHA256 `68F40FB500BC019F035418874EA594C2482AF47A67FE32C1A5057D9A60915131`. Final compiled browser rerun after the reset error guard and local read-only bank preview also pass. Evidence/checklist: `docs/ioe-portal-speaking-checklist.md`, `docs/ioe-violympic-module.md`, `docs/speaking-verification.md`, `.data/ioe-portal-{speaking-regressions,compiled-browser,final-browser,final-build,final-lint,final-startup,final-bundle,local-preview}.log`, `.data/speaking-audio-{browser,final-bundle}.log`, `.data/ioe-portal-{artifact-report,local-proof,preservation-report,final-report}.json`.

## 155. Independent optional IOE bank filters — 2026-10-05

- `src/features/ioe-violympic/Admin.tsx` separates bank filters from the required authoring scope. Subject/grade/level start empty, listing every unarchived question allowed by B ownership. Drafts no longer disable or constrain bank filters; authoring retains its locked draft scope. Bank automatically loads only in its own tab; save still refreshes it explicitly. Changing filters/search/page clears checked rows; aborted reads cannot replace the current page, loading hides stale rows, and a read failure offers the existing retry without an endless loading/false-empty state.
- `QuestionFilters = Partial<Scope>` and `parseQuestionFilters` support blank or individual GET conditions with malformed input and incompatible subject/level validation. `listBank` adds parameterized conditions only when present, retaining owner restriction, literal escaped search, soft archives, stable sorting and 30-row pagination. `GET /admin/questions` uses this parser; POST/PUT still require `parseScope`. Student shared sampling, private practice, signed engine, result/History, schema, provider and auth contracts remain unchanged.
- Bank toolbar groups subject/grade/level/search/bulk-delete on one desktop row; scoped CSS uses responsive rows on narrow viewports. Editing/copying a combined-bank row chooses its original scope; incompatible existing drafts are preserved and require save/discard before that row is added. No silent reclassification or extra draft bank is introduced.
- Validation: baseline 11 competition tests; final 69 scoped tests (13 competition, 16 admin, 34 History, 6 legacy), typecheck/canonical Node 22.16.0 build/native startup and both IOE/Speaking production-bundle smokes pass. Compiled browser covers 60 states, including default/partial filters/search/empty/pagination/check clearing/draft protection/edit/copy/loading/error retry/focus and all previous student/assignment/autosave/Enter/preview/media/review/History/practice flows. Zero browser exceptions, contrast >=6.70:1, all 978 legacy controls retain computed CSS. Desktop 1440/1280 and mobile 390/320 screenshots reviewed.
- Local --bank-filters-only browser passes without question writes: empty GET conditions match the unfiltered API and display all 30 real bank questions. Native verified backup `.data/ioe-bank-filters-before/local-test-2026-10-05T14-45-46-513Z.sqlite`; all 58 tables/1,330 rows retain hashes, quick_check=ok. Browser fixture DB/media are separate; unrelated FCE/user changes and Azure/DevQuota configuration preserved. Localhost runs the updated backend. No commit/push/deploy.
- Artifact `index-DUPuH_V-.js` / `index-UiZPLWL7.css`, 76 JS/CSS; server 1,471,380 bytes, SHA256 `47DCA3DB8928D710B6E1C8A8986CDB06123264360D27BC721644272B823B1B8B`. Checklist/behavior: `docs/ioe-bank-filters-checklist.md`, `docs/ioe-violympic-module.md`. Evidence: `.data/ioe-bank-filters-{tests,admin-tests,history-tests,legacy-tests,final-lint,build,bundle,speaking-bundle,compiled-browser,local-browser}.log`, `.data/ioe-bank-qa-lr9hCt/browser.log`, `.data/ioe-bank-filters-{final-report,database-report,local-report}.json`. Browser helper `scripts/ioe-bank-filters-browser-checks.mjs` is read-only by default; fixture writes require the existing explicit isolated-QA opt-in.

## 156. Speaking Azure prosody availability and provider metric presentation — 2026-10-05

- Root cause confirmed from local configuration and four real completed results: SPEAKING_AZURE_PROSODY=false; Azure en-US sentence assessments contained prosody=null/rhythm=null. Installed Speech SDK 1.52.0 already used the correct enableProsodyAssessment setter. Azure exposes ProsodyScore covering intonation/stress/speed/rhythm, only for en-US, with no separate RhythmScore.
- Enable the existing local opt-in flag without changing keys/region/provider. providers.ts adds a typed SDK configuration helper and propagates actual request availability into optional assessment.prosodyStatus (available/disabled/unsupported-locale/not-returned). capabilities adds a nonsecret optional azureProsody descriptor; admin config shows enabled/disabled. Other environments retain opt-in defaults, no fallback provider or automatic paid retry.
- shared/speaking/metrics.ts supplies the shared student/admin/History Review presentation. Azure shows one combined Ngữ điệu & nhịp điệu (prosody); SpeechSuper retains its independent rhythm. Specific missing reasons replace the generic missing text; zero remains a measured score, legacy snapshots remain readable and measured extension fields are preserved. No duplicated/imputed scores, rubric/overall/AI changes, schema/table migration, recorder or global CSS changes. Old completed results are immutable; new en-US readings obtain new metrics.
- Verification: baseline 45 Speaking tests; final 118 scoped tests (49 Speaking, 13 competition, 16 admin, 34 History, 6 legacy) plus History CLI, typecheck/canonical Node 22.16.0 build/native startup and both production bundle smokes pass. New regressions verify real SDK request serialization, normalize statuses/invalid/zero/duration-weighted prosody, SQLite persistence and B History with owner boundaries. Native production-shaped backup reads all four old results unchanged.
- Compiled Speaking browser retains draft/publish/AudioWorklet/flashcard/auto-upload/manual-stop/timeout/retry/resume/selected-practice/review/History. Seven added provider/status cases fit 11 viewport states; zero errors/overflow, controls >=5.78:1, visible focus and screenshots reviewed. New metrics browsing sends no writes. Main browser fixture disables real provider keys/prosody explicitly; optional live checks are separate.
- One opt-in live Azure TTS + pronunciation request using a synthetic 2.325-second en-US sentence returned prosody=91.2/status=available, accuracy=93, fluency/completeness=100, rhythm=null. No student identity/audio or database writes. This confirms real resource/adapter capability, without claiming teacher validation on real student voices. Live script scripts/speaking-live-prosody-check.ts emits only sanitized metrics and is absent from automatic test scripts.
- Localhost restarted Node 22/native WAL: real capabilities shows prosody enabled, admin config verified at 1440/390/320px, changed Review source HTTP 200 and all four real old result GETs unchanged. All 58 tables/1,330 rows retain hashes, quick_check=ok. Native backup .data/speaking-prosody-before/local-test-2026-10-05T15-00-30-441Z.sqlite. Local CDP harness corrected Windows headless GPU flags and Boolean DOM readiness serialization without product changes/assertion reductions. Unrelated user/FCE/IOE work preserved; no cleanup/commit/push/deploy.
- Artifact index-CJg8xPO1.js / index-UiZPLWL7.css, 76 JS/CSS; server 1,471,964 bytes, SHA256 18E7E365FF1453D99D2BD4A9DDDEF33709E96AC0028A6F0A45BBE2B9A0F53C51. Checklist/setup/verification: docs/speaking-prosody-checklist.md, docs/speaking-setup.md, docs/speaking-verification.md. Evidence: .data/speaking-prosody-*.log, .data/speaking-prosody-{live-azure,copy-report,local-report,db-report,final-report}.json and .data/speaking-verification/browser-report.json. Browser helper scripts/speaking-prosody-browser-checks.mjs tests read-only score presentation.

## 157. Speaking recording renewal/replay and public Home display names — 2026-10-05

- A restored Speaking set contained two prepared attempts older than 24 hours; its four completed attempts were valid and unchanged. `service.ts` exposes additive `AttemptView.recordingAllowed` using server time. New `features/speaking/recordingAttempt.ts` resumes/renews on the explicit Thu âm action before microphone access, retaining a renewal idempotency key after a lost prepare response. Valid attempts are reused; the browser clock never decides expiry. Student navigation, frozen sessions, accepted uploads, explicit completed-item practice, scores and B History remain; no schema or ticket/upload lifetime change.
- `Speaking/Review.tsx` keeps Nghe lại after downloading, resets full playback to start/unmuted/volume 1/rate 1 and clears a previous word segment. Add download, payload/decode/autoplay errors, abort/stale-download guards and keyed item cleanup. Recordings remain private B storage/authorized GET with existing retention. Four real WAV GETs have valid signal (RMS 0.137–0.271, 3.2–4.76s); the user's browser advances playback without decoding errors. Actual speaker audibility has not been confirmed; these measurements are not described as a completed hardware-audio fix.
- User explicitly chose display names visible to everyone on Home. Results service resolves B names for bounded ranked winners only, preserves the seven-field public DTO and uses `public:names-v1` cache keys. Identity/contact fields stay server-side; lesson-scoped summaries remain anonymous, admin ownership and retired raw public feed unchanged. Home wraps complete names and ignores an aborted period response after JSON parsing. Ranking, scores and period eligibility are unchanged; current local week/month has no eligible events and is correctly empty.
- Verification: full phase3 596 pass/0 fail (22 invocations, 53 Speaking/12 Results API), lint/canonical Node 22.16.0 build/native startup and both post-build bundle smokes pass. Compiled browser validates expired renewal/valid reuse with skewed client clock, actual fixture-WAV playback/replay/volume/word/full/download/payload errors/autoplay/stale response, automatic Home canonical names/allowlist/periods and all prior Speaking/History flows. Desktop/390/320px screenshots reviewed; zero browser errors, control contrast >=5.78:1. Scoring/provider/browser fixtures are isolated from the live database.
- Production-shaped copy tests preserve six original attempts/four completed results and legacy leaderboard source rows. Live GET checks preserve original assessments/audio, no provider calls/live QA writes. Native verified backup `.data/speaking-attempt-before/local-test-2026-10-05T15-20-35-794Z.sqlite`; all 58 tables/1,330 rows retain hashes, quick_check=ok. Localhost restarted with native SQLite WAL, capability/source GET 200; Azure/DevQuota keys and prior user/FCE/IOE changes preserved. No cleanup/commit/push/deploy.
- Artifact `index-B8Xibq1C.js` / `index-EOnnQpik.css`, 76 JS/CSS; server 1,472,728 bytes/SHA256 `3E295588303AD22AA83DF2EB6C78A2EB525AA29CF395DEEFC7C76B3C13966A2A`. Checklists `docs/speaking-attempt-renewal-checklist.md`, `docs/speaking-replay-home-leaderboard-checklist.md`; behavior `docs/home-leaderboard.md`, `docs/speaking-setup.md`, `docs/speaking-verification.md`. Evidence `.data/speaking-home-final-report.json`, `.data/speaking-home-*.log`, `.data/speaking-home-local-report.json`, `.data/speaking-attempt-{copy,db}-report.json`, `.data/home-leaderboard-copy-report.json`, `.data/speaking-verification/browser-report.json`. New browser helpers `scripts/speaking-replay-browser-checks.mjs`, `scripts/home-leaderboard-browser-checks.mjs` exercise build behavior without live student recordings or commercial requests.

## 158. Starters village scene and dynamic student link lists — 2026-10-05

- Only `/exams/starter` switches from StandardModulePage to `features/starter-scene/StarterScenePage`. The user's village background, transparent wooden board and signpost are separate optimized WebP assets; all labels/links are HTML. Self-hosted Baloo 2/Nunito fonts include OFL licenses. Scoped brown/cream styles override B's inherited theme inside this feature without changing common CSS. Listening and Reading & Writing lists are absolute overlays on the two lawns. Each shows up to five actual entries and scrolls to the last; mobile yard buttons pan the same undistorted scene.
- The user explicitly replaced fixed 27/54 slots with dynamic lists. Dashboard Kho de luyen thi -> Starters -> Danh sach link hoc sinh adds/removes/selects/reorders existing public sets per paper. Removing a link preserves the exam. Teachers manage their own links; super admins manage all, and the server preserves the relative sequence of foreign links. The dialog has a separate scrolling body/fixed footer, visible focus, unsaved Escape protection and explicit save/discard.
- `server/exam-platform/starterSceneRouter.ts` mounts inside the existing exam router. Public GET `/api/exam-platform/starter-scene` returns only link id/title/canonical href plus revision/configured. Staff GET/PUT `/admin/starter-scene/:paperId` uses B auth and the existing settings adapter with `starter-scene-{paper}-v1` documents containing version/revision/entries. No schema/provider/account/media-storage changes. Missing configuration reads all current public Starter sets in stable order without writes; configured empty stays empty. Draft/private/archived/deleted sets are excluded from public output. New IDs are server-generated; malformed/duplicate/wrong-paper/private selections and foreign-owner modifications are rejected. Revision conflict (409) plus a per-paper queue protects the current single Node process; multiple workers require shared storage transactions before rollout.
- Standard lists for other modules and all old paper/player URLs remain. Published versions, assignment, guest identity, prepare/activate/save/submit/grade/review and B History are untouched. Existing uncommitted user/FCE/IOE/Speaking work is preserved.
- Verification: baseline 103 exam-platform and 11 library/navigation tests; full phase3 597 pass/0 fail (23 invocations), final lint/canonical Node 22.16.0 build/native startup and both IOE/Speaking production-bundle smokes pass. Compiled-browser checks cover 0/3/25/31 links, five visible entries at 1440/1280/1024/390/320px, scrolling to the end, both existing players, actual admin mouse/keyboard/add/remove/reorder/save/reload, unsaved protection, loading/error/empty and local font/computed styles. Zero browser exceptions; control contrast >=7.95:1 on scene and >=5.36:1 in admin including disabled controls. Screenshots reviewed.
- Native production-shaped copy keeps all 58 tables/1,330 original rows, persists/reopens the layout, and leaves the other paper unchanged; public GET performs no writes. Live read-only verification retains every table/row hash, quick_check=ok/WAL. Localhost restarts independently after fixture servers stop and serves scene/API/fonts/media/source (9 resources HTTP 200); its actual public inventory is 1 Listening/0 R&W, with no demo seed or QA writes. No paid providers, cleanup, commit, push or production deploy.
- Artifact `index-Cz0yc9Te.js` / `index-EOnnQpik.css`, 78 JS/CSS assets, zero missing references; server 1,480,904 bytes/SHA256 `E3CF02F7AD7BC8F515571DF9CB67DE3480548C49043D3C194194EB5411A94790`. Existing Vite chunk-size warning remains without build errors. Docs: `docs/starter-scene.md`, `docs/starter-scene-checklist.md`. Evidence: `.data/starter-scene-final-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-scene-{copy,db,local}-report.json` and `.data/starter-scene-*.log`. Repeatable fixture/HTTP/browser scripts are included in `test:starter-scene`, `test:starter-scene-browser` and phase3.

## 159. Starters raised board lettering and text-only lawn links — 2026-10-06

- `StarterScenePage.tsx` removes lesson badge/duplicate ordinal/arrow and the two discovery hints. Titles remain semantic anchors with full tooltip/aria-label and existing click/modifier-key navigation. The five-row scrolling lists and dashboard configuration are unchanged.
- Scoped student CSS uses the existing local Baloo 2 font, gold/orange stroke and layered relief shadows for Starters/Listening/Reading & Writing. Brown lesson text sits directly on the grass with transparent background, no border/shadow/card and a hover underline. Mobile title alignment and font sizes preserve visible text. Admin styles, APIs, storage/settings/auth/publish/player/grader/History and all unrelated user changes remain unchanged; existing raster assets are not edited.
- Baseline 1 native HTTP plus 15 library/navigation tests; after changes 16 scoped tests/0 failures, lint/canonical Node 22.16.0 build/native startup and both post-build IOE/Speaking bundle smokes pass. Compiled-browser checks verify raised computed styles, local fonts, transparent links, absent hints, 0/3/25/31 entries, five rows, scrolling, player navigation, keyboard/focus, loading/error/empty and admin add/remove/reorder/save/reload/unsaved protection across 1440/1280/1024/390/320px. Zero browser exceptions; desktop and mobile screenshots reviewed. The broader 597-test gate belongs to section 158, not this presentation-only rerun.
- Native snapshot `.data/starter-typography-before/local-test-2026-10-05T16-55-17-115Z.sqlite`; all 58 tables/1,330 rows retain hashes, quick_check=ok. Restarted localhost serves the new source and all nine checked resources with HTTP 200; public inventory is unchanged. No live question/result/configuration writes, paid provider calls, commit/push or deploy.
- Artifact `index-CLoWk4eq.js` / `index-BEjBA4Wz.css`, 78 JS/CSS assets, no missing references; server hash/size and three scene asset hashes match section 158. Existing Vite chunk-size warning remains without build errors. Checklist `docs/starter-typography-checklist.md`, behavior `docs/starter-scene.md`; evidence `.data/starter-typography-final-report.json`, `.data/starter-typography-{db,local}-report.json`, `.data/starter-scene-verification/browser-report.json` and `.data/starter-typography-*.log`.

## 160. Starters house signs, smaller title and raised lawn text — 2026-10-06

- New `features/starter-scene/HouseSign.tsx` draws decorative wood plaques and shaded blue headphones/book-pencil in SVG, with HTML labels. Listening attaches above the left door (33.7% x / 28.6% y); Reading & Writing attaches above the right door (77.8% / 29.2%). The large boards below the houses are removed. Existing scene art and font files remain unchanged. Starters keeps gold relief at a smaller size; Pre A1 uses brown lettering on a light wood plaque.
- Link text gains a warm cream/gold face, brown outline and layered relief shadows, retaining transparent anchors without cards. Scoped CSS and mobile panning center each house with its five-row list. A whitespace-delimited U+FFFD separator, confirmed in the existing local title, displays as a middle dot in visible text/tooltip/aria-label only; source records are not rewritten. Other title content is untouched.
- Baseline and final 19 native HTTP/library/registry/navigation/admin tests pass. Final lint/canonical Node 22.16.0 build/native startup and both IOE/Speaking bundle smokes pass. Compiled browser covers actual SVG/plaque positions and label fit at 1440/1280/1024/390/320px, title size, raised link computed styles and outline contrast 6.74:1, legacy separator with unchanged public source, 0/3/25/31 entries, five visible rows/end scrolling, both players, keyboard/focus, all prior admin save/reorder/reload/unsaved and loading/error/empty states. Zero exceptions; desktop and two mobile yard screenshots reviewed.
- Native snapshot `.data/starter-house-before/local-test-2026-10-06T00-23-19-086Z.sqlite`; all 58 tables/1,330 rows retain hashes, quick_check=ok. Restarted localhost serves new component/source plus ten checked resources with HTTP 200, preserving its public inventory. APIs/settings/auth/publish/grade/player/History, unrelated user changes, server bundle and three scene asset hashes remain unchanged. No provider call, seed, cleanup, commit/push or deploy.
- Artifact `index-PD5YvjGs.js` / `index-BEjBA4Wz.css`, 78 JS/CSS assets, no missing references. Existing chunk-size warning remains without build errors. Checklist `docs/starter-house-checklist.md`, behavior `docs/starter-scene.md`; evidence `.data/starter-house-final-report.json`, `.data/starter-house-{db,local}-report.json`, `.data/starter-scene-verification/browser-report.json`, source snapshot and `.data/starter-house-*.log`. Matching isolated fixture now includes a legacy separator; it never seeds the live database.

## 161. Starters curved lettering, balanced plaques and lighter raised links — 2026-10-06

- Starter student presentation only: the eight decorative title letters form a gentle arc through scoped transforms, with a complete accessible h1 label. Pre A1 shifts upward by 8px. Listening/R&W signs shrink from 9.4%/14.1% to 7.9%/11.2% of the scene width (about 16–21%), retaining facade anchors, shaded emblems and readable fitted labels.
- Both lawn lists use the existing self-hosted Baloo 2 700 instead of 800, slightly larger desktop type, .018em letter spacing, a thin brown outline and deeper five-layer relief. No card background, new font/provider or altered list/publish/player/API/settings/auth/History behavior. Existing mobile panning, five-row scrolling and legacy title presentation remain.
- Baseline/final 19 HTTP/library/registry/navigation/admin tests, lint/canonical Node 22.16.0 build/native startup and both IOE/Speaking bundle smokes pass. Browser assertions extend all prior flows with actual 700 font loading, curved accessible letters, raised Pre A1, lighter/spaced/deeper link text and smaller fitted signs at 1440/1280/1024/390/320px. 0/3/25/31 counts, last-row scrolling, both players, focus, admin save/reorder/reload/unsaved and loading/error/empty remain covered. Zero exceptions; desktop/two mobile yard screenshots and the real localhost list reviewed.
- Native backup `.data/starter-balance-before/local-test-2026-10-06T05-18-25-191Z.sqlite`; all 58 tables/1,330 rows retain hashes, quick_check=ok. Localhost restarted and serves ten checked resources/API with HTTP 200, preserving public inventory. Server bundle and three scene image hashes remain unchanged. No data writes, seed, commercial provider call, commit/push or deploy.
- Artifact `index-Ir-kDmfi.js` / `index-BEjBA4Wz.css`, 78 JS/CSS assets, no missing references; existing Vite chunk-size warning remains without build errors. Checklist `docs/starter-balance-checklist.md`, behavior `docs/starter-scene.md`; evidence `.data/starter-balance-final-report.json`, `.data/starter-balance-{db,local}-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-balance-live-desktop.png` and `.data/starter-balance-*.log`.

## 162. Starters natural wood-brown lesson lettering — 2026-10-06

- Per the revised visual request, both lawns now use the existing self-hosted Nunito 600 with slight spacing and deep wood-brown text. CSS removes link text shadows, stroke, floating hover offset and hover underline. Hover changes only the brown shade; semantic links, full titles, keyboard/focus, five-row scrolling, title arc, Pre A1 and house signs remain unchanged. No font download, asset rewrite, API/settings/auth/player/grade/History change.
- Baseline/final 19 native HTTP/library/registry/navigation/admin tests, typecheck and canonical Node 22.16.0 build pass. Compiled-browser QA updates the superseded relief assertions to the requested flat lettering and checks both actual hover states, local 600 font, sampled lawn contrast >=4.51:1, all existing five-width layouts, 0/3/25/31 counts, end scrolling, both players, keyboard/focus, admin add/remove/reorder/save/reload/unsaved protection and loading/error/empty states. Zero browser exceptions; desktop and both mobile yard screenshots reviewed. A first brown candidate failed one leafy background sample; the darker wood tone passes the unchanged contrast threshold.
- Live read-only HTTP confirms the current CSS, Nunito 600 and existing public inventory (1 Listening/0 R&W). QA writes target only the isolated fixture. Server bundle and three scene asset hashes match section 161. Artifact `index-B_FJIYUW.js` / `index-BEjBA4Wz.css`, 78 JS/CSS assets, zero missing references, History navigation present; existing Vite chunk warning remains without build errors. No seed, provider call, commit/push or deploy.
- Checklist `docs/starter-natural-links-checklist.md`, behavior `docs/starter-scene.md`; evidence `.data/starter-natural-links-final-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-natural-links-*.log`, snapshot `.data/starter-natural-links-before`.

## 163. Starters illustrated wooden lesson links from the visual reference — 2026-10-06

- The user's new five-board reference supersedes the plain lawn lettering. Both paper lists use a transparent 3D honey-wood sprite with colourful blank badges, corgi/kitten/bluebird/monkey/rabbit and golden chevrons. Built-in imagegen created/refined the art in two calls; original PNGs and exact prompts are retained in `output/imagegen`. Served final asset `public/assets/lesson-cards/starter-wood-cards-v2.webp` is 1536x1024 RGBA/233,780 bytes. No generated titles or baked numbers; B's actual list order supplies numbers/names/URLs, five visual variants repeat beyond five lessons.
- `StarterScenePage.tsx` adds decorative aria-hidden art/numbers and measured per-variant positions. Scoped CSS places Baloo 2 700 brown names over blank wood in two lines, supports 2/3/4-digit numbers, preserves no hover underline/extra CSS shadow, title/house signs, modifier-key navigation, focus and exactly five visible scrollable entries. Mobile remains 44px per interactive row; full names remain in tooltip/accessible labels. Admin/public APIs/settings/ownership/published versions/player/grader/History and scene assets remain unchanged.
- Baseline/final 19 HTTP/library/registry/navigation/admin tests, typecheck and canonical Node 22.16.0 build pass. Compiled browser checks live numbering/variant cycles, real image alpha, local fonts, actual hover on each paper, sampled wood contrast >=6.26:1, number widths 12/123/1000 across 1440/1280/1024/390/320px, all prior five-row/end-scroll/0/3/25/31 counts, both players, keyboard/focus, admin editing/persistence/unsaved protection and loading/error/empty states. Zero exceptions; desktop/both mobile lawns and live localhost screenshot reviewed. QA data writes target isolated fixtures only.
- Localhost serves current JSX/CSS/art and keeps the existing public inventory (1 Listening/0 R&W). Server bundle and three original scene images retain hashes; dist/public v2 hashes match. Artifact `index-BeykSL7J.js` / `index-BEjBA4Wz.css`, 78 JS/CSS files, zero missing references, History present; existing Vite chunk warning remains without build errors. No application provider call, seed, commit/push or deploy.
- Checklist `docs/starter-wood-cards-checklist.md`, behavior `docs/starter-scene.md`, asset provenance `output/imagegen/starter-wood-cards-v2.prompt.md`; evidence `.data/starter-wood-cards-final-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-wood-cards-live-desktop.png`, `.data/starter-wood-cards-*.log`, snapshot `.data/starter-wood-cards-before`.

## 164. Starters compact wooden cards, gentle hover and local multi-link simulation — 2026-10-06

- The approved wooden sprite remains unchanged. Both desktop lawns narrow from 36% to 33%; row height reduces from 60–86px to 54–76px, with slightly smaller lesson text. Lawn anchors rise to 50% Listening / 51% R&W so five visible cards fit better before the fence. Mobile rows stay 44px. Scoped hover scales the whole card from .985 to 1 and brightens 3.5% over 180ms, without underline/extra CSS shadow or layout changes. Reduced-motion disables enlargement/animation; full titles, numbering, focus and mobile panning remain.
- `StarterScenePage.tsx` supports explicit local `/exams/starter?preview=links` only when Vite DEV and hostname loopback. Lazy `linkPreview.ts` creates 25 presentation-only links per paper with a clear simulation notice; click/Enter does not open fake exams. The preview does not fetch the real catalog or persist data. Production eliminates the helper/data and ignores the preview query, always reading B's published list. Standard local route keeps real inventory (1 Listening/0 R&W). No schema/API/settings/auth/player/grader/History change or real-data seed.
- Baseline/final 19 HTTP/library/navigation/admin tests, typecheck and canonical Node 22.16.0 build pass. Compiled-browser QA retains all prior 0/3/25/31-list, numbering, sprite alpha, both player and admin persistence/unsaved checks; adds actual hover in normal/reduced-motion modes, compact lawn positions, mouse-wheel/end scrolling on both papers and production preview rejection. Five widths 1440/1280/1024/390/320px pass; sampled wood contrast >=6.26:1, zero exceptions. Actual local DEV preview verifies 50 links, five visible per lawn, wheel scrolling to number 25, non-playing demo Enter, mobile 390/320px and unchanged actual catalog; desktop and both mobile lawns visually reviewed.
- Artifact `index-CKAYZRJD.js` / `index-BEjBA4Wz.css`, 78 JS/CSS files, zero missing references, History present and no preview helper/data in production. Server SHA-256 remains `e3cf02f7ad7bc8f515571df9cb67de3480548c49043d3c194194eb5411a94790`; original scene/art hashes match before-change snapshots. Existing chunk-size warning remains; no build error, provider call, commit/push or deploy.
- Checklist `docs/starter-compact-checklist.md`, behavior `docs/starter-scene.md`; evidence `.data/starter-compact-final-report.json`, `.data/starter-compact-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-compact-*.log`, `.data/starter-compact-preview-*.png`, snapshot `.data/starter-compact-before`.

## 165. Starters smaller cards raised into the lawns — 2026-10-06

- Four scoped CSS rules refine the approved layout: desktop lawn width 33% → 30.5%, rows 54–76px → 50–70px (about 7–8% smaller), Listening/R&W top 50/51% → 47/48% (about 22–24px higher at verified scene sizes). Lesson text shrinks slightly to fit; mobile width becomes `100vw - 48px` while preserving 44px rows. Five visible cards, existing art/title/house signs, subtle hover/reduced motion, scrolling, dynamic catalogs and dev-only 25/25 preview remain. No component/API/data/player/History changes.
- Baseline/final 19 scoped HTTP/library/navigation/admin tests, typecheck and canonical Node 22.16.0 build pass. Compiled browser now additionally measures both five-card boxes inside the upper lawn (top >=46.9%, bottom <=86.5%) at 1440/1280/1024/390/320px and verifies mobile width/touch height, retaining all numbering/contrast/hover/wheel/end-scroll/player/admin/empty/error checks. Local preview also passes 25/25 lists with five visible entries and end scrolling on both lawns. Desktop/mobile images reviewed; zero exceptions and sampled contrast >=6.26:1.
- Artifact `index-DeeU4_BO.js` / `index-BEjBA4Wz.css`, 78 JS/CSS, zero missing references, History present, simulation code/data excluded from production. Server/scene/art hashes and public inventory (1 Listening/0 R&W) remain unchanged. Existing chunk-size warning only; no build error, data write, provider call, commit/push or deploy.
- Checklist `docs/starter-fit-checklist.md`, behavior `docs/starter-scene.md`, snapshot `.data/starter-fit-before`; evidence `.data/starter-fit-final-report.json`, `.data/starter-fit-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-fit-*.log` and `.data/starter-fit-preview-*.png`.

## 166. Reading & Writing house plaque with a gentle rainbow arch — 2026-10-06

- `HouseSign.tsx` curves only the R&W wood body, light rim, grain and stud positions into a shallow convex arch. Seventeen live HTML letters follow it with a small centre rise and rotations up to ±6°; h2 retains its complete accessible name while decorative letter spans are aria-hidden. R&W keeps its facade anchor/width and book/pencil emblem; aspect 5.5 gives the fitted curve room. Listening retains its original SVG/label. Scoped CSS controls the lettering; no raster image change, AI call or list/API/player/History/data change.
- Baseline/final 19 scoped tests, typecheck/canonical Node 22.16.0 build and compiled/local browser checks pass. New per-width assertions measure the SVG's 13-unit rise, 17 curved letters, complete accessible name, every letter inside its plaque and unchanged Listening sign at 1440/1280/1024/390/320px. All prior five-card/lawn-position/numbering/hover/reduced-motion/wheel/end-scroll/player/admin/loading/error/empty checks remain; desktop/mobile images reviewed, zero exceptions.
- Artifact `index-O9NYw6Lj.js` / `index-BEjBA4Wz.css`, 78 JS/CSS with no missing references, History present and preview excluded. Server/scene/art hashes and actual public list (1 Listening/0 R&W) remain unchanged. Existing chunk-size warning only; no build error, provider call, real-data write, commit/push or deploy.
- Checklist `docs/starter-arch-checklist.md`, behavior `docs/starter-scene.md`, snapshot `.data/starter-arch-before`; evidence `.data/starter-arch-final-report.json`, `.data/starter-arch-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-arch-*.log`, `.data/starter-arch-preview-*.png`.

## 167. Reading & Writing house sign lowered slightly — 2026-10-06

- One scoped CSS anchor lowers the R&W sign from top 29.2% to 30% of the scene (about 6px). Curved wood/lettering, horizontal anchor/width, Listening sign and both lesson lists remain unchanged. The existing browser position assertion follows the revised anchor; no component/API/settings/player/data change.
- Baseline/final 19 tests, typecheck, canonical Node 22 build and compiled/local browser checks pass. Five screen widths verify the 0.8% downward shift, unchanged remaining anchors, fitted curved lettering and existing five-card/hover/scroll/player/admin/accessibility/state behavior. Desktop/mobile images reviewed; no browser exceptions or real-data writes.
- Artifact `index-Cle5sfaQ.js` / `index-BEjBA4Wz.css`, 78 JS/CSS files, zero missing references, History present and production preview excluded. Server/scene/art hashes and public catalog (1 Listening/0 R&W) remain unchanged. Existing chunk-size warning only; no build error, provider call, commit/push or deploy.
- Checklist `docs/starter-sign-position-checklist.md`, behavior `docs/starter-scene.md`, snapshot `.data/starter-lower-before`; evidence `.data/starter-lower-final-report.json`, `.data/starter-lower-live-report.json`, `.data/starter-lower-*.log` and `.data/starter-lower-preview-*.png`.

## 168. Starters empty lawns without placeholder messages — 2026-10-06

- `StarterScenePage.tsx` renders null for an empty loaded paper list, removing both placeholder lines from Listening and R&W. Existing loading/error/retry and populated lists remain unchanged; no CSS, API, settings or data change. The existing compiled-browser empty-state assertion now requires no text or child element in the empty list.
- Baseline/final 19 tests, typecheck, canonical Node 22 build and compiled/local browser checks pass. Compiled fixture verifies blank Listening at zero entries; actual local R&W remains blank on desktop/mobile while Listening retains its current lesson. Five-width layout/arch, five-card/scroll/hover, player/admin and loading/error/focus checks pass. Images reviewed; zero exceptions and real-data writes.
- Artifact `index-nfTl2Wvq.js` / `index-BEjBA4Wz.css`, 78 JS/CSS, no missing references, History present, preview excluded from production. Server/scene/art/CSS/HouseSign hashes and public catalog (1 Listening/0 R&W) remain unchanged. Existing chunk-size warning only; no build error, provider call, commit/push or deploy.
- Checklist `docs/starter-empty-checklist.md`, behavior `docs/starter-scene.md`, snapshot `.data/starter-empty-before`; evidence `.data/starter-empty-final-report.json`, `.data/starter-empty-live-report.json`, `.data/starter-empty-*.log` and `.data/starter-empty-real-*.png`.

## 169. Starters Home / Next / History on the wooden signpost — 2026-10-06

- `SignpostNavigation.tsx` makes the original two signs Home (`/`) and Next (`/exams/mover`, via B's route helper), and adds History (`/history`). The old toolbar is removed. The third board reuses a CSS-clipped region of the unchanged signpost image; all labels are live accessible HTML anchors with modifier-click and keyboard support. Scoped CSS retains the upper-right column on desktop and puts three wooden controls in one always-visible row below 1280px; touch targets stay at least 44px. No auth/API/settings/player/History contract or data change.
- Baseline/final 19 tests, typecheck, canonical Node 22 build and compiled/local browser checks pass. Five widths verify hrefs, labels, fitting, viewport visibility, touch size, font and contrast >=4.5:1. Actual Home/Next clicks and History Enter navigate correctly at 1440/390px. The first Home expectation incorrectly assumed a student fixture; B's fixed staff QA identity goes to its dashboard, and the existing student-view button then shows Home. Only the test expectation changed; App/auth remain untouched. Existing five-row/scroll/hover/arch/player/admin/loading/error/blank/focus checks pass, zero exceptions; desktop/mobile images reviewed.
- Artifact `index-BCIVgJwm.js` / `index-BEjBA4Wz.css`, 78 JS/CSS assets, zero missing references, History present, dev preview excluded. Server, scene/art/signpost/HouseSign hashes and actual catalog (1 Listening/0 R&W) remain unchanged. Existing chunk-size warning only; no build error, provider call, real-data write, commit/push or deploy.
- Checklist `docs/starter-signpost-checklist.md`, behavior `docs/starter-scene.md`, snapshot `.data/starter-nav-before`; evidence `.data/starter-nav-final-report.json`, `.data/starter-nav-live-report.json`, `.data/starter-nav-*.log` and `.data/starter-nav-real-*.png`.

## 170. Starters title at 90% and inset Pre A1 — 2026-10-06

- Scoped `starter-scene.css` reduces the curved gold title and Pre A1 font to 90% across desktop/mobile; the smaller caption shifts right 8–12px and raises to a -14px flow offset, keeping it within the wooden face. Original curve, colors, board art, routes, player, navigation, API and data remain unchanged. The existing browser smoke now measures the actual title ratio and caption containment after cascade.
- Baseline/final 19 tests, typecheck, canonical Node 22 build, compiled and live browser checks pass. Five compiled widths verify 90% text, right-shift and safe wood bounds; local before/after geometry also covers 1920px. Caption bottom stays at or above 73.3% of the board height versus up to 78.7% before. Desktop/mobile images reviewed. Existing Home/Next/History, player/admin, five-card scrolling/hover, loading/error/empty and focus checks pass with zero exceptions.
- Artifact `index-Bo9Zrwxu.js` / `index-BEjBA4Wz.css`: 78 JS/CSS, zero missing references, History present, dev preview excluded. Server, unchanged page/HouseSign/SignpostNavigation source and image hashes match the snapshot; public catalog remains 1 Listening/0 R&W. Existing chunk-size warning only; no build error, provider call, real-data write, commit/push or deploy.
- Checklist `docs/starter-title-fit-checklist.md`, behavior `docs/starter-scene.md`, snapshot `.data/starter-title-fit-before`; evidence `.data/starter-title-fit-final-report.json`, `.data/starter-title-fit-geometry-before.json`, `.data/starter-title-fit-geometry-after.json`, `.data/starter-title-fit-live-report.json`, `.data/starter-title-fit-*.log` and screenshots `.data/starter-title-fit-*.png`.

## 171. Starters student attempt theme from the supplied game-style reference — 2026-10-06

- `StudentExamAttemptShell` opts into `theme="starter"` only for live Starter Listening/Reading & Writing in `GenericExamLearningArea`. New `student/starter-player.css` scopes illustrated sky/trees/castle/wood scenery, cream rounded frame, glossy blue Part/Previous/Next controls, white star progress, golden timer and green Submit to that marker. Existing two-yard scene, other levels, question renderers, image geometry, answer/recovery/timer/identity/ticket/grading/submit/review/History contracts remain intact. The shared border cascade initially overrode the cream; a scoped important border fixes that without editing global CSS.
- New `student/StarterAudioPlayer.tsx` uses the Part's real HTMLAudioElement and media URL for play/pause, time, seek, mute/volume and retry errors. It resets on source change with no autoplay; other modules keep native controls. Nunito uses the existing self-hosted fonts. Buttons remain >=44px, visible focus, >=4.5:1 text/gradient contrast, and motion respects reduced-motion.
- Decorative scenery `public/assets/backgrounds/bg-starter-exam-v1.webp` (1536x1024, 58,426 bytes; SHA-256 `f98a8d7319022a4ab738fb3e7390f2ef627841900eddcd74d4139cc28f916189`) was generated with built-in imagegen using the supplied screenshot style. Original PNG and exact prompt are in `output/imagegen/starter-exam-background-v1.*`; only format/compression changed for WebP. It contains no UI/text/answers. No application AI/media provider or duplicate storage was introduced.
- Baseline exam-platform 103 and final 246 tests (exam-platform 103, Listening 142, Starter scene 1), typecheck, canonical Node 22.16.0 build and compiled browser pass. Fixture media extends the existing isolated QA harness; the new `scripts/starter-player-browser-checks.mjs` exercises actual play/pause/keyboard seek/volume, transparent matching hitboxes and one answer, text input count, image expand/Escape, four Listening/five R&W Parts, source reset, disabled boundary, submit/result and audio error/retry. Desktop/mobile checks cover 1440/1024/390/320px; images reviewed and no browser exception. Existing scene navigation, five-link scrolling, hover, blank/loading/error and admin add/remove/reorder/persistence still pass. Test waits now wait for React/transition completion instead of relying on immediate programmatic actions or fixed delays; assertions retain their conditions.
- Artifact `index--2waKIi_.js` / `index-BEjBA4Wz.css`: 78 JS/CSS files, no missing references, History present, demo preview excluded. Server bundle SHA-256 remains `e3cf02f7ad7bc8f515571df9cb67de3480548c49043d3c194194eb5411a94790`; API, interaction/result/image-stage/scene/global exam CSS snapshots match. Existing chunk-size warning only. Real public catalog remains 1 Listening/0 R&W; localhost serves the new background with matching hash. Local server reopened via `dev:local:native` because the existing DB has WAL; no SQL.js rollback, sidecar deletion or data conversion. No production deploy/commit/push.
- Checklist `docs/starter-player-checklist.md`, behavior `docs/starter-player-theme.md`, snapshot `.data/starter-player-before`; evidence `.data/starter-player-final-report.json`, `.data/starter-scene-verification/{browser-report,player-report}.json`, `.data/starter-player-*.log` and screenshots referenced in the reports. Roll back scoped source after protecting newer edits, then rebuild; do not restore over data.

## 172. Vocabulary student storybook theme from the supplied reference — 2026-10-06

- `StudentLearningArea` opts into a scoped `data-vocab-theme="storybook"` marker. New `VocabularyTheme.css` reuses the approved Starters sky/trees/castle scenery and local Nunito fonts, with blue/cream frames, a pink flashcard accent, glossy controls, six game-category palettes and a golden leaderboard. Semantic hooks and ARIA states replace reliance on utility colors after the global cascade. Mobile stacks the game catalogue below the stage; main touch controls remain at least 44px and measured button/gradient contrast is at least 4.98:1.
- Flashcard front/back retain their shared intrinsic grid height and natural image ratios. Short text gets larger type while long sentences retain the reduced size and wrapping. Space/Enter flips only the focused card, not its nested speaker; the hidden face is inert/aria-hidden and reduced-motion disables flip/hover animation. Existing deck/rating/completion callbacks remain unchanged. Student identity, share/assignment, lazy session, server score/save/retry/history, existing audio helper, shared controls and game catalogue contracts remain intact.
- Built-in imagegen supplied the transparent book/star/trophy/podium atlas `public/assets/vocabulary/vocab-decoration-atlas-v1.webp` (1254x1254 RGBA, 188,042 bytes; SHA-256 `9576954cf95f03b4644f30e5529f196acd940fbc0d6da661a6861d4fb2f81030`). Original PNG and exact prompt are in `output/imagegen/vocab-decoration-atlas-v1.*`; WebP changes only format/compression and preserves alpha. No new application media provider/storage or baked UI labels were introduced.
- Baseline 18 vocabulary tests and 24 layout cases pass; final related suites total 82 passes (vocabulary 18, identity 14, runs 6, history 29, backend runs/results 15). Typecheck, canonical Node 22.16.0 build and native startup pass. Browser QA uses actual shell/game renderers with isolated API fixtures and real WAV playback: 1440/1122/1024/620/390/320px, all 11 games/six groups, keyboard/inert/focus, audio, shuffle/auto-next/fullscreen, normal/reduced-motion hover, long-image text, loading/error/empty and lazy leaderboard. Completion records four actions/score 75, retries the same run after a simulated save failure and supports replay. Zero runtime exceptions; desktop/mobile screenshots reviewed.
- The layout harness now navigates only after CDP initialization and removes the blocked remote-font import solely from fixture-served CSS; application CSS and assertions remain intact. Full-shell fixtures use four distinct words and remount on set changes, matching the existing deck initialization contract. Actual localhost opens an existing vocabulary set from Home and verifies desktop/mobile plus unchanged Starters/IOE/Speaking routes, with zero API writes. Shared audio/control/image/game/global-style/Starters-style/background hashes and the server bundle match the snapshot. No real-data seed or provider call from the application.
- Artifact `index-mN_uYTXh.js` / `index-BEjBA4Wz.css`: 81 JS/CSS assets, zero missing references, History/theme present and local simulation excluded. Server bundle remains 1,480,904 bytes/SHA-256 `e3cf02f7ad7bc8f515571df9cb67de3480548c49043d3c194194eb5411a94790`. Existing Vite chunk-size warning only; no build error, commit/push or production deploy. Localhost uses `dev:local:native` with the existing WAL database.
- Checklist `docs/vocab-theme-checklist.md`, behavior `docs/vocabulary-theme.md`, snapshot `.data/vocab-theme-before`; evidence `.data/vocab-theme-final-report.json`, `.data/vocab-theme-live-report.json`, `.data/vocabulary-theme-verification/browser-report.json`, `.data/flashcard-verification/browser-report.json`, `.data/vocab-theme-*.log` and screenshots named in those reports. Roll back scoped source after protecting newer edits, then rebuild; do not restore over data.

## 173. Grammar and rewrite student theme from the supplied reference — 2026-10-06

- `GrammarLearningArea` adds a stable `#grammar-learning-root` and semantic presentation hooks; `GrammarLearningTheme.css` scopes the approved sky/trees/castle background, blue/cream frame, progress, raised question, A–D answer badges, multiline rewrite field, glossy blue navigation and green Submit. The header names the actual grammar/rewrite mode and retains B's student name. Existing local Nunito and the vocabulary star atlas are reused without creating assets/providers/storage. Text wraps and height grows; mobile controls remain at least 44px, focus is visible and reduced-motion disables hover lift.
- All state/business functions before JSX, API payloads, identity/share credentials, lazy prepare/activate/save/submit, immediate feedback locking, review policy and history remain identical to the snapshot. Choice state uses `data-answer-state`/`aria-pressed`; status/error regions gain ARIA and textarea has an explicit label. Old important Tailwind color classes were removed from themed controls because their cascade overrode scoped colors; scoped CSS now retains readable selected/disabled/correct/incorrect states. Global CSS and other modules are untouched.
- Baseline 32 grammar/import/library/router/runs/legacy tests pass; final related tests total 93 including identity/history/vocabulary. Typecheck, canonical Node 22.16.0 build, native startup and post-build browser pass. `scripts/grammar-theme-browser-smoke.mjs` uses the actual component and isolated API fixtures across 1774/1440/1024/620/390/320px: keyboard selection, answer loading/rollback/retry, prev/next, submit retry, review/history, immediate correct/incorrect feedback and locked answers, rewrite multiline/error preservation, review suppression/new run IDs, very long text, identity states and hover/reduced motion. Minimum measured button/gradient contrast 4.87:1; zero runtime exceptions; desktop/mobile screenshots reviewed.
- Local read-only Home opens the existing public multiple-choice set and renders the new lobby/header on desktop/mobile. There is currently no public rewrite set locally; rewrite is verified through the isolated fixture rather than seeded into the real bank. Vocabulary/Starters/IOE/Speaking routes still load without this root, zero API writes or runtime exceptions. The QA native Enter event includes its carriage return; local QA waits for the Home directory/data before selecting. Application navigation/keyboard callbacks remain unchanged.
- Artifact `index-gOybk0X6.js` / `index-6znrgZ6S.css`: 83 JS/CSS assets, zero missing references, History/theme present, fixture excluded. Server remains 1,480,904 bytes/SHA-256 `e3cf02f7ad7bc8f515571df9cb67de3480548c49043d3c194194eb5411a94790`; grader/router/service, shared CSS, vocabulary/Starters CSS and reused image hashes match the snapshot. Existing Vite chunk-size warning only, no build error, real-data seed, application provider call, commit/push or production deploy. Localhost continues using the native WAL development server.
- Checklist `docs/grammar-theme-checklist.md`, behavior `docs/grammar-learning-theme.md`, snapshot `.data/grammar-theme-before`; evidence `.data/grammar-theme-final-report.json`, `.data/grammar-theme-live-report.json`, `.data/grammar-theme-verification/browser-report.json`, `.data/grammar-theme-*.log`, `.data/grammar-theme-preview.png` and `.data/rewrite-theme-preview.png`. Roll back source after protecting newer edits and rebuild; do not restore over data.

## 174. Shared village catalog for seven Cambridge and IELTS levels — 2026-10-06

- `StarterScenePage` and new `sceneDefinition.ts` read the existing exam manifest for Starters, Movers, Flyers, KET, PET, FCE and IELTS. The first four retain two houses/lawns; PET/FCE/IELTS have three for their three existing papers. Interactive HTML titles, plaques and illustrated wooden links reuse the approved Starters typography/assets. Each lawn shows five scrollable rows, loaded empty lawns remain blank, and mobile pans to the selected skill. Wood Home/Previous/Next/History navigation follows the seven-level chain; four boards form a compact desktop 2x2 group so the house signs stay visible. Existing exam players, answer/grading/identity/history contracts remain unchanged.
- The existing link-list admin is available in all seven dashboards, with add/remove/select/reorder/save, ownership protection and revision conflicts. Generic scene endpoints/settings are isolated by full module/paper key; old Starter endpoints/settings remain compatible. Movers reads its existing listening/reading collections, including legacy missing-module records, without rewriting data; same IDs in different paper collections stay isolated. Public catalogs return only published link metadata, never answer keys. No table/schema/provider is added.
- Built-in imagegen edits the approved village into three foreground houses and three clear lawns without baked UI labels. Served asset `public/assets/backgrounds/bg-exams-three-yards-v1.webp` is 1672x941/354,856 bytes, SHA-256 `fc649d7ed039919834f72b3e346eb4be7df9c5cc72b424a787fdf7e6617bd5db`; original PNG and exact prompt are `output/imagegen/bg-exams-three-yards-v1.{png,prompt.md}`. WebP changes only format/compression; existing two-house assets remain intact.
- Baseline 14 tests and final related 68 tests, Listening suite 142 tests, scene API suite 7 tests, lint and canonical Node 22.16.0 build pass. New `scripts/exam-scenes-browser-smoke.mjs` checks seven levels at 1920/1440/1024/390/320px, five rows/end scrolling, actual navigation, mobile panning, 44px controls/focus/reduced motion, admin persistence and blank/loading/error/retry states with zero exceptions. Existing compiled full-app Starter browser suite also passes both exam players and prior contrast/interaction/admin checks. Its superseded Movers-list selector now asserts the requested two-yard Movers scene; remaining assertions are retained. Desktop/mobile screenshots reviewed.
- Native WAL backup/copy verifies catalog reads, saving/reopening three PET settings and preservation of existing collections/other settings. Live local checks are read-only: all 58 tables/1,339 rows retain hashes, quick_check=ok, zero API writes/runtime exceptions. Current real catalog has one Starter Listening link and no other public links; no seed is introduced. Explicit DEV-loopback `?preview=links` simulates 25 links per paper without fetching/writing real catalogs or opening fake exams; production removes preview code/data. Localhost runs `dev:local:native`, preserving WAL sidecars.
- Artifact `index-DdnuFqsQ.js` / `index-6znrgZ6S.css`: 83 JS/CSS assets, zero missing references, History present, preview excluded. Server 1,482,838 bytes/SHA-256 `22817b497d8df55c9147ceb71f798716bcf7993c957b42f0dd6543e5da5d72a8`. Existing Vite chunk-size warning only, no build errors, commit/push or production deploy. Checklist `docs/exam-scenes-checklist.md`, behavior `docs/exam-scenes.md`, snapshot `.data/exam-scenes-before`; evidence `.data/exam-scenes-{copy,db,live,artifact,final}-report.json`, `.data/exam-scenes-verification/browser-report.json`, `.data/starter-scene-verification/browser-report.json` and `.data/exam-scenes-*.log`. Roll back scoped source after protecting newer edits, then rebuild; never restore over live data.

## 175. Student History storybook presentation — 2026-10-06

- `/history` reuses the approved sky/tree/castle background, self-hosted Nunito and vocabulary book atlas. Scoped `HistoryTheme.css` opts in via `#student-history-page[data-history-theme="storybook"]`: cream/blue rounded frames, raised readable controls, nine pastel summary cards, desktop table/mobile cards, and a matching detail dialog. Load/error/empty/guest recovery, pagination and reduced-motion also match. Text wraps, headers/close controls remain visible, focus/keyboard behavior is preserved.
- Six History components add presentation hooks only. Scores, source labels, Writing /10 distinction, state/API/callbacks, ownership/guest capability, parsers, filters, summaries and Listening/R&W/Speaking/IOE detail adapters remain intact. Advanced filters remain hidden by the existing product policy. 21 guarded API/type/auth/review/shared-CSS/asset/server files retain exact hashes; main state/API/focus prefixes are unchanged. `package.json` only adds `test:history-browser`, an isolated real-component browser harness; no dependency changes.
- Baseline/final History unit 29, storage 5, native History CLI, identity 14 and legacy contracts 6 pass; typecheck and canonical Node 22.16.0 build pass. Browser checks six widths (1440/1280/1024/620/390/320), seven history source types, Writing score, long text, pagination, detail/expired/missing/legacy/malformed/error/retry/scroll/focus trap/Escape/focus return, loading/empty and valid/missing/rejected guest states. Controls >=44px, minimum sampled button contrast >=4.87:1, zero exceptions/API writes; desktop/mobile screenshots reviewed.
- Native WAL backup/copy quick_check=ok; enabling the existing runtime History flag on the isolated copy yields GET 200 without changing any table hash. Live local initially returned `LEARNING_HISTORY_DISABLED`; only the local process was reopened with `LEARNING_HISTORY_ENABLED=true`, seeds disabled and `dev:local:native`, with no `.env`, backend or production configuration edits. Actual list/detail GET 200, back navigation and 1440/390/320 layouts pass, zero API writes/runtime exceptions.
- Live DB comparison is intentionally recorded as `unchanged=false`: 8 new IOE rows and one existing Speaking attempt/job state transition occurred during work, before local QA. 53/58 table hashes match the backup; isolated read-only copy retains all 58 hashes. The concurrent rows/state changes are retained, with no restore, deletion, backfill or seed. Raw/delta evidence is kept rather than claiming a quiescent live database.
- Artifact `index-CnK96N7E.js` / `index-C-6S3ZvB.css`: 84 JS/CSS files, zero missing references, History/theme present and fixture/local preview excluded. Server remains 1,482,838 bytes/SHA-256 `22817b497d8df55c9147ceb71f798716bcf7993c957b42f0dd6543e5da5d72a8`. Existing Vite chunk-size warning only; no build errors, commit/push or deploy. Docs `docs/history-student-theme.md`, `docs/history-theme-checklist.md`; snapshot `.data/history-theme-before`, evidence `.data/history-theme-{copy,db,live,artifact,final}-report.json`, `.data/history-theme-db-delta.json`, `.data/history-theme-verification/browser-report.json` and scoped logs. Roll back presentation source after protecting newer edits and rebuild; never restore over current data.


## 176. Student journey map, exam state theme and durable Speaking queue — 2026-10-07

- `/exams` uses `ExamIslandMap.tsx` / `exam-islands.css`: seven semantic wooden level links over a built-in-imagegen edit of the supplied island map. Registry/routes and embedded home directory remain compatible; mobile has level shortcuts and horizontal scene panning. Master/prompt `output/imagegen/bg-exam-islands-v1.{png,prompt.md}`, served WebP 1672×941/478,956 bytes, SHA-256 `3928fb1ca9c0208ba0d36b291798bd630a057d1b01fd02efdaaef8b94e02ec72`.
- Explicit `data-student-journey=storybook` opts entry/name/error/summary/review roots into `journey-state.css`, including generic, legacy Listening/Movers R&W, six specialized exam results, PET Writing and standalone Writing. Approved background/Nunito/cream-blue frames/raised controls are shared. Playing geometry, answer hitboxes, scoring/provider/registry and existing callbacks are unchanged.
- IOE `BankDirectory.tsx` checks selected subject/grade/level freshly and navigates with `start=now&run=<UUID>`. Student automatically prepares/activates bank exams, resumes only the matching launch and preserves legacy/practice entry flow. Insufficient-bank message is the requested exact text. `Trả Lời` and Enter save before advancing, guard duplicate actions, retain answers on failure and require explicit final submission.
- Speaking `service.ts` replaces the old 2-owner/100-global rejection with a bounded immutable SQLite/WAV waiting spool (1,000 outstanding assessments); worker leases FIFO queued/waiting jobs with idempotence. `AttemptView.queueState` is optional, public status remains queued. Student session polling tracks any pending item after switching cards. History repository/normalizer/row/detail/review expose owner-scoped waiting/failed status/audio without fake scores or answer-key disclosure; completed-set aggregation remains. Original providers/daily limits/retention/explicit paid retry are retained.
- Full phase3, final Speaking 55 tests, lint/build, isolated journey/compiled Starter/IOE/production-bundle/Speaking/History browser suites pass. Delayed-provider browser verifies background completion on another card; native tests cover saturation/restart/idempotence/failure History. Controls >=44px/contrast>=4.5, no document overflow/exceptions. Local checks are GET-only; all 58 live tables/1,356 rows retain backup hashes, quick_check=ok; 12 guard hashes match. Native snapshots `.data/student-expansion-before` / `.data/student-expansion-verification/live-after.sqlite`; no data restore/WAL deletion.
- Artifact `index-D2376AAL.js` / `index-C-6S3ZvB.css`, 86 JS/CSS files, zero missing references/fixture code. Server 1,484,607 bytes/SHA-256 `9dccbae943410fff8ff0062878e026c10ad9ce7dfc8ff958fdfbc81578568ad4`. Local native server runs with History enabled/seeds disabled, no environment-file edits, commit/push/deploy. Docs `docs/student-journey-expansion.md`; evidence `.data/student-expansion-verification/{journey-browser,live-browser,proof}.json` and scoped logs. Drain accepted waiting jobs before reverting to an older worker; preserve current data and recordings.

## 177. IOE/Violympic and Speaking student storybook theme — 2026-10-07

- `src/components/student/StudentModuleHeader.tsx` and `student-module-theme.css` opt the two student roots into the approved sky/tree/castle illustration, self-hosted Nunito, cream/blue frames, rounded cards and raised readable buttons. The header stays transparent over the sky. IOE includes overview/mock/practice/exam/completion/review; Speaking includes catalog/deck/microphone/recording/waiting/retry/results. The record button is green at rest and red during recording. Mobile cards wrap; internal review tables scroll without document overflow.
- Only presentation markup/hooks change in the two Student components. Existing state, handler prefixes, callbacks, Enter/IME guards, exam launch, recording/audio hooks and background queue remain unchanged. 22 guarded API/backend/types/shared CSS/asset/package files retain exact hashes; admin, home entry cards and History adapters retain their current themes. No storage/schema/provider/dependency/environment-file changes.
- Baseline/final Competition 13 and Speaking 55 tests, typecheck and canonical Node 22.16.0 build pass. Existing browser suites pass 62 Competition/48 Speaking report states, including full answer/submit/review/practice and capture/retry/playback/renewal/background grading flows. Gradient endpoint contrast is measured after the cascade (minimum 4.91:1); student targets >=44px, desktop hover, keyboard focus and reduced motion pass. Desktop/mobile/long-content/result screenshots reviewed. Actual localhost checks at 1440/390/320px are GET-only with zero API writes/runtime exceptions.
- Native QA writes use isolated fixture databases only. IOE uses an isolated compiled client proxy to avoid the existing occupied Vite HMR port; runtime-error assertions remain enabled. Localhost:3000 stays available on its existing native WAL server. Artifact `index-DqQLQtm9.js` / `index-D_31aDBy.css`, 89 JS/CSS assets, zero missing HTML references. Server remains 1,484,607 bytes/SHA-256 `9dccbae943410fff8ff0062878e026c10ad9ce7dfc8ff958fdfbc81578568ad4`; existing chunk-size warning only, no commit/push/deploy.
- Docs `docs/student-module-theme.md`; snapshot `.data/student-module-theme-before`; evidence `.data/student-module-theme-verification/{competition-browser,speaking-browser,live-browser,proof,artifact}.json` and `source-diff.txt`, logs `.data/student-module-theme-*`. Roll back only scoped presentation source/scripts after protecting newer edits, then rebuild; never restore over current records or delete WAL/recordings.

## 178. Compact Speaking recorder and bounded Azure connection — 2026-10-07

- Student device samples use a labelled 54px speaker icon. The microphone selector/name are hidden; a disconnected saved device falls back to the OS default, with guidance for denied/missing/busy/disconnected/silent microphones. `RecordingBar.tsx` / `recording-bar.css` render cancel, 64 real RMS waveform samples, time, stop and send with 44px controls. Stop/send retain automatic validation/upload. Cancel releases tracks/context, clears the capture and invalidates pending flushes so a late completion cannot upload a canceled recording. Admin sample controls remain compatible.
- `azureSession.ts` replaces the provider's inline lifecycle with a 15-second connection deadline before recognition. The existing duration + 60-second/capped six-minute assessment deadline starts after connection. Multiple continuous phrases remain intact through session end; timeout never publishes a partial result. Late callbacks cannot restart or overwrite a settled job. Word cancellations use SDK details; known auth/quota/busy/network/request/service errors have safe specific messages. Cleanup cannot block settlement; raw SDK endpoint/error text is not exposed. Rubric/normalizers, immutable WAV, storage, queue, owner checks and explicit paid-retry policy remain.
- Native read-only inspection found WAV/job records for the reported timeouts. An unpaid SDK handshake reproduced a >15s stall under restricted process networking; outbound-enabled authentication returned 200 and WebSocket opened in 945ms. The prior server was already stopped, so this establishes a reproducible failure mode, not certainty about every historical timeout. Localhost was reopened with Node 22.16.0/native SQLite WAL, History enabled, seeds disabled and outbound networking; zero outstanding jobs were asserted before restart, so no old recording was automatically retried. No `.env` edits.
- Final Speaking 64 tests/typecheck/canonical build pass; compiled server smoke passes with providers disabled. Recorder browser suite covers desktop/390/320, waveform, mic fallback/permission/missing/busy/silence, cancel/flush race, speaker text/locale, stop/send/timer, retained upload/playback and background History. Actual localhost GET-only browser checks pass with zero writes/exceptions; native backup quick_check=ok and all 58 tables/1,363 rows retain hashes. A deliberate live assessment of one stored student WAV was blocked by automatic approval review and remains unexecuted pending explicit user authorization; real grading is not claimed verified.
- Artifact `index-CSvJkn9I.js` / `index-D_31aDBy.css`, zero missing HTML references, History present. Server 1,488,133 bytes/SHA-256 `4719981238434d12a6d69ad760a8c00fc14ba13d41b470d64c598e8c0946ee38`. Existing chunk-size warning only; no commit/push/deploy. Docs `docs/speaking-recorder-ui.md`, `docs/speaking-azure-timeout.md`, setup link; sources `.data/speaking-recorder-before`, evidence `.data/speaking-recorder-verification`, `.data/speaking-timeout-verification` and scoped logs. Restore only scoped sources after preserving newer edits, rebuild/restart, and retain current database/WAL/recordings.

## 179. Speaking retry and new-reading actions on one row — 2026-10-07

- `Student.tsx` groups existing retry/new-reading buttons inside `speaking-result-actions`; the error stays above the row. Two scoped rules in `speaking.css` keep the row centered and unwrapped, allow button labels to wrap and stretch both controls equally on mobile. Completed attempts keep only the new-reading action. Callbacks/conditions, recording, provider, API/storage and scores remain unchanged.
- Typecheck/canonical Node 22 build and GET-only actual localhost QA pass. At 1440/390/320px the two buttons share the same top, remain within their card and measure 46.4/68.8/91.2px high. No page overflow, browser exceptions or API writes; desktop/mobile screenshots visually reviewed, existing computed contrast/focus/hover checks pass. No new persistent tests for this low-impact layout adjustment.
- Artifact `index-CaZ5vPsD.js` / `index-D_31aDBy.css`; server SHA-256 remains `4719981238434d12a6d69ad760a8c00fc14ba13d41b470d64c598e8c0946ee38`. Existing chunk-size warning only; no provider request, commit/push/deploy. Docs `docs/speaking-recorder-ui.md`; evidence `.data/speaking-action-row-verification/live-browser.json`, screenshots and scoped logs; source snapshot `.data/speaking-action-row-before`. Revert only these scoped layout changes and rebuild; keep current data and recordings.

## 180. Transparent Starters attempt header — 2026-10-07

- `starter-player.css` replaces the scoped header gradient with a transparent background and disables both backdrop-filter variants. The existing sky illustration continues through the title/status row; sticky positioning, spacing, type and controls remain unchanged. Applies to Starters Listening and Reading & Writing attempts.
- Canonical Node 22 build passes. Isolated browser verification covers both papers at 1440/1024/390/320px: transparent background, no gradient/blur/shadow/border, sticky positioning, no page overflow, main controls >=44px and gradient contrast >=4.5:1, zero runtime exceptions. Desktop/mobile screenshots reviewed. Scenic rectangle color samples include empty glyph gaps and are retained as observations, not asserted as text contrast. Evidence `.data/starter-transparent-header-verification/browser-report.json`; source snapshot `.data/starter-transparent-header-before`.
- Artifact `index-DRCxYUEH.js` / `index-D_31aDBy.css`, zero missing HTML asset references; server SHA-256 remains `4719981238434d12a6d69ad760a8c00fc14ba13d41b470d64c598e8c0946ee38`. Existing chunk-size warning only. No API/state/provider/data change or local server restart; documentation `docs/starter-player-theme.md`.

## 181. Continuous storybook scenery on long student pages — 2026-10-07

- New scoped `src/styles/storybook-background.css` is imported by History, vocabulary, grammar/rewrite, student-module, Starters-player and journey-state themes. An isolated root with a negative-z fixed `::before` keeps the approved illustration behind content, sized `cover` to the viewport with its aspect ratio intact and no pointer interception. Replaces History's finite `100% auto`/680px image, stretched `100% 100%` players, mobile fixed-size/top-bottom images and mobile attachment overrides. Map/yard canvases retain their image-aligned geometry; transparent Starters header stays intact. No component/state/API/asset/provider/schema changes.
- `scripts/storybook-background-browser-smoke.mjs` reproduces the baseline cutoff using actual History with 20 read-only fixture rows, then verifies seven scoped roots at five desktop/portrait/landscape sizes and top/middle/bottom scroll positions. 105 layout states pass, plus baseline and pixel comparisons. Scenery-only edge pixels match before/after scrolling (children hidden solely for comparison so card shadows do not alter samples); modal and controls remain interactive. Existing History/vocabulary/grammar/result browser suites pass; their image assertions now inspect the rendered `::before` layer without weakening behavior/contrast checks. Starters Listening/R&W fixture checks pass at four widths, retaining the transparent sticky header and control contrast/size. Screenshots visually reviewed.
- Typecheck/canonical Node 22 build pass; only the existing Vite chunk warning remains. GET-only actual localhost checks pass 36 top/bottom states for History, vocabulary, grammar, Speaking catalog/lesson and Competition; zero API writes/exceptions. Exam island/village canvases retain natural aspect ratios and no fixed scenery layer. Local server had stopped; it was reopened with the existing native SQLite WAL database, History enabled and seeds disabled after asserting zero outstanding Speaking jobs and quick_check=ok. No environment-file changes or recording retry/provider request.
- Artifact `index-CAzxfGRW.js` / `index-D_31aDBy.css`, zero missing HTML references; server remains 1,488,133 bytes/SHA-256 `4719981238434d12a6d69ad760a8c00fc14ba13d41b470d64c598e8c0946ee38`. Evidence `.data/storybook-background-verification/{browser-report,live-browser,artifact}.json`, `starter/browser-report.json`, screenshots/source-diff and scoped logs. Docs `docs/storybook-background.md`; snapshot `.data/storybook-background-before`. Roll back only scoped source/checks after preserving newer changes, rebuild and retain live data/WAL/recordings. No commit/push/deploy.

## 182. Storybook homepage panels and garden footer — 2026-10-07

- `HomePage.tsx` opts into `data-home-theme="storybook"` and imports `home-theme.css`. The new scoped skin uses local Nunito, cream/cyan frames, lightly decorated pastel exam cards, raised blue/green actions, a gold leaderboard/trophy/medal frame and a garden footer with the existing weekly quote. Vocabulary toolbar/list now share one panel and have labeled search/grade IDs. Stable routes, callbacks, controllers, capabilities, leaderboard scoring and the classroom photograph remain unchanged; no API/schema/provider/asset changes.
- Existing 14 Home checks, typecheck and canonical Node 22 build pass. Real-component browser checks cover eight widths, search/grade independence, seven exam routes, lesson/module/History callbacks, period, empty/loading/unavailable/long names, guest/staff controls, hover/focus/reduced motion and disabled controls. GET-only actual localhost checks cover desktop/phones; no horizontal overflow, clipped cards, undersized controls, unreadable control contrast or mismatched SVG child colors. Screenshots visually reviewed. The checker stays under `.data` because this is a reversible presentation change.
- Artifact `index-B2svThJ7.js` / `index-c5O7pOkK.css`, no missing HTML references; server hash remains `4719981238434d12a6d69ad760a8c00fc14ba13d41b470d64c598e8c0946ee38`. Existing chunk-size warning only. Evidence `.data/home-theme-verification/{browser-report,artifact}.json`, screenshots, source diff and `.data/home-theme-*.log`; docs `docs/home-storybook-theme.md`. Roll back only this request's markup/theme after preserving newer edits, using `.data/home-theme-before/HomePage.tsx` as reference. No database/WAL changes, attempts, recording retries, backend restart, commit/push/deploy.

## 183. Warm homepage actions, animal icons and bear brand — 2026-10-07

- Home-only `home-theme.css` changes actions to muted honey orange with dark brown text, cream secondary controls and a small raised base. IOE/Speaking opening buttons share a 184px width with a container cap. Header History/logout SVG paths and the initial avatar remain fully opaque and readable. The seven exam cards replace their decorative layer glyphs with circular CSS crops of the existing dog/cat/bird/monkey/rabbit Starters board mascots. `HomePage.tsx` replaces the navbar book with `/logo.png`, the existing global bear favicon. No new raster asset, route/controller/API/provider/data change.
- Home 14 checks, typecheck and canonical Node 22 build pass. One-off real-component/GET-only localhost browser checks cover eight widths and desktop/phone screenshots, equal entry widths, loaded bear logo, seven mascot crops, header icon strokes, minimum sampled control contrast 5.68:1, callbacks/search/filters/leaderboard states and hover/focus/reduced motion/disabled behavior. No page overflow, clipped cards, runtime exceptions or API writes. Evidence `.data/home-warm-verification/{browser-report,artifact}.json`, source diffs/screenshots and `.data/home-warm-*.log`; snapshot `.data/home-warm-before`, docs `docs/home-storybook-theme.md`.
- Artifact `index-BHVYXdvM.js` / `index-c5O7pOkK.css`, Home `HomePage-COWahh-A.js` / `HomePage-Chyme0a3.css`, zero missing HTML references. Server remains 1,488,133 bytes/SHA-256 `4719981238434d12a6d69ad760a8c00fc14ba13d41b470d64c598e8c0946ee38`; existing chunk-size warning only. No backend restart, commit/push/deploy. Revert only this refinement's presentation source after protecting newer edits, rebuild and retain live database/WAL/recordings.

## 184. Glossy homepage wordmark and softer warm buttons — 2026-10-07

- `HomePage.tsx` replaces the navbar's plain brand text with an accessible transparent wordmark matching the supplied coral/honey/mint/cyan toy-letter reference. The existing bear remains. Built-in imagegen master/prompt: `output/imagegen/home-wordmark-v1.{png,prompt.md}`; served `public/assets/branding/home-wordmark-v1.webp`, 2152×731 RGBA/203,352 bytes, exact alpha retained by encoding-only conversion, SHA-256 `469f33952d303bccc47b126a92f1af47f8f7268362ac8badb22a6f3e0c54fdf8`. Scoped CSS frames the wordmark responsively; below 480px account controls use a second row to retain readable brand size. Home actions now blend pale cream, peach and orange with brown text and softer raised bases. Existing controls/widths/mascots/hero/routes/state remain intact.
- Baseline/final Home 14 checks, typecheck and canonical Node 22 build pass. One-off real-component checks cover eight widths, guest/student/staff states, unchanged navigation/search/filters, equal module-opening widths, loaded/accessible wordmark and visible letter/diacritic bounds, no control overlap, hover/focus/reduced motion and disabled styles. Actual localhost desktop/390/320 screenshots reviewed; no document overflow, clipped cards, runtime exceptions or API writes. Minimum sampled control contrast 6.09:1 and wordmark width 162px. Evidence `.data/home-soft-verification/{browser-report,artifact}.json`, screenshots/source diffs and `.data/home-soft-*.log`; snapshot `.data/home-soft-before`; docs `docs/home-storybook-theme.md`.
- Artifact `index-D7hJTGaG.js` / `index-DjuOcoRm.css`, Home `HomePage-DFEYAYRu.js` / `HomePage-Cr2o5jSQ.css`, zero missing HTML references; served wordmark matches its source hash. Server remains 1,488,133 bytes/SHA-256 `4719981238434d12a6d69ad760a8c00fc14ba13d41b470d64c598e8c0946ee38`; existing chunk-size warning only. No API/provider/data change, backend restart, commit/push/deploy. Revert only these presentation changes after protecting newer edits and rebuild; retain live data/WAL/recordings.


## 185. Full exam names on extended village links — 2026-10-07

- All seven catalogs share `SceneLessonLink.tsx` and `SceneYard.tsx` through `StarterScenePage.tsx`. Independent SVG wood planks expand with complete catalog titles, with no ellipsis or line clamp; source names remain unchanged apart from the existing display-only legacy separator repair. Nunito 700 labels stay >=15px. Mascots occupy a leading cell outside each plank; number badges/arrows are smaller and use warm pastel colors. Desktop two-yard width grows 30.5%→38%, three-yard 26.3%→28.5%; mobile uses viewport width minus 24px. Rows vary in height; five fit on wide screens, fewer on small screens. Each yard retains every entry with wheel/touch/keyboard scrolling plus 44px up/down buttons and position/total count.
- Title boards reduce about 10%, house signs grow about 12–14%, two yards share a baseline, and wood navigation follows Home/History then Previous/Next in visual/keyboard order. Houses, module/paper definitions, full exam titles, canonical player routes, catalog/admin APIs, ownership/publication/settings and grading are retained. Empty yards remain blank. No backend/schema/provider/dependency/environment changes.
- Built-in imagegen extracts the five established mascots into `output/imagegen/scene-mascots-v1.png` with `.prompt.md`; alpha-preserving format conversion serves `public/assets/lesson-cards/scene-mascots-v1.webp` (724×2172, 225,056 bytes, SHA-256 `4a5d329b77df7e83ffb81b86a405a0fbf385c289f25cade461a8e13d5fe65f3e`). CSS uses individually measured transparent row gaps. The existing atlas consumed by Home remains untouched.
- Node 22.16.0 typecheck/canonical build and 7 native scene catalog checks pass. Updated real-component browser checks cover all seven modules at five widths with full long/unbroken titles, leading mascots, navigation, scroll controls/final entry, loading/error/retry/empty and admin editing. The isolated full-app Starters browser verifies actual fixture APIs/admin, keyboard/focus/contrast/alpha/numbering, both players, submit/review and production preview exclusion. Screenshots reviewed on desktop/mobile; tests write only isolated fixtures. Docs `docs/scene-link-layout.md`; reports `.data/exam-scenes-verification/browser-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/scene-links-{artifact.json,build.log,lint.log,browser.log,starter-browser.log,tests.log}`.
- Local artifact `index-Dj3e-_gv.js` / `index-DjuOcoRm.css`; zero missing HTML/relative JS import references and served mascot matches source hash. Server remains 1,488,133 bytes/SHA-256 `4719981238434d12a6d69ad760a8c00fc14ba13d41b470d64c598e8c0946ee38`; only the existing Vite chunk-size warning remains. No commit/push/deploy or live database access. Revert only this refinement’s presentation source/assets after preserving newer edits and rebuild; retain database/WAL/recordings.

## 186. Competition import prompt: teaching guidance and literal image handling — 2026-10-07

- `src/shared/competition/import.ts` changes the shared admin clipboard/textarea/API prompt from source-only explanation extraction to concise, grade-appropriate teacher guidance. It covers complete source solutions, answer-only sources and missing explanations, with reasons, computations/evidence and result checks. Unknown/missing/contradictory data are flagged for teacher review; missing answer keys remain blank. Math-English keeps English questions and simple English explanations; other subjects use Vietnamese guidance. Multiline `explanation` remains a string in the existing contract, private before submit and preserved in immutable Review/History snapshots.
- Extraction only copies printed question/option text. `passage` is optional and limited to an actual shared written passage; diagram interpretation is confined to explanation. Image options retain empty text slots until teacher media upload, never generated text/emoji. Admin avoids inferring option A from a blank answer matching blank image-option text. Math/Math-English/Vietnamese omit domain/difficulty requests and hide both authoring controls; existing metadata/defaults remain compatible. IOE English retains its current blueprint fields. The three 30-question subjects already select randomly by subject/grade/level, without metadata quotas or a mandatory 50/50 interaction ratio; selection/grading/storage contracts remain unchanged.
- Baseline competition checks: 13 passed. Final focused/integration checks: 16 passed, including four subject prompts, HTTP staff protection/parity, image-option validation/upload contracts, numeric/choice grading, no pre-submit leaks and multiline SQLite/snapshot/History round trips. Typecheck, canonical Node 22.16.0 build and native strict startup/WAL/reopen smoke pass. No model/provider request, schema/dependency/environment changes or edits to existing question data. Docs `docs/ioe-violympic-module.md`; evidence `.data/competition-guidance-{before,tests,lint,build,startup}.log` and `artifact.json`.

## 187. Competition player: automatic saving and aligned controls — 2026-10-07

- `Student.tsx` removes the manual save button, successful-save text and numeric answered counter. Existing 3-second autosave, flush before Answer/Enter, submission, local backup/recovery and conflict protections remain; save failures/offline status stay visible. Number navigation uses the same answer predicate as the Answer action and exposes answered status accessibly. Scoped `student-module-theme.css` adds light orange answered buttons, with a separate current-question inset, and a header row containing left title, centered clock and right submit. At <=700px the title occupies its own line, with clock/submit beneath. Previous/Answer/Next share a left/center/right row at every width.
- Isolated compiled browser smoke passes: authoring metadata visibility across four subjects, no guessed key or generated passage for image-option drafts, teacher upload/preview, real server autosave/reload, 30-question Math and Math-English grading, 200-question IOE games/navigation, fixed assignments, direct bank launch, save-failure retry/double-click, Review and History. Player geometry is checked at 1440/1024/768/640/390/320px; image previews at desktop/phone widths. Computed control contrast >=4.91:1, no page overflow/runtime exceptions; 978 unrelated consolidated controls retain identical styles. Desktop/mobile screenshots reviewed. Evidence `.data/competition-guidance-browser-report.json`, `.data/competition-guidance-browser.log`; previews `.data/competition-guidance-preview/`. Browser autosave checks compare actual server answers/revisions, with the real 3-second cycle acknowledged before reloading; they do not rely on hidden success text or force a manual save.
- Canonical artifact: `index-B63iFJlb.js` / `index-DjuOcoRm.css`, 361 relative JS imports and no missing HTML/import references. `dist/server.cjs`: 1,497,079 bytes, SHA-256 `ce5e838d1fa2f2f3e4adf1c33ab6da83fea825e5095755776cace2741e9cad26`. Existing Vite chunk-size warning only. No commit/push/deploy or live database writes. Rollback only these prompt/admin/player refinements after preserving section 185 and newer work, then rebuild; retain question versions, attempts, database/WAL and recordings.

## 188. Competition prompts per subject and private teacher notes — 2026-10-08

- `src/shared/competition/import.ts` emits four subject-specific prompt profiles, names the selected subject/grade/level first, and keeps numeric answer instructions in the two Math profiles and matrix metadata only in IOE English. Each asks for student teaching explanations and optional private `teacherNote` warnings, preserving literal source text, teacher-uploaded images, blank missing keys and the existing answer formats.
- `src/shared/competition/feedback.ts` moves marked legacy teacher warnings out of explanations and creates student-safe review/detail allowlists. `types.ts` adds optional `Question.teacherNote` and excludes it from `PlayableQuestion`; no database schema/dependency/env change. Bank save/update keeps teacher notes in private question/version JSON and retains immutable published attempts.
- `features/ioe-violympic/Admin.tsx` imports/splits warnings into an editable teacher-only note field with a 5,000-character bound. Short-answer validation now distinguishes a missing key from an accepted answer exceeding 2,000 characters; explanations keep their 20,000-character bound.
- `server/ioe-violympic/engine.ts`, the competition branch of Learning History and shared Review sanitize marked warnings and private fields from current and legacy student detail responses without rewriting stored History. Notes remain available to authorized bank authoring, while student playable, preview, review and History exclude them. Tests cover source/notes separation, length/blank errors, four prompts, persisted edits/clearing, frozen snapshots, legacy detail privacy and owner boundaries.
- Behavior and limits: `docs/ioe-violympic-module.md`. Native local backup before persistence changes: `.data/competition-teacher-note-before/local-test.sqlite` (quick_check=ok, 30 questions/6 attempts). QA uses isolated fixtures; no live question or student-record rewrite, commit, push or deploy.
- Verification for section 188: 20 competition tests, 5 storage tests, 29 History unit/API tests and History CLI backup/backfill/retention checks pass; Node 22.16.0 TypeScript and canonical build pass. The canonical server bundle also passes isolated native SQLite startup, production rejection of local-test auth, static assets, 30-question grading, bank launch, media and History smoke (`.data/ioe-verification/bundle-report.json`). Only the existing Vite chunk-size warning remains. Local API prompts match source for all four subjects; native local quick_check=ok and original 30 questions/6 attempts remain unchanged. UI draft checks reproduce the specific empty-answer error, split numbered/plain warnings and editable notes, remove the error when an answer is supplied, and keep the student preview free of teacher warnings. Desktop and 390px phone note fields are visible without page overflow. Evidence `.data/teacher-note-local-report.json`, `teacher-note-build.log`, `teacher-note-authoring.png`, `teacher-note-authoring-mobile.png`.
- Canonical artifact: `index-8fC-2MIA.js` / `index-DjuOcoRm.css`; `dist/server.cjs` 1,498,171 bytes, SHA-256 `106908cb6ba8e4efe351740c380b35a22b3f17808be6e039dff3c83258e96c09`. Local source server restarted with native SQLite, existing seed-disabled test database and unchanged loopback-only local auth configuration; no production restart or deploy.
