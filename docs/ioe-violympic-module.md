# IOE/Violympic trong dự án B

Tab **Ngân hàng** mặc định để trống môn/lớp/cấp, hiển thị toàn bộ câu chưa lưu trữ trong quyền quản lý B (giáo viên: câu của mình; quản trị viên: toàn bộ), phân trang 30 câu. Mỗi bộ lọc và tìm nội dung/tiêu đề có thể dùng độc lập; chọn “Tất cả” để bỏ điều kiện đó. Năm thao tác môn/lớp/cấp/tìm kiếm/xóa nằm cùng hàng trên desktop, tự xếp trên mobile. Đổi bộ lọc, tìm kiếm hoặc trang sẽ bỏ lựa chọn xóa trước đó; khi đang tải, không thể xóa danh sách cũ.

Bộ lọc Ngân hàng độc lập với scope của **Soạn JSON**. Có bản nháp vẫn lọc được Ngân hàng; bản nháp giữ nguyên môn/lớp/cấp và nội dung. Sửa/sao chép một câu vào bảng soạn giữ scope gốc của câu. Nếu bảng đã có bản nháp thuộc scope khác, cần lưu hoặc bỏ những dòng đó trước khi thêm câu này, để tránh đổi phân loại ngoài ý muốn. `GET /admin/questions` nhận `subject`, `grade`, `level` tùy chọn (bỏ qua khi rỗng); API lưu/sửa câu vẫn bắt buộc scope đầy đủ. Checklist: `docs/ioe-bank-filters-checklist.md`.

Module nghiệp vụ riêng, học từ A tại `E:\VS CODE\ioe`. B tiếp tục sở hữu tài khoản/Firebase, hồ sơ khách, lớp/giao bài, Learning History, SQLite, media, AI tạo ảnh, TTS, secret và dashboard. Không nhập demo hoặc dựng provider/storage adapter thứ hai.

## Prompt nhập đề theo từng môn và hướng dẫn tư duy — 2026-10-08

`buildImportPrompt(scope)` trong `src/shared/competition/import.ts` là nguồn chung cho **Sao chép hướng dẫn**, **Xem hướng dẫn** ở Soạn JSON và `POST /api/ioe-violympic/admin/prompt`. Prompt giữ cấu trúc options/answer hiện có và bổ sung teacherNote tùy chọn dành riêng cho giáo viên; không thêm trường dạng câu hỏi. `options` có phương án biểu thị trắc nghiệm một đáp án; `options:[]` biểu thị trả lời ngắn/điền số. Phân số, thập phân và số có đơn vị tiếp tục dùng `answerSpec` khi cần.

Có bốn mẫu prompt riêng theo `scope.subject`: **Toán**, **Toán Tiếng Anh**, **Tiếng Việt**, **IOE Tiếng Anh**. Dòng đầu xác định đúng môn, lớp và tên cấp đã chọn; đổi môn ở Soạn JSON tự đổi cả nội dung xem và sao chép. Mỗi mẫu chỉ ghép yêu cầu của môn đó với các quy tắc chung về chép nguồn, ảnh, JSON và lời giải. Prompt Toán tập trung phép tính/suy luận và đơn vị; Toán Tiếng Anh giữ đề, đáp án và lời giải bằng tiếng Anh đơn giản. Prompt Tiếng Việt tập trung câu chữ, dấu và bằng chứng đọc hiểu/nghĩa từ/quy tắc; IOE tập trung từ vựng/ngữ pháp/đọc/nghe, giữ đề tiếng Anh và giải thích tiếng Việt. Chỉ hai môn Toán có hướng dẫn `answerSpec` phân số/thập phân/số có đơn vị; chỉ IOE có `domain`/`difficulty`. Các mẫu còn lại không nhắc yêu cầu của môn khác hoặc cơ chế chọn ngân hàng. Parser, validation, dữ liệu cũ và cơ chế chọn câu không đổi.

Ngoài nội dung câu hỏi, phương án và đáp án, prompt yêu cầu `title` (tiêu đề/yêu cầu nguồn), `sourceNumber` (đối chiếu số câu gốc) và `explanation`. `passage` chỉ dùng nếu tài liệu có đoạn văn bằng chữ dùng chung cho nhiều câu, chép nguyên văn; nếu không có thì bỏ hoặc để trống. Chỉ IOE Tiếng Anh yêu cầu thêm `domain` và `difficulty` vì bộ chọn IOE dùng ma trận hai tiêu chí này. Toán, Toán Tiếng Anh, Tiếng Việt không yêu cầu phân loại/đánh giá và ẩn hai ô khỏi Soạn JSON. Dữ liệu cũ vẫn giữ metadata; normalizer tiếp tục chấp nhận JSON không có hai trường này. Các môn đó chọn ngẫu nhiên 30 câu khác nhau theo môn/lớp/cấp, không ép tỷ lệ 50% trắc nghiệm–50% trả lời ngắn.

