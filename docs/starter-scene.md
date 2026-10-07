# Trang Starters với hai sân học

Trang học sinh: `/exams/starter`. Ảnh làng người dùng cung cấp làm nền; hai danh sách tương tác đặt trên sân Listening và Reading & Writing. Chữ, liên kết và trạng thái đều là HTML. Bảng gỗ, cột chỉ đường và ảnh nền là asset riêng. Font Baloo 2/Nunito lưu cùng ứng dụng, có giấy phép OFL trong `public/assets/fonts`.

Cột biển gỗ góc phải là điều hướng thật: **Home** về `/`, **Next** sang `/exams/mover`, **History** mở `/history` của B. Không còn thanh nút điều hướng cũ. Biển History dùng lại vùng gỗ của ảnh cột sẵn có qua CSS, không tạo hoặc sửa file ảnh. Chữ HTML màu nâu Baloo 2, link chuẩn có nhãn tiếng Việt, viền focus và hỗ trợ mở tab bằng phím bổ trợ. Từ 1279px trở xuống, ba biển xếp thành hàng phía trên cảnh để luôn truy cập được từ cả hai sân; vùng chạm tối thiểu 44px.

Starters dùng chữ vàng cam nổi, thu còn 90% kích thước trước ở cả desktop/mobile, uốn cong nhẹ theo bảng bằng từng ký tự; heading giữ nhãn accessible đầy đủ. Pre A1 đặt trên một miếng gỗ sáng với chữ nâu; chữ và padding giảm khoảng 10%, dịch phải 8–12px và nâng lên 14px so với flow để nhãn nằm gọn trong mặt gỗ, cách viền dưới. Browser đo kích thước thực và containment sau CSS cascade tại năm chiều rộng; kiểm tra local bổ sung 1920px. Biển Listening có tai nghe xanh, biển Reading & Writing có sách/bút; cả hai thu gọn khoảng 16–21% và gắn trên mặt tiền nhà theo tọa độ ảnh nền. SVG trang trí và chữ HTML độc lập, không sửa ảnh nền. Theo ảnh tham khảo mới, link ở hai sân là bảng gỗ mật ong bo mềm với lá xanh, huy hiệu màu, linh vật và mũi tên vàng. Một sprite WebP alpha gồm corgi/mèo/chim/khỉ/thỏ lặp theo chu kỳ 5; số thứ tự và tên bài là HTML động từ danh sách thật, không gán cứng 5 Part. Tên bài dùng Baloo 2 700 màu nâu, tối đa hai dòng trên vùng gỗ trống; tên đầy đủ vẫn có trong tooltip/aria-label. Hai nhãn “Cuộn để khám phá” đã bỏ; cơ chế cuộn và điều hướng bàn phím vẫn hoạt động. Ký tự lỗi U+FFFD đứng riêng giữa khoảng trắng trong tên cũ hiển thị bằng dấu ·, chỉ tại trang này; tên nguồn trong kho giữ nguyên.

Biển Reading & Writing uốn nhẹ theo hình cầu vồng: hai mép gỗ, phần sáng, vân gỗ và đinh theo cùng vòm; 17 ký tự HTML nâng giữa/xoay nhẹ tối đa ±6° để chạy theo biển. H2 có tên accessible đầy đủ, nhóm chữ trang trí aria-hidden. Điểm neo được hạ nhẹ từ 29,2% xuống 30% chiều cao cảnh (khoảng 6px ở desktop), giữ chiều rộng nhà; aspect 5,5 cho đủ chỗ theo vòm, biển Listening giữ hình dáng cũ. Không sửa ảnh nền hoặc rasterize chữ. Browser kiểm tra độ cong thật của SVG và từng ký tự nằm trong khung ở năm kích thước màn hình.

