# Speaking / Luyện đọc

Module dùng tài khoản/guest capability, SQLite, dashboard, TTS và Learning History của B. V1 chấm nội dung tiếng Anh đã biết trước: từ, câu, một lượt hội thoại, đoạn văn. Không thay game Speaking cũ hoặc tạo hệ thống hồ sơ khác.

## Sử dụng

1. Dashboard → **Speaking / Luyện đọc** → Soạn bài. Chọn lớp, dạng bài, en-US/en-GB và provider; Với Từ vựng/Câu, dán danh sách mỗi dòng một từ/câu rồi bấm Thêm danh sách; tối đa 50 mục và 20.000 ký tự mỗi bộ. Có thể nhập từng mục, đổi thứ tự hoặc sao chép từ và audio phù hợp từ bộ từ vựng B. Hội thoại và đoạn văn vẫn dùng một nội dung; hội thoại chỉ chấm vai học sinh.
2. Tạo audio riêng từng mục bằng Azure khi đặt `SPEAKING_SAMPLE_TTS_PROVIDER=azure`, hoặc TTS B khi chọn `b` và có key AI33_API_KEY/TTS_API_KEY. Có thể nghe mẫu trên thiết bị hoặc dùng `/audio/…` có sẵn. **Lưu bản nháp** đưa bài vào Kho bài với trạng thái Bản nháp. **Xuất bản** tự lưu nội dung hợp lệ trước khi xuất bản, kể cả bài mới; không cần bấm lưu riêng. Lỗi hiện cạnh nút lưu và giữ nội dung đang soạn. Chế độ reading giữ toàn bộ nội dung đến 6000 ký tự, dấu câu và lời trong ngoặc; xử lý từ vựng 120 ký tự của B giữ nguyên.
3. Học sinh mở `/speaking`, chọn bộ → Bắt đầu bộ luyện đọc → Thu âm từng mục (bài một nội dung cũ dùng Bắt đầu lượt đọc → Thu âm). Từ/câu hiển thị từng thẻ, có tiến độ và nút trước/sau. Bấm **Dừng thu** hoặc đến giới hạn thời lượng sẽ tự gửi WAV hợp lệ đúng một lần khi dịch vụ đã cấu hình. Không tự dừng theo khoảng im lặng. Nếu gửi lỗi, bản thu được giữ để nghe/tải hoặc bấm **Gửi lại bản thu**; không tự lặp request chấm. Quyền micro yêu cầu HTTPS hoặc localhost. Bản thu im lặng/clipping không gửi chấm. Trong lúc thu/gửi hoặc còn WAV chưa gửi, chuyển thẻ/rời màn bị khóa; sau khi server nhận bản thu có thể chuyển thẻ hoặc quay lại sau để xem điểm.
4. Kết quả có điểm kỹ thuật, từ/phoneme, bỏ/thêm/lặp từ, audio riêng tư và nhận xét. Bộ hoàn thành lưu một kết quả tổng hợp bằng trung bình các điểm mục (rubric set-mean-v1), cùng chi tiết từng mục; bộ dở chỉ lưu tiến độ. Luyện lại mục được chọn mở một lượt mới và giữ lượt đã hoàn thành. Kết quả xuất hiện trong `/history` của B và mục Kết quả trên dashboard; bộ lọc ban đầu là tất cả.
5. Sửa bài tạo bản nháp mới. Xuất bản đóng băng phiên bản; lượt đang làm và kết quả cũ giữ nội dung đã bắt đầu. Lưu trữ bài không xóa History.

## Runtime local và bản build

Dùng Node 22 theo quytac.md; native better-sqlite3 giữ pin 10.1.0. Local database hiện ở WAL, khởi động bằng `npm run dev:local:native` (hoặc `LOCAL_TEST_SQLITE_DRIVER=better-sqlite3` trước dev:local). Build dùng `npm run build`; production giữ các biến storage/secret và auth thật của B.

