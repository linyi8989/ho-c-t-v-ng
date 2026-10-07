# Speaking: prosody và rhythm — 2026-10-05

Mục tiêu: xác định vì sao hai chỉ số thiếu trên kết quả thật, bật chấm prosody phù hợp với Azure đang dùng, hiển thị đúng khả năng provider, giữ rubric/điểm/lịch sử và dữ liệu cũ.

## Trước sửa

- [x] Đọc quy tắc, CODEMAP/package/source trực tiếp, ghi nhận worktree hiện có; không sửa IOE/FCE ngoài phạm vi.
- [x] Baseline Speaking: 45 test đạt trên Node 22/native SQLite.
- [x] Chẩn đoán local chỉ đọc: SPEAKING_AZURE_PROSODY=false; bốn kết quả Azure en-US sentence có prosody=null/rhythm=null.
- [x] Đối chiếu SDK 1.52.0: enableProsodyAssessment là setter hợp lệ, không phải lỗi gọi phương thức. Microsoft xác nhận prosody chỉ en-US và đã bao gồm rhythm; Azure không có RhythmScore riêng trong contract.
- [x] Sao lưu source vào `.data/speaking-prosody-before`; native DB backup có quick_check=ok trước thay đổi kết quả JSON.

## Trong sửa

- [x] Truyền trạng thái bật prosody từ SDK request vào kết quả; trường prosodyStatus tùy chọn, tương thích kết quả cũ và không thêm schema/table.
- [x] Bật flag local; không thay key/region/provider, không tự chấm lại kết quả cũ.
- [x] Azure hiện một điểm “Ngữ điệu & nhịp điệu (prosody)”; không nhân đôi điểm sang rhythm. SpeechSuper giữ rhythm riêng.
- [x] Giải thích disabled/locale không hỗ trợ/provider không trả/lượt cũ; không thay null thành 0, accuracy, fluency hay điểm AI.
- [x] Trạng thái cấu hình quản trị cho biết bật/tắt prosody; chỉ locale en-US gửi yêu cầu bật.
- [x] Test SDK serialization, normalize, kết quả lưu/đọc/History và hiển thị legacy/null/0/unsupported/provider: 49 Speaking tests đạt, 0 lỗi.
- [x] Kiểm tra thật Azure bằng audio tổng hợp 2,325 giây: prosody=91,2, status=available; một TTS + một assessment, không gửi bản thu/danh tính học sinh, không ghi DB.

## Sau build

- [x] 118 test phù hợp phạm vi (49 Speaking + 13 competition + 16 admin + 34 History + 6 legacy), History CLI, lint, build chuẩn, startup native và bundle Speaking/IOE đều đạt.
- [x] Browser compiled: draft/publish, thu/gửi/chấm/review/History, frozen resume/selected practice và metrics mới; 7 trường hợp chỉ số, 11 trạng thái desktop/mobile. 0 lỗi trình duyệt/tràn khung, contrast control ≥5,78:1; đã xem screenshot.
- [x] Restart localhost: capabilities thật báo prosody bật/en-US; giao diện Cấu hình dịch vụ đúng ở 1440/390/320px, source 200, GET kết quả thật giữ nguyên bốn assessment cũ. Không QA ghi DB.
- [x] Kiểm thử bản sao production-shaped: bốn kết quả legacy đọc được và giữ nguyên score/snapshot. DB live giữ hash 58 bảng/1.330 dòng, quick_check=ok.
- [x] Xem diff và diff --check; cập nhật setup/verification/CODEMAP/artifact và bằng chứng. Không sửa CSS toàn cục, key/region, IOE/FCE hoặc schema.

Artifact: `index-CJg8xPO1.js` / `index-UiZPLWL7.css`, 76 JS/CSS; server 1.471.964 bytes, SHA256 `18E7E365FF1453D99D2BD4A9DDDEF33709E96AC0028A6F0A45BBE2B9A0F53C51`.

Evidence: `.data/speaking-prosody-{baseline-tests,tests,competition,admin,history,legacy,lint,build,browser,startup,speaking-bundle,ioe-bundle,copy-check,local-check,source-diff,diff-check}.log`; `.data/speaking-prosody-{live-azure,copy-report,local-report,db-report,final-report}.json`; `.data/speaking-verification/browser-report.json`. DB backup: `.data/speaking-prosody-before/local-test-2026-10-05T15-00-30-441Z.sqlite`.

Nguồn: [Microsoft — pronunciation assessment](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment), [SDK JS](https://github.com/microsoft/cognitive-services-speech-sdk-js/blob/master/src/sdk/PronunciationAssessmentConfig.ts).

Prosody là tính năng Azure có phí bổ sung theo resource. Bật cho yêu cầu hiện tại bằng flag local; môi trường khác tiếp tục dùng opt-in rõ ràng. Không có điểm rhythm Azure độc lập để sửa thành một số thứ hai. Kết quả đã hoàn thành giữ nguyên, cần luyện lại để nhận đánh giá mới.
