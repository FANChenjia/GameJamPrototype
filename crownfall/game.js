/* Shared deterministic rules: runs in a browser and on the LAN host. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Crownfall = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RULES = Object.freeze({ commanderHP: 24, knightHPBonus: 4, soldiers: 5, knights: 3, recruitCost: 1, promoteCost: 2, attackCost: 2, recruitsPerTurn: 2 });
  const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'];
  const SYMBOLS = { spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' };
  const face = value => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[value] || String(value));
  const power = card => 1 + Math.ceil(card.value / 3);
  const unitHP = (card, role = 'soldier') => card.value + (role === 'knight' ? RULES.knightHPBonus : 0);
  const name = card => SYMBOLS[card.suit] + face(card.value);
  function shuffle(cards, rng) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
  function create(rng = Math.random, first = 0) {
    const deck = SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ id: suit + '-' + (i + 1), suit, value: i + 1 })));
    return { version: 2, seq: 0, turn: first, turnNumber: 1, round: 1, phase: 'roll', ap: 0, die: null, recruits: 0, winner: null, fatigue: 0,
      players: [0, 1].map(i => ({ id: i, hp: RULES.commanderHP, soldiers: Array(5).fill(null), knights: Array(3).fill(null) })),
      deck: shuffle(deck, rng), discard: [], log: [], lastEvent: null };
  }
  function frontier(player) {
    const soldiers = player.soldiers.filter(Boolean);
    if (soldiers.length) return soldiers;
    const knights = player.knights.filter(Boolean);
    if (knights.length) return knights;
    return [{ id: 'commander-' + player.id, role: 'commander', hp: player.hp }];
  }
  function troops(player) { return [...player.soldiers, ...player.knights].filter(Boolean); }
  function migrate(state) {
    if (state.version === 1) {
      state.players.forEach(p => troops(p).forEach(unit => {
        const maxHP = unitHP(unit.card, unit.role);
        // Preserve the fraction of health remaining in an existing local save.
        unit.hp = Math.max(1, Math.min(maxHP, Math.ceil(unit.hp / unit.maxHP * maxHP)));
        unit.maxHP = maxHP;
      }));
      state.version = 2;
    }
    return state;
  }
  function getUnit(player, id) { return troops(player).find(u => u.id === id); }
  function finish(state) {
    const dead = state.players.map(p => p.hp <= 0);
    if (dead.some(Boolean)) {
      state.winner = dead[0] && dead[1] ? -1 : dead[0] ? 1 : 0;
      state.phase = 'over';
    }
  }
  function draw(state, rng) {
    if (!state.deck.length) {
      state.deck = shuffle(state.discard.splice(0), rng);
      state.fatigue += 2;
      state.players.forEach(p => { p.hp = Math.max(0, p.hp - state.fatigue); });
      finish(state);
      if (state.phase === 'over') return null;
    }
    return state.deck.pop() || null;
  }
  function event(state, data) {
    const ev = { id: ++state.seq, round: state.round, actor: state.turn, ...data };
    state.lastEvent = ev;
    state.log.unshift(ev);
    state.log = state.log.slice(0, 50);
    return ev;
  }
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function act(state, actor, action, rng = Math.random) {
    assert(action && typeof action.type === 'string', '无效的行动');
    assert(state.phase !== 'over', '本局已结束');
    assert(actor === state.turn, '请等待你的回合');
    if (action.type === 'roll') {
      assert(state.phase === 'roll', '本回合已经掷骰');
      state.die = 1 + Math.floor(rng() * 6);
      state.ap = state.die;
      state.phase = 'action';
      return event(state, { type: 'roll', value: state.die, text: '掷出 ' + state.die + ' 点' });
    }
    assert(state.phase === 'action', '先掷骰，获得行动点');
    const own = state.players[actor];
    const enemy = state.players[1 - actor];
    if (action.type === 'end') {
      const ev = event(state, { type: 'end', text: '结束回合' });
      state.turn = 1 - actor;
      state.turnNumber++;
      state.round = Math.ceil(state.turnNumber / 2);
      state.phase = 'roll'; state.ap = 0; state.die = null; state.recruits = 0;
      return ev;
    }
    if (action.type === 'recruit') {
      assert(state.ap >= RULES.recruitCost, '行动点不足');
      assert(state.recruits < RULES.recruitsPerTurn, '每回合最多排兵两次');
      const slot = own.soldiers.indexOf(null);
      assert(slot !== -1, '士兵位置已满');
      const previousFatigue = state.fatigue;
      const card = draw(state, rng);
      state.ap -= RULES.recruitCost; state.recruits++;
      if (card) own.soldiers[slot] = { id: card.id, card, hp: unitHP(card), maxHP: unitHP(card), role: 'soldier', slot };
      const fatigueDamage = state.fatigue > previousFatigue ? state.fatigue : 0;
      return event(state, { type: 'recruit', card, unit: card?.id, slot, fatigueDamage, text: (fatigueDamage ? '重洗 · 双方主将 −' + fatigueDamage + '；' : '') + (card ? '排兵 ' + name(card) : '疲劳终局') });
    }
    if (action.type === 'promote') {
      assert(state.ap >= RULES.promoteCost, '行动点不足');
      const slot = own.knights.indexOf(null);
      assert(slot !== -1, '骑士位置已满');
      const unit = own.soldiers.find(u => u && u.id === action.target);
      assert(unit, '选择一名士兵册封');
      own.soldiers[unit.slot] = null;
      unit.role = 'knight'; unit.hp = unitHP(unit.card, 'knight'); unit.maxHP = unit.hp; unit.slot = slot;
      own.knights[slot] = unit;
      state.ap -= RULES.promoteCost;
      return event(state, { type: 'promote', unit: unit.id, card: unit.card, text: '册封 ' + name(unit.card) + ' 为骑士' });
    }
    if (action.type === 'attack') {
      assert(state.ap >= RULES.attackCost, '行动点不足');
      const valid = frontier(enemy);
      let target = valid.find(u => u.id === action.target);
      assert(target, '先攻击最外层的护卫');
      const previousFatigue = state.fatigue;
      const card = draw(state, rng);
      state.ap -= RULES.attackCost;
      const bonus = own.knights.filter(Boolean).length;
      const damage = card ? power(card) + bonus : 0;
      let remaining = damage;
      const hits = [];
      // Spending whole base-damage points keeps odd soldier HP unambiguous.
      while (remaining > 0 && target && enemy.hp > 0 && state.phase !== 'over') {
        const multiplier = target.role === 'soldier' ? 2 : 1;
        const dealt = Math.min(target.hp, remaining * multiplier);
        const consumed = Math.min(remaining, Math.ceil(target.hp / multiplier));
        const dead = target.hp <= remaining * multiplier;
        hits.push({ id: target.id, role: target.role, damage: dealt, killed: dead });
        remaining -= consumed;
        if (target.role === 'commander') enemy.hp = Math.max(0, enemy.hp - dealt);
        else {
          target.hp -= dealt;
          if (dead) { enemy[target.role === 'soldier' ? 'soldiers' : 'knights'][target.slot] = null; state.discard.push(target.card); }
        }
        if (!dead) break;
        target = frontier(enemy).sort((a, b) => a.hp - b.hp)[0];
      }
      if (card) state.discard.push(card);
      finish(state);
      const fatigueDamage = state.fatigue > previousFatigue ? state.fatigue : 0;
      return event(state, { type: 'attack', card, damage, bonus, hits, fatigueDamage, text: (fatigueDamage ? '重洗 · 双方主将 −' + fatigueDamage + '；' : '') + (card ? '以 ' + name(card) + ' 发起攻击 · ' + damage + ' 伤害' : '疲劳终局') });
    }
    throw new Error('未知行动');
  }
  function chooseAI(state, actor, rng = Math.random) {
    if (state.turn !== actor || state.phase === 'over') return null;
    if (state.phase === 'roll') return { type: 'roll' };
    const own = state.players[actor], enemy = state.players[1 - actor];
    const knights = own.knights.filter(Boolean).length, soldiers = own.soldiers.filter(Boolean);
    const targets = frontier(enemy).sort((a, b) => a.hp - b.hp);
    const recruit = state.recruits < 2 && soldiers.length < 5;
    if (state.ap === 0) return { type: 'end' };
    if (state.ap === 1) return recruit ? { type: 'recruit' } : { type: 'end' };
    // Threats and a finishing strike take precedence over improving the formation.
    const exposed = targets[0].role === 'commander';
    if (exposed && (enemy.hp <= 5 + knights || (knights >= 1 && rng() < .75))) return { type: 'attack', target: targets[0].id };
    if (knights < 3 && soldiers.length && (knights === 0 || rng() < .58)) {
      const candidate = [...soldiers].sort((a, b) => (unitHP(b.card, 'knight') - b.hp) - (unitHP(a.card, 'knight') - a.hp) || b.card.value - a.card.value)[0];
      return { type: 'promote', target: candidate.id };
    }
    if (recruit && (!soldiers.length && own.hp <= 12 || !soldiers.length && knights === 0 || soldiers.length < 2 && state.ap >= 3 && rng() < .62)) return { type: 'recruit' };
    return { type: 'attack', target: targets[0].id };
  }
  function chooseFriendlyAI(state, actor, rng = Math.random) {
    if (state.turn !== actor || state.phase === 'over') return null;
    // Calibrated against chooseAI with alternating first player. Both policies
    // obey the same deck, HP, costs, and targeting rules as a human player.
    if (state.phase === 'roll' || state.ap < 2 || rng() >= .18) return chooseAI(state, actor, rng);
    const own = state.players[actor], soldiers = own.soldiers.filter(Boolean);
    if (own.knights.filter(Boolean).length < 3 && soldiers.length && rng() < .35) {
      const candidate = [...soldiers].sort((a, b) => a.card.value - b.card.value)[0];
      return { type: 'promote', target: candidate.id };
    }
    // Sometimes attack before strengthening the formation, or pick a tougher
    // defender. This lowers planning quality without changing the dice/results.
    const target = [...frontier(state.players[1 - actor])].sort((a, b) => b.hp - a.hp)[0];
    return { type: 'attack', target: target.id };
  }
  function snapshot(state) {
    const { deck, discard, ...publicState } = state;
    return JSON.parse(JSON.stringify({ ...publicState, deckCount: deck.length, discardCount: discard.length }));
  }
  return { RULES, SUITS, SYMBOLS, create, migrate, act, frontier, troops, getUnit, chooseAI, chooseFriendlyAI, snapshot, power, unitHP, face, name };
});
