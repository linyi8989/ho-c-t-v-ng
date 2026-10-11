# Tự lưu nội dung soạn và ổn định phiên — 10–11/10/2026

## Phạm vi và kết quả

Từ vựng; ngữ pháp trắc nghiệm/tự luận; Movers Listening; Movers Reading & Writing; các đề qua GenericExamAdmin (Starters/Flyers/KET/PET/FCE/IELTS/Writing); Speaking; IOE/Violympic; ô nhập nhanh và JSON/Smart Import chưa ghép. Giữ write path, validation, quyền sở hữu và thao tác xuất bản hiện tại. Bài làm học sinh và phần maintenance trước đó giữ nguyên.

Bài mới và các form authoring tự giữ nháp trên trình duyệt sau khoảng 250 ms ngừng nhập; checkpoint khi ẩn tab, pagehide, trước unload, chuyển màn/unmount và trước đăng xuất. Nháp có owner/module/entity/slot để tách tài khoản, loại bài và phiên soạn. Mở một bài mới giữ nháp cũ riêng. Khôi phục tiếp tục trong slot gốc, không tạo thêm bản cũ; các ô nhập JSON chỉ khôi phục đúng ô/Part. Cache đúng snapshot đã lưu được bỏ; thay đổi mới trong lúc request chạy được giữ.

Đề đã có ID trong Movers Listening, Reading & Writing và GenericExamAdmin còn tự lưu server sau khoảng 1,2 s ngừng nhập; ẩn tab/đăng xuất yêu cầu flush. Chỉ một autosave chạy tại một thời điểm, lưu thủ công chờ autosave trước rồi lấy revision/snapshot mới nhất. Bài mới không tự tạo bản ghi server; từ vựng/ngữ pháp/Speaking/IOE dùng nháp thiết bị và nút lưu hiện có để tránh đưa nội dung chưa hoàn tất vào dữ liệu phát hành/ngân hàng.

IOE ghi idempotency key vào nháp trước POST. Sau mỗi chunk thành công, cache chỉ giữ câu chưa lưu. Khi lỗi giữa danh sách hoặc mất response sau commit, reload → khôi phục → lưu lại dùng cùng key để tránh câu trùng. Sửa câu đã có giữ revision và server conflict hiện tại.

## Chẩn đoán có bằng chứng

- Autosave đề trước đây chỉ chạy khi có editingId; bài mới thiếu fallback bền vững khi tab đóng/phiên hết hạn.
- GenericExamAdmin trước đây setDirty(false) sau mọi response, kể cả khi người dùng vừa nhập thêm trong lúc request chạy. Browser QA đối chiếu API thực đã xác nhận sửa mới cuối cùng còn trên server.
- Sidebar “Soạn từ vựng mới” trước đây chỉ đổi tab. Đã nối đúng luồng khởi tạo và checkpoint nháp cũ.
- Trước đây đã sửa onIdTokenChanged, nhưng API vẫn có thể dùng token cũ từ React state. Wrapper fetch mới lấy token SDK hiện tại cho request cùng origin /api có Bearer thuộc đúng UID; 401 thử refresh/retry tối đa một lần. Không replay lỗi mạng/403/5xx và không chuyển write sang tài khoản khác. Giữ FormData headers/body/abort và capability/custom/local token hiện có.
- Profile refresh dùng sequence/UID để response cũ không khôi phục hoặc xóa phiên mới. Khi tab trở lại/online, refresh profile không làm mất màn soạn vì lỗi hạ tầng tạm thời. Logout checkpoint/flush trước signOut, chờ tối đa 1,5 s rồi nháp thiết bị tiếp tục bảo vệ phần chưa gửi.
- Firebase verify trước đây gán mọi exception thành401. Token thực sự không hợp lệ vẫn401; lỗi verifier/hạ tầng tạm thời thành503 AUTH_VERIFICATION_UNAVAILABLE. Không tăng TTL hoặc bỏ kiểm tra auth.
- Chưa có log production của ca 1–2 phút nên chưa kết luận nguyên nhân duy nhất trên hosting. Test local bypass không chứng minh Firebase thật/cPanel mạng ổn định.

## Checklist

