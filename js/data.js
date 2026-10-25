// SOC Inc. — world content (bilingual: en / uk)
// Defensive content uses real tool and framework names on purpose: that is the lesson.
// Adversary behaviour is described only at the level of MITRE ATT&CK technique names, never as procedures.
window.SI = window.SI || {};

// ---------------------------------------------------------------- departments (code = hostname prefix, w = business weight)
// w scales how much the board hates it when you isolate that department.
SI.DEPTS = {
  office:    { code: 'OFC',  w: 1,   en: 'Open Space',      uk: 'Опенспейс' },
  hr:        { code: 'HR',   w: 1,   en: 'HR',              uk: 'Кадри' },
  finance:   { code: 'FIN',  w: 1.3, en: 'Finance',         uk: 'Фінанси' },
  dev:       { code: 'DEV',  w: 1.2, en: 'R&D',             uk: 'R&D' },
  exec:      { code: 'EXE',  w: 1.6, en: 'C-Suite',         uk: 'Топ-менеджмент' },
  itops:     { code: 'IT',   w: 1,   en: 'IT Ops',          uk: 'ІТ-відділ' },
  datacenter:{ code: 'CORE', w: 2,   en: 'Datacenter',      uk: 'Дата-центр' },
  closet:    { code: 'SRV',  w: 1.6, en: 'Server Closet',   uk: 'Серверна шафа' },
  vault:     { code: 'VLT',  w: 0.4, en: 'Backup Vault',    uk: 'Сховище бекапів' },
  dmz:       { code: 'DMZ',  w: 1.6, en: 'DMZ',             uk: 'DMZ' },
  warehouse: { code: 'WH',   w: 1.4, en: 'Warehouse',       uk: 'Склад' },
  fleet:     { code: 'FLT',  w: 1.4, en: 'Fleet Ops',       uk: 'Автопарк' },
  store:     { code: 'POS',  w: 2,   en: 'Stores',          uk: 'Магазини' },
  ecom:      { code: 'ECM',  w: 2,   en: 'E-shop',          uk: 'Інтернет-магазин' },
  ward:      { code: 'WRD',  w: 2.6, en: 'Clinical Wards',  uk: 'Клінічні відділення' },
  imaging:   { code: 'IMG',  w: 2.2, en: 'Imaging & Labs',  uk: 'Діагностика й лабораторії' },
  admin:     { code: 'ADM',  w: 1,   en: 'Administration',  uk: 'Адміністрація' },
  eng:       { code: 'ENG',  w: 1.3, en: 'Engineering',     uk: 'Інженерний відділ' },
  scada:     { code: 'OT',   w: 3,   en: 'SCADA Control',   uk: 'Диспетчерська SCADA' },
  substation:{ code: 'SUB',  w: 3,   en: 'Substations',     uk: 'Підстанції' }
};

SI.KINDS = {
  ws:  { code: 'WS',  en: 'workstation',      uk: 'робоча станція' },
  srv: { code: 'SRV', en: 'server',           uk: 'сервер' },
  dc:  { code: 'DC',  en: 'domain controller', uk: 'контролер домену' },
  bkp: { code: 'BKP', en: 'backup server',    uk: 'сервер бекапів' },
  web: { code: 'WEB', en: 'public web app',   uk: 'публічний вебзастосунок' },
  iot: { code: 'IOT', en: 'embedded device (no patches, no EDR)', uk: 'вбудований пристрій (без оновлень і EDR)' }
};

// ---------------------------------------------------------------- NIST CSF 2.0 functions (the "program coverage" strip)
SI.CSF_ORDER = ['govern', 'identify', 'protect', 'detect', 'respond', 'recover'];
SI.CSF = {
  govern:   { short: 'GV', en: 'Govern',   uk: 'Управління' },
  identify: { short: 'ID', en: 'Identify', uk: 'Ідентифікація' },
  protect:  { short: 'PR', en: 'Protect',  uk: 'Захист' },
  detect:   { short: 'DE', en: 'Detect',   uk: 'Виявлення' },
  respond:  { short: 'RS', en: 'Respond',  uk: 'Реагування' },
  recover:  { short: 'RC', en: 'Recover',  uk: 'Відновлення' }
};

// ---------------------------------------------------------------- defensive capabilities (setup bars, debrief)
SI.DEFENSES = {
  aware: { icon: '👁', name: { en: 'Staff awareness', uk: 'Обізнаність персоналу' },
    stage: { en: 'Initial access', uk: 'Початковий доступ' } },
  mfa: { icon: '🔑', name: { en: 'MFA', uk: 'MFA' },
    stage: { en: 'Stolen credentials', uk: 'Вкрадені облікові дані' } },
  patch: { icon: '🩹', name: { en: 'Patching', uk: 'Оновлення' },
    stage: { en: 'Exploits', uk: 'Експлойти' } },
  pam: { icon: '👑', name: { en: 'Least privilege', uk: 'Мінімальні привілеї' },
    stage: { en: 'Privilege escalation', uk: 'Підвищення привілеїв' } },
  seg: { icon: '🧱', name: { en: 'Segmentation', uk: 'Сегментація' },
    stage: { en: 'Lateral movement', uk: 'Латеральне переміщення' } },
  edr: { icon: '🛡', name: { en: 'EDR', uk: 'EDR' },
    stage: { en: 'Execution on hosts', uk: 'Виконання на хостах' } },
  vis: { icon: '📡', name: { en: 'Visibility (SIEM)', uk: 'Видимість (SIEM)' },
    stage: { en: 'Detection', uk: 'Виявлення' } },
  backups: { icon: '💾', name: { en: 'Backups', uk: 'Бекапи' },
    stage: { en: 'Recovery', uk: 'Відновлення' } }
};
SI.BACKUP_LEVEL = { none: 0, online: 0.4, offline: 0.75, immutable: 1 };

