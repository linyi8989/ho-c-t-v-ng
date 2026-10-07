# Lịch sử học tập — giao diện storybook

Trang `/history` dùng nền trời/cây/lâu đài, font Nunito tự lưu trong dự án, khung kem viền xanh và nút bo nổi giống các trang học sinh đã duyệt. Icon sách lấy từ atlas từ vựng hiện có; không tạo hoặc tải asset mới.

Nền phủ kín viewport bằng lớp cố định, giữ tỉ lệ ảnh khi danh sách cuộn dài; không giới hạn ở độ cao ảnh đầu trang. Cơ chế và kiểm tra chung tại [storybook-background.md](storybook-background.md).

Chín số liệu tổng hợp giữ nguyên cách tính/định dạng. Desktop dùng bảng; dưới 1024px dùng thẻ. Tên bài và dữ liệu dài được xuống dòng, không cắt điểm hoặc tạo cuộn ngang. Điểm Writing riêng vẫn hiển thị thang `/10`, các lượt khác giữ thang `/100` theo logic hiện có.

Khung chi tiết dùng cùng màu/viền, có vùng nội dung cuộn riêng và nút đóng cố định ở header. Giữ mở bằng Enter, đóng bằng Escape, khóa focus trong modal và trả focus về đúng nút đã mở. Trạng thái tải/lỗi/thử lại/rỗng và khôi phục hồ sơ cũng có cùng giao diện. Hiệu ứng hover nhẹ bị tắt khi hệ điều hành yêu cầu giảm chuyển động.

Phạm vi chỉ presentation hooks và `HistoryTheme.css`, giới hạn trong `#student-history-page[data-history-theme="storybook"]`. Không sửa API, token/guest capability, nguồn dữ liệu, parser, số liệu, phân trang, review policy hoặc adapter chi tiết Listening/R&W/Speaking/IOE. Panel lọc nâng cao vẫn ẩn theo thiết kế hiện có; backend và state filter giữ nguyên.

## File thay đổi

- `src/components/history/StudentHistoryPage.tsx`: import theme, root opt-in và các class trình bày.
- `HistorySummary.tsx`, `HistoryList.tsx`, `HistoryRow.tsx`, `AssignmentHistoryGroup.tsx`: class riêng cho summary/table/card/badge/group; không đổi nội dung hoặc callback.
- `HistoryDetailModal.tsx`: class cho khung/header/summary/entry/trạng thái; không đổi focus, formatter hoặc bộ review từng module.
- `src/components/history/HistoryTheme.css` (mới), `scripts/history-theme-browser-smoke.mjs` (mới).
- `package.json`: thêm `test:history-browser`; `CODEMAP.md`, tài liệu này và checklist.

Kiểm tra bằng `npm run test:history`, `npm run test:history-browser`, `npm run lint`, `npm run build` với Node 22. Browser fixture dùng component thật, API/auth fixture cô lập, không ghi database thật. Bộ kiểm tra local chỉ đọc dữ liệu hiện có. Bằng chứng tại `.data/history-theme-*` và `.data/history-theme-verification/browser-report.json`.

Local ban đầu trả `LEARNING_HISTORY_DISABLED` vì server chưa bật runtime flag. Đã kiểm tra GET trên bản sao native của backup (200, toàn bộ bảng giữ nguyên hash), rồi mở lại process local với `LEARNING_HISTORY_ENABLED=true`, `SEED_DATA_ENABLED=false` và `dev:local:native`. Trang thật tải danh sách/chi tiết 200 ở 1440/390/320px, không ghi API và không có lỗi browser. Không chỉnh `.env` hoặc cấu hình production. Khi tự mở lại local, dùng Node 22 và PowerShell:

```powershell
$env:LEARNING_HISTORY_ENABLED = 'true'
$env:SEED_DATA_ENABLED = 'false'
npm run dev:local:native
```

Đối chiếu dữ liệu thật không quiescent: thêm 8 row thuộc lượt/phiên/chi tiết IOE và 1 attempt/job Speaking chuyển từ assessing/running sang failed ngay sau backup. Các thay đổi này xảy ra trước kiểm tra local, không phát sinh từ GET History. 53/58 bảng giữ nguyên hash; bản sao kiểm thử giữ nguyên toàn bộ 58 bảng. Không restore đè dữ liệu mới hoặc xóa sidecar WAL. Báo cáo `.data/history-theme-db-report.json` giữ kết quả so sánh thô `unchanged=false`, và `.data/history-theme-db-delta.json` giải thích chính xác phần khác nhau.

Rollback: bảo vệ thay đổi mới rồi phục hồi source tại `.data/history-theme-before` và build lại bằng script chuẩn. Không restore đè database. Không deploy trong lần thay đổi này.
