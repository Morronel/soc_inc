// SOC Inc. — end-of-run result card (canvas -> PNG) and share helpers
window.SI = window.SI || {};

(function () {
  'use strict';

  var logo = null;
  if (typeof Image !== 'undefined' && SI.CONFIG.CHANNEL_LOGO) { logo = new Image(); logo.src = SI.CONFIG.CHANNEL_LOGO; }

  function fitText(c, text, maxW, size, weight, family) {
    var s = size;
    do { c.font = weight + ' ' + s + 'px ' + family; s -= 2; } while (c.measureText(text).width > maxW && s > 12);
  }

  SI.renderCard = function (g) {
    var W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var win = g.won();
    var accent = win ? '#2ee6ff' : g.outcome === 'fired' ? '#ffb020' : '#ff3b5c';
    var display = '"Exo 2", "JetBrains Mono", sans-serif', mono = '"JetBrains Mono", monospace';

    // background
    var bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#071425'); bg.addColorStop(1, '#03070d');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    var glow = c.createRadialGradient(W / 2, 260, 40, W / 2, 260, 720);
    glow.addColorStop(0, win ? 'rgba(46,230,255,0.32)' : 'rgba(255,59,92,0.3)'); glow.addColorStop(1, 'transparent');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    // hex grid
    c.strokeStyle = 'rgba(46,230,255,0.08)'; c.lineWidth = 2;
    for (var row = 0; row < 18; row++) for (var col = 0; col < 12; col++) {
      var hx = col * 96 + (row % 2) * 48, hy = row * 84;
      c.beginPath();
      for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i + Math.PI / 6; c.lineTo(hx + Math.cos(a) * 48, hy + Math.sin(a) * 48); }
      c.closePath(); c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,0.16)';
    for (var s = 0; s < H; s += 4) c.fillRect(0, s, W, 1);

    // frame
    c.strokeStyle = accent; c.lineWidth = 4;
    c.beginPath(); c.moveTo(60, 40); c.lineTo(W - 40, 40); c.lineTo(W - 40, H - 60); c.lineTo(W - 60, H - 40); c.lineTo(40, H - 40); c.lineTo(40, 60); c.closePath(); c.stroke();

    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillStyle = '#3dffa8'; c.font = '700 30px ' + mono;
    c.fillText('// SOC INC.', W / 2, 120);

    // outcome
    var title = SI.ui.outcomeTitle(g);
    fitText(c, title, W - 160, 96, '900', display);
    c.shadowColor = accent; c.shadowBlur = 40; c.fillStyle = accent;
    c.fillText(title, W / 2, 255);
    c.shadowBlur = 0;

    // team + matchup
    c.fillStyle = '#7f9bb8'; c.font = '700 28px ' + mono;
    c.fillText(SI.lang === 'uk' ? 'КОМАНДА SOC' : 'SOC TEAM', W / 2, 340);
    fitText(c, g.name, W - 200, 70, '800', display);
    c.fillStyle = '#2ee6ff'; c.shadowColor = '#2ee6ff'; c.shadowBlur = 20;
    c.fillText(g.name, W / 2, 412); c.shadowBlur = 0;
    var vs = SI.L(g.co.name) + '  vs  ' + SI.L(g.adv.name);
    c.fillStyle = '#dcecff'; fitText(c, vs, W - 180, 38, '700', mono);
    c.fillText(vs, W / 2, 472);

    // ring: how much of the business survived
    var pct = Math.round(100 - g.peakDamage);
    var cx = W / 2, cy = 680, R = 150;
    c.lineWidth = 26; c.strokeStyle = '#11243a';
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    var ringCol = pct >= 70 ? '#3dffa8' : pct >= 40 ? '#ffb020' : '#ff3b5c';
    c.strokeStyle = ringCol; c.shadowColor = ringCol; c.shadowBlur = 25;
    c.beginPath(); c.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct / 100); c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = '#fff'; c.font = '900 92px ' + display; c.fillText(pct + '%', cx, cy + 24);
    c.fillStyle = '#7f9bb8'; c.font = '700 24px ' + mono; c.fillText(SI.lang === 'uk' ? 'БІЗНЕС УЦІЛІВ' : 'BUSINESS INTACT', cx, cy + 66);

    // stat row
    var stats = [
      [SI.t('sTime'), SI.ui.clock(g.t)],
      [SI.t('sDetect'), g.stats.detections],
      [SI.t('mTrust'), Math.round(g.trust) + '%']
    ];
    stats.forEach(function (st, k) {
      var x = 200 + k * 340;
      c.fillStyle = '#7f9bb8'; fitText(c, st[0], 300, 22, '700', mono); c.fillText(st[0], x, 900);
      c.fillStyle = '#ffb020'; c.font = '700 40px ' + mono; c.fillText(st[1], x, 950);
    });

    // rank badge
    var rank = SI.L(g.rank());
    c.font = '800 46px ' + display;
    var rw = c.measureText(rank).width + 80;
    c.fillStyle = 'rgba(5,12,22,0.85)'; c.strokeStyle = '#3dffa8'; c.lineWidth = 3;
    c.beginPath(); c.rect(W / 2 - rw / 2, 1040, rw, 90); c.fill(); c.stroke();
    c.fillStyle = '#3dffa8'; c.fillText(rank, W / 2, 1102);

    // footer
    c.fillStyle = '#dcecff'; c.font = '700 26px ' + mono;
    var url = SI.gameUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');
    c.fillText(url || 'soc inc.', W / 2, 1220);
    if (SI.telegramReady()) {
      var tg = SI.CONFIG.TELEGRAM_CHANNEL_URL.replace(/^https?:\/\//, '');
      var ready = logo && logo.complete && logo.naturalWidth > 0, lr = 22;
      var tw = c.measureText(tg).width, x0 = W / 2 - (tw + (ready ? lr * 2 + 14 : 0)) / 2;
      if (ready) {
        c.save(); c.beginPath(); c.arc(x0 + lr, 1253, lr, 0, Math.PI * 2); c.clip();
        c.drawImage(logo, x0, 1253 - lr, lr * 2, lr * 2); c.restore();
        c.strokeStyle = '#2ee6ff'; c.lineWidth = 2; c.beginPath(); c.arc(x0 + lr, 1253, lr, 0, Math.PI * 2); c.stroke();
      }
      c.textAlign = 'left'; c.fillStyle = '#2aa3e0';
      c.fillText(tg, x0 + (ready ? lr * 2 + 14 : 0), 1262);
      c.textAlign = 'center';
    }
    c.fillStyle = '#4b6584'; c.font = '400 20px ' + mono;
    c.fillText(SI.lang === 'uk' ? 'освітня гра про кіберзахист' : 'an educational game about cyber defense', W / 2, 1296);
    return cv;
  };

  SI.shareText = function (g) {
    return SI.t('shareText', {
      name: g.name, target: SI.L(g.co.name), adv: SI.L(g.adv.name), rank: SI.L(g.rank()),
      result: SI.t(g.won() ? 'resWin' : 'resLose')
    });
  };

  SI.shareResult = function (g, canvas) {
    var text = SI.shareText(g), url = SI.gameUrl();
    var fallback = function () {
      var full = text + ' ' + url;
      if (navigator.clipboard) navigator.clipboard.writeText(full).then(function () { SI.ui.toast(SI.t('copied')); }, function () {});
    };
    if (!navigator.share) return fallback();
    canvas.toBlob(function (blob) {
      var file = blob && typeof File !== 'undefined' ? new File([blob], 'soc-inc.png', { type: 'image/png' }) : null;
      var data = { title: 'SOC Inc.', text: text, url: url };
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
      navigator.share(data).catch(function () {});
    }, 'image/png');
  };

  SI.saveCard = function (canvas) {
    var a = document.createElement('a');
    a.download = 'soc-inc-result.png';
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  };

  SI.telegramShareUrl = function (g) {
    return 'https://t.me/share/url?url=' + encodeURIComponent(SI.gameUrl()) + '&text=' + encodeURIComponent(SI.shareText(g));
  };
})();
