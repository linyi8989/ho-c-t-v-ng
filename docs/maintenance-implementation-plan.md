# Kế hoạch triển khai Dung lượng & Dọn dẹp
Ngày 2026-10-09. Căn cứ: hai attachment, quytac.md, CODEMAP và source. User đã cho phép triển khai. Chính sách đã chốt: **không bắt buộc giữ backup trên hosting sau khi file tải về được đối chiếu**.

## Phạm vi và nguyên tắc
- Tích hợp vào Super Admin hiện có: thẻ Tổng quan + tab Dung lượng & Dọn dẹp. Không thêm URL /admin/storage giả khi app dùng tab state.
- Theo dõi toàn bộ account root đọc được; root không rõ vai trò chỉ giám sát. Không xóa main database/WAL/SHM, users/classes/lessons/results/history/leaderboard.
- Không cleanup trong startup/GET/page load. Không theo symlink/hardlink để xử lý; client không truyền đường dẫn hoặc shell command.
- Dùng chung helper SQLite Online Backup và reference index của CLI media cũ. Không gọi CLI cần maintenance window từ web.
- Tải backup có sẵn bằng stream; không tạo copy/nén để tải. Worker đọc file local từng khối 4MiB, chỉ gửi SHA-256/bytes.
- Quick_check + hash/size + actor/fingerprint/hạn 24h; preview hạn 10 phút, ghim và xác nhận đúng tên, revalidate trước xóa. Có thể xóa cả backup cuối trên host. DB backup không chứa media; checksum không đồng nghĩa thử restore.
- Snapshot mới được chuẩn hóa journal_mode=DELETE trên chính bản sao để tải độc lập; bản có WAL không rỗng không được đối chiếu như một file.
- Metadata riêng ngoài deploy, audit/job/snapshot hữu hạn, state tối đa 12MiB. Cách ly vẫn chiếm dung lượng; bytes file xóa khác quota thực giảm.
- Engine tự động chỉ temp/speaking đã kiểm chứng; mặc định tắt. Cron dry-run trước opt-in; job đang dùng/unknown bị chặn.
- CPanel/cloud chưa kết nối báo unknown/unconfigured. Không tự deploy hoặc chạy xóa production trong task này.

## Checklist code và kiểm thử local
### V1 — Theo dõi
- [x] Đọc quy tắc/CODEMAP/package/source; ghi nhận git status ban đầu và giữ tài liệu inventory đã có.
- [x] Config persistent, metadata store atomic/hữu hạn, lease chống trùng giữa app/CLI, phục hồi task bị gián đoạn.
- [x] Scanner giới hạn thời gian/file/catalog/nhóm; symlink/hardlink an toàn; missing/unreadable/partial có trạng thái.
- [x] Các nhóm app + nhóm account (gồm .npm/nodevenv/deploy-staging nếu tồn tại), file lớn, backup, lý do phân loại và root thực tế.
- [x] Snapshot theo ngày/tăng trưởng/cảnh báo tăng nhanh, quota, reference lỗi, file quá hạn bị job giữ và tác vụ thất bại.
- [x] Quota integration tùy cấu hình server; chưa kết nối không có số giả. Preflight dùng filesystem đích + account quota, reserve 256MiB.
- [x] Đọc crontab tùy chọn; nhận diện script, che lệnh/secret. Không nhầm lịch đăng ký với bằng chứng đã chạy.
- [x] Tab/thẻ Tổng quan chỉ super admin; server auth/role; filter/page/loading/empty/error.

### V2a — Backup local và dọn có duyệt
- [x] Catalog SQLite trong root cho phép; main DB được bảo vệ theo path và inode.
- [x] Tạo snapshot qua helper cũ, quick_check, guard quota/khoảng trống; không tạo thêm file để download.
- [x] Download stream với capability một lần, hạn 2 phút; giữ lease đến kết thúc/abort.
- [x] Worker SHA-256 incremental, progress/cancel; không upload file local.
- [x] Evidence gắn actor/hash/size/fingerprint/hạn; file đổi/bằng chứng lỗi/người khác/ghim không được xóa.
- [x] Preview, typed confirmation, audit intent/completed, kiểm tra lại nội dung trước unlink.
- [x] Không ép giữ bản trên host; fixture kiểm chứng xóa bản cuối sau đối chiếu.
- [x] Keep/hold, review, quarantine + manifest, restore không ghi đè. Speaking không được hold vượt 24h.
- [x] Temp >48h/Speaking hết hạn đủ điều kiện mới được xử lý; main data/unknown/dependency/media tham chiếu được bảo vệ.
- [x] Media reference index dùng chung, JSON hỏng fail closed; archived/version/attempt/sample audio được bảo vệ.
- [x] Release manifest/current/rollback/cache 365 ngày; legacy chưa chứng minh giữ lại. Kiểm tra SHA-256 lịch sử trước xử lý asset.

### V3 — Engine sẵn sàng, chưa kích hoạt hosting
- [x] CLI shared core: --scan / --dry-run / --execute riêng; default dry-run, yêu cầu storage path rõ ràng.
- [x] Dry-run liệt kê ứng viên kể cả policy đang tắt; execute không xóa khi chưa opt-in.
- [x] Policy temp/speaking tắt mặc định, xác nhận kích hoạt riêng, recheck từng file, tối đa 100 file/đợt, dừng khi lỗi.
- [x] Backend Speaking cap 24h; worker/retry/audio chặn legacy quá hạn, không gọi provider khi hết hạn; giữ kết quả/history.
- [x] Runbook quota, cron env riêng, activation theo giai đoạn, backup local, rollback giữ dữ liệu.

### Kiểm chứng
- [x] Fixture riêng: auth/role/capability, traversal/id lạ, symlink/hardlink, file đổi, concurrency, partial/error/metadata fail closed.
- [x] Backup hash/download/delete-last; temp keep/quarantine/restore; automation opt-in; main DB/users/gold giữ nguyên.
- [x] Kiểm thử hẹp cuối: 45 tests (maintenance + SHA-256 + Speaking), không skipped/failure.
- [x] Browser thực: tải xuống/chọn lại file local/worker đối chiếu, modal xóa cần xác nhận, Tổng quan không quét; desktop/mobile và computed contrast >=4.5.
- [x] History/storage/CLI, Listening, legacy contracts và các regression liên quan đã qua trên fixture.
- [x] Build chuẩn Node22 + manifest 124 file; startup/reopen SQLite WAL đã qua.
- [x] Server bundle: production chặn QA flag, summary 401, token QA 401, download chưa cấp 404; startup/GET không tạo maintenance directory.
- [x] Typecheck và trọn Phase2 sau bản sửa type-only: PASS (316 tests, build chuẩn, native startup/WAL/reopen). Log maintenance-phase2-final.log.
- [x] Rà soát diff/source/CODEMAP/ledger; artifact hash/size được đối chiếu sau build Phase2, server giống bundle đã smoke.

