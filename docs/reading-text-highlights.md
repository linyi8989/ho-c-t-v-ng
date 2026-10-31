# FCE Reading Part 3 text and temporary Reading highlights

## Scope

- FCE B2 First Reading (`fce-reading-3-v1`) Part 3 accepts public source text as well as an optional teacher-owned image. Other FCE papers and Parts keep their existing authoring/validation contracts.
- PET Reading and FCE Reading, including the released combined FCE Reading & Use of English player, support temporary yellow highlights in registered reading text regions. The reusable renderer can support IELTS later; IELTS is not enabled in this release. Listening and Writing are not enabled.

## Authoring Part 3

The whole-paper and focused-Part ChatGPT prompts request a complete, source-faithful transcription in `blocks[0].content.passage`, preserving headings, names, A–D labels, paragraph order and line breaks. Question rows, official answer-key provenance and private explanations retain their existing contracts. ChatGPT must not return media URLs, asset IDs, HTML, answer-key content inside the passage, or invent unreadable source text.

Example fragment (inside the existing `exam-bundle-import-v2` envelope):

```json
{
  "partNumber": 3,
  "blocks": [{
    "blockNumber": 1,
    "interaction": {
      "family": "text-entry",
      "subtype": "letter",
      "variant": "multiple-matching-letter-entry",
      "schemaVersion": 1
    },
    "content": {
      "passage": "TRAVELLERS\n\nA — Anna\nComplete source text A.\n\nB — Ben\nComplete source text B.\n\nC — Clara\nComplete source text C.\n\nD — David\nComplete source text D.",
      "questions": []
    }
  }]
}
```

The example omits the fifteen required question rows for brevity. Use the editor's copied prompt for the complete shape. No schema version bump or SQL migration is required: `passage` already exists.

The normalizer lifts first-block text into canonical `part.passage` and preserves it across editor changes, saves and publication. Optional Part 3 text must be a string of at most 20,000 characters; malformed values, control characters and oversized input are rejected before coercion/truncation. Empty text is valid when a managed image is selected. Existing image-only JSON remains valid. The editor preserves trailing newlines while typing.

Display order is **selected image first; otherwise nonblank text**. JSON import preserves existing teacher images. To use newly imported text in an existing image-based paper, use “Gỡ ảnh khỏi Part này để dùng văn bản”, then save/publish. This only removes the Part reference; it does not delete the library image. The image used as ChatGPT extraction input is not automatically attached to student content. Publication requires text or an authorized managed image; attached images retain ownership/status/kind validation even when text also exists.

Desktop shows the source at left and the fifteen A–D input rows at right. Mobile stacks source above questions. Long desktop text scrolls inside its source frame. The result viewer uses the same image/text fallback. Old published image-only papers continue to work and are not rewritten.

## Student highlight behavior

1. Select reading text with the normal browser selection gesture.
2. One floating button, **Đánh dấu**, appears near the selection.
3. Click/tap it to apply dark text (`#111827`) on a yellow background (`#ffeb3b`) with a subtle rounded inset frame and full opacity. The frame repeats on each wrapped line without changing the text size, spacing or line breaks.

There are no color selectors, erase controls, comments or per-account settings. Overlapping/adjacent marks merge. Selection spanning inline answer gaps marks only source text; gap numbers, inputs and buttons are excluded. PET notices, person descriptions, shared A–H text banks and passages use stable field/fragment keys. FCE paragraphs, inline-gap source fragments, sentence banks and the new Part 3 text share the same renderer. Images cannot be text-highlighted.

Marks live exclusively in React memory for the active run, keyed by owner/set/version/client run. They remain when changing Parts, and disappear on page reload, successful submission, leaving the player or starting a fresh run. They are never saved in browser storage, imported JSON, teacher content, API answers, attempts or History. Existing answer recovery storage is unchanged. Post-submit review and author previews do not mount a highlight session.

The implementation renders controlled React `mark` spans from character intervals. It does not mutate React-owned DOM with `surroundContents`, save HTML, or alter question/input identities. Selection starting in paragraph padding is accepted when the resulting Range includes eligible source text. Source text changes cannot reuse old offsets.

## Verification and rollout

Evidence and disposable test artifacts: `.data/reading-text-highlight-qa`. Native backup and table fingerprint verification protect the local 58-table database. API tests use temporary copies, with no user database writes or paid AI calls.

Required regression cases include whole/focused import; malformed/oversized text; repeated normalization/save/publish; text-only/image-only/both/empty; managed-image ownership; immutable attempts/review/History; exact repeated phrases; overlapping highlights; selection across gaps and near text margins; Part navigation; refresh/submission/retry clearing; desktop/mobile layout and computed contrast.

Deploy the canonical client build and `dist/server.cjs`, then restart Node/Passenger. A push alone does not update a running process. Rollback to a server that requires a Part 3 image would make new text-only drafts unpublishable and older client renderers would not show their text: keep this fallback/validation when rolling back unrelated features, or restore a matching release before publishing text-only papers. Existing published versions and answers are never bulk-migrated.
