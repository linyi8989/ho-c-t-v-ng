# Cambridge & IELTS — cảnh làng dùng chung

Bảy trang `/exams/starter`, `/exams/mover`, `/exams/flyer`, `/exams/ket`, `/exams/pet`, `/exams/fce`, `/exams/ielts` dùng cùng giao diện Starters đã duyệt: bảng tên gỗ, chữ vàng, biển hiệu trên nhà, thẻ bài linh vật và năm hàng có thể cuộn trong mỗi sân. Mỗi trang giữ tên/cấp riêng theo manifest hiện có. Không có bài thì sân trống; đang tải và lỗi vẫn có trạng thái/thử lại.

Starters/Movers/Flyers/KET dùng hai nhà Listening và Reading & Writing. PET/FCE dùng ba nhà Listening, Reading, Writing. IELTS cũng dùng ba nhà vì hệ thống có Listening, Academic Reading, Academic Writing. Không thêm kỹ năng hoặc thay đổi cấu trúc/đáp án/chấm điểm của đề.

Biển gỗ **Home** về `/`, **History** mở `/history`. **Previous/Next** đi theo chuỗi Starters → Movers → Flyers → KET → PET → FCE → IELTS; hai đầu chỉ hiện hướng tồn tại. Bốn biển desktop xếp 2×2 để không che nhà. Trên điện thoại biển luôn nằm phía trên cảnh, các nút kỹ năng chuyển vùng nhìn tới đúng sân. Link bài giữ modifier click/mở tab mới, nhãn accessible, tooltip toàn bộ tên, focus và giảm chuyển động.

## Danh sách quản trị

Dashboard → Kho đề luyện thi → chọn cấp → **Danh sách link học sinh**. Chọn kỹ năng, thêm/xóa/chọn bộ đề công khai, ↑/↓ đổi thứ tự, **Lưu danh sách**. Không khóa số bài: 25 bài là 25 link, 31 bài là 31 link; request tối đa 1.000 link. Xóa link không xóa đề. Giáo viên sửa link của mình, admin sửa toàn bộ; danh sách người khác được giữ nguyên theo quyền của B.

Khi chưa lưu danh sách: đọc các bài đã xuất bản công khai trong kho, không ghi settings hoặc seed dữ liệu. Khi đã lưu: giữ đúng số/thứ tự được chọn, kể cả danh sách rỗng. Bài chuyển về nháp, private, archived hoặc bị xóa không xuất hiện trên sân. Các URL bài, published version, identity, prepare/save/submit/review/History hiện có giữ nguyên.

## API, storage và tương thích

`starterSceneRouter.ts` hiện xử lý cả bảy cấp:

| API | Quyền |
| --- | --- |
| `GET /api/exam-platform/scenes/:moduleId` | Công khai; chỉ id/title/href + revision/configured |
| `GET /api/exam-platform/admin/scenes/:moduleId/:paperId` | Giáo viên/admin |
| `PUT /api/exam-platform/admin/scenes/:moduleId/:paperId` | Giáo viên/admin; `{baseRevision, entries:[{id,setId}]}` |

Endpoint Starter cũ `/starter-scene` và `/admin/starter-scene/:paperId` vẫn hoạt động, cùng khóa/revision với endpoint mới. Document settings giữ mẫu `{moduleId}-scene-{paperId}-v1`, schemaVersion 1; Starter giữ đúng hai key cũ. Không thêm bảng hoặc migration. Bộ khóa trong tiến trình theo module/paper và revision trả 409 chống ghi đè đồng thời; triển khai nhiều worker cần transaction chung trước khi mở rộng.

Các cấp generic đọc `exam_sets` theo module/paper. Movers đọc `listening_sets` và `mover_reading_sets`; bản legacy thiếu moduleId được xem là Movers theo adapter hiện có, không rewrite. ID giống nhau ở hai kho Movers được xử lý riêng từng paper. Catalog không đưa answer key, owner ID, share token hoặc draft xuống học sinh.

## Asset và xem mẫu local

- Hai nhà dùng `public/assets/backgrounds/bg-starters-scene.webp` đã duyệt.
- Ba nhà: `public/assets/backgrounds/bg-exams-three-yards-v1.webp`, 1672×941, 354.856 byte; SHA256 `fc649d7ed039919834f72b3e346eb4be7df9c5cc72b424a787fdf7e6617bd5db`.
- Tạo bằng built-in **imagegen**, chỉnh từ nền Starters; bản PNG và prompt tại `output/imagegen/bg-exams-three-yards-v1.png` và `.prompt.md`. Chỉ chuyển sang WebP bằng Pillow, không sửa/cắt nền bằng code. Không có chữ/UI trong background; bảng/nhãn/link là HTML/SVG và asset riêng.
- Các asset bảng gỗ, sprite thẻ bài và font Baloo 2/Nunito cũ được dùng chung.

Mở `http://localhost:3000/exams/pet?preview=links` (hoặc bất kỳ cấp nào) ở dev loopback để xem 25 bài mẫu mỗi sân. Không gọi API catalog, không ghi settings hoặc tạo attempt; click bài mẫu không mở đề. Production loại helper và luôn đọc bài thật dù query được thêm.

Kiểm thử: `npm run test:starter-scene` bao gồm suite Starters cũ và suite bảy cấp; `npm run test:exam-scenes-browser` kiểm tra shared page/admin ở năm kích thước; `npm run test:starter-scene-browser` kiểm tra toàn app và hai player Starters hiện có. Checklist tại `docs/exam-scenes-checklist.md`; báo cáo trong `.data/exam-scenes-*`.

## File thay đổi trong lần triển khai này

- `src/features/starter-scene/`: `types.ts`, `api.ts`, `sceneDefinition.ts` (mới), `StarterScenePage.tsx`, `StarterSceneAdmin.tsx`, `HouseSign.tsx`, `SignpostNavigation.tsx`, `linkPreview.ts`, `starter-scene.css`.
- `src/features/listening-library/student/ListeningModulePage.tsx`, `src/features/listening-library/admin/ListeningModuleRouter.tsx`.
- `src/server/exam-platform/starterSceneRouter.ts`, `examScenes.test.ts` (mới).
- `scripts/exam-scenes-browser-smoke.mjs` (mới), `scripts/starter-scene-browser-smoke.mjs` (một assertion điều hướng Movers), `package.json` (hai script kiểm thử).
- Asset WebP, PNG và prompt ba nhà nêu trên; `docs/exam-scenes.md`, `docs/exam-scenes-checklist.md` (mới), `docs/starter-scene.md`, `CODEMAP.md`.

Rollback: bảo vệ thay đổi mới, lấy source trước sửa từ `.data/exam-scenes-before`, bỏ nhánh scene cho các cấp tương ứng rồi build chuẩn. Không restore đè DB; settings mới có thể giữ lại khi UI cũ chạy. Chưa deploy production.
