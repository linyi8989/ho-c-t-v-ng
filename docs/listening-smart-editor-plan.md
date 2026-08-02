# Kế hoạch triển khai Listening Smart Editor

## 1. Trạng thái tài liệu

- Trạng thái: đã triển khai code cho Mover Parts 1-5 và hoàn thành các cổng tự động liên quan; còn UAT trình duyệt và cấu hình production trước khi phát hành.
- Phạm vi đầu tiên: module Mover đang hoạt động.
- Điều kiện bắt đầu sửa code: đã nhận và xác nhận logic chi tiết của từng Part.
- Nguyên tắc phát hành: Smart Editor là lớp hỗ trợ tạo bản nháp; không thay thế hoặc làm gián đoạn editor, player, grader và dữ liệu Mover đang hoạt động.

## 2. Mục tiêu

Xây dựng một Smart Editor dùng chung để giáo viên có thể:

- Tải lên nhiều ảnh, audio hoặc nhập nội dung đề.
- Gán tài nguyên cho từng Part.
- Dùng code, AI hoặc kết hợp để trích xuất dữ liệu cần thiết.
- Phân tích riêng một Part hoặc điều phối phân tích toàn bộ năm Part.
- Part 1/2/3 điền trực tiếp dữ liệu đã validate vào working draft để giáo viên chỉnh tại form chính; Part 4-5 dùng trường staged/editable trước khi merge.
- Autosave bản nháp, undo/redo, validation, preview và publish.
- Phân tích lại một Part mà không thay đổi dữ liệu các Part còn lại.

## 3. Các bất biến phải giữ

1. Giữ tương thích với bộ đề, URL, ID, share token, asset reference và attempt Mover hiện tại.
2. Không thay đổi grader, published snapshot hoặc API học sinh nếu không có yêu cầu nghiệp vụ bắt buộc.
3. Published version là bất biến; mọi chỉnh sửa tiếp tục thực hiện trên working draft.
4. Không đưa API key, prompt nội bộ hoặc logic chấm điểm sang frontend.
5. Student API không được lộ đáp án. Admin editor chỉ nhận dữ liệu đáp án trong phạm vi đã xác thực và được phép quản lý.
6. AI không được tự publish. Part 1/2/3 được direct-import sau kiểm tra `basePartHash`; Part 4-5 tiếp tục yêu cầu merge candidate thủ công.
7. Mỗi Part có extractor, schema, normalize, validation và merge rule riêng.
8. Không ép Part cùng số của Starter, Mover, Flyer và KET dùng chung cấu trúc nếu nghiệp vụ khác nhau.
9. Một Part lỗi không được làm mất kết quả của Part khác.
10. Không xóa hoặc viết lại dữ liệu lịch sử chỉ để phục vụ Smart Editor.
11. Không bao giờ dùng audio hoặc transcript tạo từ audio để trích xuất/suy luận đáp án. Audio chỉ là tài nguyên được upload, gắn vào Part và phát trong bài nghe.
12. Dữ liệu AI điền vào editor luôn có thể sửa và phải được giáo viên/admin xem lại trước khi publish; form chính của Part 1/2 là bề mặt review.

## 4. Hiện trạng có thể tái sử dụng

- `src/features/listening/types.ts`: schema dữ liệu Mover 5 Part.
- `src/features/listening/admin/ListeningAdminModule.tsx`: editor/wizard hiện tại.
- `src/features/listening/admin/ListeningAssetPicker.tsx`: upload và chọn media.
- `src/features/listening/admin/ListeningRegionEditor.tsx`: vẽ vùng tương tác chuẩn hóa 0-1.
- `src/features/listening/student/ListeningPartViews.tsx`: renderer học sinh.
- `src/server/listening/listeningValidation.ts`: validation trước publish và sanitizer.
- `src/server/listening/listeningGrader.ts`: chấm điểm server-side.
- `src/server/listening/listeningRouter.ts`: asset, draft, publish, prepare và submit.
- `src/features/listening-library/registry.ts`: manifest module dùng chung.
- `src/features/listening-library/clientRegistry.ts`: adapter frontend.
- `src/server/listening-library/registry.ts`: adapter backend.
- `server.ts`: xác thực, mount router và provider AI hiện có.

