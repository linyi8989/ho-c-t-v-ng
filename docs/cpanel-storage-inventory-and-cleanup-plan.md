**Danh mục lưu trữ cPanel và phương án dọn dữ liệu**

Ngày rà soát: 08/10/2026. Căn cứ: source hiện tại, `.cpanel.yml`, `docs/production-environment.example.env`, `quytac.md` và các CLI maintenance. Đây là danh mục theo cấu hình trong repo và phương án triển khai, chưa phải kết quả quét ổ đĩa production. Không có thao tác xóa, thay đổi runtime hay database trong lần rà soát này.

Yêu cầu đã chốt: giữ nguyên cơ chế và dữ liệu bảng vàng, bao gồm `leaderboard_events`, thời hạn đọc 62 ngày và phép so sánh kỳ trước. Không thêm lệnh xóa bảng vàng vào phương án này.

**1. Hai thư mục chính trên host**

| Ký hiệu trong tài liệu | Đường dẫn tuyệt đối | Vai trò |
|---|---|---|
| D | `/home/qzmivzbj/app-data/vhomework` | Dữ liệu vận hành cần giữ qua các lần deploy |
| P | `/home/qzmivzbj/app.msdieu.com` | Mã chạy, frontend, dependency và file phục vụ deploy |

Ví dụ `D/audio` nghĩa là `/home/qzmivzbj/app-data/vhomework/audio`. Các biến môi trường trên host có thể ghi đè đường dẫn trong mẫu; trước maintenance phải xác nhận đường dẫn thật từ cấu hình/diagnostics. Không được chuyển sang database khác để thử dọn.

**2. Những nơi phát sinh dữ liệu khi tiếp tục vận hành**