ChatGPT chỉ chép chữ thực sự có trong đề vào `title`, `prompt` và `options`. Không diễn giải hình/biểu đồ thành dữ kiện chung, không chuyển hình thành text hay emoji/icon. Với phương án chỉ có hình, giữ chỗ bằng `{"text":""}` theo đúng thứ tự, vẫn giữ nhãn đáp án nguồn; giáo viên tải ảnh vào từng ô trước khi lưu. Một phương án trống cả chữ lẫn media sẽ bị validation chặn. Đáp án rỗng không tự chọn A khi phương án hình có text rỗng. Với hình ở câu hỏi, giáo viên gắn qua công cụ media hiện có. Việc đọc/đếm hình phục vụ lời giải chỉ nằm trong `explanation`, không được đưa vào nội dung đề. Không tạo ID, URL, media hoặc dữ liệu cá nhân.

Trước đây, `explanation` chỉ chép theo nguồn và để trống nếu thiếu. Nay prompt yêu cầu hướng dẫn như giáo viên trong cả ba trường hợp: nguồn có lời giải đầy đủ, chỉ có đáp án, hoặc chưa có lời giải. Mỗi câu thường có 2–5 bước ngắn (câu đơn giản có thể 1–2), giải thích lý do chọn cách làm, thực hiện và kiểm tra kết quả; ưu tiên cách nhanh, đúng và phù hợp lớp đã chọn. Hướng dẫn Toán chú ý số lượng/chú giải của biểu đồ và ý nghĩa phép tính; Tiếng Việt dùng bằng chứng đọc hiểu/nghĩa từ/quy tắc; IOE dùng dấu hiệu từ vựng/ngữ pháp/đọc/nghe. Toán Tiếng Anh giữ đề, đáp án và hướng dẫn bằng tiếng Anh đơn giản; các môn còn lại hướng dẫn bằng tiếng Việt.

`explanation` vẫn là một chuỗi, dùng `\n` trong JSON để tách bước, được nhập/sửa trong ô **Giải thích** và hiển thị sau khi nộp trong Review/History. Kết luận trắc nghiệm phải kèm nội dung đáp án, không chỉ nhãn A/B/C/D vì thứ tự phương án có thể được trộn. Ví dụ câu chuyển sách từ tủ B (497) sang A (345):

```json
{"explanation":"1. Tủ B nhiều hơn tủ A: 497 − 345 = 152 quyển.\n2. Chuyển 1 quyển thì B giảm 1, A tăng 1; chênh lệch giảm 2 quyển. Vậy cần chuyển 152 : 2 = 76 quyển.\n3. Kiểm tra: 497 − 76 = 421 và 345 + 76 = 421. Hai tủ bằng nhau."}
```

Prompt yêu cầu kiểm tra lời giải với đáp án nguồn. Nếu thiếu khóa đáp án thì vẫn để `answer:""` cho giáo viên hoàn thiện. Nếu hình/dữ kiện không đọc được hoặc khóa đáp án mâu thuẫn với cách giải, ghi rõ **Cần giáo viên kiểm tra: ...** và phần cần xác nhận trong `teacherNote`; không bịa dữ kiện, đổi đề hoặc ép lời giải khớp khóa sai. Giáo viên xem lại JSON và lời giải trước khi lưu. Những câu đã lưu hoặc snapshot của lượt cũ không tự được viết lại; muốn bổ sung hướng dẫn cần sửa câu hoặc nhập lại JSON.

Kiểm tra phạm vi: `npm run test:competition` bao phủ prompt của bốn môn/lớp, API prompt có phân quyền, nhập các chuỗi hướng dẫn nhiều dòng, giữ đáp án chấm được và không lộ lời giải trước nộp; integration SQLite kiểm tra giữ nguyên hướng dẫn qua snapshot, Review và History. Các ví dụ kiểm thử do người phát triển viết, không phải bằng chứng chất lượng đầu ra của một lượt ChatGPT thực tế. Không thêm schema, dependency hoặc biến môi trường.

## Ghi chú riêng cho giáo viên và lỗi đáp án — 2026-10-08

Soạn JSON có ô **Ghi chú cho giáo viên (không hiển thị cho học sinh)**, nhận `teacherNote` là chuỗi tùy chọn, tối đa 5.000 ký tự. Cả bốn prompt yêu cầu đặt thông tin thiếu, khóa đáp án cần xác nhận hoặc mâu thuẫn nguồn vào trường này; `explanation` chỉ chứa hướng dẫn giải dành cho học sinh. Không có ghi chú thì bỏ trường hoặc để chuỗi rỗng. Ghi chú được lưu trong JSON câu hỏi và các phiên bản riêng của giáo viên; không thêm cột/schema hay biến môi trường.