## 5. Khoảng trống hiện tại

- Editor hiện tại là một component lớn, chưa có Editor Shell và Part Handler thật sự.
- Chưa có autosave toàn draft và chưa có optimistic concurrency/draft revision.
- Undo chỉ tồn tại cục bộ trong Region Editor.
- Chưa có resource tray, batch upload và gán nhiều tài nguyên theo Part.
- AI hiện tại chủ yếu là text prompt; chưa có pipeline multimodal cho ảnh/audio Listening.
- Chưa có candidate staging, diff, review, confidence, evidence hoặc merge confirmation.
- Validation từng Part chưa được công khai qua server handler registry.
- Chưa có kiểm thử bảo đảm merge một Part không thay đổi bốn Part còn lại.
- Các trường `example` chưa được editor/player hỗ trợ đầy đủ.
- Part 5 được xác nhận giữ đúng năm câu `colour` như source hiện tại; không thêm `write`, nên không cần đổi schema/grader vì nội dung viết.

## 6. Kiến trúc mục tiêu

### 6.1. Listening Editor Shell

Chịu trách nhiệm:

- Thông tin chung của đề.
- Điều hướng Part.
- Working draft và draft revision.
- Autosave, undo/redo và trạng thái dirty/saving/saved/conflict.
- Resource tray và phân công tài nguyên.
- Tổng hợp validation.
- Preview/publish.
- Điều phối Smart Import nhưng không chứa prompt hoặc logic AI theo Part.

### 6.2. Client Module Definition và Part Editor Handler

```ts
interface ListeningEditorModuleDefinition<TDraft> {
  moduleId: ListeningModuleId;
  schemaVersion: number;
  createDefaultDraft(): TDraft;
  partHandlers: readonly ListeningPartEditorHandler<unknown, unknown>[];
}

interface ListeningPartEditorHandler<TPart, TCandidate> {
  partId: string;
  EditorComponent: React.ComponentType<PartEditorProps<TPart>>;
  PreviewComponent: React.ComponentType<PartPreviewProps<TPart>>;
  validateLocal(part: TPart): ValidationIssue[];
  applyCandidate(
    current: TPart,
    candidate: TCandidate,
    decisions: MergeDecision[],
  ): TPart;
}
```

Client handler không chứa prompt bí mật, answer sanitizer hoặc grader.

### 6.3. Server Part Import Handler

```ts
interface ListeningPartImportHandler<TCandidate> {
  moduleId: ListeningModuleId;
  partId: string;
  schemaVersion: number;
  buildPrompt(context: ImportContext): AiPrompt;
  responseSchema: unknown;
  normalize(raw: unknown, context: ImportContext): TCandidate;
  validate(candidate: TCandidate): ValidationIssue[];
}
```

Mỗi handler có prompt, response schema, normalize, validation và quy tắc tạo candidate riêng.

### 6.4. Smart Import Candidate

```ts
interface SmartImportCandidate<T> {
  candidateId: string;
  moduleId: ListeningModuleId;
  partId: string;
  schemaVersion: number;
  basePartHash: string;
  data: T;
  issues: ValidationIssue[];
  warnings: string[];
  confidence: number;
}
```

AI không sinh ID database. Backend/code tạo ID và ánh xạ các tham chiếu nội bộ sau khi normalize.

`basePartHash` ngăn candidate cũ ghi đè Part đã được giáo viên sửa trong lúc AI xử lý.

Ngoại lệ đã chốt cho Mover Part 1: AI chỉ hỗ trợ OCR/nhận diện nhân vật và vị trí; không phân tích ảnh để suy luận đáp án. Code tạo năm đáp án random tạm thời không trùng, còn giáo viên/admin bắt buộc đặt lại và xác nhận cả năm trước khi candidate được merge/publish. Quy tắc chi tiết nằm trong `docs/listening-smart-editor-mover-spec.md`.

Quy tắc chung đã chốt cho mọi Part: audio không phải nguồn Smart Import và không bao giờ được gửi cho AI để trích đáp án. Đáp án phải có sẵn trong ảnh/text đầu vào theo quy tắc của từng Part; AI chỉ trích xuất và điền đề xuất vào trường soạn để giáo viên/admin kiểm tra, sửa và xác nhận.