| File/thư mục | Dữ liệu phát sinh | Khi nào tăng | Cơ chế hiện tại |
|---|---|---|---|
| `D/app.sqlite` | Bài học, người dùng, lớp, bài giao, phiên bản đề, metadata media, lượt làm, lịch sử, job, bảng vàng, audit log | Soạn/publish bài, tạo hồ sơ, học/làm bài, tạo ảnh/chấm Speaking | Giữ source và summary; CLI `activity-prune` chỉ dọn `attempt_details` đủ điều kiện |
| `D/app.sqlite-wal` | Các trang SQLite mới ghi trước khi checkpoint | Khi database được ghi | SQLite WAL/checkpoint; không phải file rác |
| `D/app.sqlite-shm` | Bộ nhớ chia sẻ phục vụ WAL | Khi worker mở database WAL | File điều phối, thường nhỏ; không phải file rác |
| `D/audio/<hash>.mp3` | TTS từ vựng, câu đọc mẫu; gồm audio mẫu Speaking được sinh qua Azure hoặc provider của B | Sinh nội dung/voice/settings mới | Tái dùng file theo hash; CLI orphan hỗ trợ nhưng không tự chạy định kỳ |
| `D/listening-media/<hash>.<ext>` | Ảnh đề, ảnh crop, token/icon và audio giáo viên upload; dùng chung cho Listening, Reading & Writing, exam và media IOE theo tham chiếu | Upload/crop media mới | Chống trùng theo nội dung; archive vẫn giữ file |
| `D/vocab-images/<hash>.<ext>` | Ảnh từ vựng tạo bằng AI hoặc upload | Giáo viên tạo/upload ảnh mới, kể cả ảnh chưa chọn để lưu vào bài | Lưu bytes gốc, chống trùng theo hash; chưa có job dọn orphan ảnh từ vựng |
| `D/speaking-recordings/<attempt-UUID>.wav` | Bản thu của học sinh | Mỗi lượt upload bản thu mới | WAV PCM16 mono 16 kHz; hạn nghe lại mặc định 30 ngày, chưa xóa file hết hạn |
| `D/listening-media/.tmp-pdf-import/<UUID>.jpg/png/webp` | Ảnh nguồn/đáp án tạm phục vụ Smart Import/PDF | Upload nguồn phân tích Listening | Token mặc định 10 phút, tối đa 30 phút; xóa sau sử dụng và bằng timer; restart/crash có thể để sót |
| `D/listening-media/.tmp-mover-reading-import/<UUID>.jpg/png/webp` | Ảnh phân tích tạm cho Mover Reading & Writing | Smart Import Reading & Writing | Cùng cơ chế transient/timer; có thể sót khi tiến trình bị dừng |
| File tạm ở `D/audio`, `D/listening-media`, `D/vocab-images`, `D/speaking-recordings` | `.tmp` của thao tác ghi/upload nguyên tử | Trong lúc ghi file, hoặc còn lại sau crash | Bình thường xóa trong `finally`; cần nhận diện đúng mẫu của từng writer |
| `D/backups/app-<timestamp>.sqlite` | Backup database từ CLI và một số maintenance | Mỗi lần tạo backup/chạy maintenance có backup | Có kiểm tra `quick_check`; chưa tự xoay vòng backup |
| `D/restore-backup`, `D/release-b-backups`, `D/retention-backups` | Backup theo runbook hoặc tham số `--output-dir`/`--backup-dir` | Chỉ khi người vận hành chạy lệnh tương ứng | Không phải cả ba thư mục luôn tồn tại; cần quét host |
| `D/media-quarantine/<timestamp>/tts`, `.../listening` | File orphan được CLI chuyển vào quarantine | Khi chạy media maintenance với `--execute` | Chưa xóa vĩnh viễn; vẫn chiếm dung lượng trên cùng ổ |
| `P/assets`, `P/dist/client/assets` | Hai bản asset frontend, gồm JS/CSS có hash và tài nguyên tĩnh | Sau các lần deploy có tên asset mới | `.cpanel.yml` chép bổ sung vào cả hai, không xóa asset cũ |
| `P/dist/server.cjs.previous`, `P/dist/server.cjs.map.previous`, `P/index.html.previous`, `P/dist/client/index.html.previous` | Một lớp file rollback gần nhất | Mỗi lần deploy | Cùng tên nên được ghi đè, không tăng vô hạn; cần giữ để rollback |
| Các file `.next` tương ứng dưới P | File staging trước khi kích hoạt release | Trong deploy hoặc còn lại khi deploy bị ngắt | Sau deploy thành công được move sang tên chính; chỉ là ứng viên thừa khi chắc chắn deploy đã kết thúc |
| Log của Passenger/hosting | stdout/stderr, lỗi ứng dụng, access/error log theo cấu hình host | Khi phục vụ và gặp lỗi | Repo ghi console, chưa xác định được đường dẫn log production từ cấu hình đã đọc |

`D/db.json` chỉ là dữ liệu hoạt động nếu host chọn rõ `STORAGE_MODE=local-json` cùng `LOCAL_DB_PATH`. Với SQLite theo cấu hình hiện tại, file này không phải nơi ghi bài học đang chạy. File JSON cũ có thể là bản dữ liệu phục hồi: không được coi là rác chỉ vì SQLite đang hoạt động.

**3. Bài học và lịch sử nằm ở đâu trong database?**

Tất cả các nhóm sau nằm trong cùng `D/app.sqlite`, không phải một file/thư mục cho mỗi bài học.