// ---------------------------------------------------------------- companies (difficulty)
// def: starting capabilities 0..1. income = budget per hour. critical = how hard damage hits board trust.
SI.COMPANIES = [
  {
    id: 'startup', stars: 1,
    name: { en: 'Coworking Startup', uk: 'Стартап у коворкінгу' },
    blurb: { en: 'Fourteen laptops, the Wi-Fi password on the fridge and one server under the CTO’s desk. Small network, forgiving board.',
             uk: 'Чотирнадцять ноутбуків, пароль від Wi-Fi на холодильнику й один сервер під столом CTO. Маленька мережа, поблажливе правління.' },
    def: { aware: 0.1, mfa: 0.15, patch: 0.2, pam: 0.05, seg: 0, edr: 0.1, vis: 0.1 },
    backup: 'none', budget: 16, income: 0.30, trust: 85, analysts: 1, critical: 0.7, loot: 70,
    depts: [
      { id: 'office', ws: 8 },
      { id: 'dev', ws: 6 },
      { id: 'closet', dc: 1, srv: 2 },
      { id: 'dmz', web: 1 }
    ],
    links: [['office', 'dev'], ['office', 'closet'], ['dev', 'closet'], ['dmz', 'closet']]
  },
  {
    id: 'logistics', stars: 2,
    name: { en: 'Logistics Corp', uk: 'Логістична компанія' },
    blurb: { en: 'MFA for some, antivirus for most, backups on a share “for convenience”. Trucks never stop, so neither can IT.',
             uk: 'MFA для декого, антивірус для більшості, бекапи на мережевій шарі «для зручності». Вантажівки не зупиняються, тож і ІТ теж.' },
    def: { aware: 0.2, mfa: 0.3, patch: 0.3, pam: 0.2, seg: 0.15, edr: 0.25, vis: 0.2 },
    backup: 'online', budget: 14, income: 0.29, trust: 76, analysts: 2, critical: 1, loot: 80,
    depts: [
      { id: 'finance', ws: 4 },
      { id: 'office', ws: 6 },
      { id: 'itops', ws: 3, dc: 1 },
      { id: 'warehouse', ws: 7 },
      { id: 'datacenter', srv: 4 },
      { id: 'fleet', ws: 5 },
      { id: 'dmz', web: 2 },
      { id: 'vault', bkp: 2 }
    ],
    links: [['office', 'finance'], ['office', 'warehouse'], ['warehouse', 'fleet'], ['office', 'itops'],
            ['finance', 'itops'], ['fleet', 'itops'], ['itops', 'datacenter'], ['datacenter', 'vault'], ['dmz', 'datacenter']]
  },
  {
    id: 'retail', stars: 3,
    name: { en: 'Retail Chain', uk: 'Торговельна мережа' },
    blurb: { en: 'Hundreds of tills, a busy e-shop and an office that hates friction. A big, noisy network where every store is a door.',
             uk: 'Сотні кас, жвавий інтернет-магазин і офіс, що ненавидить незручності. Велика галаслива мережа, де кожен магазин — це двері.' },
    def: { aware: 0.25, mfa: 0.3, patch: 0.3, pam: 0.2, seg: 0.2, edr: 0.25, vis: 0.2 },
    backup: 'online', budget: 13, income: 0.30, trust: 68, analysts: 2, critical: 1.25, loot: 110,
    depts: [
      { id: 'store', ws: 8 },
      { id: 'ecom', ws: 3, web: 1 },
      { id: 'office', ws: 6 },
      { id: 'datacenter', srv: 5 },
      { id: 'finance', ws: 4 },
      { id: 'itops', ws: 3, dc: 1 },
      { id: 'hr', ws: 4 },
      { id: 'dmz', web: 2 },
      { id: 'vault', bkp: 2 }
    ],
    links: [['store', 'ecom'], ['store', 'office'], ['ecom', 'datacenter'], ['office', 'finance'], ['office', 'itops'],
            ['finance', 'itops'], ['hr', 'finance'], ['hr', 'itops'], ['itops', 'datacenter'], ['itops', 'vault'],
            ['dmz', 'ecom'], ['dmz', 'datacenter']]
  },
  {
    id: 'hospital', stars: 4,
    name: { en: 'City Hospital', uk: 'Міська лікарня' },
    blurb: { en: 'Infusion pumps that cannot be patched, an imaging server on Windows 7 and lives on the line. Isolating a ward is a clinical decision.',
             uk: 'Інфузійні помпи, які не можна оновити, сервер діагностики на Windows 7 і людські життя на кону. Ізолювати відділення — клінічне рішення.' },
    def: { aware: 0.2, mfa: 0.2, patch: 0.15, pam: 0.15, seg: 0.2, edr: 0.2, vis: 0.15 },
    backup: 'online', budget: 11, income: 0.26, trust: 70, analysts: 2, critical: 1.5, loot: 70,
    depts: [
      { id: 'ward', ws: 5, iot: 4 },
      { id: 'imaging', iot: 3, srv: 1, ws: 1 },
      { id: 'admin', ws: 6 },
      { id: 'itops', ws: 2, dc: 1 },
      { id: 'datacenter', srv: 3 },
      { id: 'dmz', web: 1 },
      { id: 'vault', bkp: 1 }
    ],
    links: [['ward', 'imaging'], ['ward', 'admin'], ['admin', 'itops'], ['imaging', 'datacenter'], ['itops', 'datacenter'],
            ['ward', 'datacenter'], ['datacenter', 'vault'], ['dmz', 'datacenter'], ['dmz', 'admin']]
  },
  {
    id: 'energy', stars: 5,
    name: { en: 'Energy Grid Operator', uk: 'Оператор енергомережі' },
    blurb: { en: 'Critical infrastructure in a country at war. Decent IT security, a fragile OT network, and adversaries who want the lights off.',
             uk: 'Критична інфраструктура в країні, що воює. Пристойна безпека ІТ, крихка мережа АСУ ТП і супротивники, які хочуть вимкнути світло.' },
    def: { aware: 0.3, mfa: 0.35, patch: 0.25, pam: 0.3, seg: 0.25, edr: 0.3, vis: 0.25 },
    backup: 'offline', budget: 12, income: 0.26, trust: 58, analysts: 2, critical: 1.8, loot: 90,
    depts: [
      { id: 'office', ws: 6 },
      { id: 'eng', ws: 4 },
      { id: 'itops', ws: 2, dc: 1 },
      { id: 'datacenter', srv: 3 },
      { id: 'scada', ws: 2, iot: 4 },
      { id: 'substation', iot: 6 },
      { id: 'dmz', web: 1 },
      { id: 'vault', bkp: 2 }
    ],
    links: [['office', 'eng'], ['office', 'itops'], ['eng', 'scada'], ['itops', 'datacenter'], ['eng', 'datacenter'],
            ['scada', 'substation'], ['datacenter', 'vault'], ['dmz', 'datacenter'], ['itops', 'scada']]
  }
];

// ---------------------------------------------------------------- initial access vectors (picked by the adversary, revealed by attribution)
// counter = the capability that shrinks it; reentry = base chance of getting back in after you evict them.
SI.VECTORS = {
  phish:   { icon: '🎣', tech: 'T1566', counter: 'aware', footholds: 3, reentry: 0.85, start: ['office', 'hr', 'admin', 'finance', 'store'],
             name: { en: 'Phishing', uk: 'Фішинг' } },
  creds:   { icon: '🗝', tech: 'T1078', counter: 'mfa', footholds: 2, reentry: 0.8, start: ['finance', 'office', 'admin', 'eng'],
             name: { en: 'Valid Accounts (leaked passwords)', uk: 'Дійсні облікові записи (злиті паролі)' } },
  web:     { icon: '🌐', tech: 'T1190', counter: 'patch', footholds: 2, reentry: 0.75, start: ['dmz'],
             name: { en: 'Exploit Public-Facing Application', uk: 'Експлуатація публічного застосунку' } },
  vpn:     { icon: '🚪', tech: 'T1133', counter: 'mfa', footholds: 1, reentry: 0.75, start: ['itops'], priv: true,
             name: { en: 'External Remote Services', uk: 'Зовнішні сервіси віддаленого доступу' } },
  usb:     { icon: '💽', tech: 'T1091', counter: 'aware', footholds: 2, reentry: 0.6, start: ['ward', 'warehouse', 'office', 'eng'],
             name: { en: 'Replication Through Removable Media', uk: 'Поширення через знімні носії' } },
  supply:  { icon: '📦', tech: 'T1195', counter: 'edr', footholds: 5, reentry: 0.6, start: 'spread',
             name: { en: 'Supply Chain Compromise', uk: 'Компрометація ланцюга постачання' } },
  insider: { icon: '🪪', tech: 'T1078', counter: 'ueba', footholds: 2, reentry: 0.45, start: ['finance', 'exec', 'itops', 'admin', 'eng'], priv: true,
             name: { en: 'Trusted Insider', uk: 'Довірений інсайдер' } }
};

