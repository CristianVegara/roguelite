/**
 * HomeScreen.ts — HTML replacement for HomeScene.
 *
 * CHANGES:
 *   - TabId: 'ranks' renamed to 'history' (more accurate label).
 *   - buildTabNav(): SHOP removed — it is navigation not a tab.
 *     Now lives in the header as .hs-header-shop.
 *   - buildHeader(): right side restructured into .hs-header-right
 *     containing currency chip + SHOP link button.
 *   - buildPlayPane(): last-run reentry card moved to TOP of pane
 *     with a PLAY AGAIN button as re-engagement hook.
 *   - buildHistoryPane() (was buildRanksPane()): VIEW LEADERBOARD
 *     link added at the bottom.
 *   - Settings RENAME now passes { rename: true } to name-entry route.
 *   - Keyboard binds list updated to include M key (pause).
 */

import { ServiceLocator }                    from '../services/ServiceLocator';
import { ALL_MILESTONES }                     from '../services/types';
import { metaService, UPGRADE_INFO, META_MAX_LEVEL, UpgradeKey } from '../meta/MetaService';
import { MODES_REGISTRY, GameModeConfig }    from '../modes/GameModeConfig';
import { router }                            from '../router/Router';
import { startRun }                          from '../bridge/startRun';

export function createHomeScreen(): HTMLElement {
  return new HomeScreen().el;
}

type TabId = 'play' | 'history' | 'profile' | 'settings';

class HomeScreen {
  readonly el: HTMLElement;

  private tabs    = new Map<TabId, HTMLElement>();
  private tabBtns = new Map<TabId, HTMLElement>();
  private currencyEl!: HTMLElement;

  constructor() {
    this.el = this.build();
    this.showTab('play');
  }

  private build(): HTMLElement {
    const root = el('div', 'home-screen');
    root.append(
      this.buildHeader(),
      this.buildTabNav(),
      this.buildTabContent('play',     () => this.buildPlayPane()),
      this.buildTabContent('history',  () => this.buildHistoryPane()),
      this.buildTabContent('profile',  () => this.buildProfilePane()),
      this.buildTabContent('settings', () => this.buildSettingsPane()),
    );
    return root;
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const header = el('div', 'hs-header');

    const title = el('span', 'hs-title');
    title.textContent = 'THE SPIRE';

    const profile  = ServiceLocator.profile.getProfile();
    const name     = profile?.name ?? 'Player';
    const streak   = (profile?.current_streak ?? 0) > 1
      ? `  \u{1F525}${profile!.current_streak}` : '';
    const nameEl   = el('span', 'hs-player-name');
    nameEl.textContent = `${name}${streak}`;
    nameEl.addEventListener('click', () => this.showTab('profile'));

    const right = el('div', 'hs-header-right');

    this.currencyEl = el('span', 'hs-currency');
    this.currencyEl.textContent = '\u2605 ' + metaService.currency;

    const shopBtn = el('button', 'hs-header-shop');
    shopBtn.textContent = 'SHOP';
    shopBtn.addEventListener('click', () => router.navigate('shop'));

    right.append(this.currencyEl, shopBtn);
    header.append(title, nameEl, right);
    return header;
  }

  // ── Tab nav ────────────────────────────────────────────────────────────────