Compatibility đã chốt cho Mover Part 3: bổ sung `displayMode: 'composite'` cùng một `boardAssetId` nguyên khối; legacy Part 3 không có `displayMode` tiếp tục được đọc như `split`. Sáu option ID A-F và năm `correctOptionId` vẫn được giữ nên grader không đổi; editor/player/validation rẽ nhánh theo mode và không rewrite dữ liệu published cũ. Nếu OCR label thất bại, giáo viên/admin tự nhập trực tiếp; không cần công cụ chọn vùng OCR. Chi tiết nằm tại `docs/listening-smart-editor-mover-spec.md`.

Phương án đã chốt cho Mover Part 4: giữ schema v1 ba option image mỗi câu; AI đọc prompt/thứ tự/answer marker và chỉ đưa tọa độ gợi ý. Browser pixel code tự phát hiện khung ảnh đen hoặc xám trung tính, xếp trên-xuống/trái-phải, chia từng bộ A/B/C và căn crop vào mép trong; giáo viên có thể chỉnh từng crop trực quan bằng chuột. Code tạo derived image A/B/C bằng Canvas và upload qua asset API hiện có sau review. Cách này không cần hotspot, không đổi player/grader và không thêm native image dependency. Chi tiết nằm tại `docs/listening-smart-editor-mover-spec.md`.

## 7. Kiến trúc thư mục dự kiến

```text
src/features/listening-editor/
  shell/
    ListeningEditorShell.tsx
    useListeningDraft.ts
    useDraftAutosave.ts
    useDraftHistory.ts
  resources/
    ListeningResourceTray.tsx
    ResourceAssignmentPanel.tsx
  smart-import/
    SmartImportPanel.tsx
    ImportProgress.tsx
    ImportReviewPanel.tsx
    PartDiffView.tsx
  shared/
    TextEditor.tsx
    ImageEditor.tsx
    AudioEditor.tsx
    ChoiceEditor.tsx
    MatchingEditor.tsx
    RegionEditor.tsx
  contracts.ts

src/features/listening-library/modules/mover/editor/
  moduleDefinition.ts
  part1Handler.tsx
  part2Handler.tsx
  part3Handler.tsx
  part4Handler.tsx
  part5Handler.tsx

src/server/listening-smart-import/
  router.ts
  service.ts
  contracts.ts
  mediaResolver.ts
  aiProvider.ts
  modules/mover/
    registry.ts
    parts/
      part1Extractor.ts
      part2Extractor.ts
      part3Extractor.ts
      part4Extractor.ts
      part5Extractor.ts
```

Tên file cuối cùng có thể được điều chỉnh sau khi chốt logic từng Part, nhưng ranh giới frontend/backend và module/Part phải được giữ.

## 8. Phân công code và AI

### Code chịu trách nhiệm

- Auth, role và quyền sở hữu asset/set.
- File type, magic bytes, dung lượng và đường dẫn an toàn.
- Sinh ID và ánh xạ asset ID.
- Chuẩn hóa dữ liệu.
- Runtime schema check.
- Validation nghiệp vụ.
- Tính hash/revision và phát hiện xung đột.
- Merge theo quyết định của giáo viên.
- Autosave, undo/redo, preview, publish và grader.

### AI chỉ chịu trách nhiệm đề xuất

- OCR và hiểu bố cục ảnh.
- Trích xuất câu hỏi, lựa chọn và candidate answer có bằng chứng trực tiếp trong ảnh hoặc text đầu vào.
- Đề xuất vùng tương tác theo tọa độ chuẩn hóa.
- Trả cảnh báo, trường thiếu dữ liệu và mức độ tin cậy.

Nếu thiếu dữ kiện, AI phải trả `unknown`/cảnh báo hoặc để trống; không được đoán để làm dữ liệu trông hoàn chỉnh.

Audio bị loại khỏi pipeline AI. Backend chỉ quản lý audio như asset của Part; không tạo transcript, không gửi binary/URL audio cho provider và không dùng audio làm evidence của đáp án.

## 9. Luồng dữ liệu

### Phân tích một Part

