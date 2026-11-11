const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

test('friendly AI: 4000 held-out games stay around 40% wins against the reference strategy', t => {
  let wins = 0, losses = 0, draws = 0, totalRounds = 0;
  const games = 4000;
  for (let seed = 1; seed <= games; seed++) {
    const world = seeded(seed + 283000), friendly = seeded(seed ^ 182192), reference = seeded(seed ^ 314655);
    const state = G.create(world, seed % 2); let moves = 0;
    while (state.phase !== 'over' && moves++ < 2500) {
      const action = state.turn === 0 ? G.chooseFriendlyAI(state, 0, friendly) : G.chooseAI(state, 1, reference);
      assert.ok(action); G.act(state, state.turn, action, world);
    }
    assert.equal(state.phase, 'over');
    if (state.winner === 0) wins++; else if (state.winner === 1) losses++; else draws++;
    totalRounds += state.round;
  }
  const rate = wins / games;
  t.diagnostic(JSON.stringify({ games, wins, losses, draws, friendlyWinPercent: +(rate * 100).toFixed(2), meanRounds: +(totalRounds / games).toFixed(1), firstPlayer: 'alternating', opponent: 'reference strategy', independentValidationSeeds: true }));
  assert.ok(rate >= .36 && rate <= .44, 'Friendly AI drifted outside 36–44% on the fixed benchmark');
});
