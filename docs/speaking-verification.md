# Speaking — kết quả bàn giao 2026-10-04

## Kiểm tra trước, trong và sau build

| Giai đoạn | Kết quả |
|---|---|
| Baseline Node 22 | Typecheck pass; 27 test identity/history/legacy pass |
| Sao lưu trước schema | `.data/backups/before-speaking-20261004.sqlite`, SHA256 E8430AA2B6D16574748DB409B256C49CCA3EE6C9620AF071B6701785B4DD6596 |
| Test Speaking cuối | 18 pass, 0 fail: WAV/resample, Azure/SpeechSuper fixtures, whole-reference alignment, TTS reading/cache URL, ownership, immutable versions, signed upload, idempotency, quota, recovery, failure/null score, AI isolation, media dry-run, HTTP/History, benchmark dry-run, pagination/search |
| Toàn bộ test:phase3 | **553 pass, 0 fail**; typecheck, các bộ kiểm tra B/IOE/FCE và build/startup đều qua |
| Build Node 22.16.0 | `dist/client` và `dist/server.cjs` hoàn chỉnh; 73 artifact JS/CSS, worklet được đưa vào client build |
| Production bundle | Pass: assets/worklet, public lessons, guest B, signed prepare, unconfigured upload 503, private audio 404, History và route IOE; production từ chối local auth bypass |
| Browser desktop/mobile | 1440/390 px; soạn/lưu/xuất bản, cả 4 dạng bài, thu AudioWorklet/nghe lại/tải WAV, khóa Gửi chấm khi thiếu key, kết quả/audio/History, bộ lọc mặc định trống, focus bàn phím 3 px; không tràn trang, không exception |
| Contrast thực tế | Control text >= 5.78:1; nút chính 7.42:1; disabled opacity=1. CSS giới hạn trong Speaking |
| Database local sau migration | quick_check=ok; 5 bảng mới; **51 bảng cũ, 1226 hàng có hash nội dung giữ nguyên** |
| Benchmark | Dry-run và nhập kết quả 3 hãng ngoài đã test; không gửi giọng thật tới dịch vụ thương mại |

Build SHA256 `dist/server.cjs`: **0CB17D34C873CFCA855E3ADC8A1B123D0EA7853A19787E17023678FC4E9EE1BD**.

Vite có cảnh báo kích thước chunk `clientRegistry` của B (>500 kB); build không có lỗi. Chưa mở rộng refactor module cũ để xử lý cảnh báo này.

Browser QA build client vào thư mục tạm riêng với công tắc local auth hiện có của B, proxy API đến backend local trên database fixture; không ghi fixture vào dữ liệu của người dùng hoặc bật bypass trong bản production. Cách này kiểm tra giao diện đã build mà không phụ thuộc WebSocket HMR của Vite. Audio dùng micro/file giả, không chứng minh chất lượng chấm giọng của vendor.

## Artifact kiểm tra

- `.data/speaking-phase3.log`
- `.data/speaking-verification/browser-report.json` (đường dẫn ảnh desktop/mobile và computed styles)
- `.data/speaking-verification/bundle-report.json`
- `.data/speaking-verification/local-before-migration.json`, `local-migration-report.json`
- `.data/speaking-verification/benchmark-report.json` (cases rỗng; không có điểm giả)

Local đã khởi động lại trên `http://localhost:3000` bằng Node 22 + native SQLite. Database local đang ở WAL; khi khởi động lại dùng **`npm run dev:local:native` với Node 22**, hoặc đặt `LOCAL_TEST_SQLITE_DRIVER=better-sqlite3` trước `npm run dev:local`. Không đổi cấu hình production. `dev:local` gốc và lựa chọn SQL.js vẫn được giữ; SQL.js từ chối mở file WAL theo guard sẵn có của B.

## Phần cần cấu hình và xác minh tiếp

