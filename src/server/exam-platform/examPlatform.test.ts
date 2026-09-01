import assert from 'node:assert/strict';
import test from 'node:test';
import { EXAM_PAPER_DEFINITIONS, createDefaultExamContent, getModuleExamPaperDefinitions } from '../../features/exam-platform/definitions';
import { promoteExamPartToBlocks } from '../../features/exam-platform/examStructure';
import { FLYER_NAME_REGION_HEIGHT, FLYER_NAME_REGION_WIDTH } from '../../features/exam-platform/flyerListeningMigration';
import { normalizeFixedKetReadingWritingContent } from '../../features/exam-platform/ketReadingWritingMigration';
import type { ExamPaperContent } from '../../features/exam-platform/types';
import { applyAiWritingGrade, applyManualExamGrades, gradeExamAttempt } from './examGrader';
import {
  normalizeExamSmartImportPart,
  sanitizeExamAnswers,
  sanitizeExamContentForStudent,
  validateExamPaperContent,
} from './examValidation';

function completeDraft(content: ExamPaperContent) {
  content.title = 'Verified test paper';
  content.parts.forEach(part => {
    if (content.paperId === 'listening') part.audioAssetId = `audio-${part.part}`;
    if (content.moduleId === 'starter' && content.paperId === 'listening' && part.part === 2) {
      part.passage = "What's the boy's name? — Sam.\nHow old is he? — 10.";
    }
    if (content.moduleId === 'starter' && content.paperId === 'reading-writing') {
      if (part.part <= 4) part.imageAssetId = `image-${part.part}`;
      if (part.part === 1) {
        part.examples?.forEach((example, index) => { example.imageAssetId = `image-part-1-example-${index + 1}`; });
        part.questions.forEach((question, index) => { question.imageAssetId = `image-part-1-question-${index + 1}`; });
      }
      if (part.part === 3) {
        part.examples?.forEach((example, index) => {
          example.imageAssetId = `image-part-3-example-left-${index + 1}`;
          example.secondaryImageAssetId = `image-part-3-example-right-${index + 1}`;
        });
        part.questions.forEach((question, index) => {
          question.imageAssetId = `image-part-3-question-left-${index + 1}`;
          question.secondaryImageAssetId = `image-part-3-question-right-${index + 1}`;
        });
      }
      if (part.part === 5) part.readingScenes?.forEach((scene, index) => { scene.imageAssetId = `image-scene-${index + 1}`; });
    }
    if (content.moduleId === 'flyer' && content.paperId === 'reading-writing') {
      if ([1, 2, 3, 4, 5, 6].includes(part.part)) part.imageAssetId = `image-flyer-rw-${part.part}`;
      if (part.part === 3 && part.readingScenes?.[0]) part.readingScenes[0].imageAssetId = 'image-flyer-rw-3-middle';
      if (part.part === 5) part.passage = 'A complete story used by the sentence-completion questions.';
    }
    if (content.moduleId === 'ket' && content.paperId === 'reading-writing' && content.parts.length === 9) {
      if ([1, 4, 5, 8].includes(part.part)) part.imageAssetId = `image-ket-rw-${part.part}`;
      if ([2, 5].includes(part.part)) part.examples = [{ prompt: 'Printed example question', answer: 'A' }];
      if ([6, 7, 8].includes(part.part)) part.passage = `Printed KET Part ${part.part} instructions, source text and example.`;
      if (part.part === 9) part.passage = 'Printed writing task and all required hints.';
      if (part.part === 1 && part.readingScenes?.[0]) part.readingScenes[0].imageAssetId = 'image-ket-rw-1-middle';
      if (part.part === 3 && part.blocks?.length === 2) {
        part.blocks[0].imageAssetId = 'image-ket-rw-3a';
        part.blocks[1].imageAssetId = 'image-ket-rw-3b-left';
        if (part.blocks[1].readingScenes?.[0]) part.blocks[1].readingScenes[0].imageAssetId = 'image-ket-rw-3b-middle';
      }
    }
    if (content.moduleId === 'ket' && content.paperId === 'listening' && content.templateVersion === 'ket-listening-5-v1') {
      if (part.part === 2) {
        part.imageAssetId = 'image-ket-listening-2-left';
        if (part.readingScenes?.[0]) part.readingScenes[0].imageAssetId = 'image-ket-listening-2-middle';
      }
      if (part.part === 1) {
        const sharedQuestion = part.questions.find(question => question.displayNumber === 3);
        if (sharedQuestion) {
          sharedQuestion.imageAssetId = 'image-ket-listening-1-question-3';
          sharedQuestion.imageUrl = '/media/image-ket-listening-1-question-3.png';
        }
      }
      if (part.part === 3) {
        part.passage = 'Listen to each conversation and choose the best answer.';
        part.examples = [{ prompt: 'How are you?', answer: 'C' }];
      }
      if ([4, 5].includes(part.part)) part.passage = `Printed KET Listening Part ${part.part} instructions and example.`;
    }
    if (part.interactionLayout?.kind === 'starter-image-matching-v1') {
      part.imageAssetId = `image-${part.part}`;
      part.interactionLayout.leftItems.forEach(item => { item.geometryConfirmedByTeacher = true; });
      part.interactionLayout.rightItems.forEach(item => { item.geometryConfirmedByTeacher = true; });
    }
    if (part.interactionLayout?.kind === 'starter-image-matching-v2') {
      part.imageAssetId = `image-${part.part}`;
      part.interactionLayout.sourceNodes.forEach(node => { node.geometryConfirmedByTeacher = true; });
      part.interactionLayout.targetNodes.forEach(node => { node.geometryConfirmedByTeacher = true; });
    }
    if (part.interaction?.variant === 'image-options') {
      part.imageAssetId = `display-image-${part.part}`;
      part.imageUrl = `/media/display-image-${part.part}.png`;
      part.questions.forEach(question => question.options.forEach(option => { option.imageAssetId = `image-${part.part}-${option.id}`; }));
    }
    if (part.interactionLayout?.kind === 'starter-scene-colour-v1') {
      part.imageAssetId = `image-${part.part}`;
      part.interactionLayout.targets.forEach(target => { target.geometryConfirmedByTeacher = true; });
    }
    if (part.interactionLayout?.kind === 'flyer-name-placement-v1') {
      part.imageAssetId = `image-${part.part}`;
      part.interactionLayout.targets.forEach(target => { target.geometryConfirmedByTeacher = true; });
    }
    if (content.moduleId === 'flyer' && content.paperId === 'listening' && part.part === 3) {
      part.imageAssetId = 'image-flyer-part3-options';
      if (part.readingScenes?.[0]) part.readingScenes[0].imageAssetId = 'image-flyer-part3-people';
    }
    if (content.moduleId === 'flyer' && content.paperId === 'listening' && part.part === 4) {
      part.readingScenes = [{
        id: 'flyer-part4-display',
        imageAssetId: 'image-flyer-part4-display',
        imageUrl: '/media/image-flyer-part4-display.png',
        passage: '',
        questionIds: part.questions.map(question => question.id),
      }];
    }
    part.questions.forEach((question, questionIndex) => {
      question.prompt = `Question ${question.number}`;
      if (question.type === 'long-writing') {
        question.rubric = 'Completion, organisation, vocabulary and grammar.';
      } else if (question.options.length) {
        const legacyMatching = part.interactionLayout?.kind === 'starter-image-matching-v1' ? part.interactionLayout : undefined;
        const nodeMatching = part.interactionLayout?.kind === 'starter-image-matching-v2' ? part.interactionLayout : undefined;
        const allowedMatching = legacyMatching?.rightItems.filter(item => item.id !== legacyMatching.exampleMapping?.rightItemId)
          || nodeMatching?.targetNodes.filter(node => node.id !== nodeMatching.exampleConnection?.targetNodeId);
        question.correctOptionIds = [allowedMatching?.[questionIndex]?.id || (part.interactionLayout?.kind === 'flyer-name-placement-v1' ? question.options[questionIndex]?.id : undefined) || question.options[0].id];
      } else {
        const ketLetterIds = new Set(part.part === 3 ? part.blocks?.[1]?.questionIds || [] : []);
        question.acceptedAnswers = (content.moduleId === 'flyer' && part.part === 3) || (content.moduleId === 'ket' && ((content.paperId === 'listening' && part.part === 2) || (content.paperId === 'reading-writing' && (part.part === 1 || ketLetterIds.has(question.id))))) ? ['A'] : ['answer'];
        if (content.moduleId === 'starter' && content.paperId === 'reading-writing' && part.part === 3) question.answerLength = 6;
        if (content.moduleId === 'ket' && part.part === 6) {
          question.answerPrefix = 'a';
          question.answerLength = 6;
          question.acceptedAnswers = ['nswer'];
        }
      }
    });
  });
  return content;
}

