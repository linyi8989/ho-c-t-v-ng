# Chữ in sẵn quanh ô trả lời Listening Part 2

Phạm vi: **Starters, Movers và Flyers Listening Part 2**. Reading & Writing,
KET/PET/FCE/IELTS, audio và cách chấm điểm giữ nguyên.

Phần chữ in sẵn không đổi cách chấm. Nâng cấp cách nhập tương đương riêng
được mô tả trong [young-listening-input-variants.md](young-listening-input-variants.md).

## Soạn và nhập dữ liệu

Các prompt sao chép cho ChatGPT và prompt xử lý ảnh yêu cầu tách nhãn câu hỏi
khỏi chữ/số đã in sẵn quanh ô trống:

```json
{
  "prompt": "Address:",
  "answerPrefix": "17",
  "answerSuffix": "Street"
}
```

Với đáp án chính thức `Green`, học sinh thấy `Address: 17 [ô nhập] Street` và
chỉ nhập `Green`. `acceptedAnswers` (Movers) hoặc
`answerKey.acceptedAnswers` (Universal Import Starters/Flyers) chỉ chứa phần
còn thiếu. Giữ nguyên envelope JSON đang dùng; đoạn trên là các trường của
một câu hỏi, không phải một đề hoàn chỉnh.

- `answerPrefix`: văn bản một dòng, tối đa 20 ký tự; `answerSuffix`: tối đa 80.
- Không có chữ in sẵn thì dùng chuỗi rỗng hoặc bỏ trường. Không tự suy luận
  gợi ý từ đáp án, audio hay transcript.
- Form soạn Part 2 cho sửa chữ trước/sau ô và đáp án riêng.
- JSON sai kiểu, quá dài hoặc mâu thuẫn với chữ đã có quanh marker phải được
  sửa trước khi nhập. Import lỗi không ghi đè bài đang soạn.
- Với Starters/Flyers, nhập lại JSON không có gợi ý sẽ bỏ metadata gợi ý cũ
  của câu thay thế, tránh mang chữ của câu trước sang câu mới.

## Tương thích và dữ liệu

Movers tiếp tục lưu chữ và marker `{{blankId}}` trong `prompt` hiện có.
Hai trường nhập bổ sung được ghép vào prompt này; không thay schema, ID ô,
published version, SQL hoặc grader. Màn review/History tiếp tục dùng snapshot
của phiên bản đã làm. Đề nhiều ô cũ giữ đủ marker và thứ tự chữ giữa các ô.

Starters/Flyers dùng hai trường optional sẵn có trên `ExamQuestion` và chuyển
chúng sang bố cục ô nhập dùng chung khi hiển thị. Đề cũ đã có
`Address: 17 ____ Street` hoặc marker tương đương vẫn đọc được; không tự
rewrite dữ liệu đã lưu. Khi không có marker xác định vị trí, hệ thống không
đoán rằng những từ trong nhãn là gợi ý.

Nếu một đề cũ chỉ lưu `Address: 17 Street` mà đã mất vị trí ô trống, giáo viên
cần sửa nhãn/chữ trước/sau ô hoặc nhập lại bằng prompt mới, rồi lưu và xuất
bản. Các lượt làm cũ không bị thay đổi.

## Kiểm tra và triển khai

Regression nằm trong `youngListeningPart2Import.test.ts`,
`part2TextLayout.test.ts`, `youngListeningHints.test.ts`, các test external
parameters/provider/Movers grader. Chạy `test:listening`, `test:exam-platform`,
typecheck và build; API test dùng database tạm, không gọi AI thật.

Deploy cả client build và `dist/server.cjs`, sau đó restart Node/Passenger.
Rollback bằng source/build tương ứng sau khi giữ lại các thay đổi mới hơn;
không cần migration, xóa hoặc chuyển đổi dữ liệu.