1. Giáo viên upload/chọn asset bằng luồng media hiện có.
2. Resource tray gán asset cho module và Part.
3. Frontend gửi module ID, Part ID, ID ảnh nguồn, text tùy chọn và `basePartHash`; audio không nằm trong request phân tích.
4. Backend xác thực staff, quyền quản lý set và quyền sử dụng từng asset.
5. Backend đọc asset từ persistent media directory bằng storage key đã xác thực.
6. Server Part Handler xây prompt/schema và gọi provider.
7. Kết quả được normalize, runtime schema check và validation.
8. Backend trả candidate; không ghi draft.
9. UI dùng candidate để điền các trường staged/editable và hiển thị diff/cảnh báo để giáo viên duyệt.
10. Giáo viên xác nhận trường cần áp dụng.
11. Client handler merge đúng Part vào working draft.
12. Autosave lưu draft với revision mới.

### Phân tích toàn đề

- Shell tạo năm tác vụ Part độc lập.
- Giới hạn 1-2 request AI đồng thời để tránh timeout/quota.
- Mỗi Part có trạng thái `queued | running | needs_review | failed | accepted`.
- Retry chỉ chạy lại Part lỗi.
- Không tự động chấp nhận hoặc merge tất cả kết quả.

## 10. API dự kiến

Giữ nguyên các API học sinh, grader và publish hiện tại. Bổ sung API quản trị:

```text
POST /api/listening/admin/smart-import/analyze
POST /api/listening/admin/sets/:id/draft/autosave
```

Request phân tích chỉ gửi ID đã được backend quản lý, không gửi đường dẫn tùy ý hoặc API key:

```ts
interface SmartImportRequest {
  moduleId: ListeningModuleId;
  partId: string;
  sourceImageAssetIds: string[];
  pastedText?: string;
  currentPart?: unknown;
  basePartHash: string;
}
```

Audio asset ID không thuộc contract Smart Import. Việc chọn/upload audio tiếp tục đi qua editor/asset flow hiện có và độc lập với phân tích AI.

Autosave cần `baseRevision`; server trả `409` khi draft đã được cập nhật từ tab/phiên khác. Existing create/update/publish API vẫn được giữ để tương thích.

## 11. Các giai đoạn triển khai

### Giai đoạn 0 - Chốt logic và fixture

- Nhận đặc tả từng Part từ người dùng.
- Chốt input trích xuất trong v1: ảnh và pasted text; PDF/Word chỉ thêm khi có yêu cầu rõ. Audio vẫn được upload làm tài nguyên bài nghe nhưng không phải input của AI.
- Chốt example, số câu, distractor, nguồn đáp án và trường hợp thiếu dữ liệu.
- Chuẩn bị ít nhất 2-3 bộ fixture cho mỗi Part.
- Part 5 đã chốt luồng năm vùng `colour`, vùng cố định như Part 1, đáp án random bắt buộc giáo viên xác nhận và chính xác catalog 20 màu tiếng Anh trong đặc tả; không bổ sung `write`.

### Giai đoạn 1 - Refactor giữ nguyên hành vi

- Tách editor hiện tại thành Shell và năm handler Mover.
- Di chuyển default content vào module definition.
- Xuất validation theo Part mà không đổi kết quả whole-set validation.
- Giữ nguyên data shape v1, API, player, grader và publish.
- Bổ sung regression tests trước khi thêm AI.

### Giai đoạn 2 - Draft workspace

- Central reducer cho working draft.
- Undo/redo có giới hạn lịch sử và gộp các lần gõ liên tiếp.
- Autosave có revision/conflict handling.
- Dirty/saving/saved/error indicator.
- Batch upload qua endpoint hiện có với concurrency giới hạn.
- Resource tray và gán asset theo Part.

### Giai đoạn 3 - Smart Import Part thử nghiệm

- Làm Part 2 trước vì schema text dễ kiểm chứng và ít phụ thuộc tọa độ hình.
- Xây AI provider adapter backend-only.
- Thêm response schema, normalize, validation và candidate review.
- AI provider được mock trong automated tests; không dùng output model thật làm kết quả test cố định.
- Bật bằng feature flag cho staff.

### Giai đoạn 4 - Mở rộng đủ năm Part

Thứ tự đề xuất:

1. Part 2.
2. Part 4.
3. Part 3.
4. Part 1.
5. Part 5: tái sử dụng vùng cố định của Part 1, thêm catalog 20 màu preset, random mapping có review bắt buộc và compatibility cho màu legacy; giữ phạm vi `colour`, không thêm `write`.

Mỗi Part chỉ chuyển sang hoàn thành khi có fixture, normalize test, validation test, merge isolation test và manual review.

### Giai đoạn 5 - Phân tích toàn đề

- Điều phối năm Part độc lập.
- Progress và retry riêng.
- Giới hạn concurrency và request timeout.
- Giáo viên duyệt từng candidate.
- Refresh/đóng màn hình không được tự merge candidate chưa xác nhận.

### Giai đoạn 6 - Hardening và phát hành

- Rate limit/quota cho Smart Import.
- Audit log không chứa prompt bí mật, API key hoặc raw answer key không cần thiết.
- Timeout, abort và giới hạn media riêng cho AI import.
- Kiểm thử quyền teacher/super admin, ownership và student-data sanitization.
- Feature flags frontend/backend; giữ editor cũ làm rollback ban đầu.
- Cập nhật CODEMAP, tài liệu deploy và asset/build ledger.

## 12. Kế hoạch kiểm thử

### Unit tests

- Normalize và schema check cho từng Part.
- Validation candidate và validation draft.
- AI malformed/empty/unknown output.
- Merge chỉ thay Part được chọn.
- `basePartHash` mismatch phải chặn apply tự động.
- Sinh ID bằng code, không tin ID do AI trả về.
- Smart Import request/provider payload không chứa audio asset, audio URL, binary audio hoặc transcript sinh từ audio.

### Integration tests

- Staff auth và quyền quản lý set/asset.
- Upload → analyze → review → merge → autosave.
- Một Part fail không làm mất candidate khác.
- Existing draft và published version vẫn đọc được.
- Student payload không lộ answer key.

### Regression gates

```bash
npm run lint
npm run test:listening
npm run test:legacy-contracts
npm run build:history-ui
```

Nếu thay đổi storage, migration phải additive/idempotent và phải kiểm thử trên bản sao production-shaped trước khi deploy.

## 13. Tiêu chí hoàn thành

- Editor cũ và Mover hiện tại không bị hồi quy.
- Có thể phân tích và duyệt riêng từng Part.
- Merge Part N không thay đổi các Part khác.
- AI không tự lưu hoặc publish.
- Autosave không ghi đè draft mới hơn.
- Validation và grader vẫn chạy server-side.
- Published version vẫn bất biến.
- Test, typecheck, build và smoke test liên quan đều đạt.
- Có feature flag/rollback rõ ràng.
- CODEMAP và hướng dẫn deploy được cập nhật.

## 14. Mẫu thông tin cần nhận cho từng Part

1. Nguồn trích xuất: ảnh, pasted text hoặc tài liệu hình/text khác; audio chỉ là tài nguyên phát, không phải nguồn lấy đáp án.
2. Dữ liệu cần trích xuất.
3. Số câu, số lựa chọn và số distractor.
4. Cấu trúc example và example có được chấm hay không.
5. Nguồn xác định đáp án đúng.
6. Quy tắc vùng tương tác.
7. Trường nào bắt buộc, trường nào có thể để trống.
8. Khi thiếu dữ kiện, AI phải dừng, cảnh báo hay để trống.
9. Quy tắc merge khi draft đã có dữ liệu.
10. Ít nhất một ảnh/text nguồn, audio đính kèm riêng nếu có, và kết quả trích xuất mong muốn để làm fixture.

Đặc tả đã nhận cho Mover được ghi riêng tại `docs/listening-smart-editor-mover-spec.md` để từng Part có thể được xác nhận độc lập trước khi triển khai code.

## 15. Sổ trạng thái triển khai ngày 2026-08-02

Đã hoàn thành trong source:

