/* Fixed-step campaign simulation. Rendering never applies damage or advances timers. */
(function (global) {
'use strict';
const D=global.ConcertoData, copy=x=>JSON.parse(JSON.stringify(x));
const UNITS=Object.fromEntries(D.units.map(u=>[u.id,u])), CARDS=Object.fromEntries(D.cards.map(c=>[c.id,c]));
const ok=(message='',extra={})=>({ok:true,message,...extra}), fail=message=>({ok:false,message});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function seeded(seed=71){let value=seed>>>0;return ()=>{value+=0x6D2B79F5;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function weighted(field,random=Math.random){const pool=D.cards.filter(c=>c[field]>0),total=pool.reduce((n,c)=>n+c[field],0);let roll=random()*total;for(const c of pool){roll-=c[field];if(roll<0)return c.id;}return pool[pool.length-1].id;}
function initialProgress(){return {version:2,rhythm:0,unlocked:0,cleared:[],shops:{}};}
function settle(progress,level,result){const next=copy(progress);let reward=0;if(result.win&&!next.cleared.includes(level.id)){reward=level.reward+Math.floor((result.points+1e-7)/20);next.rhythm+=reward;next.cleared.push(level.id);next.unlocked=Math.min(9,Math.max(next.unlocked,level.index+1));}if(result.win)delete next.shops[level.id];return {progress:next,reward};}
class Game {
 constructor(level='1-1',options={}){this.level=copy(typeof level==='string'?D.levels.find(l=>l.id===level):level);if(!this.level)throw new Error('未知关卡');this.seed=options.seed??(771+this.level.index*101);this.tutorialEnabled=!!options.tutorial&&this.level.id==='1-1';this.prepaid=(options.prepaid||[]).filter(id=>CARDS[id]).slice(0,3);this.reset();}
 reset(){this.random=seeded(this.seed);this.areaRandom=seeded(this.seed+104729);this.seq=0;this.phase='ready';this.elapsed=0;this.tick=0;this.buffer=0;this.wave=0;this.waveStart=0;this.skippedTime=0;this.points=this.level.initial;this.base=10;this.kills=0;this.units=[];this.monsters=[];this.areas=[];this.bullets=[];this.effects=[];this.pulses=[];this.offers=[];this.guarantee=null;this.freeRefresh=0;this.hand=[];this.pendingCards=[];this.result=null;this.arranging=false;this.dimUntil=0;this.config={duration:120,pointsPerSecond:this.level.income};this.stats={spent:0,refreshes:0,refreshSpent:0,cardSpent:0,cardPurchases:[],leaks:0,normalLeaks:0,rushLeaks:0,cardUses:[],bossTimes:[],minPoints:this.points,waveSettlements:[]};this.giveCards(this.prepaid);this.prepareWave();this.offers=Array.from({length:3},(_,i)=>this.card(this.tutorialEnabled?['Presto','Forte','Diminuendo'][i]:this.randomCardType()));this.guide?.reset();}
 guideBlocks(action,data={}){return !!(this.guide?.active&&!this.guide.allows(action,data));}
 get waveElapsed(){return this.elapsed-this.waveStart;}
 get waveRemaining(){return Math.max(0,Math.round((this.level.waveDuration-this.waveElapsed)*100)/100);}
 get overtime(){return this.waveElapsed>=this.level.waveDuration-1e-7;}
 get remainingTime(){return this.result?.win?0:this.waveRemaining+(this.level.waves.length-this.wave-1)*this.level.waveDuration;}
 get currentWave(){return this.level.waves[this.wave];}
 get permanentCount(){return this.units.filter(u=>!u.clone&&!u.profile.summon).length;}
 get summonCount(){return this.units.filter(u=>!u.clone&&u.profile.summon).length;}
 get canEdit(){return this.phase==='ready'||this.arranging;}
 prepareWave(){this.spawnIndex=0;this.bossSpawned=false;this.batchIndex=0;this.refreshCount=0;this.normalKills=0;this.normalRewardPaid=0;const count=this.currentWave.count,end=this.level.waveDuration-20.5;this.schedule=Array.from({length:count},(_,i)=>({at:count>1?i*end/(count-1):0,lane:i%5,rush:false}));const r=seeded(this.seed+7919*(this.wave+1)),pool=this.schedule.map((s,i)=>i).filter(i=>this.level.island===1?this.schedule[i].at>=50&&this.schedule[i].at<=80:this.schedule[i].at>=this.level.waveDuration*.25&&this.schedule[i].at<=this.level.waveDuration*.25+10);for(let i=pool.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}for(const i of pool.slice(0,this.currentWave.rushCount))this.schedule[i].rush=true;}
 bossLanes(lane=this.currentWave.bossLane){const width=D.bossWidth,start=clamp(lane-Math.floor(width/2),0,D.columns-width);return Array.from({length:width},(_,i)=>start+i);}
 monsterLanes(m){return m.lanes||[m.lane];}
 intersects(m,lanes){return this.monsterLanes(m).some(l=>lanes.includes(l));}
 start(){if(this.guideBlocks('start'))return false;if(this.arranging||this.pendingCards.length)return false;if(['ready','paused'].includes(this.phase)){this.phase='running';return true;}return false;}
 pause(){if(this.phase==='running')this.phase='paused';}
 profile(p){return typeof p==='string'?UNITS[p]:p;}
 lanes(u){if(u.profile.family==='percussion'||this.active(u,'Infinite'))return [0,1,2,3,4];return Array.from({length:u.profile.width},(_,i)=>u.col+i);}
 naturalLanes(u){return Array.from({length:u.profile.width},(_,i)=>u.col+i);}
 center(u){return {x:u.col+u.profile.width/2,row:u.row+u.profile.height/2};}
 at(col,row){return this.units.find(u=>!u.clone&&u.profile.shape.some(([x,y])=>u.col+x===col&&u.row+y===row));}
 canPlace(p,col,row,ignoreId=null){p=this.profile(p);if(!p||!Number.isInteger(col)||!Number.isInteger(row))return false;const moving=this.units.find(u=>u.id===ignoreId);if(!moving){if(p.summon?this.summonCount>=2:this.permanentCount>=this.level.cap)return false;if(!p.summon&&p.unlock>this.level.island)return false;}if(!p.shape.every(([x,y])=>col+x>=0&&col+x<5&&row+y>=0&&row+y<4&&!this.units.some(u=>!u.clone&&u.id!==ignoreId&&u.profile.shape.some(([a,b])=>u.col+a===col+x&&u.row+b===row+y))))return false;if(p.family==='bowed'){const lanes=Array.from({length:p.width},(_,i)=>col+i);if(this.units.some(u=>!u.clone&&u.id!==ignoreId&&u.profile.family==='bowed'&&this.naturalLanes(u).some(l=>lanes.includes(l))))return false;}return true;}
 place(p,col,row,options={}){p=this.profile(p);this.lastError='';if(this.guideBlocks('place',{profile:p,col,row})){this.lastError=this.guide.hint;return null;}if(!p){this.lastError='未知乐器';return null;}if(['won','lost'].includes(this.phase)||this.arranging){this.lastError='当前不能新布置乐器';return null;}if(p.summon&&!options.summon){this.lastError='需要对应召唤牌';return null;}if(!this.canPlace(p,col,row)){this.lastError='检查空格、乐器上限或共振覆盖列';return null;}if(!options.free&&this.points+1e-7<p.cost){this.lastError='协奏点不足';return null;}if(!options.free){this.points-=p.cost;this.stats.spent+=p.cost;}const u={id:++this.seq,profile:copy(p),col,row,paidCost:options.free?0:p.cost,permSpeed:0,speedBonus:0,rangeBonus:0,progress:0,attacks:0,accentProgress:0,buffs:{},flash:0,clone:false,expires:p.summon&&p.id!=='suona'?this.wave:null};this.units.push(u);return u;}
 move(id,col,row){if(this.guideBlocks('move',{id,col,row}))return false;const u=this.units.find(u=>u.id===id&&!u.clone);if(!u||!this.canEdit||!this.canPlace(u.profile,col,row,id))return false;u.col=col;u.row=row;for(const clone of this.units.filter(x=>x.parent===id)){clone.col=col;clone.row=row;}return true;}
 remove(id){const ids=new Set(this.units.filter(u=>u.id===id||u.parent===id).map(u=>u.id));this.units=this.units.filter(u=>!ids.has(u.id));this.areas=this.areas.filter(a=>!ids.has(a.unitId));for(const m of this.monsters)m.marks=(m.marks||[]).filter(mark=>!ids.has(mark.source));}
 sell(id){if(this.guideBlocks('sell',{id}))return fail(this.guide.hint);const u=this.units.find(u=>u.id===id&&!u.clone);if(!u||this.phase!=='ready'||this.arranging)return fail('仅准备阶段可移除乐器');const refund=u.paidCost;this.remove(id);this.points+=refund;return ok(`已移除，返还 ${refund} 协奏点`);}
 active(u,id){return (u.buffs[id]||0)>this.elapsed+1e-8;}
 windCount(){return this.units.filter(u=>!u.clone&&u.profile.family==='wind').length;}
 windFactor(u){if(u.profile.family!=='wind')return 1;if(u.clone)return u.windSnapshot;let bonus=0;const has=id=>this.units.some(x=>!x.clone&&x.profile.id===id);if(u.profile.id==='flute'&&has('oboe')||u.profile.id==='oboe'&&has('flute'))bonus=.25;if(u.profile.id==='trumpet'&&has('euphonium'))bonus=1.5;return 1+.25*this.windCount()+bonus;}
 attackSpeed(u){const temp=(this.active(u,'Presto')?.25:0)+(this.active(u,'Prestissimo')?1:0)+(this.active(u,'Cadenza')?.5:0);const penalty=u.profile.id==='trumpet'&&(u.clone?u.trumpetSnapshot:this.units.some(x=>!x.clone&&x.profile.id==='euphonium'))?.5:1;return u.profile.attackSpeed*(1+Math.min(1,u.permSpeed))*(1+temp)*penalty;}
 directDamage(u){return u.profile.damage*this.windFactor(u)*(this.active(u,'Forte')?1.5:1)*(u.clone?.5:1);}
 // Independent sampling with replacement: cards have no finite stock.
 randomCardType(){return weighted('weight',this.random);}
 card(type){return {id:++this.seq,type};}
 giveCards(types){const incoming=types.map(type=>this.card(type));if(this.hand.length+incoming.length>8)this.pendingCards.push(...incoming);else this.hand.push(...incoming);}
 resolveOverflow(keep){const all=[...this.hand,...this.pendingCards];if(keep.length>8||new Set(keep).size!==keep.length||keep.some(id=>!all.some(c=>c.id===id)))return fail('最多保留 8 张牌');this.hand=all.filter(c=>keep.includes(c.id));this.pendingCards=[];return ok();}
 discard(id){if(this.guideBlocks('discard'))return false;const before=this.hand.length;this.hand=this.hand.filter(c=>c.id!==id);return before!==this.hand.length;}
 pity(refreshNumber){if(this.level.island>=3){if(refreshNumber===1)return 'Rondo';if(refreshNumber===2)return 'Cadenza';if(refreshNumber===3)return 'Forte';if(refreshNumber===4)return 'Infinite';}if(this.level.island===5&&refreshNumber===5)return 'Rondo';return null;}
 rollOffers(){if(this.guideBlocks('refresh'))return fail(this.guide.hint);if(['won','lost'].includes(this.phase)||this.arranging||this.pendingCards.length)return fail('当前不能刷新');if(this.freeRefresh)this.freeRefresh--;else if(this.points+1e-7>=D.refreshCost){this.points=Math.round((this.points-D.refreshCost)*1000)/1000;this.stats.spent+=D.refreshCost;this.stats.refreshSpent+=D.refreshCost;}else return fail(`刷新需要 ${D.refreshCost} 协奏点`);this.refreshCount++;this.stats.refreshes++;this.guarantee=this.pity(this.refreshCount);this.offers=Array.from({length:3},()=>this.card(this.randomCardType()));if(this.guarantee)this.offers[0]=this.card(this.guarantee);return ok();}
 claimOffer(index){
  if(this.guideBlocks('claim',{index}))return fail(this.guide.hint);
  if(['won','lost'].includes(this.phase)||this.arranging)return fail('当前不能购买');
  if(this.pendingCards.length)return fail('先整理手牌');
  const c=Number.isInteger(index)&&index>=0&&index<3?this.offers[index]:null;if(!c)return fail('请选择有效的候选位置');const cost=CARDS[c.type].cost;
  if(this.points+1e-7<cost)return fail(`购买需要 ${cost} 协奏点`);
  this.points=Math.round((this.points-cost)*1000)/1000;this.stats.spent+=cost;this.stats.cardSpent+=cost;this.stats.cardPurchases.push({type:c.type,cost,at:this.elapsed});this.stats.minPoints=Math.min(this.stats.minPoints,this.points);
  this.giveCards([c.type]);this.offers[index]=this.card(this.randomCardType());if(index===0)this.guarantee=null;return ok('已购买，使用免费');
 }
 beginArrangement(card){if(this.arranging)return fail('请先完成重排');this.arranging=true;this.arrangeCard=card.id;this.arrangeBackup=this.units.map(u=>({id:u.id,col:u.col,row:u.row}));return ok('移动乐器后确认重排',{arrange:true});}
 endArrangement(commit){if(!this.arranging)return fail('没有进行中的重排');if(commit){const c=this.hand.find(c=>c.id===this.arrangeCard);if(!c)return fail('卡牌已不在手中');this.hand=this.hand.filter(x=>x.id!==c.id);this.stats.cardUses.push({type:c.type,at:this.elapsed});}else for(const p of this.arrangeBackup){const u=this.units.find(u=>u.id===p.id);if(u)Object.assign(u,{col:p.col,row:p.row});}this.arranging=false;this.arrangeBackup=null;return ok(commit?'重排完成':'已取消');}
 useCard(id,target){const card=this.hand.find(c=>c.id===id),c=card&&CARDS[card.type];if(!c)return fail('卡牌已不在手中');if(this.guideBlocks('card',{type:c.id}))return fail(this.guide.hint);if(['won','lost'].includes(this.phase)||this.arranging||this.pendingCards.length)return fail('当前不能打出牌');const u=this.units.find(u=>u.id===(target&&typeof target==='object'?target.unitId:target)&&!u.clone);if(c.target==='unit'&&!u)return fail('请选择一件真实乐器');if(c.id==='Resonance'&&!['lyra','harp','guqin','suona','snare','gong'].includes(u.profile.id))return fail('这件乐器没有可立即释放的技能');if(c.target==='arrange')return this.beginArrangement(card);if(c.summon){if(!target||!this.canPlace(c.summon,target.col,target.row))return fail('召唤需要空格和空名额');}
 this.hand=this.hand.filter(x=>x.id!==id);this.stats.cardUses.push({type:c.id,at:this.elapsed});
 if(c.summon){this.place(c.summon,target.col,target.row,{summon:true,free:true});return ok('召唤完成');}
 if(['Presto','Prestissimo'].includes(c.id))u.buffs[c.id]=this.elapsed+5;
 if(c.id==='Sforzando')u.sforzando=true;
 if(c.id==='Resonance')this.skill(u,true);
 const durations={Cadenza:10,Forte:10,Syncopation:10,Rondo:10,Rhapsody:5,Infinite:5};
 if(durations[c.id])for(const x of this.units.filter(x=>!x.clone))x.buffs[c.id]=this.elapsed+durations[c.id];
 if(c.id==='Diminuendo')this.dimUntil=this.elapsed+5;
 if(c.id==='Fermata')for(const m of this.monsters)m.freezeUntil=this.elapsed+3;
 if(c.id==='Requiem')for(const m of [...this.monsters])this.damageMonster(m,m.maxHp-m.hp,{});
 if(c.id==='Improvisation')this.giveCards([this.randomCardType(),this.randomCardType()]);
 if(c.id==='Deduction')this.freeRefresh++;
 if(c.id==='Duet'){const clone=copy(u);Object.assign(clone,{id:++this.seq,clone:true,parent:u.id,until:this.elapsed+10,progress:0,attacks:0,accentProgress:0,flash:.3,windSnapshot:this.windFactor(u),trumpetSnapshot:this.units.some(x=>!x.clone&&x.profile.id==='euphonium'),sforzando:false});this.units.push(clone);}
 return ok('奏法已生效');}
 spawn(lane,boss=false,rush=false){const p=this.currentWave,maxHp=boss?p.bossHp:rush?p.rushHp:p.hp;const shield=!boss&&!rush&&this.level.island>=3&&this.spawnIndex<Math.floor(p.count*.2)?maxHp*.2:0;const m={id:++this.seq,lane,lanes:boss?this.bossLanes(lane):[lane],rush,travelTime:boss?20:rush?p.rushTravelTime:p.travelTime,y:0,hp:maxHp,maxHp,shield,maxShield:shield,boss,variant:boss?1:(this.spawnIndex%3),wobble:this.random()*6.28,hit:0,slowed:false,slow:0,marks:[],born:this.elapsed,stunUntil:0,freezeUntil:0,vulnerableUntil:0};this.monsters.push(m);return m;}
 front(lane){let front=null;for(const m of this.monsters)if(m.hp>0&&this.monsterLanes(m).includes(lane)&&(!front||m.y>front.y+1e-9))front=m;return front;}
 rollArea(lane){const start=this.areaRandom()*(2/3);return {lane,start,end:start+1/3};}
 addArea(unit,lane,kind='bow'){const bounds=this.rollArea(lane),key=kind==='rhapsody'?`r:${lane}`:`b:${unit.id}:${lane}`;let a=this.areas.find(a=>a.key===key);if(a){Object.assign(a,bounds);a.until=this.elapsed+(kind==='bow'?.5:2);a.pulse=.22;return a;}a={id:++this.seq,key,kind,...bounds,unitId:unit.id,bornAt:this.elapsed,until:this.elapsed+(kind==='bow'?.5:2),duration:kind==='bow'?.5:2,nextTick:this.elapsed+.5,slow:kind==='rhapsody'?.15:({violin:.15,viola:.25,cello:.4}[unit.profile.id]||.15),pulse:.22,ticks:0,clone:false};this.areas.push(a);return a;}
 areaContains(a,m){return this.monsterLanes(m).includes(a.lane)&&m.y>=a.start-1e-9&&m.y<=a.end+1e-9;}
 countAccent(u){if(!u||u.clone||u.profile.family!=='percussion')return;u.accentProgress++;while(u.accentProgress>=100){u.accentProgress-=100;this.stun();}}
 stun(){for(const m of this.monsters)if(m.hp>0)m.stunUntil=Math.max(m.stunUntil,this.elapsed+1);}
 damageMonster(m,damage,{source=null,bypass=false,mark=false}={}){if(!m||m.hp<=0||damage<=0)return 0;damage*=m.vulnerableUntil>this.elapsed?1.25:1;const old=m.hp,absorbed=bypass?0:Math.min(m.shield||0,damage);m.shield=Math.max(0,(m.shield||0)-absorbed);m.hp=Math.max(0,m.hp-damage+absorbed);const lost=old-m.hp;m.hit=.2;if(source?.profile.id==='marimba')this.countAccent(source);if(!mark)for(const tag of m.marks||[])tag.damage+=lost;
 this.effects.push({x:m.lane+.5,y:m.y,t:0,life:.4,burst:true,color:'#f4e4a1'});if(damage>=8)this.effects.push({x:m.lane+.5,y:m.y,t:0,life:.55,text:`−${Math.round(damage)}`,color:'#5f7050'});
 if(m.hp<=0&&!m.rewarded){m.rewarded=true;this.kills++;let reward=10;if(!m.boss){this.normalKills++;const paid=Math.floor(this.normalKills*this.currentWave.normalRewardBudget*1000/this.currentWave.count);reward=(paid-this.normalRewardPaid)/1000;this.normalRewardPaid=paid;}this.points=Math.round((this.points+reward)*1000)/1000;if(m.boss)this.stats.bossTimes.push({wave:this.wave,time:this.elapsed-m.born});this.effects.push({x:m.lane+.5,y:m.y,t:0,life:.7,text:`+${reward} ✦`,color:'#967a38'});}return lost;}
 mark(u,m){if(m.hp>0&&!m.marks.some(t=>t.source===u.id))m.marks.push({source:u.id,until:this.elapsed+10,damage:0});}
 skill(u,forced=false){const id=u.profile.id,covered=this.naturalLanes(u);if(id==='lyra')for(const m of this.monsters)if(m.hp>0&&this.intersects(m,covered))m.vulnerableUntil=this.elapsed+10;if(id==='harp'&&forced)u.permSpeed=Math.min(1,u.permSpeed+.01);if(id==='guqin'&&forced)for(const m of this.monsters)if(this.intersects(m,covered))this.mark(u,m);if(id==='suona'){const m=this.front(covered[0]);if(m){if(m.boss)this.damageMonster(m,m.maxHp*.03,{source:u,bypass:true});else {m.shield=0;this.damageMonster(m,m.hp,{source:u,bypass:true});}}}if(id==='snare'){const pool=this.units.filter(x=>!x.clone&&x.profile.family!=='percussion');if(pool.length){const x=pool[Math.floor(this.random()*pool.length)];x.permSpeed=Math.min(1,x.permSpeed+.1);}}if(u.profile.family==='percussion')this.stun();}
 attack(u){const lanes=this.lanes(u),all=this.monsters.filter(m=>m.hp>0&&this.intersects(m,lanes));if(!all.length)return false;u.attacks++;u.flash=.25;let targets=[];if(u.profile.family==='percussion'||u.profile.piercing)targets=all;else if(!u.profile.areaAttack)targets=lanes.map(l=>this.front(l)).filter(Boolean);
 if(u.profile.areaAttack){for(const lane of lanes){
  if(!all.some(m=>this.monsterLanes(m).includes(lane)))continue;
  const competitors=this.units.filter(x=>!x.clone&&x.profile.areaAttack&&this.lanes(x).includes(lane)),lead=competitors.sort((a,b)=>this.directDamage(b)*this.attackSpeed(b)-this.directDamage(a)*this.attackSpeed(a)||a.id-b.id)[0];
  if(!u.clone&&lead&&lead.id!==u.id)continue;
  const area=u.clone?this.rollArea(lane):this.addArea(u,lane);
  targets.push(...all.filter(m=>this.areaContains(area,m)));
 }}
 // One entity can be selected through several lanes. Resolve it once per attack.
 targets=[...new Map(targets.map(m=>[m.id,m])).values()];
 const power=this.directDamage(u)*(u.sforzando?10:1),bypass=this.active(u,'Syncopation'),segments=u.profile.id==='marimba'?[1,2,3,4,5,6,7]:[null];
 for(const m of targets){
  const rondo=this.active(u,'Rondo')?m.maxHp*(m.boss?.002:.02)*(u.clone?.5:1):0;
  if(m.boss){
   // Boss: one health/shield application and reward check per attack.
   // Marimba's seven notes total one AD; Rondo adds its bonus only once.
   this.damageMonster(m,power+rondo,{source:u,bypass});
  }else {
   for(const segment of segments){const amount=segment===null?power:power*segment/28;this.damageMonster(m,amount,{source:u,bypass});}
   if(rondo)this.damageMonster(m,rondo,{source:u,bypass});
  }
  if(u.profile.id==='guqin'&&!u.clone)this.mark(u,m);
 }
 if(!u.clone&&this.active(u,'Rhapsody'))for(const lane of lanes)if(targets.some(m=>this.monsterLanes(m).includes(lane)))this.addArea(u,lane,'rhapsody');
 if(!u.clone){
  // Marimba's passive counts its actual damage events inside damageMonster.
  if(u.profile.family==='percussion'&&u.profile.id!=='marimba')this.countAccent(u);
  if(u.profile.id==='harp')u.permSpeed=Math.min(1,u.permSpeed+.01);if(u.profile.id==='lyra'&&u.attacks%10===0)this.skill(u);if(['snare','suona'].includes(u.profile.id)&&u.attacks%5===0)this.skill(u);if(u.profile.id==='gong')this.skill(u);}
 u.sforzando=false;const center=this.center(u),origin={x:center.x,y:(.65+center.row*.08-.04)/.56};this.pulses.push({unitId:u.id,...origin,lanes,t:0,life:.4,clone:u.clone});for(const m of targets.slice(0,8))this.bullets.push({id:++this.seq,unitId:u.id,from:{...origin},to:{x:(this.monsterLanes(m).find(l=>lanes.includes(l))??m.lane)+.5,y:m.y},t:0,life:.22,note:'♪',clone:u.clone});return true;}
 finish(win,reason=''){for(const u of [...this.units])if(u.clone||u.profile.summon)this.remove(u.id);this.offers=[];this.guarantee=null;this.phase=win?'won':'lost';this.buffer=0;this.result={win,reason,time:this.elapsed,kills:this.kills,points:this.points,base:this.base,stats:copy(this.stats)};}
 endWave(){
  if(this.result)return;
  if(this.base<=0){this.finish(false,'防线失守');return;}
  if(!this.bossSpawned||this.batchIndex<this.schedule.length||this.monsters.some(m=>m.hp>0))return;
  const remainingSeconds=Math.max(0,Math.round((this.level.waveDuration-this.waveElapsed)*100)/100),bonus=Math.round(remainingSeconds*this.level.income*1000)/1000;
  this.points=Math.round((this.points+bonus)*1000)/1000;this.skippedTime=Math.round((this.skippedTime+remainingSeconds)*100)/100;
  this.stats.waveSettlements.push({wave:this.wave+1,time:this.elapsed,remainingSeconds,overtimeSeconds:Math.max(0,Math.round((this.waveElapsed-this.level.waveDuration)*100)/100),bonus,points:this.points});
  for(const u of [...this.units])if(!u.clone&&u.expires===this.wave)this.remove(u.id);
  if(this.wave===this.level.waves.length-1)this.finish(true);
  else {this.wave++;this.waveStart=this.elapsed;this.prepareWave();this.phase='running';}
 }
 step(){const dt=.01,t=this.elapsed,w=this.waveElapsed;let overtimeLeak=false;this.points=Math.round((this.points+this.level.income*dt)*1000)/1000;
 while(this.batchIndex<this.schedule.length&&this.schedule[this.batchIndex].at<=w+1e-7){this.spawn(this.schedule[this.batchIndex].lane,false,this.schedule[this.batchIndex].rush);this.spawnIndex++;this.batchIndex++;}
 if(!this.bossSpawned&&w+1e-7>=this.level.waveDuration-20){this.spawn(this.currentWave.bossLane,true);this.bossSpawned=true;}
 for(const u of [...this.units])if(u.clone&&u.until<=t+1e-8)this.remove(u.id);
 this.areas=this.areas.filter(a=>a.until>t+1e-8);for(const a of this.areas){a.age=t-a.bornAt;a.pulse=Math.max(0,a.pulse-dt);if(a.kind==='rhapsody')while(a.nextTick<=t+1e-8){a.nextTick+=.5;a.ticks++;for(const m of this.monsters)if(m.hp>0&&this.areaContains(a,m)&&!this.areas.some(b=>b.kind==='bow'&&this.areaContains(b,m))){if(m.boss&&t+1e-8<(m.nextRhapsodyHit||0))continue;this.damageMonster(m,7.5,{});if(m.boss)m.nextRhapsodyHit=t+.5;}}}
 for(const m of this.monsters)for(const tag of [...m.marks])if(tag.until<=t+1e-8){m.marks=m.marks.filter(x=>x!==tag);this.damageMonster(m,tag.damage*.3,{mark:true});}
 for(const u of this.units){u.flash=Math.max(0,u.flash-dt);u.speedBonus=u.permSpeed;const hasTarget=this.monsters.some(m=>m.hp>0&&this.intersects(m,this.lanes(u)));if(!hasTarget)continue;u.progress+=this.attackSpeed(u)*dt;while(u.progress>=1-1e-8){u.progress-=1;if(!this.attack(u)){u.progress=Math.max(0,u.progress);break;}}}
 for(const m of this.monsters){if(m.hp<=0)continue;const zoneSlow=Math.max(0,...this.areas.filter(a=>this.areaContains(a,m)).map(a=>a.slow));m.slow=Math.min(.6,zoneSlow+(this.dimUntil>t?.3:0));m.slowed=m.slow>0;const frozen=m.freezeUntil>t||m.stunUntil>t;m.y+=frozen?0:dt/(m.travelTime||(m.boss?20:28))*(1-m.slow);m.hit=Math.max(0,m.hit-dt);if(m.y>=1-1e-8){m.hp=0;const late=w+dt>=this.level.waveDuration-1e-7;if(late){overtimeLeak=true;this.base=0;}else this.base-=m.boss?10:1;this.stats.leaks++;if(!m.boss){this.stats.normalLeaks++;if(m.rush)this.stats.rushLeaks++;}if(this.base<=0)break;}}
 this.monsters=this.monsters.filter(m=>m.hp>0);for(const e of this.effects)e.t+=dt;this.effects=this.effects.filter(e=>e.t<e.life).slice(-160);for(const e of this.pulses)e.t+=dt;this.pulses=this.pulses.filter(e=>e.t<e.life).slice(-60);for(const e of this.bullets)e.t+=dt;this.bullets=this.bullets.filter(e=>e.t<e.life).slice(-140);
 this.tick++;this.elapsed=this.tick/100;this.stats.minPoints=Math.min(this.stats.minPoints,this.points);if(this.base<=0){this.finish(false,overtimeLeak?'超时后敌人触底':'防线失守');return;}if(this.bossSpawned&&this.batchIndex>=this.schedule.length&&!this.monsters.length)this.endWave();}
 update(dt){if(this.phase!=='running'||!Number.isFinite(dt)||dt<=0)return;this.buffer+=dt;while(this.buffer>=.01-1e-9&&this.phase==='running'){this.buffer-=.01;this.step();}if(this.phase!=='running')this.buffer=0;}
 advance(seconds){this.update(seconds);}
 snapshot(){return copy({level:this.level.id,phase:this.phase,wave:this.wave,elapsed:this.elapsed,points:this.points,base:this.base,units:this.units,monsters:this.monsters,hand:this.hand,offers:this.offers,result:this.result});}
}
global.Meadow={Game,DATA:D,UNITS,CARDS,copy,seeded,weighted,initialProgress,settle};
})(typeof window!=='undefined'?window:globalThis);
