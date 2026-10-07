# Nghe lại Speaking và tên Bảng vàng — 2026-10-05

## Trước sửa

- [x] Đọc quytac, CODEMAP/package, source/API/storage/player/CSS/test, xác định worktree có thay đổi từ trước.
- [x] Snapshot source; backup SQLite native dùng chung `.data/speaking-attempt-before`, quick_check=ok.
- [x] Baseline Home 14 và Results API 10 tests đạt.
- [x] Bốn WAV thật tải HTTP 200/audio-wav, 3,2–4,76 giây, RMS 0,137–0,271; không im lặng/mất file/hết hạn.
- [x] Thử Play trên trình duyệt người dùng: currentTime tăng, readyState=4, không decoder error, muted=false. Chưa xác minh nghe được tại loa của người dùng.
- [x] Người dùng chọn công khai tên trên trang chủ. API cũ thay bằng Học viên #…; game staff lấy tên qua endpoint riêng.

## Trong sửa

- [x] Nghe lại luôn phát từ đầu, bỏ mute/âm lượng 0; giữ nút sau khi tải, có download và lỗi tải/giải mã/autoplay rõ.
- [x] Chuyển mục dừng/hủy tải cũ, giải phóng object URL; nghe từng từ không cắt lượt nghe toàn bản thu tiếp theo.
- [x] Giữ authorized/private recording GET và thời hạn; không gọi provider/chấm lại hoặc đổi WAV/điểm.
- [x] Public Home giữ DTO 7 trường, chỉ mở thêm tên hiển thị; resolve hồ sơ tối đa số dòng top 20, cache key mới.
- [x] Learning-scoped summary vẫn ẩn danh; không đổi quyền quản trị, điểm/xếp hạng, schema hoặc raw result feed.
- [x] Tên dài xuống dòng, không cắt dấu …; response bộ lọc cũ đã abort không ghi đè kết quả hiện tại.
- [x] Regression test public names/canonical/limit/missing/identity/learning compatibility và browser playback/home added.

## Sau build

- [x] Full phase3, lint/canonical build/native startup, Speaking và IOE bundle smoke.
- [x] Compiled browser: phát thực, mute/replay/word/full/error/autoplay/đổi mục/stale response; Home auto load/names/period ở 1440/390/320px.
- [x] Xem ảnh desktop/mobile, kiểm tra contrast/focus/lỗi console và các luồng cũ.
- [x] Restart localhost, chỉ GET file thật/API/source; hash bảo toàn DB, xem diff, docs/CODEMAP/artifact.
- [x] Ghi rõ giới hạn: phát/giải mã và mức tín hiệu có bằng chứng, âm thanh ở loa của người dùng cần kiểm tra tại thiết bị.

Kết quả: **596 pass / 0 fail**, 0 browser errors, tương phản control tối thiểu 5,78:1; build/startup và hai bundle smoke đạt. Live GET xác nhận bốn WAV có tín hiệu và dữ liệu kết quả cũ nguyên vẹn. Hash DB giữ 58 bảng/1.330 hàng, quick_check=ok. Browser fixture xác minh tên từ hồ sơ, DTO 7 trường và tự tải Bảng vàng; bản sao xác minh các tên snapshot legacy vẫn đọc được. Local tuần/tháng hiện tại không có sự kiện phù hợp nên trả danh sách trống đúng bộ lọc cũ.

Chưa xác minh âm thanh thực sự ra loa của người dùng. Không mô tả kiểm tra giải mã/timeline/RMS là bằng chứng đã nghe được tại thiết bị. Có nút Tải bản thu để thử bằng player của máy và phân biệt vấn đề trình duyệt/thiết bị; không tự thay WAV hoặc chấm lại.

Bằng chứng: `.data/speaking-home-final-report.json`, `.data/speaking-home-local-report.json`, `.data/home-leaderboard-copy-report.json`, `.data/speaking-verification/browser-report.json`; contract tại `docs/home-leaderboard.md`, `docs/speaking-setup.md`.
