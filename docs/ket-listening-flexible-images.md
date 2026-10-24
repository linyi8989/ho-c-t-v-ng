# Flexible images and complete examples in five-Part Listening

The five-Part paper shown in the reported screenshots is the versioned KET
Listening flow (`ket-listening-5-v1`). PET's four-Part flow remains separate.

Part 1 keeps three scored choices A/B/C. Each question may declare its public
image layout independently of its printed number:

```json
{"imageLayout":{"kind":"shared"}}
```

This uses the question's common image above its answers. For separate pictures,
list exactly the choices which have an image:

```json
{"imageLayout":{"kind":"options","optionLabels":["A","C"]}}
```

All three answer texts remain available. The optional layout does not change
question IDs, answer IDs, scoring, URLs, the paper version or SQL schema. Missing
layout in existing data is inferred from actual common/option assets, never from
question number 3. Switching layouts retains dormant media in the working draft;
the student response includes only active media and excludes the crop source,
answer keys and transcripts.

The editor offers layout selection, image slots and manual crops for every
question. Automatic detection accepts wide common frames and compares every row
with the current layout plan. It displays the proposed mapping before attaching
crops. Missing/extra/overlapping frames stop assignment; manual crop remains
available. Changes to the draft while detection/upload is running prevent stale
attachment. This opt-in detection does not change Movers' frame limits.

Part 1/3 examples use the existing display-only `examples[].options` contract:
complete question, A/B/C texts, optional example images and the printed correct
label. The correct choice is highlighted and examples never affect scoring.
Example option images use the normal owner/status/type checks and published
asset-usage tracking. Existing prompt/answer-only examples still display as
before; missing original choices cannot be recovered automatically. Re-import
with the updated prompt or enter those choices in the example editor.

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

Rollback: restore this change's source and rebuild. Stored optional layout
metadata/media remain in the JSON; no destructive migration or bulk rewrite is
needed. Prior published versions and completed attempts remain immutable.
