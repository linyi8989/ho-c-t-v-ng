import{c as i,j as e}from"./index-Dli7GSoz.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],p=i("copy",u);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",key:"10ikf1"}]],y=i("play",x);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],k=i("plus",h);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]],v=i("send",g);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],j=i("trash-2",f),a="rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";function N({onPlay:o,onEdit:r,onClone:n,onResults:s,onDelete:l,playDisabled:c=!1,disabled:t=!1,playTitle:d="Play",deleteTitle:b="Xóa"}){return e.jsxs("div",{className:"flex flex-wrap gap-1.5","data-library-row-actions":!0,children:[e.jsxs("button",{type:"button","data-library-action":"play",onClick:o,disabled:t||c,title:d,className:`inline-flex items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ${a}`,children:[e.jsx(y,{size:13}),"Play"]}),e.jsx("button",{type:"button","data-library-action":"edit",onClick:r,disabled:t,className:`border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 ${a}`,children:"Sửa"}),e.jsx("button",{type:"button","data-library-action":"clone",onClick:n,disabled:t,className:`border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 ${a}`,children:"Sao chép"}),e.jsx("button",{type:"button","data-library-action":"results",onClick:s,disabled:t,className:`border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 ${a}`,children:"Kết quả"}),e.jsx("button",{type:"button","data-library-action":"delete",onClick:l,disabled:t,title:b,className:`border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 ${a}`,children:"Xóa"})]})}function C({visibility:o,privateUrl:r,onCopyPrivateLink:n}){return o==="assignment"?!r||!n?e.jsx("span",{className:"text-xs font-semibold text-slate-400",children:"Chưa có link"}):e.jsxs("button",{type:"button","data-library-link":"private",onClick:()=>void n(),className:"inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",title:"Copy link riêng",children:[e.jsx(p,{size:13}),"Link riêng"]}):o==="public"?e.jsx("span",{"data-library-link":"public",className:"inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700",children:"Công khai"}):e.jsx("span",{"data-library-link":"draft",className:"text-xs font-semibold text-slate-400",children:"Chưa xuất bản"})}export{p as C,C as L,k as P,v as S,j as T,y as a,N as b};