| Nội dung | Bảng chính |
|---|---|
| Từ vựng | `vocab_sets`, `vocab_items` |
| Ngữ pháp/viết theo thư viện grammar | `grammar_sets`, `grammar_questions`, `grammar_options` và dữ liệu JSON của set |
| Mover Listening | `listening_sets`, `listening_set_versions` |
| Mover Reading & Writing | `mover_reading_sets`, `mover_reading_set_versions` |
| Các module exam khác | `exam_sets`, `exam_set_versions` |
| Bài/bộ đọc Speaking | `speaking_lessons`, `speaking_versions` |
| IOE/Violympic | `competition_questions`, `competition_question_versions`, `competition_papers`, `competition_paper_versions` |
| Hồ sơ/lớp/bài giao | `users`, `guest_profiles`, `classes`, `class_members`, `assignments` và các bảng nghiệp vụ liên quan |
| Lượt từ vựng/ngữ pháp | `game_results` (facade `game_sessions`), `game_session_actions`, `grammar_attempts`, các bảng câu hỏi/đáp án của lượt ngữ pháp |
| Lịch sử từ vựng/ngữ pháp | `learning_attempts`, `attempt_details`, `pronunciation_attempts` theo workflow |
| Lượt/chi tiết module khác | `listening_attempts`/`listening_attempt_details`, `mover_reading_attempts`/`mover_reading_attempt_details`, `exam_attempts`/`exam_attempt_details`, `competition_attempts`/`competition_attempt_details` |
| Speaking | `speaking_sessions`, `speaking_attempts`, `speaking_attempt_details`, `speaking_jobs` |
| Bảng vàng | `leaderboard_events` — giữ nguyên |
| Metadata/tham chiếu media | `listening_assets`, các bảng `*_asset_usages`, `vocab_image_assets`; URL/hash trong JSON bài học, phiên bản và snapshot lượt học |
| Job tạo ảnh hàng loạt | `vocab_image_batch_jobs`, `vocab_image_batch_job_results`; có `expiresAt` sau 24 giờ nhưng chưa có DELETE tương ứng |
| Audit/cấu hình | `audit_logs`, `settings`, `migrations` |

Ảnh/audio trong lịch sử thường là tham chiếu tới media đã lưu; xem lại một lượt không tạo thêm ảnh/audio riêng. Chi tiết câu hỏi, đáp án và snapshot JSON vẫn tăng theo lượt làm. Riêng WAV Speaking là file mới theo từng attempt.

**4. Những nhóm có thể không còn cần dùng và cách xác định**

Không có danh sách filename production trong lần rà soát này. Không được gắn nhãn “xóa được” chỉ dựa vào tên cũ, tuổi file hoặc việc không thấy trên giao diện.

| Nhóm ứng viên | Điều kiện để coi là không còn cần | Điều chưa được phép suy ra |
|---|---|---|
| Ảnh transient/file ghi tạm bị sót | Đúng thư mục và mẫu tên; quá khoảng an toàn; không có upload/import đang sử dụng | Mọi file cũ trong thư mục media đều là file tạm |
| WAV quá hạn | Có thời điểm upload/hạn lưu đáng tin cậy; job chấm và feedback đã kết thúc hoặc được hủy an toàn | `createdAt` của attempt luôn bằng thời điểm upload |
| File hash không có metadata/tham chiếu | Quét đầy đủ tất cả nguồn tham chiếu liên quan; dữ liệu/schema hợp lệ; kiểm tra lại trước khi chuyển/xóa | Chỉ không có trong một bảng là đã orphan |
| Media có metadata nhưng không gắn vào bài | Không còn dùng bởi draft, published/archived version, snapshot, job tạo ảnh và nguồn review | Asset archived hoặc ảnh chưa được chọn chắc chắn không còn giá trị |
| Quarantine cũ | Đã xác minh không cần phục hồi, hết thời hạn quarantine, không có tham chiếu mới | Chuyển vào quarantine là đã tiết kiệm ổ đĩa |
| Backup cũ | Có bản local/off-host đã tải đủ và verify; còn bản gần nhất và mốc rollback được bảo vệ | Backup trước migration/backfill luôn có thể xóa theo tuổi |
| `.next` bị sót | Không có deploy đang chạy; release hiện tại đã xác nhận; staging không được dùng để tiếp tục/rollback | `.previous` cũng là file staging thừa |
| JSON/database preflight cũ | Xác nhận không phải đường dẫn storage hiện tại, không có worker mở và đã lưu bản phục hồi cần thiết | Mọi `.sqlite` khác `app.sqlite` là rác |
| Asset frontend có hash cũ | Ngoài toàn bộ tập phụ thuộc của các release cần bảo vệ, hết cửa sổ hỗ trợ cache/client và rollback | Không có trong `index.html` hiện tại là không còn dùng |

Các thư mục QA trên máy phát triển như `.data/qa-browser`, `.data/*-verification`, `.data/*-before`, `.data/merge-backups`, `.tmp`, `.local` và `output/imagegen` không được pipeline cPanel hiện tại chép làm dữ liệu runtime. Nếu chúng có trên host do upload thủ công, phân loại riêng rồi archive/dọn sau khi kiểm tra; không áp dụng quy tắc này cho toàn bộ `D` hoặc toàn bộ `.data` vì chúng có thể chứa database/media.

