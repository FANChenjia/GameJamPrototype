const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scope = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'engine.js'), 'utf8'), scope);
const { Game, DEFAULTS, TEMPLATES, copy, normalizeInstrument, validateTemplate } = scope.Meadow;

function fixture({ range = 3, damage = 10, col = 1, shape = [[0, 0]], piercing = true, areaAttack = false, attackSpeed = 1, random } = {}) {
  const game = new Game({ ...DEFAULTS, spawnInterval: 60, travelTime: 600, pointsPerSecond: 0 }, random);
  const unit = game.place({ ...copy(TEMPLATES[0]), attackSpeed, damage, range, shape, piercing, areaAttack }, col, 2);
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


test('关闭贯穿：只攻击覆盖范围内最靠近防线的一只，范围外更近的目标不影响选择', () => {
  const { game, monster } = fixture({ piercing: false });
  const rear = monster(0, 0.2);
  const middle = monster(1, 0.5);
  const front = monster(2, 0.8);
  const outside = monster(4, 0.95);
  game.start();
  game.advance(0.1);
  assert.equal(game.bullets.length, 1);
  assert.equal(game.bullets[0].targetId, front.id);
  assert.deepEqual(Array.from(game.pulses[0].lanes), [2]);
  game.advance(0.25);
  assert.equal(front.hp, 90);
  [rear, middle, outside].forEach(target => assert.equal(target.hp, 100));
});

test('关闭贯穿：同列多个怪物也只命中最前面的一只', () => {
  const { game, monster } = fixture({ piercing: false, range: 1 });
  const rear = monster(1, 0.1);
  const middle = monster(1, 0.4);
  const front = monster(1, 0.7);
  game.start();
  game.advance(0.35);
  assert.equal(front.hp, 90);
  assert.equal(middle.hp, 100);
  assert.equal(rear.hp, 100);
});

test('关闭贯穿：第一只被击退后，下次普攻才选择后面的目标', () => {
  const { game, monster } = fixture({ piercing: false, damage: 100 });
  const rear = monster(0, 0.2);
  monster(2, 0.7);
  game.start();
  game.advance(0.35);
  assert.equal(game.kills, 1);
  assert.equal(rear.hp, 100);
  game.advance(1);
  assert.equal(game.kills, 2);
  assert.equal(game.monsters.length, 0);
});

test('关闭贯穿：相同进度时稳定选择先出现的一个目标', () => {
  const { game, monster } = fixture({ piercing: false });
  const first = monster(0, 0.4);
  const second = monster(2, 0.4);
  game.start();
  game.advance(0.35);
  assert.equal(first.hp, 90);
  assert.equal(second.hp, 100);
});

test('关闭贯穿：分身继承单体模式，分别攻击第一只', () => {
  const { game, unit, monster } = fixture({ piercing: false });
  const front = monster(2, 0.7);
  const rear = monster(0, 0.2);
  game.useCard(game.hand.find(card => card.type === 'clone').id, unit.id);
  assert.equal(game.units[1].profile.piercing, false);
  game.start();
  game.advance(0.35);
  assert.equal(front.hp, 80);
  assert.equal(rear.hp, 100);
});

test('贯穿配置可以序列化，并在重置时保留', () => {
  const { game, unit } = fixture({ piercing: false });
  const stored = JSON.parse(JSON.stringify(unit.original));
  assert.equal(stored.piercing, false);
  const restored = new Game();
  const placed = restored.place(stored, 1, 2);
  restored.reset();
  assert.equal(restored.units[0].id, placed.id);
  assert.equal(restored.units[0].profile.piercing, false);
});

test('旧版乐器与旧布置缺少开关时默认保留贯穿，且不修改原始数据', () => {
  const legacy = copy(TEMPLATES[0]);
  delete legacy.piercing;
  const normalized = normalizeInstrument(legacy);
  assert.equal(normalized.piercing, true);
  assert.equal(legacy.piercing, undefined);
  assert.equal(validateTemplate(legacy), '');
  const game = new Game({ ...DEFAULTS, spawnInterval: 60, travelTime: 600 });
  const unit = game.place(legacy, 1, 2);
  assert.equal(unit.profile.piercing, true);
  for (let lane = 0; lane < 3; lane++) {
    game.monsters.push({ id: 1000 + lane, lane, y: 0.2, hp: 100, maxHp: 100, hit: 0 });
  }
  game.start();
  game.advance(0.1);
  assert.equal(game.bullets.length, 3);
});

test('贯穿开关只接受布尔值，不把字符串或空值当成配置', () => {
  assert.equal(validateTemplate({ ...copy(TEMPLATES[0]), piercing: false }), '');
  assert.equal(validateTemplate({ ...copy(TEMPLATES[0]), piercing: true }), '');
  assert.match(validateTemplate({ ...copy(TEMPLATES[0]), piercing: 'false' }), /贯穿/);
  assert.match(validateTemplate({ ...copy(TEMPLATES[0]), piercing: null }), /贯穿/);
});

test('改变模板的贯穿设置不会改动已部署的乐器快照', () => {
  const template = { ...copy(TEMPLATES[0]), piercing: false };
  const game = new Game();
  const existing = game.place(template, 0, 0);
  template.piercing = true;
  const later = game.place(template, 1, 0);
  assert.equal(existing.profile.piercing, false);
  assert.equal(existing.original.piercing, false);
  assert.equal(later.profile.piercing, true);
});


test('范围攻击：每个覆盖列独立随机生成一个纵向三分之一区域，不再发射普通音符', () => {
  const rolls = [0, 0.4, 0.99];
  const { game } = fixture({ areaAttack: true, random: () => rolls.shift() });
  game.start();
  game.advance(0.1);
  assert.equal(game.areas.length, 3);
  assert.deepEqual(Array.from(game.areas, area => area.lane), [0, 1, 2]);
  assert.deepEqual(Array.from(game.areas, area => area.band), [0, 1, 2]);
  game.areas.forEach(area => assert.ok(Math.abs(area.end - area.start - 1 / 3) < 1e-9));
  assert.equal(game.bullets.length, 0);
});

test('范围攻击：一个攻击间隔内恰好结算三次，每次按有效攻速的3/4计算', () => {
  const { game, monster } = fixture({ areaAttack: true, range: 1, damage: 9999, random: () => 0.5 });
  const target = monster(1, 0.5);
  game.start();
  game.advance(0.25);
  assert.equal(target.hp, 100);
  assert.equal(game.areas[0].ticks, 0);
  game.advance(0.1);
  assert.equal(target.hp, 99.25);
  assert.equal(game.areas[0].ticks, 1);
  game.advance(0.34);
  assert.equal(target.hp, 98.5);
  assert.equal(game.areas[0].ticks, 2);
  game.units = [];
  game.advance(0.32);
  assert.equal(target.hp, 97.75);
  assert.equal(game.areas.length, 0);
  game.advance(1);
  assert.equal(target.hp, 97.75);
});

test('范围攻击：只伤害对应列、对应纵向区域中的怪物', () => {
  const { game, monster } = fixture({ areaAttack: true, range: 1, random: () => 0.5 });
  const inside = [monster(1, 0.4), monster(1, 0.6)];
  const outside = [monster(1, 0.1), monster(1, 0.8), monster(0, 0.5), monster(2, 0.5)];
  game.start();
  game.advance(0.35);
  inside.forEach(target => assert.equal(target.hp, 99.25));
  outside.forEach(target => assert.equal(target.hp, 100));
});

test('范围攻击优先于贯穿关闭，区域内多只怪物仍同时受伤', () => {
  const { game, monster } = fixture({ areaAttack: true, piercing: false, range: 1, random: () => 0.5 });
  const targets = [monster(1, 0.42), monster(1, 0.57)];
  game.start();
  game.advance(0.35);
  targets.forEach(target => assert.equal(target.hp, 99.25));
  assert.equal(game.bullets.length, 0);
});

test('范围攻击：急板计入新区域的伤害和周期，已经生成的区域保留施放时数值', () => {
  const { game, unit } = fixture({ areaAttack: true, range: 1, random: () => 0.5 });
  unit.speedBonus = 0.5;
  game.start();
  game.advance(0.02);
  const area = game.areas[0];
  assert.equal(area.damage, 1.125);
  assert.ok(Math.abs(area.duration - 2 / 3) < 1e-9);
  assert.ok(Math.abs(area.interval - 2 / 9) < 1e-9);
  game.useCard(game.hand.find(card => card.type === 'speed').id, unit.id);
  assert.equal(game.attackSpeed(unit), 1.75);
  assert.equal(area.damage, 1.125);
  assert.ok(Math.abs(area.duration - 2 / 3) < 1e-9);
});

test('伤害区使区域内怪物移动速度降为75%，区域外不减速，重叠不叠加', () => {
  const { game, monster } = fixture({ areaAttack: true, range: 1, random: () => 0.5 });
  game.start();
  game.advance(0.02);
  game.areas.push({ ...game.areas[0], id: 999 });
  game.units = [];
  const inside = monster(1, 0.5);
  const outside = monster(2, 0.5);
  game.advance(0.2);
  assert.ok(Math.abs(inside.y - 0.5 - 0.2 / 600 * 0.75) < 1e-9);
  assert.ok(Math.abs(outside.y - 0.5 - 0.2 / 600) < 1e-9);
  assert.equal(inside.slowed, true);
  assert.equal(outside.slowed, false);
});

test('怪物离开伤害区后立即恢复正常移速', () => {
  const { game, monster } = fixture({ areaAttack: true, range: 1, random: () => 0.5 });
  const target = monster(1, 0.5);
  game.start();
  game.advance(0.05);
  assert.equal(target.slowed, true);
  game.units = [];
  target.y = 0.8;
  game.advance(0.1);
  assert.equal(target.slowed, false);
  assert.ok(Math.abs(target.y - 0.8 - 0.1 / 600) < 1e-9);
});

test('伤害区结束后清除减速，不遗留永久状态', () => {
  const { game, monster } = fixture({ areaAttack: true, range: 1, random: () => 0.5 });
  const target = monster(1, 0.5);
  game.start();
  game.advance(0.1);
  game.units = [];
  game.advance(0.91);
  assert.equal(game.areas.length, 0);
  assert.equal(target.slowed, false);
  const before = target.y;
  game.advance(0.1);
  assert.ok(Math.abs(target.y - before - 0.1 / 600) < 1e-9);
});

test('伤害区每一跳重新检测占位，后进入者受伤，离开后不受后续伤害', () => {
  const { game, monster } = fixture({ areaAttack: true, range: 1, random: () => 0.5 });
  game.start();
  game.advance(0.4);
  game.units = [];
  const newcomer = monster(1, 0.5);
  game.advance(0.3);
  assert.equal(newcomer.hp, 99.25);
  newcomer.y = 0.8;
  game.advance(0.31);
  assert.equal(newcomer.hp, 99.25);
});

test('分身继承范围攻击并独立生成区域，重叠区域独立结算伤害', () => {
  const { game, unit, monster } = fixture({ areaAttack: true, range: 1, random: () => 0.5 });
  const target = monster(1, 0.5);
  game.useCard(game.hand.find(card => card.type === 'clone').id, unit.id);
  assert.equal(game.units[1].profile.areaAttack, true);
  game.start();
  game.advance(0.35);
  assert.equal(game.areas.length, 2);
  assert.equal(target.hp, 98.5);
  assert.equal(target.slowed, true);
});

test('多个伤害区同时击退同一个怪物时只奖励一次', () => {
  const { game, unit, monster } = fixture({ areaAttack: true, range: 1, random: () => 0.5 });
  monster(1, 0.5, 0.75);
  game.useCard(game.hand.find(card => card.type === 'clone').id, unit.id);
  game.start();
  game.advance(0.35);
  assert.equal(game.kills, 1);
  assert.equal(game.points, DEFAULTS.initialPoints + DEFAULTS.killReward);
  assert.equal(game.monsters.length, 0);
});

test('高攻速时一帧跨过多个结算点也不会漏掉三次伤害', () => {
  const { game, monster } = fixture({ areaAttack: true, range: 1, attackSpeed: 30, random: () => 0.5 });
  const target = monster(1, 0.5);
  game.start();
  game.update(1 / 30);
  assert.equal(target.hp, 32.5);
  assert.equal(game.effects.filter(effect => effect.burst).length, 3);
  assert.equal(game.areas.length, 0);
});

test('暂停会冻结伤害区和怪物，重置会清除区域并保留乐器模式', () => {
  const { game, monster } = fixture({ areaAttack: true, range: 1, random: () => 0.5 });
  const target = monster(1, 0.5);
  game.start();
  game.advance(0.1);
  game.pause();
  const areaAge = game.areas[0].age, position = target.y, health = target.hp;
  game.advance(5);
  assert.equal(game.areas[0].age, areaAge);
  assert.equal(target.y, position);
  assert.equal(target.hp, health);
  game.reset();
  assert.equal(game.areas.length, 0);
  assert.equal(game.monsters.length, 0);
  assert.equal(game.units[0].profile.areaAttack, true);
});

test('范围攻击保存为布尔值，旧存档默认关闭且不会改变已有普通攻击行为', () => {
  const legacy = copy(TEMPLATES[0]);
  delete legacy.areaAttack;
  assert.equal(normalizeInstrument(legacy).areaAttack, false);
  assert.equal(validateTemplate(legacy), '');
  assert.match(validateTemplate({ ...legacy, areaAttack: 'true' }), /范围攻击/);
  assert.match(validateTemplate({ ...legacy, areaAttack: null }), /范围攻击/);
  const { game, unit } = fixture({ areaAttack: true });
  const stored = JSON.parse(JSON.stringify(unit.original));
  assert.equal(stored.areaAttack, true);
  const restored = new Game();
  assert.equal(restored.place(stored, 1, 2).profile.areaAttack, true);
  const normal = new Game();
  normal.place(legacy, 1, 2);
  normal.start();
  normal.advance(0.1);
  assert.equal(normal.areas.length, 0);
});


test('伤害区按实际施放时刻计时，连续攻击时不会因帧余量提前消失', () => {
  const { game } = fixture({ areaAttack: true, range: 1, attackSpeed: 1.6, random: () => 0.5 });
  game.start();
  for (let frame = 0; frame < 300; frame++) {
    game.advance(1 / 60);
    assert.ok(game.areas.length > 0, `第 ${frame} 帧应存在有效伤害区`);
    game.areas.forEach(area => assert.ok(Math.abs(area.age - Math.min(area.duration, game.elapsed - area.bornAt)) < 1e-8));
  }
});
