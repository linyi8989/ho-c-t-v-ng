# Checklist giao diện làm bài Starters theo ảnh mẫu

- [x] Đọc quytac, source/style/API/contract và trạng thái Git; snapshot trước sửa.
- [x] Baseline `test:exam-platform`: 103 đạt, 0 lỗi.
- [x] Thêm theme riêng Starters: nền minh họa, khung kem, nút xanh nổi, progress/timer và thanh nghe.
- [x] Giữ timer/server grading, local recovery, Part views, geometry, submit/review/history; không đổi các cấp khác.
- [x] Kiểm tra desktop/mobile: Part 1–4 Listening, Part 1–5 R&W, nghe/tạm dừng/tua/âm lượng/lỗi, keyboard, disabled, focus và tương phản.
- [x] Lint, test, build, compiled browser và kiểm tra artifact/dữ liệu thực đạt.
- [x] Xem ảnh, review diff, cập nhật CODEMAP và bàn giao.

Luồng giữ nguyên: playable public → danh tính B → prepare signed run → Part views/local recovery → submit/chấm server → review/history. Theme chỉ tác động cách trình bày; audio dùng URL của bộ đề. Mọi kiểm thử có ghi attempt dùng DB fixture biệt lập. Snapshot `.data/starter-player-before` để rollback source sau khi bảo vệ chỉnh sửa mới, rồi build lại; không phục hồi đè dữ liệu.

Kết quả 2026-10-06: `test:exam-platform` 103, `test:listening` 142, `test:starter-scene` 1 — tổng 246 đạt, không fail/skip. `npm run lint`, build chuẩn Node 22.16.0 và compiled browser đều đạt. Ảnh đã xem cho desktop/mobile, Listening nối/nhập/chọn/tô màu và R&W; widths 1440/1024/390/320 cho Listening, 1440/390/320 cho R&W. Nút ≥44px, tương phản chữ trên các gradient ≥4.5:1, không tràn ngang. Thanh nghe điều khiển audio thật trong fixture; đổi Part reset nguồn, không autoplay; lỗi tải có retry. Nộp bài đi tới màn kết quả của B.

Regression trang hai sân và dashboard cũng đạt: 5 link/khung, cuộn đến cuối, hover, title 90%, Home/Next/History, thêm/xóa/đổi thứ tự/lưu danh sách, loading/error và sân trống. Browser không có exception. Snapshot hash xác nhận API, renderer tương tác, màn kết quả, stage ảnh, CSS hai sân và server bundle giữ nguyên. Artifact có 78 JS/CSS, không thiếu reference, có History và không chứa preview demo. Catalog thực vẫn 1 Listening/0 R&W; background WebP phục vụ đúng hash qua localhost.

Bằng chứng: `.data/starter-player-final-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-player-{baseline,tests,listening,scene-tests,lint,build,browser}.log`. Prompt và ảnh gốc ở `output/imagegen/starter-exam-background-v1.*`.

Chẩn đoán trong triển khai: kiểm tra computed CSS phát hiện border chung ghi đè màu kem; chỉ tăng ưu tiên border trong root Starters, không sửa CSS toàn cục. Browser automation phải đợi React cập nhật lựa chọn/mute và CSS hết transition trước assertion; không giảm assertion. Lint chạy sau build vì tsconfig hiện đọc cả artifact, tránh build xóa file giữa lúc typecheck. Localhost mở lại bằng `dev:local:native`: DB hiện có WAL nên không dùng driver sql.js, không xóa sidecar hoặc chuyển đổi DB.
