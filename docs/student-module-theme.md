# IOE/Violympic and Speaking student presentation

The two student areas now reuse the approved sky, trees and castle illustration,
self-hosted Nunito, cream panels with blue frames, rounded cards and raised
blue/green controls. The navigation header stays transparent over the sky.

The scenery now uses the shared fixed viewport layer, preserving its aspect ratio
through long pages and mobile scrolling. See [storybook-background.md](storybook-background.md).

`StudentModuleHeader.tsx` imports `student-module-theme.css`. Only student roots
with `data-student-module-theme="storybook"` opt in. The shared feature styles,
admin screens, home entry cards and History review adapters stay intact.

IOE covers the overview, immediate mock exam selector, wrong-answer practice,
prepared/active exam, completion and answer review. Question navigation has
44px targets; answer controls, the timer and submit action share the theme.
Correct, incorrect and unanswered reviews retain their distinct status colors.

Speaking covers its searchable library, lesson cards, reading deck, microphone,
recording/upload/retry/waiting states, scores and detailed review. The recording
button changes from green to red while recording. Long references wrap and grow;
set review tables scroll inside their own container on small screens.

The components add presentation wrappers/hooks only. Existing callback bodies,
session/recording state, keyboard handling, locks, API calls, owner checks,
scoring, queue processing and stored records are unchanged. No schema, provider,
dependency, environment-file or global CSS change is required.

## Verification

- Before/after: Competition 13 tests and Speaking 55 tests pass.
- `npm run lint` and canonical Node 22.16.0 `npm run build` pass.
- Existing real-browser Competition and Speaking suites retain their behavior
  assertions. The shared browser helper measures gradient endpoints after the
  cascade, readable disabled/selected controls, target sizes, keyboard focus,
  gentle desktop hover and reduced motion. Both suites exercise 1440/390/320px.
- IOE covers direct launch, failure/retry, Enter/IME/modifiers, mouse answers,
  final submit/review and wrong-answer practice. Speaking covers actual fixture
  WAV capture, timeout/manual stop, upload retry, playback, expired-run renewal,
  long cards, background queued grading and completed-set review. Paid provider
  requests are replaced by fixtures.
- Localhost catalog/lesson checks use GET requests only and observe zero API
  writes/runtime exceptions. Desktop/mobile screenshots were inspected.
- 22 guarded backend/API/type/shared CSS/asset/package files retain exact
  hashes. State/handler prefixes in both student components match the snapshot.

Evidence is in `.data/student-module-theme-verification/`: browser reports,
screenshots, `proof.json`, source diff and artifact fingerprint. Logs use the
`.data/student-module-theme-*` prefix. The source snapshot is
`.data/student-module-theme-before`.

For IOE browser writes, use a fresh isolated native SQLite database and the
explicit `COMPETITION_QA_ALLOW_FIXTURE_WRITES=true` flag. When another Vite
middleware server already owns the HMR port, serve an isolated compiled QA
client against that fixture backend; keep the shipped build untouched and keep
runtime-error assertions enabled. Speaking already manages its own isolated
compiled frontend/backend.

## Rollback

Protect newer edits, then restore only the two student presentation files and
the browser scripts from the snapshot, remove the new header/theme/helper, and
rebuild normally. Restore no database or recordings; never delete WAL sidecars.

The only build warning is the existing Vite chunk-size warning. No commit, push
or production deployment is part of this request.
