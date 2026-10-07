# Checklist giao diện làm bài ngữ pháp và tự luận

- [x] Đọc quy tắc, source UI, type, router/service và CSS toàn cục; xác định thay đổi có sẵn.
- [x] Chụp snapshot source/hash và chạy baseline kiểm thử ngữ pháp, lượt làm và hợp đồng cũ: 32 đạt.
- [x] Theme giới hạn trong màn ngữ pháp: nền, header, khung, tiến độ, câu hỏi, phương án, ô tự luận và điều hướng theo ảnh mẫu.
- [x] Giữ nguyên danh tính/share/assignment, prepare/activate/save/submit/review/history và chính sách giải thích.
- [x] Kiểm tra desktop/mobile, câu dài, chọn đáp án, nhập nhiều dòng, loading/error/retry, đúng/sai, disabled, focus và reduced motion.
- [x] Test liên quan, lint, build Node 22, kiểm tra artifact và hash ngoài phạm vi.
- [x] Xem ảnh thực tế, review diff, cập nhật tài liệu/CODEMAP và bàn giao local.

Kết quả ngày 2026-10-06: 93 test đạt; lint, build Node 22.16.0 và native startup đạt. Browser trước/sau build kiểm tra 6 chiều rộng, cả trắc nghiệm/tự luận, chính sách phản hồi/xem lại và retry; tương phản nút/gradient >=4,87:1, zero exception. Hash business/server/grader/CSS ngoài phạm vi/asset giữ nguyên. Local đọc bộ trắc nghiệm hiện có và các route khác, zero API ghi. Local chưa có bộ tự luận công khai; dùng fixture riêng để kiểm tra, không seed kho thật. Build chỉ có cảnh báo chunk lớn đã có.

Bằng chứng: `.data/grammar-theme-final-report.json`, `.data/grammar-theme-live-report.json`, `.data/grammar-theme-verification/browser-report.json` và `.data/grammar-theme-*.log`. Tài liệu `docs/grammar-learning-theme.md`; CODEMAP mục 173.

Luồng hiện có: mở bộ ngữ pháp → danh tính B → prepare (chưa ghi lượt) → chọn phương án hoặc gửi câu tự luận → activate/save ở server → chuyển câu → submit → review và lịch sử hiện có. Quyền truy cập, đáp án, điểm và chính sách phản hồi thuộc backend. Giữ nguyên nội dung, trộn câu/phương án, giới hạn lượt và payload.

Phạm vi: `src/components/grammar/GrammarLearningArea.tsx` (hook trình bày/ARIA) và CSS theme riêng. Tái sử dụng nền/ảnh trang trí/font local đã duyệt. Không sửa grader, endpoint, schema, dashboard hay các module từ vựng/Listening/IOE/Speaking; không seed dữ liệu thật. Browser QA dùng fixture cô lập, local kiểm tra chỉ đọc/mở bộ có sẵn.

Rollback: bảo vệ chỉnh sửa mới, phục hồi source trong snapshot `.data/grammar-theme-before`, build lại bằng Node 22; không phục hồi đè database. Chưa deploy production.
