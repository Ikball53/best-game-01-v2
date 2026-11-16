// TRENCHLIGHT input — keyboard, mouse, and touch (joystick + ping button).
(function (global) {
  'use strict';

  function createInput(canvas) {
    var input = {
      keys: {},
      mouseX: 640, mouseY: 360, // screen coords, for the flashlight aim
      mouseDown: false,
      pingQueued: false,
      dashQueued: false,
      pauseQueued: false,
      muteQueued: false,
      joyActive: false,
      joyX: 0, joyY: 0, // -1..1 joystick vector
      usingTouch: false
    };

    var KEYMAP = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right'
    };

    function onKeyDown(e) {
      if (e.code === 'Space') {
        input.pingQueued = true;
        e.preventDefault();
        return;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        input.dashQueued = true;
        return;
      }
      if (e.code === 'KeyP') { input.pauseQueued = true; return; }
      if (e.code === 'KeyM') { input.muteQueued = true; return; }
      if (e.code === 'Enter') { input.pingQueued = true; return; }
      var dir = KEYMAP[e.code];
      if (dir) {
        input.keys[dir] = true;
        if (e.code.indexOf('Arrow') === 0) e.preventDefault();
      }
    }

    function onKeyUp(e) {
      var dir = KEYMAP[e.code];
      if (dir) input.keys[dir] = false;
    }

    function onMouseMove(e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      input.mouseX = (e.clientX - rect.left) * scaleX;
      input.mouseY = (e.clientY - rect.top) * scaleY;
    }

    function onMouseDown(e) {
      if (e.button === 0) input.mouseDown = true;
    }

    function onMouseUp(e) {
      if (e.button === 0) input.mouseDown = false;
    }

    // --- Touch: virtual joystick (bottom-left) + ping button (bottom-right). ---
    var stick = document.getElementById('stick');
    var knob = document.getElementById('stick-knob');
    var pingBtn = document.getElementById('btn-ping');
    var stickId = null;
    var stickCenter = { x: 0, y: 0 };
    var stickScale = 1; // rendered stick width / layout width (stage CSS scale)

    function markTouch() {
      if (!input.usingTouch) {
        input.usingTouch = true;
        document.body.classList.add('touch');
      }
    }

    function stickStart(e) {
      markTouch();
      var t = e.changedTouches[0];
      stickId = t.identifier;
      var rect = stick.getBoundingClientRect();
      stickCenter.x = rect.left + rect.width / 2;
      stickCenter.y = rect.top + rect.height / 2;
      // The stick is inside the scaled #stage, so its on-screen size is
      // layout size x stage scale; touch deltas arrive in screen pixels
      // and must be divided by the same scale to stay in game pixels.
      stickScale = rect.width / 112 || 1;
      stickMove(e);
      e.preventDefault();
    }

    function stickMove(e) {
      if (stickId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier !== stickId) continue;
        var dx = (t.clientX - stickCenter.x) / (44 * stickScale);
        var dy = (t.clientY - stickCenter.y) / (44 * stickScale);
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1) { dx /= len; dy /= len; }
        input.joyX = dx;
        input.joyY = dy;
        input.joyActive = len > 0.18;
        knob.style.transform = 'translate(calc(-50% + ' + (dx * 30) + 'px), calc(-50% + ' + (dy * 30) + 'px))';
      }
      e.preventDefault();
    }

    function stickEnd(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === stickId) {
          stickId = null;
          input.joyX = 0; input.joyY = 0; input.joyActive = false;
          knob.style.transform = 'translate(-50%, -50%)';
        }
      }
    }

    function pingTouch(e) {
      markTouch();
      input.pingQueued = true;
      e.preventDefault();
    }

    global.addEventListener('keydown', onKeyDown);
    global.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    global.addEventListener('mouseup', onMouseUp);
    if (stick) {
      stick.addEventListener('touchstart', stickStart, { passive: false });
      stick.addEventListener('touchmove', stickMove, { passive: false });
      stick.addEventListener('touchend', stickEnd);
      stick.addEventListener('touchcancel', stickEnd);
    }
    if (pingBtn) {
      pingBtn.addEventListener('touchstart', pingTouch, { passive: false });
    }
    global.addEventListener('touchstart', markTouch, { passive: true });

    // Movement vector from keys or joystick, normalized.
    input.moveVector = function () {
      var x = 0, y = 0;
      if (input.keys.left) x -= 1;
      if (input.keys.right) x += 1;
      if (input.keys.up) y -= 1;
      if (input.keys.down) y += 1;
      if (input.joyActive) { x = input.joyX; y = input.joyY; }
      var len = Math.sqrt(x * x + y * y);
      if (len > 1) { x /= len; y /= len; }
      return { x: x, y: y, active: len > 0.05 };
    };

    input.consumePing = function () {
      var q = input.pingQueued;
      input.pingQueued = false;
      return q;
    };
    input.consumeDash = function () {
      var q = input.dashQueued;
      input.dashQueued = false;
      return q;
    };
    input.consumePause = function () {
      var q = input.pauseQueued;
      input.pauseQueued = false;
      return q;
    };
    input.consumeMute = function () {
      var q = input.muteQueued;
      input.muteQueued = false;
      return q;
    };

    return input;
  }

  global.TrenchInput = { createInput: createInput };
})(typeof window !== 'undefined' ? window : this);
