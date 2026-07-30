# Cấu trúc dữ liệu Release B trong app.sqlite

Production chỉ sử dụng một database chính:

```text
/home/qzmivzbj/app-data/vhomework/app.sqlite
```

`app.sqlite-wal` và `app.sqlite-shm` là sidecar kỹ thuật của WAL, không phải
database nghiệp vụ khác. Release B không tạo `core.sqlite`, `activity.sqlite`,
`results.sqlite` hoặc `archive.sqlite`.

## Phân tầng bằng bảng

| Tầng | Bảng chính | Chính sách |
| --- | --- | --- |
| Dữ liệu nền | users, guest_profiles, vocab_sets, vocab_items, grammar_sets, grammar_questions, grammar_options, classes, class_members, assignments, settings | Giữ lâu dài |
| Source attempt | game_results, grammar_attempts, grammar_attempt_questions, grammar_attempt_answers | Giữ nguyên; projection/backfill không rewrite hoặc delete |
| Kết quả tổng hợp | learning_attempts, leaderboard_events | Giữ lâu dài, retention không xóa |
| Chi tiết | attempt_details, game_session_actions, pronunciation_attempts | Chỉ `attempt_details` có retention Release B |
| Dành trước | learning_history_backfill_state | Bảng đã có trong schema nhưng CLI hiện chưa đọc/ghi; resume quét source identity còn thiếu |

`attempt_drafts` và `attempt_checkpoints` chưa tồn tại. Chỉ tạo các bảng này khi
có workflow sử dụng thật; không coi chúng là một phần schema Release B hiện tại.

Các bảng legacy vẫn là source of truth tương thích trong lần triển khai đầu:

- Collection `game_sessions` đang nằm trong physical table `game_results`.
- Grammar source nằm trong `grammar_attempts`.
- Pronunciation legacy có thể đang nằm trong `game_results`.
- `leaderboard_events` tiếp tục được giữ nguyên.

Không drop, rename, rewrite hoặc xóa source row khi tạo history projection.

## learning_attempts

`learning_attempts` là projection summary, không chứa JSON review nặng.

| Nhóm | Cột |
| --- | --- |
| Identity | attempt_id, source_record_id, client_run_id, source_type |
| Ownership | student_type, user_id, guest_id, owner_key, ownership_status |
| Snapshot | student_name_snapshot, class_id, class_name_snapshot, assignment_id, assignment_title_snapshot, assignment_due_at_snapshot |
| Lesson/game | lesson_id, lesson_title_snapshot, lesson_type, game_id, game_title_snapshot |
| Score/count | score, raw_score, max_score, correct_count, incorrect_count, unanswered_count, mistake_count, total_questions |
| Time | started_at, completed_at, activity_at, study_date, duration_seconds |
| State | attempt_status, attempt_number, schema_version, detail_status, normalization_status |
| Audit | created_at, updated_at |

Ràng buộc:

- `attempt_id` là primary key.
- `source_record_id` không rỗng.
- Unique `(source_type, source_record_id)` bảo vệ backfill/reconcile.
- Partial unique `(owner_key, source_type, lesson_id, game_id, client_run_id)`
  khi owner và client run tồn tại bảo vệ retry.
- `score` nằm trong 0–100; count không âm.
- `game_id` không null; grammar dùng `grammar-practice`.
- Authenticated owner có dạng `user:<uid>`.
- Guest owner có dạng `guest:<guestId>`.
- Legacy không có stable identity dùng `owner_key=NULL` và
  `ownership_status=legacy_unlinked`.
- `study_date` là `YYYY-MM-DD` theo Asia/Bangkok.

Giá trị chính:

```text
source_type: vocabulary | grammar
student_type: authenticated | guest | legacy
lesson_type: vocab_set | grammar_set
attempt_status: completed | in_progress | interrupted
detail_status: available | missing | expired | legacy
normalization_status: canonical | legacy_partial
```

`interrupted` có thể là giá trị đã lưu cho nguồn khai báo rõ trạng thái đó.
Ngoài ra, repository suy ra read-only một row `in_progress` quá 24 giờ thành
`interrupted` khi list/filter. Phép suy ra này không update source hoặc
`learning_attempts`.

Các index phục vụ query thực:

```sql
UNIQUE (source_type, source_record_id)
(owner_key, activity_at DESC, attempt_id DESC)
(owner_key, source_type, activity_at DESC)
(owner_key, assignment_id, activity_at DESC) WHERE assignment_id IS NOT NULL
(lesson_id, activity_at DESC)
```

Không thêm FTS5 hoặc index global chưa có query plan chứng minh cần thiết.
Search `%term%` lần đầu được giới hạn bởi owner scope.

## attempt_details

Các cột:

```text
attempt_id
client_run_id
source_type
answer_details_json
question_snapshots_json
option_snapshots_json
extra_details_json
review_policy_json
created_at
updated_at
expires_at
schema_version
```

`attempt_id` là primary key và tham chiếu `learning_attempts(attempt_id)`.
Không cascade-delete summary. Bảng không chứa audio binary/base64 và không được
đọc trong list/summary query.

Detail mới snapshot review policy tại thời điểm làm bài. Detail legacy không bắt
buộc duplicate ngay; summary dùng `detail_status=legacy` và detail service
fallback source table bằng source identity.

Khi maintenance xóa detail hết hạn, nó cập nhật summary thành
`detail_status=expired` trong cùng transaction.

