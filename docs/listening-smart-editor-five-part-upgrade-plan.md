# Kế hoạch nâng cấp Listening Smart Editor Mover đủ 5 Part

## 1. Trạng thái và phạm vi

Tài liệu này là requirements ledger và implementation plan đã duyệt cho đợt nâng cấp
Smart Import Mover. Việc triển khai source/test hoàn tất ngày 2026-08-08 và bám sát
các bất biến trong tài liệu này, `quytac.md` và `CODEMAP.md`.

| Part | Trạng thái yêu cầu | Ghi chú |
| --- | --- | --- |
| Part 1 | Đã chốt | Ba ảnh có vai trò cố định; bỏ hoàn toàn đáp án random |
| Part 2 | Đã chốt | Hai ảnh có vai trò cố định; map question number sang answer number |
| Part 3 | Đã chốt | Hai ảnh; mode nối trực tiếp trên ảnh; staged candidate |
| Part 4 | Đã chốt | Một ảnh đề + một answer key; 3 crop example + 15 crop scored |
| Part 5 | Đã chốt | Ba ảnh; mode scene colour/draw; public interaction registry và private answer mapping |

Trạng thái triển khai: hoàn tất source, regression test và release checks. UAT
thủ công với provider/fixture ảnh thật trên desktop/mobile vẫn là bước vận hành
ngoài automated suite.

Các quyết định Part 1/2/3/4/5 trong tài liệu này thay thế mô tả cũ về Part 1 dùng
random provisional mapping, Part 2 lấy đáp án in đậm từ cùng một ảnh đề và Part
3 dùng bảng A-F/dropdown. Part 4 giữ crop flow hiện tại nhưng tách example và
lấy năm đáp án chấm từ ảnh answer key riêng. Part 5 giữ nguyên nhánh legacy nhưng
thêm mode scene colour/draw với số action động, palette object có distractor và
grader riêng theo action.

## 2. Bất biến chung cho cả 5 Part

1. Mỗi ảnh đầu vào phải có role kỹ thuật rõ ràng; UI phải dùng nhãn tiếng Việt
   cố định, không yêu cầu giáo viên nhớ thứ tự ảnh chung chung.
2. Tiếp tục dùng `FileDropPasteInput`, asset library và upload API hiện có.
   Thay/bỏ ảnh khỏi lần phân tích không được delete/archive asset gốc.
3. Provider chỉ nhận ảnh đúng role của Part. Audio, audio URL và transcript
   không bao giờ nằm trong Smart Import request/provider payload.
4. AI không sinh ID kỹ thuật/database. Backend/code preserve ID hiện có; nếu
   draft thiếu ID tương ứng thì code tự sinh ID theo contract hiện tại.
5. AI output là dữ liệu không đáng tin cậy: backend phải parse, normalize,
   runtime validate và tạo warning/unresolved trước khi cho phép merge.
6. Dữ liệu không chắc chắn phải giữ dữ liệu cũ an toàn hoặc unresolved; không
   random, không đoán và không tạo đáp án giả.
7. `basePartHash` phải còn khớp ngay trước direct-import hoặc staged apply.
   Autosave tiếp tục dùng `baseRevision`; stale revision không được ghi đè draft
   mới hơn.
8. Phân tích lại Part N chỉ được thay `content.parts[N - 1]`; các Part còn lại
   phải giữ byte-for-byte như trước.
9. Smart Import chỉ cập nhật candidate hoặc working draft có thể undo/sửa theo
   flow đã chốt của từng Part; không tự publish.
10. Giữ published version bất biến, dữ liệu legacy, player, grader,
    history/attempt và student sanitizer nếu schema hiện tại đã đáp ứng.
11. Warning phải còn hiển thị đủ lâu trong form/candidate review để giáo viên
    biết trường nào cần kiểm tra; không được bị mất chỉ vì candidate vừa được
    merge/clear.

## 3. Part 1 - yêu cầu đã chốt

### 3.1. Ba ảnh và nhãn UI cố định

| Role kỹ thuật dự kiến | Nhãn UI bắt buộc | Mục đích |
| --- | --- | --- |
| `question` | `Ảnh đề bài` | Ảnh canonical hiển thị cho học sinh, nguồn tên và example |
| `answer_key` | `Ảnh đáp án` | Answer key dạng text để map tên sang nhân vật/mô tả |
| `position_key` | `Ảnh đáp án + vị trí` | Tranh có đường nối hoàn chỉnh để lấy target endpoint |

Ba slot độc lập: mỗi slot chọn, upload, paste, thay hoặc bỏ riêng.

### 3.2. Quy tắc tên, example và distractor

1. Detect toàn bộ tên nhìn thấy trên ảnh đề.
2. Xác định tên thuộc đường nối example và tách example trước.
3. Sau khi tách example phải còn đúng sáu draggable choices.
4. Sáu choices gồm năm đáp án chấm điểm và đúng một distractor.
5. Với fixture hiện tại có bảy tên nhìn thấy: `Fred` là example; `Paul`,
   `John`, `Jill`, `Sally`, `Jane`, `Daisy` là sáu choices.
6. Example không được nằm trong năm targets và không tính điểm.
7. Nếu không xác định chắc tên example hoặc không còn đúng sáu choices, trả
   warning/unresolved; không tự loại một tên để ép đủ số lượng.

### 3.3. ID và mapping đáp án

- AI chỉ trả tên, mô tả/mapping logic, target center, confidence và warning.
- AI không được trả `choiceId`, `targetId`, example ID, UUID hoặc database ID.
- Code preserve choice/target/example ID hiện có. Nếu draft thiếu entity/ID
  tương ứng thì code tự sinh ID rồi mới merge.
- Backend normalize tên bằng Unicode/whitespace/case/apostrophe và chỉ map khi
  có đúng một choice khớp. Trùng hoặc không khớp là unresolved.
- Năm mapping lấy từ `Ảnh đáp án`; không dùng ảnh đề, audio, transcript hoặc
  random provisional mapping để bù dữ liệu thiếu.
- Mapping unresolved giữ `choiceId` cũ an toàn và thêm warning. Không sinh đáp
  án tạm để làm dữ liệu có vẻ hoàn chỉnh.

### 3.4. Endpoint và quy đổi tọa độ

Normalized candidate sau backend chỉ cần một `targetEndpoint` đã được xác định
là endpoint phía nhân vật/hình. Provider có thể:

- trả trực tiếp endpoint đích; hoặc
- trả hai endpoint thô để backend xác định đầu phía nhân vật bằng scene/name
  evidence.

Trong cả hai trường hợp backend chỉ được dùng endpoint phía nhân vật. Không
được dùng đầu nằm ở tên và không thay bằng center nhân vật khi endpoint đích đã
rõ. Nếu không chứng minh được đầu nào là phía nhân vật thì để unresolved.

Ảnh đề là canonical coordinate system. Với scene rectangle chuẩn hóa của ảnh đề
`questionScene`, scene rectangle tương ứng của ảnh đáp án vị trí
`positionScene`, và endpoint đích trên ảnh vị trí:

```text
u = (targetEndpoint.x - positionScene.x) / positionScene.width
v = (targetEndpoint.y - positionScene.y) / positionScene.height

canonicalCenter.x = questionScene.x + u * questionScene.width
canonicalCenter.y = questionScene.y + v * questionScene.height
```

