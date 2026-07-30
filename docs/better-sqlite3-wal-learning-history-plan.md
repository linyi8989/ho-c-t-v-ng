# Kế hoạch chuyển better-sqlite3 + WAL và xây dựng Lịch sử học tập

> Trạng thái: **Release A đã cutover production; Release B đã hoàn tất triển khai và quality gate ở local, chưa deploy production**
> Ngày khảo sát repository: 2026-07-30  
> Ngày xác minh production: 2026-07-31
> Ngày hoàn tất Release B local: 2026-07-31
> Database production duy nhất trong phạm vi kế hoạch:
> `/home/qzmivzbj/app-data/vhomework/app.sqlite`

## Tiến độ triển khai Release A — 2026-07-30

| Gói | Phạm vi | Trạng thái |
| --- | --- | --- |
| 1 | Production copy/baseline/dependency graph | Đã xác minh production DB 113 MiB, schema và table counts trước migration |
| 2 | Rollback window/runbook | Đã stop toàn bộ orphan `lsnode` worker và tạo verified pre-migration backup |
| 3 | cPanel preflight + exact pin | `better-sqlite3@10.1.0` build-from-source và isolated preflight pass trên Node 22.16/glibc 2.28/GCC 8.5 |
| 4 | Path policy/factory/native primitives | Đã triển khai và typecheck |
| 5 | Startup gate/migration runner | Đã triển khai; local empty/legacy/double-run pass |
| 6 | SQL pushdown/atomic transaction | Đã triển khai normalized hot paths và rollback test |
| 7 | Backup/checkpoint/rollback/diagnostics | Verified backup và offline/live production diagnostics đều pass |
| 8 | Test/staging/production/gate | Production-shaped copy và production cutover pass; theo dõi soak sau triển khai |

Release A đã vượt qua gate cần thiết để bắt đầu Giai đoạn 2. Các backup của
Release A vẫn phải được giữ nguyên trong suốt lần triển khai Release B đầu tiên.

## Tiến độ triển khai Release B — local 2026-07-31

| Step | Phạm vi | Trạng thái |
| --- | --- | --- |
| 2.1 | Guest migration policy | Hoàn tất: guest mới dùng capability; guest legacy không capability phải qua staff recovery |
| 2.2 | Metric semantics | Hoàn tất: score/count/attempt number/study date/interrupted và assignment classification đã cố định |
| 2.3 | Additive schema | Hoàn tất: `learning_attempts`, `attempt_details`, reserved `learning_history_backfill_state`, `pronunciation_attempts` và index |
| 2.4 | Projector new writes | Hoàn tất: vocabulary, Speaking AI và grammar ghi source/projection/detail/leaderboard nguyên tử |
| 2.5 | Backfill | Hoàn tất CLI dry-run/execute/resume/reconcile; execute bắt buộc verified backup |
| 2.6 | Repository/API | Hoàn tất list/detail SQL, owner scope, pagination/filter, review-policy redaction và timing |
| 2.7 | Frontend client/types | Hoàn tất auth/guest headers, AbortSignal và defensive response parsing |
| 2.8 | UI | Hoàn tất `/history`, summary/filter/pagination/responsive/detail modal; đang nằm sau build flag |
| 2.9 | Retention | Hoàn tất CLI dry-run mặc định; execute tự backup, chỉ xóa detail hết hạn và đo zero delta trên các bảng bảo vệ |
| 2.10 | Compatibility | Hoàn tất: không thay nguồn Recent Activity, leaderboard và API kết quả cũ |
| 2.11 | Test | Hoàn tất local trên Node `v22.16.0`: `npm run test:phase2` pass, gồm History `24/24` và legacy HTTP golden `4/4` |
| 2.12 | Deploy API trước, UI sau | **Chưa chạy trên production**; artifact API-first đã sẵn sàng, UI-on artifact chỉ build sau khi API/backfill smoke pass |

Runbook thực thi Step 2.12: `docs/release-b-cpanel-deployment.md`.

Quality gate local Release B:

- TypeScript typecheck, identity, grammar, learning-run và storage tests pass.
- History unit/API/security tests pass `24/24`.
- Legacy HTTP golden regression pass `4/4`, bao phủ public/auth results,
  public/auth leaderboard, admin vocab/grammar results và grammar
  review/my-attempts.
- Golden fixture khóa response contract hiện tại sau thay đổi; không thay thế
  archived pre-Release-B corpus hoặc smoke bằng Firebase/Passenger và dữ liệu
  production thật ở Step 2.12.
- Backfill/retention E2E trên database tạm pass; deterministic/reconcile mismatch đều
  bằng `0`, source không bị sửa/xóa và `quick_check=ok`.
- Production build và startup smoke pass bằng Node `v22.16.0`, ABI `127`.
- `dist/server.cjs` hiện chứa History API/schema/projector; `dist/client` hiện
  được build với `VITE_LEARNING_HISTORY_ENABLED=false` cho lượt deploy API-first.
- Chưa thực hiện browser screenshot/visual interaction test vì phiên local không
  có browser được kết nối; responsive/focus behavior đã được rà tĩnh và kiểm tra
  qua type/build/unit test.

## Kết quả cPanel/production — 2026-07-31

- Host runtime: Node `v22.16.0`, ABI `127`, Linux x64, glibc `2.28`, GCC `8.5.0`.
- Candidate `better-sqlite3@12.4.1` bị loại vì Linux prebuild cần `GLIBC_2.29` và source build cần tên cờ `-std=c++20` mà GCC 8.5 không nhận.
- Compatibility pin `better-sqlite3@10.1.0` được build từ source bằng Python `3.11.13`; SQLite runtime là `3.46.0`.
- Isolated host preflight pass: insert/select, WAL, close/reopen và `quick_check=ok`.
- Production baseline trước migration: `journal_mode=delete`, `quick_check=ok`, database `118222848` bytes, không có WAL/SHM.
- Verified pre-migration backup: `restore-backup/app-2026-07-30T16-41-59-140Z.sqlite`, `quick_check=ok`.
- Production-shaped copy migration pass. Mọi business table count giữ nguyên; bảng `migrations` tăng từ `2` lên `5`.
- Production migration pass dưới maintenance lock. Database sau migration là `121765888` bytes, `journal_mode=wal`, WAL `0` bytes và `quick_check=ok`.
- Live HTTP diagnostics xác nhận `storageMode=sqlite`, driver `better-sqlite3`, basename `app.sqlite`, foreign keys bật, busy timeout `10000`, WAL autocheckpoint `1000`, migration cuối `native-hot-query-columns-v2`, `lastError=null`, `busyErrors=0`.
- Public homepage trả HTTP `200`.
- Hai slow-query log khoảng 295–378 ms là backfill một lần trong migration, không phải lỗi startup.

Kết quả local Release A:

- Compatibility pin `better-sqlite3@10.1.0` đã được xác minh lại trên Windows x64, Node `v22.16.0`, ABI `127`, SQLite `3.46.0`; isolated WAL preflight và toàn bộ `npm run test:phase1` pass.
- `better-sqlite3@12.4.1` load thành công trên Windows x64, Node `v24.15.0`, ABI `137`.
- Isolated preflight: insert/select, WAL, close/reopen và `quick_check` đều pass.
- `npm run test:phase1` pass:
  - TypeScript typecheck.
  - 16/16 unit + storage tests.
  - Empty/legacy/double-run migration.
  - WAL reader trong lúc writer giữ transaction.
  - Ba writer process đồng thời.
  - Batch rollback nguyên tử.
  - Strict missing-file failure.
  - `sql.js` reopen sau rollback và non-empty WAL refusal.
  - Production build.
  - Startup smoke: storage gate trước listen, protected diagnostics, graceful close và reopen.
- Backup/checkpoint/TRUNCATE/prepare-sqljs-rollback CLI pass trên database test và backup `quick_check=ok`.
- Vite build còn cảnh báo chunk size/dynamic import đã tồn tại; không phải storage gate failure.
- Ở quality gate local ban đầu chưa có production-shaped DB/exact Passenger
  Node; điểm này sau đó đã được đóng bằng kết quả cPanel/production ở trên.

