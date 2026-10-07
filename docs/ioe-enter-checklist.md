# IOE/Violympic: Enter chuyển câu — 2026-10-04

- [x] Đọc quytac, luồng QuestionView/Student → answersRef → autosave → signed API; kiểm tra type, CSS, QA và thay đổi có sẵn.
- [x] Baseline: 10 competition tests đạt; player chưa có handler Enter. Sao lưu source/QA vào `.data/ioe-enter-before`.
- [x] Enter trong ô trả lời đã có nội dung hoặc phương án đang chọn chuyển câu tiếp; giữ nguyên đáp án và luồng tự lưu.
- [x] Enter trên phương án chưa chọn giữ thao tác chọn bằng bàn phím; không bỏ qua lựa chọn mới vì đã có lựa chọn cũ.
- [x] Không chuyển khi câu trống, đang dùng IME, Enter kèm phím bổ trợ hoặc giữ phím; câu cuối không tự nộp.
- [x] Focus theo câu mới; chỉ bật trong player đang làm, không áp dụng cho preview/review/media hoặc điều khiển khác.
- [x] Regression browser compiled: text/choice, native activation, focus, IME/repeat/modifiers, câu cuối, autosave/reload/submit/review/History.
- [x] Kiểm tra desktop/mobile 1440/390/320px và preview/game cũ.
- [x] Typecheck, scoped regression tests, build chuẩn Node 22, startup và post-build bundle.
- [x] Review diff, cập nhật docs/CODEMAP/artifact. QA chỉ ghi database fixture riêng, không thao tác bài thật học sinh.

Phạm vi source: `QuestionView.tsx`, `Student.tsx` và browser regression. Không thay API, engine chấm điểm, schema, provider, secret hoặc dữ liệu đã lưu.

## Kết quả trước, trong và sau build

- Baseline 10 competition tests đạt. Sau thay đổi, 61 tests đạt/0 lỗi: competition 10, admin 16, History 29, legacy contracts 6; TypeScript đạt. Logs `.data/ioe-enter-{baseline,competition,admin,history,legacy,lint}.log`.
- Build chuẩn Node 22.16.0 và startup đạt; Vite vẫn có cảnh báo chunk lớn trước đây, không có lỗi build. `.data/ioe-enter-{build,startup}.log`.
- Browser compiled trên fixture mới `.data/ioe-bank-qa-bem8e3`: Enter chọn phương án chưa chọn, đổi lựa chọn bằng bàn phím, chuyển đúng một câu sau khi trả lời, focus tới control mới, không nhảy khi giữ Enter. Ô trống/chỉ khoảng trắng không chuyển. Kiểm tra cờ composition/keyCode 229 bằng KeyboardEvent, các modifier và repeat bằng Chrome CDP; không thử trực tiếp bộ gõ Windows thật.
- Lưu/reload giữ đáp án; 30 câu Toán Tiếng Anh đều được chuyển bằng Enter rồi nộp đạt 300/300. Enter tại câu cuối giữ lượt active; Enter trong lúc nộp không tạo lần submit thứ hai. Audio, nút Câu tiếp và preview giữ hành vi riêng. Đề Toán cố định/giao lớp cũ đạt 300/300; IOE 200 câu/sắp xếp/nối cặp, review/media/History và dashboard đạt.
- Desktop/mobile 1440/390/320px không tràn trang; 0 browser exception, computed control contrast >=6.70:1, focus 3px; ảnh đã xem. 978 control B giữ computed style. Bằng chứng: `.data/ioe-enter-browser.log`, `.data/ioe-enter-browser-report.json`.
- Probe `.data/ioe-enter-native-probe.log` xác định lần QA đầu thiếu keypress/click vì CDP Enter không có `text: '\r'`. Đã sửa helper bàn phím, giữ nguyên assertion và chạy lại đạt; không đổi source sản phẩm để che lỗi mô phỏng.
- Post-build production bundle IOE và Speaking đạt trên database fixture/copy riêng; không gọi provider trả phí. `.data/ioe-enter-{bundle,speaking-bundle}.log`.
- Localhost 3000 trả source mới của cả QuestionView/Student, HTTP 200; DB thật chỉ kiểm tra đọc: quick_check=ok, WAL. Không tạo/sửa câu hỏi hoặc attempt kiểm thử trong DB thật. `.data/ioe-enter-artifact-report.json`.
- Artifact: `index-DjulWzQw.js` / `index-UiZPLWL7.css`, 74 JS/CSS. Server giữ 1.464.016 byte, SHA256 `8DDE5557A4F48D43DEC1D4B4A54FA243A9BB62B40A1196D432BAC2A7D0CBA2B3`. Không commit/push/deploy.

Rollback source: bỏ prop onNext/hint trong Student và khôi phục QuestionView từ `.data/ioe-enter-before`, rồi build chuẩn; không cần thay database.
