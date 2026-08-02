# 02 – Xung đột và bất nhất (Conflicts and Inconsistencies)

> Tất cả phát hiện dưới đây dựa trên source code đã đọc trực tiếp. Mỗi mục ghi rõ file, dòng và bằng chứng.

---

## C01 – `User` vs `UserProfile`: hai interface cho cùng một khái niệm

**Mức:** P2  
**File:** `src/types.ts:3–8`, `src/context/AuthContext.tsx:24–33`

**Bằng chứng:**  
`types.ts` export `User` với fields `{ id, name, email, role }`. `AuthContext.tsx` định nghĩa nội bộ `UserProfile` với `{ id, name, email, role, status, phone, phoneVerified, createdAt }`. Không có chỗ nào trong app import `User` từ `types.ts` để dùng cho auth state. `App.tsx` dùng `useAuth()` trả về `UserProfile`.

**Nguyên nhân:** Interface `User` là legacy từ giai đoạn đầu trước khi backend profile sync được thêm vào.

**Tác động:** Bất cứ ai dùng `User` từ `types.ts` sẽ có type thiếu `status` và `phone`. Code mới có thể nhầm import.

**Hướng xử lý:** Hợp nhất thành một type, hoặc export `UserProfile` và deprecate `User`.

---

## C02 – `VocabSet.status` vs `VocabSet.visibility`: hai trường cho visibility

**Mức:** P2  
**File:** `src/types.ts:67–68`, `src/App.tsx:494`, `src/components/admin/AdminDashboard.tsx:23–30`

**Bằng chứng:**  
`types.ts` có `status: 'draft' | 'public' | 'private'` và `visibility?: 'public' | 'assignment' | 'draft'`. Mapping không 1:1: `'private'` → `'assignment'`, `'public'` → `'public'`, `'draft'` → `'draft'`. Logic reconcile được viết lại ít nhất 3 lần:  
- `App.tsx:494`: `const visibility = set.visibility || (set.status === 'private' ? 'assignment' : set.status)`  
- `AdminDashboard.tsx:23–30`: `getSetVisibility()` function riêng  
- `server.ts`: `getVocabVisibility()` function riêng

**Tác động:** Bất đồng bộ giữa các lần implementation có thể tạo ra edge case. Ví dụ: nếu một set có `status: 'private'` nhưng không có `visibility`, `canViewVocabSet` trên server và frontend có thể cho kết quả khác nhau.

**Hướng xử lý:** Chọn một trường (nên là `visibility`), backfill dữ liệu, xóa trường còn lại.

---

## C03 – `GameSession.vocabSetId` bị inject prefix `grammar:` và `listening:`

**Mức:** P2  
**File:** `server.ts:1270`, `server.ts:1418`

**Bằng chứng:**  
Tại `grammarAttemptToActivity()` (line 1270): `vocabSetId: \`grammar:${attempt.grammarSetId}\``. Tại `listeningAttemptToActivity()` (line 1418): `vocabSetId: \`listening:${attempt.setId}\``. Type `GameSession.vocabSetId` được định nghĩa là `string` đơn giản (không phải union có prefix).

**Tác động:** Code downstream nhận một `vocabSetId` trông giống `grammar:abc123` sẽ thất bại khi dùng nó để query thật. Phần lớn UI đã xử lý case này (e.g. `isGrammarActivity`), nhưng bất cứ code mới nào dùng `vocabSetId` ngây thơ sẽ có lỗi ẩn.

**Hướng xử lý:** Thêm `sourceType: 'grammar' | 'vocabulary' | 'listening'` như discriminated field và giữ `vocabSetId` là raw ID. Hoặc tạo union type `ActivityId` với tagged prefix.

---

## C04 – `GrammarAttempt.userId` và `.studentId` đều optional, cả hai được clone từ cùng nguồn

**Mức:** P3  
**File:** `src/types.ts:183–185`, `server.ts:1263–1264`

**Bằng chứng:**  
`grammarAttemptToActivity()` (line 1263–1264): `userId: attempt.userId, studentId: attempt.userId`. Nếu `attempt.userId` là undefined, cả hai trường đều là `undefined` trong activity row.

**Tác động:** Queries tìm kiếm theo `userId` hoặc `studentId` có thể bỏ lỡ activities của guest users khi `userId` không tồn tại.

**Hướng xử lý:** Luôn normalize: `userId: attempt.userId || ''`, `studentId: attempt.userId || attempt.guestId || ''`.

---

## C05 – `game_sessions` (Firestore collection name) vs `game_results` (SQLite table name)

**Mức:** P2  
**File:** `src/lib/sqliteStorage.ts:49`, `src/lib/firebaseAdmin.ts:87–96`

