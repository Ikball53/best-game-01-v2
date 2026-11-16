// TRENCHLIGHT Warden — a giant deep-sea predatory fish, anglerfish-like.
// Big jaw, rows of sharp teeth, glowing lure, glowing eyes, spiky fins.
// FIERCE, not cute: angular, dark, menacing. Its eyes glow in the dark
// long before its body shows.
(function (global) {
  'use strict';

  var BODY_LEN = 380; // snout to tail, px — big enough to fill the frame
  var BODY_H = 220;
  var CATCH_R = 110;
  var PATROL_SPEED = 65;
  var HUNT_BASE = 110;

  function createWarden(den) {
    return {
      x: den.x, y: den.y,
      angle: Math.PI, // facing left to start
      alert: 0,       // 0..100 — how worked up it is
      mode: 'patrol', // patrol | hunt | return
      tx: den.x, ty: den.y, // current steer target
      den: den,
      lastPingAt: -100,
      pingsHeard: 0,
      swimPhase: 0,
      lurePhase: Math.random() * Math.PI * 2
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function dist(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

  function turnToward(w, targetAngle, rate, dt) {
    var diff = targetAngle - w.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    var step = clamp(diff, -rate * dt, rate * dt);
    w.angle += step;
  }

  // events: { ping: bool, pingX, pingY, now, beamHit: bool }
  function updateWarden(w, dt, diver, events) {
    var d = dist(w.x, w.y, diver.x, diver.y);
    w.swimPhase += dt * 3;

    // --- Alertness: pings wake it, proximity enrages it. ---
    if (events.ping) {
      var rapid = (events.now - w.lastPingAt) < 3;
      w.alert = clamp(w.alert + (rapid ? 34 : 24), 0, 100);
      w.lastPingAt = events.now;
      w.pingsHeard += 1;
      w.tx = events.pingX;
      w.ty = events.pingY;
    }
    if (d < 300) w.alert = clamp(w.alert + dt * 26, 0, 100);
    else if (d < 520) w.alert = clamp(w.alert + dt * 7, 0, 100);
    else w.alert = clamp(w.alert - dt * 3.5, 0, 100);
    if (events.beamHit) w.alert = clamp(w.alert - dt * 7, 0, 100);

    // --- Mode: hunt when worked up, drift home when calm. ---
    if (w.alert > 55) w.mode = 'hunt';
    else if (w.alert < 18) w.mode = 'patrol';

    var speed = PATROL_SPEED;
    if (w.mode === 'hunt') {
      // It knows exactly where the diver is when close; otherwise it
      // stalks the last place it heard a ping.
      if (d < 430) { w.tx = diver.x; w.ty = diver.y; }
      speed = HUNT_BASE + w.alert * 1.7;
      if (events.beamHit) speed *= 0.45; // light slows it down
      turnToward(w, angleTo(w.x, w.y, w.tx, w.ty), 2.4, dt);
    } else {
      // Slow patrol loop around its den, with a lazy sine wander.
      var t = w.swimPhase * 0.35;
      w.tx = w.den.x + Math.cos(t) * 300;
      w.ty = w.den.y + Math.sin(t * 0.7) * 190;
      turnToward(w, angleTo(w.x, w.y, w.tx, w.ty), 1.1, dt);
    }

    w.x += Math.cos(w.angle) * speed * dt;
    w.y += Math.sin(w.angle) * speed * dt * 0.8;
    w.x = clamp(w.x, 200, 1280 - 200);
    w.y = clamp(w.y, 1300, 7050);
  }

  function wardenCaught(w, diver) {
    return dist(w.x, w.y, diver.x, diver.y) < CATCH_R;
  }

  // Lure tip position (world coords) — the glowing bait ahead of the jaw.
  function lurePos(w) {
    var a = w.angle;
    var lx = w.x + Math.cos(a) * (BODY_LEN * 0.62);
    var ly = w.y + Math.sin(a) * (BODY_LEN * 0.62) - BODY_H * 0.15 + Math.sin(w.lurePhase) * 6;
    return { x: lx, y: ly };
  }

  // Eyes only — drawn on the darkness itself, so they burn through the
  // black before the body ever shows.
  function drawWardenEyes(ctx, w, cam, time) {
    var sx = w.x - cam.x, sy = w.y - cam.y;
    if (sx < -260 || sx > 1540 || sy < -260 || sy > 980) return;
    var dir = Math.cos(w.angle) >= 0 ? 1 : -1;
    var pulse = 0.75 + Math.sin(time * 2.2 + w.lurePhase) * 0.25;
    var lure = lurePos(w);
    var lx = lure.x - cam.x, ly = lure.y - cam.y;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Lure glow.
    var lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, BODY_LEN * 0.4);
    lg.addColorStop(0, 'rgba(255, 224, 138, 0.9)');
    lg.addColorStop(0.35, 'rgba(255, 190, 80, 0.35)');
    lg.addColorStop(1, 'rgba(255, 190, 80, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(lx, ly, BODY_LEN * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9ad';
    ctx.beginPath(); ctx.arc(lx, ly, BODY_LEN * 0.03, 0, Math.PI * 2); ctx.fill();
    // Two eyes.
    var ex = sx + dir * BODY_LEN * 0.28, ey = sy - BODY_H * 0.18;
    var ex2 = sx + dir * BODY_LEN * 0.17, ey2 = sy - BODY_H * 0.34;
    [[ex, ey, BODY_LEN * 0.047], [ex2, ey2, BODY_LEN * 0.033]].forEach(function (e) {
      var g = ctx.createRadialGradient(e[0], e[1], 0, e[0], e[1], e[2] * 4);
      g.addColorStop(0, 'rgba(191, 246, 255, ' + (0.95 * pulse) + ')');
      g.addColorStop(0.4, 'rgba(120, 220, 255, ' + (0.4 * pulse) + ')');
      g.addColorStop(1, 'rgba(120, 220, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e[0], e[1], e[2] * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#dffaff';
      ctx.beginPath(); ctx.arc(e[0], e[1], e[2] * 0.55, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  // The whole fish: angular dark body, spiky fins, huge jaw, needle teeth.
  function drawWarden(ctx, w, cam, time, reveal) {
    var sx = w.x - cam.x, sy = w.y - cam.y;
    if (sx < -320 || sx > 1600 || sy < -320 || sy > 1040) return;
    var dir = Math.cos(w.angle) >= 0 ? 1 : -1;
    var wiggle = Math.sin(w.swimPhase) * 0.06;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(dir, 1);
    ctx.rotate(wiggle);
    ctx.globalAlpha = reveal;

    // Tail fin — forked, sharp.
    ctx.fillStyle = '#04101d';
    ctx.beginPath();
    ctx.moveTo(-BODY_LEN * 0.42, -6);
    ctx.lineTo(-BODY_LEN * 0.62, -34);
    ctx.lineTo(-BODY_LEN * 0.5, 0);
    ctx.lineTo(-BODY_LEN * 0.62, 34);
    ctx.lineTo(-BODY_LEN * 0.42, 6);
    ctx.closePath(); ctx.fill();

    // Spiky dorsal fin — a row of blades along the back.
    ctx.fillStyle = '#061423';
    ctx.beginPath();
    ctx.moveTo(-BODY_LEN * 0.34, -BODY_H * 0.42);
    var spikes = 5;
    for (var i = 0; i < spikes; i++) {
      var bx = -BODY_LEN * 0.34 + (i * BODY_LEN * 0.62) / spikes;
      ctx.lineTo(bx + BODY_LEN * 0.05, -BODY_H * 0.42 - 26 - (i % 2) * 8);
      ctx.lineTo(bx + BODY_LEN * 0.11, -BODY_H * 0.42);
    }
    ctx.lineTo(BODY_LEN * 0.3, -BODY_H * 0.42);
    ctx.closePath(); ctx.fill();

    // Body — long wedge, heavy head, tapering tail. Dark and hard-edged.
    var bodyGrad = ctx.createLinearGradient(0, -BODY_H / 2, 0, BODY_H / 2);
    bodyGrad.addColorStop(0, '#0a1a2c');
    bodyGrad.addColorStop(0.55, '#050d18');
    bodyGrad.addColorStop(1, '#02060d');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(BODY_LEN * 0.52, -6);            // snout tip
    ctx.lineTo(BODY_LEN * 0.34, -BODY_H * 0.46); // brow
    ctx.lineTo(-BODY_LEN * 0.1, -BODY_H * 0.5);  // back
    ctx.lineTo(-BODY_LEN * 0.44, -BODY_H * 0.18);// tail top
    ctx.lineTo(-BODY_LEN * 0.44, BODY_H * 0.18); // tail bottom
    ctx.lineTo(-BODY_LEN * 0.08, BODY_H * 0.42); // belly
    ctx.lineTo(BODY_LEN * 0.3, BODY_H * 0.3);    // lower jaw hinge
    ctx.lineTo(BODY_LEN * 0.52, 14);             // chin
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90, 160, 200, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Belly spikes.
    ctx.fillStyle = '#061423';
    ctx.beginPath();
    ctx.moveTo(-BODY_LEN * 0.05, BODY_H * 0.42);
    ctx.lineTo(BODY_LEN * 0.02, BODY_H * 0.42 + 14);
    ctx.lineTo(BODY_LEN * 0.09, BODY_H * 0.42);
    ctx.lineTo(BODY_LEN * 0.16, BODY_H * 0.42 + 12);
    ctx.lineTo(BODY_LEN * 0.22, BODY_H * 0.4);
    ctx.closePath(); ctx.fill();

    // Open jaw — dark red maw with two rows of needle teeth.
    ctx.fillStyle = '#1a0508';
    ctx.beginPath();
    ctx.moveTo(BODY_LEN * 0.5, -2);
    ctx.lineTo(BODY_LEN * 0.52, 16);
    ctx.lineTo(BODY_LEN * 0.18, BODY_H * 0.3);
    ctx.lineTo(BODY_LEN * 0.34, 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8f6ff';
    var teeth;
    var toothStep = BODY_LEN * 0.06;
    var toothH = BODY_LEN * 0.08;
    for (teeth = 0; teeth < 6; teeth++) { // upper teeth, pointing down
      var tx = BODY_LEN * 0.48 - teeth * toothStep;
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx - toothStep * 0.45, toothH);
      ctx.lineTo(tx + toothStep * 0.45, 1);
      ctx.closePath(); ctx.fill();
    }
    for (teeth = 0; teeth < 5; teeth++) { // lower teeth, pointing up
      var lx2 = BODY_LEN * 0.47 - teeth * toothStep * 1.1;
      ctx.beginPath();
      ctx.moveTo(lx2, toothH);
      ctx.lineTo(lx2 - toothStep * 0.45, 3);
      ctx.lineTo(lx2 + toothStep * 0.45, toothH - 1);
      ctx.closePath(); ctx.fill();
    }

    // Pectoral fin.
    ctx.fillStyle = '#04101d';
    ctx.beginPath();
    ctx.moveTo(-BODY_LEN * 0.02, 6);
    ctx.lineTo(-BODY_LEN * 0.16, 44);
    ctx.lineTo(BODY_LEN * 0.06, 18);
    ctx.closePath(); ctx.fill();

    // Lure stalk + glowing bulb, dangling ahead of the jaw.
    ctx.strokeStyle = '#0a1a2c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(BODY_LEN * 0.36, -BODY_H * 0.4);
    ctx.quadraticCurveTo(BODY_LEN * 0.55, -BODY_H * 0.62, BODY_LEN * 0.62, -BODY_H * 0.15);
    ctx.stroke();
    var lureGlow = ctx.createRadialGradient(BODY_LEN * 0.62, -BODY_H * 0.15, 0, BODY_LEN * 0.62, -BODY_H * 0.15, BODY_LEN * 0.17);
    lureGlow.addColorStop(0, 'rgba(255, 224, 138, 0.95)');
    lureGlow.addColorStop(1, 'rgba(255, 190, 80, 0)');
    ctx.fillStyle = lureGlow;
    ctx.beginPath(); ctx.arc(BODY_LEN * 0.62, -BODY_H * 0.15, BODY_LEN * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9ad';
    ctx.beginPath(); ctx.arc(BODY_LEN * 0.62, -BODY_H * 0.15, BODY_LEN * 0.032, 0, Math.PI * 2); ctx.fill();

    // Eyes — pale, lidless, fixed forward.
    var pulse = 0.8 + Math.sin(time * 2.2 + w.lurePhase) * 0.2;
    ctx.fillStyle = 'rgba(191, 246, 255, ' + pulse + ')';
    ctx.beginPath(); ctx.arc(BODY_LEN * 0.3, -BODY_H * 0.2, BODY_LEN * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(BODY_LEN * 0.2, -BODY_H * 0.3, BODY_LEN * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#06121f';
    ctx.beginPath(); ctx.arc(BODY_LEN * 0.3, -BODY_H * 0.2, BODY_LEN * 0.016, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(BODY_LEN * 0.2, -BODY_H * 0.3, BODY_LEN * 0.012, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  global.TrenchWarden = {
    createWarden: createWarden,
    updateWarden: updateWarden,
    wardenCaught: wardenCaught,
    drawWarden: drawWarden,
    drawWardenEyes: drawWardenEyes,
    lurePos: lurePos,
    BODY_LEN: BODY_LEN
  };
})(typeof window !== 'undefined' ? window : this);
