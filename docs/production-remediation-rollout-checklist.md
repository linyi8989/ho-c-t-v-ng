# Production remediation rollout checklist

Ngày lập: 2026-09-25

Trạng thái source: **đã sửa và đã vượt gate local/CI bằng Node 22**.
Trạng thái production: **chưa deploy, chưa backfill, chưa restart và chưa ghi database production**.

## 1. Tiêu chí Go / No-Go

Chỉ Go khi tất cả điều kiện sau đều đạt:

- [ ] Commit/release cần triển khai đã được cố định; không trộn thay đổi ngoài phạm vi remediation.
- [ ] Runtime đích là Node 22.x và native ABI của `better-sqlite3` khớp runtime.
- [ ] `npm ci` hoàn tất từ `package-lock.json`; `npm audit --omit=dev` trả `0 vulnerabilities`.
- [ ] `npm run test:phase3` trả mã 0.
- [ ] `npm run build` và `npm run test:startup` trả mã 0.
- [ ] Browser smoke desktop 1440 px/mobile 390 px trả mã 0.
- [ ] Có người chịu trách nhiệm quyết định Go/rollback và cửa sổ theo dõi tối thiểu 30 phút.
- [ ] Có backup SQLite mới, đã chạy `quick_check`, nằm ngoài thư mục deploy.
- [ ] Đã xoay vòng mọi credential từng xuất hiện trong file `.env` ở máy phát triển hoặc log/chụp màn hình; `.env` không được commit/copy vào artifact.

No-Go ngay nếu có một trong các dấu hiệu: backup không xác minh được, `quick_check` khác `ok`, source count thay đổi bất thường, Node không phải 22.x, audit còn High/Critical, build/test thất bại, hoặc không có quyền xem log và rollback.

## 2. Trước khi thay đổi production

### 2.1. Xác minh artifact và runtime

- [ ] Ghi lại commit SHA, thời gian bắt đầu, người vận hành và phiên bản đang chạy.
- [ ] Chạy `node --version`; kết quả phải là `v22.x`.
- [ ] Chạy `npm ci` trên môi trường build sạch.
- [ ] Chạy `npm audit --omit=dev --audit-level=moderate`; yêu cầu `found 0 vulnerabilities`.
- [ ] Chạy `npm run test:phase3`.
- [ ] Chạy `npm run build`.
- [ ] Chạy `npm run test:startup`.
- [ ] Chạy `npm run test:css-browser` với server QA dùng bản sao database, không dùng database production.
- [ ] Xác minh artifact có `dist/server.cjs`, `dist/server.cjs.map`, `dist/client/index.html` và bundle hash dưới `dist/client/assets/`.
- [ ] Xác minh `.env`, database, WAL/SHM, backup, log và media riêng tư không nằm trong artifact.

Kết quả mong đợi tại source hiện tại:

- TypeScript/lint: pass.
- `test:phase3`: 513/513 node tests pass; startup và history CLI pass.
- Production build: pass.
- Browser smoke: pass ở 1440 px và 390 px.
- Dependency audit production: 0 vulnerability.

### 2.2. Health check chỉ đọc

Đặt `<APP_DB_PATH>` và `<BACKUP_DIR>` thành đường dẫn production đã được xác minh; không dùng đường dẫn tương đối.

- [ ] `node scripts/sqlite-diagnostics.mjs --db <APP_DB_PATH>` trả `ok: true`, `quickCheck: "ok"` và `journalMode: "wal"`.
- [ ] Ghi lại kích thước database/WAL và row count của các bảng nguồn.
- [ ] Kiểm tra dung lượng đĩa đủ cho ít nhất hai bản database và WAL hiện tại.
- [ ] `node scripts/sqlite-backup.mjs --db <APP_DB_PATH> --output-dir <BACKUP_DIR>` trả `quickCheck: "ok"`.
- [ ] Xác nhận file backup tồn tại, khác file database đang chạy và chỉ tài khoản vận hành đọc được.
- [ ] Ghi baseline 15 phút: request count, 4xx/5xx, p50/p95/p99, RSS/CPU, SQLite busy/locked, dung lượng response và slow API log.

## 3. Backfill leaderboard an toàn

Backfill là additive nhưng có ghi `leaderboard_events` và readiness marker. Thực hiện trong cửa sổ ít traffic hoặc tạm quiesce luồng ghi; không restart giữa chừng.

