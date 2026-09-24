# Nhật ký nâng cấp kiến trúc và giao diện

> Tài liệu checkpoint bắt buộc cho đợt nâng cấp `AdminDashboard.tsx`, `App.tsx`,
> `server.ts` và lớp CSS. Mục đích là giúp bất kỳ người thực hiện nào có thể
> tiếp tục đúng chỗ nếu công việc bị dừng giữa chừng, đồng thời không vượt quá
> phạm vi đã được người dùng phê duyệt.

## 1. Thông tin chung

- Ngày bắt đầu: 2026-09-21.
- Trạng thái tổng thể: **Cả 3 lần nâng cấp ban đầu và toàn bộ Bước 1–4 của kế
  hoạch chia nhỏ tiếp theo đã hoàn tất kỹ thuật**.
- Phạm vi hiện tại: **Không còn phân loại Lần 1/Lần 2/Lần 3; mọi lỗi được truy
  nguyên trên toàn bộ luồng liên quan trước khi sửa**.
- Bước hiện tại: **Bước 4 đã hoàn thành ngày 2026-09-24: CSS đã được chia theo
  owner bề mặt, lớp Dark Glass cũ đã được loại bỏ và full regression/browser
  gate đã pass. Chưa deploy production**.
- Tiến độ kế hoạch chia nhỏ tiếp theo: **4/4 bước hoàn tất kỹ thuật**.
- Source đã thay đổi: **ranh giới Admin/Vocabulary; Admin data; App/Home; các
  panel trình bày Admin; Classes và toàn bộ domain API còn lại theo
  router/service/repository; CSS owner cho base/shared/Home/Admin/Student/
  Exam-Listening; contract và browser smoke test**.
  Database schema, storage contract, URL, auth/role/ownership, bố cục và dữ
  liệu hiện hữu không thay đổi.
- Quy tắc bắt buộc: đọc `quytac.md`, `CODEMAP.md`, `package.json`, source và
  test liên quan trước khi sửa; không deploy production nếu người dùng chưa yêu
  cầu.

## 2. Lịch sử yêu cầu của người dùng

1. Thiết kế lại giao diện dựa trên hình tham khảo nhưng không sao chép; giữ
   nguyên chức năng, dữ liệu, API, route và bố cục. Mặc định chỉ thay đổi ngôn
   ngữ thị giác/màu sắc; mọi thay đổi bố cục phải hỏi trước.
2. Rà soát ba file trung tâm `AdminDashboard.tsx`, `App.tsx`, `server.ts` để
   chia trách nhiệm theo modular monolith, giảm tải và tránh một file làm quá
   nhiều nhiệm vụ.
3. Không thay router framework; giữ `appRoutes.ts`, canonical URL và legacy URL.
4. Dùng Vocabulary làm vertical slice đầu tiên; feature/page sở hữu dữ liệu,
   component trình bày không tự fetch.
5. Mutation chỉ refresh dependency thực sự liên quan; không gọi lại toàn bộ dữ
   liệu Admin cho một thay đổi nhỏ.
6. Dashboard phải dùng summary API riêng thay vì tải toàn bộ collection để đếm.
7. Không trộn refactor cấu trúc, tối ưu data và redesign CSS trong một lượt.
8. Chia việc triển khai thành đúng ba lần; mỗi lần người thực hiện phải tự test
   đầy đủ, chỉ báo cáo khi gate pass và phải dừng để người dùng test thủ công
   trước khi sang lần tiếp theo.
9. Trước khi sửa source phải có file `nangcap.md` ghi yêu cầu, phương án cuối,
   checklist, lịch sử chỉnh sửa, tiến độ và vị trí đang làm.
10. Từ 2026-09-23, không dùng ranh giới ba lần để phân loại lỗi nữa. Mọi lỗi
    phát hiện khi kiểm thử phải được kiểm tra trên toàn bộ source và sửa theo
    nguyên nhân gốc, không mặc định quy lỗi cho lượt thay đổi gần nhất.

## 3. Invariants không được phá vỡ

- Không đổi URL, route parser, router framework, canonical/legacy link.
- Không đổi auth, role, ownership, guest identity hoặc share token.
- Không đổi storage, database, grading, result, history hoặc published content.
- Không xóa dữ liệu; migration nếu phát sinh ở lần sau phải additive và
  idempotent, có backup và kiểm thử trên bản sao production-shaped.
- Không đổi bố cục, thứ tự section, DOM hierarchy, breakpoint hoặc responsive
  behavior nếu chưa được người dùng duyệt.
- Giữ các ID/class/semantic hook quan trọng và thứ tự thao tác thư viện:
  `Play → Sửa → Sao chép → Kết quả → Xóa`.
- State/bản nháp Vocabulary chưa lưu phải còn nguyên khi đổi tab rồi quay lại.
- Component trình bày không tự fetch; controller/feature boundary sở hữu data.
- Không tự động triển khai lần kế tiếp sau khi hoàn tất một lần.

## 4. Phương án triển khai cuối cùng

```text
Lần 1 — Baseline + ranh giới kiến trúc Admin
  ↓ người thực hiện test pass
  ↓ người dùng test thủ công và cho phép tiếp tục
Lần 2 — Dashboard summary + lazy/paged Admin data theo từng domain
  ↓ người thực hiện test pass
  ↓ người dùng test thủ công và cho phép tiếp tục
Lần 3 — App/Home + lớp giao diện + tiếp tục làm mỏng server.ts
```

Kiến trúc đích vẫn là modular monolith:

```text
App.tsx → route/auth gateway → Home/Student/Admin feature
AdminDashboard.tsx → compatibility entry → AdminShell → feature panels
server.ts → bootstrap/middleware/router mounting → service → repository
CSS → token/theme layer có scope, nạp sau legacy rules
```

## 5. Lần 1 — Baseline + AdminShell

### Phạm vi được phép

- Ghi baseline hiện tại.
- Tạo `AdminShell` nhưng giữ `AdminDashboard.tsx` làm compatibility entry.
- Tách phần trình bày Vocabulary thành feature/panel: list, editor, results.
- Tách controller/state ở mức an toàn nhưng controller phải được mount tại cấp
  cha để bản nháp không mất khi panel unmount.
- Có thể thêm regression/contract test cần thiết để khóa hành vi trên.

### Ngoài phạm vi

- Không đổi `refreshData()`.
- Không thêm dashboard summary, pagination hoặc API mới.
- Không đổi data loading, request count, API, database hoặc CSS.
- Không tách Grammar/Classes/Users/Results thành feature mới trong lần này.

### Checklist thực hiện

- [x] Đọc attachment kế hoạch ba lần bằng UTF-8.
- [x] Đọc lại `quytac.md`.
- [x] Kiểm tra Git status và lịch sử gần nhất.
- [x] Tạo `nangcap.md` trước khi sửa source.
- [x] Xác nhận/ghi baseline request và API Admin.
- [x] Chạy baseline lint/security/performance/Vocabulary tests.
- [x] Chạy baseline build phù hợp môi trường.
- [x] Khóa hành vi giữ bản nháp bằng regression test.
- [x] Tạo `AdminShell` giữ nguyên DOM/order/class/hook.
- [x] Tách Vocabulary list UI.
- [x] Tách Vocabulary editor UI.
- [x] Tách Vocabulary results UI.
- [x] Giữ controller/state ở cấp không bị unmount khi đổi tab.
- [x] Chạy test hẹp sau từng lát thay đổi.
- [x] Chạy toàn bộ gate Lần 1 bằng Node 22 theo `package.json`.
- [x] Kiểm tra diff, request count trước/sau và cập nhật nhật ký/CODEMAP.
- [x] Dừng sau Lần 1, chưa triển khai Lần 2.
- [x] Người dùng kiểm thử thủ công và cho phép Lần 2.

### Gate hoàn thành Lần 1

- Lint/typecheck pass.
- Security/performance và Vocabulary/Admin tests liên quan pass.
- Build pass trong môi trường phù hợp.
- Teacher/super-admin vẫn dùng được các luồng Admin liên quan.
- Vocabulary tạo/sửa/clone/xem kết quả/preview giữ nguyên.
- Bản nháp chưa lưu không mất khi đổi tab.
- Request count không tăng so với baseline.
- Giao diện/bố cục/API/storage không thay đổi.

## 6. Lần 2 — Tối ưu tải dữ liệu Admin

