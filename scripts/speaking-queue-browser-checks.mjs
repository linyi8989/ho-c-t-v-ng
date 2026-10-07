import assert from 'node:assert/strict';
// Delayed-provider responses in the isolated browser fixture only. Native tests
// separately exercise acceptance, restart, leases, idempotency and history storage.
export async function exerciseSpeakingQueue({evaluate,wait,click,partialSet,shot}) {
 await evaluate(`(async()=>{
   window.qaQueueFetch=window.fetch;window.qaQueueStage='waiting';window.qaQueuePolls=0;
   const r=await window.fetch('/api/speaking/sessions/${partialSet.sessionId}',{headers:{Authorization:'Bearer local-test-auth-bypass'}}),session=await r.json();
   const child=session.items[1].attempt;session.items[1].attempt={...child,status:'queued',queueState:'waiting',assessment:null,feedbackState:'disabled'};
   window.fetch=async(input,init)=>{const url=String(input);
     if(url.includes('/api/speaking/sessions/latest?')&&url.includes('${partialSet.id}')||url.endsWith('/api/speaking/sessions/${partialSet.sessionId}')){
       window.qaQueuePolls++;const next=structuredClone(session);
       if(window.qaQueueStage==='done'){next.items[1].attempt={...child,status:'completed',assessment:session.items[0].attempt.assessment};next.items[1].score=88;next.completedCount=2;}
       return new Response(JSON.stringify(next),{headers:{'Content-Type':'application/json'}});
     }
     if(url.endsWith('/api/speaking/attempts/'+child.id))return new Response(JSON.stringify(session.items[1].attempt),{headers:{'Content-Type':'application/json'}});
     return window.qaQueueFetch(input,init);
   };
 })()`);
 await click('Danh sách bài','#speaking-student');await wait("!document.querySelector('.speaking-reference')");
 await evaluate(`history.pushState({},'', '/speaking/lesson/${partialSet.id}');window.dispatchEvent(new PopStateEvent('popstate'))`);
 await wait("document.querySelector('.speaking-reference')?.textContent==='car'&&document.body.innerText.includes('Đã lưu bản thu vào kho chờ')");
 assert(await evaluate("![...document.querySelectorAll('#speaking-student button')].find(b=>b.textContent==='Mục tiếp theo').disabled"));
 await click('Mục tiếp theo','#speaking-student');await wait("document.querySelector('.speaking-reference')?.textContent==='boat'");
 const before=await evaluate('window.qaQueuePolls');await evaluate("window.qaQueueStage='done'");
 await wait("document.body.innerText.includes('Đã chấm 2/3 mục')");
 assert(await evaluate('window.qaQueuePolls')>before,'Session polling continues after leaving the queued card');
 assert(await evaluate("document.querySelector('.speaking-reference').textContent==='boat'"),'Completion never switches the active reading card');
 const screenshot=await shot('speaking-queue-background');await click('Mục trước','#speaking-student');await wait("document.querySelector('.speaking-turn .speaking-score')?.textContent==='88/100'");
 await evaluate('window.fetch=window.qaQueueFetch');return {backgroundCompletion:true,continueReading:true,scorePreserved:true,screenshot};
}
