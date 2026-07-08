# CODEMAP - V-Homework Vocabulary Learning Platform

Last updated: 2026-07-05

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
  - `Login.tsx` calls `/api/auth/email-by-phone`.
  - Backend finds user profile by phone.
  - Client logs in with returned email and password.
- Phone OTP helper methods exist in `AuthContext`, but current `Register.tsx` uses email registration with optional phone, not full OTP registration UI.

Profile sync behavior:

1. On auth state change, Firebase ID token is fetched.
2. A fallback profile is created locally.
3. Client attempts direct Firestore read from `users/{uid}`.
4. Client attempts backend `/api/me`.
5. If no profile exists, client attempts direct Firestore profile creation.

Important: frontend intentionally has direct Firestore fallback paths when backend API is unavailable.

### Backend Auth

`server.ts` middleware:

- `authenticateUser`: requires `Authorization: Bearer <Firebase ID token>`.
- Verifies token with `adminAuth.verifyIdToken`.
- Loads/creates `users/{uid}` profile.
- Assigns `super_admin` role automatically for:
  - `linyi8901@gmail.com`
  - `admin@vocabulary.edu.vn`
- Blocks API access if user status is `blocked`.
- Adds `req.user`.

`requireRole([...])` restricts teacher/super_admin/admin-only endpoints.

### Roles

Current active roles in backend and auth context:

- `student`
- `teacher`
- `super_admin`

Note: `src/types.ts` still declares `Role = 'admin' | 'teacher' | 'student'`, which is stale/inconsistent with current app code that uses `super_admin`.

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
- `audit_logs`

### User Profile

Fields used:

- `id`
- `name`
- `email`
- `phone?`
- `role`: `student | teacher | super_admin`
- `status`: `active | pending | blocked | deleted`
- `createdAt`

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

Authenticated:

- `GET /api/me`: current user profile.
- `POST /api/register`: sync registration profile fields.
- `POST /api/ai/ipa`: generate IPA for one word.
- `GET /api/vocab-sets`: list vocab sets; students only receive `public`.
- `GET /api/classes`: list classes.
- `GET /api/class-members`: list class members.
- `GET /api/assignments`: list assignments.
- `POST /api/game-sessions`: start game session.
- `PUT /api/game-sessions/:id`: complete/update game session.
- `GET /api/results`: list completed game sessions.

Teacher or super admin:

- `POST /api/ai/generate`: generate vocab items by topic/grade/count.
- `POST /api/vocab-sets`: create vocab set.
- `PUT /api/vocab-sets/:id`: update vocab set.
- `DELETE /api/vocab-sets/:id`: delete vocab set and related assignments.
- `POST /api/vocab-sets/:id/clone`: clone vocab set as draft.
- `POST /api/classes`: create class.
- `DELETE /api/classes/:id`: delete class, members, and assignments.
- `POST /api/classes/:classId/members`: add class member.
- `DELETE /api/classes/:classId/members/:memberId`: delete class member.
- `POST /api/assignments`: create assignment.
- `DELETE /api/assignments/:id`: delete assignment.

Super admin only:

- `GET /api/admin/users`: list all users.
- `PUT /api/admin/users/:userId/role`: change role and Firebase custom claims.
- `PUT /api/admin/users/:userId/status`: lock/unlock/change status.
- `GET /api/admin/audit-logs`: list audit logs ordered by timestamp desc.

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
- Super admin user management.
- Super admin audit logs.

Key state groups:

- Data lists: `vocabSets`, `classes`, `classMembers`, `assignments`, `results`, `usersList`, `auditLogs`.
- Filters: vocab search/grade/status; user search/role/status.
- Editor state: title, description, subject, grade, status, tags, items.
- Batch import: terms, meanings, IPAs.
- AI generation: topic, grade, count, loading.
- Assignment form state.
- Notifications.

API wrapper:

- `authFetch(url, options)` injects `Authorization: Bearer ${token}` and JSON content type.

When extending admin features, consider extracting smaller modules before large changes:

- Vocab editor panel.
- Classes panel.
- Assignments panel.
- Results panel.
- Users panel.
- Audit logs panel.

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
- Starts a game session when selected game and student name are ready.
- Completes session when game calls `onComplete`.
- Uses backend `/api/game-sessions`; falls back to direct Firestore write/update if backend fails.

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
- Score: known count / total; if no known marks, assumes all correct.

`QuizGame.tsx`:

- Linear multiple choice.
- Generates up to 3 distractors from other items.
- Supports term, meaning, and sound question modes.
- Score: correct / total.

`FillBlankGame.tsx`:

- Linear text input.
- Modes: full word or missing letters.
- Case-insensitive exact match.
- Score: correct / total.

`MatchingGame.tsx`:

- Board game with max 8 vocab items.
- Cards are term/meaning pairs.
- Timer counts elapsed seconds.
- Score: `max(50, 100 - mistakes * 5)`.

`MemoryGame.tsx`:

- Board game with max 6 vocab items.
- Cards are term/meaning pairs.
- Score: `max(50, 100 - excessMoves * 4)`.

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

`firestore.rules` currently allows broad authenticated access:

- `users/{userId}`: any auth user can read all users, only owner can write own user doc.
- `vocab_sets`, `classes`, `class_members`, `assignments`, `game_sessions`: any auth user can read/write.
- `audit_logs`: any auth user can read/write.

Important security concern:

- Backend enforces role restrictions, but frontend direct Firestore fallback and rules allow authenticated users to write many collections.
- If the hosted app is public, tighten Firestore rules before adding sensitive admin features.

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

