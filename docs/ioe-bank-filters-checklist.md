# Bộ lọc Ngân hàng IOE/Violympic — 2026-10-05

Yêu cầu: mặc định không chọn môn/lớp/cấp, liệt kê toàn bộ câu theo quyền B; chỉ lọc khi giáo viên chọn. Năm thao tác môn/lớp/cấp/tìm kiếm/xóa cùng hàng trên desktop, tự xuống dòng trên mobile.

Nguyên nhân: Ngân hàng dùng chung `scope` và điều kiện khóa khi có bản nháp của Soạn JSON. API GET cũng bắt buộc đủ scope nên chỉ đổi giao diện sẽ chưa giải quyết được.

## Trước sửa

- [x] Đọc quytac.md, CODEMAP/package và source/type/API/test trực tiếp; ghi nhận worktree có sẵn và giữ nguyên thay đổi ngoài phạm vi.
- [x] Baseline competition: 11 pass, 0 fail trên Node 22/native SQLite.
- [x] Sao lưu các source đích vào `.data/ioe-bank-filters-before`.
- [x] Chốt phạm vi: bộ lọc/UI/truy vấn đọc; không đổi schema, engine, tài khoản, provider hay dữ liệu thật.

## Trong sửa

- [x] State Ngân hàng độc lập, ba giá trị mặc định rỗng; API hỗ trợ bỏ trống và lọc từng điều kiện.
- [x] Giữ quyền giáo viên chỉ quản lý câu của mình, super_admin toàn bộ; giữ phân trang 30 câu, tìm kiếm literal và bỏ câu đã lưu trữ.
- [x] Bản nháp không khóa bộ lọc Ngân hàng; Soạn JSON vẫn giữ scope đang soạn.
- [x] Sửa/sao chép từ ngân hàng tổng giữ scope của câu; không trộn vào bản nháp scope khác.
- [x] Xóa lựa chọn khi đổi bộ lọc/tìm kiếm/trang; chặn chọn/xóa dữ liệu cũ khi đang tải.
- [x] Toolbar desktop cùng hàng, mobile tự xếp; CSS giới hạn trong module.
- [x] Regression API/SQLite: 13 competition test đạt; rỗng/từng bộ lọc/quyền/search/phân trang/input lỗi; write vẫn cần scope hợp lệ.
- [x] Browser thật: mặc định/bản nháp/partial/search/empty/pagination/edit/copy/loading/error/focus, desktop/mobile và contrast.

## Sau build

- [x] 69 test đạt: competition 13, admin 16, History 34, legacy 6; typecheck, build chuẩn và startup native SQLite đạt.
- [x] Bundle IOE + Speaking và compiled browser flow cũ đều pass; 60 trạng thái, 0 browser exception, 978 control legacy giữ computed CSS.
- [x] Localhost chạy backend mới; kiểm tra ngân hàng thật chỉ đọc: mặc định 30 câu, GET không filter/rỗng tương đương, bản nháp không khóa lọc.
- [x] Kiểm tra diff, bổ sung tài liệu/CODEMAP và ghi artifact/evidence.

## Kết quả và bằng chứng

- Desktop 1440/1280px: đủ năm thao tác cùng hàng; mobile 390/320px: tự xếp, không tràn trang. Contrast control thấp nhất 6,70:1, focus 3px. Ảnh desktop và toolbar mobile đã xem lại.
- Native backup `.data/ioe-bank-filters-before/local-test-2026-10-05T14-45-46-513Z.sqlite`, quick_check=ok. Sau kiểm thử localhost, toàn bộ 58 bảng/1.330 dòng có hash giữ nguyên.
- Build chuẩn Node 22.16.0: entry `index-DUPuH_V-.js`, CSS entry `index-UiZPLWL7.css`, 76 JS/CSS; server 1.471.380 byte, SHA256 `47DCA3DB8928D710B6E1C8A8986CDB06123264360D27BC721644272B823B1B8B`. Cảnh báo chunk lớn có sẵn, không có lỗi build.
- Test log: `.data/ioe-bank-filters-{tests,admin-tests,history-tests,legacy-tests,final-lint,build,bundle,speaking-bundle}.log`.
- Compiled browser: `.data/ioe-bank-qa-lr9hCt/browser.log`, `.data/ioe-bank-filters-compiled-browser.log`, `.data/ioe-verification/browser-report.json`; SQLite/media fixture tách riêng.
- Local read-only browser: `.data/ioe-bank-filters-local-browser.log`, `.data/ioe-bank-filters-local-report.json`.
- Artifact/API/report: `.data/ioe-bank-filters-final-report.json`; bảo toàn dữ liệu: `.data/ioe-bank-filters-database-report.json`; diff đối chiếu checkpoint: `.data/ioe-bank-filters-source-diffs.log`.

Điều chỉnh kiểm thử có bằng chứng: wait “không có role=status” ban đầu nhầm thông báo lưu thành công với trạng thái đang tải; sửa để chờ đúng `p[role=status]`. Helper click kiểm tra nút và bấm trong cùng một evaluate để tránh React đổi disabled giữa hai lệnh CDP. Kiểm thử browser trên localhost được chạy sau khi fixture đã dừng để tránh trùng cổng WebSocket của Vite. Không bỏ qua assertion lỗi/contrast/luồng cũ.

Bank chỉ tải tự động khi mở tab Ngân hàng; thao tác lưu chủ động cập nhật bank sau khi hoàn tất. Soạn JSON không chạy thêm truy vấn lọc Ngân hàng gây khóa ngắn hạn ngoài ý muốn. Azure/DevQuota hiện có vẫn configured, không đổi key hay provider.

Không commit/push/deploy. Các test ghi dữ liệu chỉ dùng SQLite/media fixture riêng.
