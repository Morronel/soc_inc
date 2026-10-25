# SOC Inc.

A Plague Inc: The Cure-style mobile browser strategy game for defenders. You run the Security Operations Center of a company that is being breached right now. Intruders start **hidden**: find them, contain them, work out who they are, then evict them all at once before they reach their goal or the board runs out of patience.

**Play:** https://morronel.github.io/soc_inc/

**Educational by design.** The defensive side is precise: every capability in the tree is a real control, with the real tools behind it, its MITRE ATT&CK mitigation or data source ID, and a page of field notes. The adversary side stays abstract: attackers acquire real ATT&CK *technique names*, never procedures.

## How it plays

- **Fog of war.** Footholds are invisible until your visibility (SIEM, endpoint telemetry, EDR, NDR, DNS analytics, UEBA, canaries) or your analysts reveal them. The adversary also gets a silent head start before your shift begins.
- **Triage.** Yellow **!** alerts pop up on the map. Tap them: true positives reveal a compromised host, false positives tune your rules. Cyan ◆ IOCs arrive once you share threat intel.
- **Contain.** Tap a red host to isolate it. Tap a department to deploy sensors, start a threat hunt (uses an analyst), reimage every known host, isolate the whole segment or restore impacted machines. Piecemeal containment tips persistent actors off: they speed up and dig in.
- **Board trust** is the Plague-Cure "compliance" meter: isolations, MFA rollouts, downtime and damage all spend it. At 0 the CISO is fired.
- **Attribution → Eradication.** Detections feed ATTRIBUTION. At 100% you learn who it is, how they got in and their playbook, and the ERADICATION PLAN starts. When it is ready, hit **ERADICATE**: a coordinated eviction sweep across every host.
- **Win** by eradicating them, or by evicting every foothold until they give up trying to come back. **Lose** if their damage meter hits 100% or trust hits 0.

### Companies (difficulty)

| ★ | Company | Twist |
|---|---|---|
| 1 | Coworking Startup | tiny flat network, no backups, forgiving board |
| 2 | Logistics Corp | online backups on the domain, mixed defenses |
| 3 | Retail Chain | big noisy network, every store is a door |
| 4 | City Hospital | unpatchable medical devices, isolating a ward costs a lot of trust |
| 5 | Energy Grid Operator | OT network, fragile trust, adversaries who want the lights off |

### Adversaries

| ★ | Actor | Goal | Notes |
|---|---|---|---|
| 2 | 🐀 THE MOLE | data theft | malicious insider with admin rights; EDR is useless, UEBA and DLP are not |
| 2 | 🦠 HIVEMIND | botnet / cryptojacking | spreads fast and loud, keeps coming back |
| 3 | 🔐 COLDLOCK | encryption | RaaS affiliate: hunts backups, kills EDR, detonates when scared |
| 4 | 🔥 ASH STORM | destruction | state wiper behind a hacktivist mask, DDoS as distraction, trigger date |
| 5 | 🐍 GREY HYDRA | espionage | stealthy, persistent, leaves implants behind on every cleanup |
| 5 | 📦 SILENT PATCH | espionage | supply-chain backdoor already on machines in every department |
| ? | ❓ UNKNOWN ACTOR | ? | random, revealed only by attribution, score ×1.2 |

### Defense program: 42 capabilities in 4 branches

- **DETECT**: SIEM, endpoint telemetry, NDR, detection engineering, EDR, DNS analytics, honeytokens, UEBA, threat hunting, XDR
- **PROTECT**: asset inventory, patch management, MFA, email security, LAPS & Credential Guard, FIDO2, application control, tiered admin & PAWs, segmentation, just-in-time admin, Zero Trust
- **RESPOND**: IR playbooks, one-click isolation, DFIR retainer, SOAR, egress control & sinkholing, memory forensics, identity recovery (krbtgt), threat-intel sharing, purple teaming, coordinated eviction
- **GOVERN**: board risk briefing, awareness, 3-2-1 backups, tabletop exercises, cyber insurance, immutable backups, 24/7 night shift, DLP, DR rehearsals, analyst wellness, NIS2 / DORA readiness

Each one maps to a NIST CSF 2.0 function; the end report shows your program coverage, the ATT&CK techniques the adversary used and which of them you had an answer for.

## Features

- Vanilla JS, single page, no build step, no dependencies
- Portrait-first for phones (landscape and desktop work too), installable as a PWA
- English and Ukrainian (auto-detected, switchable)
- Cache guard for in-app webviews (Telegram & co.): stale pages reload onto the latest build once
- NIGHTSHIFT.FM: ~20 minutes of procedural synthwave composed live with the Web Audio API, intensity follows incident severity
- Shareable PNG result card, native share sheet, Telegram share link and channel button

## Configure

Edit `js/config.js`:

- `TELEGRAM_CHANNEL_URL`, `CHANNEL_NAME`, `CHANNEL_LOGO`: the channel promoted on the title and end screens. Empty URL hides the buttons.
- `GAME_URL`: the public URL printed on the share card and in share links.

Framework labels for every capability live in `js/labels.js` (`{ id, name }`); edit or blank them freely.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Balance check

The engine has no DOM, so a bot can defend thousands of runs headless:

```sh
node tools/sim.js 40 0.7   # win% [breach/fired] avg length per company x adversary; last arg = bot attentiveness, 0 = passive
```

`tools/og.html` is the source of `assets/og-image.jpg` (render it at 1200x630).

## Deploy to GitHub Pages

`.github/workflows/pages.yml` publishes the site on every push to `main` and stamps every asset URL with the commit hash. Pages source must be set to **GitHub Actions** (Settings → Pages).

## Project layout

```
index.html            all screens
css/style.css         ops-center UI
js/config.js          Telegram link, URLs, tick speed
js/labels.js          ATT&CK mitigation / data source labels per capability
js/i18n.js            EN/UA interface strings and lessons
js/data.js            departments, companies, entry vectors, ATT&CK techniques, adversaries, events, SOC alerts
js/upgrades.js        the 42-capability defense program with lore (bilingual)
js/game.js            simulation engine (no DOM, runs in node)
js/map.js             canvas network map with fog of war
js/audio.js           NIGHTSHIFT.FM generative radio + sound effects
js/share.js           result card + sharing
js/ui.js              screens, HUD, input
tools/sim.js          headless balance bot
```