### 3.1. Dry-run

- [ ] Chọn một mốc `<AS_OF_ISO>` cố định theo UTC và dùng cùng mốc cho dry-run/execute.
- [ ] Chạy:

```text
node scripts/db-backfill-hot-read-models.mjs --db <APP_DB_PATH> --target leaderboard --as-of <AS_OF_ISO>
```

- [ ] Kết quả có `mode: "dry-run"`, `target: "leaderboard"`, `quickCheck: "ok"`, `sourceMutation: "none"`.
- [ ] `plannedGuestProfiles` phải bằng 0; ghi lại `plannedLeaderboardEvents`.
- [ ] Nếu dry-run lỗi hoặc số lượng bất thường: No-Go, không dùng `--execute`.

### 3.2. Execute

- [ ] Xác nhận luồng ghi đã quiesce hoặc cửa sổ không có ghi mới.
- [ ] Chạy:

```text
node scripts/db-backfill-hot-read-models.mjs --db <APP_DB_PATH> --target leaderboard --as-of <AS_OF_ISO> --execute --backup-dir <BACKUP_DIR>
```

- [ ] Kết quả có `ok: true`, `backupQuickCheck: "ok"`, `quickCheck: "ok"`.
- [ ] `leaderboardEvents.missingAfter` bằng 0.
- [ ] `sourceCounts.unchanged` bằng `true`.
- [ ] `readModelReady` bằng `true` và `sourceMutation` bằng `none`.
- [ ] Chạy lại dry-run cùng `<AS_OF_ISO>`; `plannedLeaderboardEvents` phải bằng 0.
- [ ] Chạy lại diagnostics; `quickCheck` vẫn `ok`.
- [ ] Mở lại luồng ghi nếu đã quiesce.

Nếu execute thất bại trước readiness marker, giữ database, điều tra và chạy lại idempotent sau khi đã xác định nguyên nhân. Không phục hồi toàn database chỉ để xóa các row additive nếu production đã nhận dữ liệu mới.

## 4. Deploy ứng dụng

- [ ] Xác minh dependency production đã được cài từ lockfile mới trước restart; chỉ copy `package-lock.json` là chưa đủ để vá package đang chạy.
- [ ] Chạy pipeline `.cpanel.yml` từ đúng commit.
- [ ] Xác nhận bundle hash được copy trước index.
- [ ] Xác nhận các file `.next` có kích thước lớn hơn 0 trước activation.
- [ ] Xác nhận snapshot rollback `.previous` đã được tạo cho server, root/dist index và `.htaccess`.
- [ ] Xác nhận pipeline chỉ touch `tmp/restart.txt` một lần và root `index.html` được activation cuối cùng.
- [ ] Không xóa bundle hash cũ trong cửa sổ deploy; dọn asset cũ là maintenance riêng sau thời gian cache tối đa.

## 5. Smoke test ngay sau deploy

### 5.1. Startup, API, route và cache

