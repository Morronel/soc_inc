// SOC Inc. — global config
window.SI = window.SI || {};

SI.CONFIG = {
  // Telegram channel promoted on the title and end screens. Leave empty to hide the buttons.
  TELEGRAM_CHANNEL_URL: 'https://t.me/binary_xor',
  CHANNEL_NAME: '/binary XOR',
  CHANNEL_LOGO: 'assets/binary-xor.png',

  // Public URL used on the share card and in share links. Empty = use the current page URL.
  GAME_URL: 'https://morronel.github.io/soc_inc/',

  VERSION: '1.0.0',
  BUILD: '__BUILD__',     // replaced with the commit hash at deploy time
  TICK_MS: 500,          // one game tick (= one in-game hour) at 1x speed
  STORAGE_KEY: 'socinc_v1'
};

SI.telegramReady = function () {
  return !!SI.CONFIG.TELEGRAM_CHANNEL_URL && SI.CONFIG.TELEGRAM_CHANNEL_URL.indexOf('YOUR_CHANNEL') === -1 && /^https:\/\/t\.me\//.test(SI.CONFIG.TELEGRAM_CHANNEL_URL);
};

SI.gameUrl = function () {
  if (SI.CONFIG.GAME_URL) return SI.CONFIG.GAME_URL;
  if (typeof location === 'undefined') return '';
  return location.origin + location.pathname.replace(/index\.html$/, '');
};
