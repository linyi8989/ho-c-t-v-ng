import type { ExamPaperContent } from './types';

const clean = (value: unknown, max = 1_000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

export function buildStarterListeningBundlePrompt(content?: Pick<ExamPaperContent, 'title' | 'description'>) {
  const title = clean(content?.title, 240) || 'Pre A1 Starters Listening';
  const description = clean(content?.description, 1_000) || 'Bộ đề Cambridge Pre A1 Starters Listening gồm 4 Part và 20 câu chấm điểm.';
  return `Bạn là chuyên gia số hóa đề Cambridge Pre A1 Starters Listening.

NHIỆM VỤ
Đọc toàn bộ ảnh/PDF đề bài và official answer key mà tôi đính kèm. Trả về MỘT JSON tổng cho cả bài Listening, gồm đúng 4 Part và đúng 20 câu chấm điểm. JSON sẽ được dán trực tiếp vào hệ thống soạn đề.

NGỮ CẢNH HIỆN TẠI
- Tiêu đề gợi ý: ${title}
- Mô tả gợi ý: ${description}

NGUYÊN TẮC PHÂN LOẠI
- Mỗi section bắt buộc khai báo đúng ba lớp trong interaction: family / subtype / variant.
- Part 1: matching / image-image / draw-line.
- Part 2: text-entry / short-answer / single-input.
- Part 3: choice / single / image-options.
- Part 4: scene / colour-object / paint.
- Không tự đổi dạng bài theo suy đoán nếu số Part đã xác định. Hãy dùng nội dung trang đề và answer key để điền đúng schema của Part tương ứng.

QUY TẮC ĐẦU RA BẮT BUỘC
- Chỉ trả về một JSON object hợp lệ. Không Markdown, không dấu \`\`\`, không lời giải thích trước hoặc sau JSON.
- Dùng đúng format "exam-bundle-import-v1", formatVersion 1, exam.moduleId "starter" và paperId "listening".
- Không tạo bất kỳ ID kỹ thuật nào. Cấm các trường id, questionId, optionId, assetId, targetId, choiceId, blankId, sourceNodeId, targetNodeId, interactionSourceNodeId và responseKey.
- Không đưa URL, đường dẫn tệp, base64, data URI, tọa độ, crop, hitbox, anchor, mask hoặc polygon vào JSON.
- Không đưa ảnh hoặc MP3 vào JSON. Giáo viên sẽ tải media, crop ảnh và xác nhận điểm neo/mask trong ứng dụng.
- Mọi nhãn dùng để tham chiếu phải giống nhau tuyệt đối giữa danh sách và đáp án, không trùng trong cùng một nhóm.
- Chỉ đánh dấu source là "official-answer-key" khi đáp án đọc được trực tiếp từ official answer key. Nếu chưa chắc chắn, dùng source "unverified" và ghi rõ trong validation.warnings; tuyệt đối không đoán đáp án.
- Chỉ lấy 5 câu chấm điểm của mỗi Part. Không đưa câu example in sẵn vào danh sách 20 câu.

YÊU CẦU TỪNG PART

PART 1
- sourceNodes đúng 7 node và targetNodes đúng 7 node: 5 cặp chấm điểm, 1 cặp example, 1 node nhiễu ở mỗi nhóm.
- Mỗi node chỉ có label và assetRole "scene-image".
- exampleConnection tham chiếu bằng sourceLabel/targetLabel và không được lặp lại trong 5 correctConnections.
- correctConnections đúng 5 phần tử, questionNumber từ 1 đến 5, ánh xạ một-một, không lặp sourceLabel hoặc targetLabel.

PART 2
- questions đúng 5 phần tử, mỗi câu chỉ có đúng 1 gap.
- template phải chứa đúng một chuỗi ____ tại vị trí học sinh nhập đáp án.
- acceptedAnswers chứa đáp án tên hoặc số và các biến thể chính thức nếu answer key cho phép; maxWords là số từ tối đa.
- passage bắt buộc chứa đúng 2 example không chấm điểm; mỗi example là một dòng đầy đủ gồm câu hỏi và đáp án in sẵn.

PART 3
- questions đúng 5 phần tử; không đưa hàng example vào questions.
- Mỗi câu có đúng 3 options theo thứ tự A, B, C. Mỗi option chỉ có label, text mô tả ngắn và assetRole "options-image".
- answer.value chứa đúng một nhãn A/B/C và source theo official answer key.
- Không crop ảnh trong JSON. Ứng dụng sẽ tự dò 15 khung; nếu trang có 18 khung thì tự bỏ 3 khung example.

PART 4
- choices chứa từ 2 đến 20 màu xuất hiện trong đề/đáp án; mỗi choice có label là tên màu tiếng Anh và type "colour".
- questions đúng 5 phần tử. Mỗi câu có đúng 1 action type "colour-object", targetLabel mô tả chính xác đối tượng cần tô và colour là tên màu có trong choices.
- targets phải là mảng rỗng, coordinateSpace là "unknown", imageSize là {"width":0,"height":0}. Giáo viên sẽ tạo mask sau.

MẪU CẤU TRÚC PHẢI ĐIỀN ĐỦ
{
  "format": "exam-bundle-import-v1",
  "formatVersion": 1,
  "exam": {
    "moduleId": "starter",
    "title": "Tên bộ đề đọc từ nguồn",
    "description": "Mô tả ngắn",
    "confidence": 0.0
  },
  "papers": [
    {
      "paperId": "listening",
      "title": "Listening",
      "sections": [
        {
          "slot": "part-1",
          "title": "Part 1",
          "instruction": "Listen and draw lines. There is one example.",
          "interaction": {"family":"matching","subtype":"image-image","variant":"draw-line","schemaVersion":2},
          "payload": {
            "sourceNodes": [
              {"label":"source label 1","assetRole":"scene-image"},
              {"label":"source label 2","assetRole":"scene-image"},
              {"label":"source label 3","assetRole":"scene-image"},
              {"label":"source label 4","assetRole":"scene-image"},
              {"label":"source label 5","assetRole":"scene-image"},
              {"label":"example source","assetRole":"scene-image"},
              {"label":"distractor source","assetRole":"scene-image"}
            ],
            "targetNodes": [
              {"label":"target label 1","assetRole":"scene-image"},
              {"label":"target label 2","assetRole":"scene-image"},
              {"label":"target label 3","assetRole":"scene-image"},
              {"label":"target label 4","assetRole":"scene-image"},
              {"label":"target label 5","assetRole":"scene-image"},
              {"label":"example target","assetRole":"scene-image"},
              {"label":"distractor target","assetRole":"scene-image"}
            ],
            "exampleConnection": {"sourceLabel":"example source","targetLabel":"example target"},
            "correctConnections": [
              {"questionNumber":1,"sourceLabel":"source label 1","targetLabel":"target label 1","source":"official-answer-key"},
              {"questionNumber":2,"sourceLabel":"source label 2","targetLabel":"target label 2","source":"official-answer-key"},
              {"questionNumber":3,"sourceLabel":"source label 3","targetLabel":"target label 3","source":"official-answer-key"},
              {"questionNumber":4,"sourceLabel":"source label 4","targetLabel":"target label 4","source":"official-answer-key"},
              {"questionNumber":5,"sourceLabel":"source label 5","targetLabel":"target label 5","source":"official-answer-key"}
            ]
          },
          "validation": {"extractedQuestionCount":5,"status":"complete","warnings":[]}
        },
        {
          "slot": "part-2",
          "title": "Part 2",
          "instruction": "Listen and write a name or a number. There are two examples.",
          "passage": "What's the boy's name? — Sam.\nHow old is he? — 10.",
          "interaction": {"family":"text-entry","subtype":"short-answer","variant":"single-input","schemaVersion":1},
          "payload": {
            "questions": [
              {"number":1,"prompt":"Question 1","template":"Question 1 ____","gaps":[{"gapNumber":1,"acceptedAnswers":["answer"],"maxWords":1,"source":"official-answer-key"}]},
              {"number":2,"prompt":"Question 2","template":"Question 2 ____","gaps":[{"gapNumber":1,"acceptedAnswers":["answer"],"maxWords":1,"source":"official-answer-key"}]},
              {"number":3,"prompt":"Question 3","template":"Question 3 ____","gaps":[{"gapNumber":1,"acceptedAnswers":["answer"],"maxWords":1,"source":"official-answer-key"}]},
              {"number":4,"prompt":"Question 4","template":"Question 4 ____","gaps":[{"gapNumber":1,"acceptedAnswers":["answer"],"maxWords":1,"source":"official-answer-key"}]},
              {"number":5,"prompt":"Question 5","template":"Question 5 ____","gaps":[{"gapNumber":1,"acceptedAnswers":["answer"],"maxWords":1,"source":"official-answer-key"}]}
            ]
          },
          "validation": {"extractedQuestionCount":5,"status":"complete","warnings":[]}
        },
        {
          "slot": "part-3",
          "title": "Part 3",
          "instruction": "Listen and tick the box. There is one example.",
          "interaction": {"family":"choice","subtype":"single","variant":"image-options","schemaVersion":1},
          "payload": {
            "questions": [
              {"number":1,"prompt":"Question 1","options":[{"label":"A","text":"picture A","assetRole":"options-image"},{"label":"B","text":"picture B","assetRole":"options-image"},{"label":"C","text":"picture C","assetRole":"options-image"}],"answer":{"type":"option-labels","value":["A"],"source":"official-answer-key"}},
              {"number":2,"prompt":"Question 2","options":[{"label":"A","text":"picture A","assetRole":"options-image"},{"label":"B","text":"picture B","assetRole":"options-image"},{"label":"C","text":"picture C","assetRole":"options-image"}],"answer":{"type":"option-labels","value":["B"],"source":"official-answer-key"}},
              {"number":3,"prompt":"Question 3","options":[{"label":"A","text":"picture A","assetRole":"options-image"},{"label":"B","text":"picture B","assetRole":"options-image"},{"label":"C","text":"picture C","assetRole":"options-image"}],"answer":{"type":"option-labels","value":["C"],"source":"official-answer-key"}},
              {"number":4,"prompt":"Question 4","options":[{"label":"A","text":"picture A","assetRole":"options-image"},{"label":"B","text":"picture B","assetRole":"options-image"},{"label":"C","text":"picture C","assetRole":"options-image"}],"answer":{"type":"option-labels","value":["A"],"source":"official-answer-key"}},
              {"number":5,"prompt":"Question 5","options":[{"label":"A","text":"picture A","assetRole":"options-image"},{"label":"B","text":"picture B","assetRole":"options-image"},{"label":"C","text":"picture C","assetRole":"options-image"}],"answer":{"type":"option-labels","value":["B"],"source":"official-answer-key"}}
            ]
          },
          "validation": {"extractedQuestionCount":5,"status":"complete","warnings":[]}
        },
        {
          "slot": "part-4",
          "title": "Part 4",
          "instruction": "Listen and colour. There is one example.",
          "interaction": {"family":"scene","subtype":"colour-object","variant":"paint","schemaVersion":1},
          "payload": {
            "coordinateSpace": "unknown",
            "imageSize": {"width":0,"height":0},
            "choices": [{"label":"red","type":"colour"},{"label":"blue","type":"colour"}],
            "targets": [],
            "questions": [
              {"number":1,"prompt":"target object 1","actions":[{"type":"colour-object","targetLabel":"target object 1","colour":"red","source":"official-answer-key"}]},
              {"number":2,"prompt":"target object 2","actions":[{"type":"colour-object","targetLabel":"target object 2","colour":"blue","source":"official-answer-key"}]},
              {"number":3,"prompt":"target object 3","actions":[{"type":"colour-object","targetLabel":"target object 3","colour":"red","source":"official-answer-key"}]},
              {"number":4,"prompt":"target object 4","actions":[{"type":"colour-object","targetLabel":"target object 4","colour":"blue","source":"official-answer-key"}]},
              {"number":5,"prompt":"target object 5","actions":[{"type":"colour-object","targetLabel":"target object 5","colour":"red","source":"official-answer-key"}]}
            ]
          },
          "validation": {"extractedQuestionCount":5,"status":"complete","warnings":["Teacher must confirm colour masks in the app."]}
        }
      ],
      "validation": {"extractedSectionCount":4,"extractedQuestionCount":20,"status":"complete","warnings":[]}
    }
  ],
  "warnings": []
}

Trước khi trả lời, tự kiểm tra: đủ 4 slot, mỗi Part đúng 5 câu chấm điểm, interaction đúng ba lớp, mọi tham chiếu label tồn tại, Part 1 ánh xạ một-một, Part 2 mỗi câu đúng một gap, Part 3 mỗi câu đúng A/B/C, Part 4 mỗi câu đúng một action. Sau đó chỉ in JSON đã hoàn chỉnh.`;
}
