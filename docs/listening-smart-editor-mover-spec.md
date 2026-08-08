# Đặc tả Smart Editor cho Mover

> Cập nhật yêu cầu ngày 2026-08-08: kế hoạch nâng cấp mới nhất được lưu tại
> `docs/listening-smart-editor-five-part-upgrade-plan.md`. Các quyết định đã
> duyệt và trạng thái triển khai cho toàn bộ Part 1-5 trong tài liệu mới thay thế
> mọi mô tả xung đột bên dưới, gồm random provisional mapping và flow Part 3
> direct import. Phần còn lại của tài liệu này được giữ như lịch sử thiết kế.

## 1. Trạng thái

- Module: Mover.
- Part 1: đã nhận và xác nhận mô tả nghiệp vụ, hình mẫu và quy tắc đáp án ngẫu nhiên bắt buộc giáo viên/admin đặt lại.
- Part 2: đã nhận và xác nhận mô tả nghiệp vụ, hình mẫu và quy tắc trích đáp án in đậm.
- Part 3: đã nhận và xác nhận mô tả nghiệp vụ, hai hình mẫu và luồng nhập thủ công khi OCR thất bại.
- Part 4: đã nhận và xác nhận mô tả nghiệp vụ, hai hình mẫu, phương án crop ba ảnh và quy tắc lấy đáp án có sẵn trong ảnh nguồn.
- Part 5: đã nhận và xác nhận đầy đủ mô tả nghiệp vụ, hình mẫu, quy tắc vùng/đáp án tạm của Part 1, catalog 20 màu tiếng Anh và phạm vi chỉ gồm năm câu `colour`.
- Đã triển khai code; còn UAT trình duyệt theo fixture thật.
- Tài liệu này bổ sung cho `docs/listening-smart-editor-plan.md` và không thay đổi các bất biến trong kế hoạch đó.

### Nguyên tắc chung đã xác nhận cho mọi Part

- Không bao giờ dùng audio hoặc transcript tạo từ audio để trích xuất/suy luận đáp án; audio chỉ được upload, gắn vào Part và phát cho học sinh.
- Đáp án phải có sẵn trong ảnh/text đầu vào theo quy tắc được xác nhận của từng Part. Part 1 là ngoại lệ dùng mapping random tạm thời để giáo viên đặt lại, không phải AI đoán đáp án.
- AI/code tự động trích thông tin để rút ngắn thao tác nhập liệu. Theo cập nhật ngày 2026-08-02, Part 1/2/3 điền thẳng vào working draft sau kiểm tra hash; Part 4-5 tiếp tục dùng staged candidate.
- Giáo viên/admin luôn xem lại và có thể sửa tại form chính trước khi publish. Direct import không đồng nghĩa tự publish.
- Tốc độ nhập liệu không được đánh đổi bằng đáp án đoán. Dữ liệu thiếu bằng chứng hoặc confidence thấp phải được đánh dấu `Cần kiểm tra`.

### Cập nhật luồng review Part 1/2/3 và crop Part 4 ngày 2026-08-02

- Part 1 bỏ bảng `Bản đề xuất đang chờ giáo viên duyệt`, checkbox xác nhận và nút áp dụng trung gian. Tên, vùng và mapping random do code tạo được điền thẳng vào form soạn; giáo viên sửa thẻ tên, dropdown đáp án và vị trí vùng ngay bên dưới.
- Part 2 bỏ bảng review heading/example/questions/answers. Các trường này được điền thẳng vào form soạn và vẫn chỉnh sửa được.
- Part 2 chỉ giữ bước crop riêng: hiển thị toàn bộ ảnh nguồn, AI đặt khung ban đầu, giáo viên dùng chuột để vẽ lại, di chuyển hoặc resize rồi mới tạo derived illustration asset.
- Part 3 coi ảnh thứ nhất là board A-F nguyên khối và không gửi ảnh này cho AI. Kết quả được import trực tiếp vào form Part 3; nếu chỉ có board thì nhãn hiện tại được giữ để giáo viên nhập, còn AI chỉ đọc ảnh thứ hai chứa danh sách nhãn hoặc pasted text OCR.
- Part 4 không còn tin tọa độ AI là crop cuối. AI chỉ đọc nội dung/thứ tự/answer marker và đưa hint; browser code phát hiện khung tối theo pixel, cho phép một cạnh bị mờ, xếp theo bố cục rồi crop phía trong đường viền. Nếu chưa đủ khung, giữ hint AI và cho chỉnh từng ảnh bằng chuột.
- Các mô tả staged candidate cũ cho Part 1/2/3 ở phần dưới được thay thế bởi quyết định cập nhật này; quy tắc không dùng audio, kiểm tra hash, cô lập Part và không tự publish vẫn giữ nguyên.

## 2. Part 1 - Mục tiêu nghiệp vụ

Giáo viên tải lên tranh tình huống Part 1. Smart Editor hỗ trợ:

1. Đọc các tên được in quanh tranh.
2. Nhận diện những nhân vật có trong tranh và tọa độ tâm tương đối của từng nhân vật.
3. Nhận diện example có sẵn nếu tranh có tên và đường nối mẫu.
4. Điền các tên hợp lệ vào sáu thẻ tên của Part 1.
5. Tạo năm vùng trả lời cho năm câu chấm điểm.
6. Khởi tạo năm đáp án bằng một hoán vị ngẫu nhiên của năm trong sáu thẻ tên; đây chỉ là dữ liệu tạm để giáo viên/admin đặt lại, không phải đáp án do AI suy luận.
7. Cho phép giáo viên kéo từng vùng như một vật thể để chỉnh vị trí.
8. Không cho thay đổi kích thước hoặc loại hình của vùng Part 1.
9. Giữ nguyên phần audio, tiêu đề và hướng dẫn của Part 1.

Part 1 Mover schema v1 tiếp tục có:

- Một example không chấm điểm khi đề có example.
- Sáu thẻ tên cho phần chấm điểm.
- Năm nhân vật/vùng chấm điểm.
- Năm tên được dùng làm đáp án và một tên nhiễu.

### Fixture từ hình mẫu đã cung cấp

Kết quả đúng sau khi giáo viên/admin hoàn tất đặt lại đáp án, dùng làm fixture đầu tiên:

- Example: `Fred`, nối tới người đàn ông đứng; không chấm điểm.
- Sáu choice name: `Paul`, `John`, `Jill`, `Sally`, `Jane`, `Daisy`.
- Target 1: `Paul`, nhân vật bé trai áo đỏ đang ngồi dưới cây.
- Target 2: `John`, nhân vật bé trai đứng cạnh/ngựa.
- Target 3: `Jill`, nhân vật bé gái ngồi cầm gấu bông.
- Target 4: `Sally`, nhân vật nữ đang chạy.
- Target 5: `Jane`, nhân vật bé gái tóc vàng đang vẽ.
- Distractor: `Daisy`.

Tọa độ chính xác của năm target sẽ lấy từ tâm nhân vật do AI đề xuất rồi được code chuyển thành vùng cố định; ảnh đánh số chỉ là ground truth trực quan, không phải dữ liệu được lưu vào đề.

## 3. Giới hạn thông tin có thể lấy từ ảnh

Ảnh đơn lẻ có thể cung cấp:

- Text/tên được in trên ảnh.
- Vị trí tương đối của từng tên.
- Danh sách và vị trí các nhân vật.
- Đường nối example nếu đường này đã được in trên ảnh.
- Mô tả hình ảnh của nhân vật như màu áo, hành động và vị trí.

Ảnh đơn lẻ không cung cấp chắc chắn:

- Tên nào thuộc nhân vật nào trong năm câu nghe.
- Nhân vật nào không được hỏi.
- Tên nào là distractor.

Vì vậy:

- Image-only import được phép tự điền tên và đề xuất vị trí nhân vật.
- AI không được suy luận hoặc đề xuất đáp án Part 1 từ ảnh, audio hay transcript.
- Code khởi tạo năm đáp án tạm bằng cách xáo trộn sáu choice name, lấy năm tên khác nhau cho năm target và để lại đúng một distractor.
- Mọi đáp án ngẫu nhiên phải được đánh dấu rõ là `provisional/random` và `requiresManualConfirmation` trong candidate/editor state.
- Giáo viên/admin luôn phải đặt lại và xác nhận riêng cả năm đáp án trong màn hình soạn đề. Không được coi thao tác tạo ngẫu nhiên là xác nhận.
- Không cho merge/publish Part 1 khi còn bất kỳ đáp án ngẫu nhiên nào chưa được giáo viên/admin xác nhận.

## 4. Phân công AI và code

### AI thị giác phù hợp hơn cho

- OCR tên trên tranh.
- Phát hiện example name và đường nối mẫu.
- Phát hiện nhân vật, kể cả nhiều nhân vật gần nhau.
- Trả về tâm nhân vật theo tọa độ chuẩn hóa 0-1.
- Mô tả ngắn nhân vật để giáo viên dễ nhận biết, ví dụ `boy in red shirt sitting under the tree`.
- Đề xuất confidence và cảnh báo khi nhân vật bị che, ảnh mờ hoặc OCR không chắc chắn.

### Audio trong Part 1

- Audio upload và thông tin hướng dẫn vẫn được giữ nguyên như yêu cầu.
- Smart Editor Part 1 không phân tích audio hoặc tạo transcript để sinh/đề xuất answer mapping.
- Audio chỉ là tài nguyên của bộ đề theo nguyên tắc chung; không nằm trong request/payload AI.

### Code phải chịu trách nhiệm

