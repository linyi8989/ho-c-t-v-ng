# Giao diện làm bài Starters

Theme áp dụng cho **lượt đang làm** của Starters Listening và Reading & Writing. Màn danh sách hai sân, các cấp khác và màn tổng kết/lịch sử giữ giao diện hiện có.

Ảnh mẫu của người dùng là nguồn định hướng: trời xanh, đồi cây/lâu đài, mặt gỗ mật ong dưới chân, khung kem bo tròn và nút xanh sáng có viền nổi. Nội dung đề, các vùng nối/chọn/tô màu và ảnh giáo viên cung cấp tiếp tục dùng renderer hiện có; không thay bằng ảnh mockup. Font Nunito lưu trong ứng dụng, cùng hệ font của trang Starters. Nút có gradient, hai lớp viền, phần gờ dưới; hover nâng 2px và tắt chuyển động khi thiết bị yêu cầu reduced motion. Disabled tiếp tục đọc được, bàn phím có vòng focus.

`StudentExamAttemptShell` có lựa chọn `theme="starter"`, chỉ truyền từ nhánh `moduleId === 'starter'` trong `GenericExamLearningArea`. Root `data-exam-theme="starter"` là ranh giới CSS. Chủ đề không thay danh tính, ticket, deadline, chuẩn bị lượt, dữ liệu đáp án, chấm điểm, submit, review hoặc projector History. Khung ảnh không thay image stage/content rect; hitbox tiếp tục trong suốt.

Thanh tiêu đề Starters có nền trong suốt, không gradient hoặc làm mờ nền để cảnh trời nối liền với phần làm bài. Thanh vẫn bám trên cùng khi cuộn; vị trí tiêu đề, tiến độ, đồng hồ và nút Nộp bài giữ nguyên.

Nền minh họa dùng lớp cố định phủ kín viewport và giữ tỉ lệ ảnh, không kéo giãn theo độ dài Part. Xem [storybook-background.md](storybook-background.md) cho cơ chế chung và kiểm tra trang dài.

Thanh nghe `StarterAudioPlayer` dùng `HTMLAudioElement` và URL của Part: phát/tạm dừng, thời gian, tua bằng slider/bàn phím, mute và âm lượng. Đổi nguồn audio tạo clip UI mới, không tự phát. Duration chưa sẵn thì tua bị khóa; lỗi file/kết nối có thông báo và vẫn cho nghe lại. Những cấp khác giữ native audio controls. Không thêm provider hoặc storage.

Ảnh nền do **built-in imagegen** tạo: `public/assets/backgrounds/bg-starter-exam-v1.webp`, 1536 × 1024, 58.426 byte. Bản gốc `output/imagegen/starter-exam-background-v1.png`; prompt đầy đủ `output/imagegen/starter-exam-background-v1.prompt.md`. WebP chỉ đổi định dạng/nén, không sửa nội dung ảnh. Background không chứa chữ, nút, khung hay nội dung đề; những thành phần đó đều là HTML thật.

Kiểm tra theo `docs/starter-player-checklist.md`: baseline/final exam-platform, Listening, lint/build, browser với DB riêng. Fixture gồm audio WAV 5 giây và SVG đề kiểm tra; mọi attempt/submit trong smoke thuộc fixture. Không tạo demo hoặc sửa bộ đề thật. Snapshot rollback source `.data/starter-player-before`, rồi build lại sau khi bảo vệ chỉnh sửa mới.

Đã kiểm chứng ngày 2026-10-06: 246 test đạt, lint/build đạt, thao tác nghe/nối/nhập/chuyển Part/nộp bài và bố cục desktop/mobile đạt, zero browser exception. Kết quả chi tiết ở `.data/starter-player-final-report.json`. Build có cảnh báo chunk-size hiện có, không có lỗi build. Localhost đang phục vụ source bằng `npm run dev:local:native` với Node 22, giữ nguyên DB WAL hiện có.
