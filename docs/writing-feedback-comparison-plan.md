# Writing: đối chiếu lỗi và bài sửa hoàn chỉnh

Phạm vi đã duyệt: kho đề Writing độc lập, kết quả giáo viên và học sinh.

- [x] Đọc luồng UI → provider → grade → exam_attempt_details.data_json → review; baseline 59 test pass.
- [x] Backup online SQLite và source trước sửa tại .data/writing-feedback-qa/before; local-before.sqlite quick_check=ok.
- [x] Thêm cặp lỗi ngữ pháp/từ vựng (original/corrected/explanation) và revisedEssay; runtime validation, retry cùng provider tối đa 2 lần.
- [x] Prompt sửa bài A2–B1 dựa đề + bài gốc, giữ ý/giọng/cấu trúc tối đa, thêm ý vừa đủ, không bịa thông tin cá nhân hoặc viết bài mẫu xa bài gốc. Điểm/số câu/số từ chỉ tính bài gốc.
- [x] Bật phản hồi mở rộng chỉ theo published version của Writing độc lập; các cấp thi khác giữ contract cũ.
- [x] Lưu thêm trường trong JSON detail, không migration và không sửa bài/điểm đã có.
- [x] Một component chung: một khung đối chiếu, Ngữ pháp phía trên/Từ vựng bên dưới, hai cột bằng nhau Em đã viết/Sửa thành; thêm khung Bài sửa hoàn chỉnh.
- [x] Giữ đọc kết quả cũ: nhận xét văn bản giữ nguyên; không bịa cặp đối chiếu, không tự chấm lại.
- [x] Test provider cả hai adapter, malformed/source mismatch/retry/legacy, roundtrip SQLite/review/quyền truy cập và blank essay.
- [x] Test browser teacher/student, desktop/mobile, dài/empty/legacy, nguyên văn/escape và contrast.
- [x] Typecheck, build chuẩn, verify manifest/server/local, diff/check, cập nhật CODEMAP.

## Hợp đồng và giới hạn

- grammarCorrections/vocabularyCorrections: tối đa 20 cặp mỗi nhóm. Mỗi cặp có original và corrected tiếng Anh, explanation tiếng Việt. Runtime kiểm tra trích dẫn tồn tại trong bài gốc, giữ chữ hoa/thường và không khớp nhầm một phần từ; cho phép khác khoảng trắng/xuống dòng.
- revisedEssay: bài sửa tiếng Anh hoàn chỉnh, riêng với userAnswer/điểm bài gốc. Không lưu HTML hoặc tự thay câu trả lời học sinh. Bài trống không gọi AI và không sinh bài mẫu.
- Các trường mới optional trong dữ liệu lưu cũ. Bài đã chấm trước bản này vẫn hiện nhận xét dạng văn bản và thông báo chưa lưu bài sửa hoàn chỉnh; chỉ lần chấm mới sử dụng prompt mới.
- Mức A2–B1, sự trung thành với ý và cách mở rộng là yêu cầu trong prompt; automated QA không chứng minh chất lượng ngôn ngữ của AI thật. Nên thử một bài có lỗi và một bài tốt qua provider đang dùng sau deploy.
- Giữ model/gateway/timeout/cơ chế chọn provider hiện tại. Giới hạn output tăng từ 2.000 lên 6.000 token chỉ với Writing độc lập để chứa bảng lỗi và bài sửa. Có thể tăng dung lượng phản hồi/thời gian/chi phí chấm tùy provider và bài viết.
- Không cần biến môi trường, dependency hoặc migration mới. Khi đưa lên hosting cần deploy đồng bộ client + server và restart ứng dụng Node để prompt mới hoạt động.

Tham khảo hợp đồng schema: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs#all-fields-must-be-required). Provider gateway hiện có được giữ nguyên; kiểm tra bằng API mock, không gọi chấm AI thật trong automated QA.

## Bằng chứng bàn giao — 2026-10-11

- 88/88 test cuối: provider, grader, router/persistence/review, contract, legacy API và learning history; tests-final.log. TypeScript exit 0.
- 38 trạng thái browser: kết quả có cặp lỗi/cũ/không lỗi/trống/dài/HTML ở 1440/390/320px, hai vai trò và pending. Hai cột cân nhau, không tràn ngang, contrast tối thiểu 7,21:1; không lỗi runtime, API fixture chỉ GET. Screenshots đã xem desktop/mobile.
- Canonical npm run build và native startup smoke PASS (better-sqlite3@10.1.0, WAL, quick_check, strict missing-file gate, close/reopen). Cảnh báo chunk Vite >500kB hiện hữu.
- 123 file client trong release manifest khớp path/bytes/SHA-256; release e48c81078cc7f1f2b8ee657b35036b28c5bda7f06005ea03493124fd3bd14164.
- Server 1.651.310 bytes / SHA-256 d3e4099d2863b094016378c0af3f61cd189d81f48ea21d5ea4d5a407fb1a2c0d; field/prompt mới có trong artifact; History navigation giữ nguyên.
- Local 127.0.0.1:3000 đã restart Node22/native SQLite, seed off. GET trang/component/CSS 200; 58/58 bảng giữ nguyên fingerprint trước/sau restart, quick_check=ok. Không có writing job hoặc maintenance executor đang chạy lúc restart.
- Source/test diffs so với snapshot và git diff --check được kiểm tra. Các thay đổi maintenance/autosave/session/grammar/background có sẵn được giữ nguyên.
- Evidence .data/writing-feedback-qa: before/, local-before.sqlite, baseline.log, tests-final.log, typecheck-final.log, browser-report.json, screenshots/, build.log, build-report.json, startup.log, local-report.json, source-review.diff.

Rollback: chỉ phần source/JSON contract mới, build lại; không khôi phục database người dùng. Các trường JSON mới optional nên kết quả đã lưu tiếp tục đọc được. Chưa commit/push/deploy.

## Điều chỉnh giao diện theo ảnh — 2026-10-11

- [x] Bỏ chú thích “Bản sửa tham khảo ở mức A2–B1, dựa trên đề bài và bài em đã viết.” dưới bài sửa; yêu cầu A2–B1 trong prompt giữ nguyên.
- [x] Nền phần giải thích và nhận xét lỗi cũ đổi thành hồng đỏ rất nhạt #fff1f2. Override giới hạn trong .writing-feedback vì CSS bảng toàn cục dùng background trắng !important.
- [x] Tiêu đề Ngữ pháp/Từ vựng có dải nền xanh nhạt #eff6ff, viền trái và chữ đậm lớn hơn; giữ hai cột đối xứng.
- [x] Kiểm tra 38 trạng thái teacher/student ở 1440/390/320px; không tràn, contrast >=7,17:1, computed màu đúng, không còn chú thích, chỉ GET fixture; xem ảnh desktop/mobile. TypeScript, canonical build và diff check PASS.
- [x] 123 manifest file khớp bytes/SHA; release a9d0e9133cafb94fee1ae53f7689d93ff0fc54be452d4338595fe24af6c9f29a. Backend SHA giữ nguyên. Local source/CSS GET200, HMR cập nhật; không cần restart backend, không gọi AI/chấm lại hoặc sửa dữ liệu.

Bằng chứng và snapshot cho lần điều chỉnh này: .data/writing-feedback-style-qa. Chỉ sửa shared UI/CSS và tài liệu; không deploy/push.
