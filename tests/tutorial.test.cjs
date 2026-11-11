const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
const T = require('../tutorial.js');
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
test('tutorial wins all 1000 deck seeds using only the prompted legal actions', t => {
  for (let seed = 1; seed <= 1000; seed++) {
    const state = T.create(seeded(seed));
    assert.equal(state.players[0].hp, 24); assert.equal(state.players[1].hp, 12);
    for (let i = 0; i < T.steps.length; i++) {
      const expected = T.steps[i], action = { type: expected.type, ...(expected.target ? { target: expected.target } : {}) };
      assert.equal(T.allowed(i, action), true); G.act(state, 0, action, T.playerRoll);
      if (action.type === 'end') { G.act(state, 1, { type: 'roll' }, T.opponentRoll); G.act(state, 1, { type: 'end' }); }
      const cards = [...state.deck, ...state.discard, ...state.players.flatMap(p => G.troops(p).map(u => u.card))];
      assert.equal(cards.length, 52); assert.equal(new Set(cards.map(c => c.id)).size, 52);
    }
    assert.equal(state.phase, 'over'); assert.equal(state.winner, 0); assert.equal(state.players[0].hp, 24); assert.equal(state.players[1].hp, 0); assert.equal(state.round, 2);
  }
  t.diagnostic('1000/1000 tutorial victories, 24 HP retained, no random failure path.');
});
test('tutorial gating rejects skips and wrong targets without advancing the lesson', () => {
  assert.equal(T.allowed(0, { type: 'end' }), false);
  assert.equal(T.allowed(2, { type: 'promote', target: 'clubs-6' }), false);
  assert.equal(T.allowed(3, { type: 'attack', target: 'commander-1' }), false);
  assert.equal(T.allowed(7, { type: 'attack', target: 'commander-1' }), true);
  assert.equal(T.allowed(8, { type: 'attack', target: 'commander-1' }), false);
});
test('tutorial setup is isolated from a normal match', () => {
  const normal = G.create(seeded(42)), before = JSON.stringify(normal); T.create(seeded(42));
  assert.equal(JSON.stringify(normal), before); assert.equal(normal.players[1].hp, 24); assert.equal(normal.deck.length, 52);
});
