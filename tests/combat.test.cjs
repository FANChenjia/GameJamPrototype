const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scope = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'engine.js'), 'utf8'), scope);
const { Game, DEFAULTS, TEMPLATES, copy } = scope.Meadow;

function fixture({ range = 3, damage = 10, col = 1, shape = [[0, 0]] } = {}) {
  const game = new Game({ ...DEFAULTS, spawnInterval: 60, travelTime: 600, pointsPerSecond: 0 });
  const unit = game.place({ ...copy(TEMPLATES[0]), attackSpeed: 1, damage, range, shape }, col, 2);
  assert.ok(unit);
  let id = 1000;
  function monster(lane, y = 0.25, hp = 100) {
    const monster = { id: ++id, lane, y, hp, maxHp: hp, variant: 0, wobble: 0, hit: 0 };
    game.monsters.push(monster);
    return monster;
  }
  return { game, unit, monster };
}

test('三列范围：一次普攻同时命中三列内所有怪物，范围外不受伤', () => {
  const { game, monster } = fixture();
  const targets = [monster(0), monster(1), monster(2)];
  const outside = [monster(3), monster(4)];
  game.start();
  game.advance(0.1);
  assert.equal(game.bullets.length, 3);
  assert.equal(game.pulses.length, 1);
  game.advance(0.25);
  targets.forEach(target => assert.equal(target.hp, 90));
  outside.forEach(target => assert.equal(target.hp, 100));
});

test('同一列多个怪物全部命中，不仅攻击最前面的一个', () => {
  const { game, monster } = fixture({ range: 1 });
  const targets = [monster(1, 0.1), monster(1, 0.4), monster(1, 0.8)];
  const outside = monster(0);
  game.start();
  game.advance(0.35);
  targets.forEach(target => assert.equal(target.hp, 90));
  assert.equal(outside.hp, 100);
});

test('齐射到达前不扣血，近处和远处的目标在同一步同时受伤', () => {
  const { game, monster } = fixture();
  const targets = [monster(0, 0.1), monster(1, 0.5), monster(2, 0.9)];
  game.start();
  game.advance(0.25);
  targets.forEach(target => assert.equal(target.hp, 100));
  game.advance(0.1);
  targets.forEach(target => assert.equal(target.hp, 90));
});

test('整次齐射只有一次攻速冷却，不随目标数量增加或重复扣血', () => {
  const { game, unit, monster } = fixture();
  const targets = Array.from({ length: 9 }, (_, i) => monster(i % 3, 0.1 + i * 0.05));
  game.start();
  game.advance(0.35);
  assert.ok(unit.cooldown > 0.6 && unit.cooldown < 0.7);
  game.advance(0.6);
  targets.forEach(target => assert.equal(target.hp, 90));
  game.advance(0.4);
  targets.forEach(target => assert.equal(target.hp, 80));
});

test('覆盖列内没有目标时不发射，不消耗冷却', () => {
  const { game, unit, monster } = fixture({ range: 1 });
  const outside = monster(4);
  game.start();
  game.advance(0.5);
  assert.equal(game.bullets.length, 0);
  assert.equal(game.pulses.length, 0);
  assert.equal(unit.cooldown, 0);
  assert.equal(outside.hp, 100);
});

test('齐射击退多只怪物，每只只奖励一次，即使原乐器与分身同时命中', () => {
  const { game, unit, monster } = fixture({ damage: 100 });
  const targets = [monster(0), monster(1), monster(2)];
  const card = game.hand.find(card => card.type === 'clone');
  assert.ok(game.useCard(card.id, unit.id).ok);
  game.start();
  game.advance(0.35);
  assert.equal(game.kills, targets.length);
  assert.equal(game.points, DEFAULTS.initialPoints + targets.length * DEFAULTS.killReward);
  assert.equal(game.monsters.length, 0);
});

test('分身独立齐射，对每个范围内目标追加一次完整伤害', () => {
  const { game, unit, monster } = fixture();
  const targets = [monster(0), monster(1), monster(2)];
  game.useCard(game.hand.find(card => card.type === 'clone').id, unit.id);
  game.start();
  game.advance(0.35);
  targets.forEach(target => assert.equal(target.hp, 80));
});

