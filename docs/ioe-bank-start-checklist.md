# IOE/Violympic: học trực tiếp từ bank — 2026-10-04

## Yêu cầu và chẩn đoán

- [x] Đọc quytac, source/API/type/selection/engine/tests, tài liệu và trạng thái Git.
- [x] Tái hiện bằng API thật: 30 câu Toán lớp 3 cấp trường, 30 distinct, ready=true; GET /papers trả 0 đề.
- [x] Xác nhận: kho chung theo môn/lớp/cấp; giáo viên vẫn chỉ sửa/xóa câu của mình.
- [x] Giữ cấu hình: IOE lớp 1–2 100 câu, lớp 3–9 200 câu; ba môn còn lại 30 câu; 30 phút.
- [x] Baseline test:competition: 9 pass. Backup native SQLite trước thay đổi persistence, quick_check=ok.

## Triển khai

- [x] Catalog đọc số câu khác nhau trong bank chung, không tạo dữ liệu khi tải trang.
- [x] Trang học sinh hiện số câu hiện có/cần, chọn môn/lớp/cấp, báo thiếu cụ thể.
- [x] Prepare lấy mẫu mới, bỏ câu archive/trùng, giữ IOE flexible blueprint và 30 câu không quota của ba môn còn lại.
- [x] Transaction atomically lưu version/attempt; retry cùng clientRunId giữ nguyên bộ câu; ngân hàng thay đổi không ảnh hưởng lượt cũ.
- [x] Giữ URL/đề công khai/giao bài cũ, danh tính B, signed ticket, timer, autosave, chấm điểm, review/History.
- [x] Không đổi quyền sửa bank hoặc quyền đọc kết quả cũ; lượt kho chung được quản trị viên xem trong kết quả và học sinh xem trong History riêng.

## Kiểm chứng

- [x] Regression: đủ/thiếu/trùng/sai scope/cross-owner pool, làm lại lấy mẫu mới, concurrent retry, freeze khi sửa/archive.
- [x] HTTP: public sanitizer, identity/ticket, forged input, review trước/sau nộp, History và quyền staff cũ.
- [x] Typecheck và gate hồi quy rộng + canonical build Node 22.
- [x] Browser compiled desktop/mobile: bank → prepare → activate → autosave/reload → submit → review/history; thiếu/loading/error/keyboard/contrast.
- [x] Smoke production bundle sau build, localhost catalog thật 30/30, đối chiếu bảo toàn database.
- [x] Diff check, CODEMAP/tài liệu và artifact ledger.

## Kết quả cuối

- `test:competition`: 10 pass; assignment tests: 5 pass. Scope bank động bị từ chối khi tạo assignment, đề cố định cũ vẫn giao được.
- `test:phase3`: 581 pass / 0 fail, gồm typecheck, canonical build và startup Node 22.16.0; log `.data/ioe-speaking-final-phase3.log`.
- Browser compiled riêng: `.data/ioe-bank-start-browser-run.log`, `.data/ioe-verification/browser-report.json`; desktop 1440 và mobile 390/320px, đủ/thiếu/loading/error, Toán/Toán Tiếng Anh 300/300, IOE 200 câu, autosave/reload/review/History, 0 browser exception. Kiểm tra CSS B: 978 control giữ computed style.
- Production bundle sau build: `.data/ioe-bank-start-final-bundle.log`, `.data/ioe-verification/bundle-report.json`; guest B lấy 30 câu trực tiếp từ bank, đạt 300/300, History/media và đề cố định cũ đạt; production từ chối local auth bypass.
- API localhost thật trả `bank-math-3-school`, 30/30 câu distinct, ready=true, 30 phút; không ghi bài/lượt QA vào dữ liệu người dùng. `.data/ioe-speaking-local-proof.json`.
- Backup: `.data/ioe-bank-start-backup/local-test-2026-10-04T14-33-24-697Z.sqlite`. So sánh toàn bộ 58 bảng/1310 hàng trước và sau restart: 0 hàng mất/đổi, 0 hàng thêm bởi kiểm tra local; quick_check=ok, WAL. `.data/ioe-speaking-preservation-report.json`.
- Artifact: 74 JS/CSS; entry `index-e7mfwfuZ.js`, CSS `index-UiZPLWL7.css`; server 1.464.016 byte, SHA256 `8DDE5557A4F48D43DEC1D4B4A54FA243A9BB62B40A1196D432BAC2A7D0CBA2B3`. `.data/ioe-speaking-artifact-report.json`.
- Vite còn cảnh báo chunk lớn sẵn có; không có lỗi build. Không gọi AI/TTS thương mại trong QA, commit/push hoặc deploy production.

Rollback: đưa source về bản trước hoặc tắt runtime module; giữ nguyên versions/attempts/media và không rewrite/drop dữ liệu.