Ở lần bàn giao ban đầu, người dùng chưa có Azure/SpeechSuper keys; lần cập nhật dưới đây đã nhận cấu hình Azure trên local. Module có adapter thật và capability rõ ràng, nhưng **chưa chấm giọng thật, chưa benchmark chất lượng/latency/chi phí của hai hãng, chưa hiệu chỉnh với giáo viên**. Không dùng các fixture tests để khẳng định độ chính xác trên học sinh thực. Gemini audio feedback cũng cần model được cấp quyền để thử thật.

V1: HTTP WAV + durable SQLite jobs + Azure continuous file trên server. Browser WebSocket streaming, adapter trực tiếp cho Chivox/SpeechAce/ELSA, automatic audio cleanup và thống kê nâng cao là các bước mở rộng, không được mô tả là đã có. Hướng dẫn cấu hình/vận hành: `docs/speaking-setup.md` và `.env.speaking.example`.

Không commit/push/deploy production; giữ các thay đổi IOE/FCE có sẵn của người dùng.

## Cập nhật nhận xét DevQuota/Stali — 2026-10-04

- Baseline 18 Speaking tests đạt; bổ sung 9 contract tests cho gateway, validation, timeout/abort, dữ liệu tối thiểu, không fallback, không thay điểm và tương thích Gemini audio cũ.
- Phase3 cuối: **562 pass / 0 fail**, gồm 27 Speaking tests; typecheck, build và startup Node 22 đạt. Log: `.data/speaking-feedback-phase3.log`.
- DevQuota dùng `/responses`; Stali dùng `/chat/completions`, cùng keys/base URLs/resolver của B. Chỉ gọi provider được chọn bằng `SPEAKING_FEEDBACK_PROVIDER`; hai gateway dùng metrics mode và không nhận WAV hoặc danh tính học sinh.
- Production bundle smoke đạt; fixture đặt provider none và xóa keys khỏi môi trường test. Browser compiled-client 1440/390 px đạt, gồm tab Cấu hình dịch vụ, microphone giả, History và route IOE; không exception, không overflow, contrast tối thiểu 5.78:1.
- Localhost đã restart trên native SQLite/Node 22; database quick_check=ok, không có job queued/running trước restart. Capability xác nhận Azure configured, SpeechSuper unconfigured, DevQuota configured với model gpt-5.6-sol/metrics. Có biến chưa xác nhận quyền/key hoạt động thật; không gửi audio hay gọi dịch vụ thương mại trong lượt này. Report: `.data/speaking-verification/local-feedback-config.json`.
- Artifact cuối: `dist/client/assets/index-DcTLxX-0.js`, `index-DxkJNmjV.css`; SHA256 `dist/server.cjs` **78DDDBC5AA3AB864E9FA0FF2B03FDC1A01354CC67E0275C01778CAA2B1860F00**. Diff check đạt; không đổi schema, tài khoản, grader kỹ thuật hoặc provider/config của các module khác.
- Rollback cấu hình: `SPEAKING_FEEDBACK_PROVIDER=none` tắt riêng AI nhận xét; hoặc `gemini` + model của B để giữ luồng cũ. Điểm Azure và dữ liệu kết quả giữ nguyên. Chưa commit/push/deploy production.

## Bộ từ/câu và sửa lỗi Tạo audio mẫu — 2026-10-04

