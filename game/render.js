// TRENCHLIGHT renderer — light IS the look. Pitch-black water, warm light.
// Flashlight cone with soft falloff, sonar rings that fade, a glowing lure,
// bioluminescent plankton, glinting relics, darkness that deepens with depth.
(function (global) {
  'use strict';

  var VIEW_W = 1280;
  var VIEW_H = 720;

  function createRenderer(canvas) {
    var dark = document.createElement('canvas');
    dark.width = VIEW_W;
    dark.height = VIEW_H;
    return {
      ctx: canvas.getContext('2d'),
      dark: dark,
      dctx: dark.getContext('2d')
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function hexRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
  }

  function mixColor(a, b, t) {
    var ca = hexRgb(a), cb = hexRgb(b);
    return 'rgb(' +
      Math.round(ca[0] + (cb[0] - ca[0]) * t) + ',' +
      Math.round(ca[1] + (cb[1] - ca[1]) * t) + ',' +
      Math.round(ca[2] + (cb[2] - ca[2]) * t) + ')';
  }

  // Depth gradient across the visible screen, sampled from the zones.
  function drawWater(ctx, world, cam, time) {
    var topM = cam.y / 10;
    var botM = (cam.y + VIEW_H) / 10;
    var topZone = global.TrenchWorld.zoneAt(topM);
    var botZone = global.TrenchWorld.zoneAt(botM);
    var g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, topZone.topColor);
    g.addColorStop(0.5, mixColor(topZone.bottomColor, botZone.topColor, 0.5));
    g.addColorStop(1, botZone.bottomColor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // God rays near the surface.
    if (cam.y < 700) {
      ctx.save();
      ctx.globalAlpha = 0.05 * (1 - cam.y / 700);
      ctx.fillStyle = '#bfefff';
      for (var i = 0; i < 4; i++) {
        var rx = 180 + i * 300 + Math.sin(time * 0.11 + i * 1.7) * 26;
        ctx.beginPath();
        ctx.moveTo(rx, -20);
        ctx.lineTo(rx + 90, -20);
        ctx.lineTo(rx + 210, VIEW_H);
        ctx.lineTo(rx + 60, VIEW_H);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawRocks(ctx, world, cam) {
    ctx.fillStyle = '#020a14';
    var rocks = world.rocks;
    for (var i = 0; i < rocks.length; i++) {
      var r = rocks[i];
      var sy = r.y - cam.y;
      if (sy > VIEW_H + 120 || sy + r.h < -120) continue;
      var sx = r.x - cam.x;
      ctx.beginPath();
      if (r.x === 0) {
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + r.w * r.jag, sy + r.h * 0.3);
        ctx.lineTo(sx + r.w * 0.7, sy + r.h * 0.6);
        ctx.lineTo(sx + r.w * 0.4, sy + r.h);
        ctx.lineTo(sx, sy + r.h);
      } else {
        ctx.moveTo(sx + r.w, sy);
        ctx.lineTo(sx + r.w - r.w * r.jag, sy + r.h * 0.3);
        ctx.lineTo(sx + r.w * 0.3, sy + r.h * 0.6);
        ctx.lineTo(sx + r.w * 0.6, sy + r.h);
        ctx.lineTo(sx + r.w, sy + r.h);
      }
      ctx.closePath(); ctx.fill();
    }
    // Seabed ridge at the very bottom.
    var floorY = world.h - cam.y;
    if (floorY < VIEW_H + 40) {
      ctx.fillStyle = '#03101d';
      ctx.beginPath();
      ctx.moveTo(0, floorY + 30);
      for (var x = 0; x <= VIEW_W; x += 90) {
        ctx.lineTo(x, floorY + Math.sin(x * 0.011 + 2) * 14);
      }
      ctx.lineTo(VIEW_W, VIEW_H);
      ctx.lineTo(0, VIEW_H);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawSnow(ctx, world, cam, time) {
    ctx.fillStyle = 'rgba(200, 230, 245, 0.5)';
    var flakes = world.snow;
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      var sy = f.y - cam.y;
      if (sy < -10 || sy > VIEW_H + 10) continue;
      var sx = f.x - cam.x + Math.sin(time * 0.3 + f.sway) * 8;
      ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.arc(sx, sy, f.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlankton(ctx, world, cam, time) {
    var motes = world.plankton;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      var sy = m.y - cam.y;
      if (sy < -12 || sy > VIEW_H + 12) continue;
      var sx = m.x - cam.x;
      var tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * m.speed + m.phase));
      ctx.fillStyle = m.hue === 'cyan'
        ? 'rgba(90, 220, 255, ' + (0.5 * tw) + ')'
        : 'rgba(120, 255, 170, ' + (0.45 * tw) + ')';
      ctx.beginPath(); ctx.arc(sx, sy, m.r * (0.8 + tw * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawTanks(ctx, world, cam, time) {
    var tanks = world.tanks;
    for (var i = 0; i < tanks.length; i++) {
      var t = tanks[i];
      if (t.taken) continue;
      var sx = t.x - cam.x;
      var sy = t.y - cam.y + Math.sin(time * 1.4 + t.bob) * 4;
      if (sy < -30 || sy > VIEW_H + 30) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 44);
      g.addColorStop(0, 'rgba(110, 230, 255, 0.5)');
      g.addColorStop(1, 'rgba(110, 230, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, 44, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#0e4a5e';
      ctx.strokeStyle = '#7df0c8';
      ctx.lineWidth = 2;
      roundRect(ctx, sx - 9, sy - 16, 18, 32, 8);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7df0c8';
      ctx.fillRect(sx - 5, sy - 20, 10, 5);
      ctx.fillStyle = '#eafcff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('O₂', sx, sy + 4);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Relics glint: a warm gem glow plus a sparkle that flashes.
  function drawRelics(ctx, world, cam, time) {
    var relics = world.relics;
    for (var i = 0; i < relics.length; i++) {
      var r = relics[i];
      if (r.taken) continue;
      var sx = r.x - cam.x;
      var sy = r.y - cam.y + Math.sin(time * 1.2 + r.bob) * 5;
      if (sy < -40 || sy > VIEW_H + 40) continue;
      var glint = 0.6 + 0.4 * Math.sin(time * 2.4 + r.bob * 3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 52);
      g.addColorStop(0, 'rgba(255, 214, 120, ' + (0.55 * glint) + ')');
      g.addColorStop(1, 'rgba(255, 214, 120, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, 52, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Gem: a small faceted diamond.
      ctx.fillStyle = '#ffd76e';
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 13);
      ctx.lineTo(sx + 10, sy);
      ctx.lineTo(sx, sy + 13);
      ctx.lineTo(sx - 10, sy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy - 8);
      ctx.lineTo(sx + 2, sy - 2);
      ctx.lineTo(sx - 2, sy + 2);
      ctx.closePath(); ctx.fill();
      // Sparkle cross.
      if (glint > 0.85) {
        ctx.strokeStyle = 'rgba(255, 244, 200, ' + (glint - 0.6) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx - 16, sy); ctx.lineTo(sx + 16, sy);
        ctx.moveTo(sx, sy - 16); ctx.lineTo(sx, sy + 16);
        ctx.stroke();
      }
    }
  }

  function drawDiver(ctx, diver, cam, time) {
    var sx = diver.x - cam.x;
    var sy = diver.y - cam.y;
    var dir = Math.cos(diver.aimAngle) >= 0 ? 1 : -1;
    var kick = Math.sin(time * 9) * (diver.moving ? 1 : 0.3);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(dir * 1.2, 1.2);
    // Bubbles rise from the helmet.
    // (Bubble particles themselves are drawn by drawBubbles.)
    // Fins.
    ctx.fillStyle = '#0d2f45';
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-26, -4 + kick * 5);
    ctx.lineTo(-26, 8 + kick * 5);
    ctx.closePath(); ctx.fill();
    // Body — dark suit with a cyan trim.
    ctx.fillStyle = '#10283a';
    roundRect(ctx, -12, -8, 24, 16, 7);
    ctx.fill();
    ctx.strokeStyle = '#19c2e6';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Oxygen tank on the back.
    ctx.fillStyle = '#c8d4da';
    roundRect(ctx, -14, -13, 12, 8, 3);
    ctx.fill();
    // Helmet — round glass with a warm lamp dot.
    ctx.fillStyle = '#dfeef5';
    ctx.beginPath(); ctx.arc(12, -2, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a2a3a';
    ctx.beginPath(); ctx.arc(14, -2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9ad';
    ctx.beginPath(); ctx.arc(15, -4, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBubbles(ctx, bubbles, cam) {
    ctx.fillStyle = 'rgba(190, 235, 255, 0.55)';
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      var sx = b.x - cam.x, sy = b.y - cam.y;
      ctx.globalAlpha = clamp(b.life, 0, 1) * 0.6;
      ctx.beginPath(); ctx.arc(sx, sy, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath(); ctx.arc(sx - b.r * 0.3, sy - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(190, 235, 255, 0.55)';
    }
  }

  // The darkness layer: everything is black except the holes light punches.
  function drawDarkness(r, s, time) {
    var dctx = r.dctx;
    var cam = s.cam;
    var depthM = clamp((s.diver.y / 10), 0, 720);
    var zone = global.TrenchWorld.zoneAt(depthM);
    var alpha = 1 - zone.light; // 0.45 near the surface, 0.9 in the abyss
    dctx.clearRect(0, 0, VIEW_W, VIEW_H);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = 'rgba(1, 4, 10, ' + alpha.toFixed(3) + ')';
    dctx.fillRect(0, 0, VIEW_W, VIEW_H);

    dctx.globalCompositeOperation = 'destination-out';
    var dx = s.diver.x - cam.x, dy = s.diver.y - cam.y;
    var flicker = 0.94 + 0.04 * Math.sin(time * 13) + 0.02 * Math.sin(time * 29 + 1.3);

    // Soft glow hugging the diver.
    var glow = dctx.createRadialGradient(dx, dy, 0, dx, dy, 175);
    glow.addColorStop(0, 'rgba(255,255,255,0.85)');
    glow.addColorStop(0.55, 'rgba(255,255,255,0.4)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    dctx.fillStyle = glow;
    dctx.beginPath(); dctx.arc(dx, dy, 175, 0, Math.PI * 2); dctx.fill();

    // Flashlight cone — long, warm, soft falloff, following the aim.
    var aim = s.diver.aimAngle;
    var coneLen = 540;
    var half = 0.34;
    dctx.save();
    dctx.translate(dx, dy);
    dctx.rotate(aim);
    var cone = dctx.createLinearGradient(0, 0, coneLen, 0);
    cone.addColorStop(0, 'rgba(255, 244, 200, ' + (0.95 * flicker).toFixed(3) + ')');
    cone.addColorStop(0.6, 'rgba(255, 244, 200, ' + (0.45 * flicker).toFixed(3) + ')');
    cone.addColorStop(1, 'rgba(255, 244, 200, 0)');
    dctx.fillStyle = cone;
    dctx.beginPath();
    dctx.moveTo(0, 0);
    dctx.lineTo(coneLen, -Math.tan(half) * coneLen);
    dctx.lineTo(coneLen, Math.tan(half) * coneLen);
    dctx.closePath(); dctx.fill();
    dctx.restore();

    // Sonar rings — expanding circles of light that fade.
    for (var i = 0; i < s.pings.length; i++) {
      var p = s.pings[i];
      var px = p.x - cam.x, py = p.y - cam.y;
      var disc = dctx.createRadialGradient(px, py, 0, px, py, p.r);
      disc.addColorStop(0, 'rgba(255,255,255,' + (0.22 * p.alpha).toFixed(3) + ')');
      disc.addColorStop(0.8, 'rgba(255,255,255,' + (0.12 * p.alpha).toFixed(3) + ')');
      disc.addColorStop(1, 'rgba(255,255,255,0)');
      dctx.fillStyle = disc;
      dctx.beginPath(); dctx.arc(px, py, p.r, 0, Math.PI * 2); dctx.fill();
      dctx.strokeStyle = 'rgba(255,255,255,' + (0.65 * p.alpha).toFixed(3) + ')';
      dctx.lineWidth = 22;
      dctx.beginPath(); dctx.arc(px, py, p.r, 0, Math.PI * 2); dctx.stroke();
    }

    // Relic and tank glows peek through the dark.
    var relics = s.world.relics;
    for (var j = 0; j < relics.length; j++) {
      if (relics[j].taken) continue;
      var rx = relics[j].x - cam.x;
      var ry = relics[j].y - cam.y + Math.sin(time * 1.2 + relics[j].bob) * 5;
      var rg = dctx.createRadialGradient(rx, ry, 0, rx, ry, 58);
      rg.addColorStop(0, 'rgba(255,255,255,0.55)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      dctx.fillStyle = rg;
      dctx.beginPath(); dctx.arc(rx, ry, 58, 0, Math.PI * 2); dctx.fill();
    }
    var tanks = s.world.tanks;
    for (var k = 0; k < tanks.length; k++) {
      if (tanks[k].taken) continue;
      var tx = tanks[k].x - cam.x;
      var ty = tanks[k].y - cam.y;
      var tg = dctx.createRadialGradient(tx, ty, 0, tx, ty, 40);
      tg.addColorStop(0, 'rgba(255,255,255,0.4)');
      tg.addColorStop(1, 'rgba(255,255,255,0)');
      dctx.fillStyle = tg;
      dctx.beginPath(); dctx.arc(tx, ty, 40, 0, Math.PI * 2); dctx.fill();
    }

    // Warden lure glow — a warm point of light in the black.
    var lure = global.TrenchWarden.lurePos(s.warden);
    var lx = lure.x - cam.x, ly = lure.y - cam.y;
    var lg2 = dctx.createRadialGradient(lx, ly, 0, lx, ly, 74);
    lg2.addColorStop(0, 'rgba(255,255,255,0.6)');
    lg2.addColorStop(1, 'rgba(255,255,255,0)');
    dctx.fillStyle = lg2;
    dctx.beginPath(); dctx.arc(lx, ly, 74, 0, Math.PI * 2); dctx.fill();

    // Plankton — the tiniest holes, a faint shimmer.
    var motes = s.world.plankton;
    for (var m = 0; m < motes.length; m++) {
      var mo = motes[m];
      var my = mo.y - cam.y;
      if (my < -10 || my > VIEW_H + 10) continue;
      dctx.fillStyle = 'rgba(255,255,255,0.1)';
      dctx.beginPath(); dctx.arc(mo.x - cam.x, my, mo.r * 2, 0, Math.PI * 2); dctx.fill();
    }
  }

  // Warm haze over the dark: the beam is warm light, not just a hole.
  function drawBeamWash(ctx, diver, cam) {
    var dx = diver.x - cam.x, dy = diver.y - cam.y;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var halo = ctx.createRadialGradient(dx, dy, 0, dx, dy, 130);
    halo.addColorStop(0, 'rgba(255, 220, 150, 0.15)');
    halo.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(dx, dy, 130, 0, Math.PI * 2); ctx.fill();
    ctx.translate(dx, dy);
    ctx.rotate(diver.aimAngle);
    var wash = ctx.createLinearGradient(0, 0, 540, 0);
    wash.addColorStop(0, 'rgba(255, 214, 130, 0.24)');
    wash.addColorStop(0.6, 'rgba(255, 214, 130, 0.1)');
    wash.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(540, -184);
    ctx.lineTo(540, 184);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawSonarRingsTop(ctx, pings, cam) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < pings.length; i++) {
      var p = pings[i];
      ctx.strokeStyle = 'rgba(140, 230, 255, ' + (0.5 * p.alpha).toFixed(3) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDangerVignette(ctx, danger, time) {
    if (danger <= 0.01) return;
    var pulse = 0.5 + 0.5 * Math.sin(time * 5);
    var a = danger * (0.22 + 0.18 * pulse);
    var g = ctx.createRadialGradient(640, 360, 280, 640, 360, 720);
    g.addColorStop(0, 'rgba(180, 10, 20, 0)');
    g.addColorStop(1, 'rgba(180, 10, 20, ' + a.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // Full frame. s: { world, diver, warden, wardenReveal, pings, bubbles, cam, danger }
  function render(r, s, time) {
    var ctx = r.ctx;
    var cam = s.cam;
    drawWater(ctx, s.world, cam, time);
    drawRocks(ctx, s.world, cam);
    drawSnow(ctx, s.world, cam, time);
    drawPlankton(ctx, s.world, cam, time);
    drawTanks(ctx, s.world, cam, time);
    drawRelics(ctx, s.world, cam, time);
    drawDiver(ctx, s.diver, cam, time);
    drawBubbles(ctx, s.bubbles, cam);
    drawDarkness(r, s, time);
    ctx.drawImage(r.dark, 0, 0);
    // The Warden's body shows once light or sonar has found it — drawn
    // over the dark so the reveal reads as a lit predator, not a smudge.
    if (s.wardenReveal > 0.02) {
      global.TrenchWarden.drawWarden(ctx, s.warden, cam, time, s.wardenReveal);
    }
    drawBeamWash(ctx, s.diver, cam);
    // Eyes and lure burn through the dark before the body ever shows.
    global.TrenchWarden.drawWardenEyes(ctx, s.warden, cam, time);
    drawSonarRingsTop(ctx, s.pings, cam);
    drawDangerVignette(ctx, s.danger, time);
  }

  global.TrenchRender = {
    createRenderer: createRenderer,
    render: render,
    VIEW_W: VIEW_W,
    VIEW_H: VIEW_H
  };
})(typeof window !== 'undefined' ? window : this);
