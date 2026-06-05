import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConfig';
import { Player } from '../entities/Player';
import { Enemy }  from '../entities/Enemy';
import { RulesEngine, AttackResult, DefenseResult } from '../combat/RulesEngine';
import { FloorManager } from '../floors/FloorManager';
import { pickRunUpgrades, ALL_UPGRADES } from '../data/AllUpgrades';
import { pickRelics, ALL_RELICS } from '../data/AllRelics';
import { ServiceLocator } from '../services/ServiceLocator';
import { RunResultDTO }   from '../services/types';
import { OwnedUpgrades, FloaterType } from '../data/UpgradeDefinition';
import { metaService, MetaService } from '../meta/MetaService';
import { StatsPanel }  from '../ui/StatsPanel';
import { BuildPanel }  from '../ui/BuildPanel';
import { ClassDefinition, findClass } from '../data/ClassDefinition';
import { getRunConfig } from '../RunConfig';
import { SpriteLoader, type MonsterSheetKey } from '../sprites/SpriteLoader';
import { XPManager }    from '../combat/XPManager';
// ── Bridge ────────────────────────────────────────────────────────────────────
import { bus }      from '../bridge/GameEventBus';
import { runState } from '../bridge/RunStateStore';
import { startRun } from '../bridge/startRun';
import { router }   from '../router/Router';
import { ModeId }   from '../modes/GameModeConfig';

type CombatState = 'fighting' | 'floor_clear' | 'player_dead' | 'special_floor';

const PLAYER_X = 130;
const ENEMY_X  = 350;
const COMBAT_Y = 350;

// ── Layout zones ─────────────────────────────────────────────────────────────
const HEADER_H     = 44;   // top bar (floor label, class badge, speed buttons)
const MOD_STRIP_Y  = HEADER_H;
const MOD_STRIP_H  = 0;    // modifier is now a floating pill — no reserved row
const HP_PANEL_Y   = MOD_STRIP_Y + MOD_STRIP_H;   // 44
const HP_PANEL_H   = 58;
const BOT_BAR_Y    = GAME_HEIGHT - 52;             // bottom info bar top edge (588)

export class GameScene extends Phaser.Scene {
  private player!:       Player;
  private enemy!:        Enemy;
  private floorManager!: FloorManager;
  private engine!:       RulesEngine;
  private owned!:        OwnedUpgrades;
  private ownedRelics!:  Set<string>;
  private state:         CombatState = 'fighting';
  private statsPanel!:   StatsPanel;
  private buildPanel!:   BuildPanel;

  private killCount     = 0;
  private bossKillCount = 0;
  private xpManager!:   XPManager;
  /** Set to true only when the player achieves a deliberate win (e.g. Classic floor cap).
   *  Kept false on all deaths so onPlayerDead() never mis-reports a win. */
  private _runWon = false;
  /**
   * Inverse of the CSS scale applied by Scale.FIT.
   * On a 390 px phone displayScale ≈ 0.81 → floaterScale ≈ 1.23.
   * Clamped to [1, 1.5]: desktop is unchanged, extreme phones don't get huge numbers.
   */
  private floaterScale = 1;

  // Pending flags set by XP events; consumed in onFloorClear
  private pendingLevelUpUpgrade = false;
  private pendingBossUpgrade    = false;
  private preRunUpgradePicksRemaining = 0;
  private currentClass: ClassDefinition | null = null;
  private monsterSheet: MonsterSheetKey = 'monster_sheet_1';
  private runStartTime     = 0;   // Date.now() at run start, for duration tracking
  /** Display name of the current enemy — tracked here since Enemy doesn't store it. */
  private currentEnemyName = 'ENEMY';
  /** Unsubscribe handle for the bus speed:change listener. */
  private busOffSpeed: (() => void) | null = null;
  /** Unsubscribe handles for pause-menu bus listeners. */
  private busOffPause:   (() => void) | null = null;
  private busOffRestart: (() => void) | null = null;
  private busOffQuit:    (() => void) | null = null;

  // Speed controls (×1, ×1.5, ×2)
  private gameSpeed: 1 | 1.5 | 2 = 1;

  private overlay!: Phaser.GameObjects.Container;
  /** Floating proc counter rendered directly above the player sprite. */
  private hitCounterLabel: Phaser.GameObjects.Text | null = null;