Chỉ được bắt đầu sau khi Lần 1 pass và người dùng cho phép.

### Thứ tự nội bộ

1. `GET /api/admin/dashboard-summary`, scope đúng teacher/super-admin.
2. Vocabulary vertical slice: summary list, server pagination/filter/search,
   detail theo ID, lazy fetch, abort/stale guard và targeted refresh.
3. Grammar.
4. Classes + Class Members.
5. Assignments.
6. Accounts + Audit.
7. Results UI/controller nếu cần.

### Nguyên tắc

- API cũ hoạt động song song trong giai đoạn chuyển đổi.
- Summary không chứa full detail/private field.
- Detail chỉ point-read khi cần.
- Mỗi domain phải test pass trước khi sang domain kế tiếp.
- Không ép Listening/Movers/Writing/Exam theo Vocabulary nếu chúng đã có kiến
  trúc/versioning riêng.
- Hoàn tất Lần 2 phải báo cáo và dừng.

### Checklist thực hiện Lần 2

- [x] Người dùng cho phép bắt đầu Lần 2.
- [x] Chuyển checkpoint sang trạng thái Lần 2 trước khi sửa source.
- [x] Ghi baseline test, request inventory, payload và hành vi hiện tại.
- [x] Thêm `GET /api/admin/dashboard-summary` qua router/service/repository.
- [x] Chuyển Dashboard sang một summary request, không tải toàn bộ domain.
- [x] Hoàn thiện Vocabulary summary list + detail point-read + server paging.
- [x] Thêm debounce, abort/stale guard và targeted Vocabulary refresh.
- [x] Test Vocabulary đầy đủ trước khi chuyển domain.
- [x] Chuyển Grammar theo cùng contract phù hợp.
- [x] Chuyển Classes + Class Members.
- [x] Chuyển Assignments và chỉ tải dependency khi mở tab.
- [x] Chuyển Accounts + Audit theo role và pagination/filter phía server.
- [x] Chuyển Results/leaderboard sang lazy load khi mở đúng bề mặt.
- [x] Giữ Listening/Movers/Writing/Exam trên API/versioning hiện có nhưng chỉ
  tải khi feature tương ứng cần dữ liệu.
- [x] Chạy test hẹp sau từng domain.
- [x] Chạy full `test:phase2` bằng Node 22, build/startup và kiểm tra diff.
- [x] Ghi metrics trước/sau, cập nhật `CODEMAP.md` và dừng để người dùng test.
- [x] Người dùng kiểm thử thủ công Lần 2 và cho phép rõ ràng trước Lần 3.

## 7. Lần 3 — App/Home + giao diện + hoàn thiện backend

Chỉ được bắt đầu sau khi Lần 1 và Lần 2 pass và người dùng cho phép.

### Phần A — App/Home

- Tách route decision, HomePage, Home controller/search khỏi `App.tsx`.
- Giữ `appRoutes.ts`, canonical/legacy URL, `pushState`, lazy loading và router
  framework.
- Chỉ chuyển Home sang summary/detail nếu giữ nguyên tìm kiếm theo term,
  meaning, IPA, example và alias; nếu chưa tương đương thì giữ API cũ.

### Phần B — Lớp giao diện

- Chỉ đổi màu, typography thị giác, button/card/badge/input, border,
  radius/shadow nhẹ và toàn bộ trạng thái tương tác.
- Không đổi layout/grid/order/spacing lớn/breakpoint/kích thước khối/DOM.
- Dùng token/theme có scope; không thay màu global mù quáng và không dọn hàng
  loạt legacy `!important`.
- Kiểm tra computed style/WCAG, desktop/mobile và các contract Exam/Listening/
  Movers/Admin.

### Phần C — Backend

- Tiếp tục rút route legacy theo `router → service → repository`.
- Giữ nguyên URL, status, response, auth, role và ownership.
- Auth/guest/compatibility route nhạy cảm làm sau cùng.
- Không microservice, PostgreSQL, worker hoặc dependency lớn mới nếu chưa có
  metrics và phê duyệt.

### Checklist thực hiện Lần 3

- [x] Người dùng cho phép bắt đầu Lần 3.
- [x] Chuyển checkpoint sang trạng thái Lần 3 trước khi sửa source.
- [x] Đọc lại `quytac.md`, kế hoạch ba lần, `CODEMAP.md`, `package.json` và lịch
  sử Git/source liên quan.
- [x] Chạy và ghi baseline lint/security/performance/route trước khi sửa.
- [x] Thêm contract test khóa route, tìm kiếm Home và ranh giới controller/view.
- [x] Tách Home controller/search và HomePage khỏi `App.tsx`, giữ nguyên API tìm
  kiếm đầy đủ, URL, `pushState`, lazy loading, DOM và hành vi.
- [x] Chạy test hẹp App/Home và gate liên quan trước khi sửa CSS.
- [x] Thêm token/theme có scope và đổi lớp thị giác đã duyệt; không đổi layout,
  grid, DOM, breakpoint hoặc kích thước khối.
- [x] Sửa độ tương phản nút xem/ẩn Bảng vàng và khóa trạng thái bằng test.
- [x] Kiểm tra tự động contrast/WCAG, focus/hover/disabled/loading/error và contract
  Exam/Listening/Movers/Admin ở desktop/mobile.
- [x] Chọn một lát backend legacy ít nhạy cảm; tách theo
  `router → service → repository` và giữ nguyên contract.
- [x] Chạy test hẹp backend, legacy integration và startup.
- [x] Chạy full gate Lần 3 bằng Node 22, build, kiểm tra diff và source sinh ra.
- [x] Cập nhật `CODEMAP.md`, nhật ký, metrics và chuẩn bị localhost cho người
  dùng kiểm thử thủ công; không deploy production.

## 8. Baseline đã biết trước khi Lần 1 sửa source

- Kích thước hiện tại:
  - `src/App.tsx`: 1.038 dòng.
  - `src/components/admin/AdminDashboard.tsx`: 5.410 dòng.
  - `server.ts`: 7.180 dòng.
  - `src/index.css`: 4.521 dòng, khoảng 1.836 `!important`.
- `AdminDashboard.refreshData()` hiện tải Vocab, Grammar, Listening, Movers
  Reading & Writing, Exam, Classes, Class Members, Assignments, Results,
  Leaderboard, Accounts và thêm Audit cho super-admin.
- Baseline tĩnh theo source: khoảng 11 nhóm request với teacher, 12 với
  super-admin. Contract test mới đã khóa đúng 11/12 và xác nhận không tăng sau
  refactor.
- Vocab/Grammar hiện phân trang ở client.
- Editor state hiện nằm tại `AdminDashboard`, vì vậy đổi tab không làm mất
  bản nháp dù JSX editor bị unmount.
- Môi trường shell hiện tại trước đợt này: Node 24.15.0; release baseline của
  dự án là Node 22.x. Native storage/startup gate phải xác minh dưới Node 22.
- Kết quả kiểm tra gần nhất trước yêu cầu triển khai:
  - `npm run lint`: pass.
  - `npm run test:security`: 15/15 pass.
  - `npm run test:performance`: 11/11 pass.

## 9. Kết quả Lần 1

### Kiến trúc đã triển khai

```text
AdminDashboard.tsx (compatibility controller, luôn được mount)
  ├── AdminShell.tsx
  ├── VocabularyLibraryPanel.tsx
  │     └── VocabularyResultsPanel.tsx
  ├── VocabularyEditorPanel.tsx
  └── LibraryPagination.tsx (dùng chung Vocab + Grammar)
```

- `AdminDashboard.tsx`: từ 5.410 xuống 4.197 dòng; toàn bộ state bản nháp,
  fetch, mutation và callback cũ vẫn nằm ở controller này.
- `AdminShell.tsx`: 230 dòng; sở hữu frame/sidebar/main và giữ nguyên ID, class,
  label, thứ tự tab, role condition và callback.
- `VocabularyLibraryPanel.tsx`: 227 dòng.
- `VocabularyResultsPanel.tsx`: 195 dòng.
- `VocabularyEditorPanel.tsx`: 921 dòng.
- `LibraryPagination.tsx`: 88 dòng, dùng lại cho Grammar và Vocabulary.
- Không file presentation mới nào có `fetch`, `authFetchJson`, `useEffect` hoặc
  persistence.

### Contract và test đã bổ sung/cập nhật