Khi ghép JSON hoặc mở câu cũ để sửa/sao chép, dòng đánh dấu **Cần giáo viên kiểm tra…** (kể cả dòng có số bước, hoặc ở cuối một dòng) và đoạn ghi chú đi kèm được chuyển khỏi Giải thích sang ô ghi chú. Các bước lời giải khác được giữ; ghi chú có sẵn được ghép lại, không lặp một đoạn giống hệt. Normalizer thực hiện cùng quy tắc ở backend trước khi lưu. Ghi chú rỗng khi sửa sẽ xóa ghi chú của phiên bản mới, không thay đổi phiên bản đề hoặc lượt làm đã đóng băng.

`playable` dùng danh sách trường cho phép và loại `teacherNote` khỏi contract học sinh. `feedback.ts` lọc ghi chú ở Review, answerDetails và competitionReview trong History, kể cả cảnh báo từng nằm lẫn trong snapshot/lịch sử cũ. Student API không trả trường hoặc nội dung ghi chú; UI Review có cùng lớp lọc để xử lý dữ liệu đã tải/cached trước bản cập nhật. Các read path không ghi lại dữ liệu lịch sử. Ghi chú vẫn xem/sửa được trong ngân hàng thuộc quyền quản lý, không hiển thị ở xem trước học sinh.

Thông báo **Nội dung trống hoặc vượt quá 2000 ký tự** trước đây gộp hai lỗi của đáp án trả lời ngắn. Nay validation báo riêng **Đáp án trả lời ngắn đang trống** hoặc **Đáp án trả lời ngắn vượt quá 2000 ký tự**. Mỗi đáp án được chấp nhận vẫn có giới hạn 2.000; Giải thích vẫn tối đa 20.000. Nếu nguồn thiếu đáp án, prompt giữ `answer:""` và cảnh báo trong `teacherNote`; giáo viên phải điền đáp án trước khi lưu vào ngân hàng, không tự dùng kết quả suy luận làm khóa chấm.

## Bố cục trang đang thi và tự lưu — 2026-10-07

Trang thi ẩn thông báo lưu thành công, nút **Lưu ngay** và tổng số câu đã trả lời. Nút cũ chỉ đẩy đáp án hiện tại lên server; tự lưu mỗi 3 giây, lưu trước khi **Trả Lời**/Enter chuyển câu, lưu khi nộp, bản sao trên thiết bị và cơ chế phục hồi giữ nguyên. Lỗi lưu/mất mạng vẫn hiện; không che lỗi bằng cách ẩn toàn bộ trạng thái.

Desktop có tiêu đề bên trái, đồng hồ giữa khung và **Nộp bài** bên phải trên cùng một hàng. Mobile để tiêu đề trên hàng riêng cho dễ đọc, đồng hồ và Nộp bài ở hàng dưới. **Câu trước — Trả Lời — Câu tiếp** cùng một hàng ở trái/giữa/phải trên mọi kích thước. Số câu đã có đáp án mang dấu tích và nền cam nhạt; câu hiện tại được đánh dấu riêng, kể cả khi đã trả lời. Thứ tự tab, Enter, điều hướng câu cuối, autosave/retry/submit và chấm điểm giữ nguyên.

Xác minh: 16 competition tests, typecheck/build và native startup đạt trên Node 22.16.0. Browser compiled cô lập kiểm tra bốn môn trong bảng soạn, ảnh phương án tải thủ công, tự lưu thật trên API/tải lại bài, lỗi lưu/retry, Enter/Trả Lời, chấm điểm Toán/Toán Tiếng Anh, IOE 200 câu, Review và History. Bố cục player đạt tại 1440/1024/768/640/390/320px; không overflow/exception, tương phản control tối thiểu 4.91:1; ảnh desktop/mobile đã xem. Bằng chứng `.data/competition-guidance-browser-report.json` và `.data/competition-guidance-{tests,lint,build,startup,browser}.log`. Không gọi mô hình bên ngoài hoặc ghi vào dữ liệu thật của giáo viên/học sinh.

## Phạm vi bản đầu

Giáo viên mở **IOE/Violympic** trong dashboard: chọn môn/lớp/cấp → sao chép hướng dẫn → gửi PDF/ảnh cho ChatGPT → dán JSON → ghép vào bảng → sửa → lưu trực tiếp vào bank. Mọi dòng được kiểm tra lại ở server; thiếu đáp án hoặc nội dung không hợp lệ được báo để giáo viên sửa. Giữ tiêu đề, số nguồn, đoạn văn, nội dung, đủ phương án, đáp án và giải thích. Các dòng đã lưu thành công được bỏ khỏi bảng ngay; retry phần còn lại không tạo bản sao ngoài ý muốn.

