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
          examples: [{ prompt: 'Example sentence', answer: 'Yes' }],
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
        content: { questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Picture ${index + 1}: ____`, type: 'short-answer', maxWords: 1, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: [`word-${index + 1}`] } })) },
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
- Giữ đúng mô hình giao diện đã khóa: Part 1 Yes/No có ảnh example riêng; Part 2 giống Movers Reading & Writing Part 2; Part 3 dùng nguyên trang ảnh ở bên trái và năm ô nhập ở bên phải; Part 4 giống Movers Part 4 nhưng có đúng năm gap; Part 5 giống Movers Part 5 với ba cảnh, hai example ở cảnh 1 và phân bố 5 câu chấm điểm là 1 + 2 + 2.
- JSON chỉ chứa nội dung và đáp án. Giáo viên sẽ tải ảnh example, ảnh trang bài, ảnh word bank và ba ảnh cảnh trong editor.

QUY TẮC TỪNG PART
- Part 1: một block choice/single/yes-no; content.examples có đúng một example không chấm; 5 câu có đúng hai options YES/NO.
- Part 2: một block choice/single/yes-no; content.examples chứa các example in trên đề; 5 nhận định có đúng hai options YES/NO.
- Part 3: một block text-entry/short-answer/image-spelling; đúng 5 câu, mỗi câu một từ. Đọc đáp án từ official key, không tự giải chữ xáo trộn nếu key không rõ.
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

function buildUniversalExamPrompt(content: ExamPaperContent, focusedPart?: number) {
  if (content.moduleId === 'starter' && content.paperId === 'listening') return starterListeningPrompt(content, focusedPart);
  if (content.moduleId === 'starter' && content.paperId === 'reading-writing') return starterReadingWritingPrompt(content, focusedPart);
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