- Kiểm tra quyền truy cập ảnh/audio.
- Chuẩn hóa Unicode, khoảng trắng, chữ hoa/thường và loại bỏ tên trùng.
- Sinh ID thật cho choices, targets và example.
- Kiểm tra số lượng tên, target và distractor.
- Tạo hoán vị ngẫu nhiên không trùng cho năm đáp án tạm và để lại đúng một distractor.
- Gắn trạng thái bắt buộc xác nhận thủ công cho từng đáp án tạm; không cho giá trị random tự trở thành đáp án đã duyệt.
- Tính vùng chữ nhật cố định từ tâm nhân vật.
- Clamp vùng vào biên ảnh.
- Ngăn resize và ngăn đổi shape.
- Merge candidate sau khi giáo viên xác nhận.
- Đảm bảo chỉ Part 1 thay đổi.
- Chạy validation trước autosave/publish.

Không nên triển khai OCR + object detection + line detection thuần code trong phiên bản đầu, vì dự án hiện không có các model/thư viện này và việc kết hợp chúng phức tạp hơn AI vision. Code vẫn là lớp quyết định cuối cùng đối với schema, tọa độ, số lượng và merge.

## 5. Candidate tạm thời của AI

Candidate không dùng ID database. Các khóa tạm chỉ tồn tại trong phiên review.

```ts
interface MoverPart1DetectedName {
  key: string;
  label: string;
  role: 'example' | 'choice' | 'unknown';
  sourceBox?: { x: number; y: number; width: number; height: number };
  confidence: number;
}

interface MoverPart1PersonAnchor {
  key: string;
  center: { x: number; y: number };
  detectedBox?: { x: number; y: number; width: number; height: number };
  visualDescription: string;
  confidence: number;
}

interface MoverPart1AnswerProposal {
  targetKey: string;
  personAnchorKey: string;
  choiceNameKey: string;
  source: 'random' | 'manual';
  requiresManualConfirmation: boolean;
  confirmedByTeacher: boolean;
}

interface MoverPart1ImportCandidate {
  names: MoverPart1DetectedName[];
  people: MoverPart1PersonAnchor[];
  example?: {
    nameKey: string;
    personAnchorKey: string;
    confidence: number;
  };
  answers: MoverPart1AnswerProposal[];
  warnings: string[];
}
```

Candidate có thể chứa nhiều hơn năm person anchor để giáo viên chọn đúng năm nhân vật được hỏi. Không tự loại nhân vật chỉ để ép đủ số lượng. `answers` ban đầu luôn là hoán vị ngẫu nhiên do code tạo, không phải output của AI; từng phần tử chỉ chuyển từ `random` sang `manual` sau thao tác đặt lại/xác nhận của giáo viên hoặc admin.

## 6. Chuyển candidate vào schema Mover hiện tại

Sau khi giáo viên duyệt:

- Sáu tên có role `choice` trở thành `ListeningChoice[]`.
- Example, nếu được xác nhận, trở thành `ListeningPart1.example` và không nằm trong năm target chấm điểm.
- Năm answer proposal đã được giáo viên/admin đặt lại và xác nhận trở thành `ListeningPart1Target[]`.
- `choiceId` được ánh xạ từ tên đã chọn.
- `region` được code tạo từ `personAnchor.center` với kích thước cố định.
- Tên distractor là choice không được target nào sử dụng.

Luồng này có thể giữ nguyên `ListeningPart1` schema v1; dữ liệu nhận diện tạm thời và confidence không cần lưu vào published content.

## 7. Quy tắc vùng tương tác Part 1

### Hình dạng và kích thước

- Luôn dùng `shape: 'rect'`.
- UI hiển thị chữ nhật bo tròn góc bằng CSS.
- Tất cả vùng dùng chung một kích thước chuẩn hóa cố định.
- Không có resize handle.
- Không có lựa chọn Elip hoặc Polygon.
- Không hiển thị nút `Hoàn tất` dành cho polygon.
- Các control shape trong hình mẫu thứ ba chỉ bị ẩn/bỏ ở Part 1; không xóa khả năng của Region Editor dùng cho Part khác.

Kích thước khởi tạo đề xuất để xác nhận:

```ts
const PART1_TARGET_SIZE = {
  width: 0.12,
  height: 0.055,
};
```

Kích thước được lưu theo tỷ lệ ảnh, nên giữ ổn định khi ảnh responsive.

### Tạo vị trí từ tâm nhân vật

```ts
x = clamp(center.x - width / 2, 0, 1 - width);
y = clamp(center.y - height / 2, 0, 1 - height);
```

- Tâm vùng ban đầu trùng gần tâm thân nhân vật do AI đề xuất.
- Khi giáo viên chọn answer/target, vùng tương ứng được active và tự chuyển đến anchor của nhân vật được chọn nếu mapping có bằng chứng.
- Giáo viên có thể kéo toàn bộ vùng bằng chuột hoặc pointer.
- Khi kéo, kích thước không thay đổi và vùng không được vượt biên ảnh.
- Nên hỗ trợ phím mũi tên để chỉnh tinh vị trí cho accessibility.

### Trạng thái hiển thị

Đề xuất để xác nhận:

- Active target: fill opacity khoảng `0.38`, viền nổi bật và nằm trên các vùng khác.
- Inactive target: fill opacity khoảng `0.12` để vẫn nhìn thấy nhưng không che tranh.
- Khi kéo: cursor `grab/grabbing` và hiển thị số vùng hoặc tên đang gán.
- Opacity là thuộc tính giao diện editor, không ghi vào schema/published content.

Không thay đổi cách hiển thị vùng ở student player nếu chưa có yêu cầu riêng; việc này giữ đúng phạm vi Smart Editor.

## 8. Luồng giao diện Part 1

1. Giữ phần `Tiêu đề Part`, `Hướng dẫn` và `Audio Part 1`.
2. Giáo viên tải/chọn `Tranh tình huống Part 1`.
3. Nút `Phân tích ảnh Part 1` tạo image candidate.
4. Code tạo năm đáp án ngẫu nhiên không trùng từ sáu choice name và đánh dấu tất cả là `Tạm thời - cần đặt lại`.
5. Khu vực review hiển thị:
   - tên example;
   - sáu tên choice;
   - các person anchor;
   - năm mapping ngẫu nhiên tạm thời;
   - trạng thái đã/chưa được giáo viên xác nhận và cảnh báo nhận diện ảnh.
6. Giáo viên/admin bắt buộc đặt lại hoặc xác nhận có chủ ý từng tên, chọn đúng năm nhân vật và hoàn tất cả năm đáp án.
7. Sáu thẻ tên và năm dropdown đáp án được điền từ candidate; mỗi dropdown ngẫu nhiên vẫn mang trạng thái chưa xác nhận cho đến khi có thao tác thủ công.
8. Chọn một dropdown/target sẽ active vùng tương ứng và đưa vùng tới person anchor đã chọn.
9. Giáo viên kéo vùng để tinh chỉnh; không resize/đổi shape.
10. Xác nhận merge chỉ cập nhật `content.parts[0]`.

## 9. Quy tắc merge

- Không merge nếu `basePartHash` không còn khớp Part 1 hiện tại.
- Không thay ảnh/audio hiện có nếu giáo viên không chọn thay.
- Không ghi đè title/instruction bằng AI nếu các trường này không thuộc candidate đã duyệt.
- Không ghi đè tên/answer đã sửa thủ công chỉ vì chạy lại image analysis.
- Không cho áp dụng nhóm `answer mappings` khi còn đáp án có `requiresManualConfirmation = true`.
- Cho phép chọn riêng các nhóm để áp dụng: `names`, `example`, `people/regions`, `answer mappings` đã xác nhận.
- Phân tích lại Part 1 không thay `parts[1..4]`.
- Candidate chưa xác nhận không được autosave vào draft chính.

## 10. Validation và xử lý lỗi

Candidate sẵn sàng merge khi:

- Có đúng sáu choice name hợp lệ, không trùng sau normalize.
- Có đúng năm target được giáo viên xác nhận.
- Mỗi target liên kết một person anchor hợp lệ.
- Có năm choice khác nhau được dùng; choice còn lại là distractor.
- Cả năm answer mapping đều đã được giáo viên/admin xác nhận thủ công; không còn nguồn `random`.
- Tọa độ hữu hạn và nằm trong 0-1.
- Vùng cố định sau clamp không vượt biên ảnh.
- Example không được tính vào năm target.

Hành vi khi dữ liệu không đạt:

- OCR không đủ/thừa tên: hiển thị danh sách để giáo viên sửa, không tự merge.
- Không nhận diện chắc chắn example: đặt role `unknown` và yêu cầu giáo viên chọn.
- Có nhiều hơn năm nhân vật khả nghi: giữ các candidate và yêu cầu chọn năm.
- Thiếu audio/transcript không ảnh hưởng bước khởi tạo ngẫu nhiên vì Part 1 không dùng chúng để suy luận đáp án.
- Còn đáp án ngẫu nhiên chưa xác nhận: giữ candidate ở `needs_review`, chặn merge/publish và chỉ rõ target nào chưa hoàn tất.
- Vùng chồng lấn: cảnh báo và yêu cầu chỉnh vị trí trước publish.

Việc bổ sung validation `năm đáp án khác nhau + một distractor` phải được kiểm tra compatibility với draft Mover cũ trước khi siết whole-set publish validator. Published version cũ vẫn phải đọc/chấm được.

## 11. Tiêu chí chấp nhận Part 1

