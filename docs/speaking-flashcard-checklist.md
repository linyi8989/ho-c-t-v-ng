# Luyện đọc từng thẻ và tự gửi bản thu — 2026-10-04

- [x] Đọc quytac, Student/useRecorder/audio, SampleAudio, review/types/API upload, FlashcardGame và browser fixture.
- [x] Giữ nội dung, provider Azure, chấm điểm, session/History và bài hội thoại/đoạn văn hiện có.
- [x] Mỗi từ/câu hiển thị trên một thẻ, tiến độ nhỏ, điều hướng trước/sau; bỏ lưới toàn bộ câu khi đang luyện.
- [x] Chữ vừa màn hình, khung tự tăng chiều cao, desktop/mobile 320px không cắt nội dung.
- [x] Dừng thu thủ công hoặc hết thời lượng → WAV hợp lệ tự gửi một lần; không cần bấm Gửi chấm.
- [x] Chặn gửi bản thu im lặng/vỡ âm; lỗi micro rõ ràng; dừng nghe mẫu khi thu.
- [x] Lỗi mạng giữ bản thu, cho nghe/tải/gửi lại thủ công, không tự lặp API chấm.
- [x] Khóa đổi thẻ/rời màn trong lúc thu/gửi hoặc có bản thu chưa gửi; tránh trùng request và nhầm mục. Server đã nhận WAV thì có thể chuyển thẻ/rời trang trong lúc job chấm.
- [x] Giữ xem điểm từng mục, luyện lại, phục hồi session và tổng kết đầy đủ.
- [x] Browser với microphone fixture và phản hồi chấm mô phỏng: stop/max-duration, error/retry, thiếu provider, keyboard, contrast, responsive.
- [x] Gate hồi quy, canonical build Node 22, production bundle Speaking và IOE; cập nhật localhost và CODEMAP.

## Kết quả cuối

- Narrow Speaking 43 pass. `test:phase3` cuối: 581 pass / 0 fail; typecheck/build/startup Node 22.16.0 đạt. `.data/speaking-flashcard-narrow.log`, `.data/ioe-speaking-final-phase3.log`.
- Browser cuối: `.data/speaking-flashcard-final-browser.log`, `.data/speaking-verification/browser-report.json`. Một thẻ, câu dài 1440/390/320px, trước/sau, manual stop/8 giây limit auto-send, lỗi mạng giữ WAV, double-click retry đúng một request, rời trang được sau accepted, im lặng không upload, micro bị từ chối có thông báo. 0 exception/overflow, computed contrast >=5.78:1, focus 3px; ảnh đã xem.
- Giữ 12-mục editor draft/reload/direct publish, session freeze khi giáo viên sửa, selected practice, review/audio/History và các dạng bài legacy. Điểm browser auto-send dùng phản hồi mô phỏng; không có điểm giả trong sản phẩm.
- Post-build production bundle: Speaking và IOE đều pass. `.data/speaking-flashcard-final-bundle.log`, `.data/ioe-bank-start-final-bundle.log`; signed prepare, guest B, private audio, History, thiếu provider 503 và production bypass rejection giữ nguyên.
- Localhost 3000 chạy source mới bằng Node 22/native SQLite WAL. Capabilities: Azure assessment/sample TTS và DevQuota metrics configured. Không gửi giọng thật hoặc gọi vendor trả phí trong lượt QA này.
- Bảo toàn DB: 58 bảng/1310 hàng giữ hash nội dung, 0 hàng mất/đổi/thêm từ kiểm tra local; quick_check=ok. `.data/ioe-speaking-preservation-report.json`.
- Artifact chung: `index-e7mfwfuZ.js` / `index-UiZPLWL7.css`, 74 JS/CSS; server 1.464.016 byte, SHA256 `8DDE5557A4F48D43DEC1D4B4A54FA243A9BB62B40A1196D432BAC2A7D0CBA2B3`. Diff check đạt; không đổi dependency/schema/secret/provider hay grader B.

Không dùng bản thu kiểm thử để đánh giá chất lượng chấm giọng thực. Không đổi schema/secret/provider hoặc tự gửi âm thanh thật của người dùng trong kiểm thử.
