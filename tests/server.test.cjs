const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('../server.cjs');
const G = require('../game.js');

test('two LAN seats: authority, streaming, reconnect, full match, mutual rematch', { timeout: 30000 }, async t => {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const streams = [];
  t.after(async () => { streams.forEach(s => s.abort()); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  async function post(route, body) {
    const res = await fetch(origin + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  }
  async function stream(credentials) {
    const controller = new AbortController(), events = [], waiting = [];
    const res = await fetch(origin + '/api/events?' + new URLSearchParams(credentials), { signal: controller.signal });
    assert.equal(res.status, 200);
    const reader = res.body.getReader(); let buffer = '';
    const result = {
      events, abort: () => controller.abort(),
      wait(predicate) {
        const existing = events.at(-1); if (existing && predicate(existing)) return Promise.resolve(existing);
        return new Promise((resolve, reject) => {
          const item = { predicate, resolve: value => { clearTimeout(timer); resolve(value); } };
          const timer = setTimeout(() => { waiting.splice(waiting.indexOf(item), 1); reject(new Error('Timed out waiting for an SSE state')); }, 3000);
          waiting.push(item);
        });
      }
    };
    streams.push(result);
    (async () => {
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          buffer += new TextDecoder().decode(chunk.value);
          let split;
          while ((split = buffer.indexOf('\n\n')) >= 0) {
            const line = buffer.slice(0, split); buffer = buffer.slice(split + 2);
            if (!line.startsWith('data: ')) continue;
            const event = JSON.parse(line.slice(6)); events.push(event);
            for (let i = waiting.length - 1; i >= 0; i--) if (waiting[i].predicate(event)) waiting.splice(i, 1)[0].resolve(event);
          }
        }
      } catch (e) { if (e.name !== 'AbortError') throw e; }
    })();
    return result;
  }
  assert.equal((await fetch(origin)).status, 200);
  assert.equal((await fetch(origin + '/cards.js')).status, 200);
  assert.equal((await fetch(origin + '/cards.css')).status, 200);
  assert.equal((await fetch(origin + '/table-flip.js')).status, 200);
  assert.equal((await fetch(origin + '/table-flip.css')).status, 200);
  assert.equal((await fetch(origin + '/tutorial.js')).status, 200);
  assert.equal((await fetch(origin + '/server.cjs')).status, 404);
  const info = await (await fetch(origin + '/api/info')).json(); assert.equal(info.port, server.address().port);
  const created = await post('/api/create', {}); assert.equal(created.status, 201);
  const c0 = { code: created.data.code, token: created.data.token };
  const s0 = await stream(c0); await s0.wait(x => !x.ready);
  const waitingMove = await post('/api/action', { ...c0, seq: 0, action: { type: 'roll' } }); assert.equal(waitingMove.status, 400);
  const joined = await post('/api/join', { code: c0.code.toLowerCase() }); assert.equal(joined.status, 200); assert.equal(joined.data.seat, 1);
  const c1 = { code: c0.code, token: joined.data.token };
  const s1 = await stream(c1); await s0.wait(x => x.connected.every(Boolean));
  assert.equal((await post('/api/join', { code: c0.code })).status, 409);
  assert.equal((await post('/api/resume', { code: c0.code, token: 'forged' })).status, 400);
  assert.equal((await post('/api/action', { ...c1, seq: 0, action: { type: 'roll' } })).status, 400);
  const roll = await post('/api/action', { ...c0, seq: 0, action: { type: 'roll' } }); assert.equal(roll.status, 200);
  const first = await s0.wait(x => x.state.seq === 1), second = await s1.wait(x => x.state.seq === 1);
  assert.deepEqual(first.state, second.state); assert.equal(first.state.deck, undefined); assert.equal(first.seats, undefined); assert.equal(first.token, undefined);
  assert.equal((await post('/api/action', { ...c0, seq: 0, action: { type: 'recruit' } })).status, 400, 'stale / duplicate request must not mutate authority');
  s1.abort(); await s0.wait(x => !x.connected[1]);
  assert.equal((await post('/api/action', { ...c0, seq: 1, action: { type: 'end' } })).status, 400, 'pause when peer is offline');
  const resumed = await post('/api/resume', c1); assert.equal(resumed.status, 200); assert.equal(resumed.data.state.seq, 1);
  const reconnect = await stream(c1); await s0.wait(x => x.connected.every(Boolean) && x.state.seq === 1);
  let current = first.state, moves = 0;
  while (current.phase !== 'over' && moves++ < 1500) {
    const actor = current.turn, action = G.chooseAI(current, actor);
    const response = await post('/api/action', { ...(actor === 0 ? c0 : c1), seq: current.seq, action });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    current = (await s0.wait(x => x.state.seq === current.seq + 1)).state;
    current.players.flatMap(G.troops).forEach(unit => { assert.equal(unit.maxHP, G.unitHP(unit.card, unit.role)); assert.ok(unit.hp > 0 && unit.hp <= unit.maxHP); });
  }
  assert.equal(current.phase, 'over');
  const guestFinal = await reconnect.wait(x => x.state.phase === 'over'); assert.deepEqual(guestFinal.state, current);
  const vote0 = await post('/api/rematch', c0); assert.equal(vote0.status, 200);
  const half = await s0.wait(x => x.votes.length === 1); assert.equal(half.state.phase, 'over');
  await post('/api/rematch', c1);
  const fresh = await s0.wait(x => x.gameIndex === 1); assert.equal(fresh.state.seq, 0); assert.equal(fresh.state.turn, 1); assert.equal(fresh.state.deckCount, 52); assert.deepEqual(fresh.votes, []);
  const foreignOrigin = await fetch(origin + '/api/create', { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(foreignOrigin.status, 403);
  t.diagnostic(JSON.stringify({ fullGameMoves: moves, rounds: current.round, matchingClients: true, reconnection: true, rematch: true }));
});