**5. Asset frontend cũ sau deploy**

- Pipeline chép `dist/client/assets/.` vào cả `P/assets` và `P/dist/client/assets`; Node phục vụ cây thứ hai, cây root phục vụ khả năng truy cập qua web server hosting. Chưa có căn cứ loại bỏ toàn bộ một cây.
- Build local xóa output cũ; deploy trên host chép bổ sung nên các JS/CSS có hash khác vẫn tồn tại.
- Rà soát local hiện tại: 81 JS + 13 CSS, tổng khoảng 2,646 MB; cộng font/ảnh/license, cả cây assets khoảng 7,255 MB. Hai cây tương ứng khoảng 14,51 MB cho cùng tập file hiện tại.
- Nếu mọi JS/CSS đều đổi hash trong một release, hai cây có thể phát sinh thêm khoảng 5,29 MB. Nếu chỉ một số chunk thay đổi thì mức tăng thấp hơn. Font/ảnh giữ tên tĩnh thường được ghi đè thay vì tạo bản mới, nhưng file tĩnh bị bỏ khỏi build cũng có thể sót trên host.
- `dist/client/index.html` local đang trỏ tới `index-De0M-g0g.js` và `index-DjuOcoRm.css`; đây không phải xác nhận production đang chạy hai tên này. Các tên lịch sử ghi trong CODEMAP cũng không đủ để kết luận một file trên host đã thừa.
- Các chunk tải sau, worker, CSS import, font và ảnh phải được giữ dù không được khai báo trực tiếp trong `index.html`. Các file không có hash như `assets/backgrounds/...`, `assets/fonts/...`, `assets/lesson-cards/...` không phải asset cũ chỉ vì tên không đổi.
- Repo đang đặt `/assets` cache immutable 365 ngày. Runbook yêu cầu dọn ngoài cửa sổ deploy và sau thời gian cache tối đa. Kế hoạch ban đầu giữ cửa sổ bảo thủ 365 ngày tính từ lần cuối release còn được hỗ trợ tham chiếu asset, đồng thời luôn giữ phụ thuộc của release hiện tại và rollback. Đây không phải cam kết mọi tab cũ vô hạn vẫn chạy; muốn rút ngắn cần chính sách tuổi client/lazy-load recovery và cache được thiết kế riêng.
- Cần tạo manifest theo release: danh sách đầy đủ file sinh ra, hash, release ID, thời gian kích hoạt và trạng thái rollback; bao gồm cả public asset/worker. Manifest là phần đề xuất, hiện chưa có trong pipeline.
- Đối chiếu cả hai cây với manifest; lấy hiệu tập hợp làm danh sách ứng viên; kiểm tra lại release không thay đổi trước khi xử lý. Không xóa theo prefix `index-*` hay chỉ theo mtime.

Điểm cần kiểm tra deploy: `src/features/speaking/useRecorder.ts` tải `/speaking-recorder-worklet.js`; build local có file đó. `.cpanel.yml` hiện chép assets và các PNG ở gốc client nhưng chưa có lệnh chép root JS này. Đây là file cần cho chức năng thu âm, không phải file thừa. Kiểm tra cách nó được đưa lên host trước khi áp dụng bất kỳ thay đổi nào; lần rà soát này chưa sửa pipeline.

**6. Chính sách dọn đề xuất**