## Checklist phải làm trên hosting trước kích hoạt
- [ ] Deploy server/client/scripts/manifest và restart Passenger theo quyền người vận hành.
- [ ] Xác nhận artifact hash, worker, super admin tab và role API trên host thật.
- [ ] Cấu hình account/deploy/state root và kết nối quota private; đối chiếu Disk Usage cùng phạm vi/thời điểm.
- [ ] Quét read-only một vòng; kiểm tra missing/unreadable/partial, asset legacy và danh sách cron hiện hữu.
- [ ] Kiểm tra cron backup/cleanup cũ, tránh trùng; các CLI cũ vẫn cần maintenance window/dung lượng riêng theo runbook.
- [ ] Tải/xác minh backup fixture trên host; thử restore có kế hoạch bên ngoài trước destructive production.
- [ ] Tạo cron env private ngoài web root và đăng ký collector; kiểm tra execution/timezone bằng log.
- [ ] Dry-run trên host, duyệt chính sách rồi mới bật temp/speaking execute. Không auto bật trong task local này.
- [ ] Kiểm tra quota thực sau xóa, history/leaderboard/Listening/Speaking, và rollback.

## Phần mở rộng chưa triển khai
- [ ] Chuyển trực tiếp backup lên R2/Azure, kiểm chứng bản remote, retention off-host: cần chọn dịch vụ/credential và thiết kế retry/multipart.
- [ ] Email và gom cảnh báo: cần kênh gửi/cấu hình; hiện dashboard có thông báo/cảnh báo.
- [ ] Instrument cron/script legacy và tác vụ nhà cung cấp để có log từng file; lịch crontab chưa đủ chứng minh kết quả.
- [ ] Dọn cache/log/deploy-staging/public_html/node_modules backup/media ZIP chưa chứng minh ownership/dependency: hiện chỉ giám sát.
- [ ] Restore drill thực cho bộ DB + media; không đánh dấu restoreTested khi mới hash/quick_check.

## Bằng chứng local
- .data/maintenance-final-tests.log; maintenance-final-history.log; maintenance-listening.log; maintenance-legacy.log; maintenance-regressions.log.
- .data/maintenance-phase2-final.log; maintenance-final-build.log; maintenance-startup.log; maintenance-bundle.log.
- .data/maintenance-qa/browser-report.json, bundle-report.json, artifact.json và screenshots/.
- Dữ liệu fixture ở temp; không truy cập/xóa DB hay media production, không sửa .env, không commit/push/deploy.

## File/luồng chính
- scripts/maintenance-core.mjs + maintenance-run.mjs; src/server/maintenance/router.ts; src/shared/maintenance.ts.
- src/components/admin/maintenance/: UI, worker/checksum, CSS và thẻ Tổng quan.
- scripts/media-reference-index.mjs dùng chung với CLI cũ; sqlite-cli-common.mjs snapshot độc lập.
- scripts/write-client-manifest.mjs; package build; .cpanel.yml lưu manifest vào data/frontend-releases sau activation.
- src/server/speaking/service.ts guard 24h. Callback Movers chỉ thêm annotation type để giải quyết lỗi never có sẵn khi chạy gate; không đổi điều kiện validation/chấm.
- docs/production-environment.example.env, maintenance-cpanel-runbook.md; CODEMAP section 190.

## Bổ sung theo phản hồi test — preview và ý nghĩa trạng thái
- [x] Giải thích trạng thái và giữ file ngay trong tab File & Dọn dẹp.
- [x] Giữ/Bỏ giữ cập nhật trạng thái ngay, có ngày hết hạn; không xóa/di chuyển file. File đang lọc trạng thái khác có thể ẩn khỏi danh sách, vẫn tìm bằng Giữ lại/Tất cả.
- [x] Backend preview ảnh/audio chỉ super admin, file ID trong catalog và root media cho phép; revalidate path/stat, chặn symlink/hardlink, giới hạn size và xác minh chữ ký định dạng.
- [x] Modal ảnh/audio, loading/error, không autoplay, abort/revoke URL và dừng audio khi đóng.
- [x] Regression preview/auth/path/content/size/concurrency + hold expiry:21 tests maintenance/SHA, không fail/skip.
- [x] Browser ảnh decode/audio playback, không autoplay, đóng/Escape/mobile/focus, không tràn dialog; giữ/bỏ giữ cập nhật ngay và backup download/worker/confirmation vẫn qua. Typecheck/build/bundle/startup PASS.
- [x] Cập nhật CODEMAP/runbook, restart đúng localhost 3000. API local thực: ảnhPNG 200 / 18,758 bytes, WAV 200 / 147,756 bytes; không token 401. Không xóa/di chuyển file thật.

Bằng chứng bổ sung: .data/maintenance-preview-{tests,lint,build,browser,bundle,startup}.log; .data/maintenance-qa/{browser-report,artifact,localhost-preview-report}.json; screenshots/maintenance-preview-{image-desktop,audio-mobile}.png.
Chẩn đoán preview: React StrictMode hủy effect đầu rồi chạy lại có thể trùng lease; request được trì hoãn đến lượt event loop để cleanup hủy trước khi gửi. Focus được chụp trước native showModal. Kiểm thử chờ đúng lần quét mới và control hết disabled; CDP dùng mã phím Escape 27 và userGesture cho thao tác Play.

## Phương án chính mở rộng toàn tài khoản hosting — rà soát 2026-10-10

Trạng thái cập nhật 2026-10-10: V1 mở rộng đã triển khai source và kiểm thử local; pilot/deploy hosting chưa thực hiện. V2 vẫn duyệt thiết kế và V3 chờ nghiệm thu. Bản rà soát dưới đây là căn cứ triển khai, kết quả cập nhật tại mục13. Căn cứ bổ sung: attachment `4830a568-b166-43d6-ab7a-9a29d6256cec/Pasted text.txt` và trao đổi về cây thư mục, tác vụ nền, media mồ côi, bộ backup ngoài dự án.

Các checklist đã đánh dấu phía trên là bằng chứng của module hiện có, không phải nghiệm thu khả năng quản trị toàn hosting. Giữ cấu trúc V1/V2/V3; bên dưới gọi rõ là V1/V2/V3 MỞ RỘNG để tránh nhầm với các mốc local cũ. Quyền trong attachment được ghi nhận là phạm vi của kế hoạch tiếp theo; yêu cầu hiện tại là đánh giá và cập nhật phương án.

### 1. Những quyết định đã duyệt được giữ nguyên