Backend phải validate scene rectangle, endpoint và `u/v`; không dùng pixel trực
tiếp. Code chuyển canonical center thành rectangle cố định:

```text
width  = 0.12
height = 0.055
x = clamp(center.x - width / 2, 0, 1 - width)
y = clamp(center.y - height / 2, 0, 1 - height)
```

Sau đó chạy region/overlap validation hiện có. Giáo viên vẫn kéo được target và
không resize được.

### 3.5. Direct-import Part 1

Direct-import được phép cập nhật trong Part 1:

- `sceneAssetId` bằng asset role `Ảnh đề bài`;
- sáu choice labels sau khi đã tách example;
- optional example;
- năm answer mappings đã resolve;
- năm regions đã map về ảnh đề.

Giữ nguyên `title`, `instruction`, audio và mọi Part khác. Sau import giáo viên
vẫn sửa tên, dropdown đáp án, kéo target, undo và chạy AI lại.

### 3.6. Regression test bắt buộc Part 1

1. Nhận đúng ba role ảnh và đúng ba nhãn UI.
2. Detect toàn bộ tên, tách example rồi còn đúng sáu choices.
3. Answer key text xác định đúng năm mapping.
4. Position key xác định target endpoint.
5. Chỉ dùng endpoint phía nhân vật, không dùng đầu phía tên.
6. Hai ảnh khác kích thước/scan vẫn map đúng bằng scene coordinates.
7. Example không nằm trong năm câu chấm điểm.
8. Provider không inject ID kỹ thuật; code preserve hoặc tự sinh ID.
9. Unresolved không tạo random/fake answer.
10. Region cuối giữ đúng `0.12 x 0.055` và được clamp.
11. Tọa độ cuối normalized theo ảnh đề.
12. Re-analyze Part 1 không thay Parts 2-5.
13. Stale hash/revision không ghi đè draft mới.
14. Part 1 legacy vẫn mở/sửa/chơi/chấm/review được và student response không
    lộ answer key trước policy cho phép.

## 4. Part 2 - yêu cầu đã chốt

### 4.1. Hai ảnh và nhãn UI cố định

| Role kỹ thuật dự kiến | Nhãn UI bắt buộc | Mục đích |
| --- | --- | --- |
| `question` | `Ảnh đề bài` | Heading/instruction, example và đúng năm prompt |
| `answer_key` | `Ảnh đáp án` | Đáp án/accepted variants cho câu 1-5 |

Hai slot độc lập: mỗi slot chọn, upload, paste, thay hoặc bỏ riêng. Luồng hai
ảnh đầy đủ yêu cầu cả hai role. Pasted text cũ, nếu tiếp tục giữ để tương thích,
phải là một fallback thủ công tách biệt và không được âm thầm thay role ảnh đáp
án trong luồng mới.

### 4.2. Schema hiện tại tiếp tục được dùng

- `ListeningPartBase.title`: tên Part, không lấy từ heading nội dung.
- `ListeningPartBase.instruction`: hướng dẫn chung, chỉ cập nhật khi ảnh đề thể
  hiện rõ; nếu không thì giữ dữ liệu cũ.
- `ListeningPart2.heading`: heading nội dung, chỉ cập nhật khi resolve được.
- `exampleText`: example không chấm điểm.
- `questions`: đúng năm phần tử; thứ tự array cuối là câu 1-5.
- `blanks[].acceptedAnswers`: contract variants hiện tại.

Không tạo schema mới và không đổi grader.

### 4.3. Tách câu hỏi và example

1. Ảnh đề chỉ cung cấp heading/instruction/example/prompt; không dùng nó để
   đoán đáp án.
2. Detect example riêng và loại khỏi danh sách scored questions.
3. Detect đúng question numbers 1-5 và prompt tương ứng.
4. Số đầu dòng chỉ dùng để mapping, không lưu vào prompt vì player tự đánh số.
5. Blank in trên ảnh trở thành logical token `{{blank}}`; khi merge code thay
   bằng blank ID hiện có hoặc ID do code sinh nếu draft thiếu.

### 4.4. Mapping answer number sang question number

- Ưu tiên tuyệt đối số câu 1-5.
- Backend lập map theo `questionNumber`, không ghép bằng vị trí phần tử OCR.
- Example, heading hoặc nội dung khác không được làm dịch index.
- Nếu answer key hoàn toàn không có số nhưng có đúng năm dòng rõ ràng, backend
  có thể map theo thứ tự và bắt buộc thêm warning `ordered fallback`.
- Nếu answer key chỉ có một phần số, trùng số, số ngoài 1-5 hoặc cấu trúc mơ hồ,
  chỉ map các số chắc chắn; phần còn lại unresolved và giữ đáp án cũ.

Ví dụ fixture phải cho kết quả:

```text
1 -> Main
2 -> 4b
3 -> hockey
4 -> comics
5 -> snake
```

Mọi đáp án được giữ dưới dạng text; không ép `4b` hoặc đáp án số sang kiểu số.

### 4.5. Answer variants

- `correctAnswer` đơn trở thành `acceptedAnswers` có đúng một phần tử.
- `answerVariants` hoặc chuỗi source phân cách rõ bằng `|` trở thành nhiều phần
  tử trong `acceptedAnswers` hiện có.
- Trim, bỏ rỗng và de-duplicate sau normalize nhưng giữ spelling hiển thị đầu
  tiên.
- Không tự sinh biến thể viết hoa/thường, số/chữ, dấu `/`, dấu phẩy hoặc từ
  `or` nếu source không thể hiện chúng là accepted alternatives.

### 4.6. AI output và direct-import an toàn

Logical provider output chỉ cần:

```ts
{
  heading?: string;
  instruction?: string;
  exampleText?: string;
  questions: Array<{
    questionNumber?: 1 | 2 | 3 | 4 | 5;
    prompt: string;
    correctAnswer?: string;
    answerVariants?: string[];
  }>;
  warnings?: string[];
}
```

AI không sinh question ID, blank ID hoặc database ID. Backend parse/normalize,
kiểm tra số câu và answer mapping trước khi trả candidate. Direct-import:

- map theo `questionNumber` sang index 0-4;
- preserve question/blank ID hiện có;
- tự sinh ID bằng code nếu draft thiếu entity/ID tương ứng;
- không ghi đè prompt bằng chuỗi rỗng hoặc chỉ một blank token;
- không ghi đè heading/instruction/example/answer khi field tương ứng unresolved;
- giữ nguyên audio, illustration ngoài crop flow đã được giáo viên xác nhận,
  `title` và Parts 1, 3, 4, 5.

### 4.7. Regression test bắt buộc Part 2

1. Nhận đúng hai role ảnh và đúng hai nhãn UI.
2. Ảnh đề lấy đúng heading/instruction khi có, example và năm câu.
3. Example không làm lệch question number/index.
4. Answer key 1-5 map đúng vào question 1-5.
5. `4b`, chữ, số và chữ+số được giữ chính xác dưới dạng text.
6. Một đáp án tạo đúng một `acceptedAnswers` variant.
7. Nhiều accepted answers vẫn dùng contract `acceptedAnswers`/`|` hiện tại.
8. Answer thiếu/malformed không bị AI/code đoán; dữ liệu cũ được giữ an toàn.
9. Provider không inject ID kỹ thuật; code preserve hoặc tự sinh ID.
10. Re-analyze Part 2 không thay Parts 1, 3, 4, 5.
11. Stale hash/revision không ghi đè draft mới.
12. Part 2 legacy vẫn mở/sửa/chơi/chấm/review được.
13. Public/prepare/student-safe response không lộ `acceptedAnswers` trước thời
    điểm review policy cho phép.

