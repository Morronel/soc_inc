// SOC Inc. — network map renderer (canvas)
// Fog of war: hidden footholds are drawn exactly like clean hosts. You only see what the SOC has found.
window.SI = window.SI || {};

(function () {
  'use strict';

  var COL = {
    clean: '#0d1a2b', cleanLine: '#35577d', patched: '#2ee6ff', known: '#ff3b5c', enc: '#c0123f', wiped: '#ff7a1a',
    iso: '#1a2533', isoLine: '#5fd6ff', zone: 'rgba(14,30,52,0.55)', zoneLine: '#1d3a5c', label: '#8fb3d9',
    edge: 'rgba(70,120,180,0.28)', gate: 'rgba(46,230,255,0.18)', alert: '#ffb020', ioc: '#2ee6ff', good: '#3dffa8'
  };

  function MapView(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = null;
    this.zones = [];
    this.flash = [];           // expanding rings {x,y,color,t0,big}
    this.traces = [];          // lines between hosts {a,b,t0,color}
    this.floaters = [];        // "+2$" texts
    this.lastState = {};
    this.shakeUntil = 0;
    this.redFlash = 0;
    this.cyanFlash = 0;
    this.selected = null;
    this.selectedDept = null;
    this.resize();
  }

  MapView.prototype.setGame = function (g) {
    this.game = g; this.lastState = {}; this.flash = []; this.floaters = []; this.traces = [];
    g.hosts.forEach(function (h) { this.lastState[h.id] = this.visState(h); }, this);
    this.layout();
  };

  // What the defender can see of a host.
  MapView.prototype.visState = function (h) {
    if (h.s === 'inf') return h.known ? 'known' : 'clean';
    return h.s;
  };

  MapView.prototype.resize = function () {
    var r = this.cv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
  };

  MapView.prototype.layout = function () {
    var g = this.game;
    if (!g) return;
    var n = g.depts.length, W = this.w, H = this.h, pad = 8, gap = 8;
    var cols = SI.mapCols(n, W / H);
    var rows = Math.ceil(n / cols);
    var zw = (W - pad * 2 - gap * (cols - 1)) / cols, zh = (H - pad * 2 - gap * (rows - 1)) / rows;
    this.zones = g.depts.map(function (d, i) {
      var row = Math.floor(i / cols), col = i % cols;
      var inRow = row === rows - 1 ? n - row * cols : cols;
      var offset = (cols - inRow) * (zw + gap) / 2;
      return { d: d, x: pad + offset + col * (zw + gap), y: pad + row * (zh + gap), w: zw, h: zh };
    });
    this.r = Math.max(5, Math.min(11, Math.min(zw, zh) / 11));
    this.zones.forEach(function (z) {
      z.d.hosts.forEach(function (h) { h.x = z.x + h.rx * z.w; h.y = z.y + h.ry * z.h; });
      z.d.zone = z;
    });
  };

  // ---------------------------------------------------------------- input
  MapView.prototype.hit = function (px, py) {
    var g = this.game, best = null, bd = 30;
    g.bubbles.forEach(function (b) {
      var d = Math.hypot(b.host.x - px, b.host.y - 18 - py);
      if (d < bd) { bd = d; best = b; }
    });
    if (best) return { bubble: best };
    var host = null, hd = Math.max(16, this.r * 2.2);
    g.hosts.forEach(function (h) {
      var d = Math.hypot(h.x - px, h.y - py);
      if (d < hd) { hd = d; host = h; }
    });
    var dept = null;
    for (var i = 0; i < this.zones.length; i++) {
      var z = this.zones[i];
      if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) dept = z.d;
    }
    if (host) return { host: host, dept: host.dept };
    if (dept) return { dept: dept };
    return null;
  };

  MapView.prototype.floatText = function (x, y, text, color) {
    this.floaters.push({ x: x, y: y, text: text, color: color, t0: performance.now() });
  };
  MapView.prototype.ring = function (h, color, big) {
    if (h && h.x != null) this.flash.push({ x: h.x, y: h.y, color: color, t0: performance.now(), big: !!big });
  };
  MapView.prototype.trace = function (a, b, color) {
    if (a && b && a.x != null) this.traces.push({ a: a, b: b, color: color || COL.alert, t0: performance.now() });
  };
  MapView.prototype.shake = function () { this.shakeUntil = performance.now() + 500; };
  MapView.prototype.flashRed = function () { this.redFlash = performance.now(); };
  MapView.prototype.flashCyan = function () { this.cyanFlash = performance.now(); };

  // ---------------------------------------------------------------- drawing helpers
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }

  function shape(c, kind, x, y, r) {
    c.beginPath();
    if (kind === 'ws') { c.arc(x, y, r, 0, Math.PI * 2); }
    else if (kind === 'srv') { c.rect(x - r, y - r, r * 2, r * 2); }
    else if (kind === 'web') { c.moveTo(x, y - r * 1.35); c.lineTo(x + r * 1.35, y); c.lineTo(x, y + r * 1.35); c.lineTo(x - r * 1.35, y); c.closePath(); }
    else if (kind === 'iot') { c.moveTo(x, y - r * 1.25); c.lineTo(x + r * 1.15, y + r * 0.85); c.lineTo(x - r * 1.15, y + r * 0.85); c.closePath(); }
    else if (kind === 'dc') {
      for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i + Math.PI / 6; c.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35); }
      c.closePath();
    } else { // bkp: cylinder
      c.ellipse(x, y - r * 0.6, r, r * 0.45, 0, 0, Math.PI * 2);
      c.moveTo(x - r, y - r * 0.6); c.lineTo(x - r, y + r * 0.7); c.ellipse(x, y + r * 0.7, r, r * 0.45, 0, Math.PI, 0, true); c.lineTo(x + r, y - r * 0.6);
    }
  }

  // ---------------------------------------------------------------- frame
  MapView.prototype.draw = function (alpha) {
    var g = this.game, c = this.ctx, W = this.w, H = this.h, now = performance.now(), self = this;
    if (!g) return;
    c.save();
    if (now < this.shakeUntil) c.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    c.clearRect(-20, -20, W + 40, H + 40);

    // background grid
    c.strokeStyle = 'rgba(40,90,150,0.13)'; c.lineWidth = 1;
    c.beginPath();
    for (var gx = 0; gx < W; gx += 24) { c.moveTo(gx + 0.5, 0); c.lineTo(gx + 0.5, H); }
    for (var gy = 0; gy < H; gy += 24) { c.moveTo(0, gy + 0.5); c.lineTo(W, gy + 0.5); }
    c.stroke();

    // zones
    var pulse = 0.5 + 0.5 * Math.sin(now / 220);
    this.zones.forEach(function (z) {
      var d = z.d, known = 0, enc = 0, iso = 0;
      d.hosts.forEach(function (h) { if (h.s === 'inf' && h.known) known++; else if (h.s === 'enc') enc++; else if (h.s === 'iso') iso++; });
      roundRect(c, z.x, z.y, z.w, z.h, 10);
      c.fillStyle = enc ? 'rgba(80,8,30,' + (0.3 + 0.35 * enc / d.hosts.length) + ')' : known ? 'rgba(90,20,40,' + (0.22 + 0.3 * known / d.hosts.length) + ')' : COL.zone;
      c.fill();
      if (d.isolated) {
        c.save(); c.clip();
        c.strokeStyle = 'rgba(95,214,255,0.08)'; c.lineWidth = 6;
        c.beginPath();
        for (var k = -z.h; k < z.w; k += 16) { c.moveTo(z.x + k, z.y + z.h); c.lineTo(z.x + k + z.h, z.y); }
        c.stroke(); c.restore();
        roundRect(c, z.x, z.y, z.w, z.h, 10);
      }
      c.setLineDash(d.isolated ? [10, 5] : []);
      c.strokeStyle = d === self.selectedDept ? '#ffffff' : d.isolated ? 'rgba(95,214,255,' + (0.55 + 0.45 * pulse) + ')' : COL.zoneLine;
      c.lineWidth = d.isolated || d === self.selectedDept ? 2 : 1;
      c.stroke();
      c.setLineDash([]);

      // hunt: a scan beam sweeps the zone
      if (d.hunt) {
        var span = d.hunt.auto ? 8 : 12;
        var k2 = ((g.t - d.hunt.t0 + alpha) / span * 3) % 1;
        var sy = z.y + 4 + k2 * (z.h - 8);
        var grd = c.createLinearGradient(0, sy - 18, 0, sy);
        grd.addColorStop(0, 'rgba(61,255,168,0)'); grd.addColorStop(1, 'rgba(61,255,168,0.35)');
        c.save(); roundRect(c, z.x, z.y, z.w, z.h, 10); c.clip();
        c.fillStyle = grd; c.fillRect(z.x, sy - 18, z.w, 18);
        c.fillStyle = 'rgba(61,255,168,0.9)'; c.fillRect(z.x, sy, z.w, 1.5);
        c.restore();
      }

      // label
      c.font = '700 ' + Math.max(9, Math.min(12, z.w / 14)) + 'px JetBrains Mono, monospace';
      c.textBaseline = 'top'; c.textAlign = 'left';
      c.fillStyle = COL.label;
      var lbl = SI.L(SI.DEPTS[d.id]).toUpperCase();
      var maxW = z.w - 52;
      while (c.measureText(lbl).width > maxW && lbl.length > 4) lbl = lbl.slice(0, -2) + '…';
      c.fillText(lbl, z.x + 9, z.y + 7);
      c.font = '10px JetBrains Mono, monospace';
      var cnt = known + enc > 0 ? '⚠ ' + (known + enc) + '/' + d.hosts.length : d.hosts.length + ' ⌂';
      c.fillStyle = enc ? COL.enc : known ? COL.known : '#5b7da3';
      c.fillText(cnt, z.x + 9, z.y + 21);
      var tagX = z.x + 15 + c.measureText(cnt).width;
      if (d.isolated) { c.fillStyle = COL.isoLine; c.fillText('· ' + SI.t('mapIso'), tagX, z.y + 21); }
      else if (d.hunt) { c.fillStyle = COL.good; c.fillText('· ' + SI.t('mapHunt'), tagX, z.y + 21); }
      // sensor pips
      for (var s = 0; s < 3; s++) {
        var px = z.x + z.w - 12 - (2 - s) * 9, py = z.y + 9;
        c.fillStyle = s < d.sensor ? COL.patched : 'rgba(46,230,255,0.12)';
        c.fillRect(px - 3, py - 3, 6, 6);
      }
    });

    // edges
    var drawn = {};
    g.hosts.forEach(function (a) {
      a.links.forEach(function (b) {
        var key = a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id;
        if (drawn[key]) return; drawn[key] = 1;
        var cross = a.dept !== b.dept;
        var va = self.visState(a), vb = self.visState(b);
        var hot = (va === 'known' || va === 'enc') && (vb === 'known' || vb === 'enc');
        c.strokeStyle = hot ? 'rgba(255,59,92,0.45)' : cross ? COL.gate : COL.edge;
        c.lineWidth = cross ? 1.3 : 1;
        if (cross) c.setLineDash([4, 4]);
        if (cross && (a.dept.isolated || b.dept.isolated)) c.strokeStyle = 'rgba(95,214,255,0.1)';
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        c.setLineDash([]);
      });
    });

    // traces (correlated movement the SOC reconstructed)
    this.traces = this.traces.filter(function (t) {
      var k = (now - t.t0) / 1400;
      if (k >= 1) return false;
      c.strokeStyle = t.color; c.globalAlpha = 1 - k; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(t.a.x, t.a.y); c.lineTo(t.b.x, t.b.y); c.stroke();
      var m = Math.min(1, k * 2.5);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(t.a.x + (t.b.x - t.a.x) * m, t.a.y + (t.b.y - t.a.y) * m, 2.5, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      return true;
    });

    // hosts
    var r = this.r;
    g.hosts.forEach(function (h) {
      var vs = self.visState(h);
      if (self.lastState[h.id] !== vs) {
        var col = vs === 'known' ? COL.known : vs === 'enc' ? (h.wiped ? COL.wiped : COL.enc) : vs === 'iso' ? COL.isoLine : COL.good;
        self.flash.push({ x: h.x, y: h.y, color: col, t0: now, big: vs === 'known' || vs === 'enc' });
        self.lastState[h.id] = vs;
      }
      var p2 = 0.6 + 0.4 * Math.sin(now / 260 + h.id);
      if (vs === 'known' || vs === 'enc') {
        c.globalAlpha = 0.16 + 0.14 * p2; c.fillStyle = vs === 'known' ? COL.known : COL.enc;
        c.beginPath(); c.arc(h.x, h.y, r * 2.1, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      }
      shape(c, h.kind, h.x, h.y, r);
      if (vs === 'known') { c.fillStyle = COL.known; c.globalAlpha = 0.75 + 0.25 * p2; }
      else if (vs === 'enc') c.fillStyle = h.wiped ? '#3a1408' : '#4a0418';
      else if (vs === 'iso') c.fillStyle = COL.iso;
      else c.fillStyle = COL.clean;
      c.fill();
      c.globalAlpha = 1;
      c.lineWidth = vs === 'clean' && h.patched ? 1.8 : 1.2;
      c.strokeStyle = vs === 'clean' ? (h.patched ? 'rgba(46,230,255,0.75)' : COL.cleanLine) : vs === 'iso' ? COL.isoLine : vs === 'enc' ? (h.wiped ? COL.wiped : COL.enc) : '#fff';
      c.stroke();
      if (vs === 'enc') {
        c.strokeStyle = h.wiped ? COL.wiped : '#ff6b8a'; c.lineWidth = 1.6;
        if (h.wiped) { // flame-ish cross: destroyed disk
          c.beginPath(); c.moveTo(h.x - r * 0.5, h.y - r * 0.5); c.lineTo(h.x + r * 0.5, h.y + r * 0.5);
          c.moveTo(h.x + r * 0.5, h.y - r * 0.5); c.lineTo(h.x - r * 0.5, h.y + r * 0.5); c.stroke();
        } else { // padlock
          c.fillStyle = '#ff6b8a';
          c.fillRect(h.x - r * 0.42, h.y - r * 0.05, r * 0.84, r * 0.6);
          c.beginPath(); c.arc(h.x, h.y - r * 0.05, r * 0.28, Math.PI, 0); c.stroke();
        }
      } else if (vs === 'iso') { // shield ring
        c.strokeStyle = COL.isoLine; c.lineWidth = 1; c.setLineDash([2, 3]);
        c.beginPath(); c.arc(h.x, h.y, r * 1.7, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      } else if (vs === 'clean' && (h.kind === 'dc' || h.kind === 'bkp')) {
        c.fillStyle = '#7fa6d0'; c.font = '700 ' + Math.round(r) + 'px JetBrains Mono, monospace';
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(h.kind === 'dc' ? 'D' : 'B', h.x, h.y + 1);
      } else if (vs === 'known') {
        c.fillStyle = '#fff'; c.font = '800 ' + Math.round(r * 1.1) + 'px JetBrains Mono, monospace';
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', h.x, h.y + 1);
      }
      if (h === self.selected) {
        c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.setLineDash([3, 3]);
        c.beginPath(); c.arc(h.x, h.y, r * 2.3, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      }
    });

    // flash rings
    this.flash = this.flash.filter(function (f) {
      var k = (now - f.t0) / (f.big ? 800 : 500);
      if (k >= 1) return false;
      c.strokeStyle = f.color; c.globalAlpha = (1 - k) * (f.big ? 1 : 0.6); c.lineWidth = f.big ? 2.5 : 1.5;
      c.beginPath(); c.arc(f.x, f.y, r + k * r * (f.big ? 4 : 2), 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
      return true;
    });

    // eradication sweep
    if (g.eradicating) {
      var sx = ((now / 2200) % 1) * (W + 120) - 60;
      var eg = c.createLinearGradient(sx - 60, 0, sx, 0);
      eg.addColorStop(0, 'rgba(46,230,255,0)'); eg.addColorStop(1, 'rgba(46,230,255,0.28)');
      c.fillStyle = eg; c.fillRect(sx - 60, 0, 60, H);
      c.fillStyle = 'rgba(160,245,255,0.8)'; c.fillRect(sx, 0, 2, H);
    }

    // alert bubbles
    g.bubbles.forEach(function (b) {
      var age = (g.t - b.born + alpha) / b.life;
      var bx = b.host.x, by = b.host.y - 18 - Math.sin(now / 400 + b.id) * 3;
      var rr = 13 + 2 * Math.sin(now / 180 + b.id);
      c.globalAlpha = age > 0.75 ? Math.max(0.2, (1 - age) * 4) * (0.6 + 0.4 * Math.sin(now / 80)) : 1;
      var colr = b.type === 'ioc' ? COL.ioc : COL.alert;
      c.shadowColor = colr; c.shadowBlur = 16;
      c.fillStyle = colr;
      if (b.type === 'ioc') {
        c.beginPath(); c.moveTo(bx, by - rr * 1.15); c.lineTo(bx + rr * 1.15, by); c.lineTo(bx, by + rr * 1.15); c.lineTo(bx - rr * 1.15, by); c.closePath(); c.fill();
      } else {
        c.beginPath(); c.arc(bx, by, rr, 0, Math.PI * 2); c.fill();
      }
      c.shadowBlur = 0;
      // countdown ring
      c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(bx, by, rr - 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, 1 - age)); c.stroke();
      c.fillStyle = '#081018'; c.font = '800 15px JetBrains Mono, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(b.type === 'ioc' ? '◆' : '!', bx, by + 1);
      c.globalAlpha = 1;
    });

    // floating texts
    this.floaters = this.floaters.filter(function (f) {
      var k = (now - f.t0) / 1100;
      if (k >= 1) return false;
      c.globalAlpha = 1 - k; c.fillStyle = f.color; c.font = '800 13px JetBrains Mono, monospace'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText(f.text, f.x, f.y - 26 - k * 28);
      c.globalAlpha = 1;
      return true;
    });

    c.restore();

    var rf = (now - this.redFlash) / 900;
    if (rf < 1) { c.fillStyle = 'rgba(255,30,70,' + (0.4 * (1 - rf)) + ')'; c.fillRect(0, 0, W, H); }
    var cf = (now - this.cyanFlash) / 900;
    if (cf < 1) { c.fillStyle = 'rgba(46,230,255,' + (0.3 * (1 - cf)) + ')'; c.fillRect(0, 0, W, H); }
  };

  // Columns for the department grid; the engine uses the same rule to pick short gate links.
  SI.mapCols = function (n, aspect) {
    if (aspect > 1.3) return Math.min(4, n);
    if (aspect > 0.85) return Math.min(3, n);
    return n <= 3 ? 1 : 2;
  };

  SI.MapView = MapView;
})();
