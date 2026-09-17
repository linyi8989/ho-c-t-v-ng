import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVocabImageGenerationPrompt,
  validateVocabImageCustomPrompt,
  VOCAB_IMAGE_CUSTOM_PROMPT_MAX_LENGTH,
} from "./generationPrompt";

test("generation prompt makes one clear full-frame 4:3 3D flashcard image without written answers", () => {
  const prompt = buildVocabImageGenerationPrompt({ term: "apple", meaning: "quả táo", partOfSpeech: "noun" });
  assert.match(prompt, /English vocabulary term: "apple"/);
  assert.match(prompt, /Vietnamese meaning for semantic clarification only: "quả táo"/);
  assert.match(prompt, /3D educational flashcard/i);
  assert.match(prompt, /4:3 landscape/i);
  assert.match(prompt, /full-frame edge-to-edge/i);
  assert.match(prompt, /no gap/i);
  assert.match(prompt, /one clear/i);
  assert.match(prompt, /no text/i);
  assert.match(prompt, /no letters/i);
  assert.doesNotMatch(prompt, /Wikimedia|Pixabay|Pexels/);
});

test("generation prompt adapts verbs and maps without changing the vocabulary term", () => {
  assert.match(buildVocabImageGenerationPrompt({ term: "run", meaning: "chạy", partOfSpeech: "verb" }), /person clearly performing the action/i);
  assert.match(buildVocabImageGenerationPrompt({ term: "bully", meaning: "bắt nạt", partOfSpeech: "v" }), /school-safe, nonviolent scene/i);
  assert.match(buildVocabImageGenerationPrompt({ term: "Australia", meaning: "nước Úc", partOfSpeech: "proper noun" }), /recognizable map outline/i);
});

test("bully verb prompt keeps the requested school-safe visual semantics and image-only constraints", () => {
  const prompt = buildVocabImageGenerationPrompt({ term: "bully", meaning: "bắt nạt", partOfSpeech: "động từ - v" });
  assert.match(prompt, /English vocabulary term: "bully"/);
  assert.match(prompt, /school-safe, nonviolent scene/i);
  assert.match(prompt, /intimidating posture or expression/i);
  assert.match(prompt, /age-appropriate and non-graphic/i);
  assert.match(prompt, /image only/i);
  assert.match(prompt, /no vocabulary word/i);
  assert.match(prompt, /no multiple visual layers/i);
});

test("custom prompts preserve teacher formatting but reject empty or oversized input", () => {
  assert.equal(validateVocabImageCustomPrompt("  First line\r\nSecond line  "), "First line\nSecond line");
  assert.throws(() => validateVocabImageCustomPrompt("   "), /không được để trống/);
  assert.throws(() => validateVocabImageCustomPrompt({ prompt: "not text" }), /phải là văn bản/);
  assert.throws(
    () => validateVocabImageCustomPrompt("x".repeat(VOCAB_IMAGE_CUSTOM_PROMPT_MAX_LENGTH + 1)),
    /không được vượt quá/
  );
});
