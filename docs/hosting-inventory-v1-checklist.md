# Checklist triển khai V1 mở rộng hosting — 10/10/2026

Phạm vi theo mục 11 của maintenance-implementation-plan.md và phê duyệt mới nhất: triển khai V1 kiểm kê/giám sát. V2 chỉ duyệt thiết kế; V3 chờ nghiệm thu. Không mở quyền xóa thư mục hosting mới. Ảnh cPanel là đầu mối cấu hình và fixture, không phải bằng chứng quét trực tiếp.

- [x] Đọc quy tắc, CODEMAP, kế hoạch/attachment, source/API/types/build; nhận diện thay đổi có sẵn.
- [x] Baseline maintenance: 21/21 test đạt trước sửa.
- [x] Chỉ mục SQLite riêng, schema version, ngân sách index/WAL/free space, giữ báo cáo trước.
- [x] Root do server đăng ký, executor process riêng, CLI rõ ràng, GET/startup không quét.
- [x] Queue bền vững, batch hữu hạn, heartbeat, pause/resume/cancel và khôi phục sau interruption.
- [x] Metadata file ẩn/nhiều cấp, lỗi quyền/missing/link/hardlink, không đọc secret/nội dung media.
- [x] Tree phân trang/filter/breadcrumb; ba phép đo và coverage tách biệt.
- [x] Bằng chứng config/domain/Passenger/CloudLinux/link/Git/deploy/cron/service/process; thiếu capability báo rõ.
- [x] Năm trạng thái hosting, panel quan hệ/bằng chứng/thời điểm; xác minh lại có chủ đích.
- [x] Snapshot/delta cùng scope, tăng trưởng 1/7/30 ngày, cảnh báo và attribution có mức chứng cứ.
- [x] Backup inventory ngoài dự án theo bộ/thành phần/loại/phần chưa rõ; không cấp quyền xóa.
- [x] Registry cấu hình/lịch so với thực thi; controls chỉ áp dụng collector.
- [x] Regression auth, no side effects GET, bảo toàn main DB/bảng vàng/media/env/runtime.
- [x] Fixture 100.000+ file, quota metadata/low disk, lỗi nguồn/quyền, links, interruption/changing files.
- [x] UI desktop/mobile/keyboard/focus/contrast; kiểm tra browser theo luồng thực.
- [x] Typecheck, maintenance/hosting tests, gate rộng, build, compiled startup/bundle/deploy script.
- [x] Runbook/cấu hình/CODEMAP và kết quả test; rà diff trước bàn giao.
- [ ] Pilot read-only trên host thật: root/quota/API/executor/tải I/O/index budget. Chưa có kết nối host trong phiên này; local pass không đánh dấu pilot đạt.

V1 chỉ ghi metadata vào maintenance/inventory.sqlite. Không migration DB nghiệp vụ. Rollback tắt executor và quay về UI cũ; metadata inventory tách biệt. Mặc định không có cron mới.

