// TRENCHLIGHT world — the trench itself: zones, relics, pickups, glow.
// Seeded so a given seed always builds the same trench.
(function (global) {
  'use strict';

  var WORLD_W = 1280;
  var WORLD_H = 7200; // 720 metres deep, 10 px per metre
  var RELIC_TARGET = 5;
  var RELIC_COUNT = 8;

  var ZONES = [
    { name: 'SUNLIT WATER', top: 0, bottom: 150, topColor: '#0a4a6b', bottomColor: '#07304a', light: 0.55 },
    { name: 'TWILIGHT ZONE', top: 150, bottom: 350, topColor: '#07304a', bottomColor: '#041d33', light: 0.38 },
    { name: 'MIDNIGHT ZONE', top: 350, bottom: 550, topColor: '#041d33', bottomColor: '#020e1c', light: 0.22 },
    { name: 'THE ABYSS', top: 550, bottom: 720, topColor: '#020e1c', bottomColor: '#00050c', light: 0.1 }
  ];

  // Deterministic RNG (mulberry32) so replays and screenshots agree.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function zoneAt(depthM) {
    for (var i = 0; i < ZONES.length; i++) {
      if (depthM < ZONES[i].bottom || i === ZONES.length - 1) return ZONES[i];
    }
    return ZONES[0];
  }

  function makeRocks(rand) {
    var rocks = [];
    var y = 120;
    while (y < WORLD_H - 200) {
      var side = rand() < 0.5 ? 'left' : 'right';
      var w = 60 + rand() * 170;
      var h = 40 + rand() * 110;
      rocks.push({
        x: side === 'left' ? 0 : WORLD_W - w,
        y: y, w: w, h: h,
        jag: 0.4 + rand() * 0.6
      });
      y += 130 + rand() * 260;
    }
    return rocks;
  }

  function makeRelics(rand) {
    // 8 relics, spread by depth band: 1 shallow, 2 twilight, 2 midnight, 3 abyss.
    var bands = [60, 190, 260, 390, 470, 580, 640, 695];
    var names = ['Sunken Compass', 'Brass Astrolabe', 'Pearl Idol', 'Captain\u2019s Spyglass',
      'Tide Bell', 'Abyssal Crown', 'Leviathan Eye', 'Heart of the Trench'];
    var relics = [];
    for (var i = 0; i < RELIC_COUNT; i++) {
      var depthM = bands[i] + (rand() * 24 - 12);
      relics.push({
        id: i,
        name: names[i],
        x: 220 + rand() * (WORLD_W - 440),
        y: depthM * 10,
        depthM: Math.round(depthM),
        value: 100 + Math.round(depthM) * 2,
        taken: false,
        bob: rand() * Math.PI * 2
      });
    }
    return relics;
  }

  function makeTanks(rand) {
    var tanks = [];
    var depths = [180, 320, 470, 610];
    for (var i = 0; i < depths.length; i++) {
      tanks.push({
        x: 200 + rand() * (WORLD_W - 400),
        y: (depths[i] + rand() * 30 - 15) * 10,
        taken: false,
        bob: rand() * Math.PI * 2
      });
    }
    return tanks;
  }

  // Marine snow: pale flakes drifting down everywhere.
  function makeSnow(rand) {
    var flakes = [];
    for (var i = 0; i < 220; i++) {
      flakes.push({
        x: rand() * WORLD_W,
        y: rand() * WORLD_H,
        r: 0.8 + rand() * 2.2,
        fall: 6 + rand() * 14,
        sway: rand() * Math.PI * 2
      });
    }
    return flakes;
  }

  // Bioluminescent plankton: tiny motes that pulse cyan in the dark.
  function makePlankton(rand) {
    var motes = [];
    for (var i = 0; i < 110; i++) {
      var depthM = 80 + rand() * 620;
      motes.push({
        x: rand() * WORLD_W,
        y: depthM * 10,
        r: 1 + rand() * 1.8,
        phase: rand() * Math.PI * 2,
        speed: 0.4 + rand() * 1.1,
        hue: rand() < 0.7 ? 'cyan' : 'green'
      });
    }
    return motes;
  }

  function createWorld(seed) {
    var rand = mulberry32(seed || 20261116);
    return {
      w: WORLD_W,
      h: WORLD_H,
      relicTarget: RELIC_TARGET,
      relicCount: RELIC_COUNT,
      zones: ZONES,
      rocks: makeRocks(rand),
      relics: makeRelics(rand),
      tanks: makeTanks(rand),
      snow: makeSnow(rand),
      plankton: makePlankton(rand),
      // The Warden's lair: a dark den near the bottom it returns to.
      wardenDen: { x: WORLD_W / 2, y: 6100 }
    };
  }

  global.TrenchWorld = {
    createWorld: createWorld,
    zoneAt: zoneAt,
    WORLD_W: WORLD_W,
    WORLD_H: WORLD_H,
    RELIC_TARGET: RELIC_TARGET
  };
})(typeof window !== 'undefined' ? window : this);
