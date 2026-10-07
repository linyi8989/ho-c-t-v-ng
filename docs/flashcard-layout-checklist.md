# Thẻ từ vựng: ảnh và câu dài — 2026-10-04

Phạm vi: layout/typography của FlashcardGame; giữ nguyên ảnh nguồn, cấu hình game, âm thanh, thứ tự từ, chấm điểm và History. Không thay schema/API hoặc CSS chung của game khác.

File của thay đổi này: `src/components/games/FlashcardGame.tsx`, `src/components/games/FlashcardGame.css`, `scripts/flashcard-layout-browser-smoke.mjs`, `package.json` (thêm lệnh QA), `CODEMAP.md` và checklist này. `dist/` được tạo lại bằng build chuẩn, không sửa thủ công.

## Trước sửa

- [x] Đọc quytac.md, source flashcard/ảnh/controls, CSS cascade, contract tests và lịch sử Git.
- [x] Nhận diện thay đổi Speaking/IOE/FCE có sẵn; giữ nguyên.
- [x] Baseline: 18 tests từ vựng đạt. Ảnh người dùng và source chỉ ra thẻ cố định 380px, hai mặt absolute và chữ 36–48px gây cắt nội dung.
- [x] Tái hiện bằng game thật + global CSS đã build với đúng câu trong ảnh.

## Trong sửa

- [x] Hai mặt cùng grid row tự giãn theo mặt dài hơn; bỏ chiều cao cố định và cuộn trong nội dung.
- [x] Giảm chữ chính xuống 20–32px theo màn hình; câu dài/từ không có khoảng trắng xuống dòng trong khung.
- [x] Frame ảnh vừa kích thước thực, giới hạn theo chiều rộng thẻ và chiều cao ảnh, giữ tỷ lệ và object-contain.
- [x] CSS chỉ dưới #flashcard-game-root; không sửa shared VocabItemImage hoặc layout game khác.
- [x] Browser: trước/sau, cả hai mặt, câu/nghĩa/ví dụ/ghi chú dài, ảnh ngang/dọc/vuông/lỗi, không ảnh và sound-only.

## Sau build

- [x] Test từ vựng và các gate B phù hợp; typecheck/canonical build/startup Node 22.
- [x] Desktop 1440/620px, mobile 390/320px: không cắt/tràn, ảnh đúng tỷ lệ, chữ nhỏ hơn và đọc được, controls nằm ngoài thẻ.
- [x] Lật, đánh dấu thuộc/chưa thuộc, chuyển từ và điểm kết thúc giữ nguyên.
- [x] Kiểm tra ảnh chụp, contrast/focus, diff/encoding và ghi artifact vào CODEMAP.

Không commit/push/deploy production hoặc ghi fixture vào dữ liệu local của người dùng.

## Bằng chứng kiểm tra

- Trước sửa: game thật với câu “Can you tell me about yourself?” và ảnh 4:3 tại 620px; mặt thẻ chỉ có 376px nhưng nội dung cần 466px, bị cắt. Log: `.data/flashcard-layout-baseline.log`.
- Sau sửa: `npm run test:flashcard-layout` — **24 trường hợp đạt**, gồm 6 fixture × 4 viewport (1440, 620, 390, 320px), mỗi trường hợp kiểm tra cả hai mặt. Đã xem ảnh chụp desktop/mobile của câu có ảnh và mặt sau có lời giải dài. Không tràn/cắt chữ, ảnh đúng tỷ lệ và controls nằm dưới thẻ; lật thẻ vẫn nhận thao tác đúng mặt.
- Chữ chính 20–32px, nghĩa 18–26px, IPA 14–18px. Hai mặt dùng chung chiều cao theo nội dung dài hơn; ảnh tối đa 280px rộng/220px cao và co tiếp khi thẻ nhỏ. Header/IPA dùng màu đậm; tương phản computed tối thiểu **5.12:1**. Tab có focus 3px; Enter chuyển từ; prev, selected toggles và đánh dấu thuộc/chưa thuộc giữ hoạt động, kết thúc đúng 50 điểm/1 thuộc/1 chưa thuộc.
- `npm run test:phase3` — **571 pass / 0 fail**, có typecheck, canonical build và native SQLite startup. Log: `.data/flashcard-phase3.log`. Vite vẫn có cảnh báo kích thước chunk lớn của dự án; không có lỗi build.
- `npm run test:speaking-bundle` và `npm run test:competition-bundle` đạt trên DB fixture riêng sau build: History, identity/auth, private audio, attempt và media vẫn qua kiểm tra.
- Browser log/report: `.data/flashcard-layout-browser.log`, `.data/flashcard-verification/browser-report.json`. QA dùng Chrome và mô phỏng kích thước mobile; không gọi TTS/provider hoặc tạo dữ liệu bài học thật.
- Artifact: `index-BawVN84d.js` / `index-UiZPLWL7.css`, 74 JS/CSS assets; lazy flashcard `FlashcardGame-aKikmj7K.js` / `FlashcardGame-DgHIbkjy.css` được StudentLearningArea tải kèm CSS. Backend SHA256 vẫn `A53E7BB61109E9249E902E127F4A54D9CAF632AE38C85467F8A8A5C29B1C1D21` (không đổi).
- Localhost và CSS mới đều trả HTTP 200; giữ server dev đang chạy. Có thể tải lại trang để dùng giao diện mới. Không sửa `.env`, database, shared image component hoặc gameplay/History.