Theo yêu cầu thu gọn thêm, mỗi sân desktop rộng 30,5% thay vì 33% ảnh; hàng cao `clamp(50px, 4vw, 70px)`, nhỏ thêm khoảng 7–8%. Sân Listening đặt tại 47% và R&W tại 48% chiều cao ảnh, nâng lên thêm 3% (khoảng 22–24px tại kích thước đang kiểm tra) để năm thẻ nằm gọn trong sân trước hàng rào. Tên bài desktop thu nhẹ cho vừa bảng. Mobile thêm khoảng trống hai bên (`100vw - 48px`) và giữ hàng 44px. Hover bằng chuột phóng cả thẻ từ 0.985 lên 1 và sáng thêm 3,5% trong 180ms, không đổi layout/cuộn, không gạch chân hoặc thêm bóng CSS. Thiết lập giảm chuyển động tắt phóng/animation; bàn phím giữ viền focus rõ.

Art: `public/assets/lesson-cards/starter-wood-cards-v2.webp` (1536 × 1024, alpha, 233.780 byte). Bản gốc và prompt built-in imagegen: `output/imagegen/starter-wood-cards-v2.png` và `output/imagegen/starter-wood-cards-v2.prompt.md`; bản v1 được giữ làm nguồn tham khảo. Giao diện dùng vị trí sprite và tọa độ huy hiệu đo từ art; không cắt/sửa ảnh nền hoặc rasterize tên bài. Số nhiều chữ số có cỡ chữ riêng để vừa huy hiệu.

## Chỉnh danh sách trong dashboard

1. Mở **Kho đề luyện thi → Starters → Danh sách link học sinh**.
2. Chọn **Listening** hoặc **Reading & Writing**.
3. Bấm **+ Thêm link**, chọn bộ đề công khai tương ứng; dùng ↑/↓ đổi thứ tự hoặc **Xóa** để gỡ link.
4. Bấm **Lưu danh sách**. Mở lại trang học sinh để xem bố trí mới.

Danh sách có bao nhiêu bài thì học sinh thấy bấy nhiêu vị trí: 25 bài là 25 vị trí, 31 bài là 31 vị trí. Mỗi sân hiện tối đa 5 bài cùng lúc, cuộn đến bài cuối. Không tạo vị trí trống và không khóa 27/54. Giới hạn kỹ thuật của mỗi request là 1.000 link để tránh payload quá lớn. Mỗi bộ đề xuất hiện một lần trong mỗi danh sách.

Trên điện thoại, nút Listening/Reading & Writing chuyển vùng nhìn sang từng sân, căn giữa ngôi nhà và danh sách tương ứng; ảnh giữ đúng tỷ lệ và tọa độ. Cuộn bên trong danh sách để xem bài tiếp theo. Có điều hướng bàn phím, viền focus và hỗ trợ giảm chuyển động.

## Mô phỏng nhiều link tại local

Mở `http://localhost:3000/exams/starter?preview=links` khi chạy dev local: mỗi sân có 25 link mẫu, hiện năm thẻ và cuộn tới bài 25. Có nhãn “Mô phỏng local”; click/Enter trên bài mẫu không mở bài thi. Trang này không tải catalog thật và không ghi DB/settings/attempt. Bỏ query `preview=links` để xem bài thật. Chỉ bật khi `import.meta.env.DEV`, hostname loopback và query được chọn rõ ràng; helper được lazy-load, bị loại khỏi bản build production. Bản build chính thức luôn dùng catalog B, kể cả URL có query mô phỏng.

## Điều kiện xuất hiện và quyền

- Link chọn từ bộ đề **Starter đã xuất bản, công khai và đúng loại bài**. Không nhập URL tùy ý; link dùng route trình làm bài hiện có của B.
- Khi chưa từng lưu bố trí, trang đọc tất cả bộ đề công khai hiện có theo thứ tự tạo ổn định. Việc mở trang không tạo hoặc seed dữ liệu.
- Sau khi đã lưu bố trí, trang giữ đúng danh sách/thứ tự đã lưu. Bộ đề mới xuất bản cần được thêm vào danh sách. Lưu danh sách trống sẽ giữ sân trống.
- Sân chưa có bài chỉ hiển thị ảnh nền, không hiện thông báo trống. Trạng thái đang tải và lỗi tải có nút thử lại tiếp tục hiển thị khi xảy ra.
- Bài chuyển về nháp, lưu trữ hoặc không còn công khai được ẩn khỏi học sinh. Dashboard vẫn giữ vị trí để người có quyền sửa hoặc gỡ.
- Giáo viên thêm/thay/xóa/sắp xếp link bài của mình; quản trị viên quản lý toàn bộ. Giáo viên không được thay đổi thứ tự tương đối hoặc xóa link của giáo viên khác. Xóa link không xóa bộ đề.
- Danh sách dùng chung cho học sinh, lấy danh tính/quyền từ B. Player, xuất bản, chấm điểm, kết quả và Lịch sử học tập tiếp tục dùng luồng B.