Các phần 0–18 bên dưới giữ lại khảo sát và quyết định gốc để phục vụ audit.
Những câu “hiện tại” trong phần khảo sát được hiểu tại baseline 2026-07-30; bảng
tiến độ ở đầu tài liệu là trạng thái mới nhất.

## 0. Tóm tắt điều hành

- Tài liệu yêu cầu có **45 đề mục chính**, đánh số liên tục từ 1 đến 45.
- Phương án tổng thể đúng hướng: giữ một `app.sqlite`, chuyển từ `sql.js` sang `better-sqlite3`, bật WAL, sau đó mới triển khai lịch sử học tập.
- Không được làm Giai đoạn 2 trước khi Giai đoạn 1 vượt qua toàn bộ quality gate.
- Tại baseline, repository dùng `sql.js@1.14.1` và chưa cài `better-sqlite3`.
- Tại baseline, local là Windows x64, Node `v24.15.0`, Node ABI `137`; dữ liệu
  này không được dùng thay cho cPanel preflight.
- Baseline tại thời điểm lập kế hoạch:
  - 12/12 test hiện có pass.
  - `tsc --noEmit` pass.
  - Chưa chạy production build trong bước lập kế hoạch này để tránh thay đổi generated output trong `dist`.
- Không có bản sao `app.sqlite` production trong repository. Vì vậy chưa thể xác minh schema/data thực tế, dung lượng, `quick_check`, số lượng bản ghi hay thời gian backfill.
- Bước này chỉ thêm file kế hoạch này; không thay đổi source code, dependency, schema hay dữ liệu.

## 1. Cách hiểu thống nhất về yêu cầu

### 1.1. Bất biến dữ liệu

Trong cả hai giai đoạn:

- Chỉ có một database dữ liệu chính: `app.sqlite`.
- `app.sqlite-wal` và `app.sqlite-shm` là sidecar kỹ thuật của WAL, không phải database nghiệp vụ riêng.
- Không tạo `core.sqlite`, `activity.sqlite`, `results.sqlite`, `archive.sqlite`.
- Không xóa, đổi tên, reset, thay thế hoặc tái tạo `app.sqlite` production.
- Không tự động chuyển sang `db.json` khi `STORAGE_MODE=sqlite`.
- Không tự động cleanup hoặc `VACUUM` khi startup, login, mở trang hoặc gọi API đọc.
- Mọi migration phải additive, idempotent và chạy được nhiều lần mà không duplicate.
- Không dùng `studentName` để xác định quyền sở hữu.
- Không thay đổi ID, timestamp, snapshot hoặc `data_json` lịch sử cũ trong migration.

### 1.2. Ranh giới Giai đoạn 1

Giai đoạn 1 chỉ thay:

- SQLite driver.
- Cách mở database.
- Cách chạy SQL/transaction.
- Cách persistence.
- WAL, diagnostics, backup, checkpoint, preflight và performance telemetry.

Giai đoạn 1 không làm:

- Trang/API lịch sử học sinh.
- `learning_attempts` nếu chưa cần cho compatibility.
- Backfill lịch sử.
- Refactor frontend lớn.
- Cleanup detail.
- Chia database.

Tiêu chí quan trọng nhất của Giai đoạn 1 là:

> Giữ nguyên dữ liệu, ID, API và hành vi ứng dụng; chỉ thay driver và cơ chế truy cập SQLite.

### 1.3. Ranh giới Giai đoạn 2

Giai đoạn 2 chỉ bắt đầu sau khi Giai đoạn 1 ổn định và đã xác minh:

- Native module load được trên cPanel/Passenger.
- Mở đúng `app.sqlite`.
- `quick_check = ok`.
- WAL thực sự hoạt động.
- Migration, backup, test và build đều thành công.
- Game, grammar, leaderboard, Recent Activity và admin results không regression.

Giai đoạn 2 thêm:

- Projection tổng hợp `learning_attempts`.
- Detail chuẩn hóa `attempt_details`.
- Backfill idempotent từ dữ liệu legacy.
- API danh sách/tổng quan/chi tiết.
- UI Lịch sử học tập.
- Guest authorization an toàn.
- Retention thủ công cho detail/draft, không xóa summary.

### 1.4. Định nghĩa nghiệp vụ cần cố định trước khi code

- **Recent Activity**: các lượt hoàn thành trong 7 ngày gần nhất; 7 ngày là điều kiện query/display, không phải lệnh xóa.
- **Learning History**: lịch sử dài hạn, không giới hạn 7 ngày.
- **Leaderboard**: tiếp tục dùng `leaderboard_events` và logic hiện hành; không xóa event.
- **Summary của History API**: tính trên toàn bộ tập bản ghi sau filter nhưng trước pagination.
- `averageScore`, `bestScore`, correct/incorrect/unanswered, duration và study days: mặc định chỉ tính các lượt `completed`; không tính lượt đang làm như điểm 0.
- Date filter: hiểu theo ngày tại múi giờ ứng dụng Asia/Bangkok; `from` inclusive, `to` inclusive ở giao diện và chuyển thành mốc exclusive của ngày kế tiếp ở backend.
- `Bài được giao`: chỉ khi có `assignment_id` thật; không suy luận từ `lesson_id`, share token hoặc tên bài.
- Record legacy không có stable `userId`/`guestId`: vẫn được giữ cho teacher/admin, nhưng không thể được học sinh “nhận” chỉ bằng tên.

## 2. Kiến trúc hiện tại đã xác minh từ repository

### 2.1. Storage mode

`src/lib/firebaseAdmin.ts` hiện chọn một trong ba mode:

- `firebase`.
- `local-json`.
- `sqlite`.

Khi `STORAGE_MODE=sqlite`, `adminDb` là `SQLiteFirestore`, một facade mô phỏng một phần API Firestore:

- `collection`.
- `doc`.
- `get`.
- `set`.
- `update`.
- `delete`.
- `where`.
- `orderBy`.
- `limit`.
- `batch`.

`server.ts` không import `sqliteStorage` trực tiếp; nó dùng `adminDb` từ `firebaseAdmin.ts`. Đây là điểm tốt cần giữ để hạn chế phạm vi sửa route.

### 2.2. Driver và persistence hiện tại

`src/lib/sqliteStorage.ts`:

- Import `sql.js` trực tiếp ở cấp module.
- Đọc toàn bộ `app.sqlite` vào memory.
- Sau mỗi standalone write:
  1. `sqliteDb.export()`.
  2. Ghi toàn bộ byte database vào file tạm.
  3. `fsync`.
  4. `rename` đè lên file chính.
- Batch dùng transaction in-memory rồi persist toàn file một lần.
- Query có normalized field map thì được push xuống SQL.
- Query field chưa hỗ trợ sẽ đọc cả bảng, parse `data_json`, filter/sort bằng JavaScript.

Đây chính là bottleneck và rủi ro multi-worker mà Giai đoạn 1 cần loại bỏ.

### 2.3. Đường dẫn và hành vi tạo database hiện tại

- Default path đã là `/home/qzmivzbj/app-data/vhomework/app.sqlite`.
- Tuy nhiên startup hiện luôn gọi `ensureParentDir`.
- Nếu file không tồn tại, `sql.js` tạo database memory rỗng rồi persist ra path.
- Sau đó migration `import-db-json-v1` có thể tìm và import `db.json`.

Điều này chưa đáp ứng chính sách production “file phải tồn tại, nếu thiếu phải fail”. Nó cũng tạo nguy cơ production âm thầm mở database mới rồi import dữ liệu cũ/seed.

### 2.4. Mapping collection sang bảng vật lý