## Cấu hình backend

Tham khảo `.env.speaking.example`. Giữ nguyên biến storage, secrets, tài khoản, TTS của B. Đặt biến trên môi trường server, **không đưa khóa vào chat, trình duyệt hoặc biến VITE_**. Sau thay đổi khởi động lại server.

**Azure:** tạo Speech resource; đặt `AZURE_SPEECH_KEY` và `AZURE_SPEECH_REGION` theo resource. en-US mặc định; en-GB cho bài Anh-Anh. `SPEAKING_AZURE_PROSODY=true` bật prosody khi tài khoản hỗ trợ và chấp nhận chi phí tương ứng; mặc định tắt. “Đã cấu hình” chỉ xác nhận có biến, chưa xác nhận khóa hoạt động.

**SpeechSuper:** đặt `SPEECHSUPER_APP_KEY` và `SPEECHSUPER_SECRET_KEY` từ tài khoản có quyền English assessment. Adapter dùng word.eval.promax / sent.eval.promax / para.eval; paragraph tối đa 180 giây. Có thể xuất bản bài khi chưa có khóa, nhưng nút Gửi chấm sẽ khóa và backend trả 503. Một lượt chỉ dùng provider đã đóng băng trong phiên bản; không có failover hoặc ghép điểm hai hãng.

**AI nhận xét:** chọn `SPEAKING_FEEDBACK_PROVIDER=devquota` hoặc `stali`, dùng lại `DEVQUOTA_API_KEY`/`DEVQUOTA_BASE_URL` hoặc `STALI_API_KEY`/`STALI_BASE_URL` của B. Model mặc định của hai gateway là `gpt-5.6-sol` theo adapter hiện có; có thể đặt `SPEAKING_FEEDBACK_MODEL` bằng model được tài khoản cấp quyền. `SPEAKING_FEEDBACK_MODE=metrics` chỉ gửi nội dung bài + kết quả Azure đã chấm, không gửi bản thu hoặc danh tính học sinh. AI viết nhận xét bằng tiếng Việt, không thay điểm kỹ thuật. Chưa hỗ trợ input audio qua DevQuota/Stali; đặt audio sẽ báo cấu hình không khả dụng, không âm thầm đổi hãng hay cách xử lý.

Vẫn hỗ trợ `SPEAKING_FEEDBACK_PROVIDER=gemini` bằng `GEMINI_API_KEY` của B và model được cấp quyền. Gemini `audio` gửi thêm WAV để nhận xét riêng; cần model hỗ trợ input audio. `holisticScore` chỉ hiện riêng trong audio mode, không cộng vào điểm kỹ thuật. Khi không đặt provider flag, giữ hành vi Gemini cũ; `none` tắt riêng AI nhận xét. Thiếu key/model hoặc lỗi hãng không tự gọi hãng khác, không retry tính phí tự động.

## Cấu hình local: Azure + DevQuota hoặc Stali

Sửa **`.env` tại thư mục gốc dự án** (`E:\VS CODE\GOOG APP STUDIO ENGLISH\ho-c-t-v-ng\.env`). `.env.speaking.example` chỉ là mẫu tham khảo, không tự được nạp. Giữ nguyên các biến khác của B; không ghi khóa vào tài liệu hoặc file mẫu.

```dotenv
AZURE_SPEECH_KEY=YOUR_AZURE_SPEECH_KEY
AZURE_SPEECH_REGION=YOUR_RESOURCE_REGION
SPEAKING_ENABLED=true
SPEAKING_AZURE_PROSODY=true
SPEAKING_FEEDBACK_PROVIDER=devquota
SPEAKING_FEEDBACK_MODEL=gpt-5.6-sol
SPEAKING_FEEDBACK_MODE=metrics
```

Trong Azure Portal, mở đúng **Speech resource → Keys and Endpoint**, lấy key và region của cùng resource. Region là mã như `southeastasia` hoặc `eastus`, không phải tên quốc gia hay URL endpoint; phải dùng đúng mã resource thực tế. [Microsoft: region và key phải khớp](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions).

