import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LibraryLinkStatus } from '../../../components/admin/LibraryRowControls';

const controlsSource = readFileSync(
  new URL('../../../components/admin/LibraryRowControls.tsx', import.meta.url),
  'utf8',
);
const listeningAdminSource = readFileSync(
  new URL('../../listening/admin/ListeningAdminModule.tsx', import.meta.url),
  'utf8',
);
const grammarAdminSource = readFileSync(
  new URL('../../../components/admin/AdminDashboard.tsx', import.meta.url),
  'utf8',
);
const listeningApiSource = readFileSync(
  new URL('../../listening/api.ts', import.meta.url),
  'utf8',
);

test('Grammar and Listening libraries share the canonical row actions in the required order', () => {
  const actionHooks = [
    'data-library-action="play"',
    'data-library-action="edit"',
    'data-library-action="clone"',
    'data-library-action="results"',
    'data-library-action="delete"',
  ];
  let previousIndex = -1;
  for (const hook of actionHooks) {
    const index = controlsSource.indexOf(hook);
    assert.ok(index > previousIndex, `${hook} must appear after the preceding action`);
    previousIndex = index;
  }
  for (const label of ['Play', 'Sửa', 'Sao chép', 'Kết quả', 'Xóa']) {
    assert.ok(controlsSource.includes(label), `Missing shared action label: ${label}`);
  }

  assert.match(grammarAdminSource, /import \{ LibraryLinkStatus, LibraryRowActions \} from '\.\/LibraryRowControls'/);
  assert.match(listeningAdminSource, /import \{ LibraryLinkStatus, LibraryRowActions \} from '\.\.\/\.\.\/\.\.\/components\/admin\/LibraryRowControls'/);
  assert.match(grammarAdminSource, /<LibraryRowActions/);
  assert.match(listeningAdminSource, /<LibraryRowActions/);
});

test('Listening link column distinguishes private, public, and unpublished records', () => {
  assert.match(listeningAdminSource, /<th className="p-4">Link<\/th>/);
  assert.match(listeningAdminSource, /overflow-x-auto rounded-3xl/);
  assert.match(listeningAdminSource, /<LibraryLinkStatus/);
  assert.match(controlsSource, /visibility === 'assignment'/);
  assert.match(controlsSource, /data-library-link="private"/);
  assert.match(controlsSource, /Link riêng/);
  assert.match(controlsSource, /data-library-link="public"/);
  assert.match(controlsSource, /Công khai/);
  assert.match(controlsSource, /data-library-link="draft"/);
  assert.match(controlsSource, /Chưa xuất bản/);

  const privateMarkup = renderToStaticMarkup(React.createElement(LibraryLinkStatus, {
    visibility: 'assignment',
    privateUrl: 'https://example.test/listening/private',
    onCopyPrivateLink: () => undefined,
  }));
  const publicMarkup = renderToStaticMarkup(React.createElement(LibraryLinkStatus, {
    visibility: 'public',
  }));
  const draftMarkup = renderToStaticMarkup(React.createElement(LibraryLinkStatus, {
    visibility: 'draft',
  }));
  assert.match(privateMarkup, /<button[^>]+data-library-link="private"/);
  assert.doesNotMatch(publicMarkup, /<button/);
  assert.match(publicMarkup, /Công khai/);
  assert.doesNotMatch(draftMarkup, /<button/);
  assert.match(draftMarkup, /Chưa xuất bản/);
});

test('Listening row actions call clone API while delete retains recoverable archive semantics', () => {
  assert.match(listeningAdminSource, /listeningApi\.cloneSet\(token, set\.id\)/);
  assert.match(listeningAdminSource, /listeningApi\.archiveSet\(token, set\.id\)/);
  assert.match(listeningAdminSource, /deleteTitle="Xóa khỏi kho \(lưu trữ có thể phục hồi\)"/);
  assert.match(listeningApiSource, /\/admin\/sets\/\$\{encodeURIComponent\(id\)\}\/clone/);
  assert.match(listeningApiSource, /method: 'POST'/);
});
