const { test } = require('node:test');
const assert = require('node:assert/strict');
const Flip = require('../table-flip.js');
const specs = [
  { kind: 'card', x: -140, y: 180, width: 66, height: 92 },
  { kind: 'card', x: 150, y: 610, width: 66, height: 92 },
  { kind: 'deck', x: -250, y: 400, width: 55, height: 77 },
  { kind: 'die', x: 250, y: 400, width: 55, height: 55 }
];
test('static friction keeps resting cards and dice at their original positions', () => {
  const sim = Flip.createSimulation(850, 820, specs, () => .5);
  for (let i = 0; i < 10; i++) Flip.step(sim, 1 / 120);
  sim.bodies.forEach((b, i) => { assert.ok(Math.abs(b.x - specs[i].x) < 1e-8); assert.ok(Math.abs(b.y - specs[i].y) < 1e-8); assert.equal(b.z, 0); assert.equal(b.slide, 0); assert.equal(b.contact, true); });
});
test('free objects have equal gravitational acceleration and a ballistic trajectory without drag', () => {
  const make = kind => ({ kind, x: 0, y: 0, z: 500, vx: 100, vy: -70, vz: 300, angle: 0, roll: 0, tumble: 0, spin: 0, drag: 0, radius: 1, restitution: .2, bounces: 0 });
  const paper = make('card'), die = make('die');
  for (let i = 0; i < 60; i++) { Flip.advanceFree(paper, 1 / 120, 980, -10000); Flip.advanceFree(die, 1 / 120, 980, -10000); }
  assert.ok(Math.abs(paper.x - 50) < 1e-8); assert.ok(Math.abs(paper.y + 35) < 1e-8);
  assert.ok(Math.abs(paper.z - (500 + 300 * .5 - .5 * 980 * .5 ** 2)) < 1e-8);
  assert.ok(Math.abs(paper.z - die.z) < 1e-8); assert.ok(Math.abs(paper.vz - die.vz) < 1e-8);
});
test('bounce restitution loses energy and never places an object below the floor', () => {
  const body = { kind: 'die', x: 0, y: 0, z: 2, vx: 100, vy: 0, vz: -500, angle: 0, roll: 0, tumble: 0, spin: 0, drag: 0, radius: 1, restitution: .38, bounces: 0, width: 55 };
  Flip.advanceFree(body, .02, 0, 0);
  assert.equal(body.z, 1); assert.equal(body.vz, 190); assert.ok(body.vx < 100); assert.equal(body.bounces, 1);
});
test('dice bounce follows one continuous path and returns to its original resting orientation', () => {
  const { frames, duration, revealAt } = Flip.diceBounceFrames();
  const y = frames.map(f => Number(f.transform.match(/translateY\(([-.\d]+)px\)/)[1]));
  const angles = frames.map(f => Number(f.transform.match(/rotate\(([-.\d]+)deg\)/)[1]));
  assert.equal(y[0], 0); assert.equal(y.at(-1), 0); assert.ok(Math.min(...y) < -40); assert.ok(Math.max(...y) <= 0);
  for (let i = 1; i < y.length; i++) { assert.ok(Math.abs(y[i] - y[i - 1]) < 4, 'no position cut'); assert.ok(Math.abs(angles[i] - angles[i - 1]) < 3, 'no rotation cut'); }
  assert.equal(angles[0], 9); assert.equal(angles.at(-1), 9); assert.ok(revealAt < duration * .6, 'final face settles before motion ends');
});
test('a flip releases each object continuously, preserving table momentum before gravity takes over', t => {
  const sim = Flip.createSimulation(850, 820, specs, () => .5), departures = [];
  for (let frame = 0; frame < 240; frame++) {
    const before = sim.bodies.map(b => ({ x: b.x, y: b.y, z: b.z, contact: b.contact }));
    Flip.step(sim, 1 / 120);
    sim.bodies.forEach((b, i) => {
      for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'angle', 'roll']) assert.ok(Number.isFinite(b[key]), key);
      assert.ok(Math.hypot(b.x - before[i].x, b.y - before[i].y, b.z - before[i].z) < 120, 'no teleport at detachment');
      assert.ok(b.z >= sim.floor + b.radius - .001 || b.contact, 'no floor penetration');
      if (before[i].contact && !b.contact) { assert.ok(Math.hypot(b.vx, b.vy, b.vz) > 1); departures.push({ kind: b.kind, time: +sim.time.toFixed(3), speed: Math.round(Math.hypot(b.vx, b.vy, b.vz)) }); }
    });
  }
  assert.equal(departures.length, specs.length); assert.equal(sim.table.released, true);
  assert.ok(new Set(departures.map(x => x.time)).size > 1, 'objects do not all fly at an arbitrary single keyframe');
  assert.ok(sim.bodies.some(b => b.bounces > 0));
  assert.ok(sim.bodies.filter(b => b.kind !== 'die').every(b => b.bounces <= 3), 'paper settles without numerical micro-bounces');
  t.diagnostic(JSON.stringify({ departures, bounces: sim.bodies.map(b => b.bounces) }));
});
