# Starters: cân đối chữ và biển hiệu — 2026-10-06

Yêu cầu: Starters cong nhẹ theo bảng; Pre A1 dịch lên; hai biển hiệu nhỏ hơn, vừa với mặt tiền; chữ link ở cả hai sân mảnh/rộng hơn nhẹ và tăng độ nổi. Giữ danh sách động, 5 dòng/cuộn và player/quản trị hiện có.

- [x] Đọc quy tắc, ảnh, source/CSS/font/test liên quan; snapshot source và backup native trong `.data/starter-balance-before`.
- [x] Baseline 19 test HTTP/library/registry/điều hướng/quản trị đạt.
- [x] Chỉ chỉnh presentation Starter: chữ cong có nhãn accessible, Pre A1 lên 8px, hai biển nhỏ khoảng 16–21%, link Baloo 2 700/rộng/nổi; ảnh/nguồn dữ liệu giữ nguyên.
- [x] Kiểm tra style thực và font 700; biển không cắt chữ; 5 dòng, 0/3/25/31 bài/cuộn/player/keyboard/focus và các luồng quản trị cũ.
- [x] Desktop/mobile 1440/1280/1024/390/320px; xem ảnh desktop và hai sân mobile.
- [x] 19 test sau sửa, lint/build chuẩn/native startup, IOE/Speaking bundle smoke đạt.
- [x] Local GET, ảnh chụp dữ liệu thật, DB hash, diff/docs/CODEMAP/artifact; mở lại localhost. Không seed/provider/deploy.

Kết quả: 19 test đạt/0 lỗi; lint, build chuẩn, native startup, trình duyệt và smoke bundle IOE/Speaking đạt. Trình duyệt không có exception. Đã xem ảnh fixture desktop/hai sân mobile và ảnh danh sách thật trên localhost. 78 asset JS/CSS không thiếu tham chiếu; server bundle và ba ảnh của cảnh giữ nguyên hash. 10 tài nguyên/API local trả 200; 58 bảng/1.330 dòng giữ nguyên hash, quick_check=ok. Cảnh báo chunk lớn Vite đã có trước, không có lỗi build.

Bằng chứng: `.data/starter-balance-final-report.json`, `.data/starter-balance-{local,db}-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-balance-live-desktop.png`, `.data/starter-balance-*.log`. Snapshot trước sửa: `.data/starter-balance-before`. Không sửa API/settings/player/quyền, gọi provider, seed, commit/push hoặc deploy.
