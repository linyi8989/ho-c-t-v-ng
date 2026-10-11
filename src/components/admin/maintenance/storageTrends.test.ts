import test from 'node:test';
import assert from 'node:assert/strict';
import {isCleanupFile,pointChange,applicationFolderTrends} from './storageTrends';
import type {MaintenanceFile,MaintenanceSummary} from '../../../shared/maintenance';
const file=(kind:string,status:string)=>({kind,status} as MaintenanceFile);
test('cleanup view keeps only actionable recordings and suspected/held media',()=>{
 for(const status of ['eligible','blocked','unknown','held'])assert.equal(isCleanupFile(file('speaking',status)),true);
 for(const status of ['suspected','held'])assert.equal(isCleanupFile(file('media',status)),true);
 for(const [kind,status] of [['speaking','used'],['speaking','protected'],['media','used'],['media','unknown'],['asset','eligible'],['temporary','eligible'],['backup','review'],['other','protected']])assert.equal(isCleanupFile(file(kind,status)),false);
});
test('trend change uses complete measurements and does not turn partial/missing into zero',()=>{
 assert.equal(pointChange([{at:'1',bytes:20,complete:true},{at:'2',bytes:999,complete:false},{at:'3',bytes:5,complete:true}]),-15);
 assert.equal(pointChange([{at:'1',bytes:20,complete:true},{at:'2',bytes:null,complete:false}]),null);
 assert.equal(pointChange([{at:'1',bytes:20,complete:true}]),null);
 assert.equal(pointChange([{at:'1',bytes:20,complete:true},{at:'2',bytes:0,complete:true}]),-20);
});
test('application charts expose paths/purpose, replace same-day point and tolerate legacy snapshots',()=>{
 const data={roots:[{id:'assets-client',root:'/app/dist/client/assets',label:'Asset frontend (Node)'},{id:'account',root:'/home/test',label:'Account'}],snapshots:[{at:'2026-10-08T10:00:00Z',complete:true,bytes:999},{at:'2026-10-09T10:00:00Z',complete:true,bytes:30,groups:{'assets-client':30}},{at:'2026-10-10T10:00:00Z',complete:true,bytes:15,groups:{'assets-client':15}}],latest:{at:'2026-10-10T11:00:00Z',complete:true,groups:[{id:'assets-client',bytes:10}],issues:[]}} as unknown as MaintenanceSummary;
 const rows=applicationFolderTrends(data);assert.equal(rows.length,1);assert.equal(rows[0].path,'/app/dist/client/assets');assert.match(rows[0].purpose,/frontend/);assert.equal(rows[0].samples.length,2);assert.equal(rows[0].change,-20);assert.equal(rows[0].bytes,10);
 data.latest!.complete=false;assert.equal(applicationFolderTrends(data)[0].change,null);assert.equal(applicationFolderTrends(data)[0].bytes,null);
 data.latest!.complete=true;data.latest!.issues=[{root:'assets-client',status:'missing'}];assert.equal(applicationFolderTrends(data)[0].bytes,null);
});
