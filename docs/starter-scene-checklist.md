# Starter: cảnh hai sân và danh sách link — 2026-10-05

## Yêu cầu đã chốt

Ảnh làng làm nền lớn; text bằng HTML, asset gỗ trong suốt tách khỏi nền. Hai overlay absolute ở sân Listening và Reading & Writing. Mỗi sân có danh sách thực tế, tối đa 5 bài hiện cùng lúc, cuộn đến hết; không khóa 27/54 vị trí. Dashboard có Danh sách link học sinh, thêm/xóa/sắp xếp. Link chọn bộ đề công khai cùng paper, giữ player/điểm/History và quyền B.

## Trước sửa

- [x] Đọc attachment UTF-8, ảnh/style, quy tắc, CODEMAP/package/source/type/API/CSS/test và Git history; giữ thay đổi có sẵn.
- [x] Baseline exam-platform 103/0; library list/navigation/router 11/0.
- [x] Native backup quick_check=ok và source snapshot `.data/starter-scene-before`; hash DB trước sửa.
- [x] Xác nhận người dùng đổi 27 vị trí cố định thành danh sách động, ít/nhiều hơn 27.

## Trong sửa

- [x] Asset WebP giữ hình/alpha, font Baloo 2/Nunito lưu local và palette gỗ/cream/sky/grass giới hạn ở Starter.
- [x] Danh sách học sinh chỉ trả id/title/href public, 5 dòng có cuộn, mobile/focus/reduced-motion/loading/error/empty.
- [x] Dashboard thêm/xóa/đổi thứ tự, save/revision/retry; giáo viên giữ quyền bài của mình, admin quản lý toàn bộ.
- [x] Settings dùng adapter B, GET không ghi/seed; không thay schema/secret/player/publish/grader/History.
- [x] Test malformed/duplicate/private/ownership/conflict/legacy/default dynamic và persisted layout.

## Sau build

- [x] Scoped tests rồi gate rộng: phase3 597 pass/0 fail, lint/canonical Node 22.16.0 build/native startup. Sau chỉnh UI cuối, chạy lại lint/build/browser và cả hai production-bundle smoke IOE/Speaking.
- [x] Compiled browser: danh sách 0/3/25/31, chỉ 5 visible/scroll cuối; add/remove/reorder/save/reload/role/errors; link vào player thật. HTTP tests kiểm quyền giáo viên/admin, conflict và malformed.
- [x] Xem ảnh desktop/mobile 1440/1280/1024/390/320; đo contrast/focus; không lỗi trình duyệt/tràn trang; module khác giữ luồng cũ. Dashboard có vùng cuộn riêng, footer luôn nhìn thấy; Esc giữ chỉnh sửa chưa lưu.
- [x] Copied DB giữ 58 bảng/1.330 dòng trước và persistence; live read-only/hash/quick_check=ok/WAL, restart/API/source/assets/build artifact. Localhost trả 200 và hiện đúng 1 Listening công khai, 0 R&W; không seed bài minh họa.
- [x] Diff/doc/CODEMAP/report và bàn giao giới hạn chính xác. Không commit/push/deploy hoặc gọi provider.

## Bằng chứng và chẩn đoán UI

Logs: `.data/starter-scene-{baseline-exam,baseline-library,tests,phase3,lint,build,startup,browser,speaking-bundle,ioe-bundle}.log`. Báo cáo: `.data/starter-scene-verification/browser-report.json`, `.data/starter-scene-{copy,db,local,final}-report.json`. Hướng dẫn sử dụng: `docs/starter-scene.md`.

- CSS màu chữ/nút của B ưu tiên `!important`. Scoped theme variables và selector trong dialog giữ palette nâu/cream; font có test tải thực và computed style. Không sửa CSS chung.
- Footer sticky trên dialog dài chiếm phần danh sách ở mobile. Dialog được chia header, nội dung cuộn và footer; đo vùng cuộn tối thiểu 300px tại các viewport đã kiểm tra.
- Native cancel có thể không cancelable khi không có user activation, đã đo trong fixture và đối chiếu [HTML Standard](https://html.spec.whatwg.org/multipage/interaction.html#closewatcher). Guard Esc tại keydown và listener trực tiếp trên dialog bảo vệ chỉnh sửa; test dùng cả input bàn phím và click thực qua CDP, không bỏ assertion.
- Hai máy chủ Vite khởi động đồng thời trong QA có thể tranh cổng HMR mặc định. Dừng các fixture rồi khởi động riêng localhost; lần khởi động cuối không có lỗi cổng. Không thay code/config server của B để xử lý va chạm môi trường kiểm thử.

Build giữ cảnh báo chunk lớn đã có từ trước; không có lỗi build. Khóa revision hiện có bảo vệ trong một tiến trình Node; cần transaction storage nếu triển khai nhiều worker. Chưa deploy production.
