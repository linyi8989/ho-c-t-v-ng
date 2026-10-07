# IOE/Violympic — triển khai và kiểm chứng

Phạm vi được duyệt: module nghiệp vụ riêng trong B, học từ A tại `E:\VS CODE\ioe`. Không chuyển tài khoản, Firebase, guest, lớp học, media provider, secret hoặc dữ liệu demo. Luồng phát hành đầu tiên: JSON → chỉnh sửa → bank → lập đề → làm bài → kết quả và History B.

Quyết định: quyền sở hữu B; lớp 1–9; IOE 100 câu lớp 1–2 và 200 câu lớp 3–9; Toán/Tiếng Việt 30 câu; 30 phút; IOE nới quota khi thiếu nhóm nhưng không giảm tổng câu. Cấu hình sản phẩm tham khảo A, không tuyên bố là quy định cuộc thi chính thức.

## Trước triển khai/build

- [x] Đọc `quytac.md`, kiến trúc và package; xác định các thay đổi FCE có sẵn cần giữ.
- [x] TypeScript baseline đạt.
- [x] Xác nhận Node 22.16.0 / ABI 127, giữ better-sqlite3 10.1.0.
- [x] Kiểm tra đường dẫn SQLite cấu hình: không có DB local hiện hữu. Không tạo DB production; test dùng bản sao/fixture cô lập.
- [x] Sao lưu dist ban đầu vào `.data/ioe-verification/initial-dist` trước build baseline.
- [x] Đã chạy gate baseline `test:phase3`: gặp lỗi budget CSS có sẵn, được ghi nhận và sửa bằng gộp khai báo trùng; log `.data/ioe-verification/baseline-phase3.log`.

## Trong triển khai

- [x] Domain/type/JSON validator/prompt/ngân hàng theo môn/lớp/cấp.
- [x] Lưu trực tiếp câu hợp lệ, ownership, copy, search, preview và archive nhiều câu.
- [x] Blueprint IOE, chọn đủ câu riêng Toán/TV, phát hiện câu trùng và báo thiếu.
- [x] Đề/version bất biến; shuffle câu/phương án và đánh số 1..N.
- [x] Prepare/activate/save/submit, ticket, ownership, revision, retry/idempotency.
- [x] Timer/chấm server, autosave, finalize quá hạn và phục hồi sau restart.
- [x] Review đầy đủ nội dung/phương án/lựa chọn/đáp án/media/giải thích.
- [x] Nối History B và giao bài/lớp B, dashboard B.
- [x] Media dùng picker/upload/image generation/TTS của B; tham chiếu bảo vệ asset.
- [x] UI scoped, loading/error/empty/disabled, desktop/mobile/focus.
- [x] Migration additive/idempotent trên fixture có dữ liệu B; không thay grader cũ.
- [x] Test mới: dữ liệu lỗi, bảo mật, snapshot, deadline, tranh chấp, quyền, History.

## Sau triển khai/build

- [x] Test module và TypeScript.
- [x] Toàn bộ gate hồi quy B `test:phase3` với Node 22.
- [x] Build chuẩn `npm run build` và smoke chạy bundle.
- [x] Browser luồng giáo viên → học sinh → kết quả → History, desktop/mobile.
- [x] Kiểm tra answer key không xuất hiện trước nộp, trái owner 404.
- [x] Kiểm tra dữ liệu legacy, migration lặp, lưu điểm 0–100/raw/max.
- [x] `git diff --check`, diff/stat và từng file; giữ các thay đổi ban đầu.
- [x] CODEMAP cập nhật, bàn giao kết quả và giới hạn có bằng chứng.

Không commit/push/deploy trong yêu cầu này. Phần game bổ sung, AI tạo hàng loạt và thống kê nâng cao thực hiện sau luồng đầu tiên, theo thứ tự ưu tiên đã duyệt.

## Kết quả bàn giao 2026-10-04

- Gate `test:phase3`: 533 test pass / 0 fail; typecheck, build, startup, History CLI và legacy đạt.
- Module: 7 test pass / 0 fail. Browser và bundle production đạt; production từ chối bypass local.
- Luồng 30 câu đạt 300/300; IOE 200 câu giữ đủ tổng và game sắp xếp/nối cặp chấm đúng.
- Desktop/mobile, focus, contrast >=4.5, media và hồi phục phiên đã kiểm tra. 978 control cũ có computed style trước/sau giống nhau.
- Test dùng DB fixture/backup cô lập; DB production chưa bị tác động. Dist sinh bằng build chuẩn.
- Tài liệu kiến trúc, API/persistence, vận hành, giới hạn và các file tích hợp: `docs/ioe-violympic-module.md`.
- Log: `.data/ioe-verification/release-phase3.log`, `final-build.log`, `browser-report.json`, `bundle-report.json`.

## Điều chỉnh bốn môn / Tổng quan / Kết quả — 2026-10-04

- [x] Đọc lại quy tắc, source/API/test và giao diện inventory của A; baseline module 7/7 đạt.
- [x] Backup DB local và fixture trước lượt kiểm chứng; không ghi DB production.
- [x] Giữ mã `math` cho dữ liệu cũ, đổi nhãn Toán; bổ sung `math-english` dùng cùng pipeline/chấm Toán và nội dung tiếng Anh.
- [x] Bốn môn, lớp 1–9; bốn cấp trường/xã-phường/tỉnh/quốc gia, giữ luyện tập riêng IOE.
- [x] Bỏ hai tab Lập đề/Giao lớp và Kho/tiến độ; thay Tổng quan, bốn bảng đủ ô kể cả kho trống, thống kê thực tế.
- [x] Kết quả lọc độc lập, mặc định trống, chỉ áp dụng khi bấm Lọc; phân trang đầy đủ, không giới hạn ở 200 bài.
- [x] Test native SQLite: 201 kết quả cùng môn, >200 kết quả tổng, quyền giáo viên/admin, lớp/cấp và paper archive; 9/9 đạt.
- [x] Browser desktop/mobile: bốn bảng, Toán Tiếng Anh full flow, bộ lọc trống/áp dụng/reset và kết quả; sửa cột bảng mobile từ bằng chứng ảnh, kiểm tra kích thước/tương phản và xem ảnh lại.
- [x] Typecheck, gate hồi quy 535/535, build chuẩn; sau chỉnh bảng mobile chạy lại typecheck/build/browser và smoke bundle.
- [x] Diff sạch, cập nhật tài liệu/CODEMAP/ledger; localhost 3000 khởi động lại, admin/overview/results-page đều HTTP 200 với bốn môn.

Log bản điều chỉnh: `.data/ioe-verification/four-subjects-phase3.log`, `four-subjects-final-lint.log`, `four-subjects-build.log`, `browser-report.json`, `bundle-report.json`. Toán và Toán Tiếng Anh đều đạt 300/300; IOE 200 câu, B assignment/History/media và 978 control CSS cũ tiếp tục đạt. Không deploy.
