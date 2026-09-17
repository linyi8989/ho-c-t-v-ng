import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
const imageSource = read("./VocabItemImage.tsx");
const flashcardSource = read("./FlashcardGame.tsx");
const quizSource = read("./QuizGame.tsx");
const fillSource = read("./FillBlankGame.tsx");
const millionaireSource = read("./MillionaireGame.tsx");
const matchingSource = read("./MatchingGame.tsx");
const memorySource = read("./MemoryGame.tsx");
const speakingSource = read("./SpeakingAIGame.tsx");
const gameListSource = readFileSync(new URL("../../lib/game-engine/gameList.ts", import.meta.url), "utf8");

test("student vocabulary images use one larger non-cropping frame without an inline source caption", () => {
  assert.match(imageSource, /h-36 w-48/);
  assert.match(imageSource, /md:h-48 md:w-64/);
  assert.match(imageSource, /object-contain/);
  assert.match(imageSource, /Ảnh minh họa cho câu hỏi từ vựng/);
  assert.doesNotMatch(imageSource, /Nguồn ảnh/);
  assert.doesNotMatch(imageSource, /figcaption/);
  assert.doesNotMatch(imageSource, /object-cover/);
});

test("image timing follows the approved game matrix", () => {
  assert.match(flashcardSource, /config\.imagePolicy === 'prompt'/);
  assert.match(flashcardSource, /config\.imagePolicy === 'answer'/);
  assert.match(quizSource, /config\.imagePolicy === 'prompt'/);
  assert.match(quizSource, /config\.imagePolicy === 'feedback' && isAnswered/);
  assert.match(fillSource, /config\.imagePolicy === 'prompt'/);
  assert.match(millionaireSource, /config\.imagePolicy !== 'none'/);

  assert.doesNotMatch(matchingSource, /VocabItemImage/);
  assert.doesNotMatch(memorySource, /VocabItemImage/);
  assert.doesNotMatch(speakingSource, /VocabItemImage/);
});

test("game registry declares image policy without making images a required field", () => {
  assert.match(gameListSource, /gameId: 'flashcard-sound'[\s\S]*?imagePolicy: 'answer'/);
  assert.match(gameListSource, /gameId: 'quiz-sound'[\s\S]*?imagePolicy: 'feedback'/);
  assert.match(gameListSource, /gameId: 'matching-word-meaning'[\s\S]*?imagePolicy: 'none'/);
  assert.match(gameListSource, /gameId: 'memory-match'[\s\S]*?imagePolicy: 'none'/);
  assert.match(gameListSource, /gameId: 'speaking-ai'[\s\S]*?imagePolicy: 'none'/);
  assert.doesNotMatch(gameListSource, /requiredFields:\s*\[[^\]]*imageUrl/);
});