| Kiểm tra | Kết quả cuối |
|---|---|
| Baseline | 27 Speaking tests pass; localhost Tạo audio mẫu tái hiện 500 SPEAKING_ERROR khi thiếu key TTS B |
| Backup trước persistence | `.data/backups/before-speaking-sets/local-test-2026-10-04T10-43-13-918Z.sqlite`; SHA256 E8BD7E17795669E927DC3CF95C23C5A4E80AF29E7496D2498DF95B58A32E08BC |
| Migration trên bản sao | Lặp migration native hai lần, giữ hash 56 bảng/1226 hàng, thêm một bảng session và hai cột nullable; quick_check=ok; SQL.js migration regression pass |
| Test mới | 9 tests cho item validation, owner/version/signed resume, aggregate History, late concurrent grading, retry/null grade, daily quota, feedback isolation, nested media references và HTTP/TTS errors |
| Gate cuối | **571 pass / 0 fail**, gồm **36 Speaking tests**; typecheck, canonical build và startup đều qua |
| Production bundle | 7 lesson fixtures; B guest set/child prepare/resume, identity/content/score forgery protection, private audio, History/IOE và runtime thiếu keys pass |
| Browser build | 1440/390 px; bulk word/sentence, import từ/audio B không đổi nguồn, lưu/xuất bản, audio từng mục, missing-TTS UI, micro/WAV, khóa chuyển mục để giữ bản thu, resume cả khi giáo viên sửa sang draft, completed-set review và selected practice; không exception/overflow |
| Tương phản | Tối thiểu 5.78:1, primary 7.42:1; keyboard focus 3 px, disabled opacity=1; đã xem ảnh desktop/mobile |
| Local thực tế | Azure + DevQuota configured; TTS B unconfigured; đúng POST gây lỗi cũ nay trả **503 SAMPLE_TTS_UNAVAILABLE** cụ thể. Bài/kết quả thực tế không có fixture mới; 56 bảng/1226 hàng cũ giữ nguyên, quick_check=ok |

Artifact cuối: `dist/client/assets/index-Cz1X57Mi.js`, `index-DxkJNmjV.css`, 73 JS/CSS assets; server 1.453.476 bytes, SHA256 **A53E7BB61109E9249E902E127F4A54D9CAF632AE38C85467F8A8A5C29B1C1D21**. Local khởi động lại bằng Node 22/native SQLite WAL tại http://localhost:3000. Không thay hạ tầng auth/guest hoặc grader từ vựng cũ.

Log/report: `.data/speaking-sets-phase3.log`, `.data/speaking-sets-narrow.log`, `.data/speaking-sets-browser.log`, `.data/speaking-sets-bundle.log`, `.data/speaking-verification/{before-sets,copy-sets-migration,local-sets-migration,browser-report,bundle-report}.json`.

Điểm từng mục vẫn dùng reading-v1. Tổng hợp bộ chỉ xuất hiện khi đủ các mục có điểm, dùng lần chấm thành công mới nhất của mỗi mục trước khi hoàn thành và đóng băng các attempt IDs (set-mean-v1). Kết quả hoàn thành không đổi khi một job đọc lại đã mở trước đó trả về muộn. AI nhận xét cập nhật riêng; không thay điểm. Luyện lại mục đã chọn mở bộ mới từ phiên bản nguồn; bài legacy vẫn giữ một lượt.

Rollback vận hành: tắt SPEAKING_ENABLED hoặc triển khai bản trước sau khi backup; migration không xóa/cải tạo dữ liệu cũ. Bản trước không có bộ mới nên cần giữ bản build này để truy cập các bộ tạo sau v2; rollback schema bằng restore backup sẽ mất bài/kết quả phát sinh sau backup và phải được phê duyệt riêng. Không tự restore/xóa database.

**Chưa gửi giọng thật tới Azure/DevQuota/Stali, chưa xác minh quyền/quota của key hoặc hiệu chỉnh điểm với giáo viên.** QA dùng micro/provider fixtures trên DB riêng, không có provider giả trong sản phẩm. Cloud TTS cần key B riêng; nghe mẫu trên thiết bị không tạo file. Không commit/push/deploy production.

## Editor + Azure sample TTS — 2026-10-04

User keeps both buttons and selects existing Azure credentials for samples. Save validation feedback is visible at the footer; valid drafts are refreshed into the bank, and publication auto-saves new/changed content. Full before/during/after evidence is in `docs/speaking-editor-azure-checklist.md`.

Final `test:phase3`: 578 pass/0 fail, typecheck/build/startup pass. Browser regression (desktop/mobile, 12 sentence items, save/reload, direct publish/republish, existing recording/session/History) passes with 0 browser errors and minimum control contrast 5.78:1. Post-build Speaking/IOE bundle smokes and 24 flashcard layout cases pass.