// ---------------------------------------------------------------- ATT&CK techniques the adversary can acquire
// fx mutates the adversary block A. note = what it means for you, counter = upgrades that blunt it.
SI.TTPS = {
  'T1046': { tactic: 'Discovery', name: { en: 'Network Service Discovery', uk: 'Виявлення мережевих сервісів' },
    note: { en: 'Systematic scanning for reachable services. Spread +15%.', uk: 'Систематичне сканування доступних сервісів. Поширення +15%.' },
    counter: ['dt_ndr', 'dt_canary', 'pr_seg'], fx: function (A) { A.spread += 0.15; } },
  'T1087': { tactic: 'Discovery', name: { en: 'Account Discovery', uk: 'Виявлення облікових записів' },
    note: { en: 'Maps who holds which rights. Spread +10%.', uk: 'Складає карту, хто має які права. Поширення +10%.' },
    counter: ['dt_canary', 'dt_ueba'], fx: function (A) { A.spread += 0.1; } },
  'T1003': { tactic: 'Credential Access', name: { en: 'OS Credential Dumping', uk: 'Вивантаження облікових даних ОС' },
    note: { en: 'Scrapes passwords and hashes from memory. Unlocks attempts to gain admin rights.', uk: 'Вишкрібає паролі й хеші з пам’яті. Відкриває спроби отримати права адміна.' },
    counter: ['pr_laps', 'dt_edr', 'pr_tier'], fx: function (A) { A.canEscalate = true; } },
  'T1003.006': { tactic: 'Credential Access', name: { en: 'DCSync', uk: 'DCSync' },
    note: { en: 'Impersonates a domain controller to copy every password. Holding the directory becomes far more valuable.', uk: 'Видає себе за контролер домену, щоб скопіювати всі паролі. Утримання каталогу стає набагато ціннішим.' },
    counter: ['pr_tier', 'rs_krbtgt', 'dt_ueba'], fx: function (A) { A.dcsync = true; A.canEscalate = true; } },
  'T1558': { tactic: 'Credential Access', name: { en: 'Steal or Forge Kerberos Tickets', uk: 'Крадіжка чи підробка квитків Kerberos' },
    note: { en: 'Cracks weak service-account passwords offline. Least privilege blocks them 25% less.', uk: 'Офлайн-злам слабких паролів сервісних акаунтів. Мінімальні привілеї блокують на 25% рідше.' },
    counter: ['dt_canary', 'pr_jit', 'rs_krbtgt'], fx: function (A) { A.pamBypass += 0.25; A.canEscalate = true; } },
  'T1558.001': { tactic: 'Persistence', name: { en: 'Golden Ticket', uk: 'Золотий квиток' },
    note: { en: 'Forged master tickets: domain control survives losing the domain controller. Broken by a double krbtgt reset.', uk: 'Підроблені майстер-квитки: контроль домену переживає втрату контролера. Ламається подвійним скиданням krbtgt.' },
    counter: ['rs_krbtgt'], fx: function (A) { A.keepDomain = true; } },
  'T1078': { tactic: 'Defense Evasion', name: { en: 'Valid Accounts', uk: 'Дійсні облікові записи' },
    note: { en: 'Logs in like an employee instead of breaking in. MFA blocks it 20% less, stealth up.', uk: 'Входить як працівник замість зламу. MFA блокує на 20% рідше, скритність зростає.' },
    counter: ['pr_fido', 'dt_ueba', 'pr_zt'], fx: function (A) { A.mfaBypass += 0.2; A.stealth += 0.05; } },
  'T1621': { tactic: 'Credential Access', name: { en: 'MFA Request Generation', uk: 'Генерація запитів MFA' },
    note: { en: 'Push-spam until a tired user approves. MFA blocks it 25% less.', uk: 'Спам пуш-запитами, доки втомлений користувач не підтвердить. MFA блокує на 25% рідше.' },
    counter: ['pr_fido', 'pr_mfa', 'gv_aware'], fx: function (A) { A.mfaBypass += 0.25; } },
  'T1539': { tactic: 'Credential Access', name: { en: 'Steal Web Session Cookie', uk: 'Крадіжка cookie веб-сесії' },
    note: { en: 'Rides sessions that already passed MFA. MFA blocks it 20% less.', uk: 'Користується сесіями, що вже пройшли MFA. MFA блокує на 20% рідше.' },
    counter: ['pr_fido', 'pr_zt'], fx: function (A) { A.mfaBypass += 0.2; } },
  'T1110': { tactic: 'Credential Access', name: { en: 'Brute Force', uk: 'Перебір паролів' },
    note: { en: 'Password spraying across many accounts. Noisy, but it works on weak passwords.', uk: 'Розпилення паролів по багатьох акаунтах. Гучно, але на слабких паролях працює.' },
    counter: ['pr_mfa', 'dt_ueba'], fx: function (A) { A.mfaBypass += 0.1; A.spread += 0.1; A.stealth -= 0.05; } },
  'T1021': { tactic: 'Lateral Movement', name: { en: 'Remote Services', uk: 'Віддалені сервіси' },
    note: { en: 'Uses the admin protocols IT itself uses. Spread +25%.', uk: 'Користується тими самими адмінськими протоколами, що й ІТ. Поширення +25%.' },
    counter: ['pr_seg', 'dt_ndr', 'pr_tier'], fx: function (A) { A.spread += 0.25; } },
  'T1570': { tactic: 'Lateral Movement', name: { en: 'Lateral Tool Transfer', uk: 'Латеральне перенесення інструментів' },
    note: { en: 'Copies tooling from host to host. Spread +15%, segmentation 10% weaker.', uk: 'Копіює інструменти з хоста на хост. Поширення +15%, сегментація слабша на 10%.' },
    counter: ['dt_ndr', 'pr_asr'], fx: function (A) { A.spread += 0.15; A.segBypass += 0.1; } },
  'T1210': { tactic: 'Lateral Movement', name: { en: 'Exploitation of Remote Services', uk: 'Експлуатація віддалених сервісів' },
    note: { en: 'Worm-like jumps through unpatched services. Patching blocks it far less, spread +20%.', uk: 'Хробакоподібні стрибки через неоновлені сервіси. Оновлення блокують набагато гірше, поширення +20%.' },
    counter: ['pr_patch', 'pr_seg'], fx: function (A) { A.exploit += 0.3; A.spread += 0.2; } },
  'T1068': { tactic: 'Privilege Escalation', name: { en: 'Exploitation for Privilege Escalation', uk: 'Експлуатація для підвищення привілеїв' },
    note: { en: 'A local bug turns a user into an admin. Patching and least privilege matter.', uk: 'Локальна вада перетворює користувача на адміна. Важать оновлення й мінімальні привілеї.' },
    counter: ['pr_patch', 'pr_asr'], fx: function (A) { A.exploit += 0.15; A.pamBypass += 0.15; A.canEscalate = true; } },
  'T1562': { tactic: 'Defense Evasion', name: { en: 'Impair Defenses', uk: 'Послаблення захисту' },
    note: { en: 'Kills or blinds security tools, e.g. with a vulnerable driver. EDR 30% less effective.', uk: 'Вбиває чи осліплює засоби захисту, наприклад вразливим драйвером. EDR на 30% менш ефективний.' },
    counter: ['pr_asr', 'dt_ndr', 'dt_siem'], fx: function (A) { A.edrEvasion += 0.3; } },
  'T1070': { tactic: 'Defense Evasion', name: { en: 'Indicator Removal', uk: 'Видалення індикаторів' },
    note: { en: 'Clears logs and deletes artefacts. Harder to detect.', uk: 'Чистить журнали й видаляє артефакти. Важче виявити.' },
    counter: ['dt_siem', 'gv_mssp', 'rs_dfir'], fx: function (A) { A.stealth += 0.12; } },
  'T1027': { tactic: 'Defense Evasion', name: { en: 'Obfuscated Files or Information', uk: 'Обфускація файлів чи інформації' },
    note: { en: 'Packed, encrypted payloads. Stealth up, EDR 10% less effective.', uk: 'Запаковані, зашифровані пейлоади. Скритність зростає, EDR на 10% менш ефективний.' },
    counter: ['dt_sigma', 'rs_memory'], fx: function (A) { A.stealth += 0.08; A.edrEvasion += 0.1; } },
  'T1053': { tactic: 'Persistence', name: { en: 'Scheduled Task/Job', uk: 'Заплановане завдання' },
    note: { en: 'Comes back after a reboot. Cleaned hosts may leave an implant behind.', uk: 'Повертається після перезавантаження. Очищені хости можуть залишити імплант.' },
    counter: ['dt_hunt', 'rs_evict'], fx: function (A) { A.persistence += 0.15; } },
  'T1547': { tactic: 'Persistence', name: { en: 'Boot or Logon Autostart Execution', uk: 'Автозапуск під час завантаження чи входу' },
    note: { en: 'Autoruns everywhere. Cleaned hosts may leave an implant behind.', uk: 'Автозапуски всюди. Очищені хости можуть залишити імплант.' },
    counter: ['dt_sysmon', 'dt_hunt'], fx: function (A) { A.persistence += 0.15; } },
  'T1572': { tactic: 'Command and Control', name: { en: 'Protocol Tunneling', uk: 'Тунелювання протоколів' },
    note: { en: 'Wraps traffic inside allowed protocols. Segmentation 25% weaker.', uk: 'Загортає трафік у дозволені протоколи. Сегментація слабша на 25%.' },
    counter: ['dt_dns', 'rs_egress'], fx: function (A) { A.segBypass += 0.25; } },
  'T1071': { tactic: 'Command and Control', name: { en: 'Application Layer Protocol', uk: 'Протокол прикладного рівня' },
    note: { en: 'C2 hidden in ordinary web traffic. Stealth up.', uk: 'C2, захований у звичайному вебтрафіку. Скритність зростає.' },
    counter: ['dt_dns', 'rs_egress', 'rs_intel'], fx: function (A) { A.stealth += 0.06; } },
  'T1041': { tactic: 'Exfiltration', name: { en: 'Exfiltration Over C2 Channel', uk: 'Ексфільтрація через канал C2' },
    note: { en: 'Starts sending data out, fastest from servers.', uk: 'Починає відправляти дані назовні, найшвидше із серверів.' },
    counter: ['rs_egress', 'gv_dlp', 'dt_ndr'], fx: function (A) { A.exfil = true; } },
  'T1567': { tactic: 'Exfiltration', name: { en: 'Exfiltration Over Web Service', uk: 'Ексфільтрація через вебсервіс' },
    note: { en: 'Uploads to legitimate cloud storage. Exfil starts or speeds up by 50%.', uk: 'Завантажує в легітимне хмарне сховище. Ексфільтрація починається або прискорюється на 50%.' },
    counter: ['gv_dlp', 'rs_egress'], fx: function (A) { if (A.exfil) A.exfilMult += 0.5; A.exfil = true; } },
  'T1048': { tactic: 'Exfiltration', name: { en: 'Exfiltration Over Alternative Protocol', uk: 'Ексфільтрація альтернативним протоколом' },
    note: { en: 'Data leaves through DNS or odd ports. Exfil +30%.', uk: 'Дані виходять через DNS чи незвичні порти. Ексфільтрація +30%.' },
    counter: ['dt_dns', 'gv_dlp'], fx: function (A) { if (A.exfil) A.exfilMult += 0.3; A.exfil = true; } },
  'T1560': { tactic: 'Collection', name: { en: 'Archive Collected Data', uk: 'Архівування зібраних даних' },
    note: { en: 'Compresses and stages loot. Exfil +30%.', uk: 'Стискає й готує здобич. Ексфільтрація +30%.' },
    counter: ['gv_dlp', 'dt_sysmon'], fx: function (A) { A.exfilMult += 0.3; } },
  'T1213': { tactic: 'Collection', name: { en: 'Data from Information Repositories', uk: 'Дані з інформаційних сховищ' },
    note: { en: 'Pulls straight from SharePoint, wikis and databases. Exfil +40%.', uk: 'Тягне просто із SharePoint, вікі й баз даних. Ексфільтрація +40%.' },
    counter: ['gv_dlp', 'dt_ueba'], fx: function (A) { A.exfilMult += 0.4; } },
  'T1486': { tactic: 'Impact', name: { en: 'Data Encrypted for Impact', uk: 'Шифрування даних для впливу' },
    note: { en: 'The locker is ready. They will detonate once they hold enough of the network, or when they get scared.', uk: 'Шифрувальник готовий. Вони здетонують, щойно утримуватимуть достатньо мережі або коли злякаються.' },
    counter: ['gv_immutable', 'gv_dr', 'dt_edr'], fx: function (A) { A.canEncrypt = true; } },
  'T1490': { tactic: 'Impact', name: { en: 'Inhibit System Recovery', uk: 'Перешкоджання відновленню системи' },
    note: { en: 'Hunts and deletes online backups before impact. Only immutable or offline copies survive.', uk: 'Полює на онлайн-бекапи й видаляє їх перед ударом. Виживають лише незмінні чи офлайн-копії.' },
    counter: ['gv_immutable'], fx: function (A) { A.backupKill = true; } },
  'T1496': { tactic: 'Impact', name: { en: 'Resource Hijacking', uk: 'Викрадення ресурсів' },
    note: { en: 'Every compromised host now mines for them. Damage grows with the size of the botnet.', uk: 'Кожен скомпрометований хост тепер майнить для них. Шкода зростає з розміром ботнету.' },
    counter: ['rs_egress', 'dt_edr'], fx: function (A) { A.mine = true; } },
  'T1498': { tactic: 'Impact', name: { en: 'Network Denial of Service', uk: 'Мережева відмова в обслуговуванні' },
    note: { en: 'DDoS waves against public services drain board trust. A distraction, and a loud one.', uk: 'Хвилі DDoS по публічних сервісах виснажують довіру правління. Відволікання, і гучне.' },
    counter: ['rs_egress', 'pr_zt'], fx: function (A) { A.ddos = true; } },
  'T1561': { tactic: 'Impact', name: { en: 'Disk Wipe', uk: 'Знищення дисків' },
    note: { en: 'A wiper is armed with a trigger date. Every foothold still alive then gets destroyed.', uk: 'Вайпер озброєно датою спрацювання. Кожен плацдарм, живий на той момент, буде знищено.' },
    counter: ['gv_immutable', 'gv_dr', 'rs_evict'], fx: function (A) { A.canWipe = true; } },
  'T1485': { tactic: 'Impact', name: { en: 'Data Destruction', uk: 'Знищення даних' },
    note: { en: 'Destroys backups too and hits harder: impact +30%.', uk: 'Знищує й бекапи та б’є сильніше: вплив +30%.' },
    counter: ['gv_immutable'], fx: function (A) { A.backupKill = true; A.impactMult += 0.3; } }
};
SI.ATTACK_TACTIC_ORDER = ['Discovery', 'Credential Access', 'Privilege Escalation', 'Defense Evasion', 'Persistence',
  'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact'];
