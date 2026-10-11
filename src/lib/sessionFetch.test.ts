import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionFetch, type SessionUser } from './sessionFetch';
const origin='https://app.example.test';
const jwt=(sub:string, nonce=0)=>'header.'+Buffer.from(JSON.stringify({sub,nonce})).toString('base64url')+'.signature';
const auth={Authorization:'Bearer '+jwt('a')};
const user=(read:(force?:boolean)=>Promise<string>):SessionUser=>({uid:'a',getIdToken:read});
test('fresh token replaces stale React token, preserving JSON method and headers',async()=>{
 let calls=0; const f=createSessionFetch(async input=>{calls++; const req=input as Request; assert.equal(req.headers.get('authorization'),'Bearer '+jwt('a',2));assert.equal(req.headers.get('x-request-id'),'unchanged'); assert.equal(req.method,'POST');assert.equal(await req.text(),'payload');return new Response('ok');},()=>user(async()=>jwt('a',2)),origin);
 await f('/api/save',{method:'POST',headers:{...auth,'X-Request-Id':'unchanged'},body:'payload'});assert.equal(calls,1);
});
test('401 refreshes exactly once and replays FormData with identical fields',async()=>{
 const forces:unknown[]=[];const bodies:string[]=[];let calls=0;
 const f=createSessionFetch(async input=>{const req=input as Request; bodies.push(String((await req.formData()).get('label')));return new Response('',{status:++calls===1?401:200});},()=>user(async force=>{forces.push(force);return jwt('a',force?2:1);}),origin);
 const form=new FormData();form.set('label','draft');await f('/api/media',{method:'POST',headers:auth,body:form});assert.deepEqual(forces,[undefined,true]);assert.deepEqual(bodies,['draft','draft']);assert.equal(calls,2);
});
test('Request input and 401 retry retain body and never retry a second rejection',async()=>{
 let calls=0;const f=createSessionFetch(async input=>{assert.equal(await (input as Request).text(),'body');calls++;return new Response('',{status:401});},()=>user(async force=>jwt('a',force?2:1)),origin);
 const result=await f(new Request(origin+'/api/edit',{method:'PUT',body:'body',headers:auth}));assert.equal(result.status,401);assert.equal(calls,2);
});
for(const status of [403,503])test('does not replay HTTP '+status,async()=>{let calls=0;const f=createSessionFetch(async()=>{calls++;return new Response('',{status});},()=>user(async()=>jwt('a',1)),origin);assert.equal((await f('/api/edit',{headers:auth})).status,status);assert.equal(calls,1);});
test('network failure is never replayed',async()=>{let calls=0;const f=createSessionFetch(async()=>{calls++;throw Error('offline');},()=>user(async()=>jwt('a')),origin);await assert.rejects(f('/api/edit',{headers:auth}),/offline/);assert.equal(calls,1);});
test('unchanged refreshed token does not repeat request',async()=>{let calls=0;const f=createSessionFetch(async()=>{calls++;return new Response('',{status:401});},()=>user(async()=>jwt('a')),origin);await f('/api/edit',{headers:auth});assert.equal(calls,1);});
test('missing user or foreign bearer cannot write under a different account',async()=>{let calls=0;const native:typeof fetch=async()=>{calls++;return new Response('');};await assert.rejects(createSessionFetch(native,()=>null,origin)('/api/edit',{headers:auth}),/đăng nhập/);await assert.rejects(createSessionFetch(native,()=>({...user(async()=>jwt('b')),uid:'b'}),origin)('/api/edit',{headers:auth}),/Tài khoản/);assert.equal(calls,0);});
test('account switch while waiting for refresh stops replay',async()=>{let current:SessionUser|null; let calls=0;const original=user(async force=>{if(force)current=null;return jwt('a',force?2:1);});current=original;const f=createSessionFetch(async()=>{calls++;return new Response('',{status:401});},()=>current,origin);await assert.rejects(f('/api/edit',{headers:auth}),/Tài khoản/);assert.equal(calls,1);});
test('cross origin, public, and local capability requests remain unchanged',async()=>{let calls=0;const f=createSessionFetch(async(input,init)=>{calls++;assert.equal(init?.headers && new Headers(init.headers).get('Authorization'),calls<3?auth.Authorization:'Bearer local-test-auth-bypass');return new Response('');},()=>{throw Error('must not refresh');},origin);await f('https://other.example/api/edit',{headers:auth});await f('/images',{headers:auth});await f('/api/edit',{headers:{Authorization:'Bearer local-test-auth-bypass'}});assert.equal(calls,3);});
test('aborted request is not sent after token lookup',async()=>{let calls=0;const c=new AbortController();const f=createSessionFetch(async()=>{calls++;return new Response('');},()=>user(async()=>{c.abort();return jwt('a');}),origin);await assert.rejects(f('/api/edit',{headers:auth,signal:c.signal}),{name:'AbortError'});assert.equal(calls,0);});
