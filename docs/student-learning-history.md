# Lịch sử học tập của học sinh

Tài liệu này mô tả contract của Release B. Lịch sử học tập là lịch sử dài hạn; nó
không thay thế Recent Activity 7 ngày và không thay đổi nguồn dữ liệu của
leaderboard.

## Phạm vi

Trang `Lịch sử học tập` tổng hợp các lượt làm từ vựng và ngữ pháp trong cùng
`app.sqlite`. Mỗi lượt có một summary gọn trong `learning_attempts`; dữ liệu phục
vụ review nằm trong `attempt_details` hoặc được đọc có kiểm soát từ bảng legacy.

Summary không hết hạn khi detail hết hạn. Việc xóa detail không được làm mất
điểm, số lượt làm, thống kê hoặc leaderboard event.

## Quyền truy cập

### Học sinh đăng nhập

- Client gửi Firebase bearer token như các API được bảo vệ hiện tại.
- Backend lấy UID từ token và tự tạo `owner_key=user:<uid>`.
- Backend bỏ qua mọi `userId` do client gửi trong query hoặc body.

### Học sinh guest

- Client gửi `X-Guest-Id`.
- Client gửi capability bí mật qua `X-Guest-Access-Token`.
- Server chỉ lưu hash của capability; không lưu hoặc log plaintext token.
- `guestId`, tên học sinh, hoặc tổ hợp `guestId + tên` không đủ để đọc history.
- Client không được tự tạo guest mới chỉ vì người dùng mở trang history.

Guest legacy chưa có capability không được tự claim bằng tên hoặc raw guest ID.
Các record đó vẫn được giữ nguyên để staff xem. Recovery chỉ được thực hiện bằng
proof cũ còn hợp lệ hoặc quy trình xác minh/cấp lại quyền riêng.

Không đưa raw `guestId` vào public result/leaderboard response. Nếu giao diện cần
grouping công khai, dùng pseudonymous key do server cấp.

### Staff recovery cho guest legacy

Teacher/super admin có quyền quản lý đúng hồ sơ có thể xoay capability bằng:

```http
POST /api/admin/guest-profiles/:guestId/history-capability
Authorization: Bearer <firebase-id-token>
```

Backend kiểm tra quyền theo assignment/set thực tế, không tin `classId` hoặc
snapshot do client gửi. Response trả plaintext `guestAccessToken` đúng một lần;
server chỉ lưu SHA-256 hash, version và thời điểm cấp. Người vận hành phải chuyển
token cho đúng học sinh qua kênh riêng. Không ghi token vào audit description,
log, URL hoặc ticket công khai. Việc xoay token làm token cũ mất hiệu lực.

## API danh sách

```http
GET /api/my-learning-history
```

Query được hỗ trợ:

| Query | Giá trị |
| --- | --- |
| `page` | Số nguyên từ 1, mặc định 1 |
| `pageSize` | `20` hoặc `50` |
| `sourceType` | `vocabulary` hoặc `grammar` |
| `historyType` | `all`, `assignment` hoặc `practice` |
| `status` | Status thuộc allowlist của backend |
| `classId` | ID lớp |
| `lessonId` | ID vocab/grammar set |
| `assignmentId` | ID bài được giao |
| `gameId` | ID game/hình thức |
| `scoreFrom`, `scoreTo` | Điểm 0–100 |
| `from`, `to` | Ngày theo múi giờ Asia/Bangkok |
| `search` | Tìm theo snapshot tên bài, có giới hạn độ dài |
| `groupByAssignment` | Nhóm hiển thị theo assignment, không gộp record vật lý |

`from` là inclusive. Ngày `to` trên giao diện là inclusive và được backend đổi
thành đầu ngày kế tiếp exclusive. `Bài được giao` chỉ được xác định khi
`assignment_id` thật sự tồn tại; không suy luận từ lesson ID, share token hoặc
tên bài.

Response:

```json
{
  "items": [],
  "summary": {
    "totalAttempts": 0,
    "completedAttempts": 0,
    "averageScore": 0,
    "bestScore": 0,
    "totalCorrect": 0,
    "totalIncorrect": 0,
    "totalUnanswered": 0,
    "totalDurationSeconds": 0,
    "studyDays": 0
  },
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  },
  "filterOptions": {
    "classes": [],
    "lessons": [],
    "assignments": [],
    "games": []
  }
}
```

Summary được tính trên toàn bộ tập record sau filter và trước pagination. Các
metric điểm/count/thời gian/ngày học mặc định chỉ tính lượt `completed`, không
coi lượt đang làm là điểm 0.