SI.ATTACK_TACTICS_UK = {
  'Discovery': 'Розвідка', 'Credential Access': 'Доступ до облікових даних', 'Privilege Escalation': 'Підвищення привілеїв',
  'Defense Evasion': 'Ухилення від захисту', 'Persistence': 'Закріплення', 'Lateral Movement': 'Латеральне переміщення',
  'Collection': 'Збір', 'Command and Control': 'Керування та контроль', 'Exfiltration': 'Ексфільтрація', 'Impact': 'Вплив'
};

// ---------------------------------------------------------------- adversaries
// kind: what "damage" means. base: starting adversary block. playbook: techniques they acquire, in order.
SI.ADVERSARIES = [
  {
    id: 'mole', stars: 2, icon: '🐀', kind: 'exfil', color: '#ffb020',
    name: { en: 'THE MOLE', uk: 'КРІТ' },
    type: { en: 'Malicious insider', uk: 'Зловмисний інсайдер' },
    blurb: { en: 'Already inside, already trusted, already holding admin rights. No malware to find: just a person abusing access they legitimately have.',
             uk: 'Уже всередині, уже має довіру й права адміна. Жодного шкідливого ПЗ: лише людина, що зловживає доступом, який має легально.' },
    lore: { en: 'A senior administrator passed over for promotion twice, with a resignation letter in a drawer and a buyer on an encrypted messenger. Insiders are the hardest threat to spot with classic tools: every login is valid, every share is one they are allowed to open. What gives them away is behaviour: the volume, the hour, the folders that have nothing to do with their job. UEBA and DLP are the sensors that matter here; EDR has nothing to kill.',
            uk: 'Старший адміністратор, якого двічі обійшли з підвищенням, із заявою про звільнення в шухляді й покупцем у зашифрованому месенджері. Інсайдерів найважче помітити класичними засобами: кожен вхід дійсний, кожна шара — та, яку йому можна відкривати. Видає поведінка: обсяги, години, теки, що не мають стосунку до його роботи. Тут важать сенсори UEBA і DLP; EDR нічого вбивати.' },
    vectors: ['insider'],
    base: { spread: 0.35, stealth: 0.55, persistence: 0.15, exfil: true, exfilMult: 1, lootFlat: 0.05, tier: 1, insider: true, evo: 0.8, headStart: 30, spook: 0.3 },
    playbook: ['T1213', 'T1087', 'T1560', 'T1567', 'T1070', 'T1078', 'T1048']
  },
  {
    id: 'hive', stars: 2, icon: '🦠', kind: 'mine', color: '#3dffa8',
    name: { en: 'HIVEMIND', uk: 'ГІВМАЙНД' },
    type: { en: 'Cryptojacking botnet', uk: 'Ботнет-криптоджекер' },
    blurb: { en: 'A worm-turned-botnet that rents your CPUs to whoever pays. Not subtle, not patient: it scans, it pops, it mines.',
             uk: 'Хробак, що став ботнетом і здає ваші процесори тому, хто платить. Не тонкий, не терплячий: сканує, ламає, майнить.' },
    lore: { en: 'HIVEMIND is not targeting you personally; it is targeting everything with an unpatched service and an internet connection. Its operators sell compute, proxy bandwidth and DDoS capacity built from other people’s machines. Damage is a cloud bill that looks like a phone number, servers throttling at 100% CPU, and the joy of explaining why your IP range just attacked a bank. It is loud and easy to see: the trick is keeping up with its speed and keeping it from coming back.',
            uk: 'ГІВМАЙНД не цілиться саме у вас; він цілиться в усе, що має неоновлений сервіс і підключення до інтернету. Його оператори продають обчислення, проксі-трафік і DDoS-потужності, зібрані з чужих машин. Шкода — це рахунок за хмару, схожий на номер телефону, сервери на 100% CPU і радість пояснювати, чому ваш діапазон IP щойно атакував банк. Він гучний і помітний: фокус у тому, щоб встигати за його швидкістю й не дати йому повернутися.' },
    vectors: ['web', 'usb'],
    base: { spread: 2.0, stealth: 0.05, persistence: 0.4, reentryBonus: 0.3, evo: 1.2, headStart: 10, spook: 0.2 },
    playbook: ['T1210', 'T1496', 'T1046', 'T1547', 'T1110', 'T1053', 'T1572', 'T1562']
  },
  {
    id: 'coldlock', stars: 3, icon: '🔐', kind: 'encrypt', color: '#ff3b5c',
    name: { en: 'COLDLOCK', uk: 'COLDLOCK' },
    type: { en: 'Ransomware affiliate', uk: 'Афіліат вимагачів' },
    blurb: { en: 'Ransomware-as-a-service at its most businesslike. They hunt your backups, kill your EDR and detonate on a Friday night.',
             uk: 'Програма-вимагач як сервіс у найділовішому вигляді. Полюють на ваші бекапи, вбивають EDR і детонують у п’ятницю вночі.' },
    lore: { en: 'The developers rent out the locker and the leak site; the affiliate does the break-in and keeps the lion’s share. COLDLOCK’s affiliates are fast and practical: they buy access when they can, steal credentials, go straight for the domain controller and the backup server, and turn security tools off before the payload runs. Their tell is speed. If you see them early, you can win the race; if the first alert is the ransom note, you are already in recovery.',
            uk: 'Розробники здають в оренду шифрувальник і сайт зливів; афіліат робить злам і забирає левову частку. Афіліати COLDLOCK швидкі й прагматичні: купують доступ, коли можуть, крадуть облікові дані, йдуть просто на контролер домену й сервер бекапів і вимикають засоби захисту, перш ніж запустити пейлоад. Їхня ознака — швидкість. Побачите їх рано — виграєте перегони; якщо перший алерт — записка з вимогою викупу, ви вже у відновленні.' },
    vectors: ['phish', 'creds', 'vpn', 'web'],
    base: { spread: 1.25, stealth: 0.25, persistence: 0.3, evo: 1.15, deadline: 330, headStart: 16, spook: 0.6 },
    playbook: ['T1046', 'T1003', 'T1021', 'T1562', 'T1486', 'T1490', 'T1053', 'T1003.006', 'T1570', 'T1027']
  },
  {
    id: 'ashstorm', stars: 4, icon: '🔥', kind: 'wipe', color: '#ff7a1a',
    name: { en: 'ASH STORM', uk: 'ПОПІЛЬНИЙ ШТОРМ' },
    type: { en: 'State wiper behind a hacktivist mask', uk: 'Державний вайпер під маскою хактивістів' },
    blurb: { en: 'A cartoon-logo “hacktivist” channel takes the credit; a military unit does the work. No ransom. Destruction on a symbolic date.',
             uk: 'Заслугу собі приписує «хактивістський» канал із мультяшним логотипом; роботу робить військова частина. Жодного викупу. Руйнування в символічну дату.' },
    lore: { en: 'ASH STORM hides behind personas that post DDoS screenshots and memes, but the tooling is professional and the targets are chosen for political effect. The pattern is familiar to anyone who defended critical infrastructure in Ukraine: weeks of quiet credential theft, DDoS waves as a distraction, then a wiper scheduled for a date that means something. You cannot negotiate. You can find every foothold before the trigger date, keep offline backups and rehearse the rebuild.',
            uk: 'ПОПІЛЬНИЙ ШТОРМ ховається за персонажами, що постять скриншоти DDoS і меми, але інструменти професійні, а цілі обрано заради політичного ефекту. Патерн знайомий кожному, хто захищав критичну інфраструктуру в Україні: тижні тихої крадіжки облікових даних, хвилі DDoS для відволікання, а потім вайпер, запланований на дату, що щось означає. Домовитися неможливо. Можна знайти кожен плацдарм до дати спрацювання, тримати офлайн-бекапи й відрепетирувати відбудову.' },
    vectors: ['creds', 'vpn', 'web', 'supply'],
    base: { spread: 1.15, stealth: 0.45, persistence: 0.35, evo: 1.15, wipeAt: [200, 270], headStart: 26, spook: 0.6 },
    playbook: ['T1078', 'T1003', 'T1021', 'T1498', 'T1561', 'T1562', 'T1070', 'T1053', 'T1003.006', 'T1485']
  },
  {
    id: 'hydra', stars: 5, icon: '🐍', kind: 'exfil', color: '#9b7bff',
    name: { en: 'GREY HYDRA', uk: 'СІРА ГІДРА' },
    type: { en: 'Espionage APT', uk: 'Шпигунська APT-група' },
    blurb: { en: 'Patient, quiet, persistent. They want the crown jewels and they want to keep coming back. Cut off one head…',
             uk: 'Терплячі, тихі, наполегливі. Їм потрібні коштовності, і вони хочуть повертатися знову. Відрубай одну голову…' },
    lore: { en: 'GREY HYDRA measures operations in months. Custom implants that live in memory, living-off-the-land with the administrator’s own tools, command-and-control on rented servers in your own country so the traffic looks local. They clean logs as they go and keep two spare footholds for every one you find. Partial cleanups only teach them what you can see. The answer is patience of your own: map the whole intrusion, then evict everything at once.',
            uk: 'СІРА ГІДРА вимірює операції місяцями. Власні імпланти, що живуть у пам’яті, «життя із землі» з інструментами самого адміністратора, командні сервери, орендовані у вашій же країні, щоб трафік виглядав місцевим. Вони чистять журнали дорогою й тримають два запасні плацдарми на кожен, який ви знайшли. Часткові зачистки лише вчать їх, що ви бачите. Відповідь — ваше власне терпіння: картографувати все вторгнення, а потім вигнати все одночасно.' },
    vectors: ['phish', 'web', 'vpn', 'supply'],
    base: { spread: 0.8, stealth: 0.55, persistence: 0.5, evo: 0.95, headStart: 30, spook: 1 },
    playbook: ['T1078', 'T1070', 'T1041', 'T1003', 'T1053', 'T1572', 'T1558', 'T1003.006', 'T1567', 'T1558.001', 'T1027', 'T1071']
  },
  {
    id: 'silentpatch', stars: 5, icon: '📦', kind: 'exfil', color: '#2ee6ff',
    name: { en: 'SILENT PATCH', uk: 'ТИХИЙ ПАТЧ' },
    type: { en: 'Supply-chain operation', uk: 'Операція через ланцюг постачання' },
    blurb: { en: 'They did not hack you. They hacked a vendor you trust and let your own update server install them everywhere.',
             uk: 'Вони не зламували вас. Вони зламали вендора, якому ви довіряєте, і дали вашому ж серверу оновлень установити їх усюди.' },
    lore: { en: 'The backdoor arrived signed with your vendor’s genuine certificate, through your own patch process, onto machines in every department. Thousands of organisations installed it; a few dozen were chosen for hands-on follow-up, and you are one of them. The implant stays dormant for weeks and its traffic imitates the vendor’s telemetry. Behaviour-based detection and network sensors catch what signatures never will, and a coordinated eviction is the only one that sticks.',
            uk: 'Бекдор прийшов підписаним справжнім сертифікатом вашого вендора, через ваш власний процес оновлень, на машини в кожному відділі. Його встановили тисячі організацій; кілька десятків обрали для ручної роботи, і ви серед них. Імплант тижнями спить, а його трафік імітує телеметрію вендора. Поведінкове виявлення й мережеві сенсори ловлять те, чого сигнатури не зловлять ніколи, і лише скоординоване вигнання спрацьовує остаточно.' },
    vectors: ['supply'],
    base: { spread: 0.85, stealth: 0.5, persistence: 0.45, evo: 1, headStart: 26, spook: 0.9 },
    playbook: ['T1071', 'T1027', 'T1003', 'T1041', 'T1558', 'T1053', 'T1003.006', 'T1567', 'T1558.001', 'T1562']
  }
];
SI.UNKNOWN_ADV = {
  id: 'unknown', stars: 0, icon: '❓',
  name: { en: 'UNKNOWN ACTOR', uk: 'НЕВІДОМИЙ АКТОР' },
  type: { en: 'Random adversary, revealed by attribution', uk: 'Випадковий супротивник, розкривається атрибуцією' },
  blurb: { en: 'Like real life: you find out who it was later. Score ×1.2.', uk: 'Як у житті: хто це був, дізнаєтесь потім. Рахунок ×1.2.' }
};

