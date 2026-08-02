# YupVox TTS

YupVox is available as an optional backend TTS provider for vocabulary audio. AI33 remains the default so existing sets and cached audio continue to work unchanged.

## Environment variables

Local `.env` or host environment:

```text
YUPVOX_API_KEY=sk-yupvox-your-real-key
YUPVOX_BASE_URL=https://api.yupvox.com
YUPVOX_TTS_POLL_ATTEMPTS=40
YUPVOX_TTS_POLL_INTERVAL_MS=1500
```

Restart the Node server after changing environment variables. Never prefix the key with `VITE_`, put it in frontend code, commit `.env`, or paste the real value into logs/issues.

## Editor workflow

1. Open the vocabulary editor and choose `YupVox` in the TTS provider field.
2. Enter a YupVox Voice ID. The project default is `EBF147`.
3. Preview or generate audio as usual, then save the vocabulary set.

The backend sends `POST /v1/tts` with `{ voiceId, text }`, polls `GET /v1/tts/{jobId}`, downloads the completed `audioUrl`, validates it, and stores the result in the existing local TTS cache. The current YupVox contract does not accept `speed`, so YupVox settings are normalized to `1.0`.

## Failure behavior

- Polling is bounded; a stuck provider job cannot create an infinite request loop.
- A failed item receives `audioStatus: "failed"`; the vocabulary set is not deleted.
- Cached audio and the client Web Speech fallback continue to work.
- The provider key stays on the server and is never returned to the browser.
