# Speaking: lưu nháp, xuất bản và Azure audio mẫu — 2026-10-04

## Trước sửa

- [x] Đọc quytac.md, CODEMAP/package, source/type/validation/API/storage/UI và tài liệu liên quan; nhận diện worktree có sẵn, không commit/push.
- [x] Backup native SQLite: `.data/backups/before-speaking-editor-azure/local-test-2026-10-04T12-16-30-814Z.sqlite`, quick_check=ok; backup source mục tiêu.
- [x] Baseline API localhost: kho Speaking 0 bài, Azure chấm đã cấu hình, TTS B thiếu key. Chưa viết dữ liệu thử vào DB người dùng.
- [x] Tái hiện trong browser/DB cô lập: 12 câu nhập dưới dạng Từ vựng bị validation từ chối; lỗi nằm ngoài viewport phía trên form, không có bản nháp. Log `.data/speaking-editor-browser-baseline.log`.
- [x] Chốt yêu cầu: giữ hai nút, sửa điều kiện; dùng key Azure hiện có cho audio mẫu.

## Trong sửa

- [x] Lưu nháp: validation chung trước API; lỗi cạnh nút lưu, focus tới phản hồi, giữ nội dung; thành công tải lại kho trang 1/bỏ tìm kiếm, trạng thái Bản nháp.
- [x] Xuất bản: tự lưu bài mới/nội dung thay đổi, dùng revision trả về; bản published không thay đổi khóa nút, không tạo bài trùng.
- [x] Azure TTS chỉ bật cho reading mẫu bằng flag explicit; B cũ mặc định. Dùng SDK sẵn có, cache/hash/atomic-write/in-flight/rate-limit của B.
- [x] Không đổi schema/auth/grader, provider từ vựng/game, published session/History; không thêm kho media hay fallback trả phí.
- [x] Unit/HTTP regression: secret sanitization, key/region/locale/voice, timeout/close, MP3/dung lượng, quyền/rate limit, B provider giữ nguyên. 43 pass/0 fail, `.data/speaking-editor-narrow.log`.
- [x] Cập nhật `.env.speaking.example`, hướng dẫn cấu hình/audio/lưu nháp.

## Sau sửa và build

- [x] Browser compiled client + native backend cô lập: lỗi 12 câu, lưu nháp/kho/reload, direct publish/republish không trùng, desktop/mobile/contrast/focus, luồng học/History cũ. 0 browser exception; contrast >=5.78:1; `.data/speaking-editor-browser.log` và `.data/speaking-verification/browser-report.json`.
- [x] Gate đầy đủ Node 22 `npm run test:phase3`: 578 pass/0 fail, typecheck, regression cũ, build canonical, startup. Log `.data/speaking-editor-phase3.log`. Typecheck đã phát hiện truy cập test payload `unknown`; sửa assertion kiểm tra toàn payload rồi chạy lại gate đầy đủ.
- [x] Post-build Speaking + IOE bundle smoke pass; flashcard 24 case pass, known/unknown completion 50/1/1 và contrast >=5.12:1. Log `.data/speaking-editor-bundle.log`, `.data/speaking-editor-competition.log`, `.data/speaking-editor-flashcard.log`.
- [x] `.env` local bật `SPEAKING_SAMPLE_TTS_PROVIDER=azure`; restart Node 22/native WAL. Lần thử ban đầu timeout do sandbox chặn outbound EACCES; kiểm tra ngoài sandbox voices API 200, chạy lại localhost có kết nối Azure. Không sửa key hoặc tắt kiểm tra TLS.
- [x] Azure thật: POST mẫu `apple` 200/1715ms, MP3 15.264 byte, GET audio 200/audio-mpeg; request lặp cached=true, URL giống nhau. UI thật: nút Tạo audio mẫu mở khi có nội dung, hiện audio + thông báo thành công, Xuất bản enabled; trình duyệt decode 1.908 giây/readyState=4/error=null. Log `.data/speaking-editor-azure-live.json`; ảnh `.data/speaking-verification/azure-local-editor.jpg`. Tab kiểm thử đã đóng, không tạo bài thử trong DB người dùng.
- [x] DB native quick_check=ok/WAL; toàn bộ 1244 dòng gốc còn nguyên. Có 30 câu/30 version/1 import IOE được thêm đồng thời trong lúc kiểm tra; các bảng cũ khác giữ hash, lần sửa chỉ gửi mẫu audio/read vào localhost. Không suy ra toàn DB không đổi khi có hoạt động đồng thời. Báo cáo `.data/speaking-editor-db-after.json`.
- [x] Review desktop/mobile screenshots, diff, UTF-8, artifact hash/CODEMAP; diff-check pass. Manifest `.data/speaking-editor-build-manifest.json`: index-C384FLZ5.js/index-UiZPLWL7.css, 74 JS/CSS assets, server 1.459.701 byte/SHA256 8e69f6860152040353129a4e5bbf08908f20b7813f1c59d41b89ef32c36bcbc8.

Phạm vi xác minh thật: Azure audio mẫu en-US đã hoạt động; giọng en-GB có trong danh sách được resource cấp quyền, adapter được unit/HTTP test nhưng chưa tạo file thật en-GB. Lần này không thu/chấm giọng học sinh thật hoặc gọi LLM/SpeechSuper. Không deploy production, commit/push.

Rollback cấu hình: đổi `SPEAKING_SAMPLE_TTS_PROVIDER=b` rồi restart; cần key B nếu tạo audio. File Azure đã tạo vẫn dùng `/audio` của B. Không có migration dữ liệu trong lần sửa này.