## Guest capability

`guest_profiles` được mở rộng additive:

```text
access_token_hash
access_token_version
access_token_created_at
```

Server sinh plaintext token tạm thời và trả đúng một lần cho client; token không
được persist hoặc log ở server. Raw guest ID hoặc tên không phải secret và không
được dùng làm bằng chứng quyền sở hữu.

Migration `guest-capability-physical-v1` chuyển hash/version/time hiện có
sang cột vật lý và loại các field capability khỏi `data_json`. Facade không trả
các cột bí mật này trong guest-profile response thông thường.

`GUEST_PUBLIC_ID_SECRET` là secret HMAC riêng của host dùng để thay raw guest ID
trong public result/leaderboard response. Secret này không nằm trong SQLite.

## Quy tắc projection

New write phải giữ source, leaderboard event, summary và detail nguyên tử trong
một transaction ngắn:

- Vocabulary completion: source session → leaderboard → summary → detail.
- Grammar activate: source attempt/answer → summary `in_progress`.
- Grammar submit: finalize source → leaderboard → summary → detail.
- Retry cùng immutable run trả row hiện có.
- Replay hợp lệ tạo source/attempt mới.
- Không gọi external service trong SQLite transaction.

Speaking history là session cha; từng pronunciation event không trở thành một
history summary riêng.

## Backfill legacy

Backfill là maintenance command riêng; không chạy job dài trong startup.

Lệnh trực tiếp:

```bash
node scripts/db-backfill-learning-history.mjs --db /path/to/app.sqlite --dry-run
node scripts/db-backfill-learning-history.mjs \
  --db /path/to/app.sqlite \
  --verified-backup /path/to/backup-before-backfill.sqlite \
  --execute
node scripts/db-backfill-learning-history.mjs \
  --db /path/to/app.sqlite \
  --verified-backup /path/to/backup-before-backfill.sqlite \
  --resume
```

Sau khi `package.json` tích hợp alias:

```bash
npm run db:backfill-learning-history -- --db /path/to/app.sqlite --dry-run
```

Smoke CLI trên database tạm, không dùng database cấu hình của ứng dụng:

```bash
node scripts/test-learning-history-cli.mjs
```

Smoke này kiểm tra ID trùng projector, dry-run không ghi, execute/resume
idempotent, source rows không đổi, reconcile/`quick_check`, và retention chỉ xóa
detail sau khi có backup hợp lệ.

Mặc định không có `--execute`/`--resume` là dry-run. Batch mặc định 500; có thể
đặt `--batch-size`, tối đa 1.000.

Backfill:

- Chỉ đọc completed vocabulary session và completed grammar attempt.
- Loại pronunciation event độc lập khỏi vocabulary summary.
- Tạo deterministic attempt ID bằng SHA-256 của
  chuỗi UTF-8 `learning-attempt-v1:<source_type>:<source_record_id>`, lấy 40 ký
  tự hex đầu và thêm prefix `attempt-`. Công thức này giống projector của new
  writes để backfill và runtime không tạo hai identity khác nhau.
- Dùng unique source identity để chạy lại không duplicate.
- Grammar canonical score là `correct_count / total_questions * 100`; raw score
  được giữ riêng.
- Matching/memory tách `mistake_count` khỏi số câu sai logic khi snapshot đủ.
- Sau các batch, tính lại `attempt_number` bằng `ROW_NUMBER()` theo partition
  `(owner_key, source_type, lesson_id, game_id)`, sắp xếp tăng dần theo
  `(activity_at, source_record_id)`. Bước này chỉ update projection
  `learning_attempts`, chạy lại cho cùng kết quả và không chạm source.
- Ghi `detail_status=legacy`; không copy toàn bộ JSON.
- Transaction từng batch, log count không log PII/detail.
- `--resume` quét các source identity chưa có projection; không cần state file.
- Reconcile eligible/covered/missing/malformed/unlinked, kiểm tra mọi row đã
  cover dùng đúng deterministic attempt ID, rồi chạy `quick_check`.
- Không update/delete source row.

Trước production execute phải có backup đã verify và phải chạy dry-run trên bản
sao production-shaped. `--execute` và `--resume` fail-fast nếu thiếu
`--verified-backup`; CLI mở file backup read-only và yêu cầu
`PRAGMA quick_check=ok`, đồng thời từ chối nếu đường dẫn đó chính là database
đang chạy. CLI không tự tạo backup, vì backup là gate triển khai riêng và phải
được tạo trước khi backfill bắt đầu. Có thể dùng lại cùng backup trước backfill
khi resume một job bị gián đoạn. Sau job, `missingAfter` và
`duplicateSourceGroups`, `deterministicIdMismatches` và
`attemptNumberMismatches` phải bằng 0.

## Bất biến dữ liệu

- Migration additive và idempotent.
- Tạo cột trước index tham chiếu cột đó.
- Không thay ID/timestamp/snapshot/`data_json` của source row
  `game_results`/`grammar_attempts`.
- Security migration được phép rewrite riêng `guest_profiles.data_json` để loại
  capability hash/version/time sau khi chuyển chúng sang cột vật lý; không đổi
  identity hay hồ sơ học tập của guest.
- Không cleanup khi startup, login, mở trang hoặc gọi read API.
- Không tự động `VACUUM`.
- Không fallback sang database/file khác khi SQLite lỗi.
