/**
 * HomeScreen.ts — main menu.
 *
 * MENU IMPROVEMENTS (this revision):
 *
 *  High priority
 *   1. Permanent upgrades moved out of PLAY into their own UPGRADES tab.
 *      PLAY tab is now: reentry card + mode grid only. Clean intent separation.
 *   2. Mode cards are single-click (whole card = play). Inner PLAY button removed.
 *      Mode cards now show a flavour line and one-sentence description.
 *   3. PLAY AGAIN is a full-width primary button spanning the whole reentry card.
 *      Last-run card also shows class name and mode from run history.
 *   4. SHOP button promoted to icon+text with border accent in header.
 *
 *  Medium priority
 *   5. Currency chip turns green when the player can afford at least one upgrade.
 *   6. Purchase feedback: currency counter briefly flashes the gold delta ("-25 ★")
 *      and the newly-filled dot plays a pop animation.
 *   7. History tab: leaderboard link hidden until at least one run exists.
 *   8. Tab nav: 5 tabs (PLAY | UPGRADES | HISTORY | PROFILE | SETTINGS).
 *      Active tab gets a background fill, not just a bottom border.
 *   9. Profile pane: best-run callout card added at the top for context.
 *  10. Title chips: active/equipped title gets gold border + "WEARING" label.
 */

import { ServiceLocator }                    from '../services/ServiceLocator';
import { ALL_MILESTONES }                     from '../services/types';
import { metaService, UPGRADE_INFO, META_MAX_LEVEL, UpgradeKey } from '../meta/MetaService';
import { MODES_REGISTRY, GameModeConfig }    from '../modes/GameModeConfig';
import { ALL_CLASSES }                        from '../data/ClassDefinition';
import { router }                            from '../router/Router';
import { startRun }                          from '../bridge/startRun';

// ---------------------------------------------------------------------------
// Mode flavour copy — keyed by mode ID.
// Falls back to mode.description if the ID isn't listed here.
// ---------------------------------------------------------------------------
const MODE_FLAVOUR: Record<string, string> = {
  classic:    'Endless floors. Build until you fall.',
  boss_rush:  'Bosses only, back to back. No breathing room.',
  one_hp:     'One hit ends everything. Choose every upgrade carefully.',
  chaos:      'Random relics from the very start. Embrace the disorder.',
};

