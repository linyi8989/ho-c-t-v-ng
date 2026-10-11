# Vận hành Dung lượng & Dọn dẹp trên cPanel

## Giao diện tinh giản hiện tại — 10/10/2026

- **Tổng quan** chỉ hiển thị: dung lượng/quota và hai khung thư mục ứng dụng/hosting. Mỗi dòng có tên, đường dẫn, chức năng và biểu đồ cột nhỏ bên phải. Hosting hiển thị thư mục cấp đầu (đã gồm con), so hai lượt quét đầy đủ giữ chi tiết; ứng dụng dùng tối đa14 mốc theo ngày có sẵn. Chưa đủ mốc/partial/khác phạm vi không kết luận giảm hoặc đã sạch.
- **File & Dọn dẹp** có một nút **Quét tất cả**, yêu cầu scanner ứng dụng và collector tài khoản. Hosting cần MAINTENANCE_INVENTORY_EXECUTOR=process và quyền đọc account root. Hai phần báo lỗi riêng; phần khả dụng vẫn chạy. Nếu collector dừng vì budget, cùng nút yêu cầu tiếp tục từ hàng chờ. Đợi lượt worker dừng hẳn trước khi bấm lại; giới hạn I/O/time cũ vẫn giữ.
- Bảng xử lý chỉ hiện bản thu cần xử lý và media nghi ngờ mồ côi/đang giữ. Các loại khác theo dõi ở biểu đồ. Giữ preview ảnh/audio, giữ/bỏ giữ, cách ly/xóa đúng điều kiện với xác nhận tên; không mở quyền xóa hosting.
- **Cài đặt tự động** thay tên Chính sách, giữ nguyên hai khung tạm48h và Speaking24h. Chỉ cấp phép cho cron đã cấu hình; không tự bật/đăng ký/chạy cron khi mở trang. Kết quả/điểm chấm được giữ.
- Bỏ các tab Backup, Nhật ký, Cảnh báo, Tác vụ nền, phạm vi hosting riêng và nút tải/cập nhật báo cáo. API/CLI cũ còn để tương thích; các mô tả lịch sử ở dưới không bổ sung lại nút vào giao diện mới.
- Không thêm biến môi trường/schema. Deploy đủ dist/server.cjs, dist/client/* và scripts/*.mjs rồi restart Passenger. Sau deploy thử Quét tất cả, đối chiếu cPanel và kiểm tra hai mốc trước khi đọc tăng/giảm. Local PASS không thay nghiệm thu quyền đọc/process/LVE trên host thật.

## Trạng thái
Module đã có code V1, V2a (backup local + dọn có duyệt) và engine V3 tắt mặc định, được kiểm thử trên fixture local. Không có cron production được đăng ký bởi task này. Không xóa dữ liệu thật, không push/deploy. Chỉ kích hoạt từng bước sau khi số liệu V1 được đối chiếu trên cPanel. Chuyển trực tiếp R2/Azure và email chưa được triển khai/kết nối; cần chốt dịch vụ, credential và kiểm chứng riêng.

## Vị trí và quyền
- Tab Dung lượng & Dọn dẹp + thẻ Tổng quan chỉ super admin.
- API /api/admin/maintenance/* dùng auth + role server. Download duy nhất dùng capability một lần, hạn 2 phút, được cấp sau auth.
- Database/WAL/SHM, users/lessons/classes/history/leaderboard không thuộc write scope.
- Metadata riêng: MAINTENANCE_STATE_DIR, mặc định maintenance cạnh database; private 0700/0600, audit 600 events/job 80/snapshot 120 ngày, file metadata <=12MiB.
- Nút Quét chạy background trong Node; GET chỉ trả report đã lưu. Scanner mặc định 60s/100000 file, loại symlink/hardlink khỏi thao tác.
- MAINTENANCE_ACCOUNT_ROOT là root tài khoản muốn giám sát. Chưa đủ quyền/quét chưa hết sẽ báo partial, không hiện zero cho vùng chưa đọc.

## Cấu hình server
SQLITE_DB_PATH/STORAGE_MODE/SQLITE_DRIVER giữ nguyên cấu hình production.
Các biến thêm được mô tả trong production-environment.example.env. MAINTENANCE_DEPLOY_ROOT phải trỏ app root đang phục vụ, MAINTENANCE_STATE_DIR ở persistent ngoài deploy.
Quota API cần MAINTENANCE_CPANEL_HOST (hostname, không URL), USER và TOKEN. Token ở server, không gửi frontend. Không cấu hình/không hỗ trợ thì báo unknown.
MAINTENANCE_CRON_DISCOVERY=true chỉ đọc crontab, không tạo/sửa cron. Lịch khác bằng chứng đã chạy; command được che để không lộ secret. Jobs dùng core này có audit; jobs cũ/provider chưa instrument được ghi chưa xác minh.

## Luồng backup local
1. Quét, mở Backup.
2. Tải bản có sẵn; stream, không tạo copy hoặc nén trên host.
3. Chọn lại file vừa tải trên máy. Worker hash theo khối 4MiB; server chỉ nhận SHA-256 và bytes.
4. Server quick_check + hash bản host, đối chiếu, tạo evidence gắn actor/fingerprint, hạn 24h. Backup có WAL không rỗng bị chặn: một file .sqlite lúc đó chưa đủ đại diện dữ liệu. Snapshot mới do helper tạo được chuẩn hóa journal_mode=DELETE trên chính bản sao để tải một file độc lập; không checkpoint/đổi journal của DB chính.
5. Xem trước xóa, nhập chính xác tên file. Server kiểm tra evidence, pin, nội dung/fingerprint lần nữa và audit intent trước unlink.
6. Cho phép xóa bản cuối cùng trên host sau xác minh. Không bắt buộc local host copy.
7. File local vẫn cần được người quản trị bảo quản. Checksum/quick_check không phải restore test. Backup DB không chứa media.
8. Nút tạo mới gọi helper Online Backup cũ, check size/page_count + 15% + reserve 256MiB. Linux shared host chưa xác minh account quota thì chặn tạo lớn; vẫn tải/xác minh/xóa backup có sẵn.
9. Giữ/ghim chặn xử lý. Download giữ lease đến kết thúc/abort; tác vụ khác bị chặn để tránh file đang tải bị xóa.

## Cron
CLI cần cấu hình riêng: env của Passenger không tự truyền cho cron.
Tạo file env private ngoài web root, chỉ chứa đúng biến cần dùng (STORAGE_MODE=sqlite, SQLITE_DRIVER=better-sqlite3, SQLITE_DB_PATH, directory maintenance/media/backup, account/deploy root và quota credential nếu cần). MAINTENANCE_ENV_FILE trỏ file đó. Không commit credential.

Ví dụ collector định kỳ, chạy bằng runtime Node 22 của hosting. Mỗi lần --scan quét filesystem tới giới hạn, rồi đọc quota/cron; chọn tần suất phù hợp shared host (khởi đầu 6 giờ/lần). Không coi đây là tác vụ quota nhẹ 15 phút:
MAINTENANCE_ENV_FILE=/home/qzmivzbj/app-data/vhomework/maintenance.env /opt/alt/alt-nodejs22/root/usr/bin/node /home/qzmivzbj/app.msdieu.com/scripts/maintenance-run.mjs --scan

Dry-run mặc định (liệt kê temp/speaking đủ điều kiện cùng policyEnabled, kể cả khi policy đang tắt; không xóa):
.../node .../scripts/maintenance-run.mjs --dry-run

Chỉ sau khi super admin kích hoạt đúng policy và kiểm tra dry-run:
.../node .../scripts/maintenance-run.mjs --execute

Cron thực tế cần tự đăng ký trong cPanel, xác nhận timezone/lần chạy. Không thêm cron trùng. App không chạy xóa trong startup/page load.
Automation chỉ temp nhập đề >48h và WAV hết hạn/24h có tham chiếu hợp lệ, không job pending/running, không held. Dọn tối đa 100 file/đợt, recheck policy từng file, dừng khi lỗi. Cron dừng hoặc job đang dùng có thể làm xóa vật lý trễ; dashboard báo blocked/quá hạn.
Backend Speaking giới hạn bản mới 24h; retry/audio/worker chặn file quá 24h kể cả legacy. Không tạo điểm giả khi job hết hạn.

## Media, asset và cách ly
- TTS/Listening đọc chung reference index với CLI cũ. JSON lỗi thì fail closed. Archive/version/attempt/sample audio vẫn được bảo vệ.
- Ảnh có row thư viện được bảo vệ; ảnh legacy chưa đủ dữ liệu không cấp xóa.
- Nút media nghi ngờ chỉ báo cáo. CLI media hiện có vẫn cần maintenance window/backup/review riêng; không chạy tự do từ web.
- Build tạo release-manifest.json đầy đủ assets/fonts/images/worker. cPanel lưu một manifest sau activation vào data/frontend-releases.
- Asset được bảo vệ nếu live index không được manifest phủ, legacy không xuất hiện trong manifest, current/rollback hoặc trong 365 ngày cache. Chỉ asset lịch sử đã biết, ngoài bản được giữ và quá hạn mới cho review/cách ly/xóa thủ công. Trước thao tác, SHA-256 phải khớp manifest; cùng tên nhưng nội dung đã đổi sẽ bị chặn. Không auto asset cleanup.
- Cách ly dùng rename + manifest, không giải phóng dung lượng. Restore không ghi đè file hiện có. Chưa hoàn tất manifest (moving) không cấp xử lý, cần kiểm tra riêng.
- Bytes file đã xóa khác quota thực giảm. Quét lại để xem quota, không tuyên bố đã thu hồi chỉ từ rename.

## Kiểm tra sau deploy
- Build chuẩn Node22, deploy server+client+scripts+manifest, restart Passenger.
- Kiểm tra artifact hash, worker tải đúng, super admin thấy tab; teacher/student API 403/401.
- Quét read-only; đối chiếu cPanel cùng phạm vi/thời điểm, giải thích vùng chưa đọc và quota differences.
- Thử tải/verify bằng backup fixture trên host trước destructive production.
- Xác nhận không có cron xóa cũ/trùng; theo dõi 1 vòng scan trước automation.
- History/leaderboard/Listening/Speaking smoke; không chỉnh record để có kết quả giả.
- Rollback code không xóa metadata hoặc DB; tắt policy và cron execute trước rollback.
- Khóa task.lock: không tự xóa nếu PID còn sống. Worker chết được phục hồi sau ít nhất 60s; file khóa lỗi cần điều tra.

## QA local
Node 22: scripts/start-maintenance-qa.mjs, sau đó scripts/maintenance-browser-smoke.mjs. scripts/maintenance-bundle-smoke.mjs kiểm tra bundle production/native SQLite, startup chặn local-auth flag, summary 401 và capability chưa cấp 404. Chỉ dùng fixture trong temp, loopback 3177. VITE bypass không bật trong build production. Kết thúc QA dừng đúng tiến trình fixture. Logs/screenshots: .data/maintenance-qa.

## Xem ảnh, nghe audio và giữ file
- File trong catalog ở root media/asset đã biết có nút Xem ảnh hoặc Nghe trước. Hỗ trợ PNG/JPEG/WebP/GIF tối đa16 MiB và WAV/MP3/OGG/M4A tối đa32 MiB; trình duyệt vẫn cần hỗ trợ codec. SVG/HTML, database, backup và đường dẫn tùy ý không được mở qua endpoint này.
- POST /api/admin/maintenance/files/:id/preview yêu cầu xác thực super admin; backend kiểm tra lại root/path/stat, symlink/hardlink, chữ ký định dạng và giữ lease khi stream. File đổi sau lần quét phải quét lại. Preview có audit, không xóa/di chuyển file hay đổi dữ liệu học tập.
- Audio không autoplay; đóng hoặc Esc sẽ dừng phát, hủy request và giải phóng blob URL. Modal có loading/error và trả focus về nút mở.
- Giữ 30 ngày chỉ thêm bảo vệ trong metadata, file vẫn tại chỗ. Trạng thái/Ngày giữ đến cập nhật ngay; media đang giữ vẫn nằm trong bảng xử lý để có thể Bỏ giữ. Bỏ giữ/hết hạn không tự xóa ngay: vẫn cần điều kiện dọn và xác nhận, hoặc policy+cron đã cấp phép. Speaking không được kéo dài quá24h.
- Media nghi ngờ chỉ có thao tác giữ và preview vì chưa đủ chứng minh an toàn để xóa trên web. Điều kiện riêng của file nằm trong cột Khả năng dọn / trạng thái.

## V1 mở rộng: kiểm kê toàn tài khoản hosting — 10/10/2026

Phạm vi mới là kiểm kê, không mở quyền xóa thư mục ngoài dự án. Trong File & Dọn dẹp bấm Quét tất cả để yêu cầu cả hai scanner; hosting hiển thị ở Tổng quan và không có thao tác dọn. Engine backup/catalog cũ vẫn giữ API theo quyền đã duyệt, không còn tab riêng. V2 tải/xóa bộ nhiều file và remote transfer chưa được kích hoạt.

Cấu hình root trên host từ resolved config thực tế, đối chiếu ảnh: account /home/qzmivzbj; deploy /home/qzmivzbj/app.msdieu.com; data /home/qzmivzbj/app-data/vhomework. Ảnh không đủ chứng minh host đang dùng đúng các đường dẫn này. Không trỏ account root vào /, ổ đĩa local hoặc thư mục tài khoản khác.

Collector ghi inventory.sqlite riêng trong MAINTENANCE_STATE_DIR. Không thêm bảng vào DB nghiệp vụ hoặc nhét toàn bộ cây vào state.json. Default index+WAL budget128 MiB, free reserve32 MiB, RSS soft limit256 MiB, batch100 mục/250ms, nghỉ50ms, cửa sổ60s. Có thể pause vì time/memory/disk; lý do hiện trong UI. Hard CPU/I/O quota phụ thuộc host; các giới hạn này không phải LVE quota. Ngân sách phải đối chiếu số file và khoảng trống thật trước pilot, đặc biệt host gần đầy. Mỗi lần mới giữ một baseline đầy đủ; khi hoàn tất giữ current + baseline, tối đa120 mốc tổng hợp, audit500. Chỉ metadata inventory bị thu gọn; không unlink file nguồn. Các trang tree/evidence/delta/backup tối đa50 mục.

Chỉ inventory.sqlite và sidecar đang ghi được loại khỏi tổng file nguồn; dung lượng chúng hiện riêng. State.json và khu cách ly vẫn được kiểm kê. Mtime thư mục chứa index có thể đổi do writer nên không coi riêng thay đổi đó là mất coverage; inode/biên giới và mọi file con vẫn được kiểm tra. Logical bytes là tổng file theo đường dẫn; unique bytes không cộng đôi inode; allocated dùng blocks Linux và unavailable trên Windows; quota cPanel là phép đo khác. Không cộng cha và con thành tổng lần nữa. Symlink chỉ lập cạnh, không đi theo; hardlink và dependency recovery được bảo vệ. Main DB/WAL/SHM/env/runtime và vùng dịch vụ không có quyền dọn mới.

Executor mặc định chưa cấu hình. Sau kiểm tra Passenger cho phép spawn Node22/process, đặt MAINTENANCE_INVENTORY_EXECUTOR=process trong environment server và restart. Worker chỉ chạy scripts/hosting-inventory-run.mjs bằng process.execPath/fixed argv, không shell từ UI. Thư mục làm việc của ứng dụng phải là deploy root có scripts/ đã được pipeline copy. CLI được gọi có chủ đích bằng Node22:

```sh
cd /home/qzmivzbj/app.msdieu.com
MAINTENANCE_ENV_FILE=/home/qzmivzbj/app-data/vhomework/maintenance.env /opt/alt/alt-nodejs22/root/usr/bin/node scripts/hosting-inventory-run.mjs --start
# UUID lấy từ báo cáo; tiếp tục job paused/interrupted/failed, không tự chạy ở GET/startup:
MAINTENANCE_ENV_FILE=/home/qzmivzbj/app-data/vhomework/maintenance.env /opt/alt/alt-nodejs22/root/usr/bin/node scripts/hosting-inventory-run.mjs --scan-id UUID
```

Không tự đăng ký cron. Tạm dừng/hủy yêu cầu executor dừng tại ranh giới batch; tiếp tục đọc lại thư mục chưa xong và upsert path, không tin thứ tự readdir. File đã ghi nhận không bị đếm hai lần; file đổi khi đọc lại được đánh dấu partial. Không khẳng định snapshot nguyên tử; reverify chỉ kiểm tra fingerprint/nguồn của đối tượng, không cấp approval xóa.

Nguồn cấu hình server chỉ dùng allowlist path, không đọc nội dung .env/key/mail. Passenger chỉ đọc trường allowlist và import tĩnh app.js; không lưu SetEnv. Domain dùng HTTPS cPanel DomainInfo/domains_data với timeout/schema check; thiếu token/quyền báo unconfigured/permission_denied. CloudLinux Node Selector opt-in dùng /usr/bin/cloudlinux-selector get với fixed argv; schema khác báo failed/unsupported, không chạy mutation. Cron opt-in /usr/bin/crontab -l, ẩn lệnh thô; process opt-in /proc cùng UID chỉ PID/cwd, không argv/env. Git/deploy chỉ metadata ở deploy root được tin cậy; vùng provider và recovery chưa có API đầy đủ nên coverage dependency còn partial. Không coi nguồn thiếu là thư mục không dùng. Bằng chứng đọc được quá24h/khác phiên bản thành stale; scope thay đổi yêu cầu quét mới.

Registry phân biệt collector có heartbeat, Speaking là trạng thái aggregate từ speaking_jobs, cron chỉ lịch được quan sát. Không báo worker Speaking đã chạy thành công chỉ từ registry. Nguồn tạo file unknown nếu chưa có operation gắn file; cùng đường dẫn/thời gian writer app chỉ là correlation. Deltas chỉ được tạo khi hai mốc filesystem đầy đủ cùng scope; thiếu quyền/partial không tạo kết luận file mất. Tăng trưởng1/7/30 ngày cần có mốc đủ tuổi; chưa có thì hiện chưa đủ mốc.

Kiểm tra trước host rollout: quyền super admin401/403; scripts mới có trên deploy; root/index budget/free space; API domain/Selector/proc/cron thật; đối chiếu cây/quota theo thời điểm; thử pause/resume; đo ảnh hưởng I/O; xác nhận DB/bảng vàng/media/env/runtime giữ nguyên. Giữ mục pilot trong checklist chưa đạt đến khi có bằng chứng host. Không bật V2/V3 từ việc deploy V1.

Rollback: tắt MAINTENANCE_INVENTORY_EXECUTOR, yêu cầu hủy/tạm dừng đúng job trước khi rollback code, giữ nguyên main DB/media/state cũ và metadata inventory. Không xóa thủ công chỉ mục đang có executor ghi. Không downgrade bằng cách rewrite DB nghiệp vụ. Nếu cần loại bỏ metadata inventory sau khi worker dừng, xác minh đúng inventory.sqlite và sidecar riêng; thao tác này không phục hồi file nguồn đã xóa bởi công cụ khác.

QA: test:hosting-inventory, test:maintenance; start-maintenance-qa.mjs + hosting-inventory-browser-smoke.mjs + maintenance-browser-smoke.mjs trên fixture3177; maintenance-bundle-smoke.mjs và test:startup cho compiled production. Báo cáo/log ở .data/maintenance-qa; checklist triển khai trong docs/hosting-inventory-v1-checklist.md.

## Đọc kết luận dọn và cập nhật V1.2 — 10/10/2026

Deploy bản build mới cùng5 file hosting-inventory-{store,sources,assessment,core,run}.mjs rồi restart ứng dụng. Pipeline scripts/*.mjs đã bao gồm assessment mới. Không đổi root, DB nghiệp vụ hay cron để có phân loại mới.

Sau reload, bấm Quét tất cả. Job hosting đã dừng cùng scope được yêu cầu tiếp tục; job đã dừng khác scope được hủy metadata kiểm kê cũ rồi tạo lượt mới, không xóa file nguồn. Quyền dọn ứng dụng vẫn kiểm tra path/bytes/modifiedAt và tuổi báo cáo. Thay file sau quét vẫn bị API cũ chặn và yêu cầu quét lại.

Engine/API hosting vẫn có phân loại dự án/dịch vụ và điều kiện dọn để tương thích; giao diện hiện tại chỉ dùng metadata cho biểu đồ, không còn cột/nút xử lý hosting. Bảng ứng dụng lọc theo Bản thu Speaking hoặc Media nghi ngờ mồ côi, giữ điều kiện riêng và preview ảnh/audio.

Local không có nguồn domain/CloudLinux đầy đủ của tài khoản hosting. Tên public_html hoặc domain không chứng minh thuộc dự án khác; cần nguồn cPanel document root/application root. Nodevenv/dependency/recovery/Git và dịch vụ cPanel được bảo vệ; chỉ hiện ứng dụng dùng runtime khi có quan hệ quan sát được. Thư mục dùng chung phải xét từng mục con.

Không dùng nhãn Cần xem xét như phê duyệt xóa. Media nghi ngờ cần kiểm tra riêng bao phủ bản nháp/phiên bản/bài học/kết quả/job. Thư mục backup nhiều file ngoài catalog chưa có tải/xóa cả bộ; V2 verifier/approval vẫn là phần cần triển khai và nghiệm thu. Thao tác Giữ30ngày không chuyển/xóa file và hết hạn không tự cấp xóa.

Bằng chứng local/checklist: docs/hosting-inventory-v1-checklist.md (phần bổ sung); .data/maintenance-qa/cleanup-assessment-*. Không đánh dấu host pilot đạt từ local.


## API xuất báo cáo còn giữ để tương thích — bản sửa 10/10/2026

Các nút cập nhật/tải báo cáo đã bỏ khỏi giao diện theo yêu cầu tinh giản. API báo cáo ứng dụng vẫn xuất catalog đã lưu kèm root map; API hosting vẫn xuất mọi entry đã lưu của lần quét hiện tại qua mọi tầng/trang. Đọc báo cáo không khởi chạy quét.

Hosting JSON có scan/coverage/sources/tasks, entries với chủ sở hữu và điều kiện dọn, evidence, backupSets, deltas, applicationReport theo actor, largestTopLevel và cleanupSummary. exportComplete=true chỉ xác nhận file JSON xuất xong; filesystemComplete=false hoặc scopeChanged=true vẫn là báo cáo thiếu/cũ. Tổng4 category chỉ cộng file, không cộng lại thư mục cha/con. BackupSet vẫn chưa có bằng chứng format/restore/off-host và không được cấp xóa chỉ vì xuất hiện trong báo cáo.

GET /api/admin/maintenance/inventory/scans/:id/report yêu cầu super_admin. Chỉ đọc chỉ mục cached theo snapshot,100 mục/batch, giới hạn60s và256 MiB, hủy khi client ngắt; không ZIP, backup mới hay file báo cáo tạm trên host. Mốc không còn chi tiết trả410, chưa quét404; scan partial vẫn xuất và ghi rõ giới hạn. Báo cáo không chứa nội dung env/mail/binary/raw credential.

Không thêm biến môi trường. Deploy đủ dist/server.cjs, dist/client/* và scripts/*.mjs (có hosting-inventory-report.mjs), restart Passenger, tải lại trang. Kiểm tra giao diện có đúng3 tab và một nút Quét tất cả; nếu còn các nút cũ, đối chiếu artifact đang chạy. Khi nghiệm thu API xuất JSON trên host thật, kiểm tra exportComplete, scan.id, entries/included, coverage và nguồn bị thiếu. Local/browser pass không thay kiểm tra proxy/thời gian/LVE thực tế.

Giao diện hiện tại chỉ cung cấp xử lý bản thu đủ điều kiện và media nghi ngờ; policy temp vẫn giữ. API cleanup/backup cũ còn kiểm tra quyền và bằng chứng như trước nhưng không được mở thêm từ dashboard. Cache tài khoản, staging và backup nhiều file ngoài catalog chưa có thao tác dọn. Không có ready không chứng minh host không có rác. File protected có thể là DB/runtime/domain/service; ứng viên review cần verifier theo loại. Giữ30 ngày không di chuyển/xóa và cách ly chưa giảm dung lượng.

Ưu tiên đối chiếu từ ảnh cPanel trước đây (không coi là số liệu hiện tại):

| Vùng | Dung lượng ảnh cũ | Việc cần xác minh trước dọn |
|---|---:|---|
| app-data |5.194,89 MB|Mở từng bộ backup/media/database; app.sqlite đang chạy phải được bảo vệ. Backup CLI dùng online snapshot SQLite, mỗi lần thêm một bản đầy đủ; chưa xác minh host đang chạy lịch nào.|
| .npm |1.708,24 MB|Đối chiếu cache theo runtime npm của tài khoản; cần cơ chế cache riêng, không xóa nodevenv/node_modules.|
| node_modules-app-backup-20261007-223115 |530,56 MB|Recovery dependency; xác minh liên kết/runtime/deploy/rollback, không cho xóa theo tên backup.|
| deploy-staging |458,43 MB|Đối chiếu release active/rollback/writer/deploy đang chạy trước đưa vào policy.|
| nodevenv |938,04 MB|Runtime được bảo vệ; không coi là rác.|

Ảnh app.sqlite801,88 MB không chứng minh toàn phần còn lại của app-data là backup. Phải dùng JSON mới để xác định mức chiếm chỗ và chu kỳ tăng. Không thêm cron/tạo backup mới trên host gần đầy chỉ để thử dọn. V2 BackupSet/cache/staging và V3 giữ gate đã duyệt.
