import{c as n,j as e}from"./index-bbuP6LaM.js";import{P as p}from"./search-D4IVvO9I.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["path",{d:"M11 14h10",key:"1w8e9d"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v1.344",key:"1e62lh"}],["path",{d:"m17 18 4-4-4-4",key:"z2g111"}],["path",{d:"M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113",key:"bjbb7m"}],["rect",{x:"8",y:"2",width:"8",height:"4",rx:"1",key:"ublpy"}]],N=n("clipboard-paste",u);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],y=n("copy",h);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],M=n("plus",x);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]],_=n("send",g);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],C=n("trash-2",f);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]],$=n("upload",m),r="rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";function k({href:t,disabled:o=!1,title:a="Play"}){const s=`inline-flex items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ${r}`,l=e.jsxs(e.Fragment,{children:[e.jsx(p,{size:13,"aria-hidden":"true"}),"Play"]});return o||!t?e.jsx("button",{type:"button","data-library-action":"play",disabled:!0,title:a,className:s,children:l}):e.jsx("a",{"data-library-action":"play",href:t,target:"_blank",rel:"noopener noreferrer",title:a,className:s,children:l})}function w({playHref:t,onEdit:o,onClone:a,onResults:s,onDelete:l,playDisabled:c=!1,disabled:i=!1,playTitle:d="Play",deleteTitle:b="Xóa"}){return e.jsxs("div",{className:"flex flex-wrap gap-1.5","data-library-row-actions":!0,children:[e.jsx(k,{href:t,disabled:i||c,title:d}),e.jsx("button",{type:"button","data-library-action":"edit",onClick:o,disabled:i,className:`border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 ${r}`,children:"Sửa"}),e.jsx("button",{type:"button","data-library-action":"clone",onClick:a,disabled:i,className:`border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 ${r}`,children:"Sao chép"}),e.jsx("button",{type:"button","data-library-action":"results",onClick:s,disabled:i,className:`border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 ${r}`,children:"Kết quả"}),e.jsx("button",{type:"button","data-library-action":"delete",onClick:l,disabled:i,title:b,className:`border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 ${r}`,children:"Xóa"})]})}function P({visibility:t,privateUrl:o,onCopyPrivateLink:a}){return t==="assignment"?!o||!a?e.jsx("span",{className:"text-xs font-semibold text-slate-400",children:"Chưa có link"}):e.jsxs("button",{type:"button","data-library-link":"private",onClick:()=>void a(),className:"inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",title:"Copy link riêng",children:[e.jsx(y,{size:13}),"Link riêng"]}):t==="public"?e.jsx("span",{"data-library-link":"public",className:"inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700",children:"Công khai"}):e.jsx("span",{"data-library-link":"draft",className:"text-xs font-semibold text-slate-400",children:"Chưa xuất bản"})}export{N as C,k as L,M as P,_ as S,C as T,$ as U,y as a,P as b,w as c};