## 5. Part 3 - yêu cầu đã chốt

### 5.1. Mục tiêu và hai ảnh có role cố định

Part 3 mới thay dropdown/bảng A-F bằng bài nối trực tiếp trên ảnh worksheet gốc.

| Role kỹ thuật dự kiến | Nhãn UI bắt buộc | Mục đích |
| --- | --- | --- |
| `question` | `Ảnh đề bài` | Ảnh nguyên trang hiển thị cho học sinh; nguồn regions, anchors và example |
| `answer_key` | `Ảnh đáp án` | Bảng đáp án hai cột/ba hàng dùng để map sáu picture slots |

Hai slot độc lập: mỗi slot chọn từ asset library, upload, paste, thay hoặc bỏ
riêng bằng `FileDropPasteInput`/asset system hiện tại. Bỏ một ảnh khỏi lần phân
tích không được delete/archive asset. Ảnh đáp án chỉ là nguồn staff Smart Import,
không được lưu vào published Part hoặc student snapshot.

### 5.2. Mode/schema additive và compatibility

Part 3 mới dùng mode tương đương:

```text
displayMode: "connect-image"
connectionSchemaVersion: 1
```

Logical content của mode mới gồm:

- `boardAssetId`: asset role `question`;
- đúng bảy answer items, mỗi item có ID code quản lý, label, region và offset
  anchor trái/phải;
- đúng sáu picture items, mỗi item có ID code quản lý, region, phía
  `left|right`, row `1..3` và một anchor offset;
- một `exampleConnection` bắt buộc và khóa;
- đúng năm `correctConnections`;
- đúng một `distractorAnswerId`;
- `exampleConnection.renderOverlayLine` mặc định `false` khi đường example đã
  in sẵn trên ảnh đề.

Bất biến:

```text
7 answers  = 1 example + 5 scored + 1 distractor
6 pictures = 1 example + 5 scored
```

`ListeningPart3` phải là union/discriminated branch giữa legacy và
`connect-image`. Part 3 legacy không có `displayMode` tiếp tục được hiểu là
`split`; `composite` hiện tại tiếp tục mở, chơi, chấm và review. Không rewrite
dữ liệu cũ khi đọc. Draft tạo mới mặc định dùng `connect-image`; draft legacy
chỉ chuyển khi giáo viên chủ động tạo/apply candidate mode mới.

### 5.3. Fixture và mapping theo bố cục hai chiều

Ảnh đề có ba picture bên trái, ba picture bên phải và bảy answer labels ở cột
giữa. Ảnh đáp án có hai cột, ba hàng; mapping theo `side + row`, không flatten
thành thứ tự OCR tuyến tính:

| Picture slot | Nội dung nhận diện để review | Answer key | Vai trò |
| --- | --- | --- | --- |
| `left-1` | Sân bóng | `Saturday` | scored |
| `right-1` | Bạn gái đọc sách và chó | `Monday` | scored |
| `left-2` | Hai bạn và bánh sinh nhật | `Thursday` | example, khóa |
| `right-2` | Thác nước | `Sunday` | scored |
| `left-3` | Bạn nhỏ làm bài | `Tuesday` | scored |
| `right-3` | Chơi bóng với chó | `Wednesday` | scored |

Kết quả fixture bắt buộc:

```text
example: Thursday -> left-2

scored:
Saturday  -> left-1
Monday    -> right-1
Sunday    -> right-2
Tuesday   -> left-3
Wednesday -> right-3

distractor: Friday
```

Backend nhóm picture theo phía, sort từ trên xuống trong từng phía và chỉ map
khi tìm được đúng ba slot mỗi phía. Với answer key sáu giá trị, phải
cross-validate đúng entry `Thursday -> left-2` với đường example trên ảnh đề rồi
loại entry đó khỏi năm câu chấm; không mặc định bỏ phần tử đầu/cuối. Với answer
key năm giá trị, example lấy từ ảnh đề và chỉ tự map khi key còn evidence vị trí
`side + row` hoặc liên kết rõ ràng. Năm label bị dồn mất quan hệ vị trí phải để
unresolved, không dùng OCR order.

### 5.4. AI output, normalization và ID

Provider chỉ trả dữ liệu logic tương đương:

```text
questionAnswers: label, region, left/right anchor hint
questionPictures: side, row, region, inward anchor hint
questionExample: answer label, picture side/row
answerKeyCells: label, side, row
warnings/unresolved
```

AI không được trả `answerId`, `pictureId`, asset/database ID hoặc UUID. Backend
phải bỏ/reject ID provider inject, parse/normalize/runtime-validate trước khi tạo
candidate.

Khi re-analyze draft `connect-image`:

- preserve answer ID bằng normalized label nếu match duy nhất;
- preserve picture ID bằng `side + row`, có region overlap/nearest-center làm
  cross-check;
- nếu draft thiếu entity/ID tương ứng thì application code tự sinh ID;
- unresolved giữ dữ liệu cũ hợp lệ kèm warning; draft mới không có dữ liệu cũ
  thì giữ unresolved, không tạo mapping giả.

Distractor được xác định bằng set difference: bảy answer labels trên ảnh đề trừ
example và năm scored labels. Trùng label, thiếu/thừa slot, example không khớp
hoặc evidence mơ hồ phải warning/unresolved.

### 5.5. Region là nguồn hình học; anchor bị constraint

Anchor không được kéo tự do khắp ảnh. Region là nguồn hình học chính và schema
ưu tiên lưu offset dọc cạnh trong khoảng `0..1`:

```text
answer.left.x  = answer.region.x
answer.right.x = answer.region.x + answer.region.width
picture left.x  = picture.region.x + picture.region.width
picture right.x = picture.region.x
y = region.y + anchorOffset * region.height
```

Node có thể được đẩy nhẹ ra ngoài viền bằng CSS/SVG visual offset nhưng dữ liệu
canonical vẫn nằm trên đúng cạnh. Editor chỉ cho giáo viên trượt offset dọc cạnh
và backend clamp `0..1`; không cho đưa node vào giữa hình hoặc sang cạnh sai.
Provider có thể trả normalized point hint, nhưng backend phải quy đổi/clamp về
edge offset trước khi candidate được dùng.

### 5.6. Staged candidate và editor

Part 3 mới tuân theo `quytac.md`: Parts 1/2 direct-import; Parts 3-5 dùng staged
candidate. Mô tả CODEMAP cũ nói Parts 1-3 direct-import là trạng thái runtime cũ
và phải được cập nhật sau khi implementation hoàn tất.

Flow Part 3:

```text
hai ảnh role-based
-> provider
-> backend normalize/cross-validate
-> staged candidate
-> giáo viên chỉnh regions/anchor offsets/example/mappings/distractor
-> validate đầy đủ
-> kiểm tra basePartHash
-> apply riêng content.parts[2]
-> working draft có thể sửa/undo
-> autosave theo baseRevision
-> không tự publish
```

