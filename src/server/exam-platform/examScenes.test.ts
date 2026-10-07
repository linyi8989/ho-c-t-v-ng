import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createStarterSceneRouter } from './starterSceneRouter';
import { getSceneDefinition } from '../../features/starter-scene/sceneDefinition';
import { SCENE_MODULES } from '../../features/starter-scene/types';

test('seven village catalogs preserve publication, ownership, routes and independent layouts', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-scenes-test-'));
  Object.assign(process.env, { NODE_ENV: 'test', STORAGE_MODE: 'sqlite', SQLITE_DRIVER: 'better-sqlite3', SQLITE_DB_PATH: path.join(root, 'app.sqlite'), SQLITE_ALLOW_CREATE: 'true', SQLITE_ALLOW_JSON_IMPORT: 'false' });
  const storage = await import('../../lib/sqliteStorage'); await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const collection = (moduleId: string, paper: string) => moduleId === 'mover' ? paper === 'listening' ? 'listening_sets' : 'mover_reading_sets' : 'exam_sets';
  for (const moduleId of SCENE_MODULES) for (const paper of getSceneDefinition(moduleId).papers) {
    for (let index = 1; index <= 31; index++) {
      // Same ID in both Mover collections must not cross-contaminate ownership or title.
      const id = moduleId === 'mover' ? `mover-${index}` : `${moduleId}-${paper.id}-${index}`;
      await db.collection(collection(moduleId, paper.id)).doc(id).set({ ...(moduleId === 'mover' && index === 1 ? {} : {moduleId}), paperId: paper.id, title: `${moduleId} ${paper.id} ${index}`, ownerId: index <= 25 ? 'teacher-a' : 'teacher-b', status: 'published', visibility: 'public', createdAt: `2026-10-01T00:00:${String(index).padStart(2, '0')}Z`, draftContent: { acceptedAnswers: ['PRIVATE-ANSWER'] }, shareToken: 'PRIVATE-TOKEN' });
    }
    for (const visibility of ['draft', 'assignment']) await db.collection(collection(moduleId, paper.id)).doc(`${moduleId}-${paper.id}-${visibility}`).set({moduleId, paperId: paper.id, title:'Private', ownerId:'teacher-a', status:visibility === 'draft' ? 'draft' : 'published', visibility});
  }
  const app = express(); app.use(express.json());
  const auth: express.RequestHandler = (req,res,next) => { if (!req.headers['x-role']) {res.sendStatus(401);return;} req.user={id:'teacher-a',role:String(req.headers['x-role'])} as any; next(); };
  const staff: express.RequestHandler = (req,res,next) => {if (!['teacher','super_admin'].includes(req.user?.role||'')){res.sendStatus(403);return;}next();};
  app.use('/api',createStarterSceneRouter({db,authenticateUser:auth,requireStaff:staff}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.close();await once(server,'close');await storage.closeSQLiteStorage();});
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const call=async(route:string,role?:string,body?:unknown)=>{const response=await fetch(base+route,{method:body===undefined?'GET':'PUT',headers:{...(role?{'X-Role':role}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,data:await response.json().catch(()=>null)};};
  const before=await Promise.all(['exam_sets','listening_sets','mover_reading_sets'].map(async name=>({name,data:(await db.collection(name).get()).docs.map((d:any)=>d.data())})));

  await t.test('all seven catalogs expose correct papers and sanitized canonical exam links without writes',async()=>{
    for(const moduleId of SCENE_MODULES){const definition=getSceneDefinition(moduleId),result=await call('/scenes/'+moduleId);assert.equal(result.status,200);assert.deepEqual(Object.keys(result.data.papers).sort(),definition.papers.map(p=>p.id).sort());
      for(const paper of definition.papers){const links=result.data.papers[paper.id].links;assert.equal(links.length,31);assert.equal(result.data.papers[paper.id].configured,false);assert.equal(links[0].title,`${moduleId} ${paper.id} 1`);assert(links.every((link:any)=>link.href.startsWith(`/exams/${moduleId}/${paper.id}/`)));assert.deepEqual(Object.keys(links[0]).sort(),['href','id','title']);}
      assert(!JSON.stringify(result.data).includes('PRIVATE'));
    }
    assert.equal((await db.collection('settings').get()).docs.length,0);
    assert.deepEqual((await call('/starter-scene')).data,(await call('/scenes/starter')).data);
  });
  await t.test('wood navigation follows the level chain and three-yard pages match manifest skills',()=>{
    SCENE_MODULES.forEach((id,index)=>{const scene=getSceneDefinition(id);assert.equal(scene.previous,SCENE_MODULES[index-1]);assert.equal(scene.next,SCENE_MODULES[index+1]);assert.equal(scene.papers[0].id,'listening');assert.equal(scene.threeYards,['pet','fce','ielts'].includes(id));});
  });
  await t.test('staff validation rejects invalid modules, papers, private and cross-level selections',async()=>{
    assert.equal((await call('/scenes/writing')).status,404);assert.equal((await call('/scenes/unknown')).status,404);
    assert.equal((await call('/admin/scenes/pet/reading')).status,401);assert.equal((await call('/admin/scenes/pet/reading','student')).status,403);
    assert.equal((await call('/admin/scenes/ket/writing','super_admin')).status,404);
    for(const setId of ['fce-reading-1','pet-writing-1','pet-reading-draft','pet-reading-assignment','https://evil.test'])assert.equal((await call('/admin/scenes/pet/reading','super_admin',{baseRevision:0,entries:[{id:'new',setId}]})).status,400);
  });
  await t.test('dynamic reorder and independent revisions work for every paper, including legacy Movers',async()=>{
    for(const moduleId of SCENE_MODULES) for(const paper of getSceneDefinition(moduleId).papers){
      const route=`/admin/scenes/${moduleId}/${paper.id}`,editor=(await call(route,'super_admin')).data;
      const entries=editor.entries.map(({id,setId}:any)=>({id,setId}));
      assert.equal((await call(route,'teacher',{baseRevision:0,entries:entries.filter((_:any,index:number)=>index!==30)})).status,403);
      const changed=entries.slice(0,25).reverse();const saved=await call(route,'super_admin',{baseRevision:0,entries:changed});assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
      const links=(await call('/scenes/'+moduleId)).data.papers[paper.id].links;assert.equal(links.length,25);assert.equal(links[0].title,`${moduleId} ${paper.id} 25`);
      assert.equal((await call(route,'super_admin',{baseRevision:0,entries})).status,409);
      assert.equal((await call(route,'super_admin',{baseRevision:1,entries})).status,200);
    }
    for(const snapshot of before)assert.deepEqual((await db.collection(snapshot.name).get()).docs.map((d:any)=>d.data()),snapshot.data,'No exam rewrites');
  });
  await t.test('configured empty and hidden/deleted sets stay isolated and survive native reopen',async()=>{
    const editor=(await call('/admin/scenes/pet/reading','super_admin')).data;
    const entries=editor.entries.map(({id,setId}:any)=>({id,setId}));
    const raced=await Promise.all([call('/admin/scenes/pet/reading','super_admin',{baseRevision:2,entries:[]}),call('/admin/scenes/pet/reading','super_admin',{baseRevision:2,entries})]);assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
    await db.collection('exam_sets').doc('fce-writing-3').update({status:'archived'});
    await db.collection('exam_sets').doc('ielts-academic-reading-2').delete();
    await storage.closeSQLiteStorage();await storage.initializeSQLiteStorage();
    assert.equal((await call('/scenes/pet')).data.papers.reading.links.length,0);
    assert.equal((await call('/scenes/pet')).data.papers.writing.links.length,31);
    assert.equal((await call('/scenes/fce')).data.papers.writing.links.length,30);
    assert.equal((await call('/scenes/ielts')).data.papers['academic-reading'].links.length,30);
    assert.equal((await db.collection('settings').doc('starter-scene-listening-v1').get()).data().value.revision,2);
  });
});