- [x] Đọc quy tắc/source/type/API/test/lịch sử Git; nhận diện và giữ phần maintenance đang có.
- [x] Backup source và database trước thay đổi; baseline31 test đạt.
- [x] Token mới tại request, retry401 có giới hạn; guard UID trước/sau refresh, không gửi dưới tài khoản khác.
- [x] Refresh foreground/online; chống profile response cũ sau logout; lỗi hạ tầng không thành thông báo hết hạn.
- [x] Nháp thiết bị theo tài khoản/module/bài/phiên; checkpoint vòng đời; quota/malformed/error có thông báo, không xóa dữ liệu cũ để nhường chỗ.
- [x] Phục hồi có lựa chọn; giữ revision/conflict; không tự xuất bản/ghi đè server khi hồi phục các form dùng lưu thủ công.
- [x] Phủ các màn authoring và JSON/nhập nhanh chưa ghép; không lưu token hoặc binary/base64 media.
- [x] Giữ snapshot mới khi sửa trong lúc lưu; đồng bộ ID/revision sau tạo bài và Smart Import.
- [x] IOE lưu từng phần và mất response có cache phần còn lại + idempotency key qua reload.
- [x] 20 unit/regression test chuyên biệt token/owner/retry/header/body/abort/quota/nháp/khôi phục và lỗi verifier đạt.
- [x] Browser QA: reload/đổi màn/ẩn tab/pagehide/logout, server chậm, conflict409, raw JSON, quota, desktop/mobile/focus, nhiều bài mới, cache slot và retry IOE đạt trên fixture riêng.
- [x] Dữ liệu local:58 bảng so với backup giống toàn bộ row fingerprint, quick_check=ok; kiểm thử chỉ ghi database QA.
- [x] Gate cuối phase3 (bao gồm TypeScript, domain tests, canonical build/startup), production bundle smoke và manifest.
- [x] CODEMAP/diff cuối, mở localhost và bàn giao.

## Giới hạn và hướng dẫn test trên host

Nháp thiết bị thuộc tài khoản trên đúng trình duyệt/profile/domain. Xóa dữ liệu trình duyệt, dùng máy khác hoặc profile ẩn danh mới sẽ không mang theo nháp. Giới hạn2 MiB/bản ghi; khi storage bị chặn/đầy phải dùng nút lưu server và xử lý thông báo. File còn đang chọn chưa upload phải chọn lại; chỉ nội dung text/JSON, metadata và URL đã có được giữ. Không bảo đảm request async hoàn tất khi browser bị đóng; checkpoint thiết bị là lớp dự phòng.

Không cần biến môi trường mới. Khi triển khai cần dùng client/server cùng build và restart Node app hiện tại. Kiểm tra tài khoản Firebase thật: soạn đề mới rồi đổi sang tab khác2–5 phút, trở lại sửa/lưu; reload/đăng nhập lại rồi khôi phục nháp; thử đề đã có ID và đối chiếu nội dung cuối trên server. Nếu còn lỗi, lấy timestamp + URL endpoint + HTTP status + mã error của request và log verifier code/name tương ứng; không gửi token/API key. Kiểm tra đồng hồ server và khả năng truy cập dịch vụ Firebase nếu503 lặp lại.

## Bằng chứng và rollback

`.data/authoring-session-qa/`: before/ chứa source và online database backup; baseline-tests.log; unit/final-*.log; test-phase3-final.log; browser-final.log/browser-report.json; ảnh desktop/mobile; data-final.json. Những file QA chứa dữ liệu fixture/local, không commit hoặc đưa lên host.

Rollback chỉ các thay đổi authoring/auth thuộc kế hoạch này, giữ phần maintenance và mọi chỉnh sửa mới hơn; build lại bằng script chuẩn. Không thay schema/migration, không dọn dữ liệu, không push/deploy trong tác vụ này.

Kết quả cuối: phase3 gồm622 test/23 nhóm đều đạt;20 test authoring riêng và21 tình huống browser đạt; hai bundle production Speaking/IOE đạt, production bypass bị từ chối đúng guard;122 asset khớp manifest. Bản build server1644314 bytes/SHA256 d0901939695a641bbf7414d297f45ed24c2a71f825b94e0b61080863054856f2. Localhttp://127.0.0.1:3000: page200/profile200;58 bảng giống backup sau startup, quick_check=ok. QA3178 đã dừng.
