// TRENCHLIGHT viewport fit — scales the fixed 1280x720 stage to any screen.
// On a phone held in landscape the viewport is far smaller than 1280x720,
// so without this the start screen, the DIVE IN button and the touch
// controls are cut off and unreachable. The stage is scaled down (never
// up, so desktop stays crisp 1:1) and centered in the viewport.
(function () {
  'use strict';

  var STAGE_W = 1280;
  var STAGE_H = 720;

  function fitStage() {
    var stage = document.getElementById('stage');
    if (!stage) return;
    var s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    if (s > 1) s = 1;
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
    window.__trenchScale = s;
  }

  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', fitStage);
  fitStage();
})();
