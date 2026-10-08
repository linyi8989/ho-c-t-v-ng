# Khung link đề đầy đủ — 2026-10-07

Áp dụng từ Movers tới toàn bộ Starters, Movers, Flyers, KET, PET, FCE và IELTS qua `StarterScenePage`, `SceneYard`, `SceneLessonLink` và CSS scoped `#starter-scene-page`.

- Giữ nguyên toàn bộ tên đề từ catalog. Chỉ tiếp tục thay dấu phân cách lỗi U+FFFD đứng riêng giữa khoảng trắng bằng dấu · như bản trước; không ghi lại tên nguồn. Chữ Nunito 700, 15px trên điện thoại, 16–18px trên hai sân desktop và 15–17px trên ba sân. Tên dài xuống dòng tự nhiên; khung tăng chiều cao, không clamp hoặc ellipsis.
- Hai sân desktop mở rộng từ 30,5% lên 38% chiều ngang cảnh, cùng điểm neo dọc 49%; ba sân từ 26,3% lên 28,5%, giữ đúng ba nhà/kỹ năng. Mobile mỗi danh sách rộng `100vw - 24px`, chuyển sân theo nút kỹ năng. Nền giữ tỷ lệ tự nhiên.
- Linh vật đứng trước khung, ở ô riêng không chiếm vùng chữ. Bảng gỗ SVG co giãn, số/mũi tên nhỏ vừa phải, màu mật ong và huy hiệu pastel. Khoảng cách giữa các bài 10px. Năm bài hiện đầy đủ trên màn hình rộng khi đủ chỗ; màn hình hẹp hiện ít hơn để giữ tên và cỡ chữ dễ đọc. Tất cả bài vẫn có trong danh sách cuộn.
- Hai thanh cuộn nâu được thay bằng chỉ báo vị trí/tổng bài và hai nút cuộn 44px. Bánh xe, touch, vùng cuộn bàn phím và link có focus vẫn hoạt động. Nút vô hiệu ở đầu/cuối; reduced motion bỏ animation cuộn.
- Bảng tên cấp giảm khoảng 10%, biển kỹ năng lớn hơn khoảng 12–14%. Điều hướng desktop Home/History ở hàng trên, Previous/Next ở hàng dưới; mobile ba/bốn biển chia đều chiều ngang. URL và nhãn đầy đủ giữ nguyên.

Linh vật: built-in imagegen, edit target `starter-wood-cards-v2.webp`, RGBA thật. Master/prompt: `output/imagegen/scene-mascots-v1.png`, `output/imagegen/scene-mascots-v1.prompt.md`. Production `public/assets/lesson-cards/scene-mascots-v1.webp`, 724×2172 / 225.056 byte / SHA-256 `4a5d329b77df7e83ffb81b86a405a0fbf385c289f25cade461a8e13d5fe65f3e`. Chỉ chuyển định dạng bằng Pillow, giữ alpha. CSS cô lập từng hình tại các khoảng alpha trống; không sửa/cắt file nguồn. Asset cũ của trang chủ không đổi.

Kiểm chứng bằng Node 22.16.0: typecheck, build chuẩn, 7 kiểm thử catalog native; browser bảy cấp × năm chiều rộng 1920/1440/1024/390/320, tên đầy đủ và tên dài không có khoảng trắng, vị trí linh vật, cuộn bằng nút/bánh xe tới bài cuối, chuyển cấp/sân, loading/error/retry/empty, admin add/remove/reorder/save, focus/reduced motion. Browser toàn app Starters kiểm tra API thật trên DB fixture, source separator giữ nguyên, tương phản pixel gỗ SVG, alpha linh vật, số nhiều chữ số, điều hướng bàn phím, hai player, submit/review và quản trị.

Báo cáo: `.data/exam-scenes-verification/browser-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/scene-links-{build,lint,browser}.log`, `.data/scene-links-artifact.json`. Screenshot desktop/mobile được xem trực tiếp. Không đổi API, DB thật, chấm điểm, dependency, biến môi trường; không commit/push/deploy. Rollback chỉ các component/CSS/asset mới sau khi bảo vệ chỉnh sửa mới hơn, rồi build lại; không restore DB.

## Mép sân Starters — 2026-10-08

Hai sân Starters có độ thụt đầu/cuối theo một đường cong bậc hai liên tục: hẹp gần hai đầu, rộng nhất ở giữa, bất đối xứng theo khoảng trống của từng sân. Độ rộng tính từ vị trí hàng đang hiển thị, cập nhật bằng ResizeObserver và scroll qua requestAnimationFrame; không lặp mẫu theo số thứ tự bài. Hai đầu mặt gỗ dùng bán kính SVG 36px để chuyển tiếp mềm. Đường cong neo vào vùng thiết kế cố định 350px (5 hàng tối thiểu 60px, 4 khoảng cách 10px và padding 5px ở mỗi đầu), thu theo chiều cao viewport nếu vùng nhìn thấp hơn. Không chuẩn hóa theo chiều cao nội dung hoặc số link; hàng đầu giữ cùng độ thụt khi có 1, 5 hoặc nhiều bài. Mobile giảm độ thụt còn 15% để ưu tiên đủ chỗ cho tên bài. Không giới hạn số dòng, không rút gọn tên, không cắt vùng tương tác; linh vật vẫn nằm trước bảng gỗ.

