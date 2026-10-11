# Sửa lỗi nhập nhanh Ngữ pháp (2026-10-11)

Yêu cầu: nhận đủ các câu khi nội dung dán thiếu dòng trống hoặc bị dồn dòng, giữ đúng câu hỏi/đáp án/lời giải và không ghi đè câu khác. Áp dụng cho trắc nghiệm và tự luận trong GrammarEditorPanel. Mẫu trong ảnh là văn bản có nhãn QUESTION:, không phải JSON.

## Nguyên nhân và phạm vi

Luồng: textarea → grammarBulkText (giữ nguyên chuỗi) → handleParseGrammarBulk → parser → grammarQuestions → nút Lưu → API quản trị → normalize/validate → SQLite. Parser cũ tách theo dòng trống rồi ghi các nhãn vào cùng một object. Hai câu không có dòng trống thành một block, câu sau ghi đè câu trước; dồn tất cả nhãn trên cùng dòng làm thiếu trường. Bộ parser dùng chung mới tách theo QUESTION:. Không thay đổi API, schema, auth, grader, publish hay cơ chế nháp.

Không có xử lý paste trong ô này để xóa xuống dòng. Bằng chứng xác định lỗi tách câu, chưa xác định được ứng dụng/nguồn clipboard bên ngoài đã làm mất dòng. Khắc phục việc nhập trong các trường hợp tái hiện, không tuyên bố sửa công cụ sao chép bên ngoài.

## Checklist

- [x] Đọc quy tắc, code map, source/type, form, handler, API/validation, test và lịch sử; giữ mọi thay đổi có sẵn.
- [x] Lưu source hiện tại và online backup vào .data/grammar-bulk-qa; kiểm thử bằng database riêng.
- [x] Tái hiện baseline: 2 câu có dòng trống → 2; không dòng trống → chỉ câu cuối; một dòng/CR → 0.
- [x] Tách bản ghi theo QUESTION:, không phụ thuộc dòng trống; giữ đoạn trống trong lời giải.
- [x] Chuẩn hóa CRLF/CR/NEL/Unicode separator, BOM và escaped newline ngay trước nhãn; giữ dấu backslash trong nội dung.
- [x] Phục hồi nhãn dồn dòng khi xác định được ANSWER/EXPLANATION; cảnh báo xem lại bảng trước khi lưu. Nhãn đầu dòng là cú pháp của mẫu, không đoán hoặc dịch nội dung.
- [x] Báo nhãn lặp/thiếu trường/đáp án không hợp lệ theo câu; không ghi đè âm thầm; vẫn nhập các câu hợp lệ khác.
- [x] Giữ nguyên đầu vào và nháp; cập nhật hướng dẫn, tên truy cập và liên kết trợ giúp của textarea.
- [x] 26 regression parser + các test grammar/admin/service/attempts/draft: tổng 64 PASS; TypeScript PASS.
- [x] 11 browser checks PASS: thiếu dòng trống, dồn dòng, malformed/duplicate/JSON, raw source + rows khôi phục sau reload, lưu/đọc lại API thật, auth/validation, rewrite alternatives, desktop/mobile/focus. Ảnh đã xem.
- [x] Canonical build PASS; 122 đường dẫn/bytes/SHA-256 trong manifest khớp; parser/hướng dẫn có trong AdminDashboard-tzwOryMA.js.
- [x] Native production startup smoke PASS: thiếu DB không tự tạo, integrity/WAL/diagnostics, đóng/mở lại.
- [x] Local 127.0.0.1:3000 trả 200 và phục vụ parser mới. Không có bài ngữ pháp QA nào ghi vào DB chính.
- [x] Rà soát diff theo source đã sao lưu, diff --check; dừng QA 3180 sau kiểm thử.

## Kết quả và giới hạn

122 manifest files, release id 1cff729116c353906e46047927c141aaf0c9567740de0b45e49d14db5862b9d9. Server không thay đổi: 1644314 bytes, SHA-256 d0901939695a641bbf7414d297f45ed24c2a71f825b94e0b61080863054856f2.

DB chính vẫn quick_check=ok. 54/58 bảng giữ nguyên fingerprint; 4 bảng attempt/version ở module thi và IOE thêm mỗi bảng 1 dòng trong lúc local đang được sử dụng. So sánh với snapshot xác nhận các dòng cũ ở 4 bảng đó không đổi; bảng ngữ pháp/từ vựng không đổi. Không khôi phục/ghi đè các hoạt động đồng thời này.

Bằng chứng: .data/grammar-bulk-qa/{baseline.json,baseline-tests.log,parser-tests.log,typecheck.log,test-final.log,browser.log,browser-report.json,screenshots,build.log,startup.log,artifact.json,data-after.json,data-changes-diagnostic.json,before}. Browser smoke: scripts/grammar-bulk-browser-smoke.mjs, chạy trên fixture riêng tại loopback 3180; script chặn cổng 3000 và host ngoài máy.

Chưa push/deploy. Khi đưa lên host, dùng client dist/client và release manifest từ cùng build, theo quy trình deploy hiện có. Hoàn tác chỉ các thay đổi parser/form/test của bước này từ before, giữ autosave/maintenance và mọi sửa khác, rồi build chuẩn; không phục hồi DB chính từ fixture QA.