| Collection logic | Bảng SQLite hiện tại | Ghi chú |
| --- | --- | --- |
| `users` | `users` | Có normalized columns + `data_json` |
| `guest_profiles` | `guest_profiles` | Có normalized columns + `data_json` |
| `vocab_sets` | `vocab_sets` | Items còn được ghi vào `vocab_items` |
| `vocab_items` | `vocab_items` | Có `audio_url` |
| `classes` | `classes` | Có normalized columns |
| `class_members` | `class_members` | `studentName` chủ yếu nằm trong JSON |
| `assignments` | `assignments` | Chỉ normalized cho vocabulary assignment |
| `results` | `results` | Legacy/ít dùng trong luồng hiện tại |
| `game_sessions` | `game_results` | Tên collection và tên bảng vật lý khác nhau |
| `game_session_actions` | `game_session_actions` | Có unique `(session_id, sequence)` |
| `pronunciation_attempts` | `game_results` | Dùng chung bảng với `game_sessions`, cần đặc biệt chú ý |
| `leaderboard_events` | `leaderboard_events` | Summary gọn |
| `grammar_sets` | `grammar_sets` | Nội dung chính trong `data_json` |
| `grammar_attempts` | `grammar_attempts` | Có query columns normalized |
| `grammar_attempt_questions` | `grammar_attempt_questions` | Hiện detail chủ yếu vẫn embedded trong attempt JSON |
| `grammar_attempt_answers` | `grammar_attempt_answers` | Tương tự |
| `audit_logs` | `audit_logs` | Có normalized fields |
| `settings` | `settings` | `value_json` |

Hệ quả quan trọng:

- Backfill không được giả định bảng vật lý tên `game_sessions`.
- Không được backfill mọi row trong `game_results` thành một learning attempt vì bảng này còn chứa `pronunciation_attempts`.
- Cần unique `source_type + source_record_id` để chống duplicate khi backfill legacy không có `clientRunId`.

### 2.5. Schema và migration hiện tại

Các bảng hiện được tạo trong `runSchemaMigration()`:

- `migrations`.
- `users`.
- `guest_profiles`.
- `vocab_sets`.
- `vocab_items`.
- `classes`.
- `class_members`.
- `assignments`.
- `results`.
- `game_results`.
- `game_session_actions`.
- `leaderboard_events`.
- `audit_logs`.
- `settings`.
- `grammar_sets`.
- `grammar_questions`.
- `grammar_options`.
- `grammar_assignments`.
- `grammar_attempts`.
- `grammar_attempt_questions`.
- `grammar_attempt_answers`.

Migration ID hiện có:

- `import-db-json-v1`.
- `grammar-attempt-query-columns-v1`.

Ngoài ra có migration logic thêm `expires_at` cho `results`/`game_results`, nhưng chưa được tổ chức thành một migration ID riêng hoàn chỉnh.

### 2.6. Startup hiện tại

`server.ts` gọi `app.listen()` trước, sau đó mới chờ `firebaseDiagnosticReady` và chạy `preSeedDb()` ở background.

Hệ quả:

- HTTP server có thể nhận request khi SQLite chưa mở/migration chưa xong.
- Lỗi SQLite startup chỉ bị log trong background thay vì bắt buộc làm process fail trước khi listen.
- Mỗi Passenger worker có thể cùng chạy seed/migration.

Giai đoạn 1 phải đảo thứ tự này: storage preflight/startup gate hoàn tất trước khi listen.

### 2.7. Luồng ghi cần giữ nguyên

#### Lazy Session v3 cho short vocabulary games

- Mở bài/chuyển game chưa tạo row server.
- Client tạo `clientRunId`, `runSecret`, `startedAt`.
- Actions giữ trong memory.
- `/api/game-sessions/lazy-complete`:
  - Tạo deterministic session ID từ actor + lesson + game + `clientRunId`.
  - Grade server-side.
  - Batch ghi completed session và leaderboard event.
- Retry cùng immutable key trả lại cùng result.
- Replay tạo run mới.

#### Speaking AI

- `/api/game-sessions/activate` tạo/resume schema v3 session khi recording đầu tiên.
- Actions và pronunciation attempt được ghi tăng dần.
- Không được giữ transaction mở trong khi nhận dạng giọng nói hoặc gọi external API.

#### Grammar prepare → activate

- `prepare` chỉ validate, kiểm tra attempt limit và trả deterministic shuffled snapshot; không ghi attempt.
- `activate` ở câu trả lời đầu tiên tạo deterministic attempt và answer đầu tiên.
- Answer tiếp theo cập nhật embedded `answers`.
- Submit ghi completed attempt + leaderboard event trong batch.

#### Recent Activity và leaderboard

- `/api/results` và `/api/public/results` scan session/attempt rồi lọc 7 ngày.
- `/api/leaderboard-results` và public counterpart đọc `leaderboard_events`, đồng thời fallback scan source tables.
- Một số hot read vẫn load cả bảng; Giai đoạn 1 cần cải thiện normalized SQL path mà không đổi response.

### 2.8. Guest identity hiện tại

- Browser lưu `msdieu_guest_id` và `msdieu_student_name`.
- Guest profile được resolve/identify bằng stable `guestId`.
- Grammar attempt mới có `attemptTokenHash`; plaintext token ở browser.
- Game session có `sessionTokenHash`/run secret hash.
- Legacy grammar attempt không có token vẫn cho phép bằng guest ID để tương thích.

Vấn đề cần xử lý trước History API:

- `/api/public/results` hiện trả raw `guestId`.
- Public leaderboard event cũng có thể mang `guestId`.
- Vì raw guest ID có thể lộ ra public API, không thể coi `guestId` là secret đủ mạnh để cấp quyền đọc toàn bộ lịch sử.
- `studentName` không được dùng để bù vào điểm yếu này.

### 2.9. Frontend hiện tại

- `App.tsx` điều phối toàn bộ screen bằng React state/path parsing, chưa có router module riêng.
- Student home hiện chứa vocabulary directory, grammar directory và leaderboard sidebar; chưa có history screen.
- `GrammarLearningArea.tsx` đã có lịch sử theo một grammar set qua `/my-attempts`, nhưng đây không phải lịch sử tổng hợp toàn hệ thống.
- `AdminDashboard.tsx` đã có Recent Activity, leaderboard và per-set results; không nên nhét Student History mới vào file lớn này.

### 2.10. Test hiện tại

Các test hiện có chỉ bao phủ:

- Guest identity client helper.
- Grammar rewrite normalization/grading.
- Client learning run/retry queue.
- Deterministic server run ID và start-time bounding.

Chưa có:

- Storage integration test.
- Migration test.
- Production-shaped SQLite test.
- WAL test.
- Transaction rollback test.
- API integration test.
- Concurrency test.
- History API/UI test.

## 3. Đánh giá phương án

### 3.1. Kết luận

Phương án được **chấp thuận có điều kiện**. Kiến trúc một database, migration additive, chia summary/detail và triển khai tuần tự là đúng. Tuy nhiên cần áp dụng các cải tiến P0 dưới đây trước khi code/deploy.

### 3.2. Các điểm mạnh nên giữ nguyên

- Chỉ một `app.sqlite`.
- Giai đoạn 1 và 2 tách biệt bằng quality gate.
- Giữ API public của storage để giảm blast radius.
- Dùng WAL, prepared statements, transaction, UPSERT và unique index.
- Không dùng physical cleanup cho Recent Activity.
- Summary và detail tách logic nhưng cùng database.
- List/aggregate/filter/pagination chạy ở backend bằng SQL.
- Detail chỉ tải khi người dùng mở.
- Guest không xác định bằng tên.
- Backup/preflight/diagnostics là deliverable bắt buộc.
- Feature flag tách backend và frontend.

### 3.3. Cải tiến P0 bắt buộc

#### P0-1. Production phải fail trước khi mở HTTP port

Refactor bootstrap để:

1. Resolve và validate storage config.
2. Kiểm tra file tồn tại.
3. Mở database.
4. Chạy pre-migration `quick_check`.
5. Chạy migration.
6. Cấu hình/verify WAL.
7. Chạy post-migration diagnostics tối thiểu.
8. Chỉ sau đó mới `app.listen()`.

Không được catch lỗi rồi tiếp tục chạy server.

