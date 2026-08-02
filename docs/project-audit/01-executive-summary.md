# 01 – Tóm tắt điều hành (Executive Summary)

**Dự án:** V-Homework Vocabulary Learning Platform  
**Ngày audit:** 2026-08-04  
**Phiên bản codebase:** commit `6548c8e` + worktree untracked changes (Smart Editor, Learning History)  
**Phạm vi:** Full-stack audit: React frontend, Express backend, SQLite storage, test suite, scripts, security, scalability  

---

## Tổng quan

Đây là một ứng dụng web học từ vựng tiếng Anh toàn stack (React 19 + Express 4 + SQLite/Firestore), hiện đang chạy production trên cPanel/Passenger với khoảng ~100 học sinh. Codebase đang trong giai đoạn mở rộng tích cực: hai module lớn mới (Listening Smart Editor và Learning History) đã được viết nhưng chưa hoàn toàn tích hợp vào production.

**Kết quả tổng thể:**

| Mức | Số lượng |
|-----|----------|
| P0 – Mất/lộ dữ liệu, sai quyền, ngừng hoạt động | **4** |
| P1 – Sai kết quả, lỗi chức năng chính, nghẽn hiệu năng nghiêm trọng | **11** |
| P2 – Ảnh hưởng bảo trì, mở rộng, hiệu năng khi tải tăng | **18** |
| P3 – Cải tiến chất lượng, nhất quán, trải nghiệm dev | **12** |
| **Tổng** | **45** |

---

## 10 Vấn đề quan trọng nhất

1. **[P0] Client-trusted score tại `PUT /api/game-sessions/:id`** — `server.ts:5056` tin hoàn toàn vào `payload.score` từ client; không có giới hạn trên. Điểm số giả mạo ghi thẳng vào database và leaderboard.

2. **[P0] Firestore client-side fallback trong `App.tsx`** — Khi backend không khả dụng, frontend đọc trực tiếp Firestore collections (`vocab_sets`, `assignments`, `classes`, `game_sessions`) bỏ qua mọi quyền hạn backend. Tùy thuộc vào Firestore rules, dữ liệu của giáo viên khác có thể bị lộ.

3. **[P0] `authFetch` không kiểm tra `res.ok` trong AdminDashboard** — 9+ mutation handler (save vocab set, delete class, create assignment…) dùng `authFetch` nhưng không kiểm tra HTTP status. Lỗi 403/404/500 từ server bị xử lý giống success, hiển thị thông báo "thành công" sai.

4. **[P0] `learnDetailNormalizer` không strip `correctAnswers` (số nhiều)** — `stripReviewSecrets()` loại bỏ `correctanswer` (singular) nhưng không loại bỏ `correctanswers` (plural). Grammar projector lưu đúng trường `correctAnswers`. Cần xác minh có rò rỉ qua API student không.

5. **[P1] Firebase ID token không được tự động refresh** — `AuthContext.tsx` không đăng ký `onIdTokenChanged`. Sau 1 giờ, mọi request từ user đang đăng nhập lâu dài sẽ nhận 401 từ backend mà không có xử lý tự động.

6. **[P1] N+1 query: `resolveVocabLearningAccess` duyệt toàn bộ assignments** — `server.ts:1158–1179` gọi `ensureAssignmentShareToken(...)` trong một vòng lặp qua toàn bộ `assignmentsSnapshot.docs`. Mỗi iteration có thể thực hiện thêm Firestore write. Sẽ rất chậm khi số assignment tăng.

7. **[P1] `updateDoc()` là read-modify-write không được bảo vệ bởi transaction** — `sqliteStorage.ts:1472–1475`: đọc document, patch, rồi upsert, ba bước này không nằm trong một transaction. Hai request đồng thời update cùng document có thể mất dữ liệu.

8. **[P1] AdminDashboard ~4.756 dòng, 60+ `useState`** — Component monolithic khổng lồ. Bất kỳ thay đổi state nào đều re-render toàn bộ component. Là điểm nghẽn bảo trì và hiệu năng lớn nhất phía frontend.

9. **[P1] `RecaptchaVerifier` memory leak trong `sendPhoneOtp`** — `AuthContext.tsx:308–313` tạo mới `RecaptchaVerifier` mỗi lần gọi, không có `verifier.clear()`. Lặp lại OTP request sẽ tích lũy DOM nodes và có thể gây lỗi Firebase.