// ---------------------------------------------------------------- alert triage texts (yellow ! caches)
SI.TRIAGE = {
  tp: [
    { en: 'Office app spawned a script interpreter', uk: 'Офісний застосунок запустив інтерпретатор скриптів' },
    { en: 'Logon from a host that never logs on anywhere', uk: 'Вхід із хоста, що ніколи нікуди не входить' },
    { en: 'Service installed from a temp folder', uk: 'Сервіс установлено з тимчасової теки' },
    { en: 'Beacon every 60 s ± 10% to a fresh domain', uk: 'Маячок кожні 60 с ± 10% на свіжий домен' },
    { en: 'Credential-store memory access by an odd process', uk: 'Доступ до пам’яті сховища облікових даних дивним процесом' },
    { en: 'Admin share accessed from a workstation', uk: 'Доступ до адмінської шари з робочої станції' },
    { en: 'Scheduled task created with an encoded command', uk: 'Створено заплановане завдання із закодованою командою' },
    { en: 'Security log cleared', uk: 'Журнал безпеки очищено' },
    { en: 'Rare parent-child process chain', uk: 'Рідкісний ланцюжок процесів батько-нащадок' },
    { en: 'Archive of 3 GB created in a user profile', uk: 'Архів на 3 ГБ створено в профілі користувача' }
  ],
  fp: [
    { en: 'Backup job flagged as mass file change', uk: 'Задачу бекапу позначено як масову зміну файлів' },
    { en: 'Vulnerability scanner hitting every port', uk: 'Сканер вразливостей стукає в усі порти' },
    { en: 'Admin running a legit inventory script', uk: 'Адмін запускає легітимний скрипт інвентаризації' },
    { en: 'User on holiday logging in from a beach', uk: 'Користувач у відпустці входить із пляжу' },
    { en: 'New software update looks like a dropper', uk: 'Нове оновлення ПЗ схоже на дропер' },
    { en: 'Developer compiling something weird', uk: 'Розробник компілює щось дивне' },
    { en: 'Printer driver doing printer driver things', uk: 'Драйвер принтера робить драйверопринтерні речі' },
    { en: 'Pentester forgot to tell the SOC', uk: 'Пентестер забув попередити SOC' }
  ],
  ioc: [
    { en: 'CERT advisory hash matched', uk: 'Збіг хешу з бюлетеня CERT' },
    { en: 'ISAC-shared C2 domain resolved', uk: 'Резолв C2-домену, яким поділився ISAC' },
    { en: 'MISP event: known actor infrastructure', uk: 'Подія MISP: відома інфраструктура актора' },
    { en: 'Peer SOC shared a YARA hit', uk: 'Сусідній SOC поділився спрацюванням YARA' }
  ]
};