test('延音扩大齐射覆盖，偶数占格仍只允许偶数列', () => {
  const { game, unit, monster } = fixture({ range: 2, shape: [[0, 0], [1, 0]] });
  game.useCard(game.hand.find(card => card.type === 'range').id, unit.id);
  assert.equal(game.attackRange(unit), 4);
  const lanes = Array.from(game.lanes(unit));
  const targets = Array.from({ length: 5 }, (_, lane) => monster(lane));
  game.start();
  game.advance(0.35);
  targets.forEach(target => assert.equal(target.hp, lanes.includes(target.lane) ? 90 : 100));
});

test('边缘三列与拖动后覆盖列正确，全部弹道从新的占格中心发出', () => {
  const { game, unit, monster } = fixture({ col: 0 });
  assert.deepEqual(Array.from(game.lanes(unit)), [0, 1]);
  assert.ok(game.move(unit.id, 4, 1));
  assert.deepEqual(Array.from(game.lanes(unit)), [3, 4]);
  [3, 4].forEach(lane => monster(lane));
  game.start();
  game.advance(0.1);
  assert.equal(game.bullets.length, 2);
  for (const note of game.bullets) {
    assert.equal(note.from.x, 4.5);
    assert.ok(Math.abs(note.from.y - ((0.65 + 1.5 * 0.08 - 0.04) / 0.56)) < 1e-8);
  }
});


test('四列范围以两列占格的中心为轴，左两列右两列同时命中', () => {
  const { game, unit, monster } = fixture({ range: 4, col: 1, shape: [[0, 0], [1, 0]] });
  assert.equal(game.center(unit).x, 2);
  assert.deepEqual(Array.from(game.lanes(unit)), [0, 1, 2, 3]);
  const targets = Array.from({ length: 5 }, (_, lane) => monster(lane));
  game.start();
  game.advance(0.1);
  assert.equal(game.bullets.length, 4);
  game.advance(0.25);
  targets.forEach(target => assert.equal(target.hp, target.lane < 4 ? 90 : 100));
});

test('四列范围靠近左边缘时截断，不挪到右边补齐', () => {
  const { game, unit, monster } = fixture({ range: 4, col: 0, shape: [[0, 0], [1, 0]] });
  assert.equal(game.center(unit).x, 1);
  assert.deepEqual(Array.from(game.lanes(unit)), [0, 1, 2]);
  const targets = Array.from({ length: 5 }, (_, lane) => monster(lane));
  game.start();
  game.advance(0.35);
  targets.forEach(target => assert.equal(target.hp, target.lane < 3 ? 90 : 100));
});

test('四列范围靠近右边缘时截断，不挪到左边补齐', () => {
  const { game, unit } = fixture({ range: 4, col: 3, shape: [[0, 0], [1, 0]] });
  assert.equal(game.center(unit).x, 4);
  assert.deepEqual(Array.from(game.lanes(unit)), [2, 3, 4]);
});

test('四列范围原点位于中间单列正中时，命中左两列和右两列', () => {
  const { game, unit, monster } = fixture({ range: 4, col: 2 });
  assert.equal(game.center(unit).x, 2.5);
  assert.deepEqual(Array.from(game.lanes(unit)), [0, 1, 3, 4]);
  const targets = Array.from({ length: 5 }, (_, lane) => monster(lane));
  game.start();
  game.advance(0.35);
  targets.forEach(target => assert.equal(target.hp, target.lane === 2 ? 100 : 90));
});

test('垂直偶数占格的四列范围也按左右各两列计算', () => {
  const { game, unit } = fixture({ range: 4, col: 2, shape: [[0, 0], [0, 1]] });
  assert.deepEqual(Array.from(game.lanes(unit)), [0, 1, 3, 4]);
});

test('拖动四列乐器后，覆盖范围围绕新中心重新计算', () => {
  const { game, unit, monster } = fixture({ range: 4, col: 1, shape: [[0, 0], [1, 0]] });
  assert.ok(game.move(unit.id, 2, 1));
  assert.deepEqual(Array.from(game.lanes(unit)), [1, 2, 3, 4]);
  const targets = Array.from({ length: 5 }, (_, lane) => monster(lane));
  game.start();
  game.advance(0.35);
  targets.forEach(target => assert.equal(target.hp, target.lane === 0 ? 100 : 90));
});