- Thêm `test:admin` và đưa vào `test:phase1`.
- `AdminShell.contract.test.ts` khóa:
  - compatibility entry và các DOM hook cũ;
  - controller luôn giữ draft khi tab UI unmount;
  - presentational component không fetch;
  - inventory request Admin 11/12;
  - action order `Play → Sửa → Sao chép → Kết quả → Xóa`;
  - semantic hook Vocabulary list/results/editor.
- Cập nhật contract test Bulk Import, Vocab Image và Exam Platform để đọc UI từ
  file sở hữu mới, không nới lỏng hành vi cũ.
- Cập nhật startup smoke với `VOCAB_IMAGE_DIR` và
  `LISTENING_TICKET_SECRET`, là hai production invariant server hiện đã yêu cầu;
  test vẫn dùng thư mục/database tạm.

### Gate sau thay đổi

- Chạy nguyên `npm run test:phase1` bằng Node 22.23.2: **pass**.
- Tổng cộng: **251 test pass, 0 fail** trong các nhóm Security, Performance,
  Identity, Grammar, Admin, Vocabulary Games, Vocabulary Images, TTS, Learning
  Runs, Movers, Exam Platform và native Storage.
- TypeScript/lint: pass.
- Production build: pass.
- Production startup smoke: pass (missing-file fail-closed, SQLite integrity,
  WAL, diagnostics, graceful shutdown và reopen).
- Build metric:
  - baseline Admin chunk: 183,14 kB; gzip 40,46 kB;
  - sau Lần 1: 187,45 kB; gzip 43,80 kB;
  - request count không đổi; thay đổi kích thước này được ghi nhận để theo dõi,
    chưa tối ưu/lazy-load trong Lần 1 vì đó là phạm vi Lần 2.

### Kiểm thử local không đụng dữ liệu thật

- Server local đã khởi động thành công trên một bản sao database nằm trong thư
  mục tạm; bản sao này đã được xóa sau khi kiểm tra.
- Môi trường Computer Use báo không có browser khả dụng, nên không giả lập click
  UI. Checklist teacher/super-admin, draft chuyển tab và các thao tác trực quan
  vẫn cần người dùng kiểm thử thủ công trước khi nghiệm thu Lần 1.
- Không tạo/sửa/xóa record trong database thật và không deploy.

## 10. Nhật ký thay đổi

### 2026-09-21 — Khởi tạo checkpoint

- Đánh giá kế hoạch ba lần: đồng ý triển khai.
- Điều chỉnh an toàn được chốt: Lần 1 chỉ tách UI Vocabulary; controller/state
  phải được mount ở cấp cha để giữ bản nháp khi đổi tab.
- Đã tạo `nangcap.md` trước mọi thay đổi source.
- Chưa sửa `AdminDashboard.tsx`, `App.tsx`, `server.ts`, CSS, API hoặc database.
- Bước tiếp theo: chạy/ghi baseline Lần 1, sau đó mới tạo ranh giới AdminShell.

### 2026-09-21 — Hoàn tất kỹ thuật Lần 1

- Ghi baseline: teacher 11 request group, super-admin 12 request group.
- Tách frame sang `AdminShell`, pagination sang component dùng chung và tách ba
  Vocabulary presentation panel; giữ state/controller tại compatibility entry.
- Bổ sung/cập nhật contract test và cập nhật `CODEMAP.md` mục 118.
- Phát hiện full gate chạy sai Node 24 gây ABI mismatch với `better-sqlite3` đã
  build cho Node 22; không rebuild dependency. Chạy lại đúng Node 22 theo
  `package.json`, toàn bộ `test:phase1` pass.
- Dừng đúng ranh giới Lần 1. Không thực hiện dashboard summary, lazy fetch,
  pagination server, targeted refresh, App/Home, CSS hoặc tách backend.
- Bước tiếp theo chỉ sau khi người dùng nghiệm thu: **Lần 2 — Dashboard summary
  + Vocabulary vertical slice data optimization**.

### 2026-09-21 — Phân loại lỗi trong lúc kiểm thử thủ công Lần 1

- Người dùng ghi nhận ba nhóm hiện tượng: tạo/phát audio báo thiếu
  `AI33_API_KEY/TTS_API_KEY`; tạo ảnh Stali báo không kết nối được; bảng vàng
  học sinh báo chưa sẵn sàng và nút xem/ẩn có độ tương phản thấp.
- Đã đối chiếu diff: `server.ts`, `src/index.css`,
  `StudentLearningArea.tsx` và `speech.ts` không bị thay đổi trong Lần 1.
- TTS: thao tác từ panel mới vẫn đi tới endpoint cũ; server trả lỗi cấu hình vì
  môi trường local không có `AI33_API_KEY`, `TTS_API_KEY` hoặc
  `YUPVOX_API_KEY`. Đây không phải lỗi nối props/handler của Lần 1.
- Stali: `STALI_API_KEY` và `STALI_BASE_URL` có cấu hình. Máy chủ truy cập được
  `api.stali.vn:443`, nhưng tiến trình localhost ban đầu chạy trong sandbox bị
  chặn kết nối ra ngoài. Đã khởi động lại localhost với quyền mạng để tiếp tục
  kiểm thử; không sửa code và không gọi tác vụ tạo ảnh thay người dùng.
- Bảng vàng: endpoint local trả `503 LEADERBOARD_NOT_READY` vì database kiểm
  thử chưa có readiness marker `leaderboard-read-model-v1`. Không tự chạy
  backfill khi server đang hoạt động và chưa có quy trình backup/quiesce.
- Độ tương phản nút xem/ẩn bảng vàng là vấn đề CSS/giao diện có sẵn, thuộc phạm
  vi Lần 3; không chỉnh CSS trong Lần 1.
- Kết luận: chưa phát hiện hồi quy thuộc Lần 1 trong các hiện tượng trên; không
  sửa source, API, database, storage hoặc CSS.

### 2026-09-21 — Bắt đầu Lần 2

- Người dùng đã cho phép tiếp tục Lần 2.
- Đã đọc lại `quytac.md`, kế hoạch ba lần, checkpoint, `package.json`, các phần
  kiến trúc/API/Admin/performance liên quan trong `CODEMAP.md` và source hiện
  tại trước khi sửa.
- Worktree Lần 1 được giữ nguyên; không commit, reset hoặc ghi đè thay đổi có
  sẵn.
- Baseline kiến trúc cần thay: mở Admin hiện gọi khoảng 11 nhóm request cho
  teacher và 12 cho super-admin; mọi mutation Vocabulary/Grammar/Class/
  Assignment/Account hiện còn có nhánh gọi `refreshData()` toàn cục.
- Bước tiếp theo: chạy baseline tự động, sau đó triển khai dashboard summary
  bằng API mới trong khi giữ toàn bộ API cũ hoạt động song song.

### 2026-09-22 — Hoàn tất kỹ thuật Lần 2

- Thêm lớp modular monolith `src/server/admin-data/` gồm contract,
  repository, service và router; mount tại `/api/admin` nhưng giữ toàn bộ API
  cũ để tương thích.
- Dashboard ban đầu chuyển từ 12 request/461.146 byte ở vai trò super-admin
  xuống 1 request `/api/admin/dashboard-summary`/1.831 byte trên bộ dữ liệu
  local hiện tại: giảm 91,7% số request và xấp xỉ 99,6% payload ban đầu.
- Vocabulary và Grammar dùng summary list có pagination/search/filter phía
  server; summary không chứa `items`/`questions`, detail chỉ đọc theo ID khi
  Edit, preview hoặc thao tác thực sự cần nội dung. Search có debounce 300 ms,
  request có abort và generation guard để bỏ response cũ.
- Classes/members, Assignments/options, Accounts và Audit được tải theo tab và
  phân trang phía server. Results/leaderboard và dependency của Listening,
  Movers, Writing, Exam chỉ tải khi đúng bề mặt cần. Dashboard không còn bật
  tất cả domain khi vừa vào Admin.
- `refreshData()` tương thích được giới hạn thành refresh Dashboard cộng đúng
  domain hiện tại/đang chỉnh sửa; mutation nhỏ không còn reload tất cả domain.
- Rule teacher được giữ nhất quán: assignment do giáo viên tạo hoặc thuộc lớp
  giáo viên quản lý đều xuất hiện trong danh sách và số đếm Dashboard; test hồi
  quy khóa cả hai nhánh này.
