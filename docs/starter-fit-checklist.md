# Checklist Starters: thẻ gọn hơn và nâng lên trong sân

- [x] Đọc quy tắc, source/style toàn cục, ledger và test liên quan; giữ snapshot trước sửa.
- [x] Baseline 19 test đạt.
- [x] Thu thêm khoảng 7–8% kích thước desktop; nâng cả hai danh sách 3% chiều cao ảnh.
- [x] Mobile gọn hơn theo chiều ngang, giữ hàng bấm 44px.
- [x] Kiểm tra 5 thẻ/cả hai sân, cuộn độc lập tới cuối, hover/focus/giảm chuyển động.
- [x] Kiểm tra trực quan desktop/mobile, bảng nằm trước hàng rào; font/số/tên dài/tương phản đạt.
- [x] 19 test sau sửa, lint và build chuẩn Node 22 đạt; browser compiled/local đều đạt.
- [x] Asset cảnh/server/dữ liệu thật giữ nguyên; History còn trong build và preview không lọt vào production.
- [x] Review diff, cập nhật tài liệu/CODEMAP và bằng chứng.

Phạm vi chỉ là bố trí Starter. Giữ art đã được duyệt, hai danh sách động, link thật và mô phỏng local 25/25. Không sửa backend/player hoặc lưu trữ.

Kết quả 2026-10-06: baseline/final 19 test, lint/build chuẩn Node 22, browser compiled và local preview đạt. Năm kích thước 1440/1280/1024/390/320px có đủ năm thẻ mỗi sân; khung thẻ nằm trong vùng 47–86,5% chiều cao ảnh, mobile giữ hàng 44px. Cuộn bằng chuột tới cuối cả hai sân, hover thường/giảm chuyển động, số 12/123/1000, tên dài, hai player, admin lưu/thêm/xóa/đổi thứ tự và loading/error/empty vẫn đạt. Tương phản gỗ tối thiểu 6,26:1; zero exception. Catalog thật vẫn 1 Listening/0 R&W, server/asset cảnh/art giữ hash. Build có 78 JS/CSS, không thiếu reference, History hiện diện và không chứa helper/dữ liệu mô phỏng. Cảnh báo kích thước chunk có sẵn; không lỗi build, chưa deploy.

Bằng chứng: `.data/starter-fit-final-report.json`, `.data/starter-fit-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-fit-{baseline,tests,lint,build,browser,live}.log`, ảnh `.data/starter-fit-preview-*.png`. Xem local tại `http://localhost:3000/exams/starter?preview=links`.

Rollback: snapshot `.data/starter-fit-before`, chỉ phục hồi những source đã sửa sau khi kiểm tra thay đổi phát sinh, rồi build lại; không phục hồi DB.