Dashboard có bốn tab **Tổng quan → Soạn JSON → Ngân hàng → Kết quả**, mặc định mở Tổng quan. Hai tab Lập đề/Giao lớp và Kho/tiến độ đã bỏ theo yêu cầu. Engine, API đề và bài giao/lịch sử B hiện hữu vẫn tương thích. Tổng quan có bốn bảng theo bốn môn, hàng lớp 1–9 và cột trường/lớp, xã/phường, tỉnh/thành phố, quốc gia; ô không có dữ liệu hiện —, có dữ liệu chỉ hiện số. Bảng chỉ đọc, không có nút hoặc thao tác mở ngân hàng trong ô; hàng và khung bảng được thu gọn. Số câu thực tế không gồm câu archive; tổng môn IOE vẫn gồm luyện tập, hiển thị riêng dưới bảng. Thống kê người chơi đếm danh tính duy nhất, lượt làm tính active/completed, hoàn thành gồm lượt đã nộp hoặc hết giờ được server chấm. Tất cả thống kê tuân theo quyền sở hữu B.

Bank có tìm kiếm, phân trang, xem trước, sửa với revision, sao chép vào bảng soạn, chọn nhiều và xóa mềm. **Xem trước** mở cửa sổ ngay trong viewport, dùng đúng QuestionView của học sinh, có thể chọn/nhập đáp án, sắp xếp và nối cặp. Câu đang soạn hợp lệ dùng cùng cửa sổ này. Câu trả lời xem thử chỉ ở state local; không tạo attempt, điểm hoặc History, không đưa đáp án/giải thích vào giao diện trước khi làm. Có Làm lại, Đóng, Escape/backdrop và giữ focus bàn phím trong cửa sổ; khi đóng trở về nút mở. Checklist: `docs/ioe-preview-checklist.md`.

Giáo viên quản lý câu/đề của mình; super admin quản lý toàn bộ. Lưu hợp lệ đi thẳng vào bank. Môn/lớp/cấp của bảng soạn được khóa đến khi lưu hoặc bỏ các dòng; editor và nút lưu được khóa khi đang ghi hoặc xử lý media.

| Môn | Lớp | Tổng câu | Thời gian | Chọn câu |
|---|---|---:|---:|---|
| IOE Tiếng Anh | 1–2 | 100 | 30 phút | Ma trận riêng, nới quota khi cần |
| IOE Tiếng Anh | 3–9 | 200 | 30 phút | Ma trận riêng, nới quota khi cần |
| Toán | 1–9 | 30 | 30 phút | Đủ câu theo lớp/cấp |
| Toán Tiếng Anh | 1–9 | 30 | 30 phút | Cùng kỹ thuật Toán, nội dung tiếng Anh |
| Tiếng Việt | 1–9 | 30 | 30 phút | Đủ câu theo lớp/cấp |

Cấp IOE: luyện tập và bốn cấp; Toán/Toán Tiếng Anh/Tiếng Việt: bốn cấp trường/lớp, xã/phường, tỉnh/thành phố, quốc gia. Toán giữ mã `math` nên dữ liệu đã lưu không đổi; môn mới dùng `math-english`, ngân hàng và snapshot riêng, tái sử dụng validator số/phân số/đơn vị, chọn 30 câu, media và engine của Toán. Prompt giữ nội dung tiếng Anh, đáp án chữ dùng normalization tiếng Anh, không áp dụng ma trận IOE. Đây là cấu hình sản phẩm được chọn, không phải thông báo quy định cuộc thi chính thức. Bộ chọn IOE thử đáp ứng đồng thời quota kiến thức và độ khó rồi nới nếu kho không thể thỏa mãn. Luôn đủ số câu khác nhau; thiếu tổng số câu sẽ từ chối lập đề và báo thiếu. Các câu cùng nội dung được khử trùng theo fingerprint khi lập đề.

Kết quả mặc định để trống cả ba bộ lọc và trả tất cả bài hoàn thành được phép xem. Bộ lọc độc lập với Soạn JSON/Ngân hàng, chỉ áp dụng khi bấm **Lọc kết quả**; **Xóa bộ lọc** trở về toàn bộ. API mới `/admin/results-page` phân trang 50 bài, tổng đầy đủ, điều kiện tùy chọn `subject`, `grade`, `level`, `paperId`, `page`; không giới hạn 200 bài. API legacy `/admin/results` giữ contract cũ. `/admin/overview` tính inventory/thống kê trong một transaction đọc, không thêm schema hoặc ghi dữ liệu khi tải trang. Bài của paper archive vẫn hiện trong kết quả và History B.

Học sinh mở `/ioe-violympic`, chọn môn/lớp/cấp rồi mở bài trực tiếp khi bank đủ số câu khác nhau theo bảng trên. Không cần giáo viên lập hoặc xuất bản một đề riêng. Bank dùng chung câu hợp lệ, chưa archive của tất cả giáo viên trong cùng môn/lớp/cấp; quyền sửa/xóa câu vẫn theo chủ sở hữu B. Màn hình hiển thị số câu dùng được/số cần, số còn thiếu và số bản trùng khi có; có nút cập nhật. Các bộ lọc ban đầu để trống. Đề công khai cố định đã tạo trước đây vẫn hiện riêng và giữ URL cũ.

