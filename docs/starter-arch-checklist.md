# Checklist biển Reading & Writing cong nhẹ

- [x] Đọc quy tắc, source/style, snapshot; baseline 19 test đạt.
- [x] Chỉ biển Reading & Writing có vòm cầu vồng nhẹ: gỗ, vân, đinh và chữ cùng đường cong.
- [x] Giữ chiều rộng/vị trí trên nhà, chữ HTML có nhãn accessible đầy đủ; Listening giữ nguyên.
- [x] Kiểm tra trực quan desktop/mobile và chữ không vượt khung.
- [x] Lint, 19 test sau sửa, build Node 22 và browser compiled/local đạt.
- [x] Năm link/cuộn/hover/player/admin/History/dữ liệu thật giữ nguyên; review diff và cập nhật CODEMAP.

Phạm vi: SVG/CSS và chữ trang trí của biển nhà R&W; không sửa ảnh nền hoặc provider. Rollback riêng source từ `.data/starter-arch-before` sau khi bảo vệ chỉnh sửa mới, rồi build lại.

Kết quả 2026-10-06: baseline/final 19 test, lint/build chuẩn và browser đạt. 1440/1280/1024/390/320px xác nhận vòm SVG cao 13 đơn vị thiết kế, 17 ký tự cong vừa khung và nhãn accessible đầy đủ; biển Listening không thay đổi. Các kiểm tra năm thẻ, cuộn tới cuối hai sân, hover/giảm chuyển động, số/tương phản, cả hai player, admin lưu/thêm/xóa/đổi thứ tự và trạng thái loading/error/empty đạt; zero exception. Local preview 25/25 giữ đúng cơ chế, catalog thật vẫn 1 Listening/0 R&W. Asset nền/art/server giữ hash; 78 JS/CSS, không thiếu reference, History có trong build và preview bị loại khỏi production. Không lỗi build; chỉ cảnh báo kích thước chunk có sẵn, chưa deploy.

Bằng chứng: `.data/starter-arch-final-report.json`, `.data/starter-arch-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-arch-{baseline,tests,lint,build,browser,live}.log`, ảnh `.data/starter-arch-preview-*.png`.
