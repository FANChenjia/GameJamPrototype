const assert = require('node:assert/strict');
const fs = require('node:fs');
const G = require('./game.js');
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const reference = (s, a, rng) => G.chooseAI(s, a, rng);
const friendly = (s, a, rng) => G.chooseFriendlyAI(s, a, rng);
const bank = period => (s, a, rng) => s.phase === 'action' && s.round % period !== 0 ? { type: 'end' } : reference(s, a, rng);
function fortify(s, actor) {
  if (s.phase === 'roll') return { type: 'roll' };
  const p = s.players[actor], soldiers = p.soldiers.filter(Boolean);
  if (p.reserve) return { type: s.recruits < 2 && soldiers.length < 5 ? 'recruit' : 'discard' };
  if (s.ap >= 2 && soldiers.length && p.knights.filter(Boolean).length < 3) return { type: 'promote', target: [...soldiers].sort((a,b)=>b.card.value-a.card.value)[0].id };
  return { type: s.ap > 0 ? 'draw' : 'end' };
}
function randomLegal(s, actor, rng) {
  if (s.phase === 'roll') return { type: 'roll' };
  const p = s.players[actor], moves = [{ type: 'end' }];
  if (!p.reserve && s.ap >= 1) moves.push({ type: 'draw' }, { type: 'draw' });
  if (p.reserve) {
    moves.push({ type: 'discard' });
    if (s.recruits < 2 && p.soldiers.some(u=>!u)) moves.push({ type: 'recruit' });
    if (s.ap >= 1) moves.push(...G.frontier(s.players[1-actor]).map(u=>({ type:'attack',target:u.id })));
  }
  if (s.ap >= 2 && p.knights.some(u=>!u)) moves.push(...p.soldiers.filter(Boolean).map(u=>({type:'promote',target:u.id})));
  return moves[Math.floor(rng()*moves.length)];
}
const profiles = [
  { name: '虎鲸 / 基础策略', policies: [friendly, reference] },
  { name: '攒 2 回合 / 攒 3 回合后爆发', policies: [bank(3), bank(4)] },
  { name: '攒 5 回合后爆发 / 基础策略', policies: [bank(6), reference] },
  { name: '双方只排兵、册封、弃牌', policies: [fortify, fortify] },
  { name: '双方随机合法操作（含主动存点）', policies: [randomLegal, randomLegal] },
  { name: '双方只掷骰、存点、跳过', policies: [(s)=>({type:s.phase==='roll'?'roll':'end'}),(s)=>({type:s.phase==='roll'?'roll':'end'})] }
];
function conserved(s) {
  const cards=[...s.deck,...s.discard,...s.players.flatMap(p=>[...G.troops(p).map(u=>u.card),...(p.reserve?[p.reserve]:[])])];
  assert.equal(cards.length,52); assert.equal(new Set(cards.map(c=>c.id)).size,52);
}
const report=[];
for (let i=0;i<profiles.length;i++) {
  const profile=profiles[i], rounds=[];let actions=0,maxActions=0,maxAP=0,fatigueEnds=0,draws=0;
  for(let seed=1;seed<=2000;seed++) {
    const world=seeded(910000+i*10000+seed), policies=[seeded(seed^67119),seeded(seed^491927)], s=G.create(world,seed%2);let n=0;
    while(s.phase!=='over'&&n<10000) {
      const actor=s.turn,action=profile.policies[actor](s,actor,policies[actor]);
      assert.ok(action); G.act(s,actor,action,world); n++;
      assert.equal(s.ap,s.players[s.turn].ap); assert.ok(s.players.every(p=>Number.isSafeInteger(p.ap)&&p.ap>=0));
      maxAP=Math.max(maxAP,...s.players.map(p=>p.ap));
      if(n%10===0) conserved(s);
    }
    assert.equal(s.phase,'over',`${profile.name}, seed ${seed}: did not finish`);assert.ok(s.round<=50);conserved(s);
    if(s.lastEvent.fatigueDamage)fatigueEnds++;if(s.winner===-1)draws++;
    rounds.push(s.round);actions+=n;maxActions=Math.max(maxActions,n);
  }
  rounds.sort((a,b)=>a-b);
  const result={profile:profile.name,games:rounds.length,completed:rounds.length,medianRounds:rounds[999],p95Rounds:rounds[1899],maxRounds:rounds.at(-1),meanRounds:+(rounds.reduce((a,b)=>a+b)/rounds.length).toFixed(2),meanActions:+(actions/rounds.length).toFixed(1),maxActions,maxAP,fatigueEnds,draws};
  report.push(result);console.log(JSON.stringify(result));
}
const idle=G.create();
while(idle.phase!=='over'&&idle.round<=50){G.act(idle,idle.turn,{type:'roll'},()=>.5);G.act(idle,idle.turn,{type:'end'});}
assert.equal(idle.phase,'over');assert.equal(idle.round,50);assert.equal(idle.deck.length,52);assert.deepEqual(idle.players.map(p=>p.hp),[0,0]);
const output={totalGames:report.reduce((n,r)=>n+r.games,0),completed:report.reduce((n,r)=>n+r.completed,0),profiles:report,idleBoundary:{rounds:idle.round,phase:idle.phase,winner:idle.winner,bank:idle.players.map(p=>p.ap),hp:idle.players.map(p=>p.hp),deck:idle.deck.length,reason:'双方一直跳过时，第46–50回合依次触发2、4、6、8、10点疲劳；最迟第50回合开始时结算。'}};
fs.writeFileSync(require('node:path').join(__dirname, '对局验证.json'),JSON.stringify(output,null,2)+'\n');
