import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INP_BUDGET_MS, inpOf, interactionCount, median, renderMarkdown, summarise } from './inp.ts';

test('INP is the longest event of the worst interaction; events without an interaction id are ignored', () => {
  const entries = [
    { name: 'pointerdown', interactionId: 1, duration: 24 },
    { name: 'click', interactionId: 1, duration: 40 },
    { name: 'keydown', interactionId: 2, duration: 72 },
    { name: 'keyup', interactionId: 2, duration: 16 },
    { name: 'pointerover', interactionId: 0, duration: 400 },
  ];
  assert.equal(inpOf(entries), 72);
  assert.equal(interactionCount(entries), 2);
});

test('no interaction gives 0', () => {
  assert.equal(inpOf([]), 0);
  assert.equal(inpOf([{ name: 'pointermove', interactionId: 0, duration: 300 }]), 0);
});

test('one outlier per 50 interactions is ignored (p98)', () => {
  const entries = Array.from({ length: 60 }, (_, i) => ({ name: 'keydown', interactionId: i + 1, duration: 20 }));
  entries[10] = { name: 'keydown', interactionId: 11, duration: 900 };
  assert.equal(inpOf(entries), 20);
  assert.equal(inpOf(entries.slice(0, 49)), 900);
});

test('median per page against the budget; a run without interactions fails the page', () => {
  const rows = summarise([
    { page: '/chats', inp: 40, interactions: 5 },
    { page: '/chats', inp: 250, interactions: 5 },
    { page: '/chats', inp: 48, interactions: 5 },
    { page: '/chats/:id', inp: 210, interactions: 9 },
    { page: '/chats/:id', inp: 230, interactions: 9 },
    { page: '/settings', inp: 10, interactions: 0 },
  ]);
  assert.deepEqual(
    rows.map((r) => [r.page, r.median, r.pass]),
    [
      ['/chats', 48, true],
      ['/chats/:id', 220, false],
      ['/settings', 10, false],
    ],
  );
  assert.equal(INP_BUDGET_MS, 200);
  assert.ok(Number.isNaN(median([])));
});

test('the Markdown table shows the median, the runs and the verdict', () => {
  const md = renderMarkdown(summarise([{ page: '/chats', inp: 31.6, interactions: 4 }]), 200, 4);
  assert.match(md, /CPU throttle 4x/);
  assert.match(md, /\| `\/chats` \| 32 ms \(200 ms\) \| 32 \| 4 \| pass \|/);
});
