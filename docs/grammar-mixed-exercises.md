# Bộ Ngữ pháp nhiều dạng trong một link

## Phạm vi và cách sử dụng

Một bộ Ngữ pháp có thể chứa nhiều nhóm trắc nghiệm, kéo thả điền từ và đọc hiểu theo thứ tự giáo viên sắp xếp. Học sinh mở một link, cuộn làm bài trong cùng một trang và nộp một lần. Mỗi nhóm có thể có tiêu đề/hướng dẫn riêng; không cần chia thành các trang Part.

- Trắc nghiệm: hiển thị đầy đủ câu hỏi và các lựa chọn.
- Kéo thả: khay từ ở trên, đoạn văn và ô trống trong câu ở dưới. Mỗi nhóm có khay từ riêng; các nhóm được phép dùng lại số ô `[[1]]`.
- Đọc hiểu: bài đọc ở trên, toàn bộ câu hỏi và lựa chọn ở dưới.
- Thời gian, số lần được làm, tiến độ và chính sách xem kết quả áp dụng cho cả bộ.
- Số nhóm, câu hỏi, lựa chọn và từ nhiễu lấy theo dữ liệu hợp lệ; không ép theo mẫu 8 ô, 6 câu hay 3/4 lựa chọn.

Trong phần soạn bài, thêm các nhóm cần dùng, sửa từng nhóm, nhân bản/xóa/đổi thứ tự rồi xem trước toàn bộ bằng giao diện học sinh. Các nhóm đã nhập được giữ khi thêm nhóm khác. Xem trước dùng trạng thái thử trong trình duyệt, không tạo lượt làm hoặc ghi History.

Prompt cho ChatGPT yêu cầu trả đúng một khung mã `json` để có nút Copy. Có thể nhập cả bộ hoặc bổ sung một nhóm; dữ liệu lỗi không thay nội dung đang soạn. Giáo viên vẫn xem và sửa trước khi lưu.

## Định dạng nhập

Định dạng mới là `grammar-mixed-v1`. JSON bên ngoài dùng nội dung, số ô và vị trí đáp án; ứng dụng tự tạo ID.

```json
{
  "format": "grammar-mixed-v1",
  "blocks": [
    {
      "type": "multiple_choice",
      "title": "Choose the correct answer",
      "instruction": "Choose one answer for each question.",
      "questions": [
        {
          "question": "She ___ to school every day.",
          "options": ["go", "goes", "going"],
          "answer": 2,
          "explanation": "She là chủ ngữ số ít nên dùng goes."
        }
      ]
    },
    {
      "type": "passage_drag_drop",
      "title": "Complete the passage",
      "instruction": "Move one word into each gap.",
      "passage": "They [[1]] to school. The lesson [[2]] at eight.",
      "wordBank": ["begins", "go", "off"],
      "answers": [
        { "blank": 1, "answer": "go", "explanation": "They đi với go." },
        { "blank": 2, "answer": "begins", "explanation": "The lesson là chủ ngữ số ít." }
      ]
    },
    {
      "type": "reading_comprehension",
      "title": "Read and answer",
      "instruction": "Read the passage, then choose.",
      "passage": "Volunteers help people. They also make new friends.",
      "questions": [
        {
          "question": "What can volunteers do?",
          "options": ["Make friends.", "Never meet people."],
          "answer": 1,
          "explanation": "Bài đọc nói tình nguyện giúp có thêm bạn."
        }
      ]
    }
  ]
}
```

`answer` của câu lựa chọn là vị trí tính từ 1 trong `options`. `blank` là số đánh dấu trong đoạn văn của chính nhóm đó. Thẻ từ được dùng một lần trong mỗi nhóm; cần lặp từ trong `wordBank` nếu nhiều ô của cùng nhóm dùng cùng từ.

## Dữ liệu và tương thích

- Bộ mới dùng `displayMode: mixed`, `contentVersion: 2`, `blocks[]` và một danh sách `questions[]` chính. Mỗi nhóm tham chiếu câu hỏi bằng `questionIds`; mỗi câu ghi `blockId`.
- Trật tự học sinh là thứ tự nhóm rồi thứ tự câu trong nhóm. Xáo trộn lựa chọn vẫn nằm trong câu/ngân hàng từ tương ứng; không tách câu đọc hiểu khỏi bài đọc hoặc trộn khay từ giữa các nhóm.
- Dữ liệu nằm trong các cột JSON sẵn có của `grammar_sets`, `grammar_attempts` và detail History. Không cần bảng/migration mới.
- Bộ cũ chưa dùng phiên bản mới giữ ba luồng hiện tại và link hiện tại. Không tự chuyển đổi hoặc viết lại dữ liệu hàng loạt.
- Chuyển bộ cũ sang nhiều dạng là thao tác soạn có chủ đích; nội dung cũ trở thành nhóm đầu tiên và ID/link bộ đề được giữ khi lưu.
- Định dạng `grammar-passage-v1` và văn bản trắc nghiệm cũ vẫn được nhận diện. Bài tự luận giữ luồng riêng hiện tại.

## Lượt làm và bảo mật đáp án

