# Checklist giao diện học từ vựng theo ảnh mẫu

- [x] Đọc quytac/source/API liên quan; nhận diện thay đổi có sẵn, xem Git history và snapshot source/hash.
- [x] Baseline `test:vocab-games`: 18 đạt, không lỗi.
- [x] Kiểm chứng baseline bố cục flashcard với ảnh/nội dung dài: 24 trường hợp đạt.
- [x] Theme riêng cho màn từ vựng: nền, header, sân chơi, flashcard, điều khiển, nhóm game và bảng vàng.
- [x] Giữ danh tính B, share/assignment, lazy session, chấm/lưu/retry/history, TTS và leaderboard tải theo nhu cầu.
- [x] Kiểm tra desktop/mobile, nội dung dài/ảnh, flip, nghe, rating, chuyển/trộn/tự chuyển/fullscreen, selected/disabled/focus/loading/error/empty.
- [x] Test liên quan, lint, build chuẩn Node 22, kiểm tra browser/artifact và hash ngoài phạm vi.
- [x] Xem ảnh, review diff, cập nhật CODEMAP và bàn giao.

Kết quả ngày 2026-10-06: 82 test liên quan đạt; 24 trường hợp bố cục đạt; browser kiểm tra 6 chiều rộng/11 game, tương phản nút tối thiểu 4,98:1 và không có runtime exception. Kiểm tra local trên bộ từ hiện có không phát sinh API ghi; các trang Starters/IOE/Speaking không nhận theme này. Lint, build Node 22.16.0 và native startup đạt. Build chỉ có cảnh báo chunk lớn đã có; chưa deploy production.

Bằng chứng: `.data/vocab-theme-final-report.json`, `.data/vocab-theme-live-report.json`, `.data/vocabulary-theme-verification/browser-report.json`, `.data/flashcard-verification/browser-report.json` và `.data/vocab-theme-*.log`. Tài liệu hành vi/rollback: `docs/vocabulary-theme.md`; CODEMAP mục 172.

Luồng hiện có: bộ từ public hoặc share/assignment → danh tính B → game được chọn → action lưu trong lượt lazy → complete/chấm server → kết quả/retry/history. Bảng vàng chỉ tải sau khi bấm xem. Theme chỉ đổi trình bày; dữ liệu thật không bị seed hoặc sửa để minh họa. Không thay provider, câu hỏi, cơ chế audio hoặc danh sách game.

Phạm vi: `StudentLearningArea` và flashcard/controls bên trong; các game khác dùng cùng khung nhưng giữ renderer và trạng thái đúng/sai hiện có. Không đổi các màn IOE, Speaking, Starters hoặc dashboard. Nội dung dài vẫn tự giãn, ảnh giữ tỉ lệ tự nhiên. Snapshot `.data/vocab-theme-before`; rollback source sau khi bảo vệ chỉnh sửa mới, rồi build lại, không phục hồi đè dữ liệu.