| Nhóm | Chính sách đề xuất | Yêu cầu triển khai |
|---|---|---|
| Transient Smart Import | Giữ cơ chế tự xóa hiện tại; thêm quét file sót quá 1 giờ | Allowlist đúng hai thư mục; tuổi an toàn lớn hơn TTL 30 phút và thời gian xử lý; không quét toàn media |
| File ghi tạm | Dọn file đúng mẫu quá 24 giờ và không còn writer dùng | Không dùng wildcard `.tmp*` cho mọi nơi; bản export SQLite tạm cần xử lý riêng khi zero writers |
| WAV Speaking | Lưu tối đa 24 giờ từ upload theo yêu cầu trước đó; giữ điểm/nhận xét | Lưu `audio_uploaded_at`/deadline; UI/API hết quyền nghe/retry; chấm và feedback quá hạn phải kết thúc/hủy trước khi xóa; legacy thiếu mốc thời gian đưa vào report, không đoán |
| TTS/Listening orphan | File không có metadata/tham chiếu, già hơn 7 ngày → quarantine; xem xét xóa sau 7 ngày quarantine | Bổ sung lock/recheck, kiểm tra schema/JSON và thay đổi tham chiếu; CLI hiện tại chưa phù hợp để bật unattended execute ngay |
| Ảnh từ vựng orphan/ảnh chưa chọn | Giai đoạn đầu chỉ báo cáo; dọn file không có tham chiếu sau grace period 30 ngày và review | Quét draft, set, snapshot, batch result và library; việc xóa metadata thư viện là phạm vi riêng |
| Asset frontend cũ | Dọn theo manifest và cửa sổ cache/rollback như mục 5 | Bảo vệ release hiện tại, rollback, public assets, lazy chunk/worker; xử lý hai cây nhất quán |
| Backup | Đề xuất giữ 3 bản gần nhất trên host và các mốc rollback đang được ghim; lưu 4 bản tuần + 3 bản tháng ở local/off-host | SHA-256 khớp, SQLite `quick_check=ok`, thử restore trên bản sao; giữ cặp DB/media phù hợp; mốc trước maintenance chỉ bỏ khi hoàn tất cửa sổ rollback |
| Quarantine | Xóa sau cửa sổ phục hồi đã chọn, kiểm tra lại không có tham chiếu; giữ report ngắn gọn | Không coi quarantine là giải pháp giảm dung lượng cuối cùng; không đưa WAV hết hạn vào quarantine lâu hơn chính sách 24 giờ |
| Chi tiết lịch sử | Đề xuất 30 ngày cho phần review nặng; giữ summary/source cần thiết và bảng vàng | Giai đoạn riêng sau khi API trả trạng thái expired; xử lý các bản JSON trùng và phụ thuộc nghiệp vụ trước khi dọn |
| Job tạo ảnh | Dọn job/result đã hoàn tất, quá hạn và qua grace period sau khi kết quả cần thiết đã được lưu | Không xóa asset ảnh vì xóa job; không xóa job queued/running chỉ theo tuổi |
| Log host | Xoay vòng theo ngày/kích thước và số bản giới hạn | Xác định đường dẫn thật và cơ chế Passenger/hosting, tránh xóa file đang được process ghi |
| Dữ liệu bảng vàng | Giữ nguyên hoàn toàn | Không đổi `LEADERBOARD_RETENTION_DAYS`, projector, source hay `leaderboard_events` trong cleanup |

Job định kỳ có độ trễ: chạy mỗi giờ có thể giữ WAV đến gần 25 giờ. Muốn yêu cầu vật lý tối đa 24 giờ cần deadline thu hồi trước biên một khoảng phù hợp, chu kỳ ngắn và giám sát job; host ngừng chạy không thể bảo đảm mốc xóa chỉ bằng cron. Không tuyên bố đã áp dụng giới hạn 24 giờ chỉ vì đặt env bằng 1.

Lưu ý lịch sử: IOE hiện đọc history để dựng “Luyện câu sai”; phải tách trạng thái câu sai chưa giải quyết trước khi dọn detail IOE. Grammar dùng source attempt để đếm giới hạn số lượt; Speaking session dùng các attempt con để dựng review. CLI hiện tại chỉ xóa `attempt_details`, không phủ hết detail module khác và không bỏ snapshot nặng còn trong source JSON. Không bật dọn 30 ngày hàng loạt cho tất cả bảng.

**7. Trình tự triển khai và tiêu chí an toàn**