- `src/types.ts` role union is stale: includes `admin`, not `super_admin`.
- `firebase-blueprint.json` is partly stale compared with actual runtime schema. For example it uses fields like `topic`, `creatorId`, `gameType`, `studentId`, while runtime uses `subject`, `createdBy`, `gameId`, and name-based sessions.
- Firestore rules are much more permissive than backend roles.
- Client has direct Firestore fallback writes for profile and game sessions; this bypasses backend audit/role logic.
- `/api/game-sessions` is protected by `authenticateUser`, but `StudentLearningArea` fetch does not send Authorization header. In normal logged-in app this route likely fails and then direct Firestore fallback creates sessions.
- `App.tsx` imports unused icons/states such as `classes`, `homeSearch`, etc. Some UI/filter state appears incomplete.
- `AdminDashboard.tsx` is large and hard to maintain; high risk for merge conflicts and accidental UI regressions.
- ID generation uses `Date.now()` plus random suffix in some places, not a central ID helper.
- Game scoring in `QuizGame` and `FillBlankGame` may compute final score from state values before the latest async state update if completion happens immediately after answering. Review before building advanced analytics.
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

- `firebase-first`: use Firebase/Firestore when diagnostics pass, with local resilience.
- local JSON fallback through the compatibility layer in `src/lib/firebaseAdmin.ts`.
- SQLite mode through `src/lib/sqliteStorage.ts` when `STORAGE_MODE=sqlite`.

SQLite notes:

- `src/lib/sqliteStorage.ts` stores normalized tables plus `data_json`.
- `vocab_items.audio_url` already exists and maps from `audioUrl`.
- `vocab_sets` are saved with nested `items`, and items are also upserted into `vocab_items`.
- `game_sessions` include `guestId` through JSON/data fields and are used for leaderboard identity.

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
- Production should use these environment variables when SQLite is the data source:
  - `STORAGE_MODE=sqlite`
  - `SQLITE_DB_PATH=/home/qzmivzbj/app-data/vhomework/app.sqlite`
  - `LOCAL_DB_PATH=/home/qzmivzbj/app-data/vhomework/db.json`
  - `DIAGNOSTIC_SECRET=<host-only secret>`

Mandatory rules to prevent repeat incidents:

- Never add automatic physical deletes on production data during app startup, login, page load, or read endpoints.
- "Recent" UI requirements must be implemented with query/filter limits first. Physical cleanup must be a separate, explicit maintenance task with backup and confirmation.
- Never point production fallback storage at the deploy directory. Runtime data must live under a persistent data directory such as `/home/qzmivzbj/app-data/vhomework`.
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

Registry:

- `src/lib/game-engine/gameList.ts` has `hidden?: boolean` support.
- `StudentLearningArea.tsx` derives `VISIBLE_GAMES_LIST = GAMES_LIST.filter(game => !game.hidden)`.

### Leaderboard / Bảng Vàng

- `src/lib/leaderboard.ts` computes honor score from completed game sessions.
- Current concept:
  - best result per student/vocab set/game mode
  - completed lessons
  - average accuracy
  - study days
  - improvement bonus
- Student home and Admin results tab both use leaderboard-derived rows.
- `StudentLearningArea.tsx` also uses the total leaderboard, not per-vocab-set ranking.
- The in-game leaderboard supports a class filter beside the week/month filter.
- Student names in the in-game leaderboard display a class suffix when class data exists, e.g. `Nguyen Van A - Lop 3`.
- `/api/public/results` returns `classId`/`className`; old sessions are backfilled at read time from `assignmentId`, and new sessions store class metadata when created.

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

The default pronunciation path is browser Web Speech API:

- `src/lib/game-engine/speech.ts`
  - exports `speakEnglish(text: string)`
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
- `AdminDashboard.tsx` example audio preview
- `SpeakingAIGame.tsx` fallback

Current direct audio URL support:

- `VocabItem.audioUrl?: string`
- `MillionaireGame.tsx` can play `item.audioUrl` or alternate fields:
  - `audio`
  - `sound`
  - `pronunciationAudio`
- `SpeakingAIGame.tsx` can play `audioUrl` when target text is the term.
- AI vocab detail routes currently return `audioUrl: ""`; no server-side audio generation exists yet.

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
- Changing the English term in the editor clears stale audio metadata for that row so old files are not reused for new text.
- Vocab item metadata stores only lightweight references:
  - `audioUrl`
  - `audioPath`
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
- Teachers can generate TTS audio before saving a vocab set. The editor stores returned `audioUrl`/`audioHash` metadata on each row, then saves that metadata with the vocab set.
- Optional post-save generation still exists for missing audio when `ttsSettings.autoGenerate` is enabled, but the preferred workflow is generate/check audio first, then save the set.
- TTS failure marks the item as `audioStatus: "failed"` and preserves the vocab set.

Current backend endpoints:

- `GET /api/tts/voices`: backend proxy for AI33 Voice Library.
- `POST /api/tts/preview`: generates/plays a cached short preview.
- `GET /api/vocab-sets/:id/audio/status`: returns per-item audio metadata.
- `POST /api/vocab-sets/:id/audio/generate-missing`: queues missing/retry audio generation.

Required production env vars for TTS:

```text
AI33_API_KEY=<host-only key>
TTS_AUDIO_DIR=/home/qzmivzbj/app-data/vhomework/audio
AI33_TASK_STATUS_URL_TEMPLATE=https://api.ai33.pro/v1/task/{taskId}
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