- [ ] Process lên một lần, không crash-loop; log có storage ready, WAL và không có lỗi startup.
- [ ] `GET /api/public/leaderboard-results` trả 410 với code `LEADERBOARD_RAW_RETIRED`, không đọc raw storage.
- [ ] `GET /api/leaderboard-results` khi đã đăng nhập cũng trả 410.
- [ ] `GET /api/public/leaderboard-summary?period=week&limit=8` trả 200, tối đa 8 entries, payload dưới 20 KB.
- [ ] Public summary chỉ có `rank`, `studentName`, `completedLessons`, `averageAccuracy`, `studyDays`, `honorScore`, `badges`; không có id, class, token, email hay metadata hoạt động.
- [ ] Gọi lặp 5 request song song vào public summary: tất cả response hợp lệ, không 5xx; cold request được single-flight và warm request dùng cache.
- [ ] Warm latency p95 dưới 500 ms; cold latency dưới 1.500 ms trong điều kiện production bình thường.
- [ ] API không tồn tại trả JSON 404 và `Cache-Control: no-store`.
- [ ] Asset không tồn tại trả 404 text, không phải SPA HTML.
- [ ] Route browser không tồn tại trả 404; `/`, `/history`, `/login` và route học hợp lệ trả app shell.
- [ ] `index.html` có `Cache-Control: no-cache`.
- [ ] Bundle dưới `/assets/` có `Cache-Control: public, max-age=31536000, immutable`; ảnh tên cố định ngoài `/assets/` không bị immutable một năm.
- [ ] Response text/JSON/CSS/JS đủ lớn được compression tại edge/web server.
- [ ] Security headers có `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP baseline và HSTS trên HTTPS.

### 5.2. Auth/role/capability matrix

- [ ] Guest gọi public summary: 200.
- [ ] Guest gọi admin summary: 401.
- [ ] Student gọi admin summary: 403.
- [ ] Teacher gọi admin summary: 200 và chỉ thấy scope mình sở hữu.
- [ ] Super admin gọi admin summary: 200 theo scope toàn hệ thống được phép.
- [ ] Learning summary của assignment/private set thiếu hoặc sai `X-Vocab-Share-Token`: 403.
- [ ] Learning summary với capability hợp lệ: 200, chỉ đúng class/set và vẫn dùng tên ẩn danh.
- [ ] Thử token của assignment A với set/class B: bị từ chối hoặc không trả dữ liệu chéo scope.

### 5.3. UI và workflow chính

- [ ] Home desktop/mobile tải bình thường; leaderboard không tải raw 23 MB và hiển thị trạng thái lỗi có kiểm soát nếu API tạm unavailable.
- [ ] Student learning desktop/mobile mở/đóng Bảng vàng, retry và capability scope hoạt động.
- [ ] Admin leaderboard lọc period/category/class/set và phân trang; không tải toàn bộ lịch sử vào browser.
- [ ] Vocabulary/Grammar CTA có tương phản đọc được; keyboard focus nhìn thấy.
- [ ] Không có horizontal overflow ở 1440 px và 390 px trên Home/Admin/Student.
- [ ] Broken route hiển thị 404 rõ ràng, không render Home giả.
- [ ] Một workflow vocabulary, grammar, listening và history quan trọng được chạy end-to-end bằng tài khoản test; không dùng/xóa dữ liệu thật của học viên.

## 6. Theo dõi sau deploy

Trong 30 phút đầu và kiểm lại sau 24 giờ:

- [ ] Không có Critical/High mới; không có chuỗi 5xx hoặc process restart bất thường.
- [ ] So sánh 4xx/5xx, p95/p99, RSS/CPU và SQLite busy/locked với baseline.
- [ ] Không còn response leaderboard cỡ MB; summary luôn nằm dưới giới hạn payload.
- [ ] Không có log `LEADERBOARD_NOT_READY` sau khi backfill thành công.
- [ ] Không có `database is locked`, `SQLITE_BUSY`, quick-check failure hoặc WAL tăng không kiểm soát.
- [ ] Chạy diagnostics read-only sau 30 phút và sau 24 giờ; `quickCheck: "ok"`.
- [ ] Kiểm tra backup theo lịch và thực hiện một restore drill trên bản sao, không restore đè production.

## 7. Điều kiện rollback

Rollback ứng dụng nếu có một trong các dấu hiệu: auth scope sai, dữ liệu public vượt allowlist, 5xx liên tục, latency summary vượt 2 giây khi warm, process crash-loop, route chính hỏng, hoặc SQLite busy/locked tăng rõ rệt.

- [ ] Dừng activation mới/đặt maintenance nếu cần ngăn ghi sai.
- [ ] Khôi phục đồng bộ `server.cjs.previous`, server map, root/dist `index.html.previous` và `.htaccess.previous`.
- [ ] Touch restart đúng một lần, rồi smoke lại API/route/auth.
- [ ] Giữ bundle hash cũ nên index cũ vẫn tải được.
- [ ] Không restore database production nếu đã phát sinh ghi mới sau backup. Backfill leaderboard là additive và tương thích app cũ; ưu tiên rollback ứng dụng.
- [ ] Chỉ phục hồi database khi có bằng chứng integrity hỏng và có quyết định sự cố riêng; trước đó phải lưu bản forensic hiện tại.

## 8. Biên bản kết quả

- Release/commit: ____________________
- Người vận hành: ____________________
- Thời gian bắt đầu/kết thúc: ____________________
- Backup đã xác minh: ____________________
- Backfill planned/inserted/missing: ____________________
- Audit result: ____________________
- Test/build/browser result: ____________________
- API p50/p95/p99 và payload: ____________________
- 4xx/5xx trước/sau: ____________________
- DB quick_check trước/sau: ____________________
- Quyết định cuối: GO / ROLLBACK / HOLD