- Không đổi `App.tsx`, `appRoutes.ts`, CSS, DOM/class bố cục chủ đích, database
  schema, storage contract hay dữ liệu. Không chạy migration và không xóa dữ
  liệu. Lần 3 chưa bắt đầu.
- Test hẹp đã pass: `lint`, `test:admin-data` (5/5), `test:admin` (11/11),
  `test:security` (15/15), `test:performance` (11/11) và legacy integration
  (5/5). Full `test:phase2` bằng Node 22 đã pass, gồm toàn bộ Lần 1, build,
  startup, Admin data, History và legacy contracts.
- Máy có Node 24 đứng trước trong `PATH`; khi chạy gate/local phải đặt thư mục
  Node 22 (`modules=127`) lên đầu `PATH` để khớp binary `better-sqlite3`. Không
  rebuild hoặc thay dependency chỉ để né sai lệch môi trường này.
- Hai fixture legacy test được căn lại với contract đang tồn tại (`sourceId`/
  `sourceType` và từ mẫu `hello`); startup fixture dùng thư mục media tạm bắt
  buộc, không thay đổi hành vi production.
- Kết luận: dừng tại gate Lần 2 để người dùng kiểm thử thủ công. Lỗi thiếu khóa
  TTS, mạng Stali và tương phản Bảng vàng đã phân loại trước đó không bị trộn
  vào lần tối ưu dữ liệu này.
- Localhost đã được khởi động lại từ source mới nhất tại
  `http://localhost:3000`. Smoke API thực tế trả 200/JSON cho Dashboard,
  Vocabulary, Grammar, Classes, Assignments, Assignment options, Accounts và
  Audit; response Dashboard hiện tại là 1.831 byte.

### 2026-09-22 — Bắt đầu Lần 3

- Người dùng đã nghiệm thu Lần 2 và cho phép rõ ràng: “ok lần 2 và tiếp tục
  lần 3”.
- Đã đọc lại đầy đủ `quytac.md`, kế hoạch ba lần, `package.json`, toàn bộ
  `CODEMAP.md`, lịch sử Git và các ranh giới App/Home/CSS/server liên quan.
- Chốt thứ tự nội bộ Lần 3: khóa baseline/contract → tách App/Home và test →
  đổi lớp thị giác có scope và test → tách một lát backend an toàn và test →
  full gate Node 22 → cập nhật tài liệu/local test.
- Home hiện tìm kiếm cả metadata lẫn `term`, `meaning`, IPA, ví dụ, ghi chú và
  alias. Vì vậy Lần 3 giữ API Home đầy đủ hiện tại; không đổi sang summary nếu
  chưa có contract tìm kiếm tương đương phía server.
- Tại checkpoint này chưa sửa source Lần 3, chưa đổi CSS/API/database/storage và
  chưa deploy production.
- Baseline Node 22 trước thay đổi đã pass: `lint`; `test:security` 15/15 (gồm
  route parser/canonical-legacy URL); `test:performance` 11/11. Đây là mốc so
  sánh cho lát App/Home.

### 2026-09-22 — Hoàn tất kỹ thuật Lần 3

- `App.tsx` giảm từ 1.038 xuống 378 dòng và trở thành cổng điều phối. Route
  state/pushState/popstate được chuyển sang `useAppNavigation`; Home UI sang
  `HomePage`; fetch/state/search sang `useHomeController` và `homeSearch`.
- Home tiếp tục dùng payload đầy đủ vì tìm kiếm hiện hữu phải bao phủ cả term,
  meaning, IPA, part of speech, example, example meaning, notes và alias. Không
  hy sinh tính năng tìm kiếm để đổi sang summary chưa tương đương.
- Thêm lớp `Phase 3 scoped visual theme` cuối `index.css`, chỉ scope vào
  `#app-root`, `#admin-dashboard-container` và `#student-area-root`. Lớp này
  đổi palette/card/button/input/badge/shadow/focus; không đổi layout, grid,
  DOM, breakpoint, spacing lớn hoặc kích thước khối.
- Nút xem/ẩn Bảng vàng có nền amber đậm, chữ trắng, hover và focus ring rõ;
  contrast được khóa bằng test WCAG AA. Error/retry của Bảng vàng cũng có màu
  đọc được trên nền sáng.
- Tách 6 route Classes/Class Members cũ khỏi `server.ts` thành
  `src/server/classes/{router,service,repository}.ts`. Giữ nguyên URL, status,
  response, auth, staff role, teacher ownership, soft archive, audit và thu hồi
  share token của assignment; không đổi schema/database/storage.
- Kích thước sau Lần 3: `App.tsx` 378 dòng; `HomePage.tsx` 349;
  `useHomeController.ts` 140; `server.ts` 7.264; CSS 4.815 dòng. Build tạo
  `HomePage` thành lazy chunk riêng khoảng 20,03 kB (gzip 6,63 kB).
- Thêm `test:home`, `test:classes` và `test:phase3`. Một contract History cũ
  được cập nhật để kiểm tra nút ở file sở hữu mới; contract Listening Admin cũ
  được cập nhật tương tự cho Vocabulary panel. Đây là cập nhật đường dẫn kiểm
  tra, không nới lỏng hành vi.
- Full `npm run test:phase3` chạy bằng Node 22 đã **pass**: lint/TypeScript,
  security 15/15, performance 11/11, Home 9/9, Classes 2/2, History 27/27,
  legacy API 5/5, Listening 139/139, Exam 99/99, Movers 28/28, Admin 11/11,
  production build và startup smoke đều đạt. `git diff --check` sạch; `dist/`
  sinh bởi build đã được trả về đúng trạng thái trước test.
- Không thay đổi/xóa record thật, không migration, không thay router framework,
  không microservice/PostgreSQL/worker và không deploy production.
- Localhost source mới nhất đã chạy tại `http://localhost:3000` bằng Node
  22.23.2. Smoke read-only có local bypass trả 200 cho `/api/me`, Dashboard
  summary (1.831 byte), Vocabulary page, Classes và Class Members. Nguồn
  `index.html` giữ title UTF-8 đúng `Tiếng Anh Cô Diệu`.
- Computer Use không có browser khả dụng (`Browser is not available: iab`),
  nên không tự nhận đã kiểm tra trực quan. Bước còn lại là người dùng kiểm thử
  trên localhost theo checklist Lần 3 bên dưới.

## 11. Checklist người dùng kiểm thử Lần 1

- [ ] Đăng nhập/giả lập vai trò teacher: sidebar, tab và dữ liệu đúng scope.
- [ ] Đăng nhập/giả lập super-admin: có tab Audit và quản lý tài khoản đúng.
- [ ] Mở Kho từ vựng; search, filter và pagination hoạt động như cũ.
- [ ] Play/preview mở đúng URL hiện tại.
- [ ] Mở sửa một bộ từ; không cần lưu nếu chỉ kiểm thử draft.
- [ ] Tạo draft mới, nhập tiêu đề/nội dung, chuyển sang tab khác rồi quay lại:
  dữ liệu chưa lưu vẫn còn.
- [ ] Sao chép một bộ từ trên dữ liệu test và xác nhận danh sách refresh đúng.
- [ ] Mở Kết quả; filter tên/game, xem chi tiết và đóng panel.
- [ ] Nếu dùng dữ liệu test: thử Save một bộ từ và xác nhận audio/image/link như
  trước. Không dùng record production cho phép thử phá hủy.
- [ ] Kiểm tra nhanh desktop/mobile: bố cục, màu, class/style không đổi.
- [ ] Xác nhận không có request lặp bất thường trong Network.
- [x] Cho phép rõ ràng trước khi bắt đầu Lần 2.

## 12. Mẫu cập nhật checkpoint sau mỗi lát thay đổi

```text
Thời điểm:
Lần / bước:
Mục tiêu:
File đã sửa:
Hành vi/API/data/CSS có thay đổi không:
Test đã chạy và kết quả:
Request count/metric trước-sau:
Rủi ro hoặc blocker:
Bước tiếp theo:
```

## 13. Checklist người dùng kiểm thử Lần 2

- [ ] Vào Tổng quan: nội dung xuất hiện, Network chỉ gọi summary ban đầu và
  không tự tải toàn bộ kho dữ liệu.
- [ ] Mở Kho từ vựng: search/filter phân trang; Edit/Play/preview đúng record;
  Save hoặc Sao chép trên dữ liệu test chỉ refresh Vocabulary.
