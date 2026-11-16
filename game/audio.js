// TRENCHLIGHT sound — every sound is synthesized with WebAudio. No audio files.
(function (global) {
  'use strict';

  function SoundEngine() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientNodes = null;
    this.wardenDrone = null;
  }

  SoundEngine.prototype.ensure = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    return true;
  };

  SoundEngine.prototype.setMuted = function (muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.55;
  };

  SoundEngine.prototype.tone = function (opts) {
    if (!this.ensure()) return;
    var t0 = this.ctx.currentTime + (opts.delay || 0);
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.from, t0);
    if (opts.to !== undefined && opts.to !== opts.from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.vol || 0.25, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  };

  SoundEngine.prototype.noiseBurst = function (opts) {
    if (!this.ensure()) return;
    var t0 = this.ctx.currentTime + (opts.delay || 0);
    var len = Math.floor(this.ctx.sampleRate * opts.dur);
    var buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource();
    src.buffer = buffer;
    var filter = this.ctx.createBiquadFilter();
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.value = opts.freq || 1200;
    filter.Q.value = opts.q || 1.2;
    var gain = this.ctx.createGain();
    gain.gain.setValueAtTime(opts.vol || 0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  };

  // Sonar ping: a deep, soft blip that falls away into the dark.
  SoundEngine.prototype.ping = function () {
    this.tone({ type: 'sine', from: 620, to: 230, dur: 0.8, vol: 0.2 });
    this.tone({ type: 'sine', from: 310, to: 150, dur: 0.9, vol: 0.1 });
  };

  // Relic pickup: one short bright ting.
  SoundEngine.prototype.pickup = function () {
    this.tone({ type: 'sine', from: 1568, dur: 0.16, vol: 0.22 });
    this.tone({ type: 'sine', from: 2093, dur: 0.1, vol: 0.1, delay: 0.03 });
  };

  SoundEngine.prototype.tank = function () {
    this.tone({ type: 'sine', from: 330, to: 660, dur: 0.3, vol: 0.25 });
    this.noiseBurst({ dur: 0.25, freq: 900, vol: 0.12 });
  };

  // Oxygen critical: one slow, quiet heartbeat tick.
  SoundEngine.prototype.heartbeat = function () {
    this.tone({ type: 'sine', from: 58, to: 36, dur: 0.14, vol: 0.3 });
    this.tone({ type: 'sine', from: 52, to: 32, dur: 0.16, vol: 0.24, delay: 0.2 });
  };

  // Warden near: a low uneasy drone that holds while it hunts.
  SoundEngine.prototype.startWardenDrone = function () {
    if (!this.ensure() || this.wardenDrone) return;
    var osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    var osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 55.6;
    var filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    var gain = this.ctx.createGain();
    gain.gain.value = 0.0;
    gain.gain.linearRampToValueAtTime(0.055, this.ctx.currentTime + 1.2);
    var lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.5;
    var lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc2.start();
    lfo.start();
    this.wardenDrone = { osc: osc, osc2: osc2, lfo: lfo, gain: gain };
  };

  SoundEngine.prototype.stopWardenDrone = function () {
    if (!this.wardenDrone) return;
    var d = this.wardenDrone;
    this.wardenDrone = null;
    var t = this.ctx.currentTime;
    d.gain.gain.cancelScheduledValues(t);
    d.gain.gain.setValueAtTime(d.gain.gain.value, t);
    d.gain.gain.linearRampToValueAtTime(0.0001, t + 0.8);
    setTimeout(function () {
      try { d.osc.stop(); d.osc2.stop(); d.lfo.stop(); } catch (e) { /* already stopped */ }
    }, 900);
  };

  SoundEngine.prototype.click = function () {
    this.tone({ type: 'square', from: 900, to: 700, dur: 0.06, vol: 0.12 });
  };

  // Win: three short rising notes, quick and light.
  SoundEngine.prototype.win = function () {
    var notes = [523, 659, 784];
    for (var i = 0; i < notes.length; i++) {
      this.tone({ type: 'triangle', from: notes[i], dur: 0.3, vol: 0.22, delay: i * 0.11 });
    }
  };

  // Lose: three short falling notes.
  SoundEngine.prototype.lose = function () {
    var notes = [330, 262, 196];
    for (var i = 0; i < notes.length; i++) {
      this.tone({ type: 'sine', from: notes[i], dur: 0.34, vol: 0.22, delay: i * 0.13 });
    }
  };

  // Ambient: a very quiet low drone plus slow bubbles, looped.
  SoundEngine.prototype.startAmbient = function () {
    if (!this.ensure() || this.ambientNodes) return;
    var drone = this.ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 48;
    var drone2 = this.ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 48.7;
    var gain = this.ctx.createGain();
    gain.gain.value = 0.03;
    var lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    var lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    drone.connect(gain);
    drone2.connect(gain);
    gain.connect(this.master);
    drone.start();
    drone2.start();
    lfo.start();
    this.ambientNodes = { drone: drone, drone2: drone2, lfo: lfo, gain: gain };
    var self = this;
    var bubble = function () {
      if (!self.ambientNodes) return;
      self.tone({ type: 'sine', from: 300 + Math.random() * 500, to: 900 + Math.random() * 600, dur: 0.25, vol: 0.018 });
      setTimeout(bubble, 900 + Math.random() * 2400);
    };
    setTimeout(bubble, 600);
  };

  SoundEngine.prototype.stopAmbient = function () {
    if (!this.ambientNodes) return;
    try {
      this.ambientNodes.drone.stop();
      this.ambientNodes.drone2.stop();
      this.ambientNodes.lfo.stop();
    } catch (e) { /* already stopped */ }
    this.ambientNodes = null;
  };

  global.TrenchSound = SoundEngine;
})(typeof window !== 'undefined' ? window : this);
