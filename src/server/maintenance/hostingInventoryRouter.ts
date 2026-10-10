import express from 'express';
import { MaintenanceError } from '../../../scripts/maintenance-core.mjs';
import {linkApplicationCatalog} from '../../../scripts/hosting-inventory-assessment.mjs';
import type {createMaintenance} from '../../../scripts/maintenance-core.mjs';
import type { createHostingInventory } from '../../../scripts/hosting-inventory-core.mjs';
// Mounted only after maintenance authentication + super_admin authorization.
export function createHostingInventoryRouter(service: ReturnType<typeof createHostingInventory>, application?:ReturnType<typeof createMaintenance>) {
  const router=express.Router();
  const decorate=async<T extends {items?:unknown[];entry?:unknown}|null>(result:T,actor:string):Promise<T>=>{
    if(!result||!application)return result;
    const summary=await application.summary(actor),root=service.summary().root;
    if(result.items)result.items=result.items.map(entry=>linkApplicationCatalog(entry,root,summary));
    if(result.entry)result.entry=linkApplicationCatalog(result.entry,root,summary);
    return result;
  };
  const handle=(action:(req:express.Request,res:express.Response)=>unknown):express.RequestHandler=>(req,res)=>{
    void Promise.resolve().then(()=>action(req,res)).catch(error=>res.status(error instanceof MaintenanceError?error.status:503).json({error:error instanceof MaintenanceError?error.message:'Không đọc được chỉ mục/nguồn inventory. Báo cáo trước được giữ.'}));
  };
  router.get('/summary',handle((_req,res)=>res.json(service.summary())));
  router.post('/scan',handle((req,res)=>res.status(202).json(service.start(req.user!.id))));
  router.post('/scans/:id/control',handle((req,res)=>res.status(202).json(service.control(req.user!.id,req.params.id,req.body?.action))));
  router.get('/scans/:id/tree',handle(async(req,res)=>res.json(await decorate(service.tree(req.params.id,typeof req.query.parent==='string'?req.query.parent:'',req.query),req.user!.id))));
  router.get('/scans/:id/entries/:entry/evidence',handle(async(req,res)=>res.json(await decorate(service.evidence(req.params.id,req.params.entry,req.query),req.user!.id))));
  router.post('/scans/:id/entries/:entry/reverify',handle(async(req,res)=>res.json(await service.reverify(req.user!.id,req.params.id,req.params.entry))));
  router.get('/scans/:id/backups',handle(async(req,res)=>res.json(await decorate(service.backups(req.params.id,req.query),req.user!.id))));
  router.get('/scans/:id/deltas',handle((req,res)=>res.json(service.deltas(req.params.id,req.query))));
  return router;
}