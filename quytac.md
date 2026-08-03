# Quy tắc làm việc và sửa code an toàn

Tài liệu này áp dụng cho mọi AI agent hoặc lập trình viên làm việc trong dự án. Mục tiêu là sửa đúng nguyên nhân, giới hạn phạm vi, bảo vệ dữ liệu và tránh chu kỳ sửa lỗi vòng quanh mà không có bằng chứng.

## 1. Thứ tự đọc trước khi làm việc

Trước mọi thay đổi phải:

1. Đọc `quytac.md`.
2. Đọc toàn bộ `CODEMAP.md` và `package.json` khi thay đổi kiến trúc, dữ liệu, build hoặc deploy.
3. Đọc file yêu cầu/attachment của người dùng bằng đúng encoding UTF-8.
4. Đọc đầy đủ source, type, API, validation, test và tài liệu liên quan trực tiếp.
5. Chạy `git status --short` để nhận diện thay đổi có sẵn của người dùng.
6. Xem lịch sử Git gần nhất của khu vực sẽ sửa khi lỗi có thể là regression.
7. Không bắt đầu sửa khi chưa mô tả được luồng dữ liệu hiện tại và kết quả mong muốn.

## 2. Giữ đúng phạm vi

- Chỉ sửa chức năng được yêu cầu và các dependency trực tiếp thật sự cần thiết.
- Sửa chức năng A không được làm thay đổi hành vi chức năng B nếu người dùng không yêu cầu.
- Không nhân tiện refactor, đổi tên, format hàng loạt hoặc nâng dependency ngoài phạm vi.
- Nếu cần mở rộng phạm vi để sửa đúng, phải nêu rõ lý do, tác động và xin xác nhận khi thay đổi là đáng kể.
- Ưu tiên thay đổi nhỏ nhất giải quyết được nguyên nhân gốc, nhưng không dùng bản vá che triệu chứng.
- Giữ tương thích ngược với dữ liệu, URL, API và hành vi đã phát hành trừ khi có kế hoạch migration/rollout rõ ràng.

## 3. Bảo vệ thay đổi của người dùng

- Mọi thay đổi có sẵn trong worktree đều thuộc về người dùng cho đến khi có bằng chứng khác.
- Không dùng `git reset --hard`, `git checkout --`, xóa file hoặc ghi đè thay đổi ngoài phạm vi.
- Không sửa trực tiếp file sinh tự động trong `dist`; sửa source rồi build lại bằng script chuẩn.
- Không commit, push, force-push hoặc tạo PR nếu người dùng chưa yêu cầu.
- Trước khi bàn giao phải xem `git diff --check`, `git diff --stat` và diff của từng file đã sửa.

## 4. Chẩn đoán trước, sửa sau

Mọi lỗi phải đi qua chu trình:

1. Tái hiện lỗi hoặc thu thập bằng chứng gần nhất có thể.
2. Truy vết end-to-end: UI → client state → API request → router/service → storage → API response → UI.
3. Phân biệt rõ:
   - không có code;
   - code không chạy;
   - ghi thất bại;
   - ghi đúng nhưng đọc sai;
   - API bỏ dữ liệu;
   - UI bỏ qua dữ liệu;
   - build/deploy đang chạy artifact cũ.
4. Nêu giả thuyết và bằng chứng ủng hộ/phủ định.
5. Chỉ sửa sau khi xác định được nguyên nhân gốc hoặc có thí nghiệm nhỏ để phân biệt các giả thuyết.
6. Sau khi sửa phải chạy lại đúng đường lỗi ban đầu, không chỉ dựa vào build thành công.

Không được sửa ngẫu nhiên nhiều vị trí cùng lúc rồi hy vọng lỗi biến mất.

## 5. Quy tắc chống sửa lỗi vòng lặp

- Mỗi lần thử phải ghi nhận: giả thuyết, thay đổi/thí nghiệm, kết quả và bằng chứng mới.
- Không lặp lại cùng một cách sửa nếu không có thông tin mới.
- Nếu một lần sửa không tạo thêm bằng chứng mới hoặc không thay đổi triệu chứng,
- không tiếp tục sửa cùng hướng. Quay lại chẩn đoán trước lần sửa tiếp theo.