- Upload ảnh mẫu nhận được đúng các tên in quanh ảnh hoặc đánh dấu rõ tên không chắc chắn.
- Example có đường nối được nhận diện riêng và không tính vào năm câu.
- AI trả được các person anchor theo tọa độ chuẩn hóa.
- AI không làm phát sinh answer mapping từ ảnh, audio hoặc transcript.
- Code tạo đúng năm đáp án tạm không trùng, để lại đúng một distractor và hiển thị rõ đây là dữ liệu random chưa xác nhận.
- Giáo viên/admin phải đặt lại/xác nhận cả năm; khi đó sáu thẻ tên và năm đáp án mới được phép merge/publish.
- Mỗi target là chữ nhật bo góc, kích thước giống nhau.
- Vùng tự đặt vào tâm nhân vật và kéo được như một vật thể.
- Không resize được và không có nút Elip/Polygon ở Part 1.
- Active region nổi bật hơn nhưng vẫn nhìn được nhân vật.
- Merge Part 1 giữ nguyên Parts 2-5.
- Player/grader/published Mover cũ không bị thay đổi ngoài yêu cầu đã xác nhận.

## 12. Các điểm Part 1 đã xác nhận

1. AI không phân tích ảnh, audio hoặc transcript để suy luận đáp án. Code chỉ tạo hoán vị random tạm thời; giáo viên/admin luôn đặt lại và xác nhận cả năm đáp án trong màn hình soạn đề.
2. Example có đường nối như `Fred` được nhận diện riêng, loại khỏi sáu thẻ tên và không chấm điểm.
3. Kích thước vùng mặc định là `width = 0.12`, `height = 0.055` theo tỷ lệ ảnh.
4. Mức nổi bật trong editor là `active opacity = 0.38`, `inactive opacity = 0.12`.
5. Thay đổi opacity chỉ áp dụng trong editor; không thay đổi giao diện học sinh trong phạm vi này.

## 13. Part 2 - Mục tiêu nghiệp vụ

Giáo viên/admin tải lên ảnh nguồn của Part 2. Smart Editor hỗ trợ:

1. Đọc tiêu đề nội dung trên ảnh, ví dụ `ABC`.
2. Nhận diện example không chấm điểm nếu có.
3. Nhận diện đúng năm dòng câu hỏi theo thứ tự đọc.
4. Phân biệt phần câu dẫn và phần đáp án dựa trên khác biệt kiểu chữ; trong mẫu này, đáp án được in đậm hơn phần câu hỏi.
5. Thay từng phần đáp án bằng ô trống trong `prompt` và đưa nội dung in đậm vào `acceptedAnswers`.
6. Tự điền candidate vào đúng trường soạn Part 2 dạng staged/editable để giáo viên/admin duyệt và sửa trước khi merge.
7. Giữ nguyên phần tải audio, tiêu đề Part và hướng dẫn chung của Part 2.

`ABC` trong hình mẫu ánh xạ tới `ListeningPart2.heading`, không ghi đè `ListeningPartBase.title` đang dùng để đặt tên Part.

Part 2 Mover schema v1 hiện tại đã đáp ứng yêu cầu:

- `heading`: tiêu đề nội dung như `ABC`.
- `exampleText`: example không chấm điểm, nếu có.
- `questions`: đúng năm câu.
- `question.prompt`: câu dẫn có một hoặc nhiều token `{{blankId}}` tại vị trí đáp án.
- `question.blanks[].acceptedAnswers`: một hoặc nhiều đáp án được chấp nhận cho từng ô.

Không cần thay đổi schema, student player hoặc grader cho cấu trúc mẫu này.

## 14. Fixture Part 2 từ hình mẫu

Kết quả mong muốn dùng làm fixture đầu tiên:

- `heading`: `ABC`.
- `exampleText`: `Name: Jill Walker`.
- Câu 1:
  - prompt: `Lives at: 7 {{blank-1}} Street`;
  - accepted answers: `Main`.
- Câu 2:
  - prompt: `Class number: {{blank-2}}`;
  - accepted answers: `four b`, `4b`.
- Câu 3:
  - prompt: `Favourite sport: {{blank-3}}`;
  - accepted answers: `hockey`.
- Câu 4:
  - prompt: `Likes reading: {{blank-4}}`;
  - accepted answers: `comics`.
- Câu 5:
  - prompt: `Pet: {{blank-5}}`;
  - accepted answers: `snake`.

Các tên `blank-1` đến `blank-5` chỉ là khóa tạm để mô tả fixture. Code phải sinh ID thật; AI không được sinh hoặc quyết định ID database.

Số thứ tự đầu dòng trên ảnh chỉ dùng để xác định thứ tự câu. Không lưu `1.`, `2.`, ... vào `prompt`, vì student renderer hiện tự hiển thị số câu; lưu cả số sẽ gây lặp như `1. 1. Lives at...`.

## 15. Quy tắc phân biệt câu hỏi và đáp án

### Bằng chứng chính

- Câu hỏi là phần chữ thường/ít đậm hơn.
- Đáp án là span chữ đậm hơn rõ ràng nằm trong cùng dòng hoặc cùng khối câu hỏi.
- Vị trí trước và sau span đậm phải được giữ nguyên để tạo đúng câu dẫn có ô trống.
- Không dùng ngữ nghĩa, audio, transcript tạo từ audio hoặc kiến thức bên ngoài để đoán một từ là đáp án nếu ảnh không thể hiện đủ khác biệt kiểu chữ.

Ví dụ:

```text
Ảnh:    Lives at: 7 [Main - chữ đậm] Street
Prompt: Lives at: 7 {{blankId}} Street
Answer: Main
```

### Nhiều đáp án được chấp nhận

- Dấu `|` trong một span đáp án được hiểu là ký hiệu phân cách các biến thể, ví dụ `four b | 4b` trở thành `['four b', '4b']`.
- Code trim khoảng trắng, loại chuỗi rỗng và loại biến thể trùng sau normalize.
- Không tự coi dấu `/`, dấu phẩy hoặc từ `or` là dấu phân cách nếu chưa có quy tắc riêng; giữ nguyên để giáo viên duyệt.
- Không tự tạo thêm biến thể viết hoa/thường vì grader hiện đã normalize Unicode NFKC, khoảng trắng, chữ hoa/thường và dấu nháy.

### Nhiều ô trống trong một câu

Schema hiện tại hỗ trợ nhiều blank. Nếu một dòng có nhiều span đậm tách biệt, mỗi span trở thành một blank riêng theo đúng thứ tự trái sang phải. Câu chỉ được chấm đúng khi tất cả blank đều đúng, đúng với grader hiện tại.

## 16. Phân công AI và code cho Part 2

### AI thị giác phù hợp hơn cho

- OCR theo bố cục, dòng và thứ tự đọc.
- Nhận diện tiêu đề, example, số câu và từng khối câu hỏi.
- Nhận diện bounding box của vùng tranh minh họa khi ảnh nguồn là một trang tổng hợp.
- Phân loại font weight/độ đậm tương đối giữa các span trong cùng một câu.
- Trả bounding box cho tiêu đề, câu dẫn và từng đáp án để giao diện review có thể đánh dấu trực tiếp trên ảnh.
- Trả confidence riêng cho OCR text, vai trò span và độ đậm.

Không nên dùng ngưỡng màu/pixel thuần code làm nguồn quyết định duy nhất vì ảnh scan, độ tương phản, nền ô đáp án, font và chất lượng nén có thể khác nhau. AI vision tạo đề xuất; giáo viên/admin vẫn là người duyệt cuối cùng.

### Code phải chịu trách nhiệm

- Kiểm tra quyền truy cập và loại/dung lượng ảnh.
- Chuẩn hóa rotation/orientation và kích thước đầu vào nếu cần, không sửa asset gốc.
- Validate/clamp vùng tranh minh họa trong tọa độ 0-1, tạo preview crop và chỉ sinh derived image asset sau khi giáo viên/admin xác nhận.
- Giữ nguyên asset nguồn; bản crop là asset mới có metadata truy vết về nguồn, không ghi đè file gốc.
- Sinh khóa candidate tạm và ID thật sau khi merge.
- Loại số thứ tự đầu dòng khỏi prompt.
- Thay đúng span đáp án bằng `{{blankId}}`, kể cả khi đáp án nằm giữa câu.
- Tách biến thể đáp án theo dấu `|`, trim, loại rỗng và loại trùng.
- Giữ nguyên chính tả/case hiển thị của OCR; chỉ dùng normalize để so sánh/validation.
- Kiểm tra đúng năm câu, thứ tự câu, số blank và accepted answers.
- Merge candidate sau khi giáo viên/admin xác nhận và bảo đảm chỉ `content.parts[1]` thay đổi.

## 17. Candidate tạm thời của AI cho Part 2

```ts
interface MoverPart2TextSpanCandidate {
  key: string;
  text: string;
  role: 'heading' | 'example' | 'question_number' | 'prompt' | 'answer' | 'unknown';
  box: { x: number; y: number; width: number; height: number };
  weight: 'regular' | 'bold' | 'unknown';
  ocrConfidence: number;
  roleConfidence: number;
}

interface MoverPart2BlankCandidate {
  key: string;
  rawText: string;
  acceptedAnswers: string[];
  sourceSpanKeys: string[];
  confidence: number;
  requiresManualConfirmation: boolean;
}

interface MoverPart2QuestionCandidate {
  key: string;
  order: number;
  prompt: string;
  blanks: MoverPart2BlankCandidate[];
  sourceSpanKeys: string[];
  confidence: number;
}

interface MoverPart2ImportCandidate {
  heading?: string;
  exampleText?: string;
  illustration?: {
    sourceAssetId: string;
    crop: { x: number; y: number; width: number; height: number };
    confidence: number;
    requiresManualConfirmation: boolean;
  };
  spans: MoverPart2TextSpanCandidate[];
  questions: MoverPart2QuestionCandidate[];
  warnings: string[];
}
```

