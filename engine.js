/* Pure simulation: no DOM, rendering, or storage. Time is measured in seconds. */
(function(global){
const DEFAULTS={duration:120,spawnInterval:2.4,monsterHealth:65,travelTime:24,pointsPerSecond:2,killReward:12,initialPoints:120,speedBuff:25,rangeBuff:1,speedCost:40,rangeCost:50,cloneCost:80};
const TEMPLATES=[{id:'flute',name:'风语长笛',icon:'flute',attackSpeed:1.6,damage:14,range:3,piercing:true,areaAttack:false,shape:[[0,0]]},{id:'harp',name:'晨光竖琴',icon:'harp',attackSpeed:1,damage:28,range:1,piercing:true,areaAttack:false,shape:[[0,0]]},{id:'violin',name:'林间提琴',icon:'violin',attackSpeed:.85,damage:35,range:2,piercing:true,areaAttack:false,shape:[[0,0],[1,0]]},{id:'drum',name:'苔石小鼓',icon:'drum',attackSpeed:.5,damage:45,range:4,piercing:true,areaAttack:false,shape:[[0,0],[1,0],[0,1],[1,1]]}];
const AREA_ATTACK=Object.freeze({ticks:3,damageRatio:.75,slowMultiplier:.75});
const copy=x=>JSON.parse(JSON.stringify(x));
// Profiles created before the piercing switch keep the original all-target behavior.
function normalizeInstrument(p){return {...copy(p),piercing:p.piercing??true,areaAttack:p.areaAttack??false};}
function normalize(shape){if(!shape.length)return [];let x=Math.min(...shape.map(p=>p[0])),y=Math.min(...shape.map(p=>p[1]));return shape.map(p=>[p[0]-x,p[1]-y]);}
function validateTemplate(p){if(p.areaAttack!==undefined&&typeof p.areaAttack!=='boolean')return '范围攻击开关必须为开启或关闭。';if(p.piercing!==undefined&&typeof p.piercing!=='boolean')return '贯穿开关必须为开启或关闭。';if(!p.name?.trim())return '请给乐器起一个名字。';if(!Number.isFinite(p.attackSpeed)||p.attackSpeed<.05||p.attackSpeed>30)return '攻速需在 0.05–30 次 / 秒之间。';if(!Number.isInteger(p.damage)||p.damage<1||p.damage>10000)return '伤害需为 1–10000 的整数。';if(!Number.isInteger(p.range)||p.range<1||p.range>5)return '攻击范围需为 1–5 列的整数。';if(!Array.isArray(p.shape)||!p.shape.length)return '请至少选择一个占格。';let keys=new Set();for(const cell of p.shape){if(!Array.isArray(cell)||cell.length!==2||!cell.every(Number.isInteger)||cell[0]<0||cell[0]>4||cell[1]<0||cell[1]>3)return '占格必须位于 5×4 网格内。';let k=cell.join(',');if(keys.has(k))return '占格不能重复。';keys.add(k);}if(p.shape.length%2===0&&p.range%2!==0)return '偶数占格的乐器，攻击范围必须为 2 或 4 列。';let seen=new Set([p.shape[0].join(',')]),q=[p.shape[0]];while(q.length){let [x,y]=q.pop();for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let k=`${x+dx},${y+dy}`;if(keys.has(k)&&!seen.has(k)){seen.add(k);q.push([x+dx,y+dy]);}}}return seen.size!==keys.size?'占格需上下或左右相连。':'';}
function validateConfig(c){const limits={duration:[5,3600],spawnInterval:[.1,60],monsterHealth:[1,100000],travelTime:[1,600],pointsPerSecond:[0,1000],killReward:[0,10000],initialPoints:[0,100000],speedBuff:[1,1000],rangeBuff:[1,4],speedCost:[0,10000],rangeCost:[0,10000],cloneCost:[0,10000]};for(const [key,[min,max]]of Object.entries(limits)){if(!Number.isFinite(c[key])||c[key]<min||c[key]>max)return `${key} 超出允许范围 ${min}–${max}。`;}for(const key of ['monsterHealth','killReward','initialPoints','rangeBuff','speedCost','rangeCost','cloneCost'])if(!Number.isInteger(c[key]))return `${key} 需要填写整数。`;return '';}
class Game{
 constructor(config=DEFAULTS,random=Math.random){this.config=copy(config);this.random=random;this.units=[];this.seq=0;this.reset();}
 reset(){this.phase='ready';this.elapsed=0;this.points=this.config.initialPoints;this.kills=0;this.monsters=[];this.areas=[];this.bullets=[];this.effects=[];this.pulses=[];this.spawnClock=0;this.hand=[{id:++this.seq,type:'speed'},{id:++this.seq,type:'range'},{id:++this.seq,type:'clone'}];this.units=this.units.filter(u=>!u.clone).map(u=>({...u,profile:copy(u.original),speedBonus:0,rangeBonus:0,cooldown:0,flash:0}));this.result=null;}
 canPlace(p,col,row,ignoreId=null){return p.shape.every(([x,y])=>col+x>=0&&col+x<5&&row+y>=0&&row+y<4&&!this.units.some(u=>!u.clone&&u.id!==ignoreId&&u.profile.shape.some(([ux,uy])=>u.col+ux===col+x&&u.row+uy===row+y)));}
 move(id,col,row){let unit=this.units.find(u=>u.id===id&&!u.clone);if(!unit||!this.canPlace(unit.profile,col,row,id))return false;unit.col=col;unit.row=row;for(let clone of this.units.filter(u=>u.clone&&u.parent===id)){clone.col=col;clone.row=row;}return true;}
 place(p,col,row){if(!this.canPlace(p,col,row))return null;const profile=normalizeInstrument(p);let u={id:++this.seq,profile,original:copy(profile),col,row,speedBonus:0,rangeBonus:0,cooldown:0,flash:0,clone:false};this.units.push(u);return u;}
 at(col,row){return this.units.find(u=>!u.clone&&u.profile.shape.some(([x,y])=>u.col+x===col&&u.row+y===row));}
 center(u){let s=u.profile.shape;return {x:u.col+s.reduce((n,p)=>n+p[0]+.5,0)/s.length,row:u.row+s.reduce((n,p)=>n+p[1]+.5,0)/s.length};}
 attackSpeed(u){return u.profile.attackSpeed*(1+u.speedBonus);}
 attackRange(u){return Math.min(u.profile.shape.length%2===0?4:5,u.profile.range+u.rangeBonus);}
 lanes(u){
   const range=this.attackRange(u),center=this.center(u).x,half=Math.floor(range/2);
   let lanes=[];
   if(range%2===0){
     // Split an even range equally around the actual firing axis.
     // A lane whose center is exactly on that axis is not a left or right lane.
     const axis=center-.5;
     const leftEnd=Math.ceil(axis)-1,rightStart=Math.floor(axis)+1;
     for(let offset=0;offset<half;offset++)lanes.push(leftEnd-offset,rightStart+offset);
   }else{
     const anchor=Math.floor(center);
     for(let offset=-half;offset<=half;offset++)lanes.push(anchor+offset);
   }
   // Clip at the battlefield edge; never move lost coverage to the other side.
   return lanes.filter(lane=>lane>=0&&lane<5).sort((a,b)=>a-b);
 }
 remove(id){this.units=this.units.filter(u=>u.id!==id&&u.parent!==id);}
 buy(type){let cost=this.config[type+'Cost'];if(!Number.isFinite(cost)||!['speed','range','clone'].includes(type))return {ok:false,message:'未知的卡牌。'};if(this.points+1e-8<cost)return {ok:false,message:'协奏点还不够，再听一会儿风吧。'};if(this.hand.length>=30)return {ok:false,message:'手牌已满（30 张），先使用一些灵感吧。'};this.points=Math.max(0,this.points-cost);this.hand.push({id:++this.seq,type});return {ok:true,message:'一份新的灵感，已收入牌堆。'};}
 useCard(cardId,unitId){let card=this.hand.find(c=>c.id===cardId),u=this.units.find(u=>u.id===unitId);if(!card||!u)return {ok:false,message:'请先选择卡牌，再选择乐器。'};if(card.type==='speed')u.speedBonus+=this.config.speedBuff/100;
 if(card.type==='range'){let before=this.attackRange(u),next=Math.min(u.profile.shape.length%2===0?4:5,before+this.config.rangeBuff);if(u.profile.shape.length%2===0&&next%2)next++;next=Math.min(u.profile.shape.length%2===0?4:5,next);if(next===before)return {ok:false,message:'这件乐器的攻击范围已经达到上限。'};u.rangeBonus+=next-before;}
 if(card.type==='clone'){if(this.units.length>=80)return {ok:false,message:'乐团已达到 80 件乐器的演奏上限。'};this.units.push({...copy(u),id:++this.seq,clone:true,parent:u.clone?u.parent:u.id,cooldown:0,flash:.5});}
 this.hand=this.hand.filter(c=>c.id!==cardId);u.flash=.5;return {ok:true,message:card.type==='clone'?'回响出现，同一处多了一道旋律。':'灵感已生效，让旋律继续生长。'};}
 start(){if(this.phase==='ready'||this.phase==='paused')this.phase='running';}
 pause(){if(this.phase==='running')this.phase='paused';}
 spawn(){let max=this.config.monsterHealth;this.monsters.push({id:++this.seq,lane:Math.floor(this.random()*5),y:0,hp:max,maxHp:max,variant:Math.floor(this.random()*3),wobble:this.random()*6.28,hit:0,slowed:false});}
 areaContains(area,monster){return area.lane===monster.lane&&monster.y>=area.start&&monster.y<area.end;}
 refreshSlows(){for(const monster of this.monsters)monster.slowed=this.areas.some(area=>area.ticks<AREA_ATTACK.ticks&&this.areaContains(area,monster));}
 createDamageAreas(unit,lanes,rate,bornAt=this.elapsed){
   const duration=1/rate;
   for(const lane of lanes){
     const band=Math.min(2,Math.floor(this.random()*3));
     this.areas.push({id:++this.seq,unitId:unit.id,lane,band,start:band/3,end:(band+1)/3,
       age:0,bornAt,duration,interval:duration/AREA_ATTACK.ticks,ticks:0,pulse:0,
       damage:rate*AREA_ATTACK.damageRatio,clone:unit.clone});
   }
 }
 damageMonster(monster,damage){
   if(!monster||monster.hp<=0)return;
   monster.hp-=damage;
   if(monster.hp<1e-9)monster.hp=0;
   monster.hit=.24;
   this.effects.push({x:monster.lane+.5,y:monster.y,t:0,life:.4,burst:true,color:'#f4e4a1'});
   this.effects.push({x:monster.lane+.5,y:monster.y,t:0,life:.65,text:`−${Number(damage.toFixed(3))}`,color:'#5f7050'});
   if(monster.hp<=0){
     this.kills++;this.points+=this.config.killReward;
     this.effects.push({x:monster.lane+.5,y:monster.y,t:0,life:.8,text:`+${this.config.killReward} ✦`,color:'#967a38'});
   }
 }
 updateAreas(dt){
   for(const area of this.areas){
     area.age=Math.min(area.duration,Math.max(0,this.elapsed-area.bornAt));
     area.pulse=Math.max(0,area.pulse-dt);
     while(area.ticks<AREA_ATTACK.ticks&&area.age+1e-9>=(area.ticks+1)*area.interval){
       area.ticks++;area.pulse=.22;
       // Sample current occupants at each tick; entering or leaving changes who is hit.
       for(const monster of this.monsters){
         if(monster.hp>0&&this.areaContains(area,monster))this.damageMonster(monster,area.damage);
       }
     }
   }
   this.areas=this.areas.filter(area=>area.ticks<AREA_ATTACK.ticks);
   this.refreshSlows();
 }

 finish(win){this.phase=win?'won':'lost';this.result={win,time:this.elapsed,kills:this.kills,points:Math.floor(this.points)};}
 update(dt){if(this.phase!=='running')return;dt=Math.min(dt,1/30);const effective=Math.min(dt,Math.max(0,this.config.duration-this.elapsed));if(!effective){this.finish(true);return;}dt=effective;this.elapsed+=dt;this.points+=this.config.pointsPerSecond*dt;this.spawnClock+=dt;
 while(this.spawnClock>=this.config.spawnInterval){this.spawnClock-=this.config.spawnInterval;this.spawn();}
 this.refreshSlows();
 for(let m of this.monsters){m.y+=dt/this.config.travelTime*(m.slowed?AREA_ATTACK.slowMultiplier:1);m.hit=Math.max(0,m.hit-dt);if(m.y>=1){this.finish(false);return;}}
 // Piercing attacks hit every living target; single-target attacks hit the frontmost one.
 // All notes use the same lifetime, so a volley lands simultaneously regardless of distance.
 for(const u of this.units){
   u.cooldown-=dt;
   u.flash=Math.max(0,u.flash-dt);
   if(u.cooldown>1e-9)continue;
   const lanes=this.lanes(u);
   const rate=this.attackSpeed(u);
   if(u.profile.areaAttack){
     if(!lanes.length){u.cooldown=0;continue;}
     const castAt=this.elapsed+Math.min(0,u.cooldown);
     u.cooldown=Math.max(0,u.cooldown+1/rate);
     u.flash=.28;
     const center=this.center(u);
     this.pulses.push({unitId:u.id,x:center.x,y:(.65+center.row*.08-.04)/.56,lanes:[],t:0,life:.5,clone:u.clone});
     this.createDamageAreas(u,lanes,rate,castAt);
     continue;
   }
   const candidates=this.monsters.filter(m=>m.hp>0&&lanes.includes(m.lane));
   if(!candidates.length){u.cooldown=0;continue;}
   // Larger y means closer to the defense line. A stable tie keeps the older target.
   const targets=u.profile.piercing===false
     ? [candidates.reduce((front,monster)=>monster.y>front.y?monster:front)]
     : candidates;
   const center=this.center(u);
   const origin={x:center.x,y:(.65+center.row*.08-.04)/.56};
   // Attack speed belongs to the whole volley, not to individual targets or lanes.
   u.cooldown=Math.max(0,u.cooldown+1/rate);
   u.flash=.28;
   this.pulses.push({unitId:u.id,...origin,lanes:u.profile.piercing===false?[targets[0].lane]:lanes,t:0,life:.5,clone:u.clone});
   for(const target of targets){
     this.bullets.push({id:++this.seq,unitId:u.id,targetId:target.id,from:{...origin},
       to:{x:target.lane+.5,y:target.y},t:0,life:.3,damage:u.profile.damage,
       clone:u.clone,note:this.random()>.5?'♪':'♫'});
   }
 }

 for(const bullet of this.bullets){
   bullet.t+=dt;
   const target=this.monsters.find(monster=>monster.id===bullet.targetId);
   if(target)bullet.to={x:target.lane+.5,y:target.y};
   if(bullet.t>=bullet.life)this.damageMonster(target,bullet.damage);
 }
 this.updateAreas(dt);
 this.bullets=this.bullets.filter(b=>b.t<b.life);this.monsters=this.monsters.filter(m=>m.hp>0);for(let e of this.effects)e.t+=dt;this.effects=this.effects.filter(e=>e.t<e.life);for(let p of this.pulses)p.t+=dt;this.pulses=this.pulses.filter(p=>p.t<p.life);if(this.elapsed>=this.config.duration-1e-8){this.elapsed=this.config.duration;this.finish(true);}}
 advance(seconds){let remaining=seconds;while(remaining>1e-8&&this.phase==='running'){let dt=Math.min(remaining,1/60);this.update(dt);remaining-=dt;}}
}
global.Meadow={Game,DEFAULTS,TEMPLATES,AREA_ATTACK,copy,normalize,normalizeInstrument,validateTemplate,validateConfig};
})(typeof window!=='undefined'?window:globalThis);