Nếu B đã có key DevQuota thì không cần tạo hoặc điền lại key. Tên chuẩn là `DEVQUOTA_API_KEY`; alias cũ `DEVQUOTA_API_KEYk` vẫn được resolver của B hỗ trợ, có cảnh báo deprecated. Nếu dùng Stali, đổi duy nhất provider thành `stali` và dùng `STALI_API_KEY` sẵn có; kiểm tra tài khoản có quyền model đã chọn. Không cần key SpeechSuper để chấm bằng Azure; giữ các biến SpeechSuper trống nếu chưa có.

Sau khi lưu `.env`, dừng server cũ rồi chạy bằng Node 22:

```powershell
npm run dev:local:native
```

Mở `http://localhost:3000/admin` → Speaking / Luyện đọc → tab Cấu hình dịch vụ. Azure và hãng nhận xét cần hiện đã cấu hình; endpoint đọc trạng thái là `http://localhost:3000/api/speaking/capabilities`, không trả key. Có biến chỉ xác nhận cấu hình, chưa xác nhận quyền/balance của tài khoản thật.

Tạo bài có dịch vụ chấm **Azure Speech**, tích **Bật AI nhận xét sau khi chấm**, lưu và xuất bản. Mở `http://localhost:3000/speaking`, cho phép microphone, thu một câu ngắn rồi dừng; bản thu hợp lệ tự gửi chấm. Điểm Azure xuất hiện trước; nhận xét DevQuota/Stali chạy job riêng và xuất hiện sau. Nhận xét lỗi vẫn giữ điểm/kết quả trong History. Audio mẫu có thể dùng cùng Azure Speech key/region với cấu hình dưới đây.

## Giới hạn và tính điểm V1

- Word tối đa 8 giây; sentence/dialogue 30 giây; passage mặc định 180 giây, Azure cho phép nâng 300 giây. Tối đa 400 từ; SpeechSuper sentence tối đa 200 từ.
- AudioWorklet thu mono, bộ lọc resample giữ nhịp/khoảng dừng, đóng WAV PCM16/16kHz. Kiểm tra WAV, số mẫu, silence/clipping trên cả browser và server; đây không phải bộ khử nhiễu hay VAD phân biệt mọi tiếng ồn.
- Azure word lấy Accuracy; không để Fluency kéo điểm của một từ. Câu/hội thoại/đoạn đều dùng continuous session để giữ toàn bản thu; điểm dùng **reading-v1 = 60% accuracy + 20% fluency + 20% completeness**; accuracy/fluency theo trọng số thời lượng utterance, completeness căn chỉnh toàn reference. PronScore đơn utterance được lưu riêng nếu có. Đây là công thức V1 của ứng dụng, chưa được hiệu chỉnh với giáo viên; không mô tả là điểm PronScore tổng chính thức của Azure. Prosody hiển thị riêng khi được trả về.
- SpeechSuper word lấy pronunciation; câu/đoạn lấy overall của provider. Rhythm giữ riêng, không đổi tên thành Azure prosody. Paragraph hiện không có phoneme trong hợp đồng adapter. Chỉ số không hỗ trợ là null, không điền 0.
- Lỗi chấm là failed với score null. Không tự chấm lại sau timeout/crash để tránh phát sinh lượt trả phí ngoài kiểm soát. Học sinh chủ động yêu cầu chấm lại cùng WAV, tối đa 3 lần xử lý; provider giữ nguyên. Timeout có thể đã được hãng tính phí.

## Job, lưu trữ và vận hành

Schema có 6 bảng speaking_*; v2 thêm speaking_sessions và hai cột nullable session_id/item_id vào speaking_attempts. Migration additive/idempotent, chạy được với native SQLite/SQL.js. Không sửa enum/check của bảng Learning History cũ; đọc kết quả Speaking bằng UNION vào History. Bản nháp và phiên bản chỉ lưu JSON/metadata, không lưu binary/base64 vào DB.

