# Checklist mở rộng cảnh Cambridge & IELTS — 2026-10-06

Yêu cầu: bảy trang Starters/Movers/Flyers/KET/PET/FCE/IELTS dùng cùng giao diện làng Starters đã duyệt. Biển gỗ Home, Previous/Next theo cấp, History. PET/FCE (và IELTS có cùng ba paper riêng) dùng ba nhà, ba sân; mỗi sân năm hàng và cuộn hết danh sách. Sân không có bài để trống.

Phạm vi: cảnh catalog, danh sách link quản trị, adapter đọc catalog và settings riêng từng module/paper. Giữ route/player, đề đã xuất bản, quyền sở hữu, chấm điểm, tài khoản và lịch sử hiện có. Không sửa cấu trúc đề, không seed DB thật, không deploy.

- [x] Đọc quytac, source/types/API/storage/tests/CODEMAP liên quan; baseline 14 tests pass.
- [x] Snapshot source trước sửa tại `.data/exam-scenes-before`.
- [x] Background ba nhà cùng style; lưu asset/prompt, xem ảnh thực.
- [x] Shared scene theo manifest; hai/ba sân đúng paper, nhãn level vừa bảng.
- [x] Điều hướng gỗ giữa đủ bảy cấp, Home/History, bàn phím/mobile.
- [x] Catalog/admin riêng theo module/paper; giữ endpoint/settings Starter; đọc Movers legacy từ kho hiện có.
- [x] Native HTTP fixture: quyền/ownership, lọc công khai, revision conflict, không rò answer key, không sửa đề/DB thật.
- [x] Browser đủ bảy cấp: năm hàng, scroll cuối, empty/loading/error/retry, link đúng player, admin add/remove/reorder/save, desktop/mobile/focus/contrast/reduced motion.
- [x] Tests liên quan, lint, canonical Node 22 build; native startup; local read-only.
- [x] Diff review, CODEMAP/ledger/docs; rollback chỉ source sau bảo vệ thay đổi mới và build lại, không restore DB.

Bằng chứng: `.data/exam-scenes-tests.log` (68 pass), `.data/exam-scenes-listening.log` (142 pass), `.data/exam-scenes-api-final.log` (7 API tests pass), `.data/exam-scenes-verification/browser-report.json` (7 cấp × 5 width, 0 exception), `.data/starter-scene-verification/browser-report.json` (toàn app/admin/hai player), `.data/exam-scenes-{copy,db,live,artifact}-report.json`. Native live giữ 58 tables/1.339 rows, quick_check=ok, không API write. Chỉ fixture hoặc bản sao nhận PUT.

Kiểm tra Starter cũ ban đầu chờ selector màn Movers cũ; cập nhật assertion sang cảnh Movers hai sân theo yêu cầu mới, giữ route và toàn bộ các assertion khác. Suite sau cập nhật pass. Live harness từng trả DOM trực tiếp qua CDP; đổi kiểm tra thành Boolean, không sửa app. Các ảnh screenshot desktop/mobile đã được xem trực tiếp.

## Điều chỉnh khung link đầy đủ — 2026-10-07

- [x] Giữ nguyên tên đề, bỏ clamp/ellipsis; tên dài tăng chiều cao khung.
- [x] Mở rộng khung, đưa linh vật ra đầu; SVG gỗ và atlas alpha riêng.
- [x] Hai sân cùng baseline; ba sân giữ đúng nhà/kỹ năng; nav Home/History rồi Previous/Next.
- [x] Mobile >=15px, nút cuộn 44px, chỉ báo vị trí; số hàng linh hoạt thay yêu cầu cứng năm hàng.
- [x] Browser bảy cấp × năm width có tên dài/unbroken token, cuối danh sách, empty/loading/error/retry, admin và điều hướng.
- [x] Browser Starters toàn app/API fixture/hai player/submit/review, typecheck/build; xem ảnh thực.

Chi tiết hiện hành: `docs/scene-link-layout.md`; báo cáo trong các đường dẫn nêu ở tài liệu đó. Các số liệu 68/142 tests và snapshot phía trên là bằng chứng của lần mở rộng ngày 2026-10-06.