## API và lưu trữ

`src/server/exam-platform/starterSceneRouter.ts` được mount bên trong exam-platform router:

| Endpoint | Quyền | Nội dung |
| --- | --- | --- |
| `GET /api/exam-platform/starter-scene` | Công khai | Chỉ id link, tiêu đề và route bài công khai, cùng revision/trạng thái cấu hình |
| `GET /api/exam-platform/admin/starter-scene/:paperId` | Giáo viên/admin | Danh sách, lựa chọn và quyền sửa từng link |
| `PUT /api/exam-platform/admin/starter-scene/:paperId` | Giáo viên/admin | Lưu `{baseRevision, entries: [{id, setId}]}` sau validation/quyền |

Adapter settings hiện có lưu hai document `starter-scene-listening-v1` và `starter-scene-reading-writing-v1`, giá trị `{schemaVersion: 1, revision, entries}`. Không thêm bảng, migration, tài khoản, provider hoặc kho media. Backend sinh ID link mới. Revision và hàng đợi theo paper trong tiến trình Node hiện tại chống ghi đè đồng thời; client nhận 409 nếu danh sách đã thay đổi và giữ chỉnh sửa để giáo viên quyết định tải lại. Chạy nhiều worker cần chuyển cơ chế khóa này sang transaction chung của storage trước khi mở rộng mô hình vận hành.

Các module Mover/Flyer/KET/PET/FCE/IELTS cũng dùng cảnh làng chung theo `docs/exam-scenes.md`. PET/FCE/IELTS có ba nhà và ba sân theo kỹ năng hiện có. Mỗi cấp có danh sách quản trị riêng và biển gỗ Previous/Next. Học sinh vẫn có thể mở các URL bài/paper đã phát hành trước đây; endpoint/settings Starter cũ được giữ.

## Kiểm thử và bàn giao

Checklist: `docs/starter-scene-checklist.md`, `docs/starter-typography-checklist.md`, `docs/starter-house-checklist.md`, `docs/starter-balance-checklist.md`, `docs/starter-natural-links-checklist.md`, `docs/starter-wood-cards-checklist.md`, `docs/starter-compact-checklist.md`, `docs/starter-fit-checklist.md`. Test HTTP native: `npm run test:starter-scene`. Kiểm tra trình duyệt: build chuẩn rồi `npm run test:starter-scene-browser` dưới Node 22; script tạo DB và client build biệt lập, không ghi dữ liệu học sinh thật hoặc gọi provider. Kiểm tra style thực xác nhận chữ cong có nhãn accessible, Pre A1 nâng lên, biển nhỏ bám tọa độ hai nhà và vừa chữ, link dùng đúng font/màu, sprite alpha, số thứ tự động và không gạch chân/bóng CSS ở trạng thái thường/hover. Có kiểm tra hover thường/giảm chuyển động, cuộn bằng bánh xe và đến cuối ở cả hai sân, năm hàng trên năm kích thước màn hình, khung năm thẻ nằm trong vùng sân phía trên cảnh hàng rào và production từ chối query mô phỏng. Tương phản tên bài được kiểm tra trên các pixel phần gỗ dưới chữ, cùng điều hướng bàn phím/focus. Fixture có tên chứa dấu phân cách lỗi để kiểm tra trình bày mà không rewrite nguồn.

Rollback giao diện bằng snapshot source trước sửa trong `.data/starter-scene-before`, sau khi bảo vệ mọi chỉnh sửa phát sinh và build lại. Không xóa hoặc phục hồi đè DB để rollback giao diện; settings mới có thể giữ nguyên khi dùng màn cũ. Chưa deploy production.