**Bằng chứng:**  
`sqliteStorage.ts` `collectionTableMap` (line 49) maps `"game_sessions"` → `"game_results"`. `LocalDbEngine.mapCollectionKey()` (firebaseAdmin.ts:87) maps `"game_sessions"` → `"gameSessions"`.

**Tác động:** Trong Firestore mode: dữ liệu nằm ở collection `game_sessions`. Trong SQLite mode: nằm ở table `game_results`. Trong local-json mode: nằm ở key `gameSessions`. Ba chỗ lưu khác tên cho cùng dữ liệu. Bất kỳ tool export/import nào phải biết mode đang dùng để chọn đúng mapping.

**Hướng xử lý:** Document rõ ràng mapping này trong CODEMAP. Xem xét alias nhất quán trong SQLite table name.

---

## C06 – `durationMs` vs `durationSeconds`: hai trường duration tồn tại song song

**Mức:** P3  
**File:** `src/types.ts:227–228`, `server.ts:1279–1280`

**Bằng chứng:**  
`GameSession` type có cả `durationMs?: number` và `durationSeconds?: number`. `grammarAttemptToActivity()` (line 1279–1280) set cả hai: `durationMs: ... * 1000`, `durationSeconds: ...`. SQLite `game_results` schema có `duration_ms` column (sqliteStorage.ts ~line 766).

**Tác động:** Code mới có thể đọc `durationMs` hoặc `durationSeconds` không biết cái nào canonical. Kết quả display time có thể sai nếu chỉ đọc một trong hai.

**Hướng xử lý:** Chọn `durationMs` làm canonical, backfill `durationSeconds * 1000` cho legacy data.

---

## C07 – `collectionTableMap` có nhiều alias cho cùng table `game_results`

**Mức:** P2  
**File:** `src/lib/sqliteStorage.ts:39–92`

**Bằng chứng:**  
Các collection names `"game_sessions"`, `"gamesessions"`, `"game_results"`, `"gameresults"` đều map tới table `"game_results"`. Ngoài ra `"results"` map tới table riêng `"results"` (legacy).

**Tác động:** Code dùng `adminDb.collection("results")` sẽ miss các records trong `game_results` và ngược lại. Nếu có code legacy dùng `"results"` để query completed sessions, dữ liệu sẽ bị thiếu trong SQLite mode.

**Hướng xử lý:** Cần xác minh có code nào còn dùng collection `"results"` trực tiếp không. Nếu có, cần migration hoặc alias nhất quán.

---

## C08 – `AuthContext` có hardcoded email logic trùng với `server.ts`

**Mức:** P2  
**File:** `src/context/AuthContext.tsx:68–73`, `server.ts:213`

**Bằng chứng:**  
`AuthContext.tsx` có function `getDefaultRole()` với hardcoded `linyi8901@gmail.com → super_admin`. `server.ts` cũng có `SUPER_ADMIN_EMAILS = new Set(["linyi8901@gmail.com", "admin@vocabulary.edu.vn"])`. Nếu thêm super admin mới vào `server.ts` mà quên cập nhật `AuthContext`, frontend logic sẽ bị lệch.

**Bằng chứng thêm:** `AuthContext.getDefaultRole` không bao giờ được gọi để cập nhật `user.role` sau khi đã fetch từ `/api/me`. Hàm này là dead code (được dùng trong `createDefaultProfile` nhưng `createDefaultProfile` không còn được gọi).

**Tác động:** Dead code tạo confusion cho developer; nếu ai "kích hoạt" lại sẽ tạo role inconsistency.

**Hướng xử lý:** Xóa `getDefaultRole` và `createDefaultProfile` khỏi `AuthContext`, đảm bảo role luôn đến từ backend `/api/me`.

---

## C09 – CODEMAP artifact hash không khớp với git status hiện tại

**Mức:** P3  
**File:** `CODEMAP.md:79–84`, `git status` output

**Bằng chứng:**  
CODEMAP ghi: current artifact là `index-vgHIw9Ix.js` và `index-nByREmg-.css`. Git status cho thấy các file này đã bị **deleted** (`D dist/client/assets/index-nByREmg-.css`, `D dist/client/assets/index-vgHIw9Ix.js`). File mới là `index-CI66mUD2.css` và `index-YgFmPSne.js` (untracked). CODEMAP chưa được cập nhật.

**Tác động:** CODEMAP không còn là nguồn sự thật cho deployment state. Làm khó quá trình smoke check sau deploy.

**Hướng xử lý:** Cập nhật CODEMAP sau mỗi build tạo artifact mới.

---