Editor được phép refactor/reuse normalized image/region infrastructure hiện có,
nhưng cần một bề mặt overlay Part 3 đủ khả năng chỉnh 13 regions, constrained
anchor offsets, example, năm mappings và distractor. Không tạo upload system hay
editor coordinate system song song.

### 5.7. Player và chống lộ đáp án

Ảnh đề nguyên trang là background/canonical coordinate system. Node và
connection UI nằm trong SVG/HTML overlay; không crop sáu picture riêng và không
bake dữ liệu vào ảnh gốc.

- Desktop: pointer drag từ answer node, preview Bezier, snap nhẹ và thả vào
  picture node eligible.
- Mobile/keyboard: tap/Enter/Space chọn answer node rồi chọn picture; Escape hủy.
- Một answer tối đa một picture; một picture tối đa một answer; nối lại answer
  giải phóng picture cũ và thay connection cũ; không tạo duplicate.
- Example answer/picture luôn khóa. Vì line example đã in trên fixture,
  `renderOverlayLine=false` chỉ render trạng thái node locked/example, không vẽ
  đè thêm đường SVG. Nguồn không có line mẫu mới bật overlay line.

Eligibility tuyệt đối chỉ dựa vào luật UI và student state, không dựa vào
`correctConnections`:

- kéo từ left anchor: mọi picture node bên trái chưa khóa/chưa bị answer khác
  chiếm đều eligible;
- kéo từ right anchor: mọi picture node bên phải chưa khóa/chưa bị answer khác
  chiếm đều eligible;
- khi kéo lại một answer, picture cũ của chính answer đó được tạm giải phóng;
- player không được biết hoặc highlight picture đúng.

`correctConnections` và `distractorAnswerId` phải bị loại khỏi student snapshot.
Student thấy sáu answers chưa khóa và năm pictures chưa khóa; khi điền đủ sẽ còn
một answer không dùng nhưng không được biết trước đó là answer nào.

### 5.8. Submission, grader và review

Source hiện tại xác nhận `ListeningAnswers.part3` có serialized shape
`Record<string,string>`, nhưng legacy dùng ngữ nghĩa `itemId -> optionId`. Mode
mới có thể reuse cùng shape với ngữ nghĩa `answerId -> pictureId` mà không đổi
attempt/history payload:

```text
legacy split/composite: itemId -> optionId
connect-image:          answerId -> pictureId
```

Player, backend grader và activity/review formatter phải phân nhánh bằng
`displayMode`; không được ép ngữ nghĩa mới lên legacy data. Grader mode mới chỉ
duyệt đúng năm `correctConnections`; example không chấm, unknown/distractor keys
không tạo câu bổ sung và tổng bài vẫn đúng 25 câu. Grading version phải được ghi
rõ nếu implementation mở rộng grader.

Student sanitizer chỉ giữ board, answer/picture regions, derived anchors và
example data công khai; loại correct mappings, distractor, confidence/warnings,
editor metadata và ảnh answer key.

### 5.9. Regression test bắt buộc Part 3

1. Nhận đúng hai role và nhãn `Ảnh đề bài`/`Ảnh đáp án`.
2. Detect đúng bảy answer regions và mỗi answer có hai derived/constrained
   anchors đúng cạnh.
3. Detect đúng sáu picture regions; ba trái có anchor cạnh phải, ba phải có
   anchor cạnh trái; mọi tọa độ/offset normalized.
4. Fixture map đúng sáu `side + row`, nhận `Thursday -> left-2` là example,
   đúng năm scored connections và `Friday` là distractor.
5. Key năm và sáu giá trị xử lý đúng; mất evidence vị trí thì unresolved.
6. Provider không inject ID; code preserve ID hiện có hoặc tự sinh khi thiếu.
7. Anchor editor clamp đúng cạnh, không tạo trạng thái node giữa/sai phía.
8. Example khóa, không tính điểm và mặc định không vẽ đè SVG line.
9. Eligibility chỉ dựa side/lock/student mappings, không nhận answer key.
10. Mỗi answer/picture dùng tối đa một lần; reconnect trả picture cũ; picture
    bị answer khác chiếm không eligible.
11. Tap, drag, keyboard/focus, aria-label và semantic hooks cho root/nodes/SVG/
    example state hoạt động.
12. Student submission chỉ chứa mapping của học sinh; backend chấm
    `answerId -> pictureId` theo immutable content.
13. Student snapshot không lộ correct mappings/distractor/answer-key asset.
14. Part 3 legacy split/composite vẫn mở/sửa/chơi/chấm/review đúng.
15. Re-analyze/apply Part 3 không thay Parts 1, 2, 4, 5.
16. Stale `basePartHash` hoặc autosave `baseRevision` không ghi đè draft mới.

## 6. Part 4 - yêu cầu đã chốt

### 6.1. Mục tiêu và đúng hai ảnh có role cố định

Giữ cơ chế Part 4 hiện tại: AI đọc prompt/thứ tự, browser pixel detector tìm
khung tối, crop editor chỉnh trực quan, Canvas tạo derived assets và giáo viên
duyệt staged candidate trước khi apply. Chỉ mở rộng để tách example và tự map
năm đáp án chấm từ answer key riêng.

| Role kỹ thuật dự kiến | Nhãn UI bắt buộc | Cardinality | Mục đích |
| --- | --- | --- | --- |
| `question` | `Ảnh đề bài` | đúng 1 | Một ảnh lớn chứa example và năm câu; nguồn prompt và 18 picture crops |
| `answer_key` | `Ảnh đáp án` | đúng 1 | Chỉ chứa đáp án đánh số cho năm câu chấm |

Hai slot chọn/upload/paste/thay/bỏ riêng bằng `FileDropPasteInput` và asset
system hiện tại. Bỏ nguồn không delete/archive asset. Backend phải validate role,
cardinality, hai asset khác nhau, staff/ownership, active image type, magic/size,
aggregate limit, timeout/rate/quota và rollback flag. Không suy role từ vị trí
trong một mảng ảnh chung. Audio/transcript không bao giờ được gửi provider.

### 6.2. Giữ schema Part 4 hiện tại

Tiếp tục dùng:

```text
ListeningPart4.questions: đúng 5 ListeningPart4Question
ListeningPart4Question.options: đúng 3 ListeningPart4Option theo A/B/C
ListeningPart4Question.correctOptionId: một option ID hiện có
ListeningPart4.example?: ListeningPart4Question
ListeningAnswers.part4: questionId -> optionId
```

Không tạo schema mới, không đổi grader, attempt/history hoặc published legacy.
Năm question/15 option IDs hiện có phải được preserve. Nếu draft chưa có
example thì application code sinh một example question ID và ba example option
IDs; AI không được sinh bất kỳ ID kỹ thuật/database nào.

Legacy Part 4 không có `example` tiếp tục mở, chơi, chấm và review, không rewrite
khi đọc. Validator chung không được bắt legacy phải có example; nếu example hiện
diện thì phải validate prompt, đúng ba unique option IDs, ba image assets và
`correctOptionId` thuộc ba options.

### 6.3. Tách example và năm câu chấm

Ảnh đề fixture gồm một ảnh lớn ghép hai trang theo chiều dọc:

- example ở đầu trang: `Where is Pat's dad going?`;
- năm câu được đánh số `1..5`;
- mỗi block có ba picture frames trái sang phải A/B/C.

Example phải được nhận diện riêng trước khi lập danh sách năm câu chấm. Example
không được làm lệch question number/index và không được tính vào answer key năm
câu hoặc grader.

Fixture example:

```text
prompt: Where is Pat's dad going?
A: Bank
B: Supermarket
C: Library
correct: A (marker/tick rõ trên ảnh đề)
```

Đáp án example chỉ được lấy từ marker rõ ràng trên ảnh đề hoặc giáo viên chọn
trong review. Nếu marker không chắc, giữ example cũ hoặc unresolved/warning;
không dùng answer key năm câu để bù.

### 6.4. Giữ detector/crop logic, mở rộng từ 15 lên 18 ảnh

Không thay thuật toán pixel `detectPart4Frames` và quy tắc:

- nhận khung đen/xám trung tính, cho phép một cạnh mờ;
- sort theo thứ tự đọc trên-xuống, trái-sang-phải;
- mỗi logical block có ba crop A/B/C;
- crop nằm trong mép khung, loại chữ A/B/C, checkbox/tick, viền và question text;
- AI coordinates chỉ là hint; pixel detector là nguồn căn crop ưu tiên;
- `VisualCropEditor` tiếp tục là fallback chỉnh bằng chuột.

Với fixture mới, gọi/group tương đương:

```text
groupPart4Frames(detectedFrames, 6)

group 0 -> example
group 1 -> question 1
group 2 -> question 2
group 3 -> question 3
group 4 -> question 4
group 5 -> question 5
```

Tổng output:

```text
3 derived images của example
+ 5 questions x 3 derived images A/B/C
= 18 derived images
```

Các regression test 15-frame hiện tại vẫn phải pass để chứng minh detector core
không regression; fixture mới bổ sung test 18/18 và example đứng trước câu 1.
Answer-key asset tuyệt đối không được đưa vào pixel detector, crop source picker,
Canvas crop hoặc `derivedFromAssetId` của option images.

### 6.5. Answer key và numbered mapping

Ảnh answer key fixture:

```text
Part 4 (5 marks)
1 A  2 C  3 C  4 B  5 C
```

Logical provider output chỉ cần:

```ts
{
  answers: Array<{
    questionNumber?: 1 | 2 | 3 | 4 | 5;
    answer: 'A' | 'B' | 'C';
  }>;
  orderedFallbackEvidence?: 'single-row' | 'single-column';
  warnings?: string[];
}
```

Backend ưu tiên map tuyệt đối bằng `questionNumber`:

```text
1 -> A
2 -> C
3 -> C
4 -> B
5 -> C
```

Validation:

- question number phải là integer `1..5`;
- answer sau trim/NFKC/uppercase phải đúng một ký tự `A|B|C`;
- duplicate question number làm chính số đó conflict/unresolved, kể cả hai entry
  trùng letter; các số hợp lệ khác vẫn được dùng;
- thiếu một số không được dồn các entry phía sau hoặc dùng phần tử không số để
  lấp khoảng trống;
- ngoài A/B/C, OCR không chắc hoặc evidence mơ hồ phải giữ đáp án draft tương
  ứng và warning; không sửa/đoán/random.

Ordered fallback chỉ được dùng khi không có entry nào mang question number, có
đúng năm answers A/B/C hợp lệ và evidence một hàng/cột có thứ tự rõ ràng. Fallback
map array 0..4 sang câu 1..5 và bắt buộc warning. Nếu output trộn numbered và
unnumbered thì chỉ map phần numbered chắc chắn.

AI không được trả `questionId`, `choiceId`, `optionId`, asset/database ID hoặc
UUID. Backend chỉ pick các field logic ở trên và bỏ/reject ID provider inject.

### 6.6. Mapping letter sang option ID và safe retain

Candidate dùng letter/index, không chứa option ID do provider tạo:

```text
A -> option index 0
B -> option index 1
C -> option index 2
```

Khi apply:

```text
question = part.questions[questionNumber - 1]
correctOptionId = question.options[letterIndex].id
```

Mỗi review question phải giữ trạng thái nguồn tương đương:

```text
answer-key-numbered
answer-key-ordered-fallback
current-part
manual
```

Key hợp lệ preselect answer key. Key thiếu/malformed/conflict preselect
`correctOptionId` hiện tại và hiển thị `Giữ từ draft`; không để dropdown trống
mơ hồ. Giáo viên thay A/B/C chuyển source thành `manual`. Apply dùng đúng giá trị
cuối giáo viên đang thấy.

Trong flow hai role mới, năm đáp án chấm chỉ lấy từ `answer_key`. Marker/tick ở
ảnh đề chỉ được dùng cho example; không dùng marker câu scored để bù answer key
thiếu. Không suy luận đáp án từ nội dung hình.

### 6.7. Candidate review và apply

Part 4 tiếp tục staged candidate theo `quytac.md`. Review hiển thị sáu card:

1. `Example - không tính điểm`;
2. câu 1;
3. câu 2;
4. câu 3;
5. câu 4;
6. câu 5.

Mỗi card cho giáo viên sửa prompt, xem/chỉnh ba crop A/B/C và chọn đáp án. Flow:

```text
question + answer_key roles
-> provider
-> backend tách example/questions và normalize answer map
-> browser align 18 frames
-> staged editable review
-> validate đủ 1 example + 5 questions + 18 crops
-> kiểm tra basePartHash
-> Canvas crop/upload 18 derived assets
-> apply riêng content.parts[3]
-> working draft có thể sửa/undo
-> autosave theo baseRevision
-> không tự publish
```

Nếu một crop/upload lỗi, không merge Part 4 không hoàn chỉnh. Giữ behavior retry/
staging hiện có; không đổi các Part khác. Main Part 4 editor phải cho sửa/thay
ba ảnh và correct option của example sau khi apply, giống năm question cards.

### 6.8. Student player, sanitizer và grader

Yêu cầu hiển thị sample cần một mở rộng player tối thiểu:

- nếu `part.example` có mặt, render trước năm câu với nhãn `Example`;
- ba lựa chọn hiển thị như câu thường;
- correct option của example checked/selected sẵn và toàn bộ controls disabled;
- example không được ghi vào `answers.part4` và không tính progress/điểm;
- Part 4 legacy không có example giữ UI hiện tại.

Backend grader không đổi: chỉ duyệt đúng năm `part.questions` và so sánh
`answers.part4[question.id]` với `question.correctOptionId`.

Student sanitizer tiếp tục loại `questions[].correctOptionId`. Riêng
`example.correctOptionId` được giữ vì đây là đáp án mẫu công khai cần để player
đánh dấu option đã chọn; việc này phải có test chứng minh không làm lộ bất kỳ
scored answer hoặc answer-key asset nào.

Activity/review của attempt chỉ gồm năm scored questions; example không tạo
answer row hoặc thay tổng 25 câu.

### 6.9. Regression test bắt buộc Part 4

1. Nhận đúng hai role `question`/`answer_key` và đúng hai nhãn UI.
2. Question role tách riêng example và đúng năm scored questions; example không
   làm lệch số câu.