  private buildTabNav(): HTMLElement {
    const nav = el('nav', 'hs-tab-nav');
    const tabs:   TabId[] = ['play', 'history', 'profile', 'settings'];
    const labels           = ['PLAY', 'HISTORY', 'PROFILE', 'SETTINGS'];

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

  private buildPlayPane(): HTMLElement {
    const pane = el('div', 'hs-play-pane');

    const lastRun = metaService.lastRun;
    if (lastRun) {
      pane.appendChild(
        this.buildReentryCard(lastRun.floor, lastRun.kills, lastRun.bossesDefeated),
      );
    }

    pane.appendChild(sectionLabel('GAME MODES'));
    const grid = el('div', 'hs-mode-grid');
    MODES_REGISTRY.forEach(mode => grid.appendChild(this.buildModeCard(mode)));
    pane.appendChild(grid);

    pane.appendChild(sectionLabel('PERMANENT UPGRADES'));
    const upgradeList = el('div', 'hs-upgrade-list');
    UPGRADE_INFO.forEach(info => {
      upgradeList.appendChild(this.buildUpgradeRow(info.key, info.label, info.color));
    });
    pane.appendChild(upgradeList);

    return pane;
  }

  private buildReentryCard(floor: number, kills: number, bosses: number): HTMLElement {
    const card = el('div', 'hs-last-run hs-last-run--reentry');

    const labelEl  = el('span', 'hs-last-run-label');
    labelEl.textContent = 'LAST RUN';

    const floorEl  = el('span', 'hs-last-run-floor');
    floorEl.textContent = 'Floor ' + floor;

    const detailEl = el('span', 'hs-last-run-detail');
    detailEl.textContent = kills + ' kills \u00b7 ' + bosses + ' bosses';

    const playAgain = el('button', 'hs-last-run-play-btn');
    playAgain.textContent = 'PLAY AGAIN \u2192';
    playAgain.addEventListener('click', () => {
      const lastMode = ServiceLocator.history.getRecentRuns(1)[0]?.mode_id ?? 'classic';
      router.navigate('class-select', { modeId: lastMode });
    });

    card.append(labelEl, floorEl, detailEl, playAgain);
    return card;
  }

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

    const iconEl  = el('span', 'hs-mode-icon');   iconEl.textContent  = mode.icon;
    const nameEl  = el('span', 'hs-mode-name');   nameEl.textContent  = mode.name.toUpperCase();
    const diffEl  = el('span', 'hs-mode-diff');   diffEl.textContent  = mode.difficulty.toUpperCase();
    diffEl.style.color = diffColors[mode.difficulty] ?? 'var(--text-secondary)';
    const bestEl  = el('span', 'hs-mode-best');   bestEl.textContent  = bestStr;
    const playBtn = el('button', 'hs-mode-play'); playBtn.textContent = 'PLAY';

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mode.rules.forceRandomClass) {
        startRun({ modeId: mode.id, classId: '' });
      } else {
        router.navigate('class-select', { modeId: mode.id });
      }
    });

    card.append(iconEl, nameEl, diffEl, bestEl, playBtn);
    return card;
  }

  private buildUpgradeRow(key: UpgradeKey, label: string, color: number): HTMLElement {
    const row = el('div', 'hs-upgrade-row');

    const nameEl = el('span', 'hs-upg-name');
    nameEl.textContent = label;
    nameEl.style.color = intToHex(color);

    const dotsEl   = el('div', 'hs-upg-dots');
    const drawDots = () => {
      dotsEl.innerHTML = '';
      const level = metaService.upgrades[key];
      for (let i = 0; i < META_MAX_LEVEL; i++) {
        const dot = el('span', 'hs-upg-dot');
        if (i < level) dot.classList.add('is-filled');
        dot.style.setProperty('--dot-color', intToHex(color));
        dotsEl.appendChild(dot);
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
      if (metaService.purchase(key)) {
        drawDots();
        setLevelText();
        refreshBtn();
        this.currencyEl.textContent = '\u2605 ' + metaService.currency;
      }
    });

    row.append(nameEl, dotsEl, levelEl, buyBtn);
    return row;
  }

  // ── HISTORY tab ────────────────────────────────────────────────────────────

  private buildHistoryPane(): HTMLElement {
    const pane = el('div', 'hs-ranks-pane');
    pane.appendChild(sectionLabel('PERSONAL BESTS'));

    const runs       = ServiceLocator.history.getRecentRuns(50);
    const bestByMode = this.getBestRunsPerMode(runs);

    if (bestByMode.length === 0) {
      const empty = el('p', 'hs-empty');
      empty.textContent = 'Complete a run to see your records.';
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
    }

    const lbBtn = el('button', 'hs-stats-btn');
    lbBtn.textContent = 'FULL RUN HISTORY  \u2192';
    lbBtn.style.marginTop = 'auto';
    lbBtn.addEventListener('click', () => router.navigate('leaderboard'));
    pane.appendChild(lbBtn);

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

    const card = el('div', 'hs-profile-card');
    const nameEl = el('div', 'hs-profile-name'); nameEl.textContent = profile.name;

    const streak = profile.current_streak > 1
      ? '  \u{1F525} ' + profile.current_streak + '-day streak' : '';
    const subEl  = el('div', 'hs-profile-sub');
    subEl.textContent = profile.total_runs + ' runs \u00b7 Best fl. ' + profile.highest_floor + streak;

    card.append(nameEl, subEl);

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
        chip.textContent = ALL_MILESTONES.find(m => m.id === id)?.title ?? id;
        if (id === profile.active_title) chip.classList.add('is-active');

        chip.addEventListener('click', () => {
          if (id === profile.active_title) return;
          ServiceLocator.profile.updateProfile({ active_title: id });
          profile.active_title = id;
          titleEl.textContent = '[' + id + ']';
          if (!card.contains(titleEl)) card.appendChild(titleEl);
          titles.querySelectorAll('.hs-title-chip').forEach(e =>
            e.classList.remove('is-active'));
          chip.classList.add('is-active');
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
        ServiceLocator.profile.reset();
        router.navigate('name-entry', { rename: true });
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