- Nếu blocker không thể giải quyết bằng source, test hoặc công cụ hiện có,
báo rõ thông tin còn thiếu thay vì suy đoán.
- Không đổi frontend khi bằng chứng chỉ ra backend/storage, và ngược lại.
- Không kết luận “cache” hoặc “deploy” nếu chưa kiểm tra asset hash, server bundle, process restart và response thực tế.
- Khi test pass nhưng lỗi thực tế còn tồn tại, phải kiểm tra test có thật sự đi qua production path hay chỉ dùng fixture/mock quá đơn giản.

Mẫu nhật ký chẩn đoán ngắn:

```text
Giả thuyết:
Bằng chứng hiện có:
Thí nghiệm/kiểm tra:
Kết quả:
Kết luận tiếp theo:
```

## 6. Kiểm thử có tỷ lệ với rủi ro

- Trước khi sửa, chạy test hẹp liên quan nếu có thể để biết baseline.
- Sau khi sửa, chạy test hẹp trước, rồi test rộng hơn theo mức ảnh hưởng.
- Mọi bug fix quan trọng phải có regression test tái hiện nguyên nhân khi phù hợp.
- Không xóa, bỏ qua hoặc làm yếu assertion chỉ để test pass.
- Không thay thế validation thực bằng ép kiểu, `any`, giá trị mặc định che lỗi hoặc `try/catch` nuốt lỗi.
- Test phải bao phủ cả happy path, malformed input, quyền truy cập và dữ liệu legacy khi liên quan.
- Build pass không thay thế kiểm thử hành vi.
- Với UI, kiểm tra desktop/mobile, trạng thái loading/error/empty/disabled và keyboard/focus khi liên quan.

Các quality gate chuẩn của dự án:

```bash
npm run lint
npm run test:listening
npm run test:history
npm run test:legacy-contracts
npm run test:phase2
npm run build
```

Chỉ chạy tập gate phù hợp phạm vi, nhưng thay đổi cross-cutting hoặc trước deploy phải dùng gate rộng tương ứng.

## 7. An toàn dữ liệu và storage

- Không chạy xóa dữ liệu tự động trong startup, login, page load hoặc read endpoint.
- Yêu cầu “gần đây” phải được thực hiện bằng query/filter trước, không bằng physical delete.
- Cleanup phải là maintenance task riêng, có dry-run, backup, phạm vi rõ và xác nhận.
- Production SQLite phải dùng persistent path ngoài deploy directory.
- Không seed hoặc tự tạo database production ngoài ý muốn.
- Migration phải additive, idempotent và giữ nguyên dữ liệu cũ.
- Thứ tự migration SQLite: tạo bảng nền → thêm cột thiếu → backfill nếu cần → tạo index → ghi dữ liệu mới.
- Trước thay đổi schema/storage/auth/persistence phải backup database và kiểm thử trên bản sao production-shaped.
- Không lưu binary/base64 ảnh hoặc audio trong SQLite/Firestore JSON; chỉ lưu metadata và URL/storage key.
- Không đưa secret, `.env`, private key, diagnostic secret hoặc API key vào source, log, test fixture hay tài liệu.

Production baseline cần giữ nếu chưa có kế hoạch nâng cấp riêng:

- Node.js `22.x`.
- `better-sqlite3@10.1.0` exact pin.
- SQLite WAL.
- `STORAGE_MODE=sqlite` với đường dẫn production đã cấu hình ngoài release directory.

## 8. API, auth và bảo mật

- Backend là write path chính cho dữ liệu quản trị và kết quả học tập.
- Mỗi endpoint phải xác định rõ: public, authenticated, teacher/super admin hay owner-only.
- Không tin `userId`, role, owner key, score hoặc answer key do client tự khai báo.
- Xác thực quyền sở hữu ở backend trước khi đọc hoặc sửa set, asset, attempt và detail.
- Public/student response phải qua sanitizer và không được lộ raw owner ID, guest ID, đáp án hoặc logic chấm điểm.
- Cross-owner detail lookup phải trả 404 khi phù hợp để không lộ sự tồn tại của dữ liệu.
- Dùng deterministic ID/idempotency key cho retry khi nghiệp vụ yêu cầu.
- Không log access token, run secret, prompt bí mật, API key hoặc answer key không cần thiết.
- Bypass đăng nhập chỉ được phép qua `npm run dev:local`: phải đồng thời có cờ explicit, backend non-production, hostname loopback, socket loopback và token local cố định. Production phải từ chối khởi động nếu cờ bypass backend bị bật; không được dùng bypass này trên host hoặc với dữ liệu production.

