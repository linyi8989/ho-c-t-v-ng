# Nền minh họa trên trang dài

`src/styles/storybook-background.css` được nhập từ sáu stylesheet theme. Các root History, từ vựng, ngữ pháp/tự luận, Speaking, IOE/Violympic, Starters đang làm và màn chuyển/tổng kết/kết quả dùng chung một lớp cảnh nền.

Nguyên nhân cũ: History vẽ ảnh một lần với `100% auto`, mobile giới hạn ảnh ở 680px. Sau độ cao ảnh, danh sách còn tiếp tục nhưng chỉ thấy gradient nền. Ngữ pháp/từ vựng có quy tắc tương tự trên mobile hoặc kéo ảnh bằng `100% 100%` trên desktop. Starters cũng kéo ảnh theo chiều cao bài; Speaking và các màn kết quả dùng `background-attachment: fixed` nhưng đổi sang scroll trên mobile.

Root mới có `isolation: isolate`; `::before` dùng `position: fixed`, `inset: 0`, ảnh `center / cover`, `z-index: -1` và `pointer-events: none`. Ảnh giữ tỉ lệ, phủ kín viewport ở mọi vị trí cuộn; chiều cao nội dung tăng độc lập. Không dùng lại cảnh liên tiếp, không kéo méo hoặc tạo đường nối ảnh. Cơ chế này không phụ thuộc hỗ trợ `background-attachment: fixed` trên thiết bị di động. Tiêu đề Starters tiếp tục trong suốt.

Bản đồ đảo `/exams` và các sân chọn bài của bảy cấp vẫn giữ ảnh trong canvas đúng tỉ lệ vì vị trí nhà, biển và link gắn theo tọa độ ảnh. Không áp dụng nền cố định vào những cảnh tương tác đó. Admin, Home, API, trạng thái làm bài, số liệu, tọa độ hitbox và dữ liệu lưu không đổi.

Kiểm tra: `scripts/storybook-background-browser-smoke.mjs` tái hiện baseline History với 20 lượt; kiểm tra bảy root ở 1440×1000, 1024×768, 390×844, 320×568 và 844×390, tại đầu/giữa/cuối trang. History là component thật với API GET fixture; các root còn lại dùng CSS thật và nội dung dài cô lập. Ảnh chụp lớp nền giữ nguyên pixel ở cạnh khi cuộn (ẩn nội dung con chỉ cho phép so sánh ảnh, không thay chiều cao trang). Modal History và nút vẫn tương tác được. Các bộ browser History, từ vựng, ngữ pháp và kết quả giữ kiểm tra hành vi/tương phản; assertion ảnh nay đọc lớp `::before` đang được vẽ.

Bằng chứng: `.data/storybook-background-verification/browser-report.json`, các screenshot, `source-diff.txt`, `artifact.json` và log `.data/storybook-background-*.log`. Snapshot source `.data/storybook-background-before`; rollback chỉ các thay đổi CSS/kiểm tra này sau khi bảo vệ chỉnh sửa mới, rồi build lại. Không khôi phục database hoặc xóa WAL.
