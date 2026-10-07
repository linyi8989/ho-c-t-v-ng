# Checklist điều hướng bằng biển gỗ Starters

- [x] Đọc quy tắc/source/style/route; snapshot và baseline 19 test đạt.
- [x] Thay Learn/Explore bằng Home/Next, thêm History; bỏ thanh điều hướng cũ.
- [x] Dùng route B hiện có: `/`, `/exams/mover`, `/history`; giữ link chuẩn, modifier-click và keyboard.
- [x] Kiểm tra hình thức desktop/mobile, ba nút luôn truy cập được và tương phản rõ.
- [x] Lint, 19 test, build chuẩn và browser kiểm tra cả ba đường điều hướng đạt.
- [x] Review diff, artifact, dữ liệu thật và cập nhật tài liệu/CODEMAP.

Biển History tái sử dụng vùng ảnh gỗ sẵn có bằng CSS; không chỉnh file ảnh, thêm provider hay sửa dữ liệu. Snapshot `.data/starter-nav-before`; rollback riêng source sau khi bảo vệ chỉnh sửa mới, rồi build lại.

Kết quả 2026-10-06: baseline/final 19 test, lint và build Node 22 đạt. Browser compiled kiểm tra ba href/nhãn, vùng bấm từ 44px, font/tương phản AA tại 1440/1280/1024/390/320px; click Home/Next và Enter History mở đúng route ở 1440/390px. Fixture dùng tài khoản staff của B nên Home hiện dashboard; bấm nút Xem trang học sinh hiện homepage thật. Kỳ vọng Home ban đầu nhầm với tài khoản học sinh đã được sửa theo contract B, không sửa auth/source App.

Năm thẻ/cuộn/hover/giảm chuyển động, player, admin, sân trống/loading/error và focus tiếp tục đạt. Local thật và preview 25/25 kiểm tra trực quan desktop/mobile, zero exception, catalog vẫn 1 Listening/0 R&W. Artifact `index-BCIVgJwm.js`, 78 JS/CSS, không thiếu reference, History có trong build, preview bị loại khỏi production; hash server/ảnh/HouseSign giữ nguyên. Chỉ cảnh báo chunk lớn có sẵn, chưa deploy.

Bằng chứng: `.data/starter-nav-final-report.json`, `.data/starter-nav-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-nav-*.log` và ảnh `.data/starter-nav-real-*.png`.
