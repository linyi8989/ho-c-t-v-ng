# Checklist giao diện lịch sử học tập — 2026-10-06

Yêu cầu: `/history` dùng phong cách trang học sinh đã duyệt: nền trời/cây/lâu đài, khung kem viền xanh, font Nunito và nút bo nổi. Đổi cả khung xem chi tiết và trạng thái tải/lỗi/rỗng/khôi phục hồ sơ. Giữ nguyên API, quyền, dữ liệu, số liệu, phân trang và nội dung review của từng module.

- [x] Đọc quytac/source/type/API/styles/test/docs liên quan; baseline History unit 29 pass.
- [x] Snapshot source và hash guard tại `.data/history-theme-before`.
- [x] CSS chỉ áp dụng root opt-in; dùng lại background/font/atlas đã duyệt.
- [x] Chỉ thêm presentation hooks; giữ state/callback/payload/format/adapter. 21 guard file giữ nguyên hash; state/API/focus của hai component chính giữ nguyên; package chỉ thêm browser test.
- [x] Browser component thật ở 1440/1280/1024/620/390/320px: văn bản dài, load/error/empty/recovery, phân trang và modal/focus/keyboard/scroll/retry pass. Controls >=44px, tương phản nút >=4.87:1, zero runtime exceptions, reduced-motion pass; ảnh desktop/mobile đã xem.
- [x] History storage 5 + unit 29 + native CLI, identity 14, legacy 6 pass; lint và canonical Node 22.16.0 build pass. Artifact có History/theme, 84 JS/CSS, zero missing references, fixture/preview không vào production; server hash giữ nguyên.
- [x] Native backup/copy quick_check=ok, History GET 200 và toàn bộ hash bản sao giữ nguyên. Local UI đọc list/detail thật 200, zero API writes/browser exceptions. So sánh DB thật ghi nhận thêm 8 row IOE và chuyển trạng thái 1 Speaking attempt/job đang chạy trong lúc làm việc, trước kiểm tra local; không phục hồi/xóa/ghi đè các lượt mới. Delta và báo cáo hash được lưu riêng, không tuyên bố toàn DB thật giữ nguyên hash.
- [x] Diff review, CODEMAP/ledger và tài liệu bàn giao. Local API trước đó trả LEARNING_HISTORY_DISABLED; đã bật LEARNING_HISTORY_ENABLED=true riêng process local sau kiểm tra bản sao. Không sửa file .env/backend/production config.

Rollback: bảo vệ thay đổi mới rồi lấy lại source snapshot và build chuẩn. Không restore DB hoặc xóa WAL sidecar. Không deploy/commit/push trong yêu cầu này.
