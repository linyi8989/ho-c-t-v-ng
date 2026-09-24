import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = Number(process.env.CSS_QA_DEBUG_PORT || (10_000 + Math.floor(Math.random() * 20_000)));
const origin = process.env.CSS_QA_ORIGIN || 'http://127.0.0.1:3000';
const qaRoot = mkdtempSync(path.join(os.tmpdir(), 'vhomework-css-qa-'));
const profileDir = path.join(qaRoot, 'profile');
const screenshotDir = path.join(qaRoot, 'screenshots');
mkdirSync(profileDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  '--window-size=1440,1000',
  origin,
], {
  stdio: ['ignore', 'ignore', 'pipe'],
  windowsHide: true,
});

let chromeError = '';
chrome.stderr.setEncoding('utf8');
chrome.stderr.on('data', chunk => {
  chromeError += chunk;
});

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForDebugger() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chrome DevTools endpoint did not start. ${chromeError.slice(-800)}`);
}

function createCdpClient(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeoutId);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', event => {
    const detail = `Chrome DevTools WebSocket closed (${event.code}): ${event.reason}`;
    for (const [id, request] of pending) {
      clearTimeout(request.timeoutId);
      request.reject(new Error(detail));
      pending.delete(id);
    }
  });
  socket.addEventListener('error', error => {
    for (const [id, request] of pending) {
      clearTimeout(request.timeoutId);
      request.reject(error);
      pending.delete(id);
    }
  });

  return {
    ready,
    close: () => socket.close(),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        const timeoutId = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Chrome DevTools command timed out: ${method}`));
        }, 10_000);
        pending.set(id, { resolve, reject, timeoutId });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const targets = await waitForDebugger();
  const target = targets.find(item => item.type === 'page' && item.url.startsWith(origin));
  if (!target?.webSocketDebuggerUrl) throw new Error('Localhost page target was not created.');

  const cdp = createCdpClient(target.webSocketDebuggerUrl);
  await Promise.race([
    cdp.ready,
    delay(5_000).then(() => {
      throw new Error('Timed out opening the Chrome DevTools WebSocket.');
    }),
  ]);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const evaluate = async expression => {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  const waitFor = async expression => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await delay(100);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };

  const viewport = async (width, height, mobile = false) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await delay(100);
  };

  const screenshot = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const filePath = path.join(screenshotDir, `${name}.png`);
    writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    return filePath;
  };

  const surfaceMetricsExpression = rootSelector => `(() => {
    const root = document.querySelector(${JSON.stringify(rootSelector)});
    if (!root) return null;
    const rootStyle = getComputedStyle(root);
    const buttons = [...root.querySelectorAll('button')];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      rootWidth: root.scrollWidth,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      backgroundColor: rootStyle.backgroundColor,
      backgroundImage: rootStyle.backgroundImage,
      backdropFilters: [...new Set(buttons.map(button => getComputedStyle(button).backdropFilter))],
      beforeContent: getComputedStyle(document.body, '::before').content,
      buttonCount: buttons.length,
    };
  })()`;

  const examCardMetricsExpression = `(() => {
    const root = document.querySelector('#home-listening-directory');
    const cards = [...(root?.querySelectorAll('[data-exam-module-card]') || [])];
    const cardMetrics = cards.map(card => {
      const rect = card.getBoundingClientRect();
      const title = card.querySelector('.exam-directory-module-title')?.getBoundingClientRect();
      const level = card.querySelector('.exam-directory-module-level')?.getBoundingClientRect();
      const description = card.querySelector('.exam-directory-module-description')?.getBoundingClientRect();
      const actionElement = card.querySelector('.exam-directory-module-action');
      const action = actionElement?.getBoundingClientRect();
      const actionStyle = actionElement ? getComputedStyle(actionElement) : null;
      return {
        id: card.getAttribute('data-exam-module-card'),
        width: rect.width,
        height: rect.height,
        top: rect.top,
        scrollHeight: card.scrollHeight,
        clientHeight: card.clientHeight,
        actionHeight: action?.height || 0,
        actionBottom: action?.bottom || 0,
        actionWhiteSpace: actionStyle?.whiteSpace || '',
        contentOrder: Boolean(title && level && description && action
          && title.top <= level.top
          && level.bottom <= description.top + 1
          && description.bottom <= action.top + 1),
        actionInside: Boolean(action && action.bottom <= rect.bottom + 1),
      };
    });
    const rowTops = [...new Set(cardMetrics.map(card => Math.round(card.top)))];
    const rows = rowTops.map(top => {
      const row = cardMetrics.filter(card => Math.round(card.top) === top);
      const bottoms = row.map(card => card.actionBottom);
      return { top, count: row.length, actionBottomSpread: Math.max(...bottoms) - Math.min(...bottoms) };
    });
    const heights = cardMetrics.map(card => card.height);
    const widths = cardMetrics.map(card => card.width);
    return {
      count: cards.length,
      ids: cardMetrics.map(card => card.id),
      activeBadgePresent: root?.textContent?.includes('Đang hoạt động') || false,
      heightSpread: heights.length ? Math.max(...heights) - Math.min(...heights) : null,
      widthSpread: widths.length ? Math.max(...widths) - Math.min(...widths) : null,
      maximumHeight: heights.length ? Math.max(...heights) : null,
      noCardOverflow: cardMetrics.every(card => card.scrollHeight <= card.clientHeight + 1 && card.actionInside),
      singleLineActions: cardMetrics.every(card => card.actionHeight <= 42 && card.actionWhiteSpace === 'nowrap'),
      contentOrder: cardMetrics.every(card => card.contentOrder),
      rows,
      cards: cardMetrics,
    };
  })()`;

  const grammarFilterMetricsExpression = `(() => {
    const root = document.querySelector('#home-grammar-directory');
    const search = document.querySelector('#home-grammar-search');
    const grade = document.querySelector('#home-grammar-grade-filter');
    const title = root?.querySelector('h2 > span:first-of-type');
    const rootRect = root?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();
    const gradeRect = grade?.getBoundingClientRect();
    return {
      present: Boolean(root && search && grade),
      root: rootRect && { left: rootRect.left, right: rootRect.right, width: rootRect.width },
      search: searchRect && { left: searchRect.left, right: searchRect.right, width: searchRect.width, height: searchRect.height },
      grade: gradeRect && { left: gradeRect.left, right: gradeRect.right, width: gradeRect.width, height: gradeRect.height },
      searchLabel: search?.getAttribute('aria-label') || '',
      gradeLabel: grade?.getAttribute('aria-label') || '',
      titleSingleLine: Boolean(title && title.getBoundingClientRect().height < 30),
      insideRoot: Boolean(rootRect && searchRect && gradeRect
        && searchRect.left >= rootRect.left - 1 && searchRect.right <= rootRect.right + 1
        && gradeRect.left >= rootRect.left - 1 && gradeRect.right <= rootRect.right + 1),
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  })()`;

  const lessonListMetricsExpression = selector => `(() => {
    const root = document.querySelector(${JSON.stringify(selector)});
    const rootRect = root?.getBoundingClientRect();
    const headers = [...(root?.querySelectorAll('[role="columnheader"]') || [])]
      .map(header => header.textContent?.trim() || '');
    const rows = [...(root?.querySelectorAll('.home-lesson-list-row') || [])];
    return {
      present: Boolean(root),
      headers,
      rowCount: rows.length,
      rows: rows.map(row => {
        const rect = row.getBoundingClientRect();
        const action = row.querySelector('.home-lesson-list-action');
        const actionStyle = action ? getComputedStyle(action) : null;
        const cells = [...row.querySelectorAll('[role="cell"]')];
        return {
          cellCount: cells.length,
          actionText: action?.textContent?.trim() || '',
          hasPlayIcon: Boolean(action?.querySelector('svg')),
          actionStyle: actionStyle ? {
            backgroundColor: actionStyle.backgroundColor,
            color: actionStyle.color,
            filter: actionStyle.filter,
            opacity: actionStyle.opacity,
          } : null,
          insideRoot: Boolean(rootRect && rect.left >= rootRect.left - 1 && rect.right <= rootRect.right + 1),
          overflow: row.scrollWidth > row.clientWidth + 1,
        };
      }),
      headerDisplay: root?.querySelector('.home-lesson-list-header')
        ? getComputedStyle(root.querySelector('.home-lesson-list-header')).display
        : '',
      overflow: Boolean(root && root.scrollWidth > root.clientWidth + 1),
    };
  })()`;

  await viewport(1440, 1000, false);
  await waitFor(`document.readyState === 'complete' && document.querySelector('#admin-dashboard-container')`);
  const adminDesktop = await evaluate(surfaceMetricsExpression('#admin-dashboard-container'));
  assert(adminDesktop && !adminDesktop.overflowX, 'Admin desktop has horizontal document overflow.');
  assert(adminDesktop.backdropFilters.every(value => value === 'none'), 'Admin button inherited a blur layer.');
  const adminScreenshot = await screenshot('admin-desktop');

  await viewport(390, 844, true);
  await delay(150);
  const adminMobile = await evaluate(surfaceMetricsExpression('#admin-dashboard-container'));
  assert(adminMobile && !adminMobile.overflowX, 'Admin 390px has horizontal document overflow.');
  const adminMobileScreenshot = await screenshot('admin-mobile-390');

  await evaluate(`document.querySelector('#view-student-page-btn')?.click()`);
  await waitFor(`document.querySelector('#app-root')`);
  await viewport(1440, 1000, false);
  const homeDesktop = await evaluate(`(() => {
    const metrics = ${surfaceMetricsExpression('#app-root')};
    const hero = document.querySelector('#home-hero');
    const heroStyle = hero ? getComputedStyle(hero) : null;
    return {
      ...metrics,
      heroBackground: heroStyle?.backgroundImage || '',
      heroBackdrop: heroStyle?.backdropFilter || '',
    };
  })()`);
  assert(homeDesktop && !homeDesktop.overflowX, 'Home desktop has horizontal document overflow.');
  assert(homeDesktop.backdropFilters.every(value => value === 'none'), 'Home button inherited a blur layer.');
  assert(homeDesktop.heroBackdrop === 'none', 'Home hero inherited a blur layer.');
  const homeScreenshot = await screenshot('home-desktop');

  await waitFor(`document.querySelectorAll('#home-listening-directory [data-exam-module-card]').length === 7`);
  await evaluate(`document.querySelector('#home-listening-directory')?.scrollIntoView({ block: 'start' })`);
  await delay(150);
  const examCardsDesktop = await evaluate(examCardMetricsExpression);
  assert(examCardsDesktop.count === 7, 'Exam directory must render seven student module cards.');
  assert(!examCardsDesktop.activeBadgePresent, 'Exam directory still displays the active-status badge.');
  assert(examCardsDesktop.heightSpread <= 1 && examCardsDesktop.maximumHeight <= 210, 'Exam cards are not uniformly compact.');
  assert(examCardsDesktop.widthSpread <= 1, 'Exam cards do not have uniform desktop widths.');
  assert(examCardsDesktop.noCardOverflow && examCardsDesktop.contentOrder,
    `Exam card content overflows or is out of order: ${JSON.stringify(examCardsDesktop.cards)}`);
  assert(examCardsDesktop.singleLineActions, 'Exam card actions must remain on one compact line.');
  assert(examCardsDesktop.rows.every(row => row.actionBottomSpread <= 1), 'Exam card actions do not align within their rows.');
  const examCardsDesktopScreenshot = await screenshot('exam-directory-desktop');

  await evaluate(`document.querySelector('#home-grammar-directory')?.scrollIntoView({ block: 'center' })`);
  await delay(150);
  const grammarFiltersDesktop = await evaluate(grammarFilterMetricsExpression);
  assert(grammarFiltersDesktop.present && grammarFiltersDesktop.insideRoot, 'Grammar filters leave their desktop section.');
  assert(!grammarFiltersDesktop.overflowX, 'Grammar filters cause desktop horizontal overflow.');
  assert(grammarFiltersDesktop.search?.height >= 36 && grammarFiltersDesktop.grade?.height >= 36, 'Grammar filter controls are shorter than the existing Home filters.');
  assert(grammarFiltersDesktop.searchLabel && grammarFiltersDesktop.gradeLabel, 'Grammar filters are missing accessible labels.');
  assert(grammarFiltersDesktop.titleSingleLine, 'Grammar heading wraps in the desktop filter row.');
  const vocabListDesktop = await evaluate(lessonListMetricsExpression('#home-sets-grid'));
  assert(JSON.stringify(vocabListDesktop.headers) === JSON.stringify(['STT', 'Tên', 'Khối lớp', 'Chủ đề', 'Thao tác']),
    `Vocabulary list headers are incorrect: ${JSON.stringify(vocabListDesktop.headers)}`);
  assert(vocabListDesktop.rowCount > 0 && vocabListDesktop.rows.every(row => row.cellCount === 5), 'Vocabulary list does not expose five cells per row.');
  assert(vocabListDesktop.rows.every(row => row.actionText === 'Học Bài' && row.hasPlayIcon), 'Vocabulary list action is missing Play / Học Bài.');
  assert(vocabListDesktop.rows.every(row => row.actionStyle?.backgroundColor === 'rgb(37, 99, 235)'
    && row.actionStyle.color === 'rgb(255, 255, 255)'
    && row.actionStyle.opacity === '1'
    && row.actionStyle.filter === 'none'),
  `Vocabulary actions are visually faded or overridden: ${JSON.stringify(vocabListDesktop.rows)}`);
  assert(!vocabListDesktop.overflow && vocabListDesktop.rows.every(row => row.insideRoot && !row.overflow), 'Vocabulary desktop list overflows.');
  const grammarFiltersDesktopScreenshot = await screenshot('grammar-filters-desktop');

  await evaluate(`window.scrollTo(0, 0)`);

  await viewport(390, 844, true);
  await delay(150);
  const homeMobile = await evaluate(`(() => {
    const metrics = ${surfaceMetricsExpression('#app-root')};
    const hero = document.querySelector('#home-hero')?.getBoundingClientRect();
    const heading = document.querySelector('#home-hero h1')?.getBoundingClientRect();
    return { ...metrics, hero: hero && { left: hero.left, right: hero.right, width: hero.width }, headingWidth: heading?.width || 0 };
  })()`);
  assert(homeMobile && !homeMobile.overflowX, 'Home 390px has horizontal document overflow.');
  assert(homeMobile.hero && homeMobile.hero.left >= -1 && homeMobile.hero.right <= 391, 'Home hero leaves the 390px viewport.');
  const homeMobileScreenshot = await screenshot('home-mobile-390');

  await evaluate(`document.querySelector('#home-listening-directory')?.scrollIntoView({ block: 'start' })`);
  await delay(150);
  const examCardsMobile = await evaluate(examCardMetricsExpression);
  assert(examCardsMobile.count === 7, 'Mobile exam directory must render seven module cards.');
  assert(!examCardsMobile.activeBadgePresent, 'Mobile exam directory still displays the active-status badge.');
  assert(examCardsMobile.heightSpread <= 1 && examCardsMobile.maximumHeight <= 210, 'Mobile exam cards are not uniformly compact.');
  assert(examCardsMobile.widthSpread <= 1, 'Mobile exam cards do not have uniform widths.');
  assert(examCardsMobile.noCardOverflow && examCardsMobile.contentOrder,
    `Mobile exam card content overflows or is out of order: ${JSON.stringify(examCardsMobile.cards)}`);
  assert(examCardsMobile.singleLineActions, 'Mobile exam card actions must remain on one compact line.');
  const examCardsMobileScreenshot = await screenshot('exam-directory-mobile-390');

  await evaluate(`document.querySelector('#home-grammar-directory')?.scrollIntoView({ block: 'center' })`);
  await delay(150);
  const grammarFiltersMobile = await evaluate(grammarFilterMetricsExpression);
  assert(grammarFiltersMobile.present && grammarFiltersMobile.insideRoot, 'Grammar filters leave their mobile section.');
  assert(!grammarFiltersMobile.overflowX, 'Grammar filters cause mobile horizontal overflow.');
  assert(grammarFiltersMobile.search?.width === grammarFiltersMobile.grade?.width, 'Mobile grammar controls do not share one width.');
  const vocabListMobile = await evaluate(lessonListMetricsExpression('#home-sets-grid'));
  assert(vocabListMobile.headerDisplay === 'none', 'Mobile lesson list still shows the desktop header.');
  assert(!vocabListMobile.overflow && vocabListMobile.rows.every(row => row.insideRoot && !row.overflow), 'Vocabulary mobile list overflows.');
  const grammarFiltersMobileScreenshot = await screenshot('grammar-filters-mobile-390');

  const openedStudent = await evaluate(`(() => {
    const button = document.querySelector('#home-sets-grid button');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  let student = { skipped: true, reason: 'No vocabulary set button in local fixture.' };
  let studentScreenshot = null;
  let studentMobileScreenshot = null;
  if (openedStudent) {
    await waitFor(`document.querySelector('#student-area-root')`);
    await viewport(1440, 1000, false);
    const goldenToggleDefault = await evaluate(`(() => {
      const toggle = document.querySelector('#learning-golden-toggle');
      const style = toggle ? getComputedStyle(toggle) : null;
      return style && {
        color: style.color,
        backgroundColor: style.backgroundColor,
        opacity: style.opacity,
        filter: style.filter,
        backdropFilter: style.backdropFilter,
      };
    })()`);
    const toggleCenter = await evaluate(`(() => {
      const rect = document.querySelector('#learning-golden-toggle')?.getBoundingClientRect();
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    })()`);
    if (toggleCenter) {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: toggleCenter.x,
        y: toggleCenter.y,
      });
    }
    student = await evaluate(`(() => {
      const metrics = ${surfaceMetricsExpression('#student-area-root')};
      const goldenToggle = document.querySelector('#learning-golden-toggle');
      const hoverBackgroundColor = goldenToggle ? getComputedStyle(goldenToggle).backgroundColor : null;
      goldenToggle?.focus();
      const toggleStyle = goldenToggle ? getComputedStyle(goldenToggle) : null;
      const disabledButton = [...document.querySelectorAll('#student-area-root button:disabled')]
        .find(button => button.getBoundingClientRect().width > 0);
      const disabledStyle = disabledButton ? getComputedStyle(disabledButton) : null;
      return {
        ...metrics,
        skipped: false,
        gameStageBackdrop: getComputedStyle(document.querySelector('#game-stage')).backdropFilter,
        goldenToggleHoverBackgroundColor: hoverBackgroundColor,
        goldenToggle: toggleStyle && {
          color: toggleStyle.color,
          backgroundColor: toggleStyle.backgroundColor,
          outlineStyle: toggleStyle.outlineStyle,
          outlineWidth: toggleStyle.outlineWidth,
        },
        disabledButton: disabledStyle && {
          color: disabledStyle.color,
          backgroundColor: disabledStyle.backgroundColor,
          opacity: disabledStyle.opacity,
        },
      };
    })()`);
    student.goldenToggleDefault = goldenToggleDefault;
    assert(!student.overflowX, 'Student desktop has horizontal document overflow.');
    assert(student.backdropFilters.every(value => value === 'none'), 'Student button inherited a blur layer.');
    assert(student.gameStageBackdrop === 'none', 'Game stage inherited a blur layer.');
    assert(student.goldenToggleDefault?.backgroundColor === 'rgb(180, 83, 9)', 'Golden-board default background is faded.');
    assert(student.goldenToggleDefault?.color === 'rgb(255, 255, 255)', 'Golden-board default label lacks contrast.');
    assert(student.goldenToggleDefault?.opacity === '1', 'Golden-board default state is translucent.');
    assert(student.goldenToggleDefault?.filter === 'none' && student.goldenToggleDefault?.backdropFilter === 'none',
      'Golden-board default state inherited a visual filter.');
    assert(student.goldenToggleHoverBackgroundColor === 'rgb(146, 64, 14)', 'Golden-board hover state is not visible.');
    assert(student.goldenToggle?.outlineStyle !== 'none', 'Golden-board focus state is not visible.');
    await evaluate(`document.querySelector('#learning-golden-toggle')?.click()`);
    await waitFor(`document.querySelector('#learning-golden-board')?.dataset.leaderboardStatus === 'ready'`, 15000);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
    await delay(100);
    const goldenBoardOpen = await evaluate(`(() => {
      const board = document.querySelector('#learning-golden-board');
      const toggle = document.querySelector('#learning-golden-toggle');
      toggle?.blur();
      const style = toggle ? getComputedStyle(toggle) : null;
      return {
        status: board?.dataset.leaderboardStatus || '',
        expanded: toggle?.getAttribute('aria-expanded') || '',
        backgroundColor: style?.backgroundColor || '',
        color: style?.color || '',
        opacity: style?.opacity || '',
        entries: board?.querySelectorAll('.learning-podium-card').length || 0,
        hasPreparationError: board?.textContent?.includes('Bảng vàng đang được chuẩn bị') || false,
      };
    })()`);
    assert(goldenBoardOpen.status === 'ready' && goldenBoardOpen.expanded === 'true', 'Golden board did not finish loading after opening.');
    assert(!goldenBoardOpen.hasPreparationError, 'Golden board still reports that its read model is not ready.');
    assert(goldenBoardOpen.backgroundColor === 'rgb(180, 83, 9)'
      && goldenBoardOpen.color === 'rgb(255, 255, 255)'
      && goldenBoardOpen.opacity === '1', 'Golden-board open toggle is faded.');
    student.goldenBoardOpen = goldenBoardOpen;
    studentScreenshot = await screenshot('student-desktop');
    await viewport(390, 844, true);
    await delay(150);
    const studentMobile = await evaluate(surfaceMetricsExpression('#student-area-root'));
    assert(studentMobile && !studentMobile.overflowX, 'Student 390px has horizontal document overflow.');
    student.mobile = studentMobile;
    studentMobileScreenshot = await screenshot('student-mobile-390');
  }

  const report = {
    qaRoot,
    screenshots: {
      adminDesktop: adminScreenshot,
      adminMobile: adminMobileScreenshot,
      homeDesktop: homeScreenshot,
      homeMobile: homeMobileScreenshot,
      examCardsDesktop: examCardsDesktopScreenshot,
      examCardsMobile: examCardsMobileScreenshot,
      grammarFiltersDesktop: grammarFiltersDesktopScreenshot,
      grammarFiltersMobile: grammarFiltersMobileScreenshot,
      studentDesktop: studentScreenshot,
      studentMobile: studentMobileScreenshot,
    },
    adminDesktop,
    adminMobile,
    homeDesktop,
    homeMobile,
    examCardsDesktop,
    examCardsMobile,
    grammarFiltersDesktop,
    grammarFiltersMobile,
    vocabListDesktop,
    vocabListMobile,
    student,
  };
  writeFileSync(path.join(qaRoot, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  cdp.close();
}

try {
  await main();
} catch (error) {
  console.error(error);
  if (chromeError.trim()) console.error(chromeError.slice(-2_000));
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
}
