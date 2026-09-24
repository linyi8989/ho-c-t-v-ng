import LibraryPagination from '../LibraryPagination';

export interface AuditLogController {
  auditLogs: any[];
  auditPage: number;
  auditPageSize: number;
  auditTotalItems: number;
  auditTotalPages: number;
  setAuditPage: (value: number) => void;
  setAuditPageSize: (value: number) => void;
}

export default function AuditLogPanel({
  controller,
}: {
  controller: AuditLogController;
}) {
  const {
    auditLogs,
    auditPage,
    auditPageSize,
    auditTotalItems,
    auditTotalPages,
    setAuditPage,
    setAuditPageSize,
  } = controller;

  return (
          <div className="space-y-6 animate-fade-in" id="audit-logs-tab-content">
            <div>
              <h2 className="text-2xl font-black text-gray-800">Nhật ký hệ thống (Audit Logs)</h2>
              <p className="text-gray-400 text-sm">Ghi chép các sự kiện quan trọng trong hệ thống: đăng ký mới, cập nhật vai trò, khóa/mở khóa tài khoản.</p>
            </div>

            {/* Logs Timeline Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4 w-16">STT</th>
                      <th className="p-4 w-48">Thời gian</th>
                      <th className="p-4 w-40">Hành động</th>
                      <th className="p-4 w-52">Người thực hiện</th>
                      <th className="p-4">Chi tiết hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Chưa có nhật ký hoạt động nào được ghi nhận.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, index) => {
                        const dateFormatted = log.timestamp
                          ? new Date(log.timestamp).toLocaleString('vi-VN', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'Unknown';

                        let actionBadgeColor = 'bg-gray-50 text-gray-600';
                        if (log.action === 'LOCK_USER') actionBadgeColor = 'bg-rose-50 text-rose-700';
                        if (log.action === 'UNLOCK_USER') actionBadgeColor = 'bg-emerald-50 text-emerald-700';
                        if (log.action === 'UPDATE_USER_ROLE') actionBadgeColor = 'bg-amber-50 text-amber-700';
                        if (log.action === 'REGISTER_USER') actionBadgeColor = 'bg-indigo-50 text-indigo-700';

                        return (
                          <tr key={log.id} className="hover:bg-gray-50/30 text-xs font-semibold text-gray-700">
                            <td className="p-4 text-gray-400 font-bold">{(auditPage - 1) * auditPageSize + index + 1}</td>
                            <td className="p-4 text-gray-500 font-normal">{dateFormatted}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${actionBadgeColor}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="text-gray-800 font-bold">{log.userName || 'Hệ thống'}</span>
                                <span className="text-[10px] text-gray-400">{log.userEmail || ''}</span>
                              </div>
                            </td>
                            <td className="p-4 text-gray-600 font-normal font-mono max-w-[300px] truncate" title={log.details}>
                              {log.details}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <LibraryPagination
              currentPage={Math.min(auditPage, auditTotalPages)}
              totalPages={auditTotalPages}
              pageSize={auditPageSize}
              totalItems={auditTotalItems}
              onPageChange={setAuditPage}
              onPageSizeChange={(size) => { setAuditPageSize(size); setAuditPage(1); }}
            />
          </div>
  );
}