test('paper definitions activate the six requested modules and IELTS Academic only', () => {
  assert.equal(EXAM_PAPER_DEFINITIONS.length, 15);
  assert.deepEqual(getModuleExamPaperDefinitions('starter').map(item => item.paperId), ['listening', 'reading-writing']);
  assert.deepEqual(getModuleExamPaperDefinitions('pet').map(item => item.paperId), ['reading', 'writing', 'listening']);
  assert.deepEqual(getModuleExamPaperDefinitions('fce').map(item => item.paperId), ['reading-use-of-english', 'writing', 'listening']);
  assert.deepEqual(getModuleExamPaperDefinitions('ielts').map(item => item.paperId), ['listening', 'academic-reading', 'academic-writing']);
  assert.equal(EXAM_PAPER_DEFINITIONS.some(item => String(item.paperId).includes('general')), false);
  assert.equal(EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'ielts' && item.paperId === 'academic-reading')?.totalQuestionCount, 40);
});

test('every default paper validates after teacher supplies media and official answer keys', () => {
  for (const definition of EXAM_PAPER_DEFINITIONS) {
    const content = completeDraft(createDefaultExamContent(definition));
    assert.deepEqual(validateExamPaperContent(content), [], `${definition.moduleId}/${definition.paperId}`);
  }
});

