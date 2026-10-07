export async function exerciseProsodyReview({ cdp, origin, evaluate, click, wait, viewport, metrics, shot, assert, fixtureResult }) {
  const reports = {}, screenshots = {};
  const cases = [
    { name: 'azureAvailable', provider: 'azure', locale: 'en-US', prosody: 91.2, status: 'available', rhythm: null, expected: '91.2/100', enabled: true },
    { name: 'azureZero', provider: 'azure', locale: 'en-US', prosody: 0, status: 'available', rhythm: null, expected: '0/100', enabled: true },
    { name: 'azureDisabled', provider: 'azure', locale: 'en-US', prosody: null, status: 'disabled', rhythm: null, expected: 'chưa được bật', enabled: false },
    { name: 'azureNoReturn', provider: 'azure', locale: 'en-US', prosody: null, status: 'not-returned', rhythm: null, expected: 'Azure chưa trả', enabled: true },
    { name: 'azureLegacy', provider: 'azure', locale: 'en-US', prosody: null, rhythm: null, expected: 'Lượt chấm cũ', enabled: true },
    { name: 'azureBritish', provider: 'azure', locale: 'en-GB', prosody: null, status: 'unsupported-locale', rhythm: null, expected: 'chỉ hỗ trợ', enabled: true },
    { name: 'speechsuperRhythm', provider: 'speechsuper', locale: 'en-US', prosody: null, rhythm: 82, expected: '82/100', enabled: true },
  ];
  for (const item of cases) {
    const result = { ...fixtureResult, audioAvailable: false, lesson: { ...fixtureResult.lesson, provider: item.provider, locale: item.locale }, assessment: { ...fixtureResult.assessment, provider: item.provider, prosody: item.prosody, prosodyStatus: item.status, rhythm: item.rhythm } };
    const script = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const realFetch=window.fetch.bind(window);window.qaProsodyWrites=0;window.fetch=async(input,init)=>{const url=String(input);if(init?.method&&!['GET','HEAD'].includes(init.method.toUpperCase()))window.qaProsodyWrites++;if(/\\/api\\/speaking\\/admin\\/results\\/[^/?]+$/.test(url))return new Response(JSON.stringify(${JSON.stringify(result)}),{status:200,headers:{'Content-Type':'application/json'}});if(url.endsWith('/api/speaking/capabilities')){const response=await realFetch(input,init),data=await response.json();data.azureProsody={enabled:${item.enabled},locale:'en-US',includesRhythm:true};return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})}return realFetch(input,init)}})()` });
    try {
      await viewport(1440); await cdp.send('Page.navigate', { url: origin + '/admin' }); await wait("document.querySelector('#tab-speaking')"); await evaluate("document.querySelector('#tab-speaking').click()"); await wait("document.querySelector('#speaking-admin nav[aria-label=\"Quản lý Speaking\"]')");
      await click('Cấu hình dịch vụ'); await wait(`document.querySelector('[data-speaking-prosody-status]')?.textContent.includes(${JSON.stringify(item.enabled ? 'Đã bật' : 'Đang tắt')})`);
      await click('Kết quả'); await click('Xem', '#speaking-admin tbody');
      const metric = item.provider === 'azure' ? 'prosody' : 'rhythm';
      await wait(`document.querySelector('[data-speaking-metric=${metric}]')?.textContent.includes(${JSON.stringify(item.expected)})`);
      assert(await evaluate(`document.querySelector('.speaking-review .speaking-score').textContent===${JSON.stringify(result.assessment.score + '/100')}`), 'Additional metrics do not change the stored reading score');
      assert(await evaluate(`document.querySelectorAll('[data-speaking-metric]').length===4&&!document.querySelector('[data-speaking-metric=${item.provider === 'azure' ? 'rhythm' : 'prosody'}]')`), 'Provider shows four supported metric cards: ' + item.name);
      if (item.provider === 'azure') assert(await evaluate("document.querySelector('[data-speaking-metric=prosody]').textContent.includes('không trả điểm rhythm riêng')"), 'Azure combined metric explains the absent independent rhythm');
      for (const width of item.name === 'azureAvailable' || item.name === 'azureLegacy' ? [1440,390,320] : [1440]) {
        await viewport(width); const layout = await evaluate("(()=>{const root=document.querySelector('.speaking-review');return{width:root.clientWidth,overflow:root.scrollWidth>root.clientWidth+1,metricCount:root.querySelectorAll('[data-speaking-metric]').length,missingGeneric:root.textContent.includes('Không có chỉ số')};})()");
        assert(!layout.overflow && !layout.missingGeneric && layout.metricCount === 4, 'Review metrics fit at ' + item.name + width);
        reports[item.name + width] = { ...await metrics('#speaking-admin'), layout }; screenshots[item.name + width] = await shot('prosody-' + item.name + '-' + width, '.speaking-review');
      }
      assert(await evaluate('window.qaProsodyWrites===0'), 'Viewing metrics does not grade/retry/save any attempt');
    } finally { await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier }); }
  }
  return { reports, screenshots };
}