3. Detector core fixture 15-frame cũ vẫn pass; fixture mới detect/group đúng
   18/18 ảnh thành example + năm bộ A/B/C.
4. Answer-key asset không đi vào detector/crop/derived provenance.
5. `1 A 2 C 3 C 4 B 5 C` parse chính xác và map theo question number.
6. A/B/C map về đúng option ID hiện có; question/option IDs được preserve; code
   tự sinh IDs cho example mới.
7. Provider không inject ID kỹ thuật.
8. Thiếu một answer không làm lệch câu sau; câu thiếu giữ answer draft.
9. Duplicate question number warning/unresolved; answer ngoài A/B/C không được
   tự sửa hoặc đoán.
10. Ordered fallback chỉ chạy khi đủ đúng năm unnumbered answers có evidence rõ
    và bắt buộc warning; mixed partial numbering không fallback.
11. Review preselect đúng năm answer-key mappings, hiển thị retained source khi
    unresolved và cho giáo viên sửa A/B/C trước apply.
12. Example A được lấy từ marker rõ trên ảnh đề, crop bỏ marker, hiển thị selected/
    locked cho học sinh và không tính điểm.
13. Apply tạo đúng 18 derived assets và re-analyze/apply Part 4 không thay Parts
    1, 2, 3, 5.
14. Stale `basePartHash` hoặc autosave `baseRevision` không ghi đè draft mới.
15. Legacy Part 4 không có example vẫn mở/sửa/chơi/chấm/review đúng; grader vẫn
    chấm `questionId -> optionId` và đúng năm câu.
16. Student snapshot loại năm scored `correctOptionId` và answer-key asset nhưng
    giữ đúng public example selection.

## 7. Part 5 - yêu cầu đã chốt

### 7.1. Mục tiêu, mode additive và compatibility

Part 5 mới thay mô hình năm rectangle tô màu cố định bằng một scene tương tác có
hai loại thao tác:

- `colour_object`: chọn/kéo màu vào một object trên scene và thấy lớp màu ngay;
- `place_object`: chọn/kéo một object token/sticker từ palette vào vị trí trên
  scene, không dùng freehand canvas.

Mode mới dùng discriminator:

```text
displayMode: "scene-colour-draw"
interactionSchemaVersion: 1
```

`ListeningPart5` phải là union giữa nhánh legacy hiện tại và nhánh
`scene-colour-draw`. Part 5 cũ không có `displayMode` tiếp tục mở, sửa, chơi,
chấm và review bằng đúng submission `targetId -> colourId`, sáu màu/năm target
và grader cũ. Không rewrite dữ liệu cũ khi đọc. Smart Import Part 5 mới hoặc lựa
chọn mode rõ ràng của giáo viên là hành động opt-in chuyển riêng working draft
Part 5; không tự chuyển published content hay draft chỉ vì được mở.

Mode mới vẫn có đúng năm câu chấm điểm và tổng bài vẫn là 25 câu. Số action của
mỗi câu không cố định: một câu có thể có một, hai hoặc nhiều action. Publish yêu
cầu mỗi câu có ít nhất một action hợp lệ; giới hạn kỹ thuật chống payload bất
thường không được biến thành giả định nghiệp vụ một action/câu.

Ví dụ fixture logic:

```text
Question 1:
  - colour big cupboard -> Green
  - colour small cupboard -> Yellow
Question 2:
  - place Lamp on the table by the bed
Question 3:
  - colour T-shirt of the standing boy -> Red
Question 4:
  - colour mat in front of the door -> Brown
Question 5:
  - place Red toy plane between the boys
```

Question 1 có hai action nhưng chỉ tạo một kết quả chấm điểm.

### 7.2. Ba ảnh có role và nhãn UI cố định

| Role kỹ thuật | Nhãn UI bắt buộc | Cardinality | Mục đích |
| --- | --- | --- | --- |
| `question` | `Ảnh đề bài` | đúng 1 | Scene canonical hiển thị cho học sinh |
| `answer_key` | `Ảnh đáp án` | đúng 1 | Prompt staff-side, màu và object cần dùng cho câu 1-5 |
| `position_key` | `Ảnh đáp án + vị trí` | 0 hoặc 1 | Hỗ trợ object geometry/placement region khi có ảnh lời giải trực quan |

Ba slot dùng `FileDropPasteInput`, asset library và upload API hiện có; mỗi slot
chọn, upload, paste, thay hoặc bỏ riêng. Bỏ nguồn chỉ detach khỏi lần phân tích,
không delete/archive asset. Chỉ `question` trở thành `sceneAssetId`; hai ảnh đáp
án là metadata candidate staff-only và không được lưu vào published Part/student
snapshot. Audio/transcript tuyệt đối không được gửi provider hoặc dùng suy luận.

Không suy role bằng thứ tự trong mảng ảnh. Backend phải validate role,
cardinality, asset khác nhau, ownership, trạng thái active, MIME/magic/size,
aggregate limit, timeout/rate/quota và rollback flag hiện có.

### 7.3. Public interaction registry và private answer mapping

Geometry dùng để render/tương tác không được đồng nghĩa với “đây là object đúng
của action”. Mode mới được normalize thành ba nhóm dữ liệu:

```text
scene
public interactiveObjects + public objectPalette
private questions/actions answer mapping
```

Public colourable object tương đương:

```ts
{
  id: string; // application code sinh/preserve
  label: string;
  geometry: ListeningRegion;
  interactionKinds: ['colour'];
}
```

`interactiveObjects` phải chứa tập object có thể thao tác đã được giáo viên
duyệt, không chỉ đúng một geometry được hỏi. Khi tập public geometry làm lộ duy
nhất target đúng, candidate phải warning và editor yêu cầu bổ sung object tương
tác/distractor hợp lý trước publish.

Public placement palette tương đương:

```ts
{
  id: string; // application code sinh/preserve
  objectType: string;
  label: string;
  colourId?: string;
  tokenAssetId?: string;
}
```

Palette phải chứa mọi token đúng cần cho `place_object` và ít nhất một palette
item không được action nào dùng làm đáp án. Không được chỉ gửi duy nhất object
đúng cho học sinh. Nếu AI/source không cung cấp đủ palette, không tự tạo object
nhiễu giả; giữ candidate unresolved và yêu cầu giáo viên hoàn thiện. Sticker có
nhãn cùng optional color swatch là fallback; `tokenAssetId` qua asset system hiện
có là tùy chọn khi giáo viên muốn hình thật.

Private question/action tương đương:

```ts
{
  id: string; // code sinh/preserve
  questionNumber: 1 | 2 | 3 | 4 | 5;
  staffPrompt: string;
  actions: Array<
    | {
        id: string;
        type: 'colour_object';
        correctObjectId: string;
        correctColourId: string;
      }
    | {
        id: string;
        type: 'place_object';
        correctPaletteItemId: string;
        targetRegion: ListeningRegion;
        relationLabel?: string;
      }
  >;
}
```

`staffPrompt` lấy từ answer key có thể chứa nguyên đáp án như “Colour the big
cupboard green”, nên là dữ liệu staff/review và không được gửi học sinh. Nếu sau
này cần chữ công khai phải dùng một `studentPrompt` riêng đã được giáo viên kiểm
tra không lộ đáp án; không tái sử dụng staff prompt.

