import {cleanupCategory,type CleanupCategory} from './hostingInventory';
export interface MaintenanceFile {
  id: string; rootId: string; relative: string; name: string; bytes: number; modifiedAt: string;
  kind: string; status: string; reason: string; pinned?: boolean; verified?: boolean;
  previewType?: 'image' | 'audio' | null; heldUntil?: string | null;
}
export interface MaintenanceSummary {
  latest: null | {
    at: string; complete: boolean; totalBytes: number; fileCount: number; durationMs: number;
    groups: Array<{ id: string; label: string; root: string; bytes: number; allocatedBytes: number; files: number }>;
    entries: MaintenanceFile[];
    quota: { status: string; usedBytes: number | null; limitBytes: number | null; measuredAt: string | null };
    issues: Array<{ root: string; status: string; relative?: string }>;
    alerts: Array<{ severity: string; message: string; action: string }>;
    growth: Array<{ id: string; label: string; bytes: number }>;
    cron: { status: string; schedules: Array<{ id: number; task?: string; schedule: string; command: string; status: string }> };
  };
  snapshots: Array<{ at: string; complete: boolean; bytes: number }>;
  jobs: Array<{ id: string; task: string; source: string; status: string; startedAt: string; finishedAt?: string; durationMs?: number; scanned?: number; removedBytes?: number; quarantinedBytes?: number; error?: string }>;
  audit: Array<{ id: string; at: string; actor: string; action: string; file?: string; bytes?: number; removedBytes?: number; quarantinedBytes?: number; reason?: string }>;
  quarantine: Array<{ id: string; name: string; relative: string; rootId: string; bytes: number; at: string; status: string }>;
  policy: { temporary: boolean; speaking: boolean };
  roots: Array<{ id: string; root: string; label: string }>;
  busy: boolean; scanRunning: boolean; scanError: string;
}
export const maintenanceStatus: Record<string, string> = {
  protected: 'Được bảo vệ', used: 'Đang sử dụng', unknown: 'Chưa xác minh', suspected: 'Nghi ngờ mồ côi',
  eligible: 'Đủ điều kiện dọn', blocked: 'Quá hạn, đang bị giữ', review: 'Cần xác nhận', held: 'Giữ lại', pinned: 'Đã ghim',
};
export const maintenanceStatusDescription: Record<string, string> = {
  protected: 'Dữ liệu quan trọng hoặc ngoài phạm vi được phép dọn; dashboard không cấp xóa.',
  used: 'Có tham chiếu sử dụng hoặc còn trong thời gian bảo vệ; giữ nguyên.',
  unknown: 'Thiếu thông tin để xác minh an toàn; chưa được phép xóa.',
  suspected: 'Chưa tìm thấy tham chiếu trong lần quét; chỉ là nghi ngờ, cần kiểm tra media riêng trước khi xóa.',
  eligible: 'Đã đạt quy tắc dọn; có thể cách ly hoặc xem trước xóa, server vẫn kiểm tra lại.',
  blocked: 'Đã quá hạn nhưng tác vụ còn dùng; chặn xóa để bảo vệ tác vụ.',
  review: 'Backup cần đối chiếu file local và xác nhận trước khi xóa khỏi host.',
  held: 'Được quản trị viên bảo vệ đến thời hạn hiển thị; file vẫn ở vị trí cũ.',
  pinned: 'Backup được ghim, không cho xóa cho đến khi bỏ ghim.',
};
export function maintenanceCleanupDecision(entry:MaintenanceFile):{category:CleanupCategory;label:string;reason:string;nextSteps:string[]} {
  const protectedFile=entry.pinned||['protected','used','blocked','held','pinned'].includes(entry.status);
  const ready=!protectedFile&&(entry.status==='eligible'||entry.kind==='backup'&&entry.verified);
  const category:CleanupCategory=protectedFile?'protected':ready?'ready':['suspected','review'].includes(entry.status)?'review':'unverified';
  const nextSteps=category==='ready'?['Xem trước thao tác, nhập đúng tên xác nhận. Server kiểm tra lại file và điều kiện trước khi xử lý.']:entry.kind==='backup'?['Tải bản đã có, chọn lại file local để đối chiếu SHA-256/bytes/quick_check. Bỏ ghim trước khi xem trước xóa.']:entry.status==='suspected'?['Chưa tìm thấy tham chiếu chưa chứng minh file vô dụng. Cần verifier media kiểm tra draft/version/bài học/kết quả/job trước khi cho xóa.']:category==='protected'?['Giữ nguyên theo tham chiếu, thời hạn hoặc tác vụ đang dùng. Giữ 30 ngày chỉ khóa tạm thời; hết hạn không tự xóa.']:['Quét lại và kiểm tra nguồn/policy đúng nhóm trước khi dọn.'];
  return {category,label:cleanupCategory[category],reason:entry.reason,nextSteps};
}
export function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return 'Chưa có dữ liệu';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let n = Math.abs(bytes), index = 0;
  while (n >= 1024 && index < units.length - 1) { n /= 1024; index++; }
  return (bytes < 0 ? '−' : '') + n.toLocaleString('vi-VN', { maximumFractionDigits: index ? 2 : 0 }) + ' ' + units[index];
}
