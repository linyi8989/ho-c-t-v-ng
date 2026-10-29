# Giải thích đáp án Reading — 2026-10-29

Phạm vi: KET `reading-writing` (chỉ câu có đáp án cố định, không áp dụng bài viết dài Part 9), PET `reading`, FCE `reading` và `reading-use-of-english` cũ, IELTS `academic-reading`. Listening và Writing giữ nguyên prompt, JSON và quy trình chấm hiện có; PET Writing Part 1 cũng nằm ngoài phạm vi.

## Sử dụng

1. Mở đúng kho Reading, sao chép prompt toàn đề hoặc prompt riêng Part mới.
2. ChatGPT trả thêm chuỗi `explanation` trong từng question, cùng cấp với `answerKey`. Đây là phần giải thích AI xây dựng, bằng tiếng Việt, thường 2–4 câu dựa trên dẫn chứng bài đọc/ngữ pháp/từ vựng. Khóa đáp án và nội dung nguồn vẫn tuân thủ quy tắc nhập hiện tại. Thiếu căn cứ hoặc chưa xác nhận đáp án thì để chuỗi trống để giáo viên kiểm tra; không bịa dẫn chứng.
3. Dán JSON như trước. Trong mỗi Part, khối **Giải thích đáp án** nằm sau phần soạn câu hỏi, liệt kê số câu và nội dung để giáo viên sửa từng lời giải. Tối đa 4.000 ký tự; giữ xuống dòng. Lưu nháp và xuất bản theo quy trình hiện tại.
4. Khi được phép xem đáp án sau khi hoàn thành, học sinh thấy lời giải dưới câu/đáp án. Với bảng điền, nối đáp án hoặc ô trống nhỏ, lời giải có số câu nằm dưới nhóm bài để giữ bố cục. Câu đúng, sai và bỏ trống đều được xem lời giải nếu có; trường trống không tạo khung rỗng. Lịch sử hiển thị dưới đáp án đúng.

Ví dụ một question trong cấu trúc JSON hiện có:

```json
{
  "questionNumber": 1,
  "prompt": "She ___ to school every day.",
  "options": [
    {"label": "A", "text": "go"},
    {"label": "B", "text": "goes"},
    {"label": "C", "text": "going"}
  ],
  "answerSource": "official-answer-key",
  "answerKey": {"correctOptionLabels": ["B"]},
  "explanation": "“Every day” diễn tả thói quen nên dùng thì hiện tại đơn. Chủ ngữ “She” là ngôi thứ ba số ít, vì vậy “go” đổi thành “goes”."
}
```

Đây là ví dụ trường mới, không thay thế envelope/Part/block đặc thù của từng kho.

## Tương thích và bảo vệ đáp án

- Trường mới là tùy chọn. JSON và đề cũ vẫn nhập/chơi/chấm bình thường; không đổi schema version hoặc tạo bảng SQL.
- Nhập JSON thay thế lấy lời giải mới từ chính câu được nhập, không kế thừa lời giải cũ theo vị trí. Nếu JSON mới bỏ lời giải đã có, importer xóa lời giải cũ trong Part được thay và báo cảnh báo. Các Part khác không bị sửa. Mở/lưu nháp bình thường giữ nguyên lời giải.
- Các giá trị không phải chuỗi hoặc vượt giới hạn bị chặn khi nhập/xuất bản. Nháp chưa hợp lệ vẫn có thể lưu; màn soạn báo trường sai và cho nhập lại thay vì gây lỗi trang.
- `explanation` là dữ liệu riêng của giáo viên trước khi nộp. Backend xóa khỏi playable, prepare và các API công khai. Review/History tiếp tục kiểm tra chủ lượt làm, run secret và `showReviewAfterSubmit`.
- Grader sao chép lời giải từ immutable version vào `exam_attempt_details.questions` tại lúc nộp; không thay cách tính điểm. Lời giải không đổi theo lần sửa/xuất bản đề về sau. Lượt làm cũ không được tự bổ sung hoặc viết lại.
- Không gọi AI khi học sinh mở kết quả. Không đổi cấu hình provider/chấm Writing, không gửi tài liệu tới AI trong kiểm thử.

## Kiểm chứng và vận hành

- `npm run test:exam-platform`: kiểm thử import/prompt mới, JSON cũ, dữ liệu sai, chấm điểm, phạm vi, bảo mật và snapshot. Prompt Listening/Writing toàn bài/từng Part và KET Part 9 được đối chiếu SHA256 với nội dung trước nâng cấp.
- `npm run test:phase2`: 456 tests pass, zero failures; gồm typecheck, build, startup, History/legacy, 191 exam-platform tests. Backend Reading mới còn được chạy trên bản sao native SQLite/WAL có cùng 58 bảng với local. 73 kiểm tra render thật xác nhận các Part, trường rỗng, escape HTML, nháp sai kiểu, không dùng lời giải từ playable và không hiển thị lặp.
- Browser fixture dùng component, parser, sanitizer và grader thật, API ghi bộ nhớ tạm; không ghi kho đề/database của người dùng. Đã xác nhận nhập JSON vào form KET, sửa/lưu lời giải, chuyển Part, loại Part viết dài và không hiển thị lời giải khi đang làm bài. Kiểm tra trực quan kết quả desktop/mobile và computed contrast chưa hoàn tất: công cụ Computer Use dừng vì không xác định URL trình duyệt đủ chắc chắn. Không xem các kiểm tra render tự động là thay thế phần này.
- Bằng chứng/log/bản sao trước sửa: `.data/reading-explanations-qa/`. 58/58 bảng local giữ nguyên fingerprint sau kiểm thử. Chưa commit/push/deploy.
- Deploy cần client build mới, `dist/server.cjs` mới và restart Node theo `quytac.md`. Hoàn tác source của tính năng này sau khi bảo vệ thay đổi mới hơn rồi build lại; giữ nguyên database, phiên bản đề và attempt. Bản cũ bỏ qua trường JSON mới, không cần khôi phục DB.