  constructor() { super({ key: 'GameScene' }); }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  create(): void {
    this.state        = 'fighting';
    const cfg0        = getRunConfig();
    this.monsterSheet  = cfg0.modeId === 'boss_rush'
      ? 'monster_sheet_1'
      : SpriteLoader.chooseRunMonsterSheet();

    this.floorManager = new FloorManager({
      bossesOnly:            cfg0.rules.bossesOnly,
      allFloorsModified:     cfg0.rules.allFloorsModified,
      bossEveryNFloors:      cfg0.rules.bossEveryNFloors,
      enemyHpMultiplier:     cfg0.rules.enemyHpMultiplier,
      enemyDamageMultiplier: cfg0.rules.enemyDamageMultiplier,
      enemySpeedMultiplier:  cfg0.rules.enemySpeedMultiplier,
      monsterSheet:          this.monsterSheet,
      getRandomBossCellKey:  SpriteLoader.getRandomBossSheetCellKey,
    });
    this.owned               = new Map();
    this.ownedRelics         = new Set();
    this.pendingLevelUpUpgrade = false;
    this.pendingBossUpgrade    = false;
    this._runWon               = false;

    const cfg = cfg0;
    this.currentClass = findClass(cfg.classId);
    this.drawBackground();
    this.createEntities();

    // XP + leveling
    this.xpManager = new XPManager();
    this.xpManager.onLevelUp = () => { this.pendingLevelUpUpgrade = true; };

    // Apply chosen class (from ClassScene → RunConfig)
    if (this.currentClass) {
      this.currentClass.apply(this.player.stats, this.engine);
    }

    this.applyModeRules();
    this.createOverlay();
    this.statsPanel  = new StatsPanel(this, this.player, this.player.stats, this.engine);
    this.buildPanel  = new BuildPanel(this, this.player, this.owned, this.ownedRelics);
    void this.buildPanel;   // panel is self-managing via B key binding

    if (cfg0.modeId === 'one_hp' || cfg0.modeId === 'boss_rush') {
      this.state = 'special_floor';
      this.preRunUpgradePicksRemaining = 5;
      this.launchPreRunUpgradeSequence();
    } else {
      this.engine.onFloorStart(this.floorManager.currentModifier);
    }

    this.runStartTime = Date.now();

    // ── Floater scale compensation for CSS-scaled canvas on mobile ──────────────
    // Scale.FIT shrinks the canvas CSS size on narrow phones; floater font sizes
    // are in canvas pixels, so they appear tiny after CSS scaling. We boost them
    // by the inverse of the display scale, clamped so desktop is unaffected.
    const ds = this.scale.displayScale.x;  // CSS scale factor (≈0.81 on 390 px phone)
    this.floaterScale = Math.min(1.5, Math.max(1, 1 / ds));

    // ── Hit counter label (shown above player when proc-every-N talents active) ─
    this.hitCounterLabel = this.add
      .text(PLAYER_X, COMBAT_Y - 68, '', {
        fontSize:        '13px',
        color:           '#a8d8ff',
        fontFamily:      'monospace',
        fontStyle:       'bold',
        stroke:          '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setVisible(false);

    // ── Bridge: push initial run state so HTML HUD has data from frame 0 ────
    this.syncRunState();

    // ── Bridge: HTML speed buttons communicate speed changes via bus ─────────
    this.busOffSpeed = bus.on('speed:change', (e) => {
      this.setGameSpeed(e.payload.speed);
    });

    // ── Bridge: HTML Build / Stats buttons toggle Phaser panels ──────────────
    bus.on('hud:toggle-build', () => this.buildPanel.toggle());
    bus.on('hud:toggle-stats', () => this.statsPanel.toggle());

    // ── M key → request pause (emit only; scene.pause is handled by bus listener)
    this.input.keyboard?.on('keydown-M', () => {
      if (this.state === 'fighting') {
        bus.emit({ type: 'pause:open', payload: {} });
      }
    });

    // ── Pause menu bus responses ──────────────────────────────────────────────
    // pause:open — triggered by M key OR the mobile chrome pause button.
    // Centralising scene.pause() here means both input paths are identical.
    // Both off-functions are combined into busOffPause so a single call in
    // pause:quit / DESTROY cleans up both listeners.
    {
      const offOpen   = bus.on('pause:open', () => {
        if (this.state === 'fighting') this.scene.pause();
      });
      const offResume = bus.on('pause:resume', () => {
        this.scene.resume();
      });
      this.busOffPause = () => { offOpen(); offResume(); };
    }

    this.busOffRestart = bus.on('pause:restart', () => {
      const cfg = getRunConfig();
      this.scene.resume();
      startRun({ modeId: cfg.modeId as ModeId, classId: cfg.classId });
    });

    this.busOffQuit = bus.on('pause:quit', () => {
      // 1. Gate the update loop immediately so syncRunState() can't flip
      //    isRunActive back to true on the next tick.
      this.state = 'player_dead';

      // 2. Kill the HUD before the scene teardown fires.
      runState.update({ isRunActive: false });

      // 3. Eagerly unsubscribe all bus listeners (DESTROY will also do this,
      //    but being explicit avoids any edge-case ordering issues).
      this.busOffSpeed?.();   this.busOffSpeed   = null;
      this.busOffPause?.();   this.busOffPause   = null;
      this.busOffRestart?.(); this.busOffRestart = null;
      this.busOffQuit?.();    this.busOffQuit    = null;

      // 4. Stop the scene — terminates the RAF loop and fires DESTROY.
      //    Do NOT call this.scene.resume() first: we want the loop to stay
      //    dead, not tick once more before stop() lands.
      this.scene.stop();

      // 5. Navigate the HTML layer after Phaser has stopped.
      router.navigate('home');
    });

    // Clean up all bus listeners when this scene is destroyed
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.busOffSpeed?.();   this.busOffSpeed   = null;
      this.busOffPause?.();   this.busOffPause   = null;
      this.busOffRestart?.(); this.busOffRestart = null;
      this.busOffQuit?.();    this.busOffQuit    = null;
    });
  }

  update(_time: number, delta: number): void {
    if (this.state !== 'fighting') return;

    const scaledDelta = delta * this.gameSpeed;

    // ── 1. Tick DoTs + modifier effects ─────────────────────────────────────
    const dot = this.engine.tickStatusEffects(scaledDelta, this.enemy);

    if (dot.poisonDamage > 0) {
      this.enemy.takeDamage(dot.poisonDamage);
      this.spawnFloater(this.enemy.x, this.enemy.y - 20, dot.poisonDamage, 'poison');
    }
    if (dot.burnDamage > 0) {
      this.enemy.takeDamage(dot.burnDamage);
      this.spawnFloater(this.enemy.x, this.enemy.y - 20, dot.burnDamage,
        dot.burnIsCrit ? 'crit' : 'burn');
    }
    if (dot.dotHeal > 0) {
      const gained = this.player.heal(dot.dotHeal);
      this.engine.trackHealing(gained);
      this.spawnFloater(this.player.x, this.player.y - 20, dot.dotHeal, 'heal');
    }
    // Regenerating modifier: enemy heals
    if (dot.enemyRegenHeal > 0 && !this.enemy.isDead()) {
      this.enemy.stats.hp = Math.min(this.enemy.stats.maxHp, this.enemy.stats.hp + dot.enemyRegenHeal);
    }

    if ((dot.poisonDamage > 0 || dot.burnDamage > 0) && this.enemy.isDead()) {
      this.handleEnemyKill();
      return;
    }

    // ── 2. Player attack ─────────────────────────────────────────────────────
    if (this.player.tickAttack(scaledDelta * this.engine.playerSpeedMultiplier)) {
      const result = this.engine.resolvePlayerAttack(this.enemy);
      this.applyAttackResult(result);

      if (this.enemy.isDead()) {
        const overkill = Math.max(0, result.damage - Math.max(0, this.enemy.stats.hp));
        this.engine.storeOverkill(overkill);
        this.handleEnemyKill();
        return;
      }
    }

    // ── 3. Enemy attack ──────────────────────────────────────────────────────
    if (!this.enemy.isDead() && this.enemy.tickAttack(scaledDelta)) {
      const defResult = this.engine.resolveEnemyAttack(this.enemy.stats.damage, this.enemy);
      this.applyDefenseResult(defResult);

      if (this.player.isDead()) {
        if (this.engine.checkPhoenix()) {
          this.player.stats.hp = 1;
          this.player.takeDamage(0);
        } else {
          this.transition('player_dead');
          return; // don't let refreshHpTexts re-enable the HUD this frame
        }
      }
    }

    this.refreshHpTexts();
    this.refreshHitCounter();
    this.statsPanel.update();
  }

