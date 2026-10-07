# Checklist sân Starters chưa có bài

- [x] Đọc quy tắc/source/style/test; snapshot và baseline 19 test đạt.
- [x] Bỏ hai dòng thông báo khi Listening hoặc R&W không có bài; giữ trạng thái đang tải/lỗi.
- [x] Lint, 19 test liên quan và build Node 22 đạt.
- [x] Kiểm tra sân trống thực trên local, fixture compiled và giao diện desktop/mobile.
- [x] Review diff, artifact/History/dữ liệu thật và cập nhật CODEMAP.

Phạm vi chỉ nhánh hiển thị danh sách trống, không đổi API/settings/câu hỏi/bộ đề. Snapshot `.data/starter-empty-before` để rollback source riêng sau khi bảo vệ chỉnh sửa mới, rồi build lại.

Kết quả 2026-10-06: baseline/final 19 test, lint/build chuẩn và browser compiled/local đạt. Fixture xác nhận sân Listening 0 bài không có chữ/phần tử nội dung; local xác nhận R&W 0 bài trống tại 1440/390/320px, sân Listening có bài vẫn hoạt động. Kiểm tra năm thẻ, cuộn, hover, keyboard, player, admin, loading/error và bố trí năm kích thước đều đạt, zero exception. Catalog thật giữ nguyên 1 Listening/0 R&W; hash server/ảnh/CSS/biển nhà giữ nguyên. Artifact `index-nfTl2Wvq.js`, 78 JS/CSS, không thiếu reference, History hiện diện và preview bị loại khỏi production. Chỉ cảnh báo chunk lớn có sẵn; chưa deploy.

Bằng chứng: `.data/starter-empty-final-report.json`, `.data/starter-empty-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-empty-*.log` và ảnh `.data/starter-empty-real-*.png`.