Ban đầu chỉ Starters bật contour; các cấp khác được áp dụng chung trong cập nhật bên dưới. Danh sách thật và mô phỏng dùng cùng component. Mô phỏng 5 link: `/exams/starter?preview=links&count=5`; mô phỏng 25 link: `/exams/starter?preview=links`. Không ghi dữ liệu hoặc đổi catalog/route/player.

Kiểm tra local trực tiếp: năm link ở mỗi sân có chiều rộng thay đổi theo vị trí; tên đầy đủ vừa khung; góc SVG computed rx=36px; viewport desktop 1440px, điện thoại 390px và chuyển sân; danh sách 25 bài cuộn bằng End tới bài cuối vẫn đọc đủ tên và cập nhật độ thụt theo vị trí mới. Typecheck pass. Đây là kiểm tra source dev trên localhost; báo cáo/build chuẩn phía trên thuộc lượt kiểm chứng trước thay đổi contour.


Sửa trường hợp chỉ có một bài: trước đây nội dung 70px khiến tâm hàng đầu thành tâm đường cong, gần như bỏ hết độ thụt. Sau sửa, kiểm tra browser thực xác nhận hàng đầu của 1/5 link có cùng chiều rộng và độ thụt ở desktop lẫn 390px; đã kiểm tra cả một bộ đề thật. Sân Reading & Writing của Starters chuyển từ left 74,5%/top 49% sang left 76%/top 50% trên desktop; mobile giữ tâm 77,8% để toàn bộ sân nằm trong viewport, chỉ hạ xuống top 50%. Chiều cao sân giữ 37%, linh vật đi cùng hàng link. Bố cục các cấp khác khi đó giữ nguyên; xem cập nhật áp dụng chung bên dưới.

## Áp dụng mép sân cho cả bảy cấp — 2026-10-08

- Movers A1, Flyers A2 và KET A2 Key dùng cùng đường cong trái/phải và vị trí sân Reading & Writing như Starters: desktop left 76% / top 50%; mobile giữ tâm 77,8%. Cơ chế căn viewport khi đổi kỹ năng cũng dùng cùng tâm sân, tránh lệch vị trí so với link.
- PET B1 Preliminary, FCE B2 First và IELTS dùng ba đường cong trái/giữa/phải theo ba sân hiện có. Sân giữa thụt đối xứng, nhẹ hơn hai sân ngoài (hệ số 0,16 phía trên / 0,13 phía dưới). Vị trí ba nhà, các kỹ năng và tâm sân 20% / 50% / 80% giữ nguyên.
- Tất cả dùng cùng vùng thiết kế tối đa 350px, góc bảng gỗ 36px và hệ số mobile 15%. Một bài không tự kéo rộng hơn bài đầu trong danh sách năm bài. Tên nguồn hiển thị đầy đủ, tự xuống dòng; linh vật nằm ở ô đầu của mỗi hàng.
- Khi cuộn đến cuối, danh sách giữ neo ở đáy dù khung co lại làm tên bài xuống dòng và tăng chiều cao. Bài cuối vẫn hiện đủ, nút cuộn xuống được vô hiệu đúng lúc; Home đưa danh sách về đầu.

Kiểm chứng localhost: bảy cấp ở desktop 1920px với 1/5 bài mỗi sân; sáu cấp được cập nhật ở điện thoại 390px qua từng nút kỹ năng; Movers và IELTS với 25 bài, End tới bài cuối và Home về đầu. Không tràn ngang, không rút gọn tên, linh vật đứng trước bảng, góc SVG 36px. Ba sân có thể hiện ít hàng hơn hai sân do chiều cao vùng nhìn; các bài còn lại vẫn cuộn được. TypeScript, build chuẩn Node 22.16.0 và 7 kiểm thử catalog đều pass.

Báo cáo `.data/scene-contour-all-browser-report.json`; screenshot `.data/scene-contour-{mover,ielts}-{desktop,mobile}.png`; log `.data/scene-contour-all-{build,lint,tests}.log`. Snapshot trước sửa `.data/scene-contour-all-before`. Mô phỏng có thể mở ở bất kỳ cấp nào bằng `?preview=links&count=1`, `count=5` hoặc `?preview=links` (25 bài). Không đổi API/catalog, đề, URL player, dữ liệu, asset, dependency hoặc biến môi trường. Hoàn tác chỉ source trình bày của lần sửa này sau khi bảo vệ thay đổi mới hơn, rồi build lại; giữ dữ liệu hiện có.
