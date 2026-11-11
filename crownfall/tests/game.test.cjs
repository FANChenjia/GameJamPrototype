const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
function ready() { const s = G.create(() => .5); G.act(s, 0, { type: 'roll' }, () => .99); return s; }
function drawNext(s, value) { const index = s.deck.findIndex(c => c.value === value); const card = s.deck.splice(index, 1)[0]; s.deck.push(card); return card; }
function add(s, actor, role, hp, value) {
  const p = s.players[actor], key = role === 'soldier' ? 'soldiers' : 'knights', slot = p[key].indexOf(null);
  if (value) drawNext(s, value);
  const card = s.deck.pop(), maxHP = G.unitHP(card, role);
  return p[key][slot] = { id: card.id, card, role, slot, hp: hp ?? maxHP, maxHP };
}
function conserved(s) {
  const cards = [...s.deck, ...s.discard, ...s.players.flatMap(p => G.troops(p).map(u => u.card))];
  assert.equal(cards.length, 52); assert.equal(new Set(cards.map(c => c.id)).size, 52);
  s.players.flatMap(G.troops).forEach(unit => { assert.equal(unit.maxHP, G.unitHP(unit.card, unit.role)); assert.ok(unit.hp > 0 && unit.hp <= unit.maxHP); });
}
function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
test('one shared deck; two Joker commanders; only commanders at start', () => {
  const s = G.create(); assert.equal(s.deck.length, 52); conserved(s);
  assert.equal(s.players[0].hp, 24); assert.equal(s.players[1].hp, 24);
  assert.equal(s.players.flatMap(G.troops).length, 0);
  assert.throws(() => G.act(s, 0, { type: 'attack', target: 'commander-1' }), /先掷骰/);
});
test('a die gives exactly 1–6 AP and can only be rolled once', () => {
  for (let i = 1; i <= 6; i++) { const s = G.create(); G.act(s, 0, { type: 'roll' }, () => (i - .5) / 6); assert.equal(s.ap, i); assert.equal(s.die, i); assert.throws(() => G.act(s, 0, { type: 'roll' }), /已经掷骰/); }
});
test('invalid actor, invalid target, and insufficient AP do not change the state', () => {
  const s = ready(), before = JSON.stringify(s);
  assert.throws(() => G.act(s, 1, { type: 'recruit' }), /等待/); assert.equal(JSON.stringify(s), before);
  assert.throws(() => G.act(s, 0, { type: 'promote', target: 'none' }), /选择/); assert.equal(JSON.stringify(s), before);
  s.ap = 1; const low = JSON.stringify(s); assert.throws(() => G.act(s, 0, { type: 'attack', target: 'commander-1' }), /不足/); assert.equal(JSON.stringify(s), low);
});
test('recruit costs 1, draws a real card, caps at two per turn', () => {
  const s = ready(); const top = s.deck.at(-1); G.act(s, 0, { type: 'recruit' });
  assert.equal(s.ap, 5); assert.equal(s.players[0].soldiers[0].card.id, top.id); assert.equal(s.players[0].soldiers[0].hp, top.value);
  G.act(s, 0, { type: 'recruit' }); assert.throws(() => G.act(s, 0, { type: 'recruit' }), /最多/); conserved(s);
});
test('promotion costs 2, restores card value +4 HP and caps at three knights', () => {
  const s = ready(), unit = add(s, 0, 'soldier', 2, 6); G.act(s, 0, { type: 'promote', target: unit.id });
  assert.equal(s.ap, 4); assert.equal(s.players[0].soldiers[0], null); assert.equal(s.players[0].knights[0].hp, 10); assert.equal(s.players[0].knights[0].id, unit.id);
  add(s, 0, 'knight'); add(s, 0, 'knight'); const next = add(s, 0, 'soldier'); assert.throws(() => G.act(s, 0, { type: 'promote', target: next.id }), /已满/); conserved(s);
});
test('damage mapping includes A, face cards, and K', () => {
  assert.deepEqual(Array.from({ length: 13 }, (_, i) => G.power({ value: i + 1 })), [2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6]);
});
test('soldiers receive exactly twice knight damage', () => {
  for (const [role, remaining] of [['soldier', 2], ['knight', 8]]) {
    const s = ready(), target = add(s, 1, role, undefined, 6); drawNext(s, 1);
    G.act(s, 0, { type: 'attack', target: target.id }); assert.equal(target.hp, remaining); assert.equal(s.ap, 4); conserved(s);
  }
});
test('outer layers block commanders and overflow pierces to the next layer', () => {
  const s = ready(), soldier = add(s, 1, 'soldier', undefined, 6); const before = JSON.stringify(s);
  assert.throws(() => G.act(s, 0, { type: 'attack', target: 'commander-1' }), /最外层/); assert.equal(JSON.stringify(s), before);
  drawNext(s, 13); const ev = G.act(s, 0, { type: 'attack', target: soldier.id });
  assert.equal(ev.damage, 6); assert.equal(ev.hits[0].damage, 6); assert.equal(ev.hits[1].damage, 3); assert.equal(s.players[1].hp, 21); assert.equal(s.players[1].soldiers[0], null); conserved(s);
});
test('three knights add 3 base damage before soldier multiplication', () => {
  const s = ready(); add(s, 0, 'knight'); add(s, 0, 'knight'); add(s, 0, 'knight');
  const soldier = add(s, 1, 'soldier', undefined, 6), knight = add(s, 1, 'knight'); const initialHP = knight.hp; drawNext(s, 1);
  const ev = G.act(s, 0, { type: 'attack', target: soldier.id }); assert.equal(ev.damage, 5); assert.equal(knight.hp, initialHP - 2); conserved(s);
});
test('every rank A–K recruits at face-value HP and promotes to value +4', () => {
  for (let value = 1; value <= 13; value++) {
    const s = ready(), card = drawNext(s, value);
    G.act(s, 0, { type: 'recruit' });
    const unit = s.players[0].soldiers[0]; assert.equal(unit.hp, value); assert.equal(unit.maxHP, value);
    unit.hp = 1;
    G.act(s, 0, { type: 'promote', target: card.id });
    assert.equal(unit.hp, value + 4); assert.equal(unit.maxHP, value + 4); conserved(s);
  }
});
test('odd soldier HP spends whole base points before passing overflow onward', () => {
  const s = ready(), target = add(s, 1, 'soldier', undefined, 7); drawNext(s, 13);
  const ev = G.act(s, 0, { type: 'attack', target: target.id });
  assert.equal(ev.hits[0].damage, 7); assert.equal(ev.hits[1].damage, 2); assert.equal(s.players[1].hp, 22); conserved(s);
});
test('old fixed-HP saves migrate once, preserving health ratio, units and turn', () => {
  const s = ready(), soldier = add(s, 0, 'soldier', 3, 10), knight = add(s, 1, 'knight', 4, 13);
  s.version = 1; soldier.maxHP = 6; knight.maxHP = 8;
  const seq = s.seq; G.migrate(s);
  assert.equal(s.version, 2); assert.equal(s.seq, seq); assert.equal(s.turn, 0);
  assert.equal(soldier.maxHP, 10); assert.equal(soldier.hp, 5); assert.equal(knight.maxHP, 17); assert.equal(knight.hp, 9); conserved(s);
  const after = JSON.stringify(s); G.migrate(s); assert.equal(JSON.stringify(s), after);
});
test('AI promotion values restored health and high-rank defenders', () => {
  const s = ready(), low = add(s, 0, 'soldier', undefined, 1), high = add(s, 0, 'soldier', undefined, 13);
  const move = G.chooseAI(s, 0, () => .99); assert.equal(move.type, 'promote'); assert.equal(move.target, high.id);
  high.hp = 1; low.hp = 1;
  assert.equal(G.chooseAI(s, 0, () => .99).target, high.id);
});
test('turn end clears AP and recruit cap, switches actor, and updates round', () => {
  const s = ready(); G.act(s, 0, { type: 'recruit' }); G.act(s, 0, { type: 'end' });
  assert.equal(s.turn, 1); assert.equal(s.ap, 0); assert.equal(s.recruits, 0); assert.equal(s.phase, 'roll'); assert.equal(s.round, 1);
  G.act(s, 1, { type: 'roll' }); G.act(s, 1, { type: 'end' }); assert.equal(s.round, 2);
});
test('commander death ends game and prevents any further actions', () => {
  const s = ready(); s.players[1].hp = 1; drawNext(s, 1); G.act(s, 0, { type: 'attack', target: 'commander-1' });
  assert.equal(s.winner, 0); assert.equal(s.phase, 'over'); assert.equal(s.players[1].hp, 0); assert.throws(() => G.act(s, 0, { type: 'end' }), /已结束/);
});
test('exhaustion reshuffles only discard and applies increasing symmetric fatigue', () => {
  const s = ready(); s.discard.push(...s.deck.splice(0)); G.act(s, 0, { type: 'recruit' });
  assert.equal(s.fatigue, 2); assert.equal(s.players[0].hp, 22); assert.equal(s.players[1].hp, 22); conserved(s);
  s.discard.push(...s.deck.splice(0)); G.act(s, 0, { type: 'recruit' }); assert.equal(s.fatigue, 4); assert.equal(s.players[0].hp, 18); conserved(s);
});
test('simultaneous fatigue deaths are a draw', () => {
  const s = ready(); s.players.forEach(p => p.hp = 2); s.discard.push(...s.deck.splice(0)); G.act(s, 0, { type: 'recruit' });
  assert.equal(s.phase, 'over'); assert.equal(s.winner, -1); conserved(s);
});
test('public snapshots never leak deck order or discarded hidden state', () => {
  const s = ready(), v = G.snapshot(s); assert.equal(v.deck, undefined); assert.equal(v.discard, undefined); assert.equal(v.deckCount, 52);
  v.players[0].hp = 0; assert.equal(s.players[0].hp, 24);
});
test('300 seeded complete AI matches: valid moves, deck conservation, no deadlocks', t => {
  const rounds = []; let firstWins = 0, draws = 0;
  for (let i = 1; i <= 300; i++) {
    const rng = seeded(i), first = i % 2, s = G.create(rng, first); let actions = 0;
    while (s.phase !== 'over' && actions++ < 1500) {
      const action = G.chooseAI(s, s.turn, rng); assert.ok(action); G.act(s, s.turn, action, rng); conserved(s);
    }
    assert.equal(s.phase, 'over', 'seed ' + i + ' did not end'); assert.ok(s.round < 100);
    if (s.winner === first) firstWins++; if (s.winner === -1) draws++; rounds.push(s.round);
  }
  rounds.sort((a, b) => a - b);
  t.diagnostic(JSON.stringify({ games: 300, medianRounds: rounds[150], maxRounds: Math.max(...rounds), firstWinPercent: +(firstWins / 3).toFixed(1), draws }));
});
