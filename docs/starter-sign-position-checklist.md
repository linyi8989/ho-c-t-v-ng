# Checklist hạ biển Reading & Writing

- [x] Đọc quy tắc/source/style và bảo vệ thay đổi có sẵn; baseline 19 test đạt.
- [x] Hạ toàn bộ biển R&W từ 29,2% xuống 30% chiều cao cảnh (khoảng 6px), giữ đường cong đã duyệt.
- [x] Lint, 19 test liên quan và build chuẩn Node 22 đạt.
- [x] Kiểm tra trực quan desktop/mobile, chữ trong khung; năm thẻ/cuộn và chức năng hiện có đạt.
- [x] Review diff, cập nhật tài liệu/CODEMAP và xác nhận không sửa dữ liệu thật.

Chỉ đổi một tọa độ CSS của biển R&W. Snapshot trước sửa: `.data/starter-lower-before`; khôi phục riêng dòng CSS sau khi bảo vệ chỉnh sửa mới, rồi build lại.

Kết quả 2026-10-06: browser compiled tại 1440/1280/1024/390/320px xác nhận biển hạ thêm 0,8% chiều cao cảnh; vị trí ngang/chiều rộng/biển Listening và độ cong giữ nguyên. Các kiểm tra chữ vừa khung, năm thẻ, hover, cuộn, keyboard, player, quản trị và trạng thái loading/error/empty đạt. Local preview 25/25 đạt, catalog thật 1 Listening/0 R&W không đổi. Build không lỗi; artifact `index-Cle5sfaQ.js`, 78 JS/CSS, không thiếu reference, History hiện diện, preview bị loại khỏi production; server/ảnh giữ hash. Không deploy.

Bằng chứng: `.data/starter-lower-final-report.json`, `.data/starter-lower-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-lower-*.log` và ảnh `.data/starter-lower-preview-*.png`.