Bản đầu có trắc nghiệm với số phương án linh hoạt, nhập chữ/số/phân số/đơn vị, sắp xếp và nối cặp; ảnh/audio nằm tại câu hoặc phương án. Mỗi lượt mới lấy mẫu từ bank hiện tại rồi đóng băng snapshot. Thứ tự câu và phương án được trộn, nhãn phương án được đánh lại theo thứ tự hiển thị, số câu là 1..N của lượt làm. Điều hướng 200 câu có vùng cuộn riêng trên mobile.

Trong bài đang làm, nhập đáp án rồi nhấn **Enter**, hoặc chọn phương án rồi nhấn **Enter**, để sang câu tiếp. Focus chuyển tới ô nhập/phương án của câu mới. Enter trên phương án chưa chọn vẫn chọn phương án đó trước, kể cả khi đã chọn phương án khác; nhấn lại mới chuyển. Câu trống, thao tác composition của bộ gõ, Enter kèm phím bổ trợ và giữ phím không chuyển câu. Câu cuối phải bấm **Nộp bài**, Enter trong vùng trả lời không tự nộp. Đáp án tiếp tục tự lưu theo luồng cũ. Shortcut chỉ bật trong player đang làm; preview/review, audio và các nút điều hướng giữ hành vi riêng. Checklist: `docs/ioe-enter-checklist.md`.

Giao bài cố định dùng `resourceType: competition` trong assignments B. Context lớp, tên bài giao và danh tính học sinh được đọc phía server từ B; không tin tên/user/class do client khai báo. Link đã thu hồi không mở lượt mới. Lượt đã chuẩn bị giữ snapshot riêng để có thể phục hồi. Scope bank động chỉ dùng trực tiếp, không được tạo assignment hoặc gắn context giao bài giả. Lượt từ bank chung hiện trong kết quả của super admin và History riêng của học sinh; giáo viên vẫn xem kết quả của đề thuộc quyền quản lý cũ, không được đọc lượt kho chung của học sinh bất kỳ. Không suy diễn quyền từ việc một giáo viên đóng góp câu vào kho chung.

## Ranh giới kiến trúc

| Vị trí | Vai trò |
|---|---|
| `src/shared/competition/{answer,types,import}.ts` | Contract, normalize/validate JSON, prompt và sanitizer câu học sinh |
| `src/server/ioe-violympic/{selection,graderRegistry}.ts` | Ma trận, chọn câu, shuffle và grader học từ A |
| `src/server/ioe-violympic/{schema,repository,engine,router}.ts` | SQLite B, ownership, immutable versions, attempt và API |
| `src/features/ioe-violympic/{Admin,Overview,Results,BankDirectory,Student,QuestionView,QuestionPreview,Review,MediaEditor,api}.tsx/ts` | Tổng quan, studio/bank/kết quả, thư mục bank học sinh, player, preview modal, review và cầu nối media B |
| `src/features/ioe-violympic/competition.css` | Style chỉ áp dụng trong root module và review IOE/Violympic |

Integration hiện hữu gồm `server.ts`, `src/lib/sqliteStorage.ts`, `src/App.tsx`, `src/appRoutes.ts`, HomePage, AdminDashboard/AdminShell, assignments contracts/service/panel, History types/validation/repository/normalizer/filter/modal, Listening asset archive, và media maintenance. Không thay grader của các môn/module cũ. `src/styles/exam-listening.css` chỉ gộp 75 khai báo reset trùng trong PET Writing/KET; giữ selector và giá trị. Đối chiếu computed style trước/sau của 978 control cho kết quả giống nhau.

## Persistence và engine

Migration `competition-schema-v1` thêm tám bảng: `competition_questions`, `competition_question_versions`, `competition_papers`, `competition_paper_versions`, `competition_imports`, `competition_asset_usages`, `competition_attempts`, `competition_attempt_details`; thêm index theo owner/scope/fingerprint/history/deadline/media. Migration lặp an toàn, chạy trong transaction migration SQLite của B và không sửa dữ liệu cũ.

Paper/version và attempt chứa snapshot bất biến. Sửa/xóa mềm bank hoặc đề không làm đổi nội dung, đáp án hoặc media trong lịch sử đã có. Resource facade B chỉ dùng cho đọc đề khi giao bài và tìm media usage; write path thuộc router module, sử dụng SQLite gateway/transaction sẵn có của B.

`GET /api/ioe-violympic/bank-topics` đọc catalog 153 scope được hỗ trợ, gồm cả scope chưa có câu; chỉ trả metadata đã sanitize, không ghi dữ liệu. ID ổn định dạng `bank-{subject}-{grade}-{level}` được đọc qua URL bài hiện có. Prepare của scope đủ câu chọn mẫu trong transaction rồi lưu metadata paper với `source: bank`, một immutable version mới và attempt bằng các bảng hiện hữu. Metadata paper này không xuất hiện trong danh sách đề cố định. Client không được điều khiển tổng câu, thời gian, owner hoặc đáp án. Retry cùng owner/clientRunId trả version cũ trước khi đọc lại bank; bank bị sửa hoặc thiếu câu sau đó vẫn không làm mất lượt đã chuẩn bị. Không thêm migration/schema trong điều chỉnh này.

