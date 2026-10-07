# Speaking: lượt thu mới và khôi phục lượt quá hạn — 2026-10-05

Mục tiêu: khi bấm Thu âm, kiểm tra lượt thu với server và mở lượt hợp lệ nếu lượt chuẩn bị cũ đã hết hạn; không bắt học sinh reset thủ công, không mất tiến độ/điểm/bản thu đang gửi.

## Trước sửa

- [x] Đọc quy tắc, CODEMAP, source/API/service/session/types/styles/tests và worktree; giữ thay đổi có sẵn.
- [x] Baseline 49 Speaking tests đạt.
- [x] Dữ liệu local chỉ đọc: một session mở 2026-10-04; hai attempt prepared chưa có audio đã 24,9 giờ; bốn attempt completed mới giữ điểm. Chưa có session mới trong DB.
- [x] Snapshot source và native backup quick_check=ok: `.data/speaking-attempt-before`.

## Trong sửa

- [x] Server trả trạng thái cho phép thu, tính bằng đồng hồ server; không nới thời hạn upload/ticket hay đổi schema.
- [x] Nút Thu âm kiểm tra lượt hiện tại và chuẩn bị lượt mới khi cần; retry cùng prepare ID nếu response bị mất, không reset các mục khác.
- [x] Giữ WAV/ticket khi upload lỗi; không tự gửi lại/gọi provider thêm, không đổi điểm/lịch sử.
- [x] Regression SDK-independent: expired/current/client clock/retry/owner/session/snapshot/History, cả bộ và bài cũ.

## Sau build

- [x] Test phù hợp, lint/build/native startup và hai bundle smoke.
- [x] Browser compiled: expired restored item, chuyển thẻ/quay lại/reload/lượt bộ mới, retry/micro/auto-upload/review cũ; desktop/mobile/focus/contrast.
- [x] Bản sao production-shaped và hash DB live giữ dữ liệu cũ.
- [x] Restart localhost, xác minh source/capability/GET thực tế, cập nhật CODEMAP/setup/verification/artifact, xem diff.

Kết quả: full phase3 **596 pass / 0 fail**, gồm 53 Speaking tests; lint, canonical build, native startup và hai bundle smoke đạt. Browser xác nhận Thu âm tự thay lượt prepared hết hạn, giữ điểm mục khác và dùng lại lượt hợp lệ dù đồng hồ client nhanh hai ngày. Bản sao giữ nguyên sáu snapshot cũ/bốn kết quả; live DB giữ hash 58 bảng/1.330 hàng, quick_check=ok. Không ghi QA vào DB live hoặc gọi provider.

Bằng chứng: `.data/speaking-home-final-report.json`, `.data/speaking-attempt-copy-report.json`, `.data/speaking-attempt-db-report.json`, `.data/speaking-verification/browser-report.json`; diễn giải tại `docs/speaking-verification.md`.
