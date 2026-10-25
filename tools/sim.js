// Headless balance check: a reasonable bot defends every company x adversary many times.
// Usage: node tools/sim.js [runsPerCombo] [skill 0..1]
global.window = global;
var path = require('path');
['config', 'labels', 'i18n', 'data', 'upgrades', 'game'].forEach(function (f) { require(path.join(__dirname, '..', 'js', f + '.js')); });

var RUNS = +process.argv[2] || 40;
var SKILL = process.argv[3] != null ? +process.argv[3] : 0.7;     // how attentive the bot is
var DETAIL = !!process.env.DETAIL;
var PRIORITY = ['dt_siem', 'gv_board', 'rs_playbook', 'dt_sysmon', 'rs_dfir', 'pr_assets', 'dt_ndr', 'pr_mfa', 'rs_isolate', 'dt_edr',
  'gv_backup', 'pr_patch', 'rs_memory', 'dt_sigma', 'gv_aware', 'rs_soar', 'dt_dns', 'pr_laps', 'rs_egress', 'gv_tabletop', 'gv_immutable',
  'dt_ueba', 'gv_dlp', 'dt_hunt', 'rs_intel', 'pr_tier', 'pr_seg', 'rs_purple', 'dt_canary', 'gv_insure', 'pr_fido', 'rs_krbtgt',
  'gv_mssp', 'rs_evict', 'gv_dr', 'pr_email', 'pr_asr', 'dt_xdr', 'pr_jit', 'pr_zt', 'gv_wellness', 'gv_nis2'];

function play(co, adv, seed) {
  var rnd = SI.mulberry32(seed * 7919 + 13);
  var g = new SI.Game({ company: co, adversary: adv, seed: seed, rand: rnd });
  var reserve = 3;
  while (!g.over && g.t < 2500) {
    g.tick();
    if (SKILL <= 0) continue;
    g.bubbles.slice().forEach(function (b) { if (rnd() < 0.2 * SKILL) g.collectBubble(b.id); });
    // contain what you can see
    g.hosts.forEach(function (h) { if (h.s === 'inf' && h.known && rnd() < 0.4 * SKILL && g.budget >= g.isoCostOf()) g.isolateHost(h); });
    // buy the next upgrade on the list
    for (var i = 0; i < PRIORITY.length; i++) {
      var u = g.upgradeById(PRIORITY[i]);
      if (g.canBuy(u)) { if (g.budget >= u.cost + (g.firstDetectAt >= 0 ? reserve : 0)) g.buy(u.id); break; }
    }
    // hunt where it is hot, sensor where it matters
    if (g.t % 6 === 0 && rnd() < SKILL) {
      var ds = g.depts.slice().sort(function (a, b) {
        // only what a player can see: known threats and recent alerts in the department
        var ka = (a.hosts.filter(function (h) { return h.known || h.s === 'enc'; }).length + rnd() * 2), kb = (b.hosts.filter(function (h) { return h.known || h.s === 'enc'; }).length + rnd() * 2);
        return kb - ka;
      });
      if (g.firstDetectAt >= 0 && g.freeAnalysts() > 0 && g.budget > 6) g.deptAction(ds[0], 'hunt');
      var weak = g.depts.filter(function (d) { return d.sensor < 2; });
      if (weak.length && g.budget > 14) g.deptAction(weak[Math.floor(rnd() * weak.length)], 'sensor');
      g.depts.forEach(function (d) { if (g.deptAction(d, 'restore', true).ok && g.budget > 8) g.deptAction(d, 'restore'); });
    }
    if (g.planReady && !g.eradicating) g.launchEradication();
  }
  return g;
}

console.log('runs/combo ' + RUNS + ', skill ' + SKILL + '   cell = win% [breach/fired] avg-days');
var pad = function (s, n) { s = String(s); while (s.length < n) s += ' '; return s; };
console.log(pad('', 11) + SI.ADVERSARIES.map(function (a) { return pad(a.id, DETAIL ? 30 : 21); }).join(''));
var allW = 0, allN = 0;
SI.COMPANIES.forEach(function (co) {
  var row = pad(co.id, 11);
  SI.ADVERSARIES.forEach(function (adv) {
    var win = 0, br = 0, fi = 0, t = 0, er = 0, dw = 0, pk = 0;
    for (var s = 1; s <= RUNS; s++) {
      var g = play(co, adv, s);
      if (g.won()) win++;
      if (g.outcome === 'eradicated') er++;
      if (g.outcome === 'breach') br++;
      if (g.outcome === 'fired') fi++;
      t += g.t; dw += g.firstDetectAt < 0 ? g.t : g.firstDetectAt; pk += g.stats.peakInf;
    }
    allW += win; allN += RUNS;
    row += pad(Math.round(win / RUNS * 100) + '% [' + Math.round(br / RUNS * 100) + '/' + Math.round(fi / RUNS * 100) + '] ' + Math.round(t / RUNS / 24) + 'd e' + Math.round(er / RUNS * 100) + (DETAIL ? ' w' + Math.round(dw / RUNS) + ' p' + Math.round(pk / RUNS) : ''), DETAIL ? 30 : 21);
  });
  console.log(row);
});
console.log('overall win ' + Math.round(allW / allN * 100) + '%');
