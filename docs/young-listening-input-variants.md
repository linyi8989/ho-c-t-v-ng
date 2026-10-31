# Cách nhập tương đương cho Listening Part 2

Áp dụng riêng Starters, Movers và Flyers Listening Part 2. Giáo viên giữ đáp
án gốc từ tài liệu và có thêm danh sách cách nhập tương đương để chấm input.
Danh sách bổ sung không xuất hiện trong playable, prepare, đáp án kết quả hay
History. Câu trả lời thực tế mà học sinh đã nhập vẫn hiển thị bình thường.

## JSON và prompt

Universal Import của Starters/Flyers đặt trường trong `answerKey` của câu:

```json
{
  "questionNumber": 1,
  "prompt": "Years of tennis:",
  "type": "short-answer",
  "answerSource": "official-answer-key",
  "answerKey": {
    "acceptedAnswers": ["four"],
    "inputAnswerVariants": ["4", "four years", "4 years"]
  }
}
```

Movers external JSON đặt hai danh sách ở cùng hàng câu hỏi:

```json
{
  "questionNumber": 1,
  "prompt": "Years of tennis:",
  "acceptedAnswers": ["four"],
  "inputAnswerVariants": ["4", "four years", "4 years"]
}
```

Đây là một hàng dữ liệu; giữ nguyên envelope đề/Part đang dùng. Legacy
Starters v1 đặt trường bổ sung trong từng `gaps[]`; server Smart Import dùng
trường trên câu; provider Movers dùng `answers[].inputAnswerVariants`.

Các prompt tương ứng yêu cầu AI giữ nguyên đáp án gốc và chỉ gợi ý cách biểu
diễn cùng nghĩa sau khi xác minh đáp án. Cho phép số ↔ chữ, thêm/bỏ đơn vị
khi nhãn hoặc nội dung xác định rõ giá trị. Không tự tạo từ đồng nghĩa, tên
riêng, lỗi chính tả hoặc thay đổi mã/điện thoại có số 0 đầu. Với đơn vị đã in
sẵn quanh ô, có thể cho phép học sinh nhập lại đơn vị nếu không đổi nghĩa.
Không loại một biến thể đã được duyệt chỉ vì `maxWords` của đáp án gốc.

- `acceptedAnswers` vẫn là đáp án gốc/biến thể chính thức, dùng hiển thị.
- `inputAnswerVariants` là mảng optional, tối đa 20 chuỗi một dòng, mỗi chuỗi
  không rỗng và tối đa 200 ký tự. Dữ liệu sai bị chặn khi nhập/xuất bản.
- Không có biến thể an toàn thì dùng `[]` hoặc bỏ trường. Không có đáp án
  gốc đã xác minh thì không gắn các cách nhập bổ sung.
- Trong form soạn, sửa riêng ô “Cách nhập tương đương”, ngăn cách bằng `|`.
  Ô này giữ được dấu phân cách và khoảng trắng trong lúc gõ.
- Nhập lại câu với đáp án mới mà thiếu trường bổ sung sẽ bỏ biến thể cũ.
  Partial import Movers chưa xác định được đáp án vẫn giữ dữ liệu cũ theo
  cơ chế hiện có; không ghép biến thể mới vào đáp án cũ không cùng lượt nhập.

## Chấm và tương thích

Grader so sánh input với hợp của hai danh sách theo chuẩn hóa hiện có
(hoa/thường, khoảng trắng, dấu nháy). Không tự suy luận hay gọi AI khi chấm.
Ví dụ trên nhận cả `four`, `4`, `four years`, `4 years`; `five` vẫn sai.
Kết quả vẫn dùng `four` làm đáp án đúng, không liệt kê danh sách bổ sung.

Trường canonical là `ExamQuestion.inputAnswerVariants` cho Starters/Flyers,
`ListeningTextBlank.inputAnswerVariants` cho Movers. Đây là trường private
optional trong JSON hiện có, không cần SQL migration hoặc đổi envelope.
Đề/lượt làm cũ không bị rewrite hoặc tự chấm lại. Muốn áp dụng cho đề cũ,
nhập lại JSON bằng prompt mới hoặc bổ sung thủ công, lưu và xuất bản.

Nội dung có biến thể dùng grading version
`exam-platform-young-listening-input-variants-v1` hoặc
`listening-five-part-input-variants-v1`. Nội dung không có biến thể giữ
grading version cũ. Ticket đã bắt đầu dùng đúng immutable version ban đầu,
kể cả khi giáo viên sửa và xuất bản danh sách mới.

## Xác minh và triển khai

Các regression nằm trong `part2AnswerVariants.test.ts`,
`youngListeningInputVariantsImport.test.ts`,
`youngListeningInputVariants.test.ts` và test external/provider/Movers grader.
API test chỉ dùng database tạm/bản sao native và provider mock.

Deploy cả client và server build, restart Node/Passenger. Nếu cần tắt tính
năng khi rollback, vẫn giữ sanitizer loại trường private và reader tương
thích với version đã xuất bản; không quay lại server cũ chưa biết loại
trường này khỏi playable. Không xóa hoặc sửa hàng loạt published versions.
