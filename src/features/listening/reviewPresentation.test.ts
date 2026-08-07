import assert from 'node:assert/strict';
import test from 'node:test';
import {
  containsInternalListeningDisplayValue,
  defaultListeningReviewQuestion,
  formatListeningReviewAnswer,
  formatListeningReviewQuestion,
} from './reviewPresentation';

test('Listening review questions replace template tokens and never expose internal ids', () => {
  assert.equal(
    formatListeningReviewQuestion('Lives at: 15 {{blank-0305b0ae-9dd1-4943-b17c-2e9c1cb50105}} Street', 2, 5),
    'Lives at: 15 _____ Street',
  );
  assert.equal(
    formatListeningReviewQuestion('Part 1 • p1-target-38918157-dca9-4b67-9fc9-2982dd000e09', 1, 0),
    'Part 1 · Vị trí nhân vật 1',
  );
  assert.equal(defaultListeningReviewQuestion(5, 24), 'Part 5 · Vùng tô màu 5');
  assert.equal(formatListeningReviewAnswer('p1-choice-1b8ab652-e300-43f4-9746-a56c573814d8'), 'Không có dữ liệu hiển thị');
  assert.equal(formatListeningReviewAnswer('Mrs Brown'), 'Mrs Brown');
  assert.equal(containsInternalListeningDisplayValue('Part 3 · Monday'), false);
});
