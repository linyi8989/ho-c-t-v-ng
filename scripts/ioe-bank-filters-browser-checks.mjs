export async function exerciseBankFilters({ assert, click, field, wait, evaluate, viewport, metrics, shot, staffFetch }, fixture = false) {
  const reports = {}, screenshots = {}, added = [];
  if (fixture) {
    const scope = { subject: 'vietnamese', grade: 9, level: 'national' };
    const saved = await staffFetch('/api/ioe-violympic/admin/questions', 'POST', { ...scope, requestId: 'qa-bank-filter-' + Date.now(), questions: Array.from({ length: 35 }, (_, i) => ({ prompt: 'QA bank filter pagination ' + i, answer: 'đúng', domain: 'reading', title: 'QA bank filter title ' + i })) });
    added.push(...saved.ids);
  }
  await evaluate("window.qaBankOriginalFetch=window.fetch;window.qaBankWrites=[];window.fetch=(input,init)=>{if(init?.method&&!['GET','HEAD'].includes(init.method.toUpperCase()))window.qaBankWrites.push(String(input));return window.qaBankOriginalFetch(input,init)}");
  const settled = async (query = '') => {
    const expected = await staffFetch('/api/ioe-violympic/admin/questions' + (query ? '?' + query : ''));
    await wait(`!document.querySelector('#ioe-violympic-admin p[role=status]')&&[...document.querySelectorAll('#ioe-violympic-admin .competition-toolbar span')].some(s=>s.textContent.startsWith(${JSON.stringify(expected.total + ' câu ·')}))&&document.querySelectorAll('#ioe-violympic-admin tbody tr').length===${expected.items.length}`);
    assert(await evaluate(`(()=>{const rows=[...document.querySelectorAll('#ioe-violympic-admin tbody tr')];return ${JSON.stringify(expected.items.map(q => q.prompt))}.every((prompt,i)=>rows[i].textContent.includes(prompt));})()`), 'Bank displays the API page for ' + query);
    return expected;
  };
  const clear = async () => { await field('Môn', ''); await field('Lớp', ''); await field('Cấp', ''); await field('Tìm nội dung / tiêu đề', ''); return settled(); };
  try {
    await click('Soạn JSON'); await click('Ngân hàng');
    assert(await evaluate("[...document.querySelectorAll('.competition-bank-toolbar select')].every(s=>s.value===''&&!s.disabled)"), 'Bank starts with three empty, enabled filters');
    const all = await settled(); reports.default = { total: all.total, pageSize: all.items.length, emptyFilters: true };
    for (const width of [1440,1280,390,320]) {
      await viewport(width);
      const layout = await evaluate("(()=>{const root=document.querySelector('.competition-bank-toolbar');const r=[...root.children].map(el=>el.getBoundingClientRect());return{count:r.length,oneRow:r.every(x=>Math.abs(x.bottom-r[0].bottom)<2),fit:r.every(x=>x.left>=0&&x.right<=innerWidth+1),selectsEnabled:[...root.querySelectorAll('select')].every(s=>!s.disabled)};})()");
      assert(layout.count === 5 && layout.fit && layout.selectsEnabled && (width < 1001 || layout.oneRow), 'Five visible bank controls fit at ' + width + ': ' + JSON.stringify(layout));
      reports['bankFilters' + width] = { ...await metrics('#ioe-violympic-admin'), layout }; screenshots[width] = await shot('bank-filters-' + width, width < 600 ? '.competition-bank-toolbar' : undefined);
    }
    await viewport(1440); await evaluate("document.querySelector('.competition-bank-toolbar select').focus()");
    const focus = await evaluate("(()=>{const s=getComputedStyle(document.activeElement);return{width:parseFloat(s.outlineWidth),style:s.outlineStyle};})()"); assert(focus.width >= 3 && focus.style === 'solid', 'Bank filters have visible keyboard focus');
    if (all.total > 30) {
      await evaluate("document.querySelector('#ioe-violympic-admin tbody input[type=checkbox]').click()"); await click('Trang sau');
      await settled('page=2'); assert(await evaluate("document.querySelector('.competition-bank-toolbar button').textContent.includes('Xóa 0')"), 'Changing page clears checked questions');
      await click('Trang trước'); await settled(); reports.pagination = true;
    }
    await field('Lớp', '3'); await settled('grade=3');
    await field('Môn', 'math'); await settled('subject=math&grade=3');
    await field('Cấp', 'school'); const math = await settled('subject=math&grade=3&level=school'); assert(math.total >= 1, 'Local/fixture bank contains Math grade 3 school questions');
    await evaluate("document.querySelector('#ioe-violympic-admin tbody input[type=checkbox]').click()");
    await field('Tìm nội dung / tiêu đề', 'QA nonexistent bank filter 86e0'); await settled('subject=math&grade=3&level=school&search=QA+nonexistent+bank+filter+86e0');
    assert(await evaluate("document.querySelector('.competition-bank-toolbar button').textContent.includes('Xóa 0')&&document.body.textContent.includes('Không có câu phù hợp bộ lọc.')"), 'Search clears selection and displays the empty state');
    await field('Tìm nội dung / tiêu đề', math.items[0].prompt.slice(0, 25)); await settled(new URLSearchParams({ subject: 'math', grade: '3', level: 'school', search: math.items[0].prompt.slice(0,25) }).toString());
    await clear();
    // UI-only drafts exercise the original bug without writing any question.
    await click('Soạn JSON'); await field('Môn', 'english'); await field('Lớp', '3'); await field('Cấp', 'practice'); await click('Thêm câu thủ công');
    await field('Nội dung câu hỏi', 'QA unsaved bank-filter draft', '[data-competition-draft-row]');
    await click('Ngân hàng'); await settled();
    assert(await evaluate("[...document.querySelectorAll('.competition-bank-toolbar select')].every(s=>!s.disabled&&s.value==='')&&!document.body.textContent.includes('Môn/lớp/cấp được giữ')"), 'Unsaved drafts do not lock or scope the bank');
    await field('Môn', 'math'); await field('Lớp', '3'); await field('Cấp', 'school'); await settled('subject=math&grade=3&level=school');
    await click('Sửa', '#ioe-violympic-admin tbody'); await wait("document.querySelector('#ioe-violympic-admin [role=alert]')?.textContent.includes('môn/lớp/cấp khác')");
    assert(await evaluate("document.querySelector('.competition-bank-toolbar')!==null"), 'Incompatible edit preserves the bank and existing draft');
    await click('Soạn JSON');
    assert(await evaluate("document.querySelector('#ioe-violympic-admin select').value==='english'&&document.querySelector('#ioe-violympic-admin select').disabled&&document.querySelector('[data-competition-draft-row] textarea').value==='QA unsaved bank-filter draft'"), 'Filtering and incompatible editing leave draft scope/content intact');
    await click('Bỏ dòng'); await click('Ngân hàng');
    await wait("document.querySelector('#ioe-violympic-admin tbody button')&&!document.querySelector('#ioe-violympic-admin p[role=status]')"); await click('Sửa', '#ioe-violympic-admin tbody');
    await wait("document.querySelector('[data-competition-draft-row]')");
    const edit = await evaluate("({scope:[...document.querySelectorAll('#ioe-violympic-admin > .competition-toolbar select')].map(s=>s.value),prompt:document.querySelector('[data-competition-draft-row] textarea').value})");
    assert(edit.scope.join('|') === 'math|3|school' && edit.prompt === math.items[0].prompt, 'Editing from the combined bank retains original question scope');
    await click('Ngân hàng'); await settled('subject=math&grade=3&level=school'); await click('Sao chép', '#ioe-violympic-admin tbody');
    assert(await evaluate("document.querySelectorAll('[data-competition-draft-row]').length===2&&[...document.querySelectorAll('[data-competition-draft-row] textarea')].filter(t=>t.value===" + JSON.stringify(math.items[0].prompt) + ").length===2"), 'Copy appends a same-scope draft without changing content');
    await click('Bỏ dòng'); await click('Bỏ dòng'); await click('Ngân hàng'); await settled('subject=math&grade=3&level=school');
    // Delay and transient failure affect read requests only.
    await evaluate("window.fetch=async(input,init)=>{if(String(input).includes('/admin/questions?'))await new Promise(r=>setTimeout(r,700));return window.qaBankOriginalFetch(input,init)}");
    await field('Lớp', '4'); await wait("document.body.textContent.includes('Đang tải câu hỏi...')");
    assert(await evaluate("document.querySelectorAll('#ioe-violympic-admin tbody tr').length===0&&document.querySelector('.competition-bank-toolbar button').disabled&&[...document.querySelectorAll('.competition-bank-toolbar select')].every(s=>!s.disabled)"), 'Loading hides stale rows and blocks deletion while filters stay enabled');
    await settled('subject=math&grade=4&level=school');
    await evaluate("window.fetch=async(input,init)=>String(input).includes('/admin/questions?')?new Response(JSON.stringify({error:'QA bank read failed'}),{status:500,headers:{'Content-Type':'application/json'}}):window.qaBankOriginalFetch(input,init)");
    await field('Lớp', '3'); await wait("document.querySelector('#ioe-violympic-admin [role=alert]')?.textContent.includes('QA bank read failed')");
    await evaluate("window.fetch=window.qaBankOriginalFetch"); await click('Tải lại dữ liệu'); await settled('subject=math&grade=3&level=school'); await clear();
    reports.behavior = { partialFilters: true, search: true, empty: true, draftPreserved: true, editScope: true, copyScope: true, loading: true, errorRetry: true, focus, noBrowserWrites: true };
    assert(await evaluate("window.qaBankWrites.length===0"), 'Bank filtering/editing/copy preview does not save/archive/grade any data');
    for (const report of Object.values(reports)) if (report.controls) assert(!report.overflow && report.controls.every(c => c.contrast >= 4.5), 'Bank toolbar computed contrast and viewport fit');
    return { reports, screenshots };
  } finally {
    await evaluate("window.fetch=window.qaBankOriginalFetch");
    if (added.length) await staffFetch('/api/ioe-violympic/admin/questions/archive', 'POST', { ids: added });
  }
}
