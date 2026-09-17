interface VocabImagePromptInput {
  term: string;
  meaning?: string;
  partOfSpeech?: string;
}

export const VOCAB_IMAGE_CUSTOM_PROMPT_MAX_LENGTH = 8_000;

function clean(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function subjectInstruction(term: string, partOfSpeech: string) {
  const normalizedPos = partOfSpeech.toLowerCase();
  const normalizedTerm = term.toLowerCase();
  const compactPos = normalizedPos.replace(/[.\s_-]+/g, "");
  if (normalizedPos.includes("verb") || normalizedPos.includes("động từ") || compactPos === "v") {
    if (normalizedTerm === "bully") {
      return "Depict the verb clearly in a school-safe, nonviolent scene: one student uses an intimidating posture or expression toward another student, with no injury, physical attack or humiliation.";
    }
    return `Show one person clearly performing the action “${term}”, with the action easy to recognize at a glance.`;
  }
  const countries = ["australia", "canada", "china", "england", "france", "germany", "india", "italy", "japan", "vietnam", "united kingdom", "united states"];
  if (countries.includes(normalizedTerm) || normalizedPos.includes("proper noun")) {
    return `Show a clean, recognizable map outline representing “${term}”; do not write the place name on the image.`;
  }
  if (normalizedPos.includes("adjective") || normalizedPos.includes("tính từ")) {
    return `Show one simple, unambiguous visual situation that communicates the quality “${term}”.`;
  }
  return `Show one clear main subject representing “${term}”, centered and fully visible.`;
}

export function buildVocabImageGenerationPrompt(input: VocabImagePromptInput) {
  const term = clean(input.term, 120);
  const meaning = clean(input.meaning, 160);
  const partOfSpeech = clean(input.partOfSpeech, 40) || "unspecified";
  if (!term) throw Object.assign(new Error("Từ tiếng Anh là bắt buộc để tạo ảnh."), { status: 400 });
  return [
    "Create one child-friendly 3D educational flashcard illustration for an English-vocabulary learning web app.",
    `English vocabulary term: "${term}".`,
    ...(meaning ? [`Vietnamese meaning for semantic clarification only: "${meaning}".`] : []),
    `Part of speech: "${partOfSpeech}".`,
    subjectInstruction(term, partOfSpeech),
    "Visual style: polished modern 3D animated illustration, expressive and immediately understandable for school students, age-appropriate and non-graphic.",
    "Composition: one coherent scene in a 4:3 landscape canvas, full-frame edge-to-edge artwork, one clear focal action or subject, large and sharp, high contrast. Fill the whole canvas naturally with no empty outer margin, no gap, no padding and no card mockup.",
    "Hard constraints: image only; no explanation, no pronunciation, no vocabulary word, no text, no letters, no numbers, no captions, no labels, no logos, no watermark, no border, no collage, no split screen, no stacked overlays, no multiple panels, no multiple visual layers, no irrelevant objects.",
  ].join("\n");
}

export function validateVocabImageCustomPrompt(value: unknown) {
  if (typeof value !== "string") {
    throw Object.assign(new Error("Prompt tùy chỉnh phải là văn bản."), { status: 400 });
  }
  const prompt = value.replace(/\r\n?/g, "\n").trim();
  if (!prompt) {
    throw Object.assign(new Error("Prompt tạo ảnh không được để trống."), { status: 400 });
  }
  if (prompt.length > VOCAB_IMAGE_CUSTOM_PROMPT_MAX_LENGTH) {
    throw Object.assign(
      new Error(`Prompt tạo ảnh không được vượt quá ${VOCAB_IMAGE_CUSTOM_PROMPT_MAX_LENGTH.toLocaleString("vi-VN")} ký tự.`),
      { status: 400 }
    );
  }
  return prompt;
}