test('Starters Listening Part 2 requires two separate unscored example lines', () => {
  const definition = EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'starter' && item.paperId === 'listening')!;
  const content = completeDraft(createDefaultExamContent(definition));
  content.parts[1].passage = "What's the boy's name? — Sam.";
  assert.ok(validateExamPaperContent(content).some(error => error.includes('phải nhập đủ đúng 2 example')));
  content.parts[1].passage = "What's the boy's name? — Sam.\nHow old is he? — 10.";
  assert.equal(validateExamPaperContent(content).some(error => error.includes('phải nhập đủ đúng 2 example')), false);
});

test('Flyers Listening upgrades released Part 2 name-placement drafts and keeps Movers-size Part 1 regions', () => {
  const definition = EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'flyer' && item.paperId === 'listening')!;
  const content = createDefaultExamContent(definition);
  const part1 = content.parts[0];
  const part2 = content.parts[1];
  const layout = part1.interactionLayout?.kind === 'flyer-name-placement-v1' ? part1.interactionLayout : undefined;
  assert.ok(layout);
  assert.ok(layout.targets.every(target => target.region.width === FLYER_NAME_REGION_WIDTH && target.region.height === FLYER_NAME_REGION_HEIGHT));

  content.parts[1] = {
    ...part2,
    interaction: part1.interaction,
    interactionLayout: part1.interactionLayout,
    examples: part1.examples,
    questions: part1.questions.map((question, index) => ({
      ...question,
      id: part2.questions[index].id,
      number: part2.questions[index].number,
      acceptedAnswers: ['answer'],
    })),
  };
  const errors = validateExamPaperContent(content);
  assert.equal(errors.some(error => error.includes('Flyers Listening Part 2: phải đặt và xác nhận đúng năm vùng thả tên')), false);
  assert.equal(errors.some(error => error.includes('Flyers Listening Part 2: cần đúng sáu thẻ tên dùng chung cho năm câu')), false);
  assert.equal(errors.some(error => /Part 2, câu \d+: dạng câu hỏi không phù hợp/.test(error)), false);
});