Local `.env` selects Azure samples. Live API returns MP3 (200, 15,264 bytes); second request is cached. Real UI creation succeeds and audio decodes 1.908 seconds/error=null. Initial sandbox EACCES was resolved by restarting the authorized localhost server with outbound network access; the key itself was valid (Azure voices list 200). Original 1,244 DB rows remain intact; 61 IOE rows were added concurrently, outside this task's sample/read requests. No test lessons written to the user DB. No new live pronunciation/LLM/SpeechSuper assessment in this pass.

Artifact: index-C384FLZ5.js/index-UiZPLWL7.css, 74 JS/CSS; server 1,459,701 bytes, SHA256 8E69F6860152040353129A4E5BBF08908F20B7813F1C59D41B89EF32C36BCBC8. No deploy/commit/push.

## Flashcard học sinh và tự gửi bản thu — 2026-10-04

- Từ/câu hiển thị từng thẻ, tiến độ nhỏ và nút trước/sau; khung tự tăng chiều cao, nội dung dài vừa màn hình 320px. Hội thoại/đoạn văn giữ một nội dung. Điểm hiện trên thẻ; chi tiết phát âm và nhận xét mở qua disclosure.
- Dừng thu hoặc hết giới hạn thời lượng tự gửi WAV hợp lệ một lần. Lỗi upload giữ bytes/ticket để nghe/tải/gửi lại thủ công; double-click không tạo request trùng. Silence/clipping giữ validation cũ; từ chối micro có thông báo rõ. Navigation khóa khi thu/gửi hoặc còn WAV chưa gửi; server đã nhận thì có thể chuyển thẻ/rời trang trong lúc chấm.
- Gate cuối `test:phase3`: **581 pass / 0 fail**, gồm **43 Speaking tests**; typecheck, canonical build và startup Node 22.16.0 đạt. Log `.data/ioe-speaking-final-phase3.log`.
- Browser `.data/speaking-flashcard-final-browser.log` / `.data/speaking-verification/browser-report.json`: manual stop, max-duration, network/retry/no-duplicate, accepted navigation, silent upload rejection, permission handling, 1440/390/320px, keyboard focus 3px, contrast >=5.78:1, 0 exception/overflow. Giữ kiểm tra editor 12 mục/draft/direct publish, frozen resume, selected practice, review/audio/History. Ảnh desktop/mobile đã xem.
- Production bundle Speaking và IOE sau build đều đạt; guest B/signed prepare/private audio/missing-provider 503/History/bypass rejection giữ nguyên. Logs `.data/speaking-flashcard-final-bundle.log` và `.data/ioe-bank-start-final-bundle.log`.
- Localhost 3000 được restart bằng Node 22/native SQLite WAL. Azure assessment/sample TTS và DevQuota metrics hiện configured. **Điểm trong browser auto-send dùng phản hồi mô phỏng; chưa gửi bản thu thật hoặc chấm giọng thật với Azure trong lượt này.** HTTP/service tests dùng backend thật với adapter fixtures; sản phẩm không có provider giả.
- Database giữ nguyên 58 bảng/1310 hàng theo hash trước/sau restart, quick_check=ok/WAL. Artifact mới: `index-e7mfwfuZ.js` / `index-UiZPLWL7.css`, 74 JS/CSS; server 1.464.016 byte, SHA256 `8DDE5557A4F48D43DEC1D4B4A54FA243A9BB62B40A1196D432BAC2A7D0CBA2B3`. Proof chung `.data/ioe-speaking-{local-proof,preservation-report,artifact-report}.json`; checklist `docs/speaking-flashcard-checklist.md`.

Không đổi schema/dependency/secret/provider hoặc grader của B trong điều chỉnh UI này. Không ghi bài/lượt QA vào DB thực, commit/push/deploy hoặc cleanup dữ liệu. Cảnh báo chunk lớn có sẵn vẫn được Vite báo; build không lỗi.

## Sửa từ chối bản thu ngắn có khoảng im lặng — 2026-10-05

