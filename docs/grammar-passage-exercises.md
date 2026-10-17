# Bài kéo thả điền từ và đọc hiểu trong Grammar

## Cách soạn bài

1. Mở **Soạn bài ngữ pháp**, chọn **Dạng bài**: **Kéo thả điền từ** hoặc **Đọc hiểu**.
2. Nhập tên, lớp, chủ đề hoặc yêu cầu vào phần mô tả. Bấm **Sao chép hướng dẫn … cho ChatGPT**; gửi hướng dẫn cùng ảnh/nội dung bài tập cho ChatGPT.
3. Dán JSON ChatGPT trả về vào ô nhập nhanh, bấm **Ghép dữ liệu vào bảng câu hỏi**. Dữ liệu nhập sai không thay đổi nội dung đang soạn. Nhập thay thế một bài đã có nội dung sẽ hỏi trước khi thay.
4. Kiểm tra và sửa trực tiếp hướng dẫn, đoạn văn, ngân hàng từ, từng câu/ô và đáp án. Bấm **Xem trước và thử làm như học sinh** để thử tương tác; xem trước không tạo lượt làm, điểm hay History.
5. Bấm **Lưu bài ngữ pháp**. Các thao tác công khai/link riêng, sửa, sao chép, kết quả và lưu trữ tiếp tục dùng kho Grammar hiện có. Sao chép tạo bài nháp với đầy đủ nội dung.

Mọi trường mới được lưu trong bản nháp thiết bị. Sau khi tải lại, có thể **Khôi phục** hoặc **Khôi phục thành bài mới** như bài Grammar cũ. Nháp cũ chưa có các trường mới vẫn khôi phục theo dạng thường.

## Kéo thả điền từ

- Khay thẻ từ nằm **trên**; đoạn văn nằm **dưới** và các ô trống nằm ngay trong câu. Khay xuống dòng theo chiều rộng màn hình.
- Dùng `[[1]]`, `[[2]]`… để đặt ô trong đoạn văn. Mỗi số ô xuất hiện một lần và có đúng một dòng đáp án tương ứng. Không đảo thứ tự câu/ô khi làm bài.
- Bấm **Thêm câu** để tạo một ô mới; marker được thêm vào cuối đoạn văn và có thể chuyển tới vị trí mong muốn. Xóa ô trong bảng cũng xóa marker tương ứng. Sau khi sửa số ô hoặc nội dung đoạn văn, kiểm tra lại các marker trước khi lưu.
- Ngân hàng từ có thể chứa từ nhiễu. **Thêm thẻ từ / từ nhiễu** không thêm câu chấm điểm. Không bắt buộc số từ nhiễu là 1 hay 2.
- Mỗi thẻ dùng một lần. Nếu cần dùng một từ hai lần, tạo hai thẻ giống nhau và gán riêng cho hai ô. Thẻ có cùng nội dung chuẩn hóa được chấm tương đương; ID kỹ thuật không hiển thị cho học sinh.
- Học sinh có thể kéo thả, chọn từ rồi chọn ô, chọn từ đã đặt rồi chọn ô khác. Kéo thẻ đã đặt về khay hoặc dùng phím Delete/Backspace ở ô để gỡ. Nút/ô có thể dùng Tab và Enter/Space. Theo yêu cầu ngày 17/10/2026, ô đã điền không có nút × bên cạnh.
- Một lần chuyển/gỡ lưu toàn bộ vị trí thẻ trong cùng một bản cập nhật. Trong lúc lưu, các thao tác tiếp theo tạm khóa; lỗi mạng giữ thay đổi để **Thử lưu lại**, kể cả sau khi tải lại trang trong cùng tab.
- Mỗi ô là một câu chấm điểm. Mặc định chỉ hiện đúng/sai sau khi nộp để học sinh có thể đổi vị trí tự do. Giải thích và đáp án sau nộp tuân theo tùy chọn xem lại của bài.

JSON minh họa, số lượng chỉ là ví dụ:

```json
{
  "format": "grammar-passage-v1",
  "mode": "passage_drag_drop",
  "instruction": "Put a word in each gap to complete the passage.",
  "passage": "They [[1]] to school. The lesson [[2]] at eight.",
  "wordBank": ["begins", "go", "off"],
  "answers": [
    { "blank": 1, "answer": "go", "explanation": "They đi với go." },
    { "blank": 2, "answer": "begins", "explanation": "The lesson là chủ ngữ số ít." }
  ]
}
```

## Đọc hiểu

- Bài đọc chung nằm **trên**; toàn bộ câu hỏi và lựa chọn xếp **dưới**, cả trên máy tính và điện thoại.
- Mỗi câu có số lựa chọn riêng. Form hỗ trợ thêm/xóa lựa chọn. `answer` trong JSON là vị trí đáp án đúng tính từ **1**, không phải ID và không phải nhãn A/B/C.
- Khi hệ thống nhập dữ liệu, ứng dụng tạo ID riêng; lưu/chấm theo ID nên trộn lựa chọn không làm sai đáp án. Số nhãn tiếp tục A…Z, AA, AB… khi cần.
- Nếu bật giải thích sau từng câu, câu đã trả lời được khóa và giữ phản hồi khi tiếp tục bài sau tải lại. Nếu tắt, học sinh được đổi đáp án trước khi nộp.

```json
{
  "format": "grammar-passage-v1",
  "mode": "reading_comprehension",
  "instruction": "Read the passage and choose the correct answer.",
  "passage": "Volunteers help people. They also make new friends.",
  "questions": [
    {
      "question": "What can volunteers do?",
      "options": ["Make new friends.", "Always earn money.", "Never meet people."],
      "answer": 1,
      "explanation": "Đoạn văn nói người tình nguyện có thêm bạn mới."
    }
  ]
}
```