- [ ] Mở Kho ngữ pháp và kiểm tra search/filter/pagination/detail tương tự.
- [ ] Mở Lớp học: đúng lớp theo role và đúng thành viên của lớp được phép xem.
- [ ] Mở Giao bài: danh sách phân trang, dropdown vẫn có đủ lớp/bộ từ hợp lệ,
  Save trên dữ liệu test không làm tải lại các domain không liên quan.
- [ ] Với super-admin: Accounts/Audit phân trang và filter đúng; với teacher:
  không lộ dữ liệu ngoài scope.
- [ ] Mở Kết quả/Bảng vàng, Listening/Movers/Writing/Exam và xác nhận dữ liệu
  chỉ bắt đầu tải khi mở đúng tab/bề mặt.
- [ ] Chuyển tab khi đang có draft Vocabulary chưa lưu và xác nhận draft còn
  nguyên; màu sắc, bố cục, route và thao tác hiện hữu không đổi.
- [ ] Xác nhận không có request lặp, response cũ ghi đè search mới hoặc lỗi
  console bất thường.
- [x] Cho phép rõ ràng trước khi bắt đầu Lần 3.

## 14. Checklist người dùng kiểm thử Lần 3

- [ ] Trang chủ desktop/mobile giữ nguyên bố cục, thứ tự khu vực, route và thao
  tác; màu pastel/navy mới rõ chữ và không có chữ tiếng Việt lỗi mã hóa.
- [ ] Search Home vẫn tìm được theo tên bộ, mô tả, term, nghĩa, IPA, ví dụ, ghi
  chú và alias; filter lớp vẫn đúng.
- [ ] Đăng nhập/đăng ký, back/forward browser, `/history`, link private Vocab/
  Grammar, kho đề và các canonical/legacy URL vẫn hoạt động.
- [ ] Admin teacher/super-admin: sidebar, Dashboard, Vocab, Grammar, Classes,
  Assignments, Results, Accounts/Audit đúng quyền và không mất draft khi đổi tab.
- [ ] Lớp học: xem/tạo/lưu trữ lớp; thêm/xóa thành viên trên dữ liệu test; không
  dùng dữ liệu production cho thao tác phá hủy.
- [ ] Giao diện học sinh và game: card/button/input/badge, hover/focus/disabled/
  loading/error đều rõ; không có overlay che nút hoặc thay đổi kích thước khối.
- [ ] Bảng vàng: nút xem/ẩn rõ trên nền, trạng thái “đang chuẩn bị” và nút Thử
  lại dễ đọc. Readiness marker thiếu vẫn là dữ liệu môi trường, không tự backfill.
- [ ] Audio có sẵn phát được; tạo audio mới chỉ thử khi môi trường đã cấu hình
  `AI33_API_KEY`, `TTS_API_KEY` hoặc `YUPVOX_API_KEY`.
- [ ] Tạo ảnh Stali chỉ thử khi máy chủ có DNS/firewall/quyền mạng và API key;
  lỗi nhà cung cấp không được nhầm thành lỗi UI Lần 3.
- [ ] DevTools Network/Console: không request lặp bất thường, không lỗi runtime,
  không response cũ ghi đè search mới.

## 15. Bảo trì tổng thể sau ba lần nâng cấp — 2026-09-23

### Lỗi và nguyên nhân gốc

- Audio từ vựng không có file lưu sẵn phải dùng Web Speech API của trình duyệt.
  Lớp dùng chung trước đây luôn gọi `speechSynthesis.cancel()` ngay trước
  `speak()`, tạo race trên Chromium và làm utterance bị bỏ im lặng. Utterance
  cũng không được giữ tham chiếu; lỗi media phát sinh sau khi `audio.play()` đã
  resolve không kích hoạt fallback.
- Phiếu làm bài hết hạn bị kẹt do Exam có gia hạn nhưng client bắt mọi HTTP 410,
  còn Movers Reading & Writing và Listening hiển thị “có thể nộp lại” nhưng
  server không có endpoint gia hạn. Cả ba client vẫn phục hồi local run cũ nên
  người học không có đường thoát an toàn khi đã quá cửa sổ khôi phục.

### Thay đổi đã thực hiện

- `src/lib/game-engine/speech.ts` giữ utterance đang phát, chỉ hủy speech engine
  khi thật sự có speech cũ, chờ qua nhịp hủy trước khi phát mới và fallback cả
  khi `HTMLAudioElement` phát sự kiện `error`.
- Exam, Movers Reading & Writing và Listening cùng phân loại lỗi bằng mã máy
  chủ rõ ràng; chỉ gia hạn khi đúng mã phiếu hết hạn. Movers/Listening có thêm
  endpoint `attempts/renew`, cửa sổ khôi phục hữu hạn và kiểm tra owner,
  `runSecret`, set/version.
- Lượt đã được server ghi thành công vẫn trả kết quả idempotent dù phiếu trên
  trình duyệt vừa hết hạn; không tạo bài làm trùng.
- Nếu quá hạn khôi phục, nút Nộp bị khóa và có hành động “Lưu bản sao và bắt
  đầu lượt mới”. Bản sao chỉ chứa câu trả lời/metadata cần thiết, không chứa
  signed ticket hay `runSecret`, giữ tối đa 10 bản trong localStorage. Nếu lưu
  bản sao thất bại thì lượt cũ không bị thay thế.
- Lượt bắt đầu ở chế độ guest vẫn giữ đúng owner nếu người học đăng nhập giữa
  chừng trước khi gia hạn/nộp.

### Kiểm thử đã thêm/đã chạy

- [x] Web Speech không bị idle-cancel race.
- [x] File audio lỗi sau `play()` vẫn fallback đúng một lần.
- [x] Phân loại mã lỗi và lưu bản sao không chứa credential.
- [x] Movers: hết hạn → renew → submit; quá hạn khôi phục; replay idempotent.
- [x] Listening: hết hạn → renew → submit; quá hạn khôi phục; replay idempotent.
- [x] Exam: renew contract và replay idempotent với phiếu hết hạn.
- [x] `lint`, `test:vocab-games`, `test:runs`, `test:mover-reading`,
  `test:listening`, `test:exam-platform`.
- [x] Production build, startup smoke và full regression gate bằng Node 22.
- [x] Khởi động lại localhost từ source mới nhất và chạy HTTP smoke cuối: trang
  chủ 200, `/api/me` nhận đúng local super admin, Dashboard summary 200 và HTML
  được giải mã UTF-8 đúng.

## 16. Kế hoạch hoàn thiện modular hóa sau review QA — 2026-09-23

Mục tiêu của đợt này là hoàn thiện việc chia nhỏ ba khối còn lớn mà không đổi
API, URL, schema, quyền truy cập hoặc dữ liệu hiện hữu. Mỗi bước phải hoàn tất
test hẹp và regression trước khi chuyển bước kế tiếp.

### Bước 1 — Ổn định regression QA trước khi tách tiếp

Trạng thái: **hoàn thành ngày 2026-09-23**.

- [x] Ghi baseline `lint`, Admin/Home/performance tests trước khi sửa.
- [x] Sidebar quay lại Vocabulary Editor phải giữ nguyên draft chưa lưu.
- [x] Hành động “Soạn bộ từ mới” rõ ràng vẫn tạo editor sạch khi người dùng chủ
  động bắt đầu một bộ mới.
- [x] Save Vocabulary chỉ phát một request danh sách sau mutation; không gọi hai
  request `/api/admin/vocab-sets` giống nhau.
- [x] Sửa toàn bộ chuỗi mojibake xác định được trong source Vocabulary/TTS.
- [x] Không tự động sửa dữ liệu database đã mất ký tự thành `?`; ghi riêng yêu
  cầu backup/audit/migration cho dữ liệu legacy.
- [x] Tiêu đề Home không bị cắt ở viewport mobile 390 px.
- [x] Chặn `backdrop-filter` từ theme Glass cũ rò vào Home/Admin/Vocabulary
  Student Phase 3; chưa tái cấu trúc toàn bộ CSS ở bước này.
- [x] Bổ sung contract/regression test cho draft, request Save, mojibake, mobile
  hero và CSS containment.
- [x] Chạy test hẹp, `lint`, build cô lập, startup smoke và kiểm tra diff.
- [x] Cập nhật trạng thái, bằng chứng test và lỗi còn lại trước khi sang Bước 2.

