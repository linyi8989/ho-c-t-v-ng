# IOE/Violympic: bảng tổng quan gọn, chỉ đọc — 2026-10-04

- [x] Đọc quytac.md, yêu cầu/ảnh, component tổng quan, API/type, CSS toàn cục và kiểm tra worktree có sẵn.
- [x] Baseline: 9 test competition pass; giao diện thực có 144 nút trong 4 bảng, mỗi bảng cao 542px ở viewport 1280px.
- [x] Chỉ sửa hiển thị tổng quan: thay nút bằng ô dữ liệu, bỏ callback mở ngân hàng, số 0 hiện — và số dương chỉ hiện số; giữ nhãn hàng/cột cho trình đọc màn hình.
- [x] Thu gọn card, phần tóm tắt và khoảng cách hàng; bảng tự vừa chiều ngang, bỏ khung ô và hiệu ứng hover của hàng. Tiêu đề Trường/Phường/Tỉnh/Quốc gia gọn; tooltip và nhãn accessibility vẫn giữ tên cấp đầy đủ.
- [x] Cập nhật kiểm tra browser hiện có theo yêu cầu mới: bảng chỉ đọc, nội dung ô là dấu — hoặc số.
- [x] Typecheck, 9 test competition sau sửa và build canonical Node 22 pass. `.data/ioe-compact-gate.log`, `.data/ioe-compact-final-build.log`.
- [x] Production bundle smoke pass: 30 câu, điểm 300/300, History/media, bypass production bị từ chối. `.data/ioe-compact-bundle.log`.
- [x] Browser compiled trên DB/media thử riêng pass toàn luồng JSON → bank → thi → review/History, Toán Tiếng Anh và IOE 200 câu, bảng/kết quả desktop 1440/mobile 390; 0 exception, tương phản control >=4.5:1, 978 control CSS cũ không đổi. `.data/ioe-compact-browser.log`, `.data/ioe-verification/browser-report.json`. Lần đầu thử bằng dev server riêng gặp xung đột cổng HMR; chạy lại với client đã biên dịch, không bỏ assertion lỗi browser.
- [x] Sau rút gọn tiêu đề, browser chỉ đọc trên localhost tại 1280/390/320px: 144 ô khớp API, không control/tab stop, không tràn/cắt chữ; bảng cao 237px (1280/390) và 253px (320), so với 542px ban đầu. Border ô 0px, cursor auto; bấm ô không chuyển tab. `.data/ioe-compact-overview-report.json`, `.data/ioe-compact-overview.log`.
- [x] Đã xem ảnh desktop/mobile; ảnh bàn giao `.data/ioe-compact-final-desktop.png`. Thêm chế độ `node scripts/ioe-violympic-browser-smoke.mjs --overview-only` (COMPETITION_QA_ORIGIN=localhost) để kiểm tra hiển thị chỉ đọc mà không tạo/sửa dữ liệu. Chế độ full vẫn yêu cầu cờ fixture write và database thử.
- [x] Diff-check pass; cập nhật CODEMAP và hướng dẫn. Bản cuối index-DEMNDZ6K.js/index-UiZPLWL7.css, 74 JS/CSS; server giữ 1.459.701 byte/SHA256 8e69f6860152040353129a4e5bbf08908f20b7813f1c59d41b89ef32c36bcbc8. Server frontend QA đã dừng; localhost 3000 giữ hoạt động. Không commit/push/deploy.

Phạm vi: Overview.tsx, nơi gọi trong Admin.tsx, CSS tổng quan và assertion browser liên quan. Không có thay đổi dữ liệu/API/lập đề/chấm điểm. Browser kiểm tra localhost chỉ đọc; dữ liệu kiểm thử server nằm trong DB cô lập.
