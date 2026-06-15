/**
 * GameOverModal.ts — HTML replacement for showGameOverOverlay().
 *
 * Self-managing: instantiated once from main.ts.
 * Opens on bus 'run:ended'.
 *
 * Buttons:
 *   Play Again   → startRun({ same modeId + classId })
 *   Return to Hub → router.navigate('home')
 *
 * Mounts in #modal-root.
 */
import { bus } from '../bridge/GameEventBus';
import { router } from '../router/Router';
import { startRun } from '../bridge/startRun';
import { ALL_RELICS } from '../data/AllRelics';
import { metaService } from '../meta/MetaService';
export class GameOverModal {
    constructor() {
        this.active = false;
        this.root = document.getElementById('modal-root');
        bus.on('run:ended', (e) => {
            if (this.active)
                return;
            this.open(e.payload.result, e.payload.newTitles, e.payload.goldEarned);
        });
    }
    // ── Open / close ────────────────────────────────────────────────────────────
    open(run, newTitles, goldEarned) {
        this.active = true;
        // R key = fast restart with same class/mode
        const onKey = (e) => {
            if (e.key === 'r' || e.key === 'R') {
                document.removeEventListener('keydown', onKey);
                this.close();
                startRun({ modeId: run.mode_id, classId: run.class_id });
            }
        };
        document.addEventListener('keydown', onKey);
        const dim = document.createElement('div');
        dim.className = 'modal-dim';
        const panel = document.createElement('div');
        panel.className = 'go-panel';
        panel.append(this.buildTitle(run), this.buildPrimaryStats(run), this.buildCombatStats(run), this.buildRelics(run), this.buildEarned(goldEarned), ...newTitles.length > 0 ? [this.buildTitleUnlock(newTitles[0])] : [], this.buildTip(run), this.buildButtons(run));
        dim.appendChild(panel);
        this.root.appendChild(dim);
        requestAnimationFrame(() => dim.classList.add('is-visible'));
    }
    close() {
        this.active = false;
        const dim = this.root.querySelector('.modal-dim');
        if (dim) {
            dim.classList.remove('is-visible');
            dim.addEventListener('transitionend', () => dim.remove(), { once: true });
        }
    }
    // ── Sections ────────────────────────────────────────────────────────────────
    buildTitle(run) {
        const wrap = document.createElement('div');
        wrap.className = 'go-title-wrap';
        const title = document.createElement('div');
        title.className = 'go-title';
        title.textContent = run.won ? 'VICTORY' : 'GAME OVER';
        if (run.won)
            title.classList.add('is-victory');
        const identity = document.createElement('div');
        identity.className = 'go-identity';
        identity.textContent = `${run.class_id.toUpperCase()}  ·  ${run.build_archetype}`;
        wrap.append(title, identity);
        return wrap;
    }
    buildPrimaryStats(run) {
        const wrap = document.createElement('div');
        wrap.className = 'go-primary';
        const isBossRush = run.mode_id === 'boss_rush';
        const primaryLabel = isBossRush ? 'BOSSES CLEARED' : 'FLOOR';
        const primaryValue = isBossRush ? `${run.bosses_killed ?? 0}` : `${run.floor_reached}`;
        const bestValue = `${metaService.highestFloor}`;
        const current = this.statBlock(primaryLabel, primaryValue, false);
        const best = this.statBlock('BEST', bestValue, true);
        wrap.append(current, best);
        return wrap;
    }
    buildCombatStats(run) {
        const grid = document.createElement('div');
        grid.className = 'go-stat-grid';
        const stats = [
            ['KILLS', `${run.kills}`],
            ['BOSSES', `${run.bosses_killed ?? 0}`],
            ['TOP HIT', `${run.highest_hit}`],
            ['HEALED', `${run.healing_done}`],
            ['DAMAGE', `${run.damage_dealt}`],
            ['TIME', formatDuration(run.duration_ms)],
        ];
        stats.forEach(([label, value]) => {
            const cell = document.createElement('div');
            cell.className = 'go-stat-cell';
            const valEl = document.createElement('div');
            valEl.className = 'go-stat-val';
            valEl.textContent = value;
            const lblEl = document.createElement('div');
            lblEl.className = 'go-stat-lbl';
            lblEl.textContent = label;
            cell.append(valEl, lblEl);
            grid.appendChild(cell);
        });
        return grid;
    }
    buildRelics(run) {
        const wrap = document.createElement('div');
        wrap.className = 'go-relics';
        if (!run.relics_owned || run.relics_owned.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'go-relics-empty';
            empty.textContent = 'No relics found';
            wrap.appendChild(empty);
            return wrap;
        }
        run.relics_owned.forEach(id => {
            const def = ALL_RELICS.find(r => r.id === id);
            const chip = document.createElement('span');
            chip.className = 'go-relic-chip';
            chip.textContent = `◈ ${def ? def.name : id}`;
            wrap.appendChild(chip);
        });
        return wrap;
    }
    buildEarned(goldEarned) {
        const wrap = document.createElement('div');
        wrap.className = 'go-earned';
        const label = document.createElement('span');
        label.className = 'go-earned-label';
        label.textContent = 'EARNED';
        const val = document.createElement('span');
        val.className = 'go-earned-val';
        val.textContent = `+${goldEarned} ★`;
        wrap.append(label, val);
        return wrap;
    }
    buildTitleUnlock(titleName) {
        const banner = document.createElement('div');
        banner.className = 'go-title-unlock';
        const text = document.createElement('span');
        text.textContent = `✦ Title unlocked: ${titleName}`;
        banner.appendChild(text);
        return banner;
    }
    buildTip(run) {
        const tip = pickTip(run);
        const wrap = document.createElement('div');
        wrap.className = 'go-tip';
        const label = document.createElement('span');
        label.className = 'go-tip-label';
        label.textContent = 'TIP';
        const text = document.createElement('span');
        text.className = 'go-tip-text';
        text.textContent = tip;
        wrap.append(label, text);
        return wrap;
    }
    buildButtons(run) {
        const wrap = document.createElement('div');
        wrap.className = 'go-buttons';
        const playAgain = document.createElement('button');
        playAgain.className = 'go-btn go-btn-primary';
        playAgain.textContent = 'PLAY AGAIN  [R]';
        playAgain.addEventListener('click', () => {
            this.close();
            startRun({ modeId: run.mode_id, classId: run.class_id });
        });
        const toHub = document.createElement('button');
        toHub.className = 'go-btn go-btn-secondary';
        toHub.textContent = 'RETURN TO HUB';
        toHub.addEventListener('click', () => {
            this.close();
            router.navigate('home');
        });
        wrap.append(playAgain, toHub);
        return wrap;
    }
    // ── Helpers ────────────────────────────────────────────────────────────────
    statBlock(label, value, dim) {
        const block = document.createElement('div');
        block.className = 'go-stat-block';
        if (dim)
            block.classList.add('is-dim');
        const valEl = document.createElement('div');
        valEl.className = 'go-block-val';
        valEl.textContent = value;
        const lblEl = document.createElement('div');
        lblEl.className = 'go-block-lbl';
        lblEl.textContent = label;
        block.append(valEl, lblEl);
        return block;
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
const TIPS_GENERAL = [
    'Stack upgrades from the same category — synergy tier cards unlock at 2+ stacks.',
    'Armor reduces all damage including mirror recoil and volatile explosions.',
    'Merchant floors appear every 5 floors. Save gold for a big purchase.',
    'Boss kills always grant an upgrade — prioritise boss floors when low on options.',
    'Lifesteal + high attack speed is one of the strongest sustain combos.',
    'Poison and Burn deal damage over time — stack them before the enemy attacks.',
    'Overflow stores overkill damage for your next hit, but has a hard cap of 1B.',
    'Critical hit chance caps at 95%. Stacking past that is wasted.',
    'The Volatile modifier never kills you — it always leaves you at 5% HP.',
    'Relics are permanent and powerful. Relic floors appear every 5 floors.',
    'Press M during a run to pause and restart or quit safely.',
    'Press B to see your full build, Tab to see live combat stats.',
];
const TIPS_LOW_FLOOR = [
    'Died early? Focus on one damage category and stick with it.',
    'Starter upgrades scale well when stacked. 3× Sharp Edge is a solid foundation.',
    'Iron Skin stacks give +12 armor each. Even two stacks dramatically reduce damage taken.',
];
const TIPS_HIGH_FLOOR = [
    'Past floor 10, synergy-tier cards start appearing regularly — keep space for them.',
    'Keystones are game-changing. Check what you already own before the next relic floor.',
    'At high floors, effective HP (shown in Stats panel) matters more than raw armor.',
];
function pickTip(run) {
    const pool = [
        ...TIPS_GENERAL,
        ...(run.floor_reached <= 5 ? TIPS_LOW_FLOOR : []),
        ...(run.floor_reached >= 10 ? TIPS_HIGH_FLOOR : []),
    ];
    return pool[Math.floor(Math.random() * pool.length)];
}