HTTP upload WAV được ký theo danh tính B; payload lặp cùng hash không tạo job mới. Worker durable SQLite chạy tuần tự, lease 8 phút; phục hồi lease quá hạn thành failed và yêu cầu retry rõ ràng. Một danh tính tối đa 20 lượt đọc/ngày (UTC, SPEAKING_DAILY_LIMIT cấu hình 1–200); mỗi lần prepare một mục tính một lượt, retry cùng mã không tính thêm. Nếu cần học bộ 50 mục trong ngày, đặt giới hạn phù hợp và khởi động lại. Tiến độ bộ lưu để tiếp tục ngày sau. Giới hạn khác: 2 lượt đang chấm; tổng hàng đợi tối đa 100. Timer kiểm tra hàng đợi mỗi 1,5 giây. V1 dùng HTTP upload và Azure continuous trên server; WebSocket streaming browser là giai đoạn tiếp theo sau kiểm tra reverse proxy/hosting.

Bản thu ở `speaking-recordings` cạnh database của B, ngoài các thư mục media công khai. Ghi qua file tạm và hard-link trên cùng filesystem để cài file hoàn chỉnh mà không ghi đè. Cần filesystem hỗ trợ hard-link và quyền ghi; lỗi filesystem không tạo điểm. Endpoint audio kiểm tra chủ sở hữu/giáo viên quản lý bài/admin, đặt private/no-store. Quyền nghe lại mặc định 30 ngày; điểm giữ lâu dài. Hết thời hạn chỉ khóa nghe lại, **không tự xóa file** trong startup/read. Dọn file hết hạn/orphan là tác vụ bảo trì riêng: kiểm kê dry-run, backup, rồi phê duyệt thao tác xóa theo quytac.md. Không công khai hoặc sao chép thư mục bản thu vào dist/public.

Đặt process manager giữ Node 22 sống để worker xử lý. Shutdown có thể để job running; lần khởi động sau đợi hết lease rồi đánh dấu failed, không gọi trả phí tự động. Không đổi LISTENING_TICKET_SECRET trong khi có lượt đang làm. Backup database cùng thư mục recordings khi chuyển máy. Tắt `SPEAKING_ENABLED=false` để tạm dừng module mà vẫn giữ dữ liệu và các tính năng B.

## Kiểm thử và benchmark

Nếu nhận lỗi chấm quá thời gian, kiểm tra kết nối **từ tiến trình server** tới Azure, bao gồm WebSocket `wss://<region>.stt.speech.microsoft.com` qua cổng 443. Kết nối trên trình duyệt hoặc máy có mạng chưa chứng minh server có quyền kết nối. Luồng chấm tách thời hạn mở kết nối 15 giây khỏi thời hạn chấm; lỗi xác thực/hạn mức/kết nối được hiển thị riêng, giữ WAV và trạng thái lỗi trong History. Sau khi khắc phục kết nối, dùng **Yêu cầu chấm lại**; hệ thống không tự gửi lại lượt lỗi hoặc đổi provider. Chẩn đoán và bằng chứng: [speaking-azure-timeout.md](speaking-azure-timeout.md).

`npm run test:speaking` kiểm tra WAV/resample/alignment/provider fixtures, immutable versions, quyền, idempotency, quota, recovery, feedback, HTTP và History. Fixtures chỉ nằm trong test, không có chế độ điểm giả trên server sản phẩm. `npm run test:phase3` gồm kiểm tra hồi quy B và build. Browser QA dùng database local cô lập, micro giả và dữ liệu fixture, không gọi hãng.

