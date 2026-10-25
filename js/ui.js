// SOC Inc. — screens, HUD, input and glue
window.SI = window.SI || {};

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var qa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var store = { settings: { lang: null, sfx: true, music: true, volume: 70, seenHint: false, seenIsoTip: false }, best: {} };
  function load() {
    try { var s = JSON.parse(localStorage.getItem(SI.CONFIG.STORAGE_KEY) || 'null'); if (s) { store.settings = Object.assign(store.settings, s.settings || {}); store.best = s.best || {}; } } catch (e) { /* storage blocked */ }
  }
  function save() { try { localStorage.setItem(SI.CONFIG.STORAGE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }

  var ui = SI.ui = {};
  var sel = { co: 0, adv: -1, name: '' };      // adv -1 = unknown actor
  var game = null, view = null, speed = 1, acc = 0, lastFrame = 0, paused = false, rafId = 0;
  var tickerQueue = [], tickerBusyUntil = 0, hintTimer = 0, treeBranch = 'detect', treeSel = null, socTab = 'alerts';
  var socUnseen = 0, deptOpen = null, lowTrustWarned = false;

  // ------------------------------------------------------------ utils
  ui.clock = function (t) {
    var d = Math.floor(t / 24), h = t % 24;
    return SI.t('timeFmt', { d: d < 10 ? '0' + d : d, h: h < 10 ? '0' + h : h });
  };
  ui.current = function () { return game; };
  ui.toast = function (msg, tone) {
    var el = $('toast'); el.textContent = msg; el.className = 'toast show' + (tone ? ' ' + tone : '');
    clearTimeout(ui._tt); ui._tt = setTimeout(function () { el.classList.remove('show'); }, 1800);
  };
  ui.outcomeTitle = function (g) {
    return SI.t(g.outcome === 'breach' ? 'breach_' + g.adv.kind + 'Title' : g.outcome + 'Title');
  };
  function sfx(n) { SI.Audio.sfxPlay(n); }
  function upgradeById(id) { return SI.UPGRADES.filter(function (u) { return u.id === id; })[0]; }
  function randomName() { return SI.TEAM_NAMES[Math.floor(Math.random() * SI.TEAM_NAMES.length)]; }
  function money(x) { return '$' + (Math.round(x * 10) / 10) + 'K'; }
  function labelTag(kind, key) {
    var l = SI.label(kind, key);
    if (!l) return '';
    return '<span class="rl">' + (l.id ? '<b>' + esc(l.id) + '</b>' : '') + (l.name ? ' ' + esc(l.name) : '') + '</span>';
  }
  function techTag(id, on) {
    return '<span class="tt' + (on ? ' on' : '') + '"><b>' + esc(id) + '</b> ' + esc(SI.techName(id)) + '</span>';
  }
  function advOf(g) { return g.adv; }
  function bump(id) { var el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  function show(id) {
    qa('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    if (id === 'scr-title') startRadar(); else stopRadar();
  }
  function openOvl(id) { $(id).classList.add('open'); syncPause(); }
  function closeOvl(id) {
    $(id).classList.remove('open'); syncPause();
    if (id === 'ovl-dept') { deptOpen = null; if (view) view.selectedDept = null; }
  }
  function anyPausingOverlay() {
    return ['ovl-tree', 'ovl-menu', 'ovl-howto', 'ovl-confirm', 'ovl-soc', 'ovl-dept'].some(function (id) { return $(id).classList.contains('open'); });
  }
  function syncPause() { paused = anyPausingOverlay(); }

  // ------------------------------------------------------------ i18n
  function applyLang() {
    document.documentElement.lang = SI.lang === 'uk' ? 'uk' : 'en';
    qa('[data-i18n]').forEach(function (el) { el.textContent = SI.t(el.getAttribute('data-i18n')); });
    qa('.lang-switch button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === SI.lang); });
    $('howto-body').innerHTML = SI.t('howtoBody').map(function (p) { return '<p>' + p + '</p>'; }).join('');
    $('sfx-toggle').textContent = store.settings.sfx ? SI.t('on') : SI.t('off');
    renderSetupCards();
    renderRadio();
    if (game) {
      updateHud(true);
      if ($('ovl-tree').classList.contains('open')) renderTree();
      if ($('ovl-soc').classList.contains('open')) renderSoc();
      if (deptOpen) renderDept();
    }
  }
  function setLang(l) { SI.lang = l; store.settings.lang = l; save(); applyLang(); }

  // ------------------------------------------------------------ setup screen
  function defBars(co) {
    return Object.keys(SI.DEFENSES).map(function (k) {
      var v = k === 'backups' ? SI.BACKUP_LEVEL[co.backup] : co.def[k];
      var label = SI.L(SI.DEFENSES[k].name);
      if (k === 'backups') label += ': ' + SI.t('backups' + co.backup.charAt(0).toUpperCase() + co.backup.slice(1));
      return '<div class="def">' + SI.DEFENSES[k].icon + ' ' + label + '<div class="dbar"><i style="width:' + Math.round(v * 100) + '%"></i></div></div>';
    }).join('');
  }
  function bestFor(coId, advId) { return store.best[coId + '/' + advId]; }
  function renderSetupCards() {
    var cc = $('company-cards'), ac = $('adv-cards');
    cc.innerHTML = SI.COMPANIES.map(function (co, i) {
      var bests = Object.keys(store.best).filter(function (k) { return k.indexOf(co.id + '/') === 0 && store.best[k].won; }).length;
      return '<div class="card' + (i === sel.co ? ' sel' : '') + '" data-i="' + i + '">' +
        (bests ? '<span class="best">✓ ' + bests + '/' + SI.ADVERSARIES.length + '</span>' : '') +
        '<div class="stars">' + '★'.repeat(co.stars) + '☆'.repeat(5 - co.stars) + '</div>' +
        '<h4>' + SI.L(co.name) + '</h4><p>' + SI.L(co.blurb) + '</p>' +
        '<div class="defs">' + defBars(co) + '</div>' +
        '<div class="goal">' + SI.t('coMeta', { a: co.analysts, b: co.budget, t: co.trust }) + ' · ' + co.depts.reduce(function (s, d) { return s + (d.ws || 0) + (d.srv || 0) + (d.dc || 0) + (d.bkp || 0) + (d.web || 0) + (d.iot || 0); }, 0) + ' ⌂</div></div>';
    }).join('');
    var co = SI.COMPANIES[sel.co];
    var advs = [SI.UNKNOWN_ADV].concat(SI.ADVERSARIES);
    ac.innerHTML = advs.map(function (a, i) {
      var idx = i - 1, b = bestFor(co.id, a.id);
      return '<div class="card adv' + (idx === sel.adv ? ' sel' : '') + '" data-i="' + idx + '" style="--ac:' + (a.color || '#7f9bb8') + '">' +
        (b ? '<span class="best">' + SI.t('best') + ': ' + SI.L(b.rank) + '</span>' : '') +
        '<div class="stars">' + (a.stars ? '★'.repeat(a.stars) + '☆'.repeat(5 - a.stars) : '?????') + '</div>' +
        '<div class="vicon">' + a.icon + '</div><h4>' + SI.L(a.name) + '</h4><div class="atype">' + SI.L(a.type) + '</div><p>' + SI.L(a.blurb) + '</p>' +
        (a.kind ? '<div class="weak">' + SI.t('advKind_' + a.kind) + '</div>' : '') + '</div>';
    }).join('');
    qa('.card', cc).forEach(function (el) { el.onclick = function () { sel.co = +el.dataset.i; sfx('click'); renderSetupCards(); }; });
    qa('.card', ac).forEach(function (el) { el.onclick = function () { sel.adv = +el.dataset.i; sfx('click'); renderSetupCards(); }; });
  }

  // ------------------------------------------------------------ game start / loop
  function startGame() {
    var name = ($('team-name').value || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_\-./Ѐ-ӿ]/g, '') || randomName();
    sel.name = name;
    show('scr-game');
    var mr = $('map-wrap').getBoundingClientRect();
    var co = SI.COMPANIES[sel.co];
    var unknown = sel.adv < 0;
    var adv = unknown ? SI.ADVERSARIES[Math.floor(Math.random() * SI.ADVERSARIES.length)] : SI.ADVERSARIES[sel.adv];
    game = new SI.Game({ company: co, adversary: adv, unknown: unknown, name: name, onEvent: onGameEvent,
      cols: SI.mapCols && mr.height ? SI.mapCols(co.depts.length, mr.width / mr.height) : 0 });
    if (!view) view = new SI.MapView($('map'));
    view.resize();
    view.setGame(game);
    view.selected = null; view.selectedDept = null;
    speed = 1; $('btn-speed').textContent = '1×';
    acc = 0; lastFrame = performance.now(); paused = false; deptOpen = null; lowTrustWarned = false;
    tickerQueue = []; tickerBusyUntil = 0; socUnseen = 0;
    treeBranch = 'detect'; treeSel = null; socTab = 'alerts';
    $('hud-name').textContent = name;
    $('m-dmg-l').textContent = SI.t('dmg_' + adv.kind);
    pushTicker(SI.t('h_start', { target: SI.L(co.name) }), 'good');
    if (!store.settings.seenHint) {
      var h = $('hint'); h.textContent = SI.t('tapHint'); h.classList.remove('hidden');
      clearTimeout(hintTimer); hintTimer = setTimeout(function () { h.classList.add('hidden'); }, 15000);
    }
    if (store.settings.music) SI.Audio.play();
    SI.Audio.setIntensity(0.12);
    updateHud(true);
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!game) return;
    var dt = Math.min(250, now - lastFrame); lastFrame = now;
    if (!paused && !game.over) {
      acc += dt * speed;
      var step = SI.CONFIG.TICK_MS, ticked = false;
      while (acc >= step && !game.over) { acc -= step; game.tick(); ticked = true; }
      if (ticked) updateHud();
    }
    view.draw(paused || game.over ? 0 : Math.min(1, acc / SI.CONFIG.TICK_MS));
    $('budget-val').textContent = Math.floor(game.budget);
    updateTicker(now);
    rafId = requestAnimationFrame(frame);
  }

  var lastAffordable = -1;
  function setMeter(id, frac, text) {
    $(id).style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    if (text != null) $(id + '-v').textContent = text;
  }
  function updateHud(force) {
    var g = game, known = g.knownCount();
    setMeter('m-known', known / g.denom, known + (g.count('iso') ? ' · 🔒' + g.count('iso') : ''));
    setMeter('m-dmg', g.damage / 100, Math.round(g.damage) + '%');
    document.querySelector('.m-dmg').classList.toggle('hot', g.damage >= 50);
    setMeter('m-inv', g.investigation / 100, g.firstDetectAt < 0 ? SI.t('invLocked') : g.attributed ? g.advName() : Math.floor(g.investigation) + '%');
    document.querySelector('.m-inv').classList.toggle('off', g.firstDetectAt < 0);
    setMeter('m-plan', g.plan / 100, g.attributed ? Math.floor(g.plan) + '%' : SI.t('planLocked'));
    document.querySelector('.m-plan').classList.toggle('off', !g.attributed);
    document.querySelector('.m-plan').classList.toggle('ready', g.planReady && !g.eradicating);
    setMeter('m-trust', g.trust / 100, Math.round(g.trust) + '%');
    document.querySelector('.m-trust').classList.toggle('hot', g.trust < 25);
    var vis = g.visibility();
    setMeter('m-vis', vis, Math.round(vis * 100) + '%');
    $('hud-clock').textContent = 'T+ ' + ui.clock(g.t) + ' · ' + SI.L(g.co.name);
    var sevEl = $('hud-sev');
    sevEl.textContent = SI.t('sev' + g.sev);
    sevEl.className = 'sev s' + g.sev;
    $('analyst-val').textContent = g.freeAnalysts() + '/' + g.analysts;
    $('hud-analysts').classList.toggle('none', g.freeAnalysts() < 1);
    // eradicate button
    var eb = $('btn-erad'), el = $('erad-label');
    eb.classList.toggle('ready', g.planReady && !g.eradicating);
    eb.classList.toggle('running', g.eradicating);
    eb.disabled = !g.planReady || g.eradicating;
    el.textContent = g.eradicating ? SI.t('eradicating') : g.planReady ? '⚡ ' + SI.t('eradicate') :
      g.attributed ? SI.t('planBtn', { n: Math.floor(g.plan) }) : SI.t('attribBtn', { n: Math.floor(g.investigation) });
    var sb = $('soc-badge'); sb.textContent = socUnseen > 99 ? '99+' : socUnseen; sb.classList.toggle('hidden', socUnseen === 0);
    var n = SI.UPGRADES.filter(function (u) { return g.canBuy(u) && g.budget >= u.cost; }).length;
    if (n !== lastAffordable || force) {
      lastAffordable = n;
      var b = $('defense-badge'); b.textContent = n; b.classList.toggle('hidden', n === 0);
      $('btn-defense').classList.toggle('can', n > 0);
    }
    if ($('ovl-tree').classList.contains('open')) $('tree-budget').textContent = Math.floor(g.budget);
    if (g.trust < 25 && !lowTrustWarned) { lowTrustWarned = true; pushTicker(SI.t('h_lowTrust'), 'hot', true); }
    SI.Audio.setIntensity(g.eradicating ? 0.75 : [1, 0.95, 0.7, 0.42, 0.14][g.sev] + g.damage / 500);
  }

  // ------------------------------------------------------------ ticker
  function pushTicker(text, tone, urgent) {
    if (urgent) tickerQueue.unshift({ text: text, tone: tone }); else tickerQueue.push({ text: text, tone: tone });
    if (tickerQueue.length > 6) tickerQueue.splice(1, tickerQueue.length - 6);
  }
  function updateTicker(now) {
    if (now < tickerBusyUntil || !tickerQueue.length) return;
    var item = tickerQueue.shift();
    var box = $('ticker'), span = $('ticker-text');
    box.className = 'ticker' + (item.tone ? ' ' + item.tone : '');
    span.className = '';
    span.textContent = item.text;
    span.style.transform = 'translateX(0)';
    var overflow = span.scrollWidth - span.parentNode.clientWidth;
    var dur = 3600;
    if (overflow > 0) {
      dur = 2200 + overflow * 22;
      span.style.setProperty('--shift', -(overflow + 16) + 'px');
      span.style.setProperty('--dur', dur + 'ms');
      void span.offsetWidth; span.className = 'scroll';
      dur += 1200;
    }
    tickerBusyUntil = now + dur;
  }

  // ------------------------------------------------------------ engine events
  function onGameEvent(type, d) {
    if (!view) return;
    switch (type) {
      case 'headline': {
        var p = d.params || {};
        if (d.key === 'attributed') p.adv = SI.L(game.adv.name);
        pushTicker(SI.t('h_' + d.key, p), d.tone || 'good', true);
        sfx(d.key === 'planReady' ? 'plan' : d.tone === 'hot' ? 'alert' : 'triage');
        if (d.key === 'patient0') { view.flashRed(); vibrate(80); }
        if (d.key === 'attributed' || d.key === 'planReady') view.flashCyan();
        break;
      }
      case 'news': pushTicker('NEWS: ' + SI.L(d.event.t), ''); sfx('news'); break;
      case 'ttp':
        if (!d.active) break;
        pushTicker(d.seen ? SI.t('h_ttp', { name: d.id + ' ' + SI.techName(d.id) }) : SI.t('h_ttpUnk'), 'ai'); sfx('ttp'); break;
      case 'sev':
        if (d.level <= 2) { pushTicker(SI.t('h_sev' + d.level), 'hot', true); sfx('alert'); vibrate(d.level === 1 ? [80, 60, 80] : 60); }
        break;
      case 'detect':
        sfx('detect');
        if (d.src && d.src.known) view.trace(d.src, d.host, '#ffb020');
        break;
      case 'trace': view.trace(d.a, d.b, '#ff3b5c'); break;
      case 'block':
        if (Math.random() < 0.35) { view.ring(d.host, '#2ee6ff'); sfx('block'); }
        break;
      case 'impactStart':
        if (d.kind === 'mine') { pushTicker(SI.t('h_impactMine'), 'hot', true); break; }
        sfx('breach'); view.shake(); view.flashRed();
        $('map-wrap').classList.remove('shake'); void $('map-wrap').offsetWidth; $('map-wrap').classList.add('shake');
        vibrate([200, 80, 300]);
        break;
      case 'impact': sfx('impact'); break;
      case 'restore': sfx('restore'); break;
      case 'soc':
        socUnseen++;
        if ($('ovl-soc').classList.contains('open') && socTab === 'alerts') renderSoc();
        break;
      case 'isolateHost':
        sfx('isolate');
        if (d.auto) view.floatText(d.host.x, d.host.y, 'SOAR 🔒', '#5fd6ff');
        break;
      case 'huntDone':
        if (d.auto && !d.found) break;
        pushTicker(SI.t(d.found ? 'h_huntFound' : 'h_huntNone', { dept: SI.L(SI.DEPTS[d.dept.id]), n: d.found }), d.found ? 'hot' : 'good');
        if (deptOpen === d.dept) renderDept();
        break;
      case 'autoHunt': pushTicker(SI.t('h_autoHunt', { dept: SI.L(SI.DEPTS[d.dept.id]) }), 'good'); break;
      case 'quiet': if (game.firstDetectAt >= 0) pushTicker(SI.t('h_quiet'), 'good'); break;
      case 'reentry': if (!d.ok && game.firstDetectAt >= 0) pushTicker(SI.t('h_reentryFail'), 'good'); break;
      case 'eradicate': sfx('eradicate'); view.flashCyan(); vibrate([60, 40, 60, 40, 120]); break;
      case 'bought': sfx('buy'); break;
      case 'deptAction': if (d.act === 'isolate') sfx('segment'); break;
      case 'end':
        sfx(game.won() ? 'win' : 'lose');
        setTimeout(showEnd, 1400);
        break;
    }
  }
  function vibrate(p) { if (navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* no-op */ } }

  // ------------------------------------------------------------ map input
  function onMapPointer(e) {
    if (!game || game.over || paused) return;
    var r = $('map').getBoundingClientRect();
    var h = view.hit(e.clientX - r.left, e.clientY - r.top);
    if (!h) return;
    if (h.bubble) {
      var b = h.bubble;
      var gain = game.collectBubble(b.id);
      var isTp = b.type === 'ioc' || b.host.known;
      var what = b.type === 'ioc' ? SI.L(SI.TRIAGE.ioc[b.text]) : SI.L((b.tp ? SI.TRIAGE.tp : SI.TRIAGE.fp)[b.text]);
      view.floatText(b.host.x, b.host.y, '+' + money(gain), b.type === 'ioc' ? '#2ee6ff' : '#ffb020');
      if (b.type === 'ioc') { pushTicker(SI.t('iocFound', { what: what }), 'good', true); sfx('ioc'); }
      else if (isTp) { pushTicker(SI.t('tpFound', { what: what }) + ' → ' + b.host.name, 'hot', true); sfx('triage'); }
      else { ui.toast(SI.t('fpFound', { what: what })); sfx('fp'); }
      bump('hud-budget');
      if (!store.settings.seenHint) { store.settings.seenHint = true; save(); $('hint').classList.add('hidden'); }
      updateHud();
      return;
    }
    if (h.host && h.host.s === 'inf' && h.host.known) {
      if (game.isolateHost(h.host)) {
        view.floatText(h.host.x, h.host.y, '🔒 −' + money(game.isoCostOf()), '#5fd6ff');
        ui.toast(SI.t('isoDone', { host: h.host.name }), 'cyan');
        if (!store.settings.seenIsoTip) { store.settings.seenIsoTip = true; save(); }
        updateHud();
      } else { ui.toast(SI.t('isoPoor'), 'warn'); sfx('fp'); }
      return;
    }
    if (h.dept) openDept(h.dept, h.host);
  }

  // ------------------------------------------------------------ department sheet
  function openDept(d, host) {
    deptOpen = d;
    view.selectedDept = d;
    view.selected = host || null;
    sfx('click');
    renderDept();
    openOvl('ovl-dept');
  }
  function renderDept() {
    var g = game, d = deptOpen;
    if (!d) return;
    var known = 0, enc = 0, iso = 0;
    d.hosts.forEach(function (h) { if (h.s === 'inf' && h.known) known++; else if (h.s === 'enc') enc++; else if (h.s === 'iso') iso++; });
    $('dept-title').textContent = SI.L(SI.DEPTS[d.id]);
    $('dept-budget').textContent = Math.floor(g.budget);
    var pips = '';
    for (var i = 0; i < 3; i++) pips += '<i class="' + (i < d.sensor ? 'on' : '') + '"></i>';
    var kinds = {};
    d.hosts.forEach(function (h) { kinds[h.kind] = (kinds[h.kind] || 0) + 1; });
    var sel2 = view.selected && view.selected.dept === d ? view.selected : null;
    $('dept-info').innerHTML =
      '<div class="di-row"><span>' + SI.t('deptHosts', { n: d.hosts.length }) + ' · ' + Object.keys(kinds).map(function (k) { return kinds[k] + '× ' + SI.L(SI.KINDS[k]).split(' (')[0]; }).join(', ') + '</span></div>' +
      '<div class="di-row stats">' +
        (known ? '<b class="r">⚠ ' + SI.t('deptKnown', { n: known }) + '</b>' : '') +
        (enc ? '<b class="r">✖ ' + SI.t('deptImpacted', { n: enc }) + '</b>' : '') +
        (iso ? '<b class="c">🔒 ' + SI.t('deptIsoHosts', { n: iso }) + '</b>' : '') +
        '<span class="pips">' + SI.t('sensorLvl') + ' ' + pips + '</span>' +
      '</div>' +
      (sel2 ? '<div class="di-row sel">◎ <b>' + sel2.name + '</b> · ' + SI.L(SI.KINDS[sel2.kind]) + (sel2.patched && sel2.s === 'clean' ? ' · 🩹' : '') + (sel2.s === 'iso' ? ' · 🔒' : sel2.s === 'enc' ? ' · ✖' : '') + '</div>' : '') +
      (known && !store.settings.seenIsoTip ? '<div class="di-row tip">' + SI.t('tapHostTip') + '</div>' : '');
    var acts = [
      { act: 'sensor', icon: '📡', label: SI.t('act_sensor') + ' ' + (d.sensor < 3 ? '(' + (d.sensor + 1) + '/3)' : ''), desc: SI.t('act_sensorD') },
      { act: 'hunt', icon: '🔎', label: SI.t('act_hunt'), desc: SI.t('act_huntD'), extra: ' · 👤' },
      { act: 'reimage', icon: '🧹', label: SI.t('act_reimage', { n: known }), desc: SI.t('act_reimageD') },
      { act: 'isolate', icon: '🔒', label: d.isolated ? SI.t('act_unisolate') : SI.t('act_isolate'), desc: SI.t('act_isolateD'), cls: d.isolated ? 'on' : 'warnact' }
    ];
    if (enc) acts.push({ act: 'restore', icon: '💾', label: SI.t('act_restore', { n: Math.min(3, enc) }), desc: SI.t(g.backup === 'none' ? 'act_rebuildD' : 'act_restoreD') });
    $('dept-actions').innerHTML = acts.map(function (a) {
      var r = g.deptAction(d, a.act, true);
      var right = r.ok ? (r.cost ? money(r.cost) : SI.t('free')) : SI.t('r_' + r.reason);
      if (a.act === 'hunt' && d.hunt) right = SI.t('r_busy');
      return '<button class="dact ' + (a.cls || '') + '" data-act="' + a.act + '" ' + (r.ok ? '' : 'disabled') + '>' +
        '<span class="di">' + a.icon + '</span><span class="dt"><b>' + a.label + '</b><small>' + a.desc + '</small></span>' +
        '<span class="dc">' + right + (a.extra && r.ok ? a.extra : '') + '</span></button>';
    }).join('');
    qa('.dact', $('dept-actions')).forEach(function (btn) {
      btn.onclick = function () {
        var res = game.deptAction(d, btn.dataset.act);
        if (res.ok) {
          sfx(btn.dataset.act === 'isolate' ? 'segment' : btn.dataset.act === 'reimage' ? 'isolate' : 'buy');
          if (btn.dataset.act === 'isolate' || btn.dataset.act === 'reimage') { closeOvl('ovl-dept'); }
          else renderDept();
          updateHud(true);
        }
      };
    });
  }

  // ------------------------------------------------------------ defense tree
  function renderTree() {
    var g = game;
    $('tree-budget').textContent = Math.floor(g.budget);
    $('tree-tabs').innerHTML = SI.BRANCHES.map(function (b) {
      var owned = SI.UPGRADES.filter(function (u) { return u.branch === b.id && g.owned[u.id]; }).length;
      var total = SI.UPGRADES.filter(function (u) { return u.branch === b.id; }).length;
      var afford = SI.UPGRADES.some(function (u) { return u.branch === b.id && g.canBuy(u) && g.budget >= u.cost; });
      return '<button style="--c:' + b.color + '" class="' + (b.id === treeBranch ? 'on' : '') + (afford ? ' can' : '') + '" data-b="' + b.id + '">' + SI.L(b.name) + '<small>' + owned + '/' + total + '</small></button>';
    }).join('');
    qa('#tree-tabs button').forEach(function (btn) {
      btn.onclick = function () { treeBranch = btn.dataset.b; treeSel = null; sfx('click'); renderTree(); };
    });
    var branch = SI.BRANCHES.filter(function (b) { return b.id === treeBranch; })[0];
    var ups = SI.UPGRADES.filter(function (u) { return u.branch === treeBranch; });
    if (!treeSel || upgradeById(treeSel).branch !== treeBranch) {
      var firstAvail = ups.filter(function (u) { return g.canBuy(u); })[0];
      treeSel = (firstAvail || ups[0]).id;
    }
    var grid = $('tree-grid');
    grid.innerHTML = ups.map(function (u) {
      var cls = g.owned[u.id] ? 'owned' : g.canBuy(u) ? 'avail' : 'locked';
      if (cls === 'avail' && g.budget >= u.cost) cls += ' afford';
      if (u.id === treeSel) cls += ' sel';
      return '<div class="node ' + cls + '" style="--c:' + branch.color + ';grid-row:' + (u.tier + 1) + ';grid-column:' + (u.col + 1) + '" data-id="' + u.id + '">' +
        '<div class="nname">' + SI.L(u.name) + '</div><div class="ncost">' + (g.owned[u.id] ? '✓' : '$' + u.cost + 'K') + '</div></div>';
    }).join('');
    qa('.node', grid).forEach(function (el) {
      el.onclick = function () { treeSel = el.dataset.id; sfx('click'); renderTree(); };
    });
    requestAnimationFrame(function () {
      var svg = $('tree-lines'), wrap = svg.parentNode, wr = wrap.getBoundingClientRect();
      svg.setAttribute('width', wrap.scrollWidth); svg.setAttribute('height', wrap.scrollHeight);
      var lines = '';
      ups.forEach(function (u) {
        u.req.forEach(function (r) {
          var a = grid.querySelector('[data-id="' + r + '"]'), b = grid.querySelector('[data-id="' + u.id + '"]');
          if (!a || !b) return;
          var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
          var x1 = ar.left + ar.width / 2 - wr.left + wrap.scrollLeft, y1 = ar.top + ar.height / 2 - wr.top + wrap.scrollTop;
          var x2 = br.left + br.width / 2 - wr.left + wrap.scrollLeft, y2 = br.top + br.height / 2 - wr.top + wrap.scrollTop;
          var on = g.owned[r];
          lines += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (on ? branch.color : '#1f3d5e') + '" stroke-width="' + (on ? 3 : 2) + '" ' + (on ? '' : 'stroke-dasharray="5 5"') + ' opacity="' + (on ? 0.9 : 0.8) + '"/>';
        });
      });
      svg.innerHTML = lines;
    });
    // detail
    var u = upgradeById(treeSel);
    var state = g.owned[u.id] ? 'owned' : !g.canBuy(u) ? 'locked' : g.budget < u.cost ? 'poor' : 'ok';
    var btnLabel = state === 'owned' ? '✓ ' + SI.t('owned') : state === 'locked' ? SI.t('locked') : state === 'poor' ? SI.t('needBudget') + ' · $' + u.cost + 'K' : SI.t('buy') + ' · $' + u.cost + 'K';
    var csf = SI.CSF[u.csf];
    var counters = (u.counters || []).map(function (id) { return techTag(id, g.A.ttps.some(function (x) { return x.id === id && x.seen; })); }).join('');
    $('tree-detail').innerHTML =
      '<div class="td-head"><h3 style="color:' + branch.color + '">' + SI.L(u.name) + '</h3><span class="csf">' + csf.short + ' · ' + SI.L(csf) + '</span></div>' +
      (SI.label('upgrades', u.id) ? '<div class="tac rlrow">' + labelTag('upgrades', u.id) + '</div>' : '') +
      '<p class="eff">' + SI.L(u.desc) + '</p>' +
      '<button class="btn btn-primary btn-wide" id="tree-buy" ' + (state === 'ok' ? '' : 'disabled') + '>' + btnLabel + '</button>' +
      '<div class="lore"><div class="lh">▌' + SI.t('loreLbl') + '</div><p>' + SI.L(u.lore) + '</p></div>' +
      '<div class="tools"><div class="lh">▌' + SI.t('toolsLbl') + '</div>' + u.tools.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
      (counters ? '<div class="ctr"><div class="lh">▌' + SI.t('countersLbl') + ' · MITRE ATT&CK</div>' + counters + '</div>' : '');
    $('tree-detail').scrollTop = 0;
    $('tree-buy').onclick = function () {
      if (game.buy(u.id)) { renderTree(); updateHud(true); }
    };
  }

  // ------------------------------------------------------------ SOC console
  function socText(a) {
    var tpl = SI.SOC[a.key];
    var up = a.up ? a.up + ' ' + SI.techName(a.up) : '';
    return SI.fmt(SI.L(tpl), { host: a.host || '?', src: a.src || '?', up: up });
  }
  function renderSoc() {
    var g = game;
    socUnseen = 0;
    qa('#soc-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === socTab); });
    $('soc-stats').textContent = SI.t('sDetect') + ': ' + g.stats.detections;
    $('soc-list').classList.toggle('hidden', socTab !== 'alerts');
    $('adv-pane').classList.toggle('hidden', socTab !== 'adv');
    if (socTab === 'alerts') {
      var list = g.socLog.slice().reverse();
      $('soc-list').innerHTML = list.length ? list.map(function (a) {
        return '<li class="' + a.sev + '"><span class="st">' + ui.clock(a.t) + '</span>' +
          '<span class="sv">' + a.sev.toUpperCase() + '</span>' +
          '<span class="sm">' + esc(socText(a)) + '</span></li>';
      }).join('') : '<li class="empty">' + SI.t('socEmpty') + '</li>';
    } else renderAdvPane();
    updateHud();
  }
  function ttpRow(x, g, full) {
    var def = SI.TTPS[x.id];
    if (!x.seen && !full) return '<li class="ttp unk"><b>T????</b> ' + SI.t('ttpHidden') + '</li>';
    var ctr = (def.counter || []).map(function (id) { var u = upgradeById(id); return '<span class="cu' + (g.owned[id] ? ' on' : '') + '">' + (g.owned[id] ? '✓ ' : '') + SI.L(u.name) + '</span>'; }).join('');
    return '<li class="ttp"><div class="th"><b>' + x.id + '</b> ' + SI.L(def.name) + ' <small>' + (SI.lang === 'uk' ? SI.ATTACK_TACTICS_UK[def.tactic] : def.tactic) + '</small></div>' +
      '<div class="tn">' + SI.L(def.note) + '</div>' + (ctr ? '<div class="tc">' + SI.t('counterLbl') + ': ' + ctr + '</div>' : '') + '</li>';
  }
  function renderAdvPane() {
    var g = game, a = advOf(g), html = '';
    var named = !g.unknown || g.attributed;
    if (g.firstDetectAt < 0 && g.unknown) {
      html = '<div class="adv-card unknown"><div class="ai">❓</div><h3>' + SI.t('advUnknown') + '</h3><p>' + SI.t('advUnknownTxt') + '</p></div>';
    } else {
      html = '<div class="adv-card" style="--ac:' + (named ? a.color : '#7f9bb8') + '"><div class="ai">' + (named ? a.icon : '❓') + '</div>' +
        '<h3>' + (named ? SI.L(a.name) : SI.t('advUnknown')) + '</h3>' + (named ? '<div class="atype">' + SI.L(a.type) + '</div>' : '') +
        (named ? '<p>' + SI.L(a.lore) + '</p>' : '') +
        (!g.attributed ? '<p class="warn">' + (g.firstDetectAt < 0 ? SI.t('advUnknownTxt') : SI.t('advPartial')) + '</p>' : '') + '</div>';
      if (g.attributed) {
        var v = g.vector;
        html += '<div class="adv-facts"><div><small>' + SI.t('vectorLbl') + '</small>' + v.icon + ' ' + SI.L(v.name) + ' ' + techTag(v.tech) + '</div>' +
          '<div><small>' + SI.t('objectiveLbl') + '</small>' + SI.t('advKind_' + a.kind) + '</div>' +
          (a.kind === 'wipe' ? '<div><small>' + SI.t('wipeAtLbl') + '</small>' + ui.clock(g.A.wipeAt) + '</div>' : '') + '</div>';
      }
      if (g.firstDetectAt >= 0) {
        var ttps = g.A.ttps.filter(function () { return true; });
        html += '<h4>' + SI.t('ttpsLbl') + '</h4><ol class="ttp-list">' + (ttps.length ? ttps.map(function (x) { return ttpRow(x, g); }).join('') : '<li class="empty">' + SI.t('noTtps') + '</li>') + '</ol>';
      }
    }
    $('adv-pane').innerHTML = html;
  }

  // ------------------------------------------------------------ end screen
  function showEnd() {
    var g = game, win = g.won();
    SI.Audio.setIntensity(win ? 0.45 : 0.1);
    show('scr-end');
    $('scr-end').scrollTop = 0;
    $('scr-end').className = 'screen active ' + (win ? 'win' : g.outcome === 'fired' ? 'fired' : 'lose');
    var title = ui.outcomeTitle(g);
    $('end-title').textContent = title; $('end-title').setAttribute('data-text', title);
    var subKey = g.outcome === 'breach' ? 'breach_' + g.adv.kind + 'Sub' : g.outcome + 'Sub';
    $('end-sub').textContent = SI.t(subKey, { adv: SI.L(g.adv.name), target: SI.L(g.co.name) });

    var score = g.score(), key = g.co.id + '/' + g.adv.id, prev = store.best[key];
    if (!prev || score > prev.score) {
      var rk = g.rank();
      store.best[key] = { score: score, rank: { en: rk.en, uk: rk.uk }, won: win || (prev && prev.won) };
      save();
    }

    var card = SI.renderCard(g);
    ui._card = card;
    $('share-img').src = card.toDataURL('image/png');
    $('btn-tgshare').href = SI.telegramShareUrl(g);

    var dwell = g.firstDetectAt >= 0 ? ui.clock(g.firstDetectAt + (g.stats.headStart || 0)) : SI.t('never');
    var st = [
      [SI.t('sRank'), SI.L(g.rank())],
      [SI.t('sTime'), ui.clock(g.t)],
      [SI.t('sAdv'), g.adv.icon + ' ' + SI.L(g.adv.name)],
      [SI.t('sVector'), g.vector.icon + ' ' + SI.L(g.vector.name)],
      [SI.t('sDwell'), dwell],
      [SI.t('sDetect'), g.stats.detections],
      [SI.t('sContained'), g.stats.contained],
      [SI.t('sTriaged'), g.stats.triaged + ' / ' + g.stats.fps],
      [SI.t('sDamage'), Math.round(g.peakDamage) + '%'],
      [SI.t('sTrust'), Math.round(g.trust) + '%'],
      [SI.t('sUpgrades'), g.stats.upgrades + ' / ' + SI.UPGRADES.length]
    ];
    $('stat-grid').innerHTML = st.map(function (s) { return '<div class="stat"><small>' + s[0] + '</small><b>' + s[1] + '</b></div>'; }).join('');

    // debrief
    var items = [];
    var top = g.topCounters();
    if (win) {
      $('debrief-title').textContent = SI.t('worked');
      top.slice(0, 4).forEach(function (c) {
        items.push('<li><span class="dname">' + SI.DEFENSES[c.def].icon + ' ' + SI.L(SI.DEFENSES[c.def].name) + '</span><br>' + SI.fmt(SI.L(SI.COUNTER_TEXT[c.key]), { n: c.n }) + '</li>');
      });
    } else {
      $('debrief-title').textContent = SI.t('gaps');
      gapsOf(g).forEach(function (x) { items.push('<li class="weak">' + x + '</li>'); });
      top.slice(0, 2).forEach(function (c) {
        items.push('<li><span class="dname">' + SI.DEFENSES[c.def].icon + ' ' + SI.L(SI.DEFENSES[c.def].name) + '</span><br>' + SI.fmt(SI.L(SI.COUNTER_TEXT[c.key]), { n: c.n }) + '</li>');
      });
    }
    $('debrief').innerHTML = items.join('');

    // adversary report: entry vector + every technique, with your counters
    var v = g.vector;
    var rep = '<div class="ar-vec">' + v.icon + ' <b>' + SI.t('vectorLbl') + ':</b> ' + SI.L(v.name) + ' ' + techTag(v.tech) +
      ' <span class="cu' + ((g.D[v.counter] || 0) >= 0.5 ? ' on' : '') + '">' + (v.counter === 'ueba' ? 'UEBA' : SI.L(SI.DEFENSES[v.counter].name)) + ' ' + Math.round((g.D[v.counter] || 0) * 100) + '%</span></div>';
    rep += '<ol class="ttp-list">' + g.A.ttps.map(function (x) { return ttpRow(x, g, true); }).join('') + '</ol>';
    $('adv-report').innerHTML = rep;

    // program by CSF function
    $('program').innerHTML = SI.CSF_ORDER.map(function (k) {
      var list = SI.UPGRADES.filter(function (u) { return u.csf === k && g.owned[u.id]; });
      return '<div class="pb' + (list.length ? ' on' : '') + '"><div class="pbh"><span class="pbs">' + SI.CSF[k].short + '</span> ' + SI.L(SI.CSF[k]) + ' <em>' + list.length + '</em></div>' +
        (list.length ? '<div class="pbl">' + list.map(function (u) { return '<span>' + SI.L(u.name) + (SI.label('upgrades', u.id) && SI.label('upgrades', u.id).id ? ' <i>' + SI.label('upgrades', u.id).id + '</i>' : '') + '</span>'; }).join('') + '</div>' : '') + '</div>';
    }).join('');

    // lesson
    if (win) {
      var best = top.length ? SI.L(SI.DEFENSES[top[0].def].name) : SI.L(SI.DEFENSES.vis.name);
      $('lesson').textContent = SI.fmt(SI.L(SI.LESSON.win), { best: best });
    } else if (g.outcome === 'fired') {
      $('lesson').textContent = SI.L(SI.LESSON.fired);
    } else {
      var gap = v.counter === 'ueba' ? 'UEBA' : SI.L(SI.DEFENSES[v.counter].name);
      $('lesson').textContent = SI.fmt(SI.L(SI.LESSON.breach), { gap: gap });
    }
  }

  // Missing answers to what the adversary actually did.
  function gapsOf(g) {
    var out = [], v = g.vector, uk = SI.lang === 'uk';
    var cv = g.D[v.counter] || 0, cname = v.counter === 'ueba' ? 'UEBA' : SI.L(SI.DEFENSES[v.counter].name);
    out.push('<span class="dname">' + v.icon + ' ' + SI.L(v.name) + '</span><br>' + (uk
      ? 'Вони зайшли через ' + v.tech + ', а ваш захист «' + cname + '» був на ' + Math.round(cv * 100) + '%. Кожна хвиля поверталася тими самими дверима.'
      : 'They came in via ' + v.tech + ' while your ' + cname + ' sat at ' + Math.round(cv * 100) + '%. Every new wave came back through the same door.'));
    var missing = g.A.ttps.filter(function (x) { var d = SI.TTPS[x.id]; return d.counter && !d.counter.some(function (id) { return g.owned[id]; }); });
    missing.slice(0, 3).forEach(function (x) {
      var d = SI.TTPS[x.id];
      out.push('<span class="dname">' + x.id + ' ' + SI.L(d.name) + '</span><br>' + SI.L(d.note) + '<div class="tip">↳ ' + d.counter.map(function (id) { return SI.L(upgradeById(id).name); }).join(', ') + '</div>');
    });
    if (g.firstDetectAt < 0 || g.firstDetectAt > 120) out.push('<span class="dname">📡 ' + SI.L(SI.DEFENSES.vis.name) + '</span><br>' + (uk
      ? 'Вони довго лишалися непоміченими. Більше видимості (SIEM, телеметрія, сенсори) означає раннє виявлення, коли вони ще малі.'
      : 'They stayed unseen for a long time. More visibility (SIEM, telemetry, sensors) means catching them while they are still small.'));
    if (!g.attributed) out.push('<span class="dname">🧭 ' + SI.t('mInv') + '</span><br>' + (uk
      ? 'Ви так і не встановили, хто це. Без атрибуції немає плану ліквідації: часткові зачистки лише вчать їх ховатися.'
      : 'You never attributed them. Without attribution there is no eradication plan: piecemeal cleanups only teach them to hide.'));
    return out;
  }

  // ------------------------------------------------------------ radio panel
  function fmtTime(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function renderRadio() {
    var A = SI.Audio;
    $('radio-track').textContent = A.tracks[A.trackIndex].name;
    $('radio-toggle').textContent = A.playing ? '⏸' : '▶';
    var on = $('radio-onair'); on.textContent = A.playing ? SI.t('onAir') : SI.t('offAir'); on.classList.toggle('on', A.playing);
    $('radio-list').innerHTML = A.tracks.map(function (t, i) {
      return '<li class="' + (i === A.trackIndex ? 'on' : '') + '" data-i="' + i + '">' + t.name + '<span>' + fmtTime(A.trackSeconds) + '</span></li>';
    }).join('');
    qa('#radio-list li').forEach(function (li) { li.onclick = function () { A.select(+li.dataset.i); store.settings.music = true; save(); }; });
  }
  function radioViz() {
    if (!$('ovl-radio').classList.contains('open')) return;
    requestAnimationFrame(radioViz);
    var A = SI.Audio, cv = $('radio-viz'), c = cv.getContext('2d');
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w) { cv.width = w; cv.height = h; }
    c.clearRect(0, 0, w, h);
    $('radio-time').textContent = fmtTime(A.trackElapsed) + ' / ' + fmtTime(A.trackSeconds);
    if (!A.analyser) return;
    var data = new Uint8Array(A.analyser.frequencyBinCount);
    A.analyser.getByteFrequencyData(data);
    var n = 40, bw = w / n;
    for (var i = 0; i < n; i++) {
      var v = data[Math.floor(i * data.length / n * 0.8)] / 255;
      var bh = Math.max(2, v * h * 0.95);
      var grd = c.createLinearGradient(0, h, 0, h - bh);
      grd.addColorStop(0, '#2e7bff'); grd.addColorStop(1, '#2ee6ff');
      c.fillStyle = grd;
      c.fillRect(i * bw + 1, h - bh, bw - 2, bh);
    }
  }
  function openRadio() {
    SI.Audio.unlock();
    renderRadio();
    openOvl('ovl-radio');
    radioViz();
  }

  // ------------------------------------------------------------ title radar
  var radarOn = false;
  function startRadar() { if (!radarOn) { radarOn = true; requestAnimationFrame(radar); } }
  function stopRadar() { radarOn = false; }
  var blips = [];
  function radar(now) {
    if (!radarOn) return;
    requestAnimationFrame(radar);
    var cv = $('title-radar'), c = cv.getContext('2d');
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var cx = w / 2, cy = h * 0.5, R = Math.max(w, h) * 0.62, ang = (now / 2600) % 1 * Math.PI * 2;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(46,230,255,0.08)'; c.lineWidth = 1;
    for (var k = 1; k <= 5; k++) { c.beginPath(); c.arc(cx, cy, R * k / 5, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke();
    var grd = c.createConicGradient ? c.createConicGradient(ang - 0.6, cx, cy) : null;
    if (grd) {
      grd.addColorStop(0, 'rgba(46,230,255,0)'); grd.addColorStop(0.095, 'rgba(46,230,255,0.16)'); grd.addColorStop(0.1, 'rgba(46,230,255,0)');
      c.fillStyle = grd; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, ang - 0.6, ang); c.closePath(); c.fill();
    }
    if (blips.length < 7 && Math.random() < 0.02) blips.push({ a: Math.random() * Math.PI * 2, d: 0.15 + Math.random() * 0.8, t: now, red: Math.random() < 0.35 });
    blips = blips.filter(function (b) {
      var age = (now - b.t) / 4000;
      if (age > 1) return false;
      c.fillStyle = b.red ? 'rgba(255,59,92,' + (1 - age) + ')' : 'rgba(61,255,168,' + (1 - age) * 0.8 + ')';
      c.beginPath(); c.arc(cx + Math.cos(b.a) * b.d * R, cy + Math.sin(b.a) * b.d * R, b.red ? 4 : 3, 0, Math.PI * 2); c.fill();
      return true;
    });
  }

  // ------------------------------------------------------------ wiring
  function init() {
    load();
    SI.lang = store.settings.lang || ((navigator.language || '').toLowerCase().indexOf('uk') === 0 ? 'uk' : 'en');
    SI.Audio.sfxOn = store.settings.sfx;
    SI.Audio.volume = store.settings.volume / 100;
    $('radio-vol').value = store.settings.volume;
    $('ver').textContent = SI.CONFIG.VERSION;

    if (SI.telegramReady()) {
      ['btn-channel', 'btn-channel-end'].forEach(function (id) {
        var el = $(id);
        el.href = SI.CONFIG.TELEGRAM_CHANNEL_URL;
        el.querySelector('.ch-logo').src = SI.CONFIG.CHANNEL_LOGO;
        el.querySelector('.ch-name').textContent = SI.CONFIG.CHANNEL_NAME || SI.CONFIG.TELEGRAM_CHANNEL_URL.replace(/^https:\/\//, '');
        el.classList.remove('hidden');
      });
    }

    document.addEventListener('pointerdown', function once() { SI.Audio.unlock(); document.removeEventListener('pointerdown', once); }, { passive: true });

    qa('.lang-switch button').forEach(function (b) { b.onclick = function () { setLang(b.getAttribute('data-lang')); sfx('click'); }; });
    qa('[data-close]').forEach(function (b) {
      b.onclick = function () { var o = b.closest('.overlay'); closeOvl(o.id); sfx('click'); };
    });
    qa('.overlay').forEach(function (o) {
      o.addEventListener('click', function (e) { if (e.target === o) closeOvl(o.id); });
    });

    $('btn-play').onclick = function () { sfx('click'); if (!$('team-name').value) $('team-name').value = randomName(); show('scr-setup'); renderSetupCards(); };
    $('btn-howto').onclick = function () { sfx('click'); openOvl('ovl-howto'); };
    $('btn-radio-title').onclick = function () { sfx('click'); openRadio(); };
    $('setup-back').onclick = function () { sfx('click'); show('scr-title'); };
    $('name-reroll').onclick = function () { sfx('click'); $('team-name').value = randomName(); };
    $('btn-start').onclick = function () { SI.Audio.unlock(); startGame(); };

    $('btn-menu').onclick = function () { sfx('click'); openOvl('ovl-menu'); };
    $('btn-radio').onclick = function () { sfx('click'); openRadio(); };
    $('btn-speed').onclick = function () {
      speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; this.textContent = speed + '×'; sfx('click');
    };
    $('btn-defense').onclick = function () { sfx('click'); renderTree(); openOvl('ovl-tree'); };
    $('btn-soc').onclick = function () { sfx('click'); renderSoc(); openOvl('ovl-soc'); };
    qa('#soc-tabs button').forEach(function (b) { b.onclick = function () { socTab = b.dataset.tab; sfx('click'); renderSoc(); }; });
    $('btn-erad').onclick = function () {
      if (!game || !game.planReady || game.eradicating) return;
      sfx('click');
      var w = [];
      if (game.visibility() < 0.45) w.push(SI.t('confirmLowVis'));
      if ((game.adv.kind === 'encrypt' && !game.detonated && game.A.canEncrypt) || (game.adv.kind === 'wipe' && !game.wiping && game.A.canWipe)) w.push(SI.t('confirmImpact'));
      $('confirm-warn').textContent = w.join(' ');
      openOvl('ovl-confirm');
    };
    $('confirm-yes').onclick = function () { closeOvl('ovl-confirm'); game.launchEradication(); updateHud(true); };

    $('map').addEventListener('pointerdown', onMapPointer);
    window.addEventListener('resize', function () { if (view && game) view.resize(); });
    if (window.ResizeObserver) new ResizeObserver(function () { if (view && game) view.resize(); }).observe($('map-wrap'));
    window.addEventListener('orientationchange', function () { setTimeout(function () { if (view && game) view.resize(); }, 250); });

    $('menu-howto').onclick = function () { sfx('click'); openOvl('ovl-howto'); };
    $('menu-radio').onclick = function () { sfx('click'); closeOvl('ovl-menu'); openRadio(); };
    $('sfx-toggle').onclick = function () {
      store.settings.sfx = !store.settings.sfx; SI.Audio.sfxOn = store.settings.sfx; save();
      this.textContent = store.settings.sfx ? SI.t('on') : SI.t('off');
    };
    $('menu-quit').onclick = function () {
      closeOvl('ovl-menu'); cancelAnimationFrame(rafId); game = null; show('scr-title'); SI.Audio.setIntensity(0.12);
    };

    $('radio-toggle').onclick = function () { SI.Audio.toggle(); store.settings.music = SI.Audio.playing; save(); };
    $('radio-next').onclick = function () { SI.Audio.next(); };
    $('radio-prev').onclick = function () { SI.Audio.prev(); };
    $('radio-vol').oninput = function () { store.settings.volume = +this.value; SI.Audio.setVolume(this.value / 100); save(); };
    SI.Audio.onChange(renderRadio);

    $('btn-share').onclick = function () { if (game && ui._card) SI.shareResult(game, ui._card); };
    $('btn-save').onclick = function () { if (ui._card) SI.saveCard(ui._card); };
    $('btn-again').onclick = function () { sfx('click'); show('scr-setup'); renderSetupCards(); };
    $('btn-end-menu').onclick = function () { sfx('click'); show('scr-title'); };

    document.addEventListener('visibilitychange', function () {
      SI.Audio.setHidden(document.hidden);
      if (document.hidden && game && !game.over && $('scr-game').classList.contains('active')) openOvl('ovl-menu');
    });

    applyLang();
    startRadar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