Candidate không chứa ID database và không tự ghi vào draft. Bounding box chuẩn hóa 0-1 chỉ phục vụ review/evidence, không cần lưu vào published Part 2.

## 18. Luồng giao diện Part 2

1. Giữ `Tiêu đề Part`, `Hướng dẫn` và `Audio Part 2` hiện có.
2. Giáo viên/admin tải/chọn ảnh nguồn Part 2.
3. Chọn `Phân tích ảnh Part 2`.
4. Backend gọi Part 2 extractor và trả candidate có heading, example, năm câu, blank, answers, bounding box, confidence và warnings.
5. Giao diện tự điền candidate vào các trường staged/editable và hiển thị ảnh nguồn bên cạnh dữ liệu đã tách:
   - tiêu đề nội dung;
   - example;
   - từng prompt với ô trống;
   - accepted answers của từng blank;
   - preview vùng tranh sẽ được cắt làm illustration;
   - highlight khác màu cho prompt và answer span trên ảnh.
6. Các giá trị được AI điền chỉ là đề xuất. Trường có confidence thấp hoặc không phân biệt được độ đậm phải mang trạng thái `Cần kiểm tra`, không được âm thầm đoán.
7. Giáo viên/admin sửa và xác nhận candidate.
8. Sau khi giáo viên/admin xác nhận vùng crop, backend tạo derived image asset từ ảnh nguồn và gắn asset mới vào trường illustration.
9. Chọn áp dụng sẽ điền `heading`, `exampleText`, `questions` và illustration đã duyệt vào editor Part 2.
10. Merge chỉ cập nhật `content.parts[1]`; ảnh nguồn phân tích không tự ghi đè hình minh họa nếu giáo viên chưa chọn.

## 19. Quy tắc merge Part 2

- Không merge nếu `basePartHash` không còn khớp Part 2 hiện tại.
- Không thay audio, `title`, `instruction` hoặc illustration ngoài nhóm dữ liệu giáo viên chọn áp dụng.
- Không tạo/lưu derived illustration khi crop chưa được xác nhận; không bao giờ chỉnh sửa hoặc thay thế binary của ảnh nguồn.
- Cho phép chọn riêng `heading`, `exampleText` và `questions`.
- Nếu áp dụng `questions`, áp dụng trọn bộ năm câu đã duyệt để tránh trộn thứ tự/blank ID của hai phiên bản.
- Không ghi đè câu đã sửa thủ công chỉ vì chạy lại phân tích ảnh.
- Candidate chưa xác nhận không được autosave vào draft chính.
- Phân tích lại Part 2 không thay Parts 1, 3, 4 và 5.

## 20. Validation và xử lý lỗi Part 2

Candidate sẵn sàng merge khi:

- Có heading hợp lệ.
- Có đúng năm question theo thứ tự duy nhất 1-5.
- Mỗi question có prompt không rỗng và ít nhất một token `{{blankId}}`.
- Mỗi blank có ít nhất một accepted answer không rỗng.
- Mỗi blank xuất hiện đúng một lần trong prompt của chính question đó.
- Question/blank keys không trùng trong candidate; ID thật do code sinh sau merge cũng không trùng.
- Tất cả trường `requiresManualConfirmation` đã được giáo viên/admin xác nhận.
- Nếu chọn dùng illustration tự cắt: crop hữu hạn, nằm trong 0-1, có chiều rộng/cao dương, đạt kích thước pixel tối thiểu sau crop và derived asset được tạo thành công.

Hành vi khi dữ liệu không đạt:

- Không nhận diện được heading: để trống, cảnh báo và yêu cầu nhập thủ công.
- Không đủ hoặc thừa năm câu: giữ toàn bộ khối OCR trong review, không tự cắt/ghép để ép đủ năm.
- Không phân biệt chắc chắn prompt/answer: giữ raw text và bounding box, đánh dấu `needs_review`, không đoán bằng ngữ nghĩa.
- OCR không chắc chắn một ký tự trong đáp án: không tự thêm nhiều accepted answer; yêu cầu giáo viên sửa/xác nhận.
- Bold span rỗng hoặc token không khớp: chặn merge.
- Ảnh nghiêng/mờ/tương phản thấp: trả cảnh báo cụ thể để giáo viên đổi ảnh hoặc nhập tay.
- Không nhận diện chắc chắn vùng tranh: cho phép giáo viên kéo/chỉnh crop hoặc bỏ chọn illustration; không cắt theo phỏng đoán rồi tự lưu.

## 21. Tiêu chí chấp nhận Part 2

- Ảnh mẫu tạo đúng heading `ABC`.
- Example `Name: Jill Walker` được tách riêng và không tính vào năm câu.
- Tạo đúng năm câu theo thứ tự ảnh và không lặp số câu trong prompt.
- Mỗi span in đậm được thay đúng vị trí bằng blank; phần chữ trước/sau được giữ nguyên.
- Câu 1 giữ `7` và `Street` trong prompt, chỉ `Main` là đáp án.
- Câu 2 tạo hai accepted answers `four b` và `4b` từ dấu `|`.
- Các câu 3-5 lần lượt có đáp án `hockey`, `comics`, `snake`.
- Dữ liệu không rõ độ đậm bị đánh dấu cần duyệt, không được AI đoán bằng ngữ nghĩa, audio hoặc transcript tạo từ audio.
- Giáo viên/admin có thể sửa heading, prompt và accepted answers trước khi áp dụng.
- Nếu ảnh nguồn là trang tổng hợp, vùng tranh được preview/căn chỉnh trước khi tạo illustration asset mới; ảnh nguồn vẫn nguyên vẹn.
- Merge Part 2 giữ nguyên Parts 1, 3, 4 và 5.
- Schema v1, player, grader và published Mover cũ tiếp tục hoạt động như trước.

## 22. Các điểm Part 2 đã xác nhận

1. Dấu `|` trong phần in đậm là dấu phân cách các đáp án chấp nhận, ví dụ `four b | 4b`.
2. Khi có nhiều span in đậm trong cùng một câu, mỗi span tạo một ô trống riêng.
3. Khi ảnh nguồn có cả tranh minh họa và câu hỏi, Smart Editor tự cắt vùng tranh và lưu/gắn làm illustration sau bước review.
4. Example lấy toàn bộ nội dung sau nhãn `Example:` vào `exampleText`, không cần tách answer key riêng.
5. Không dùng audio để trích đáp án. AI lấy đáp án có sẵn từ phần in đậm trên ảnh, tự điền vào trường soạn và giáo viên/admin luôn xem lại, có thể sửa trước khi xác nhận.

## 23. Part 3 - Mục tiêu nghiệp vụ

Part 3 dùng hai ảnh với hai vai trò tách biệt:

1. **Ảnh bảng lựa chọn A-F**: một ảnh nguyên khối chứa sáu hình nhỏ và nhãn A-F. Ảnh này được upload, lưu và hiển thị nguyên vẹn; không cắt thành sáu ảnh, không cần AI/OCR và không tạo sáu vùng tương tác.
2. **Ảnh nguồn lấy nhãn**: AI/OCR chỉ lấy năm chuỗi text thuộc cột được người dùng minh họa bằng khung đỏ. Khung đỏ chỉ có trong ảnh mô tả ở cuộc trò chuyện, không tồn tại trong ảnh nguồn thực tế và không được coi là dấu hiệu bắt buộc.

Kết quả OCR được điền vào năm dòng ghép. Mỗi dòng có:

- Một label có thể sửa, ví dụ `Monday`.
- Một dropdown đáp án chữ `A` đến `F` do code tạo.

Theo phạm vi đã mô tả, AI không phân tích nội dung sáu hình A-F, không đối chiếu thumbnail, không suy luận `correctOptionId` và không dùng audio. Giáo viên/admin chọn đáp án đúng A-F cho từng dòng.

## 24. Fixture Part 3 từ hình mẫu

### Ảnh bảng lựa chọn

- Một asset duy nhất chứa sáu hình nhỏ đã bố trí thành hai cột, ba hàng.
- Các nhãn `A`, `B`, `C`, `D`, `E`, `F` đã nằm trên ảnh.
- Không crop/tách ảnh và không trích xuất dữ liệu từ asset này.

### Ảnh nguồn OCR

Năm label cần lấy theo thứ tự từ trên xuống:

1. `Monday`
2. `Tuesday`
3. `Wednesday`
4. `Thursday`
5. `Friday`

Các thumbnail, dropdown và thành phần ngoài cột label không phải dữ liệu cần trích xuất. Khung đỏ trong ảnh fixture chỉ là chú thích ground truth cho tài liệu/test; extractor phải hoạt động khi ảnh thật không có khung đỏ.

Fixture chưa xác định đáp án đúng A-F. Các dropdown phải ở trạng thái chưa chọn cho đến khi giáo viên/admin nhập và xác nhận.

## 25. Khoảng cách với cấu trúc Part 3 hiện tại

Editor/player hiện tại dùng chế độ chia nhỏ:

- `options[]`: mỗi vị trí A, B, C... yêu cầu một `imageAssetId` riêng.
- `items[]`: mỗi dòng yêu cầu thêm một `imageAssetId` thumbnail riêng.
- Editor có nút `Thêm vị trí` và dropdown `Quy tắc dùng lựa chọn`.
- Student player render từng option thành card ảnh riêng và render thumbnail cho từng item.

