import express from 'express';
import {once} from 'node:events';
import { MaintenanceError } from '../../../scripts/maintenance-core.mjs';
import {linkApplicationCatalog,indexApplicationCatalog} from '../../../scripts/hosting-inventory-assessment.mjs';
import type {createMaintenance} from '../../../scripts/maintenance-core.mjs';
import type { createHostingInventory } from '../../../scripts/hosting-inventory-core.mjs';
// Mounted only after maintenance authentication + super_admin authorization.
export function createHostingInventoryRouter(service: ReturnType<typeof createHostingInventory>, application?:ReturnType<typeof createMaintenance>) {
  const router=express.Router();
  const decorate=async<T extends {items?:unknown[];entry?:unknown}|null>(result:T,actor:string):Promise<T>=>{
    if(!result||!application)return result;
    const summary=await application.summary(actor),root=service.summary().root,index=indexApplicationCatalog(summary);
    if(result.items)result.items=result.items.map(entry=>linkApplicationCatalog(entry,root,summary,index));
    if(result.entry)result.entry=linkApplicationCatalog(result.entry,root,summary,index);
    return result;
  };
  const handle=(action:(req:express.Request,res:express.Response)=>unknown):express.RequestHandler=>(req,res)=>{
    void Promise.resolve().then(()=>action(req,res)).catch(error=>{if(res.headersSent){res.destroy();return;}res.status(error instanceof MaintenanceError?error.status:503).json({error:error instanceof MaintenanceError?error.message:'Không đọc được chỉ mục/nguồn inventory. Báo cáo trước được giữ.'});});
  };
  router.get('/trends',handle((_req,res)=>res.json(service.trends())));
  router.get('/summary',handle((_req,res)=>res.json(service.summary())));
  router.post('/scan',handle((req,res)=>res.status(202).json(service.start(req.user!.id))));
  router.post('/scans/:id/control',handle((req,res)=>res.status(202).json(service.control(req.user!.id,req.params.id,req.body?.action))));
  router.get('/scans/:id/report',handle(async(req,res)=>{
    const controller=new AbortController(),abort=()=>controller.abort();
    res.once('close',abort);const timeout=setTimeout(abort,65000);
    try {
      const applicationSummary=application?await application.summary(req.user!.id):null;
      const root=service.summary().root,index=indexApplicationCatalog(applicationSummary);
      await service.report(req.params.id,async(chunk:string)=>{
        controller.signal.throwIfAborted();
        if(!res.headersSent){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="hosting-report-'+req.params.id+'.json"');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');}
        if(!res.write(chunk))await once(res,'drain',{signal:controller.signal});
      },entry=>linkApplicationCatalog(entry,root,applicationSummary,index),applicationSummary?.latest||null,{signal:controller.signal});
      res.end();
    } finally {clearTimeout(timeout);res.off('close',abort);}
  }));
  router.get('/scans/:id/tree',handle(async(req,res)=>res.json(await decorate(service.tree(req.params.id,typeof req.query.parent==='string'?req.query.parent:'',req.query),req.user!.id))));
  router.get('/scans/:id/entries/:entry/evidence',handle(async(req,res)=>res.json(await decorate(service.evidence(req.params.id,req.params.entry,req.query),req.user!.id))));
  router.post('/scans/:id/entries/:entry/reverify',handle(async(req,res)=>res.json(await service.reverify(req.user!.id,req.params.id,req.params.entry))));
  router.get('/scans/:id/backups',handle(async(req,res)=>res.json(await decorate(service.backups(req.params.id,req.query),req.user!.id))));
  router.get('/scans/:id/deltas',handle((req,res)=>res.json(service.deltas(req.params.id,req.query))));
  return router;
}