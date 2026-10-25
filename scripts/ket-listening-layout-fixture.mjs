import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';

// Isolated UI fixture for browser-tool QA; no database or user API writes.
const evidence = path.resolve('.data/ket-listening-layout-repair-qa');
fs.mkdirSync(evidence, { recursive: true });
const output = path.join(evidence, 'fixture.js');
await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';
import{AuthoringOwner,AuthoringDocumentScope}from'./src/lib/authoring/DocumentScope';
import{UniversalPartImportPanel,UniversalWholeImportPanel}from'./src/features/exam-platform/admin/UniversalAuthoring';
import KetListeningAuthoring from'./src/features/exam-platform/admin/KetListeningAuthoring';
import KetListeningPartView from'./src/features/exam-platform/student/KetListeningViews';
import{createDefaultExamContent,getExamPaperDefinition}from'./src/features/exam-platform/definitions';
import{importUniversalExamPart}from'./src/features/exam-platform/universalImport';
import{listeningApi}from'./src/features/listening/api';
import sample from'./docs/examples/ket-listening-part1-sports-centre.json';
const definition=getExamPaperDefinition('ket','listening');
function initial(){const c=createDefaultExamContent(definition);c.parts[0]=importUniversalExamPart(c,0,JSON.stringify(sample)).part;c.parts[0].imageAssetId='source';c.parts[0].imageUrl='/source.svg';return c;}
const sourceAsset={id:'source',kind:'image',status:'active',mimeType:'image/png',url:'/source.svg',originalName:'Two-page test source',size:1000};
function Fixture(){const[content,setContent]=useState(initial),[assets,setAssets]=useState([sourceAsset]),[mode,setMode]=useState(new URLSearchParams(location.search).get('mode')||'author'),[message,setMessage]=useState({text:''}),[answers,setAnswers]=useState({}),[uploads,setUploads]=useState([]),[slow,setSlow]=useState(false),[fail,setFail]=useState(false);
useEffect(()=>{const report=()=>{if(window.parent===window)return;const width=document.documentElement.clientWidth;window.parent.postMessage({fixtureMetrics:true,width,documentWidth:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('select,button,input,textarea')].filter(e=>e.getBoundingClientRect().right>width+1).slice(0,4).map(e=>({tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent.slice(0,60),right:e.getBoundingClientRect().right}))},location.origin);};document.fonts.ready.then(report);},[content,mode,message,uploads]);
listeningApi.uploadAsset=async(token,file,kind,metadata)=>{setUploads(rows=>[...rows,{name:file.name,type:file.type,size:file.size,crop:metadata?.crop}]);if(slow)await new Promise(r=>setTimeout(r,1000));if(fail)throw Error('Fixture upload failure');return{id:'crop-'+crypto.randomUUID(),kind:'image',status:'active',mimeType:'image/png',url:URL.createObjectURL(file),originalName:file.name,size:file.size};};
const update=part=>setContent(c=>({...c,parts:c.parts.map((p,i)=>i===0?part:p)}));
const source=url=>update({...content.parts[0],imageAssetId:'source',imageUrl:url});
return <AuthoringOwner value="isolated-layout-fixture"><AuthoringDocumentScope value="isolated-layout-fixture"><main id="generic-exam-editor" style={{maxWidth:1100,margin:'auto',padding:16}}>
<nav className="flex flex-wrap gap-2 mb-4">{[['author','Soạn bài'],['student','Học sinh'],['whole','Nhập đề tổng']].map(([id,label])=><button key={id} onClick={()=>setMode(id)}>{label}</button>)}<button onClick={()=>{setContent(initial());setUploads([]);setAnswers({});setMessage({text:''});}}>Khôi phục fixture</button><button onClick={()=>source('/source.svg')}>Ảnh mô phỏng</button><button onClick={()=>source('/actual-source.png')}>Ảnh đề bạn gửi</button><button onClick={()=>update({...content.parts[0],imageAssetId:undefined,imageUrl:undefined})}>Xóa ảnh nguồn</button><label><input type="checkbox" checked={slow} onChange={e=>setSlow(e.target.checked)}/>Chậm upload</label><label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/>Lỗi upload</label></nav>
<p role={message.error?'alert':'status'} data-qa-message>{message.text}</p>
<details><summary>Dữ liệu kiểm thử</summary><pre data-qa-valid>{JSON.stringify(sample)}</pre><pre data-qa-state>{JSON.stringify({layouts:content.parts[0].questions.map(q=>q.imageLayout),media:content.parts[0].questions.map(q=>({common:q.imageAssetId,options:q.options.map(o=>o.imageAssetId)})),prompts:content.parts[0].questions.map(q=>q.prompt),uploads,answers})}</pre></details>
{mode==='author'?<><UniversalPartImportPanel content={content} definition={definition} partIndex={0} onChange={update} onMessage={setMessage}/><KetListeningAuthoring part={content.parts[0]} token="fixture" assets={assets} onAssets={a=>setAssets(rows=>rows.some(x=>x.id===a.id)?rows:[...rows,a])} onChange={update}/></>:mode==='whole'?<UniversalWholeImportPanel content={content} definition={definition} onChange={setContent} onImported={()=>{}} onMessage={setMessage}/>:<KetListeningPartView part={content.parts[0]} answers={answers} onAnswer={(id,value)=>setAnswers(a=>({...a,[id]:value}))}/>}
</main></AuthoringDocumentScope></AuthoringOwner>;}
createRoot(document.getElementById('fixture')).render(<Fixture/>);
` }, outfile: output, bundle: true, format: 'esm', jsx: 'automatic', logLevel: 'silent' });
const frames = [];
const row = (x, y, count, wide = false) => { for (let i = 0; i < count; i++) frames.push(`<rect x="${x + i * 140}" y="${y}" width="${wide ? 400 : 100}" height="${wide ? 140 : 80}" fill="white" stroke="black" stroke-width="3"/>`); };
row(40, 80, 3); // unscored example on left page
row(40, 350, 1, true); row(40, 820, 3); // Q1/Q2, left page
row(540, 190, 3); row(540, 510, 3); row(540, 680, 3); // Q3/Q4/Q5, right page
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="white"/>${frames.join('')}</svg>`;
const actual = 'C:/Users/Admin/AppData/Local/Temp/codex-clipboard-96fe41f1-af8c-4bcc-b4c6-a8d8db42b843.png';
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/mobile/')) { const student = req.url.includes('student'), width = req.url.includes('320') ? 320 : 390; res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><html><body style="margin:0;background:#f1f5f9"><iframe title="Mobile ${width}" src="/?mode=${student ? 'student' : 'author'}" style="display:block;margin:auto;width:${width}px;height:950px;border:0;background:white"></iframe><pre data-qa-mobile-metrics style="white-space:pre-wrap"></pre><script>addEventListener('message',e=>{if(e.origin===location.origin&&e.source===document.querySelector('iframe').contentWindow&&e.data.fixtureMetrics)document.querySelector('[data-qa-mobile-metrics]').textContent=JSON.stringify(e.data);});</script></body></html>`); }
  else if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(output)); }
  else if (req.url === '/style.css') { const css = fs.readdirSync('dist/client/assets').find(name => /^index-.*\.css$/.test(name)); res.setHeader('Content-Type', 'text/css'); res.end(fs.readFileSync(path.join('dist/client/assets', css))); }
  else if (req.url === '/actual-source.png') { res.setHeader('Content-Type', 'image/png'); res.end(fs.readFileSync(actual)); }
  else if (req.url === '/source.svg' || req.url === '/picture.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end(svg); }
  else if (req.url.startsWith('/api/')) { res.writeHead(500).end('User API writes are disabled in the isolated fixture'); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="fixture"></div><script type="module" src="/fixture.js"></script></body></html>'); }
});
server.listen(Number(process.env.KET_LAYOUT_FIXTURE_PORT || 3191), '127.0.0.1', () => console.log('Isolated layout fixture ready on loopback port ' + server.address().port));
