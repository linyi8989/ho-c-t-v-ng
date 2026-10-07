import assert from 'node:assert/strict';

export async function verifyStarterPlayer({ cdp, evaluate, wait, click, goto, shot, viewport, reports, screenshots }) {
  const root = '#listening-exam-root[data-exam-theme=starter]';
  const key = async (name, code = name, virtual = 0) => {
    for (const type of ['keyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: name, code, windowsVirtualKeyCode: virtual });
  };
  const theme = () => evaluate(`(()=>{const root=document.querySelector('[data-exam-theme=starter]'),panel=root.querySelector('[data-starter-exam-panel]'),s=getComputedStyle(panel),buttons=[...root.querySelectorAll('.student-exam-part-tab,.student-exam-part-nav,.student-exam-submit-action,.starter-audio-play')],lum=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0),contrast=buttons.map(e=>{const s=getComputedStyle(e),f=lum(s.color.match(/[0-9.]+/g).slice(0,3).map(Number)),colors=s.backgroundImage.match(/rgb\([^)]+\)/g)||[s.backgroundColor];return Math.min(...colors.map(c=>{const b=lum(c.match(/[0-9.]+/g).slice(0,3).map(Number));return (Math.max(f,b)+.05)/(Math.min(f,b)+.05);}));});return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,background:getComputedStyle(root,'::before').backgroundImage.includes('bg-starter-exam-v1.webp'),cream:s.borderTopColor==='rgb(255, 250, 241)',round:parseFloat(s.borderRadius),minimumContrast:Math.min(...contrast),touch:buttons.every(b=>b.getBoundingClientRect().height>=44),parts:root.querySelectorAll('[role=tab]').length};})()`);
  const tap = async selector => {
    const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    for (const type of ['mousePressed','mouseReleased']) await cdp.send('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});
  };
  const journey = async (label) => {
    for (const width of [1440,390,320]) {
      await viewport(width);
      const state=await evaluate(`(()=>{const r=document.querySelector('[data-student-journey]'),p=r.firstElementChild,s=getComputedStyle(p);return {background:getComputedStyle(r,'::before').backgroundImage.includes('bg-starter-exam-v1.webp'),round:parseFloat(s.borderRadius),overflow:document.documentElement.scrollWidth>innerWidth+1,touch:[...r.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width>0).every(e=>e.getBoundingClientRect().height>=44)};})()`);
      assert(state.background&&state.round>=24&&!state.overflow&&state.touch, label+' '+JSON.stringify(state));reports[label+width]=state;screenshots[label+width]=await shot(label+'-'+width);
    }
    await viewport(1440);
  };
  await journey('starterTransition');
  await viewport(1440);
  await click('Bắt đầu', '#generic-exam-player');
  await wait(`document.querySelector('${root}')`);
  await wait("document.querySelector('[data-starter-audio] audio')?.duration===5");
  await evaluate('document.fonts.ready.then(()=>true)');
  screenshots.starterPlayerInitial=await shot('starter-player-initial');
  const pressAudio = async () => evaluate("document.querySelector('.starter-audio-play').click()");
  await pressAudio(); await wait("document.querySelector('[data-starter-audio] audio').currentTime>.1&&!document.querySelector('[data-starter-audio] audio').paused");
  await pressAudio(); await wait("document.querySelector('[data-starter-audio] audio').paused");
  const beforeSeek = await evaluate("document.querySelector('[data-starter-audio] audio').currentTime");
  await evaluate("document.querySelector('.starter-audio-seek').focus()");await key('ArrowRight', 'ArrowRight', 39);
  assert((await evaluate("document.querySelector('[data-starter-audio] audio').currentTime")) > beforeSeek, 'Keyboard seek advances the real clip');
  await evaluate("document.querySelector('.starter-audio-mute').click()");
  assert(await evaluate("document.querySelector('[data-starter-audio] audio').muted"), 'Mute updates the real media element');
  // Muted volume is displayed at zero; ArrowRight must increase it and unmute.
  await wait("document.querySelector('.starter-audio-volume').value==='0'");
  await evaluate("document.querySelector('.starter-audio-volume').focus()");await key('ArrowRight', 'ArrowRight', 39);
  await wait("document.querySelector('[data-starter-audio] audio').volume<1&&!document.querySelector('[data-starter-audio] audio').muted");
  reports.starterAudio = { play: true, pause: true, keyboardSeek: true, mute: true, volume: true };
  await wait("document.querySelector('[data-exam-image-content-ready=true]')");
  assert(await evaluate("[...document.querySelectorAll('.starter-matching-node-hitbox')].every(b=>{const s=getComputedStyle(b);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.backdropFilter==='none'&&s.filter==='none';})"), 'The decorated frame does not style answer hitboxes');
  await tap('[data-starter-action=select-matching-source]');await wait("document.querySelector('[data-starter-action=select-matching-source][data-selected=true]')");
  await tap('[data-starter-action=select-matching-target][data-eligible=true]');
  await wait("document.querySelector('.student-exam-shell-progress')?.textContent==='1/20'");
  reports.starterMatching = { hitboxesTransparent: true, answerCount: true };
  await evaluate("document.querySelector('.exam-platform-image-expand').click()");await wait("document.querySelector('#exam-platform-image-dialog')");await key('Escape', 'Escape', 27);await wait("!document.querySelector('#exam-platform-image-dialog')");
  reports.starterImageExpand = true;
  for (const width of [1440, 1024, 390, 320]) {
    await viewport(width);
    const state = await theme();
    assert(state.background && state.cream && state.round >= 25 && state.minimumContrast >= 4.5 && state.touch && !state.overflow && state.parts === 4, JSON.stringify(state));
    reports['starterPlayer' + width] = state;screenshots['starterPlayer' + width] = await shot('starter-player-' + width);
  }
  await viewport(1440);
  await click('Part sau', root);await wait("document.querySelector('[data-starter-audio] audio')?.duration===5&&document.querySelector('[data-starter-audio] audio').src.endsWith('?part=2')");
  assert(await evaluate("document.querySelector('[data-starter-audio] audio').paused&&document.querySelector('[data-starter-audio] audio').currentTime===0"), 'Changing Part resets the clip and does not autoplay');
  await wait("document.querySelector('[data-starter-interaction=text-entry] input')");
  await evaluate("(()=>{const input=document.querySelector('[data-starter-interaction=text-entry] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'7');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await wait("document.querySelector('.student-exam-shell-progress')?.textContent==='2/20'");
  screenshots.starterPart2 = await shot('starter-player-part2');
  await click('Part sau', root);await wait("document.querySelector('[data-starter-interaction=image-options]')");screenshots.starterPart3 = await shot('starter-player-part3');
  await click('Part sau', root);await wait("document.querySelector('[data-starter-interaction=scene-colour-draw]')");screenshots.starterPart4 = await shot('starter-player-part4');
  assert(await evaluate("document.querySelector('[data-direction=next]').disabled"));
  reports.starterParts = { allFour: true, inputsUpdate: true, lastDisabled: true, audioResets: true };
  // Use the same B submit/review flow against this script's isolated fixture only.
  await cdp.send('Page.enable');
  const dialog = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm=()=>true;' });
  await evaluate('window.confirm=()=>true;document.querySelector(".student-exam-submit-action").click()');
  await wait("document.querySelector('#listening-result-screen')||document.querySelector('#starter-listening-result-screen')");
  reports.starterSubmit = true;
  await journey('starterSummary');await click('Xem kết quả','[data-student-journey]');await wait("document.querySelector('[id*=review-screen]')");await journey('starterReview');
  await click('Quay lại tổng kết','[data-student-journey]');
  await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: dialog.identifier });
  await goto('/exams/starter/reading-writing/qa-reading-writing-1');await wait("document.querySelector('#generic-exam-player button.exam-platform-primary-action')");await journey('starterReadingTransition');await click('Bắt đầu', '#generic-exam-player');
  await wait("document.querySelector('#generic-exam-player[data-exam-theme=starter] [data-starter-exam-panel=reading-writing]')");
  for (const width of [1440, 390, 320]) {
    await viewport(width);const state=await theme();
    assert(state.background&&state.cream&&state.minimumContrast>=4.5&&state.touch&&!state.overflow&&state.parts===5,JSON.stringify(state));
    reports['starterReadingPlayer'+width]=state;screenshots['starterReadingPlayer'+width]=await shot('starter-reading-player-'+width);
  }
  await viewport(1440);
  for (let part=2;part<=5;part++) {await click('Part sau','#generic-exam-player');await wait(`document.querySelector('[role=tab][aria-selected=true]')?.textContent.includes('Part ${part}')`);screenshots['starterReadingPart'+part]=await shot('starter-reading-player-part'+part);}
  reports.starterReadingParts = 5;
  // An unavailable clip must show an error with an enabled retry control.
  await goto('/exams/starter/listening/qa-listening-1');await wait("document.querySelector('#generic-exam-player button.exam-platform-primary-action')");await click('Bắt đầu','#generic-exam-player');await wait("document.querySelector('[data-starter-audio] audio')");
  await evaluate("document.querySelector('[data-starter-audio] audio').src='/audio/does-not-exist.wav'");await wait("document.querySelector('.starter-audio-error[role=alert]')");
  assert(await evaluate("!document.querySelector('.starter-audio-play').disabled"));reports.starterAudio.errorRetry=true;
}
