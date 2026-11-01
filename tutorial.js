/* The guide observes real game state; demonstrations use normal prices and timers. */
(function (global) {
'use strict';
const STEPS = {
 place: {part:1,title:'放下第一把里拉琴',text:'选择里拉琴，放到第 1 列第 3 行的高亮格。也可以直接拖放。'},
 move: {part:1,title:'调整乐器位置',text:'把这把里拉琴移到第 1 列第 2 行。拖动，或选中后点击高亮空格；移动免费。'},
 remove: {part:1,title:'试一次移除',text:'点击「移除」。准备阶段返还全部 18 协奏点，之后可以重新布置。'},
 formation: {part:2,title:'让五列都有声音',text:'每列放 1 把里拉琴，共 5 把、90 协奏点。每把会贯穿所在列的全部敌人。'},
 start: {part:2,title:'开始你的第一段演奏',text:'五列已就绪。点击「开始战斗」；目标是守住基地，完成 120 秒演奏。'},
 earn: {part:3,title:'观察协奏点增长',text:'协奏点每秒增长，击败敌人也会获得奖励。先让乐器演奏约 12 秒。'},
 claim: {part:3,title:'领取第一张奏法牌',text:'点击候选区的「急板」。领取免费，只有打出时才付费；领取后该槽会自动补牌。'},
 use: {part:4,title:'把急板交给乐器',text:'将手牌「急板」拖到任意里拉琴：花费 12 协奏点，攻速提高 25%，持续 5 秒。也可点牌后点乐器。'},
 save: {part:5,title:'为刷新攒一点协奏',text:'候选不会定时更换。继续演奏，攒够 6 协奏点后尝试手动刷新。'},
 refresh: {part:5,title:'亲手刷新一次',text:'点击「刷新 · 6 协奏」，更换整组三张候选。入场首组免费，之后整组刷新都要付费。'},
 play: {part:6,title:'自由演奏，准备迎战',text:'突进怪跑得快，可用奏法牌支援薄弱声部。剩余 20 秒时，Boss 会横跨第 2–4 列。'},
 boss: {part:6,title:'Boss 来了',text:'第 2–4 列可共同攻击这个 Boss，生命共享。最后 20 秒内击败它；漏过扣 10 耐久，控制不延长截止。'},
 finish: {part:6,title:'完成最后一段演奏',text:'守住基地直到计时结束。你已学会布阵、调整、奏法和刷新；通关后前往星摇岛。'}
};
class TutorialGuide {
 constructor(game) { this.game=game;game.guide=this;this.reset(); }
 reset() {this.active=!!this.game.tutorialEnabled;this.step='place';this.trainingId=null;this.holding=false;this.completed=false;this.skipped=false;this.preClaimIds=new Set();}
 get spec() {return STEPS[this.step];}
 get hint() {return this.spec.text;}
 get unrestricted() {return !this.active||['play','boss','finish'].includes(this.step);}
 allows(action,data={}) {
  if(!this.active)return true;
  if(action==='start')return ['start','earn','save','play','finish'].includes(this.step);
  if(this.unrestricted)return true;
  if(action==='select')return data.profile?.id==='lyra';
  if(action==='place'){
   if(data.profile?.id!=='lyra')return false;
   if(this.step==='place')return this.game.units.length===0&&data.col===0&&data.row===2;
   return this.step==='formation'&&!this.game.units.some(u=>!u.clone&&u.col===data.col);
  }
  if(action==='move')return this.step==='move'&&data.id===this.trainingId&&data.col===0&&data.row===1||this.step==='formation';
  if(action==='sell')return this.step==='remove'&&data.id===this.trainingId||this.step==='formation';
  if(action==='claim')return this.step==='claim'&&this.game.offers[data.index]?.type==='Presto';
  if(action==='card')return this.step==='use'&&data.type==='Presto';
  if(action==='refresh')return this.step==='refresh';
  return false;
 }
 pauseAt(step) {this.step=step;if(step==='claim')this.preClaimIds=new Set(this.game.hand.map(c=>c.id));this.game.pause();this.holding=true;}
 resumeAt(step) {this.step=step;this.holding=false;this.game.start();}
 update() {
  if(!this.active)return;
  const g=this.game,first=g.units.find(u=>u.id===this.trainingId);
  if(g.phase==='lost'){this.active=false;this.holding=false;return;}
  if(this.step==='place'){
   const u=g.units.find(u=>!u.clone&&u.profile.id==='lyra'&&u.col===0&&u.row===2);
   if(u){this.trainingId=u.id;this.step='move';}
  }else if(this.step==='move'&&first?.col===0&&first.row===1)this.step='remove';
  else if(this.step==='remove'&&!first)this.step='formation';
  else if(this.step==='formation'&&g.permanentCount===5&&[0,1,2,3,4].every(col=>g.units.some(u=>u.profile.id==='lyra'&&u.col===col)))this.step='start';
  else if(this.step==='start'&&g.phase==='running')this.step='earn';
  else if(this.step==='earn'&&g.elapsed>=12)this.pauseAt('claim');
  else if(this.step==='claim'&&g.hand.some(c=>c.type==='Presto'&&!this.preClaimIds.has(c.id)))this.step='use';
  else if(this.step==='use'&&g.stats.cardUses.some(c=>c.type==='Presto'))this.resumeAt('save');
  else if(this.step==='save'&&g.points+1e-7>=6)this.pauseAt('refresh');
  else if(this.step==='refresh'&&g.stats.refreshes>=1)this.resumeAt('play');
  else if(this.step==='play'&&g.bossSpawned)this.pauseAt('boss');
  else if(this.step==='finish'&&g.result?.win){this.active=false;this.completed=true;this.holding=false;}
 }
 continue() {if(this.active&&this.step==='boss'){this.resumeAt('finish');return true;}return false;}
 skip() {const resume=this.holding;this.active=false;this.skipped=true;this.holding=false;if(resume)this.game.start();}
 targets() {
  const cell=(col,row)=>`.grid-cell[data-col="${col}"][data-row="${row}"]`;
  if(this.step==='place')return ['.instrument-option[aria-label^="里拉琴"]',cell(0,2)];
  if(this.step==='move')return [cell(0,1),cell(0,2)];
  if(this.step==='remove')return ['#sell-unit'];
  if(this.step==='formation'){const cols=[0,1,2,3,4].filter(col=>!this.game.units.some(u=>u.col===col));return ['.instrument-option[aria-label^="里拉琴"]',...cols.map(col=>cell(col,2))];}
  if(this.step==='start')return ['#start-game'];
  if(this.step==='earn'||this.step==='save')return ['.wallet','#start-game'];
  if(this.step==='claim')return ['#draw-cards .play-card[aria-label^="急板"]'];
  if(this.step==='use')return ['#hand-cards .play-card[aria-label^="急板"]',...this.game.units.filter(u=>!u.clone).map(u=>cell(u.col,u.row))];
  if(this.step==='refresh')return ['#draw-refresh'];
  if(this.step==='boss')return ['#boss-health'];
  return ['#wave-tip'];
 }
}
global.Meadow.TutorialGuide=TutorialGuide;
})(typeof window!=='undefined'?window:globalThis);