Luồng attempt: **prepare → activate → save answers → submit → review/history**. Prepare idempotent theo owner + clientRunId; activate bắt đầu deadline một lần. Mọi lần đọc/ghi đều cần danh tính B và ticket HMAC gắn owner/attempt/version, dùng signing secret hiện có của B với namespace riêng. Save dùng revision và transaction, retry giống nội dung được nhận; bản cũ có nội dung khác trả 409. Submit idempotent. Server chấm từ snapshot riêng, bỏ ghi sau deadline và tự hoàn tất lượt quá hạn khi khởi động/định kỳ. Đồng hồ client chỉ để hiển thị, được hiệu chỉnh bằng serverNow.

Autosave ba giây, lưu ngay, lưu tạm sessionStorage và phục hồi sau reload. Phản hồi autosave không gửi lại toàn bộ đề. Khi xung đột phiên, dừng autosave và giữ bản sao câu trả lời trước khi đồng bộ server; bản tải xuống chỉ chứa tiêu đề/câu trả lời, không có ticket hoặc credential. Score lưu raw/max và chuẩn hóa 0–100; mỗi câu tối đa 10 điểm.

API public/pre-submit chỉ trả metadata và câu đã sanitizer; không có ownerId, số nguồn, answerSpec hoặc giải thích. Review sau nộp có đủ phương án, lựa chọn, đáp án đúng, media, giải thích và dữ liệu nhập/sắp xếp/nối cặp. Completed attempts được UNION vào Learning History B; không tạo hệ hồ sơ/hệ lịch sử riêng.

## Media và vận hành

Editor luôn hiện **Tải ảnh, Dán ảnh, Tải audio, Nghe thử**, tái sử dụng FileDropPasteInput/AudioPreviewButton và upload của B. Nghe thử mở khi có URL audio; có nút gỡ media đã gắn. Bỏ phần tạo ảnh AI/TTS trong editor IOE, ô Số nguồn PDF và editor JSON cả câu. Số nguồn đã nhập và dữ liệu game nâng cao vẫn giữ trong snapshot; nhập JSON/game, đáp án nâng cao và preview vẫn hoạt động. Chỉ lưu metadata/URL. Media upload tuân theo kiểm tra MIME/kích thước/owner của B; khóa lưu/chuyển tab trong lúc upload. Usage của version được giữ để archive asset và maintenance của B không làm mất media lịch sử. Maintenance vẫn mặc định dry-run, không có cleanup tự động. Dịch vụ ảnh/TTS của các module khác giữ nguyên.

## Trang con học sinh và luyện câu sai — 2026-10-05

`/ioe-violympic` mở từ trang chủ B vào khu học riêng, lấy bố cục hero, thống kê và các khu hoạt động của StudentHomeView/MockExamHubView trong A. Có **Tổng quan, Thi thử, Luyện tập** và đường về History B. Thi thử có bốn môn, chọn môn/lớp/cấp, trạng thái đủ/thiếu câu; lấy mẫu mới từ kho chung mỗi lượt theo số câu đã chốt, không cần đề công khai. Đề cố định cũ nằm trong mục riêng và link giao bài B tiếp tục dùng được.

`GET /api/ioe-violympic/practice` cần danh tính B đã xác minh và chỉ trả thống kê/nhóm câu sai của owner hiện tại. Server đọc các lượt đã hoàn thành và review đã chấm, theo thứ tự ghi completion. Câu chưa trả lời không vào kho; kết quả trả lời gần nhất của từng question ID quyết định còn cần luyện hay đã làm đúng. Nội dung gốc, media và đáp án riêng lấy từ snapshot trong attempt, kể cả bank đã archive/sửa. Không tin owner hoặc danh sách câu từ client và không gửi đáp án/giải thích trong metadata.

Nhóm riêng có ID `mistakes-{subject}-{grade}-{level}`. Lượt mới lấy ngẫu nhiên tối đa 10 câu sai trong một nhóm; có 1 câu vẫn luyện được, không đòi quota thi thử. Không còn câu sai thì hiển thị trạng thái trống, không lấy câu ngẫu nhiên thay thế. Thời gian 30 phút và engine signed/server-grade/autosave/review giống luồng thi hiện có. Prepare tạo version riêng với `source: mistakes`, visibility assignment; source này không vào catalog đề công khai hoặc assignment. Retry cùng owner/clientRunId trả snapshot đã chuẩn bị, kể cả sau khi em làm đúng hết câu.

Làm đúng trong một bài đã nộp gỡ câu khỏi danh sách cần luyện; bỏ trống hoặc làm sai tiếp giữ lại. History cũ không sửa và kết quả luyện ghi vào cùng Learning History B. Thống kê trên trang con lấy từ dữ liệu thật; chưa có danh tính thì không giả lập kết quả. Không thêm bảng, schema, profile hay kho media. Queue được suy ra từ History theo owner, đọc từng batch 100 bản ghi; có thể bổ sung read model khi lượng History thực tế lớn, sau đo đạc. Mã mới: `StudentPortal.tsx` và `src/server/ioe-violympic/practice.ts`. Checklist: `docs/ioe-portal-speaking-checklist.md`.