Runner `node --import tsx scripts/speaking-benchmark.ts --manifest=path/to/manifest.json --output=path/to/report.json` (hoặc npm.cmd run speaking:benchmark -- … trên Windows) mặc định dry-run: kiểm tra WAV và cấu hình, không gửi audio. Manifest mẫu ở `docs/speaking-benchmark.example.json`, cases mặc định rỗng. Thêm `--run` mới gọi hai adapter Azure/SpeechSuper và có thể phát sinh phí. Chỉ chạy khi có quyền sử dụng bản thu và khóa thử nghiệm.

Đối chiếu năm ứng viên: Azure, SpeechSuper, Chivox, SpeechAce, ELSA. Hai hãng được tích hợp trong runner; ba hãng còn lại nhập kết quả API/export chính thức bằng `--external=results.json` với `{id,provider:"chivox"|"speechace"|"elsa",score,elapsedMs}`. Runner không giả lập adapter khi chưa có API access và hợp đồng tài khoản. Báo cáo giữ từng provider, tỷ lệ thành công, p50/p95 và sai số tuyệt đối so với teacherScore; không chọn người thắng khi thiếu dữ liệu. So sánh theo nhóm word/câu/đoạn, lớp, microphone, mức học sinh; dùng cùng WAV và rubric của giáo viên. Chưa chạy benchmark thật hoặc hiệu chỉnh chất lượng trên học sinh Việt Nam; việc có key/capability không thay thế đối chiếu bản thu thật với giáo viên.

## Tài liệu provider