Lỗi “Không nghe rõ lời đọc” ở cả Dừng thu và hết thời gian bắt nguồn từ gate năng lượng client trước khi gửi Azure. RMS của toàn bản thu làm một từ ngắn bị pha loãng bởi khoảng im lặng; gate server cũng yêu cầu tỷ lệ mẫu vượt 0,01. Tái hiện trước sửa: một đoạn 250 ms có peak 0,012 được nhận ở 1 giây nhưng bị từ chối trong bản thu 8/30 giây. Log `.data/speaking-audio-repro.log`; hai regression mới thất bại trước sửa, `.data/speaking-audio-red.log`.

Client/server dùng chung `src/shared/speaking/audioQuality.ts`: đo PCM theo khung 20 ms, bỏ thành phần DC, cần ít nhất 80 ms khung có RMS ≥0,002. Không cắt im lặng, tăng âm lượng WAV hoặc đổi điểm/phát âm/provider. Silence, DC, click đơn, âm gần như không nghe được và clipping vẫn bị từ chối. Bật yêu cầu autoGainControl trong getUserMedia để trình duyệt điều chỉnh gain nếu hỗ trợ; [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/autoGainControl). Có chọn micro, tên thiết bị đang dùng, thanh tín hiệu lúc thu và lỗi cụ thể khi thiết bị/quyền truy cập/dữ liệu không sẵn sàng. Giới hạn mẫu và timer dừng vẫn chặn ghi dài ngoài cấu hình.

45 Speaking tests đạt, gồm client/server WAV với lời đọc ngắn trong 1/8/30/180/300 giây. Browser chạy compiled backend và AudioWorklet/resampler thật với media/provider fixtures: manual stop gửi WAV 4,05 giây, RMS 0,001889; timeout gửi WAV 8 giây, RMS 0,001344; cùng peak 0,008514. Hai bản này bị gate cũ từ chối và được gate mới nhận. Mỗi lần gửi đúng một request, retry do người dùng giữ cùng bytes/ticket; silence/quyền từ chối/micro không có không upload. Report `.data/speaking-verification/browser-report.json`, log `.data/speaking-audio-browser.log`.

Các kiểm tra draft/publish, flashcard, frozen resume, selected-item practice, review/History và 1440/390/320px vẫn đạt: 0 lỗi trình duyệt, không tràn, control contrast ≥5,78:1. Toàn bộ test:phase3 đạt 584/0, canonical build/typecheck/startup và hai production bundle smoke đạt. Bảng kiểm chung `docs/ioe-portal-speaking-checklist.md`. Chưa thu giọng thật trên micro của người dùng hoặc chấm pronunciation thật bằng Azure trong lượt sửa này; provider scoring trong browser là fixture, không có dịch vụ giả trong sản phẩm.

## Prosody/rhythm thiếu — 2026-10-05

Local đặt `SPEAKING_AZURE_PROSODY=false`; bốn kết quả thật Azure en-US có prosody/rhythm=null. SDK 1.52.0 đã dùng đúng setter, không có lỗi mất trường ở storage/API. Azure chỉ có ProsodyScore, bao gồm rhythm và chỉ hỗ trợ en-US. Bật flag local, ghi trạng thái yêu cầu vào trường JSON tùy chọn prosodyStatus và công khai boolean trong capabilities. Kết quả Azure hiện một chỉ số **Ngữ điệu & nhịp điệu (prosody)**; SpeechSuper hiện rhythm riêng. Trường thiếu có lý do cụ thể, 0 vẫn là số đo hợp lệ. Rubric/overall/AI/History và kết quả cũ giữ nguyên; cần luyện lại en-US để nhận điểm mới.

Baseline 45 Speaking tests; cuối cùng 118 scoped tests đạt (49 Speaking, 13 competition, 16 admin, 34 History, 6 legacy) cùng History CLI, typecheck, canonical Node 22.16.0 build, native startup và hai production bundle smoke. Regression dùng SDK thật để kiểm tra JSON request, giữ measured/null/invalid/weighted continuous score, lưu/đọc SQLite và B History. Copied native DB đọc được bốn kết quả legacy, không sửa score/snapshot.