  // ---------------------------------------------------------------------------
  // Combat result application
  // ---------------------------------------------------------------------------

  private applyAttackResult(result: AttackResult): void {
    this.enemy.takeDamage(result.damage);

    if (result.summonDamage  > 0) this.enemy.takeDamage(result.summonDamage);
    if (result.lightningDamage > 0) this.enemy.takeDamage(result.lightningDamage);
    if (result.areaDamage    > 0) this.enemy.takeDamage(result.areaDamage);

    // Heal from lifesteal
    if (result.healAmount > 0) {
      const gained = this.player.heal(result.healAmount);
      this.engine.trackHealing(gained);
    }

    // Alchemist's Flask: heal floaters were pushed into defResult floaters,
    // but for attack result we check the floaters array for 'heal' typed ones
    // applied via the alchemist flask are in defense context — no action here.

    // Transfuser relic: lifesteal also on area + summon damage
    if (this.engine.hasUpgrade('relic_transfuser')) {
      const ls = this.player.stats.lifesteal ?? 0;
      const bonus = Math.floor((result.areaDamage + result.summonDamage) * ls);
      if (bonus > 0) {
        const gained = this.player.heal(bonus);
        this.engine.trackHealing(gained);
        this.spawnFloater(this.player.x, this.player.y - 20, bonus, 'heal');
      }
    }

    // Overcharge: excess heal → shield
    if (result.excessHeal > 0 && this.engine.hasUpgrade('overcharge')) {
      const s = this.player.stats;
      const maxSh = s.maxShield ?? 0;
      if (maxSh > 0) {
        s.shield = Math.min(maxSh, (s.shield ?? 0) + result.excessHeal);
      }
    }

    if (result.poisonApplied > 0) {
      const s = this.player.stats;
      this.enemy.applyPoison(
        result.poisonApplied,
        s.poisonDamage ?? 2,
        1000 / (s.poisonTickRate ?? 2),
        s.poisonMaxStacks ?? 10,
      );
    }
    if (result.burnApplied) {
      const s = this.player.stats;
      this.enemy.applyBurn(
        s.burnDamage ?? 5,
        (s.burnDuration ?? 3) * 1000,
        500,
        s.burnCanCrit ?? false,
      );
    }

    // Thorned / Mirrored floor modifier: player takes recoil
    // Mirror reflects respect player armor; thorn damage is fixed
    const mirrorAfterArmor = result.mirrorDamage > 0
      ? Math.max(0, result.mirrorDamage - (this.player.stats.armor ?? 0))
      : 0;
    const recoil = result.thornDamage + mirrorAfterArmor;
    if (recoil > 0) {
      this.player.takeDamage(recoil);
      this.spawnFloater(this.player.x, this.player.y - 20, recoil, 'reflect');
      if (this.player.isDead()) {
        if (this.engine.checkPhoenix()) {
          this.player.stats.hp = 1;
          this.player.takeDamage(0);
        } else {
          this.transition('player_dead');
          return;
        }
      }
    }

    for (const f of result.floaters) {
      const ex = f.target === 'enemy' ? this.enemy.x : this.player.x;
      const ey = f.target === 'enemy' ? this.enemy.y : this.player.y;
      this.spawnFloater(ex, ey - 18, f.value, f.type);
    }

    this.refreshHpTexts();
  }

  private applyDefenseResult(defResult: DefenseResult): void {
    this.player.takeDamage(defResult.damageTaken);

    if (defResult.reflectDamage > 0) {
      this.enemy.takeDamage(defResult.reflectDamage);
    }

    // Vampiric enemy modifier: enemy heals on damage dealt
    if (defResult.enemyHeal > 0 && !this.enemy.isDead()) {
      this.enemy.stats.hp = Math.min(this.enemy.stats.maxHp, this.enemy.stats.hp + defResult.enemyHeal);
    }

    for (const f of defResult.floaters) {
      const ex = f.target === 'player' ? this.player.x : this.enemy.x;
      const ey = f.target === 'player' ? this.player.y : this.enemy.y;
      // Heal floaters from Alchemist's Flask
      if (f.type === 'heal' && f.target === 'player') {
        const gained = this.player.heal(f.value);
        this.engine.trackHealing(gained);
      }
      this.spawnFloater(ex, ey - 18, f.value, f.type);
    }

    this.refreshHpTexts();
  }

  // ---------------------------------------------------------------------------
  // Floor transitions
  // ---------------------------------------------------------------------------

  private handleEnemyKill(): void {
    // Guard: if player died from recoil/mirror on the same hit that killed the enemy,
    // don't advance the floor — that would let the merchant "resurrect" the player.
    if (this.player.isDead()) {
      if (!this.engine.checkPhoenix()) {
        this.transition('player_dead');
      } else {
        this.player.stats.hp = 1;
        this.player.takeDamage(0);
      }
      return;
    }

    this.killCount++;

    const isBoss = this.enemy.isBoss;
    if (isBoss) {
      this.bossKillCount++;
      this.engine.onBossKilled();
      // BUG #2 fix: clear boss label immediately — don't wait for advanceFloor
      this.currentEnemyName = 'ENEMY';
      this.syncRunState();
      // Boss kills always grant an upgrade pick (separate from level-up)
      this.pendingBossUpgrade = true;
      this.xpManager.bossXP(this.floorManager.currentFloor);
      // Bridge: boss killed event
      bus.emit({ type: 'boss:killed', payload: {
        floor:    this.floorManager.currentFloor,
        bossName: this.currentEnemyName,
      }});
    } else {
      // Normal kill: grant XP (level-up fires onLevelUp callback → pendingLevelUpUpgrade)
      this.xpManager.killXP(this.floorManager.currentFloor);
    }

    // Volatile modifier: enemy explodes on death — never drops player below 5% HP
    if (this.engine.volatile && this.enemy.stats.maxHp > 0) {
      const minHp    = Math.max(1, Math.ceil(this.player.stats.maxHp * 0.05));
      const explosion = Math.floor(this.enemy.stats.maxHp * 0.25);
      const capped    = Math.min(explosion, Math.max(0, this.player.stats.hp - minHp));
      this.player.takeDamage(capped);
      this.spawnFloater(this.player.x, this.player.y - 30, capped, 'burn');
    }

    // Cursed floor modifier: bonus gold on kill
    const mod = this.floorManager.currentModifier;
    if (mod?.bonusGold) {
      this.engine.addGold(mod.bonusGold);
      this.spawnFloater(this.enemy.x, this.enemy.y - 30, mod.bonusGold, 'gold');
    }

    // Bomb Collar relic: store explosion damage for carryover
    if (this.engine.hasUpgrade('relic_bomb_collar')) {
      const blast = Math.floor(this.enemy.stats.maxHp * 0.50);
      const data = this.engine.getRelicData('bomb_collar');
      data['pendingBlast'] = blast;
    }

    // Golden Idol relic: gold per relic owned
    if (this.engine.hasUpgrade('relic_golden_idol')) {
      const relicBonus = this.ownedRelics.size * 3;
      this.engine.addGold(relicBonus);
    }
    // Sync gold to HUD immediately so it reflects kill-gold before floor-clear overlay
    runState.update({ gold: this.engine.gold });

    const killResult = this.engine.onEnemyKilled(this.enemy);
    if (killResult.pendingHeal > 0) {
      const gained = this.player.heal(killResult.pendingHeal);
      if (gained > 0) {
        this.engine.trackHealing(gained);
        this.spawnFloater(this.player.x, this.player.y - 20, gained, 'heal');
      }
    }
    this.transition('floor_clear');
  }

