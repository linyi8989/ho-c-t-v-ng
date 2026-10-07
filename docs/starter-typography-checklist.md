# Starters: chữ nổi và link trực tiếp trên sân — 2026-10-06

Yêu cầu: chữ Starters/Listening/Reading & Writing dùng kiểu bo tròn vàng cam, viền và bóng nổi theo ảnh tham chiếu; link chỉ còn chữ hợp với ảnh; bỏ hai dòng Cuộn để khám phá. Giữ dữ liệu, quản trị, route/player và cơ chế 5 bài có cuộn.

- [x] Đọc quy tắc, ảnh tham chiếu, source/CSS/API/test liên quan; nhận diện thay đổi có sẵn. Snapshot source và native backup trong `.data/starter-typography-before`.
- [x] Baseline: 1 test HTTP Starter và 15 test danh sách/điều hướng/router đều đạt.
- [x] Chỉ sửa trình bày Starter; không sửa backend/settings/player/publish/quyền.
- [x] HTML text với font đang có; viền/bóng nổi, chữ link không nền/viền/ô/số badge/mũi tên; bỏ hint hai bên.
- [x] Kiểm tra 5 dòng, cuộn cuối, 0/3/25/31 bài, link vào player, quản trị save/reload và các trạng thái.
- [x] Desktop/mobile 1440/1280/1024/390/320px, text không tràn, hover/focus/Enter, font tải local và style thực.
- [x] Lint/build/native startup, 16 test liên quan đạt, smoke IOE/Speaking sau build; xem ảnh desktop và hai sân mobile.
- [x] Live GET/dữ liệu giữ nguyên, diff/docs/CODEMAP/artifact; localhost mở lại. Không gọi provider hoặc deploy.

Kết quả: 16 test đạt/0 lỗi; lint, build chuẩn, startup native, kiểm tra trình duyệt và smoke bundle IOE/Speaking đạt. Trình duyệt không có exception. 78 asset JS/CSS không thiếu tham chiếu; server bundle và ba ảnh nền/bảng/cột giữ nguyên hash. Localhost trả 200 cho 9 tài nguyên/API, phục vụ source mới. Cả 58 bảng/1.330 dòng giữ nguyên hash, quick_check=ok. Build có cảnh báo kích thước chunk Vite đã tồn tại, không có lỗi build.

Bằng chứng: `.data/starter-typography-final-report.json`, `.data/starter-typography-{local,db}-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-typography-*.log`. Snapshot trước sửa: `.data/starter-typography-before`. Không ghi câu/bài/kết quả vào dữ liệu local thật, không gọi provider, commit/push hoặc deploy.
