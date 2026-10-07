# Checklist thu gọn link Starters và mô phỏng hai sân

Phạm vi: giữ mẫu bảng gỗ đã được duyệt; thu gọn khoảng 8–10% trên desktop, hover nhẹ, mỗi sân hiện 5 bài và cuộn độc lập. Mô phỏng local 25 bài mỗi sân, không lưu vào kho hay tạo bộ đề thật.

- [x] Đọc quy tắc, source, CSS toàn cục, API/types, kiểm thử và tình trạng Git; lưu snapshot trước sửa.
- [x] Baseline: 19 test Starter/library/navigation/admin đạt.
- [x] CSS chỉ giới hạn Starter; desktop nhỏ hơn, mobile giữ vùng bấm 44px.
- [x] Hover nhẹ, không gạch chân/bóng mới; giảm chuyển động theo thiết lập hệ thống.
- [x] Local preview có nhãn rõ, 25 bài mỗi sân, không gọi API catalog/ghi DB/chơi bài giả; production không chứa dữ liệu mô phỏng.
- [x] Kiểm tra trình duyệt: 5 thẻ mỗi sân, bánh xe chuột, cuộn tới cuối cả hai sân, tên dài và số nhiều chữ số.
- [x] Kiểm tra desktop/mobile, font/tương phản thực, keyboard/focus, player và danh sách quản trị cũ.
- [x] Test sau sửa, typecheck và build chuẩn Node 22 đạt; History vẫn có trong artifact.
- [x] Mở local preview và xem trực quan; xác nhận danh sách thật/API/backend/asset nền giữ nguyên.
- [x] Review diff, cập nhật tài liệu/CODEMAP và ghi bằng chứng sau build.

Kết quả 2026-10-06: baseline/final 19 test, lint và build đạt. Browser compiled kiểm tra 1440/1280/1024/390/320px, hover thường/giảm chuyển động, 0/3/25/31 bài, cả hai player và quản trị; zero exception. Preview thực trên localhost có 25/25 bài, 5 thẻ mỗi sân, wheel/end tới số 25, Enter không mở bài giả; catalog thật vẫn 1 Listening/0 R&W. Tương phản chữ trên gỗ tối thiểu 6,26:1. Server, ba ảnh cảnh gốc và art giữ hash. Production có 78 JS/CSS, không thiếu reference, có History và không chứa helper/dữ liệu preview. Chunk-size warning có sẵn, không có lỗi build; chưa deploy.

Bằng chứng: `.data/starter-compact-final-report.json`, `.data/starter-compact-live-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-compact-{baseline,tests,lint,build,browser,live}.log` và ảnh `.data/starter-compact-preview-*.png`. Bản mô phỏng: `http://localhost:3000/exams/starter?preview=links`; bài thật: `http://localhost:3000/exams/starter`.

Rollback: phục hồi riêng source đã sửa từ `.data/starter-compact-before` sau khi kiểm tra thay đổi phát sinh, rồi build lại. Không phục hồi hoặc xóa database để rollback giao diện.
