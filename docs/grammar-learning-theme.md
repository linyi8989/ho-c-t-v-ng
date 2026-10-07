# Giao diện làm bài ngữ pháp và tự luận

`GrammarLearningArea` dùng root `#grammar-learning-root` và CSS riêng `GrammarLearningTheme.css`. Theme theo ảnh mẫu: nền trời/cây/lâu đài đã duyệt, header có tên bài và danh tính B, khung xanh kem, câu hỏi nổi nhẹ, phương án A–D và nút điều hướng cùng phong cách. Tự luận dùng cùng khung, có nhãn và ô nhập nhiều dòng, nút gửi đáp án. Lobby, trạng thái hồ sơ, lỗi, phản hồi, xem lại và lịch sử dùng chung theme.

Nền `public/assets/backgrounds/bg-starter-exam-v1.webp`, atlas sao `public/assets/vocabulary/vocab-decoration-atlas-v1.webp` và Nunito local được tái sử dụng, không tạo thêm asset/provider/storage. Chữ dài xuống dòng và khung tăng chiều cao; textarea được kéo giãn dọc. Mobile sắp lại header và giảm cỡ chữ/gutter, vẫn giữ nút ít nhất 44px. Focus rõ, lựa chọn có `aria-pressed`, lỗi có `role=alert`, tiến độ/chờ lưu/phản hồi có trạng thái đọc được. Reduced motion bỏ hiệu ứng hover.

Toàn bộ state, xác minh danh tính, share token, câu hỏi/phương án và callback trước JSX giữ nguyên so với snapshot. Luồng `prepare → activate/save answer → submit → review/history`, điểm, giới hạn lượt, khóa đáp án sau phản hồi tức thì và chính sách xem lời giải tiếp tục do B quyết định. CSS dùng hook semantic và trạng thái đáp án; bỏ class màu Tailwind `!important` cũ vì chúng ghi đè chữ/nền trong theme. Không sửa CSS toàn cục hoặc backend.

Kiểm chứng ngày 2026-10-06:

- Baseline 32 test ngữ pháp/import, router/library, runs và legacy integration đạt. Sau sửa, thêm identity/history/vocabulary: tổng 93 test đạt.
- `npm run lint`, build chuẩn Node 22.16.0 và `npm run test:startup` đạt. Chỉ còn cảnh báo chunk lớn đã có; chưa deploy production.
- `node scripts/grammar-theme-browser-smoke.mjs`: component thật với API fixture cô lập, sáu chiều rộng 1774/1440/1024/620/390/320px; font/nền/khung/touch/overflow và tương phản nút/gradient >=4,87:1. Kiểm tra native Enter trên phương án, selected/disabled/loading, phản hồi đúng/sai và khóa đáp án, prev/next, lỗi prepare/save/submit và retry, review/history, tự luận nhiều dòng/giữ chữ khi lỗi, chính sách ẩn lời giải, lượt làm mới có run khác, câu rất dài, trạng thái hồ sơ, hover/reduced motion và thoát. Zero runtime exception; chạy lại sau build đạt.
- Local mở bộ trắc nghiệm công khai hiện có từ Home, xem desktop/mobile và đọc các trang từ vựng/Starters/IOE/Speaking, zero API ghi/exception. Local hiện không có bộ tự luận công khai để mở qua Home; luồng tự luận được kiểm tra bằng fixture riêng, không seed bài vào kho thật.
- Hash server, grader/router/service, CSS toàn cục, từ vựng/Starters và hai asset giữ nguyên. Client có History và theme, không chứa fixture; không thiếu tham chiếu chunk.

QA giữ nguyên assertion hành vi/tương phản. CDP gửi Enter với ký tự carriage return để kích hoạt hành vi native của button; kiểm tra tải Home chờ directory/dữ liệu sẵn sàng. Các thay đổi này thuộc harness, không sửa luồng ứng dụng. Remote Google-font import chỉ được loại trong CSS phục vụ fixture và bị chặn khi kiểm tra local; font của theme vẫn là file local đã có.

Checklist `docs/grammar-theme-checklist.md`; snapshot `.data/grammar-theme-before`; bằng chứng `.data/grammar-theme-final-report.json`, `.data/grammar-theme-live-report.json`, `.data/grammar-theme-verification/browser-report.json` và `.data/grammar-theme-*.log`. Rollback source sau khi bảo vệ thay đổi mới rồi build lại, không khôi phục đè database. Không commit/push/deploy.