#### P0-2. Chặn create/import/seed ngầm ở production

- Dùng `SQLITE_ALLOW_CREATE=false` ở production.
- Với `better-sqlite3`, dùng `fileMustExist: true` khi không cho create.
- Không gọi `mkdir` để che giấu sai path trong chế độ production strict.
- Không tự động import `db.json` khi đang `STORAGE_MODE=sqlite`.
- `import-db-json-v1` chỉ còn là explicit maintenance/migration path có flag rõ ràng, không phải fallback.
- Guard `preSeedDb()` bằng biến kiểu `SEED_DATA_ENABLED`; production mặc định false.

#### P0-3. Rollback từ WAL về sql.js không chỉ là đổi env

`sql.js` chỉ đọc file main và không tự merge một WAL sidecar đang có pending frames. Vì vậy đổi thẳng `SQLITE_DRIVER=sqljs` có thể bỏ qua dữ liệu mới trong WAL rồi export đè file main.

Rollback an toàn phải:

1. Dừng toàn bộ app worker.
2. Backup online/validated khi driver mới còn hoạt động.
3. Chạy checkpoint có kiểm tra `busy/log/checkpointed`.
4. Chuyển `journal_mode=DELETE` trong maintenance window.
5. Đóng connection.
6. Xác nhận WAL không còn pending data.
7. Chạy `quick_check`.
8. Sau đó mới bật code/driver `sqljs`.

Driver `sqljs` nên từ chối startup nếu phát hiện non-empty `app.sqlite-wal`.

#### P0-4. Chọn phiên bản native theo cPanel, không theo local Windows

- Phiên bản phải pin exact, không dùng `^` hoặc `~`.
- Không chọn phiên bản trước khi biết:
  - `node --version`.
  - `process.versions.modules`.
  - `process.execPath`.
  - Linux distribution/glibc.
  - CPU architecture.
  - Passenger dùng đúng Node binary nào.
- Tại ngày lập kế hoạch, npm hiển thị `better-sqlite3` latest là `13.0.1`, nhưng đây là major mới phát hành rất gần thời điểm khảo sát. Không tự động pin latest nếu chưa vượt qua preflight cPanel.
- Chạy preflight với chính package version dự kiến pin; nếu fail thì dừng, không fallback.

Tham khảo chính thức:

- https://www.npmjs.com/package/better-sqlite3
- https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
- https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md

#### P0-5. Migration phải chịu được nhiều Passenger worker

- Migration có migration ID.
- Bao migration bằng `BEGIN IMMEDIATE` hoặc transaction strategy tương đương.
- Re-check điều kiện sau khi giành write lock.
- Tạo table → add column → backfill normalized column → create index → mark migration.
- Không giữ một transaction dài để backfill hàng trăm nghìn row.
- Schema migration chạy startup phải ngắn.
- Data backfill lịch sử nên là maintenance command resumable, không block mọi startup.

#### P0-6. Guest History cần capability token riêng

Không cho phép:

- `guestId` đơn lẻ.
- `studentName`.
- `guestId + studentName`.

Thiết kế đề xuất:

- `guest_profiles` thêm additive:
  - `access_token_hash`.
  - `access_token_version`.
  - `access_token_created_at`.
- Guest profile mới nhận token random một lần; server chỉ lưu hash.
- Browser lưu plaintext token dưới key riêng.
- History API nhận `X-Guest-Id` và `X-Guest-Access-Token`; không gửi tên trong header.
- Không log token.
- API public không tiếp tục lộ raw `guestId`; thay bằng public pseudonymous key/HMAC nếu leaderboard client cần grouping.

Legacy guest không có capability là bài toán không thể giải an toàn chỉ bằng dữ liệu hiện có. Phương án chuyển tiếp:

1. Tự claim bằng một session/attempt token cũ còn hợp lệ; hoặc
2. Teacher/admin xác minh và cấp lại quyền; hoặc
3. Chỉ giữ row cho staff, chưa cho guest self-access cho đến khi claim.

Không dùng cơ chế “ai có guestId claim trước thì sở hữu”, vì guestId hiện có thể xuất hiện trong public response.

#### P0-7. Canonical summary phải có source identity

Ngoài danh sách field tối thiểu, `learning_attempts` cần:

- `source_record_id`: ID row nguồn trong `game_results` hoặc `grammar_attempts`.
- Unique `(source_type, source_record_id)`.

Lý do:

- Legacy row có thể không có `client_run_id`.
- SQLite unique index có `NULL` không ngăn nhiều legacy row null.
- Backfill cần key deterministic và khả năng reconcile/fallback detail.

#### P0-8. Chuẩn hóa count/score theo game, không copy mù

Hiện matching/memory dùng `incorrectAnswers` gồm cả mistake events và unmatched items; `totalQuestions = correct + incorrect` có thể lớn hơn số item logic.

`learning_attempts` cần chuẩn hóa:

- `score`: luôn 0–100.
- `raw_score`, `max_score`: giữ giá trị game-specific nếu cần.
- `total_questions`: số item/câu logic.
- `correct_count`, `incorrect_count`, `unanswered_count`: không âm và có định nghĩa nhất quán.
- `mistake_count`: field bổ sung cho matching/memory nếu cần.
- `normalization_status`: `canonical | legacy_partial`.

Không sửa các session cũ. Chỉ normalizer của projection quyết định summary mới.

#### P0-9. Snapshot review policy

Grammar attempt hiện snapshot câu hỏi/đáp án nhưng quyền review vẫn đọc từ grammar set hiện tại.

Lượt mới cần snapshot:

- `showReviewAfterSubmit`.
- `showExplanationImmediately`.
- Policy/version liên quan.

Detail API dùng policy snapshot của thời điểm làm bài; legacy fallback có trạng thái rõ ràng và không tự động rewrite record cũ.

#### P0-10. Telemetry phải theo request, không dùng global counter delta

`getSQLitePersistStats()` hiện dùng counter toàn process. Khi request đồng thời, delta có thể trộn chi phí của request khác.

Đề xuất:

- Dùng request context/`AsyncLocalStorage`.
- Mỗi statement ghi:
  - query count.
  - query duration.
  - rows read.
  - rows written.
  - transaction count/duration.
  - driver.
  - busy/lock error.
- `Server-Timing` lấy dữ liệu từ đúng request.
- Bỏ nghĩa cũ của `persistMs`; nếu giữ compatibility field thì đặt rõ là deprecated và không đại diện export database.

#### P0-11. CLI production phải chạy được khi không có devDependencies

Không viết maintenance script TypeScript rồi phụ thuộc `tsx` ở production nếu host cài `npm ci --omit=dev`.

Chọn một trong hai:

- Build CLI TS thành `dist/scripts/*.cjs`; package scripts chạy bằng `node`.
- Hoặc viết `.mjs` độc lập không cần `tsx`.

Khuyến nghị build CLI vào `dist/scripts` để tái sử dụng storage modules đã typecheck.

#### P0-12. Tách “recent 7 ngày” khỏi “detail retention 30 ngày”

Tên `ACTIVITY_RETENTION_DAYS=30` dễ xung đột với constant Recent Activity 7 ngày hiện tại.

Đề xuất rõ nghĩa:

- `RECENT_ACTIVITY_DAYS=7`.
- `ATTEMPT_DETAIL_RETENTION_DAYS=30`.
- `DRAFT_RETENTION_DAYS=3` chỉ là reserved config cho workflow draft/checkpoint
  tương lai; Release B hiện tại chưa đọc biến này.

History summary không hết hạn. Leaderboard event không bị xóa bởi command retention này.

### 3.4. Cải tiến P1 nên thực hiện

- Định nghĩa TypeScript interface cho storage facade thay cho `any`.
- Bổ sung `size` nhất quán cho mọi query snapshot.
- Tách storage driver, migration, diagnostics, instrumentation khỏi một file 1.321 dòng.
- Dùng repository SQL riêng cho history aggregate/filter/pagination; không ép qua Firestore-like query facade thiếu `OFFSET`/aggregate.
- Tách history router/service khỏi `server.ts` đang hơn 5.700 dòng.
- Centralize guest storage keys/identity client helper; hiện vocabulary và grammar đang duplicate logic tạo guest ID.
- Không tạo quá nhiều index trước khi đo `EXPLAIN QUERY PLAN`.
- Không chạy backfill lớn trong một transaction duy nhất.

