// SOC Inc. — simulation engine (no DOM; runs headless in node for balance tests)
// You are the SOC. Infections start hidden: you only see what your sensors, triage and hunts reveal.
window.SI = window.SI || {};

(function () {
  'use strict';

  var PRIV = { srv: 1, dc: 1, bkp: 1 };                                                  // need admin rights
  var LOOT = { srv: 0.07, dc: 0.05, bkp: 0.04, web: 0.03, ws: 0.012, iot: 0.004 };      // GB per hour per foothold
  var SENSOR_DET = [0, 0.006, 0.013, 0.022];                                             // extra detection per hidden host per hour
  var SENSOR_COST = [4, 6, 9];
  var RESTORE = { none: 0.0015, online: 0.011, offline: 0.016, immutable: 0.024 };      // impacted hosts restored per hour
  var HUNT_TICKS = 12, AUTO_HUNT_TICKS = 8;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function pick(arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  // ------------------------------------------------------------ map generation
  function buildNetwork(co, seed, cols) {
    var rnd = mulberry32(seed);
    var depts = [], hosts = [], byId = {};

    co.depts.forEach(function (spec, di) {
      var d = { id: spec.id, index: di, hosts: [], sensor: 0, isolated: false, isoSince: -1, hunt: null };
      var kinds = [];
      ['dc', 'srv', 'web', 'bkp', 'ws', 'iot'].forEach(function (k) { for (var i = 0; i < (spec[k] || 0); i++) kinds.push(k); });
      var pts = [];
      kinds.forEach(function () {
        var best = null, bestD = -1;
        for (var tries = 0; tries < 30; tries++) {
          var c = { x: 0.12 + rnd() * 0.76, y: 0.36 + rnd() * 0.52 };
          var md = 9;
          pts.forEach(function (p) { md = Math.min(md, Math.hypot((p.x - c.x) * 1.4, p.y - c.y)); });
          if (md > bestD) { bestD = md; best = c; }
        }
        pts.push(best);
      });
      var seq = {};
      kinds.forEach(function (k, i) {
        seq[k] = (seq[k] || 0) + 1;
        var code = (SI.DEPTS[spec.id] && SI.DEPTS[spec.id].code) || spec.id.toUpperCase();
        var name = code + '-' + SI.KINDS[k].code + (seq[k] < 10 ? '0' : '') + seq[k];
        var h = { id: hosts.length, dept: d, kind: k, name: name, rx: pts[i].x, ry: pts[i].y, s: 'clean', known: false, patched: false, links: [], isoUntil: 0 };
        hosts.push(h); d.hosts.push(h);
      });
      depts.push(d); byId[d.id] = d;
    });

    function link(a, b) {
      if (a === b || a.links.indexOf(b) !== -1) return;
      a.links.push(b); b.links.push(a);
    }
    // intra-department: minimum spanning tree + a few extra edges
    depts.forEach(function (d) {
      var hs = d.hosts;
      if (hs.length < 2) return;
      var inTree = [hs[0]], rest = hs.slice(1);
      while (rest.length) {
        var bi = 0, bj = 0, bd = 1e9;
        inTree.forEach(function (a, i) {
          rest.forEach(function (b, j) {
            var dd = Math.hypot(a.rx - b.rx, a.ry - b.ry);
            if (dd < bd) { bd = dd; bi = i; bj = j; }
          });
        });
        link(inTree[bi], rest[bj]);
        inTree.push(rest.splice(bj, 1)[0]);
      }
      var extra = Math.floor(hs.length / 3);
      for (var e = 0; e < extra; e++) {
        var a = pick(hs, rnd), near = hs.slice().sort(function (x, y) {
          return Math.hypot(x.rx - a.rx, x.ry - a.ry) - Math.hypot(y.rx - a.rx, y.ry - a.ry);
        });
        if (near[2]) link(a, near[2]);
      }
    });
    // inter-department gates, picked so the lines stay short in the map layout
    cols = cols || (depts.length <= 3 ? 1 : 2);
    var gates = [];
    var gridCenter = function (d) {
      var row = Math.floor(d.index / cols), col = d.index % cols, rows = Math.ceil(depts.length / cols);
      var inRow = row === rows - 1 ? depts.length - row * cols : cols;
      return { x: (cols - inRow) / 2 + col + 0.5, y: row + 0.5 };
    };
    co.links.forEach(function (pair) {
      var A = byId[pair[0]], B = byId[pair[1]];
      if (!A || !B) return;
      var n = Math.min(A.hosts.length, B.hosts.length) > 4 ? 2 : 1;
      var nearest = function (from, to) {
        var c = gridCenter(to), pc = gridCenter(from);
        return from.hosts.slice().sort(function (x, y) {
          return Math.hypot(pc.x + x.rx - 0.5 - c.x, pc.y + x.ry - 0.5 - c.y) - Math.hypot(pc.x + y.rx - 0.5 - c.x, pc.y + y.ry - 0.5 - c.y);
        });
      };
      var na = nearest(A, B), nb = nearest(B, A);
      for (var i = 0; i < n; i++) {
        var a = na[Math.min(na.length - 1, i * 2 + Math.floor(rnd() * 2))], b = nb[Math.min(nb.length - 1, i * 2 + Math.floor(rnd() * 2))];
        link(a, b); gates.push([a, b]);
      }
    });
    return { depts: depts, hosts: hosts, byId: byId, gates: gates };
  }

  // ------------------------------------------------------------ game
  function Game(opts) {
    var self = this;
    this.co = opts.company;
    this.adv = opts.adversary;
    this.unknown = !!opts.unknown;           // player picked "unknown actor": name hidden until attribution
    this.name = opts.name || 'BLUE_OWL';
    this.rand = opts.rand || Math.random;
    this.listener = opts.onEvent || function () {};
    var r = this.rand;

    var vid = opts.vector || pick(this.adv.vectors, r);
    this.vectorId = vid;
    this.vector = SI.VECTORS[vid];

    var d = this.co.def;
    this.D = { aware: d.aware, mfa: d.mfa, patch: d.patch, pam: d.pam, seg: d.seg, edr: d.edr, vis: d.vis, ndr: 0, dlp: 0, ueba: 0, deception: 0 };
    this.backup = this.co.backup;

    var net = buildNetwork(this.co, opts.seed || (Date.now() & 0xffff), opts.cols);
    this.depts = net.depts; this.hosts = net.hosts; this.deptById = net.byId; this.gates = net.gates;
    this.denom = this.hosts.length;
    this.lootGoal = this.co.loot;
    // a little head start: some hosts are already patched
    this.hosts.forEach(function (h) { if (h.kind !== 'iot' && r() < d.patch * 0.6) h.patched = true; });

    this.budget = this.co.budget;
    this.trust = this.co.trust;
    this.analysts = this.co.analysts;

    // player modifiers (upgrades write here)
    this.p = {
      income: 1, bubbleMult: 1, bubbleLife: 1, actionDisc: 1, sensorDisc: 1, isoCost: 1, isoTime: 1,
      huntPower: 1, invest: 1, plan: 1, trustLoss: 1, damageTrust: 1, isoDrain: 1, restore: 0,
      fpRate: 1, tpBoost: 0, wsDetect: 0, c2Detect: 0, xdr: 0, eviction: 1, purple: 0,
      exfilCut: 0, spreadCut: 0, mineCut: 0, credProtect: 0, antiBypass: 0, antiEvasion: 0, domainGuard: 0,
      autoTriage: false, autoIso: false, autoHunt: false, ioc: false, ttpReveal: false, jit: false, ztna: false, noFatigue: false
    };

    // adversary block (techniques write here)
    var b = this.adv.base;
    this.A = {
      spread: b.spread, stealth: b.stealth, persistence: b.persistence, evoRate: b.evo || 1,
      mfaBypass: 0, segBypass: 0, exploit: 0.1, exploitRatio: b.exploitRatio != null ? b.exploitRatio : 0.4, pamBypass: 0, edrEvasion: 0, impactMult: 1,
      tier: b.tier || 0, keepDomain: false, canEscalate: false, dcsync: false,
      exfil: !!b.exfil, exfilMult: b.exfilMult || 1, lootFlat: b.lootFlat || 0, insider: !!b.insider,
      mine: false, ddos: false, canEncrypt: false, canWipe: false, backupKill: false,
      reentryBonus: b.reentryBonus || 0,
      evo: 1, next: 0, ttps: [], playbook: this.adv.playbook.slice()
    };
    // small shuffle of the mid-game order so runs differ
    for (var i = 2; i < this.A.playbook.length - 1; i++) {
      if (r() < 0.3) { var tmp = this.A.playbook[i]; this.A.playbook[i] = this.A.playbook[i + 1]; this.A.playbook[i + 1] = tmp; i++; }
    }
    if (this.vector.priv) this.A.tier = Math.max(this.A.tier, 1);
    this.A.deadline = b.deadline ? b.deadline + Math.floor(r() * 60) : 0;
    this.A.wipeAt = b.wipeAt ? b.wipeAt[0] + Math.floor(r() * (b.wipeAt[1] - b.wipeAt[0])) : 0;

    this.owned = {};
    this.csf = {};
    this.t = 0;
    this.damage = 0; this.peakDamage = 0; this.loot = 0;
    this.investigation = 0; this.attributed = false;
    this.plan = 0; this.planReady = false;
    this.eradicating = false; this.eradStart = -1;
    this.detonated = false; this.detonatedAt = -1; this.wiping = false;
    this.firstDetectAt = -1;
    this.dormant = false; this.reentryFails = 0; this.nextReentry = 0;
    this.sev = 4;
    this.over = false; this.outcome = null;
    this.mods = []; this.flags = {};
    this.bubbles = []; this.bubbleSeq = 0;
    this.socLog = [];
    this.nextBubble = 8 + Math.floor(r() * 6);
    this.nextIoc = 30;
    this.nextEvent = 26 + Math.floor(r() * 14);
    this.nextEscalate = 16 + Math.floor(r() * 10);
    this.nextAutoHunt = 40; this.nextAutoIso = 6; this.nextJit = 40;
    this.nextDdos = 30; this.nextExfilAlert = 10; this.nextWave = 70 + Math.floor(r() * 30);
    this.stats = {
      infections: 0, detections: 0, detBy: {}, blocked: { seg: 0, mfa: 0, patch: 0, pam: 0, edr: 0, iso: 0 },
      contained: 0, edrCleaned: 0, restored: 0, impacted: 0, upgrades: 0, triaged: 0, fps: 0, iocs: 0, hunts: 0,
      reinfections: 0, peakInf: 0, peakKnown: 0, reentries: 0, reentryTries: 0, waves: 0, actions: 0, bubblesMissed: 0, dwell: -1
    };
    this.seedFootholds();
    // the adversary was inside before your shift started: silent spread, nobody watching
    var head = (b.headStart || 18) + 8 + Math.floor(r() * 10);
    for (var hs = 0; hs < head; hs++) this.spreadPhase(true);
    this.stats.headStart = head;
    void self;
  }

  var G = Game.prototype;

  G.emit = function (type, data) { this.listener(type, data || {}); };

  G.mod = function (key) {
    var m = 1;
    for (var i = 0; i < this.mods.length; i++) if (this.mods[i].key === key) m *= this.mods[i].mult;
    return m;
  };
  G.addMod = function (key, mult, ticks) { this.mods.push({ key: key, mult: mult, until: this.t + ticks }); };

  G.count = function (state) {
    var n = 0;
    for (var i = 0; i < this.hosts.length; i++) if (this.hosts[i].s === state) n++;
    return n;
  };
  G.footholds = function () { return this.count('inf'); };
  // encrypted hosts still run the locker until restored
  G.presence = function () { return this.footholds() + (this.adv.kind === 'encrypt' ? this.count('enc') : 0); };
  G.knownCount = function () {
    var n = 0;
    for (var i = 0; i < this.hosts.length; i++) if (this.hosts[i].s === 'inf' && this.hosts[i].known) n++;
    return n;
  };
  G.busyAnalysts = function () { return this.depts.filter(function (d) { return d.hunt && !d.hunt.auto; }).length; };
  G.freeAnalysts = function () { return this.analysts - this.busyAnalysts(); };

  G.trustHit = function (x, raw) {
    if (x <= 0) return;
    this.trust = Math.max(0, this.trust - (raw ? x : x * this.p.trustLoss));
  };
  G.trustGain = function (x) { this.trust = Math.min(100, this.trust + x); };

  G.domainActive = function () {
    if (this.A.keepDomain && this.flags.dcEver) return true;
    return this.hosts.some(function (h) { return h.kind === 'dc' && h.s === 'inf'; });
  };

  G.seedFootholds = function (reentry) {
    var v = this.vector, self = this, r = this.rand;
    var counter = this.D[v.counter] || 0;
    var n = Math.max(1, Math.round(v.footholds * (1 - 0.5 * counter)));
    if (reentry) n = Math.max(1, Math.round(n / 2));
    var candidates = [];
    var free = function (h) { return h.s === 'clean'; };
    if (v.start === 'spread') {
      var ds = this.depts.filter(function (d) { return d.id !== 'vault' && d.id !== 'dmz'; });
      for (var i = 0; i < n; i++) {
        var d = ds[(i + Math.floor(r() * ds.length)) % ds.length];
        var pool = d.hosts.filter(function (h) { return free(h) && h.kind !== 'iot'; });
        if (pool.length) candidates.push(pick(pool, r));
      }
    } else {
      var dept = null, starts = v.start.filter(function (id) { return self.deptById[id]; });
      if (starts.length) dept = this.deptById[pick(starts, r)];
      if (!dept) dept = pick(this.depts.filter(function (d) { return d.id !== 'vault' && d.id !== 'dmz'; }), r);
      var pool2 = dept.hosts.filter(function (h) { return free(h) && (h.kind === 'ws' || h.kind === 'web'); });
      if (!pool2.length) pool2 = dept.hosts.filter(free);
      for (var k = 0; k < n && pool2.length; k++) candidates.push(pool2.splice(Math.floor(r() * pool2.length), 1)[0]);
    }
    candidates.forEach(function (h) { if (h && h.s === 'clean') self.infect(h, null, true); });
    if (!reentry) this.startFootholds = candidates.length;
  };

  // ------------------------------------------------------------ SOC console
  G.soc = function (key, host, src, extra) {
    var tpl = SI.SOC[key];
    if (!tpl) return;
    var a = { t: this.t, key: key, sev: tpl.sev, host: host ? host.name : '', src: src ? src.name : '', up: extra || '' };
    this.socLog.push(a);
    if (this.socLog.length > 120) this.socLog.shift();
    this.emit('soc', { alert: a });
  };

  // ------------------------------------------------------------ host state changes
  G.infect = function (h, src, silent) {
    h.s = 'inf'; h.known = false; h.since = this.t;
    this.stats.infections++;
    if (h.kind === 'dc') this.flags.dcEver = true;
    this.emit('infect', { host: h, src: src, silent: !!silent });
  };

  // An infected host becomes visible to the SOC.
  G.reveal = function (h, how, src) {
    if (!h || h.s !== 'inf' || h.known) return false;
    h.known = true; h.knownAt = this.t;
    this.stats.detections++;
    this.stats.detBy[how] = (this.stats.detBy[how] || 0) + 1;
    if (this.firstDetectAt < 0) {
      this.firstDetectAt = this.t;
      this.stats.dwell = this.t - (this.flags.firstInfAt || 0);
      this.emit('headline', { key: 'patient0', tone: 'hot', params: { host: h.name } });
    }
    var key = { vis: 'd_vis', sensor: 'd_sensor', edr: 'd_edr', ndr: 'd_ndr', dns: 'd_dns', ueba: 'd_ueba', canary: 'd_canary',
      hunt: 'd_hunt', triage: 'd_triage', xdr: 'd_xdr', ioc: 'd_ioc', exfil: 'd_exfil', block: 'd_block' }[how] || 'd_vis';
    this.soc(key, h, src);
    this.emit('detect', { host: h, how: how, src: src });
    if (src && src.s === 'inf') this.emit('trace', { a: src, b: h });
    // correlation pulls the next thread
    if (this.p.xdr && how !== 'xdr' && this.rand() < this.p.xdr) {
      var hidden = h.links.filter(function (n) { return n.s === 'inf' && !n.known; });
      if (hidden.length) this.reveal(pick(hidden, this.rand), 'xdr', h);
    }
    return true;
  };

  // why: edr | iso | reimage | erad | event. Persistence may leave a hidden implant on a neighbour.
  G.clean = function (h, why) {
    var self = this, A = this.A;
    h.s = 'clean'; h.known = false; h.patched = h.kind !== 'iot';
    var k = why === 'erad' ? 0.3 / this.p.eviction : why === 'edr' ? 0.35 : 0.55;
    if (A.persistence > 0 && this.rand() < A.persistence * k) {
      var opts = h.links.filter(function (n) { return n.s === 'clean' && !(n.dept.isolated && n.dept !== h.dept); });
      if (opts.length) { this.stats.reinfections++; self.infect(pick(opts, this.rand), h, true); }
    }
    this.emit('clean', { host: h, why: why });
  };

  G.patchRandom = function (f) {
    var r = this.rand;
    this.hosts.forEach(function (h) { if (h.s === 'clean' && !h.patched && h.kind !== 'iot' && r() < f) h.patched = true; });
  };
  G.infectRandom = function (n) {
    var pool = this.hosts.filter(function (h) { return h.s === 'clean' && h.kind === 'ws' && !h.dept.isolated; });
    for (var i = 0; i < n && pool.length; i++) this.infect(pool.splice(Math.floor(this.rand() * pool.length), 1)[0], null, true);
  };

  // ------------------------------------------------------------ player actions
  G.upgradeById = function (id) { return SI.UPGRADES.filter(function (x) { return x.id === id; })[0]; };
  G.canBuy = function (u) {
    if (this.owned[u.id] || this.over) return false;
    if (u.req.length && !u.req.some(function (r) { return this.owned[r]; }, this)) return false;
    return true;
  };
  G.buy = function (id) {
    var u = this.upgradeById(id);
    if (!u || !this.canBuy(u) || this.budget < u.cost) return false;
    this.budget -= u.cost;
    this.owned[id] = true;
    this.stats.upgrades++;
    this.csf[u.csf] = (this.csf[u.csf] || 0) + 1;
    u.fx(this.p, this);
    ['aware', 'mfa', 'patch', 'pam', 'seg', 'edr', 'vis', 'ndr', 'dlp', 'ueba', 'deception'].forEach(function (k) { this.D[k] = Math.min(1, this.D[k]); }, this);
    this.emit('bought', { upgrade: u });
    return true;
  };

  G.isoCostOf = function () { return Math.round(2 * this.p.isoCost * this.p.actionDisc * 10) / 10; };

  // Piecemeal containment tips the adversary off: they speed up and dig in. Eradication avoids this.
  G.spook = function () {
    var A = this.A, k = this.adv.base.spook || 0.5;
    if (this.eradicating) return;
    A.spooked = Math.min(6, (A.spooked || 0) + k);
    this.addMod('spread', 1 + 0.08 * k, 12);
    A.stealth = Math.min(0.85, A.stealth + 0.004 * k);
  };
  G.isolateHost = function (h, auto) {
    if (!h || h.s !== 'inf' || !h.known || this.over) return false;
    var cost = auto ? 0 : this.isoCostOf();
    if (this.budget < cost) return false;
    this.budget -= cost;
    h.s = 'iso'; h.known = false;
    h.isoUntil = this.t + Math.round(16 * this.p.isoTime);
    this.stats.contained++;
    if (!auto) this.stats.actions++;
    this.trustHit(0.15);
    // the implant may have already copied itself next door
    if (this.A.persistence > 0 && this.rand() < this.A.persistence * 0.7) {
      var opts = h.links.filter(function (n) { return n.s === 'clean' && !n.dept.isolated; });
      if (opts.length) { this.stats.reinfections++; this.infect(pick(opts, this.rand), h, true); }
    }
    this.soc(auto ? 'auto_iso' : 'iso', h);
    this.spook();
    this.emit('isolateHost', { host: h, auto: !!auto });
    return true;
  };

  // Department actions: sensor | hunt | reimage | isolate | restore
  G.deptAction = function (d, act, dry) {
    var p = this.p, cost = 0, ok = true, reason = '', self = this;
    var known = d.hosts.filter(function (h) { return h.s === 'inf' && h.known; });
    var enc = d.hosts.filter(function (h) { return h.s === 'enc'; });
    switch (act) {
      case 'sensor':
        if (d.sensor >= 3) { ok = false; reason = 'max'; break; }
        cost = Math.round(SENSOR_COST[d.sensor] * p.sensorDisc * p.actionDisc * 10) / 10; break;
      case 'hunt':
        if (d.hunt) { ok = false; reason = 'busy'; break; }
        if (this.freeAnalysts() < 1) { ok = false; reason = 'analysts'; }
        cost = Math.round(3 * p.actionDisc * 10) / 10; break;
      case 'reimage':
        if (!known.length) { ok = false; reason = 'none'; }
        cost = Math.round(Math.max(1, 1.2 * known.length) * p.actionDisc * 10) / 10; break;
      case 'isolate':
        cost = 0; break;
      case 'restore':
        if (!enc.length) { ok = false; reason = 'none'; }
        cost = Math.round(Math.min(3, enc.length || 1) * (this.backup === 'none' ? 4 : 1.5) * p.actionDisc * 10) / 10; break;
      default: ok = false;
    }
    if (ok && this.budget < cost) { ok = false; reason = 'budget'; }
    if (this.over) ok = false;
    if (dry || !ok) return { ok: ok, cost: cost, reason: reason, n: act === 'reimage' ? known.length : act === 'restore' ? Math.min(3, enc.length) : 0 };

    this.budget -= cost;
    this.stats.actions++;
    switch (act) {
      case 'sensor': d.sensor++; break;
      case 'hunt': d.hunt = { until: this.t + HUNT_TICKS, t0: this.t, found: 0 }; break;
      case 'reimage':
        known.forEach(function (h) { self.clean(h, 'reimage'); self.soc('reimage', h); self.trustHit(0.25); self.spook(); });
        this.stats.contained += known.length; break;
      case 'isolate':
        d.isolated = !d.isolated; d.isoSince = this.t;
        if (d.isolated) this.trustHit(1.2 * (SI.DEPTS[d.id].w || 1));
        break;
      case 'restore':
        enc.slice(0, 3).forEach(function (h) { h.s = 'clean'; h.patched = h.kind !== 'iot'; h.wiped = false; self.stats.restored++; self.emit('restore', { host: h }); });
        break;
    }
    this.emit('deptAction', { dept: d, act: act });
    return { ok: true, cost: cost };
  };

  G.collectBubble = function (id, auto) {
    for (var i = 0; i < this.bubbles.length; i++) {
      if (this.bubbles[i].id !== id) continue;
      var b = this.bubbles.splice(i, 1)[0], gain;
      if (b.type === 'ioc') {
        gain = 2;
        this.stats.iocs++;
        if (this.firstDetectAt >= 0 || b.host.s === 'inf') this.investigation = Math.min(100, this.investigation + 4);
        if (b.host.s === 'inf') this.reveal(b.host, 'ioc');
      } else if (b.tp && b.host.s === 'inf') {
        gain = 1.6;
        this.stats.triaged++;
        this.reveal(b.host, 'triage');
        this.investigation = Math.min(100, this.investigation + 2);
      } else {
        gain = 0.6;
        this.stats.fps++;
        this.soc('fp', b.host);
      }
      gain = Math.round(gain * this.p.bubbleMult * (auto ? 0.5 : 1) * 10) / 10;
      this.budget += gain;
      this.emit('bubble', { bubble: b, gain: gain, tp: b.type === 'ioc' || (b.tp && b.host.known), auto: !!auto });
      return gain;
    }
    return 0;
  };

  G.spawnAlert = function (tp) {
    var r = this.rand;
    if (this.bubbles.filter(function (b) { return b.type === 'alert'; }).length >= 3) return;
    var hidden = this.hosts.filter(function (h) { return h.s === 'inf' && !h.known; });
    // the more is going on, the more of the noise is real
    var tpChance = hidden.length ? clamp((0.03 + this.D.vis * 0.2 + this.p.tpBoost * 0.6 + (1 - this.p.fpRate) * 0.2) * (1 + hidden.length * 0.1), 0, 0.8) : 0;
    if (tp === undefined) tp = r() < tpChance;
    if (tp && !hidden.length) tp = false;
    var used = this.bubbles.map(function (b) { return b.host; });
    var pool = tp ? hidden : this.hosts.filter(function (h) { return h.s === 'clean'; });
    pool = pool.filter(function (h) { return used.indexOf(h) === -1; });
    if (!pool.length) return;
    this.bubbles.push({ id: ++this.bubbleSeq, type: 'alert', host: pick(pool, r), tp: tp, born: this.t, life: Math.round(22 * this.p.bubbleLife),
      text: Math.floor(r() * (tp ? SI.TRIAGE.tp.length : SI.TRIAGE.fp.length)) });
  };
  G.spawnIoc = function (force) {
    var r = this.rand;
    if (!force && !this.p.ioc) return;
    if (this.bubbles.some(function (b) { return b.type === 'ioc'; })) return;
    var hidden = this.hosts.filter(function (h) { return h.s === 'inf' && !h.known; });
    var host = hidden.length && r() < 0.75 ? pick(hidden, r) : pick(this.hosts.filter(function (h) { return h.s === 'clean'; }), r);
    if (!host) return;
    this.bubbles.push({ id: ++this.bubbleSeq, type: 'ioc', host: host, born: this.t, life: Math.round(30 * this.p.bubbleLife), text: Math.floor(r() * SI.TRIAGE.ioc.length) });
  };

  G.launchEradication = function () {
    if (!this.planReady || this.eradicating || this.over) return false;
    this.eradicating = true; this.eradStart = this.t;
    this.trustHit(5);
    this.emit('eradicate', {});
    this.emit('headline', { key: 'eradStart', tone: 'good' });
    return true;
  };

  // ------------------------------------------------------------ adversary
  G.acquire = function (id) {
    var def = SI.TTPS[id], A = this.A;
    if (!def) return;
    var before = {};
    Object.keys(A).forEach(function (k) { if (typeof A[k] === 'number') before[k] = A[k]; });
    def.fx(A, this);
    var damp = 1 - this.p.purple;
    Object.keys(before).forEach(function (k) { if (A[k] !== before[k]) A[k] = before[k] + (A[k] - before[k]) * damp; });
    A.stealth = clamp(A.stealth, 0, 0.85);
    var seen = this.attributed || this.p.ttpReveal;
    A.ttps.push({ id: id, t: this.t, seen: seen });
    if (this.attributed) this.plan = Math.max(0, this.plan - 5 * damp);
    if (this.firstDetectAt >= 0) this.soc(seen ? 'ttp' : 'ttp_unk', null, null, id);
    this.emit('ttp', { id: id, seen: seen, active: this.firstDetectAt >= 0 });
  };

  G.evolve = function () {
    var A = this.A;
    if (this.eradicating) return;
    A.evo += (0.03 + this.footholds() * 0.005) * A.evoRate;
    var next = A.playbook[A.next];
    if (next && A.evo >= 3 + A.next * 0.8) { A.evo = 0; A.next++; this.acquire(next); }
  };

  G.escalate = function () {
    var A = this.A, D = this.D, r = this.rand;
    if (this.t >= this.nextEscalate) {
      this.nextEscalate = this.t + 16 + Math.floor(r() * 8);
      if (A.tier < 1 && this.footholds() > 0) {
        var block = Math.min(0.9, D.pam * 0.75 * (1 - Math.min(0.9, A.pamBypass)));
        var chance = (A.canEscalate ? 0.5 : 0.1) * (1 - block) * (1 - this.p.credProtect);
        if (r() < chance) { A.tier = 1; this.flags.adminAt = this.t; }
      }
    }
    if (this.p.jit && this.t >= this.nextJit) {
      this.nextJit = this.t + 40;
      if (A.tier === 1 && !this.domainActive() && !A.insider && r() < 0.35) A.tier = 0;
    }
  };

  G.tryInfect = function (src, dst, dom, silent) {
    var D = this.D, A = this.A, p = this.p, r = this.rand, st = this.stats.blocked;
    if (dst.s !== 'clean') return;
    var cross = src.dept !== dst.dept, iot = dst.kind === 'iot', priv = !!PRIV[dst.kind];
    if (silent) {   // head start: only the hard walls matter, nobody is reading logs yet
      if (priv && A.tier < 1 && !dom) return;
      if (cross && r() < D.seg) return;
      if (!iot && r() < D.edr * 0.3) return;
      this.infect(dst, src, true);
      return;
    }
    if (cross && (src.dept.isolated || dst.dept.isolated)) { st.iso++; this.blocked(dst, src, 'iso', 0.08); return; }
    if (priv && A.tier < 1 && !dom) { st.pam++; return; }
    if (cross) {
      var seg = D.seg * (1 - Math.min(0.9, A.segBypass + (dom ? 0.25 : 0)));
      if (r() < seg) { st.seg++; this.blocked(dst, src, 'seg', 0.1); return; }
    }
    if (priv && !dom) {
      var pam = Math.min(0.95, D.pam * (dst.kind === 'dc' ? 0.7 * (1 + p.domainGuard) : 0.45) * (1 - Math.min(0.9, A.pamBypass)));
      if (r() < pam) { st.pam++; this.blocked(dst, src, 'pam', 0.14); return; }
    }
    // each move either rides stolen credentials or exploits a bug: MFA answers the first, patching the second
    if (iot || r() < A.exploitRatio) {
      if (dst.patched && !iot && r() < 0.85 * (1 - Math.min(0.9, A.exploit))) { st.patch++; this.blocked(dst, src, 'patch', 0.05); return; }
    } else {
      var mfaBy = A.mfaBypass * (1 - p.antiBypass);
      if (r() < D.mfa * 0.6 * (1 - Math.min(0.9, mfaBy))) { st.mfa++; this.blocked(dst, src, 'mfa', 0.07); return; }
    }
    if (!iot && D.edr > 0) {
      var edrB = D.edr * 0.3 * (1 - Math.min(0.9, A.edrEvasion * (1 - p.antiEvasion)));
      if (r() < edrB) { st.edr++; this.blocked(dst, src, 'edr', 0.3); return; }
    }
    if (D.deception > 0 && r() < D.deception * 0.1) this.reveal(src, 'canary');
    this.infect(dst, src);
    if (cross && D.ndr > 0 && r() < D.ndr * 0.2 * (1 - A.stealth)) this.reveal(dst, 'ndr', src);
  };

  // A defense held. Sometimes the blocked attempt is traced back to the compromised source.
  G.blocked = function (dst, src, def, trace) {
    var r = this.rand;
    this.emit('block', { host: dst, def: def });
    if (r() < 0.22) this.soc('b_' + def, dst, src);
    if (src.s === 'inf' && !src.known && r() < (trace + this.D.ndr * 0.12) * (1 - this.A.stealth * 0.5)) this.reveal(src, 'block');
  };

  G.spreadPhase = function (silent) {
    var self = this, A = this.A, r = this.rand;
    var dom = this.domainActive();
    var mult = A.spread * this.mod('spread') * (dom ? 1.5 + (A.dcsync ? 0.3 : 0) : 1) * (1 - Math.min(0.6, this.p.spreadCut)) * (this.eradicating ? 0.25 : 1);
    var att = Math.min(0.8, 0.058 * mult);
    var lockerSpreads = this.adv.kind === 'encrypt';
    var infected = this.hosts.filter(function (h) { return h.s === 'inf' || (lockerSpreads && h.s === 'enc'); });
    infected.forEach(function (h) {
      var a = att * (h.dept.isolated ? 0.5 : 1) * (h.s === 'enc' ? 0.5 : 1);
      if (h.links.length && r() < a) self.tryInfect(h, pick(h.links, r), dom, silent);
    });
  };

  G.destroyBackups = function () {
    if (!this.A.backupKill || this.backup !== 'online') return;
    var bkp = this.hosts.filter(function (h) { return h.kind === 'bkp' && h.s === 'inf'; })[0];
    if (!bkp && !this.domainActive()) return;
    this.backup = 'none';
    this.flags.backupsGone = true;
    this.soc('backups', bkp || this.hosts.filter(function (h) { return h.kind === 'bkp'; })[0]);
    this.emit('headline', { key: 'backupsGone', tone: 'hot' });
  };

  G.detonate = function () {
    this.detonated = true; this.detonatedAt = this.t;
    this.destroyBackups();
    this.emit('headline', { key: 'detonate', tone: 'hot' });
    this.emit('impactStart', { kind: 'encrypt' });
  };

  G.impact = function (h) {
    h.s = 'enc'; h.known = false; h.wiped = this.adv.kind === 'wipe';
    this.stats.impacted++;
    if (this.stats.impacted === 1) this.soc(h.wiped ? 'wipe' : 'encrypt', h);
    this.emit('impact', { host: h });
  };

  G.objectivePhase = function () {
    var self = this, A = this.A, D = this.D, p = this.p, r = this.rand;
    var fh = this.footholds(), kind = this.adv.kind;
    var prev = this.damage;
    var slow = this.eradicating ? 0.5 : 1;
    if (kind === 'encrypt') {
      if (!this.detonated && A.canEncrypt && fh > 0) {
        var f = fh / this.denom, knownF = this.knownCount() / Math.max(1, fh);
        if ((this.domainActive() && f >= 0.22) || f >= 0.38 || (this.t >= A.deadline && f >= 0.1) ||
            (knownF >= 0.5 && f >= 0.12 && this.firstDetectAt >= 0) || (this.eradicating && f >= 0.08)) this.detonate();
      }
      if (this.detonated) this.hosts.forEach(function (h) { if (h.s === 'inf' && r() < 0.05 * A.impactMult * slow) self.impact(h); });
      this.damage = this.count('enc') / (this.denom * 0.55) * 100;
    } else if (kind === 'wipe') {
      if (A.ddos && this.t >= this.nextDdos) {
        this.nextDdos = this.t + 40 + Math.floor(r() * 30);
        this.trustHit(2.5 * (1 - Math.min(0.6, p.mineCut)) * (p.ztna ? 0.6 : 1));
        this.soc('ddos');
        this.emit('headline', { key: 'ddos', tone: 'hot' });
      }
      if (!this.wiping && A.canWipe && this.t >= A.wipeAt && fh > 0) {
        this.wiping = true; this.flags.wipeStart = this.t;
        this.destroyBackups();
        this.emit('headline', { key: 'wiper', tone: 'hot' });
        this.emit('impactStart', { kind: 'wipe' });
      }
      if (this.wiping) this.hosts.forEach(function (h) { if (h.s === 'inf' && r() < 0.1 * A.impactMult * slow) self.impact(h); });
      this.damage = this.count('enc') / (this.denom * 0.42) * 100;
    } else if (kind === 'exfil') {
      if (A.exfil && fh > 0) {
        var rate = 0, top = null, topRate = 0;
        this.hosts.forEach(function (h) {
          if (h.s !== 'inf' || h.dept.isolated) return;
          var x = (A.tier >= 1 || !PRIV[h.kind] ? LOOT[h.kind] : 0) + A.lootFlat;
          rate += x;
          if (x > topRate) { topRate = x; top = h; }
        });
        rate *= A.exfilMult * (1 - D.dlp * 0.6) * (1 - Math.min(0.75, p.exfilCut)) * slow;
        this.loot += rate;
        if (rate > 0.05 && top && this.t >= this.nextExfilAlert) {
          this.nextExfilAlert = this.t + 14 + Math.floor(r() * 10);
          if (r() < D.ndr * 0.5 + D.dlp * 0.9 + p.c2Detect * 0.5) this.reveal(top, 'exfil');
        }
        if (!this.flags.lootHalf && this.loot >= this.lootGoal / 2) { this.flags.lootHalf = true; if (this.firstDetectAt >= 0) this.emit('headline', { key: 'lootHalf', tone: 'hot' }); }
      }
      this.damage = this.loot / this.lootGoal * 100;
    } else if (kind === 'mine') {
      if (A.mine) {
        this.damage += fh * 0.012 * (1 - Math.min(0.7, p.mineCut)) * A.impactMult * slow;
        if (!this.flags.mining && fh > 0) { this.flags.mining = true; this.emit('impactStart', { kind: 'mine' }); }
        if (fh > 0 && r() < 0.03) { var m = pick(this.hosts.filter(function (h) { return h.s === 'inf'; }), r); if (m && !m.known) this.soc('mine', m); }
      }
    }
    this.damage = Math.min(100, this.damage);
    this.peakDamage = Math.max(this.peakDamage, this.damage);
    if (this.damage > prev) this.trustHit((this.damage - prev) * 0.2 * this.co.critical * p.damageTrust);
  };

  G.detectPhase = function () {
    var self = this, A = this.A, D = this.D, p = this.p, r = this.rand;
    var mult = (1 - A.stealth) * this.mod('detect');
    if (A.insider) mult *= 0.55 + D.ueba * 1.6 + D.dlp * 0.7;
    else mult *= 1 + D.ueba * 0.4;
    if (A.mine) mult *= 1.6;
    var edrE = 1 - Math.min(0.9, A.edrEvasion * (1 - p.antiEvasion));
    this.hosts.forEach(function (h) {
      if (h.s !== 'inf' || h.known) return;
      var iot = h.kind === 'iot';
      var parts = {
        vis: 0.0012 + D.vis * 0.005,
        sensor: SENSOR_DET[h.dept.sensor],
        edr: iot ? 0 : D.edr * 0.005 * edrE + (h.kind === 'ws' ? p.wsDetect * 0.004 : 0),
        dns: p.c2Detect * 0.006,
        ueba: A.insider ? D.ueba * 0.004 : 0
      };
      var tot = parts.vis + parts.sensor + parts.edr + parts.dns + parts.ueba;
      if (r() < tot * mult) {
        var x = r() * tot, how = 'vis';
        for (var k in parts) { x -= parts[k]; if (x <= 0) { how = k; break; } }
        self.reveal(h, how);
      }
    });
  };

  G.defensePhase = function () {
    var self = this, A = this.A, D = this.D, p = this.p, r = this.rand;
    // EDR quietly kills footholds it recognises
    var edrE = 1 - Math.min(0.9, A.edrEvasion * (1 - p.antiEvasion));
    var er = D.edr * 0.0035 * edrE * (A.insider ? 0.1 : 1);
    if (er > 0) this.hosts.forEach(function (h) {
      if (h.s === 'inf' && h.kind !== 'iot' && r() < er) {
        if (!h.known) self.reveal(h, 'edr');
        self.stats.edrCleaned++;
        self.soc('edr_kill', h);
        self.clean(h, 'edr');
      }
    });
    // patch drift
    var pr = D.patch * 0.0012;
    this.hosts.forEach(function (h) { if (h.s === 'clean' && !h.patched && h.kind !== 'iot' && r() < pr) h.patched = true; });
    // isolated hosts come back rebuilt
    this.hosts.forEach(function (h) {
      if (h.s === 'iso' && self.t >= h.isoUntil) { h.s = 'clean'; h.patched = h.kind !== 'iot'; self.emit('rebuilt', { host: h }); }
    });
    // restores from backup
    var rr = RESTORE[this.backup] * (1 + p.restore);
    this.hosts.forEach(function (h) {
      if (h.s === 'enc' && r() < rr) { h.s = 'clean'; h.patched = h.kind !== 'iot'; h.wiped = false; self.stats.restored++; self.emit('restore', { host: h }); }
    });
    // SOAR auto-containment
    if (p.autoIso && this.t >= this.nextAutoIso) {
      this.nextAutoIso = this.t + 7;
      var known = this.hosts.filter(function (h) { return h.s === 'inf' && h.known; });
      if (known.length) this.isolateHost(pick(known, r), true);
    }
    // hunts
    this.depts.forEach(function (d) {
      if (!d.hunt) return;
      var hp = 0.09 * (1 + 0.3 * d.sensor) * p.huntPower * self.mod('hunt') * (1 - A.stealth * 0.5) * (d.hunt.auto ? 0.7 : 1);
      d.hosts.forEach(function (h) { if (h.s === 'inf' && !h.known && r() < hp) { self.reveal(h, 'hunt'); d.hunt.found++; } });
      if (self.t >= d.hunt.until) {
        var found = d.hunt.found, auto = d.hunt.auto;
        d.hunt = null;
        self.stats.hunts++;
        if (self.firstDetectAt >= 0) self.investigation = Math.min(100, self.investigation + (auto ? 1.5 : 3));
        self.emit('huntDone', { dept: d, found: found, auto: auto });
      }
    });
    if (p.autoHunt && this.t >= this.nextAutoHunt) {
      this.nextAutoHunt = this.t + 40 + Math.floor(r() * 15);
      var cands = this.depts.filter(function (d) { return !d.hunt; });
      // hunters follow hunches: departments with more going on get looked at first
      cands.sort(function (a, b) { return b.hosts.filter(function (h) { return h.s === 'inf'; }).length - a.hosts.filter(function (h) { return h.s === 'inf'; }).length + (r() - 0.5) * 3; });
      if (cands.length) { cands[0].hunt = { until: this.t + AUTO_HUNT_TICKS, t0: this.t, found: 0, auto: true }; this.emit('autoHunt', { dept: cands[0] }); }
    }
  };

  G.researchPhase = function () {
    var p = this.p;
    if (this.firstDetectAt >= 0 && !this.attributed) {
      this.investigation += (0.22 + 0.025 * Math.min(30, this.stats.detections)) * p.invest * this.mod('plan');
      if (this.investigation >= 100) this.attribute();
    }
    if (this.attributed && !this.planReady) {
      this.plan += 0.34 * p.plan * this.mod('plan') * (0.75 + this.D.vis * 0.5);
      if (this.plan >= 100) {
        this.plan = 100; this.planReady = true;
        this.emit('headline', { key: 'planReady', tone: 'good' });
        this.emit('planReady', {});
      }
    }
  };

  G.attribute = function () {
    this.investigation = 100;
    this.attributed = true;
    this.A.ttps.forEach(function (x) { x.seen = true; });
    this.trustGain(4);
    this.emit('headline', { key: 'attributed', tone: 'good' });
    this.emit('attributed', {});
  };

  G.eradicationPhase = function () {
    if (!this.eradicating) return;
    var self = this, D = this.D, p = this.p, r = this.rand;
    this.hosts.forEach(function (h) {
      if (h.s !== 'inf') return;
      var cov = Math.min(1, D.vis * 0.6 + h.dept.sensor * 0.18 + (h.kind === 'iot' ? 0 : D.edr * 0.3) + (h.known ? 0.6 : 0) + (p.eviction > 1 ? 0.3 : 0));
      if (r() < 0.07 * p.eviction * (0.35 + 0.65 * cov)) { if (h.known || r() < 0.3) self.soc('sweep', h); self.clean(h, 'erad'); }
    });
  };

  G.bubblePhase = function () {
    var self = this, r = this.rand;
    if (this.t >= this.nextBubble) {
      this.spawnAlert();
      var busy = this.knownCount() + (this.firstDetectAt >= 0 ? 2 : 0);
      this.nextBubble = this.t + Math.max(6, 13 - busy) + Math.floor(r() * 6);
    }
    if (this.p.ioc && this.t >= this.nextIoc) {
      this.nextIoc = this.t + 28 + Math.floor(r() * 14);
      this.spawnIoc();
    }
    // SOAR triages for you, at half value, if you leave an alert sitting there
    if (this.p.autoTriage) this.bubbles.slice().forEach(function (b) { if (self.t - b.born >= 9) self.collectBubble(b.id, true); });
    this.bubbles = this.bubbles.filter(function (b) {
      var alive = self.t - b.born < b.life && (b.type === 'ioc' || b.host.s === (b.tp ? 'inf' : 'clean'));
      if (!alive && b.tp && b.host.s === 'inf') self.stats.bubblesMissed++;
      return alive;
    });
  };

  G.economyPhase = function () {
    var self = this, p = this.p;
    this.budget += this.co.income * p.income * (0.5 + this.trust / 100);
    var drain = 0;
    this.depts.forEach(function (d) { if (d.isolated) drain += 0.045 * (SI.DEPTS[d.id].w || 1); });
    if (drain) this.trustHit(drain * p.isoDrain);
    if (this.knownCount() === 0 && this.count('enc') === 0 && !drain) this.trustGain(0.012);
    void self;
  };

  G.updateSev = function () {
    var known = this.knownCount(), enc = this.count('enc'), lvl = 4;
    if (known > 0 || enc > 0 || (this.firstDetectAt >= 0 && this.footholds() > 0)) lvl = 3;
    if (known >= this.denom * 0.12 || this.damage >= 15) lvl = 2;
    if (this.damage >= 40 || (this.detonated && enc > 0) || this.wiping) lvl = 1;
    if (lvl < this.sev) { this.sev = lvl; this.emit('sev', { level: lvl }); }
    else this.sev = lvl;
  };

  G.newsPhase = function () {
    var self = this, r = this.rand;
    if (this.t < this.nextEvent) return;
    this.nextEvent = this.t + 30 + Math.floor(r() * 24);
    var pool = SI.EVENTS.filter(function (e) { return e.when(self); });
    var tot = pool.reduce(function (s, e) { return s + e.w; }, 0), x = r() * tot;
    for (var k = 0; k < pool.length; k++) {
      x -= pool[k].w;
      if (x <= 0) { pool[k].run(this); this.emit('news', { event: pool[k] }); break; }
    }
  };

  // With no footholds left the adversary tries to come back the way it first got in. Fail twice and it gives up.
  G.reentryChance = function () {
    var D = this.D, v = this.vector, counter = D[v.counter] || 0;
    return Math.min(0.9, v.reentry + this.A.reentryBonus) * (1 - Math.min(0.85, counter * 0.8)) *
      (this.p.ztna && (this.vectorId === 'creds' || this.vectorId === 'vpn') ? 0.3 : 1) * (1 - Math.min(0.5, this.investigation / 200));
  };
  G.reentryPhase = function () {
    var r = this.rand, D = this.D, v = this.vector;
    if (this.eradicating || this.wiping) return;
    // while active, the campaign keeps sending fresh waves through the same door
    if (this.presence() > 0) {
      this.dormant = false; this.reentryFails = 0;
      if (this.t >= this.nextWave) {
        this.nextWave = this.t + 60 + Math.floor(r() * 40);
        if (r() < this.reentryChance() * 0.7) { this.seedFootholds(true); this.stats.waves++; }
        else if (r() < 0.3 + (D[v.counter] || 0)) this.soc('reentry', null, null, v.tech);
      }
      return;
    }
    if (!this.dormant) {
      this.dormant = true;
      this.nextReentry = this.t + 14 + Math.floor(r() * 14);
      this.emit('quiet', {});
      return;
    }
    if (this.t < this.nextReentry) return;
    var counter = D[v.counter] || 0, chance = this.reentryChance();
    this.stats.reentryTries++;
    if (r() < chance) {
      this.seedFootholds(true);
      this.dormant = false; this.reentryFails = 0;
      this.stats.reentries++;
      this.emit('reentry', { ok: true });
    } else {
      this.reentryFails++;
      if (r() < 0.4 + counter) this.soc('reentry', null, null, v.tech);
      this.emit('reentry', { ok: false });
      this.nextReentry = this.t + 18 + Math.floor(r() * 12);
    }
  };

  // ------------------------------------------------------------ main tick
  G.tick = function () {
    if (this.over) return;
    var self = this;
    this.t++;
    this.mods = this.mods.filter(function (m) { return m.until > self.t; });
    if (!this.flags.firstInfAt) this.flags.firstInfAt = 0;

    this.spreadPhase();
    this.evolve();
    this.escalate();
    this.objectivePhase();
    this.detectPhase();
    this.defensePhase();
    this.researchPhase();
    this.eradicationPhase();
    this.bubblePhase();
    this.economyPhase();
    this.updateSev();
    this.newsPhase();
    this.reentryPhase();

    var fh = this.footholds();
    this.stats.peakInf = Math.max(this.stats.peakInf, fh);
    this.stats.peakKnown = Math.max(this.stats.peakKnown, this.knownCount());
    this.checkEnd();
  };

  G.checkEnd = function () {
    if (this.over) return;
    if (this.damage >= 100) return this.end('breach');
    if (this.trust <= 0) return this.end('fired');
    var fh = this.presence();
    if (fh === 0 && this.eradicating) return this.end('eradicated');
    if (fh === 0 && this.wiping) return this.end('survived');
    if (fh === 0 && this.reentryFails >= 3) return this.end('repelled');
  };

  G.end = function (outcome) {
    this.over = true;
    this.outcome = outcome;
    this.emit('end', { outcome: outcome });
  };
  G.won = function () { return this.outcome === 'eradicated' || this.outcome === 'repelled' || this.outcome === 'survived'; };

  // ------------------------------------------------------------ derived info for UI / debrief
  G.knownPct = function () { return this.knownCount() / this.denom; };
  G.visibility = function () {
    // rough "how much of the network can we actually see" figure for the HUD
    var D = this.D, s = 0;
    this.depts.forEach(function (d) { s += d.sensor / 3 * d.hosts.length; });
    return clamp(D.vis * 0.45 + D.edr * 0.25 + D.ndr * 0.15 + s / this.denom * 0.35, 0, 1);
  };
  G.advName = function () { return !this.unknown || this.attributed ? SI.L(this.adv.name) : '???'; };

  G.score = function () {
    var stars = this.co.stars + this.adv.stars, s;
    if (this.won()) {
      s = 42 + stars * 5 + this.trust * 0.15 + (100 - this.peakDamage) * 0.15 + Math.max(0, 15 - this.t / 40);
      if (this.outcome === 'eradicated') s += 3;
      if (this.outcome === 'survived') s -= 12;
    } else {
      s = stars * 3 + (100 - this.peakDamage) * 0.08 + Math.min(15, this.stats.detections * 0.4) + (this.attributed ? 5 : 0);
    }
    if (this.unknown) s *= 1.2;
    return Math.round(s);
  };
  G.rank = function () {
    var s = this.score(), r = SI.RANKS[0];
    SI.RANKS.forEach(function (x) { if (s >= x.min) r = x; });
    return r;
  };

  // What worked for the defense, biggest first.
  G.topCounters = function () {
    var s = this.stats, b = s.blocked;
    var list = [
      { key: 'seg', n: b.seg, def: 'seg' },
      { key: 'mfa', n: b.mfa, def: 'mfa' },
      { key: 'patch', n: b.patch, def: 'patch' },
      { key: 'pam', n: b.pam, def: 'pam' },
      { key: 'edr', n: b.edr + s.edrCleaned, def: 'edr' },
      { key: 'iso', n: b.iso, def: 'seg' },
      { key: 'detect', n: s.detections, def: 'vis' },
      { key: 'contain', n: s.contained, def: 'edr' },
      { key: 'restore', n: s.restored, def: 'backups' }
    ];
    return list.filter(function (x) { return x.n > 0; }).sort(function (a, b2) { return b2.n - a.n; });
  };

  SI.Game = Game;
  SI.buildNetwork = buildNetwork;
  SI.SENSOR_COST = SENSOR_COST;
  SI.mulberry32 = mulberry32;
})();
