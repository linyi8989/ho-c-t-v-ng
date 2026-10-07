# Checklist căn chữ và nhãn Starters

- [x] Đọc quy tắc/source/style; lưu snapshot và baseline 19 test đạt.
- [x] Đo vị trí nhãn trước sửa tại 1920/1440/1280/1024/390/320px; ở 1280px mép dưới nhãn tới 78,7% chiều cao bảng, sát viền gỗ.
- [x] Thu chữ Starters còn 90%; thu nhỏ Pre A1, dịch nhẹ sang phải và đưa vào phần gỗ bên trong.
- [x] Kiểm tra kích thước và vị trí thực sau cascade trên desktop/mobile; giữ chữ cong và nhãn accessible.
- [x] Lint, test liên quan, build chuẩn và browser sau build đạt.
- [x] Review diff/ảnh/artifact, xác minh dữ liệu và chức năng liên quan, cập nhật CODEMAP.

Snapshot `.data/starter-title-fit-before`; thay đổi chỉ ở CSS thuộc trang Starters. Không sửa ảnh, route, API, player hoặc dữ liệu. Rollback riêng CSS từ snapshot sau khi bảo vệ chỉnh sửa mới, rồi build lại.

Kết quả 2026-10-06: baseline/final 19 test, typecheck và build Node 22 đạt. Trình duyệt compiled đo title/Pre A1 đúng 90%, nhãn lệch phải và nằm trong mặt gỗ tại 1440/1280/1024/390/320px; so sánh local trước/sau có thêm 1920px, khung nhãn nhỏ hơn và mép dưới tối đa 73,3% chiều cao bảng. Ảnh desktop/mobile đã xem trực tiếp. Điều hướng Home/Next/History, player, admin, năm thẻ/cuộn/hover, loading/error/empty/focus vẫn đạt; zero exception.

Artifact `index-Bo9Zrwxu.js` / `index-BEjBA4Wz.css`: 78 JS/CSS, không thiếu reference, History có trong build, preview không có trong production. Hash server, source trang/biển nhà/điều hướng và asset ảnh giữ nguyên. Catalog local vẫn 1 Listening/0 R&W. Không ghi dữ liệu thật hoặc gọi provider; chỉ có cảnh báo chunk lớn có sẵn, chưa deploy.

File sửa: `src/features/starter-scene/starter-scene.css`, `scripts/starter-scene-browser-smoke.mjs`, `docs/starter-scene.md`, checklist này và `CODEMAP.md`. Bằng chứng: `.data/starter-title-fit-final-report.json`, `.data/starter-title-fit-geometry-before.json`, `.data/starter-title-fit-geometry-after.json`, `.data/starter-title-fit-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-title-fit-*.log` và ảnh `.data/starter-title-fit-*.png`.