1. Kiểm kê production chỉ đọc: xác nhận D/P thật, driver/database đang chạy, kích thước từng thư mục, file lớn nhất, tuổi file, `.next`, `.previous`, hai cây assets, backup và log. Không xuất secret trong report.
2. Sinh danh sách ứng viên cụ thể: đường dẫn tuyệt đối, kích thước, hash, nhóm writer, căn cứ không còn dùng, release cuối tham chiếu hoặc deadline và dung lượng có thể thu hồi. Nếu thiếu schema/JSON hỏng/không xác định tham chiếu thì dừng nhóm đó, không suy ra “không có tham chiếu”.
3. Kiểm thử CLI trên bản sao/fixture: path ngoài root, symlink, filename không biết, file đang sử dụng, restart bỏ sót transient, job chấm đang chạy, rollback/lazy asset, record thiếu/sai ngày và chạy lại idempotent. Không gọi provider thật để test dọn.
4. Lần đầu production có backup DB/media cần phục hồi, report được duyệt và maintenance window. Với các CLI retention hiện tại, tuân thủ zero writers. File operation không rollback cùng transaction SQLite: cần manifest chuyển file và cơ chế phục hồi riêng.
5. Xác minh trước/sau: hash/nội dung các bảng protected không thay đổi ngoài những cột metadata được allowlist rõ; bảng vàng luôn protected. Kiểm tra `quick_check`, foreign keys, đăng nhập, mở bài, submit/review, media, Speaking và asset lazy qua cả Node/web server.
6. Chỉ sau khi pilot được xác minh mới đặt lịch: cron/scheduler hosting chạy CLI riêng, một job tại một thời điểm, không gọi từ startup/login/page load/API đọc. Giới hạn số file/byte mỗi lượt và dừng khi vượt kế hoạch. Giữ report và cảnh báo lỗi/dung lượng tăng bất thường.

Thứ tự ưu tiên: (a) báo cáo và file transient sót; (b) WAV 24 giờ; (c) backup/quarantine/log; (d) manifest frontend và orphan media; (e) retention detail 30 ngày sau khi giải quyết các phụ thuộc. Bảng vàng không nằm trong bất kỳ bước dọn nào.

**8. File/thư mục cần bảo vệ**

- `D/app.sqlite`, WAL/SHM/journal đang hoạt động: không unlink theo tuổi. Muốn giảm WAL dùng checkpoint; muốn thu nhỏ database sau DELETE dùng maintenance SQLite riêng có backup. DELETE thường chỉ tạo free pages để tái dùng.
- Các bảng tài khoản, lớp, bài giao, bài học, phiên bản, summary và `leaderboard_events`: không là mục tiêu của file cleanup. Không DROP/TRUNCATE/seed hoặc rewrite database.
- Media còn tham chiếu, dù bài/asset đã archive; không xóa toàn thư mục media.
- `P/app.js`, server/client hiện tại, `node_modules`, `package.json`, lockfile, `.htaccess` do cPanel quản lý, cấu hình/secret và file phục vụ restart như `P/tmp/restart.txt`.
- `.previous` và toàn bộ asset phụ thuộc rollback đang được bảo vệ. Không tự coi server sourcemap là file thừa.
- Repository Git và cache/tệp riêng do hosting quản lý chưa kiểm kê: không thuộc allowlist dọn của ứng dụng.

**Nguồn đối chiếu**

- `.cpanel.yml`; `docs/production-environment.example.env`; `vite.config.ts`; `server.ts`.
- `src/lib/sqliteStorage.ts`; `src/lib/storage/sqliteConfig.ts`; `src/lib/firebaseAdmin.ts`.
- `src/server/listening/listeningRouter.ts`; `src/server/mover-reading-writing/moverReadingWritingRouter.ts`; `src/server/listening-pdf-import/transientSources.ts`.
- `src/server/vocab-images/service.ts`; `src/server/speaking/service.ts`; `src/server/speaking/sessions.ts`; `src/server/ioe-violympic/practice.ts`.
- `scripts/media-orphan-maintenance.mjs`; `scripts/activity-prune.mjs`; `scripts/sqlite-cli-common.mjs`; `scripts/sqlite-backup.mjs`.
- `quytac.md`; `docs/DATA_SAFETY.md`; `docs/sqlite-backup-restore.md`; `docs/production-remediation-rollout-checklist.md`.
