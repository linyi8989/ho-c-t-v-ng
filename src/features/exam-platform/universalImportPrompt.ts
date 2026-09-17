import type { ExamPaperContent } from './types';

const starterListeningPartNames: Record<number, string> = {
  1: 'matching / image-image / draw-line — giữ mô hình nối hình Starters hiện tại',
  2: 'text-entry / short-answer / single-input — cùng mô hình Movers Listening Part 2',
  3: 'choice / single / image-options — cùng mô hình Movers Listening Part 4',
  4: 'scene / colour-object + draw-object — cùng mô hình Movers Listening Part 5',
};

function starterListeningPrompt(content: ExamPaperContent, focusedPart?: number) {
  const selectedParts = focusedPart ? [focusedPart] : [1, 2, 3, 4];
  const partRules: Record<number, string> = {
    1: `PART 1 — NỐI HÌNH
- Trả đúng 5 câu chấm điểm, một example và các distractor nhìn thấy trên đề.
- Một block duy nhất: interaction {"family":"matching","subtype":"image-image","variant":"draw-line","schemaVersion":2}.
- content.sourceNodes/content.targetNodes chứa label; mỗi question có questionNumber, prompt, sourceLabel và answerKey.targetLabel.
- exampleConnection tách riêng. Ánh xạ đáp án phải một-một. Có thể trả geometryHints source-node/target-node dạng normalized nếu nhìn rõ.`,
    2: `PART 2 — LISTEN AND WRITE (tham chiếu Movers Listening Part 2)
- Tách example riêng trong content.passage và trả đúng 5 questions được chấm.
- Một block duy nhất: interaction {"family":"text-entry","subtype":"short-answer","variant":"single-input","schemaVersion":1}.
- Mỗi prompt chứa đúng một dấu ____ ở vị trí ô trống; answerKey.acceptedAnswers chứa tên/số và biến thể chính thức.
- Không tạo lựa chọn, ảnh riêng từng câu, crop hoặc geometry. Tranh minh họa do giáo viên tải/crop trong editor.`,
    3: `PART 3 — CHỌN ẢNH A/B/C (tham chiếu Movers Listening Part 4)
- Tách example riêng nếu có và trả đúng 5 questions theo questionNumber 1..5.
- Một block duy nhất: interaction {"family":"choice","subtype":"single","variant":"image-options","schemaVersion":1}.
- Mỗi câu có đúng ba options A/B/C; answerKey.correctOptionLabels chỉ nhận A, B hoặc C.
- Không trả crop hoặc asset ID. Code sẽ dò khung và crop 15 ảnh; nếu trang có 18 khung sẽ bỏ ba hình example.`,
    4: `PART 4 — COLOUR + DRAW (tham chiếu Movers Listening Part 5)
- Trả đúng 5 câu theo questionNumber 1..5; đọc từng yêu cầu trong official answer key, không mặc định tất cả đều là Colour.
- Mỗi hành động Colour dùng block scene/colour-object/paint; question có answerKey.colour thuộc red, blue, green, yellow, orange, purple, pink, brown, black, white.
- Mỗi hành động Draw/add dùng block scene/draw-object/draw; question có type "scene-draw", drawObject và targetDescription. Ví dụ “Draw a flower on the dog's head” phải là drawObject "flower", không đổi thành Colour.
- Nếu đề có cả Colour và Draw, tách thành các blocks theo loại hành động nhưng giữ đúng 5 câu chấm điểm; mỗi questionNumber 1..5 chỉ xuất hiện một lần.
- Không trả icon PNG. Giáo viên tải icon Draw. geometryHints colour-mask/draw-region chỉ là gợi ý normalized và luôn cần giáo viên xác nhận.`,
  };
  const templates: Record<number, unknown> = {
    1: { blockNumber: 1, title: 'Listen and draw lines', interaction: { family: 'matching', subtype: 'image-image', variant: 'draw-line', schemaVersion: 2 }, content: { sourceNodes: [{ label: 'source label' }], targetNodes: [{ label: 'target label' }], exampleConnection: { sourceLabel: 'example source', targetLabel: 'example target' }, questions: [{ questionNumber: 1, prompt: 'source label', sourceLabel: 'source label', answerSource: 'official-answer-key', answerKey: { targetLabel: 'target label' } }] } },
    2: { blockNumber: 1, title: 'Listen and write', interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'single-input', schemaVersion: 1 }, content: { passage: 'Example: Name — Ann', questions: [{ questionNumber: 1, prompt: 'Age: ____', type: 'short-answer', answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['8'] } }] } },
    3: { blockNumber: 1, title: 'Listen and tick the box', interaction: { family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1 }, content: { questions: [{ questionNumber: 1, prompt: 'Which picture is correct?', options: [{ label: 'A', text: 'picture A' }, { label: 'B', text: 'picture B' }, { label: 'C', text: 'picture C' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: ['B'] } }] } },
    4: { blocks: [{ blockNumber: 1, title: 'Colour', interaction: { family: 'scene', subtype: 'colour-object', variant: 'paint', schemaVersion: 1 }, content: { questions: [{ questionNumber: 1, prompt: 'Colour the flower red.', answerSource: 'official-answer-key', answerKey: { colour: 'red' } }] }, geometryHints: { coordinateSpace: 'normalized', regions: [{ role: 'colour-mask', ref: 'Câu 1', questionNumber: 1, shape: 'polygon', x: 0.1, y: 0.1, width: 0.1, height: 0.1, confidence: 0.8 }] } }, { blockNumber: 2, title: 'Draw', interaction: { family: 'scene', subtype: 'draw-object', variant: 'draw', schemaVersion: 2 }, content: { questions: [{ questionNumber: 5, prompt: "Draw a flower on the dog's head.", type: 'scene-draw', drawObject: 'flower', targetDescription: "on the dog's head", answerSource: 'official-answer-key', answerKey: {} }] }, geometryHints: { coordinateSpace: 'normalized', regions: [{ role: 'draw-region', ref: 'Câu 5', questionNumber: 5, shape: 'rect', x: 0.6, y: 0.2, width: 0.15, height: 0.15, confidence: 0.8 }] } }] },
  };
  const partsTemplate = selectedParts.map(partNumber => ({
    partNumber,
    title: `Part ${partNumber}`,
    instruction: `Instruction Part ${partNumber}`,
    ...(partNumber === 4 ? templates[4] as object : { blocks: [templates[partNumber]] }),
  }));
  return `Bạn là chuyên gia số hóa Cambridge Pre A1 Starters Listening từ ảnh/PDF đề bài và official answer key.

MỤC TIÊU
${focusedPart ? `- CHỈ phân tích Part ${focusedPart}: ${starterListeningPartNames[focusedPart]}.` : '- Phân tích đúng MỘT bài Starters Listening gồm CỐ ĐỊNH 4 Part và 20 câu chấm điểm.'}
- Mô hình giao diện đã cố định theo Cambridge/Movers; JSON chỉ điền nội dung và đáp án, không tự đổi dạng bài.
- Không dùng audio hoặc transcript để đoán đáp án.

ÁNH XẠ CỐ ĐỊNH
${selectedParts.map(part => `- Part ${part}: ${starterListeningPartNames[part]}.`).join('\n')}

${selectedParts.map(part => partRules[part]).join('\n\n')}

QUY TẮC CHUNG
- Chỉ trả một JSON object hợp lệ; không Markdown, code fence hoặc lời giải thích.
- format "exam-bundle-import-v2", formatVersion 2, exam.moduleId "starter", paperId "listening".
- ${focusedPart ? `papers[0].parts chỉ có Part ${focusedPart}.` : 'papers[0].parts phải có đúng Part 1, 2, 3, 4 theo thứ tự; mỗi Part tổng cộng đúng 5 câu được chấm.'}
- Không sinh id, questionId, questionIds, optionId, assetId, URL, base64 hoặc đường dẫn file.
- answerSource chỉ là "official-answer-key" khi nhìn thấy trực tiếp trong key; nếu chưa chắc dùng "unverified" và để answerKey rỗng.
- Tọa độ/crop/mask chỉ được đặt trong geometryHints với status gợi ý; không khai báo đã được giáo viên xác nhận.

JSON MẪU ĐÚNG CẤU TRÚC (thay toàn bộ dữ liệu minh họa bằng dữ liệu thật):
${JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'starter', title: content.title, description: content.description, level: 'Pre A1 Starters' }, papers: [{ paperId: 'listening', title: 'Listening', timeLimitMinutes: content.timeLimitMinutes || 20, parts: partsTemplate }] }, null, 2)}

Tự kiểm tra lần cuối: ${focusedPart ? `đúng Part ${focusedPart}, đúng 5 câu chấm điểm và đúng mô hình đã khóa` : 'đủ đúng 4 Part, mỗi Part đúng 5 câu, tổng 20 câu'}, đáp án chỉ lấy từ official answer key. Sau đó chỉ in JSON.`;
}

