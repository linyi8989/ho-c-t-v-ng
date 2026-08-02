# Triển khai Listening Smart Editor

## 1. Biến môi trường

Các biến bắt buộc của Listening hiện hữu vẫn giữ nguyên:

```env
LISTENING_MEDIA_DIR=/duong-dan-persistent/listening-media
LISTENING_TICKET_SECRET=<chuoi-bi-mat-du-manh>
```

Bật/tắt Smart Import:

```env
LISTENING_SMART_IMPORT_ENABLED=true
```

Đặt `false` sẽ vô hiệu hóa endpoint phân tích và các nút phân tích, nhưng editor thủ công, upload media, player, grader và lịch sử vẫn hoạt động.

Để đọc ảnh bằng AI, cấu hình ít nhất một provider:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1
```

Thứ tự chạy là Gemini trước, OpenAI sau. Khi không có cả hai key, Part 2/3 vẫn có thể parse pasted text cục bộ; Parts 1/4/5 không chạy phân tích ảnh và giáo viên vẫn soạn tay được.

Không đưa key vào biến `VITE_*`, frontend hoặc log. Thư mục `LISTENING_MEDIA_DIR` phải nằm ngoài thư mục release và được mount persistent; ảnh crop Part 2/4 cũng được lưu tại đây.

## 2. Build và kiểm tra trước deploy

```bash
npm ci
npm run lint
npm run test:listening
npm run test:legacy-contracts
npm run build:history-ui
```

`better-sqlite3` phải được cài/rebuild bằng đúng major Node của host (`package.json` yêu cầu Node 22.x). Không deploy nếu native module báo sai `NODE_MODULE_VERSION`.

## 3. UAT tối thiểu

1. Đăng nhập teacher và mở editor Mover cũ; xác nhận bộ đề legacy vẫn hiển thị/sửa được.
2. Tạo draft mới và upload ảnh tại từng Part; xác nhận audio không xuất hiện trong danh sách nguồn gửi phân tích.
3. Chạy Smart Import riêng từng Part; kiểm tra nút X chỉ bỏ ảnh khỏi lần phân tích hiện tại và không xóa media dùng chung. Resource Tray/phân tích toàn đề hiện là đường rollback bị ẩn khỏi tab Chung.
4. Duyệt candidate, chỉnh thủ công và apply; undo/redo phải hoạt động. Đổi Part sau khi analyze phải làm candidate stale và bị chặn apply.
5. Part 1/5 không được apply khi chưa xác nhận đủ năm mapping. Vùng chỉ kéo được, không resize.
6. Part 3 phải giữ board A-F nguyên ảnh. Part 4 phải sinh đủ 15 ảnh crop. Part 5 chỉ cho chọn catalog 20 màu.
7. Mở cùng draft ở hai tab; tab revision cũ phải nhận conflict thay vì ghi đè.
8. Publish, làm bài bằng học sinh, kiểm tra điểm và chi tiết từng câu trong Lịch sử học tập.

## 4. Rollback

Rollback nhanh không cần đổi schema:

```env
LISTENING_SMART_IMPORT_ENABLED=false
```

Khởi động lại server sau khi đổi biến. Đây là thay đổi additive: published snapshot cũ không bị viết lại; Part 3 không có `displayMode` tiếp tục được hiểu là `split`, còn màu legacy vẫn được hiển thị dù không thuộc catalog mới.

## 5. Chế độ local không cần đăng nhập

Chỉ dùng trên máy phát triển:

```bash
npm run dev:local
```

Lệnh này dùng SQL.js và dữ liệu riêng trong `.data/`, đồng thời đăng nhập giả lập bằng quyền `super_admin` tại `http://localhost:3000`. Không thêm `LOCAL_AUTH_BYPASS_ENABLED` hoặc `VITE_LOCAL_AUTH_BYPASS_ENABLED` vào cấu hình host. Backend chủ động từ chối khởi động nếu bypass được bật cùng `NODE_ENV=production`.
