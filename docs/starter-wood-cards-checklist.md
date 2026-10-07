# Starters: link bảng gỗ và linh vật — 2026-10-06

Yêu cầu: áp dụng kiểu bảng gỗ/linh vật/số màu/mũi tên vàng trong ảnh tham khảo cho các link ở hai sân. Tên bài và số thứ tự là HTML lấy từ danh sách thật, không ghi cứng 5 Part hay thay nội dung bài. Mỗi sân vẫn hiện 5 bài rồi cuộn; quản trị và player giữ nguyên.

- [x] Đọc quy tắc/skill/image/source/CSS, kiểm tra worktree và baseline 19 test đạt.
- [x] Snapshot source/report trong `.data/starter-wood-cards-before`.
- [x] Dùng built-in imagegen tạo sprite bảng gỗ theo ảnh, số/tên để trống; lưu bản gốc trong `output/imagegen` và bản WebP alpha tại `public/assets/lesson-cards`.
- [x] Gắn art trang trí và số/tên động cho cả hai sân, thứ tự/màu/linh vật theo 5 biến thể.
- [x] Kiểm tra font, màu, hover, vùng chữ trên gỗ, alpha, số nhiều chữ số và focus.
- [x] Kiểm tra desktop/mobile, 5 bài/cuộn đến cuối, 0/3/25/31 bài, cả hai player và quản trị.
- [x] Test sau sửa, typecheck, build chuẩn, artifact/localhost đạt.
- [x] Xem ảnh/diff và hoàn tất tài liệu/CODEMAP, không tác động dữ liệu hay backend.

Kết quả: 19 test trước/sau sửa đạt, 0 lỗi; typecheck và build chuẩn Node 22 đạt. Browser smoke kiểm tra 1440/1280/1024/390/320px, font local, 5 biến thể/số động, hover ở hai sân không gạch chân, số 12/123/1000 vừa huy hiệu, sprite alpha góc ngoài 0 và phần gỗ dưới chữ đủ đục (alpha >= 0,95). Tương phản chữ tại các pixel gỗ được đo tối thiểu 6,26:1. Các luồng 5 bài/cuộn đến cuối, 0/3/25/31 bài, hai player, bàn phím/focus và quản trị thêm/xóa/sắp xếp/lưu/tải lại/chống mất chỉnh sửa vẫn đạt, không có exception. Đã xem ảnh desktop và cả hai sân mobile, cùng ảnh danh sách thật trên localhost.

Asset v2 sau một lượt cân chỉnh bằng built-in imagegen: `public/assets/lesson-cards/starter-wood-cards-v2.webp` (1536 × 1024, alpha, 233.780 byte); bản gốc/prompt trong `output/imagegen/starter-wood-cards-v2.{png,prompt.md}`. Font/title/số vẫn là HTML; không ghi cứng Part hoặc đổi tên nguồn. Không tạo danh sách/demo để lấp đầy trang thật.

Artifact `index-BeykSL7J.js` / `index-BEjBA4Wz.css`: 78 JS/CSS, không thiếu tham chiếu, vẫn có History. Server bundle và ba ảnh cảnh gốc giữ nguyên hash; asset v2 trong dist khớp public. Localhost phục vụ source/art mới; danh sách thật giữ 1 Listening/0 R&W. Cảnh báo chunk lớn Vite đã có trước, không có lỗi build. Backend/quyền/settings/player/dữ liệu giữ nguyên. Không seed, gọi provider ứng dụng, commit/push hoặc deploy; hai lượt built-in imagegen chỉ dùng để tạo asset theo yêu cầu.

Bằng chứng: `.data/starter-wood-cards-final-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-wood-cards-live-desktop.png`, `.data/starter-wood-cards-{baseline,tests,lint,build,browser}.log`. Snapshot: `.data/starter-wood-cards-before`.