## Số lượng, tiếp tục bài và tương thích

- Không cắt danh sách theo số lượng của ảnh mẫu: số câu, ô trống, từ nhiễu và lựa chọn theo dữ liệu hợp lệ. Đã kiểm tra 11 ô với 13 thẻ, 13 câu đọc hiểu trong unit test, và 9 câu với một câu có 28 lựa chọn qua API/UI thật.
- Vẫn áp dụng giới hạn dung lượng request của ứng dụng; đoạn văn tối đa 100.000 ký tự, hướng dẫn/câu hỏi tối đa 4.000, lựa chọn/thẻ từ tối đa 1.000, lời giải tối đa 6.000 ký tự. Vượt giới hạn được báo lỗi, không cắt âm thầm. JSON dùng `\n` để xuống dòng trong chuỗi.
- Lượt làm và đáp án lưu phía server; thông tin tiếp tục bài và thay đổi chưa xác nhận lưu trong sessionStorage theo lượt làm. Sau reload trong cùng tab, bấm **Tiếp tục bài đang làm**. Không hứa phục hồi tự động sau đóng tab/xóa bộ nhớ hoặc trên thiết bị khác.
- Đoạn văn, ngân hàng từ và câu hỏi được chụp vào lượt làm; sửa bài sau đó không đổi nội dung của lượt đã bắt đầu. Chính sách xem lại cũng được giữ theo lượt làm đối với hai dạng mới.
- History dùng chung renderer xem lại, hiển thị từ thực tế thay vì token ID. Khi không cho xem đáp án sau nộp, toàn bộ snapshot review mới bị loại khỏi response History.
- Trắc nghiệm thường và tự luận vẫn dùng định dạng nhập và giao diện cũ. Dữ liệu thiếu `displayMode` được đọc như `standard`. Không thêm bảng hoặc chạy migration; lưu trường bổ sung trong JSON hiện có.

## Phạm vi mã nguồn

- `src/lib/grammarPassages.ts`, `grammarPassageImport.ts`: contract, marker, nhãn động, JSON version 1, validation; ID do ứng dụng sinh.
- `adminBulkImportPrompts.ts`, `AdminDashboard.tsx`, `GrammarEditorPanel.tsx`, `GrammarPassageEditor.tsx`: hướng dẫn ChatGPT, form, preview, draft và CRUD.
- `GrammarPassageView.tsx`, `GrammarPassageRun.tsx`, `grammarPassageRecovery.ts`, `GrammarPassage.css`: renderer dùng chung, lưu/khôi phục, tương tác và CSS theo feature root.
- `src/server/grammar/passageExercises.ts`, `server.ts`, `src/server/grammar-attempts/service.ts`: chuẩn hóa, snapshot, quyền, chấm điểm, revision/idempotency và tuần tự hóa các cập nhật/lần nộp trong tiến trình ứng dụng hiện tại.
- Projector/normalizer History và `HistoryDetailModal.tsx`: đáp án đọc được, snapshot đầy đủ và chính sách bảo mật. Summary kho quản trị bổ sung `displayMode` qua JSON extraction, không mở rộng schema SQL.

## Kiểm chứng và hoàn tác

QA dùng bản sao SQLite tại `.data/grammar-passages-qa/fixture`, cổng loopback 3187; không ghi bài thử vào database chính. Backup kiểm tra `quick_check=ok` trước QA nằm trong `.data/grammar-passages-qa/before`.

- `npm run test:grammar`: parser/chấm/di chuyển/clear/retry/revision/quyền/History; có kiểm thử hồi quy định dạng cũ.
- `npm run test:phase2`: TypeScript, security, performance, identity, Grammar/admin, vocabulary, Reading/Exam, storage, build, native startup, admin-data, History và legacy API.
- `npm run test:server-domains`: các router/service domain, bao gồm Grammar CRUD và lượt làm.
- `scripts/grammar-passages-api-smoke.ts`: API thật với private share, clone, số lượng động, ownership, snapshot, History, immediate feedback và review denial.
- `scripts/grammar-passages-browser-smoke.mjs`: form thật, preview/khôi phục, desktop/mobile 1440/390/320px, chuột/chạm/bàn phím, mất mạng/reload/retry, feedback khóa và History. Ảnh chụp và computed contrast trong `.data/grammar-passages-qa`.

Chưa commit/push/deploy. Khi hoàn tác, chỉ hoàn tác source thuộc tính năng này rồi build chuẩn; không phục hồi database chính bằng fixture QA và không sửa lịch sử cũ. Khóa cập nhật hiện dùng chung service trong tiến trình; nếu triển khai nhiều tiến trình ghi cùng một database, cần cơ chế compare-and-set/transaction ở storage trước khi mở rộng mô hình đó.

Kết quả ngày 17/10/2026: `test:phase2` **362 pass / 0 fail**, server domains **51 pass / 0 fail**. Sau sửa trường hợp tiếp tục bài khi giáo viên đổi dạng, TypeScript/build cuối và **20** regression Grammar/attempt/compiled legacy pass. API và 8 nhóm kiểm tra browser thật đều pass, không runtime exception; đã xem ảnh desktop/mobile/review/History. **126** file manifest khớp bytes/SHA-256; main SQLite **58/58** bảng giữ nguyên fingerprint và `quick_check=ok`. Báo cáo: `quality-gates-final.log`, `final-build.log`, `final-startup.log`, `final-regressions.log`, `api-report.json`, `browser-report.json`, `artifact-report.json` trong thư mục bằng chứng nêu trên.