  private transition(next: CombatState): void {
    this.state = next;
    this.refreshHpTexts();
    if (next === 'floor_clear') this.onFloorClear();
    else                        this.onPlayerDead();
  }

  private onFloorClear(): void {
    const floor     = this.floorManager.currentFloor;
    const { rules } = getRunConfig();

    // Bridge: floor cleared event
    bus.emit({ type: 'floor:cleared', payload: {
      floor,
      isBoss: this.enemy.isBoss,
    }});

    // Classic Mode (and any mode with a floorCap): trigger win on completing the cap floor.
    if (rules.floorCap !== null && floor >= rules.floorCap) {
      this.onRunWon();
      return;
    }

    // Boss Rush keeps its own cadence (upgrade + relic every 3 bosses).
    // Standard mode: upgrades come from LEVEL-UPS and BOSS KILLS only.
    // Relic floors remain floor-based (FloorManager decides).
    const isBossRush      = rules.bossesOnly;
    const isUpgradeFloor  = isBossRush
      ? floor % 3 === 0
      : (this.pendingBossUpgrade || this.pendingLevelUpUpgrade);
    const isRelicFloor    = isBossRush
      ? floor % 3 === 0
      : this.floorManager.isRelicFloor() && !isUpgradeFloor;

    // Consume flags regardless of which branch fires
    const doUpgrade = isUpgradeFloor;
    this.pendingBossUpgrade    = false;
    this.pendingLevelUpUpgrade = false;

    // 500 ms pause so kill floaters settle before the overlay appears,
    // then 900 ms on the overlay before the upgrade / relic / next-floor prompt.
    this.time.delayedCall(500, () => {
      // Guard: if the scene was torn down or the run ended mid-delay, abort.
      if (this.state !== 'floor_clear') return;
      this.showFloorClearOverlay(floor);
      this.time.delayedCall(900, () => {
        // Guard: same check for the inner callback.
        if (this.state !== 'floor_clear') return;
        if (doUpgrade)         this.launchUpgradeScreen();
        else if (isRelicFloor) this.launchRelicScreen();
        else                   this.advanceFloor();
      });
    });
  }

  private launchUpgradeScreen(
    afterChoiceCallback?: (upgraded: boolean) => void,
    forcedContextLabel?: string,
  ): void {
    const classWeights = this.currentClass?.categoryWeights;
    const isBossReward = this.enemy?.isBoss ?? false;
    const level        = this.xpManager.currentLevel;
    const contextLabel = forcedContextLabel
      ?? (isBossReward
        ? '⚔  Boss Reward'
        : level > 0
          ? `★  Level ${level} — Choose an Upgrade`
          : `Floor ${this.floorManager.currentFloor} cleared`);

    // On the first level-up guarantee at least one card from the class's primary category
    const primaryCategory: string | undefined = classWeights
      ? (Object.entries(classWeights).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0])
      : undefined;
    const isFirstLevelUp = !isBossReward && level === 1;
    const guaranteeCategory = isFirstLevelUp ? primaryCategory : undefined;

    const upgradePicks = pickRunUpgrades(3, this.floorManager.currentFloor, this.owned, classWeights, guaranteeCategory);

    bus.emit({ type: 'upgrade:available', payload: {
      upgrades:     upgradePicks,
      contextLabel,
      floor:        this.floorManager.currentFloor,
    }});

    // Cross-cleanup: whichever fires first removes the other
    let offSelected: (() => void) | undefined;
    let offSkipped:  (() => void) | undefined;

    const afterChoice = (upgraded: boolean) => {
      offSelected?.();
      offSkipped?.();
      if (upgraded && this.engine.hasUpgrade('relic_momentum_stone')) {
        this.player.stats.maxHp += 5;
        this.player.stats.hp    = Math.min(this.player.stats.hp + 5, this.player.stats.maxHp);
      }
      this.scene.resume();
      if (afterChoiceCallback) {
        afterChoiceCallback(upgraded);
        return;
      }
      const { rules } = getRunConfig();
      if (rules.bossesOnly) {
        this.launchRelicScreen();
      } else {
        this.advanceFloor();
      }
    };

    offSelected = bus.on('upgrade:selected', (e) => {
      const upg = upgradePicks.find(u => u.id === e.payload.upgradeId);
      if (upg) {
        upg.apply(this.player.stats, this.engine);
        this.owned.set(upg.id, (this.owned.get(upg.id) ?? 0) + 1);
        this.engine.registerUpgrade(upg.id);
      }
      afterChoice(true);
    });

    offSkipped = bus.on('upgrade:skipped', () => {
      afterChoice(false);
    });

