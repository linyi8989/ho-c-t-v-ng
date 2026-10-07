# Giao diện học từ vựng

Màn học thật từ trang chủ, link riêng và bài giao dùng theme `storybook` trên root `#student-area-root[data-vocab-theme="storybook"]`. Nền trời/cây/lâu đài và khung xanh kem theo ảnh người dùng; flashcard, nút điều khiển, sáu nhóm game và bảng vàng đều là HTML tương tác thật. CSS nằm trong `src/components/games/VocabularyTheme.css`, không mở rộng selector toàn cục.

Giữ nguyên danh tính B, quyền truy cập, danh sách 11 game, helper phát audio/TTS, chấm điểm, lazy completion, thử lưu lại, chơi lại và History. Bảng vàng vẫn chỉ tải khi bấm xem. Luồng kiểm thử dùng API/media giả lập trong máy; kiểm tra localhost thật chỉ đọc, không tạo kết quả hoặc thêm dữ liệu mẫu.

Hai mặt flashcard tiếp tục dùng grid có chiều cao tự nhiên: ảnh giữ tỉ lệ, chữ dài xuống dòng, cả hai mặt cùng quyết định chiều cao. Từ/cụm ngắn không quá 18 ký tự dùng cỡ lớn; nội dung dài giữ cỡ giảm trước đây. Phím Space/Enter lật khi focus vào thẻ, không bắt phím của nút nghe bên trong. Mặt không nhìn thấy là `inert`/`aria-hidden`; reduced motion bỏ chuyển động lật/hover. Nút chính tối thiểu 44px, có focus rõ, selected/toggle có trạng thái ARIA. Mobile xếp danh sách game xuống dưới và nền giữ tỉ lệ.

Font Nunito dùng các file cục bộ đã có. Nền tái sử dụng `public/assets/backgrounds/bg-starter-exam-v1.webp` của trang Starters. Bộ trang trí mới tạo bằng **built-in imagegen**: `public/assets/vocabulary/vocab-decoration-atlas-v1.webp`, RGBA 1254 × 1254, 188.042 byte; gồm sách ABC, sao, cúp và bục xếp hạng trong bốn ô. Bản PNG gốc và prompt chính xác lưu tại `output/imagegen/vocab-decoration-atlas-v1.png` và `output/imagegen/vocab-decoration-atlas-v1.prompt.md`. WebP chỉ đổi định dạng/nén, giữ alpha; CSS chọn từng ô, không dùng ảnh thay cho nội dung/tên/nút.

Kiểm thử:

- `npm run test:vocab-games`, `test:identity`, `test:runs`, `test:history:unit`; các bài backend `vocabularyRuns.test.ts` và `resultsApi.test.ts`: tổng 82 đạt.
- `npm run lint`, build chuẩn Node 22.16.0 và `npm run test:startup` đạt; build chỉ có cảnh báo chunk lớn đã có.
- `npm run test:flashcard-layout`: 24 trường hợp tại 1440/620/390/320px, gồm ảnh dọc/ngang/hỏng, câu rất dài, hai mặt, bàn phím và rating.
- `node scripts/vocabulary-theme-browser-smoke.mjs`: shell thật + renderers với API/media fixture cô lập; sáu chiều rộng, 11 game, audio WAV thật, fullscreen, tự chuyển, trộn, hover/reduced motion, loading/error/empty, gửi lại cùng run và chơi lại. Tương phản nút/gradient tối thiểu 4,98:1; không có runtime exception.
- Localhost: mở bộ từ hiện có từ trang chủ, xem desktop/mobile, đọc các trang Starters/IOE/Speaking; không phát sinh API ghi. Báo cáo `.data/vocab-theme-live-report.json`.

Harness flashcard trước đây chờ font Google bị mạng chặn và khởi động/reload chồng nhau. QA hiện bỏ riêng import font từ xa khỏi CSS phục vụ trong fixture (không sửa CSS ứng dụng), điều hướng sau khi CDP sẵn sàng và phục vụ font/asset cục bộ. Không giảm assertion bố cục/tương phản. Full-shell fixture cần tối thiểu bốn từ khác nghĩa để chạy Ai là triệu phú; đổi bộ dữ liệu fixture phải remount như khi mở bài khác, vì deck hiện có được khởi tạo khi mount.

Checklist `docs/vocab-theme-checklist.md`; ảnh/báo cáo `.data/vocabulary-theme-verification/browser-report.json`, `.data/flashcard-verification/browser-report.json`, `.data/vocab-theme-final-report.json`. Rollback source theme/hook/flashcard sau khi bảo vệ thay đổi mới, rồi build lại; không phục hồi đè dữ liệu. Chưa deploy production.
