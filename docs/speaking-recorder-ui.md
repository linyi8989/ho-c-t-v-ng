# Speaking: compact sample and recording controls

Student lessons render device speech as a labelled speaker icon via `SampleAudio`'s optional `compact` prop. It reads the current reference text and locale, stops when recording starts, and retains accessible disabled/error states. Stored sample audio and the admin preview keep their existing controls.

The microphone selector and device name are hidden in student lessons. A disconnected saved input automatically falls back to the operating system's default input. Missing devices, denied permission, busy microphones, disconnection and silent recordings display actionable guidance.

`RecordingBar.tsx` displays a compact rounded strip with cancel, a live waveform, elapsed time, stop and send. The waveform contains the last 64 measured RMS levels from the existing AudioWorklet/resampler, without simulated animation. Its accessible meter exposes the current signal level. All icon controls have labels/tooltips and 44px touch targets.

Cancel releases the microphone, invalidates any pending flush and discards the capture without uploading. Stop and send both finish the recording through the existing validation/automatic upload path. Reaching the time limit, retained WAV on upload failure, explicit retry, navigation guards and background grading are unchanged. No provider, daily quota, queue, storage or API changes.

Styles are scoped to the student Speaking root in `recording-bar.css`; the existing background, cards and typography remain. The meter follows actual audio, with no decorative motion in reduced-motion mode.

Verification: `npm run lint`, `npm run test:speaking`, canonical Node 22 `npm run build`, and `npm run test:speaking-browser`. Browser coverage includes desktop/390/320px recording layouts, real waveform input, microphone fallback, cancellation and track cleanup, sample icon text/locale, stop/send/timeout, upload retry, permission/missing microphone/silence, playback and pending History. Tests use an isolated native SQLite fixture and synthetic audio, with commercial providers disabled.

Evidence: `.data/speaking-recorder-{baseline,lint,tests,build,browser}.log`, `.data/speaking-verification/browser-report.json`; before-change sources in `.data/speaking-recorder-before`.

Failed-attempt actions **Yêu cầu chấm lại bản thu** and **Đọc lượt mới** share a centered, non-wrapping `speaking-result-actions` row. Labels wrap inside their buttons on small screens; both buttons keep equal height and fit the reading card. Completed attempts retain only the new-reading button. Handlers, disabled conditions and retry/recording behavior are unchanged. GET-only localhost QA at 1440/390/320px verified both controls on one row, no overflow, >=44px heights and existing contrast/focus/hover behavior. Typecheck and canonical build pass; evidence `.data/speaking-action-row-verification/live-browser.json`, scoped logs and `.data/speaking-action-row-before`.