Attempt lưu `in_progress` nhưng không có hoạt động trong hơn 24 giờ được list và
lọc dưới trạng thái hiệu lực `interrupted`. Đây là phép suy ra read-only tại lúc
query; API không update row nguồn và retention không xóa attempt đó.

Mỗi filter option có shape `{ "id": "...", "label": "..." }` và luôn nằm trong
owner scope. Khi `groupByAssignment=true`, response có thêm
`assignmentGroups`; đây chỉ là aggregate hiển thị, còn `items` và pagination vẫn
giữ từng attempt độc lập.

List API chỉ đọc summary columns, aggregate và pagination bằng SQL. Nó không đọc
hoặc parse detail JSON, không lookup lesson/class theo từng row và sắp xếp ổn
định bằng:

```sql
ORDER BY activity_at DESC, attempt_id DESC
```

## API chi tiết

```http
GET /api/my-learning-history/:attemptId
```

Backend phải kiểm tra owner trước khi đọc detail. Attempt của người khác trả 404
để giảm khả năng dò ID.

Detail mới được đọc từ `attempt_details`. Với `detail_status=legacy`, service
fallback đúng source row bằng `(source_type, source_record_id)`. Trạng thái
không có dữ liệu được trả bằng HTTP 200:

- `missing`
- `expired`
- `legacy_unavailable`

JSON được parse defensive. Một field hoặc một row malformed không được làm lỗi
toàn bộ response/trang.

Quyền xem đáp án dùng review-policy snapshot tại thời điểm làm bài. Khi actor
không có quyền, backend phải loại bỏ correct answer, accepted answers,
explanation và dữ liệu tương đương trước khi gửi response; ẩn bằng CSS là không
đủ.

SQLite không lưu hoặc trả audio binary/base64 cho Speaking AI.

## Giao diện

Entry `Lịch sử học tập` nằm trong student portal, không nằm trong
`AdminDashboard.tsx`.

Trang phải có:

- Tổng quan thống kê.
- Tab Tất cả, Bài được giao và Tự luyện.
- Filter chạy ở backend.
- Pagination 20/50; đổi filter reset về trang 1.
- Desktop table/list và mobile card, không tràn ngang.
- Loading, empty, error và retry state.
- Abort request cũ khi filter đổi nhanh.
- Detail modal có focus management, Escape/close và vùng scroll riêng.

Empty state:

```text
Bạn chưa có lượt làm bài nào.
Hãy hoàn thành một bài học để kết quả xuất hiện tại đây.
```

Error state:

```text
Không thể tải lịch sử học tập.
Vui lòng thử lại.
```

## Feature flags và rollback

```env
LEARNING_HISTORY_ENABLED=true
VITE_LEARNING_HISTORY_ENABLED=true
GUEST_PUBLIC_ID_SECRET=PASTE_64_HEX_OUTPUT_HERE
```

Backend flag tắt cả History API và projector; frontend flag được áp dụng tại
build time. Rollback Release B là tắt backend/UI flag. Không drop bảng mới,
không chuyển database và không đổi driver. Game, grammar, Recent Activity,
leaderboard và admin results phải tiếp tục hoạt động khi history bị tắt. Source
attempt vẫn được ghi; trước khi bật lại sau một khoảng rollback phải chạy
backfill catch-up/reconcile.

`GUEST_PUBLIC_ID_SECRET` dùng để tạo pseudonymous public student key bằng HMAC.
Production phải đặt một giá trị ngẫu nhiên, ổn định và chỉ lưu trong môi trường
host trước khi bật backend API. Không dùng raw guest ID làm secret, không commit
giá trị thật và không thay secret tùy tiện vì public key sẽ đổi.

`VITE_LEARNING_HISTORY_ENABLED` không được đọc lại khi Passenger restart. Vì
`.cpanel.yml` chỉ copy `dist`, muốn bật/tắt entry `/history` phải build lại
frontend ở máy phát hành rồi deploy artifact mới. Runbook hai lượt nằm tại
`docs/release-b-cpanel-deployment.md`.

## Compatibility bắt buộc

- `/api/results` vẫn là Recent Activity 7 ngày.
- Public/private leaderboard vẫn dùng dữ liệu dài hạn hiện hành.
- Admin vocabulary/grammar results giữ response contract cũ.
- Grammar per-set `my-attempts` và review tiếp tục hoạt động.
- Chỉ chuyển API cũ sang đọc projection sau khi golden response tests pass.
