# Nền làm bài cho toàn bộ cấp thi

Ngày: 2026-10-11. Phạm vi: giữ nền minh họa Starter hiện có và áp dụng vào lúc học sinh làm bài Movers A1, Flyers A2, KET A2 Key, PET B1 Preliminary, FCE B2 First, IELTS Academic.

## Thiết kế và phạm vi

- StudentExamAttemptShell nhận tùy chọn background độc lập với theme Starter. Các cấp còn lại giữ kiểu control, câu hỏi, chấm điểm, state và lưu bài hiện tại.
- GenericExamLearningArea bao phủ Listening, Reading/Reading & Writing/Reading & Use of English và Writing tương ứng với các paper đang hỗ trợ. Movers Listening và Reading & Writing được bật riêng ở player legacy.
- Nền cố định phủ viewport khi cuộn; lớp trang trí không nhận click. Nội dung câu hỏi có nền sáng. Không sinh thêm ảnh hay bản sao ảnh cho từng cấp.
- Đề Movers Listening có ảnh nền riêng tiếp tục dùng URL và gradient do giáo viên đã cấu hình.
- Trang chọn cấp/sân/bản đồ giữ canvas và tọa độ tương tác hiện tại; Writing độc lập giữ giao diện đang làm hiện tại. Màn bắt đầu/kết quả của các cấp vốn đã dùng nền minh họa chung.

## Checklist

- [x] Đọc quy tắc, CODEMAP, package, source/CSS/test liên quan; nhận diện thay đổi có sẵn.
- [x] Lưu snapshot source trước sửa tại .data/exam-background-all-qa/before.
- [x] Tái hiện phạm vi cũ: active player chỉ có theme Starter được bật nền. Baseline 33 test pass.
- [x] Bật nền qua khung chung và ba player hiện có, không sửa schema/API/validation/grader.
- [x] Giữ ảnh nền tùy chọn của Movers Listening; sửa CSS nhiều lớp sau khi computed style tái hiện image=none.
- [x] 46 test liên quan exam platform, identity, Movers contrast và Listening answer moves pass.
- [x] TypeScript noEmit pass.
- [x] Kiểm tra 19 component player thật, 4 viewport mỗi player: 1440×960, 1024×960, 390×844, 320×844. Bao gồm 18 player các cấp thi và 1 Writing độc lập để kiểm tra giới hạn phạm vi.
- [x] Kiểm tra bắt đầu, chuyển Part/trạng thái chọn, focus, contrast control >=4.5:1, nút >=40px, không tràn ngang, nền cố định ở trang dài.
- [x] Kiểm tra ảnh nền riêng + gradient, nhập câu trả lời/cập nhật tiến độ, lỗi submit 503 giữ player. API fixture có chủ ý, không chứng minh việc chấm bài thật; logic đó không đổi.
- [x] Xem screenshot desktop/mobile: Movers, Flyers, PET, IELTS và đề có nền riêng. Fixture default có ô ảnh/nội dung chưa soạn; dùng để kiểm tra bố cục, không phải đề đã xuất bản.
- [x] Bộ nền dùng chung pass: 105 trạng thái root/viewport/vị trí cuộn; kiểm tra History modal và pixel nền ở cạnh đầu/cuối trang.
- [x] Build chuẩn npm run build pass; kiểm tra toàn bộ 122 đường dẫn/byte/SHA-256 của manifest, hook nền mới, ảnh WebP và History navigation.
- [x] Browser cuối sau build không có runtime exception.
- [x] Local 127.0.0.1:3000 phục vụ source/nền mới HTTP200 với Node22/native SQLite, seed tắt.
- [x] Soát diff/check và cập nhật CODEMAP trước bàn giao.

## Bằng chứng và bản build

Bằng chứng nằm trong .data/exam-background-all-qa: baseline-tests.log, tests.log, typecheck.log, browser-final.log, browser-report.json, shared-background-report.json, build.log, artifact-final.json và screenshots. Browser tạo máy chủ/API fixture và profile Chrome riêng; không sửa bài hoặc attempt trong database người dùng.

Release ID: 61548b123fa770a98fe233e8ce978c0910a0ee11797324b15ce176093b55001f. Chunk bài thi: clientRegistry-CoWWXhJr.js, clientRegistry-BA2lGOAk.css. Server giữ nguyên 1.644.314 byte / SHA-256 d0901939695a641bbf7414d297f45ed24c2a71f825b94e0b61080863054856f2. Build còn cảnh báo kích thước chunk Vite đã có; không thay đổi chiến lược chia bundle trong yêu cầu này.

## Bàn giao và rollback

Thử lại trên local bằng cách tải lại trang, mở một bộ đề của các cấp và bắt đầu làm bài. Chưa commit/push/deploy hosting; không có biến môi trường hoặc migration mới. Khi deploy dùng artifact build chuẩn gồm client/assets nền.

Rollback chỉ thay đổi nền của khung/player/CSS nêu trên sau khi bảo vệ mọi sửa mới, rồi build lại. Giữ toàn bộ các thay đổi trước đó về maintenance, autosave/session và nhập câu hỏi ngữ pháp. Không khôi phục database, không xóa WAL hay dữ liệu làm bài.
