# Starters: chữ link hòa cùng cảnh nền — 2026-10-06

Yêu cầu: chữ link ở cả hai sân nhẹ và cùng tông/style với ảnh; không đổ bóng, không viền nổi, không gạch chân khi rê chuột. Giữ vị trí, danh sách động, 5 dòng/cuộn, biển nhà và player.

- [x] Đọc quytac.md, source/CSS/font và kiểm thử liên quan; nhận diện thay đổi có sẵn, snapshot trong `.data/starter-natural-links-before`.
- [x] Baseline 19 test HTTP/library/registry/điều hướng/quản trị đạt, 0 lỗi.
- [x] Chữ bo tròn Nunito 600, nâu gỗ cùng bảng hiệu; bỏ bóng/viền/gạch chân trên cả hai sân.
- [x] Kiểm tra font và style thực, hover, keyboard/focus, tương phản với nền ảnh.
- [x] Kiểm tra desktop/mobile, 5 dòng/cuộn đến cuối, hai player và quản trị thêm/xóa/sắp xếp/lưu.
- [x] Test sau sửa, typecheck và build chuẩn đạt; kiểm tra artifact/localhost.
- [x] Xem ảnh kiểm tra và diff; cập nhật tài liệu, ghi kết quả thực tế.

Kết quả: 19 test trước/sau sửa đạt, 0 lỗi; typecheck, build Node 22 chuẩn và browser smoke đạt. Browser kiểm tra 1440/1280/1024/390/320px, số bài 0/3/25/31, hai player, 5 dòng/cuộn đến cuối, hover thật ở cả hai sân, focus bàn phím, quản trị thêm/xóa/sắp xếp/lưu/tải lại và các trạng thái loading/error/empty. Không có exception. Đã xem ảnh desktop và hai sân mobile; chỉ font/link đổi, chữ Starters/Pre A1/biển nhà giữ nguyên. Tương phản chữ với ba điểm ảnh nền bên dưới mỗi dòng đang hiện đạt tối thiểu 4,51:1 ở viewport desktop được đo. Nâu ban đầu không đạt ở một điểm cây lá; nâu gỗ đậm hơn giải quyết được mà không cần bóng/ô nền.

Localhost đang phục vụ CSS mới và font Nunito 600, API/danh sách giữ 1 Listening/0 Reading & Writing như trước. Artifact có 78 JS/CSS, không thiếu tham chiếu và vẫn có nút History; server bundle và ba ảnh giữ nguyên hash. Cảnh báo Vite chunk lớn đã có trước; không có lỗi build. Không sửa API, quyền, settings, dữ liệu hoặc player; không gọi provider, seed, commit/push hay deploy.

Bằng chứng: `.data/starter-natural-links-final-report.json`, `.data/starter-scene-verification/browser-report.json`, `.data/starter-natural-links-{baseline,tests,lint,build,browser}.log`. Snapshot trước sửa: `.data/starter-natural-links-before`.
