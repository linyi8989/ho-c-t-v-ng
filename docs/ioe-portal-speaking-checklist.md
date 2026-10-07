# IOE/Violympic portal, editor and Speaking microphone — 2026-10-05

## Scope and decisions

- Finish the three authorized requests: Speaking audio rejection; always-visible IOE upload/paste/play controls and simplified fields; student subsystem inspired by `E:\VS CODE\ioe`.
- Mock exams use the shared bank by subject/grade/level, without a published paper. English grades 1–2: 100 questions; grades 3–9: 200. Math, English Math and Vietnamese: 30. All sessions retain the existing 30-minute server timer and signed engine.
- Wrong-answer practice uses only the current student's completed, server-graded snapshots. Ignore unanswered questions. Keep the latest answered outcome per question; a later correct answer removes it from the pending queue. Preserve all History records, archived bank snapshots and media.
- Practice takes up to 10 pending questions in one subject/grade/level, even if fewer than 10 exist. No full-bank quota and no random substitute when the queue is empty. It uses B's prepare/activate/save/submit/review flow and History.
- No new accounts, profile, storage provider, database tables or schema migration. Scope metadata and immutable versions use the existing competition tables. Practice metadata stays private and cannot be assigned as a public paper.
- Speaking measures audible frames instead of diluting a short utterance across surrounding silence. Keep PCM unchanged, reject silence/DC/clicks/clipping, show signal and microphone selection. Automated provider fixtures incur no paid calls.
- Existing imported sourceNumber and advanced game data remain preserved; only the requested editor controls are removed. Media uploads still use B's ownership/validation/storage service.

## Before implementation

- [x] Read quytac.md, existing CODEMAP, package, related source/styles/tests and source A views.
- [x] Capture dirty intake; preserve unrelated FCE/user work.
- [x] Reproduce Speaking short-phrase/silence rejection and add failing regressions before changing the audio gate.
- [x] Speaking baseline: 43 tests pass; repaired gate: 45 tests pass.
- [x] Backup native live database using SQLite backup API: `.data/ioe-portal-before/local-test-2026-10-05T00-34-53-962Z.sqlite`; quick_check=ok. Speaking source snapshots are in `.data/speaking-audio-before`; previous IOE source checkpoints and dirty intake were retained.

## During implementation

- [x] Verify private queue ownership, unanswered exclusion, immutable snapshots, mastery/removal, preparation retry, answer protection, media and normal History: 11 competition tests pass.
- [x] Verify the four always-visible media controls, upload/paste/remove/play and preservation of imported game/source data: compiled browser path passes. Playback is tested with a trusted mouse gesture; synthetic element.click() had triggered Chrome's autoplay gate, fixed in the test without weakening product assertions.
- [x] Verify browser recording after manual stop and timeout, including a short quiet phrase surrounded by silence; retain explicit retry/no duplicate upload: 45 Speaking domain tests and compiled browser pass.
- [x] Verify portal desktop/mobile, empty/short-bank states, all four subjects, wrong-practice selection and completion: 1440/390/320px, 2 wrong + 28 unanswered → 2 practice correct → 0 pending → same History. Screenshots reviewed.
- [x] Production-shaped backup copy passes private practice prepare/activate/submit/History and owner reads; all 58 tables/1,314 original rows preserved, live database unchanged, no new schema. `.data/ioe-portal-preservation-report.json`.

## After implementation/build

- [x] Typecheck, relevant domain tests and broad regression gates pass: `test:phase3`, 584 pass / 0 fail, `.data/ioe-portal-speaking-regressions.log`.
- [x] Canonical Node 22.16.0 final build/typecheck/startup and both feature bundle checks pass: `.data/ioe-portal-final-{build,lint,startup,bundle}.log`, `.data/speaking-audio-final-bundle.log`.
- [x] Run browser end-to-end on isolated fixtures and compiled backend; inspect screenshots/overflow/contrast and browser exceptions: no overflow/exceptions, IOE contrast ≥6.70:1, Speaking ≥5.78:1. Reports in `.data/ioe-verification` and `.data/speaking-verification`.
- [x] Repeat IOE compiled browser after the final reset error guard: `.data/ioe-portal-final-browser.log`; passed on a fresh fixture, including full wrong-practice/History/media/Enter/assignment flow. Final proof `.data/ioe-portal-final-report.json`.
- [x] Verify legacy modules/History/assignment paths; no QA writes to the live database. Browser preserves all 978 computed legacy CSS controls and real fixed assignment/autosave/review/History flows.
- [x] Update CODEMAP section 154 and artifact ledger, inspect final source/diff, restart local server to serve updated backend. Local bank/practice/capability and new source GETs return 200; Azure/DevQuota configured. Local read-only bank preview passes. `.data/ioe-portal-local-proof.json`, `.data/ioe-portal-local-preview.log`.
- [x] Document verified results and limits: real user's microphone and real Azure pronunciation cannot be proven by synthetic fixtures alone; no live pronunciation/LLM call in this repair. Localhost is ready for the user to record with the selected device and inspect the live meter.
