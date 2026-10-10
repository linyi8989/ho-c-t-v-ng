import express from 'express';
import { createHostingInventoryRouter } from './hostingInventoryRouter';
import type { createHostingInventory } from '../../../scripts/hosting-inventory-core.mjs';
import { pipeline } from 'node:stream/promises';
import { MaintenanceError } from '../../../scripts/maintenance-core.mjs';
import type { createMaintenance } from '../../../scripts/maintenance-core.mjs';

interface Options {
  service: ReturnType<typeof createMaintenance>;
  inventory?: ReturnType<typeof createHostingInventory>;
  authenticateUser: express.RequestHandler;
  requireSuperAdmin: express.RequestHandler;
}
export function createMaintenanceRouter(options: Options) {
  const router = express.Router(), service = options.service;
  let scanning: Promise<unknown> | null = null, scanError = '';
  const sendError = (res: express.Response, error: unknown) => {
    if (res.headersSent) { res.destroy(); return; }
    const known = error instanceof MaintenanceError;
    res.status(known ? error.status : 500).json({ error: known ? error.message : 'Không thể hoàn tất maintenance. Xem trạng thái tác vụ và thử lại.' });
  };
  const handle = (action: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
    (req, res) => { void action(req, res).catch(error => sendError(res, error)); };
  // Single-use, short-lived capability issued only by the authenticated route below.
  // This supports streaming browser downloads without putting Firebase tokens in URLs.
  router.get('/download/:ticket', handle(async (req, res) => {
    await service.download(req.params.ticket, async (file, entry) => {
      res.set({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(entry.bytes),
        'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(entry.name),
        'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
      const stream = file.createReadStream({ autoClose: false });
      const timeout = setTimeout(() => stream.destroy(new Error('Download timeout')), 30 * 60000);
      try { await pipeline(stream, res); } finally { clearTimeout(timeout); }
    });
  }));
  router.use(options.authenticateUser, options.requireSuperAdmin);
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  if (options.inventory) router.use('/inventory', createHostingInventoryRouter(options.inventory,service));
  router.get('/overview', handle(async (req, res) => {
    const d=await service.summary(req.user!.id);
    let hosting: {status:string;at:string|null;bytes:number|null;filesystemComplete:boolean;dependencyComplete:boolean;alerts:number}={status:'unconfigured',at:null,bytes:null,filesystemComplete:false,dependencyComplete:false,alerts:0};
    try {const h=options.inventory?.summary(),s=h?.latest;if(h)hosting={status:s?.status||'unscanned',at:s?.finishedAt||s?.heartbeat||null,bytes:s?.logicalBytes??null,filesystemComplete:Boolean(s?.filesystemComplete),dependencyComplete:Boolean(s?.dependencyComplete),alerts:s?.alerts.length||0};}
    catch{hosting.status='unavailable';}
    res.json({at:d.latest?.at||null,bytes:d.latest?.totalBytes??null,complete:Boolean(d.latest?.complete),alerts:d.latest?.alerts.length||0,backupFiles:d.latest?.entries.filter(e=>e.kind==='backup').length||0,hosting});
  }));
  router.get('/summary', handle(async (req, res) => res.json({ ...await service.summary(req.user!.id), scanRunning: Boolean(scanning), scanError })));
  router.post('/scan', handle(async (req, res) => {
    if (scanning) return res.status(409).json({ error: 'Đang quét dung lượng.' });
    scanError = '';
    scanning = service.scan(req.user!.id).catch(error => { scanError = error instanceof MaintenanceError ? error.message : 'Quét lỗi; báo cáo trước vẫn được giữ.'; }).finally(() => { scanning = null; });
    res.status(202).json({ accepted: true });
  }));
  router.post('/backups/create', handle(async (req, res) => {
    if (req.body?.confirmation !== 'TẠO BACKUP') throw new MaintenanceError(400, 'Cần xác nhận tạo backup mới.');
    res.json(await service.createBackup(req.user!.id));
  }));
  router.post('/backups/:id/download-ticket', handle(async (req, res) => {
    const result = await service.downloadTicket(req.user!.id, req.params.id);
    res.json({ url: '/api/admin/maintenance/download/' + result.ticket, expiresInSeconds: result.expiresInSeconds });
  }));
  router.post('/backups/:id/verify', handle(async (req, res) =>
    res.json(await service.verifyBackup(req.user!.id, req.params.id, req.body?.sha256, req.body?.bytes))));
  router.post('/backups/:id/delete-preview', handle(async (req, res) =>
    res.json(await service.previewDelete(req.user!.id, req.params.id))));
  router.post('/backups/:id/delete', handle(async (req, res) =>
    res.json(await service.deleteBackup(req.user!.id, req.params.id, req.body?.approval, req.body?.confirmation))));
  router.post('/backups/:id/pin', handle(async (req, res) =>
    res.json(await service.pin(req.user!.id, req.params.id, req.body?.enabled))));
  router.post('/files/:id/preview', handle(async (req,res) => {
    await service.previewMedia(req.user!.id,req.params.id,async (file,entry) => {
      res.set({ 'Content-Type':entry.mime,'Content-Length':String(entry.bytes),
        'Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(entry.name),
        'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'none'; sandbox" });
      const stream=file.createReadStream({ autoClose:false,start:0 });
      const timeout=setTimeout(()=>stream.destroy(new Error('Media preview timeout')),30000);
      try { await pipeline(stream,res); } finally { clearTimeout(timeout); }
    });
  }));
  router.post('/files/:id/hold', handle(async (req, res) =>
    res.json(await service.hold(req.user!.id, req.params.id, req.body?.days, req.body?.reason))));
  router.post('/files/:id/cleanup', handle(async (req, res) =>
    res.json(await service.cleanup(req.user!.id, req.params.id, req.body?.action, req.body?.confirmation))));
  router.post('/quarantine/:id', handle(async (req, res) =>
    res.json(await service.quarantineAction(req.user!.id, req.params.id, req.body?.action, req.body?.confirmation))));
  router.post('/policy', handle(async (req, res) =>
    res.json(await service.policy(req.user!.id, req.body?.updates, req.body?.confirmation))));
  return router;
}