function starterReadingWritingPrompt(content: ExamPaperContent, focusedPart?: number) {
  const selectedParts = focusedPart ? [focusedPart] : [1, 2, 3, 4, 5];
  const partTemplates: Record<number, unknown> = {
    1: {
      partNumber: 1,
      title: 'Look and read',
      instruction: 'Look and read. Choose yes or no.',
      blocks: [{
        blockNumber: 1,
        title: 'Look, read and choose Yes or No',
        interaction: { family: 'choice', subtype: 'single', variant: 'yes-no', schemaVersion: 1 },
        content: {
          examples: [{ prompt: 'Example sentence 1', answer: 'Yes' }, { prompt: 'Example sentence 2', answer: 'No' }],
          questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Sentence ${index + 1}`, type: 'true-false', options: [{ label: 'YES', text: 'Yes' }, { label: 'NO', text: 'No' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: [index % 2 ? 'NO' : 'YES'] } })),
        },
      }],
    },
    2: {
      partNumber: 2,
      title: 'Look and read. Write yes or no',
      instruction: 'Look at the picture and choose yes or no.',
      blocks: [{
        blockNumber: 1,
        title: 'Picture statements',
        interaction: { family: 'choice', subtype: 'single', variant: 'yes-no', schemaVersion: 1 },
        content: {
          examples: [{ prompt: 'Example statement 1', answer: 'Yes' }, { prompt: 'Example statement 2', answer: 'No' }],
          questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Statement ${index + 1}`, type: 'true-false', options: [{ label: 'YES', text: 'Yes' }, { label: 'NO', text: 'No' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: [index % 2 ? 'YES' : 'NO'] } })),
        },
      }],
    },
    3: {
      partNumber: 3,
      title: 'Look at the pictures. Look at the letters. Write the words.',
      instruction: 'Write one word for each picture.',
      blocks: [{
        blockNumber: 1,
        title: 'Spell the words',
        interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'image-spelling', schemaVersion: 1 },
        content: { examples: [{ prompt: 'Printed example', answer: 'ear' }], questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Picture ${index + 1}: ____`, type: 'short-answer', maxWords: 1, answerLength: 4, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: [`word-${index + 1}`] } })) },
      }],
    },
    4: {
      partNumber: 4,
      title: 'Read this. Choose a word and write it in each gap.',
      instruction: 'Write one word in each gap.',
      blocks: [{
        blockNumber: 1,
        title: 'Complete the story',
        interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'story-gaps', schemaVersion: 1 },
        content: {
          examples: [{ prompt: 'Printed example', answer: 'example answer' }],
          passage: 'Story text with gap (1) [[1]], then (2) [[2]], (3) [[3]], (4) [[4]] and (5) [[5]].',
          questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Gap ${index + 1}`, type: 'short-answer', maxWords: 1, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: [`word-${index + 1}`] } })),
        },
      }],
    },
    5: {
      partNumber: 5,
      title: 'Look at the pictures and read the questions.',
      instruction: 'Write one, two or three words.',
      blocks: [{
        blockNumber: 1,
        title: 'Picture story',
        interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'scene-story', schemaVersion: 1 },
        content: {
          examples: [{ prompt: 'Printed example 1', answer: 'example answer 1' }, { prompt: 'Printed example 2', answer: 'example answer 2' }],
          scenes: [
            { sceneNumber: 1, passage: 'Story for picture 1', questions: [{ questionNumber: 1, prompt: 'Question 1: ____', type: 'short-answer', maxWords: 3, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['answer'] } }] },
            { sceneNumber: 2, passage: 'Story for picture 2', questions: [{ questionNumber: 2, prompt: 'Question 2: ____', type: 'short-answer', maxWords: 3, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['answer'] } }, { questionNumber: 3, prompt: 'Question 3: ____', type: 'short-answer', maxWords: 3, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['answer'] } }] },
            { sceneNumber: 3, passage: 'Story for picture 3', questions: [{ questionNumber: 4, prompt: 'Question 4: ____', type: 'short-answer', maxWords: 3, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['answer'] } }, { questionNumber: 5, prompt: 'Question 5: ____', type: 'short-answer', maxWords: 3, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['answer'] } }] },
          ],
        },
      }],
    },
  };
  const parts = selectedParts.map(partNumber => partTemplates[partNumber]);
  return `Bạn là chuyên gia số hóa Cambridge Pre A1 Starters Reading & Writing từ ảnh/PDF đề bài và official answer key.

MỤC TIÊU
${focusedPart ? `- CHỈ phân tích Part ${focusedPart}; papers[0].parts chỉ chứa đúng Part ${focusedPart}.` : '- Phân tích đúng một bài gồm CỐ ĐỊNH 5 Part, mỗi Part đúng 5 câu chấm điểm, tổng 25 câu.'}
- Giữ đúng mô hình giao diện đã khóa: Part 1 có 2 example và 5 câu Yes/No theo 7 hàng ảnh; Part 2 giống Movers Reading & Writing Part 2; Part 3 có 1 hàng example và 5 hàng câu hỏi, mỗi hàng gồm ảnh trái, ô nhập giữa và ảnh chữ gợi ý bên phải; Part 4 giống Movers Part 4 nhưng có đúng năm gap; Part 5 giống Movers Part 5 với ba cảnh, hai example ở cảnh 1 và phân bố 5 câu chấm điểm là 1 + 2 + 2.
- JSON chỉ chứa nội dung, đáp án và answerLength. Giáo viên tải một ảnh trang nguồn; ứng dụng dùng pixel để tự dò và crop 7 hình Part 1 hoặc crop 12 hình Part 3, đồng thời cho giáo viên kiểm tra/chỉnh vùng trước khi lưu. Ảnh word bank và ba ảnh cảnh còn lại được tải trong editor.

QUY TẮC TỪNG PART
- Part 1: một block choice/single/yes-no; content.examples có đúng 2 example không chấm; 5 câu có đúng hai options YES/NO. Hai example và năm câu phải giữ đúng thứ tự từ trên xuống của đề gốc.
- Part 2: một block choice/single/yes-no; content.examples chứa các example in trên đề; 5 nhận định có đúng hai options YES/NO.
- Part 3: một block text-entry/short-answer/image-spelling; content.examples có đúng 1 example; đúng 5 câu, mỗi câu một từ. Mỗi câu phải có answerLength bằng số chữ cái thực tế để player dựng đúng số gạch chân. Đọc đáp án từ official key, không tự giải chữ xáo trộn nếu key không rõ.
- Part 4: một block text-entry/short-answer/story-gaps; content.passage phải giữ đủ và đúng một lần các marker [[1]], [[2]], [[3]], [[4]], [[5]] tại vị trí ô trống; đúng 5 answer keys một từ.
- Part 5: một block text-entry/short-answer/scene-story; content.examples có đúng 2 example không chấm điểm và đều thuộc cảnh 1; content.scenes có đúng ba cảnh theo thứ tự, lần lượt 1, 2 và 2 câu chấm điểm; prompt đặt ____ tại vị trí ô nhập; mỗi đáp án tối đa ba từ.

QUY TẮC ĐÁP ÁN VÀ AN TOÀN
- answerSource chỉ là "official-answer-key" khi thấy trực tiếp trong đáp án chính thức. Nếu không chắc, dùng "unverified" và để answerKey rỗng; tuyệt đối không đoán.
- Không sinh id, questionId, questionIds, sceneId, optionId, assetId, URL, base64, đường dẫn file, crop hay tọa độ.
- Không dùng audio/transcript để suy luận. Chỉ trả một JSON object hợp lệ, không Markdown/code fence và không giải thích ngoài JSON.
- format phải là "exam-bundle-import-v2", formatVersion 2, exam.moduleId "starter", paperId "reading-writing".

JSON MẪU ĐÚNG CẤU TRÚC (thay dữ liệu minh họa bằng dữ liệu thật và mở rộng đủ 5 câu trong mỗi Part):
${JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'starter', title: content.title, description: content.description, level: 'Pre A1 Starters' }, papers: [{ paperId: 'reading-writing', title: 'Reading & Writing', timeLimitMinutes: content.timeLimitMinutes || 20, parts }] }, null, 2)}

Tự kiểm tra lần cuối: ${focusedPart ? `chỉ có Part ${focusedPart} và đúng 5 câu chấm điểm` : 'đủ Part 1-5, mỗi Part đúng 5 câu, tổng 25 câu'}, đúng interaction đã khóa, Part 5 đúng 2 example ở cảnh 1 và đúng 3 cảnh theo phân bổ 1+2+2 câu chấm điểm, đáp án chỉ từ official key. Sau đó chỉ in JSON.`;
}