- Editor Shell, module definition, năm Part Handler, draft reducer với undo/redo và autosave có revision conflict.
- Resource Tray upload tối đa 20 file, hai worker; các điểm nhận ảnh dùng chung thao tác chọn file, kéo-thả, Ctrl+V hoặc nút đọc clipboard; phân tích từng Part hoặc toàn đề với trạng thái độc lập và retry.
- `basePartHash` chặn kết quả stale; import/merge Part N có test không thay bốn Part còn lại. Part 1/2/3 direct-import vào working draft; Part 4-5 giữ candidate tách khỏi draft.
- Part 1 và Part 5 dùng vùng chữ nhật bo góc cố định; giáo viên kéo trực tiếp từng khung, không cần dropdown chọn vùng và không thể đổi kích thước. Part 1 giữ kích thước `0.12 x 0.055`; riêng năm khung ở editor thủ công Part 5 dùng `0.12 x 0.11` để cao gấp đôi. Part 1 direct-import tên/vùng/mapping random vào form chính để giáo viên sửa; Part 5 vẫn giữ review candidate.
- Part 2 OCR heading/example/năm câu/đáp án in đậm và hỗ trợ `|` cho nhiều đáp án rồi direct-import vào form chính. Crop tranh minh họa hiển thị toàn ảnh nguồn, cho vẽ/di chuyển/resize bằng chuột và chỉ tạo asset dẫn xuất khi giáo viên bấm dùng vùng crop.
- Part 3 dùng một board A-F nguyên khối, chỉ ảnh nhãn được gửi AI; board và nhãn nhận được import trực tiếp vào form chính, còn nhãn thiếu giữ giá trị hiện tại để giáo viên tự nhập.
- Trường hợp Part 3 chỉ có một ảnh board tạo kết quả cục bộ rồi import board trực tiếp, không báo lỗi thiếu nguồn và không gửi board cho AI; muốn OCR tự động phải thêm ảnh nhãn thứ hai hoặc pasted text.
- Part 4 OCR năm prompt; pixel detector thay tọa độ AI bằng mép trong của đủ 15 khung tối khi nhận diện thành công, chỉ nhận answer marker khi ảnh nguồn đánh dấu rõ; code tạo 15 asset crop sau review. Từng crop có fallback chỉnh bằng chuột.
- Part 5 dùng đúng catalog 20 màu tiếng Anh, không dùng color picker tự do; dữ liệu màu legacy vẫn đọc được. Form thủ công ẩn năm trường tên vùng không cần thiết và đổi nhãn dropdown thành `Đáp án màu 1` đến `Đáp án màu 5`.
- Smart Import chỉ nhận ảnh/text. Audio không nằm trong request provider. Gemini vision là lựa chọn đầu, OpenAI Responses vision là fallback; nếu không có key thì chỉ parser text cục bộ của Part 2/3 hoạt động.
- Backend kiểm tra staff/ownership, loại asset, magic bytes, đường dẫn media, giới hạn 10 MB/ảnh và 30 MB/request, rate limit 20 lượt/10 phút, timeout 45 giây kèm AbortSignal, audit metadata không ghi prompt/raw answer.
- Asset crop lưu `derivedFromAssetId` và tọa độ chuẩn hóa để truy vết nguồn.
- `LISTENING_SMART_IMPORT_ENABLED=false` tắt toàn bộ phân tích Smart Import nhưng giữ editor thủ công.

Kết quả tự động hiện tại:

- `npm run lint`: đạt.
- `npm run test:listening`: 30/30 đạt, gồm regression test direct-import Part 1/2/3, Part 3 board-only và dò/sắp khung Part 4.
- `npm run build:history-ui`: đạt; đồng thời tạo production client/server thành công.
- `npm run test:legacy-contracts`: chưa chạy được trên máy hiện tại vì binary `better-sqlite3` được build cho Node ABI 127 trong khi Node đang chạy cần ABI 137; lỗi xảy ra lúc nạp native module, trước khi test logic bắt đầu.

Việc còn lại trước phát hành:

- Cấu hình biến môi trường theo `docs/listening-smart-editor-deploy.md` và đảm bảo `LISTENING_MEDIA_DIR` là persistent volume.
- UAT trên trình duyệt bằng tài khoản teacher/super admin với ít nhất một fixture thật cho mỗi Part.
- Chạy lại `npm run test:legacy-contracts` sau khi cài/rebuild `better-sqlite3` đúng Node 22 của môi trường build.
