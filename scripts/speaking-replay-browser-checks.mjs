export async function exerciseRecordingPlayback({ cdp, origin, evaluate, click, wait, viewport, shot, assert, completedSet }) {
  await viewport(1440);
  const script = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{
    const realFetch=window.fetch.bind(window);window.qaReplayReads=0;
    window.fetch=async(input,init)=>{if(String(input).startsWith('/api/speaking/sessions/latest?lessonId='+${JSON.stringify(completedSet.id)}))return realFetch('/api/speaking/sessions/'+${JSON.stringify(completedSet.sessionId)},init);
      if(String(input).endsWith('/recording')){
      window.qaReplayReads++;if(window.qaBadAudio){window.qaBadAudio=false;return new Response('{}',{headers:{'Content-Type':'application/json'}})}
      if(window.qaDelayAudio)await new Promise(resolve=>window.qaReleaseAudio=resolve);
    }return realFetch(input,init)};
  })()` });
  try {
    await cdp.send('Page.navigate', { url: origin + '/speaking/lesson/' + completedSet.id });
    await wait('document.querySelector(\'[aria-label="Kết quả bộ Speaking"]\')');
    await click('Nghe lại bản thu', '.speaking-review');
    await wait("document.querySelector('.speaking-review audio')?.currentTime>0.05");
    let playback = await evaluate("(()=>{const a=document.querySelector('.speaking-review audio');return{paused:a.paused,muted:a.muted,volume:a.volume,rate:a.playbackRate,error:a.error?.code||null,seconds:a.duration};})()");
    assert(!playback.paused && !playback.muted && playback.volume === 1 && !playback.error && playback.seconds > .2, 'Authorized WAV actually starts playing');
    assert(await evaluate("Boolean(document.querySelector('.speaking-review a[download]'))"), 'Authorized recording can be downloaded for device playback');
    await evaluate("(()=>{const a=document.querySelector('.speaking-review audio');a.pause();a.volume=0;a.muted=true;a.currentTime=.6;})()");
    await click('Nghe lại bản thu', '.speaking-review');
    assert(await evaluate("(()=>{const a=document.querySelector('.speaking-review audio');return!a.muted&&a.volume===1&&a.currentTime<.5&&!a.paused&&window.qaReplayReads===1})()"), 'Replay resets silent controls, starts from the beginning and reuses the downloaded file');
    await evaluate("document.querySelector('.speaking-review details').open=true");
    await click('Nghe đoạn từ này', '.speaking-review details');
    await click('Nghe lại bản thu', '.speaking-review');
    await wait("document.querySelector('.speaking-review audio')?.currentTime>.4");
    assert(await evaluate("!document.querySelector('.speaking-review audio').paused"), 'Full replay is not cut off by an old word-segment request');
    const screenshot = await shot('recording-replay-desktop', '.speaking-review');
    await click('Xem mục 2', '.speaking-review');
    assert(await evaluate("!document.querySelector('.speaking-review audio')&&!document.querySelector('.speaking-review a[download]')"), 'Switching items removes the previous recording');
    await evaluate('window.qaBadAudio=true');
    await click('Nghe lại bản thu', '.speaking-review');
    await wait("document.querySelector('.speaking-review [role=alert]')?.textContent.includes('không phải audio')");
    assert(await evaluate("!document.querySelector('.speaking-review audio')"), 'An HTTP 200 non-audio payload cannot masquerade as a recording');
    await evaluate("(()=>{const realPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){HTMLMediaElement.prototype.play=realPlay;return Promise.reject(new DOMException('Blocked','NotAllowedError'))}})()");
    await click('Nghe lại bản thu', '.speaking-review');
    await wait("document.querySelector('.speaking-review [role=alert]')?.textContent.includes('Bấm Play')");
    await click('Nghe lại bản thu', '.speaking-review');
    await wait("document.querySelector('.speaking-review audio')?.currentTime>0.05");
    assert(await evaluate("!document.querySelector('.speaking-review [role=alert]')"), 'Autoplay rejection is visible and an explicit replay recovers');
    await viewport(390);
    const layout = await evaluate("(()=>{const r=document.querySelector('.speaking-review');return{overflow:r.scrollWidth>r.clientWidth+1,audioWidth:r.querySelector('audio').clientWidth,width:r.clientWidth};})()");
    assert(!layout.overflow && layout.audioWidth <= layout.width, 'Review audio fits mobile');
    const mobileScreenshot = await shot('recording-replay-mobile', '.speaking-review');
    await click('Xem mục 3', '.speaking-review'); await evaluate('window.qaDelayAudio=true');
    await evaluate("[...document.querySelectorAll('.speaking-review button')].find(b=>b.textContent==='Nghe lại bản thu').click()");
    await wait('window.qaReleaseAudio'); await click('Xem mục 1', '.speaking-review');
    await evaluate('window.qaDelayAudio=false;window.qaReleaseAudio()');
    assert(await evaluate("!document.querySelector('.speaking-review audio')"), 'A stale download cannot attach to the newly selected item');
    return { report: { playback, replayFromStart: true, silentControlsReset: true, wordThenFull: true, fileDownload: true, badPayload: true, autoplayRecovery: true, itemCleanup: true, staleDownload: true, mobile: layout }, screenshots: { recordingReplayDesktop: screenshot, recordingReplayMobile: mobileScreenshot } };
  } finally { await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier }); }
}
