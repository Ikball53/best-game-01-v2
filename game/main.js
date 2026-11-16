// TRENCHLIGHT game — the loop, the rules, the quiet UI.
// Win: collect 5 relics, then return to the surface alive. That is all.
// Lose: oxygen hits 0, or the Warden catches you. Nothing else.
(function () {
  'use strict';

  var VIEW_W = 1280;
  var VIEW_H = 720;
  var OXY_MAX = 100;
  var PING_COST = 1.5;
  var PING_COOLDOWN = 1.1;
  var DASH_COST = 4;
  var DASH_COOLDOWN = 0.9;
  var SWIM_ACCEL = 1500;
  var SWIM_MAX = 190;
  var DASH_SPEED = 540;

  var BEST_KEY = 'trenchlight-best-v2';

  function $(id) { return document.getElementById(id); }

  function loadBest() {
    try {
      var b = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
      return { score: b.score || 0, depth: b.depth || 0 };
    } catch (e) { return { score: 0, depth: 0 }; }
  }

  function saveBest(best) {
    try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) { /* private mode */ }
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function createGame() {
    var canvas = $('game');
    var renderer = TrenchRender.createRenderer(canvas);
    var input = TrenchInput.createInput(canvas);
    var sound = new TrenchSound();
    var world = TrenchWorld.createWorld(20261116);
    var warden = TrenchWarden.createWarden(world.wardenDen);

    var game = {
      state: 'menu', // menu | playing | paused | win | lose
      diver: null,
      oxygen: OXY_MAX,
      relicsGot: 0,
      score: 0,
      elapsed: 0,
      maxDepthM: 0,
      pings: [],
      bubbles: [],
      cam: { x: 0, y: 0 },
      wardenReveal: 0,
      danger: 0,
      pingTimer: 0,
      dashTimer: 0,
      bubbleTimer: 0,
      heartTimer: 0,
      loseCause: '',
      time: 0,
      noteTimer: null
    };

    function newDiver() {
      return {
        x: 640, y: 70, vx: 0, vy: 0,
        aimAngle: Math.PI / 2, moving: false, r: 14
      };
    }

    function resetRun() {
      world = TrenchWorld.createWorld(20261116);
      warden = TrenchWarden.createWarden(world.wardenDen);
      game.diver = newDiver();
      game.oxygen = OXY_MAX;
      game.relicsGot = 0;
      game.score = 0;
      game.elapsed = 0;
      game.maxDepthM = 0;
      game.pings = [];
      game.bubbles = [];
      game.pingTimer = 0;
      game.dashTimer = 0;
      game.heartTimer = 0;
      game.wardenReveal = 0;
      game.danger = 0;
      game.loseCause = '';
      sound.stopWardenDrone();
    }

    function showOnly(id) {
      ['screen-start', 'card-win', 'card-lose', 'card-pause'].forEach(function (x) {
        $(x).classList.add('hidden');
      });
      if (id) $(id).classList.remove('hidden');
      $('hud').classList.toggle('hidden', game.state !== 'playing' && game.state !== 'paused');
      $('touch-controls').classList.toggle('hidden', game.state !== 'playing');
    }

    function showNote(text) {
      var note = $('hud-note');
      note.textContent = text;
      note.classList.add('show');
      if (game.noteTimer) clearTimeout(game.noteTimer);
      game.noteTimer = setTimeout(function () { note.classList.remove('show'); }, 1400);
    }

    function startGame() {
      resetRun();
      game.state = 'playing';
      showOnly(null);
      sound.ensure();
      sound.startAmbient();
      sound.click();
    }

    function showMenu() {
      game.state = 'menu';
      game.diver = newDiver();
      game.diver.y = 5900; // deep water behind the menu, lure glowing below
      sound.stopWardenDrone();
      refreshBestLine();
      showOnly('screen-start');
    }

    function refreshBestLine() {
      var best = loadBest();
      $('best-score').textContent = best.score;
      $('best-depth').textContent = best.depth + ' m';
    }

    function endRun(win, cause) {
      var best = loadBest();
      var depthM = Math.floor(game.maxDepthM);
      if (game.score > best.score) best.score = game.score;
      if (depthM > best.depth) best.depth = depthM;
      saveBest(best);
      sound.stopWardenDrone();
      if (win) {
        game.state = 'win';
        sound.win();
        $('win-stats').innerHTML =
          'SCORE <b>' + game.score + '</b> &nbsp;·&nbsp; TIME <b>' + fmtTime(game.elapsed) + '</b><br>' +
          'MAX DEPTH <b>' + depthM + ' m</b> &nbsp;·&nbsp; RELICS <b>5 / 5</b>';
        showOnly('card-win');
      } else {
        game.state = 'lose';
        game.loseCause = cause;
        sound.lose();
        $('lose-cause').textContent = cause;
        $('lose-stats').innerHTML =
          'DEPTH <b>' + depthM + ' m</b> &nbsp;·&nbsp; RELICS <b>' + game.relicsGot + ' / 5</b><br>' +
          'SCORE <b>' + game.score + '</b> &nbsp;·&nbsp; TIME <b>' + fmtTime(game.elapsed) + '</b>';
        showOnly('card-lose');
      }
    }

    function firePing() {
      if (game.pingTimer > 0) return;
      game.pingTimer = PING_COOLDOWN;
      game.oxygen = Math.max(0, game.oxygen - PING_COST);
      game.pings.push({ x: game.diver.x, y: game.diver.y, r: 12, alpha: 1 });
      sound.ping();
    }

    function doDash(mv) {
      if (game.dashTimer > 0 || game.oxygen <= DASH_COST) return;
      game.dashTimer = DASH_COOLDOWN;
      game.oxygen = Math.max(0, game.oxygen - DASH_COST);
      var dx = mv.active ? mv.x : Math.cos(game.diver.aimAngle);
      var dy = mv.active ? mv.y : Math.sin(game.diver.aimAngle);
      game.diver.vx += dx * DASH_SPEED;
      game.diver.vy += dy * DASH_SPEED;
    }

    function resolveRocks(d) {
      var rocks = world.rocks;
      for (var i = 0; i < rocks.length; i++) {
        var r = rocks[i];
        var cx = Math.max(r.x, Math.min(d.x, r.x + r.w));
        var cy = Math.max(r.y, Math.min(d.y, r.y + r.h));
        var dx = d.x - cx, dy = d.y - cy;
        var distSq = dx * dx + dy * dy;
        if (distSq < d.r * d.r && distSq > 0.01) {
          var dist = Math.sqrt(distSq);
          d.x = cx + (dx / dist) * d.r;
          d.y = cy + (dy / dist) * d.r;
        }
      }
    }

    function updatePlaying(dt) {
      var d = game.diver;
      var mv = input.moveVector();
      d.moving = mv.active;

      // Swim with water drag.
      d.vx += mv.x * SWIM_ACCEL * dt;
      d.vy += mv.y * SWIM_ACCEL * dt;
      var drag = Math.exp(-3.1 * dt);
      d.vx *= drag;
      d.vy *= drag;
      var sp = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
      if (sp > SWIM_MAX) { d.vx *= SWIM_MAX / sp; d.vy *= SWIM_MAX / sp; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.x = Math.max(34, Math.min(world.w - 34, d.x));
      d.y = Math.max(30, Math.min(world.h - 20, d.y));
      resolveRocks(d);

      // Aim: mouse on desktop, travel direction on touch.
      if (input.usingTouch) {
        if (mv.active) d.aimAngle = Math.atan2(mv.y, mv.x);
      } else {
        var sx = d.x - game.cam.x, sy = d.y - game.cam.y;
        d.aimAngle = Math.atan2(input.mouseY - sy, input.mouseX - sx);
      }

      if (input.consumePing()) firePing();
      if (input.consumeDash()) doDash(mv);
      game.pingTimer = Math.max(0, game.pingTimer - dt);
      game.dashTimer = Math.max(0, game.dashTimer - dt);

      var depthM = d.y / 10;
      game.maxDepthM = Math.max(game.maxDepthM, depthM);
      game.elapsed += dt;

      // Oxygen drains constantly, faster the deeper you go.
      var drain = 0.5 + (depthM / 720) * 1.1;
      game.oxygen = Math.max(0, game.oxygen - drain * dt);
      if (game.oxygen < 25) {
        game.heartTimer -= dt;
        if (game.heartTimer <= 0) {
          game.heartTimer = 1.0;
          sound.heartbeat();
        }
      }

      // Sonar rings expand and fade.
      for (var i = game.pings.length - 1; i >= 0; i--) {
        var p = game.pings[i];
        p.r += 640 * dt;
        p.alpha = Math.max(0, 1 - p.r / 430);
        if (p.alpha <= 0) game.pings.splice(i, 1);
      }

      // Warden: ping events + flashlight beam.
      var wDist = Math.sqrt((warden.x - d.x) * (warden.x - d.x) + (warden.y - d.y) * (warden.y - d.y));
      var toW = Math.atan2(warden.y - d.y, warden.x - d.x);
      var angDiff = Math.abs(toW - d.aimAngle);
      if (angDiff > Math.PI) angDiff = Math.PI * 2 - angDiff;
      var beamHit = angDiff < 0.34 && wDist < 540;
      var pingEvent = game.pings.length > 0 && game.pings[game.pings.length - 1].r < 40;
      TrenchWarden.updateWarden(warden, dt, d, {
        ping: pingEvent,
        pingX: d.x, pingY: d.y,
        now: game.elapsed,
        beamHit: beamHit
      });

      // Warden reveal: light, sonar, or closeness.
      var revealTarget = 0;
      if (beamHit || wDist < 280) revealTarget = 1;
      for (var j = 0; j < game.pings.length; j++) {
        if (Math.abs(game.pings[j].r - wDist) < 120) revealTarget = 1;
      }
      game.wardenReveal += (revealTarget - game.wardenReveal) * Math.min(1, dt * 4);

      // Danger: how close the Warden is. Drives the vignette + the drone.
      game.danger = Math.max(0, Math.min(1, (520 - wDist) / 340));
      if (game.danger > 0.25) sound.startWardenDrone();
      else sound.stopWardenDrone();

      // Relics: touch to collect, automatically.
      for (var k = 0; k < world.relics.length; k++) {
        var r = world.relics[k];
        if (r.taken) continue;
        var rd = Math.sqrt((r.x - d.x) * (r.x - d.x) + (r.y - d.y) * (r.y - d.y));
        if (rd < 36) {
          r.taken = true;
          game.relicsGot += 1;
          game.score += r.value;
          sound.pickup();
          showNote(r.name + '  ·  +' + r.value);
        }
      }

      // Oxygen tanks.
      for (var m = 0; m < world.tanks.length; m++) {
        var t = world.tanks[m];
        if (t.taken) continue;
        var td = Math.sqrt((t.x - d.x) * (t.x - d.x) + (t.y - d.y) * (t.y - d.y));
        if (td < 34) {
          t.taken = true;
          game.oxygen = Math.min(OXY_MAX, game.oxygen + 30);
          sound.tank();
          showNote('Oxygen tank  ·  +30');
        }
      }

      // Bubbles trail from the diver.
      game.bubbleTimer -= dt;
      if (game.bubbleTimer <= 0) {
        game.bubbleTimer = 0.14;
        game.bubbles.push({
          x: d.x + (Math.random() - 0.5) * 8,
          y: d.y - 10,
          r: 1.6 + Math.random() * 2.6,
          vy: -(38 + Math.random() * 30),
          life: 1.6
        });
      }

      // Win: 5 relics, back at the surface alive.
      if (game.relicsGot >= 5 && d.y <= 95) {
        game.score += Math.max(0, Math.round(600 - game.elapsed * 3));
        endRun(true);
        return;
      }
      // Lose: oxygen out, or the Warden catches you. Nothing else.
      if (game.oxygen <= 0) {
        endRun(false, 'Your oxygen ran out at ' + Math.floor(depthM) + ' m.');
        return;
      }
      if (TrenchWarden.wardenCaught(warden, d)) {
        endRun(false, 'The Warden took you at ' + Math.floor(depthM) + ' m.');
        return;
      }
    }

    function updateBubbles(dt) {
      for (var i = game.bubbles.length - 1; i >= 0; i--) {
        var b = game.bubbles[i];
        b.y += b.vy * dt;
        b.x += Math.sin(game.time * 2 + i) * 6 * dt;
        b.life -= dt;
        if (b.life <= 0 || b.y < 10) game.bubbles.splice(i, 1);
      }
    }

    function updateCamera(dt) {
      var d = game.diver;
      var tx = Math.max(0, Math.min(world.w - VIEW_W, d.x - VIEW_W / 2));
      var ty = Math.max(0, Math.min(world.h - VIEW_H, d.y - VIEW_H / 2));
      game.cam.x += (tx - game.cam.x) * Math.min(1, dt * 5);
      game.cam.y += (ty - game.cam.y) * Math.min(1, dt * 5);
    }

    function updateHud() {
      var oxyEl = $('hud-oxygen');
      oxyEl.style.width = Math.max(0, game.oxygen).toFixed(1) + '%';
      oxyEl.classList.toggle('low', game.oxygen < 25);
      $('hud-depth').textContent = Math.floor(game.diver.y / 10) + ' m';
      $('hud-relics').textContent = '◆ ' + game.relicsGot + ' / 5';
    }

    // Screenshot staging: ?shot=start|gameplay|lose|win
    function applyShotMode() {
      var params = new URLSearchParams(window.location.search);
      var shot = params.get('shot');
      if (!shot) return;
      if (shot === 'gameplay') {
        resetRun();
        game.state = 'playing';
        game.diver.x = 620;
        game.diver.y = 4200; // 420 m, midnight zone
        game.diver.aimAngle = 0.5;
        game.oxygen = 78;
        game.relicsGot = 2;
        game.score = 760;
        world.relics[0].taken = true;
        world.relics[1].taken = true;
        // Two more relics glinting in frame for the shot.
        world.relics[2].x = 880; world.relics[2].y = 4080;
        world.relics[3].x = 400; world.relics[3].y = 4400;
        game.pings.push({ x: 620, y: 4200, r: 190, alpha: 0.8 });
        warden.x = 1080;
        warden.y = 4350;
        warden.alert = 62;
        warden.mode = 'hunt';
        game.wardenReveal = 0.25;
        game.danger = 0.35;
        game.cam.x = 0;
        game.cam.y = 3840;
        showOnly(null);
      } else if (shot === 'lose') {
        resetRun();
        game.state = 'playing';
        game.diver.x = 560;
        game.diver.y = 5120; // 512 m
        game.diver.aimAngle = -0.1; // flashlight on the Warden, right of the card
        game.oxygen = 0;
        game.relicsGot = 3;
        game.score = 1240;
        game.elapsed = 161;
        game.maxDepthM = 512;
        world.relics[0].taken = true;
        world.relics[1].taken = true;
        world.relics[2].taken = true;
        warden.x = 950;
        warden.y = 5080;
        warden.alert = 90;
        game.wardenReveal = 1;
        game.danger = 0.9;
        game.cam.x = 0;
        game.cam.y = 4760;
        updateHud();
        endRun(false, 'The Warden took you at 512 m.');
      } else if (shot === 'win') {
        resetRun();
        game.state = 'playing';
        game.diver.x = 640;
        game.diver.y = 60; // back at the surface
        game.oxygen = 41;
        game.relicsGot = 5;
        game.score = 2480;
        game.elapsed = 214;
        game.maxDepthM = 695;
        world.relics.forEach(function (r, i) { if (i < 5) r.taken = true; });
        game.cam.x = 0;
        game.cam.y = 0;
        updateHud();
        endRun(true);
      }
      // shot=start (or anything else) stays on the menu.
    }

    function loop(ts) {
      requestAnimationFrame(loop);
      var now = ts / 1000;
      var dt = Math.min(0.05, now - (game.time || now));
      game.time = now;
      if (game.state === 'playing') {
        updatePlaying(dt);
        updateCamera(dt);
        updateHud();
      } else if (game.state === 'menu') {
        // The Warden lurks in the lower-right dark, lure glowing, behind the menu.
        warden.x = 1000;
        warden.y = 6180;
        warden.angle = Math.PI; // facing left, toward the diver
        updateCamera(dt);
      }
      updateBubbles(dt);
      TrenchRender.render(renderer, {
        world: world,
        diver: game.diver,
        warden: warden,
        wardenReveal: game.wardenReveal,
        pings: game.pings,
        bubbles: game.bubbles,
        cam: game.cam,
        danger: game.state === 'playing' ? game.danger : 0
      }, now);

      if (input.consumePause() && (game.state === 'playing' || game.state === 'paused')) {
        if (game.state === 'playing') {
          game.state = 'paused';
          showOnly('card-pause');
        } else {
          game.state = 'playing';
          showOnly(null);
        }
      }
      if (input.consumeMute()) {
        sound.setMuted(!sound.muted);
        $('btn-mute').textContent = sound.muted ? '✕' : '♪';
      }
    }

    function bindButtons() {
      $('btn-play').addEventListener('click', startGame);
      $('btn-again-win').addEventListener('click', startGame);
      $('btn-again-lose').addEventListener('click', startGame);
      $('btn-menu-win').addEventListener('click', showMenu);
      $('btn-menu-lose').addEventListener('click', showMenu);
      $('btn-menu-pause').addEventListener('click', showMenu);
      $('btn-resume').addEventListener('click', function () {
        game.state = 'playing';
        showOnly(null);
      });
      $('btn-mute').addEventListener('click', function () {
        sound.ensure();
        sound.setMuted(!sound.muted);
        $('btn-mute').textContent = sound.muted ? '✕' : '♪';
      });
    }

    bindButtons();
    showMenu();
    applyShotMode();
    requestAnimationFrame(loop);

    // For debugging and scripted screenshots.
    window.__trench = game;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createGame);
  } else {
    createGame();
  }
})();