## 4. Kiến trúc đích đề xuất

### 4.1. Storage layer Giai đoạn 1

```text
src/lib/storage/
├── storageTypes.ts
├── sqliteConfig.ts
├── sqliteStorageFactory.ts
├── betterSqliteStorage.ts
├── sqlJsStorage.ts
├── sqliteMigrations.ts
├── sqliteDiagnostics.ts
├── sqliteInstrumentation.ts
└── sqliteStorageFacade.ts
```

Nguyên tắc:

- `server.ts` chỉ biết storage facade/service.
- Factory chọn đúng một driver từ `SQLITE_DRIVER`.
- Không catch lỗi driver rồi mở driver khác.
- `better-sqlite3` giữ một connection theo process.
- API facade bên ngoài vẫn async-compatible để giảm thay đổi route, dù native calls là synchronous.
- Prepared statement được reuse/cached có kiểm soát.
- Transaction callback không được `await` external API.
- `sql.js` chỉ là rollback path có guard WAL.

### 4.2. Startup order đề xuất

```text
load config
→ validate STORAGE_MODE / SQLITE_DRIVER / path policy
→ verify file exists when allowCreate=false
→ load selected native/wasm driver
→ open exact app.sqlite
→ PRAGMA quick_check (pre-migration)
→ apply short additive migrations
→ configure and verify WAL/foreign_keys/synchronous/timeout/autocheckpoint
→ PRAGMA quick_check (post-migration)
→ expose diagnostics
→ optional explicit seed only in dev/test
→ start HTTP listener
```

PRAGMA target:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 10000;
PRAGMA wal_autocheckpoint = 1000;
```

Phải đọc lại từng giá trị quan trọng. Production strict phải fail nếu `journal_mode` không phải `wal`.

### 4.3. History modules Giai đoạn 2

Backend:

```text
src/server/learning-history/
├── learningHistoryRouter.ts
├── learningHistoryService.ts
├── learningHistoryRepository.ts
├── learningAttemptProjector.ts
├── learningHistoryAuth.ts
├── learningHistoryValidation.ts
├── learningDetailNormalizer.ts
└── learningHistoryTypes.ts
```

Frontend:

```text
src/components/history/
├── StudentHistoryPage.tsx
├── HistorySummary.tsx
├── HistoryFilters.tsx
├── HistoryList.tsx
├── HistoryRow.tsx
├── HistoryDetailModal.tsx
├── AssignmentHistoryGroup.tsx
└── historyTypes.ts

src/lib/api/learningHistory.ts
```

Maintenance:

```text
scripts/
├── storage-preflight.ts
├── db-backup.ts
├── db-checkpoint.ts
├── db-prepare-sqljs-rollback.ts
├── db-backfill-learning-history.ts
└── activity-prune.ts
```

Các script phải được build/copy vào production artifact.

## 5. Schema Giai đoạn 2 đề xuất

### 5.1. `learning_attempts`

Giữ toàn bộ field tối thiểu trong yêu cầu và bổ sung các field cần thiết:

| Nhóm | Field |
| --- | --- |
| Identity | `attempt_id`, `source_record_id`, `client_run_id`, `source_type` |
| Ownership | `student_type`, `user_id`, `guest_id`, `owner_key`, `ownership_status` |
| Snapshot | `student_name_snapshot`, `class_id`, `class_name_snapshot`, `assignment_id`, `assignment_title_snapshot`, `assignment_due_at_snapshot` |
| Lesson | `lesson_id`, `lesson_title_snapshot`, `lesson_type`, `game_id`, `game_title_snapshot` |
| Score | `score`, `raw_score`, `max_score`, `correct_count`, `incorrect_count`, `unanswered_count`, `mistake_count`, `total_questions` |
| Time | `started_at`, `completed_at`, `activity_at`, `study_date`, `duration_seconds` |
| State | `attempt_status`, `attempt_number`, `schema_version`, `detail_status`, `normalization_status` |
| Audit | `created_at`, `updated_at` |

Quy tắc:

- `attempt_id` primary key.
- `source_record_id` non-empty.
- `game_id` non-null; grammar dùng `grammar-practice`.
- `score` clamp 0–100.
- Count không âm.
- `owner_key`:
  - `user:<uid>`.
  - `guest:<guestId>`.
- Legacy không có stable ID:
  - `owner_key = NULL`.
  - `ownership_status = legacy_unlinked`.
  - Staff vẫn xem được.
  - Student/guest không thể claim bằng tên.
- `study_date` là `YYYY-MM-DD` tại timezone ứng dụng để aggregate study days ổn định.
- Không lưu action/question/option JSON nặng trong bảng này.

### 5.2. `attempt_details`

Field:

- `attempt_id` primary key/unique.
- `client_run_id`.
- `source_type`.
- `answer_details_json`.
- `question_snapshots_json`.
- `option_snapshots_json`.
- `extra_details_json`.
- `review_policy_json`.
- `created_at`.
- `updated_at`.
- `expires_at`.
- `schema_version`.

Quy tắc:

- Foreign key đến `learning_attempts(attempt_id)` với hành vi không cascade-delete summary.
- Không chứa audio binary/base64.
- Không đọc trong list/summary query.
- JSON parse defensive.
- Nếu detail bị retention xóa, update summary `detail_status=expired` trong cùng transaction.
- Legacy chưa copy detail có `detail_status=legacy`; detail service fallback source table.

### 5.3. Draft/checkpoint

Không cần tạo ngay nếu chưa có write path thực tế.

- Short game tiếp tục chỉ dùng React state + retry queue.
- Grammar đã persist answer theo attempt.
- Speaking đã có active session/actions.

Chỉ tạo `attempt_drafts`/`attempt_checkpoints` khi một workflow cụ thể cần chúng; tránh schema không có consumer.

### 5.4. Index đề xuất

Tạo sau khi column tồn tại:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_attempts_source_record
ON learning_attempts(source_type, source_record_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_attempts_client_run
ON learning_attempts(owner_key, source_type, lesson_id, game_id, client_run_id)
WHERE client_run_id IS NOT NULL AND owner_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learning_attempts_owner_activity
ON learning_attempts(owner_key, activity_at DESC, attempt_id DESC);

CREATE INDEX IF NOT EXISTS idx_learning_attempts_owner_source_activity
ON learning_attempts(owner_key, source_type, activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_attempts_owner_assignment_activity
ON learning_attempts(owner_key, assignment_id, activity_at DESC)
WHERE assignment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learning_attempts_lesson_activity
ON learning_attempts(lesson_id, activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_attempt_details_expires
ON attempt_details(expires_at)
WHERE expires_at IS NOT NULL;
```

Không tạo global index `source_type + completed_at` nếu không có query thật dùng nó. Xác nhận bằng `EXPLAIN QUERY PLAN`.

Search `LIKE '%term%'` không dùng B-tree hiệu quả; trong lần đầu chấp nhận vì đã bắt buộc scope theo owner. Chỉ thêm FTS5 khi số liệu production chứng minh cần.

## 6. Projection và transaction Giai đoạn 2

### 6.1. New vocabulary completion

Trong một transaction ngắn:

1. Re-check immutable run/idempotency.
2. Insert/update source game session.
3. Upsert deterministic leaderboard event.
4. Upsert `learning_attempts`.
5. Upsert `attempt_details`.
6. Commit.

Không external API trong transaction.

### 6.2. Grammar activate

Trong một transaction:

1. Insert deterministic grammar attempt nếu chưa có.
2. Insert first answer vào source representation.
3. Insert/update `learning_attempts` trạng thái `in_progress`.
4. Commit.

Prepared-only state không tạo row.

### 6.3. Grammar answer

