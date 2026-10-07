# Speaking / Luyện đọc — checklist triển khai

Phạm vi: Azure chính, SpeechSuper đối chứng; thu PCM/WAV, quality gate, chấm backend,
job bền vững, feedback riêng, dashboard và Learning History của B. Không thay grader Speaking cũ.

## Trước triển khai
- [x] Đọc yêu cầu UTF-8, quytac.md, CODEMAP, package và các điểm nối trực tiếp.
- [x] Ghi nhận worktree có thay đổi IOE/FCE trước lượt này; không reset/ghi đè.
- [x] Node 22: typecheck pass; 27 test identity/history/legacy pass.
- [x] Sao lưu database local vào `.data/backups/before-speaking-20261004.sqlite`.
- [x] Người dùng xác nhận chưa có API key: không gọi provider thật, không tạo điểm giả.

## Trong triển khai
- [x] Migration bổ sung, lặp an toàn, thử native SQLite và SQL.js trên dữ liệu có sẵn.
- [x] Nội dung có phiên bản, quyền sở hữu, tìm kiếm và archive.
- [x] Thu âm, resample PCM16/16kHz/mono, nghe lại, quality gate, audio riêng tư.
- [x] Signed attempt, idempotency, quota, job lease/recovery và lỗi không thành điểm 0.
- [x] Azure ngắn/continuous, SpeechSuper, chuẩn hóa và căn chỉnh thiếu/thừa/lặp từ.
- [x] Feedback LLM độc lập, tận dụng backend Gemini/DevQuota/Stali B, không thay điểm kỹ thuật.
- [x] Student, admin, kết quả và Learning History dùng chung.
- [x] Bộ benchmark và hướng dẫn cấu hình không chứa secrets.

## Sau triển khai / build
- [x] Test hẹp Speaking: validation, WAV, provider fixtures, HTTP, ownership, recovery, History.
- [x] Quality gates hiện có, typecheck, build Node 22 và startup artifact production.
- [x] Browser QA desktop/mobile, các trạng thái và computed contrast.
- [x] Hồi quy B và diff check; ghi artifact/hash, giới hạn còn chưa xác minh.
- [ ] Chấm giọng thật và hiệu chỉnh giáo viên: CHƯA THỰC HIỆN; local đã nhận cấu hình Azure + DevQuota nhưng chưa gửi bản thu thật tới dịch vụ.

Không commit/push/deploy production trong công việc này.

Kiểm chứng bản module ban đầu: 553 pass / 0 fail, 18 Speaking tests, build/startup/bundle/browser QA pass. Đối chiếu database local: 51 bảng và 1226 hàng cũ giữ nguyên. Chi tiết: docs/speaking-verification.md. Local dùng Node 22 + native SQLite, mở tại http://localhost:3000.

## Bổ sung Azure + LLM của B (2026-10-04)

- [x] Trước sửa: 18 kiểm thử Speaking cũ đạt; xác định `.env` gốc và resolver key DevQuota/Stali của B.
- [x] Nối nhận xét metrics qua đúng gateway được chọn; không gửi WAV/PII, không fallback hoặc đổi điểm Azure.
- [x] Chặn thiếu key, mode không hỗ trợ, URL/model lỗi, timeout và JSON không hợp lệ; giữ Gemini cũ tương thích.
- [x] Trong sửa: 27 kiểm thử Speaking đạt (18 cũ + 9 hợp đồng feedback).
- [x] Hướng dẫn cấu hình, file mẫu và local `.env` chọn DevQuota; giữ nguyên key sẵn có, Azure chờ người dùng điền.
- [x] Sau sửa: phase3 562 pass / 0 fail, typecheck/build/startup Node 22 và smoke artifact đạt.
- [x] Sau sửa: localhost đã khởi động lại; Azure + DevQuota configured, SpeechSuper unconfigured; desktop/mobile không lỗi hoặc tràn, contrast tối thiểu 5.78:1.
- [ ] Chấm Azure + DevQuota/Stali thật: chưa thực hiện; cần gửi bản thu từ giao diện để xác nhận key/quyền model và chất lượng.

## Bộ từ/câu và lỗi audio mẫu (2026-10-04)

- [x] Trước sửa: 27 Speaking tests đạt; tái hiện lỗi Tạo audio mẫu trả 500 do B TTS thiếu key.
- [x] Sao lưu native SQLite: `.data/backups/before-speaking-sets/local-test-2026-10-04T10-43-13-918Z.sqlite`; quick_check OK. Snapshot 56 bảng/1226 hàng cũ.
- [x] Migration additive: bảng session và hai cột liên kết nullable; giữ bài/kết quả legacy.
- [x] Editor nhiều từ/câu, nhập theo dòng, copy từ kho B, audio từng mục; không ghi vào kho từ B.
- [x] Signed attempt riêng từng mục, resume server, điểm tổng hợp khi đủ mục; lịch sử B một dòng mỗi bộ hoàn thành.
- [x] TTS báo thiếu cấu hình cụ thể, chặn nút cloud khi chưa cấu hình và nghe mẫu trên thiết bị.
- [x] Test mới: quyền/phiên bản/idempotency/đọc lại/lịch sử/media/TTS; native + SQL.js.
- [x] Typecheck và toàn bộ phase3, build/startup/bundle.
- [x] QA desktop/mobile, thu WAV, tiến độ từng mục, review và hồi quy IOE/History.
- [x] Đối chiếu 56 bảng cũ trên localhost sau migration, diff/UTF-8 và tài liệu cuối.