Các trường/control trên không phù hợp với mẫu composite. Tuy nhiên dữ liệu published cũ vẫn phải đọc/chơi/chấm được, nên không xóa thẳng legacy contract.

### Mở rộng tương thích được đề xuất

Giữ root `ListeningSetContent.schemaVersion = 1` và thêm chế độ hiển thị tùy chọn cho Part 3:

```ts
interface ListeningPart3 extends ListeningPartBase {
  part: 3;
  displayMode?: 'split' | 'composite';
  boardAssetId?: string;
  boardUrl?: string;
  reuseMode: 'once' | 'multiple';
  options: Array<{
    id: string;
    label: string;
    imageAssetId?: string;
    imageUrl?: string;
  }>;
  items: Array<{
    id: string;
    label: string;
    imageAssetId?: string;
    imageUrl?: string;
    correctOptionId: string;
  }>;
}
```

Quy tắc compatibility:

- Part 3 cũ không có `displayMode` được đọc như `split` và giữ nguyên UI/validation/player cũ.
- Part 3 mới dùng `displayMode: 'composite'`, yêu cầu một `boardAssetId`, đúng sáu option A-F và không yêu cầu ảnh riêng trong option/item.
- Grader không cần đổi thuật toán vì vẫn so sánh câu trả lời với `item.correctOptionId`.
- Student sanitizer phải giữ `boardUrl`, label và option ID cần cho player nhưng tiếp tục loại `correctOptionId`.
- Không migration hoặc rewrite các bộ đề published cũ.

Đây là mở rộng additive có legacy fallback, không phải thay toàn bộ contract Part 3 đang tồn tại.

## 26. Phân công AI và code cho Part 3

### AI thị giác chỉ chịu trách nhiệm

- Xác định khối danh sách năm dòng trong ảnh nguồn OCR bằng bố cục, không dựa vào viền đỏ.
- OCR đúng năm label theo thứ tự từ trên xuống.
- Trả bounding box và confidence riêng cho từng label.
- Cảnh báo khi text mờ, bị cắt, trùng hoặc không xác định chắc chắn thứ tự.

AI không được:

- Phân tích hoặc chia ảnh bảng A-F.
- Trích thumbnail trong ảnh nguồn.
- So khớp thumbnail với sáu hình A-F.
- Đề xuất đáp án A-F.
- Phân tích audio hoặc transcript từ audio.

### Code chịu trách nhiệm

- Kiểm tra quyền/type/dung lượng của hai ảnh đầu vào.
- Lưu/gắn nguyên asset bảng A-F làm `boardAssetId`.
- Sinh đúng sáu option ID ổn định với label `A` đến `F`; không yêu cầu sáu image asset.
- Chuẩn hóa label OCR bằng Unicode NFKC, trim và gom khoảng trắng nhưng giữ chính tả/case hiển thị để giáo viên duyệt.
- Sinh đúng năm item ID, điền label vào staged editor và khởi tạo `correctOptionId` rỗng.
- Giữ `reuseMode: 'once'` cho mẫu sáu lựa chọn/năm câu và không hiển thị control này trong editor composite nếu được xác nhận ở mục 31.
- Chặn merge/publish khi chưa đủ năm label hoặc còn dropdown đáp án chưa được giáo viên/admin chọn.
- Merge chỉ Part 3 và không thay đổi các Part khác.

## 27. Candidate tạm thời của AI cho Part 3

```ts
interface MoverPart3LabelCandidate {
  key: string;
  order: number;
  text: string;
  box: { x: number; y: number; width: number; height: number };
  confidence: number;
  requiresManualConfirmation: boolean;
}

interface MoverPart3ImportCandidate {
  labels: MoverPart3LabelCandidate[];
  warnings: string[];
}
```

Candidate không chứa `correctOptionId`, option ID database hoặc dữ liệu từ ảnh bảng A-F. ID nguồn OCR do backend/code gắn vào context, không tin ID do AI tạo.

## 28. Bố trí lại editor Part 3

### Giữ lại

- `Tiêu đề Part 3`.
- `Hướng dẫn`.
- `Audio Part 3`.
- Một asset picker `Ảnh bảng lựa chọn A-F`.
- Một asset picker `Ảnh nguồn lấy danh sách` và nút `Phân tích ảnh`.
- Năm dòng gồm `Nhãn` và dropdown `Đáp án A-F`.
- Trạng thái OCR/confidence/cần kiểm tra và nút xác nhận.

### Ẩn/bỏ khỏi chế độ composite

- Sáu picker `Hình vị trí` riêng lẻ.
- Nút `Thêm vị trí`.
- Năm picker `Hình đồ vật`/thumbnail.
- Control chọn `Quy tắc dùng lựa chọn` nếu Part 3 được chốt luôn dùng mỗi chữ tối đa một lần.
- Mọi chức năng crop/chia sáu ô của ảnh bảng A-F.

### Bố cục đề xuất

- Khối đầu: thông tin chung và audio.
- Khối thứ hai: preview lớn của một ảnh bảng A-F nguyên vẹn.
- Khối thứ ba: ảnh nguồn OCR ở bên trái; năm trường label đã tự điền ở bên phải trên desktop, xếp dọc trên mobile.
- Mỗi dòng label có dropdown A-F, chỉ báo đã/chưa xác nhận và lỗi trùng đáp án nếu `reuseMode = 'once'`.

## 29. Luồng giao diện và merge Part 3

1. Giáo viên/admin chọn ảnh bảng A-F; hệ thống chỉ preview và gắn asset, không gọi AI.
2. Giáo viên/admin chọn ảnh nguồn chứa danh sách label.
3. Chọn `Phân tích danh sách Part 3`.
4. Backend chỉ gửi ảnh nguồn danh sách cho Part 3 extractor; không gửi ảnh bảng A-F hoặc audio.
5. UI tự điền năm label OCR vào trường staged/editable theo thứ tự từ trên xuống và highlight bounding box tương ứng trên ảnh nguồn.
6. Giáo viên/admin xem lại, sửa và xác nhận năm label.
7. Giáo viên/admin chọn đáp án đúng A-F cho từng label; AI không tham gia bước này.
8. Chỉ khi đủ năm label, đủ năm đáp án và không vi phạm quy tắc dùng một lần thì mới cho áp dụng vào draft.
9. Merge tạo/cập nhật `content.parts[2]` ở `displayMode: 'composite'`; Parts 1, 2, 4 và 5 giữ nguyên.
10. Candidate chưa xác nhận không được tự autosave/merge/publish.

## 30. Validation và tiêu chí chấp nhận Part 3

### Validation composite

- Có đúng một `boardAssetId` ảnh hợp lệ.
- Có đúng sáu option, label theo thứ tự `A` đến `F`, ID không trùng.
- Có đúng năm item, ID không trùng và label không rỗng.
- Mỗi `correctOptionId` tham chiếu một trong sáu option.
- Nếu `reuseMode = 'once'`, năm `correctOptionId` phải khác nhau và còn đúng một option không dùng.
- Không yêu cầu `options[].imageAssetId` hoặc `items[].imageAssetId` trong composite mode.
- Ảnh nguồn OCR không bắt buộc lưu vào published content; có thể chỉ tồn tại trong resource tray/audit metadata.

### Xử lý lỗi

- OCR không đủ/thừa năm label: giữ toàn bộ candidate, đánh dấu cần duyệt và không tự ép thành năm.
- Không xác định được cột label hoặc OCR không trả đủ dữ liệu: để các trường tương ứng ở trạng thái `Cần nhập` để giáo viên/admin tự điền; không cần công cụ kéo chọn vùng OCR.
- Label confidence thấp: điền đề xuất nhưng đánh dấu `Cần kiểm tra`.
- Đáp án A-F chưa chọn hoặc bị trùng khi dùng một lần: chặn merge/publish và chỉ rõ dòng lỗi.
- Ảnh bảng A-F không hợp lệ hoặc thiếu nhãn A-F trực quan: cảnh báo để giáo viên thay ảnh; không gọi AI để tái tạo/chia ảnh.

### Tiêu chí chấp nhận

- Chỉ cần upload một ảnh bảng A-F và ảnh được hiển thị nguyên vẹn ở editor/player.
- Không còn sáu picker hình vị trí, năm picker thumbnail hoặc nút thêm vị trí trong composite editor.
- Ảnh nguồn không có viền đỏ vẫn trích đúng `Monday` đến `Friday`; nếu không trích được thì hiển thị trường trống rõ ràng để giáo viên/admin tự điền.
- Năm label được tự điền vào trường có thể chỉnh sửa theo đúng thứ tự.
- Dropdown đáp án chỉ có A-F và được giáo viên/admin chọn thủ công.
- Student player hiển thị một bảng ảnh A-F cùng năm dòng label/dropdown, không hiển thị thumbnail riêng cho từng dòng.
- Grader vẫn chấm đúng năm câu bằng `correctOptionId` trên backend.
- Published Part 3 legacy split vẫn đọc, chơi và chấm như trước.
- Merge Part 3 không thay đổi bốn Part còn lại.

## 31. Các điểm Part 3 đã xác nhận

