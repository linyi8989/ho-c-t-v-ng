# Bảng vàng trang chủ

Theo lựa chọn của người dùng ngày 2026-10-05, mọi người trên trang chủ đều được xem tên hiển thị của học sinh trong Bảng vàng. Trang chủ tự gọi `GET /api/public/leaderboard-summary`; không cần vào game hoặc bấm tải trước.

Server vẫn tổng hợp từ read model hiện có, giữ nguyên quy tắc điểm, xếp hạng, tuần/tháng và chọn kết quả tốt nhất theo bộ từ/game. Chỉ resolve tên từ hồ sơ B cho các dòng đã xếp hạng, tối đa 20 dòng; dữ liệu legacy chưa liên kết hồ sơ giữ tên trong snapshot. Tên được giới hạn 120 ký tự, tên trống dùng `Học viên #…`.

DTO công khai vẫn chỉ có bảy trường: `rank`, `studentName`, `completedLessons`, `averageAccuracy`, `studyDays`, `honorScore`, `badges`. ID người dùng/guest/owner, email, liên hệ và chi tiết kết quả không được gửi ra. Cache Home dùng key `public:names-v1:{period}:{limit}` và `Cache-Control: public, max-age=30`.

Endpoint summary theo bài học giữ contract ẩn danh hiện có. Bảng quản trị vẫn tuân theo quyền B; raw result feed công khai vẫn bị từ chối. Không thêm hồ sơ, bảng hay thay schema.

Tên dài xuống dòng ở cả ba vị trí podium và danh sách; không dùng dấu ba chấm để cắt tên. Đổi tuần/tháng hủy request cũ, kể cả response đang parse, để không ghi đè bộ lọc mới. Không có sự kiện hợp lệ trong kỳ đã chọn thì hiện trạng thái trống; không lôi kết quả ngoài kỳ vào bảng.

Regression: Results API 12 tests; full phase3 596/0; browser build xác minh tự tải, tên canonical, DTO và bộ lọc, không tràn ở 1440/390/320px. QA dùng hồ sơ/sự kiện giả trên DB riêng. Bản sao DB thật xác minh tên legacy; DB thật chỉ được đọc, giữ hash 58 bảng/1.330 hàng. Chi tiết tại `docs/speaking-replay-home-leaderboard-checklist.md` và `.data/speaking-home-final-report.json`.
