export const CHATGPT_COPYABLE_JSON_OUTPUT_INSTRUCTION = [
  'ĐỊNH DẠNG PHẢN HỒI CÓ NÚT COPY',
  '- Toàn bộ câu trả lời phải nằm trong đúng MỘT khối mã Markdown có nhãn json: mở bằng ```json và đóng bằng ```.',
  '- Không viết tiêu đề, lời dẫn, nhận xét hoặc bất kỳ ký tự nào bên ngoài khối mã.',
  '- Bên trong khối mã chỉ chứa đúng một JSON object hợp lệ theo schema đã yêu cầu; không thêm comment và không dùng dấu phẩy thừa.',
  '- Kết quả trả về phải đặt trong khung mã có nút Copy của ChatGPT để thuận tiện sao chép dữ liệu và dán trực tiếp vào ô nhập JSON của Kho đề luyện thi; không tạo nút Copy bằng HTML hoặc chèn nút vào dữ liệu JSON.',
].join('\n');

export function withChatGptJsonCopyBlock(prompt: string) {
  return `${prompt.trim()}\n\n${CHATGPT_COPYABLE_JSON_OUTPUT_INSTRUCTION}`;
}
