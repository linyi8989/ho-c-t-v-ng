import assert from 'node:assert/strict';
import test from 'node:test';
import { EXAM_PAPER_DEFINITIONS, createDefaultExamContent, getModuleExamPaperDefinitions } from '../../features/exam-platform/definitions';
import { promoteExamPartToBlocks } from '../../features/exam-platform/examStructure';
import type { ExamPaperContent } from '../../features/exam-platform/types';
import { applyManualExamGrades, gradeExamAttempt } from './examGrader';
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
    if (content.moduleId === 'starter' && content.paperId === 'reading-writing') {
      if (part.part <= 4) part.imageAssetId = `image-${part.part}`;
      if (part.part === 1 && part.examples?.[0]) part.examples[0].imageAssetId = 'image-example-1';
      if (part.part === 5) part.readingScenes?.forEach((scene, index) => { scene.imageAssetId = `image-scene-${index + 1}`; });
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
    part.questions.forEach((question, questionIndex) => {
      question.prompt = `Question ${question.number}`;
      if (question.type === 'long-writing') {
        question.rubric = 'Completion, organisation, vocabulary and grammar.';
      } else if (question.options.length) {
        const legacyMatching = part.interactionLayout?.kind === 'starter-image-matching-v1' ? part.interactionLayout : undefined;
        const nodeMatching = part.interactionLayout?.kind === 'starter-image-matching-v2' ? part.interactionLayout : undefined;
        const allowedMatching = legacyMatching?.rightItems.filter(item => item.id !== legacyMatching.exampleMapping?.rightItemId)
          || nodeMatching?.targetNodes.filter(node => node.id !== nodeMatching.exampleConnection?.targetNodeId);
        question.correctOptionIds = [allowedMatching?.[questionIndex]?.id || question.options[0].id];
      } else {
        question.acceptedAnswers = ['answer'];
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
  }
  const question = content.parts[0].questions[0];
  assert.deepEqual(sanitizeExamAnswers({ [question.id]: question.options[0].id, injected: 'answer' }, content), {
    ...Object.fromEntries(content.parts.flatMap(part => part.questions).map(item => [item.id, ''])),
    [question.id]: question.options[0].id,
  });
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