Một lượt làm chụp `blocksSnapshot[]`, câu hỏi, khay từ, lựa chọn và chính sách xem kết quả khi bắt đầu. Sửa đề hoặc đổi dạng sau đó không thay nội dung lượt đang làm/kết quả cũ.

Mixed dùng revision và mutation ID cho lưu đáp án. Lưu khay từ gửi `blockId` cùng mapping đầy đủ của riêng nhóm đó; backend kiểm tra câu hỏi/thẻ từ thuộc đúng nhóm và giữ đáp án mọi nhóm khác. MCQ/đọc hiểu vẫn chấm bằng option ID. Di chuyển/gỡ thẻ không làm mất đáp án trắc nghiệm hoặc khay khác. Retry với cùng mutation ID không thêm lượt hoặc cộng điểm lần hai.

Nếu bộ có nhóm kéo thả, xem đáp án ngay bị tắt cho cả lượt để việc di chuyển thẻ không lộ khóa đáp án. Chính sách xem kết quả sau nộp được chụp theo bộ. API học sinh trước nộp không trả khóa đáp án; History/review kiểm tra owner và run secret/capability theo contract hiện tại. Khi không cho xem đáp án, toàn bộ snapshot trực quan phải bị loại khỏi History, không chỉ xóa một vài trường.

Điểm tổng tính các câu trắc nghiệm, câu đọc hiểu và ô trống; thẻ nhiễu không được tính thành câu. Một lần nộp tạo một kết quả tổng và một dòng History, giữ cách quy đổi leaderboard hiện tại.

## Kiểm chứng và bằng chứng

QA chạy trên bản sao SQLite qua Native Online Backup API, port riêng `3188`, seed tắt. Các script từ chối port `3000` và host ngoài loopback; không gửi dữ liệu lên provider AI.

```powershell
$env:GRAMMAR_MIXED_QA_ORIGIN='http://127.0.0.1:3188'
node node_modules/tsx/dist/cli.mjs scripts/grammar-mixed-api-smoke.ts
node scripts/grammar-mixed-browser-smoke.mjs
```

Dùng Node 22 tương thích native SQLite của dự án. Trước khi chạy cần khởi động server test trên database đã sao chép và bật History bằng cấu hình local hiện có; không trỏ script vào database đang dùng học thật. Báo cáo và ảnh QA nằm dưới `.data/grammar-mixed-qa/`, được Git bỏ qua.

Checklist bàn giao:

- [x] Import/soạn/xem trước/nhân bản/đổi thứ tự/xóa nhóm và câu; phục hồi đầy đủ draft sau reload.
- [x] Bài trắc nghiệm → kéo thả A → đọc hiểu → kéo thả B trên một trang; hai nhóm đều có `[[1]]`.
- [x] Lưu, chuyển và gỡ từ ở A giữ nguyên MCQ/đọc hiểu/B; chặn câu hoặc token chéo nhóm.
- [x] Reload/resume/retry giữ đáp án và snapshot sau giáo viên sửa đề; một lần nộp/một kết quả/History.
- [x] Review bị tắt không lộ đáp án qua submit/review/History; quyền sở hữu không đổi.
- [x] Cả ba dạng cũ tiếp tục lưu/làm/chấm được; chuyển bài cũ có chủ đích giữ ID/link và lượt đang làm cũ.
- [x] Desktop/mobile 1440/390/320px, kéo thả/chạm/bàn phím, loading/disabled/error, focus và computed contrast.
- [x] Typecheck, test liên quan, canonical build/native startup, kiểm tra manifest/History và diff.
- [x] So sánh tất cả fingerprint bảng SQLite gốc với backup: 58/58 bảng giữ nguyên, `quick_check=ok`.

Kết quả ngày 24/10/2026: `test:phase2` 377 pass/0 fail; server domains 51 pass/0 fail; 8 regression backend nhiều dạng và 7 kiểm thử model/import mới nằm trong gate Grammar. API thật kiểm tra cả prepare/activate lẫn create-attempt trực tiếp, chuyển bộ cũ sang nhiều dạng giữ link/ID, immutable snapshot và một kết quả tổng. Browser thật đã xác minh soạn/preview/draft, desktop/mobile, thao tác và History, không runtime exception; tương phản các nút được lấy mẫu tối thiểu 11,15:1. Đã xem ảnh chụp. TypeScript/build cuối đạt, manifest 126 file khớp kích thước/SHA-256 và giữ nút History. Báo cáo nằm trong `.data/grammar-mixed-qa/{quality-gates.log,server-domains.log,api-report.json,browser-report.json,artifact-report.json,main-comparison-report.json}`; ảnh trong `screenshots/`. Không gọi provider AI, không commit/push/deploy.

## Rollback

Giữ database hiện tại, WAL, lượt làm và History; không phục hồi backup đè dữ liệu người dùng. Khi cần rollback, bảo toàn thay đổi mới hơn, chỉ hoàn nguyên source của tính năng và build lại bằng script chuẩn. Phiên bản cũ chưa hiểu mixed không nên được dùng để chỉnh/làm bộ mixed đã lưu; cần giữ phiên bản có adapter mixed để đọc những bộ/lượt mới đó. Backup dùng để điều tra/phục hồi có kiểm soát, không phải thao tác rollback thường ngày.
