# Flexible images and complete examples in five-Part Listening

The five-Part paper shown in the reported screenshots is the versioned KET
Listening flow (`ket-listening-5-v1`). PET's four-Part flow remains separate.

Part 1 keeps three scored choices A/B/C. New Universal JSON imports must declare
the public image layout of every question independently of its printed number:

```json
{"imageLayout":{"kind":"shared"}}
```

This uses the question's common image above its answers. For separate pictures,
list exactly the choices which have an image:

```json
{"imageLayout":{"kind":"options","optionLabels":["A","C"]}}
```

All three answer texts remain available. The optional stored layout does not change
question IDs, answer IDs, scoring, URLs, the paper version or SQL schema. Missing
layout in existing data is inferred from actual common/option assets, never from
question number 3. Switching layouts retains dormant media in the working draft;
the student response includes only active media and excludes the crop source,
answer keys and transcripts.

New Part 1 imports reject missing `imageLayout` with the printed question number
and keep the working draft unchanged. They do not inherit old layout metadata or
infer the layout of a new question from old image assets. Existing stored and
published content still uses the compatibility inference above.

The editor offers layout selection, image slots and manual crops for every
question. Automatic detection accepts wide common frames and compares every row
with the current layout plan. It displays the proposed mapping before attaching
crops. Missing/extra/overlapping frames stop assignment; manual crop remains
available. Changes to the draft while detection/upload is running prevent stale
attachment. This opt-in detection does not change Movers' frame limits.

For a two-page horizontal source, select **Hai trang nằm ngang** and position the
page split in the gap between the pages (50% by default). Detection groups rows
inside each page, reads the entire left page before the right, and rejects frames
crossing the split or nested/overlapping frames. Source layout, split and example
settings participate in the asynchronous crop fingerprint. Weak or broken scan
borders may not be detected; the original sports-centre scan falls into this
case, and manual crop is available for both the common map and each A/B/C image.

Part 1/3 examples use the existing display-only `examples[].options` contract:
complete question, A/B/C texts, optional example images and the printed correct
label. The correct choice is highlighted and examples never affect scoring.
Example option images use the normal owner/status/type checks and published
asset-usage tracking. Existing prompt/answer-only examples still display as
before; missing original choices cannot be recovered automatically. Re-import
with the updated prompt or enter those choices in the example editor. New Part
1/3 imports require all three example choices and never silently import a
prompt/answer-only example. The error appears next to the JSON field.

The reported example is available in
`docs/examples/ket-listening-part1-sports-centre.json`: Q1 uses the common map,
Q2–5 use three separate pictures, and the unscored example retains
Tuesday/Wednesday/Thursday with C highlighted. Import this file through
**Nhập lại JSON Part 1**. Answer keys are preserved from the user's supplied JSON;
they were not inferred from audio.

When an already-open development tab still shows the old hardcoded Q3 wording,
keep it open, open a fresh `/admin` tab in the same browser, select KET Listening,
and restore the latest device draft **thành bài mới**. Confirm the source image
and all five Parts before closing the old tab. A restored copy has no set ID and
does not autosave into an existing server set. Raw JSON has a separate recovery
slot in its import panel; restoring that text does not apply it to the draft.

Part 4/5 prompts require `content.passage` to contain only the form title, static
context and completed example. Scored row labels go in `questions[].prompt`,
printed fragments in `answerPrefix`/`answerSuffix`, and only the student's missing
text in `answerKey.acceptedAnswers`. Existing imported passages are not silently
rewritten; correct duplicates in the editor or re-import with the updated prompt.

Verification: `npm run test:exam-platform`, `npm run test:listening`,
`npm run test:phase2`, `npm run lint`, `npm run build`, and
`node scripts/ket-listening-flex-browser-smoke.mjs` after building. The browser
fixture runs the actual editor, pixel detector, canvas crop and player with
isolated uploads; it never writes the user's database.
`node scripts/ket-listening-layout-fixture.mjs` serves an isolated manual browser
fixture on loopback3191, with one-page/two-page controls, in-memory PNG uploads
and 320/390px iframe viewports. Control it with the available browser tools;
`/mobile/author-320` and `/mobile/student-390` exercise actual CSS media queries.

Rollback: restore this change's source and rebuild. Stored optional layout
metadata/media remain in the JSON; no destructive migration or bulk rewrite is
needed. Prior published versions and completed attempts remain immutable.