    this.scene.pause();
  }

  private launchPreRunUpgradeSequence(): void {
    const nextPick = (): void => {
      if (this.preRunUpgradePicksRemaining <= 0) {
        this.engine.onFloorStart(this.floorManager.currentModifier);
        this.state = 'fighting';
        this.syncRunState();
        return;
      }

      const pickIndex = 6 - this.preRunUpgradePicksRemaining;
      const contextLabel = `PRE-RUN UPGRADE ${pickIndex} of 5`;

      this.launchUpgradeScreen(() => {
        this.preRunUpgradePicksRemaining -= 1;
        nextPick();
      }, contextLabel);
    };

    nextPick();
  }

  private launchRelicScreen(): void {
    const relics = pickRelics(3, this.floorManager.currentFloor, this.ownedRelics);
    if (relics.length === 0) {
      this.advanceFloor();
      return;
    }

    bus.emit({ type: 'relic:available', payload: {
      relics,
      floor: this.floorManager.currentFloor,
    }});

    let offSelected: (() => void) | undefined;
    let offSkipped:  (() => void) | undefined;

    const afterRelic = (relicId: string | null) => {
      offSelected?.();
      offSkipped?.();
      if (relicId) {
        const relic = relics.find(r => r.id === relicId);
        if (relic) {
          relic.onAcquire(this.player.stats, this.engine);
          this.engine.registerRelic(relic.id);
          this.engine.registerUpgrade(relic.id);
          this.ownedRelics.add(relic.id);
        }
      }
      this.updateRelicHud();
      this.scene.resume();
      this.advanceFloor();
    };

    offSelected = bus.on('relic:selected', (e) => afterRelic(e.payload.relicId));
    offSkipped  = bus.on('relic:skipped',  ()  => afterRelic(null));

    this.scene.pause();
  }

  private advanceFloor(): void {
    this.floorManager.advance();
    // Boss Rush: always spawn a boss regardless of floor number
    const { rules } = getRunConfig();
    const config = rules.bossesOnly
      ? this.floorManager.buildBossConfig()
      : this.floorManager.buildEnemyConfig();
    const mod    = this.floorManager.currentModifier;

    if (rules.bossesOnly) {
      config.sprite = { sheet: SpriteLoader.getRandomBossSheetCellKey() };
    }

    this.enemy.destroy();
    this.enemy = new Enemy(this, ENEMY_X, COMBAT_Y, config);

    this.updateModifierLabel();
    this.hideOverlay();

    // ── Special floors: skip combat ────────────────────────────────────────
    if (mod?.skipCombat) {
      this.state = 'special_floor';
      if (mod.specialType === 'merchant') {
        this.launchMerchantScene();
      } else {
        // Treasure floor
        this.showTreasureOverlay(mod);
      }
      return;
    }

    // Apply kill carryover (Plague Carrier, Backdraft, Bomb Collar blast)
    this.engine.applyKillCarryover(this.enemy);
    const bombData = this.engine.getRelicData('bomb_collar');
    if (bombData['pendingBlast']) {
      const blast = bombData['pendingBlast'] as number;
      this.enemy.takeDamage(blast);
      this.spawnFloater(this.enemy.x, this.enemy.y - 30, blast, 'area');
      bombData['pendingBlast'] = 0;
    }

    this.engine.onFloorStart(mod);

    // ── Nightmare modifier: player starts at 50% HP ────────────────────────
    if (this.engine.nightmareActive) {
      this.player.stats.hp = Math.max(1, Math.floor(this.player.stats.maxHp * 0.5));
      this.player.takeDamage(0); // refresh health bar
    }

    // ── Sanctified modifier: player heals 30% max HP ──────────────────────
    if (this.engine.sanctifiedActive) {
      const healAmt = Math.floor(this.player.stats.maxHp * 0.3);
      const gained  = this.player.heal(healAmt);
      if (gained > 0) this.spawnFloater(this.player.x, this.player.y - 30, gained, 'heal');
    }

    // ── Constricting modifier: lose 25% of current HP on entry ────────────
    if (this.engine.activeModifier === 'constricting') {
      const penalty = Math.max(1, Math.floor(this.player.stats.hp * 0.25));
      this.player.takeDamage(penalty);
      this.spawnFloater(this.player.x, this.player.y - 20, penalty, 'damage');
      if (this.player.isDead() && !this.engine.checkPhoenix()) {
        this.transition('player_dead');
        return;
      } else if (this.player.isDead()) {
        this.player.stats.hp = 1;
      }
    }

    if (config.isBoss) this.announceBoss(config.bossLabel);
    else               this.announceFloor();

    // Bridge: track enemy name (Enemy class doesn't expose it)
    this.currentEnemyName = config.isBoss ? (config.bossLabel ?? 'BOSS') : 'ENEMY';

    this.state = 'fighting';

    // Bridge: floor + enemy state changed
    this.syncRunState();
  }

  // ── Treasure floor ───────────────────────────────────────────────────────

  private showTreasureOverlay(mod: import('../floors/FloorModifier').FloorModifier): void {
    this.overlay.removeAll(true);

    const gold = mod.bonusRewards?.gold ?? 40;
    this.engine.addGold(gold);
    this.syncRunState(); // immediately reflect new gold in HUD

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(-190, -120, 380, 240, 10);
    bg.lineStyle(2, 0xffd700);
    bg.strokeRoundedRect(-190, -120, 380, 240, 10);

    const title = this.add.text(0, -86, '✦  TREASURE ROOM  ✦', {
      fontSize: '22px', color: '#ffd700',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const goldText = this.add.text(0, -44, `+${gold} GOLD`, {
      fontSize: '18px', color: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const hintText = this.add.text(0, -10, 'Bonus upgrade awaits…', {
      fontSize: '12px', color: '#888899', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Claim button
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a3a1a);
    btnBg.fillRoundedRect(-80, 30, 160, 44, 8);
    btnBg.lineStyle(2, 0x2ecc71);
    btnBg.strokeRoundedRect(-80, 30, 160, 44, 8);

    const btnLabel = this.add.text(0, 52, 'CLAIM REWARD', {
      fontSize: '13px', color: '#2ecc71',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const zone = this.add.zone(0, 52, 160, 44).setInteractive({ cursor: 'pointer' });
    zone.on('pointerdown', () => {
      this.overlay.removeAll(true);
      this.overlay.setVisible(false);
      this.spawnFloater(this.enemy.x, this.enemy.y - 30, gold, 'gold');
      this.launchUpgradeScreen();
    });

    this.overlay.add([bg, title, goldText, hintText, btnBg, btnLabel, zone]);
    this.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 300 });
  }

  // ── Merchant floor ───────────────────────────────────────────────────────

  private launchMerchantScene(): void {
    const floor          = this.floorManager.currentFloor;
    const merchantOffers = pickRunUpgrades(3, floor, this.owned);

    bus.emit({ type: 'merchant:available', payload: {
      upgradeCards: merchantOffers,
      consumables: [
        { id: 'war_ration',       name: 'War Ration',       cost: 20, effect: 'Restore 25% max HP' },
        { id: 'sharpening_stone', name: 'Sharpening Stone', cost: 25, effect: '+10% damage this floor' },
        { id: 'guard_totem',      name: 'Guard Totem',       cost: 25, effect: '+20 armor this floor' },
      ],
      rerollCost: 15,
      floor,
    }});

    // Handle purchases while scene is paused
    const offPurchase = bus.on('merchant:purchase', (e) => {
      const { itemId, type, cost } = e.payload;
      this.engine.addGold(-cost);
      runState.update({ gold: this.engine.gold });

      if (type === 'upgrade') {
        const upg = merchantOffers.find(u => u.id === itemId)
          ?? ALL_UPGRADES.find(u => u.id === itemId);
        if (upg) {
          upg.apply(this.player.stats, this.engine);
          this.owned.set(upg.id, (this.owned.get(upg.id) ?? 0) + 1);
          this.engine.registerUpgrade(upg.id);
        }
      } else if (type === 'consumable') {
        this.applyMerchantConsumable(itemId);
      }
      // 'reroll' only deducts gold (handled above); new offers generated by modal
    });

    const offClosed = bus.on('merchant:closed', () => {
      offPurchase();
      offClosed();
      this.scene.resume();
      this.advanceFloor();
    });

    this.scene.pause();
  }

  /** Apply a consumable purchased from the merchant. */
  private applyMerchantConsumable(id: string): void {
    const s = this.player.stats;
    switch (id) {
      case 'war_ration':
        s.hp = Math.min(s.maxHp, s.hp + Math.floor(s.maxHp * 0.25));
        break;
      case 'sharpening_stone':
        s.damage = Math.ceil(s.damage * 1.10);
        break;
      case 'guard_totem':
        s.armor += 20;
        break;
    }
    this.syncRunState();
  }

  /**
   * Called when the player achieves a deliberate win condition (e.g. Classic
   * Mode floor cap). Sets the _runWon flag then delegates to onPlayerDead()
   * so the single run-recording path handles everything.
   */
  private onRunWon(): void {
    this._runWon = true;
    this.onPlayerDead();
  }

  private onPlayerDead(): void {
    // Clear any residual boss label so it doesn't linger on the game-over overlay
    this.currentEnemyName = 'ENEMY';
    const floor       = this.floorManager.currentFloor;
    const goldEarned  = MetaService.earnedForFloor(floor);
    const durationMs  = Date.now() - this.runStartTime;

    // ── Legacy meta progression (currency, permanent upgrades) ────────────
    metaService.recordRunEnd({ floor, kills: this.killCount, bossesDefeated: this.bossKillCount, goldEarned });

    // ── Platform run record ───────────────────────────────────────────────
    const profile  = ServiceLocator.profile.getProfile();
    const cfg = getRunConfig();
    // Mode-aware score formula
    const score = cfg.modeId === 'boss_rush'
      ? this.bossKillCount * 100 + Math.floor(this.engine.totalDamageDealt / 10)
      : floor * 10 + this.killCount;

    const run: RunResultDTO = {
      id:              this.generateRunId(),
      player_id:       profile?.id ?? 'local',
      mode_id:         cfg.modeId,
      class_id:        this.currentClass?.id ?? 'unknown',
      floor_reached:   floor,
      score,
      build_archetype: this.detectBuildName(),
      relics_owned:    [...this.ownedRelics],
      keystone_owned:  this.detectKeystone(),
      kills:           this.killCount,
      bosses_killed:   this.bossKillCount,
      damage_dealt:    this.engine.totalDamageDealt,
      healing_done:    this.engine.totalHealingDone,
      highest_hit:     this.engine.highestDamageHit,
      duration_ms:     durationMs,
      date:            new Date().toISOString(),
      won:             this._runWon,
    };

    const { newTitles } = ServiceLocator.profile.recordRunEnd(run);
    ServiceLocator.history.addRun(run);

    // Bridge: run ended — HTML GameOverModal listens here
    bus.emit({ type: 'run:ended', payload: { result: run, newTitles, goldEarned } });
    // Bridge: mark run as inactive and sync final state
    runState.update({ isRunActive: false });
  }

  private generateRunId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  private detectKeystone(): string | null {
    for (const [id] of this.owned) {
      const upg = ALL_UPGRADES.find(u => u.id === id && u.tier === 'keystone');
      if (upg) return upg.name;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Scene construction
  // ---------------------------------------------------------------------------

  // ── Mode rule application ────────────────────────────────────────────────────

  private applyModeRules(): void {
    const { modeId, rules } = getRunConfig();

    // One HP: override player stats before HUD reads them
    if (rules.maxHpOverride !== null) {
      this.player.stats.maxHp = rules.maxHpOverride;
      this.player.stats.hp    = rules.maxHpOverride;
    }
    // Disable lifesteal (One HP mode — healing is a no-op at max=1 anyway,
    // but disabling explicitly prevents shield generation from Overcharge)
    if (rules.disableLifesteal) {
      this.player.stats.lifesteal = 0;
    }
    // Starting gold (Bounty_Hunter class already gives 30 via class apply; this
    // is for future modes that grant gold)
    if (rules.startingGold > 0) {
      this.engine.addGold(rules.startingGold);
    }
    // Chaos mode: grant random relics before floor 1
    if (rules.forceRandomRelics > 0) {
      this.grantRandomRelics(rules.forceRandomRelics);
    }

    // Store mode ID so run results carry the right leaderboard target
    void modeId; // used via getRunConfig() in onPlayerDead
  }

  /** Grant N random relics from the pool (used for Chaos mode). */
  private grantRandomRelics(count: number): void {
    const available = ALL_RELICS.filter(r => !this.ownedRelics.has(r.id));
    const picks     = [...available].sort(() => Math.random() - 0.5).slice(0, count);
    picks.forEach(relic => {
      relic.onAcquire(this.player.stats, this.engine);
      this.engine.registerRelic(relic.id);
      this.engine.registerUpgrade(relic.id);
      this.ownedRelics.add(relic.id);
    });
  }

  private createEntities(): void {
    const classFrame = this.currentClass ? SpriteLoader.getClassSpriteFrame(this.currentClass.id) : undefined;
    this.player = new Player(this, PLAYER_X, COMBAT_Y, classFrame ?? undefined);

    // Nightmare: skip permanent upgrade bonuses so meta progression has no effect
    if (!getRunConfig().rules.noMetaBonuses) {
      metaService.applyBonus(this.player.stats);
    }

    this.engine = new RulesEngine(this.player.stats);

    this.enemy = new Enemy(this, ENEMY_X, COMBAT_Y, this.floorManager.buildEnemyConfig());
  }

  private drawBackground(): void {
    const g = this.add.graphics();

    // Base background fill
    g.fillStyle(0x0d0d1f);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Top bar surface
    g.fillStyle(0x0c0c1e);
    g.fillRect(0, 0, GAME_WIDTH, HEADER_H);
    g.lineStyle(1, 0x1e1e36);
    g.lineBetween(0, HEADER_H, GAME_WIDTH, HEADER_H);

    // Bottom info bar surface
    g.fillStyle(0x0b0b1c);
    g.fillRect(0, BOT_BAR_Y, GAME_WIDTH, GAME_HEIGHT - BOT_BAR_Y);
    g.lineStyle(1, 0x1a1a30);
    g.lineBetween(0, BOT_BAR_Y, GAME_WIDTH, BOT_BAR_Y);

    // Subtle arena ground line
    g.lineStyle(1, 0x1e1e36);
    g.lineBetween(16, COMBAT_Y + 44, GAME_WIDTH - 16, COMBAT_Y + 44);

    // Player / enemy zone divider (very subtle)
    g.lineStyle(1, 0x111120);
    g.lineBetween(GAME_WIDTH / 2, HP_PANEL_Y + HP_PANEL_H + 4, GAME_WIDTH / 2, BOT_BAR_Y - 4);
  }

  // BUG #3: speed controls affect ONLY simulation time scaling (gameSpeed).
  // They must NEVER touch s.attackSpeed or any engine stat.
  // playerSpeedMultiplier is a floor-modifier stat effect — separate concern.
  private setGameSpeed(speed: 1 | 1.5 | 2): void {
    this.gameSpeed = speed;
    // Bridge: speed changed — HTML HUD speed buttons update via runState
    runState.update({ gameSpeed: speed });
  }

  private refreshHpTexts(): void {
    // Bridge: push live HP + enemy status so HTML HUD stays in sync
    this.syncRunState();
    // Update Phaser-side debuff icons above the enemy sprite
    this.enemy?.updateDebuffs();
  }

  private updateModifierLabel(): void {
    this.syncRunState();
  }

  private updateRelicHud(): void {
    // Bridge: relic count changed
    this.syncRunState();
  }

  // ---------------------------------------------------------------------------
  // Overlays
  // ---------------------------------------------------------------------------

  private createOverlay(): void {
    this.overlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.overlay.setVisible(false);
  }

  private showFloorClearOverlay(floor: number): void {
    this.overlay.removeAll(true);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.82);
    bg.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);

    const cleared = this.add.text(0, -52, 'FLOOR CLEARED', {
      fontSize: '40px', color: '#2ecc71',
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#0a1a0a', strokeThickness: 4,
    }).setOrigin(0.5);

    const rule = this.add.graphics();
    rule.lineStyle(1, 0x1a6a3a);
    rule.lineBetween(-160, -80, 160, -80);

    const sub = this.add.text(0, 18, `Floor ${floor}`, {
      fontSize: '22px', color: '#5a5a88', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.overlay.add([bg, rule, cleared, sub]);
    this.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 300, ease: 'Power2' });
  }

  /** Detect the player's build archetype from owned upgrades. */
  private detectBuildName(): string {
    // Simpler: count by tag occurrence across owned upgrade IDs
    const poisonIds  = ['venom_tips','toxic_coating','plague_carrier','reactive_venom','poison_lord'];
    const critIds    = ['eagle_eye','precision','predators_mark','speed_to_crit','eternal_crit'];
    const lightIds   = ['static_charge','spark','overload','ball_lightning','thunder_engine'];
    const burnIds    = ['kindling','igniter','backdraft','conflagration','spontaneous_combustion','phoenix_protocol'];
    const summonIds  = ['familiar','pack_leader','coordinated_strike','lich_form'];
    const defIds     = ['iron_skin','reactive_plating','living_wall','diamond_body'];

    const count = (ids: string[]) => ids.filter(id => (this.owned.get(id) ?? 0) > 0).length;
    const p = count(poisonIds), c = count(critIds), l = count(lightIds),
          b = count(burnIds),   s = count(summonIds), d = count(defIds);

    if (p >= 3 && c >= 2) return 'Toxic Criticals';
    if (p >= 3)            return 'Endless Plague';
    if (c >= 3)            return 'Critical Strike';
    if (l >= 3)            return 'Lightning Storm';
    if (b >= 3)            return 'Pyromaniac';
    if (s >= 2)            return 'Battle Commander';
    if (d >= 3)            return 'Iron Fortress';
    return 'Mixed Build';
  }

  private hideOverlay(): void {
    this.tweens.killTweensOf(this.overlay);
    this.overlay.setVisible(false);
    this.overlay.setAlpha(1);
  }

  // ---------------------------------------------------------------------------
  // Bridge helpers
  // ---------------------------------------------------------------------------

  /**
   * Push a full snapshot of the current run state to RunStateStore.
   * Called after any state change that the HTML HUD needs to reflect.
   * Safe to call frequently — RunStateStore only notifies subscribers
   * when a selected value actually changes.
   */
  private syncRunState(): void {
    const mod = this.floorManager.currentModifier;
    const ps  = this.enemy?.statusEffects.poison;
    const bs  = this.enemy?.statusEffects.burn;
    const cfg = getRunConfig();

    runState.update({
      isRunActive: this.state !== 'player_dead',
      floor:       this.floorManager.currentFloor,
      isBoss:      this.enemy?.isBoss ?? false,

      modifierName: mod && !mod.skipCombat ? mod.name        : '',
      modifierDesc: mod && !mod.skipCombat ? mod.description : '',

      playerHp:       this.player.stats.hp,
      playerMaxHp:    this.player.stats.maxHp,
      playerLevel:    this.xpManager.currentLevel,
      playerXp:       Math.round(this.xpManager.xpProgress * 100),
      playerXpNeeded: 100,
      className:      this.currentClass?.name ?? '',
      classId:        this.currentClass?.id   ?? '',

      enemyHp:           this.enemy?.stats.hp      ?? 0,
      enemyMaxHp:        this.enemy?.stats.maxHp   ?? 0,
      enemyName:         this.currentEnemyName,
      enemyPoisonStacks: ps?.stacks ?? 0,
      enemyBurnStacks:   (bs && bs.durationMs > 0) ? 1 : 0,

      gold:           this.engine.gold,
      summonCount:    this.player.stats.summonCount ?? 0,
      summonUpgrades: this.computeSummonUpgrades(),

      keystoneName: this.detectKeystone() ?? '',
      keystoneId:   this.detectKeystoneId(),
      relicCount:   this.ownedRelics.size,
      buildArchetype:    this.detectBuildName(),
      categoryBreakdown: this.computeCategoryBreakdown(),

      gameSpeed: this.gameSpeed,
      modeId:    cfg.modeId,
    });
  }

  // ---------------------------------------------------------------------------
  // Hit counter label helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns a display string for the proc-every-N-hits counter, or null when
   * no such talent is active (in which case the label should be hidden).
   *
   * Priority order:
   *   1. ball_lightning / spark  — charge counter towards next lightning strike
   *   2. vital_strike            — hit counter mod 3
   *   3. areaEveryNHits          — hit counter mod N (Shockwave)
   *   4. perpetual_machine       — hit streak mod 10
   */
  private computeHitCounterDisplay(): string | null {
    const s = this.player.stats;

    // Lightning charge counter (spark / ball_lightning)
    if (this.engine.hasUpgrade('spark') || this.engine.hasUpgrade('ball_lightning')) {
      const threshold = this.engine.hasUpgrade('archmage_class') ? 2 : 3;
      const charge    = this.engine.chargeCounter;
      return `⚡ ${charge}/${threshold}`;
    }

    // Vital Strike: every 3rd hit heals
    if (this.engine.hasUpgrade('vital_strike')) {
      const progress = this.engine.hitCount % 3;
      return `❤ ${progress}/3`;
    }

    // Shockwave (areaEveryNHits)
    const everyN = s.areaEveryNHits ?? 0;
    if (everyN > 0) {
      const progress = this.engine.hitCount % everyN;
      return `💥 ${progress}/${everyN}`;
    }

    // Perpetual Machine: every 10 consecutive unhit attacks
    if (this.engine.hasUpgrade('perpetual_machine')) {
      const streak = this.engine.hitStreak % 10;
      return `🔥 ${streak}/10`;
    }

    return null;
  }

  /** Refresh the hit counter label above the player sprite. */
  private refreshHitCounter(): void {
    if (!this.hitCounterLabel) return;
    const text = this.computeHitCounterDisplay();
    if (text !== null) {
      this.hitCounterLabel.setText(text).setVisible(true);
    } else {
      this.hitCounterLabel.setVisible(false);
    }
  }

  /** Returns the ID of the keystone upgrade the player currently holds. */
  private detectKeystoneId(): string {
    for (const [id] of this.owned) {
      const upg = ALL_UPGRADES.find(u => u.id === id && u.tier === 'keystone');
      if (upg) return upg.id;
    }
    return '';
  }

  /** Upgrade IDs that belong to the summon kit — drives the mini-entity panel. */
  private static readonly SUMMON_UPGRADE_IDS = new Set([
    'familiar', 'pack_leader', 'coordinated_strike', 'lich_form',
  ]);

  /**
   * Returns owned stacks for summon-category upgrades only.
   * Pushed to RunStateStore so HudRight can render the mini-entity panel.
   */
  private computeSummonUpgrades(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, stacks] of this.owned) {
      if (GameScene.SUMMON_UPGRADE_IDS.has(id)) {
        result[id] = stacks;
      }
    }
    return result;
  }

  /**
   * Counts total stacks per upgrade category.
   * Used by the Build Fingerprint in the right HUD rail and Build Inspector.
   */
  private computeCategoryBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const [id, stacks] of this.owned) {
      const upg = ALL_UPGRADES.find(u => u.id === id);
      if (upg) {
        breakdown[upg.category] = (breakdown[upg.category] ?? 0) + stacks;
      }
    }
    return breakdown;
  }

  // ---------------------------------------------------------------------------
  // Announcements
  // ---------------------------------------------------------------------------

  private announceFloor(): void {
    const mod = this.floorManager.currentModifier;
    const label = mod
      ? `FLOOR ${this.floorManager.currentFloor}  ${mod.name}`
      : `FLOOR ${this.floorManager.currentFloor}`;
    const color = mod ? intToHex(mod.color) : '#ffffff';

    const text = this.add
      .text(GAME_WIDTH / 2, COMBAT_Y - 90, label, {
        fontSize: '26px', color, fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: text, alpha: 1, duration: 250, yoyo: true, hold: 600, onComplete: () => text.destroy() });
  }

  private announceBoss(bossLabel: string): void {
    const card = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);
    const bg   = this.add.graphics();
    bg.fillStyle(0x000000, 0.72);
    bg.fillRoundedRect(-150, -44, 300, 88, 8);
    bg.lineStyle(1, 0x9b59b6);
    bg.strokeRoundedRect(-150, -44, 300, 88, 8);

    const warning = this.add.text(0, -18, '⚠  BOSS ENCOUNTER', { fontSize: '12px', color: '#e74c3c', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5);
    const name    = this.add.text(0,  14, bossLabel,            { fontSize: '20px', color: '#9b59b6', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5);

    card.add([bg, warning, name]);
    card.setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 300, yoyo: true, hold: 1800, onComplete: () => card.destroy() });
  }

  // ---------------------------------------------------------------------------
  // Floating damage numbers
  // ---------------------------------------------------------------------------

  private spawnFloater(x: number, y: number, value: number, type: FloaterType): void {
    if (value <= 0) return;

    const cfg: Record<FloaterType, { color: string; size: string }> = {
      damage:    { color: '#ffffff', size: '14px' },
      crit:      { color: '#FFD700', size: '22px' },   // crits are visually distinct: larger + gold
      heal:      { color: '#2ecc71', size: '14px' },
      poison:    { color: '#9b59b6', size: '12px' },
      burn:      { color: '#e67e22', size: '12px' },
      lightning: { color: '#3498db', size: '14px' },
      area:      { color: '#bdc3c7', size: '11px' },
      reflect:   { color: '#95a5a6', size: '11px' },
      summon:    { color: '#4fc3f7', size: '12px' },
      gold:      { color: '#ffd700', size: '13px' },
      shield:    { color: '#5dade2', size: '13px' },
    };

    const { color, size } = cfg[type];
    const prefix = (type === 'heal' || type === 'gold' || type === 'shield') ? '+' : '';

    // Scale font up on mobile (compensates for CSS scale-down of the canvas)
    const scaledSize = `${Math.round(parseInt(size, 10) * this.floaterScale)}px`;

    const label = this.add
      .text(
        x + Phaser.Math.Between(-12, 12),
        y,
        `${prefix}${value}`,
        {
          fontSize: scaledSize,
          color,
          fontFamily: 'monospace',
          fontStyle:  type === 'crit' ? 'bold' : 'normal',
          stroke: '#000000',
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5);

    this.tweens.add({
      targets: label, y: label.y - 50, alpha: 0,
      duration: 900, ease: 'Power1',
      onComplete: () => label.destroy(),
    });
  }
}

function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

