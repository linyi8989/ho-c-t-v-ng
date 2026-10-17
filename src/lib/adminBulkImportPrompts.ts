import { grammarPassageTemplate } from './grammarPassageImport';

export interface AdminBulkImportPromptContext {
  title?: string;
  description?: string;
  grade?: string;
  subject?: string;
  topic?: string;
  tags?: string | string[];
}

function copyableOutputRule(format: 'text' | 'json') {
  return `Kết quả trả về phải đặt toàn bộ trong đúng một khung mã Markdown (mở bằng \`\`\`${format} và đóng bằng \`\`\`) để ChatGPT hiển thị nút Copy; bên trong chỉ chứa dữ liệu đúng định dạng để sao chép và dán trực tiếp vào khung soạn đề, không có nội dung bên ngoài khung.`;
}

export function buildPassageGrammarBulkImportPrompt(mode: 'passage_drag_drop' | 'reading_comprehension', context: AdminBulkImportPromptContext = {}) {
  return [
    mode === 'passage_drag_drop' ? 'Tạo hoặc trích xuất bài điền từ kéo thả trong đoạn văn.' : 'Tạo hoặc trích xuất bài đọc hiểu trắc nghiệm.',
    contextBlock(context),
    'Nếu tôi gửi ảnh hoặc văn bản, hãy giữ đầy đủ nội dung bài, xuống đoạn, câu hỏi và các lựa chọn. Nếu yêu cầu tạo mới, làm theo ngữ cảnh.',
    'Chỉ trả một đối tượng JSON hợp lệ, format grammar-passage-v1 như mẫu. Không lời dẫn, không ID kỹ thuật.',
    copyableOutputRule('json'),
    'Không khóa số lượng câu, ô trống hay lựa chọn theo mẫu. Có bao nhiêu dữ liệu thì trả đầy đủ bấy nhiêu; mỗi câu có thể có số lựa chọn khác nhau.',
    'instruction là hướng dẫn tiếng Anh; passage là đoạn văn đầy đủ (xuống dòng bằng \\n); explanation giải thích bằng tiếng Việt.',
    mode === 'passage_drag_drop'
      ? 'Đánh dấu ô trong passage bằng [[1]], [[2]]… Mỗi số xuất hiện đúng một lần. wordBank là mảng từ/cụm từ, có thể thêm 1–2 từ nhiễu khi phù hợp, không bắt buộc. Mỗi thẻ dùng một lần: cần hai lần cùng một từ thì lặp từ đó trong wordBank. answers có một mục cho mỗi ô: blank là số ô, answer là nguyên văn một từ trong wordBank, explanation là lời giải. Không thêm câu trắc nghiệm riêng.'
      : 'questions là mảng câu hỏi. Mỗi câu có question, options (mảng ít nhất hai lựa chọn khác nhau), answer (vị trí đáp án đúng tính từ 1) và explanation. Không giới hạn ở A/B/C/D hoặc ba lựa chọn.',
    'Không đoán đáp án còn thiếu trong nguồn. Nếu không xác định được, báo thiếu dữ kiện để giáo viên bổ sung; không trả dữ liệu hoàn chỉnh giả tạo.',
    'Mẫu cấu trúc (số lượng trong mẫu chỉ để minh họa):',
    grammarPassageTemplate(mode),
  ].join('\n\n');
}