1. Ảnh bảng sáu hình luôn có sẵn nhãn A-F và được hiển thị nguyên vẹn.
2. AI chỉ lấy năm label từ ảnh thứ hai; năm đáp án A-F ban đầu để trống để giáo viên/admin chọn thủ công.
3. Mỗi chữ A-F dùng tối đa một lần, năm câu dùng năm chữ và còn một chữ nhiễu; ẩn control `Quy tắc dùng lựa chọn` trong composite editor.
4. Part 3 không cần thumbnail riêng ở từng dòng; student player chỉ hiển thị label và dropdown A-F bên cạnh ảnh composite.
5. Nếu AI không tìm được cột text hoặc không OCR được label, giáo viên/admin tự điền vào trường soạn; không triển khai công cụ kéo chọn vùng OCR.

## 32. Part 4 - Mục tiêu nghiệp vụ

Giáo viên/admin có thể cung cấp:

- Một ảnh trang tổng hợp chứa đủ năm câu; hoặc
- Một danh sách tối đa năm ảnh, mỗi ảnh chứa một câu giống hình mẫu thứ hai.

Smart Editor phải:

1. Xác định năm khối câu hỏi theo thứ tự đọc.
2. OCR prompt của từng câu và loại số thứ tự in sẵn.
3. Xác định đúng ba vùng hình đáp án theo thứ tự trái sang phải A, B, C.
4. Tạo preview crop riêng cho từng option.
5. Trích và đề xuất đáp án đúng khi ảnh nguồn chứa bằng chứng đáp án rõ ràng; không suy luận đáp án từ nội dung hình hoặc audio.
6. Điền prompt, ba ảnh option và đáp án đề xuất vào trường soạn staged/editable để giáo viên/admin xem lại, sửa và xác nhận.

Audio chỉ được upload/gắn vào Part 4 và không nằm trong Smart Import request.

## 33. Nên dùng một ảnh hay ba ảnh cho mỗi câu?

### Phương án được khuyến nghị: ba derived image A/B/C

Giữ cấu trúc hiện tại, mỗi câu có ba `ListeningPart4Option` và mỗi option có một `imageAssetId` riêng. Giáo viên không phải upload thủ công 15 ảnh; hệ thống tự crop từ ảnh nguồn sau khi duyệt.

Lý do:

- Giữ nguyên `ListeningPart4`, student player, sanitizer, validation và grader hiện tại.
- Học sinh có thể bấm trực tiếp từng option bằng radio/label hiện có; không cần hotspot hoặc tọa độ tương tác mới.
- Responsive, keyboard, focus và accessibility dễ giữ ổn định hơn.
- Giáo viên có thể thay riêng một option nếu crop sai.
- Ảnh nguồn gốc vẫn nguyên vẹn; derived asset đi qua upload validation và SHA-256 dedupe hiện có.
- Dung lượng tăng thêm nhỏ so với rủi ro/độ phức tạp của schema composite.

### Không khuyến nghị: một composite image cho cả A/B/C

Một ảnh composite cho mỗi câu sẽ cần thêm ba vùng click/hotspot hoặc một lớp ánh xạ vị trí A/B/C, thay đổi schema, sanitizer, player, validation và kiểm thử responsive. Nếu crop/layout hơi lệch, đáp án có thể trỏ nhầm hình. Phương án này chỉ giảm số asset nhưng làm tăng đáng kể rủi ro triển khai.

Vì vậy Part 4 không cần schema mới. Smart Editor chỉ tự động hóa OCR/crop để tạo đúng data shape v1 đang có.

## 34. Fixture Part 4 từ hình mẫu

### Câu mẫu thể hiện trong hình thứ hai

- Prompt lưu vào editor: `What does Daisy want for supper?`
- Không lưu tiền tố `1.` vào prompt vì student player tự hiển thị số câu.
- Có đúng ba option theo thứ tự trái sang phải: `A`, `B`, `C`.
- Mỗi derived crop chỉ chứa phần tranh đáp án, loại viền card, chữ A/B/C và radio trạng thái.
- Dấu chọn màu xanh ở option B là một dạng bằng chứng đáp án trực quan để đề xuất `B`.
- Đáp án B vẫn mang trạng thái cần giáo viên/admin kiểm tra và xác nhận trước khi merge/publish.

Hình tổng hợp đầu tiên dùng làm fixture bố cục năm câu. Các chuỗi dạng `1. 1. ...` trong ảnh cho thấy prompt hiện chứa số thứ tự trong khi player cũng đánh số; extractor phải bỏ số thứ tự để không lặp.

## 35. Phân công AI và code cho Part 4

### AI thị giác chịu trách nhiệm đề xuất

- Nhận diện một trang năm câu hoặc một ảnh một câu.
- Trả thứ tự đọc và bounding box của từng question block.
- OCR prompt và tách số thứ tự đầu dòng.
- Trả ba bounding box option image theo A/B/C từ trái sang phải.
- Nhận diện bằng chứng đáp án rõ ràng trong ảnh nguồn, gồm radio được tô, dấu tick, highlight option hoặc answer key ghi trực tiếp chữ A/B/C.
- Trả loại bằng chứng, raw text nếu có, bounding box và confidence riêng cho đáp án đề xuất.
- Trả confidence riêng cho prompt, question order và từng crop.

AI không được:

- Suy luận đáp án từ nội dung ba hình.
- Dùng audio/transcript để tìm đáp án.
- Tạo ID database hoặc tự lưu derived asset.
- Tự coi marker/answer key mờ, không nhất quán hoặc không gắn được với đúng câu là đáp án đã xác nhận.

### Code chịu trách nhiệm

- Kiểm tra quyền/type/dung lượng của ảnh nguồn.
- Clamp/validate bounding box trong tọa độ 0-1 và kiểm tra crop không rỗng/quá nhỏ.
- Loại số thứ tự đầu prompt và normalize text nhưng giữ nội dung/case hiển thị.
- Gán letter A/B/C theo thứ tự trái sang phải; không phụ thuộc OCR chữ cái trên ảnh.
- Hiển thị overlay/preview để giáo viên chỉnh crop hoặc thay ảnh riêng khi cần.
- Sau khi duyệt, dùng Canvas/browser image APIs để tạo ba blob crop cho mỗi câu và upload qua endpoint asset hiện có.
- Sinh question/option ID bằng code và gắn derived `imageAssetId` sau upload thành công.
- Gán `alt` mặc định `Lựa chọn A`, `Lựa chọn B`, `Lựa chọn C`; cho phép chỉnh nếu cần.
- Chỉ gán `correctOptionId` từ bằng chứng đáp án rõ ràng trong ảnh nguồn đã được giáo viên xác nhận hoặc từ lựa chọn thủ công của giáo viên.
- Không merge Part 4 nếu một crop/upload lỗi; giữ các crop thành công trong staging để retry đúng phần lỗi.

Dự án hiện chưa có thư viện xử lý ảnh backend như `sharp`. Dùng Canvas trong editor rồi upload blob qua endpoint hiện có tránh thêm native dependency và vẫn tận dụng magic-byte validation, size limit, storage key SHA-256 và asset ownership ở backend.

## 36. Candidate tạm thời của AI cho Part 4

```ts
interface MoverPart4OptionCropCandidate {
  letter: 'A' | 'B' | 'C';
  crop: { x: number; y: number; width: number; height: number };
  cropConfidence: number;
  selectionState: 'selected' | 'unselected' | 'unknown';
  selectionConfidence: number;
}

interface MoverPart4QuestionCandidate {
  key: string;
  order: number;
  prompt: string;
  questionBox: { x: number; y: number; width: number; height: number };
  promptConfidence: number;
  options: [
    MoverPart4OptionCropCandidate,
    MoverPart4OptionCropCandidate,
    MoverPart4OptionCropCandidate,
  ];
  proposedCorrectLetter?: 'A' | 'B' | 'C';
  answerEvidence?: {
    kind: 'selected_marker' | 'answer_key_text' | 'explicit_option_label';
    letter: 'A' | 'B' | 'C';
    rawText?: string;
    box?: { x: number; y: number; width: number; height: number };
    confidence: number;
  };
  requiresManualConfirmation: boolean;
}

interface MoverPart4ImportCandidate {
  questions: MoverPart4QuestionCandidate[];
  warnings: string[];
}
```

Candidate chỉ chứa text, tọa độ và evidence tạm thời. Asset ID thật chỉ xuất hiện sau bước crop/upload bằng code.

## 37. Luồng giao diện Part 4

1. Giữ `Tiêu đề Part 4`, `Hướng dẫn` và `Audio Part 4`.
2. Giáo viên chọn chế độ nguồn:
   - `Một ảnh chứa 5 câu`; hoặc
   - `Danh sách ảnh câu hỏi` với tối đa năm ảnh.
3. Chọn `Phân tích Part 4`.
4. Backend chỉ gửi ảnh nguồn cho Part 4 extractor và trả candidate.
5. UI tự điền năm prompt, preview ba crop A/B/C mỗi câu và đáp án đề xuất nếu ảnh nguồn có bằng chứng đáp án rõ ràng.
6. Giáo viên/admin xem lại:
   - sửa prompt;
   - chỉnh crop hoặc thay riêng ảnh option;
   - xác nhận/chọn đáp án đúng.
7. Sau xác nhận crop, client tạo/upload derived image. Mỗi câu chỉ hoàn tất khi cả ba upload thành công.
8. Dữ liệu đã duyệt được chuyển về đúng `ListeningPart4Question[]` hiện tại.
9. Merge chỉ cập nhật `content.parts[3]`; bốn Part khác giữ nguyên.
10. Candidate/crop chưa xác nhận không được tự autosave vào draft chính hoặc publish.

## 38. Bố trí lại editor Part 4

### Khu vực nhập nhanh

- Asset picker một ảnh trang hoặc danh sách ảnh câu hỏi.
- Nút phân tích và trạng thái tiến trình theo từng câu.
- Preview ảnh nguồn có overlay question/option boxes.