## C10 – `firebase-blueprint.json` stale: dùng field names cũ (`topic`, `creatorId`, `gameType`, `studentId`)

**Mức:** P3  
**File:** `firebase-blueprint.json`, `CODEMAP.md:899` (Known Issues)

**Bằng chứng:** CODEMAP section 15 ghi nhận: `firebase-blueprint.json` partly stale — dùng `topic` thay vì `subject`, `creatorId` thay vì `createdBy`, `gameType` thay vì `gameId`, `studentId` thay vì name-based session.

**Tác động:** Nếu AI Studio tooling dùng blueprint này để generate data, nó sẽ generate wrong field names. Không gây lỗi runtime nhưng tạo confusion.

**Hướng xử lý:** Update hoặc archive file này.

---

## C11 – `learning_attempts.source_type CHECK` constraint không bao gồm `'listening'`

**Mức:** P2  
**File:** `src/lib/sqliteStorage.ts:1940`

**Bằng chứng:**  
Schema constraint: `CHECK(source_type IN ('vocabulary', 'grammar'))`. Nhưng `LearningSourceType` trong TypeScript bao gồm `'listening'`. Listening attempts được lưu vào table riêng `listening_attempts` và được bridge qua CTE trong queries.

**Tác động:** Nếu sau này muốn unify history tables, cần migration. Hiện tại, constraint không gây lỗi nhưng là divergence giữa TypeScript types và DB schema.

**Hướng xử lý:** Hoặc thêm `'listening'` vào constraint + migrate listening_attempts, hoặc update comment trong schema để rõ ràng đây là intentional split.

---

## C12 – Dùng `Array index` thay vì ID cho grammar answer options

**Mức:** P1  
**File:** CODEMAP.md:638 (grammar docs), `server.ts` grammar grading logic

**Bằng chứng:** CODEMAP ghi: "Correct answers are stored and checked by stable option IDs, not by A/B/C/D labels after shuffle." Tuy nhiên, cần xác minh trong `sanitizeGrammarAnswerForStudent()` (server.ts:1223) và `grammarAttemptToActivity()` (server.ts:1288) rằng `selectedOptionId` luôn là ID, không phải index.  
**Trạng thái:** Bằng chứng trong code ngụ ý đây đã được xử lý đúng với option IDs. Đánh dấu **Cần xác minh thêm** cho bất kỳ place nào còn dùng index.

---

## C13 – `shareToken` và `assignmentSlug` cùng tồn tại cho assignment

**Mức:** P3  
**File:** `server.ts:1088–1113`, CODEMAP.md:257

**Bằng chứng:**  
`getAssignmentShareToken()` (line 1088) return `assignment?.shareToken || assignment?.assignmentSlug || ""`. `ensureAssignmentShareToken()` (line 1092) đặt cả `shareToken` và `assignmentSlug` khi tạo token mới. Hai field này là synonymous nhưng cả hai được lưu.

**Tác động:** Dư thừa dữ liệu. Code mới không biết nên dùng field nào.

**Hướng xử lý:** Deprecate `assignmentSlug`, migrate về `shareToken`.

---

## C14 – Feature flag `LAZY_SESSION_V3_ENABLED` không có documentation trong `.env.example`

**Mức:** P3  
**File:** `server.ts:510`, `.env.example`

**Bằng chứng:**  
`server.ts:510`: `const LAZY_SESSION_V3_ENABLED = process.env.LAZY_SESSION_V3_ENABLED !== "false"` — default ON. Không tìm thấy entry này trong `.env.example`.

**Tác động:** Operator không biết có thể tắt feature này. Nếu cần rollback, không có documented path.

**Hướng xử lý:** Thêm `LAZY_SESSION_V3_ENABLED` vào `.env.example` với comment.

---

## C15 – `resolveVocabLearningAccess` full-scan toàn bộ assignments khi token không khớp

**Mức:** P1 (hiệu năng + data exposure risk)  
**File:** `server.ts:1158–1179`

**Bằng chứng:**  
Khi không tìm thấy assignment bằng `expectedAssignmentId`, function fallback đến: `const assignmentsSnapshot = await adminDb.collection("assignments").get()` — full scan — và iterate từng doc với `await ensureAssignmentShareToken(...)`. Nếu assignment chưa có `shareToken`, function này **write** vào database (set shareToken). Đây là write trong một read path, và write xảy ra cho toàn bộ assignments không có token.

**Tác động:** (1) O(n) Firestore reads + writes khi query vocab share token với n = tổng số assignments. (2) Unexpected writes trong what appears to be a read operation. (3) Potential race condition nếu hai requests chạy đồng thời.

**Hướng xử lý:** Index `shareToken` field, query trực tiếp thay vì full scan.