### Bước 2 — Hoàn thiện chia nhỏ AdminDashboard theo domain

Trạng thái: **hoàn thành ngày 2026-09-23**.

- [x] Lập inventory state/effect/handler/DOM hook của từng domain trước khi di
  chuyển code.
- [x] Tách Grammar thành panel/controller riêng theo pattern Vocabulary.
- [x] Tách Classes + Class Members.
- [x] Tách Assignments và dependency options.
- [x] Tách Results + leaderboard.
- [x] Tách Accounts và Audit; giữ nguyên role guard teacher/super-admin.
- [x] Page/feature sở hữu fetch; component con chỉ hiển thị/phát event.
- [x] Không đổi route, ID, API contract, pagination, draft hoặc thứ tự thao tác.
- [x] Sau mỗi domain: chạy test hẹp, request inventory và kiểm thử draft/tab.
- [x] Gate kết thúc: `AdminDashboard.tsx` chỉ còn controller/shell orchestration
  ở mức hợp lý, không còn JSX lớn của từng domain.

#### Inventory khóa trước khi di chuyển code

| Domain | State/fetch owner giữ lại | Presentation boundary cần tách | DOM/API bất biến |
| --- | --- | --- | --- |
| Dashboard | `AdminDashboard` giữ summary, recent activity, leaderboard filters và lazy loaders | `dashboard/DashboardOverviewPanel` | `dashboard-tab-content`, hai expanded panel và các API summary/results hiện tại |
| Grammar | `AdminDashboard` giữ draft, parse/save/clone/delete/detail/results và `refreshGrammarData` | `grammar/GrammarLibraryPanel`, `grammar/GrammarEditorPanel` | `grammar-sets-tab-content`, `grammar-editor-tab-content`, action order và paged APIs |
| Classes | `AdminDashboard` giữ create/delete/member mutations và `refreshClassesData` | `classes/ClassManagementPanel` | `classes-tab-content`, `classes-grid`, class card IDs và sáu legacy class routes |
| Assignments | `AdminDashboard` giữ resource options, create/delete/preview và `refreshAssignmentsData` | `assignments/AssignmentManagementPanel` | `assignments-tab-content`, `assignment-creation-box`, link/token semantics và paged APIs |
| Results | `AdminDashboard` giữ lazy results/leaderboard fetch, filters và detail loader | `results/AdminResultsPanel` | `results-tab-content`, `activity-results-sheet`, `leaderboard-sheet/table` |
| Accounts | `AdminDashboard` giữ role/status/name mutations và scoped account loader | `accounts/AccountManagementPanel` | `users-tab-content`, role guards và `/api/admin/accounts-page` |
| Audit | `AdminDashboard` giữ super-admin loader/pagination | `audit/AuditLogPanel` | `audit-logs-tab-content`, super-admin guard và `/api/admin/audit-logs-page` |

Quy tắc ownership áp dụng cho toàn bộ inventory: panel không được gọi `fetch`,
`authFetchJson`, `useEffect` hoặc persistence; panel chỉ render props và phát
event. Mọi draft vẫn nằm trong controller đã mount nên đổi tab không reset.

### Nhật ký Bước 2

- 2026-09-23: Người dùng cho phép tiếp tục Bước 2. Đã đọc lại `quytac.md`,
  `package.json`, CODEMAP Admin/Phase 1-3 và source liên quan trước khi sửa.
- Worktree đang chứa toàn bộ thay đổi nâng cấp các bước trước; coi tất cả là dữ
  liệu của người dùng, không reset/reformat ngoài phạm vi.
- Đã bổ sung contract test trước khi tách. Test khóa tám presentation boundary,
  cấm `fetch`/`authFetchJson`/`useEffect` trong panel, giữ DOM hook và giữ draft
  Grammar trong controller đã mount.
- Đã tách `DashboardOverviewPanel`, hai panel Grammar, Classes, Assignments,
  Results, Accounts và Audit. `AdminDashboard.tsx` giảm từ khoảng 4.470 còn
  2.972 dòng nội dung (3.211 dòng vật lý nếu tính cả dòng trống); file này tiếp
  tục sở hữu state, effect, fetch, mutation, draft và overlay để tránh thay đổi
  vòng đời dữ liệu.
- Không đổi API, URL, schema, storage, quyền, pagination, thứ tự thao tác, CSS
  hoặc bố cục. Không có mutation database trong browser QA của bước này.
- Test hẹp sau từng nhóm đều đạt: Admin `16/16`, Grammar `13/13`, Classes `2/2`,
  Admin-data `5/5`, performance `11/11`; Listening đạt `139/139` sau khi cập
  nhật contract đọc Grammar UI từ file sở hữu mới.
- Browser QA tại localhost xác nhận Dashboard và các tab Grammar library/editor,
  Classes, Results, Accounts, Audit render đúng hook; request vẫn lazy theo tab,
  không có alert, `NaN` hay overflow ngang ở viewport 390 px. Assignments không
  được tự ý thêm vào sidebar vì đó là thay đổi bố cục chưa được người dùng duyệt.
- Full gate `npm run test:phase3` chạy bằng Node `22.23.2` kết thúc mã `0`, gồm
  lint, production build, startup smoke, storage/SQLite, security, performance,
  API/legacy contracts, Home, Admin, Classes và Listening. Lần chạy bằng Node 24
  trước đó chỉ lỗi ABI của `better-sqlite3`; khóa PATH về Node 22 xác nhận source
  không có regression.
- Bước đang làm: **Bước 4 hoàn thành; kế hoạch chia nhỏ 4/4 đã đóng kỹ thuật,
  chưa deploy production**.

### Bước 3 — Hoàn thiện chia nhỏ server.ts theo router/service/repository

Trạng thái: **hoàn thành kỹ thuật ngày 2026-09-24; chưa deploy production**.

- [x] Lập inventory toàn bộ route còn khai báo trực tiếp trong `server.ts`.
- [x] Khóa API/status/error/auth/audit contracts bằng integration tests.
- [x] Chuyển từng domain theo thứ tự ít rủi ro trước; không đổi endpoint.
- [x] Router chỉ parse/validate HTTP; service giữ nghiệp vụ; repository giữ truy
  cập SQLite/Firestore.
- [x] Giữ transaction, idempotency, archive semantics và quyền role hiện tại.
- [x] Không migration dữ liệu nếu chưa có backup/preflight/rollback riêng.
- [x] Sau mỗi domain: security, performance, legacy integration và startup smoke.
- [x] Gate kết thúc: `server.ts` không còn khai báo route trực tiếp; tập trung
  bootstrap, middleware, router mount và các helper/provider tương thích được
  inject vào domain service.

#### Inventory khóa trước khi di chuyển route

Baseline trước Bước 3: `server.ts` có khoảng 6.659 dòng và còn các domain khai
báo route trực tiếp dưới đây. Các router đã tách trước (`learning-history`,
`listening-library`, `vocab-images`, `admin-data`, `classes`, Movers Listening,
Movers R&W và Exam Platform) là pattern tham chiếu và không bị viết lại.

| Domain trực tiếp còn lại | Route/contract phải giữ | Ranh giới dự kiến |
| --- | --- | --- |
| Diagnostics | `/api/auth/debug`, `/api/diagnostics/storage`; diagnostic secret và response hiện tại | router nhỏ, repository đọc storage |
| Auth/Profile | phone login, `/api/me`, `/api/register` | router → service → repository/provider auth |
| Guest identity | resolve/identify, capability và timing | router → service, dùng identity repository hiện hữu qua injection |
| Vocabulary AI | IPA, vocab detail, generate | router → service/provider; giữ fallback và limiter |
| Vocabulary/TTS | public/private/list/save/archive/clone, preview/batch/status/generate | router → service → repository; giữ managed image/audio metadata |
| Assignments | list/create/archive | router → service → repository; giữ token, class/resource ownership và audit |
| Grammar | set CRUD/share/preview/results và attempt lifecycle | router → service → repository; giữ snapshots, token, grading và idempotency |
| Vocabulary runs | activate/lazy-complete/actions/submit/pronunciation | router → service → repository; giữ atomic batch, run secret và leaderboard/history projection |
| Results/leaderboard | public/staff summary/detail/leaderboard | router → service → repository; giữ pseudonymization, scope, bounded reads và timing |
| Accounts/Audit | directory, rename, role/status, recovery capability, audit list | router → service → repository; giữ teacher/super-admin guards và custom claims |

