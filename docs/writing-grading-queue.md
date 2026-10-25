# Parallel Writing grading and bounded retries

## Problem and implementation

The initial repair introduced a two-per-provider/four-total admission limit.
The user explicitly replaced that policy: distinct essays must start
concurrently without an application concurrency cap. Only repeated requests
for the same essay must be serialized and bounded.

The existing `exam_attempts` and `exam_attempt_details` remain the durable job
store. No SQL migration, dependency, essay rewrite, rubric or score change is
introduced. KET/PET and standalone Writing share the same grading worker.

- Each distinct attempt starts independently. There is no application limit
  of two, four or another fixed number, and no shared provider cooldown. The
  removed queue module and concurrency environment variables are not used.
- The router claims/reloads the attempt, detail and immutable version under
  its attempt-specific grading lock. Duplicate submissions do not create
  concurrent calls for the same attempt. Teacher-completed jobs are skipped;
  stale results cannot overwrite teacher scores. A newer retry cycle resumes
  after the old worker exits.
- Each essay makes one initial call and at most two sequential retries: three
  calls maximum per automatic cycle. Permanent authentication/configuration
  errors stop earlier. Requests use the explicitly selected provider.
- Retry uses jittered backoff (about one then two seconds) and honors
  seconds/HTTP-date `Retry-After` for that essay alone. Its wait never holds
  another student's essay.
- A retry wait above 30 seconds ends that cycle without retrying early. The
  learner retry deadline retains the upstream wait. A
  failed attempt remains available for the existing learner/teacher retry or
  manual grading flow; failed work is not silently regraded on deployment.
- The 60-second deadline covers fetch, body decoding and result validation;
  abort plus a promise deadline prevents a stalled body from holding the worker.
- Error messages distinguish provider limiting, timeout, network and invalid AI
  results. Permanent configuration/authentication failures remain teacher-only.
  Structured logs include safe reason/category/status instead of raw AI output.

## Hosting configuration

No Writing concurrency setting is required. Previously suggested
`WRITING_GRADING_CONCURRENCY_PER_PROVIDER` and `WRITING_GRADING_TOTAL_CONCURRENCY`
are no longer read and may be removed from hosting configuration if added.

The existing attempt locks/dedup are local to a Node process. For strict
cross-process duplicate protection, multiple Passenger workers require a shared
atomic job claim; the existing check-then-write lease is not that guarantee.
This is distinct from limiting the number of different essays. Do not overwrite
the host-managed `.htaccess` as part of this change.

The queue survives restart through the existing durable recovery scan every
30 seconds: queued work starts again, an expired processing lease is
recovered and an unexpired lease is respected.

Deploy the canonical build and restart the Node application once. No new API
key is needed. Hosting deployment and its incident logs have not been accessed
as part of local verification. Confirm the new server bundle on the host and
test with a class. External provider quota and
availability remain external constraints.

## Verification and rollback

- `npm run test:exam-platform` includes provider and real-router tests.
- Router tests submit twenty distinct students through actual HTTP endpoints,
  verify all twenty start before any peer finishes, durable answers, duplicate
  submission, teacher decisions, protected retry and startup
  recovery. Provider tests use mocked transports only; no paid requests.
- Run the router suite with native SQLite/WAL and an optional verified database
  copy using `WRITING_TEST_SQLITE_DRIVER=better-sqlite3` and
  `WRITING_TEST_DB_COPY=/absolute/path/to/verified-copy.sqlite`. It creates its
  own disposable copy and refuses to process recoverable real attempts.
- Broad gates, build manifest verification and the main database fingerprint
  comparison are recorded in `CODEMAP.md`; local evidence is under
  `.data/writing-parallel-qa` (the previous capped-policy evidence remains under
  `.data/writing-pipeline-qa`).

Rollback restores these source changes and rebuilds/restarts the prior server.
Existing essays, published versions, URLs, scores and retry records stay in the
same collections; no destructive migration needs reversing.