### Khu vực năm câu

Mỗi card câu hỏi gồm:

- Trường prompt có thể sửa.
- Ba preview crop A/B/C trên cùng một hàng ở desktop, xếp phù hợp trên mobile.
- Radio `Đáp án đúng`.
- Trạng thái `OCR đã kiểm tra`, `Crop đã kiểm tra`, `Đáp án đã xác nhận`.
- Nút `Chỉnh crop` và `Thay ảnh này` cho từng option.

Không cần yêu cầu giáo viên thao tác trực tiếp với 15 asset picker như luồng chính. Các picker đơn lẻ chỉ còn là fallback `Thay ảnh này` khi crop không đạt.

## 39. Validation và tiêu chí chấp nhận Part 4

### Candidate/derived crop validation

- Có đúng năm question theo thứ tự duy nhất 1-5.
- Mỗi prompt không rỗng và không chứa số thứ tự lặp ở đầu.
- Mỗi câu có đúng ba crop A/B/C, box hữu hạn, nằm trong 0-1 và có kích thước pixel tối thiểu.
- Mỗi câu có đúng ba derived image asset hợp lệ trước merge.
- Mỗi `correctOptionId` tham chiếu một trong ba option ID.
- Mọi prompt/crop/đáp án có confidence thấp đã được giáo viên/admin xác nhận.

### Xử lý lỗi

- Không tách được năm câu: giữ candidate tìm được, báo dòng thiếu/thừa và cho phép nhập câu thủ công hoặc cung cấp ảnh riêng cho câu lỗi.
- OCR prompt lỗi: để trường editable ở trạng thái `Cần nhập`.
- Không tìm được option box: cho phép thay ảnh option thủ công; không đoán crop.
- Không có bằng chứng đáp án rõ: để radio đáp án trống cho giáo viên chọn.
- Bằng chứng đáp án mâu thuẫn, nhiều option cùng được đánh dấu hoặc answer key không gắn chắc chắn với câu: cảnh báo xung đột và không đề xuất đáp án.
- Crop/upload một option lỗi: retry đúng option đó, không bỏ các câu đã hoàn thành.

### Tiêu chí chấp nhận

- Một ảnh trang có thể tạo năm prompt và 15 preview option đúng thứ tự.
- Danh sách ảnh một câu được ghép đúng thành năm câu theo thứ tự giáo viên sắp xếp.
- Prompt không xuất hiện dạng `1. 1. ...` trên student player.
- Crop chỉ giữ phần tranh, không mang theo radio/marker đáp án làm lộ đáp án cho học sinh.
- Marker B trong fixture thứ hai tạo đề xuất B kèm evidence; answer key A/B/C rõ ràng trong ảnh nguồn khác cũng được phép tạo đề xuất tương ứng. Tất cả vẫn yêu cầu giáo viên xác nhận.
- Sau duyệt, editor chứa đúng năm câu × ba `imageAssetId` và một `correctOptionId` mỗi câu.
- Student player, sanitizer, grader và published Part 4 v1 tiếp tục hoạt động như trước.
- Merge/retry Part 4 không thay đổi Parts 1, 2, 3 và 5.

## 40. Các điểm Part 4 đã xác nhận

1. Dùng ba derived image A/B/C cho mỗi câu; giáo viên chỉ tải ảnh nguồn và hệ thống tự crop.
2. Ảnh nguồn có thể chứa sẵn đáp án. AI trích đáp án từ bằng chứng rõ ràng như radio/tick/highlight hoặc answer key A-C, tự điền đề xuất vào editor và giáo viên/admin luôn kiểm tra, sửa được. Nếu không có bằng chứng rõ ràng thì để trống; không đoán từ nội dung tranh.
3. Crop option bỏ chữ A/B/C, radio, viền card và marker đáp án, chỉ giữ phần tranh.
4. Nếu crop sai, giáo viên/admin được chỉnh khung crop hoặc thay riêng ảnh option đó.
5. Nếu nguồn có block `Example`, xử lý giống một câu nhưng lưu vào `part.example` và không tính trong năm câu chấm điểm.

## 41. Part 5 - Mục tiêu nghiệp vụ

Giáo viên tải/chọn một tranh Part 5. Smart Editor hỗ trợ:

1. Giữ `Tiêu đề Part 5`, `Hướng dẫn`, `Audio Part 5` và asset tranh hiện có.
2. Dùng AI thị giác để đề xuất các vật thể/nhân vật và tâm vùng có thể dùng làm target; không dùng AI để suy luận màu đúng.
3. Tạo năm vùng chấm điểm dạng chữ nhật bo góc, kích thước cố định và có thể kéo như Part 1.
4. Cho giáo viên chọn đúng sáu màu từ danh sách 20 màu tiếng Anh định sẵn.
5. Code khởi tạo năm đáp án màu khác nhau bằng hoán vị ngẫu nhiên của sáu màu đã chọn; màu còn lại là màu nhiễu.
6. Đánh dấu mọi đáp án random là tạm thời và bắt buộc giáo viên/admin đặt lại hoặc xác nhận có chủ ý trước khi merge/publish.
7. Không hiển thị bảng chọn màu tự do, trường tên màu tự do, mã HEX tự do, resize handle, Ellipse hoặc Polygon trong editor Part 5.

Trong phạm vi đã mô tả, Part 5 tiếp tục có năm target tô màu và một màu nhiễu. Chưa bổ sung câu trả lời dạng chữ `write` vào schema v1 cho đến khi có xác nhận nghiệp vụ riêng.

## 42. Khoảng cách với Part 5 hiện tại và phương án tương thích

Mã hiện tại đã có:

- `ListeningPart5.colours` gồm sáu `{ id, label, value }`.
- `ListeningPart5.targets` gồm năm `{ id, label, correctColourId, region }`.
- Một `example` tùy chọn.
- Student player chọn một màu rồi chạm vào vùng.
- Backend sanitizer bỏ `correctColourId` khỏi dữ liệu học sinh và grader chấm bằng ID màu.

Khoảng trống hiện tại:

- Editor cho sửa tên màu và dùng `<input type="color">`, nên giáo viên có thể chọn mã gần giống nhưng không đúng tên màu cần dạy.
- Sáu màu mặc định có nhãn `Màu 1` đến `Màu 6`, không phải tên tiếng Anh.
- Region Editor dùng chung vẫn cho Rectangle/Ellipse/Polygon và thay đổi kích thước, trái quy tắc Part 5 mới.
- Validator mới kiểm tra sáu mã HEX và năm target; chưa kiểm tra màu thuộc preset, năm đáp án khác nhau, đúng một distractor hoặc trạng thái xác nhận thủ công.

Phương án giữ tương thích:

- Không đổi schema Part 5 v1, API học sinh, answer payload, sanitizer hoặc grader.
- 20 màu là catalog ở code/editor; khi chọn vẫn lưu `label` và `value` vào cấu trúc `ListeningColour` hiện tại.
- Chỉ editor Part 5 mới giới hạn lựa chọn. Không siết whole-set validator theo preset nếu việc đó làm draft/published legacy có màu tùy chỉnh bị lỗi.
- Khi mở dữ liệu cũ có màu ngoài catalog, giữ nguyên và hiển thị badge `Màu cũ - cần xem lại`; không tự rewrite khi chỉ mở editor.
- Khi giáo viên chủ động thay màu cũ, màu mới phải lấy từ catalog.

## 43. Quy tắc vùng Part 5 kế thừa Part 1

### Hình dạng, kích thước và thao tác

- Chỉ dùng `shape: 'rect'`; CSS hiển thị chữ nhật bo góc.
- Dùng chiều rộng chuẩn hóa của Part 1 nhưng tăng gấp đôi chiều cao riêng cho editor Part 5:

```ts
const PART5_TARGET_SIZE = {
  width: 0.12,
  height: 0.11,
};
```

- Vị trí được tính từ tâm anchor rồi clamp trong biên ảnh:

```ts
x = clamp(center.x - width / 2, 0, 1 - width);
y = clamp(center.y - height / 2, 0, 1 - height);
```

- Giáo viên kéo toàn bộ vùng bằng chuột, touch/pointer hoặc chỉnh tinh bằng phím mũi tên.
- Không cho resize, đổi shape, vẽ ellipse/polygon hoặc hiển thị nút hoàn tất polygon.
- Chỉ ẩn các control đó trong Part 5; không xóa khả năng của Region Editor ở Part khác.

### Trạng thái hiển thị trong editor

- Target đang chọn: fill opacity khoảng `0.38`, viền nổi bật và z-index cao hơn.
- Target không chọn: fill opacity khoảng `0.12`.
- Vùng hiển thị số/nhãn target để phân biệt; màu overlay trong editor không được dùng làm bằng chứng cho đáp án.
- Opacity chỉ là trạng thái giao diện editor, không lưu vào published schema và không tự thay đổi giao diện học sinh.

### Vai trò của AI khi đặt vùng

- AI có thể phát hiện người, vật thể, chữ/đường nối hoặc vùng đánh dấu rõ trong ảnh và trả tâm/bounding box/confidence.
- Nếu ảnh chỉ là tranh sạch, không có dấu hiệu chỉ ra đúng năm vùng được hỏi, AI chỉ trả candidate anchors; không được khẳng định năm target đúng.
- Code có thể đặt năm vùng mặc định vào năm anchor được giáo viên chọn. Nếu thiếu anchor đáng tin cậy, tạo vùng mặc định trong ảnh và yêu cầu giáo viên kéo thủ công.
- Audio/transcript không bao giờ được gửi vào bước này để tìm target hoặc màu đúng.