Thứ tự triển khai: Assignments → Diagnostics/Auth/Guest/AI → Vocabulary/TTS →
Grammar → game sessions → Results/Leaderboard → Accounts/Audit. Domain có
transaction/idempotency/answer key được làm sau khi các boundary ít rủi ro đã
chứng minh pattern. Không migration hoặc ghi dữ liệu production trong bước này.

### Nhật ký Bước 3

- 2026-09-23: Người dùng duyệt Bước 3. Đã đọc lại toàn bộ `quytac.md`,
  `CODEMAP.md`, `package.json`, source route, test và lịch sử Git liên quan.
- Baseline Node 22 trước sửa đạt: security `15/15`, performance `11/11`, legacy
  integration `5/5` và startup smoke. Localhost hiện hữu không bị dừng.
- Lát đầu tiên: Assignments, vì đủ ownership/token/archive/audit để kiểm chứng
  kiến trúc nhưng không chạm attempt, grader, history hoặc transaction học tập.
- Đã hoàn thành 12 boundary có contract test riêng: Assignments, Diagnostics,
  Auth/Profile, Guest Identity, Vocabulary AI, Vocabulary, TTS, Grammar Library,
  Grammar Attempts, Vocabulary Runs/Pronunciation, Results/Leaderboard và
  Accounts/Audit. Các boundary có sẵn như Admin Data, Classes, History,
  Listening, Movers và Exam tiếp tục được mount qua router hiện hữu.
- `server.ts` giảm từ baseline khoảng 6.659 xuống 3.712 dòng vật lý. Lệnh kiểm
  tra `app.get/post/put/patch/delete` trực tiếp trả về 0 kết quả. Phần còn lại
  chủ yếu là bootstrap, middleware, wiring và helper/provider tương thích được
  truyền vào service; không ép di chuyển helper dùng chung nếu việc đó làm thay
  đổi contract trong cùng checkpoint.
- Transaction/batch write, idempotency, run secret, archive/share-token,
  answer-key, role/ownership, audit và bounded-read được giữ nguyên. Không có
  migration schema, ghi dữ liệu production, deploy, đổi CSS hay đổi bố cục.
- `test:server-domains` khóa 12 domain với `41/41` test. Contract test cũ được
  trỏ tới owner mới thay vì nới lỏng điều kiện kiểm tra.
- Full gate `npm run test:phase3` bằng Node `22.23.2` kết thúc mã `0`: lint,
  production build, startup/storage smoke, security `15/15`, performance
  `11/11`, legacy `5/5`, Admin Data `5/5`, Storage `5/5`, Listening `139/139`,
  Movers `28/28`, Exam `99/99` và toàn bộ suite phụ thuộc đều pass.
- Artefact `dist` sinh bởi build đã được hoàn nguyên về nội dung trước kiểm
  thử; `git diff --name-only -- dist` rỗng. Localhost hiện hữu không bị dừng.
- Checkpoint cuối 2026-09-24: cổng 3000 không còn tiến trình nên đã khởi động
  lại bằng `dev:local`, Node 22 và local-auth chỉ dành cho loopback. HTTP smoke
  chỉ đọc đạt `200` cho public Results/Vocabulary/Grammar, `/api/me`, Dashboard
  Summary và Accounts page. Leaderboard Summary trả đúng trạng thái có chủ đích
  `503 LEADERBOARD_NOT_READY` vì projection của fixture local chưa sẵn sàng;
  không có exception server và không thực hiện mutation.
- Checkpoint tiếp theo: chỉ bắt đầu Bước 4 sau khi người dùng duyệt; Bước 4 mới
  được phép inventory/hợp nhất các thế hệ CSS và vẫn phải giữ nguyên DOM/layout.

### Bước 4 — Hợp nhất và chia lớp CSS theo bề mặt

Trạng thái: **hoàn thành kỹ thuật ngày 2026-09-24; chưa deploy production**.

- [x] Inventory selector toàn cục, `!important`, pseudo-layer và specificity.
- [x] Chốt import order: tokens/base → shared components → Home → Admin →
  Student → Exam/Listening.
- [x] Tách CSS theo bề mặt nhưng giữ nguyên DOM/layout đã duyệt.
- [x] Loại dần Dark Glass/global override cũ thay vì tiếp tục append override.
- [x] Không để CSS Home/Admin ảnh hưởng hitbox hoặc trang thi.
- [x] Thêm computed-style/visual regression desktop và mobile, không chỉ regex
  source.
- [x] Kiểm tra contrast, focus, hover, disabled, loading, error và overflow.
- [x] Gate kết thúc: không còn hai thế hệ theme cùng điều khiển một component;
  `index.css` chỉ còn entry/import và base thực sự dùng chung.

### Nhật ký Bước 4

- 2026-09-24: Người dùng duyệt Bước 4. Đã đọc lại `quytac.md`, `CODEMAP.md`,
  `package.json`, toàn bộ entry CSS, các contract test và source của bốn bề mặt
  trước khi sửa.
- Inventory xác nhận nhận định “hai lớp giao diện” là có cơ sở: đầu file cũ có
  một thế hệ Dark Glass với pseudo/background/blur và selector button rộng,
  trong khi các block Light/Phase 3 phía sau tiếp tục ghi đè cùng component.
  Baseline `index.css` là 4.823 dòng, 1.945 lần `!important` và 156 khai báo
  `backdrop-filter`/`-webkit-backdrop-filter`.
- `src/index.css` nay chỉ còn 8 dòng import theo thứ tự cố định. CSS được giao
  cho sáu owner: `tokens-base.css`, `shared-components.css`, `home.css`,
  `admin.css`, `student.css`, `exam-listening.css`. Home/Admin/Student không
  được phép chạm root của bề mặt anh em; Exam/Listening giữ riêng các contract
  hitbox, player và authoring nhạy cảm.
- Đã xóa thế hệ Dark Glass, `body::before`, các class `glass-*` và selector
  button Glass toàn cục. Các rule shared còn lại là một lớp chuẩn hóa light và
  accessibility duy nhất; palette cuối của từng bề mặt thuộc file owner tương
  ứng, không phải một theme cũ nằm mờ phía dưới.
- Tổng sáu file owner hiện khoảng 3.902 dòng, 1.828 lần `!important` và 139 khai
  báo backdrop. Phần lớn specificity còn lại thuộc các contract Exam/Listening
  và utility legacy đang được test bảo vệ; không xóa máy móc trong đợt này vì có
  thể làm sai hitbox, trạng thái đáp án hoặc nội dung đã phát hành.
- Không đổi DOM, bố cục, route, API, schema, storage, auth/role/ownership hoặc dữ
  liệu. Không mutation database trong browser QA. Build artifact dưới `dist`
  được hoàn nguyên sau kiểm thử; localhost local-auth chỉ dành cho loopback vẫn
  được giữ chạy.
- Contract CSS đọc đúng bundle import qua `src/styles/cssTestUtils.ts`; Home
  đạt `12/12`, Admin `16/16`, Movers `28/28`, Exam `99/99`, Listening
  Contrast `11/11` và Listening `139/139`. `lint` và production build đều đạt.
- `scripts/css-browser-smoke.mjs` bổ sung computed-style QA độc lập tại desktop
  1440 px và mobile 390 px cho Home/Admin/Student. Kết quả: không overflow ngang,
  mọi button đã kiểm tra có backdrop `none`, `body::before` không còn content,
  hero và game stage không blur; nút Bảng vàng giữ hover nâu đậm, chữ trắng và
  focus outline 3 px. Sáu ảnh chụp đã được kiểm tra trực quan, không còn lớp cũ
  mờ phía dưới hay nội dung bị cắt ở mobile.
- Full gate `npm run test:phase3` bằng Node `22.23.2` kết thúc mã `0`, gồm lint,
  security, performance, identity, Grammar, Admin, Vocabulary, TTS, recovery,
  Movers, Exam, SQLite/storage, production build, startup smoke, Admin Data,
  History, legacy contracts, Home, Classes, Assignments, server domains và
  Listening. Một lần chạy bằng Node 24 dừng do ABI `better-sqlite3` 137/127;
  chạy lại đúng Node 22 xác nhận đây là lỗi môi trường, không phải regression.
- Checkpoint cuối: **Bước 4 hoàn thành; kế hoạch chia nhỏ 4/4 hoàn thành kỹ
  thuật, chưa deploy production**.

