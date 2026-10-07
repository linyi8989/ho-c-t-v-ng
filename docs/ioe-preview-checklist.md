# IOE/Violympic: xem thử giao diện học sinh — 2026-10-04

- [x] Đọc quytac, source/type/API/CSS, Git và QA liên quan; giữ thay đổi có sẵn.
- [x] Baseline 10 competition tests đạt. Browser local chỉ đọc tái hiện preview tại y=3592px trong viewport 853px, không có dialog và 4 control trả lời bị khóa.
- [x] Sao lưu source trong `.data/ioe-preview-before`; không thay schema/persistence/provider hoặc dữ liệu thật.
- [x] Nút Xem trước mở modal trong viewport, dùng QuestionView của học sinh, có thể chọn/nhập/sắp xếp/nối thử.
- [x] Preview chỉ giữ state local, không tạo attempt/History/score hoặc hiển thị đáp án JSON.
- [x] Đóng bằng nút/Escape/backdrop, focus trap/restore; mở lại xóa câu trả lời xem thử.
- [x] Dùng cùng preview cho câu bank và câu hợp lệ đang soạn; nội dung soạn giữ nguyên.
- [x] Desktop/mobile 1440/390/320px, nội dung/media, keyboard/contrast/selected/disabled.
- [x] Regression module, typecheck/canonical Node 22 build/startup, browser compiled, production bundle.
- [x] Kiểm tra local chỉ đọc, diff check, docs/CODEMAP/artifact ledger.

Chẩn đoán/baseline: `.data/ioe-preview-baseline-ui.json`, `.data/ioe-preview-baseline-browser.log`, `.data/ioe-preview-baseline.log`. QA ghi dữ liệu chỉ trên database fixture riêng; chế độ `--preview-only` chỉ đọc bank thật và tương tác state xem thử.

## Kết quả trước, trong và sau build

- Source đổi: `Admin.tsx`, `QuestionPreview.tsx`, feature CSS và browser regression. Không đổi QuestionView, Student, API/router/engine, schema, provider hoặc secret.
- 61 tests đạt / 0 lỗi: competition 10, admin 16, History 29, legacy contracts 6. Typecheck, canonical build Node 22.16.0 và startup đạt. Logs `.data/ioe-preview-{narrow,final-lint,final-build,startup,test-admin,test-history-unit,test-legacy-contracts}.log`.
- Browser compiled trên fixture mới: `.data/ioe-preview-compiled-browser.log`, `.data/ioe-verification/browser-report.json`. Câu đang soạn và cả bốn dạng câu bank tương tác được; làm lại/mở lại sạch state, button/Escape/backdrop close, focus trap/restore, 1440/390/320px và media đạt. Instrumented preview không gọi API write; không đổi 30 dòng đang soạn hoặc 30 câu đã lưu. 0 browser exception/overflow, computed control contrast >=6.70:1, focus 3px; ảnh đã xem.
- Các luồng cũ vẫn đạt trong cùng QA: JSON/media/bank, Toán/Toán Tiếng Anh 300/300, IOE 200 câu/games, assignment B, signed prepare/activate/autosave/reload/submit/review/History, results/overview. 978 control B giữ computed style giống trước.
- Post-build production bundle IOE và Speaking đều đạt. `.data/ioe-preview-final-bundle.log`, `.data/ioe-preview-speaking-bundle.log`. Không gọi provider trả phí.
- Localhost source hiện tại: chế độ `--preview-only` đạt với câu Toán thật, 1440/390/320px, tương tác/làm lại/đóng/mở/focus và 0 request write. `.data/ioe-preview-local-browser.log`, `.data/ioe-preview-local-report.json`.
- DB: toàn bộ 58 bảng/1310 hàng của checkpoint vẫn giữ hash, 0 hàng mất/đổi, quick_check=ok/WAL. Có thêm 3 hàng cho một lượt Toán/bank version/paper lúc `15:07:30Z`, trước browser QA baseline `15:09:33Z`; lượt thực tế này được giữ nguyên. `.data/ioe-preview-db-report.json`, `.data/ioe-preview-final-report.json`.
- Artifact: `index-B8glmBUO.js` / `index-UiZPLWL7.css`, 74 JS/CSS. Server giữ 1.464.016 byte, SHA256 `8DDE5557A4F48D43DEC1D4B4A54FA243A9BB62B40A1196D432BAC2A7D0CBA2B3`. Vite còn cảnh báo chunk lớn có sẵn, không có lỗi build. Không commit/push/deploy hoặc cleanup dữ liệu.

Chẩn đoán trong QA: native dialog close event từ effect cleanup có thể đến sau lần mở lại trong React Strict Mode; handler chỉ xử lý khi dialog đã đóng. React unmount cũng không tự khôi phục focus của native dialog đã bị gỡ khỏi DOM, nên cleanup giữ và focus lại trigger. Tab/Shift-Tab được giới hạn trong các control đang dùng của dialog. Các assertion không bị nới để vượt qua lỗi này.