function flyerReadingWritingPrompt(content: ExamPaperContent, focusedPart?: number) {
  const selected = focusedPart ? [focusedPart] : [1, 2, 3, 4, 5, 6, 7];
  const officialAnswer = (acceptedAnswers: string[]) => ({ answerSource: 'official-answer-key', answerKey: { acceptedAnswers } });
  const definitionPart = (partNumber: number, count: number) => ({
    partNumber,
    title: `Part ${partNumber}`,
    instruction: 'Read the definitions and write the correct word.',
    blocks: [{
      blockNumber: 1,
      title: 'Write the word',
      interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'inline-definitions', schemaVersion: 1 },
      content: {
        examples: [{ prompt: 'Printed example ____', answer: 'example' }],
        questions: Array.from({ length: count }, (_, index) => ({ questionNumber: index + 1, prompt: `Definition ${index + 1}: ____`, type: 'short-answer', maxWords: 3, ...officialAnswer([`answer ${index + 1}`]) })),
      },
    }],
  });
  const templates: Record<number, unknown> = {
    1: definitionPart(1, 10),
    2: {
      partNumber: 2,
      title: 'Look and read. Write yes or no',
      instruction: 'Look at the picture and choose yes or no.',
      blocks: [{ blockNumber: 1, title: 'Picture statements', interaction: { family: 'choice', subtype: 'single', variant: 'yes-no', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example 1', answer: 'Yes' }, { prompt: 'Printed example 2', answer: 'No' }], questions: Array.from({ length: 7 }, (_, index) => ({ questionNumber: index + 1, prompt: `Statement ${index + 1}`, type: 'true-false', options: [{ label: 'YES', text: 'Yes' }, { label: 'NO', text: 'No' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: [index % 2 ? 'NO' : 'YES'] } })) } }],
    },
    3: {
      partNumber: 3,
      title: 'Look, match and write a letter',
      instruction: 'Write a letter A-H in each box.',
      blocks: [{ blockNumber: 1, title: 'Two-image letter matching', interaction: { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example', answer: 'F' }], questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Conversation gap ${index + 1}`, type: 'short-answer', maxWords: 1, ...officialAnswer([String.fromCharCode(65 + index)]) })) } }],
    },
    4: {
      partNumber: 4,
      title: 'Complete the text and choose a title',
      instruction: 'Write one word in each gap, then choose the best title.',
      blocks: [{ blockNumber: 1, title: 'Story gaps and title', interaction: { family: 'text-entry', subtype: 'short-answer-and-title', variant: 'story-gaps-title', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example', answer: 'island' }], passage: Array.from({ length: 5 }, (_, index) => `Text around gap ${index + 1} [[${index + 1}]].`).join(' '), questions: [...Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Gap ${index + 1}`, type: 'short-answer', maxWords: 1, ...officialAnswer([`word ${index + 1}`]) })), { questionNumber: 6, prompt: 'Choose the best name for this story.', type: 'single-choice', options: [{ label: 'A', text: 'Title A' }, { label: 'B', text: 'Title B' }, { label: 'C', text: 'Title C' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: ['A'] } }] } }],
    },
    5: {
      partNumber: 5,
      title: 'Read the story and complete the sentences',
      instruction: 'Write some words to complete the sentences about the story.',
      blocks: [{ blockNumber: 1, title: 'Story sentence completion', interaction: { family: 'text-entry', subtype: 'story-sentence-completion', variant: 'story-sentence-completion', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example 1 ____', answer: 'example answer' }, { prompt: 'Printed example 2 ____', answer: 'example answer' }], questions: Array.from({ length: 7 }, (_, index) => ({ questionNumber: index + 1, prompt: `Sentence ${index + 1}: ____`, type: 'short-answer', maxWords: 4, ...officialAnswer([`answer ${index + 1}`]) })) } }],
    },
    6: {
      partNumber: 6,
      title: 'Choose the right words for the text',
      instruction: 'Choose A, B or C for each gap.',
      blocks: [{ blockNumber: 1, title: 'Multiple-choice cloze', interaction: { family: 'choice', subtype: 'cloze', variant: 'multiple-choice-cloze', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example in the student image', answer: 'example' }], questions: Array.from({ length: 10 }, (_, index) => ({ questionNumber: index + 1, prompt: `Question ${index + 1}`, type: 'single-choice', options: [{ label: 'A', text: 'Option A' }, { label: 'B', text: 'Option B' }, { label: 'C', text: 'Option C' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: ['A'] } })) } }],
    },
    7: {
      partNumber: 7,
      title: 'Write one word in each gap',
      instruction: 'Read the story and write one missing word on each line.',
      blocks: [{ blockNumber: 1, title: 'Open cloze', interaction: { family: 'text-entry', subtype: 'open-cloze', variant: 'open-cloze', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example ____', answer: 'his' }], passage: Array.from({ length: 5 }, (_, index) => `Text [[${index + 1}]].`).join(' '), questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Gap ${index + 1}`, type: 'short-answer', maxWords: 1, ...officialAnswer([`word ${index + 1}`]) })) } }],
    },
  };
  return `Bạn là chuyên gia số hóa Cambridge A2 Flyers Reading & Writing từ ảnh/PDF đề bài và official answer key.

MỤC TIÊU CỐ ĐỊNH
- ${focusedPart ? `CHỈ trả Part ${focusedPart}; papers[0].parts chỉ có đúng Part ${focusedPart}.` : 'Trả đúng 7 Part theo thứ tự. Chỉ số Part và dạng bài được cố định; số câu KHÔNG được cố định.'}
- Tự đọc số câu in trên tiêu đề của từng Part và trả đúng từng câu chấm điểm nhìn thấy trong đề. Example không tính là câu chấm điểm. Không tự thêm/bớt câu để khớp JSON mẫu.
- Các ảnh mẫu thường có phân bổ 10–7–5–6–7–10–5, nhưng đây chỉ là ví dụ nhận diện, tuyệt đối không phải ràng buộc schema. Nếu đề gốc khác, giữ đúng đề gốc.
- Part 1 giống Movers Reading & Writing Part 1: ảnh ngân hàng từ bên trái, example không chấm điểm, câu định nghĩa và ô điền bên phải.
- Part 2 giống Movers Reading & Writing Part 2: ảnh tình huống bên trái, example và các câu Yes/No bên phải.
- Part 3 là hội thoại có các ô điền chữ A-H: đúng 1 example không chấm điểm, các câu hội thoại chấm điểm, và danh sách A-H có đáp án nhiễu không dùng. Hai trang/ảnh được giáo viên tải riêng.
- Part 4 là bài đọc có word box: các ô điền từ là câu chấm điểm, sau đó thêm đúng 1 câu tick chọn tiêu đề A/B/C. Số marker bằng số ô điền, không tính câu tiêu đề.
- Part 5 dùng một ảnh đầy đủ chứa cả truyện và câu hỏi ở bên trái; JSON chỉ trả đúng 2 examples không chấm điểm và các câu hoàn thành ở bên phải, không chép/generate lại toàn bộ truyện; mỗi đáp án có thể từ 1 đến 4 từ.
- Part 6 dùng đúng cấu trúc Movers Reading & Writing Part 6 dạng ảnh: một ảnh đầy đủ chứa passage, example và số câu ở bên trái; bên phải là các hàng đáp án, mỗi hàng gồm số câu và đúng ba lựa chọn từ/cụm từ A/B/C. Không chép/generate lại passage.
- Part 7 là open cloze: đúng 1 example không chấm điểm; mỗi ô chỉ điền đúng một từ. Ảnh hiển thị có thể có hoặc không.

QUY TẮC DỮ LIỆU
- Mỗi Part có đúng một block và đúng interaction trong JSON mẫu. Không chia thêm block.
- Part 1: prompt phải giữ ____ tại vị trí ô điền; mỗi câu là short-answer.
- Part 2: mỗi câu đúng hai options YES/NO và đúng một correctOptionLabels.
- Part 3: acceptedAnswers của mỗi câu chỉ là đúng một chữ A-H; giữ nguyên các câu hội thoại, không biến các đáp án nhiễu thành câu hỏi; không sinh tọa độ/crop.
- Part 4: nếu có N ô điền, content.passage chứa đúng một lần từng marker [[1]] đến [[N]]; N questions đầu là short-answer, question cuối có đúng ba options A/B/C để chọn tiêu đề.
- Part 5: không trả content.passage; đúng 2 examples; questions là các câu hoàn thành câu và đều là short-answer, maxWords 4. Ảnh hiển thị do giáo viên tải riêng.
- Part 6: không trả content.passage hay marker; mỗi question chỉ cần questionNumber, prompt ngắn để quản trị, đúng ba options chữ A/B/C và đúng một đáp án chính thức. Ảnh hiển thị do giáo viên tải riêng.
- Part 7: content.passage có đúng một marker cho mỗi câu; mỗi question là short-answer, maxWords 1.
- Ảnh do giáo viên tải/dán trong editor, không đặt dữ liệu ảnh vào JSON. Part 7 cho phép không có ảnh. Không trả asset ID, URL, base64 hoặc đường dẫn file.
- answerSource chỉ là "official-answer-key" khi nhìn thấy trực tiếp trong key. Nếu chưa chắc, dùng "unverified" và để answerKey rỗng; không đoán.
- Không sinh id, questionId, questionIds, optionId, sceneId, crop, mask hoặc tọa độ.
- Chỉ trả một JSON object hợp lệ; không Markdown, code fence hoặc giải thích ngoài JSON.
- format "exam-bundle-import-v2", formatVersion 2, exam.moduleId "flyer", paperId "reading-writing".

JSON MẪU ĐÚNG CẤU TRÚC (thay toàn bộ dữ liệu minh họa bằng dữ liệu thật):
${JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'flyer', title: content.title, description: content.description, level: 'A2 Flyers' }, papers: [{ paperId: 'reading-writing', title: 'Reading & Writing', timeLimitMinutes: content.timeLimitMinutes || 40, parts: selected.map(part => templates[part]) }] }, null, 2)}

Tự kiểm tra lần cuối: ${focusedPart ? `chỉ Part ${focusedPart}, số questions bằng đúng số câu chấm điểm in trên đề và đúng interaction đã khóa` : 'đủ 7 Part; từng Part có đúng số câu in trên đề, không tính example và không ép theo số câu của JSON mẫu'}, đáp án chỉ từ official key. Sau đó chỉ in JSON.`;
}

function flyerListeningPrompt(content: ExamPaperContent, focusedPart?: number) {
  const selected = focusedPart ? [focusedPart] : [1, 2, 3, 4, 5];
  const templates: Record<number, unknown> = {
    1: { partNumber: 1, title: 'Listen and put the names', instruction: 'Listen and put the names in the correct places.', blocks: [{ blockNumber: 1, title: 'Name the people', interaction: { family: 'matching', subtype: 'name-scene', variant: 'drag-name-to-region', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example', answer: 'Example name' }], questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Person ${index + 1}`, options: ['Alex', 'Ben', 'Katy', 'Mary', 'Robert', 'Sally'].map((name, optionIndex) => ({ label: String.fromCharCode(65 + optionIndex), text: name })), answerSource: 'official-answer-key', answerKey: { correctOptionLabels: [String.fromCharCode(65 + index)] } })) }, geometryHints: { coordinateSpace: 'normalized', regions: Array.from({ length: 5 }, (_, index) => ({ role: 'target-node', ref: `Vùng ${index + 1}`, questionNumber: index + 1, shape: 'rect', x: .08 + (index % 2) * .62, y: .12 + Math.floor(index / 2) * .27, width: .12, height: .055, confidence: .8 })) } }] },
    2: { partNumber: 2, title: 'Listen and write', instruction: 'Listen and write a word or a number.', blocks: [{ blockNumber: 1, title: 'Listen and write', interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'single-input', schemaVersion: 1 }, content: { passage: 'Example: Name — Ann', questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Question ${index + 1}: ____`, type: 'short-answer', answerSource: 'official-answer-key', answerKey: { acceptedAnswers: [`answer ${index + 1}`] } })) } }] },
    3: { partNumber: 3, title: 'Listen and write a letter', instruction: 'Which food does each person like? Write a letter in each box.', blocks: [{ blockNumber: 1, title: 'Match people to pictures A-H', interaction: { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1 }, content: { examples: [{ prompt: 'Bill', answer: 'D' }], questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Person ${index + 1}`, type: 'short-answer', maxWords: 1, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: [String.fromCharCode(65 + index)] } })) } }] },
    4: { partNumber: 4, title: 'Listen and tick the box', instruction: 'Listen and tick the correct picture.', blocks: [{ blockNumber: 1, title: 'Choose A, B or C', interaction: { family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example', answer: 'B' }], questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Question ${index + 1}`, options: [{ label: 'A', text: 'picture A' }, { label: 'B', text: 'picture B' }, { label: 'C', text: 'picture C' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: ['B'] } })) } }] },
    5: { partNumber: 5, title: 'Listen, colour and draw', instruction: 'Listen, colour and draw. There is one example.', blocks: [{ blockNumber: 1, title: 'Colour', interaction: { family: 'scene', subtype: 'colour-object', variant: 'paint', schemaVersion: 1 }, content: { questions: Array.from({ length: 4 }, (_, index) => ({ questionNumber: index + 1, prompt: `Colour instruction ${index + 1}`, answerSource: 'official-answer-key', answerKey: { colour: ['red', 'blue', 'green', 'yellow'][index] } })) } }, { blockNumber: 2, title: 'Draw', interaction: { family: 'scene', subtype: 'draw-object', variant: 'draw', schemaVersion: 2 }, content: { questions: [{ questionNumber: 5, prompt: 'Draw an object in the correct place.', type: 'scene-draw', drawObject: 'object', targetDescription: 'target place', answerSource: 'official-answer-key', answerKey: {} }] } }] },
  };
  return `Bạn là chuyên gia số hóa Cambridge A2 Flyers Listening từ ảnh/PDF đề và official answer key.

MỤC TIÊU CỐ ĐỊNH
- ${focusedPart ? `Chỉ trả Part ${focusedPart}; papers[0].parts chỉ có đúng Part ${focusedPart}.` : 'Trả đúng 5 Part theo thứ tự, mỗi Part đúng 5 câu chấm điểm, tổng 25 câu.'}
- Part 1 dùng đúng giao diện Movers Listening Part 1: sáu thẻ tên, năm vùng đặt tên trên một ảnh scene, một example không chấm điểm. JSON phải nhận diện vị trí tương đối của đúng năm nhân vật được hỏi.
- Part 2 dùng đúng giao diện Movers Listening Part 2: một ảnh minh họa chung, phần example và năm câu điền một từ hoặc một số.
- Part 3 dùng hai ảnh giáo viên tải riêng: ảnh lựa chọn A-H bên trái và ảnh người/tên ở giữa; năm ô nhập chữ cái nằm ở cột phải. JSON chỉ trả example, tên năm hàng và đáp án chữ A-H.
- Part 4 giống Movers Listening Part 4: năm câu, mỗi câu đúng ba ảnh A/B/C.
- Part 5 giống Movers Listening Part 5: Colour và Draw dùng chung scene; phải phân biệt từng hành động và tách block theo loại.

QUY TẮC
- Chỉ lấy đáp án từ official answer key. Nếu chưa chắc, dùng answerSource "unverified" và để answerKey rỗng; không đoán từ audio/transcript.
- Part 1: mỗi question phải lặp đủ cùng sáu options tên; correctOptionLabels chọn đúng tên/nhãn chính thức. geometryHints phải có đúng năm target-node đánh số Vùng 1..5, ánh xạ lần lượt questionNumber 1..5. Mỗi vùng dùng tọa độ normalized x/y trong 0..1, shape "rect" và kích thước đúng Movers Listening Part 1: width 0.12, height 0.055; đặt tâm vùng trên thân nhân vật tương ứng, không bao cả nhóm người. Giáo viên sẽ nhìn lại và có thể kéo vùng sang vị trí khác; không tạo bước xác nhận riêng.
- Part 2: một block text-entry/short-answer/single-input; mỗi prompt có đúng một dấu ____ tại vị trí ô điền; acceptedAnswers chỉ chứa đáp án từ official key và các biến thể được key chấp nhận. Không tạo options, ảnh/crop/toạ độ cho từng câu.
- Part 3: đúng một example không chấm và đúng năm short-answer; acceptedAnswers chỉ là một chữ A-H. Không sinh crop/toạ độ.
- Part 4: đúng ba options A/B/C cho mỗi câu; ứng dụng tự crop ảnh sau khi giáo viên tải trang nguồn.
- Part 5: colour dùng catalog red, blue, green, yellow, orange, purple, pink, brown, black, white; draw/add phải trả scene-draw, drawObject và targetDescription, không đổi thành colour.
- Không sinh id, questionId, questionIds, assetId, URL, base64, đường dẫn file hoặc trường kỹ thuật. Chỉ trả JSON, không Markdown hay giải thích.
- format "exam-bundle-import-v2", formatVersion 2, exam.moduleId "flyer", paperId "listening".

JSON MẪU (thay dữ liệu minh họa bằng dữ liệu thật):
${JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'flyer', title: content.title, description: content.description, level: 'A2 Flyers' }, papers: [{ paperId: 'listening', title: 'Listening', timeLimitMinutes: content.timeLimitMinutes || 25, parts: selected.map(part => templates[part]) }] }, null, 2)}

Tự kiểm tra lần cuối: ${focusedPart ? `chỉ Part ${focusedPart}, đúng 5 câu chấm điểm và đúng interaction đã khóa` : 'đủ 5 Part, 25 câu; Part 1 là name-scene, Part 2 là short-answer, Part 3 hai ảnh + chữ A-H, Part 4 ảnh A/B/C, Part 5 Colour/Draw'}, rồi chỉ in JSON.`;
}

function ketListeningPrompt(content: ExamPaperContent, focusedPart?: number) {
  const selected = focusedPart ? [focusedPart] : [1, 2, 3, 4, 5];
  const accepted = (answers: string[]) => ({ answerSource: 'official-answer-key', answerKey: { acceptedAnswers: answers } });
  const choices = (count: number, startNumber = 1) => Array.from({ length: count }, (_, index) => ({
    questionNumber: startNumber + index,
    prompt: `Question ${startNumber + index}`,
    type: 'single-choice',
    options: [{ label: 'A', text: 'Option A' }, { label: 'B', text: 'Option B' }, { label: 'C', text: 'Option C' }],
    answerSource: 'official-answer-key',
    answerKey: { correctOptionLabels: ['A'] },
  }));
  const formRows = (count: number, startNumber = 1) => Array.from({ length: count }, (_, index) => ({
    questionNumber: startNumber + index,
    prompt: `Field ${startNumber + index}`,
    type: 'short-answer',
    maxWords: 5,
    ...accepted([`answer ${startNumber + index}`]),
  }));
  const templates: Record<number, unknown> = {
    1: { partNumber: 1, title: 'Listen and tick the box', instruction: 'Listen and choose the correct picture.', blocks: [{ blockNumber: 1, title: 'Choose picture A, B or C', interaction: { family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example', answer: 'B' }], questions: choices(5) } }] },
    2: { partNumber: 2, title: 'Listen and write a letter', instruction: 'Write a letter for each numbered item.', blocks: [{ blockNumber: 1, title: 'Single-image letter matching', interaction: { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example', answer: 'A' }], questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: 6 + index, prompt: `Row ${6 + index}`, type: 'short-answer', maxWords: 1, ...accepted([String.fromCharCode(65 + index)]) })) } }] },
    3: { partNumber: 3, title: 'Listen and choose A, B or C', instruction: 'Choose the best reply for each conversation.', blocks: [{ blockNumber: 1, title: 'Dialogue choices', interaction: { family: 'choice', subtype: 'dialogue', variant: 'dialogue-choice', schemaVersion: 1 }, content: { examples: [{ prompt: 'How are you?', answer: 'C' }], questions: choices(5, 11) } }] },
    4: { partNumber: 4, title: 'Part 4 listening - Question 16–20.', instruction: 'Part 4 listening - Question 16–20.', blocks: [{ blockNumber: 1, title: 'Listening form fields', interaction: { family: 'text-entry', subtype: 'form-completion', variant: 'image-form-fields', schemaVersion: 1 }, content: { passage: 'Phone Message\nTo: Martin\nInclude only the printed form content and example.', questions: formRows(5, 16) } }] },
    5: { partNumber: 5, title: 'Part 5 listening - Question 21–25.', instruction: 'Part 5 listening - Question 21–25.', blocks: [{ blockNumber: 1, title: 'Listening form fields', interaction: { family: 'text-entry', subtype: 'form-completion', variant: 'image-form-fields', schemaVersion: 1 }, content: { passage: 'Event details\nInclude only the printed form content and example.', questions: formRows(5, 21).map((question, index) => index === 0 ? { ...question, prompt: 'New address', answerPrefix: '98', answerSuffix: 'Road', ...accepted(['Warnock']) } : question) } }] },
  };
  return `Bạn là chuyên gia số hóa Cambridge A2 Key (KET) Listening từ ảnh/PDF đề bài và official answer key.

MỤC TIÊU CẤU TRÚC
- ${focusedPart ? `CHỈ trả Part ${focusedPart}; papers[0].parts chỉ có đúng Part ${focusedPart}.` : 'Trả đúng 5 Part theo thứ tự 1–5.'}
- Mỗi Part mặc định thường có 5 câu nhưng số câu KHÔNG bị khóa theo JSON mẫu. Đọc số câu thật trên đề và trả đúng số câu chấm điểm; example luôn tách riêng và không tính điểm.
- JSON chỉ chứa nội dung và đáp án. Giáo viên gắn ảnh/audio trong editor; không trả asset ID, URL, base64, crop hoặc tọa độ.

ÁNH XẠ GIAO DIỆN
- Part 1: giống Movers Listening Part 4 và mỗi câu vẫn có ba đáp án A/B/C. Ứng dụng chỉ tự crop ba ảnh lựa chọn cho từng câu in số 1, 2, 4, 5, tổng cộng 12 ảnh. Câu in số 3 là đúng MỘT ảnh tổng đặc biệt do giáo viên tải/dán riêng; ảnh nằm trên và ba nút A/B/C nằm dưới, tuyệt đối không sinh ba crop hay ba ảnh riêng cho câu 3. Câu thêm ngoài bộ 1–5 do giáo viên gắn ảnh thủ công.
- Part 2: dùng đúng một ảnh đặt bên trái và cột nhập chữ ở bên phải. Trả đúng một example, prompt/nhãn của từng hàng và acceptedAnswers là đúng một chữ A–H.
- Part 3: không dùng ảnh và không trả content.passage lặp lại tiêu đề/hướng dẫn. Trả đúng một example dạng text; mỗi câu có prompt là lời thoại/câu hỏi đầy đủ nằm trên và đúng ba lựa chọn A/B/C nằm dưới.
- Part 4 và Part 5: title và instruction phải lần lượt đúng “Part 4 listening - Question 16–20.” và “Part 5 listening - Question 21–25.”. content.passage CHỈ chứa nội dung biểu mẫu in sẵn và example nằm dưới tiêu đề chính; tuyệt đối không lặp PART, dải QUESTIONS, tiêu đề hoặc hướng dẫn nghe. Mỗi question là một hàng biểu mẫu có questionNumber, prompt là nhãn, answerPrefix là chữ/ký hiệu in sẵn trước ô và answerSuffix là chữ/ký hiệu in sẵn sau ô (cả hai đều có thể rỗng), maxWords và acceptedAnswers. Ví dụ câu 21 “New address: 98 ___ Road” phải trả answerPrefix "98", answerSuffix "Road", acceptedAnswers chỉ là phần điền giữa như "Warnock".

QUY TẮC ĐÁP ÁN
- Chỉ dùng answerSource "official-answer-key" khi nhìn thấy đáp án trực tiếp trong key. Nếu chưa chắc, dùng "unverified" và để answerKey rỗng; không đoán từ transcript.
- Part 1 và Part 3: đúng ba options có label A/B/C và đúng một correctOptionLabels.
- Part 2: acceptedAnswers chỉ là một chữ A–H.
- Part 4/5: acceptedAnswers chỉ chứa phần học sinh phải nhập ở giữa, không lặp answerPrefix hoặc answerSuffix.
- Không sinh id, questionId, questionIds, optionId, imageAssetId, imageUrl, audioAssetId, audioUrl, secret/API key hoặc trường kỹ thuật.
- Chỉ trả một JSON object hợp lệ, không Markdown, code fence hay giải thích ngoài JSON.
- format "exam-bundle-import-v2", formatVersion 2, exam.moduleId "ket", paperId "listening".

JSON MẪU ĐÚNG CẤU TRÚC (thay toàn bộ dữ liệu minh họa và số lượng mẫu bằng dữ liệu thật):
${JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'ket', title: content.title, description: content.description, level: 'A2 Key' }, papers: [{ paperId: 'listening', title: 'Listening', timeLimitMinutes: content.timeLimitMinutes || 30, parts: selected.map(part => templates[part]) }] }, null, 2)}

Tự kiểm tra lần cuối: ${focusedPart ? `chỉ Part ${focusedPart}, đúng số câu thật và đúng interaction đã khóa` : 'đủ 5 Part; Part 1 có 12 crop + một ảnh chung câu 3, Part 2 một ảnh + chữ A–H, Part 3 không lặp khối tiêu đề, Part 4/5 tách tiêu đề chính khỏi nội dung biểu mẫu và hỗ trợ prefix/input/suffix'}, đáp án chỉ từ official key. Sau đó chỉ in JSON.`;
}

function ketReadingWritingPrompt(content: ExamPaperContent, focusedPart?: number) {
  const selected = focusedPart ? [focusedPart] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const accepted = (answers: string[]) => ({ answerSource: 'official-answer-key', answerKey: { acceptedAnswers: answers } });
  const choices = (count: number, withPrompt: boolean, startNumber = 1) => Array.from({ length: count }, (_, index) => ({
    questionNumber: startNumber + index,
    ...(withPrompt ? { prompt: `Question text ${startNumber + index}` } : { prompt: `Admin label ${startNumber + index}` }),
    type: 'single-choice',
    options: [{ label: 'A', text: 'Option A' }, { label: 'B', text: 'Option B' }, { label: 'C', text: 'Option C' }],
    answerSource: 'official-answer-key',
    answerKey: { correctOptionLabels: ['A'] },
  }));
  const letters = (count: number, startNumber = 1) => Array.from({ length: count }, (_, index) => ({
    questionNumber: startNumber + index,
    prompt: `Row ${startNumber + index}`,
    type: 'short-answer',
    maxWords: 1,
    ...accepted([String.fromCharCode(65 + index)]),
  }));
  const templates: Record<number, unknown> = {
    1: { partNumber: 1, title: 'Write a letter', instruction: 'Read the question page and write a letter for each number.', blocks: [{ blockNumber: 1, title: 'Single-image letter matching', interaction: { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example', answer: 'A' }], questions: letters(5) } }] },
    2: { partNumber: 2, title: 'Choose A, B or C', instruction: 'Read each question and choose the correct answer.', blocks: [{ blockNumber: 1, title: 'Text questions and answer rows', interaction: { family: 'choice', subtype: 'cloze', variant: 'multiple-choice-cloze', schemaVersion: 1 }, content: { examples: [{ prompt: 'Nina ____ up early that morning because it was her birthday.', answer: 'B' }], questions: choices(5, true, 6) } }] },
    3: { partNumber: 3, title: 'Two exercise groups', instruction: 'Complete both exercise groups.', blocks: [{ blockNumber: 1, title: 'Part 3A · Choose A, B or C', interaction: { family: 'choice', subtype: 'cloze', variant: 'multiple-choice-cloze', schemaVersion: 1 }, content: { questions: choices(5, true, 11) } }, { blockNumber: 2, title: 'Part 3B · Write a letter', interaction: { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1 }, content: { examples: [{ prompt: 'Printed example', answer: 'A' }], questions: letters(5, 16) } }] },
    4: { partNumber: 4, title: 'Read and choose', instruction: 'Read each question and choose A, B or C.', blocks: [{ blockNumber: 1, title: 'Image, question and three choices', interaction: { family: 'choice', subtype: 'single', variant: 'prompt-choice-rows', schemaVersion: 1 }, content: { questions: choices(7, true, 21) } }] },
    5: { partNumber: 5, title: 'Choose A, B or C', instruction: 'Choose the correct answer for each number.', blocks: [{ blockNumber: 1, title: 'Image, example and answer rows', interaction: { family: 'choice', subtype: 'cloze', variant: 'multiple-choice-cloze', schemaVersion: 1 }, content: { examples: [{ prompt: '0', options: [{ label: 'A', text: 'with' }, { label: 'B', text: 'of' }, { label: 'C', text: 'in' }], answer: 'B' }], questions: choices(8, false, 28) } }] },
    6: { partNumber: 6, title: 'Complete the spelling', instruction: 'The first letter is given. Write the remaining letters.', blocks: [{ blockNumber: 1, title: 'Initial-letter spelling', interaction: { family: 'text-entry', subtype: 'spelling', variant: 'initial-letter-spelling', schemaVersion: 1 }, content: { passage: 'PART 6\nRead the descriptions of some words. What is the word for each description? The first letter is already there.\nEXAMPLE\nYou can take photos of your holiday with this. c a m e r a', questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: 36 + index, prompt: `Description ${36 + index}`, type: 'short-answer', answerPrefix: 'p', answerLength: 8, maxWords: 1, ...accepted(['assport']) })) } }] },
    7: { partNumber: 7, title: 'Complete the text', instruction: 'Write one word for each numbered space.', blocks: [{ blockNumber: 1, title: 'Numbered text gaps', interaction: { family: 'text-entry', subtype: 'open-cloze', variant: 'image-numbered-gaps', schemaVersion: 1 }, content: { passage: 'PART 7\nComplete the letter. Write ONE word for each space.\nDear Pat,\nI arrived (Example: here) three weeks ago. Transcribe the complete printed text and preserve every numbered gap.', questions: Array.from({ length: 10 }, (_, index) => ({ questionNumber: 41 + index, prompt: '', type: 'short-answer', maxWords: 1, ...accepted([`word${index + 1}`]) })) } }] },
    8: { partNumber: 8, title: 'Complete the notes', instruction: 'Read the source image and complete each labelled field.', blocks: [{ blockNumber: 1, title: 'Image source and form fields', interaction: { family: 'text-entry', subtype: 'form-completion', variant: 'image-form-fields', schemaVersion: 1 }, content: { questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: 51 + index, prompt: ['Date', 'Name of film', 'Starting time', 'Ticket price', 'Meet Sheila in'][index], type: 'short-answer', answerPrefix: index === 3 ? '£' : '', maxWords: 5, ...accepted([`answer ${index + 1}`]) })) } }] },
    9: { partNumber: 9, title: 'Guided writing', instruction: 'Read the task and write your answer.', blocks: [{ blockNumber: 1, title: 'Writing task', interaction: { family: 'writing', subtype: 'guided', variant: 'ai-guided-writing', schemaVersion: 1 }, content: { passage: 'QUESTION 56\nRead the note from your friend. Write a postcard or message that answers every requested point.\nHints: when you are coming; how long you want to stay; what you want to do.', questions: [{ questionNumber: 56, prompt: 'Write a postcard or short message using every point above.', context: 'The student must answer every point in the task text and hints.', type: 'long-writing', points: 10, minWords: 25, maxWords: 50, rubric: 'Score completion, sentence use, grammar and vocabulary with an integer score from 0 to 10.', writingGrading: { enabled: true, providerId: 'stali:gpt-5.6-sol', taskContext: 'The student must answer every point in the task text and hints.', gradingInstructions: 'Chấm điểm nguyên từ 0 đến 10. Kiểm tra mức độ hoàn thành yêu cầu, số câu, ngữ pháp và từ vựng; chỉ ra lỗi cụ thể và trả về nhận xét ngắn gọn, đầy đủ trong khoảng 4–5 câu.', scoreScale: 10 } }] } }] },
  };
  return `Bạn là chuyên gia số hóa Cambridge A2 Key (KET) Reading & Writing từ ảnh/PDF đề bài và official answer key.

MỤC TIÊU CỐ ĐỊNH
- ${focusedPart ? `CHỈ trả Part ${focusedPart}; papers[0].parts chỉ có đúng Part ${focusedPart}.` : 'Trả đúng 9 Part theo thứ tự 1–9.'}
- Số câu của Part 1–8 KHÔNG bị khóa theo JSON mẫu. Hãy đọc số câu thật trên đề và tạo đúng số câu chấm điểm. Part 2 và Part 5 giữ đúng một example tách riêng; Part 6–7 chép example vào content.passage và không tạo câu chấm điểm cho example. Part 8 không trả content.passage vì toàn bộ nguồn, hướng dẫn và example đã nằm trong ảnh giáo viên gắn.
- Part 3 luôn có đúng hai blocks theo thứ tự 3A rồi 3B. Part 9 luôn có đúng một bài viết, points 10 và được chấm điểm nguyên 0–10.
- JSON chỉ chứa nội dung/đáp án. Ảnh dùng ở Part 1, 3A, 3B, 4, 5 và 8, do giáo viên tải hoặc dán riêng trong editor; Part 2, 6, 7 và 9 phải trả đầy đủ chữ cần hiển thị, không phụ thuộc ảnh. Không trả asset ID, URL, base64, crop hay tọa độ.

ÁNH XẠ GIAO DIỆN
- Part 1: đúng một ảnh đặt bên trái và một cột nhập chữ A–H bên phải.
- Part 2: không dùng ảnh. Trả đúng một example dạng chữ trong content.examples. Mỗi câu bắt buộc có questionNumber và prompt là câu hỏi thật; câu hỏi nằm trên, đúng ba đáp án A/B/C nằm ngay bên dưới.
- Part 3A: ảnh hiển thị phía trên và phần làm bài ở dưới; không tạo khối example riêng. Mỗi câu bắt buộc có prompt là câu hỏi thật nằm trên ba đáp án A/B/C.
- Part 3B: giống Part 1, chỉ dùng một ảnh bên trái. Đọc đúng số in cạnh từng chỗ trống trên ảnh và trả số đó trong questionNumber (ví dụ 16, 17, 18, 19, 20); tuyệt đối không đánh lại thành 1..5. Hai nhóm có số câu độc lập và đều có thể thêm/bớt.
- Part 4: ảnh hiển thị phía trên, bỏ example riêng; mỗi câu nằm dưới ảnh với prompt ở trên và ba phương án A/B/C dàn đều bên dưới.
- Part 5: ảnh hiển thị phía trên. Example trong official key là một hàng lựa chọn, KHÔNG phải câu điền khuyết được dựng lại từ ảnh đề. Trả đúng một content.examples[0] gồm prompt là số example in trên đề (thường là "0"), options đúng ba mục A/B/C chép nguyên văn từ official key và answer là nhãn đáp án đúng A/B/C. Với mẫu Schnauzer trong tài liệu: prompt "0", options A "with", B "of", C "in", answer "B". Không đưa câu "There are three sizes ... Schnauzer dog." vào example.prompt vì câu đó đã nằm trong ảnh.
- Part 6: không dùng ảnh. content.passage phải chép nguyên hướng dẫn và example thành chữ. Mỗi question bắt buộc có questionNumber, prompt, answerPrefix đúng một chữ cái và answerLength là TỔNG số ký tự của từ đầy đủ. answerKey.acceptedAnswers CHỈ chứa phần học sinh phải nhập, không gồm answerPrefix. Ví dụ passport: answerPrefix "p", answerLength 8, acceptedAnswers ["assport"], học sinh thấy đúng 7 ô.
- Part 7: không dùng ảnh. content.passage phải chứa toàn bộ hướng dẫn, bài đọc và example thành chữ, giữ nguyên các số ô trống. Mỗi question chỉ cần questionNumber khớp bài đọc, prompt rỗng, maxWords 1 và đáp án; không sinh "Gap 1". Các ô được giao diện chia hai cột.
- Part 8: giáo viên tải/dán một ảnh riêng trong editor và ảnh hiển thị bên trái khu vực làm bài; JSON không chứa trường ảnh và KHÔNG trả content.passage. Hướng dẫn, nguồn thông tin và example chỉ dùng để đọc đáp án từ ảnh, không chép lại thành khối chữ. Mỗi question có questionNumber, prompt là nhãn biểu mẫu, một answerPrefix không bắt buộc (ví dụ £) nằm ngay đầu cùng vùng nhập và acceptedAnswers chỉ chứa phần học sinh điền tiếp. Không sinh answerSuffix. Số hàng có thể thêm/bớt.
- Part 9: không dùng ảnh. content.passage phải chứa đầy đủ câu hỏi và các gợi ý thành chữ; context/taskContext mô tả trung thực yêu cầu đó. minWords/maxWords do giáo viên cấu hình; không tự khóa ở 25–35 hay 50 từ. Giữ writingGrading đúng cấu trúc mẫu, points 10, scoreScale 10.

QUY TẮC ĐÁP ÁN VÀ AN TOÀN
- answerSource chỉ là "official-answer-key" khi đáp án nhìn thấy trực tiếp trong key. Nếu chưa chắc, dùng "unverified" và để answerKey rỗng; không đoán.
- Part 1 và 3B: mỗi acceptedAnswers là đúng một chữ A–H.
- Part 2, 3A, 4, 5: mỗi câu đúng ba options A/B/C và đúng một correctOptionLabels.
- Part 6: mỗi acceptedAnswers có đúng answerLength trừ độ dài answerPrefix ký tự và không chứa lại answerPrefix ở đầu; p + assport tạo thành passport.
- Không sinh id, questionId, questionIds, optionId, assetId, URL, base64, đường dẫn file hoặc secret/API key.
- Chỉ trả một JSON object hợp lệ, không Markdown, code fence hay giải thích ngoài JSON.
- format "exam-bundle-import-v2", formatVersion 2, exam.moduleId "ket", paperId "reading-writing".

JSON MẪU ĐÚNG CẤU TRÚC (thay dữ liệu minh họa và số lượng mẫu bằng dữ liệu thật):
${JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'ket', title: content.title, description: content.description, level: 'A2 Key' }, papers: [{ paperId: 'reading-writing', title: 'Reading & Writing', timeLimitMinutes: content.timeLimitMinutes || 60, parts: selected.map(part => templates[part]) }] }, null, 2)}

Tự kiểm tra lần cuối: ${focusedPart ? `chỉ Part ${focusedPart}, đúng interaction và đúng số câu thật trên ảnh` : 'đủ 9 Part; Part 1/3B mỗi dạng chỉ một ảnh; Part 3 đúng hai block; Part 5 có một example A/B/C lấy từ official key; Part 8 không có content.passage và có ảnh giáo viên gắn; Part 9 đúng một bài viết 10 điểm'}, đáp án chỉ từ official key. Sau đó chỉ in JSON.`;
}

function buildUniversalExamPrompt(content: ExamPaperContent, focusedPart?: number) {
  if (content.moduleId === 'starter' && content.paperId === 'listening') return starterListeningPrompt(content, focusedPart);
  if (content.moduleId === 'starter' && content.paperId === 'reading-writing') return starterReadingWritingPrompt(content, focusedPart);
  if (content.moduleId === 'flyer' && content.paperId === 'listening') return flyerListeningPrompt(content, focusedPart);
  if (content.moduleId === 'flyer' && content.paperId === 'reading-writing') return flyerReadingWritingPrompt(content, focusedPart);
  if (content.moduleId === 'ket' && content.paperId === 'listening' && content.templateVersion === 'ket-listening-5-v1') return ketListeningPrompt(content, focusedPart);
  if (content.moduleId === 'ket' && content.paperId === 'reading-writing' && content.templateVersion === 'ket-reading-writing-9-v1') return ketReadingWritingPrompt(content, focusedPart);
  const context = JSON.stringify({
    moduleId: content.moduleId,
    paperId: content.paperId,
    currentTitle: content.title,
    currentLevel: content.level,
    ...(focusedPart ? { requestedPart: focusedPart } : {}),
  }, null, 2);
  return `Bạn là chuyên gia trích xuất đề thi từ ảnh/PDF và official answer key thành Universal Exam JSON v2.

MỤC TIÊU
- Đọc đúng cấu trúc thật của đề, không áp đặt số Part hoặc số câu cố định.
- Mỗi Part trong đề tạo đúng một phần tử parts[].
- Nếu một Part có nhiều dạng/yêu cầu làm bài, tách thành nhiều blocks[] theo đúng thứ tự in trên đề.
- Mỗi block phải mô tả đủ 3 lớp interaction: family -> subtype -> variant.
- Chỉ trích xuất nội dung; ứng dụng sẽ tự tạo ID kỹ thuật và giáo viên tự gắn ảnh/audio.
${focusedPart ? `- CHỈ trích xuất Part ${focusedPart}. Trong papers[0].parts chỉ trả đúng một phần tử có partNumber ${focusedPart}; không tự tạo lại các Part khác.` : ''}

NGỮ CẢNH ĐÍCH
${context}

INTERACTION ĐƯỢC PHÉP
- choice: subtype single|multiple; variant text-options|image-options.
- text-entry: subtype short-answer; variant single-input|inline-gap|image-regions.
- matching: subtype text-text|text-image|image-image; variant select-pair|draw-line. Dùng draw-line cho nối trực quan trên ảnh.
- scene: subtype colour-object|draw-object|place-object; variant paint|draw|drag-drop.
- writing: subtype guided|essay; variant text-area.
Không đổi dạng bài chỉ để khớp ví dụ. Hãy dùng family/subtype/variant phản ánh đúng thao tác học sinh thực hiện.

QUY TẮC ĐÁP ÁN
- Mỗi câu có answerSource: "official-answer-key", "teacher-supplied" hoặc "unverified".
- Chỉ dùng official-answer-key khi đáp án được nhìn thấy trực tiếp trong key chính thức.
- Với câu chọn: answerKey.correctOptionLabels, ví dụ ["B"].
- Với điền: answerKey.acceptedAnswers.
- Với image-image draw-line: câu có sourceLabel và answerKey.targetLabel; content.sourceNodes/content.targetNodes liệt kê toàn bộ đối tượng, kể cả example/distractor; exampleConnection tách riêng và không tính là câu.
- Nếu không chắc, dùng unverified và để answerKey rỗng; không đoán.

PHÂN BIỆT COLOUR VÀ DRAW TRÊN TRANH
- Đọc từng câu trong official answer key hoặc instruction; không suy ra rằng mọi câu của Part đều là tô màu chỉ vì tiêu đề có từ "colour".
- Hành động tô một vật đã có sẵn: dùng interaction scene / colour-object / paint. Mỗi question trả answerKey.colour bằng đúng một tên trong catalog: red, blue, green, yellow, orange, purple, pink, brown, black, white.
- Hành động yêu cầu tạo thêm nét/vật chưa có sẵn, với động từ draw/add/make: dùng interaction scene / draw-object / draw. Mỗi question trả drawObject và targetDescription; không trả answerKey.colour.
- JSON không trả ảnh/icon Draw. Sau khi nhập, giáo viên sẽ tải riêng một ảnh PNG nền trong suốt cho mỗi drawObject; học sinh kéo ảnh này vào vùng đích trên scene.
- Ví dụ "Draw a flower on the dog's head" nghĩa là vẽ thêm một bông hoa ở đầu con chó. Phải trả drawObject "flower"; tuyệt đối không đổi thành "Colour the flower on the dog's head".
- Nếu cùng một Part có cả colour và draw, tách thành hai blocks theo đúng interaction, giữ questionNumber gốc để không đổi thứ tự câu.

GỢI Ý TỌA ĐỘ (KHÔNG BẮT BUỘC)
- Được phép trả geometryHints để gợi ý vùng source-node, target-node, answer-region, colour-mask, draw-region hoặc option-crop.
- Ưu tiên coordinateSpace "normalized" với x,y,width,height trong 0..1.
- Nếu dùng "pixel", bắt buộc có imageSize {width,height} đúng theo ảnh nguồn.
- Mỗi region có role, ref (nhãn node hoặc "Câu N"), shape rect|ellipse|polygon, x,y,width,height; polygon thêm points; có thể thêm anchor và confidence 0..1.
- Đây chỉ là gợi ý. Không khai báo là đã được giáo viên xác nhận.

CẤM
- Không trả id, questionId, questionIds, imageAssetId, imageUrl, audioAssetId, audioUrl, correctOptionIds, interactionSourceNodeId, responseKey, URL, base64 hoặc đường dẫn file.
- Không đưa audio/transcript vào JSON và không dùng audio để suy luận đáp án.
- Không bọc Markdown, không dùng dấu \`\`\`, không viết giải thích ngoài JSON.

SCHEMA BẮT BUỘC
{
  "format": "exam-bundle-import-v2",
  "formatVersion": 2,
  "exam": {
    "moduleId": "${content.moduleId}",
    "title": "Tên bộ đề",
    "description": "Mô tả ngắn",
    "level": "Cấp độ"
  },
  "papers": [
    {
      "paperId": "${content.paperId}",
      "title": "Tên paper",
      "description": "Mô tả",
      "level": "Cấp độ",
      "timeLimitMinutes": 20,
      "parts": [
        {
          "partNumber": ${focusedPart || 1},
          "title": "Tiêu đề Part",
          "instruction": "Hướng dẫn chung",
          "blocks": [
            {
              "blockNumber": 1,
              "title": "Tên dạng bài",
              "instruction": "Yêu cầu của block",
              "interaction": {
                "family": "text-entry",
                "subtype": "short-answer",
                "variant": "inline-gap",
                "schemaVersion": 1
              },
              "content": {
                "passage": "Đoạn chung nếu có",
                "questions": [
                  {
                    "prompt": "Which class is Sam in? ____",
                    "type": "short-answer",
                    "points": 1,
                    "answerSource": "official-answer-key",
                    "answerKey": { "acceptedAnswers": ["5"] }
                  }
                ]
              },
              "geometryHints": {
                "coordinateSpace": "normalized",
                "regions": [
                  {
                    "role": "answer-region",
                    "ref": "Câu 1",
                    "questionNumber": 1,
                    "shape": "rect",
                    "x": 0.62,
                    "y": 0.41,
                    "width": 0.22,
                    "height": 0.06,
                    "confidence": 0.9
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}

Với câu choice, thêm options [{"label":"A","text":"..."}] trong từng question.
Với image-image draw-line, ví dụ content là:
{
  "sourceNodes": [{"label":"elephant"}],
  "targetNodes": [{"label":"boat"}],
  "exampleConnection": {"sourceLabel":"example source","targetLabel":"example target"},
  "questions": [{"prompt":"elephant","sourceLabel":"elephant","answerSource":"official-answer-key","answerKey":{"targetLabel":"boat"}}]
}

Với yêu cầu vẽ thêm vật trên scene, ví dụ một block hợp lệ là:
{
  "blockNumber": 2,
  "title": "Draw on the picture",
  "instruction": "Listen, colour and draw.",
  "interaction": {"family":"scene","subtype":"draw-object","variant":"draw","schemaVersion":2},
  "content": {
    "questions": [{
      "questionNumber": 5,
      "prompt": "Draw a flower on the dog's head.",
      "type": "scene-draw",
      "drawObject": "flower",
      "targetDescription": "on the dog's head",
      "points": 1,
      "answerSource": "official-answer-key",
      "answerKey": {}
    }]
  },
  "geometryHints": {
    "coordinateSpace": "normalized",
    "regions": [{"role":"draw-region","ref":"Câu 5","questionNumber":5,"shape":"rect","x":0.6,"y":0.2,"width":0.15,"height":0.15,"confidence":0.8}]
  }
}

${focusedPart ? `Chỉ trả Part ${focusedPart}, nhưng vẫn dùng đầy đủ envelope exam-bundle-import-v2 giống JSON tổng. Tự xác định số block và số câu thật của Part này.` : 'Tự xác định số Part, số block và số câu từ tài liệu được cung cấp.'} Chỉ trả về một JSON hợp lệ theo schema trên.`;
}

export function buildUniversalExamImportPrompt(content: ExamPaperContent) {
  return buildUniversalExamPrompt(content);
}

export function buildUniversalExamPartImportPrompt(content: ExamPaperContent, partIndex: number) {
  return buildUniversalExamPrompt(content, partIndex + 1);
}
