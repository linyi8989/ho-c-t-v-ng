// Use computed colors after the full cascade. Gradient endpoints are checked
// separately so a solid fallback cannot conceal unreadable raised controls.
export function controlMetricsExpression(selector) {
  return `(() => {
    const root = document.querySelector(${JSON.stringify(selector)});
    const rgb = s => s.match(/[\\d.]+/g).slice(0,3).map(Number);
    const lum = c => c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,
      controls:[...root.querySelectorAll('button,input:not([type=file]):not([type=checkbox]),select,textarea')].filter(el=>el.getBoundingClientRect().width>0).map(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect(),a=lum(rgb(s.color));
        const colors=s.backgroundImage.match(/rgba?\\([^)]+\\)/g)||[s.backgroundColor];
        const contrast=Math.min(...colors.map(color=>{const b=lum(rgb(color));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}));
        return {text:el.textContent.trim().slice(0,55),disabled:el.disabled,selected:el.getAttribute('aria-pressed'),fg:s.color,bg:s.backgroundColor,image:s.backgroundImage,opacity:s.opacity,contrast,outline:s.outlineStyle,height:r.height};
      })};
  })()`;
}

export async function exerciseStudentModuleTheme({ evaluate, cdp, root, assert }) {
  await evaluate('document.fonts.ready');
  const layout = await evaluate(`(() => {
    const root=document.querySelector(${JSON.stringify(root)}),s=getComputedStyle(root),panel=root.querySelector('.student-module-panel');
    return {theme:root.dataset.studentModuleTheme,font:s.fontFamily,background:getComputedStyle(root,'::before').backgroundImage,panel:getComputedStyle(panel).borderRadius,header:!!root.querySelector('.student-module-heading h1'),headerBackground:getComputedStyle(root.querySelector('.student-module-header')).backgroundColor};
  })()`);
  assert(layout.theme==='storybook'&&layout.font.includes('Nunito')&&layout.background.includes('bg-starter-exam-v1.webp')&&layout.header&&parseFloat(layout.panel)>=26,'Student module uses the approved illustration, font and frame: '+root);
  assert(layout.headerBackground==='rgba(0, 0, 0, 0)','The illustrated sky remains visible behind the student header');
  const metrics=await evaluate(controlMetricsExpression(root));
  assert(!metrics.overflow&&metrics.controls.every(c=>c.height>=44&&c.contrast>=4.5),'Student controls fit and meet size/contrast contracts: '+root);
  // Exercise mouse hover on desktop with an explicit motion preference, then
  // verify reduced motion separately (the host OS may already enable it).
  const height=await evaluate('innerHeight');
  if(metrics.width<900) await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height,deviceScaleFactor:1,mobile:false});
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  const point=await evaluate(`(() => {const b=document.querySelector(${JSON.stringify(root+' button:not(:disabled)')});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
  await new Promise(resolve=>setTimeout(resolve,200));
  const hover=await evaluate(`(() => {const b=document.querySelector(${JSON.stringify(root+' button:not(:disabled)')}),s=getComputedStyle(b);return {hover:b.matches(':hover'),transform:s.transform,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,pointElement:document.elementFromPoint(${point.x},${point.y})?.outerHTML.slice(0,200),rect:b.getBoundingClientRect().toJSON()}})()`);
  assert(hover.transform!=='none','Hover gently raises the student control: '+JSON.stringify(hover));
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
  await evaluate(`document.querySelector(${JSON.stringify(root+' button:not(:disabled)')}).focus()`);
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert(await evaluate("getComputedStyle(document.activeElement).outlineStyle==='solid'&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=3"),'Student keyboard focus remains visible');
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const reduced=await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(root+' button')})).transitionDuration`);
  assert(reduced==='0s','Reduced motion removes student control transitions');
  await cdp.send('Emulation.setEmulatedMedia',{features:[]});
  if(metrics.width<900) await cdp.send('Emulation.setDeviceMetricsOverride',{width:metrics.width,height,deviceScaleFactor:1,mobile:true});
  return {layout,hover:true,keyboardFocus:true,reducedMotion:true,minContrast:Math.min(...metrics.controls.map(c=>c.contrast)),minHeight:Math.min(...metrics.controls.map(c=>c.height))};
}
