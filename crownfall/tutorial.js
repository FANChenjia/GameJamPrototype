(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./game.js'));
  else root.CrownfallTutorial = factory(root.Crownfall);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G) {
  'use strict';
  const steps = Object.freeze([
    { type: 'roll', title: '先掷骰，获得行动点', text: '点一下桌上的骰子。这次会有 6 点，足够试试排兵、册封和攻击。', button: 'dice' },
    { type: 'recruit', title: '抽一张牌，排成士兵', text: '点击「排兵」，花 1 点。抽到的 K 有 13 点，所以是 13 生命。', button: 'recruit-button' },
    { type: 'promote', target: 'spades-13', title: '为这名士兵册封', text: '点「册封」，再点你的 K 士兵。花 2 点，回满至 17 生命，并让每次攻击 +1。', button: 'promote-button' },
    { type: 'attack', target: 'clubs-6', title: '试着突破最外层', text: '点「攻击」，再点虎鲸的士兵。攻击会先亮牌；士兵承受双倍伤害，余伤继续突破。', button: 'attack-button' },
    { type: 'end', title: '把回合交给虎鲸', text: '点「结束回合」。剩下的 1 点会清空，虎鲸会把下一回合交还给你。', button: 'end-button' },
    { type: 'roll', title: '再掷骰，准备收尾', text: '对手的主将只剩 12 生命。再掷骰，这回合练习击破骑士，再攻击主将。', button: 'dice' },
    { type: 'attack', target: 'hearts-1', title: '先清掉最后的骑士', text: '点「攻击」，再点虎鲸剩下的骑士。击破后，余伤会直接打到主将。', button: 'attack-button' },
    { type: 'attack', target: 'commander-1', title: '最后一击，拿下王冠', text: '敌阵已空。点「攻击」，再点虎鲸的 Joker 主将，赢下你的第一局。', button: 'attack-button' }
  ]);
  function create(rng = Math.random) {
    const state = G.create(rng, 0);
    function take(id) { const i = state.deck.findIndex(card => card.id === id); return state.deck.splice(i, 1)[0]; }
    const soldier = take('clubs-6'), knight = take('hearts-1');
    state.players[1].hp = 12;
    state.players[1].soldiers[0] = { id: soldier.id, card: soldier, role: 'soldier', slot: 0, hp: G.unitHP(soldier), maxHP: G.unitHP(soldier) };
    state.players[1].knights[0] = { id: knight.id, card: knight, role: 'knight', slot: 0, hp: G.unitHP(knight, 'knight'), maxHP: G.unitHP(knight, 'knight') };
    const lessonCards = ['spades-13', 'hearts-13', 'clubs-13', 'diamonds-13'].map(take);
    state.deck.push(...lessonCards.reverse());
    return state;
  }
  function allowed(step, action) {
    const expected = steps[step];
    return Boolean(expected && action && expected.type === action.type && (!expected.target || expected.target === action.target));
  }
  return { create, steps, allowed, playerRoll: () => .999, opponentRoll: () => .2 };
});
