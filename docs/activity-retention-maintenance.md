# Maintenance retention cho Learning History

Retention Release B chỉ dọn detail đã hết hạn. Summary, source attempt,
leaderboard và dữ liệu nền không bị xóa.

## Chính sách

Biến môi trường được tách rõ nghĩa:

```env
RECENT_ACTIVITY_DAYS=7
ATTEMPT_DETAIL_RETENTION_DAYS=30
DRAFT_RETENTION_DAYS=3
```

Recent Activity 7 ngày là điều kiện query/display, không phải lệnh DELETE.
`learning_attempts` không hết hạn. `activity-prune` hiện chỉ xóa row hết hạn
trong `attempt_details`; draft/checkpoint chỉ được bổ sung khi các bảng và
workflow đó tồn tại thật.

`DRAFT_RETENTION_DAYS` hiện chỉ là biến dự phòng cho workflow tương lai. Server
và `activity-prune` chưa đọc biến này; cấu hình giá trị không tự tạo bảng và
không xóa draft/checkpoint.

Không được xóa:

- `learning_attempts`.
- `leaderboard_events`.
- `game_results`, `grammar_attempts` hoặc source legacy khác.
- Users, lessons/sets, classes, assignments.
- Detail của attempt `in_progress`.

Command không chạy `VACUUM`.

## Preflight

Trước production maintenance:

1. Chọn maintenance window. Trước `--execute`, dừng toàn bộ app/Passenger
   worker và xác nhận **zero writers**; chỉ giảm tải là không đủ.
2. Xác nhận đúng absolute path của `app.sqlite`.
3. Chạy dry-run.
4. Kiểm tra `eligible`, `protectedInProgress` và `invalidExpiry`.
5. Xác nhận backup directory đủ dung lượng và process có quyền ghi.

CLI từ chối file không tồn tại, thiếu schema Release B, sai primary key/unique
source identity, `quick_check` lỗi hoặc có foreign-key violation.

## Dry-run mặc định

```bash
node scripts/activity-prune.mjs \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --dry-run
```

Nếu không truyền mode, command vẫn là dry-run:

```bash
node scripts/activity-prune.mjs \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite
```

Sau khi `package.json` tích hợp alias:

```bash
npm run maintenance:activity-prune -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --dry-run
```

Dry-run mở database read-only, không tạo backup và không ghi dữ liệu.
Dry-run có thể chạy khi ứng dụng đang phục vụ, nhưng report chỉ là snapshot tại
thời điểm đọc. Vẫn phải dừng toàn bộ writer trước execute.

`--as-of <ISO timestamp>` chỉ nên dùng cho test/rehearsal có kiểm soát. Mặc định
là thời điểm command chạy.

Retention không có checkpoint dài hạn và không hỗ trợ `--resume`; CLI fail-fast
nếu truyền mode đó. Mỗi lần chạy execute tự tính lại tập detail đủ điều kiện
trong transaction ngắn.

## Execute

```bash
node scripts/activity-prune.mjs \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --backup-dir /home/qzmivzbj/app-data/vhomework/retention-backups \
  --execute
```

Nếu không truyền `--backup-dir`, command dùng `SQLITE_BACKUP_DIR`, sau đó mới
fallback về thư mục `backups` cạnh database.

Thứ tự execute:

1. Mở read-only, validate file/schema, `quick_check` và `foreign_key_check`.
2. Tính dry-run report.
3. Tạo SQLite online backup.
4. Mở lại backup read-only và bắt buộc `quick_check=ok`.
5. Mở database nguồn, revalidate, tính lại eligible rows và chụp lại row count
   của các bảng được bảo vệ.
6. Trong một transaction:
   - Chụp eligible attempt IDs vào temporary table.
   - Update đúng summary đó thành `detail_status=expired`.
   - Delete đúng `attempt_details` đó.
   - So sánh selected/updated/deleted counts; mismatch làm rollback.
7. Commit.
8. Chạy lại `quick_check`, `foreign_key_check` và đo lại row count bảo vệ.
9. So sánh độc lập `learning_attempts`, `game_results`, `grammar_attempts`,
   `pronunciation_attempts` và `leaderboard_events` trong cả cửa sổ command
   (snapshot trước backup → sau transaction) và riêng quanh transaction; bất kỳ
   delta nào cũng làm report `ok=false`.
10. Báo before/after/delta thực đo và đường dẫn backup đã redacted.

Không có DELETE nào ngoài `attempt_details`; temporary table chỉ tồn tại trong
connection maintenance.

Execute thành công cần:

- `deletedDetails == updatedSummaries == selectedDetails`.
- `after.eligible == 0`.
- `protectedRowCounts.unchanged == true` và delta của từng bảng bảo vệ bằng 0.
- `summaryDeletion`, từng giá trị trong `sourceDeletionByTable`,
  `sourceDeletion` và `leaderboardDeletion` thực đo đều bằng 0.
- `quickCheck=ok`.
- `backupQuickCheck=ok`.
- `vacuum=false`.

## Sau maintenance

1. Lưu JSON report và backup theo retention vận hành.
2. Chạy diagnostics.
3. Smoke History list/detail.
4. Xác nhận detail hết hạn hiển thị trạng thái `expired`, không trả 500.
5. Xác nhận Recent Activity, leaderboard và admin results không regression.

SQLite sẽ tái sử dụng free pages sau DELETE. Nếu cần giảm kích thước file vật
lý, lập maintenance window và runbook riêng có backup; không thêm `VACUUM` vào
command này.

## Khôi phục khi có lỗi

Nếu transaction chưa commit, SQLite tự rollback và backup vẫn được giữ.

Nếu cần restore sau commit:

1. Dừng toàn bộ app worker.
2. Giữ database lỗi/WAL/SHM để điều tra.
3. Verify `quick_check` của backup.
4. Restore theo `docs/sqlite-backup-restore.md`.
5. Start known-good code và smoke API.

Không copy riêng `app.sqlite` khi app còn writer hoạt động trong WAL mode.