- Update source attempt.
- Có thể update `learning_attempts.updated_at/activity_at` trong cùng transaction.
- Không cần rewrite standardized detail ở mỗi answer nếu chưa có consumer; build detail chuẩn khi submit.

### 6.4. Grammar submit

Trong một transaction:

1. Re-check status/idempotency.
2. Finalize source attempt.
3. Upsert leaderboard event.
4. Finalize summary.
5. Upsert standardized detail + review policy snapshot.
6. Commit.

Retry completed attempt chỉ trả row hiện có, không tạo event/summary mới.

### 6.5. Speaking AI

- Kích hoạt session ở recording đầu tiên.
- Pronunciation rows mới nên ghi vào bảng `pronunciation_attempts` riêng trong Giai đoạn 2; không tiếp tục phụ thuộc mapping chung `game_results`.
- Legacy pronunciation rows giữ nguyên trong `game_results` và detail fallback đọc có kiểm soát.
- Learning summary của Speaking là session cha, không phải mỗi pronunciation event.

## 7. Backfill lịch sử

### 7.1. Không chạy backfill lớn tự động ở mọi startup

Tách:

- Schema migration nhanh, idempotent.
- Backfill command explicit, resumable, có dry-run và reconciliation.

Lệnh đã triển khai:

```text
npm run db:backfill-learning-history -- --db /home/qzmivzbj/app-data/vhomework/app.sqlite --dry-run
npm run db:backfill-learning-history -- --db /home/qzmivzbj/app-data/vhomework/app.sqlite --verified-backup /path/to/verified-backup.sqlite --execute
npm run db:backfill-learning-history -- --db /home/qzmivzbj/app-data/vhomework/app.sqlite --verified-backup /path/to/verified-backup.sqlite --resume
```

`--execute` và `--resume` fail-fast nếu thiếu `--verified-backup`. Backup được
mở read-only và phải có `PRAGMA quick_check=ok`; CLI cũng từ chối dùng chính
database đang chạy làm “backup”.

### 7.2. Nguồn vocabulary

Đọc bảng vật lý `game_results`, chỉ chọn completed game session:

- Có `completedAt`/`endedAt`.
- Có lesson/game session shape.
- Loại pronunciation event độc lập.
- Không dựa vào ID prefix duy nhất; validate shape.

`attempt_id` deterministic theo `source_type + source_record_id`.

### 7.3. Nguồn grammar

Đọc `grammar_attempts`:

- `status = completed`.
- Có `completedAt`.
- Score canonical tính theo correct/total; raw score giữ riêng.

### 7.4. Legacy detail

Lần đầu không cần duplicate toàn bộ JSON:

- Insert summary.
- `detail_status=legacy`.
- Detail API fallback sang source table bằng `source_record_id`.
- Chỉ dữ liệu mới ghi standardized `attempt_details`.

### 7.5. Batch và reconcile

- Batch 500–1.000 row tùy đo thực tế.
- Transaction từng batch, không transaction toàn database.
- Checkpoint progress bằng source key cuối cùng/migration job state.
- Unique index chống duplicate.
- Sau mỗi batch log count, không log PII/detail.
- Cuối job so sánh:
  - eligible source rows.
  - inserted summary.
  - already existed.
  - skipped malformed.
  - legacy unlinked.
- `quick_check` sau job.
- Không xóa source.

## 8. History API chi tiết

### 8.1. Actor resolution

Authenticated:

- Firebase bearer token.
- Backend lấy UID.
- Bỏ qua mọi `userId` client gửi.

Guest:

- `X-Guest-Id`.
- `X-Guest-Access-Token`.
- Hash compare constant-time khi phù hợp.
- Không dùng/tin `studentName`.

### 8.2. List API

`GET /api/my-learning-history`

Validation:

- `page >= 1`.
- `pageSize` chỉ 20 hoặc 50.
- `sourceType`: vocabulary/grammar.
- `historyType`: all/assignment/practice.
- Score 0–100 và from ≤ to.
- Date hợp lệ, giới hạn độ dài search.
- Status thuộc allowlist.
- Không nhận raw SQL field/order.

Query:

1. Bắt buộc `owner_key = actor.ownerKey`.
2. Build parameterized `WHERE`.
3. Count total.
4. Aggregate summary.
5. Query page chỉ summary columns.
6. `ORDER BY activity_at DESC, attempt_id DESC LIMIT ? OFFSET ?`.

Response summary tính trên filtered set, không phải chỉ page.

### 8.3. Detail API

`GET /api/my-learning-history/:attemptId`

Flow:

1. Resolve actor.
2. Query summary theo `attempt_id`.
3. Verify owner trước khi đọc detail.
4. Với staff, gọi authorization service theo lesson/class/assignment ownership.
5. Đọc `attempt_details`; nếu `legacy`, fallback đúng source table.
6. Defensive parse từng JSON field.
7. Apply review policy snapshot.
8. Xóa correct answer/explanation/accepted answers nếu không có quyền.
9. Không có detail trả HTTP 200 với trạng thái `missing|expired|legacy_unavailable`, không 500.
10. Unauthorized nên trả 404 để giảm enumeration.

### 8.4. Không làm N+1

- List dùng snapshot title/class/assignment.
- Không lookup lesson/class cho từng row.
- Nếu cần labels bổ sung, dùng join hoặc batch lookup.
- Detail chỉ lookup một attempt.

## 9. Frontend UX và điều hướng

### 9.1. Điều hướng

Thêm entry `Lịch sử học tập` ở student portal, không thêm vào `AdminDashboard.tsx`.

Vì `App.tsx` chưa có router chuẩn, có hai phương án:

- Ít thay đổi: thêm state/screen `studentHistory`.
- Bền vững hơn: route `/history` bằng router.

Khuyến nghị lần này dùng screen state/path nhẹ để tránh refactor routing lớn trong cùng release. Router tổng thể để phase riêng.

### 9.2. State

- Loading.
- Empty.
- Error.
- Retry.
- Filters.
- Page/pageSize.
- Detail loading/error/status.
- Abort stale request khi đổi filter nhanh.
- Reset page 1 khi filter đổi.

### 9.3. Responsive

- Desktop: table/list.
- Mobile: card.
- Không horizontal overflow.
- Detail modal có focus management, Escape/close và scroll riêng.
- Một malformed detail row chỉ hiện fallback cho row đó.

### 9.4. Guest chưa có capability

- Không tự tạo guest mới khi mở history.
- Nếu chưa identify/claim được:
  - Hiện trạng thái yêu cầu xác minh/khôi phục.
  - Không gửi request theo student name.

## 10. Retention maintenance

### 10.1. Dry-run mặc định

```text
npm run maintenance:activity-prune -- --dry-run
npm run maintenance:activity-prune -- --execute
```

Nếu không có `--execute`, luôn dry-run.

### 10.2. Execute flow

1. Validate exact DB path.
2. Refuse nếu production file không tồn tại.
3. `quick_check`.
4. Tạo/verify backup.
5. Tính eligible rows.
6. Transaction:
   - Delete expired `attempt_details`.
   - Delete expired drafts/checkpoints nếu đã triển khai.
   - Update summary detail status.
7. Commit.
8. `quick_check`.
9. Report counts.

Không xóa:

- Summary.
- Leaderboard.
- Source session/attempt legacy.
- Users/lessons/classes/assignments.
- Attempt đang làm.

Không `VACUUM`.

## 11. Kế hoạch thực hiện step by step

## Giai đoạn 0 — Discovery và khóa baseline

### Step 0.1 — Nhận bản sao production

Yêu cầu một backup/sanitized copy của `app.sqlite` hoặc tối thiểu:

- `sqlite_schema`.
- `PRAGMA table_info` cho mọi bảng.
- `PRAGMA index_list/index_info`.
- Table counts.
- File size.
- `PRAGMA user_version`.
- Migration rows.

Không dùng production file để test/stress.

### Step 0.2 — Chụp baseline

- Git commit SHA.
- Node/npm local.
- Node/ABI/platform cPanel.
- Current env names, không log secret.
- Current table counts/checksum samples trên copy.
- Chạy current lint/tests/build.
- Smoke API hiện tại.