Browser compiled chạy toàn bộ draft/publish/AudioWorklet/flashcard/auto-send/retry/resume/practice/review/History cũ. Bổ sung 7 trường hợp: available/0/disabled/not-returned/legacy/en-GB/SpeechSuper, 11 trạng thái viewport cho metrics; không phát sinh request ghi khi xem điểm. Desktop/mobile 1440/390/320px có 0 lỗi/tràn, contrast control ≥5,78:1 và focus hiển thị; screenshots đã xem. Scoring browser là fixture, không có provider giả trong sản phẩm.

Đã chạy **một kiểm tra Azure thật**, dùng TTS tổng hợp “Can you tell me about yourself?” dài 2,325 giây trong bộ nhớ: accuracy=93, fluency=100, completeness=100, **prosody=91,2**, prosodyStatus=available, rhythm=null. Một request TTS + một pronunciation assessment, không gửi bản thu/danh tính học sinh, không ghi DB, không retry. `.data/speaking-prosody-live-azure.json`; script kiểm tra tùy chọn `scripts/speaking-live-prosody-check.ts`. Chưa đối chiếu chất lượng với giọng thật/microphone của người dùng; kiểm tra này xác nhận resource/adapter có thể trả prosody.

Localhost restart/native WAL: capabilities thật báo prosody bật, cấu hình hiển thị Đã bật ở 1440/390/320px; source Review 200 và GET kết quả thật giữ nguyên cả bốn assessment cũ. Native DB giữ nguyên hash 58 bảng/1.330 dòng, quick_check=ok. Kiểm tra local là GET, không thu/chấm lại dữ liệu học sinh. Hai lỗi ban đầu của script local là cấu hình Chrome headless/GPU chưa khớp runner hiện có và serialize DOM node trong điều kiện chờ CDP; sửa harness bằng cùng flags đã xác minh và Boolean trước khi serialize, không đổi sản phẩm hay giảm assertion.

Checklist/artifact/log: `docs/speaking-prosody-checklist.md`, `.data/speaking-prosody-final-report.json`, `.data/speaking-prosody-*.log`, `.data/speaking-verification/browser-report.json`. Build tại lần cập nhật này: `index-CJg8xPO1.js` / `index-UiZPLWL7.css`, server 1.471.964 bytes/SHA256 `18E7E365FF1453D99D2BD4A9DDDEF33709E96AC0028A6F0A45BBE2B9A0F53C51`. Không đổi dependency/schema/global CSS/key/region, không commit/push/deploy.

## Lượt quá hạn, nghe lại bản thu và Bảng vàng — 2026-10-05

Local có hai lượt prepared quá 24 giờ trong bộ cũ, bốn lượt completed vẫn hợp lệ. Nút Thu âm trước đây tái dùng lượt prepared đó và buộc học sinh bấm Đọc lượt mới. Server nay trả `recordingAllowed` theo đồng hồ server. `recordingAttempt.ts` kiểm tra lượt trên mỗi thao tác Thu âm và tự prepare lượt mới nếu đã hết hạn; giữ prepare ID mới để retry khi response bị mất. Lượt hợp lệ được dùng lại, đồng hồ client không quyết định hết hạn; các mục khác, frozen snapshot và History giữ nguyên. Không nới thời hạn upload/ticket, không đổi schema hoặc tự tạo lượt ở page load.

Bốn WAV thật tải được qua endpoint private, có tín hiệu RMS 0,137–0,271 và dài 3,2–4,76 giây. Play trong trình duyệt hiện tại chạy timeline, readyState=4, không lỗi giải mã. Chưa xác định nguyên nhân âm thanh không ra loa của người dùng. Player được bổ sung phát lại toàn bản thu từ đầu, bỏ mute/volume=0 và tốc độ cũ, dừng audio mẫu đang quản lý; giữ nút Nghe lại sau khi tải, có Tải bản thu và lỗi tải/giải mã/autoplay cụ thể. Nghe đoạn từ rồi nghe toàn bản thu không bị giới hạn đoạn cũ. Hủy tải/dừng audio/giải phóng URL khi đổi mục; response chậm không gắn bản thu của mục trước vào mục mới. Không thay WAV, storage, quyền nghe hoặc điểm.