test('Flyers Listening Part 4 keeps the student display image and hides the crop source', () => {
  const definition = EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'flyer' && item.paperId === 'listening')!;
  const content = completeDraft(createDefaultExamContent(definition));
  const part4 = content.parts[3];
  const safe = sanitizeExamContentForStudent(content);
  assert.equal(safe.parts[3].imageAssetId, undefined);
  assert.equal(safe.parts[3].imageUrl, undefined);
  assert.equal(safe.parts[3].readingScenes?.[0]?.imageAssetId, 'image-flyer-part4-display');
  assert.equal(safe.parts[3].readingScenes?.[0]?.imageUrl, '/media/image-flyer-part4-display.png');
  part4.readingScenes = [];
  assert.ok(validateExamPaperContent(content).some(error => error.includes('Flyers Listening Part 4: phải tải ảnh hiển thị chung cho học sinh')));
});

test('publish validation blocks missing objective answer keys and invalid official structure', () => {
  const definition = EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'starter' && item.paperId === 'reading-writing')!;
  const content = createDefaultExamContent(definition);
  const errors = validateExamPaperContent(content);
  assert.ok(errors.some(error => error.includes('chưa xác nhận đáp án đúng')));
  content.parts[0].questions.pop();
  assert.ok(validateExamPaperContent(content).some(error => error.includes('phải có đúng 5 câu')));
});

test('Smart Import rejects technical IDs and maps official labels onto application-owned IDs', () => {
  const definition = EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'starter' && item.paperId === 'reading-writing')!;
  const content = createDefaultExamContent(definition);
  const partDefinition = definition.parts[0];
  const currentPart = content.parts[0];
  const injected = normalizeExamSmartImportPart(currentPart, {
    questions: [{ id: 'ai-id', prompt: 'Injected' }],
  }, partDefinition);
  assert.ok(injected.errors[0].includes('id'));

  const candidate = {
    title: 'Official Part 1',
    instruction: 'Choose True or False.',
    questions: currentPart.questions.map((_, index) => ({
      type: 'true-false',
      prompt: `Statement ${index + 1}`,
      options: [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }],
      correctOptionLabels: [index % 2 ? 'B' : 'A'],
    })),
  };
  const normalized = normalizeExamSmartImportPart(currentPart, candidate, partDefinition);
  assert.deepEqual(normalized.errors, []);
  assert.deepEqual(normalized.warnings, []);
  assert.equal(normalized.part.id, currentPart.id);
  assert.equal(normalized.part.questions[0].id, currentPart.questions[0].id);
  assert.equal(normalized.part.questions[0].correctOptionIds[0], currentPart.questions[0].options[0].id);
});

test('student content and submitted answers never expose or accept private grading fields', () => {
  const definition = EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'ket' && item.paperId === 'reading-writing')!;
  const content = completeDraft(createDefaultExamContent(definition));
  content.parts[0].audioTranscript = 'Teacher-only transcript';
  const safe = sanitizeExamContentForStudent(content);
  assert.equal(safe.parts[0].audioTranscript, undefined);
  for (const question of safe.parts.flatMap(part => part.questions)) {
    assert.equal('correctOptionIds' in question, false);
    assert.equal('acceptedAnswers' in question, false);
    assert.equal('modelAnswer' in question, false);
    assert.equal('writingGrading' in question, false);
  }
  const question = content.parts[0].questions[0];
  const submitted = question.correctOptionIds[0] || question.acceptedAnswers[0];
  assert.deepEqual(sanitizeExamAnswers({ [question.id]: submitted, injected: 'answer' }, content), {
    ...Object.fromEntries(content.parts.flatMap(part => part.questions).map(item => [item.id, ''])),
    [question.id]: submitted,
  });
});