Kết quả kiểm thử local: maintenance22/22; hosting inventory19/19 (bao gồm100.123 file được tạo,100.140 file quan sát, index64.012.288 bytes/~61 MiB trong ngân sách128 MiB); phase2 316/316; Listening142/142; Speaking65/65; typecheck/build/native startup/compiled auth PASS. Browser hai luồng cũ/mở rộng PASS: process executor, pause/resume, tree50 mục/trang, evidence/focus/reverify, backup folder membership, registry và390px mobile; contrast thấp nhất7,85:1. Manifest124 file đối chiếu đủ SHA-256/bytes,4 module worker nằm trong scripts/*.mjs của pipeline.

Bằng chứng: .data/maintenance-qa/hosting-{tests,maintenance,phase2,listening,speaking,lint,build,startup,bundle,browser,legacy-browser}.log; hosting-{large-report,artifact,localhost-report}.json; hosting-browser-report.json, browser-report.json và screenshots. Store regression9/9 bổ sung chống khởi tạo nhầm SQLite khác/lease trùng, sau đó chạy lại toàn bộ19 case.

Chẩn đoán đã xử lý: inode NTFS vượt Number precision làm nhận diện bị làm tròn; scanner cũ đọc BigInt khi cần và inventory mới lưu inode nguyên vẹn. Loại trừ index tự ghi nhưng vẫn tính state.json/quarantine. Scope gồm root/media/backup và flags nguồn; thay đổi scope chặn resume/reverify cũ. Native fixture kiểm tra DB/bảng vàng/media/env/runtime còn nguyên. Không chạy thao tác xóa trên dữ liệu người dùng.

Local3000 mở bằng Node22/native SQLite, executor process opt-in cho local, root là workspace hiện tại. GET inventory/overview200, không auth401, không tự tạo scan. QA3177 đã dừng.

Phần còn lại thuộc host acceptance: cấu hình/quyền API thực tế và executor/LVE/quota/index budget; metadata recovery/provider chưa có đủ nguồn nên hiện Unknown/Partial. Không kết luận thư mục nào trên ảnh có thể xóa. Nguồn tạo mới chỉ là unknown/correlation khi chưa có operation gắn file; không tự tuyên bố verified. V2 mở rộng xử lý backup nhiều file/remote và V3 vẫn chưa triển khai.


## Bổ sung khả năng dọn và quan hệ dự án — 10/10/2026

Yêu cầu mới được triển khai theo mục14 của kế hoạch chính; không thay đổi các quyết định đã duyệt và gate rollout V2/V3.

- [x] Tree/evidence/backup hiện4 kết luận dọn và6 nhóm quan hệ dự án/dịch vụ.
- [x] Lý do, chủ sở hữu quan sát được và các bước còn thiếu trên từng đối tượng.
- [x] Nguồn mới/config đúng để gán dự án khác/runtime; tên domain không tự chứng minh.
- [x] Giữ bảo vệ DB/env/runtime/dependency/recovery/Git/dịch vụ/dự án khác/vùng mixed.
- [x] Đối chiếu exact path/bytes/mtime với catalog mới theo actor; stale/scope/issue không nâng quyền.
- [x] Nút Dọn file này mở đúng file ứng dụng; Tải / xác minh backup mở manager cũ.
- [x] File ứng dụng có filter/badge/Điều kiện dọn; không chỉ hiện nút giữ.
- [x] API xóa/typed approval cũ giữ nguyên; không endpoint xóa thư mục ngoài phạm vi.
- [x] Chặn resume scope cũ nhưng cho hủy job cũ; sửa đổi ns/ms chính xác có regression.
- [x] Test hosting22/22 và maintenance22/22; focused3/3 sau chỉnh lời giải thích.
- [x] Typecheck, build cuối, compiled production/auth/no-startup-write smoke.
- [x] Browser mới/cũ desktop/mobile, preview/audio, backup local và typed-confirm cancel.
- [x] Rà diff snapshot, source/deploy pipeline và124 manifest hash/bytes;5 worker flat.
- [x] Local3000 restart native SQLite/tắt seed; cached GET200/auth401; QA3177 dừng.
- [x] Cập nhật kế hoạch chính/runbook/CODEMAP194 và bằng chứng riêng của lần bổ sung.
- [ ] Host pilot và nguồn/API thật; không kết luận file trên ảnh được xóa.

Kết quả mới nhất thay số19 hosting của lần triển khai đầu:22/22. Fixture100.123 file tạo/100.140 observed, index64.036.864 bytes; ngân sách128MiB. Browser kiểm tra temp ready → đúng file → typed confirmation bắt buộc → Hủy giữ fixture, cache review, runtime protected. Các nhóm media chưa có verifier đầy đủ vẫn chỉ review/preview/hold; BackupSet nhiều file và xóa root mới còn thuộc V2.

Bằng chứng: .data/maintenance-qa/cleanup-assessment-*.log/json; hosting-browser-report.json, browser-report.json; screenshots/hosting-{ownership-desktop,cleanup-decisions-desktop,tree-mobile,backup-desktop}.png. Nguồn trước sửa giữ tại cleanup-assessment-before; diff riêng cleanup-assessment-review.diff. Không xóa dữ liệu người dùng.


## Sửa xuất báo cáo — 10/10/2026

- [x] Tái hiện nguyên nhân: nút tải cũ chỉ refresh cache.
- [x] Cập nhật báo cáo và tải file JSON tách riêng; có báo cáo ứng dụng và toàn hosting.
- [x] Export mọi entry đã quét qua tất cả tầng/trang, nguồn/evidence/backup membership/deltas và actor catalog.
- [x] Top20 mục cấp tài khoản và tổng hợp số file/bytes của4 khả năng dọn; không cộng cha/con hai lần.
- [x] GET super_admin, snapshot read-only, streaming100 mục/batch, giới hạn60s/256 MiB và backpressure/abort; không file tạm trên host.
- [x] Partial/stale/scopeChanged/thu gọn được ghi rõ; không cấp quyền dọn mới.
- [x] Regression missing/invalid ID/auth, readonly index, snapshot writer, stream failure/abort/time/bytes và fingerprint.
- [x] Hosting24/24, maintenance22/22, focused4/4, typecheck/canonical build/compiled auth.
- [x] Browser11 kiểm tra, tải file thật cả hai loại, đủ123 file phân trang; desktop/mobile/contrast.
- [x] Fixture100.123 file xuất100.267 entry,103.371.802 bytes, chunk tối đa103.652 bytes.
- [x] Rà diff/source/artifact;124 manifest SHA/bytes và6 flat worker trong deploy glob.
- [x] Restart localhost3000 native/tắt seed; cached export200/auth401, không tự resume,58 bảng giữ số dòng; QA3177 dừng.
- [x] Master plan15/runbook/CODEMAP195 và bằng chứng report-export-*.log/json.
- [ ] Tải qua host/proxy thật sau deploy bản sửa.
- [ ] Khả năng dọn nhóm cache/staging/backup nhiều file ngoài catalog còn cần triển khai V2. Chưa giải phóng dung lượng host bằng lần sửa này.

Snapshot trước sửa: .data/maintenance-qa/report-export-before. Các kiểm tra chỉ dùng fixture hoặc GET metadata local; không cleanup user data, đăng ký cron, tạo backup host, deploy, commit hoặc push.


## Giao diện theo dõi tăng trưởng tinh giản — 10/10/2026

Yêu cầu mới bỏ giao diện can thiệp hosting và tác vụ nền; các đoạn kiểm thử UI cũ ở trên là lịch sử triển khai. Không thêm quyền dọn host hoặc bật V2/V3.

- [x] Ba tab Tổng quan / File & Dọn dẹp / Cài đặt tự động; Tổng quan chỉ thông tin.
- [x] Nhãn/đường dẫn/chức năng và cột nhỏ bên phải cho thư mục ứng dụng và hosting; cached readonly/auth/partial/scope/baseline guards.
- [x] Quét tất cả gọi cả hai scanner; giữ budget, cùng nút tiếp tục hàng chờ, lỗi hosting riêng.
- [x] Chỉ bản thu và media nghi ngờ trong bảng xử lý; các nhóm còn lại chỉ theo dõi dung lượng. Giữ preview/hold/confirmation/busy guard và cài đặt tự động hiện có.
- [x]69 unit/integration +19 browser checks, TypeScript/build/native bundle/122 manifest hashes PASS;58 bảng local nguyên số dòng,quick_check=ok; QA dừng.
- [ ] Nghiệm thu quyền đọc/process/LVE/cPanel trên hosting sau deploy; chưa đánh dấu đạt từ local.

Master plan19 và CODEMAP199 ghi giới hạn2 mốc hosting/14 mốc ứng dụng, bằng chứng focused-* và lượt quét local giữ nguyên hàng chờ. Không xóa dữ liệu thật, push/deploy hoặc bật policy.