function clean(value: unknown, maxLength = 1_000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function contextBlock(context: AdminBulkImportPromptContext) {
  const tags = Array.isArray(context.tags) ? context.tags.join(', ') : context.tags;
  const rows = [
    ['Tên bài/bộ dữ liệu', clean(context.title, 200)],
    ['Lớp', clean(context.grade, 120)],
    ['Môn/chủ đề', clean(context.subject, 200)],
    ['Topic', clean(context.topic, 200)],
    ['Tags', clean(tags, 300)],
    ['Mô tả/yêu cầu', clean(context.description, 1_000)],
  ].filter(([, value]) => value);

  if (!rows.length) return 'NGỮ CẢNH: Chưa có thông tin bổ sung.';
  return ['NGỮ CẢNH:', ...rows.map(([label, value]) => `- ${label}: ${value}`)].join('\n');
}

const rawOutputRules = [
  'Chỉ trả về dữ liệu để dán trực tiếp vào ô nhập nhanh.',
  'Không viết lời mở đầu, kết luận, nhận xét hoặc hướng dẫn.',
  copyableOutputRule('text'),
  'Không chuyển dữ liệu thành JSON hoặc bảng Markdown.',
  'Không thêm tiêu đề, số thứ tự, bullet hoặc ID kỹ thuật.',
].join('\n- ');

export function buildVocabularyBulkImportPrompt(context: AdminBulkImportPromptContext = {}) {
  return [
    'Bạn đang tạo dữ liệu cho khu vực “Nhập nhanh từ vựng nhiều dòng”.',
    contextBlock(context),
    'Hãy tạo một danh sách từ vựng tiếng Anh phù hợp với ngữ cảnh trên.',
    'Mỗi từ phải nằm trên đúng một dòng và có đúng bốn cột theo thứ tự:',
    'word | meaning | ipa | partOfSpeech',
    'QUY TẮC BẮT BUỘC:',
    `- ${rawOutputRules}`,
    '- Tối đa 500 dòng; không chèn dòng trống giữa các từ.',
    '- word là từ hoặc cụm từ tiếng Anh; meaning là nghĩa tiếng Việt ngắn gọn.',
    '- ipa phải là phiên âm IPA nằm giữa hai dấu /; partOfSpeech dùng nhãn tiếng Anh như noun, verb, adjective, adverb hoặc phrase.',
    '- Không được dùng ký tự | bên trong bất kỳ cột dữ liệu nào.',
    '- Không để trống cột nào và không thêm ví dụ câu.',
    'Ví dụ cấu trúc duy nhất: traffic | giao thông | /ˈtræfɪk/ | noun',
    'CHỈ TRẢ VỀ MỘT KHUNG MÃ CHỨA DỮ LIỆU THEO ĐÚNG MẪU, KHÔNG THÊM NỘI DUNG BÊN NGOÀI KHUNG.',
  ].join('\n\n');
}

export function buildMultipleChoiceGrammarBulkImportPrompt(context: AdminBulkImportPromptContext = {}) {
  return [
    'Bạn đang tạo dữ liệu cho khu vực “Nhập nhanh nhiều câu hỏi” của bài ngữ pháp trắc nghiệm.',
    contextBlock(context),
    'Hãy tạo một bộ câu hỏi ngữ pháp phù hợp với ngữ cảnh trên.',
    'Mỗi câu phải có đúng cấu trúc sau, giữ nguyên tên trường:',
    'QUESTION: nội dung câu hỏi\nA: lựa chọn A\nB: lựa chọn B\nC: lựa chọn C nếu cần\nD: lựa chọn D nếu cần\nANSWER: B\nEXPLANATION: lời giải thích ngắn gọn bằng tiếng Việt',
    'QUY TẮC BẮT BUỘC:',
    `- ${rawOutputRules}`,
    '- Mỗi câu có từ 2 đến 4 lựa chọn; QUESTION, A, B, ANSWER và EXPLANATION là bắt buộc.',
    '- C và D là tùy chọn; nếu có D thì bắt buộc phải có C.',
    '- ANSWER chỉ là đúng một chữ cái in hoa A, B, C hoặc D tương ứng với lựa chọn đúng.',
    '- Các lựa chọn trong cùng một câu phải khác nhau và chỉ có một đáp án đúng.',
    '- EXPLANATION nằm trên một dòng, giải thích vì sao đáp án đúng.',
    '- Giữa hai câu có đúng một dòng trống; không có dòng trống bên trong một câu.',
    'CHỈ TRẢ VỀ MỘT KHUNG MÃ CHỨA DỮ LIỆU THEO ĐÚNG MẪU, KHÔNG THÊM NỘI DUNG BÊN NGOÀI KHUNG.',
  ].join('\n\n');
}

export function buildRewriteGrammarBulkImportPrompt(context: AdminBulkImportPromptContext = {}) {
  return [
    'Bạn đang tạo dữ liệu cho khu vực “Nhập nhanh nhiều câu hỏi” của bài tự luận dạng trả lời văn bản.',
    contextBlock(context),
    'Hãy tạo một bộ câu hỏi có đáp án xác định, phù hợp để chấm bằng so khớp ANSWER và các biến thể ACCEPTED.',
    'Mỗi câu phải có cấu trúc sau, giữ nguyên tên trường:',
    'QUESTION: nội dung câu hỏi\nANSWER: đáp án chính xác\nACCEPTED: đáp án thay thế thứ nhất\nđáp án thay thế thứ hai\nEXPLANATION: lời giải thích ngắn gọn bằng tiếng Việt',
    'QUY TẮC BẮT BUỘC:',
    `- ${rawOutputRules}`,
    '- QUESTION, ANSWER và EXPLANATION là bắt buộc; ACCEPTED là tùy chọn.',
    '- Nếu không có đáp án thay thế thì bỏ toàn bộ trường ACCEPTED.',
    '- Nếu có ACCEPTED, viết đáp án thay thế đầu tiên sau “ACCEPTED:” và mỗi đáp án tiếp theo trên một dòng riêng, không lặp lại ANSWER.',
    '- Chỉ tạo câu có đáp án khách quan, xác định; không tạo đề bài luận mở hoặc câu cần giáo viên đánh giá ý nghĩa.',
    '- ANSWER và mỗi ACCEPTED phải là nội dung có thể dán trực tiếp để hệ thống so khớp.',
    '- EXPLANATION nằm trên một dòng.',
    '- Giữa hai câu có đúng một dòng trống; không có dòng trống bên trong một câu.',
    'CHỈ TRẢ VỀ MỘT KHUNG MÃ CHỨA DỮ LIỆU THEO ĐÚNG MẪU, KHÔNG THÊM NỘI DUNG BÊN NGOÀI KHUNG.',
  ].join('\n\n');
}