const MODE_ICON_LABEL: Record<string, string> = {
  normal:  'Normal',
  hard:    'Hard',
  extreme: 'Extreme',
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHomeScreen(): HTMLElement {
  return new HomeScreen().el;
}

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

type TabId = 'play' | 'upgrades' | 'history' | 'profile' | 'settings';

class HomeScreen {
  readonly el: HTMLElement;

  private tabs    = new Map<TabId, HTMLElement>();
  private tabBtns = new Map<TabId, HTMLElement>();
  private currencyEl!:  HTMLElement;
  private deltaEl!:     HTMLElement;       // flash element for purchase delta
  private deltaTimer:   ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.el = this.build();
    this.showTab('play');
    this.refreshCurrencyState();
    this.bindKeyboard();
  }

  // ── Root shell ─────────────────────────────────────────────────────────────

  private build(): HTMLElement {
    const root = el('div', 'home-screen');
    root.append(
      this.buildHeader(),
      this.buildTabNav(),
      this.buildTabContent('play',     () => this.buildPlayPane()),
      this.buildTabContent('upgrades', () => this.buildUpgradesPane()),
      this.buildTabContent('history',  () => this.buildHistoryPane()),
      this.buildTabContent('profile',  () => this.buildProfilePane()),
      this.buildTabContent('settings', () => this.buildSettingsPane()),
    );
    return root;
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const header = el('div', 'hs-header');

    // FIX 1: Title gets its own element class for bolder styling in CSS
    const title = el('div', 'hs-title-wrap');
    const titleMain = el('span', 'hs-title');
    titleMain.textContent = 'THE SPIRE';
    title.appendChild(titleMain);

    const profile  = ServiceLocator.profile.getProfile();
    const name     = profile?.name ?? 'Player';
    const streak   = (profile?.current_streak ?? 0) > 1
      ? ' \u{1F525}' + profile!.current_streak : '';
    const nameEl   = el('span', 'hs-player-name');
    nameEl.textContent = name + streak;
    nameEl.addEventListener('click', () => this.showTab('profile'));

    // FIX 4: SHOP promoted — icon + text with accent border
    const right = el('div', 'hs-header-right');

    // Currency wrapper holds the balance + the flash delta
    const currencyWrap = el('div', 'hs-currency-wrap');
    this.currencyEl = el('span', 'hs-currency');
    this.currencyEl.textContent = '\u2605 ' + metaService.currency;
    this.deltaEl = el('span', 'hs-currency-delta');
    currencyWrap.append(this.currencyEl, this.deltaEl);

    const shopBtn = el('button', 'hs-header-shop');
    shopBtn.innerHTML = '<i class="ti ti-shirt" aria-hidden="true"></i> SHOP';
    shopBtn.addEventListener('click', () => router.navigate('shop'));

    right.append(currencyWrap, shopBtn);
    header.append(title, nameEl, right);
    return header;
  }

  // ── Tab nav ────────────────────────────────────────────────────────────────

  private buildTabNav(): HTMLElement {
    const nav = el('nav', 'hs-tab-nav');
    // FIX 8: 5 tabs — UPGRADES split out from PLAY
    const tabs:   TabId[] = ['play', 'upgrades', 'history', 'profile', 'settings'];
    const labels           = ['PLAY', 'UPGRADES', 'HISTORY', 'PROFILE', 'SETTINGS'];

    tabs.forEach((id, i) => {
      const btn = el('button', 'hs-tab-btn');
      btn.textContent    = labels[i];
      btn.dataset['tab'] = id;
      btn.addEventListener('click', () => this.showTab(id));
      this.tabBtns.set(id, btn);
      nav.appendChild(btn);
    });

    return nav;
  }

  private buildTabContent(id: TabId, builder: () => HTMLElement): HTMLElement {
    const pane = el('div', 'hs-tab-pane');
    pane.dataset['tab'] = id;
    pane.appendChild(builder());
    this.tabs.set(id, pane);
    return pane;
  }

  private showTab(id: TabId): void {
    this.tabs.forEach((pane, key) => pane.classList.toggle('is-active', key === id));
    this.tabBtns.forEach((btn, key) => btn.classList.toggle('is-active', key === id));
  }

  // ── PLAY tab ───────────────────────────────────────────────────────────────
  // FIX 1: PLAY tab now only contains the reentry card + mode grid.
  // Upgrades moved to the UPGRADES tab — intent is now clear.

  private buildPlayPane(): HTMLElement {
    const pane = el('div', 'hs-play-pane');

    // FIX 3: reentry card at top with rich context
    const lastRun = metaService.lastRun;
    if (lastRun) {
      pane.appendChild(this.buildReentryCard());
    } else {
      // First-time player: warm welcome instead of blank
      const welcome = el('div', 'hs-welcome');
      const wt = el('div', 'hs-welcome-title'); wt.textContent = 'Welcome to The Spire';
      const ws = el('div', 'hs-welcome-sub');
      ws.textContent = 'Choose a mode below and select your class to begin your first run.';
      welcome.append(wt, ws);
      pane.appendChild(welcome);
    }

    pane.appendChild(sectionLabel('GAME MODES'));
    const grid = el('div', 'hs-mode-grid');
    MODES_REGISTRY.forEach(mode => grid.appendChild(this.buildModeCard(mode)));
    pane.appendChild(grid);

    return pane;
  }

  // FIX 3: full-context reentry card — shows class, mode, stats, full-width CTA
  private buildReentryCard(): HTMLElement {
    const card = el('div', 'hs-reentry-card');

    // Get extra context from the most recent run
    const lastRun = ServiceLocator.history.getRecentRuns(1)[0];
    const floor   = metaService.lastRun?.floor      ?? 0;
    const kills   = metaService.lastRun?.kills       ?? 0;
    const bosses  = metaService.lastRun?.bossesDefeated ?? 0;

    const classLabel = lastRun ? humaniseClass(lastRun.class_id) : '';
    const modeLabel  = lastRun
      ? MODES_REGISTRY.find(m => m.id === lastRun.mode_id)?.name ?? lastRun.mode_id
      : '';
    const lastMode   = lastRun?.mode_id ?? 'classic';

    const meta = el('div', 'hs-reentry-meta');
    meta.textContent = 'LAST RUN';

    const identity = el('div', 'hs-reentry-identity');
    if (classLabel && modeLabel) {
      // FIX 14: show class + mode
      identity.textContent = classLabel + ' \u00b7 ' + modeLabel;
    }

    const stats = el('div', 'hs-reentry-stats');
    const floorEl = el('span', 'hs-reentry-floor');
    floorEl.textContent = 'Floor ' + floor;
    const detailEl = el('span', 'hs-reentry-detail');
    detailEl.textContent = kills + ' kills \u00b7 ' + bosses + ' bosses';
    stats.append(floorEl, detailEl);

    // FIX 3: PLAY AGAIN as full-width primary button
    const playAgain = el('button', 'hs-reentry-play');
    playAgain.textContent = 'PLAY AGAIN \u2192';
    playAgain.addEventListener('click', () => {
      router.navigate('class-select', { modeId: lastMode });
    });

    card.append(meta, identity, stats, playAgain);
    return card;
  }

  // FIX 2: single-click card, no inner PLAY button, flavour + description added
  private buildModeCard(mode: GameModeConfig): HTMLElement {
    const card = el('div', 'hs-mode-card');
    card.style.setProperty('--mode-color', intToHex(mode.color));

    const diffColors: Record<string, string> = {
      normal: '#2ecc71', hard: '#f39c12', extreme: '#e74c3c',
    };

    const bestRun  = this.getBestRunForMode(mode.id);
    const bestStr  = bestRun
      ? mode.id === 'boss_rush'
        ? 'Best: ' + bestRun.bosses_killed + ' bosses'
        : 'Best: Fl. ' + bestRun.floor_reached
      : 'No runs yet';

    const topRow = el('div', 'hs-mode-top');
    const iconEl = el('span', 'hs-mode-icon');   iconEl.textContent  = mode.icon;
    const nameEl = el('span', 'hs-mode-name');   nameEl.textContent  = mode.name.toUpperCase();
    const diffEl = el('span', 'hs-mode-diff');
    diffEl.textContent = (MODE_ICON_LABEL[mode.difficulty] ?? mode.difficulty).toUpperCase();
    diffEl.style.color = diffColors[mode.difficulty] ?? 'var(--text-secondary)';
    topRow.append(iconEl, nameEl, diffEl);

    // FIX 2: flavour line — one atmospheric sentence
    const flavourEl = el('div', 'hs-mode-flavour');
    flavourEl.textContent = MODE_FLAVOUR[mode.id] ?? '';

    // FIX 2: description — what makes this mode different
    const descEl = el('div', 'hs-mode-desc');
    descEl.textContent = (mode as any).description ?? '';

    const bestEl = el('div', 'hs-mode-best');
    bestEl.textContent = bestStr;

    card.append(topRow, flavourEl, descEl, bestEl);

    // FIX 2: whole card is clickable — no inner button
    card.addEventListener('click', () => {
      card.classList.add('is-selected');
      setTimeout(() => {
        if (mode.rules.forceRandomClass) {
          startRun({ modeId: mode.id, classId: '' });
        } else {
          router.navigate('class-select', { modeId: mode.id });
        }
      }, 90);
    });

    return card;
  }

  // ── UPGRADES tab ───────────────────────────────────────────────────────────
  // FIX 1: permanent upgrades now live here, separate from play intent.

  private buildUpgradesPane(): HTMLElement {
    const pane = el('div', 'hs-upgrades-pane');

    const intro = el('div', 'hs-upgrades-intro');
    intro.textContent = 'Upgrades persist across all runs and modes. Spend earned gold to strengthen future runs.';
    pane.appendChild(intro);

    pane.appendChild(sectionLabel('PERMANENT UPGRADES'));
    const upgradeList = el('div', 'hs-upgrade-list');
    UPGRADE_INFO.forEach(info => {
      upgradeList.appendChild(this.buildUpgradeRow(info.key, info.label, info.color));
    });
    pane.appendChild(upgradeList);

    return pane;
  }

  private buildUpgradeRow(key: UpgradeKey, label: string, color: number): HTMLElement {
    const row = el('div', 'hs-upgrade-row');
    // FIX 16: left-border accent color matches the upgrade's own color token
    row.style.setProperty('--upg-accent', intToHex(color));

    const nameEl = el('span', 'hs-upg-name');
    nameEl.textContent = label;
    nameEl.style.color = intToHex(color);

    const dotsEl   = el('div', 'hs-upg-dots');
    const dotEls: HTMLElement[] = [];
    const drawDots = () => {
      dotsEl.innerHTML = '';
      dotEls.length = 0;
      const level = metaService.upgrades[key];
      for (let i = 0; i < META_MAX_LEVEL; i++) {
        const dot = el('span', 'hs-upg-dot');
        if (i < level) dot.classList.add('is-filled');
        dot.style.setProperty('--dot-color', intToHex(color));
        dotsEl.appendChild(dot);
        dotEls.push(dot);
      }
    };
    drawDots();

    const levelEl      = el('span', 'hs-upg-level');
    const setLevelText = () => {
      levelEl.textContent = metaService.upgrades[key] + '/' + META_MAX_LEVEL;
    };
    setLevelText();

    const buyBtn = document.createElement('button');
    buyBtn.className = 'hs-upg-buy';
    const refreshBtn = () => {
      const isMax     = metaService.isMaxLevel(key);
      const canAfford = metaService.canAfford(key);
      const cost      = metaService.costForUpgrade(key);
      buyBtn.textContent     = isMax ? 'MAX' : 'BUY';
      buyBtn.dataset['cost'] = isMax ? '' : cost + ' \u2605';
      buyBtn.disabled        = isMax || !canAfford;
      buyBtn.classList.toggle('is-max',     isMax);
      buyBtn.classList.toggle('can-afford', canAfford && !isMax);
    };
    refreshBtn();

    buyBtn.addEventListener('click', () => {
      const cost = metaService.costForUpgrade(key);
      if (metaService.purchase(key)) {
        const prevLevel = metaService.upgrades[key] - 1;
        drawDots();
        setLevelText();
        refreshBtn();
        // FIX 6: animate the newly filled dot
        const newDot = dotEls[prevLevel];
        if (newDot) {
          newDot.classList.add('is-popped');
          setTimeout(() => newDot.classList.remove('is-popped'), 400);
        }
        // FIX 6: flash purchase delta on currency
        this.flashDelta('-' + cost + ' \u2605');
        this.refreshCurrencyState();
      }
    });

    row.append(nameEl, dotsEl, levelEl, buyBtn);
    return row;
  }

  // FIX 5 + 6: currency chip state and delta flash
  private refreshCurrencyState(): void {
    this.currencyEl.textContent = '\u2605 ' + metaService.currency;
    // Turn chip green if player can afford at least one upgrade
    const canAffordAny = UPGRADE_INFO.some(info => metaService.canAfford(info.key));
    this.currencyEl.classList.toggle('is-affordable', canAffordAny);
  }

  private flashDelta(text: string): void {
    if (this.deltaTimer) clearTimeout(this.deltaTimer);
    this.deltaEl.textContent = text;
    this.deltaEl.classList.add('is-visible');
    this.deltaTimer = setTimeout(() => {
      this.deltaEl.classList.remove('is-visible');
    }, 1400);
  }

  // ── HISTORY tab ────────────────────────────────────────────────────────────

  private buildHistoryPane(): HTMLElement {
    const pane = el('div', 'hs-ranks-pane');
    pane.appendChild(sectionLabel('PERSONAL BESTS'));

    const runs       = ServiceLocator.history.getRecentRuns(50);
    const bestByMode = this.getBestRunsPerMode(runs);

    if (bestByMode.length === 0) {
      const empty = el('div', 'hs-history-empty');
      const emIcon = el('div', 'hs-history-empty-icon'); emIcon.textContent = '\u{1F3AF}';
      const emTitle = el('div', 'hs-history-empty-title');
      emTitle.textContent = 'No runs yet';
      const emSub = el('div', 'hs-history-empty-sub');
      emSub.textContent = 'Complete a run in any mode and your personal bests will appear here.';
      empty.append(emIcon, emTitle, emSub);
      pane.appendChild(empty);
    } else {
      const table = el('div', 'hs-ranks-table');

      const hdr = el('div', 'hs-ranks-row hs-ranks-hdr');
      ['MODE', 'STAT', 'BUILD', 'DATE'].forEach(col => {
        const c = el('span'); c.textContent = col; hdr.appendChild(c);
      });
      table.appendChild(hdr);

      bestByMode.forEach(({ mode, run }) => {
        const row = el('div', 'hs-ranks-row');
        row.style.setProperty('--mode-color', intToHex(mode.color));

        const statVal = mode.id === 'boss_rush'
          ? (run.bosses_killed ?? 0) + ' BO'
          : run.floor_reached + ' FL';

        const dateStr = new Date(run.date).toLocaleDateString('en-GB', {
          month: 'short', day: 'numeric',
        });

        const modeEl  = el('span', 'hs-ranks-mode');  modeEl.textContent  = mode.icon + '  ' + mode.name;
        const statEl  = el('span', 'hs-ranks-stat');  statEl.textContent  = statVal;
        const buildEl = el('span', 'hs-ranks-build'); buildEl.textContent = run.build_archetype;
        const dateEl  = el('span', 'hs-ranks-date');  dateEl.textContent  = dateStr;

        row.append(modeEl, statEl, buildEl, dateEl);
        table.appendChild(row);
      });

      pane.appendChild(table);

      // FIX 7: leaderboard link only shown when runs exist
      const lbBtn = el('button', 'hs-stats-btn');
      lbBtn.textContent = 'FULL RUN HISTORY  \u2192';
      lbBtn.style.marginTop = 'auto';
      lbBtn.addEventListener('click', () => router.navigate('leaderboard'));
      pane.appendChild(lbBtn);
    }

    return pane;
  }

  // ── PROFILE tab ────────────────────────────────────────────────────────────

  private buildProfilePane(): HTMLElement {
    const pane    = el('div', 'hs-profile-pane');
    const profile = ServiceLocator.profile.getProfile();

    if (!profile) {
      const empty = el('p', 'hs-empty'); empty.textContent = 'No profile found.';
      pane.appendChild(empty);
      return pane;
    }

    // FIX 9: best-run callout at the top for context
    const allRuns = ServiceLocator.history.getRecentRuns(50);
    const bestRun = allRuns.sort((a, b) => b.floor_reached - a.floor_reached)[0];
    if (bestRun) {
      const callout = el('div', 'hs-best-callout');
      const blabel  = el('span', 'hs-best-label'); blabel.textContent = 'PERSONAL BEST';
      const bfloor  = el('span', 'hs-best-floor'); bfloor.textContent = 'Floor ' + bestRun.floor_reached;
      const bdetail = el('span', 'hs-best-detail');
      bdetail.textContent = humaniseClass(bestRun.class_id) + ' \u00b7 ' +
        (MODES_REGISTRY.find(m => m.id === bestRun.mode_id)?.name ?? bestRun.mode_id);
      callout.append(blabel, bfloor, bdetail);
      pane.appendChild(callout);
    }

    const card = el('div', 'hs-profile-card');

    // FIX 22: styled initials avatar — more personal than a class emoji.
    // Shows the first letter of the player name in a coloured circle,
    // with the player's favourite class emoji as a small badge overlay.
    const avatarWrap = el('div', 'hs-avatar-wrap');
    const avatarCircle = el('div', 'hs-avatar-circle');
    // Derive a hue from the name so each player gets a consistent colour
    const hue = Array.from(profile.name).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    avatarCircle.style.setProperty('--avatar-hue', String(hue));
    avatarCircle.textContent = (profile.name[0] ?? '?').toUpperCase();

    const favClass = (profile.favorite_class ?? '');
    if (favClass) {
      const badge = el('span', 'hs-avatar-badge');
      const cls = ALL_CLASSES.find(c => c.id === favClass);
      badge.textContent = cls?.icon ?? '\u2605';
      avatarWrap.appendChild(badge);
    }
    avatarWrap.appendChild(avatarCircle);

    const nameEl = el('div', 'hs-profile-name'); nameEl.textContent = profile.name;

    const streak = profile.current_streak > 1
      ? '  \u{1F525} ' + profile.current_streak + '-day streak' : '';
    const subEl  = el('div', 'hs-profile-sub');
    subEl.textContent = profile.total_runs + ' runs \u00b7 Best fl. ' + profile.highest_floor + streak;

    // Wrap text in a column body so it sits beside the avatar, not as separate flex items
    const cardBody = el('div', 'hs-profile-card-body');
    cardBody.append(nameEl, subEl);
    card.append(avatarWrap, cardBody);

    const titleEl = el('span', 'hs-profile-title');
    if (profile.active_title) {
      titleEl.textContent = '[' + profile.active_title + ']';
      card.appendChild(titleEl);
    }
    pane.appendChild(card);

    const grid = el('div', 'hs-profile-stats');
    const stats: Array<[string, string]> = [
      ['WINS',   String(profile.wins)],
      ['KILLS',  profile.total_kills.toLocaleString()],
      ['BOSSES', String(profile.total_bosses_killed)],
      ['STREAK', profile.best_streak + ' days'],
    ];
    stats.forEach(([label, val]) => {
      const cell  = el('div', 'hs-stat-cell');
      const lbl   = el('span', 'hs-stat-lbl'); lbl.textContent = label;
      const valEl = el('span', 'hs-stat-val'); valEl.textContent = val;
      cell.append(lbl, valEl);
      grid.appendChild(cell);
    });
    pane.appendChild(grid);

    pane.appendChild(sectionLabel('TITLES EARNED'));
    const titles = el('div', 'hs-titles');
    if (profile.unlocked_titles.length === 0) {
      const empty = el('span', 'hs-empty');
      empty.textContent = 'Complete a run to earn your first title.';
      titles.appendChild(empty);
    } else {
      const hint = el('div', 'hs-title-hint');
      hint.textContent = 'Tap a title to equip it.';
      pane.appendChild(hint);

      profile.unlocked_titles.forEach(id => {
        const chip = el('button', 'hs-title-chip');
        const milTitle = ALL_MILESTONES.find(m => m.id === id)?.title ?? id;
        const isActive = id === profile.active_title;

        chip.textContent = milTitle;
        if (isActive) {
          chip.classList.add('is-active');
          // FIX 10: "WEARING" label on equipped title
          const wearing = el('span', 'hs-title-wearing'); wearing.textContent = 'wearing';
          chip.appendChild(wearing);
        }

        chip.addEventListener('click', () => {
          if (id === profile.active_title) return;
          ServiceLocator.profile.updateProfile({ active_title: id });
          profile.active_title = id;
          titleEl.textContent = '[' + id + ']';
          if (!card.contains(titleEl)) card.appendChild(titleEl);
          titles.querySelectorAll('.hs-title-chip').forEach(e => {
            e.classList.remove('is-active');
            e.querySelector('.hs-title-wearing')?.remove();
          });
          chip.classList.add('is-active');
          const w = el('span', 'hs-title-wearing'); w.textContent = 'wearing';
          chip.appendChild(w);
        });

        titles.appendChild(chip);
      });
    }
    pane.appendChild(titles);

    const statsBtn = el('button', 'hs-stats-btn');
    statsBtn.textContent = 'FULL PROFILE & STATISTICS  \u2192';
    statsBtn.addEventListener('click', () => router.navigate('stats'));
    pane.appendChild(statsBtn);

    return pane;
  }

  // ── SETTINGS tab ───────────────────────────────────────────────────────────

  private buildSettingsPane(): HTMLElement {
    const pane = el('div', 'hs-settings-pane');
    pane.appendChild(sectionLabel('SETTINGS'));

    const renameRow = this.buildSettingsRow(
      'Change Name',
      'Opens name entry to change your display name',
      'RENAME \u2192',
      () => {
        sessionStorage.setItem('nameEntryContext', 'rename');
        router.navigate('name-entry');
      },
    );
    pane.appendChild(renameRow);

    let resetPending = false;
    const resetRow = this.buildSettingsRow(
      'Reset All Data',
      'Clears all progress, currency and statistics',
      'RESET \u2192',
      (btn) => {
        if (resetPending) {
          metaService.resetSave();
          ServiceLocator.profile.reset();
          ServiceLocator.history.clear();
          router.navigate('name-entry');
        } else {
          resetPending = true;
          btn.textContent = 'TAP AGAIN \u2192';
          setTimeout(() => { resetPending = false; btn.textContent = 'RESET \u2192'; }, 3000);
        }
      },
      true,
    );
    pane.appendChild(resetRow);

    pane.appendChild(sectionLabel('CONTROLS'));
    const binds: Array<[string, string]> = [
      ['B',       'Build overview (during run)'],
      ['Tab',     'Stats panel (during run)'],
      ['M',       'Pause menu (during run)'],
      ['1 / 2 / 3', 'Select upgrade or relic card'],
      ['S',       'Skip upgrade / relic'],
      ['ESC / B', 'Back (menus)'],
    ];
    const bindList = el('div', 'hs-bind-list');
    binds.forEach(([key, desc]) => {
      const row    = el('div', 'hs-bind-row');
      const keyEl  = el('span', 'hs-bind-key');  keyEl.textContent  = '[' + key + ']';
      const descEl = el('span', 'hs-bind-desc'); descEl.textContent = desc;
      row.append(keyEl, descEl);
      bindList.appendChild(row);
    });
    pane.appendChild(bindList);

    // FIX 17: version line — players know what build they're on
    const versionRow = el('div', 'hs-version-row');
    versionRow.textContent = 'The Spire \u00b7 browser build';
    pane.appendChild(versionRow);

    return pane;
  }

  private buildSettingsRow(
    title:    string,
    desc:     string,
    btnLabel: string,
    onClick:  (btn: HTMLElement) => void,
    danger = false,
  ): HTMLElement {
    const row     = el('div', 'hs-settings-row');
    const info    = el('div', 'hs-settings-info');
    const titleEl = el('div', 'hs-settings-title'); titleEl.textContent = title;
    if (danger) titleEl.classList.add('is-danger');
    const descEl  = el('div', 'hs-settings-desc');  descEl.textContent  = desc;
    info.append(titleEl, descEl);

    const btn = el('button', 'hs-settings-btn');
    btn.textContent = btnLabel;
    if (danger) btn.classList.add('is-danger');
    btn.addEventListener('click', () => onClick(btn));

    row.append(info, btn);
    return row;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * FIX 18: Keyboard navigation for tabs.
   * Left / Right arrow keys cycle through tabs.
   * Only active when the home screen is mounted and no modal is open.
   */
  private bindKeyboard(): void {
    const TAB_ORDER: TabId[] = ['play', 'upgrades', 'history', 'profile', 'settings'];

    const onKey = (e: KeyboardEvent) => {
      // Skip if focus is inside an input or the event target is interactive
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'button' || tag === 'select') return;
      // Skip if a modal dim overlay is visible
      if (document.querySelector('.modal-dim.is-visible')) return;

      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      // Find currently active tab
      let currentIdx = 0;
      this.tabBtns.forEach((_, key) => {
        const idx = TAB_ORDER.indexOf(key);
        if (this.tabs.get(key)?.classList.contains('is-active') && idx >= 0) {
          currentIdx = idx;
        }
      });

      const dir      = e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx  = (currentIdx + dir + TAB_ORDER.length) % TAB_ORDER.length;
      const nextTab  = TAB_ORDER[nextIdx];
      e.preventDefault();
      this.showTab(nextTab);
      // Move focus to the tab button so keyboard position is visible
      this.tabBtns.get(nextTab)?.focus();
    };

    document.addEventListener('keydown', onKey);

    // Clean up when this screen is removed from the DOM
    const observer = new MutationObserver(() => {
      if (!document.body.contains(this.el)) {
        document.removeEventListener('keydown', onKey);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }

  private getBestRunForMode(modeId: string) {
    const runs = ServiceLocator.history.getRecentRuns(50).filter(r => r.mode_id === modeId);
    if (modeId === 'boss_rush') {
      return runs.sort((a, b) => (b.bosses_killed ?? 0) - (a.bosses_killed ?? 0))[0] ?? null;
    }
    return runs.sort((a, b) => b.floor_reached - a.floor_reached)[0] ?? null;
  }

  private getBestRunsPerMode(runs: import('../services/types').RunResultDTO[]) {
    const best = new Map<string, import('../services/types').RunResultDTO>();
    runs.forEach(r => {
      const prev     = best.get(r.mode_id);
      const isBetter = r.mode_id === 'boss_rush'
        ? !prev || (r.bosses_killed ?? 0) > (prev.bosses_killed ?? 0)
        : !prev || r.floor_reached > prev.floor_reached;
      if (isBetter) best.set(r.mode_id, r);
    });
    return MODES_REGISTRY
      .filter(m => best.has(m.id))
      .map(m => ({ mode: m, run: best.get(m.id)! }));
  }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) className.split(' ').forEach(c => c && e.classList.add(c));
  return e;
}

function sectionLabel(text: string): HTMLElement {
  const s = el('div', 'hs-section-label');
  s.textContent = text;
  return s;
}

function intToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

function humaniseClass(id: string): string {
  if (!id || id === 'unknown') return '\u2014';
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
}