## 44. Catalog 20 màu tiếng Anh

Danh sách đã được người dùng xác nhận:

| STT | Tên hiển thị | Mã màu đề xuất |
| ---: | --- | --- |
| 1 | Red | `#EF4444` |
| 2 | Blue | `#2563EB` |
| 3 | Green | `#16A34A` |
| 4 | Yellow | `#FACC15` |
| 5 | Orange | `#F97316` |
| 6 | Purple | `#7C3AED` |
| 7 | Pink | `#EC4899` |
| 8 | Brown | `#92400E` |
| 9 | Black | `#111827` |
| 10 | White | `#FFFFFF` |
| 11 | Grey | `#6B7280` |
| 12 | Light Blue | `#7DD3FC` |
| 13 | Dark Blue | `#1E3A8A` |
| 14 | Light Green | `#86EFAC` |
| 15 | Dark Green | `#166534` |
| 16 | Light Pink | `#F9A8D4` |
| 17 | Dark Red | `#991B1B` |
| 18 | Beige | `#D6C7A1` |
| 19 | Gold | `#D4A017` |
| 20 | Silver | `#A8A9AD` |

Quy tắc catalog:

- Catalog là hằng số do code quản lý, không phải AI tự đặt tên/mã màu.
- Dùng chính tả Anh-Anh `Grey`, phù hợp nội dung Cambridge; không đồng thời tạo thêm `Gray` như một màu khác.
- Mỗi chip luôn hiển thị cả swatch và tên tiếng Anh; `White` phải có viền rõ, các màu tối phải có trạng thái chọn đủ tương phản.
- Giáo viên chọn tối đa và bắt buộc đúng sáu màu không trùng nhau cho một Part 5.
- Sáu màu mặc định cho bộ đề mới: `Red`, `Purple`, `Orange`, `Blue`, `Green`, `Yellow`, giữ gần hành vi hiện tại nhưng có tên đúng.
- Không cho nhập mã HEX hoặc tên màu tùy ý trong luồng tạo mới.

## 45. Phân công AI và code cho Part 5

### AI thị giác chỉ đề xuất

- Danh sách visual anchor với loại `person`, `object`, `text_marker` hoặc `unknown`.
- Tâm/bounding box chuẩn hóa và confidence.
- Example có dấu hiệu rõ, nếu có; example vẫn cần giáo viên xác nhận.
- Cảnh báo khi thiếu/thừa candidate, vùng bị che hoặc không đủ bằng chứng chọn đúng năm target.

AI không được:

- Chọn màu đúng từ nội dung tranh.
- Suy luận target/màu từ audio hoặc transcript.
- Tạo catalog màu, ID database, tự merge, autosave hoặc publish.
- Coi màu vốn có trong tranh là đáp án tô màu.

### Code chịu trách nhiệm

- Quản lý catalog 20 màu cố định và trạng thái chọn sáu màu không trùng.
- Sinh ID cho sáu `ListeningColour` và năm target.
- Tạo hoán vị ngẫu nhiên năm màu khác nhau từ sáu màu đã chọn; màu không được dùng tự động trở thành distractor.
- Đánh dấu answer mapping là `random/requiresManualConfirmation` trong candidate/editor state, không lưu cờ tạm vào published content.
- Tạo/clamp năm vùng cố định, xử lý drag/keyboard và cảnh báo chồng lấn.
- Chuyển candidate đã duyệt về schema Part 5 v1 hiện tại.

## 46. Candidate tạm thời của Part 5

```ts
interface MoverPart5AnchorCandidate {
  key: string;
  kind: 'person' | 'object' | 'text_marker' | 'unknown';
  description?: string;
  center: { x: number; y: number };
  box?: { x: number; y: number; width: number; height: number };
  confidence: number;
}

interface MoverPart5TargetCandidate {
  key: string;
  label: string;
  anchorKey?: string;
  region: { shape: 'rect'; x: number; y: number; width: number; height: number };
  proposedColourKey: string;
  answerSource: 'random' | 'manual';
  requiresManualConfirmation: boolean;
}

interface MoverPart5ImportCandidate {
  selectedColours: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  anchors: MoverPart5AnchorCandidate[];
  targets: MoverPart5TargetCandidate[];
  example?: MoverPart5TargetCandidate;
  warnings: string[];
}
```

`proposedColourKey` luôn do code random hoặc giáo viên chọn, không phải output của AI.

## 47. Luồng giao diện Part 5

1. Giữ `Tiêu đề`, `Hướng dẫn`, `Audio` và picker `Tranh Part 5`.
2. Form thủ công không hiển thị trường `Tên vùng`; năm dropdown được ghi rõ `Đáp án màu 1` đến `Đáp án màu 5`.
3. Giáo viên chọn `Phân tích ảnh Part 5`; backend chỉ gửi ảnh cho extractor Part 5.
4. UI hiển thị candidate anchors và cảnh báo; giáo viên chọn/đổi năm anchor hoặc để vùng mặc định rồi kéo thủ công.
5. Khu `Chọn 6 màu` hiển thị grid 20 chip có swatch + tên tiếng Anh, không có color picker tự do.
6. Khi đủ sáu màu, code random năm mapping không trùng và hiển thị badge `Tạm thời - cần đặt lại` trên từng đáp án.
7. Giáo viên chọn từng target, đặt lại/xác nhận màu và kéo vùng đến vị trí đúng.
8. Màu không được target nào dùng được tính động và hiển thị badge `Màu nhiễu`; không mặc định coi slot thứ sáu luôn là nhiễu sau khi giáo viên sửa.
9. Chỉ khi đủ năm mapping đã xác nhận, năm vùng hợp lệ và đúng một distractor thì cho áp dụng candidate.
10. Merge chỉ cập nhật `content.parts[4]`; Parts 1-4 giữ nguyên.

## 48. Validation, lỗi và compatibility Part 5

Candidate mới sẵn sàng merge khi:

- Có đúng sáu màu khác nhau lấy từ catalog đã xác nhận.
- Có đúng năm target và năm `correctColourId` khác nhau; màu thứ sáu là distractor duy nhất.
- Cả năm mapping đã được giáo viên/admin xác nhận, không còn `answerSource: 'random'`.
- Mỗi vùng là `rect`, có đúng kích thước chuẩn, tọa độ hữu hạn trong 0-1 và không vượt biên sau clamp.
- Example, nếu có, tách khỏi năm target và không chấm điểm.
- Các vùng chồng lấn đáng kể được cảnh báo để giáo viên xử lý.

Xử lý lỗi:

- AI không tìm đủ anchor: giữ candidate tìm được, tạo các vùng mặc định còn thiếu và yêu cầu giáo viên kéo.
- AI trả anchor confidence thấp: đánh dấu `Cần kiểm tra`, không tự merge.
- Chưa chọn đủ sáu màu hoặc chọn trùng: chặn random/merge và chỉ rõ màu cần sửa.
- Thay một trong sáu màu: mapping liên quan quay về trạng thái chưa xác nhận; code không âm thầm đổi đáp án đã duyệt.
- Dữ liệu cũ có màu ngoài catalog: vẫn đọc/chấm như cũ; editor yêu cầu xem lại khi giáo viên chủ động chỉnh Part 5.
- Thiếu audio không ảnh hưởng bước phân tích ảnh hoặc random màu; audio không phải nguồn đáp án.

Validator server hiện tại vẫn giữ khả năng đọc/publish dữ liệu legacy hợp lệ. Quy tắc preset và trạng thái xác nhận được áp dụng ở Smart Editor/candidate trước merge; chỉ nâng whole-set validator sau khi có compatibility test chứng minh không làm hỏng bộ đề cũ.

## 49. Tiêu chí chấp nhận Part 5

- Editor hiển thị đúng 20 màu có tên tiếng Anh và mã cố định; không còn bảng màu tự do cho Part 5 mới.
- Chọn được đúng sáu màu khác nhau; student player vẫn chỉ nhận sáu màu đã chọn.
- Code tạo năm mapping random không trùng, còn đúng một distractor và không gắn nguồn đáp án cho AI/audio.
- Giáo viên bắt buộc đặt lại hoặc xác nhận cả năm mapping trước merge/publish.
- Năm vùng là chữ nhật bo góc đồng kích thước, kéo được nhưng không resize/đổi shape.
- AI có thể gợi ý anchor nhưng không tự khẳng định target/màu khi ảnh không có bằng chứng.
- Màu nhiễu được tính từ màu không dùng, không phụ thuộc thứ tự slot.
- Existing draft/published Part 5 với màu HEX hợp lệ vẫn mở, chơi và chấm được.
- Merge/retry Part 5 không thay đổi Parts 1-4.

## 50. Các điểm Part 5 đã xác nhận

Đã xác nhận:

1. Part 5 kế thừa quy tắc Part 1 về vùng cố định, kéo cả vật thể, không resize và không dùng Ellipse/Polygon.
2. Đáp án màu ban đầu là random do code tạo; giáo viên/admin luôn đặt lại hoặc xác nhận trong editor.
3. Không dùng audio để trích/suy luận target hoặc đáp án.
4. Bỏ bảng màu tự do trong editor và thay bằng 20 màu cơ bản có tên tiếng Anh.
5. Dùng chính xác danh sách 20 tên/mã màu tại mục 44.
6. Đợt nâng cấp này chỉ có năm câu `colour` như schema hiện tại; không bổ sung câu `write`, không đổi schema/grader vì nội dung `write`.