## 9. Quy tắc riêng cho AI

- AI provider chỉ được gọi từ backend.
- AI output luôn là dữ liệu không đáng tin cậy: phải parse, normalize, runtime schema check và validation.
- Response schema của provider không thay thế validation nghiệp vụ.
- AI không được tự sinh ID database; code sinh ID sau normalize.
- AI không được tự publish. Với Mover Part 1/2, sau khi `basePartHash` còn khớp, dữ liệu trích xuất được phép điền thẳng vào working draft theo quyết định nghiệp vụ ngày 2026-08-02; form soạn chính là bề mặt review và vẫn phải cho sửa/undo trước khi publish. Part 3-5 tiếp tục dùng candidate riêng cho đến khi có quyết định khác.
- AI phải trả cảnh báo/unknown khi thiếu dữ kiện; không đoán đáp án để làm dữ liệu hoàn chỉnh giả tạo.
- Prompt và extractor phải riêng theo module + Part khi cấu trúc khác nhau.
- Whole-exam import phải điều phối các Part độc lập; một Part lỗi không hủy kết quả Part khác.
- Kết quả AI phải gắn với hash/revision của dữ liệu đầu vào để tránh ghi đè draft mới hơn.
- Automated test dùng provider mock/fixture; không phụ thuộc output trực tiếp của model thật.
- Có giới hạn file, timeout, abort, concurrency, rate limit và quota.
- Chỉ gửi cho provider lượng dữ liệu tối thiểu cần thiết và không gửi PII ngoài mục đích nghiệp vụ.

## 10. Quy tắc riêng cho Listening

- Listening là resource riêng, không phải `VocabSet`.
- Mover hiện có đúng năm Part, năm câu chấm điểm mỗi Part và 25 câu tổng cộng cho schema v1.
- Parts 1 và 5 hiện dùng vùng tương tác; tọa độ phải chuẩn hóa trong khoảng 0-1.
- Published version là bất biến.
- Khi summary và chi tiết Listening được lưu ở hai collection/bảng khác nhau,
  mọi adapter lịch sử/kết quả quản trị phải ghép chi tiết sau khi kiểm tra quyền.
  API công khai và nhánh học sinh không được ghép answer key. Regression test
  phải phủ cả hai nhánh để tránh trường hợp summary có điểm nhưng modal quản trị
  hiện `0 dòng` trong khi chi tiết vẫn tồn tại trong storage.
- Student snapshot phải loại bỏ answer key trước khi gửi xuống client học sinh.
- Grader phải ở backend và chấm trên immutable published version.
- Legacy record thiếu `moduleId` được đọc như Mover; không tự rewrite hàng loạt.
- Smart Editor phải là lớp tạo working draft, không thay đổi attempt/player/history ngoài phạm vi.
- Listening Smart Editor tuyệt đối không dùng audio để trích xuất hoặc suy luận đáp án. Audio chỉ được upload, gắn vào Part và phát cho học sinh; request gửi AI không được chứa audio/audio transcript để tìm answer key.
- Dữ liệu AI trích từ ảnh/text luôn phải điền vào trường soạn có thể chỉnh sửa. Part 1/2 nhập trực tiếp vào working draft sau kiểm tra hash và giáo viên/admin xem lại ngay tại form chính trước khi publish; Part 3-5 vẫn cần bước xác nhận candidate riêng.
- Phân tích lại Part N chỉ được thay Part N; không được thay các Part còn lại. Part 1/2 có thể thay ngay working draft theo luồng direct import đã duyệt, nhưng tuyệt đối không tự publish.
- Part 5 mới chỉ cho giáo viên chọn màu từ catalog 20 màu tiếng Anh đã duyệt; không dùng color picker, tên màu hoặc mã HEX tự do. Dữ liệu legacy ngoài catalog vẫn phải đọc/chơi/chấm được và không bị tự rewrite khi mở editor.
- Không dùng một prompt/parser chung cho năm Part.
- Không ép cùng số Part của Starter/Mover/Flyer/KET dùng chung handler.
- Nếu thay đổi schema Part hoặc grader, phải có schema version, compatibility adapter và kế hoạch migration/rollout rõ ràng.

