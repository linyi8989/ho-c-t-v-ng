# Starters: biển trên nhà và chữ link nổi — 2026-10-06

Yêu cầu: biển Listening/tai nghe và Reading & Writing/sách gắn trên mặt tiền như ảnh tham chiếu; thu nhỏ Starters, chỉnh Pre A1; chữ link nổi 3D, hợp tông ảnh và không có ô bao quanh. Giữ danh sách động, 5 bài/cuộn, quản trị và player.

- [x] Đọc quytac, source/CSS/API/type và ảnh; kiểm tra thay đổi có sẵn. Snapshot source và native DB backup trong `.data/starter-house-before`.
- [x] Baseline 19 test HTTP/danh sách/registry/điều hướng/quản trị đều đạt.
- [x] SVG trang trí và CSS giới hạn trong Starter; biển trên nhà, Starters nhỏ, Pre A1 trên gỗ sáng, chữ link nổi/không ô.
- [x] 5 dòng, cuộn cuối, 0/3/25/31 bài, player, bàn phím/focus; quản trị lưu/tải lại và bảo vệ chỉnh sửa.
- [x] Desktop/mobile 1440/1280/1024/390/320px: vị trí biển theo ảnh nền, không tràn/cắt chữ, style thực, ảnh chụp desktop/hai sân mobile được xem.
- [x] Lint, 19 test sau sửa, build chuẩn, native startup và smoke bundle IOE/Speaking đạt.
- [x] Diff/docs/CODEMAP/artifact; local GET mới, dữ liệu và ảnh nền giữ nguyên; localhost mở lại. Không gọi provider, seed hoặc deploy.

Kết quả: 19 test đạt/0 lỗi; lint, build chuẩn, native startup, trình duyệt và smoke bundle IOE/Speaking đạt. Không có exception trình duyệt; viền chữ link so với mặt chữ đạt 6,74:1. 78 asset JS/CSS không thiếu tham chiếu; server bundle và ba ảnh của cảnh giữ nguyên hash. 10 tài nguyên/API local trả 200; đã xem ảnh chụp danh sách thật, tên hiển thị không còn dấu phân cách lỗi. 58 bảng/1.330 dòng giữ nguyên hash, quick_check=ok. Cảnh báo chunk lớn của Vite đã có trước, không có lỗi build.

Bằng chứng: `.data/starter-house-final-report.json`, `.data/starter-house-{local,db}-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-house-live-desktop.png`, `.data/starter-house-*.log`. Snapshot trước sửa: `.data/starter-house-before`. Dấu U+FFFD giữa khoảng trắng được thay thành · khi hiển thị, không sửa tên nguồn hoặc dữ liệu bài. Không tạo dữ liệu demo, gọi provider, commit/push hoặc deploy.