### Nhật ký Bước 1

- 2026-09-23: Người dùng duyệt kế hoạch bốn bước và yêu cầu bắt đầu Bước 1.
- Phạm vi dữ liệu: không sửa database production; CRUD test chỉ được dùng bản
  sao cô lập hoặc fixture.
- Baseline trước sửa: `lint` đạt; Admin `11/11`, Home `9/9`, performance
  `11/11` đều đạt.
- Contract test được bổ sung trước cho ba regression: giữ draft khi đổi tab,
  không tải lặp danh sách sau Save và không để mojibake quay lại. Home có thêm
  contract cho mobile hero và CSS blur containment.
- `AdminShell` nay chỉ đổi tab khi quay lại editor; chỉ các CTA “Soạn bộ từ
  mới” mới chủ động gọi reset draft. Không đổi URL, API, schema hoặc quyền.
- Sau Save Vocabulary, controller chỉ refresh dashboard summary; effect của tab
  danh sách sở hữu đúng một lần fetch `/api/admin/vocab-sets`.
- Đã sửa các nhãn TTS/Vocabulary bị mã hóa sai trong source và chỉ chuẩn hóa nhãn
  legacy `L?p ...` khi hiển thị. Dữ liệu nội dung đã mất ký tự thành `?` trong
  database không bị suy đoán hay ghi đè; cần backup + audit + migration riêng.
- Home 390 px đã được kiểm tra thực tế: tiêu đề xuống dòng, không overflow.
  Home/Admin/Student được kiểm tra computed style và đều có
  `backdrop-filter: none` trên button Phase 3.
- Browser QA xác nhận: draft được giữ khi quay lại bằng sidebar; CTA tạo mới cho
  editor sạch; Save giả lập phát một POST, một summary GET và đúng một vocab-list
  GET; không có mutation database trong phiên QA này.
- Kết quả sau sửa: Admin contract `14/14`, Home contract `11/11`, `lint` đạt.
  Full gate `npm run test:phase3` chạy bằng Node `22.23.2` kết thúc mã `0`, gồm
  production build, startup smoke, storage/SQLite, API/legacy contracts, Home,
  Admin, learning history, classes và Listening (`139/139`).
- Artefact hash trong `dist` do build kiểm thử sinh ra đã được hoàn nguyên; diff
  nội dung của `dist` bằng rỗng. Localhost hiện hữu không bị dừng.
- Checkpoint cũ: **Bước 1 hoàn thành; sau đó người dùng đã duyệt và Bước 2 đã
  được thực hiện ở nhật ký phía trên**.

## Bổ sung sau nâng cấp: sửa Bảng vàng học sinh - 2026-09-24

- [x] Tái hiện lỗi trên localhost: summary trả `503
  LEADERBOARD_NOT_READY` trong khi endpoint tương thích vẫn đọc được kết quả
  cũ với `200`; xác nhận lỗi nằm ở readiness boundary, không phải do
  học sinh không có điểm.
- [x] Giữ đường nhanh `leaderboard_events` là ưu tiên; khi marker chưa sẵn
  sàng thì chỉ sau thao tác `Xem bảng vàng` mới chạy fallback đọc-only từ
  nguồn cũ. Không ghi database, không tự backfill và không tự đặt marker.
- [x] Sửa `Thử lại` dùng refresh key thật sự; thêm `aria-expanded` và
  trạng thái DOM để browser test theo dõi đúng chu kỳ request.
- [x] Khóa visual nút `Xem/Ẩn bảng vàng`: nền `#b45309`, chữ trắng,
  opacity `1`, không filter; không đổi bố cục hay breakpoint.
- [x] Contract test cho service fallback, performance boundary, retry UI và CSS
  đều đạt. Browser smoke xác nhận cả desktop/mobile không overflow, nút
  không mờ, API chuyển `ready` và hiển thị được dòng xếp hạng local.
- Trạng thái: **đã sửa và xác minh trên localhost; chưa deploy
  production. Backfill production vẫn nên thực hiện theo quy trình backup/quiesce
  để loại chi phí fallback khi nhiều người cùng mở bảng.**

## Bổ sung sau nâng cấp: bộ lọc Luyện ngữ pháp - 2026-09-24

- [x] Tách state tìm kiếm/lớp của Ngữ pháp khỏi state của Từ vựng; hai danh mục
  không còn lọc lẫn nhau.
- [x] Thêm ô `Tìm bài ngữ pháp theo tên...` và dropdown `Tất cả khối lớp` tại
  giao diện học sinh; danh sách lớp có cả lớp mặc định, lớp đã tải và
  `gradeLevel` thực tế của bài Grammar.
- [x] Giữ nguyên endpoint, route, dữ liệu, visibility `public` và thao tác mở bài
  ngữ pháp.
- [x] Home contract đạt 13/13, lint đạt; browser QA desktop 1440 px/mobile 390 px
  xác nhận tiêu đề không bị ngắt chữ, control không tràn ngang và trên mobile cả
  hai control cùng rộng 358 px.

## Bổ sung sau nâng cấp: danh sách bài học công khai - 2026-09-24

- [x] Bỏ hai dòng hướng dẫn dưới tiêu đề `Luyện từ vựng` và `Luyện ngữ pháp`;
  bỏ hoàn toàn badge đếm số bài Grammar.
- [x] Thay card công khai của cả hai danh mục bằng một cấu trúc danh sách dùng
  chung gồm `STT`, `Tên`, `Khối lớp`, `Chủ đề`, `Thao tác`.
- [x] Nút mở bài giữ nguyên callback/luồng điều hướng, chỉ đổi phần trình bày
  thành biểu tượng Play kèm chữ `Học Bài`.
- [x] Giữ nguyên tìm kiếm, lọc lớp, visibility `public`, empty state, API,
  route, schema và dữ liệu. Không xóa mô tả/tác giả/số từ/số câu khỏi record;
  chỉ không còn hiển thị các trường ngoài yêu cầu trong danh sách Home.
- [x] Danh sách có cột đồng đều trên desktop và chuyển sang hàng gọn có nhãn
  trên mobile; nút Vocabulary/Grammar có màu riêng, opacity `1` và không filter.
- Trạng thái: **đã triển khai trong source và bổ sung contract/browser QA;
  chưa deploy production**.

## Bổ sung sau nâng cấp: hero Trang chủ tách riêng chữ và ảnh - 2026-09-24

- [x] Giữ hero trong một khung chung và hai owner DOM rõ ràng:
  `home-hero-copy` là lớp nội dung trên (`z-index: 2`), `home-hero-media` là lớp
  ảnh phủ toàn bộ bề mặt phía dưới (`position: absolute`, `z-index: 0`).
- [x] Desktop dùng ảnh làm lớp thị giác toàn khung và mask liên tục từ rất nhẹ
  dưới vùng chữ tới rõ dần phía phải. Tablet/mobile vẫn dùng cùng lớp media,
  nhưng ảnh neo xuống đáy và chuyển mềm theo chiều dọc.
- [x] Bỏ hoàn toàn card, viền, nền và bóng riêng của ảnh. Chỉ đường bao của toàn
  hero còn hiển thị; không tồn tại đường chia trái–phải hoặc trên–dưới.
- [x] Loại bỏ hoàn toàn badge `Game hóa Từ vựng tiếng Anh đột phá`, bao gồm
  icon/import và toàn bộ CSS không còn sử dụng.
- [x] Thu nhỏ và thiết kế lại heading thành các nhịp navy–coral–teal: coral nhấn
  `thật vui`, teal nhấn thương hiệu, vệt nền mềm thay cho gạch chân cứng. Font
  dùng `clamp()` và xuống dòng riêng cho mobile để giữ chất trẻ, rõ và hiện đại.
- [x] Ảnh lớp học do người dùng cung cấp được lưu tại
  `public/home-classroom-achievement.png`, có alt text; mobile giữ khung 4:3,
  desktop dùng `object-fit: cover` trong vùng ảnh tràn mép của hero.
- [x] Không thay đổi route, API, dữ liệu, hành vi tìm kiếm, danh sách bài học,
  Bảng vàng hay breakpoint chức năng hiện hữu.
- [x] Home contract đạt 14/14, lint đạt; browser QA tại 1440 px và 390 px xác
  nhận media phủ bề mặt hero, copy nằm ở lớp trên, ảnh không có card riêng và
  không overflow ngang.