- [Azure Pronunciation Assessment SDK](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment)
- [SpeechSuper English sentence](https://docs.speechsuper.com/Languages/English/sent.eval.promax.md), [paragraph](https://docs.speechsuper.com/Languages/English/para.eval.md), [HTTP samples](https://github.com/speechsuper/SpeechSuper-API-Samples)
- [Gemini audio input](https://ai.google.dev/gemini-api/docs/audio)

Trạng thái kiểm thử/build chi tiết: `docs/speaking-checklist.md` và `docs/speaking-verification.md`.

## Audio mẫu khi chỉ có key Azure

Đặt `SPEAKING_SAMPLE_TTS_PROVIDER=azure` trong `.env` gốc, dùng lại `AZURE_SPEECH_KEY` và `AZURE_SPEECH_REGION` đã cấu hình, rồi restart bằng Node 22 / `npm run dev:local:native`. Không cần key AI33 cho audio mẫu Speaking. Mặc định en-US dùng JennyNeural, en-GB dùng SoniaNeural; có thể đặt giọng phù hợp bằng `SPEAKING_AZURE_TTS_VOICE_EN_US` / `SPEAKING_AZURE_TTS_VOICE_EN_GB`. Adapter dùng SDK Speech đã có, MP3 mono 16kHz/64kbps, tốc độ 1.0. Tài liệu: [Azure Speech synthesis](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis).

Nút **Tạo audio mẫu** dùng cấu hình backend, chỉ mở khi có cấu hình và nội dung. Thiếu cấu hình trả `503 SAMPLE_TTS_UNAVAILABLE`; provider lỗi trả `502 SAMPLE_TTS_FAILED`, timeout trả 504, đều không lộ chi tiết SDK/secret. Thời gian, dung lượng và rate limit dùng giới hạn TTS của B. MP3 đi vào cache `/audio/…` hiện có, có provider/locale/voice trong hash và gộp request đang chạy; không tạo kho media mới, không gọi hãng khác hoặc tự retry trả phí. Có biến/key không đồng nghĩa resource có quyền/quota TTS: phải thử tạo mẫu để xác nhận.

Để giữ đường cũ, chọn `SPEAKING_SAMPLE_TTS_PROVIDER=b` (hoặc bỏ biến) và cấu hình `AI33_API_KEY` / `TTS_API_KEY`. TTS từ vựng/game và danh sách giọng B vẫn dùng provider cũ. **Nghe mẫu trên thiết bị** vẫn dùng được khi chưa có file; không tạo/lưu file audio. Với danh sách câu như “What's your hobby?”, chọn **Dạng bài: Câu**, mỗi dòng một câu; **Từ vựng** yêu cầu mỗi mục đúng một từ.

Bài/kết quả một nội dung cũ tiếp tục đọc được. Bộ đang học giữ snapshot của phiên bản đã mở kể cả khi giáo viên sửa sang nháp; tải lại trang dùng owner session để tiếp tục. Bản thu chưa gửi phải gửi hoặc bỏ trước khi chuyển mục. Khi bấm **Thu âm**, client kiểm tra trạng thái từ server và tự mở lượt thu hợp lệ nếu lượt chuẩn bị cũ quá 24 giờ; không reset bộ hay mất các mục đã chấm. **Đọc lượt mới** dùng để luyện lại mục đã hoàn thành. Khi đang luyện chỉ hiện một thẻ, chữ và khung tự tăng chiều cao trên điện thoại. Điểm hiện ngay trên thẻ; chi tiết phát âm/nhận xét mở bằng **Xem nhận xét và chi tiết phát âm**. Bài hội thoại/đoạn văn vẫn hiển thị một nội dung và review đầy đủ.

**Nghe lại bản thu** tải qua endpoint riêng có kiểm tra quyền và phát từ đầu, đặt âm lượng đầy đủ/bỏ mute ở player. Có thể bấm lại để phát lại mà không tải/gọi chấm lần nữa. **Tải bản thu** cho phép nghe WAV bằng thiết bị. Lỗi tải, dữ liệu không phải audio, giải mã hoặc trình duyệt chặn autoplay đều có thông báo. Nếu thanh audio chạy nhưng vẫn không nghe được, kiểm tra âm thanh của tab/trình duyệt và đầu ra loa; điểm chấm và file gốc không bị thay đổi bởi thao tác nghe lại.

## Ngữ điệu và nhịp điệu

Azure chỉ hỗ trợ đánh giá prosody với **en-US**. Chỉ số này bao gồm ngữ điệu, trọng âm, tốc độ và nhịp điệu; Azure không trả một điểm rhythm độc lập. Kết quả Azure hiển thị **Ngữ điệu & nhịp điệu (prosody)**; kết quả SpeechSuper giữ chỉ số rhythm riêng theo phản hồi của hãng. Không sao chép prosody sang rhythm, biến chỉ số thiếu thành 0 hoặc thay bằng điểm AI. [Microsoft: prosody và phạm vi ngôn ngữ](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment).

Local đã bật `SPEAKING_AZURE_PROSODY=true` cho yêu cầu này; key, region và provider giữ nguyên. Biến này tiếp tục là opt-in trên môi trường khác; tính năng prosody có phí Azure bổ sung. Tab **Cấu hình dịch vụ** và `GET /api/speaking/capabilities` công khai trạng thái bật/tắt, chỉ locale en-US gửi yêu cầu prosody. SDK JS 1.52.0 dùng setter `enableProsodyAssessment`; kiểm thử đối chiếu JSON request thật của SDK.

Kết quả cũ không được tự chấm lại hoặc sửa điểm. Học sinh cần luyện lại mục en-US để có điểm mới. Khi chưa có số, giao diện nêu cụ thể lượt cũ, chức năng chưa bật, locale không hỗ trợ hoặc Azure không trả chỉ số; rubric reading-v1 và điểm trung bình bộ giữ nguyên.

Kiểm tra Azure thật có chủ đích: `SPEAKING_LIVE_PROSODY_CHECK=true` rồi chạy `npx tsx scripts/speaking-live-prosody-check.ts`. Script gọi một lần TTS và một lần pronunciation assessment bằng câu tổng hợp ngắn, giữ WAV trong bộ nhớ, không gửi dữ liệu học sinh hay ghi DB, không retry tự động. Đây là kiểm tra tùy chọn có phí, không nằm trong bộ test tự động. Báo cáo chỉ ghi điểm/cấu hình an toàn vào `.data/speaking-prosody-live-azure.json`.