test('KET Reading & Writing uses nine flexible Parts, two Part 3 groups and a ten-point AI Writing score', () => {
  const definition = EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'ket' && item.paperId === 'reading-writing')!;
  const content = completeDraft(createDefaultExamContent(definition));
  assert.equal(content.parts.length, 9);
  assert.deepEqual(content.parts.map(part => part.questions.length), [5, 5, 10, 7, 8, 5, 10, 5, 1]);
  assert.equal(content.parts[2].blocks?.length, 2);
  const legacySpelling = createDefaultExamContent(definition);
  legacySpelling.parts[5].questions[0].answerPrefix = 'p';
  legacySpelling.parts[5].questions[0].answerLength = 8;
  legacySpelling.parts[5].questions[0].acceptedAnswers = ['passport'];
  legacySpelling.parts[7].questions[0].answerSuffix = 'p.m.';
  const normalizedSpelling = normalizeFixedKetReadingWritingContent(legacySpelling);
  assert.deepEqual(normalizedSpelling.parts[5].questions[0].acceptedAnswers, ['assport']);
  assert.equal(normalizedSpelling.parts[7].questions[0].answerSuffix, undefined);
  content.parts[1].questions.pop();
  assert.equal(validateExamPaperContent(content).some(error => error.includes('Part 2') && error.includes('đúng 5')), false);
  const writing = content.parts[8].questions[0];
  assert.equal(writing.points, 10);
  writing.minWords = 20;
  writing.maxWords = 60;
  assert.equal(validateExamPaperContent(content).some(error => error.includes('giới hạn từ')), false);
  const answers = Object.fromEntries(content.parts.flatMap(part => part.questions.map(question => [question.id, question.type === 'long-writing' ? 'This is a complete short response for the writing task.' : question.correctOptionIds[0] || question.acceptedAnswers[0]])));
  const pending = gradeExamAttempt(content, answers);
  const finalized = applyAiWritingGrade(pending, writing.id, { score: 7, sentenceCount: 2, grammarErrors: ['example'], vocabularyErrors: [], feedback: 'Clear response with one grammar issue. The task is mostly complete. Vocabulary is suitable. Check verb forms.' });
  assert.equal(finalized.status, 'completed');
  assert.equal(finalized.questions.find(question => question.questionId === writing.id)?.writingScore, 7);
  assert.equal(finalized.score, Math.round((content.parts.slice(0, 8).reduce((sum, part) => sum + part.questions.length, 0) + 7) / (content.parts.slice(0, 8).reduce((sum, part) => sum + part.questions.length, 0) + 10) * 100));
});

test('Starter Part 3 keeps the display image but strips the teacher-only crop source', () => {
  const definition = EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'starter' && item.paperId === 'listening')!;
  const content = completeDraft(createDefaultExamContent(definition));
  const part3 = promoteExamPartToBlocks(content.parts[2]);
  part3.blocks![0].imageAssetId = 'part3-crop-source';
  part3.blocks![0].imageUrl = '/media/part3-crop-source.png';
  content.parts[2] = part3;
  const safe = sanitizeExamContentForStudent(content);
  assert.equal(safe.parts[2].imageAssetId, 'display-image-3');
  assert.equal(safe.parts[2].imageUrl, '/media/display-image-3.png');
  assert.equal(safe.parts[2].blocks![0].imageAssetId, undefined);
  assert.equal(safe.parts[2].blocks![0].imageUrl, undefined);
});

test('backend grading supports weighted objective items and teacher-reviewed Writing', () => {
  const definition = EXAM_PAPER_DEFINITIONS.find(item => item.moduleId === 'fce' && item.paperId === 'writing')!;
  const content = completeDraft(createDefaultExamContent(definition));
  content.parts[0].questions[0].points = 1;
  content.parts[1].questions[0].points = 2;
  const answers = Object.fromEntries(content.parts.flatMap(part => part.questions).map(question => [question.id, 'Student response']));
  const pending = gradeExamAttempt(content, answers);
  assert.equal(pending.status, 'pending_review');
  assert.equal(pending.pendingManualCount, 2);
  const finalized = applyManualExamGrades(pending, {
    [content.parts[0].questions[0].id]: 1,
    [content.parts[1].questions[0].id]: 1,
  });
  assert.equal(finalized.status, 'completed');
  assert.equal(finalized.score, 67);
});