- Tích hợp Super Admin hiện có: Tổng quan và Dung lượng & Dọn dẹp, không tạo một hệ quản trị/URL tách rời.
- Kiểm kê toàn phạm vi tài khoản hosting có quyền đọc, gồm file/thư mục ngoài thư mục dự án; không quét toàn máy chủ AZDIGI hoặc tài khoản khác.
- Cây thư mục, dung lượng, vai trò, bản đồ phụ thuộc, xem bằng chứng, xác minh lại, snapshot, cảnh báo và tác vụ nền là phạm vi chính thức của V1 mở rộng.
- Tên file, tuổi file, AI nhận xét hoặc việc không tìm thấy tham chiếu không đủ để cấp quyền xóa.
- V2 mở rộng gồm dry-run, quản lý cả bộ backup, tải/local hoặc lưu ngoài host, đối chiếu, phê duyệt, thao tác backend có audit. Chỉ duyệt thiết kế ở bước này; phải nghiệm thu fixture và cấp phép triển khai production trước hành động mới trên dữ liệu thật.
- V3 mở rộng chờ V1/V2 nghiệm thu, mặc định tắt, chỉ các nhóm app tự tạo với policy đã kiểm thử; không tự xóa thư mục lạ/toàn hosting.
- Không bắt buộc giữ bất kỳ bản backup nào trên host sau khi bản ngoài host được xác minh phù hợp. Giữ nguyên cơ chế đã duyệt cho file SQLite: bản local khớp SHA-256/bytes, quick_check, xác nhận và kiểm tra lại; không tự thêm yêu cầu phải thử restore từng bản mới cho xóa.
- Hash/quick_check không phải bằng chứng đã thử restore. Hiển thị riêng mức kiểm tra; restore drill là tiêu chí rollout theo nhóm backup, không được ghi đã thử khi chưa làm.
- Bảng vàng giữ nguyên cơ chế; dữ liệu tài khoản, bài học, kết quả, lịch sử và main DB/WAL/SHM tiếp tục được bảo vệ. Việc mở rộng inventory không cấp quyền xóa bản ghi database.
- Speaking giữ tối đa 24h, file tạm >48h theo policy hiện có; job đang dùng chặn dọn. Giữ 30 ngày, ghim backup, preview ảnh/audio tiếp tục hoạt động theo hợp đồng hiện hành.
- Không cleanup/backup/scan nặng khi startup, GET hoặc tải trang. Cách ly vẫn chiếm dung lượng; xóa file và thay đổi quota là hai phép đo riêng.
- Không xóa toàn bộ account root, nodevenv/, public_html/, mail/, .cpanel/, repositories/, app-data/, runtime, thư mục chứa cấu hình/secret hoặc đích backup đang được dùng. Xử lý dữ liệu thừa bên trong chỉ bằng phạm vi con được xác minh riêng.

### 2. Đối chiếu source: tái sử dụng và giới hạn cần giải quyết

