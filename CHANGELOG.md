# Lịch sử thay đổi

## 2026-09-02 - Khắc phục audit bảo mật và hiệu năng

- Sửa cấu hình quyền quản trị: bỏ email admin khỏi logic mã nguồn; dùng Firebase
  claim, vai trò lưu ở backend và `BOOTSTRAP_SUPER_ADMIN_EMAILS`.
- Sửa bảo vệ HTTP: thêm security headers, giới hạn JSON 100 KB, cấu hình proxy
  tin cậy và rate limit cho đăng nhập điện thoại, guest, AI, TTS.
- Sửa endpoint chẩn đoán: bắt buộc secret qua header, không lộ stack, project ID
  hay lỗi nội bộ trong response production.
- Sửa guest session cũ: chỉ cho cập nhật phiên chưa hoàn thành trong cửa sổ
  tương thích ngắn; có thể tắt bằng cấu hình.
- Sửa luồng dữ liệu frontend: bỏ fallback đọc Firestore trực tiếp; dữ liệu ứng
  dụng đi qua API backend và Firestore client rules đóng quyền đọc còn sót.
- Sửa thao tác xóa: chuyển vocab, grammar, lớp và bài giao sang lưu trữ/thu hồi
  link. Không xóa bài làm, thành viên lớp, lịch sử, leaderboard hoặc phiên bản.
- Sửa hiệu năng: không quét toàn bộ users/guest profiles để gắn tên kết quả và
  không chạy chuỗi truy vấn N+1 theo từng guest trong danh sách tài khoản.
- Sửa đường dẫn runtime: local dùng `.data`, production phải khai báo thư mục
  bền vững; bỏ username máy chủ khỏi default trong mã nguồn.
- Thêm công cụ dò media mồ côi: dry-run mặc định; chế độ execute sao lưu SQLite
  rồi chuyển file vào quarantine có thể phục hồi, không xóa vĩnh viễn.
- Giảm rải rác regex/state định tuyến trong `App.tsx` bằng bộ phân tích route
  riêng, vẫn giữ nguyên URL đã phát hành.
- Thêm 14 kiểm thử bảo mật/route và mở rộng bộ kiểm thử hiệu năng lên 9 trường
  hợp. Chi tiết kiến trúc và giới hạn rollout nằm tại CODEMAP mục 80.

Việc vận hành còn bắt buộc sau khi deploy: đổi/thu hồi các key thật tại nhà cung
cấp, đổi tên biến legacy `DEVQUOTA_API_KEYk`, đặt đúng proxy hop và triển khai
`firestore.rules`. Không có giá trị secret nào được ghi vào tài liệu này.

### Kiểm tra trước bàn giao

- `npm run lint`: đạt.
- 297 kiểm thử thuộc các bộ portable đã chạy: đạt toàn bộ.
- `npm run build`: đạt; server bundle hợp lệ và chứa security headers, archive
  lifecycle; client bundle vẫn chứa nút History.
- 20 kiểm thử History không dùng native driver đạt. Bảy ca History native, bốn
  ca Storage, bốn ca legacy integration, History CLI và startup chưa thể chạy
  hết vì shell hiện là Node 24 ABI 137 trong khi `better-sqlite3` đã được cài cho
  Node 22 ABI 127. Không rebuild bằng Node 24 để tránh làm sai artifact triển
  khai; cần chạy lại các gate này trong Node 22.
