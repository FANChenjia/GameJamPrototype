(() => {
  'use strict';
  const G = window.Crownfall;
  const T = window.CrownfallTutorial;
  const AI_NAME = '虎鲸', AI_TAGLINE = '才不是大肥鱼';
  const $ = id => document.getElementById(id);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delay = ms => new Promise(resolve => setTimeout(resolve, reduceMotion ? Math.min(ms, 80) : ms));
  const STORE = 'crownfall.local.v1', SESSION = 'crownfall.seat.v1';
  let state = G.create(), seat = 0, mode = 'ai', room = null, connection = 'ok';
  let selection = null, busy = false, rolling = false, presenting = false, resetting = false, attackStage = '', source = null, aiTimer = null, epoch = 0;
  let presentationQueue = Promise.resolve();
  let tutorial = null;
  let tutorialSpotlight = null;
  let netSession = null, netInfo = null, lastResult = -1, gameIndex = 0, toastTimer, soundEnabled = false, audio;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if ([1, 2].includes(saved?.version) && saved.players?.length === 2 && Array.isArray(saved.deck) && Array.isArray(saved.discard) && ['roll', 'action', 'over'].includes(saved.phase) && saved.players.every(p => p.soldiers?.length === 5 && p.knights?.length === 3)) state = G.migrate(saved);
  } catch { /* A fresh table is always available when storage is disabled. */ }
  gameIndex = (state.turn + state.turnNumber - 1) % 2;
  function save(value = state) { if (mode === 'ai' && !tutorial) try { localStorage.setItem(STORE, JSON.stringify(value)); } catch {} }
  function toast(message) {
    $('toast').textContent = message; $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
  }
  function sound(kind) {
    if (!soundEnabled) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const notes = { roll: [190, 240, 170, 290], draw: [280, 370], reveal: [520, 660], recruit: [420, 610], promote: [392, 494, 587, 784], attack: [140, 85], flip: [105, 78, 62], land: [80, 50], end: [350, 270], win: [392, 494, 587, 784] }[kind] || [430];
      notes.forEach((f, i) => {
        const osc = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime + i * .055;
        osc.type = ['attack', 'flip', 'land'].includes(kind) ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.045, start + .009); gain.gain.exponentialRampToValueAtTime(.001, start + .15);
        osc.connect(gain); gain.connect(audio.destination); osc.start(start); osc.stop(start + .17);
      });
    } catch { /* Audio is an optional enhancement. */ }
  }
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const mine = () => state.players[seat];
  const enemy = () => state.players[1 - seat];
  const connected = () => mode === 'ai' || (room?.ready && room.connected.every(Boolean) && connection === 'ok');
  const myTurn = () => state.turn === seat && connected() && state.phase !== 'over';
  const canAct = () => myTurn() && state.phase === 'action' && !busy && !presenting && !resetting;
  const count = list => list.filter(Boolean).length;
  const red = card => card.suit === 'hearts' || card.suit === 'diamonds';
  const cardFaceHTML = (card, role = 'soldier') => window.CrownfallCards.render(card, role);
  function arcStyle(role, slot) {
    if (role === 'commander') return '';
    const rise = role === 'knight' ? [.16, 0, .16] : [.32, .09, 0, .09, .32];
    const tilt = role === 'knight' ? [8, 0, -8] : [12, 6, 0, -6, -12];
    return `--arc-rise:${rise[slot] || 0};--arc-angle:${tilt[slot] || 0}deg`;
  }
  function unitHTML(unit, owner, role) {
    const commander = role === 'commander', isMine = owner === seat;
    const hp = commander ? state.players[owner].hp : unit.hp, maxHP = commander ? 24 : unit.maxHP;
    const card = commander ? null : unit.card, id = commander ? 'commander-' + owner : unit.id;
    const targetable = selection === 'attack' && !isMine && G.frontier(state.players[owner]).some(u => u.id === id);
    const promotable = selection === 'promote' && isMine && role === 'soldier';
    const dimmed = selection === 'attack' && !isMine && !targetable || selection === 'promote' && isMine && !promotable;
    const label = `${isMine ? '你的' : '对方'}${{ commander: '主将 Joker', soldier: '士兵', knight: '骑士' }[role]}${card ? ' ' + G.name(card) : ''}，${hp}/${maxHP} 生命${targetable ? '，点击攻击' : promotable ? '，点击册封' : ''}`;
    let face;
    if (commander) face = window.CrownfallCards.renderJoker();
    else face = cardFaceHTML(card, role);
    return `<div class="unit ${role} ${targetable ? 'targetable' : ''} ${promotable ? 'targetable promotable' : ''} ${dimmed ? 'not-target' : ''}" style="${arcStyle(role, commander ? 0 : unit.slot)}" data-unit="${id}" data-owner="${owner}"><button class="playing-card ${card ? red(card) ? 'red' : '' : owner !== seat ? 'red' : ''}" data-card="${id}" data-owner="${owner}" aria-label="${escape(label)}"${promotable ? ` title="册封后恢复至 ${G.unitHP(card, 'knight')} 生命"` : ''}>${face}</button><span class="unit-health"><span class="health-track"><i style="width:${Math.max(0, hp / maxHP * 100)}%"></i></span><b>${hp}</b><span class="hp-max">/ ${maxHP}</span></span></div>`;
  }
  function emptyHTML(role, i) {
    return `<div class="empty-slot" style="${arcStyle(role, i)}" aria-hidden="true"><div class="slot-outline">${icon(role === 'knight' ? 'crown' : 'flag')}</div><span class="slot-number">${['I', 'II', 'III', 'IV', 'V'][i]}</span></div>`;
  }
  function formationHTML(owner) {
    const p = state.players[owner];
    return `<div class="card-row row-commander"><span class="rank-caption"><em>I</em> 主将</span>${unitHTML(null, owner, 'commander')}</div><div class="card-row row-knights"><span class="rank-caption"><em>II</em> 骑士</span>${p.knights.map((u, i) => u ? unitHTML(u, owner, 'knight') : emptyHTML('knight', i)).join('')}</div><div class="card-row row-soldiers"><span class="rank-caption"><em>III</em> 士兵</span>${p.soldiers.map((u, i) => u ? unitHTML(u, owner, 'soldier') : emptyHTML('soldier', i)).join('')}</div>`;
  }
  function getRects() {
    return new Map([...document.querySelectorAll('.unit')].map(el => [el.dataset.unit, { rect: el.getBoundingClientRect(), element: el }]));
  }
  function renderArmies(ev) {
    const previous = getRects();
    if (ev?.type === 'attack' && !reduceMotion) {
      ev.hits.filter(h => h.killed && h.role !== 'commander').forEach(hit => {
        const old = previous.get(hit.id);
        if (!old) return;
        const rect = old.rect, clone = old.element.querySelector('button').cloneNode(true);
        clone.classList.add('falling-card'); clone.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height - 14}px`;
        $('effects').append(clone);
        clone.animate([{ opacity: 1, transform: 'rotate(0) scale(1)' }, { opacity: .5, transform: 'translate(12px, -15px) rotate(12deg) scale(1.03)', offset: .35 }, { opacity: 0, transform: 'translate(30px, 65px) rotate(23deg) scale(.8)' }], { duration: 650, easing: 'ease-in' }).finished.then(() => clone.remove());
      });
    }
    $('away-army').innerHTML = formationHTML(1 - seat);
    $('home-army').innerHTML = formationHTML(seat);
    if (ev && !reduceMotion) {
      const deckRect = $('deck').getBoundingClientRect();
      document.querySelectorAll('.unit').forEach(el => {
        const old = previous.get(el.dataset.unit), next = el.getBoundingClientRect();
        const rest = getComputedStyle(el).transform;
        if (old && (Math.abs(old.rect.x - next.x) > 1 || Math.abs(old.rect.y - next.y) > 1)) el.animate([{ transform: `translate(${old.rect.x - next.x}px,${old.rect.y - next.y}px) rotate(-6deg) scale(1.06) ${rest}` }, { transform: rest }], { duration: 720, easing: 'cubic-bezier(.2,.85,.3,1.18)' });
        else if (!old && !el.classList.contains('commander')) el.animate([{ opacity: 0, transform: `translate(${deckRect.x - next.x}px,${deckRect.y - next.y}px) rotate(-15deg) scale(.72) ${rest}` }, { opacity: 1, transform: rest }], { duration: 650, easing: 'cubic-bezier(.15,.8,.3,1.18)' });
        if (ev.type === 'promote' && el.dataset.unit === ev.unit) {
          el.querySelector('button').animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.45)', offset: .4 }, { filter: 'brightness(1)' }], 900);
          sparks(next.x + next.width / 2, next.y + next.height / 2);
        }
      });
    }
    if (ev?.type === 'attack') attackEffect(ev, previous);
  }
  const dieLayout = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function drawDie(value) { $('dice-face').innerHTML = dieLayout[value || 5].map(n => `<i class="die-pip" style="grid-row:${Math.floor(n / 3) + 1};grid-column:${n % 3 + 1}"></i>`).join(''); }
  function renderUI() {
    const own = mine(), otherTurn = state.turn !== seat, waiting = mode === 'lan' && !room?.ready;
    let title, description, eyebrow;
    if (state.phase === 'over') {
      title = state.winner === -1 ? '双王，落幕。' : state.winner === seat ? '此局，加冕。' : '胜负，已定。';
      description = '牌已落定，下一座王国正等着你。'; eyebrow = 'GAME OVER';
    } else if (waiting) { title = '留一个，座位。'; description = '分享邀请，等另一位君主入座。'; eyebrow = 'WAITING FOR A FRIEND'; }
    else if (!connected()) { title = '静候，归来。'; description = connection !== 'ok' ? '正在重连牌桌，牌阵会为你保留。' : '对手暂时离线，重连后继续。'; eyebrow = 'RECONNECTING'; }
    else if (otherTurn) { title = '静候，落子。'; description = mode === 'ai' ? AI_NAME + '正在推演下一步。' : '对手正在落子，留意他的牌阵。'; eyebrow = 'OPPONENT’S TURN'; }
    else { title = '由你，执棋。'; description = selection === 'attack' ? '点选亮起的敌方单位，发起攻击。' : selection === 'promote' ? '选一名士兵，为他加冕骑士之名。' : state.phase === 'roll' ? '掷下骰子，让命运开局。' : state.ap === 0 ? '行动点已用尽，交出这一回合。' : '落一张牌，向王冠再近一步。'; eyebrow = 'YOUR TURN'; }
    if (presenting) description = ({ draw: '从牌堆抽取攻击牌…', reveal: '牌已翻开，蓄势待发。', strike: '突破敌阵！', impact: '伤害结算中…' })[attackStage] || description;
    if (resetting) { title = '再起，一座王国。'; description = document.body.dataset.resetStage === 'settle' ? '牌桌落稳，新局将启。' : '收起旧牌阵，重新开局。'; eyebrow = 'A FRESH DECK'; }
    $('turn-title').textContent = title; $('turn-description').textContent = description; $('turn-eyebrow').textContent = eyebrow;
    $('turn-dot').style.background = waiting || !connected() ? '#bca16b' : otherTurn ? '#bd927c' : '#7d9678';
    $('turn-index').textContent = String(state.turnNumber).padStart(2, '0');
    $('round-value').textContent = String(state.round).padStart(2, '0');
    $('ap-value').textContent = state.phase === 'roll' ? '—' : state.ap;
    $('ap-total').textContent = state.die || 6;
    document.querySelector('.ap-heading>span:first-child').textContent = otherTurn && !waiting ? '对手行动点' : '行动点';
    $('ap-track').innerHTML = Array.from({ length: 6 }, (_, i) => `<i class="ap-pip ${i < state.ap ? 'lit' : i < (state.die || 0) ? 'spent' : ''}"></i>`).join('');
    const recruitReason = !canAct() ? '先掷骰，获得行动点' : count(own.soldiers) === 5 ? '士兵位置已满' : state.recruits >= 2 ? '本回合已排兵两次' : '排兵 · 1 行动点（R）';
    $('recruit-button').disabled = !canAct() || state.ap < 1 || count(own.soldiers) >= 5 || state.recruits >= 2;
    $('recruit-button').title = recruitReason;
    $('promote-button').disabled = !canAct() || state.ap < 2 || !count(own.soldiers) || count(own.knights) >= 3;
    $('promote-button').title = !count(own.soldiers) ? '先排兵，再选择士兵册封' : count(own.knights) === 3 ? '骑士位置已满' : '册封 · 2 行动点（C）';
    $('attack-button').disabled = !canAct() || state.ap < 2;
    $('attack-button').title = '攻击 · 2 行动点，再点选敌方最外层目标（A）';
    $('promote-button').classList.toggle('active', selection === 'promote'); $('attack-button').classList.toggle('active', selection === 'attack');
    $('end-button').disabled = !canAct();
    $('end-button').title = '结束回合，未使用的行动点会清空（E）';
    $('dice').disabled = !myTurn() || state.phase !== 'roll' || busy || rolling || presenting || resetting;
    $('dice').parentElement.classList.toggle('ready', myTurn() && state.phase === 'roll' && !busy);
    $('dice').setAttribute('aria-label', state.phase === 'roll' ? '掷骰，获得行动点（D）' : '本回合骰子：' + state.die + ' 点');
    $('dice-caption').innerHTML = rolling ? '命运转动中' : waiting ? '等待入座' : !connected() ? '等待重连' : state.phase === 'over' ? '胜负已定' : otherTurn ? '对手的骰子' : state.phase === 'roll' ? '点击掷骰 <span>↗</span>' : '本回合已掷';
    if (!rolling) drawDie(state.die || 5);
    $('deck-count').textContent = state.deckCount ?? state.deck.length;
    $('deck').setAttribute('aria-label', '公共牌堆，剩余 ' + (state.deckCount ?? state.deck.length) + ' 张');
    $('opponent-name').textContent = mode === 'ai' ? AI_NAME : '对方';
    $('opponent-type').textContent = mode === 'ai' ? AI_TAGLINE : room?.ready ? room.connected[1 - seat] ? '已入座' : '重连中' : '空席以待';
    $('opponent-status').classList.toggle('offline', mode === 'lan' && !room?.connected[1 - seat]);
    $('my-type').textContent = mode === 'ai' ? '执青 · ' + (gameIndex % 2 === 0 ? '先手' : '后手') : '执青 · ' + (seat === room.gameIndex % 2 ? '先手' : '后手');
    $('table-status').textContent = state.fatigue ? '疲劳 ' + state.fatigue + ' · 牌堆已重洗' : selection ? '落子无悔，谋定后动。' : '一副扑克，一座王国。';
    $('mode-caption').innerHTML = mode === 'ai' ? '本地演练 <i></i> 自动存档' : '局域网牌桌 <i></i> ' + escape(room.code);
    $('ai-mode').classList.toggle('active', mode === 'ai'); $('lan-mode').classList.toggle('active', mode === 'lan');
    $('ai-mode').setAttribute('aria-pressed', mode === 'ai'); $('lan-mode').setAttribute('aria-pressed', mode === 'lan');
    $('room-strip').hidden = mode !== 'lan'; if (room) $('room-code').textContent = room.code;
    $('target-banner').hidden = !selection;
    $('target-instruction').textContent = selection === 'attack' ? '选择最外层的敌方目标' : '选择一名士兵，册封骑士';
    const note = selection === 'attack' ? '亮起的单位可以攻击。先亮牌，再进攻；剩余伤害继续突破下一层。' : selection === 'promote' ? '骑士生命为<b>牌面点数 +4</b>，册封回满；每名骑士使攻击增加 <b>1</b> 点伤害。' : state.phase === 'action' && myTurn() && state.ap === 1 ? (state.recruits < 2 && count(own.soldiers) < 5 ? '还剩 <b>1</b> 点，可以再招一名士兵守住前阵。' : '行动点不足以册封或攻击，可以结束回合。') : '士兵生命等于<b>牌面点数</b>；骑士生命为<b>点数 +4</b>，每名使攻击 +1。';
    $('tactical-text').innerHTML = note;
    $('journal-entries').innerHTML = state.log.length ? state.log.slice(0, 30).map(ev => `<p class="journal-entry ${ev.actor === seat ? 'mine' : ''}"><small>${String(ev.round).padStart(2, '0')}</small><span>${ev.actor === seat ? '你' : mode === 'ai' ? AI_NAME : '对方'} · ${escape(ev.text)}</span></p>`).join('') : '<p class="journal-empty">牌未落，胜负未定。</p>';
    renderTutorialUI();
    if (state.phase === 'over') updateResult();
  }
  function renderTutorialUI() {
    document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
    $('tutorial-exit').hidden = !tutorial; $('turn-index').hidden = Boolean(tutorial);
    $('lan-mode').disabled = Boolean(tutorial); $('ai-mode').disabled = Boolean(tutorial);
    $('restart-button').disabled = Boolean(tutorial || resetting);
    $('rules-link').innerHTML = tutorial ? '退出教程，回到原牌桌 <span>↗</span>' : '初次入座？跟着玩一局 <span>↗</span>';
    if (!tutorial) { stopTutorialSpotlight(); return; }
    startTutorialSpotlight();
    $('mode-caption').innerHTML = '新手教程 <i></i> 练习残局';
    const step = T.steps[tutorial.step];
    if (!step || state.phase === 'over') return;
    $('turn-eyebrow').textContent = `新手教程 · ${tutorial.step + 1} / ${T.steps.length}`;
    $('turn-title').textContent = step.title;
    $('turn-description').textContent = state.turn !== seat ? '虎鲸正在把回合交还给你，稍等一下。' : rolling ? '骰子正在落稳，点数就是本回合行动点。' : presenting ? '先看清攻击牌，再观察敌阵的生命变化。' : step.text;
    const actions = { roll: 'dice', recruit: 'recruit-button', promote: 'promote-button', attack: 'attack-button', end: 'end-button' };
    for (const [type, id] of Object.entries(actions)) if (type !== step.type) $(id).disabled = true;
    if (!$(step.button).disabled && !selection) $(step.button).classList.add('tutorial-focus');
  }
  function stopTutorialSpotlight() {
    if (!tutorialSpotlight) return;
    cancelAnimationFrame(tutorialSpotlight.frame);
    document.removeEventListener('click', tutorialSpotlight.guardClick, true);
    document.removeEventListener('keydown', tutorialSpotlight.guardTab, true);
    tutorialSpotlight.svg.remove(); tutorialSpotlight = null;
  }
  function startTutorialSpotlight() {
    if (tutorialSpotlight) { tutorialSpotlight.refresh(); return; }
    const ns = 'http://www.w3.org/2000/svg';
    const node = (tag, attrs = {}) => { const el = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); return el; };
    const svg = node('svg', { class: 'tutorial-spotlight', 'aria-hidden': 'true', focusable: 'false' });
    const defs = node('defs'), mask = node('mask', { id: 'tutorial-spotlight-mask', maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', x: 0, y: 0 });
    const base = node('rect', { fill: 'white' }), holes = node('g', { fill: 'black' });
    mask.append(base, holes); defs.append(mask);
    const shade = node('rect', { class: 'tutorial-spotlight-shade', mask: 'url(#tutorial-spotlight-mask)' });
    const outlines = node('g', { class: 'tutorial-spotlight-outlines' });
    svg.append(defs, shade, outlines); document.body.append(svg);
    const spotlight = { svg, frame: null, focus: [], signature: '', targetKey: '' };
    function modalOpen() { return Boolean(document.querySelector('dialog[open]')); }
    spotlight.guardClick = event => {
      if (!tutorial || modalOpen()) return;
      if (spotlight.focus.some(el => el.contains(event.target)) || document.querySelector('.turn-section').contains(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    spotlight.guardTab = event => {
      if (event.key !== 'Tab' || !tutorial || modalOpen()) return;
      const controls = [...new Set([...spotlight.focus, $('tutorial-exit')])].filter(el => el?.isConnected && !el.disabled && !el.hidden);
      if (!controls.length) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const index = controls.indexOf(document.activeElement), direction = event.shiftKey ? -1 : 1;
      controls[(index + direction + controls.length) % controls.length].focus({ preventScroll: true });
    };
    document.addEventListener('click', spotlight.guardClick, true);
    document.addEventListener('keydown', spotlight.guardTab, true);
    tutorialSpotlight = spotlight;
    function tick() {
      if (tutorialSpotlight !== spotlight || !tutorial) return;
      cancelAnimationFrame(spotlight.frame);
      svg.style.display = modalOpen() ? 'none' : '';
      const step = T.steps[tutorial.step], regions = [], focusRegions = [];
      spotlight.focus = [];
      const add = (el, kind = 'context', padding = 8) => {
        if (!el || !el.isConnected) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        regions.push({ x: rect.x - padding, y: rect.y - padding, width: rect.width + padding * 2, height: rect.height + padding * 2, kind });
        if (kind === 'focus') focusRegions.push(regions[regions.length - 1]);
      };
      const coachRects = [...document.querySelectorAll('.turn-section > .eyebrow,#turn-title,#turn-description')].map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
      if (coachRects.length) {
        const pad = innerWidth <= 760 ? 6 : 8;
        const left = Math.min(...coachRects.map(r => r.left)), top = Math.min(...coachRects.map(r => r.top));
        const right = Math.max(...coachRects.map(r => r.right)), bottom = Math.max(...coachRects.map(r => r.bottom));
        regions.push({ x: left - pad, y: top - pad, width: right - left + pad * 2, height: bottom - top + pad * 2, kind: 'coach' });
      }
      let action = step && $(step.button);
      if (step && selection && step.target) action = document.querySelector(`[data-card="${step.target}"]`);
      if (rolling) {
        add($('dice'), 'focus', 11); add($('dice').parentElement, 'context', 8);
      } else if (presenting) {
        if (step?.target) add(document.querySelector(`[data-unit="${step.target}"]`), 'context', 9);
        const reveal = document.querySelector('.attack-showcase');
        if (reveal && Number(getComputedStyle(reveal).opacity) > .04) {
          add(reveal, 'focus', 9);
          reveal.querySelectorAll('.attack-owner,.attack-tally').forEach(el => { if (getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > .04) add(el); });
        }
        document.querySelectorAll('.damage-float,.falling-card').forEach(el => { if (Number(getComputedStyle(el).opacity) > .04) add(el, 'context', 5); });
      } else if (action && step && state.phase !== 'over') {
        add(action.closest('.unit') || action, 'focus', action.id === 'dice' ? 11 : 8);
        if (!action.disabled && !busy && myTurn()) spotlight.focus.push(action);
      }
      const targetKey = `${tutorial.step}:${selection || ''}:${rolling}:${presenting}:${state.turn}`;
      if (targetKey !== spotlight.targetKey && action && !rolling && !presenting) {
        spotlight.targetKey = targetKey;
        const rect = action.getBoundingClientRect();
        const mobileTableCard = innerWidth <= 760 && action.closest('.formation');
        const bottom = mobileTableCard ? document.querySelector('.command-panel').getBoundingClientRect().top - 12 : innerHeight - 12;
        if (rect.top < 12 || rect.bottom > bottom || rect.left < 0 || rect.right > innerWidth) action.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'instant' : 'smooth' });
      }
      svg.dataset.focus = selection && step?.target ? step.target : presenting ? 'attack-animation' : step?.button || 'complete';
      const viewportWidth = document.documentElement.clientWidth, viewportHeight = document.documentElement.clientHeight;
      const signature = `${viewportWidth},${viewportHeight}|` + regions.map(r => [r.x, r.y, r.width, r.height].map(v => v.toFixed(1)).join(',') + r.kind).join('|');
      if (signature !== spotlight.signature) {
        spotlight.signature = signature;
        svg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
        for (const el of [base, shade, mask]) { el.setAttribute('width', viewportWidth); el.setAttribute('height', viewportHeight); }
        holes.replaceChildren(...regions.map(r => node('rect', { x: r.x, y: r.y, width: r.width, height: r.height, rx: r.kind === 'coach' ? 12 : 10, 'data-kind': r.kind })));
        outlines.replaceChildren(...focusRegions.map(r => node('rect', { x: r.x, y: r.y, width: r.width, height: r.height, rx: 10 })));
      }
      spotlight.frame = requestAnimationFrame(tick);
    }
    spotlight.refresh = tick;
    tick();
  }
  function render(ev) {
    renderArmies(ev); renderUI();
    if (ev && ev.type !== 'roll') sound(ev.type);
    if (ev?.fatigueDamage) toast('牌堆重洗 · 双方主将受到 ' + ev.fatigueDamage + ' 点疲劳伤害');
    if (state.phase === 'over' && lastResult !== state.seq) {
      lastResult = state.seq; const currentEpoch = epoch;
      setTimeout(() => { if (epoch === currentEpoch && state.phase === 'over') { document.querySelectorAll('dialog[open]').forEach(d => d.close()); $('result-dialog').showModal(); if (state.winner === seat) sound('win'); } }, reduceMotion ? 100 : 1100);
    }
  }
  function setAttackStage(name) {
    attackStage = name;
    document.body.dataset.attackStage = name;
    const showcase = document.querySelector('.attack-showcase');
    if (showcase) showcase.dataset.stage = name;
    renderUI();
  }
  async function motion(element, frames, duration, easing = 'cubic-bezier(.2,.8,.25,1)') {
    if (reduceMotion) { element.style.opacity = '1'; return delay(60); }
    await element.animate(frames, { duration, easing, fill: 'forwards' }).finished.catch(() => {});
  }
  function clearAttack() {
    document.querySelectorAll('.attack-showcase,.attack-trail').forEach(el => {
      el.getAnimations({ subtree: true }).forEach(animation => animation.cancel()); el.remove();
    });
    document.querySelectorAll('.attack-aim').forEach(el => el.classList.remove('attack-aim'));
    delete document.body.dataset.attackStage;
  }
  async function drawAttack(ev, token) {
    const alive = () => token === epoch;
    const board = $('table').getBoundingClientRect(), deck = $('deck').getBoundingClientRect();
    const mobilePanel = innerWidth <= 760 ? document.querySelector('.command-panel').getBoundingClientRect().top : innerHeight - 20;
    const width = innerWidth <= 760 ? 88 : 112, height = Math.round(width * 1.4);
    const cx = Math.max(width / 2 + 25, Math.min(innerWidth - width / 2 - 25, board.x + board.width / 2));
    const cy = Math.max(height / 2 + 45, Math.min(mobilePanel - height / 2 - 75, board.y + board.height / 2));
    const el = document.createElement('div'); el.className = 'attack-showcase';
    el.style.cssText = `left:${cx - width / 2}px;top:${cy - height / 2}px;--attack-w:${width}px;--attack-h:${height}px`;
    el.innerHTML = `<span class="attack-owner">${ev.actor === seat ? '你的进攻' : mode === 'ai' ? AI_NAME + '的进攻' : '对方的进攻'}</span><div class="attack-flipper"><div class="attack-back deck-back"><div class="back-frame">${icon('crown')}<i>✧</i></div></div><div class="attack-front playing-card ${red(ev.card) ? 'red' : ''}">${cardFaceHTML(ev.card)}</div></div><div class="attack-tally"><span><b>${ev.damage}</b><small>基础伤害</small></span><p>牌面 ${G.power(ev.card)}${ev.bonus ? ` <i>＋</i> 骑士 ${ev.bonus}` : ' <i>·</i> 无骑士加成'}</p></div>`;
    $('effects').append(el);
    const flipper = el.querySelector('.attack-flipper'), tally = el.querySelector('.attack-tally');
    const firstTarget = ev.hits?.[0]?.id;
    if (firstTarget) document.querySelector(`[data-unit="${firstTarget}"]`)?.classList.add('attack-aim');
    setAttackStage('draw'); sound('draw');
    $('deck').animate([{ transform: 'rotate(-7deg)' }, { transform: 'rotate(-11deg) translateY(-3px)' }, { transform: 'rotate(-7deg)' }], { duration: reduceMotion ? 1 : 400 });
    await motion(el, [
      { opacity: 0, transform: `translate(${deck.x + deck.width / 2 - cx}px,${deck.y + deck.height / 2 - cy}px) rotate(-12deg) scale(${deck.width / width})` },
      { opacity: 1, transform: 'translate(0,-12px) rotate(-3deg) scale(1.06)', offset: .76 },
      { opacity: 1, transform: 'translate(0,0) rotate(0) scale(1)' }
    ], 440, 'cubic-bezier(.18,.8,.3,1.12)');
    if (!alive()) return false;
    sound('reveal');
    if (!reduceMotion) await motion(flipper, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(190deg)', offset: .85 }, { transform: 'rotateY(180deg)' }], 380);
    flipper.style.transform = 'rotateY(180deg)';
    if (!alive()) return false;
    setAttackStage('reveal');
    motion(tally, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], 200);
    // Reading time is preserved even when the player requests less movement.
    await new Promise(resolve => setTimeout(resolve, reduceMotion ? 500 : 850));
    if (!alive()) return false;
    setAttackStage('strike');
    const target = firstTarget && document.querySelector(`[data-unit="${firstTarget}"]`);
    const rect = target?.getBoundingClientRect();
    const tx = rect ? rect.x + rect.width / 2 : cx, ty = rect ? rect.y + rect.height / 2 - 7 : cy - 50;
    const dx = tx - cx, dy = ty - cy, length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) * 180 / Math.PI;
    tally.style.visibility = 'hidden'; el.querySelector('.attack-owner').style.visibility = 'hidden';
    await motion(el, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${-dx * .07}px,${-dy * .07}px) rotate(-5deg) scale(1.06)` }], 140);
    if (!alive()) return false;
    const trail = document.createElement('i'); trail.className = 'attack-trail';
    trail.style.cssText = `left:${cx}px;top:${cy}px;width:${length}px;transform:rotate(${angle}deg)`;
    $('effects').append(trail);
    if (!reduceMotion) trail.animate([{ opacity: 0, scale: '.1 1' }, { opacity: .8, scale: '.8 1', offset: .65 }, { opacity: 0, scale: '1 1' }], { duration: 430, fill: 'forwards' });
    await motion(el, [
      { opacity: 1, transform: `translate(${-dx * .07}px,${-dy * .07}px) rotate(-5deg) scale(1.06)` },
      { opacity: 1, transform: `translate(${dx * .8}px,${dy * .8}px) rotate(${dy < 0 ? 10 : -10}deg) scale(.7)`, offset: .8 },
      { opacity: 0, transform: `translate(${dx}px,${dy}px) rotate(${dy < 0 ? 15 : -15}deg) scale(.48)` }
    ], 310, 'cubic-bezier(.55,.05,.8,.45)');
    return alive();
  }
  async function present(next, ev) {
    const token = epoch;
    save(next); // Refreshing during a reveal keeps the already-drawn result.
    if (ev?.type === 'roll') {
      await rollAnimation(ev.value);
      if (token === epoch) { state = next; render(ev); }
      return;
    }
    if (!ev || ev.type !== 'attack' || !ev.card) { state = next; render(ev); return; }
    presenting = true; selection = null; renderArmies(); renderUI();
    try {
      if (!await drawAttack(ev, token) || token !== epoch) return;
      setAttackStage('impact');
      state = next; render(ev);
      await delay(480 + (ev.hits?.length || 1) * 80);
    } finally {
      if (token === epoch) { clearAttack(); presenting = false; attackStage = ''; renderUI(); }
    }
  }
  function sparks(x, y) {
    if (reduceMotion) return;
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('i'); el.className = 'spark'; el.style.left = x + 'px'; el.style.top = y + 'px'; $('effects').append(el);
      const angle = i / 12 * Math.PI * 2, length = 35 + Math.random() * 25;
      el.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: `translate(${Math.cos(angle) * length * .6}px,${Math.sin(angle) * length * .6}px) scale(1)`, opacity: 1, offset: .3 }, { transform: `translate(${Math.cos(angle) * length}px,${Math.sin(angle) * length + 10}px) scale(0)`, opacity: 0 }], { duration: 800, easing: 'ease-out' }).finished.then(() => el.remove());
    }
  }
  function attackEffect(ev, previous) {
    for (const [index, hit] of (ev.hits || []).entries()) {
      const target = document.querySelector(`[data-unit="${hit.id}"]`), old = previous.get(hit.id);
      const rect = target?.getBoundingClientRect() || old?.rect;
      if (!rect) continue;
      if (target && !reduceMotion) { const rest = getComputedStyle(target).transform; target.animate([{ transform: rest }, { transform: `translateX(-6px) rotate(-3deg) ${rest}` }, { transform: `translateX(5px) rotate(2deg) ${rest}` }, { transform: `translateX(-3px) ${rest}` }, { transform: rest }], { duration: 420, delay: index * 80 }); }
      const pop = document.createElement('div'); pop.className = 'damage-float'; pop.style.left = rect.x + rect.width / 2 - 15 + 'px'; pop.style.top = rect.y + 10 + 'px';
      pop.innerHTML = '−' + hit.damage + (hit.role === 'soldier' ? '<small>双倍</small>' : ''); $('effects').append(pop);
      pop.animate([{ opacity: 0, transform: 'translateY(10px) scale(.7)' }, { opacity: 1, transform: 'translateY(-12px) scale(1.1)', offset: .2 }, { opacity: 1, transform: 'translateY(-24px) scale(1)', offset: .65 }, { opacity: 0, transform: 'translateY(-50px) scale(.9)' }], { duration: reduceMotion ? 200 : 1150, delay: index * 80, easing: 'ease-out' }).finished.then(() => pop.remove());
      const ring = document.createElement('i'); ring.className = 'impact-ring'; ring.style.cssText = `left:${rect.x + rect.width / 2}px;top:${rect.y + (rect.height - 14) / 2}px`;
      $('effects').append(ring);
      ring.animate([{ opacity: .85, transform: 'translate(-50%,-50%) scale(.2)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' }], { duration: reduceMotion ? 1 : 530, delay: index * 80, easing: 'ease-out' }).finished.then(() => ring.remove());
      if (hit.killed) sparks(rect.x + rect.width / 2, rect.y + 35);
    }
  }
  function setSelection(next) { selection = next; renderArmies(); renderUI(); }
  async function rollAnimation(finalValue) {
    rolling = true; $('dice').classList.add('rolling'); $('dice').dataset.rollPhase = 'airborne'; renderUI(); sound('roll');
    const interval = setInterval(() => drawDie(1 + Math.floor(Math.random() * 6)), 80);
    const bounce = window.CrownfallTableFlip.diceBounceFrames();
    const revealTimer = setTimeout(() => { clearInterval(interval); drawDie(finalValue); $('dice').dataset.rollPhase = 'settling'; }, reduceMotion ? 0 : bounce.revealAt);
    try {
      await $('dice').animate(reduceMotion ? [{ opacity: .6 }, { opacity: 1 }] : bounce.frames,
        { duration: reduceMotion ? 160 : bounce.duration, easing: 'linear' }).finished.catch(() => {});
    } finally { clearInterval(interval); clearTimeout(revealTimer); drawDie(finalValue); rolling = false; $('dice').classList.remove('rolling'); delete $('dice').dataset.rollPhase; }
  }
  async function dispatch(action) {
    if (busy || presenting || resetting || !myTurn()) return;
    if (tutorial && !T.allowed(tutorial.step, action)) { toast('跟着当前提示，先完成这一步'); return; }
    busy = true; selection = null; const thisEpoch = epoch;
    renderArmies(); renderUI();
    try {
      if (thisEpoch !== epoch) return;
      if (mode === 'ai') { const next = structuredClone(state), ev = G.act(next, seat, action, tutorial ? T.playerRoll : Math.random); await present(next, ev); if (thisEpoch === epoch && tutorial) await advanceTutorial(action); }
      else await post('/api/action', { ...netSession, action, seq: state.seq });
    } catch (error) { toast(error.message); }
    finally { if (thisEpoch === epoch) { busy = false; renderUI(); scheduleAI(); } }
  }
  function scheduleAI() {
    if (aiTimer || tutorial || presenting || resetting || mode !== 'ai' || state.turn !== 1 || state.phase === 'over') return;
    const thisEpoch = epoch;
    aiTimer = setTimeout(async () => {
      aiTimer = null;
      if (thisEpoch !== epoch || mode !== 'ai' || state.turn !== 1 || state.phase === 'over') return;
      const action = G.chooseFriendlyAI(state, 1);
      if (!action) return;
      if (thisEpoch !== epoch) return;
      try { const next = structuredClone(state), ev = G.act(next, 1, action); await present(next, ev); }
      catch (error) { console.error('AI action failed', error); toast('推演中断，重新开局即可继续'); return; }
      scheduleAI();
    }, reduceMotion ? 250 : state.phase === 'roll' ? 900 : 1050);
  }
  function updateResult() {
    $('result-title').textContent = state.winner === -1 ? '双王，落幕。' : state.winner === seat ? '此局，加冕。' : '王国，待重建。';
    $('result-eyebrow').textContent = state.winner === -1 ? 'TWO CROWNS FALL' : state.winner === seat ? 'THE CROWN IS YOURS' : 'EVERY KINGDOM RISES AGAIN';
    $('result-description').textContent = state.winner === -1 ? '疲劳耗尽了双方主将的生命，本局平局。' : state.winner === seat ? '最后一层防线已破，王冠属于你。' : '主将的生命已归零，换一个阵法再来。';
    $('result-rounds').textContent = state.round; $('result-hp').textContent = mine().hp; $('result-knights').textContent = count(mine().knights);
    const voted = mode === 'lan' && room.votes.includes(seat);
    $('play-again').disabled = voted; $('play-again').innerHTML = voted ? '等待对方同意…' : '再来一局 <span>→</span>';
    if (tutorial) {
      $('result-title').textContent = '第一局，加冕。';
      $('result-description').textContent = '你已学会掷骰、排兵、册封和逐层突破。准备好与虎鲸正式对弈了。';
      $('play-again').disabled = false; $('play-again').innerHTML = '完成教程 <span>→</span>';
    }
  }
  function startTutorial() {
    if (tutorial || resetting) return;
    const previous = { state: structuredClone(state), gameIndex, scrollY: window.scrollY, mode, seat, room, netSession };
    epoch++; clearTimeout(aiTimer); aiTimer = null; clearAttack(); $('dice').getAnimations().forEach(a => a.cancel());
    source?.close(); source = null; presentationQueue = Promise.resolve();
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    tutorial = { step: 0, previous }; state = T.create(); gameIndex = 0; seat = 0; mode = 'ai'; room = null; netSession = null; connection = 'ok';
    busy = false; rolling = false; presenting = false; selection = null; lastResult = -1; attackStage = '';
    $('dice').classList.remove('rolling'); $('effects').innerHTML = ''; document.body.classList.add('tutorial-active');
    render(); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function finishTutorial() {
    if (!tutorial) return;
    const previous = tutorial.previous;
    epoch++; clearTimeout(aiTimer); aiTimer = null; clearAttack(); $('dice').getAnimations().forEach(a => a.cancel());
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    tutorial = null; state = previous.state; gameIndex = previous.gameIndex; mode = previous.mode; seat = previous.seat; room = previous.room; netSession = previous.netSession;
    connection = mode === 'lan' ? 'connecting' : 'ok';
    busy = false; rolling = false; presenting = false; selection = null; lastResult = -1; attackStage = '';
    $('dice').classList.remove('rolling'); $('effects').innerHTML = ''; document.body.classList.remove('tutorial-active');
    save(); render(); window.scrollTo({ top: previous.scrollY || 0, behavior: 'instant' });
    if (mode === 'lan') {
      const token = epoch;
      try {
        const resumed = await post('/api/resume', previous.netSession);
        if (token === epoch) connect(resumed, previous.netSession);
      } catch (error) {
        if (token !== epoch) return;
        connect({ ...previous.room, state: previous.state }, previous.netSession);
        toast(error.message + '，正在尝试重连');
      }
    } else scheduleAI();
  }
  async function advanceTutorial(action) {
    if (!tutorial) return;
    tutorial.step++; renderUI();
    if (action.type !== 'end') return;
    const token = epoch;
    await delay(300);
    if (!tutorial || token !== epoch) return;
    let next = structuredClone(state), ev = G.act(next, 1, { type: 'roll' }, T.opponentRoll);
    await present(next, ev); await delay(250);
    if (!tutorial || token !== epoch) return;
    next = structuredClone(state); ev = G.act(next, 1, { type: 'end' });
    await present(next, ev);
  }
  async function restartWithFlip(reset) {
    if (resetting) return;
    resetting = true; busy = true; epoch++;
    clearTimeout(aiTimer); aiTimer = null; clearAttack(); presenting = false; selection = null; rolling = false;
    $('dice').getAnimations().forEach(animation => animation.cancel());
    $('dice').classList.remove('rolling');
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    document.querySelector('.game-shell').inert = true;
    renderArmies(); renderUI();
    let committed = false;
    const commit = () => { if (!committed) { committed = true; reset(); } };
    try {
      await window.CrownfallTableFlip.play({ table: $('table'), commit, reducedMotion: reduceMotion,
        onStage: stage => { if (stage === 'lift') sound('flip'); if (stage === 'settle') sound('land'); renderUI(); } });
    } catch (error) { commit(); console.error('Table reset animation interrupted', error); }
    finally {
      resetting = false; busy = false; document.querySelector('.game-shell').inert = false;
      renderUI(); scheduleAI();
    }
  }
  function newLocal(alternate = false) {
    epoch++; clearAttack(); clearTimeout(aiTimer); aiTimer = null; source?.close(); source = null; presentationQueue = Promise.resolve();
    try { sessionStorage.removeItem(SESSION); } catch {}
    netSession = null; mode = 'ai'; room = null; seat = 0; selection = null; busy = false; rolling = false; presenting = false; attackStage = ''; lastResult = -1;
    gameIndex = alternate ? gameIndex + 1 : 0; state = G.create(Math.random, gameIndex % 2);
    document.querySelectorAll('dialog[open]').forEach(d => d.close()); $('effects').innerHTML = ''; $('dice').classList.remove('rolling');
    save(); render(); scheduleAI();
  }
  async function post(path, body) {
    let response;
    try { response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); }
    catch { throw new Error('无法连接牌桌，请确认本地服务仍在运行'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('本地服务响应异常，请重新连接'); }
    if (!response.ok) throw new Error(data.error || '连接失败');
    return data;
  }
  function connect(data, credentials) {
    epoch++; clearAttack(); clearTimeout(aiTimer); aiTimer = null; source?.close(); presentationQueue = Promise.resolve();
    mode = 'lan'; room = data; state = data.state; seat = credentials.seat; netSession = credentials; selection = null; busy = false; rolling = false; presenting = false; attackStage = ''; connection = 'connecting'; lastResult = -1;
    try { sessionStorage.setItem(SESSION, JSON.stringify(credentials)); } catch {}
    render();
    const stream = new EventSource('/api/events?' + new URLSearchParams({ code: credentials.code, token: credentials.token })); source = stream;
    let receivedSeq = data.state.seq, receivedGame = data.gameIndex;
    stream.onopen = () => { if (source === stream) { connection = 'ok'; renderUI(); } };
    stream.onmessage = message => {
      if (source !== stream) return;
      let next;
      try { next = JSON.parse(message.data); } catch { return; }
      const restarted = next.gameIndex !== receivedGame;
      const changed = next.state.seq !== receivedSeq || restarted;
      receivedSeq = next.state.seq; receivedGame = next.gameIndex;
      room = next; connection = 'ok';
      if (!changed) { renderUI(); refreshLanContent(); return; }
      // Keep both seats on the same draw → reveal → strike timeline, even if
      // another packet arrives while a card is still being shown.
      presentationQueue = presentationQueue.then(async () => {
        if (source !== stream) return;
        selection = null;
        if (restarted) {
          await restartWithFlip(() => { epoch++; clearAttack(); presenting = false; attackStage = ''; lastResult = -1; state = next.state; $('effects').innerHTML = ''; render(); });
          refreshLanContent(); return;
        }
        const ev = !restarted && next.state.seq === state.seq + 1 ? next.state.lastEvent : null;
        await present(next.state, ev);
        refreshLanContent();
      }).catch(error => { if (source === stream) { clearAttack(); presenting = false; state = next.state; render(); console.error('Presentation interrupted', error); } });
    };
    stream.onerror = () => { if (source === stream) { connection = 'reconnecting'; selection = null; if (presenting) renderUI(); else render(); } };
    refreshLanContent();
  }
  function invitation() {
    const origin = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? netInfo?.addresses[0] || location.origin : location.origin;
    return origin + '/?room=' + room.code;
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const input = document.createElement('textarea'); input.value = text; input.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      const parent = document.querySelector('dialog[open]') || document.body; parent.append(input); input.select();
      const done = document.execCommand('copy'); input.remove();
      if (!done) { toast('请手动复制房间码：' + (room?.code || '')); return; }
    }
    toast('邀请链接已复制');
  }
  function refreshLanContent() {
    const active = mode === 'lan';
    $('lan-active').hidden = !active; $('lan-options').hidden = active || !netInfo; $('lan-offline').hidden = Boolean(netInfo) || active;
    if (active) {
      $('invite-code').textContent = room.code;
      $('lan-address').textContent = '对手打开 ' + invitation() + ' 即可入座。' + (netInfo?.addresses.length > 1 ? ' 其他可用地址：' + netInfo.addresses.slice(1).join('、') : '');
      $('lan-message').textContent = !room.ready ? '牌桌已开，正在等候另一位玩家。' : connection !== 'ok' ? '正在重连…' : '两位君主已入座。关闭此窗口即可对弈。';
    }
  }
  async function openLan() {
    $('lan-message').textContent = '';
    if (!$('lan-dialog').open) $('lan-dialog').showModal();
    if (location.protocol === 'file:') { netInfo = null; refreshLanContent(); return; }
    try {
      const response = await fetch('/api/info', { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error();
      netInfo = await response.json();
    } catch { netInfo = null; }
    refreshLanContent();
  }
  async function roomRequest(path, body, button) {
    if (button.disabled) return;
    button.disabled = true; $('lan-message').textContent = '正在准备牌桌…';
    try {
      const data = await post(path, body);
      connect(data, { code: data.code, token: data.token, seat: data.seat });
      $('lan-dialog').close(); toast(path === '/api/create' ? '牌桌已开 · 点击房间码旁的链接邀请好友' : '已入座 · 祝你此局加冕');
    } catch (error) { $('lan-message').textContent = error.message; }
    finally { button.disabled = false; }
  }
  async function rematch() {
    if (tutorial) return finishTutorial();
    if (mode === 'ai') return restartWithFlip(() => newLocal(true));
    $('play-again').disabled = true;
    try { await post('/api/rematch', netSession); toast('已邀请对方再来一局'); }
    catch (error) { toast(error.message); $('play-again').disabled = false; }
  }
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', ev => { if (ev.target === dialog) { const r = dialog.getBoundingClientRect(); if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) dialog.close(); } }));
  function openRules() {
    $('rules-start-tutorial').innerHTML = tutorial ? '继续新手教程 <span>→</span>' : '开始新手教程 <span>→</span>';
    $('rules-tutorial-note').textContent = tutorial ? '关闭手册，继续当前教学步骤。' : mode === 'lan' ? '进入教程会暂停联机对局，退出后回到原座位。' : '随时练习，退出教程后回到当前牌局。';
    $('rules-dialog').showModal();
  }
  $('rules-button').onclick = openRules;
  $('rules-start-tutorial').onclick = () => { if (tutorial) $('rules-dialog').close(); else startTutorial(); };
  $('rules-link').onclick = () => {
    if (tutorial) return finishTutorial();
    $('tutorial-dialog').showModal();
  };
  $('start-tutorial').onclick = startTutorial;
  $('tutorial-exit').onclick = finishTutorial;
  $('tutorial-read-rules').onclick = () => { $('tutorial-dialog').close(); openRules(); };
  $('sound-button').onclick = () => { soundEnabled = !soundEnabled; $('sound-button').innerHTML = icon(soundEnabled ? 'sound' : 'mute'); $('sound-button').setAttribute('aria-pressed', soundEnabled); $('sound-button').setAttribute('aria-label', soundEnabled ? '关闭音效' : '打开音效'); $('sound-button').title = soundEnabled ? '关闭音效' : '打开音效'; if (soundEnabled) sound('promote'); };
  $('dice').onclick = () => dispatch({ type: 'roll' });
  $('recruit-button').onclick = () => dispatch({ type: 'recruit' });
  $('promote-button').onclick = () => { if (!$('promote-button').disabled) setSelection(selection === 'promote' ? null : 'promote'); };
  $('attack-button').onclick = () => { if (!$('attack-button').disabled) setSelection(selection === 'attack' ? null : 'attack'); };
  $('end-button').onclick = () => dispatch({ type: 'end' });
  $('cancel-target').onclick = () => setSelection(null);
  $('table').addEventListener('click', event => {
    const card = event.target.closest('[data-card]'); if (!card) return;
    const owner = Number(card.dataset.owner), id = card.dataset.card;
    if (selection === 'attack' && owner !== seat && G.frontier(enemy()).some(u => u.id === id)) dispatch({ type: 'attack', target: id });
    else if (selection === 'promote' && owner === seat && mine().soldiers.some(u => u?.id === id)) dispatch({ type: 'promote', target: id });
    else if (selection === 'attack') toast('先突破最外层的护卫');
    else if (selection === 'promote') toast('请选择你前排的士兵');
    else toast(card.getAttribute('aria-label'));
  });
  $('lan-mode').onclick = openLan;
  $('room-share').onclick = () => copy(invitation());
  $('ai-mode').onclick = () => { if (mode !== 'ai') newLocal(); };
  $('create-room').onclick = () => roomRequest('/api/create', {}, $('create-room'));
  $('join-form').onsubmit = event => { event.preventDefault(); roomRequest('/api/join', { code: $('join-code').value.trim().toUpperCase() }, $('join-button')); };
  $('join-code').oninput = () => { $('join-code').value = $('join-code').value.replace(/[^a-fA-F0-9]/g, '').toUpperCase(); };
  $('copy-invite').onclick = () => copy(invitation());
  $('leave-room').onclick = () => newLocal();
  $('journal-toggle').onclick = () => { const expanded = document.querySelector('.journal').classList.toggle('expanded'); $('journal-toggle').setAttribute('aria-expanded', expanded); $('journal-toggle').innerHTML = expanded ? '收起 <span>↙</span>' : '展开 <span>↗</span>'; };
  $('restart-button').onclick = () => {
    if (resetting) return;
    if (mode === 'lan') { if (state.phase === 'over') { $('result-dialog').showModal(); } else toast('联机对战结束后，双方可同意再来一局'); return; }
    $('restart-dialog').showModal();
  };
  $('confirm-restart').onclick = () => restartWithFlip(() => newLocal());
  $('play-again').onclick = rematch;
  document.addEventListener('keydown', event => {
    if (resetting) { event.preventDefault(); return; }
    if (event.key === 'Escape') { if (selection) { event.preventDefault(); setSelection(null); } return; }
    if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const button = { d: 'dice', r: 'recruit-button', c: 'promote-button', a: 'attack-button', e: 'end-button' }[event.key.toLowerCase()];
    if (button && !$(button).disabled) { event.preventDefault(); $(button).click(); }
  });
  render(); scheduleAI();
  (async () => {
    if (location.protocol === 'file:') return;
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(SESSION)); } catch {}
    if (saved?.token && saved?.code) {
      try { const data = await post('/api/resume', saved); connect(data, saved); return; }
      catch { try { sessionStorage.removeItem(SESSION); } catch {} toast('原牌桌已关闭，已回到人机对战'); }
    }
    const code = new URLSearchParams(location.search).get('room');
    if (code && /^[A-F0-9]{6}$/i.test(code)) { $('join-code').value = code.toUpperCase(); openLan(); }
  })();
})();
