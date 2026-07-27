# CODEMAP - V-Homework Vocabulary Learning Platform

Last updated: 2026-07-27

## 1. Project Overview

This project is a full-stack vocabulary learning web app for students, teachers, and super admins.

Core capabilities:

- Student login/register and vocabulary learning portal.
- Teacher/admin dashboard for vocabulary sets, classes, assignments, results, and AI generation.
- Game engine with flashcards, quiz, fill-blank, matching, and memory games.
- Firebase Authentication plus Firestore data storage.
- Express backend API with Firebase Admin and a local `db.json` fallback layer.
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

## 2. Important Files

### Root

- `package.json`: scripts and dependencies.
- `server.ts`: Express API server, auth middleware, seed logic, Gemini routes, CRUD routes, static/Vite serving.
- `app.js`: production entry that imports `./dist/server.cjs`.
- `vite.config.ts`: Vite config, React plugin, Tailwind plugin, alias `@` to repo root, output `dist/client`.
- `tsconfig.json`: TS config; `allowJs`, `noEmit`, bundler module resolution.
- `index.html`: Vite HTML entry.
- `src/main.tsx`: React root; wraps app in `AuthProvider`.
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
- `src/lib/firebase.ts`: Firebase client initialization.
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

In production, `server.ts` serves `dist/client` statically and returns `index.html` for SPA fallback routes.

### cPanel Deploy

`.cpanel.yml` copies:

- `dist/client/*` to `/home/qzmivzbj/app.msdieu.com`.
- full `dist` folder.
- `app.js`, `package.json`, `package-lock.json`, `db.json`.

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

1. On auth state change, Firebase ID token is fetched.
2. Client verifies the profile through backend `/api/me`.
3. Protected UI uses the backend-verified profile only.
4. Registration calls backend `/api/register` and requires that backend profile sync succeeds.

Important: direct client Firestore profile write fallback was removed in the Phase 1 security hardening pass. Backend Admin SDK is the profile write path.

Phase 2 authorization hardening:

- `/api/results` is role-scoped: super admin can view all completed activity, teachers only view activity tied to vocab/grammar/classes/assignments they manage, and students only view their own authenticated activity.
- Teacher write actions now go through ownership helpers for vocab sets, classes, class members, assignments, grammar sets, and TTS actions.
- Assignment private links must use random `shareToken`/`assignmentSlug`; the server no longer treats a predictable assignment id as a valid share token.
- Vocabulary private links have two explicit access contexts: an assignment token binds the session to that assignment/game/class, while a direct vocab-set token opens the private set without guessing an assignment and uses the set/grade class metadata. `GET /api/vocab-sets/share/:token` and `POST /api/game-sessions` share the same token resolver, and guest session creation revalidates the token.
- Legacy assignments missing share tokens are backfilled with random tokens when assignment lists/share links are read.
- Starting a vocabulary game rejects draft or unavailable vocab sets unless a valid assignment context makes the lesson eligible.

### Backend Auth

`server.ts` middleware:

- `authenticateUser`: requires `Authorization: Bearer <Firebase ID token>`.
- Verifies token with `adminAuth.verifyIdToken`.
- Loads/creates `users/{uid}` profile.
- Assigns `super_admin` role automatically for:
  - `linyi8901@gmail.com`
  - `admin@vocabulary.edu.vn`
- Accepts `super_admin` only from a Firebase custom claim or the bootstrap admin email list.
- Blocks API access unless user status is `active`.
- Adds `req.user`.

`requireRole([...])` restricts teacher/super_admin/admin-only endpoints.

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
- `GET /api/results`: list completed game sessions.

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
- Legacy activities with a `guestId` are backfilled additively into `guest_profiles` using the most recent activity name. Activities without a stable user/guest id are left untouched and marked `legacyUnlinked` in enriched API output.

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

`src/App.tsx` decides which screen to show:

1. Loading screen while auth restores.
2. Login/Register if no authenticated user.
3. Blocked account screen if status is `blocked`.
4. `StudentLearningArea` if a vocab set is selected.
5. `AdminDashboard` if user is `teacher` or `super_admin` and not in student-view mode.
6. Student home portal otherwise.

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

`MatchingGame.tsx`:

- Board game with max 8 vocab items.
- Cards are term/meaning pairs.
- Timer counts elapsed seconds.
- Score: `max(50, 100 - mistakes * 5)`.
- Interval and short-lived failed-card timeout are stored in refs and cleared on restart/unmount.

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
- SQLite mode through `src/lib/sqliteStorage.ts` when `STORAGE_MODE=sqlite`.
- Legacy `firebase-first` is normalized to `firebase`; Firestore read/write failure returns a storage-unavailable API error instead of switching to local data.