// ---------------------------------------------------------------- SOC console messages
SI.SOC = {
  d_vis:     { sev: 'med',  en: 'SIEM correlation: anomalous activity confirmed on {host}', uk: 'Кореляція SIEM: підтверджено аномальну активність на {host}' },
  d_sensor:  { sev: 'med',  en: 'Sensor telemetry: suspicious service creation on {host}', uk: 'Телеметрія сенсорів: підозріле створення сервісу на {host}' },
  d_edr:     { sev: 'high', en: 'EDR: malicious process tree on {host}', uk: 'EDR: шкідливе дерево процесів на {host}' },
  d_ndr:     { sev: 'high', en: 'NDR: admin-protocol connection {src} → {host}', uk: 'NDR: з’єднання адмін-протоколом {src} → {host}' },
  d_dns:     { sev: 'med',  en: 'DNS analytics: periodic beacon from {host} to a newly registered domain', uk: 'Аналітика DNS: періодичний маячок із {host} на щойно зареєстрований домен' },
  d_ueba:    { sev: 'high', en: 'UEBA: impossible travel and rare resource access by account on {host}', uk: 'UEBA: неможлива подорож і рідкісний доступ до ресурсів акаунтом на {host}' },
  d_canary:  { sev: 'crit', en: 'CANARY TRIPPED: decoy credential used from {host}', uk: 'КАНАРКА СПРАЦЮВАЛА: приманковий обліковий запис використано з {host}' },
  d_hunt:    { sev: 'high', en: 'Hunt finding: hidden persistence on {host}', uk: 'Знахідка полювання: прихована персистентність на {host}' },
  d_triage:  { sev: 'high', en: 'Triage: alert on {host} confirmed TRUE POSITIVE', uk: 'Тріаж: алерт на {host} підтверджено як СПРАВЖНІЙ' },
  d_xdr:     { sev: 'high', en: 'XDR: incident graph links {src} to {host}', uk: 'XDR: граф інциденту пов’язує {src} з {host}' },
  d_ioc:     { sev: 'high', en: 'Threat intel match: known IOC observed on {host}', uk: 'Збіг розвідданих: відомий IOC помічено на {host}' },
  d_exfil:   { sev: 'high', en: 'DLP/NDR: large outbound transfer from {host}', uk: 'DLP/NDR: великий вихідний трафік із {host}' },
  d_block:   { sev: 'med',  en: 'Blocked attack traced back to its source: {host}', uk: 'Заблоковану атаку відстежено до джерела: {host}' },
  b_edr:     { sev: 'med',  en: 'EDR blocked execution on {host} (origin {src})', uk: 'EDR заблокував виконання на {host} (джерело {src})' },
  b_seg:     { sev: 'low',  en: 'Firewall denied {src} → {host} across a segment boundary', uk: 'Фаєрвол відхилив {src} → {host} на межі сегмента' },
  b_mfa:     { sev: 'low',  en: 'MFA challenge failed for a login to {host} from {src}', uk: 'Не пройдено MFA під час входу на {host} з {src}' },
  b_pam:     { sev: 'med',  en: 'Privileged logon to {host} denied by tier policy (from {src})', uk: 'Привілейований вхід на {host} відхилено політикою ярусів (з {src})' },
  b_patch:   { sev: 'low',  en: 'Exploit attempt against patched service on {host}', uk: 'Спроба експлойту проти оновленого сервісу на {host}' },
  b_iso:     { sev: 'low',  en: 'Quarantine boundary dropped traffic {src} → {host}', uk: 'Межа карантину відкинула трафік {src} → {host}' },
  edr_kill:  { sev: 'med',  en: 'EDR auto-remediated a foothold on {host}', uk: 'EDR автоматично знешкодив плацдарм на {host}' },
  iso:       { sev: 'low',  en: 'Responder isolated {host}', uk: 'Реагувальник ізолював {host}' },
  auto_iso:  { sev: 'low',  en: 'SOAR auto-contained {host}', uk: 'SOAR автоматично стримав {host}' },
  reimage:   { sev: 'low',  en: 'Reimaged {host} from golden image', uk: '{host} переінстальовано із золотого образу' },
  fp:        { sev: 'low',  en: 'Triage: alert on {host} closed as false positive, rule tuned', uk: 'Тріаж: алерт на {host} закрито як хибний, правило відтюнено' },
  dc:        { sev: 'crit', en: 'Directory replication requested by non-DC host {host}', uk: 'Реплікацію каталогу запитав не-DC хост {host}' },
  encrypt:   { sev: 'crit', en: 'Mass file modification, ransom note written on {host}', uk: 'Масова зміна файлів, записку з вимогою викупу записано на {host}' },
  wipe:      { sev: 'crit', en: 'Partition table overwritten on {host}', uk: 'Таблицю розділів перезаписано на {host}' },
  mine:      { sev: 'med',  en: 'CPU pegged at 100%: unknown miner on {host}', uk: 'CPU на 100%: невідомий майнер на {host}' },
  ddos:      { sev: 'high', en: 'Edge: volumetric DDoS against public services', uk: 'Периметр: об’ємний DDoS по публічних сервісах' },
  backups:   { sev: 'crit', en: 'Backup catalogue deleted from {host}', uk: 'Каталог бекапів видалено з {host}' },
  reentry:   { sev: 'high', en: 'Initial access attempt blocked at the edge ({up})', uk: 'Спробу початкового доступу заблоковано на периметрі ({up})' },
  ttp:       { sev: 'med',  en: 'New adversary behaviour observed: {up}', uk: 'Помічено нову поведінку супротивника: {up}' },
  ttp_unk:   { sev: 'med',  en: 'Adversary behaviour changed: unknown capability', uk: 'Поведінка супротивника змінилася: невідома можливість' },
  restore:   { sev: 'low',  en: 'Restored {host} from backup', uk: '{host} відновлено з бекапу' },
  sweep:     { sev: 'high', en: 'Eradication: implant removed from {host}', uk: 'Ліквідація: імплант видалено з {host}' }
};