Người dùng chọn mọi người được xem tên trên Bảng vàng. Home public summary nay resolve tên hồ sơ B cho top đã xếp hạng (tối đa 20), giữ bảy trường allowlist và cache key mới. Learning-scoped summary vẫn ẩn danh, quản trị vẫn theo quyền B; không lộ ID/liên hệ hoặc thay điểm/quy tắc xếp hạng. Tên dài xuống dòng, không cắt dấu ba chấm; request bộ lọc cũ đã abort không ghi đè kết quả mới. Contract chi tiết: `docs/home-leaderboard.md`.

| Kiểm tra | Kết quả |
|---|---|
| Baseline | 49 Speaking, 14 Home, 10 Results API tests đạt |
| Full phase3 | **596 pass / 0 fail** trong 22 test invocations; gồm 53 Speaking và 12 Results API; lint, canonical build và native startup đạt |
| Bundle sau build | Speaking và IOE đạt; signed engine/private audio/missing-provider/History/bypass rejection giữ nguyên |
| Browser build | Lượt expired tự renew, lượt valid giữ nguyên dù clock client nhanh hai ngày; replay/volume/word/full/download/error/autoplay/đổi mục/stale response; Home tự tải/tên canonical/DTO/tuần-tháng, desktop và 390/320px đạt |
| Luồng cũ | Draft/publish, AudioWorklet/resampler, flashcard, manual stop/timeout/auto-upload/retry/permission/silence, frozen resume, selected practice, prosody và History vẫn đạt |
| UI | 0 browser errors, control contrast tối thiểu 5,78:1; screenshot desktop/mobile đã xem |
| Bản sao DB | Sáu attempt snapshot cũ/bốn completed giữ nguyên, chỉ tạo prepared mới khi renew; legacy leaderboard projection giữ tên snapshot và source rows |
| Local thật | Source/API GET 200, bốn WAV có tín hiệu; tuần/tháng hiện tại có 0 sự kiện phù hợp nên bảng trống. Không dùng kết quả trống làm bằng chứng tên canonical; điều đó được kiểm tra bằng DB fixture riêng |
| Bảo toàn | Hash toàn bộ 58 bảng/1.330 hàng unchanged, quick_check=ok; không live DB writes hoặc provider calls trong lượt sửa này |

**Âm thanh ra loa của người dùng chưa được xác nhận.** Browser fixture chứng minh giải mã/timeline/volume=1; đo PCM thật chứng minh file có tín hiệu, không chứng minh thiết bị phát ra tiếng. Nút tải bản thu hỗ trợ kiểm tra bằng player của máy; cần phân biệt tab/trình duyệt/thiết bị âm thanh trước khi sửa thêm. Không chấm lại hoặc gọi Azure để thử phát.

Localhost đã restart bằng Node 22.16.0/native SQLite WAL với `npm run dev:local:native`, http://localhost:3000 phản hồi capability 200. Artifact: `index-B8Xibq1C.js` / `index-EOnnQpik.css`, 76 JS/CSS; server 1.472.728 bytes, SHA256 `3E295588303AD22AA83DF2EB6C78A2EB525AA29CF395DEEFC7C76B3C13966A2A`. Cảnh báo chunk lớn có sẵn vẫn còn, build không lỗi. Giữ thay đổi IOE/FCE có sẵn; không commit/push/deploy.

Checklists: `docs/speaking-attempt-renewal-checklist.md`, `docs/speaking-replay-home-leaderboard-checklist.md`. Báo cáo chung `.data/speaking-home-final-report.json`; log `.data/speaking-home-{final-phase3,compiled-browser,speaking-bundle,ioe-bundle,local-proof,db-proof}.log`; reports `.data/speaking-verification/browser-report.json`, `.data/speaking-home-local-report.json`, `.data/speaking-attempt-{copy,db}-report.json`, `.data/home-leaderboard-copy-report.json`.