| Hạng mục | Source thực tế | Điều bổ sung vào phương án |
|---|---|---|
| Account root | maintenanceConfig có MAINTENANCE_ACCOUNT_ROOT; production có fallback home /home/, local fallback dataRoot | Cấu hình root rõ trên host, kiểm tra biên giới/quyền; không suy rộng kết quả local thành host đã được quét |
| Scanner | scan trong scripts/maintenance-core.mjs: một lượt hữu hạn, mặc định 60s/100000 file; danh sách chi tiết ứng viên tối đa 3000 + largest50; nhóm account cấp đầu, tối đa 1000 nhóm | Cây nhiều cấp, phân trang backend, quét chia đợt và lưu tiến độ bền vững; tăng limit đơn thuần không giải quyết đầy đủ |
| State | state.json tối đa 12MiB; audit 600, jobs 80, snapshots 120; summary trả jobs 30/audit 100 | Không đưa toàn bộ inventory/graph vào state.json hoặc một response; cần chỉ mục riêng có ngân sách disk và API theo trang |
| Snapshot | Một điểm/ngày, thay điểm trong cùng ngày; growth theo nhóm và giới hạn phạm vi hiện tại | Theo dõi lần quét hoàn chỉnh và chênh lệch file, cửa sổ 1/7/30 ngày trên cùng scope; không suy ra file mới từ số nhóm tăng |
| Bằng chứng | Reference index DB media, Speaking jobs, release manifests; không có bộ lấy domain/app/runtime toàn hosting | Thêm nguồn hosting có báo cáo coverage; giữ reference index hiện có, không coi nó là bản đồ toàn tài khoản |
| Cron/jobs | crontab -l tùy chọn, lịch được che lệnh; job/audit chỉ từ core maintenance | Registry nguồn tác vụ, heartbeat/kết quả có chứng cứ; worker Speaking và cron/provider khác chưa tự xuất hiện |
| Backup | Root cố định, nhận diện SQLite theo mẫu tên/path; download/verify/delete từng file có lease và actor-bound evidence | Bộ backup có danh sách file, archive/media/code/ngoài dự án; nhận diện bằng bằng chứng, không thay regex rồi cho xóa folder |
| An toàn | Router super_admin, safeFile/path/stat, không symlink/hardlink, lease, Online Backup, confirmation và recheck | Tái sử dụng qua module nhỏ có regression, bổ sung chặn folder cấp cao, xác minh cả bộ và race với tác vụ ngoài core |
| Frontend/deploy | Các tab state trong AdminDashboard; .cpanel.yml giữ .htaccess do host quản lý, copy scripts/*.mjs, deploy root khác data root | Mở rộng UI/API hiện có; collector .mjs mới phải nằm trong đường copy được kiểm chứng. Không sửa .htaccess, .env, dependency/runtime để phục vụ inventory |

Node22/better-sqlite3@10.1.0/SQLite WAL và build chuẩn tiếp tục giữ. Bản hiện tại chưa có tree index, pause/resume bền vững, dependency adapters, bộ backup đa file hoặc remote transfer. Những mục này phải để chưa hoàn thành đến khi có kiểm thử và bằng chứng host.

### 3. A — Trạng thái dựa trên bằng chứng, không tự chuyển thành quyền xóa

Giữ nguyên chín trạng thái file/API hiện hành. Năm trạng thái của bản đánh giá được dùng cho góc nhìn hosting mới; thông tin vai trò và bảo vệ được lưu riêng:

| Trạng thái hosting | Điều kiện và cách hiển thị |
|---|---|
| Protected / Được bảo vệ | Ngoài quyền dọn, vùng hệ thống, main data, runtime, bí mật, hold/pin hoặc có dữ liệu con phải giữ; hiển thị rule và lý do |
| Active / Đang được tham chiếu | Có quan hệ hiện hành từ app/domain/cron/dịch vụ; có thể đồng thời thuộc policy bảo vệ |
| Unknown / Chưa xác minh | Thiếu collector, quyền, schema, dữ liệu lỗi/cũ hoặc chưa xác định vai trò; nêu cụ thể phần thiếu |
| Cleanup Candidate / Ứng viên dọn | Dấu hiệu cần xem xét, chưa đủ bằng chứng cho phép xóa; tên backup hoặc không có tham chiếu chỉ tạo ứng viên |
| Verified Cleanup / Đã xác minh theo chính sách | Vượt verifier của đúng nhóm trong scope đầy đủ liên quan, evidence còn hiệu lực; vẫn cần backend xét quyền và phê duyệt mỗi thao tác |

Không đổi ý nghĩa used cũ thành chắc chắn có tiến trình đang mở file: used còn có nghĩa file mới chưa hết thời gian bảo vệ. eligible hiện tại của một file không được suy rộng thành toàn folder đủ điều kiện. Một folder có thể hiển thị vai trò hỗn hợp, số byte được bảo vệ/ứng viên/chưa rõ; không cho xóa cả folder nếu có mục con protected/unknown/held/pinned.

Mỗi evidence chứa nguồn, thời điểm quan sát/xác minh, phiên bản bộ kiểm tra, scope, ID đối tượng, tham chiếu đã che secret, trạng thái nguồn và lý do. Approval V2 thêm actor, bộ file/fingerprint/hash, revision cấu hình liên quan và hạn do server quản lý. Cấu hình root/domain/app/cron thay đổi, bộ file đổi hoặc nguồn lỗi/cũ làm bằng chứng mất hiệu lực. Frontend không được tự gửi verified=true để cấp quyền.

V1 mở rộng chỉ phân loại/giải thích, không phát hành quyền xóa thư mục mới. Khi nguồn chưa đủ thì hiển thị Candidate/Unknown, kể cả trong mock graph đẹp. Thời điểm xác minh và phạm vi luôn có trên UI.

### 4. B — Bản đồ phụ thuộc và nguồn dữ liệu phù hợp hosting hiện tại

Mô hình quan hệ: tài khoản → domain → document root hoặc ứng dụng → code/startup/runtime/dependencies/data/media; thêm cạnh repository/deploy/cron/backup/dịch vụ. Mỗi cạnh có bằng chứng, không coi sơ đồ minh họa app.msdieu.com/nodevenv/app-data là thực trạng đã xác minh.

Các nguồn độc lập, đọc theo khả năng của host:

1. Đường dẫn ứng dụng đã cấu hình: resolved paths trong maintenanceConfig/process.env allowlist, app.js → dist/server.cjs, DB/media/state, .cpanel.yml và release manifests. Chỉ dùng các đường dẫn cần thiết; không thu thập toàn bộ environment.
2. cPanel Domains/hosting configuration: domain, document root, quan hệ chia sẻ; adapter tùy API/schema thực tế, timeout và cache hữu hạn. Token nằm server; API thiếu quyền/không hỗ trợ báo rõ.
3. CloudLinux Node.js Selector/Passenger: phát hiện cơ chế host có thật rồi đọc metadata ứng dụng/runtime/startup. Không mặc định cPanel Application Manager và CloudLinux Selector là cùng một nguồn hoặc luôn có quyền. .htaccess chỉ được phân tích các trường Passenger/path được allowlist; không lưu raw SetEnv/secret và không sửa file.
4. Symlink: đọc metadata/đích liên kết để lập cạnh phụ thuộc, không đi theo để kiểm kê hoặc xử lý ngoài root. Đích runtime ngoài tài khoản chỉ là node ngoài phạm vi, không được cộng dung lượng hoặc cấp xóa. Hardlink/shared dependencies tiếp tục protected.
5. Git/deploy: root, metadata triển khai được tin cậy, manifest hiện hành/rollback; không chạy npm, package scripts, hook hoặc file thực thi trong thư mục lạ. Che credential trong remote URL. File .cpanel.yml chỉ là nguồn đường dẫn dự kiến, không tự chứng minh deployment đã chạy.
6. Cron: lịch và tham chiếu script/path từ lệnh được nhận diện; lệnh thô/secret không xuất hiện trong UI/log. Không thực thi cron chỉ để xem nó làm gì.
7. Email, cPanel, backup và dịch vụ: vùng được quản lý được bảo vệ bằng policy; chỉ đọc metadata đủ để nhận diện. Thiếu API của nhà cung cấp không dẫn đến kết luận các vùng đó không dùng.
8. Tiến trình: chỉ metadata không bí mật của process thuộc tài khoản và được phép quan sát. Không dump environment/full command line; không thấy process hoặc không mở file tại thời điểm kiểm tra không chứng minh thư mục vô dụng.

Trường hợp cần thêm bảo vệ: tên node_modules-app-backup-* có thể liên quan đến thay đổi môi trường hoặc phục hồi của công cụ hosting. CloudLinux có cơ chế migration giữ dependency cũ cho đến khi kiểm tra sức khỏe hoàn tất. Đây là khả năng cần kiểm tra phiên bản/trạng thái trên host, không phải kết luận host đang dùng tính năng này. Nếu không đọc được trạng thái migration/recovery thì giữ Unknown/Protected, không dựa tên để đưa vào backup có thể xóa.

Coverage theo từng nguồn: available / unconfigured / permission_denied / unsupported / partial / failed / stale. Không đổi tất cả thành một cờ complete. Filesystem đã duyệt đủ vẫn có thể thiếu bằng chứng phụ thuộc.

### 5. C — Collector chia đợt, kho chỉ mục riêng và ngân sách tài nguyên

- Scope được server cấu hình từ account root đã xác nhận, không nhận root/path tùy ý từ trình duyệt. Duyệt file ẩn, thư mục con bằng metadata; ghi rõ missing, permission_denied, vanished và symlink-excluded, không đổi thành 0 byte.
- Một job có scanId, scope/version, hàng chờ thư mục, trạng thái queued/running/paused/interrupted/completed/failed, heartbeat, số mục đã đọc và khoảng thời gian đo. Pause tại ranh giới batch; restart không tự scan ở startup/GET, resume có chủ đích từ tác vụ đã đăng ký.
- Collector chạy qua CLI/worker đáng tin cậy với tham số cố định/ID, ưu tiên process riêng sau kiểm chứng trên Passenger. Không dùng shell ghép lệnh từ UI. Nếu host không hỗ trợ executor thì hiển thị chưa cấu hình; kiểm kê qua CLI được đăng ký rõ, không báo đang chạy giả.
- Chia batch theo số mục, thời gian, memory/I/O; nghỉ giữa đợt và hạ tốc khi app bận. Ngân sách batch là giới hạn mềm; hard CPU/I/O quota chỉ khẳng định khi host cung cấp và đã kiểm chứng. Không giữ lease thao tác xóa/download xuyên suốt nhiều giờ kiểm kê. Có job lease riêng, phối hợp chống sửa chỉ mục trùng và recheck trước mọi action. Lease của core không bảo vệ được tác vụ bên ngoài không sử dụng core.
- Restart giữa lúc duyệt thư mục: lưu hàng chờ; thư mục chưa hoàn tất được duyệt lại và upsert theo scanId/path để không đếm đôi. Không tin vào thứ tự readdir ổn định. File/thư mục đổi trong cửa sổ quét phải có cờ thay đổi và xác minh lại.
- Chỉ mục SQLite riêng trong MAINTENANCE_STATE_DIR, ví dụ inventory.sqlite, dùng runtime/native đã pin; không thêm inventory vào DB nghiệp vụ. Các nhóm logic: scans, entries/directories, sources, evidence/edges, deltas, backup_sets, task_registry. state.json hiện tại giữ tương thích, không nhét toàn bộ graph vào trần 12MiB.
- Có ngân sách disk rõ cho index + WAL/journal + file tạm, kiểm tra free space trước ghi, transaction ngắn và checkpoint hợp lý. Trần được chốt từ fixture lớn/pilot host trước rollout. Chạm trần thì pause/partial và báo nguyên nhân, không mất báo cáo cũ hoặc báo hoàn tất. Giữ current + baseline chi tiết cần so sánh; lịch sử dài hạn chỉ lưu tổng hợp hữu hạn, không nhân bản toàn cây mỗi ngày.
- Metadata của chính inventory được tính thành nhóm giám sát riêng; tránh tự quét chỉ mục đang ghi rồi cảnh báo file mới vô hạn. Không tạo backup toàn index tự động. Prune chỉ metadata của collector theo retention công bố, không động file ứng dụng.
- Không đọc nội dung .env, private key, SSH, thư/email để tính dung lượng. Dùng stat cho kiểm kê; config paths từ environment đã được app nạp và nguồn allowlist. V1 chỉ ghi metadata riêng của inventory/job, không ghi/xóa dữ liệu được kiểm kê.
- API phân trang/lazy-load từng directory/edge/delta, không trả toàn tài khoản qua summary hiện tại; UI không suy ra việc thiếu dòng trong trang hiện tại là file đã biến mất.

Tách các phép đo: logical bytes theo đường dẫn; allocated bytes theo filesystem khi có; hardlink/inode dùng chung không cộng đôi ở tổng vật lý; thư mục cha đã bao gồm con nên không cộng tất cả dòng tree với nhau. Không hỗ trợ allocated measurement thì để unavailable, không lấy logical gắn nhãn vật lý. Quota cPanel có scope/thời điểm/cơ chế riêng; số thiếu hoặc schema chưa xác minh không đổi thành zero.

Mỗi báo cáo phân biệt: job kết thúc hay chưa; filesystem coverage; dependency coverage; thời gian bắt đầu/kết thúc; root/rule version; độ mới của số liệu. Quét filesystem là cửa sổ quan sát, không phải snapshot nguyên tử của mọi dữ liệu đang vận hành. Không hiện 100% khi chưa biết tổng công việc.

### 6. D — Snapshot, file mới và nguồn phát sinh có mức bằng chứng

- Lưu các mốc hoàn chỉnh có scope tương đương; tổng hợp ngày theo múi giờ đã cấu hình, timestamp gốc UTC. So sánh 1/7/30 ngày chỉ khi cùng scope và độ bao phủ đủ; đổi root, lỗi quyền hoặc giới hạn chưa hết thì hiển thị không đủ mốc.
- Deltas gồm mới được quan sát, thay đổi và không còn được thấy trong phạm vi đã duyệt lại đầy đủ. Không gọi file mới được quan sát là vừa được tạo chắc chắn; không coi bị bỏ sót do quyền/batch là đã xóa.
- So sánh size/fingerprint để tìm thay đổi; chỉ hash nội dung khi xác minh đúng nhóm cần thiết, không hash toàn mail/node_modules chỉ để thống kê.
- Nguồn tạo có ba mức: đã xác minh từ job/deploy/backup event gắn operation và file; tương quan thời gian/đường dẫn; chưa xác định. Thời điểm trùng cron không đủ khẳng định cron đã tạo file.
- Cảnh báo tăng trưởng, bộ backup liên tục sinh thêm, asset cũ tích lũy, file tạm quá hạn; mỗi cảnh báo kèm mốc, coverage, lý do và hành động. Cron không có log đúng khoảng dự kiến được báo thiếu bằng chứng chạy, không kết luận chắc chắn đã ngừng.
- Ngưỡng absolute + tỷ lệ/tốc độ có cấu hình; gom trùng cảnh báo theo đối tượng và khoảng thời gian. Quota chỉ được kết luận từ nguồn thật; ngưỡng đề xuất chưa được trình bày như số đo host.

### 7. E — Backup Manager theo bộ, ưu tiên bản đã có

- V1 kiểm kê bộ backup ngoài dự án, phân biệt SQLite/media/code/archive/chưa rõ. Chỉ gọi bản đầy đủ khi có danh sách thành phần/scope chứng minh; hậu tố zip hoặc chữ full không đủ. Mọi bộ có nguồn nhận diện và phần chưa xác minh.
- V2 quản lý BackupSet ID và danh sách thành phần cố định có đường dẫn tương đối, hash/bytes/fingerprint, nguồn tạo và tình trạng đang ghi. Không đồng nhất folder chứa nhiều đời backup với một bộ backup bất biến.
- Tải có xác thực qua stream/capability hạn ngắn như cơ chế cũ; không công khai static URL hoặc đưa Firebase token vào query. Giữ protection cho bộ đang tải; download hoàn tất không tự chứng minh bản đã nằm trên máy người dùng.
- Archive có sẵn tải nguyên file. Folder có thể tải từng thành phần hoặc đóng gói theo luồng với danh sách kèm theo, không tạo ZIP lớn tạm trên host; hash/đối chiếu toàn bộ thành phần. Bộ đổi giữa khi liệt kê/tải thì bằng chứng không hợp lệ. Không cam kết tải tiếp/multipart trước khi cơ chế đó được kiểm thử.
- Không tải main SQLite/WAL đang ghi như một file backup. Bản mới qua Online Backup/helper đã có; kiểm tra filesystem/quota và dự phòng. Bộ có database và media đang thay đổi cần cơ chế tạo snapshot nhất quán riêng; V1 không tự tạo nó.
- Các mức xác minh riêng: transferComplete, checksumVerified, formatChecked, restoreTested. SQLite dùng quick_check và chính sách cũ; archive cần kiểm tra cấu trúc/CRC hoặc danh sách thành phần phù hợp; định dạng chưa có verifier giữ chưa xác minh. Không thử giải nén bộ lớn trên host chật hoặc chạy code lấy từ backup.
- Giữ đường local và bổ sung đường remote. Cloud vẫn thuộc thiết kế đã duyệt; triển khai kết nối cần chọn provider/credential/quyền/chi phí, không làm blocker V1. Remote object phải hoàn tất upload và có checksum đáng tin hoặc kiểm tra đọc lại; HTTP200/ETag không mặc nhiên là SHA-256. Không tạo/trả public URL dữ liệu riêng.
- Có thể xóa bản cuối trên host sau bằng chứng ngoài host phù hợp và phê duyệt. Không xóa chính thư mục đích mà cron/cPanel đang ghi. Xóa từng mục của bộ đã chốt; chỉ xóa container riêng của bộ khi thật sự rỗng, không xóa cây bao ngoài.
- Restore drill cho từng loại mới trên dữ liệu giả/bản sao ngoài host trước rollout; trình bày rõ dữ liệu/media nào nằm ngoài scope backup. Không ép dùng cloud nếu người dùng đã chọn và xác minh bản local.

### 8. F — Quyền dọn backend và ranh giới thư mục

- Các endpoint inventory/evidence của V1 không mở thêm cleanup action. API cũ chỉ giữ phạm vi cũ đã duyệt; việc có tree mới không cấp quyền xóa cho root mới.
- V2 chỉ nhận object/plan/approval ID được server phát hành; không nhận arbitrary path, shell command hoặc rm recursive từ UI. Kiểm tra super_admin, account boundary, loại đối tượng, protected descendants, policy/hold/pin, bằng chứng/actor/expiry và cấu hình hiện tại.
- Backend dựng danh sách từng mục được phép xử lý rồi dry-run. Trước mỗi thao tác kiểm tra lại parent/root/realpath, lstat và fingerprint/hash phù hợp, symlink/hardlink, job đang dùng và membership của bộ. Có file thêm/đổi/thiếu hoặc config đổi thì dừng và yêu cầu xác minh lại; không tự mở rộng danh sách.
- Chống thay thế parent directory và link sau quét phải có regression. Không tuyên bố loại bỏ mọi race bằng lstat + một lease: writer ngoài core/host tool phải được phối hợp hoặc đưa vùng đó vào maintenance window. Nếu không kiểm soát được điều kiện an toàn thì không cấp xóa folder.
- Danh sách vùng cấp cao bảo vệ ở mục 1 không được bỏ bảo vệ bằng tên đẹp, score AI, nút mark verified hoặc lời xác nhận đơn thuần. Vai trò của thư mục lạ cần bằng chứng bổ sung; chưa có verifier đúng loại thì vẫn giám sát.
- Không auto recursive-delete toàn node_modules backup khi chưa chứng minh hết quan hệ recovery/migration. Dọn các file app quản lý theo nhóm đã test; media nghi ngờ cần verifier riêng bao phủ draft/version/attempt/job/library, chưa có thì không mở xóa trên web.
- Audit intent/completed/failure theo operation và từng mục. Mất kết nối có thể để lại bộ dọn một phần; resume phải dựa log/danh sách cố định, không lặp xóa cả cây. Phục hồi không ghi đè.
- Cách ly bằng rename không giải phóng dung lượng. Nếu khác filesystem hoặc cần copy mà host thiếu chỗ thì dừng, không âm thầm copy cả bộ hoặc chuyển thành xóa vĩnh viễn.
- Ghi removed logical bytes riêng, allocated estimate riêng khi có; đo quota trước/sau với timestamp/scope. Quota giảm khi có hoạt động khác không được quy toàn bộ cho một job; nhà cung cấp cập nhật trễ thì báo chờ/chưa xác minh.

### 9. G — Tác vụ nền, lịch và nhật ký có nguồn chứng minh

- Giữ ba lớp: cấu hình/lịch dự kiến; job đang chạy/chờ/heartbeat; lịch sử thực thi/audit. Những thao tác manual dashboard cũng có history nhưng không được gọi là lịch tự động.
- Registry từng task có source, executor, trạng thái cấu hình, timezone/lịch nếu có, lần quan sát, lần bắt đầu/kết thúc có evidence, kết quả, scope/dữ liệu đã xử lý và operation. Tính lần tiếp theo chỉ khi scheduler/timezone đủ thông tin; không hỗ trợ thì báo chưa xác định.
- Core/collector mới ghi đầy đủ job và audit. Worker Speaking có nguồn registry riêng trước khi xuất hiện như job được kiểm chứng. Cron legacy/provider/cPanel/AZDIGI chỉ có metadata hoặc thiếu log thì hiển thị observed/unverified/permission denied, không suy thành success.
- Start/pause/resume/cancel chỉ cho collector hoặc task được đăng ký cho quản trị; không tạo nút chạy/sửa mọi cron lấy từ crontab. Bật/tắt chính sách không tự tạo lịch. Tác vụ đang chạy được chặn theo điều kiện thực thi, không dùng UI để tùy ý kill process hệ thống.
- UI poll hữu hạn khi xem job đang chạy, dừng khi ẩn tab/đóng panel; refresh chỉ đọc cache. Có tiến độ file/thư mục đã đọc, thư mục hiện tại, lý do pause/failed và độ mới số liệu; không chỉ một dòng success cuối cùng.

### 10. UI/API và các phần code dự kiến thay đổi khi triển khai

- File & Dọn dẹp: chế độ File ứng dụng / Thư mục hosting; chọn root đã đăng ký, nút Quét toàn tài khoản và tiến độ; cây nhiều cấp/phân trang, bộ lọc vai trò/trạng thái/size, panel bằng chứng + nguồn còn thiếu + xác minh lại. Trạng thái hành động phân biệt rõ với trạng thái sử dụng.
- Backup: danh sách theo bộ và thành phần, loại/scope, file đang ghi, local/remote evidence, mức format/restore và hành động theo phase. Nút tạo mới là phụ, không bắt tạo backup trước khi dọn bản sẵn có.
- Tác vụ nền: cấu hình quan sát/lịch, hiện tại và lịch sử; Nhật ký: chi tiết audit. Cảnh báo có mốc/phạm vi; Chính sách giữ opt-in và phase gate.
- Dự kiến tách các module scripts/hosting-inventory-*.mjs (collector/store/evidence/nguồn hosting), một CLI runner, API trong src/server/maintenance/, types riêng và component tree/evidence/jobs trong src/components/admin/maintenance/. Tên cụ thể chỉ chốt khi triển khai; chưa có các module mới này trong source.
- Tái sử dụng checks/backup/reference từ core hiện tại sau khi bổ sung test, không nhân bản engine cleanup. Thay đổi additive, đọc state version1 cũ được; giữ route cũ và quyền cũ. Inventory DB có schema/version riêng, không migration main DB hoặc rewrite state cũ hàng loạt.
- Collector .mjs và các dependency phải được pipeline scripts/*.mjs/bundle kiểm chứng; không âm thầm thêm subfolder không được deploy. Runbook bổ sung executor, index disk budget, nguồn khả dụng và rollback; config mới giữ credential server-side, không dùng VITE_ cho secret.

### 11. Mốc triển khai, phạm vi cấp phép và checklist nghiệm thu

Các mục mở rộng đều chưa hoàn thành trong lần cập nhật phương án này.

| Mốc | Trạng thái duyệt | Đích nghiệm thu |
|---|---|---|
| V1 mở rộng — kiểm kê/giám sát | Được duyệt triển khai read-only theo bản đánh giá; lượt hiện tại chỉ hợp nhất thiết kế | Toàn bộ readable account scope, tree, coverage, evidence graph, snapshot/delta/cảnh báo/job; không thêm quyền dọn |
| V2 mở rộng — xác minh/dọn có duyệt | Duyệt thiết kế, chờ nghiệm thu fixture và cấp phép rollout dữ liệu thật | BackupSet/local/remote theo cấu hình, dry-run, format/restore evidence, typed approval, guard, audit và số đo sau xử lý |
| V3 mở rộng — tự động | Chờ V1/V2 nghiệm thu; không tự bật | Chỉ policy app tạo đã kiểm thử, batch hữu hạn, dừng khi lỗi, cảnh báo, không thư mục lạ/system |

Checklist V1 mở rộng:
- [ ] Chốt account root thật, boundary, nguồn hosting có quyền và executor; ghi rõ khác biệt local/host.
- [x] Store riêng có ngân sách disk/index/WAL; report retention, migration tương thích và rollback chỉ metadata.
- [x] Collector bounded/pause/resume/restart, file ẩn, metadata-only, dedup, vùng không đọc được, thống kê chính xác trên fixture nhiều cấp.
- [x] Tree/phân trang trả đủ dữ liệu qua nhiều trang; báo filesystem và dependency coverage độc lập; không auto scan khi mở trang.
- [x] Nguồn domain/CloudLinux/Passenger/config/Git-deploy/cron/dịch vụ; từng nguồn có capability/time/evidence, secret không xuất hiện trong API/log.
- [x] Năm trạng thái hosting giữ tương thích chín trạng thái file; panel bằng chứng và graph, vùng mixed/protected không có nút xóa mới.
- [x] Snapshot/delta cùng scope, file mới/biến mất có điều kiện bao phủ, tăng trưởng 1/7/30 ngày, nguồn tạo có mức chứng cứ.
- [x] BackupSet inventory ngoài dự án, phân biệt loại/chưa rõ/đang ghi, không chỉ lọc SQLite regex.
- [x] Jobs/lịch/observed/verified, pause/resume thực và polling hợp lý; nguồn không có log không hiển thị success.
- [x] V1 API không thể tạo destructive approval mới; GET/page load không gọi scan/backup/cleanup, main DB và file được kiểm kê giữ nguyên.
- [x] Native fixture account đầy đủ + thiếu quyền/API lỗi + 100k+ file/metadata limit + low-disk + link vòng/ngoài root/hardlink + thay đổi giữa batch; hash bảo toàn DB/bảng vàng/media.
- [x] UI desktop/mobile, keyboard/focus, loading/empty/error/disabled và contrast theo quytac; typecheck/test/bundle/startup phù hợp phạm vi.
- [ ] Pilot read-only trên host: đối chiếu scope/quota/root/known apps, process executor, mức tải I/O và ngân sách index. Local fixture pass không thay cho host pass.

Bảy câu hỏi nghiệm thu của attachment phải có câu trả lời hoặc lý do thiếu bằng chứng: nodevenv ứng dụng nào dùng; deploy-staging thuộc pipeline nào; node_modules-app-backup còn recovery không; public_html phục vụ domain nào; app-data lớn do nhóm nào; .npm/.trash/tmp có gì; thư mục chưa rõ vì quyền, cấu hình hay chưa có collector. Không cần giả vờ trả lời chắc chắn mọi mục.

Checklist V2 mở rộng trước production:
- [ ] Nhận diện bộ ổn định và verifier từng loại; giữ chính sách bản cuối ngoài host, local không buộc cloud/restore từng bản.
- [ ] Stream/archive/manifest và hash/format local, timeout/abort/quota gần đầy, bộ đang ghi/WAL/membership đổi bị chặn.
- [ ] Cloud: provider/credential/quyền đã chốt, multipart/retry nếu dùng, object hoàn tất và checksum đọc lại phù hợp; chưa kết nối không báo done.
- [ ] Dry-run/approval ID/actor/TTL/hold/pin/protected parents+descendants; traversal, parent swap, symlink/hardlink và writer ngoài core có regression.
- [ ] Thử xóa/phục hồi fixture, giữ main DB/bảng vàng/media/env/runtime; dừng khi metadata/audit lỗi, xử lý partial operation và host gần hết chỗ.
- [ ] Restore drill ngoài host cho loại mới, rà soát bằng chứng và cấp phép rollout production trước khi mở action mới.

Checklist V3 mở rộng:
- [ ] V1/V2 đã nghiệm thu; chốt từng nhóm app tạo, dry-run và ngân sách file/byte/time.
- [ ] Opt-in chính sách và lịch riêng, dừng khi lỗi/config thay đổi, alert và rollback; không tự bật theo việc deploy code.

### 12. Ma trận truy vết bảy bổ sung và kiểm soát quyết định

| Yêu cầu attachment | Đã đưa vào thiết kế | Nghiệm thu chính |
|---|---|---|
| A — Bằng chứng/trạng thái | Mục 3 | Source/evidence/coverage/expiry, không tên/AI tự cấp xóa |
| B — Bản đồ phụ thuộc | Mục 4 | Domain/app/runtime/data/cron/deploy, CloudLinux phù hợp host, thiếu quyền minh bạch |
| C — Quét có giới hạn | Mục 5 | Account boundary, pause/resume, index disk budget, secret-safe, ba phép đo |
| D — Phát sinh bất thường | Mục 6 | Snapshot/delta cùng scope, file mới, creator attribution có mức bằng chứng |
| E — Backup chính thức | Mục 7 | Theo bộ/local+remote, streaming, format/restore riêng, không ép giữ host copy |
| F — Backend chống xóa nhầm | Mục 8 | IDs/approval/revalidation, protected roots, folder thay đổi, partial/race |
| G — Quan sát/thực thi | Mục 9 | Lịch khác execution proof, heartbeat, source coverage và quota attribution |

Bổ sung kỹ thuật từ rà soát source: giữ tương thích state/route/status; chỉ mục riêng không phá trần 12MiB; phân biệt hoàn tất quét với đủ bằng chứng; invalidate khi config/bộ file đổi; bảo vệ dependency recovery; tách collector read-only khỏi global cleanup lease; backup bộ bất biến và dọn theo danh sách; đo quota không quy nguồn tùy tiện. Không mục nào loại bỏ quyết định đã duyệt.

Nguồn kỹ thuật tham khảo (không thay bằng chứng host thật):
- [cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/): application path, domain, environment; khả dụng tùy nhà cung cấp.
- [Cách domain phục vụ nội dung](https://docs.cpanel.net/knowledge-base/cpanel-product/how-domains-serve-content/): document root và ứng dụng proxy cần được đối chiếu.
- [CloudLinux CLI / Node.js Selector](https://docs.cloudlinux.com/cloudlinuxos/command-line_tools/#node-js-selector): nguồn liệt kê ứng dụng của user; migration/dependency recovery phải xem đúng khả năng phiên bản host, không chạy các lệnh mutation để kiểm kê.

Bản cập nhật này chỉ thay tài liệu kế hoạch/CODEMAP, không sửa code chức năng, không deploy/restart, không tạo cron, không chạy scan/xóa dữ liệu thật hoặc thay đổi policy.

### 13. Triển khai V1 mở rộng và kiểm thử — 2026-10-10

Phê duyệt mới nhất cho phép triển khai theo phương án; phạm vi V1 kiểm kê/giám sát đã hoàn thành code và test local. Mốc thiết kế của mục11 được giữ làm lịch sử; checklist thực thi chi tiết là docs/hosting-inventory-v1-checklist.md. Các quyết định V2/V3, quyền giữ bản cuối ngoài host và bảo vệ dữ liệu nghiệp vụ không thay đổi.

Các module mới: scripts/hosting-inventory-{store,sources,core,run}.mjs; src/server/maintenance/hostingInventoryRouter.ts; src/shared/hostingInventory.ts; src/components/admin/maintenance/HostingInventory.tsx. Tích hợp router super_admin/overview và các tab hiện hành, cùng worker flat scripts để pipeline cPanel chép đầy đủ. Tree/evidence/backup/delta phân trang50 mục; snapshot/queue/metadata có budget và retention riêng. Root/CLI do server cấu hình; không nhận path hoặc lệnh shell từ UI.

Kiểm thử: maintenance22, hosting19, phase2 316, Listening142, Speaking65 đều đạt; fixture100.123 file, source preservation, giới hạn disk/free space/memory/time, pause/resume/interruption, lỗi quyền/source/schema, link/hardlink/BigInt identity, changed file/scope, unknown SQLite index và duplicate executor. Browser giữ nguyên preview/hold/SQLite backup, thêm executor/tree/evidence/membership/registry trên desktop/mobile. Build/native startup/auth smoke và124 hash/bytes manifest đạt.

Đã mở lại localhost3000 để kiểm thử: File & Dọn dẹp → Thư mục hosting → Quét toàn tài khoản. Root local là workspace; đây không phải kết quả hosting. Không chạy scan thực trên host, không đổi env host/cron, không dọn dữ liệu người dùng, không commit/push.

Mục chưa nghiệm thu: account root/quyền/executor/quota/budget/tải I/O trên host thật. API/CloudLinux/provider/process/cron phụ thuộc khả năng hosting; source không đủ phải hiện unavailable/partial/unconfigured, không suy ra rác. Attribution verified chỉ được dùng khi có operation gắn file; dữ liệu nguồn hiện thiếu nên chỉ trả unknown/correlation. Inventory backup không chứng minh restore hoặc cấp xóa folder. V2 remote/multi-file cleanup và V3 không được kích hoạt.


### 14. Phân loại khả năng dọn và quan hệ dự án — 2026-10-10

Yêu cầu tiếp theo: kết quả không chỉ có Xem bằng chứng hoặc Giữ 30 ngày; phải nêu ai dùng file, dọn được đến đâu, lý do bảo vệ và điều kiện còn thiếu. Đây là cải tiến quyết định/UI của V1 và kết nối thao tác ứng dụng đã được duyệt. Giữ nguyên các phê duyệt trước; không mặc nhiên hoàn thành hoặc bật V2/V3.

| Kết luận dọn | Điều kiện / thao tác |
|---|---|
| Có thể dọn có xác nhận | File thường khớp chính xác đường dẫn, bytes và modifiedAt với catalog ứng dụng mới dưới 24h; Speaking/temp/asset phải eligible, backup SQLite phải có bằng chứng local của actor và không ghim. Mở đúng file trong luồng cũ; backend vẫn kiểm tra lại và yêu cầu xác nhận. |
| Cần xem xét | Dấu hiệu cache/backup, media nghi ngờ mồ côi hoặc file thuộc app chưa có kết luận riêng. Nêu nguồn/kiểm tra còn thiếu; chưa cấp xóa. |
| Được bảo vệ / đang dùng | DB/WAL/SHM/env, runtime/dependency/recovery, repository, dịch vụ hosting, dự án khác, vùng dùng chung, tham chiếu đang dùng hoặc hold/pin/job. |
| Chưa đủ xác minh | Chưa xác định chủ sở hữu, báo cáo/nguồn cũ, scope đổi, lỗi quyền/file thay đổi. Cần cập nhật nguồn/quét lại. |

Mỗi dòng hosting có hai phần độc lập: Dự án/dịch vụ liên quan và Khả năng dọn. Phân loại chủ sở hữu gồm ứng dụng này, domain/dự án khác, runtime/dependency, dịch vụ hosting, vùng dùng chung và chưa xác định. Dùng root cấu hình cùng nguồn document_root/application_root/Passenger/Node Selector/symlink đã quan sát và còn mới; tên giống domain không đủ nhận diện. Vị trí trong root app không chứng minh từng file được dùng. Nếu biết quan hệ runtime thì hiển thị chủ sở hữu/domain; thiếu nguồn thì giữ bảo vệ và nói chưa đủ gán ứng dụng.

Module scripts/hosting-inventory-assessment.mjs tính kết luận trên trang đọc cache, không thêm cột vào inventory.sqlite. Đọc quan hệ tối đa1000/trang, trả50 mục; nguồn vượt giới hạn được báo thiếu khi cần. GET không đọc toàn cây, không tự xác minh nội dung/source/API call và không tự quét. Không thêm endpoint xóa hosting.

Router liên kết catalog cũ theo actor và fingerprint, chỉ cấp điều hướng Dọn file này hoặc Tải / xác minh backup. Scope cũ, báo cáo quá24h, đối tượng có issue, khác bytes/mtime, dự án khác hay protected không được nâng thành ready. Trước thao tác, API cũ recheck live state/path/reference/job/hold và typed approval. Ảnh/audio/backup streaming và quyền giữ bản cuối ngoài host vẫn giữ nguyên.

Hosting verifier version là hosting-inventory-v1.2. Sau cập nhật, hủy job cũ nếu paused/interrupted rồi Quét file ứng dụng và Quét toàn tài khoản lại; hủy chỉ đổi trạng thái job. Resume scope cũ bị chặn. Chuyển nanoseconds sang milliseconds không làm tròn mất1ms; vẫn đối chiếu chính xác, không nới tolerance.

Checklist bổ sung:
- [x] Hai lớp kết luận/quan hệ và lý do/điều kiện trên tree, evidence và backup.
- [x] Phân biệt dự án khác/runtime/dịch vụ/mixed/unknown; không quyết định theo tên riêng.
- [x] Mở đúng catalog entry cho thao tác đã được duyệt; giữ guards và typed confirmation.
- [x] File ứng dụng có bộ lọc Khả năng dọn, badge, Điều kiện dọn; giữ9 trạng thái cũ.
- [x] Regression stale/scope/changed/held/protected và xử lý job cũ sau nâng phiên bản.
- [x] Hosting22/22, maintenance22/22, focused3/3, typecheck/build và compiled auth smoke đạt.
- [x] Browser desktop/mobile: phân loại cache/runtime, temp ready mở đúng file, typed confirmation và cancel; preview/audio/backup cũ vẫn đạt.
- [x] Rà diff riêng,124 manifest hash/bytes,5 flat worker trong pipeline; cập nhật CODEMAP/runbook.
- [x] Restart localhost3000 với Node22/native SQLite, tắt seed; GET không tự quét, auth401. Dừng QA3177.
- [ ] Pilot trên host thật và nguồn quan hệ domain/runtime/API thực tế. Giữ nguyên gate V2/V3.

Bằng chứng bổ sung: .data/maintenance-qa/cleanup-assessment-{tests,maintenance,focused,lint,build,bundle,browser,legacy-browser}.log; cleanup-assessment-{artifact,localhost}.json; hosting-browser-report.json và screenshots. Fixture100.123 file/100.140 observed, index64.036.864 bytes trong128MiB. Không dọn file hoặc dữ liệu người dùng, không deploy host/commit/push.
