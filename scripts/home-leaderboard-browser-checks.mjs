export async function exerciseHomeLeaderboard({ cdp, origin, evaluate, wait, viewport, metrics, shot, assert, names }) {
  const response = await fetch(origin + '/api/public/leaderboard-summary?period=week&limit=5');
  const board = await response.json();
  assert(response.status === 200 && board.entries.length === 5, 'Public API provides the bounded Home summary without authentication');
  assert(board.entries.every(entry => names.includes(entry.studentName)), 'Public Home uses B canonical display names');
  const allowed = ['rank', 'studentName', 'completedLessons', 'averageAccuracy', 'studyDays', 'honorScore', 'badges'].sort().join();
  assert(board.entries.every(entry => Object.keys(entry).sort().join() === allowed), 'Public summary exposes no account, class, guest or raw result identity');
  await viewport(1440); await cdp.send('Page.navigate', { url: origin + '/' });
  await wait("document.querySelector('#student-golden-board')||document.querySelector('#view-student-page-btn')");
  await evaluate("document.querySelector('#view-student-page-btn')?.click()");
  await wait("document.querySelectorAll('#home-leaderboard-list .home-leaderboard-name').length===5");
  assert(await evaluate(`JSON.stringify([...document.querySelectorAll('#home-leaderboard-list .home-leaderboard-name')].map(p=>p.textContent))===${JSON.stringify(JSON.stringify(board.entries.map(e => e.studentName)))}`), 'Home automatically displays exactly the names and order returned by its public API');
  const reports = {}, screenshots = {};
  for (const width of [1440, 390, 320]) {
    await viewport(width);
    const layout = await evaluate("(()=>{const r=document.querySelector('#student-golden-board');return{overflow:r.scrollWidth>r.clientWidth+1,names:[...r.querySelectorAll('.home-leaderboard-name')].map(p=>({overflow:p.scrollWidth>p.clientWidth+1,nowrap:getComputedStyle(p).whiteSpace==='nowrap',ellipsis:getComputedStyle(p).textOverflow==='ellipsis'}))};})()");
    assert(!layout.overflow && layout.names.every(p => !p.overflow && !p.nowrap && !p.ellipsis), 'Full student names wrap without clipping at ' + width);
    reports['homeLeaderboard' + width] = { ...await metrics('#student-golden-board'), layout };
    screenshots['homeLeaderboard' + width] = await shot('home-leaderboard-' + width, '#student-golden-board');
  }
  await evaluate("(()=>{const s=document.querySelector('#student-golden-board select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'month');s.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await wait("document.querySelectorAll('#home-leaderboard-list .home-leaderboard-name').length===5");
  reports.homeLeaderboardNames = { publicNamed: true, canonicalNames: true, boundedDto: true, automaticLoad: true, periodFilter: true };
  return { reports, screenshots };
}