### Step 0.3 — Xác nhận storage dependency graph

- Re-run search mọi import/call.
- Liệt kê route hot path.
- Liệt kê normalized field và JSON-only field.
- Đóng băng public facade contract bằng characterization tests.

### Step 0.4 — Chốt rollback window

- Xác định cách stop toàn bộ Passenger worker.
- Xác định backup directory.
- Xác định người có quyền đổi env/restart.
- Viết lệnh checkpoint/journal rollback trước khi deploy.

Deliverable Giai đoạn 0:

- Báo cáo kiến trúc.
- File list.
- Risk register.
- Baseline test result.
- Rollback runbook draft.

## Giai đoạn 1 — better-sqlite3 + WAL

### Step 1.1 — Preflight candidate trên cPanel

- Không chạm `app.sqlite`.
- Tạo riêng `better-sqlite3-test.sqlite`.
- Log Node/ABI/execPath/platform/arch.
- Load package.
- Tạo bảng/insert/select.
- Bật và verify WAL.
- Close/reopen/select.
- `quick_check`.
- Xóa test DB chỉ bằng maintenance/manual command sau xác nhận; không để script production đụng main DB.

Nếu fail: dừng Giai đoạn 1, không code history.

### Step 1.2 — Pin dependency

- Chọn exact version đã preflight.
- Cập nhật lockfile v3.
- Nếu cần type package thì pin phù hợp.
- Xác minh `npm ci` sạch trên Linux với đúng Node production.
- Không chuyển `node_modules` Windows.

### Step 1.3 — Tách config/path policy

- Parse `SQLITE_DRIVER`.
- Parse `SQLITE_ALLOW_CREATE`.
- Production yêu cầu explicit driver/path.
- `fileMustExist` khi strict.
- Redact path trong log/diagnostics.
- Không fallback JSON/driver.

### Step 1.4 — Tách driver factory và facade contract

- Extract sql.js hiện tại thành rollback implementation.
- Implement better-sqlite3 implementation.
- Giữ collection/doc/query/batch behavior.
- Thêm explicit transaction capability.
- Thêm typed snapshot `size`.

### Step 1.5 — Implement native SQL primitives

- `prepare().get/all/run`.
- Parameter binding đúng API better-sqlite3.
- Transaction thật.
- Rows read/written metadata.
- Busy error classification.
- Statement cache có giới hạn/cleanup.
- Close connection khi process shutdown.

### Step 1.6 — Startup integrity gate

- Pre-migration quick check.
- Fail nếu không `ok`.
- Chạy migration transaction.
- Apply PRAGMA.
- Verify WAL.
- Post-migration quick check.
- Chỉ listen sau success.

### Step 1.7 — Migration runner

- Mỗi migration có ID/version.
- Schema create/add/index đúng thứ tự.
- Giữ nguyên ID/timestamp/data_json.
- Không destructive SQL.
- Test double-run.
- Guard concurrent worker.

### Step 1.8 — Hot query SQL pushdown

Tối thiểu:

- Game session by owner/client run/source IDs.
- Game actions by session/sequence.
- Grammar attempts by set/user/guest/status/created.
- Leaderboard by date/class/student.
- Recent Activity by completed time/status.
- Per-set admin results.

Legacy JSON fallback chỉ cho cold/legacy fields.

### Step 1.9 — Atomic write verification

- Lazy completion + leaderboard.
- Speaking action + session state.
- Grammar activate + first answer.
- Grammar submit + leaderboard.
- Batch admin writes.
- Không external call trong transaction.

### Step 1.10 — Backup/checkpoint/rollback tools

- `db:backup`.
- `db:checkpoint`.
- `db:checkpoint -- --truncate`.
- `db:prepare-sqljs-rollback`.
- Validate backup quick check.
- Timestamp, no overwrite.

### Step 1.11 — Diagnostics/telemetry

- Protected diagnostics.
- Request-scoped metrics.
- Slow query log.
- No PII/secret/full path.
- Deprecate persistMs semantics.

### Step 1.12 — Giai đoạn 1 tests

- Storage CRUD/reopen/WAL/FK/transaction rollback.
- Migration empty/legacy/double-run/path safety.
- Production-shaped copy.
- Concurrency multi-connection/process.
- App integration all listed flows.
- No auxiliary DB.
- Lint/typecheck/unit/integration/build.

### Step 1.13 — Staging deploy

- Linux artifact/install.
- Preflight.
- Backup copy.
- Start with better driver.
- Smoke.
- Monitor busy/WAL/query latency.
- Restart/reopen test.

### Step 1.14 — Production deploy

- Maintenance window.
- Stop workers nếu cần.
- Backup/verify.
- Install exact native package bằng Passenger Node.
- Deploy.
- Start and confirm exact DB basename/fingerprint.
- Confirm WAL.
- Run smoke checklist.
- Monitor ít nhất một chu kỳ tải thực tế.

### Step 1.15 — Gate quyết định

Chỉ đánh dấu Giai đoạn 1 done khi đủ 15 gate trong yêu cầu. Nếu thiếu cPanel verification, báo “local/staging verified, cPanel pending”, không nói production-ready.

## Giai đoạn 2 — Lịch sử học tập

### Step 2.1 — Chốt guest migration policy

- Loại raw guestId khỏi public response hoặc thay pseudonymous key.
- Tạo guest access capability cho profile mới.
- Chốt claim/recovery cho legacy.
- Viết authorization tests trước API.

### Step 2.2 — Chốt metric semantics

- Vocabulary normalizer theo từng game.
- Grammar percent/raw score.
- Attempt number partition.
- Timezone/study date.
- In-progress/interrupted display rule.
- Assignment classification thật.

### Step 2.3 — Additive schema migration

- Tạo summary.
- Tạo detail.
- Add constraints/index theo thứ tự.
- Double-run.
- Không backfill lớn ở startup.

### Step 2.4 — Projector cho new writes

- Vocabulary lazy/legacy completion.
- Speaking.
- Grammar activate/answer/submit.
- Leaderboard + summary + detail atomic.
- Retry/replay tests.

### Step 2.5 — Dry-run và execute backfill

- Count/reconcile.
- Batch/resume.
- Legacy unlinked report.
- No source rewrite/delete.
- Quick check.

### Step 2.6 — History repository/API

- Parameter validation.
- Ownership scope.
- SQL aggregate/list/count.
- Detail fallback.
- Review policy filter.
- Server timing.

### Step 2.7 — Frontend API client/types

- Shared request builder cho auth/guest capability.
- Abort support.
- Response validation/defensive parsing.
- Feature flag.

### Step 2.8 — UI

- Entry ở student portal.
- Summary.
- Tabs/filter/pagination.
- Desktop/mobile.
- Detail modal.
- Loading/empty/error/retry.

### Step 2.9 — Retention command

- Dry-run default.
- Backup before execute.
- Detail only.
- Update status.
- No vacuum.

### Step 2.10 — Compatibility adapter

Xác minh không đổi contract:

- Recent Activity vẫn 7 ngày.
- Public/admin results fields cũ.
- Leaderboard.
- Grammar per-set history/review.
- Vocabulary per-set results/detail.

Chỉ chuyển endpoint cũ sang đọc projection sau khi có golden response tests.

### Step 2.11 — Test toàn diện

- Migration/backfill.
- Auth/ownership.
- Filters/pagination/aggregate.
- Detail/review/malformed JSON.
- Retry/replay.
- Retention.
- Frontend states.
- Build.

### Step 2.12 — Deploy API trước, UI sau

1. Backup.
2. Schema migration.
3. Backfill dry-run.
4. Backfill execute/reconcile.
5. Bật backend API flag.
6. Smoke API.
7. Bật frontend build flag.
8. Smoke UI.
9. Không chạy retention execute trong deploy đầu.

## 12. File dự kiến sửa/thêm

### Giai đoạn 1

Dự kiến sửa:

- `package.json`.
- `package-lock.json`.
- `.env.example`.
- `server.ts`.
- `src/lib/firebaseAdmin.ts`.
- `src/lib/sqliteStorage.ts` hoặc thay bằng compatibility re-export.
- `.cpanel.yml` nếu CLI artifact cần thay đổi deploy contract.
- `CODEMAP.md`.
- `docs/DATA_SAFETY.md`.

Dự kiến thêm:

- Các module dưới `src/lib/storage/`.
- CLI dưới `scripts/`.
- Storage/migration/concurrency/integration tests.
- `docs/better-sqlite3-migration.md`.
- `docs/sqlite-wal-operations.md`.
- `docs/cpanel-better-sqlite3-preflight.md`.
- `docs/sqlite-backup-restore.md`.

### Giai đoạn 2

Dự kiến sửa:

- `server.ts` ở mức mount router/projector integration.
- Các completion/activate/submit write path.
- `src/types.ts`.
- `src/App.tsx`.
- `src/lib/guestIdentity.ts`.
- `src/vite-env.d.ts`.
- `.env.example`.
- `CODEMAP.md`.

Dự kiến thêm:

- Backend history modules.
- `src/components/history/*`.
- `src/lib/api/learningHistory.ts`.
- Backfill/retention scripts.
- History/backend/frontend tests.
- `docs/student-learning-history.md`.
- `docs/app-sqlite-data-structure.md`.
- `docs/activity-retention-maintenance.md`.

Không dự kiến nhét history UI vào `AdminDashboard.tsx`.

## 13. Test matrix và acceptance

### 13.1. Storage driver contract

- Same fixture qua sqljs và better-sqlite3.
- Snapshot shape: `docs`, `empty`, `size`, `forEach`.
- CRUD/batch/query/order/limit.
- Unsupported legacy field fallback.
- No implicit fallback.

### 13.2. Data integrity

- Before/after table counts.
- Stable IDs/timestamps.
- Stable JSON hashes cho sample legacy rows.
- No dropped table/column.
- No new DB file ngoài test path.
- `quick_check=ok`.

### 13.3. Idempotency/concurrency

- Concurrent same `clientRunId`.
- Same secret returns one result.
- Wrong secret forbidden.
- Replay new run creates second attempt.
- One leaderboard event per source.
- One learning summary per source/run.
- WAL readers during short writer.
- Busy timeout behavior bounded.

### 13.4. API golden contract

Capture response shape trước/sau cho:

- `/api/results`.
- `/api/public/results`.
- `/api/leaderboard-results`.
- `/api/public/leaderboard-results`.
- Admin vocab results.
- Admin grammar results.
- Grammar review/my-attempts.

So sánh field, order, authorization và 7-day behavior.

### 13.5. History

- Auth user own only.
- Guest capability own only.
- Raw guestId/name attack fail.
- Staff authorization đúng resource.
- All filters.
- Aggregate filtered set.
- Pagination stable.
- Detail policy.
- Missing/expired/malformed.
- Legacy unlinked không bị claim.

## 14. Rollback

### 14.1. Giai đoạn 1 code rollback

Ưu tiên rollback code nhưng tiếp tục dùng native driver nếu schema/API tương thích.

Nếu bắt buộc quay về sql.js:

- Stop app.
- Backup.
- Native checkpoint TRUNCATE có verify.
- `journal_mode=DELETE`.
- Close.
- Quick check.
- Switch driver/code.
- Smoke.

Không copy riêng `app.sqlite` khi app đang ghi WAL.

### 14.2. Database restore

Chỉ khi migration/data integrity fail:

- Stop toàn bộ worker.
- Giữ nguyên failed files để điều tra.
- Xác minh backup quick check.
- Restore đúng target path.
- Xử lý WAL/SHM theo runbook khi database đóng.
- Start old known-good code.
- Smoke.

### 14.3. Giai đoạn 2 rollback

- Tắt `VITE_LEARNING_HISTORY_ENABLED` bằng rebuild/deploy frontend.
- Tắt `LEARNING_HISTORY_ENABLED` backend.
- Không drop bảng mới.
- Source game/grammar/leaderboard vẫn là fallback.
- Additive schema được giữ lại cho forward recovery.
- Backend flag cũng tắt projector. Source attempt vẫn được ghi; trước khi bật
  lại phải tạo fresh backup và chạy backfill catch-up/reconcile cho khoảng
  rollback.

## 15. Risk register

| Rủi ro | Mức | Mitigation |
| --- | --- | --- |
| Native ABI/glibc không tương thích cPanel | Critical | Preflight bằng exact Passenger Node, pin exact version |
| Mở sai/thiếu app.sqlite và tạo DB mới | Critical | `fileMustExist`, allow-create false, startup fail |
| sqljs rollback bỏ qua pending WAL | Critical | Stop/checkpoint/journal DELETE/verify |
| Concurrent migration nhiều worker | High | Short idempotent migration + write lock |
| Backfill nhầm pronunciation row | High | Source shape validation + source unique + dry-run |
| GuestId bị dùng như secret | Critical | Capability token + remove public raw ID |
| Count matching/memory sai nghĩa | High | Game-specific canonical normalizer |
| Review policy thay đổi sau attempt | High | Snapshot policy |
| Long synchronous query block event loop | High | Index, pagination, chunked backfill, slow query log |
| Request telemetry trộn request | Medium | AsyncLocalStorage/request context |
| Startup seed thay đổi production trống/sai path | High | Explicit seed flag, off production |
| CODEMAP/deploy docs lệch thực tế | Medium | Update only after verified implementation |

## 16. Các đầu vào còn thiếu trước khi triển khai

Không cần cho bước lập kế hoạch, nhưng bắt buộc trước khi bắt đầu Giai đoạn 1:

1. Node version, ABI, `execPath`, platform, arch và glibc của cPanel Passenger.
2. Cách stop/restart toàn bộ Passenger workers.
3. Bản sao production-shaped `app.sqlite` hoặc schema dump + table counts.
4. Dung lượng DB/WAL hiện tại và traffic/concurrency ước tính.
5. Quyền ghi của process vào `/home/qzmivzbj/app-data/vhomework`.
6. Quyết định policy claim lịch sử cho legacy guest.
7. Maintenance window và backup directory.

## 17. Definition of Done

### Giai đoạn 1 Done

- Exact driver/version documented.
- Production path strict.
- No full-file export persistence.
- WAL verified.
- Backup/checkpoint/restore tested.
- Migrations additive/idempotent.
- All baseline/golden/concurrency tests pass.
- Build pass.
- cPanel status stated honestly.
- No auxiliary database.

### Giai đoạn 2 Done

- Giai đoạn 1 gate passed.
- Summary/detail schema and backfill reconciled.
- New writes atomic/idempotent.
- History API secure for user/guest.
- UI responsive/stable.
- Review answers not leaked.
- Retention dry-run/execute safe.
- Old APIs still pass golden tests.
- Feature-flag rollback tested.
- No summary/source/leaderboard deletion.

Trạng thái 2026-07-31: các tiêu chí code/test local đã đạt. Definition of Done
toàn bộ Release B chỉ được đánh dấu đạt sau Step 2.12 trên production: fresh
backup, migration, backfill reconcile, API smoke, UI smoke và rollback flag
verification. Không dùng kết quả local để thay cho gate này.

## 18. Quyết định đề xuất cuối cùng

Thứ tự thực hiện được khuyến nghị:

1. Không bắt đầu history ngay.
2. Thu thập cPanel ABI + production-shaped DB copy.
3. Hoàn thành preflight/version pin.
4. Triển khai và soak better-sqlite3/WAL.
5. Chỉ khi gate pass mới thêm schema/projector history.
6. Giải quyết guest capability trước khi public History API.
7. Backfill bằng command explicit, không bằng startup transaction dài.
8. Bật API trước, UI sau.

Đây là phương án giảm tối đa nguy cơ lặp lại sự cố dữ liệu trước đây trong khi vẫn đạt mục tiêu dài hạn của tài liệu 45 đề mục.