Kế hoạch Smart Editor chi tiết nằm tại `docs/listening-smart-editor-plan.md`.

## 11. UI và CSS

- Đọc `src/index.css` trước khi sửa giao diện vì global selectors có thể ghi đè Tailwind classes.
- Giữ nền sáng và độ tương phản đọc được.
- Disabled control vẫn phải nhìn thấy; không dùng chữ gần trùng màu nền.
- Không dùng broad global selector cho một feature mới; ưu tiên selector giới hạn theo feature root ID/class.
- Giữ accessibility: label, aria-label, focus-visible, keyboard navigation và modal focus behavior.
- Kiểm tra chuỗi tiếng Việt bằng UTF-8; không sửa mojibake bằng thao tác thay thế hàng loạt khi chưa xác định encoding thật.

### Hợp đồng tương phản bắt buộc cho trang/module mới

- Mỗi trang hoặc module tương tác mới phải có một root `id`/class ổn định và các nút chính phải có semantic hook ổn định; không được chỉ dựa vào utility như `bg-*`, `text-white` hoặc opacity vì `src/index.css` có các luật toàn cục dùng `!important`.
- Màu chữ/icon/nền/viền của nút phải được kiểm tra ở computed style sau toàn bộ cascade, không kết luận từ tên class trong JSX. Icon dùng `currentColor` và phải được kiểm tra cùng trạng thái của nút cha.
- Mọi nút phải đạt tối thiểu WCAG AA: chữ thường tối thiểu 4.5:1; chữ lớn và icon điều khiển tối thiểu 3:1 so với nền. Không dùng chữ trắng trên nền trắng/pastel hoặc chữ xám nhạt trên nền sáng.
- Phải kiểm tra đủ trạng thái: mặc định, hover, focus-visible, selected/active, disabled, loading, empty và lỗi. Disabled vẫn phải đọc/nhận biết được, nhưng khác rõ với enabled.
- Nút chỉ có icon hoặc ô màu phải có `aria-label`; trạng thái chọn phải có `aria-pressed`, `aria-current` hoặc thuộc tính tương đương. Nội dung hỗ trợ accessibility không bắt buộc hiển thị thành chữ nếu thiết kế yêu cầu chỉ dùng màu/icon.
- Khi thêm control vào Listening player, phải dùng selector nằm dưới root của player và cập nhật regression test hợp đồng tương phản. Không mở rộng allowlist toàn cục chỉ để sửa một nút riêng.
- Trước khi bàn giao UI mới phải kiểm tra trực quan trên desktop và mobile, đồng thời kiểm tra computed foreground/background của các control chính. Build/typecheck pass không thay thế bước này.

## 12. Build và deploy

- Source là nguồn sự thật; không chỉnh sửa `dist` thủ công.
- `npm run build` luôn phải chứa nút và route Student History; không được dùng build-time flag để loại bỏ chức năng này khỏi client. `npm run build:history-ui` chỉ còn là alias tương thích và phải tạo cùng một loại artifact.
- `LEARNING_HISTORY_ENABLED` là runtime flag phía server cho API/projector. Bật/tắt flag này không được làm biến mất nút History ở lần build kế tiếp; khi backend chưa sẵn sàng, UI phải hiển thị trạng thái lỗi/không khả dụng có thể hiểu được.
- Sau mọi thay đổi build script hoặc trước deploy, phải có regression test hoặc kiểm tra artifact xác nhận `student-history-nav-btn` tồn tại trong client bundle và chuỗi `VITE_LEARNING_HISTORY_ENABLED` không còn là điều kiện biên dịch.
- Control quan trọng đã phát hành (History, điều hướng, submit, back/home) không được phụ thuộc một biến build tùy chọn có default “off”. Nếu cần rollout/rollback, ưu tiên runtime capability phía server và trạng thái UI rõ ràng.
- Thay đổi backend yêu cầu deploy `dist/server.cjs` và restart Node/Passenger.
- Sau deploy phải xác minh:
  - Git commit đang chạy.
  - Tên/hash client asset.
  - Server bundle đã cập nhật.
  - Node process đã restart.
  - API smoke và browser smoke thực tế.
- Không kết luận deploy thành công chỉ vì Git push thành công.
- Cập nhật CODEMAP version/deployment ledger khi thay đổi artifact hoặc kiến trúc đáng kể.

### Quy tắc tốc độ TTS theo provider

