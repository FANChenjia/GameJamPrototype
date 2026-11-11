(function(){
'use strict';
const $=s=>document.querySelector(s), D=ConcertoData, M=Meadow, {CARDS,UNITS}=M;
const STORE='concerto-meadow.campaign.v2',esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let progress=M.initialProgress();try{const s=JSON.parse(localStorage.getItem(STORE));if(s&&s.version===2&&Number.isFinite(s.rhythm)&&s.rhythm>=0&&Number.isInteger(s.unlocked)&&s.unlocked>=0&&s.unlocked<=9&&Array.isArray(s.cleared)){progress={...progress,...s,cleared:s.cleared.filter(id=>D.levels.some(l=>l.id===id)),shops:s.shops||{}};}}catch{}
let game=null,painter=null,currentLevel=D.levels[progress.unlocked],activeIsland=currentLevel.island,selectedTemplate=null,selectedCard=null,selectedUnit=null,resumeTactical=false,view='map',toastTimer,last=performance.now(),lastHud=0,settled=false,overflowKeep=new Set(),overflowResume=false,drag=null,suppressClick=0,tutorialSignature='',tutorialTargets=[],tutorialHoles=[],progressResetResume=null;
const canvas=$('#battle-canvas'),ghost=document.createElement('div');ghost.className='drag-ghost hidden';document.body.append(ghost);
let seenSettlements=0;
let tutorialDirty=true,tutorialUIKey='',tutorialLayoutPending=false;
function setText(selector,value){const el=$(selector),next=String(value);if(el.textContent!==next)el.textContent=next;}
function invalidateBattle(){if(painter)painter.dirty=true;}
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
function persist(){try{localStorage.setItem(STORE,JSON.stringify(progress));}catch{}}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function time(s){s=Math.ceil(Math.max(0,s-1e-7));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function switchView(next){view=next;if(next!=='battle'){$('#tutorial-shade').classList.add('hidden');$('#tutorial-panel').classList.add('hidden');}for(const [id,key] of [['#map-screen','map'],['#shop-screen','shop'],['#battle-screen','battle']])$(id).classList.toggle('hidden',key!==next);$('#map-open').classList.toggle('hidden',next==='map');$('#resume-game').classList.toggle('hidden',next!=='map'||!game||['won','lost'].includes(game.phase));$('#rhythm-points').textContent=progress.rhythm;if(next==='battle'&&painter)requestAnimationFrame(()=>painter.resize());}
function openProgressReset(){
 const dialog=$('#progress-reset-dialog');if(dialog.open)return;progressResetResume=game?.phase==='running'?game:null;game?.pause();$('#tutorial-panel').classList.add('hidden');$('#tutorial-shade').classList.add('hidden');dialog.showModal();$('#progress-reset-cancel').focus();
}
function resetAllProgress(){
 progressResetResume=null;game?.pause();if(drag){try{drag.el.releasePointerCapture?.(drag.pointer);}catch{}endDrag();}clearSelected();
 for(const el of document.querySelectorAll('.card-fly,.card-drop-burst'))el.remove();
 progress=M.initialProgress();try{localStorage.removeItem(STORE);}catch{}persist();game=null;
 if(painter){painter.game=null;painter.draggingId=null;painter.showRange=false;}
 currentLevel=D.levels[0];activeIsland=1;settled=false;resumeTactical=false;overflowResume=false;overflowKeep.clear();suppressClick=0;tutorialSignature='';tutorialTargets=[];tutorialHoles=[];handSignature='';offerSignature='';
 for(const el of document.querySelectorAll('.tutorial-target'))el.classList.remove('tutorial-target');
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();$('#range-toggle').setAttribute('aria-pressed','false');showMap();toast('全部进度已重置');
}
for(const button of document.querySelectorAll('.reset-progress-trigger'))button.onclick=openProgressReset;
$('#progress-reset-cancel').onclick=()=>$('#progress-reset-dialog').close();
$('#progress-reset-confirm').onclick=resetAllProgress;
$('#progress-reset-dialog').addEventListener('close',()=>{const resume=progressResetResume;progressResetResume=null;if(resume&&resume===game)game.start();if(game&&view==='battle')renderAll();});
$('#brand-icon').innerHTML=Art.icon('harp');
function effect(c){return c.description.replace('；开局开放，仅局外商店','').replace('、不解锁内容','');}
document.addEventListener('dragstart',e=>{if(e.target.closest?.('.play-card,.card-visual,.drag-ghost'))e.preventDefault();},true);
document.addEventListener('selectstart',e=>{if(e.target.closest?.('.play-card,.card-visual,.drag-ghost'))e.preventDefault();});
function cardArt(c){return `<span class="card-visual${c.summon?' placeholder':''}"><img src="${c.art}" alt="${esc(c.name)}" loading="lazy" draggable="false"></span>`;}
function cardButton(type,extra='',purchase=false){const c=CARDS[type],b=document.createElement('button');b.type='button';b.className='play-card '+extra;b.draggable=false;const price=purchase?`购买 ${c.cost} 协奏点`:'免费使用';b.title=`${c.name} · ${price}\n${effect(c)}`;b.setAttribute('aria-label',`${c.name}，${price}，${effect(c)}`);b.innerHTML=cardArt(c)+`<strong>${esc(c.name)}</strong><small>${purchase?`✦ ${c.cost} 购买`:"免费使用"}</small>`;return b;}
function showMap(){if(game){game.pause();cancelSelection(false);}$('#chapter-label').textContent='选择岛屿';switchView('map');renderMap();}
function levelName(level){return `${D.islands[level.island-1].name} · ${level.id==='1-1'?'新手引导':'第'+level.part+'关'}`;}
function renderMap(){const area=$('#island-list');area.replaceChildren();D.islands.forEach((island,index)=>{const n=index+1,levels=D.levels.filter(l=>l.island===n),available=levels.some(l=>l.index<=progress.unlocked),cleared=levels.filter(l=>progress.cleared.includes(l.id)).length,b=document.createElement('button');b.className='island-node'+(n===activeIsland?' active':'')+(!available?' locked':'');b.setAttribute('aria-pressed',String(n===activeIsland));b.setAttribute('aria-label',`第${n}岛 ${island.name} ${island.english}${available?'':'，未解锁'}`);b.innerHTML=`<span class="island-land"><span>${Art.icon(island.symbol)}</span><b class="island-status">${available?(cleared===levels.length?'✓':String(n)):'锁'}</b></span><strong>${island.name}</strong><small class="island-english">${island.english}</small><small>${cleared} / ${levels.length}</small>`;b.onclick=()=>{activeIsland=n;renderMap();};area.append(b);});$('#campaign-progress').textContent=progress.cleared.length+' / 10';$('#island-name').textContent=`第${['一','二','三','四','五'][activeIsland-1]}岛 · ${D.islands[activeIsland-1].name}`;$('#island-unlock').textContent=activeIsland===5?'全乐器可用':'新增'+D.islands[activeIsland-1].newFamily+'乐器';const list=$('#level-list');list.replaceChildren();for(const level of D.levels.filter(l=>l.island===activeIsland)){const b=document.createElement('button'),cleared=progress.cleared.includes(level.id);b.className='level-card';b.disabled=level.index>progress.unlocked;b.innerHTML=`<span class="level-boss-portrait" aria-hidden="true">${Portraits.boss(level.bossPortrait)}</span><div><strong>${level.id==='1-1'?'新手引导':'第'+level.part+'关'}</strong><small>标准 120 秒 · ${level.waves.length} 波</small></div><span>${b.disabled?'锁':cleared?'✓':'→'}</span>`;b.onclick=()=>showShop(level);list.append(b);}}
function shopState(level=currentLevel){let s=progress.shops[level.id];if(!s||!Array.isArray(s.purchased)||!Array.isArray(s.offers)||s.offers.length!==6){s=progress.shops[level.id]={purchased:[],offers:Array.from({length:6},()=>({type:M.weighted('shopWeight'),sold:false}))};persist();}s.purchased=s.purchased.filter(id=>CARDS[id]).slice(0,3);return s;}
function showShop(level){if(level.index>progress.unlocked)return;game?.pause();cancelSelection(false);currentLevel=level;shopState();$('#chapter-label').textContent=levelName(level);switchView('shop');renderShop();}
function renderShop(){const s=shopState();$('#shop-level').textContent=levelName(currentLevel);$('#shop-boss').innerHTML=Portraits.boss(currentLevel.bossPortrait)+`<span>${esc(currentLevel.bossName)}</span>`;
 $('#prebuy-count').textContent=`预购 ${s.purchased.length} / 3`;$('#rhythm-points').textContent=progress.rhythm;$('#shop-refresh').disabled=progress.rhythm<2;$('#outside-cards').replaceChildren();s.offers.forEach((item,index)=>{const c=CARDS[item.type];if(!c)return;const div=document.createElement('div');div.className='shop-item';div.innerHTML=cardArt(c)+`<strong>${esc(c.name)}</strong><p>${esc(effect(c))}</p><span class="release-cost">入场后免费使用</span><button class="secondary-button">${item.sold?'已购买':c.rhythm+' 韵律'}</button>`;const b=div.querySelector('button');b.disabled=item.sold||s.purchased.length>=3||progress.rhythm<c.rhythm;b.onclick=()=>{if(b.disabled)return;progress.rhythm-=c.rhythm;item.sold=true;s.purchased.push(c.id);persist();renderShop();};$('#outside-cards').append(div);});$('#prebuy-list').innerHTML=s.purchased.length?s.purchased.map(id=>`<span class="prebuy-chip">${esc(CARDS[id].name)}</span>`).join(''):'—';$('#shop-summary').textContent=`初始协奏 ${currentLevel.initial} · ${currentLevel.waves.length} 波 · 常驻上限 ${currentLevel.cap}`;}
$('#shop-refresh').onclick=()=>{if(progress.rhythm<2)return;progress.rhythm-=2;shopState().offers=Array.from({length:6},()=>({type:M.weighted('shopWeight'),sold:false}));persist();renderShop();};
function enterLevel(){const prepaid=shopState().purchased;game=new M.Game(currentLevel.id,{prepaid,tutorial:currentLevel.id==='1-1'});new M.TutorialGuide(game);tutorialSignature='';tutorialDirty=true;seenSettlements=0;$('#wave-settlement').classList.add('hidden');settled=false;if(!painter)painter=new MeadowPainter(canvas,game);else painter.game=game;cancelSelection(false);switchView('battle');$('#chapter-label').textContent=levelName(currentLevel);renderAll();}
function beginTactical(){if(game.phase==='running'){game.pause();resumeTactical=true;}}
function clearSelected(){selectedCard=null;selectedTemplate=null;selectedUnit=null;if(painter){painter.selected=null;painter.placement=null;painter.hover=null;}}
function cancelSelection(resume=true){if(game?.arranging)return;clearSelected();if(resume&&resumeTactical&&game?.phase==='paused')game.start();resumeTactical=false;if(game&&view==='battle')renderAll();}
function finishSelection(){clearSelected();if(game.pendingCards.length){overflowResume=resumeTactical||game.phase==='running';resumeTactical=false;showOverflow();return;}if(resumeTactical&&game.phase==='paused')game.start();resumeTactical=false;renderAll();}
function selectCard(id){if(game.arranging)return;if(selectedCard===id){cancelSelection();return;}const card=game.hand.find(c=>c.id===id);if(!card)return;beginTactical();selectedCard=id;selectedTemplate=null;selectedUnit=null;painter.selected=null;painter.placement=CARDS[card.type].summon?UNITS[CARDS[card.type].summon]:null;renderAll();}
function renderHand(){tutorialDirty=true;invalidateBattle();const area=$('#hand-cards');area.replaceChildren();if(!game.hand.length){const p=document.createElement('p');p.className='hand-empty';p.textContent='从抽选购买奏法牌';area.append(p);}for(const card of game.hand){const b=cardButton(card.type,card.id===selectedCard?'selected':'');b.dataset.cardId=card.id;b.disabled=game.guideBlocks('card',{type:card.type});b.onclick=()=>{if(performance.now()>=suppressClick)selectCard(card.id);};installDrag(b,()=>game.arranging||game.pendingCards.length?null:{kind:'card',cardId:card.id,type:card.type,profile:CARDS[card.type].summon?UNITS[CARDS[card.type].summon]:null});area.append(b);}$('#hand-count').textContent=game.hand.length+' / 8';renderDetail();}
function renderDetail(){const detail=$('#card-detail'),card=game.hand.find(c=>c.id===selectedCard);detail.replaceChildren();if(!card){detail.textContent=game.hand.length?'拖放手牌到目标使用':'抽选购买 · 手牌免费使用';return;}const c=CARDS[card.type],body=document.createElement('div');body.innerHTML=`<strong>${esc(c.name)} · 免费使用</strong><span>${esc(effect(c))}</span>`;detail.append(body);const actions=document.createElement('div');actions.className='card-detail-actions';if(['global','arrange'].includes(c.target)){const b=document.createElement('button');b.className='primary-button';b.textContent=c.target==='arrange'?'开始重排':'释放';b.onclick=()=>playSelected();actions.append(b);}else{const text=document.createElement('span');text.textContent=c.target==='unit'?'拖到乐器上，或点击目标':'拖到空格上，或点击位置';actions.append(text);}const discard=document.createElement('button');discard.className='secondary-button';discard.textContent='弃牌';discard.disabled=game.guideBlocks('discard');discard.onclick=()=>{game.discard(card.id);finishSelection();};const cancel=document.createElement('button');cancel.className='secondary-button';cancel.textContent='取消';cancel.onclick=()=>cancelSelection();actions.append(discard,cancel);detail.append(actions);}
function playSelected(target){const result=game.useCard(selectedCard,target);if(!result.ok){toast(result.message);return;}if(result.arrange){selectedCard=null;selectedTemplate=null;painter.placement=null;renderAll();return;}finishSelection();}
function offerUnavailable(index){const offer=game.offers[index];return !offer||['won','lost'].includes(game.phase)||game.arranging||game.pendingCards.length>0||game.points+1e-7<CARDS[offer.type].cost||game.guideBlocks('claim',{index});}
function renderDraw(){tutorialDirty=true;invalidateBattle();const area=$('#draw-cards');area.replaceChildren();if(!game.offers.length){const p=document.createElement('p');p.className='draw-empty';p.textContent=['won','lost'].includes(game.phase)?'本关已结束':'点击刷新抽选卡牌';area.append(p);}else game.offers.forEach((card,index)=>{const b=cardButton(card.type,index===0&&game.guarantee?'pity':'',true);b.dataset.offerId=card.id;b.dataset.slot=index;b.disabled=offerUnavailable(index);b.onclick=()=>{const result=game.claimOffer(index);if(!result.ok){toast(result.message);return;}if(game.pendingCards.length){overflowResume=game.phase==='running';showOverflow();}renderHand();renderDraw();updateHud();};area.append(b);});$('#draw-refresh').textContent=game.freeRefresh?`免费刷新 · ${game.freeRefresh} 次`:'刷新 · 6 协奏';$('#draw-refresh').disabled=['won','lost'].includes(game.phase)||game.arranging||game.pendingCards.length>0||(!game.freeRefresh&&game.points<6)||game.guideBlocks('refresh');}
function renderBench(){tutorialDirty=true;invalidateBattle();const list=$('#instrument-list');list.replaceChildren();for(const p of D.units.filter(u=>!u.summon&&u.unlock<=game.level.island)){const b=document.createElement('button');b.className='instrument-option'+(selectedTemplate?.id===p.id?' selected':'');b.title=`${p.name} · ${p.width}×${p.height} · ${p.attackSpeed} 次/秒 · ${p.damage} 伤害\n${p.description}`;b.setAttribute('aria-label',`${p.name}，${p.cost} 协奏点，${p.width}列${p.height}行`);b.innerHTML=`<span>${Portraits.instrument(p.portrait||p.id)}</span><strong>${p.name}</strong><small>✦ ${p.cost} · ${p.width}×${p.height}</small>`;b.disabled=game.arranging||['won','lost'].includes(game.phase)||game.guideBlocks('select',{profile:p});b.onclick=()=>{if(performance.now()<suppressClick)return;cancelSelection();selectedTemplate=p;painter.placement=p;renderBench();updateHud();};installDrag(b,()=>({kind:'template',profile:p,dx:0,dy:0}));list.append(b);}}
function renderInstrumentInfo(u){
 const panel=$('#unit-status'),p=selectedTemplate||u?.profile;panel.classList.toggle('hidden',!p);if(!p)return;
 const current=u?.profile.id===p.id?u:null,family={plucked:'拨弦',wind:'吹奏',percussion:'打击',bowed:'拉弦'}[p.family];
 const buffs=current?Object.entries(current.buffs).filter(([,until])=>until>game.elapsed).map(([id,until])=>`${CARDS[id].name} ${Math.ceil(until-game.elapsed)} 秒`):[];
 const speed=current?game.attackSpeed(current):p.attackSpeed,damage=current?game.directDamage(current):p.damage;
 const key=[p.id,current?.id,current?.permSpeed,speed,damage,buffs.join('/'),current?.sforzando,current?.accentProgress].join('|');if(panel._infoKey===key)return;panel._infoKey=key;
 const live=current?`<div class="instrument-live">常驻攻速 +${Math.round(current.permSpeed*100)}%${buffs.length?' · '+esc(buffs.join(' / ')):''}${p.family==='percussion'?' · 重音 '+current.accentProgress+'/100'+(p.id==='marimba'?'（按伤害次数）':' 次普攻'):''}${current.sforzando?' · 突强就绪':''}</div>`:'';
 const html=`<div class="instrument-portrait">${Portraits.instrument(p.portrait||p.id)}</div><div class="instrument-copy"><div class="instrument-info-heading"><strong>${esc(p.name)}</strong><span>${family}${p.summon?' · 召唤':''}</span></div><p>${esc(p.description)}</p><div class="instrument-attributes"><span>${p.summon?"奏法召唤 · 使用免费":p.cost+" 协奏"}</span><span>${p.width}×${p.height} 格</span><span>${+speed.toFixed(2)} 次/秒</span><span>${current?'当前':'基础'}伤害 ${+damage.toFixed(2)}</span></div>${live}</div>`;
 if(panel._infoMarkup!==html){panel._infoMarkup=html;panel.innerHTML=html;}
}
function updateHud(){if(!game)return;setText('#rhythm-points',progress.rhythm);setText('#book-points',Math.floor(game.points+1e-7));setText('#income-label',`+${game.level.income} / 秒`);setText('#timer',time(game.remainingTime));setText('#base-count',game.base);setText('#kill-count',game.kills);setText('#level-label',levelName(game.level));setText('#wave-label',`第 ${game.wave+1} / ${game.level.waves.length} 波`);const until=game.level.waveDuration-20-game.waveElapsed,bossLanes=game.bossLanes();setText('#wave-tip',`${game.overtime?'本波超时 +'+time(Math.floor(game.waveElapsed-game.level.waveDuration+1e-7))+' · 触底即失败':'本波 '+time(game.waveRemaining)} · Boss 第 ${bossLanes[0]+1}–${bossLanes.at(-1)+1} 列${until>0?' · '+time(until):''}`);$('#wave-tip').classList.toggle('overtime-warning',game.overtime);const boss=game.monsters.find(m=>m.boss&&m.hp>0);$('#boss-health').classList.toggle('hidden',!boss);if(boss){setText('#boss-health',game.level.bossName+' '+Math.ceil(boss.hp/boss.maxHp*100)+'%');$('#boss-health').title=Math.ceil(boss.hp)+' / '+boss.maxHp+' · 三条声部共享生命；每件乐器一次普攻仅命中一次';}setText('#placed-count',`常驻 ${game.permanentCount}/${game.level.cap} · 召唤 ${game.summonCount}/2`);const phases={ready:'布阵',running:'战斗中',paused:'已暂停',won:'通关',lost:'失败'};setText('#phase-label',game.arranging?'战术重排':game.overtime&&['running','paused'].includes(game.phase)?(game.phase==='paused'?'超时 · 已暂停':'超时 · 触底即失败'):phases[game.phase]);setText('#start-game',{ready:'开始战斗',running:'暂停',paused:'继续战斗',won:'已通关',lost:'已结束'}[game.phase]);$('#start-game').disabled=['won','lost'].includes(game.phase)||game.arranging||game.pendingCards.length>0||(game.phase!=='running'&&game.guideBlocks('start'));$('#arrange-controls').classList.toggle('hidden',!game.arranging);const u=game.units.find(u=>u.id===selectedUnit&&!u.clone);setText('#sell-unit','移除');$('#sell-unit').title='准备阶段移除并全额退还布置费用';$('#sell-unit').disabled=!u||game.phase!=='ready'||game.arranging||game.guideBlocks('sell',{id:u?.id});renderInstrumentInfo(u);const c=game.hand.find(c=>c.id===selectedCard);setText('#field-tip',game.arranging?'拖动乐器，或选中后点击空格':selectedTemplate?`${selectedTemplate.name} · ${selectedTemplate.cost} 协奏 · 选择空格`:c?`${CARDS[c.type].name} · ${CARDS[c.type].target==='unit'?'选择乐器':'选择位置'}`:u?`${u.profile.name} · ${game.attackSpeed(u).toFixed(2)} 次/秒 · ${game.directDamage(u).toFixed(1)} 伤害 · 第 ${game.lanes(u).map(l=>l+1).join('/')} 列`:(game.canEdit?'选择乐器放置，选中后可移动或移除':'选择卡牌或布置新乐器'));setText('#draw-status',game.refreshCount?`本波刷新 ${game.refreshCount} 次`:game.wave===0?'首组免刷新费':'候选保留');$('#draw-refresh').disabled=['won','lost'].includes(game.phase)||game.arranging||game.pendingCards.length>0||(!game.freeRefresh&&game.points<6)||game.guideBlocks('refresh');for(const b of document.querySelectorAll('#draw-cards [data-slot]'))b.disabled=offerUnavailable(Number(b.dataset.slot));renderTutorial();}
function renderAll(){if(!game)return;invalidateBattle();syncGuide();renderHand();renderDraw();renderBench();updateHud();$('#arrange-controls').classList.toggle('hidden',!game.arranging);}
function focusTutorialTarget(force=false){
 const guide=game?.guide;if(!guide?.active)return;const selectors=guide.targets(),index=guide.step==='use'&&selectedCard?1:0,el=document.querySelector(selectors[index]||selectors[0]);if(!el)return;
 const r=el.getBoundingClientRect();if(force||r.top<16||r.bottom>innerHeight-16||r.left<0||r.right>innerWidth)el.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'nearest'});
}
function scheduleTutorialLayout(){
 if(tutorialLayoutPending)return;tutorialLayoutPending=true;requestAnimationFrame(()=>{tutorialLayoutPending=false;positionTutorial();});
}
function attr(el,key,value){value=String(value);if(el.getAttribute(key)!==value)el.setAttribute(key,value);}
function positionTutorial(){
 const guide=game?.guide,panel=$('#tutorial-panel'),shade=$('#tutorial-shade');if($('#progress-reset-dialog').open||!guide?.active||view!=='battle'){shade.classList.add('hidden');return;}
 const focused=!['play','finish'].includes(guide.step),vw=innerWidth,vh=innerHeight,width=Math.min(340,vw-24);
 if(panel.style.width!==width+'px')panel.style.width=width+'px';
 // Read geometry once per animation frame, only after a state/layout change.
 const rects=tutorialTargets.map(el=>el.getBoundingClientRect()),height=panel.getBoundingClientRect().height;
 tutorialHoles=rects.map(r=>({x:Math.max(0,Math.round(r.left-6)),y:Math.max(0,Math.round(r.top-6)),right:Math.min(vw,Math.round(r.right+6)),bottom:Math.min(vh,Math.round(r.bottom+6))})).filter(r=>r.right>r.x&&r.bottom>r.y);
 attr(panel,'role',focused?'dialog':'region');attr(panel,'aria-modal',focused);shade.classList.toggle('hidden',!focused);
 if(focused){
  if(!shade._parts){shade.innerHTML='<defs><mask id="tutorial-cutouts"><rect fill="white"/><g fill="black"></g></mask></defs><rect fill="#3e2d23" opacity=".62" mask="url(#tutorial-cutouts)"/>';shade._parts={white:shade.querySelector('mask>rect'),holes:shade.querySelector('g'),overlay:shade.lastElementChild};}
  attr(shade,'viewBox',`0 0 ${vw} ${vh}`);const parts=shade._parts;for(const el of [parts.white,parts.overlay]){attr(el,'width',vw);attr(el,'height',vh);}
  while(parts.holes.children.length>tutorialHoles.length)parts.holes.lastElementChild.remove();
  tutorialHoles.forEach((r,i)=>{let el=parts.holes.children[i];if(!el){el=document.createElementNS('http://www.w3.org/2000/svg','rect');attr(el,'rx',9);parts.holes.append(el);}attr(el,'x',r.x);attr(el,'y',r.y);attr(el,'width',r.right-r.x);attr(el,'height',r.bottom-r.y);});
 }
 const r=rects[guide.step==='use'&&selectedCard?1:0]||rects[0],gap=15;let x=12,y=12,side='bottom';
 if(r&&r.bottom>0&&r.top<vh){const candidates=[{x:r.right+gap,y:r.top+(r.height-height)/2,side:'right'},{x:r.left-gap-width,y:r.top+(r.height-height)/2,side:'left'},{x:r.left+(r.width-width)/2,y:r.top-height-gap,side:'top'},{x:r.left+(r.width-width)/2,y:r.bottom+gap,side:'bottom'}],positioned=candidates.map(c=>({...c,x:Math.max(12,Math.min(vw-width-12,c.x)),y:Math.max(12,Math.min(vh-height-12,c.y))})),overlap=c=>tutorialHoles.reduce((n,h)=>n+Math.max(0,Math.min(c.x+width,h.right)-Math.max(c.x,h.x))*Math.max(0,Math.min(c.y+height,h.bottom)-Math.max(c.y,h.y)),0);({x,y,side}=positioned.find(c=>overlap(c)===0)||positioned.sort((a,b)=>overlap(a)-overlap(b))[0]);}
 x=Math.round(Math.max(12,Math.min(vw-width-12,x)));y=Math.round(Math.max(12,Math.min(vh-height-12,y)));const transform=`translate3d(${x}px,${y}px,0)`;if(panel.style.transform!==transform)panel.style.transform=transform;if(panel.dataset.side!==side)panel.dataset.side=side;
 const arrow=$('#tutorial-arrow');arrow.classList.toggle('hidden',!r||r.bottom<=0||r.top>=vh);if(r){const left=(side==='right'?-6:side==='left'?width-6:Math.max(18,Math.min(width-24,r.left+r.width/2-x-5)))+'px',top=(side==='top'?height-6:side==='bottom'?-6:Math.max(18,Math.min(height-24,r.top+r.height/2-y-5)))+'px';if(arrow.style.left!==left)arrow.style.left=left;if(arrow.style.top!==top)arrow.style.top=top;}
}
function tutorialEventAllowed(e){if($('#progress-reset-dialog').open||e.target.closest?.('#progress-reset-dialog,.reset-progress-trigger'))return true;const guide=game?.guide;if(!guide?.active||view!=='battle'||['play','finish'].includes(guide.step))return true;if(e.target.closest?.('#tutorial-panel'))return true;if(e.detail===0&&tutorialTargets.some(el=>el===e.target||el.contains(e.target)))return true;return tutorialHoles.some(r=>e.clientX>=r.x&&e.clientX<=r.right&&e.clientY>=r.y&&e.clientY<=r.bottom);}
document.addEventListener('pointerdown',e=>{if(!tutorialEventAllowed(e)){if(e.pointerType!=='touch')e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('click',e=>{if(!tutorialEventAllowed(e)){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('keydown',e=>{if($('#progress-reset-dialog').open)return;const guide=game?.guide;if(!guide?.active||view!=='battle'||['play','finish'].includes(guide.step))return;if(e.key==='Tab'){const controls=[...new Set([...tutorialTargets.flatMap(el=>el.matches('button')?[el]:[...el.querySelectorAll('button')]),...$('#tutorial-panel').querySelectorAll('button'),$('#reset-progress')])].filter(el=>!el.disabled&&el.getClientRects().length);if(!controls.length)return;const index=controls.indexOf(document.activeElement),next=(index+(e.shiftKey?-1:1)+controls.length)%controls.length;e.preventDefault();controls[next].focus();}else if(e.code==='Space'&&e.target===document.body){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('resize',scheduleTutorialLayout);window.addEventListener('scroll',scheduleTutorialLayout,{passive:true});
new ResizeObserver(scheduleTutorialLayout).observe($('#battle-screen'));new ResizeObserver(scheduleTutorialLayout).observe($('#tutorial-panel'));

function syncGuide(){
 const guide=game?.guide;if(!guide)return false;guide.update();const key=game.level.id+'/'+guide.active+'/'+guide.step;if(key===tutorialSignature)return false;tutorialSignature=key;tutorialDirty=true;
 if(!game.arranging){clearSelected();if(guide.active&&['move','remove'].includes(guide.step)){selectedUnit=guide.trainingId;painter.selected=selectedUnit;}}
 if(guide.holding)resumeTactical=false;
 if(guide.active&&['place','move','remove','formation','start','claim','use','refresh','boss'].includes(guide.step))requestAnimationFrame(()=>{if(!drag?.active)focusTutorialTarget();});
 return true;
}
function renderTutorial(){
 const guide=game?.guide,panel=$('#tutorial-panel'),resetOpen=$('#progress-reset-dialog').open,key=[guide?.active,guide?.step,guide?.holding,game.phase,!!selectedCard,resetOpen,view].join('/');
 if(key===tutorialUIKey&&!tutorialDirty)return;tutorialUIKey=key;tutorialDirty=false;
 panel.classList.toggle('hidden',resetOpen||!guide?.active);const targets=new Set(guide?.active&&!resetOpen?guide.targets().flatMap(s=>[...document.querySelectorAll(s)]):[]);
 for(const el of tutorialTargets)if(!targets.has(el))el.classList.remove('tutorial-target');for(const el of targets)if(!el.classList.contains('tutorial-target'))el.classList.add('tutorial-target');tutorialTargets=[...targets];
 if(!guide?.active||resetOpen){$('#tutorial-shade').classList.add('hidden');return;}
 const spec=guide.spec;setText('#tutorial-step','新手引导 · '+spec.part+' / 6');setText('#tutorial-title',spec.title);setText('#tutorial-text',spec.text);setText('#tutorial-note',guide.holding?'教学暂停 · 不计入关卡时间':game.phase==='ready'?'布阵不计时':'战斗计时中');
 const dots=Array.from({length:6},(_,i)=>`<i class="${i<spec.part-1?'done':i===spec.part-1?'current':''}"></i>`).join('');if($('#tutorial-progress').innerHTML!==dots)$('#tutorial-progress').innerHTML=dots;
 $('#tutorial-next').classList.toggle('hidden',guide.step!=='boss');setText('#tutorial-focus',guide.step==='use'&&selectedCard?'定位乐器 ↑':'定位目标 ↓');$('#tutorial-focus').classList.toggle('hidden',['earn','save','play','finish'].includes(guide.step));scheduleTutorialLayout();
}
$('#tutorial-focus').onclick=()=>focusTutorialTarget(true);
$('#tutorial-next').onclick=()=>{if(game?.guide?.continue())renderAll();};
$('#tutorial-skip').onclick=()=>{cancelSelection(false);game?.guide?.skip();renderAll();};
function showOverflow(){game.pause();const all=[...game.hand,...game.pendingCards];overflowKeep=new Set(all.slice(0,8).map(c=>c.id));const area=$('#overflow-cards');area.replaceChildren();for(const c of all){const b=cardButton(c.type,overflowKeep.has(c.id)?'selected':'');b.onclick=()=>{if(overflowKeep.has(c.id))overflowKeep.delete(c.id);else if(overflowKeep.size<8)overflowKeep.add(c.id);else {toast('先取消一张，再选择新牌');return;}b.classList.toggle('selected',overflowKeep.has(c.id));$('#overflow-count').textContent=overflowKeep.size+' / 8';};area.append(b);}$('#overflow-count').textContent=overflowKeep.size+' / 8';if(!$('#overflow-dialog').open)$('#overflow-dialog').showModal();}
$('#overflow-confirm').onclick=()=>{const result=game.resolveOverflow([...overflowKeep]);if(!result.ok)return toast(result.message);$('#overflow-dialog').close();if(overflowResume&&game.phase==='paused')game.start();overflowResume=false;renderAll();};$('#overflow-dialog').addEventListener('cancel',e=>e.preventDefault());
function boardClick(col,row){if(!game||['won','lost'].includes(game.phase))return;const u=game.at(col,row);if(selectedCard){const c=CARDS[game.hand.find(c=>c.id===selectedCard)?.type];if(c?.target==='unit'){if(!u)return toast('请选择一件乐器');playSelected(u.id);}else if(c?.target==='summon')playSelected({col,row});return;}if(selectedTemplate&&u&&game.canEdit){selectedTemplate=null;painter.placement=null;selectedUnit=u.id;painter.selected=u.id;renderBench();updateHud();return;}if(selectedTemplate){const placed=game.place(selectedTemplate,col,row);if(!placed)return toast(game.lastError);selectedUnit=placed.id;painter.selected=placed.id;renderAll();return;}if(selectedUnit&&!u&&game.canEdit){if(game.move(selectedUnit,col,row)){updateHud();return;}toast('这里无法放置');return;}selectedUnit=u?.id??null;painter.selected=selectedUnit;updateHud();}
function installDrag(el,source){el.addEventListener('pointerdown',e=>{
 if(e.button!==0||el.disabled||!game||$('dialog[open]')||['won','lost'].includes(game.phase))return;
 const data=source();if(!data)return;if(e.pointerType==='mouse')e.preventDefault();
 drag={...data,x:e.clientX,y:e.clientY,pointer:e.pointerId,el,active:false,sourceRect:el.getBoundingClientRect()};
});}
function dragPos(e){const r=$('#placement-grid').getBoundingClientRect();return {col:Math.floor((e.clientX-r.left)/r.width*5)-(drag.dx||0),row:Math.floor((e.clientY-r.top)/r.height*4)-(drag.dy||0),inside:e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom};}
function clearCardHighlights(){for(const cell of document.querySelectorAll('.grid-cell.drop-target'))cell.classList.remove('drop-target');$('#battle-world').classList.remove('card-drop-ready');}
function cardDropAt(d,x,y){
 if(game.guideBlocks('card',{type:d.type}))return {valid:false,message:game.guide.hint};
 const c=CARDS[d.type],r=$('#battle-world').getBoundingClientRect(),inside=x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom;
 if(!inside)return {valid:false,message:'拖到战场内使用'};
 if(['won','lost'].includes(game.phase)||game.arranging||game.pendingCards.length)return {valid:false,message:'当前不能使用奏法牌'};
 const grid=$('#placement-grid').getBoundingClientRect(),col=Math.floor((x-grid.left)/grid.width*5),row=Math.floor((y-grid.top)/grid.height*4),inGrid=x>=grid.left&&x<grid.right&&y>=grid.top&&y<grid.bottom;
 if(c.target==='unit'){
  const unit=inGrid&&game.at(col,row);if(!unit)return {valid:false,message:'拖到一件已布置的乐器上'};
  if(c.id==='Resonance'&&!['lyra','harp','guqin','suona','snare','gong'].includes(unit.profile.id))return {valid:false,message:'这件乐器没有可立即释放的技能'};
  const center=game.center(unit);
  return {valid:true,target:unit.id,unit,col,row,x:grid.left+center.x/5*grid.width,y:grid.top+center.row/4*grid.height};
 }
 if(c.summon){if(!inGrid||!game.canPlace(c.summon,col,row))return {valid:false,message:'召唤需要合法空格和空名额'};const p=UNITS[c.summon];return {valid:true,target:{col,row},col,row,x:grid.left+(col+p.width/2)/5*grid.width,y:grid.top+(row+p.height/2)/4*grid.height};}
 if(c.target==='arrange'&&!inGrid)return {valid:false,message:'拖到总谱上重排'};
 return {valid:true,x,y};
}
function highlightCardDrop(d){
 const hit=cardDropAt(d,d.tx,d.ty);d.drop=hit;
 if(d.profile){const p=dragPos({clientX:d.tx,clientY:d.ty});painter.hover=p.inside?{col:p.col,row:p.row}:null;}
 const key=[hit.valid,hit.unit?.id,hit.col,hit.row].join('/');if(d.highlightKey===key)return;d.highlightKey=key;clearCardHighlights();ghost.classList.toggle('invalid',!hit.valid);
 if(hit.valid&&hit.unit){painter.selected=hit.unit.id;for(const [x,y] of hit.unit.profile.shape)document.querySelector(`.grid-cell[data-col="${hit.unit.col+x}"][data-row="${hit.unit.row+y}"]`)?.classList.add('drop-target');}
 else {painter.selected=null;if(hit.valid&&!d.profile)$('#battle-world').classList.add('card-drop-ready');}
}
function animateCardGhost(dt){
 if(!drag?.active||drag.kind!=='card')return;
 const d=drag;d.age+=dt;
 if(!reducedMotion){
  d.vx+=(d.tx-d.gx)*280*dt;d.vy+=(d.ty-d.gy)*280*dt;
  const damping=Math.exp(-23*dt);d.vx*=damping;d.vy*=damping;d.gx+=d.vx*dt;d.gy+=d.vy*dt;
 }else {d.gx=d.tx;d.gy=d.ty;}
 const tilt=reducedMotion?0:Math.max(-10,Math.min(10,d.vx*.014)),scale=reducedMotion?1:1+Math.sin(d.age*24)*Math.exp(-d.age*9)*.13;
 ghost.style.left=d.gx+'px';ghost.style.top=d.gy+'px';ghost.style.transform=`translate(-50%,-63%) rotate(${tilt}deg) scale(${scale})`;
 if(!reducedMotion){const edge=70,delta=d.ty<edge&&window.scrollY>0?-420*dt:d.ty>window.innerHeight-edge?420*dt:0;if(delta)window.scrollBy(0,delta);}
 highlightCardDrop(d);
}
function flyCard(d,hit,success){
 const fly=ghost.cloneNode(true);fly.className='drag-ghost card-drag card-fly';fly.classList.remove('hidden');document.body.append(fly);
 const origin=d.sourceRect,to=success?{x:hit.x,y:hit.y}:{x:origin.left+origin.width/2,y:origin.top+origin.height*.63};
 if(reducedMotion||!fly.animate){fly.remove();return;}
 const frames=success?[
  {left:d.gx+'px',top:d.gy+'px',transform:ghost.style.transform,opacity:1},
  {left:to.x+'px',top:to.y+'px',transform:'translate(-50%,-63%) scale(1.16)',opacity:1,offset:.52},
  {left:to.x+'px',top:to.y+'px',transform:'translate(-50%,-63%) scale(.2)',opacity:0}
 ]:[
  {left:d.gx+'px',top:d.gy+'px',transform:ghost.style.transform,opacity:1},
  {left:to.x+'px',top:to.y+'px',transform:'translate(-50%,-63%) rotate(-5deg) scale(.88)',opacity:.9,offset:.75},
  {left:to.x+'px',top:to.y+'px',transform:'translate(-50%,-63%) rotate(0deg) scale(.75)',opacity:0}
 ];
 fly.animate(frames,{duration:success?350:430,easing:'cubic-bezier(.22,1.45,.48,1)',fill:'forwards'}).finished.then(()=>fly.remove(),()=>fly.remove());
 if(success){const ring=document.createElement('span');ring.className='card-drop-burst';ring.setAttribute('aria-hidden','true');ring.style.left=to.x+'px';ring.style.top=to.y+'px';document.body.append(ring);ring.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{transform:'translate(-50%,-50%) scale(1.2)',opacity:1,offset:.4},{transform:'translate(-50%,-50%) scale(1.7)',opacity:0}],{duration:380,easing:'ease-out'}).finished.then(()=>ring.remove(),()=>ring.remove());}
}
function endDrag(){
 const d=drag;d?.el.classList.remove('drag-origin');ghost.className='drag-ghost hidden';ghost.style.transform='';clearCardHighlights();document.body.classList.remove('is-dragging');
 if(painter){painter.draggingId=null;painter.hover=null;painter.placement=selectedTemplate||null;painter.dirty=true;}
 drag=null;
}
function cancelDrag(){const d=drag;if(d?.active&&d.kind==='card'){flyCard(d,{},false);suppressClick=performance.now()+300;endDrag();finishSelection();}else endDrag();}
document.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.pointer)return;
 if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6){
  drag.active=true;drag.el.setPointerCapture?.(e.pointerId);document.body.classList.add('is-dragging');
  if(drag.kind==='card'){
   beginTactical();selectedCard=drag.cardId;selectedTemplate=null;selectedUnit=null;
   drag.tx=e.clientX;drag.ty=e.clientY;drag.gx=e.clientX;drag.gy=e.clientY;drag.vx=0;drag.vy=0;drag.age=0;
   ghost.className='drag-ghost card-drag';ghost.style.left=drag.gx+'px';ghost.style.top=drag.gy+'px';ghost.style.transform='translate(-50%,-63%)';ghost.innerHTML=cardArt(CARDS[drag.type]);ghost.querySelector('img').loading='eager';drag.el.classList.add('drag-origin');
   painter.placement=drag.profile||null;renderDetail();
  }else {if(drag.kind==='unit')selectedTemplate=null;ghost.innerHTML=Portraits.instrument(drag.profile.portrait||drag.profile.id);ghost.classList.remove('hidden');painter.placement=drag.profile;painter.draggingId=drag.unitId??null;}
 }
 if(!drag.active)return;e.preventDefault();
 if(drag.kind==='card'){drag.tx=e.clientX;drag.ty=e.clientY;highlightCardDrop(drag);return;}
 const p=dragPos(e);painter.hover=p.inside?{col:p.col,row:p.row}:null;ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';ghost.classList.toggle('invalid',!p.inside||!game.canPlace(drag.profile,p.col,p.row,drag.unitId));
},{passive:false});
document.addEventListener('pointerup',e=>{
 if(!drag||e.pointerId!==drag.pointer)return;if(!drag.active){drag=null;return;}
 suppressClick=performance.now()+300;const d=drag;
 if(d.kind==='card'){
  const hit=cardDropAt(d,e.clientX,e.clientY),result=hit.valid?game.useCard(d.cardId,hit.target):{ok:false,message:hit.message};
  if(result.ok&&hit.unit)hit.unit.flash=.5;
  flyCard(d,hit,result.ok);endDrag();
  if(!result.ok){toast(result.message);finishSelection();}
  else if(result.arrange){selectedCard=null;selectedTemplate=null;painter.placement=null;renderAll();}
  else finishSelection();
  return;
 }
 const p=dragPos(e);let result=false;if(p.inside)result=d.kind==='unit'?game.move(d.unitId,p.col,p.row):game.place(d.profile,p.col,p.row);
 if(!result)toast(d.kind==='unit'?'无法移动到这里':game.lastError||'无法放置');else {selectedUnit=d.unitId||result.id;painter.selected=selectedUnit;}
 endDrag();renderAll();
});
document.addEventListener('pointercancel',cancelDrag);
for(let row=0;row<4;row++)for(let col=0;col<5;col++){const b=document.createElement('button');b.className='grid-cell';b.dataset.col=col;b.dataset.row=row;b.setAttribute('aria-label',`第${col+1}列第${row+1}行`);b.onpointerenter=()=>{if(painter)painter.hover={col,row};};b.onpointerleave=()=>{if(painter&&!drag)painter.hover=null;};b.onclick=()=>{if(performance.now()>=suppressClick)boardClick(col,row);};installDrag(b,()=>{const u=game.at(col,row);return u&&!selectedCard&&game.canEdit?{kind:'unit',unitId:u.id,profile:u.profile,dx:col-u.col,dy:row-u.row}:null;});$('#placement-grid').append(b);}
$('#enter-level').onclick=enterLevel;$('#shop-back').onclick=showMap;$('#map-open').onclick=showMap;$('#home').onclick=e=>{e.preventDefault();showMap();};$('#resume-game').onclick=()=>{if(!game)return;switchView('battle');$('#chapter-label').textContent=levelName(game.level);renderAll();};
$('#start-game').onclick=()=>{if(game.phase==='running'){game.pause();resumeTactical=false;}else if(!selectedCard)game.start();updateHud();};$('#reset-game').onclick=()=>{if(game.arranging)game.endArrangement(false);game.reset();seenSettlements=0;$('#wave-settlement').classList.add('hidden');settled=false;resumeTactical=false;clearSelected();renderAll();};$('#range-toggle').onclick=()=>{painter.showRange=!painter.showRange;$('#range-toggle').setAttribute('aria-pressed',String(painter.showRange));};$('#sell-unit').onclick=()=>{const result=game.sell(selectedUnit);if(!result.ok)toast(result.message);else {selectedUnit=null;painter.selected=null;toast(result.message);renderAll();}};
$('#draw-refresh').onclick=()=>{const result=game.rollOffers();if(!result.ok)toast(result.message);renderDraw();updateHud();};$('#arrange-confirm').onclick=()=>{const result=game.endArrangement(true);if(!result.ok)return toast(result.message);finishSelection();};$('#arrange-cancel').onclick=()=>{game.endArrangement(false);finishSelection();};
function showResult(){if(settled||!game.result)return;settled=true;const {progress:next,reward}=M.settle(progress,game.level,game.result);progress=next;persist();$('#rhythm-points').textContent=progress.rhythm;const win=game.result.win;$('#result-symbol').textContent=win?'✦':'♭';$('#result-title').textContent=win?(game.level.index===9?'群岛通关':game.guide?.completed?'引导完成':'关卡完成'):'演奏中断';$('#result-reason').textContent=win?levelName(game.level):game.result.reason;$('#result-stats').innerHTML=`<span><strong>${game.kills}</strong>击败</span><span><strong>${Math.floor(game.points+1e-7)}</strong>剩余协奏</span><span><strong>+${reward}</strong>韵律</span>`;$('#result-primary').textContent=win?(game.level.index<9?'下一关 →':'返回选关'):'重新挑战';if(!$('#result-dialog').open)$('#result-dialog').showModal();}
$('#result-primary').onclick=()=>{const won=game.result.win,index=game.level.index;$('#result-dialog').close();if(!won){game.reset();seenSettlements=0;$('#wave-settlement').classList.add('hidden');settled=false;clearSelected();renderAll();}else if(index<9)showShop(D.levels[index+1]);else showMap();};$('#result-map').onclick=()=>{$('#result-dialog').close();showMap();};$('#result-dialog').addEventListener('cancel',()=>{setTimeout(showMap,0);});
document.addEventListener('keydown',e=>{if($('dialog[open]'))return;if(e.key==='Escape'){if(drag?.active){cancelDrag();return;}if(game?.arranging){game.endArrangement(false);finishSelection();}else cancelSelection();return;}if(view!=='battle')return;if(['Delete','Backspace'].includes(e.key)&&selectedUnit){e.preventDefault();const r=game.sell(selectedUnit);if(!r.ok)toast(r.message);else{selectedUnit=null;painter.selected=null;renderAll();}}if(e.code==='Space'&&e.target===document.body){e.preventDefault();$('#start-game').click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game){game.pause();resumeTactical=false;updateHud();}});
for(const event of ['pointermove','pointerdown','pointerup','click','keydown'])document.addEventListener(event,invalidateBattle,{passive:true});
let handSignature='',offerSignature='',paintPhase='';function frame(now){
 const dt=Math.min(.1,(now-last)/1000);last=now;animateCardGhost(Math.min(dt,.033));
 if(view==='battle'&&game){
  game.update(dt);if(syncGuide())renderAll();
  if(painter.dirty||game.phase==='running'||drag?.active||paintPhase!==game.phase){painter.dirty=false;paintPhase=game.phase;painter.render(game.elapsed);}
  if(now-lastHud>80){updateHud();const hs=game.hand.map(c=>c.id).join(',');if(hs!==handSignature&&!drag?.active){handSignature=hs;renderHand();}const os=game.offers.map(c=>c.id).join(',');if(os!==offerSignature){offerSignature=os;renderDraw();}lastHud=now;}
  if(game.stats.waveSettlements.length>seenSettlements){const entry=game.stats.waveSettlements.at(-1);seenSettlements=game.stats.waveSettlements.length;setText('#wave-settlement',`第 ${entry.wave} 波清场 · ${entry.overtimeSeconds?'超时 '+entry.overtimeSeconds.toFixed(2):'提前 '+entry.remainingSeconds.toFixed(2)} 秒 · 协奏 +${entry.bonus}`);$('#wave-settlement').classList.remove('hidden');}
  if(game.result)showResult();
 }
 requestAnimationFrame(frame);
}
window.concertoDebug={snapshot:()=>game?.snapshot(),get game(){return game;},get progress(){return M.copy(progress);},data:D,render:renderAll,openLevel:(id)=>{const l=D.levels.find(x=>x.id===id);if(!l)return;currentLevel=l;enterLevel();}};
showMap();requestAnimationFrame(frame);
})();