SQLite notes:

- `src/lib/sqliteStorage.ts` stores normalized tables plus `data_json`.
- `vocab_items.audio_url` already exists and maps from `audioUrl`.
- `vocab_sets` are saved with nested `items`, and items are also upserted into `vocab_items`.
- `game_sessions` include `guestId` through JSON/data fields and are used for leaderboard identity.
- `leaderboard_events` stores compact completed-attempt summaries for longer-lived leaderboard calculations.
- sql.js persistence writes to a temporary DB file, fsyncs it, then renames it over the active SQLite file. This reduces corruption risk from interrupted writes but does not make sql.js a multi-worker database.

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
  - `SQLITE_DB_PATH=/home/qzmivzbj/app-data/vhomework/app.sqlite`
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
  - `/api/leaderboard-results` and `/api/public/leaderboard-results` return compact `leaderboard_events` plus legacy sessions/attempts still inside the leaderboard retention window.
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

- Backend-only provider calls through AI33 v3 Text To Speech.
- Frontend never sends the provider API key and never calls AI33 directly.
- Audio files are cached under the persistent host path:

```text
/home/qzmivzbj/app-data/vhomework/audio/
```

- Express serves cached files through:

```text
/audio/{audioHash}.mp3
```

- `audioHash` is deterministic:

```text
provider + lang + voice + speed + normalizedText
```

- `normalizedText` preserves case and is produced from sanitized TTS text, not raw row text.
- TTS input cleanup uses the first non-empty line, removes trailing notes/IPA, removes text after a separator like `word - meaning`, collapses whitespace, and caps text at 120 chars. The returned metadata includes `ttsText` plus `audioWarnings` so teachers can see what was actually sent to TTS.
- Cached audio is reused when the hash/file already exists. A forced regenerate bypasses the existing cache file and returns a cache-busted `/audio/{hash}.mp3?v=...` URL.
- Backend TTS calls use an abort timeout (`TTS_FETCH_TIMEOUT_MS`), downloaded audio is capped (`TTS_MAX_AUDIO_BYTES`), and cache writes use a temp file followed by atomic rename.
- In-flight generation is deduped by `audioHash` so concurrent requests for the same text/voice/speed do not create duplicate provider jobs in the same server process.
- `normalizeTtsSettings` currently restricts provider to `ai33`. Add a real adapter before accepting another provider value.
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

- `GET /api/tts/voices`: backend proxy for AI33 Voice Library.
- `POST /api/tts/preview`: generates/plays a cached short preview.
- `POST /api/tts/batch-preview`: generates editor batch audio before save. Backend dedupes by `audioHash` and runs up to 5 concurrent TTS jobs by default (`TTS_CONCURRENCY`, clamped 1-10).
- `GET /api/vocab-sets/:id/audio/status`: returns per-item audio metadata.
- `POST /api/vocab-sets/:id/audio/generate-missing`: queues missing/retry audio generation. Queue processing groups duplicate hashes and runs up to 5 concurrent TTS jobs while keeping DB writes batched to status phases.

Required production env vars for TTS:

```text
AI33_API_KEY=<host-only key>
TTS_AUDIO_DIR=/home/qzmivzbj/app-data/vhomework/audio
AI33_TASK_STATUS_URL_TEMPLATE=https://api.ai33.pro/v1/task/{taskId}
TTS_CONCURRENCY=5
TTS_FETCH_TIMEOUT_MS=30000
TTS_MAX_AUDIO_BYTES=3145728
```

Keep Web Speech as the final fallback only when cached audio is missing or browser playback fails.

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

Observed bottlenecks:

- Production SQLite uses `sql.js`. Every standalone write exports the whole database, writes a temporary file, calls `fsync`, and renames it over the active file.
- The old `SQLiteQuery.get()` always loaded a full table and filtered in JavaScript, so SQL indexes were not used.
- Grammar attempt creation/history scanned all `grammar_attempts`.
- Each incremental game action scanned all `game_session_actions`, wrote the action, then persisted the session separately.
- Game completion resent every action before submit even when each action had already been saved.

Implemented behavior:

- Slow game/grammar APIs return a `Server-Timing` header and log `[PERF]` when total duration exceeds `SLOW_API_LOG_MS` (default 500 ms). In SQLite mode, each log also reports `persists` and `persistMs`, measured from the real `persistDb()` calls, so export/fsync cost can be verified instead of inferred.
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
- Native `better-sqlite3`/WAL remains a separate staging task because cPanel native-binary compatibility must be verified before changing the production storage driver.