- Chỉ gửi tham số tốc độ cho provider khi hợp đồng API đã xác nhận hỗ trợ. Không tự thêm trường chưa được tài liệu hoặc response contract xác nhận.
- Nếu provider không hỗ trợ tốc độ lúc tạo file nhưng sản phẩm cần điều chỉnh, lưu tốc độ trong metadata và áp dụng bằng `HTMLAudioElement.playbackRate` qua helper phát audio dùng chung.
- Không áp dụng tốc độ hai lần: audio AI33 đã được render với tốc độ provider phải phát ở `1.0`; audio YupVox dùng file gốc và chỉ áp dụng `ttsSpeed` ở lớp playback.
- Thay đổi tốc độ playback không được tạo file YupVox trùng lặp; cache hash của raw audio phải dùng tốc độ tạo thực tế của provider.
- Mọi game/preview phát audio từ vựng phải đi qua helper chung hoặc truyền cùng quy tắc playback rate; thêm provider/control mới phải có regression test cho UI, metadata, cache và player.

## 13. Quy trình chuẩn cho AI agent

### Bước 1 - Intake

- Viết lại yêu cầu và tiêu chí hoàn thành.
- Xác định rõ việc được phép sửa và việc ngoài phạm vi.
- Liệt kê giả định; hỏi lại nếu giả định có thể thay đổi dữ liệu/schema/hành vi đáng kể.

### Bước 2 - Inspect

- Đọc CODEMAP, package, target source, tests, styles và Git history liên quan.
- Lập sơ đồ luồng dữ liệu và ownership/security boundary.

### Bước 3 - Diagnose/Design

- Với bug: tái hiện và xác định nguyên nhân gốc.
- Với feature: xác định invariants, compatibility và rollback trước khi code.
- Chọn thay đổi nhỏ nhất đáp ứng đầy đủ yêu cầu.

### Bước 4 - Implement

- Chia thay đổi thành lát nhỏ có thể kiểm thử.
- Tránh sửa đồng thời nhiều tầng nếu chưa có test/bằng chứng cho từng tầng.
- Dùng type rõ ràng; hạn chế `any` và fallback che lỗi.
- Không làm thay đổi file ngoài phạm vi.

### Bước 5 - Verify

- Chạy test hẹp → test tích hợp → typecheck/build theo mức ảnh hưởng.
- Kiểm tra lại đường lỗi hoặc use case thực tế.
- Xem diff để phát hiện thay đổi ngoài ý muốn.

### Bước 6 - Handoff

- Nêu kết quả trước.
- Liệt kê file đã sửa.
- Nêu test đã chạy và kết quả.
- Nêu phần chưa thể xác minh và bước deploy/rollback nếu có.
- Không tuyên bố hoàn thành nếu còn tiêu chí bắt buộc chưa đạt.

## 14. Khi nào phải dừng và hỏi người dùng

- Yêu cầu có thể hiểu theo nhiều cách và mỗi cách làm thay đổi schema/hành vi khác nhau.
- Cần xóa, di chuyển hoặc rewrite dữ liệu.
- Cần thay đổi grader hoặc published contract.
- Cần mở rộng phạm vi sang chức năng khác.
- Thiếu fixture hoặc quy tắc nghiệp vụ để xác định đáp án đúng.
- Phát hiện thay đổi người dùng xung đột trực tiếp với yêu cầu.
- Không thể xác minh production state bằng quyền hiện có.
- Cùng blocker đã lặp lại ba lần mà không có bằng chứng mới.

## 15. Định nghĩa hoàn thành

Một thay đổi chỉ được coi là hoàn thành khi:

- Đáp ứng đúng yêu cầu và tiêu chí chấp nhận.
- Không có thay đổi ngoài phạm vi.
- Không làm hỏng chức năng hiện có liên quan.
- Có regression test phù hợp hoặc lý do rõ ràng khi không thể tự động hóa.
- Typecheck/test/build cần thiết đã pass.
- Không có secret hoặc dữ liệu nhạy cảm trong diff/log.
- Dữ liệu legacy vẫn đọc được hoặc có migration/rollback đã xác minh.
- Tài liệu/CODEMAP được cập nhật nếu kiến trúc, API, schema, vận hành hoặc deploy thay đổi.
- Người dùng nhận được báo cáo chính xác, không che giấu phần chưa kiểm chứng.