Màu token như “red toy plane” là presentation công khai vì học sinh phải thấy
token mình kéo. Student projection có thể chứa `tokenColourId`, nhưng không được
giữ một field mang semantics answer key như `correctColourId`.

### 7.4. AI output, số action động và ID

Provider phân tích độc lập các role và chỉ trả dữ liệu logic tương đương:

```ts
{
  questionScene?: ListeningRegion;
  positionScene?: ListeningRegion;
  interactiveObjects: Array<{
    label: string;
    geometry: ListeningRegion;
    confidence?: number;
  }>;
  paletteItems?: Array<{
    objectType: string;
    label: string;
    color?: string;
  }>;
  questions: Array<{
    questionNumber?: 1 | 2 | 3 | 4 | 5;
    prompt: string;
    actions: Array<
      | { type: 'colour_object'; objectLabel: string; correctColor: string; geometry?: ListeningRegion; confidence?: number }
      | { type: 'place_object'; objectType: string; color?: string; targetRegion?: ListeningRegion; relationLabel?: string; confidence?: number }
    >;
  }>;
  warnings?: string[];
}
```

AI tự xác định số action theo evidence của từng câu; parser không truncate về
một action và không hard-code riêng câu 1 có hai action. Backend chỉ cố định đúng
năm unique `questionNumber` 1-5. AI không được sinh question/action/object/
palette/asset/database ID hoặc UUID. Normalizer pick field logic, bỏ mọi ID
provider inject, normalize color label vào catalog và application code mới sinh
hoặc preserve ID.

Màu mới chỉ được map vào đúng catalog 20 màu tiếng Anh hiện có. Không fuzzy-map
màu ngoài catalog, không sinh color variant, không dùng color picker/HEX tự do.
Legacy custom colors tiếp tục đọc/chơi/chấm trong nhánh legacy mà không rewrite.
Mode mới cho phép tái sử dụng màu; không dùng single-use six-colour/distractor
logic cũ.

### 7.5. Geometry, transform và validation

Tận dụng `ListeningRegion` normalized hiện có thay vì tạo coordinate system mới:

- `interactiveObjects[].geometry`: ưu tiên polygon để fill object;
- `targetRegion`: rect, ellipse hoặc polygon;
- mọi point/bounds ở `0..1` theo canonical `question` scene.

Polygon phải có ít nhất ba điểm, finite, trong biên, diện tích khác 0 và không
self-intersect. Backend tính lại bounding box từ points và reject/warning khi bbox
provider mâu thuẫn; không tự biến polygon lỗi thành fixed rectangle. Editor phải
cho chọn/thêm/kéo/xóa point và undo, không chỉ vẽ lại polygon từ đầu.

Nếu geometry/placement lấy từ `position_key`, phải map về ảnh đề bằng scene
transform tương tự Part 1. Với một point `(x,y)` trên position scene:

```text
u = (x - positionScene.x) / positionScene.width
v = (y - positionScene.y) / positionScene.height

canonical.x = questionScene.x + u * questionScene.width
canonical.y = questionScene.y + v * questionScene.height
```

Transform mọi polygon point/corner, validate `u/v`, clamp chỉ sai số biên nhỏ và
tính lại bbox. Không xác định chắc scene correspondence thì unresolved/warning,
không dùng raw position coordinates trên question image.

### 7.6. Re-analyze và staged candidate không mất dữ liệu

Part 5 tiếp tục staged candidate theo `quytac.md`. Matching/merge:

1. Match question bằng `questionNumber`.
2. Match action bằng `type`, normalized object label/type và geometry tương đối.
3. Chỉ preserve ID khi match duy nhất, đủ chắc chắn.
4. Action cũ không match được phải giữ lại để review cùng warning.
5. Action mới không match trở thành đề xuất riêng; không tự thay/xóa action cũ.
6. Review cho giáo viên quyết định giữ, thêm, thay thế hoặc xóa thủ công.
7. Apply mặc định không xóa action cũ nào chỉ vì lần AI mới bỏ sót.

Unresolved prompt, màu, object, token hoặc geometry giữ field/action cũ hợp lệ.
Draft mới không có dữ liệu cũ thì để thiếu và chặn publish; không tạo action,
object, distractor, màu, rectangle hay placement giả.

Flow:

```text
role-based question + answer_key + optional position_key
-> provider
-> backend normalize/validate/transform
-> staged candidate giữ cả unmatched-old và suggested-new
-> giáo viên sửa questions/actions/registry/palette/geometry/mappings
-> validate đủ dữ liệu công khai và private mapping
-> kiểm tra basePartHash
-> apply riêng content.parts[4]
-> working draft có thể sửa/undo
-> autosave theo baseRevision
-> không tự publish
```

### 7.7. Editor và player

Editor mode mới phải cho sửa:

- đúng năm question numbers và staff prompts;
- số action động, loại action và thứ tự;
- public interactive object label/geometry;
- object palette label/type/color/optional asset và distractor state;
- private correct object/color/palette mapping;
- private placement target region/relation;
- warning/unresolved và preview student-safe.

Player chỉ nhận public registry, palette và generic action slots. Colour flow:

- desktop kéo màu; mobile/keyboard chọn màu rồi chọn một public object;
- mọi public colourable object đều eligible theo UI state, không theo đáp án;
- SVG overlay fill object đã chọn ngay và cho đổi màu;
- palette dùng đủ catalog 20 màu và màu được tái sử dụng.

Place flow:

- chọn một generic action slot, chọn bất kỳ token đúng hoặc nhiễu từ palette,
  rồi thả/chạm tại bất kỳ điểm hợp lệ trên scene;
- không freehand;
- player không nhận `targetRegion`, không snap/highlight/gợi ý vùng đúng;
- chỉ highlight toàn scene/drop surface, pointer focus và trạng thái token;
- hover/select nhẹ, mobile tap fallback, keyboard/focus/aria và
  `prefers-reduced-motion` đầy đủ.

### 7.8. Submission, sanitizer và grader

`ListeningAnswers.part5` phải hỗ trợ union tương thích legacy:

```ts
// legacy
targetId -> colourId

// scene colour action
actionId -> {
  type: 'colour_object',
  objectId: string,
  colourId: string
}

// scene placement action
actionId -> {
  type: 'place_object',
  paletteItemId: string,
  anchor: { x: number, y: number }
}
```

Answer sanitizer phải whitelist riêng hai structured shapes, giới hạn ID/field,
chỉ nhận finite normalized coordinates và loại field lạ/malformed. Không dùng
`String(answer)` khiến object thành `"[object Object]"`. String legacy vẫn được
giữ nguyên.

Grader phân nhánh bằng `displayMode`:

- legacy: giữ exact `targetId -> colourId` behavior;
- `colour_object`: actual `objectId` và `colourId` đều phải khớp private mapping;
- `place_object`: `paletteItemId` đúng và anchor nằm trong private target region;
- containment hỗ trợ rect, ellipse và polygon bằng normalized geometry;
- một question đúng chỉ khi mọi action đúng;
- không action nào có answer là unanswered; có ít nhất một action đã làm nhưng
  thiếu/sai action khác là incorrect;
- chỉ emit năm question results cho Part 5, không emit một result/action.

Student snapshot được giữ:

- scene;
- toàn bộ public `interactiveObjects`/geometry;
- toàn bộ public `objectPalette`/token presentation;
- generic question/action IDs và loại tương tác cần cho submission.

Student snapshot phải loại:

- `staffPrompt` và mọi answer text từ ảnh đáp án;
- `correctObjectId`, `correctColourId`, `correctPaletteItemId`;
- toàn bộ `targetRegion`;
- AI confidence/warnings/unresolved;
- answer-key/position-key assets và candidate/editor metadata.

Activity/review sau submit dùng immutable full content ở backend để dựng năm
human-readable rows, tổng hợp các sub-action nhưng không hiển thị ID kỹ thuật.

### 7.9. Regression test bắt buộc Part 5

1. Nhận đúng ba role và ba nhãn UI; `position_key` optional, hai role còn lại
   bắt buộc; bỏ nguồn không archive asset.
2. AI tự xác định một/hai/nhiều actions trên từng câu và vẫn tạo đúng năm câu.
3. Multi-action fixture tách đúng hai cupboard actions trong câu 1.
4. Provider không inject question/action/object/palette/asset/database ID.
5. Màu map chính xác vào catalog 20; ngoài catalog unresolved; màu mode mới được
   tái sử dụng; legacy custom color vẫn chơi/chấm.
6. Public interactive registry chứa geometry độc lập; private mapping không thể
   suy ra trực tiếp từ một action-visible geometry.
7. Polygon normalized, bbox được tính lại, out-of-bounds/zero-area/
   self-intersection bị reject/warning.
8. Position-key geometry được transform đúng sang question scene với ảnh khác
   kích thước/crop; transform mơ hồ không dùng raw coordinates.
9. Re-analyze thiếu action không xóa action cũ; uncertain match giữ old và đưa
   suggested new vào review cùng warning.
10. Palette có mọi correct token và ít nhất một distractor; thiếu token/distractor
    chặn publish, code/AI không sinh object giả.
11. Editor sửa được prompt, số/type action, registry, palette, polygon/region,
    color/mapping và cho preview student-safe.
12. Colour player hỗ trợ drag/tap/keyboard, fill overlay ngay, đổi/tái sử dụng màu
    và không highlight object đúng theo private mapping.
13. Place player hỗ trợ palette đúng+nhiễu, drag/tap/keyboard, đặt lại token và
    không freehand.
14. Student không nhận `targetRegion` và không có highlight/snap/gợi ý vùng đúng.
15. Structured submission qua sanitizer không thành `"[object Object]"`; malformed
    object, unknown field/ID và tọa độ ngoài biên bị loại/reject.
16. Grader colour kiểm tra cả object+màu; place kiểm tra palette item+containment
    cho rect/ellipse/polygon.
17. Câu nhiều action chỉ đúng khi tất cả action đúng; partial answer là incorrect;
    hoàn toàn trống là unanswered; Part 5 vẫn đúng năm results/tổng 25.
18. Student snapshot loại staff prompt, private mappings, target regions, answer
    assets, candidate/warnings/confidence nhưng giữ public registry/palette.
19. Generic action slots không dùng private answer mapping để quyết định
    eligibility; toàn bộ public object/token hợp lệ đều có thể được chọn.
20. Re-analyze/apply Part 5 không thay Parts 1-4.
21. Stale `basePartHash` hoặc autosave `baseRevision` không ghi đè draft mới.
22. Part 5 legacy vẫn mở/sửa/chơi/chấm/review đúng và không rewrite khi đọc.
23. Activity/review mode mới dựng đúng năm dòng dễ đọc, không lộ ID kỹ thuật.
24. Audio/audio URL/transcript không vào prompt/provider payload.
25. Desktop/mobile/reduced-motion, focus/aria và contrast hooks đạt contract UI.

## 8. Kế hoạch triển khai sau khi đủ yêu cầu 5 Part

1. Khóa schema/mode compatibility cho Part 3 và Part 5 bằng discriminated union;
   Part 1-5 hiện đã chốt trong ledger này.
2. Chạy baseline `git status --short` và `npm run test:listening`.
3. Mở rộng typed Smart Import source-role contract và UI slot dùng chung, nhưng
   giữ prompt/parser/validator riêng cho từng Part.
4. Cập nhật backend asset-role validation và provider payload có role rõ ràng.
5. Triển khai Part 1: name/example split, answer mapping, endpoint scene
   transform, bỏ random và safe partial merge.
6. Triển khai Part 2: numbered question/answer mapping, variants và safe partial
   merge.
7. Triển khai Part 3/4/5 đúng từng đặc tả đã chốt. Part 5 phải hoàn thành public
   interaction registry/private mapping, structured answers và legacy branch
   trước khi nối player mới.
8. Bổ sung unit, router, direct-import/staged-apply isolation, stale revision,
   legacy và student-sanitizer regression tests cho từng Part.
9. Chạy test hẹp trước, sau đó:

```bash
npm run lint
npm run test:listening
npm run build
```

10. Kiểm tra `git diff --check`, diff từng file, UAT desktop/mobile với fixture
    thật, rồi cập nhật `CODEMAP.md` và tài liệu deploy. Không sửa `dist` thủ công.

## 9. Vùng source dự kiến chịu ảnh hưởng

- `src/features/listening-editor/smart-import/types.ts`
- `src/features/listening-editor/smart-import/SmartImportPanel.tsx`
- `src/features/listening-library/modules/mover/editor/part1Handler.tsx`
- `src/features/listening-library/modules/mover/editor/part2Handler.tsx`
- handler Part 3/4/5 theo đặc tả đã chốt
- `src/features/listening-library/modules/mover/editor/directImport.ts`
- `src/server/listening-smart-import/service.ts`
- `src/server/listening/listeningRouter.ts`
- provider adapter trong `server.ts`
- test tương ứng của service, router, Smart Import UI, direct import, draft,
  grader/legacy compatibility và student sanitization

Dự kiến không đổi root schema Mover v1, storage/migration, history/attempt hoặc
published content cũ. Part 3 và Part 5 bắt buộc thêm mode/schema branch và mở
rộng player/grader/sanitizer có compatibility adapter. Part 4 giữ schema/grader
hiện tại nhưng mở rộng player/sanitizer tối thiểu để hiển thị public example.
Part 5 mode mới dùng structured submission nhưng string answers legacy vẫn giữ.

## 10. Kết quả triển khai

- Source roles, provider payload, parser/normalizer và UI đã được triển khai cho
  cả năm Part đúng flow: Parts 1-2 direct import; Parts 3-5 staged candidate.
- Part 3 và Part 5 dùng discriminated mode có nhánh legacy; không migration hay
  rewrite published content cũ. New attempts dùng grading version
  `listening-five-part-v2`.
- Part 4 hỗ trợ tách 3 crop example + 15 crop scored khi ảnh có example, đồng
  thời vẫn nhận fixture legacy 15 crop không example.
- Student sanitizer giữ geometry/palette công khai cần cho tương tác nhưng loại
  scored mapping Part 3 và toàn bộ private target/mapping Part 5.
- Release checks ngày 2026-08-08: `npm run lint` pass,
  `npm run test:listening` pass 52/52, `npm run build` pass và
  `git diff --check` pass. Build chỉ còn các cảnh báo Vite sẵn có về Firebase
  mixed imports và kích thước chunk.