// ---------------------------------------------------------------- news events (defender's world)
SI.EVENTS = [
  { id: 'patchtue', w: 3, when: function () { return true; },
    t: { en: 'Patch Tuesday: 97 CVEs, 4 already exploited. Change board approves an emergency window', uk: 'Вівторок оновлень: 97 CVE, 4 уже експлуатуються. Рада змін схвалила екстрене вікно' },
    run: function (g) { g.patchRandom(0.25); } },
  { id: 'budgetq', w: 3, when: function () { return true; },
    t: { en: 'Quarter closes under budget: finance releases leftovers to security', uk: 'Квартал закрито з економією: фінвідділ віддає залишки на безпеку' },
    run: function (g) { g.budget += 5; } },
  { id: 'ceomfa', w: 2, when: function (g) { return g.D.mfa > 0.2; },
    t: { en: 'CEO demands an MFA exception “just for the iPad”. You say no. Awkward lunch', uk: 'CEO вимагає виняток з MFA «лише для айпада». Ви кажете «ні». Незручний обід' },
    run: function (g) { g.trustHit(2); } },
  { id: 'intern', w: 2, when: function (g) { return g.footholds() > 0; },
    t: { en: 'Intern disables antivirus to install a game mod. Laptop now “very fast”', uk: 'Стажер вимкнув антивірус, щоб поставити мод до гри. Ноутбук тепер «дуже швидкий»' },
    run: function (g) { g.infectRandom(1); } },
  { id: 'siemfull', w: 2, when: function (g) { return g.D.vis > 0.15 && !g.flags.siemfull; },
    t: { en: 'SIEM hits its daily ingest licence cap. Logs dropped until midnight', uk: 'SIEM вперся в добовий ліміт ліцензії. Журнали відкидаються до опівночі' },
    run: function (g) { g.flags.siemfull = true; g.addMod('detect', 0.4, 24); } },
  { id: 'vendorai', w: 2, when: function () { return true; },
    t: { en: 'Vendor rebrands the same firewall as “AI-native”. Renewal price doubles, features don’t', uk: 'Вендор перейменував той самий фаєрвол на «AI-native». Ціна продовження подвоїлася, функції — ні' },
    run: function (g) { g.budget = Math.max(0, g.budget - 3); } },
  { id: 'competitor', w: 2, when: function () { return true; },
    t: { en: 'Competitor hit by ransomware on the evening news. Board suddenly very interested in security', uk: 'Конкурента вразив вимагач у вечірніх новинах. Правління раптом дуже цікавиться безпекою' },
    run: function (g) { g.trustGain(6); g.budget += 4; } },
  { id: 'cert', w: 2, when: function (g) { return g.firstDetectAt >= 0 && !g.attributed; },
    t: { en: 'CERT advisory publishes indicators for an active campaign. Some look familiar', uk: 'CERT публікує індикатори активної кампанії. Деякі виглядають знайомо' },
    run: function (g) { g.investigation = Math.min(100, g.investigation + 8); g.spawnIoc(true); } },
  { id: 'coffee', w: 2, when: function () { return true; },
    t: { en: 'Coffee machine on the SOC floor breaks. Mean time to respond doubles', uk: 'Зламалася кавоварка на поверсі SOC. Середній час реагування подвоївся' },
    run: function (g) { g.addMod('hunt', 0.6, 24); g.addMod('plan', 0.6, 24); } },
  { id: 'pentest', w: 2, when: function (g) { return !g.flags.pentest; },
    t: { en: 'Pentest report: “flat network, shared local admin passwords”. Now it’s in writing, and the board read it', uk: 'Звіт пентесту: «пласка мережа, спільні паролі локальних адмінів». Тепер це на папері, і правління прочитало' },
    run: function (g) { g.flags.pentest = true; g.budget += 6; } },
  { id: 'holiday', w: 2, when: function (g) { return !g.owned.gv_mssp; },
    t: { en: 'Long weekend. Half the SOC is at a lake with no signal', uk: 'Довгі вихідні. Пів SOC на озері без зв’язку' },
    run: function (g) { g.addMod('detect', 0.55, 30); } },
  { id: 'auditor', w: 1, when: function (g) { return g.backup !== 'none' && !g.flags.auditor; },
    t: { en: 'Auditor asks to see a restore test. One is finally performed. It works!', uk: 'Аудитор просить показати тест відновлення. Його нарешті проводять. Працює!' },
    run: function (g) { g.flags.auditor = true; g.p.restore += 0.15; g.trustGain(2); } },
  { id: 'phishwave', w: 2, when: function () { return true; },
    t: { en: 'Sector-wide phishing wave. The report-phish button lights up like a Christmas tree', uk: 'Хвиля фішингу по всій галузі. Кнопка «Повідомити про фішинг» світиться, як ялинка' },
    run: function (g) { g.spawnAlert(false); g.spawnAlert(false); } },
  { id: 'shadowit', w: 2, when: function () { return true; },
    t: { en: 'Marketing signs up for a new SaaS with the company card. Nobody told IT', uk: 'Маркетинг підписався на новий SaaS корпоративною карткою. ІТ ніхто не сказав' },
    run: function (g) { g.addMod('detect', 0.8, 36); } },
  { id: 'junior', w: 1, when: function (g) { return !g.flags.junior; },
    t: { en: 'A brilliant junior analyst joins straight from a CTF team', uk: 'Блискучий молодший аналітик приходить просто з CTF-команди' },
    run: function (g) { g.flags.junior = true; g.analysts++; } },
  { id: 'burnout', w: 1, when: function (g) { return !g.p.noFatigue && !g.flags.burnout && g.analysts > 1 && g.t > 120; },
    t: { en: 'Senior analyst burns out and quits. Years of context walk out the door', uk: 'Старший аналітик вигорів і звільнився. Роки контексту пішли за двері' },
    run: function (g) { g.flags.burnout = true; g.analysts--; } },
  { id: 'storm', w: 2, when: function (g) { return !g.p.noFatigue; },
    t: { en: 'A misconfigured rule fires 12,000 times overnight. Alert fatigue sets in', uk: 'Хибно налаштоване правило спрацювало 12 000 разів за ніч. Настає втома від алертів' },
    run: function (g) { g.addMod('detect', 0.7, 24); g.spawnAlert(false); } },
  { id: 'press', w: 3, when: function (g) { return g.damage > 30 && !g.flags.press; },
    t: { en: 'A journalist asks for comment on “reports of a cyber incident”', uk: 'Журналіст просить прокоментувати «повідомлення про кіберінцидент»' },
    run: function (g) { g.flags.press = true; g.trustHit(4); } },
  { id: 'regulator', w: 3, when: function (g) { return g.damage > 15 && !g.flags.regulator; },
    t: { en: 'The regulator’s 24-hour notification clock has started', uk: 'Запущено 24-годинний відлік для повідомлення регулятора' },
    run: function (g) { g.flags.regulator = true; if (g.owned.gv_nis2) g.trustGain(3); else g.trustHit(3); } },
  { id: 'oob', w: 2, when: function () { return true; },
    t: { en: 'Vendor ships an out-of-band fix for the bug everyone is exploiting', uk: 'Вендор випустив позапланове виправлення вади, яку всі експлуатують' },
    run: function (g) { g.patchRandom(0.3); g.A.exploit = Math.max(0, g.A.exploit - 0.1); } },
  { id: 'darkweb', w: 3, when: function (g) { return g.adv.kind === 'exfil' && g.damage > 20 && !g.flags.darkweb; },
    t: { en: 'A sample of your data appears on a dark-web forum', uk: 'Зразок ваших даних з’явився на форумі в даркнеті' },
    run: function (g) { g.flags.darkweb = true; g.trustHit(5); } },
  { id: 'negotiator', w: 3, when: function (g) { return g.detonated && !g.flags.negotiator; },
    t: { en: 'Negotiator: “They want 40 BTC by Friday.” The board says no. Good', uk: 'Перемовник: «Вони хочуть 40 BTC до п’ятниці». Правління каже «ні». Добре' },
    run: function (g) { g.flags.negotiator = true; g.trustGain(2); } },
  { id: 'xpbox', w: 2, when: function (g) { return !g.flags.xpbox; },
    t: { en: 'A Windows XP box running the parking barrier is discovered. On the network since 2009', uk: 'Знайдено Windows XP, що керує шлагбаумом на парковці. У мережі з 2009 року' },
    run: function (g) { g.flags.xpbox = true; if (g.footholds() > 0 && g.rand() < 0.4) g.infectRandom(1); } },
  { id: 'champions', w: 2, when: function (g) { return g.owned.gv_aware && !g.flags.champions; },
    t: { en: 'Security champions: accounting reports a phish within 90 seconds', uk: 'Чемпіони безпеки: бухгалтерія повідомила про фішинг за 90 секунд' },
    run: function (g) { g.flags.champions = true; g.D.aware = Math.min(1, g.D.aware + 0.05); g.trustGain(2); } },
  { id: 'cloudbill', w: 3, when: function (g) { return g.adv.kind === 'mine' && g.damage > 20 && !g.flags.cloudbill; },
    t: { en: 'Cloud bill alert: compute spend up 900% this week', uk: 'Алерт рахунку за хмару: витрати на обчислення +900% за тиждень' },
    run: function (g) { g.flags.cloudbill = true; g.trustHit(3); } },
  { id: 'drill', w: 2, when: function (g) { return !g.flags.drill; },
    t: { en: 'National cyber drill: your team takes part and brings home a few tricks', uk: 'Національні кібернавчання: ваша команда бере участь і привозить кілька трюків' },
    run: function (g) { g.flags.drill = true; g.investigation = Math.min(100, g.investigation + 4); g.plan = Math.min(100, g.plan + (g.attributed ? 5 : 0)); } },
  { id: 'ctf', w: 1, when: function () { return true; },
    t: { en: 'The SOC wins a local CTF. Morale is excellent, hunts are sharper', uk: 'SOC виграв місцевий CTF. Бойовий дух чудовий, полювання гостріші' },
    run: function (g) { g.addMod('hunt', 1.5, 30); } },
  { id: 'friday', w: 2, when: function (g) { return g.footholds() > 0 && !g.owned.gv_mssp; },
    t: { en: 'Friday 17:55. The change freeze starts, and so does somebody else’s shift', uk: 'П’ятниця, 17:55. Починається заморозка змін, а в когось іще — зміна' },
    run: function (g) { g.addMod('spread', 1.35, 24); } },
  { id: 'insurer', w: 1, when: function (g) { return !g.flags.insurer && !g.owned.gv_insure; },
    t: { en: 'Insurer’s questionnaire asks about MFA, EDR and offline backups. The board starts asking too', uk: 'Анкета страховика питає про MFA, EDR і офлайн-бекапи. Правління теж починає питати' },
    run: function (g) { g.flags.insurer = true; g.budget += 3; } }
];

