# Release B cPanel deployment

Release B được triển khai thành hai lượt:

1. API-first: schema/projector/CLI/API có mặt nhưng History API và UI vẫn tắt.
2. UI-on: chỉ thực hiện sau khi schema, backfill, reconcile và API smoke đều pass.

Không chạy retention execute trong lần deploy đầu. Không copy riêng
`app.sqlite` khi Passenger còn ghi trong WAL mode.

## Trạng thái artifact trước lượt 1

Artifact hiện tại được build với:

```env
VITE_LEARNING_HISTORY_ENABLED=false
```

Vì vậy `dist/server.cjs` có mã Release B nhưng `dist/client` chưa hiện entry
`Lịch sử học tập`. `.cpanel.yml` chỉ copy artifact; host không chạy Vite build.

## 1. Chuẩn bị trước maintenance

Trong cPanel Node.js Application Environment, thêm mới hoặc sửa giá trị hiện có;
không tạo hai biến trùng tên:

```env
LEARNING_HISTORY_ENABLED=false
RECENT_ACTIVITY_DAYS=7
ATTEMPT_DETAIL_RETENTION_DAYS=30
GUEST_PUBLIC_ID_SECRET=PASTE_64_HEX_OUTPUT_HERE
```

Sinh secret ở terminal nếu host có OpenSSL:

```bash
openssl rand -hex 32
```

Chỉ chép output vào biến môi trường cPanel. Không đưa secret vào Git, command
history, URL, log hoặc ảnh chụp. Giữ nguyên các biến Release A đã xác minh:
`STORAGE_MODE=sqlite`, `SQLITE_DRIVER=better-sqlite3`, absolute
`SQLITE_DB_PATH`, deny create/import, WAL settings và `SEED_DATA_ENABLED=false`.
Giữ `GUEST_PUBLIC_ID_SECRET` ổn định trong kho secret/config backup của host;
xoay giá trị này sẽ làm toàn bộ pseudonymous public student key thay đổi.
Production startup chủ động fail nếu bật `LEARNING_HISTORY_ENABLED=true` mà
thiếu secret này.

`DRAFT_RETENTION_DAYS=3` hiện là cấu hình dành trước cho workflow draft/checkpoint
tương lai; Release B hiện tại chưa đọc biến này và retention CLI không xóa draft.

Tạo backup online mới ngay trước Release B trong khi bản Release A ổn định đang
chạy:

```bash
cd /home/qzmivzbj/app.msdieu.com
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
npm run db:backup -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --output-dir /home/qzmivzbj/app-data/vhomework/release-b-backups
ls -lht /home/qzmivzbj/app-data/vhomework/release-b-backups/app-*.sqlite
```

Backup phải báo `quickCheck=ok`. JSON output cố ý rút gọn đường dẫn; dùng kết quả
`ls` để ghi lại absolute path đầy đủ của file mới. Đây là backup pre-migration,
không thay thế backup pre-backfill ở bước 3.

## 2. Lượt 1 — deploy API-first

1. Dừng Web Application trong cPanel và xác nhận không còn Passenger worker của
   ứng dụng:

```bash
pgrep -afu "$USER" 'lsnode:/home/qzmivzbj/app\.msdieu\.com/'
```

Không có output mới là trạng thái mong đợi. Nếu còn PID, chưa được deploy hoặc
chạy maintenance.

2. Deploy commit API-first qua cPanel Git Version Control.
3. Trong application root, xác nhận đúng runtime/dependency:

```bash
cd /home/qzmivzbj/app.msdieu.com
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
node -v
npm ls better-sqlite3
```

Kết quả mong đợi là Node `v22.16.0` và `better-sqlite3@10.1.0`. Chỉ chạy lại
`npm ci --omit=dev` nếu `package-lock.json`/dependency thay đổi hoặc
`node_modules` thiếu; khi đó dùng đúng Python 3.11/build-from-source theo
`docs/cpanel-better-sqlite3-preflight.md`.

4. Start Web Application một lần với `LEARNING_HISTORY_ENABLED=false`. Startup
   chạy migration additive trước khi listen.
5. Kiểm tra homepage HTTP 200 và diagnostics:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://app.msdieu.com/
npm run db:diagnostics -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite
```

Phải có `quickCheck=ok`, `journalMode=wal` và các bảng
`learning_attempts`, `attempt_details`, `learning_history_backfill_state`,
`pronunciation_attempts`. Khi backend flag còn tắt,
`GET /api/my-learning-history` phải trả `404` với code
`LEARNING_HISTORY_DISABLED`.

Nếu migration/startup/diagnostics lỗi, giữ backend/UI flag tắt, dừng app và xử
lý trước; không chạy backfill.

## 3. Backfill dưới maintenance lock

Dừng Web Application để không có source write mới trong lúc chụp/reconcile tập
dữ liệu. Kiểm tra lại ngay trước maintenance:

```bash
cd /home/qzmivzbj/app.msdieu.com
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
pgrep -afu "$USER" 'lsnode:/home/qzmivzbj/app\.msdieu\.com/'
```

Khi không còn worker, tạo backup thứ hai. Backup này bao gồm migration và mọi
write xảy ra trong lượt smoke, và là file phải truyền cho backfill:

```bash
npm run db:backup -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --output-dir /home/qzmivzbj/app-data/vhomework/release-b-backups
ls -lht /home/qzmivzbj/app-data/vhomework/release-b-backups/app-*.sqlite
```

Gán absolute path của đúng file vừa tạo; thay phần timestamp mẫu bằng tên thật,
không thêm `.sqlite` lần thứ hai:

```bash
export RELEASE_B_BACKFILL_BACKUP=/home/qzmivzbj/app-data/vhomework/release-b-backups/app-YYYY-MM-DDTHH-MM-SS-sssZ.sqlite
test -f "$RELEASE_B_BACKFILL_BACKUP"
```

Chỉ tiếp tục khi backup command exit `0`, JSON có `ok=true`,
`quickCheck=ok`, và `test -f` exit `0`. Sau đó chạy dry-run:

```bash
npm run db:backfill-learning-history -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --dry-run
```

Review `plannedInserts`, malformed/unlinked counts và mismatch. Chỉ execute khi
không có duplicate/deterministic mismatch:

```bash
npm run db:backfill-learning-history -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --verified-backup "$RELEASE_B_BACKFILL_BACKUP" \
  --execute
