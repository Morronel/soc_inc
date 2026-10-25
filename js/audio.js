// SOC Inc. — NIGHTSHIFT.FM procedural synthwave radio + sound effects (Web Audio API, no audio files)
window.SI = window.SI || {};

(function () {
  'use strict';

  var SCALES = {
    minor:    [0, 2, 3, 5, 7, 8, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    dorian:   [0, 2, 3, 5, 7, 9, 10],
    lydian:   [0, 2, 4, 6, 7, 9, 11],
    mixolyd:  [0, 2, 4, 5, 7, 9, 10]
  };

  // 8 tracks x ~150 s = ~20 minutes of music, then the station loops. Calmer modes than an attacker's playlist:
  // night-shift synthwave that tightens up as the incident severity climbs.
  var TRACKS = [
    { name: 'Coffee at 3 AM',          bpm: 84,  root: 45, scale: 'dorian',   prog: [0, 3, 5, 4], seed: 101 },
    { name: 'False Positive Waltz',    bpm: 96,  root: 43, scale: 'mixolyd',  prog: [0, 6, 3, 4], seed: 113 },
    { name: 'Tier 1 Triage',           bpm: 104, root: 40, scale: 'minor',    prog: [0, 5, 6, 4], seed: 127 },
    { name: 'Honeytoken Heartbeat',    bpm: 90,  root: 38, scale: 'dorian',   prog: [0, 6, 5, 3], seed: 139 },
    { name: 'Purple Team Sunrise',     bpm: 110, root: 47, scale: 'lydian',   prog: [0, 4, 5, 1], seed: 151 },
    { name: 'Golden Ticket Revoked',   bpm: 118, root: 42, scale: 'harmonic', prog: [0, 3, 4, 5], seed: 163 },
    { name: 'Patch Tuesday Groove',    bpm: 100, root: 36, scale: 'mixolyd',  prog: [0, 3, 6, 4], seed: 179 },
    { name: 'Log Retention Lullaby',   bpm: 80,  root: 44, scale: 'minor',    prog: [0, 5, 3, 6], seed: 191 }
  ];
  var TRACK_SECONDS = 150;

  var BASS_PATTERNS = [
    // [step, octaveOffset]
    [[0, 0], [2, 0], [3, 0], [4, 0], [6, 12], [7, 0], [8, 0], [10, 0], [11, 0], [12, 0], [14, 12], [15, 0]],
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0]],
    [[0, 0], [3, 0], [6, 0], [8, 12], [10, 0], [12, 0], [14, 7]],
    [[0, 0], [4, 0], [7, 12], [8, 0], [11, 0], [12, 0], [14, 12]]
  ];
  var ARP_PATTERNS = [
    [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3],
    [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3],
    [0, -1, 1, -1, 2, -1, 3, -1, 0, -1, 1, -1, 2, -1, 3, 2],
    [3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0, 1, 2, 3, 2]
  ];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  var A = {
    ctx: null, ready: false, sfxOn: true, volume: 0.7,
    playing: false, trackIndex: 0, trackElapsed: 0,
    intensity: 0.15, targetIntensity: 0.15,
    listeners: []
  };

  A.onChange = function (fn) { A.listeners.push(fn); };
  function changed() { A.listeners.forEach(function (f) { f(); }); }

  A.tracks = TRACKS;
  A.trackSeconds = TRACK_SECONDS;

  // ------------------------------------------------------------ init / graph
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended' && !A.hidden) A.ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    var ctx;
    // 'playback' asks for bigger audio buffers: a bit more latency, far fewer dropouts on phones
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
    buildGraph(ctx);
    return true;
  };

  var MUSIC_GAIN = 0.55;

  function buildGraph(ctx) {
    A.ctx = ctx;
    // gain staging: voices -> music/sfx buses -> master -> compressor -> soft clipper -> out
    A.master = ctx.createGain(); A.master.gain.value = 0.8;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
    var clip = ctx.createWaveShaper(), curve = new Float32Array(2048);
    for (var ci = 0; ci < curve.length; ci++) {
      var x = ci / (curve.length - 1) * 2 - 1, ax = Math.abs(x);
      curve[ci] = ax < 0.7 ? x : Math.sign(x) * (0.7 + 0.3 * Math.tanh((ax - 0.7) / 0.3));
    }
    clip.curve = curve; clip.oversample = 'none';
    A.analyser = ctx.createAnalyser(); A.analyser.fftSize = 128;
    A.master.connect(comp); comp.connect(clip); clip.connect(A.analyser); A.analyser.connect(ctx.destination);

    A.music = ctx.createGain(); A.music.gain.value = A.volume * MUSIC_GAIN;
    A.musicTone = ctx.createBiquadFilter(); A.musicTone.type = 'lowpass'; A.musicTone.frequency.value = 9000;
    A.music.connect(A.musicTone); A.musicTone.connect(A.master);
    A.sfx = ctx.createGain(); A.sfx.gain.value = 0.55; A.sfx.connect(A.master);

    // reverb: a small feedback-delay network. Much cheaper than a convolver, which matters on phones
    A.revSend = ctx.createGain(); A.revSend.gain.value = 0.3;
    A.reverb = ctx.createGain(); A.reverb.gain.value = 0.5;
    [0.0297, 0.0371, 0.0411, 0.0437].forEach(function (dt, i) {
      var dl = ctx.createDelay(0.2), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
      dl.delayTime.value = dt * 2.3; fb.gain.value = 0.78 - i * 0.02;
      lp.type = 'lowpass'; lp.frequency.value = 3200 - i * 300;
      A.revSend.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
      var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.value = i % 2 ? 0.6 : -0.6; lp.connect(pan); pan.connect(A.reverb); } else lp.connect(A.reverb);
    });
    A.reverb.connect(A.music);

    // tempo-synced delay (set per track)
    A.delay = ctx.createDelay(1.5); A.delayFb = ctx.createGain(); A.delayFb.gain.value = 0.38;
    var dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    A.delaySend = ctx.createGain(); A.delaySend.gain.value = 0.32;
    A.delaySend.connect(A.delay); A.delay.connect(dlp); dlp.connect(A.delayFb); A.delayFb.connect(A.delay); dlp.connect(A.music);

    // shared noise buffer
    var nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
    for (var k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
    A.noiseBuf = nb;

    A.ready = true;
  }

  A.unlock = function () {
    if (!A.ctx) A.init();
    else if (A.ctx.state === 'suspended' && !A.hidden) A.ctx.resume();
  };

  A.setVolume = function (v) {
    A.volume = v;
    if (A.music && A.playing) A.music.gain.setTargetAtTime(v * MUSIC_GAIN, A.ctx.currentTime, 0.05);
  };
  A.setIntensity = function (x) { A.targetIntensity = Math.max(0, Math.min(1, x)); };

  // ------------------------------------------------------------ instruments
  function env(g, t, a, peak, dec, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    if (end) g.gain.setValueAtTime(0, t + a + dec + 0.01);
  }
  function noise(t, dur) {
    var s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf;
    s.start(t, Math.random() * 0.5); s.stop(t + dur);
    return s;
  }

  function kick(t, vel) {
    var c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    env(g, t, 0.003, 0.95 * vel, 0.42);
    o.connect(g); g.connect(A.music); o.start(t); o.stop(t + 0.5);
  }
  function snare(t, vel) {
    var c = A.ctx, n = noise(t, 0.25), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
    env(g, t, 0.002, 0.42 * vel, 0.2);
    n.connect(bp); bp.connect(g); g.connect(A.music); g.connect(A.revSend);
    var o = c.createOscillator(), og = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    env(og, t, 0.002, 0.3 * vel, 0.1);
    o.connect(og); og.connect(A.music); o.start(t); o.stop(t + 0.15);
  }
  function hat(t, open, vel) {
    var c = A.ctx, n = noise(t, open ? 0.3 : 0.06), hp = c.createBiquadFilter(), g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 7500;
    env(g, t, 0.001, (open ? 0.12 : 0.09) * vel, open ? 0.25 : 0.045);
    n.connect(hp); hp.connect(g); g.connect(A.music);
  }
  function tick(t) { // rim/perc for high intensity
    var c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = 1800 + Math.random() * 400;
    env(g, t, 0.001, 0.035, 0.03);
    o.connect(g); g.connect(A.music); g.connect(A.delaySend); o.start(t); o.stop(t + 0.06);
  }
  function bass(t, midi, dur, bright) {
    var c = A.ctx, o1 = c.createOscillator(), sub = c.createOscillator();
    var f = c.createBiquadFilter(), g = c.createGain(), sg = c.createGain();
    o1.type = 'sawtooth'; sub.type = 'sine';
    var fr = mtof(midi);
    o1.frequency.value = fr; sub.frequency.value = fr / 2;
    f.type = 'lowpass'; f.Q.value = 7;
    var base = 160 + bright * 900;
    f.frequency.setValueAtTime(base * 4, t); f.frequency.exponentialRampToValueAtTime(base, t + Math.min(dur, 0.18));
    env(g, t, 0.004, 0.26, dur * 0.95);
    env(sg, t, 0.004, 0.22, dur * 0.95);
    o1.connect(f); f.connect(g); g.connect(A.music);
    sub.connect(sg); sg.connect(A.music);
    [o1, sub].forEach(function (o) { o.start(t); o.stop(t + dur + 0.05); });
  }
  function arp(t, midi, dur, bright) {
    var c = A.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'square'; o.frequency.value = mtof(midi);
    f.type = 'lowpass'; f.frequency.value = 900 + bright * 3200; f.Q.value = 3;
    env(g, t, 0.003, 0.05, dur * 1.1);
    o.connect(f); f.connect(g); g.connect(A.music); g.connect(A.delaySend);
    o.start(t); o.stop(t + dur * 1.2 + 0.05);
  }
  function pad(t, notes, dur) {
    var c = A.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1300, t + dur * 0.6); f.Q.value = 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.065, t + Math.min(0.8, dur * 0.3));
    g.gain.setValueAtTime(0.065, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    f.connect(g); g.connect(A.music); g.connect(A.revSend);
    notes.forEach(function (m) {
      [-9, 9].forEach(function (det) {
        var o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.7);
      });
    });
  }
  function lead(t, midi, dur) {
    var c = A.ctx, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = mtof(midi);
    lfo.frequency.value = 5.5; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.detune);
    f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.04);
    g.gain.setValueAtTime(0.07, t + dur * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15);
    o.connect(f); f.connect(g); g.connect(A.music); g.connect(A.delaySend); g.connect(A.revSend);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2);
  }
  function riser(t, dur) {
    var c = A.ctx, n = A.ctx.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = A.noiseBuf; n.loop = true;
    f.type = 'bandpass'; f.Q.value = 4; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    n.connect(f); f.connect(g); g.connect(A.music); g.connect(A.revSend);
    n.start(t); n.stop(t + dur + 0.1);
  }

  // ------------------------------------------------------------ arrangement
  function buildTrack(def) {
    var rnd = mulberry32(def.seed);
    var bar = 240 / def.bpm;
    var bars = Math.round(TRACK_SECONDS / bar);
    var scale = SCALES[def.scale];
    var sectionsTpl = [
      ['intro', 'build', 'drop', 'drop', 'break', 'build', 'drop', 'drop', 'outro'],
      ['intro', 'drop', 'drop', 'break', 'build', 'drop', 'drop', 'break', 'outro'],
      ['intro', 'build', 'build', 'drop', 'break', 'drop', 'drop', 'drop', 'outro']
    ][Math.floor(rnd() * 3)];
    var melody = [];
    var deg = 4 + Math.floor(rnd() * 3);
    for (var i = 0; i < 8; i++) {
      deg += Math.floor(rnd() * 5) - 2;
      deg = Math.max(0, Math.min(9, deg));
      melody.push({ deg: deg, len: rnd() < 0.3 ? 4 : 2, rest: rnd() < 0.2 });
    }
    return {
      def: def, bar: bar, bars: bars, scale: scale,
      sixteenth: bar / 16,
      sections: sectionsTpl,
      fourFloor: def.bpm >= 100 || rnd() < 0.3,
      bassPat: BASS_PATTERNS[Math.floor(rnd() * BASS_PATTERNS.length)],
      arpPat: ARP_PATTERNS[Math.floor(rnd() * ARP_PATTERNS.length)],
      arpOct: rnd() < 0.5 ? 24 : 36,
      melody: melody,
      leadInDrop: rnd() < 0.6
    };
  }

  function noteOf(tr, degree, octave) {
    var s = tr.scale, n = s.length;
    var o = Math.floor(degree / n), d = ((degree % n) + n) % n;
    return tr.def.root + s[d] + 12 * (o + (octave || 0));
  }
  function chordOf(tr, barIndex) {
    var d = tr.def.prog[Math.floor(barIndex / 2) % tr.def.prog.length];
    return [noteOf(tr, d), noteOf(tr, d + 2), noteOf(tr, d + 4), noteOf(tr, d + 7)];
  }

  function sectionAt(tr, barIndex) {
    var per = Math.max(4, Math.floor(tr.bars / tr.sections.length));
    var idx = Math.min(tr.sections.length - 1, Math.floor(barIndex / per));
    if (barIndex >= tr.bars - 4) return { name: 'outro', pos: barIndex - (tr.bars - 4), len: 4 };
    return { name: tr.sections[idx], pos: barIndex - idx * per, len: per };
  }

  // schedule one 16th step
  function step(tr, barIndex, s, t) {
    var sec = sectionAt(tr, barIndex), name = sec.name;
    var I = A.intensity;
    var drums = name === 'drop' || (name === 'build' && sec.pos >= sec.len / 2) || (I > 0.75 && name !== 'intro' && name !== 'outro');
    var sixteenth = tr.sixteenth;
    var chord = chordOf(tr, barIndex);

    // pad at the start of each 2-bar chord
    if (s === 0 && barIndex % 2 === 0 && !(name === 'drop' && I >= 0.9)) {
      pad(t, [chord[0] + 12, chord[1] + 12, chord[2] + 12], tr.bar * 2);
    }
    // drums
    if (drums) {
      var kickOn = tr.fourFloor ? s % 4 === 0 : (s === 0 || s === 10 || (I > 0.5 && s === 7));
      if (kickOn) kick(t, 1);
      var snOn = tr.fourFloor ? (s === 4 || s === 12) : s === 8;
      if (snOn) snare(t, 1);
    }
    if (name !== 'intro' || sec.pos >= 2) {
      if (s % 4 === 2) hat(t, s === 14 && name === 'drop', 1);
      else if (I > 0.45 && s % 2 === 1 && name !== 'outro') hat(t, false, 0.55);
    }
    if (I > 0.66 && (s === 3 || s === 11) && name !== 'intro') tick(t);
    // bass
    if (name !== 'intro' && name !== 'break' && !(name === 'outro' && sec.pos > 1)) {
      tr.bassPat.forEach(function (bp) {
        if (bp[0] === s) bass(t, chord[0] - 12 + bp[1], sixteenth * 0.9, 0.2 + I * 0.8);
      });
    }
    // arp
    var arpIdx = tr.arpPat[s];
    if (arpIdx >= 0 && (name !== 'outro' || s % 2 === 0)) {
      var bright = name === 'break' ? 0.2 : name === 'drop' ? 0.65 + I * 0.35 : 0.35 + I * 0.3;
      arp(t, chord[arpIdx] + tr.arpOct - 12, sixteenth, bright);
    }
    // lead melody (2-bar phrase over 8 notes)
    if ((name === 'break' || (name === 'drop' && tr.leadInDrop && sec.pos % 4 >= 2)) && s % 4 === 0) {
      var phrasePos = ((barIndex % 2) * 4 + s / 4) | 0;
      var m = tr.melody[phrasePos];
      if (!m.rest) lead(t, noteOf(tr, m.deg, 2), sixteenth * m.len * 1.8);
    }
    // riser into a drop
    var nextSec = sectionAt(tr, barIndex + 2);
    if (s === 0 && name !== 'drop' && nextSec.name === 'drop' && sectionAt(tr, barIndex + 1).name !== 'drop' && sec.pos === sec.len - 2) {
      riser(t, tr.bar * 2);
    }
  }

  // ------------------------------------------------------------ scheduler
  // Lookahead scheduler: a timer wakes every TICK ms and queues every note due in the next AHEAD seconds.
  // A generous window rides out main-thread hiccups (canvas frames, GC) without late or clipped notes.
  var TICK = 40, AHEAD = 0.3;
  var timer = null, track = null, nextTime = 0, barIdx = 0, stepIdx = 0;

  function loadTrack(i, continuous) {
    A.trackIndex = (i + TRACKS.length) % TRACKS.length;
    track = buildTrack(TRACKS[A.trackIndex]);
    barIdx = 0; stepIdx = 0;
    if (A.ctx) {
      var now = A.ctx.currentTime, at = continuous ? Math.max(now, nextTime) : now;
      // glide the echo to the new tempo instead of jumping (a jump makes the delay tail crackle)
      A.delay.delayTime.cancelScheduledValues(at);
      A.delay.delayTime.setValueAtTime(A.delay.delayTime.value, at);
      A.delay.delayTime.linearRampToValueAtTime(track.sixteenth * 3, at + 0.6);
      if (!continuous) nextTime = now + 0.1;
    }
    A.trackElapsed = 0;
    changed();
  }

  function advance() {
    nextTime += track.sixteenth;
    stepIdx++;
    if (stepIdx === 16) {
      stepIdx = 0; barIdx++;
      if (barIdx >= track.bars) loadTrack(A.trackIndex + 1, true);
    }
  }

  function schedule() {
    var c = A.ctx, now = c.currentTime;
    A.intensity += (A.targetIntensity - A.intensity) * 0.03;
    if (A.musicTone) A.musicTone.frequency.setTargetAtTime(3500 + A.intensity * 9000, now, 0.5);
    if (nextTime < now - 1) nextTime = now + 0.05;          // woke up after a long stall: resync
    while (nextTime < now + AHEAD) {
      // never start a note in the past: a late note gets cut mid-attack and clicks, so drop it instead
      if (nextTime >= now + 0.005) step(track, barIdx, stepIdx, nextTime);
      advance();
    }
    A.trackElapsed = (barIdx * 16 + stepIdx) * track.sixteenth;
  }

  A.play = function () {
    if (!A.init()) return;
    if (A.playing) return;
    if (!track) loadTrack(A.trackIndex);
    nextTime = A.ctx.currentTime + 0.1;
    A.music.gain.cancelScheduledValues(A.ctx.currentTime);
    A.music.gain.setTargetAtTime(A.volume * MUSIC_GAIN, A.ctx.currentTime, 0.1);
    timer = setInterval(schedule, TICK);
    A.playing = true;
    changed();
  };
  A.stop = function () {
    if (!A.playing) return;
    clearInterval(timer); timer = null;
    A.music.gain.setTargetAtTime(0, A.ctx.currentTime, 0.08);
    A.playing = false;
    changed();
  };
  // Background tabs throttle timers, which would starve the scheduler: suspend audio instead.
  A.hidden = false;
  A.setHidden = function (h) {
    A.hidden = h;
    if (!A.ctx) return;
    if (h) A.ctx.suspend(); else A.ctx.resume();
  };

  // Dev helper: render `seconds` of a track offline (no speakers needed) to check levels and clicks.
  A.renderOffline = function (trackIndex, seconds, intensity, startBar) {
    var saved = { ctx: A.ctx, master: A.master, analyser: A.analyser, music: A.music, musicTone: A.musicTone, sfx: A.sfx, reverb: A.reverb,
      revSend: A.revSend, delay: A.delay, delayFb: A.delayFb, delaySend: A.delaySend, noiseBuf: A.noiseBuf, intensity: A.intensity, ready: A.ready };
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var off = new OAC(2, Math.ceil(44100 * seconds), 44100);
    buildGraph(off);
    A.intensity = intensity || 0;
    var tr = buildTrack(TRACKS[trackIndex]);
    A.delay.delayTime.value = tr.sixteenth * 3;
    var t = 0.05, bar = startBar || 0, st = 0;
    while (t < seconds - 0.5) {
      step(tr, bar % tr.bars, st, t);
      t += tr.sixteenth; st++;
      if (st === 16) { st = 0; bar++; }
    }
    Object.keys(saved).forEach(function (k) { A[k] = saved[k]; });
    return off.startRendering();
  };

  A.toggle = function () { if (A.playing) A.stop(); else A.play(); };
  A.next = function () { var p = A.playing; if (p) A.stop(); loadTrack(A.trackIndex + 1); if (p) A.play(); };
  A.prev = function () { var p = A.playing; if (p) A.stop(); loadTrack(A.trackIndex - 1); if (p) A.play(); };
  A.select = function (i) { var p = A.playing; if (p) A.stop(); loadTrack(i); A.play(); };

  // ------------------------------------------------------------ sound effects
  var lastSfx = {};
  function sfxOk(name, gap) {
    if (!A.ready || !A.sfxOn) return false;
    var now = A.ctx.currentTime;
    if (lastSfx[name] && now - lastSfx[name] < (gap || 0)) return false;
    lastSfx[name] = now;
    return true;
  }
  function blip(type, f1, f2, dur, vol, t0) {
    var c = A.ctx, t = (t0 || c.currentTime), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, 0.004, vol, dur);
    o.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + dur + 0.05);
  }

  A.sfxPlay = function (name) {
    if (!sfxOk(name, name === 'block' ? 0.35 : name === 'detect' ? 0.15 : name === 'restore' ? 0.2 : 0.03)) return;
    var c = A.ctx, t = c.currentTime;
    switch (name) {
      case 'click': blip('square', 1400, 900, 0.04, 0.08); break;
      case 'triage': blip('sine', 660, 1320, 0.1, 0.28); blip('triangle', 1320, 1980, 0.12, 0.16, t + 0.08); break;
      case 'fp': blip('sine', 900, 600, 0.1, 0.16); break;
      case 'ioc': [0, 5, 12].forEach(function (s2, i) { blip('sine', mtof(76 + s2), null, 0.12, 0.14, t + i * 0.05); }); break;
      case 'buy': [0, 4, 7, 12].forEach(function (s2, i) { blip('square', mtof(64 + s2), null, 0.09, 0.11, t + i * 0.06); }); break;
      case 'detect': blip('sine', 1760, 1760, 0.07, 0.16); blip('sine', 1760, 1760, 0.07, 0.12, t + 0.12); break;
      case 'isolate': blip('sawtooth', 220, 880, 0.14, 0.09); noiseHit(t, 0.14, 4000, 0.08); break;
      case 'block': blip('triangle', 2400, 2000, 0.03, 0.04); break;
      case 'impact': blip('sawtooth', 300, 80, 0.3, 0.12); break;
      case 'restore': blip('triangle', 880, 1320, 0.08, 0.07); break;
      case 'news': blip('square', 2200, null, 0.02, 0.05); blip('square', 1800, null, 0.02, 0.05, t + 0.05); break;
      case 'ttp': [0, 1, 0, -1].forEach(function (s2, i) { blip('sawtooth', mtof(50 + s2), null, 0.16, 0.07, t + i * 0.09); }); break;
      case 'alert':
        for (var i = 0; i < 4; i++) blip('sawtooth', i % 2 ? 660 : 880, null, 0.2, 0.11, t + i * 0.22);
        break;
      case 'segment': blip('square', 140, 70, 0.3, 0.2); noiseHit(t, 0.2, 1200, 0.18); break;
      case 'plan': [0, 4, 7, 11, 14].forEach(function (s2, i) { blip('sine', mtof(67 + s2), null, 0.35, 0.09, t + i * 0.07); }); break;
      case 'eradicate':
        [0, 7, 12, 19, 24].forEach(function (s2, i) { blip('sawtooth', mtof(55 + s2), null, 0.9, 0.06, t + i * 0.06); });
        noiseHit(t, 1.2, 6000, 0.25, true);
        break;
      case 'breach':
        var o = c.createOscillator(), g = c.createGain(), ws = c.createWaveShaper();
        var curve = new Float32Array(256);
        for (var k = 0; k < 256; k++) { var x = k / 128 - 1; curve[k] = Math.tanh(x * 4); }
        ws.curve = curve;
        o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
        env(g, t, 0.01, 0.8, 1.6);
        o.connect(ws); ws.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + 1.8);
        noiseHit(t, 1.2, 2500, 0.4, true);
        break;
      case 'win': [0, 4, 7, 12, 16].forEach(function (s2, i) { blip('triangle', mtof(60 + s2), null, 1.2, 0.09, t + i * 0.1); }); break;
      case 'lose': blip('sawtooth', 440, 55, 1.4, 0.15); blip('square', 330, 41, 1.4, 0.06); break;
    }
  };
  function noiseHit(t, dur, freq, vol, sweep) {
    var c = A.ctx, n = noise(t, dur + 0.05), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(80, t + dur);
    env(g, t, 0.005, vol, dur);
    n.connect(f); f.connect(g); g.connect(A.sfx);
  }

  SI.Audio = A;
})();