// ---------------------------------------------------------------- debrief texts (what the defense did)
SI.COUNTER_TEXT = {
  seg:    { en: 'Segmentation and firewalls denied {n} moves between departments.', uk: 'Сегментація й фаєрволи відхилили {n} переходів між відділами.' },
  mfa:    { en: 'MFA stopped {n} logins with stolen credentials.', uk: 'MFA зупинила {n} входів із вкраденими обліковими даними.' },
  patch:  { en: 'Patched services shrugged off {n} exploit attempts.', uk: 'Оновлені сервіси відбили {n} спроб експлойту.' },
  pam:    { en: 'Least privilege kept them off servers {n} times.', uk: 'Мінімальні привілеї {n} разів не пустили їх на сервери.' },
  edr:    { en: 'EDR blocked {n} executions and cleaned footholds on its own.', uk: 'EDR заблокував {n} запусків і сам очищав плацдарми.' },
  iso:    { en: 'Your quarantines dropped {n} attempts to cross into isolated zones.', uk: 'Ваші карантини відкинули {n} спроб пробратися в ізольовані зони.' },
  detect: { en: 'You detected {n} compromised hosts.', uk: 'Ви виявили {n} скомпрометованих хостів.' },
  contain:{ en: 'You contained {n} hosts by isolation and reimaging.', uk: 'Ви стримали {n} хостів ізоляцією та переінсталяцією.' },
  restore:{ en: 'Backups brought {n} hosts back.', uk: 'Бекапи повернули {n} хостів.' }
};

SI.RANKS = [
  { min: 0,   en: 'Intern on Coffee Duty', uk: 'Стажер на каві' },
  { min: 15,  en: 'L1 Alert Triage',       uk: 'Тріаж L1' },
  { min: 30,  en: 'L2 Analyst',            uk: 'Аналітик L2' },
  { min: 45,  en: 'Incident Handler',      uk: 'Обробник інцидентів' },
  { min: 60,  en: 'Threat Hunter',         uk: 'Мисливець на загрози' },
  { min: 75,  en: 'SOC Lead',              uk: 'Керівник SOC' },
  { min: 90,  en: 'CISO',                  uk: 'CISO' },
  { min: 105, en: 'Blue Team Legend',      uk: 'Легенда синьої команди' }
];

SI.TEAM_NAMES = ['BLUE_OWL', 'NIGHTWATCH', 'SIGMA_SQUAD', 'TIER_ZERO', 'PACKET_OWLS', 'HONEYPOT', 'KRBTGT_X2', 'CANARY_CREW',
  'IRONLOGS', 'BLUEBYTE', 'GHOSTHUNT', 'ZEROTRUST', 'YARA_YARA', 'SINKHOLE', 'TRIAGE_CATS', 'DWELL_ZERO'];