Module khả dụng với `STORAGE_MODE=sqlite`, mặc định bật; `IOE_VIOLYMPIC_ENABLED=false` tắt API/lối vào mới bằng runtime capability. History đã ghi vẫn đọc bằng History B. Giữ `LEARNING_HISTORY_ENABLED=true` để học sinh xem History. Production cần Node 22.x, better-sqlite3 10.1.0, DB persistent/WAL và các secret B hiện hữu; không thêm secret/provider mới. Khi phát hành thực tế, backup DB bằng quy trình B trước migration. Chưa deploy hoặc sửa DB production trong task này.

Rollback chức năng: tắt runtime flag, giữ nguyên bảng/versions/attempts/media; không drop bảng hoặc rewrite lịch sử. Nếu rollback cả release, dùng backup/artifact theo quy trình B đã có, đánh giá dữ liệu mới trước khi phục hồi DB.

## Kiểm chứng

Bản Enter chuyển câu: 61 scoped tests, TypeScript/build/startup Node 22.16.0 và hai bundle smoke IOE/Speaking đạt. Browser compiled kiểm tra text/choice, native chọn/đổi phương án, focus, blank/composition/modifier/repeat guard, save/reload và câu cuối không tự nộp; 30 câu Toán Tiếng Anh chuyển bằng Enter đạt 300/300. Preview, audio, submit một lần, IOE games và History giữ hành vi; desktop/mobile 1440/390/320px không overflow hoặc browser exception, contrast >=6.70:1. QA dùng fixture riêng; localhost chỉ kiểm tra đọc. Bằng chứng: `docs/ioe-enter-checklist.md`.

Bản sửa Xem trước: 61 competition/admin/History/legacy tests đạt, typecheck/build/startup Node 22.16.0 đạt; browser compiled kiểm tra câu nháp và cả bốn dạng câu bank tại 1440/390/320px, media, reset/reopen, Escape/backdrop/keyboard/focus và 0 request write. Browser không exception/overflow; computed contrast >=6.70:1; 978 control cũ giữ style. Toàn bộ luồng làm bài cũ, History và hai bundle smoke IOE/Speaking đạt. Kiểm tra localhost chỉ đọc xác nhận preview của câu thật. Bằng chứng: `docs/ioe-preview-checklist.md`.

Bản học trực tiếp từ bank ngày 2026-10-04: `test:phase3` cuối 581 pass/0 fail, gồm typecheck/build/startup Node 22.16.0; 10 competition tests và 5 assignment tests. Browser compiled cô lập kiểm tra readiness/thiếu/loading/error ở 1440/390/320px, Toán và Toán Tiếng Anh 300/300, IOE 200 câu/game, autosave/reload/review/History và đề/giao bài cố định cũ; 0 exception. Production bundle guest lấy 30 câu từ bank đạt 300/300, giữ media/History và từ chối bypass production. Localhost thật có Toán lớp 3 cấp trường 30/30, ready=true; không ghi lượt kiểm thử vào DB người dùng. 58 bảng/1310 hàng trước và sau restart giữ nội dung, quick_check=ok/WAL. Checklist và log chi tiết: `docs/ioe-bank-start-checklist.md`.

Bản điều chỉnh bốn môn/Tổng quan/Kết quả ngày 2026-10-04: gate hồi quy 535 pass/0 fail, gồm 9 test module (201 kết quả/phân trang/quyền/lớp/cấp/archived). Typecheck/build chuẩn và browser desktop/mobile đạt; Toán và Toán Tiếng Anh full flow đạt 300/300. Bảng kết quả mobile dùng cột có chiều rộng tối thiểu và cuộn ngang, kiểm tra thực tế width/titleWidth/rowHeight để tránh ép tiêu đề thành một ký tự mỗi dòng. Bundle production chạy trên backup fixture đạt guest/media/History và từ chối bypass local. 68 JS/CSS artifact, không thiếu tham chiếu. Log mới: `four-subjects-phase3.log`, `four-subjects-final-lint.log`, `four-subjects-build.log` cùng report browser/bundle trong `.data/ioe-verification`.

Kiểm chứng phát hành đầu trước bản điều chỉnh:

- `npm run test:phase3`: 533 test pass, 0 fail, gồm module mới; bao gồm typecheck, các domain cũ, history/legacy, build và startup.
- `npm run test:competition`: 7 test pass; kiểm tra malformed input, quyền, snapshot/version, quota, số câu, ticket, tranh chấp, retry, deadline, guest capability B, History và maintenance dry-run.
- Browser: desktop 1440, mobile 390; JSON lỗi/hợp lệ, media clipboard/upload/remove, chặn lưu khi media đang xử lý, bank, lập đề, giao lớp B, làm bài, autosave/reload, điểm 300/300, review và modal History; IOE 200 câu và sắp xếp/nối cặp; keyboard focus, tương phản control >=4.5 và không tràn trang.
- Bundle production: bypass local bị từ chối; HTML/assets, prepare/activate/save/submit, B guest profile, review/media và History đạt trên backup fixture. Startup kiểm tra missing-file gate, integrity, WAL, graceful close/reopen.
- Log/checkpoint ở `.data/ioe-verification/`: `baseline-phase3.log`, `release-phase3.log`, `final-build.log`, `browser-report.json`, `bundle-report.json`. Baseline gặp assertion budget CSS có sẵn; đã sửa bằng gộp khai báo trùng, không nới assertion. Vite còn cảnh báo kích thước chunk của dự án; không có lỗi build.

Browser QA chỉ chạy trên DB fixture riêng, qua `npm run dev:local`; không dùng DB thật. Ví dụ PowerShell, dùng Node 22 đang cấu hình:

```powershell
$env:PORT='3016'
$env:LOCAL_TEST_SQLITE_DRIVER='better-sqlite3'
$env:LOCAL_TEST_SQLITE_DB_PATH=Join-Path (Get-Location) '.data\ioe-verification\browser-2.sqlite'
$env:SEED_DATA_ENABLED='false'
$env:LEARNING_HISTORY_ENABLED='true'
npm run dev:local
# Trong terminal thứ hai, cùng workspace/Node 22:
$env:COMPETITION_QA_ALLOW_FIXTURE_WRITES='true'
npm run test:competition-browser
npm run build
npm run test:competition-bundle
```

Browser fixture tạo câu/lớp/bài giao QA và xóa mềm các câu QA cũ trong scope kiểm thử; sẽ từ chối nếu thấy câu khác. Bản đối chiếu CSS trước thay đổi nằm ở `.data/ioe-verification/exam-listening-before.css`, là checkpoint của task này. Bundle smoke tạo backup DB fixture riêng, không ghi DB nguồn. Provider AI tạo ảnh/TTS thật chưa được gọi trong QA; API/provider của B được kiểm thử bằng fixture/mock, việc sử dụng thật vẫn phụ thuộc cấu hình B hiện có.

Các bước sau theo phương án đã duyệt: game bổ sung của A, AI tạo đề hàng loạt và thống kê nâng cao. Kết quả quản trị hiện phân trang toàn bộ; History B tiếp tục là lịch sử học sinh chung.

## File của thay đổi này

Tạo mới:

```text
docs/ioe-violympic-checklist.md
docs/ioe-violympic-module.md
scripts/ioe-violympic-browser-smoke.mjs
scripts/ioe-violympic-bundle-smoke.mjs
src/features/ioe-violympic/Admin.tsx
src/features/ioe-violympic/Overview.tsx
src/features/ioe-violympic/Results.tsx
src/features/ioe-violympic/BankDirectory.tsx
src/features/ioe-violympic/MediaEditor.tsx
src/features/ioe-violympic/QuestionView.tsx
src/features/ioe-violympic/QuestionPreview.tsx
src/features/ioe-violympic/Review.tsx
src/features/ioe-violympic/Student.tsx
src/features/ioe-violympic/api.ts
src/features/ioe-violympic/competition.css
src/server/ioe-violympic/competition.test.ts
src/server/ioe-violympic/engine.ts
src/server/ioe-violympic/graderRegistry.ts
src/server/ioe-violympic/repository.ts
src/server/ioe-violympic/router.ts
src/server/ioe-violympic/schema.ts
src/server/ioe-violympic/selection.ts
src/shared/competition/answer.ts
src/shared/competition/feedback.ts
src/shared/competition/import.ts
src/shared/competition/types.ts
```

Tích hợp có chủ đích vào B:

```text
CODEMAP.md
package.json
scripts/media-orphan-maintenance.mjs
server.ts
src/App.tsx
src/appRoutes.ts
src/components/admin/AdminDashboard.tsx
src/components/admin/AdminShell.tsx
src/components/admin/assignments/AssignmentManagementPanel.tsx
src/components/history/HistoryDetailModal.tsx
src/components/history/HistoryFilters.tsx
src/components/history/historyTypes.ts
src/features/home/HomePage.tsx
src/lib/sqliteStorage.ts
src/server/assignments/contracts.ts
src/server/assignments/service.ts
src/server/learning-history/learningDetailNormalizer.ts
src/server/learning-history/learningHistoryRepository.ts
src/server/learning-history/learningHistoryTypes.ts
src/server/learning-history/learningHistoryValidation.ts
src/server/listening/listeningRouter.ts
src/styles/exam-listening.css
src/types.ts
```

`dist/client` và `dist/server.cjs(.map)` được sinh lại bằng build chuẩn. Các file FCE Reading đang thay đổi trước task được giữ, không thuộc danh sách source mới/sửa của IOE/Violympic.
