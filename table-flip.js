(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownfallTableFlip = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const AXIS = -.13;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function pose(u, v, angle) {
    return { x: u * Math.cos(AXIS) - v * Math.cos(angle) * Math.sin(AXIS), y: u * Math.sin(AXIS) + v * Math.cos(angle) * Math.cos(AXIS), z: v * Math.sin(angle) };
  }
  function velocity(v, speed, angle, omega) {
    const tangent = speed * Math.cos(angle) - v * omega * Math.sin(angle);
    return { vx: -Math.sin(AXIS) * tangent, vy: Math.cos(AXIS) * tangent, vz: speed * Math.sin(angle) + v * omega * Math.cos(angle) };
  }
  function createSimulation(width, height, specs, rng = Math.random) {
    const g = height * 7.85, floor = -height * .66;
    return { width, height, g, floor, time: 0,
      table: { angle: 0, omega: 0, alpha: 0, released: false, ...pose(height / 2 * Math.sin(AXIS), height / 2 * Math.cos(AXIS), 0) },
      bodies: specs.map((b, i) => {
        const u = b.x * Math.cos(AXIS) + b.y * Math.sin(AXIS), v = -b.x * Math.sin(AXIS) + b.y * Math.cos(AXIS);
        const die = b.kind === 'die';
        return { ...b, id: i, u, v, slide: 0, contact: true, ...pose(u, v, 0), vx: 0, vy: 0, vz: 0,
          angle: 0, tumble: 0, roll: (b.roll || 0) * Math.PI / 180, spin: 0,
          muS: (die ? .52 : .37) + rng() * .06, muK: die ? .32 : .22 + rng() * .06,
          drag: die ? .000035 : .00055 + rng() * .00025, restitution: die ? .38 : .1,
          radius: die ? b.width / 2 : 1, bounces: 0 };
      }) };
  }
  function advanceFree(body, dt, g, floor) {
    const speed = Math.hypot(body.vx, body.vy, body.vz), drag = body.drag * speed;
    const ax = -drag * body.vx, ay = -drag * body.vy, az = -g - drag * body.vz;
    body.x += body.vx * dt + .5 * ax * dt * dt;
    body.y += body.vy * dt + .5 * ay * dt * dt;
    body.z += body.vz * dt + .5 * az * dt * dt;
    body.vx += ax * dt; body.vy += ay * dt; body.vz += az * dt;
    body.angle += body.tumble * dt; body.roll += body.spin * dt;
    body.tumble *= Math.exp(-(body.kind === 'die' ? .18 : .65) * dt);
    body.spin *= Math.exp(-.5 * dt);
    if (body.z < floor + body.radius) {
      body.z = floor + body.radius;
      if (body.vz < -Math.max(80, g * dt * 2.1)) {
        body.vz = -body.vz * body.restitution; body.bounces++;
        if (body.kind === 'die') body.tumble += body.vz / Math.max(20, body.width) * .25;
      } else body.vz = 0;
      body.vx *= Math.exp(-9 * dt); body.vy *= Math.exp(-9 * dt);
      if (body.kind !== 'die') {
        const flat = Math.round(body.angle / Math.PI) * Math.PI;
        body.angle += (flat - body.angle) * (1 - Math.exp(-18 * dt)); body.tumble *= Math.exp(-16 * dt);
      }
    }
  }
  function step(sim, dt) {
    sim.time += dt;
    const table = sim.table, H = sim.height;
    if (!table.released) {
      const pulse = sim.time >= .1 && sim.time < .42 ? 42 * Math.sin((sim.time - .1) / .32 * Math.PI) : 0;
      table.alpha = pulse - 1.5 * sim.g / H * Math.cos(table.angle) - 1.2 * table.omega;
      if (table.angle <= 0 && table.alpha < 0) { table.angle = 0; table.omega = 0; table.alpha = 0; }
      table.omega += table.alpha * dt; table.angle += table.omega * dt;
      Object.assign(table, pose(H / 2 * Math.sin(AXIS), H / 2 * Math.cos(AXIS), table.angle));
      if (table.angle > Math.PI * .51) {
        table.released = true;
        Object.assign(table, velocity(H / 2 * Math.cos(AXIS), 0, table.angle, table.omega));
      }
    } else {
      table.x += table.vx * dt; table.y += table.vy * dt;
      table.z += table.vz * dt - .5 * sim.g * dt * dt; table.vz -= sim.g * dt;
      table.angle += table.omega * dt; table.omega *= Math.exp(-.1 * dt);
    }
    for (const body of sim.bodies) {
      if (!body.contact) { advanceFree(body, dt, sim.g, sim.floor); continue; }
      const normal = sim.g * Math.cos(table.angle) + body.v * table.alpha + 2 * body.slide * table.omega;
      const drive = body.v * table.omega * table.omega - sim.g * Math.sin(table.angle);
      let acceleration = 0;
      if (Math.abs(body.slide) > .5 || Math.abs(drive) > body.muS * Math.max(0, normal)) {
        const sign = Math.abs(body.slide) > .5 ? Math.sign(body.slide) : Math.sign(drive);
        acceleration = drive - sign * body.muK * Math.max(0, normal);
      } else body.slide = 0;
      const previousSpeed = body.slide;
      body.slide += acceleration * dt;
      if (previousSpeed && Math.sign(previousSpeed) !== Math.sign(body.slide) && Math.abs(drive) < body.muS * Math.max(0, normal)) body.slide = 0;
      body.v += body.slide * dt;
      const originalX = body.u * Math.cos(AXIS) - body.v * Math.sin(AXIS);
      const originalY = body.u * Math.sin(AXIS) + body.v * Math.cos(AXIS);
      const offEdge = originalY < -body.height * .3 || originalY > H + body.height * .3 || Math.abs(originalX) > sim.width / 2 + body.width * .3;
      Object.assign(body, pose(body.u, body.v, table.angle));
      body.angle = table.angle;
      if (table.released || normal <= 0 || offEdge) {
        body.contact = false; body.departed = sim.time;
        Object.assign(body, velocity(body.v, body.slide, table.angle, table.omega));
        body.tumble = table.omega + body.slide / Math.max(40, body.height) * (body.kind === 'die' ? .5 : .22);
        body.spin = clamp(body.slide / Math.max(40, body.width) * body.u / sim.width, -7, 7);
      }
    }
    return sim;
  }
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function diceBounceFrames() {
    const duration = 1040, frames = [], count = 125, dt = duration / 1000 / count;
    let y = 0, vy = -380, lastImpact = -10, impactSpeed = 0;
    for (let i = 0; i <= count; i++) {
      const t = i * dt;
      if (i > 0) {
        y += vy * dt + .5 * 1450 * dt * dt; vy += 1450 * dt;
        if (y > 0) {
          y = 0;
          if (vy > 35) { lastImpact = t; impactSpeed = vy; vy = -vy * .4; } else vy = 0;
        }
      }
      const age = t - lastImpact;
      const squash = .13 * Math.min(1, impactSpeed / 380) * Math.exp(-age * 27) * Math.cos(age * 25);
      const sx = 1 + squash, sy = 1 - squash;
      const u = clamp(t / 1.04, 0, 1), rotation = 9 + 34 * Math.sin(u * Math.PI * 2) * (1 - u) ** 2;
      const height = Math.max(0, -y), tilt = Math.min(8, height * .14);
      frames.push({ offset: i / count,
        transform: `translateY(${y}px) scale(${sx},${sy}) rotate(${rotation}deg) rotateX(${Math.sin(t * 8) * tilt}deg) rotateY(${Math.cos(t * 7) * tilt * .5}deg)`,
        boxShadow: `inset 2px 3px 4px #fff8,inset -2px -3px 3px #a88d5d2e,0 3px 0 #b8a98a,0 5px 0 #aa9c7f,2px ${10 + height * .3}px ${13 + height * .35}px rgba(10,40,30,${.4 - height * .003})`
      });
    }
    frames[frames.length - 1].transform = 'translateY(0px) scale(1,1) rotate(9deg) rotateX(0) rotateY(0)';
    return { frames, duration, revealAt: 430 };
  }
  async function play({ table, commit, reducedMotion = false, onStage = () => {} }) {
    const doc = table.ownerDocument, win = doc.defaultView;
    let overlay, shadow, surface, raf, committed = false, stopped = false;
    const priorVisibility = table.style.visibility;
    const oldOverflow = doc.documentElement.style.overflow;
    const commitOnce = () => { if (!committed) { committed = true; commit(); } };
    const report = stage => { doc.body.dataset.resetStage = stage; onStage(stage); };
    const finishAnimation = animation => animation.finished.catch(() => {});
    try {
      doc.body.classList.add('is-table-flipping');
      doc.documentElement.style.overflow = 'hidden';
      win.scrollTo({ top: Math.max(0, win.scrollY + table.getBoundingClientRect().top - 12), behavior: 'instant' });
      await new Promise(resolve => win.requestAnimationFrame(resolve));
      if (reducedMotion) {
        report('clear');
        await finishAnimation(table.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }));
        commitOnce(); report('settle');
        table.getAnimations().forEach(a => a.cancel());
        await finishAnimation(table.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 }));
        return;
      }
      const rect = table.getBoundingClientRect(), W = rect.width, H = rect.height, cx = rect.x + W / 2;
      const specs = [], sourceNodes = [];
      function add(node, kind, count = 1) {
        const r = node.getBoundingClientRect();
        for (let i = 0; i < count; i++) {
          const width = node.offsetWidth, height = node.offsetHeight;
          const unitTransform = kind === 'card' ? win.getComputedStyle(node.closest('.unit')).transform : 'none';
          const matrix = new win.DOMMatrix(unitTransform === 'none' ? undefined : unitTransform);
          const cardRoll = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
          specs.push({ kind, width, height, x: r.x + r.width / 2 - cx + i * .45, y: H - (r.y + r.height / 2 - rect.y) - i * .18, roll: kind === 'deck' ? -7 + i * .15 : kind === 'die' ? 9 : cardRoll });
          sourceNodes.push(node);
        }
      }
      table.querySelectorAll('.unit .playing-card').forEach(node => add(node, 'card'));
      add(table.querySelector('.deck'), 'deck', Math.min(15, Math.max(4, Math.ceil(Number(doc.getElementById('deck-count')?.textContent || 52) / 4))));
      add(table.querySelector('.dice'), 'die');
      overlay = doc.createElement('div'); overlay.className = 'table-flip-stage'; overlay.setAttribute('aria-hidden', 'true');
      overlay.style.perspectiveOrigin = `${cx}px ${rect.y}px`;
      const world = doc.createElement('div'); world.className = 'table-flip-world'; overlay.append(world);
      shadow = doc.createElement('div'); shadow.className = 'table-flip-ground-shadow';
      shadow.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${W}px;height:${H}px`; world.append(shadow);
      surface = doc.createElement('div'); surface.className = 'table-flip-surface';
      surface.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${W}px;height:${H}px`;
      const front = table.cloneNode(true); front.classList.add('table-flip-front');
      front.style.cssText = `width:${W}px;height:${H}px;min-height:0;max-height:none;position:absolute;inset:0;visibility:visible`;
      front.querySelectorAll('.unit,.deck,.dice').forEach(el => { el.style.visibility = 'hidden'; });
      front.querySelectorAll('[id]').forEach(el => el.removeAttribute('id')); front.removeAttribute('id');
      const back = doc.createElement('div'); back.className = 'table-flip-back';
      front.style.backfaceVisibility = 'visible'; back.style.backfaceVisibility = 'visible';
      back.innerHTML = '<i></i><i></i><span>♛</span>';
      surface.append(front, back); world.append(surface);
      const pieces = specs.map((spec, i) => {
        const node = sourceNodes[i], el = doc.createElement('div');
        el.className = 'table-flip-piece ' + (spec.kind === 'die' ? 'flip-die' : 'flip-paper');
        el.style.cssText = `width:${spec.width}px;height:${spec.height}px;--card-w:${spec.width}px;--card-h:${spec.height}px;--die-half:${spec.width / 2}px`;
        if (spec.kind === 'die') {
          const layouts = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
          const value = Number(node.getAttribute('aria-label')?.match(/：(\d)/)?.[1]) || 5;
          el.innerHTML = [value, 7 - value, 2, 5, 3, 4].map((v, side) => `<div class="flip-die-face side-${side}"><span class="dice-face">${layouts[v].map(p => `<i class="die-pip" style="grid-row:${Math.floor(p / 3) + 1};grid-column:${p % 3 + 1}"></i>`).join('')}</span></div>`).join('');
        } else {
          const face = spec.kind === 'deck' ? node.querySelector('.deck-back').cloneNode(true) : node.cloneNode(true);
          face.classList.add('flip-paper-face'); face.removeAttribute('id'); face.removeAttribute('data-card'); face.removeAttribute('aria-label'); face.setAttribute('tabindex', '-1');
          face.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;transform:none;transition:none';
          const reverse = table.querySelector('.deck-back').cloneNode(true); reverse.classList.add('flip-paper-reverse');
          el.append(face, reverse);
        }
        world.append(el); return el;
      });
      doc.body.append(overlay); table.style.visibility = 'hidden';
      const sim = createSimulation(W, H, specs);
      let last = win.performance.now(), accumulator = 0;
      const radToDeg = 180 / Math.PI;
      function drawFrame(now) {
        if (stopped) return;
        // Replay at a slight slow-motion rate; the physics timestep stays fixed.
        accumulator += Math.min(.05, Math.max(0, (now - last) / 1000)) * .72; last = now;
        while (accumulator >= 1 / 120) { step(sim, 1 / 120); accumulator -= 1 / 120; }
        const t = sim.table, angle = t.angle * radToDeg;
        const follow = -H * .12 * Math.sin(clamp(t.angle, 0, Math.PI / 2));
        world.style.transform = `translateY(${follow}px) matrix3d(1,0,0,0,0,1,0,0,0,-.62,1,0,0,0,0,1)`;
        const rotation = `rotateZ(${-AXIS * radToDeg}deg) rotateX(${-angle}deg) rotateZ(${AXIS * radToDeg}deg)`;
        surface.style.transform = `translate3d(${t.x}px,${H / 2 - t.y}px,${t.z}px) ${rotation}`;
        const frontFacing = Math.cos(t.angle) + .62 * Math.cos(AXIS) * Math.sin(t.angle) > 0;
        front.style.visibility = frontFacing ? 'visible' : 'hidden'; back.style.visibility = frontFacing ? 'hidden' : 'visible';
        surface.style.opacity = String(1 - clamp((sim.time - 1.35) / .4, 0, 1));
        shadow.style.opacity = String(.16 * (1 - clamp(sim.time / 1.3, 0, 1)));
        shadow.style.transform = `translate3d(${t.x}px,${H / 2 - t.y}px,${sim.floor}px) scale(.9)`;
        sim.bodies.forEach((b, i) => {
          const el = pieces[i];
          el.style.transform = `translate3d(${cx + b.x - b.width / 2}px,${rect.y + H - b.y - b.height / 2}px,${b.z + 3}px) rotateZ(${-AXIS * radToDeg}deg) rotateX(${-b.angle * radToDeg}deg) rotateZ(${b.roll * radToDeg + AXIS * radToDeg}deg)`;
          if (b.kind !== 'die') {
            const visibleFace = Math.cos(b.angle) + .62 * Math.cos(AXIS) * Math.sin(b.angle) > 0;
            el.children[0].style.backfaceVisibility = 'visible'; el.children[1].style.backfaceVisibility = 'visible';
            el.children[0].style.visibility = visibleFace ? 'visible' : 'hidden'; el.children[1].style.visibility = visibleFace ? 'hidden' : 'visible';
          }
          el.style.opacity = String(1 - clamp((sim.time - 1.7) / .4, 0, 1));
          el.dataset.motion = b.contact ? 'contact' : b.bounces ? 'bounce' : 'airborne';
        });
        const stage = sim.time < .14 ? 'brace' : sim.bodies.some(b => !b.contact) ? 'flight' : 'lift';
        if (doc.body.dataset.resetStage !== stage) report(stage);
        raf = win.requestAnimationFrame(drawFrame);
      }
      report('brace'); raf = win.requestAnimationFrame(drawFrame);
      await sleep(3000);
      stopped = true; win.cancelAnimationFrame(raf);
      commitOnce(); table.style.visibility = priorVisibility; overlay.remove(); overlay = null;
      report('settle');
      // A critically damped landing is sampled analytically; no repeated bounce.
      const frames = Array.from({ length: 46 }, (_, i) => {
        const t = i / 45 * .62, displacement = -32 * (1 + 12 * t) * Math.exp(-12 * t);
        return { transform: `perspective(1400px) translateY(${displacement}px) rotateX(${displacement * .12}deg)`, opacity: .45 + .55 * Math.min(1, t / .2), offset: i / 45 };
      });
      await finishAnimation(table.animate(frames, { duration: 620, easing: 'linear' }));
    } finally {
      stopped = true; if (raf) win.cancelAnimationFrame(raf);
      try { commitOnce(); } finally {
        overlay?.remove(); table.style.visibility = priorVisibility;
        doc.body.classList.remove('is-table-flipping'); delete doc.body.dataset.resetStage;
        doc.documentElement.style.overflow = oldOverflow;
      }
    }
  }
  return { createSimulation, step, advanceFree, diceBounceFrames, play };
});
