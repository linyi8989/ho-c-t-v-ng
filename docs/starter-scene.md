# Trang Starters với hai sân học

Trang học sinh: `/exams/starter`. Ảnh làng người dùng cung cấp làm nền; hai danh sách tương tác đặt trên sân Listening và Reading & Writing. Chữ, liên kết và trạng thái đều là HTML. Bảng gỗ, cột chỉ đường và ảnh nền là asset riêng. Font Baloo 2/Nunito lưu cùng ứng dụng, có giấy phép OFL trong `public/assets/fonts`.

Điều hướng thật dùng biển gỗ **Home**, **History**, **Next** (sang `/exams/mover`). Desktop xếp cùng hệ thống Home/History rồi Previous/Next của các cấp; Starter không có Previous. Mobile ba biển chia đều phía trên cảnh. Link chuẩn, nhãn đầy đủ, vùng chạm 44px, focus và modifier click được giữ.

Bảng tên chữ vàng cam uốn nhẹ, nhãn Pre A1 trên gỗ sáng. Biển Listening có tai nghe, Reading & Writing có sách/bút và chữ chạy theo vòm SVG. Bố cục mới ngày 2026-10-07 giảm bảng tên khoảng 10%, tăng biển kỹ năng và mở rộng hai sân desktop lên 38%, cùng điểm neo dọc 49%; mỗi sân mobile rộng `100vw - 24px`.

Tên đề hiển thị đầy đủ bằng Nunito 700, không rút gọn hoặc giới hạn số dòng. Khung gỗ SVG kéo dài và tăng chiều cao theo chữ; linh vật đứng đầu khung ở ô riêng, huy hiệu số và mũi tên nhỏ. Asset alpha mới `public/assets/lesson-cards/scene-mascots-v1.webp` tách năm linh vật từ sprite cũ bằng built-in imagegen, PNG/prompt tại `output/imagegen/scene-mascots-v1.{png,prompt.md}`. Sprite cũ vẫn phục vụ icon trang chủ. Chi tiết và kiểm chứng: `docs/scene-link-layout.md`.

Năm thẻ hiển thị khi đủ chiều cao; mobile/tên dài dùng ít hàng hơn để giữ chữ dễ đọc. Mỗi sân cuộn độc lập bằng bánh xe, touch, bàn phím hoặc nút lên/xuống 44px, có vị trí/tổng bài thay hai thanh cuộn nâu. Hover phóng nhẹ từ 0.985 lên 1 và sáng thêm 3,5%; giảm chuyển động tắt animation. Dấu phân cách U+FFFD đứng riêng giữa khoảng trắng tiếp tục hiển thị bằng dấu ·, chỉ ở UI; dữ liệu nguồn giữ nguyên.

## Chỉnh danh sách trong dashboard

1. Mở **Kho đề luyện thi → Starters → Danh sách link học sinh**.
2. Chọn **Listening** hoặc **Reading & Writing**.
3. Bấm **+ Thêm link**, chọn bộ đề công khai tương ứng; dùng ↑/↓ đổi thứ tự hoặc **Xóa** để gỡ link.
4. Bấm **Lưu danh sách**. Mở lại trang học sinh để xem bố trí mới.

Danh sách có bao nhiêu bài thì học sinh thấy bấy nhiêu vị trí: 25 bài là 25 vị trí, 31 bài là 31 vị trí. Mỗi sân hiện số bài phù hợp chiều cao và tên đề, cuộn đến bài cuối. Không tạo vị trí trống và không khóa 27/54. Giới hạn kỹ thuật của mỗi request là 1.000 link để tránh payload quá lớn. Mỗi bộ đề xuất hiện một lần trong mỗi danh sách.

Trên điện thoại, nút Listening/Reading & Writing chuyển vùng nhìn sang từng sân, căn giữa ngôi nhà và danh sách tương ứng; ảnh giữ đúng tỷ lệ và tọa độ. Cuộn bên trong danh sách để xem bài tiếp theo. Có điều hướng bàn phím, viền focus và hỗ trợ giảm chuyển động.

## Mô phỏng nhiều link tại local

Để xem đúng 5 link ở mỗi sân, mở `http://localhost:3000/exams/starter?preview=links&count=5`. Thêm `count=1` thay cho `count=5` để đối chiếu trường hợp chỉ có một link ở mỗi sân. Nhãn mô phỏng hiển thị đúng số bài; tên đầy đủ và linh vật đầu khung dùng cùng giao diện với link thật.

Mở `http://localhost:3000/exams/starter?preview=links` khi chạy dev local: mỗi sân có 25 link mẫu, tên đầy đủ và cuộn tới bài 25. Có nhãn “Mô phỏng local”; click/Enter trên bài mẫu không mở bài thi. Trang này không tải catalog thật và không ghi DB/settings/attempt. Bỏ query `preview=links` để xem bài thật. Chỉ bật khi `import.meta.env.DEV`, hostname loopback và query được chọn rõ ràng; helper được lazy-load, bị loại khỏi bản build production. Bản build chính thức luôn dùng catalog B, kể cả URL có query mô phỏng.

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

Checklist: `docs/starter-scene-checklist.md`, `docs/starter-typography-checklist.md`, `docs/starter-house-checklist.md`, `docs/starter-balance-checklist.md`, `docs/starter-natural-links-checklist.md`, `docs/starter-wood-cards-checklist.md`, `docs/starter-compact-checklist.md`, `docs/starter-fit-checklist.md`. Test HTTP native: `npm run test:starter-scene`. Kiểm tra trình duyệt: build chuẩn rồi `npm run test:starter-scene-browser` dưới Node 22; script tạo DB và client build biệt lập, không ghi dữ liệu học sinh thật hoặc gọi provider. Kiểm tra style thực xác nhận chữ cong và nhãn accessible vừa bảng, link dùng Nunito nâu trên pixel gỗ SVG có tương phản >=4,5, linh vật alpha đứng trước khung, số thứ tự vừa huy hiệu và không có ellipsis/clamp. Có kiểm tra hover thường/giảm chuyển động, cuộn bằng bánh xe tới cuối, khung nằm trong sân ở năm kích thước màn hình và production từ chối query mô phỏng. Điều hướng bàn phím/focus, cả hai player, submit/review và admin vẫn được kiểm tra đầy đủ. Fixture giữ tên chứa dấu phân cách lỗi để xác nhận chỉ đổi trình bày, không rewrite nguồn. Checklist cập nhật và bằng chứng tại `docs/scene-link-layout.md`.

Rollback giao diện bằng snapshot source trước sửa trong `.data/starter-scene-before`, sau khi bảo vệ mọi chỉnh sửa phát sinh và build lại. Không xóa hoặc phục hồi đè DB để rollback giao diện; settings mới có thể giữ nguyên khi dùng màn cũ. Chưa deploy production.