```

Nếu command bị gián đoạn, dùng lại cùng verified pre-backfill backup:

```bash
npm run db:backfill-learning-history -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --verified-backup "$RELEASE_B_BACKFILL_BACKUP" \
  --resume
```

Không chạy `--resume` sau một execute thành công chỉ để “chắc chắn”. Gate pass
khi command exit `0`, top-level `ok=true`, `backupQuickCheck=ok` và:

- `missingAfter=0`;
- `duplicateSourceGroups=0`;
- `deterministicIdMismatches=0`;
- `attemptNumberMismatches=0`;
- mọi `writes.*.idempotencyConflicts=0`;
- source mutation là `none`;
- `quickCheck=ok`.

Chạy diagnostics lại sau backfill và lưu toàn bộ JSON report. Vì
`sourceMutation=none` là declaration của CLI, đối chiếu thêm table counts
`game_results`, `grammar_attempts` và `leaderboard_events` giữa diagnostics
trước/sau khi toàn bộ worker đã dừng.

## 4. Bật backend API, UI vẫn tắt

Trong cPanel, đổi đúng biến hiện có:

```env
LEARNING_HISTORY_ENABLED=true
```

Restart Web Application. Kiểm tra:

- homepage HTTP 200;
- diagnostics vẫn `quickCheck=ok`, WAL và đúng basename `app.sqlite`;
- request History không credential trả lỗi auth có kiểm soát, không trả 500;
- một tài khoản học sinh hợp lệ list/detail đúng owner;
- guest mới có cả `X-Guest-Id` và `X-Guest-Access-Token` list được;
- guest legacy thiếu capability nhận `GUEST_HISTORY_RECOVERY_REQUIRED`;
- attempt của owner khác trả 404;
- Recent Activity, leaderboard, vocab/grammar result cũ không regression.

Giữ trạng thái API-only ít nhất một cửa sổ smoke/quan sát ngắn trước khi bật UI.

## 5. Lượt 2 — build và deploy UI

Trên máy phát hành, dùng Node 22. Chạy quality gate trước; gate này cố ý build
lại artifact UI-off. Sau đó build UI-on là lệnh cuối cùng:

```powershell
npm run test:phase2
$env:VITE_LEARNING_HISTORY_ENABLED='true'
npm run build
Remove-Item Env:VITE_LEARNING_HISTORY_ENABLED
```

Xác nhận `dist/client` có entry `Lịch sử học tập`, sau đó commit/push artifact UI
thành commit riêng. Deploy commit đó qua cPanel và restart Web Application.
Không cần thêm `VITE_LEARNING_HISTORY_ENABLED` vào môi trường Passenger vì giá
trị đã được đóng vào frontend lúc build.

Không chạy lại `npm run test:phase2` hoặc `npm run build` không có flag sau bước
trên vì nó sẽ ghi đè client về UI-off. Khi stage Git, phải gồm asset hash mới và
cả deletion của asset hash cũ; dùng `git add dist/client` thay vì chỉ add file
mới.

Smoke trên desktop/mobile:

- mở trực tiếp `/history`, back/forward hoạt động;
- loading/empty/error/retry;
- tab/filter/pagination 20/50;
- list không tràn ngang trên mobile;
- detail modal mở/đóng, Escape/focus;
- guest không capability nhận hướng dẫn recovery thay vì tự tạo identity mới.

## 6. Rollback Release B

Rollback nhanh:

1. Đặt `LEARNING_HISTORY_ENABLED=false` và restart.
2. Deploy lại artifact client có `VITE_LEARNING_HISTORY_ENABLED=false`.
3. Không drop bảng Release B, không xóa projection và không đổi SQLite driver.

Backend flag này tắt cả API lẫn projector. Source game/grammar vẫn tiếp tục được
ghi nên không mất kết quả gốc, nhưng projection sẽ thiếu các lượt phát sinh
trong thời gian rollback. Trước lần bật lại Release B, phải tạo fresh verified
backup, dừng/xác nhận zero worker, chạy backfill dry-run rồi execute/resume để
catch up và đạt toàn bộ reconcile gate ở bước 3.

Nếu cần restore database, dừng toàn bộ workers và làm theo
`docs/sqlite-backup-restore.md`. Restore là thao tác ghi đè source of truth nên
không được thực hiện chỉ vì UI/API có lỗi.

Retention chỉ được xem xét ở maintenance window riêng sau thời gian theo dõi.
Lần đầu chỉ chạy dry-run:

```bash
cd /home/qzmivzbj/app.msdieu.com
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
npm run maintenance:activity-prune -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --dry-run
```