10. **[P2] `persistDb()` xuất toàn bộ database sau mỗi write đơn lẻ** — `sqliteStorage.ts:496–499`: mỗi `run()` call gây `exportBytes()` + atomic file rename. Với sql.js driver (emergency fallback), mọi write đều tốn O(database_size) I/O. Với better-sqlite3 trong production, điều này không xảy ra (WAL checkpoint khác biệt), nhưng cần xác nhận rõ code path.

---

## 5 Quick wins ít rủi ro

1. **Thêm `Math.min(100, ...)` cho score tại `server.ts:5056`** — 1 dòng, không thay đổi logic, chặn score injection.
2. **Thêm `res.ok` check vào các `authFetch` handler trong AdminDashboard** — Pattern đã có ở `handleSaveGrammarSet` (line 916), chỉ cần nhân rộng.
3. **Đăng ký `onIdTokenChanged` trong `AuthContext`** — Firebase SDK cung cấp sẵn, 5 dòng code, loại bỏ stale token hoàn toàn.
4. **Xác minh và fix `stripReviewSecrets` để cover `correctAnswers` plural** — 2 dòng thêm vào blocklist, rủi ro thấp.
5. **Thêm `verifier.clear()` và lưu ref trước khi tạo `RecaptchaVerifier` mới** — Ngăn DOM leak trong OTP flow.

---

## 5 Thay đổi cần lập kế hoạch riêng

1. **Server-side scoring cho vocabulary games** — Cần tái thiết kế PUT /api/game-sessions/:id để tính score từ `privateSnapshot` thay vì tin payload. Phải giữ backward compat với legacy sessions.
2. **Tách `AdminDashboard.tsx` thành sub-panels** — Cần migration cẩn thận để không gây regression trong 40+ action handlers.
3. **Thêm transaction bảo vệ `updateDoc()` trong SQLite** — Cần đánh giá tác động đến toàn bộ call sites; có thể ảnh hưởng hiệu năng nếu dùng `EXCLUSIVE` transaction.
4. **Xóa/đóng gói Firestore client-side fallback trong `App.tsx`** — Phụ thuộc vào việc tightening Firestore rules trước; nếu xóa fallback trước khi rules đủ chặt sẽ gây lỗi trải nghiệm.
5. **Loại bỏ `sql.js` khỏi production dependency hoặc pin rõ ràng là emergency-only** — Hiện tại `sql.js` vẫn trong `dependencies`, không phải `devDependencies`; cần đánh giá build size và bundle impact.

---

## Những điểm chưa thể xác minh

- **Firestore security rules thực tế trên production** — `firestore.rules` file có tại local nhưng chưa xác minh phiên bản đang deploy trên Firebase Console.
- **WAL mode trên production SQLite** — CODEMAP ghi nhận WAL đang active, nhưng chưa chạy `PRAGMA journal_mode` trực tiếp trên production DB.
- **Artifact hash đang chạy trên cPanel** — CODEMAP ghi commit `6548c8e` nhưng last confirmed artifact là `index-gODK9tEe.js`, không khớp với build mới nhất (`index-CI66mUD2.css`, `index-YgFmPSne.js` trong git status).
- **Tốc độ tăng database thực tế** — Chưa có dữ liệu về kích thước hiện tại của `app.sqlite` trên production.
- **AI prompt injection từ teacher input** — `listening-smart-import/service.ts` không sanitize pasted text trước khi đưa vào AI prompt. Rủi ro thực tế phụ thuộc vào AI provider's safeguards.
- **Memory usage của Passenger process** — Không có monitoring data để xác nhận.

---

## Nhận xét tổng thể

Dự án có kiến trúc khá cẩn thận với nhiều quyết định đúng: idempotency key cho game sessions, server-side grading cho listening/grammar, WAL cho SQLite, timing-safe comparison cho tokens, và full test coverage cho các module mới nhất. Các vấn đề nghiêm trọng nhất (score injection, authFetch silent error) là kỹ thuật nợ từ giai đoạn trước khi các security policies hiện tại được thiết lập. Smart Editor và Learning History được xây dựng với tiêu chuẩn cao hơn đáng kể so với code legacy.

Ưu tiên: fix P0s trước khi mở Smart Editor cho production users.
