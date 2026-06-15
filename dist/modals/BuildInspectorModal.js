/**
 * BuildInspectorModal.ts — Run detail panel (M12).
 *
 * Opened by LeaderboardScreen (row click) and can be reused from GameOverModal.
 * Takes a RunResultDTO. Shows:
 *   A. Run identity: class, mode, floor, archetype
 *   B. Build: relics, keystone, upgrade stacks (category breakdown bar)
 *   C. Combat stats: 6 StatRows
 *   "Copy Build" button copies text summary to clipboard.
 *
 * Mounts in #modal-root.
 */
import { ALL_RELICS } from '../data/AllRelics';
import { MODES_REGISTRY } from '../modes/GameModeConfig';
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function openBuildInspector(run) {
    new BuildInspectorModal(run);
}
// ---------------------------------------------------------------------------
// BuildInspectorModal
// ---------------------------------------------------------------------------
class BuildInspectorModal {
    constructor(run) {
        this.run = run;
        this.root = document.getElementById('modal-root');
        this.dim = this.build();
        this.root.appendChild(this.dim);
        requestAnimationFrame(() => this.dim.classList.add('is-visible'));
    }
    build() {
        const dim = el('div', 'modal-dim');
        const panel = el('div', 'bi-panel');
        panel.append(this.buildHeader(), this.buildSectionA(), this.buildSectionB(), this.buildSectionC(), this.buildFooter());
        dim.appendChild(panel);
        // Close on backdrop click
        dim.addEventListener('click', (e) => {
            if (e.target === dim)
                this.close();
        });
        return dim;
    }
    close() {
        this.dim.classList.remove('is-visible');
        this.dim.addEventListener('transitionend', () => this.dim.remove(), { once: true });
    }
    // ── Header ──────────────────────────────────────────────────────────────────
    buildHeader() {
        const hdr = el('div', 'bi-header');
        const title = el('div', 'bi-header-title');
        title.textContent = 'BUILD INSPECTOR';
        const closeBtn = el('button', 'bi-close-btn');
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.close());
        hdr.append(title, closeBtn);
        return hdr;
    }
    // ── Section A: Run identity ──────────────────────────────────────────────────
    buildSectionA() {
        const sec = el('div', 'bi-section');
        const modeCfg = MODES_REGISTRY.find(m => m.id === this.run.mode_id);
        const dateStr = new Date(this.run.date).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
        const identity = el('div', 'bi-identity');
        const classEl = el('div', 'bi-identity-class');
        classEl.textContent = humanise(this.run.class_id).toUpperCase();
        const meta = el('div', 'bi-identity-meta');
        meta.textContent = [
            modeCfg ? `${modeCfg.icon} ${modeCfg.name}` : this.run.mode_id,
            `Floor ${this.run.floor_reached}`,
            dateStr,
        ].join('  ·  ');
        const archEl = el('div', 'bi-identity-arch');
        archEl.textContent = this.run.build_archetype;
        identity.append(classEl, meta, archEl);
        sec.appendChild(identity);
        return sec;
    }
    // ── Section B: Build composition ─────────────────────────────────────────────
    buildSectionB() {
        const sec = el('div', 'bi-section');
        const lbl = el('div', 'bi-section-label');
        lbl.textContent = 'BUILD';
        sec.appendChild(lbl);
        // Keystone
        if (this.run.keystone_owned) {
            const ks = el('div', 'bi-keystone');
            const ksPip = el('span', 'bi-ks-pip');
            ksPip.textContent = '♛';
            const ksName = el('span', 'bi-ks-name');
            ksName.textContent = this.run.keystone_owned;
            ks.append(ksPip, ksName);
            sec.appendChild(ks);
        }
        // Relics
        if (this.run.relics_owned && this.run.relics_owned.length > 0) {
            const relicWrap = el('div', 'bi-relics');
            this.run.relics_owned.forEach(id => {
                const def = ALL_RELICS.find(r => r.id === id);
                const chip = el('span', 'bi-relic-chip');
                chip.textContent = `◈ ${def ? def.name : id}`;
                relicWrap.appendChild(chip);
            });
            sec.appendChild(relicWrap);
        }
        return sec;
    }
    // ── Section C: Combat stats ───────────────────────────────────────────────────
    buildSectionC() {
        const sec = el('div', 'bi-section');
        const lbl = el('div', 'bi-section-label');
        lbl.textContent = 'COMBAT STATS';
        sec.appendChild(lbl);
        const grid = el('div', 'bi-stat-grid');
        const stats = [
            ['FLOOR REACHED', `${this.run.floor_reached}`],
            ['SCORE', `${this.run.score}`],
            ['KILLS', `${this.run.kills}`],
            ['BOSSES', `${this.run.bosses_killed ?? 0}`],
            ['DAMAGE', formatNum(this.run.damage_dealt)],
            ['TOP HIT', `${this.run.highest_hit}`],
            ['HEALING', formatNum(this.run.healing_done)],
            ['DURATION', formatDuration(this.run.duration_ms)],
        ];
        stats.forEach(([label, value]) => {
            const row = el('div', 'bi-stat-row');
            const lbl = el('span', 'bi-stat-lbl');
            lbl.textContent = label;
            const val = el('span', 'bi-stat-val');
            val.textContent = value;
            row.append(lbl, val);
            grid.appendChild(row);
        });
        sec.appendChild(grid);
        return sec;
    }
    // ── Footer ───────────────────────────────────────────────────────────────────
    buildFooter() {
        const footer = el('div', 'bi-footer');
        const copyBtn = el('button', 'bi-copy-btn');
        copyBtn.textContent = 'COPY BUILD';
        copyBtn.addEventListener('click', () => {
            const text = this.buildTextSummary();
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.textContent = 'COPIED ✓';
                setTimeout(() => { copyBtn.textContent = 'COPY BUILD'; }, 2000);
            }).catch(() => {
                copyBtn.textContent = 'FAILED';
                setTimeout(() => { copyBtn.textContent = 'COPY BUILD'; }, 2000);
            });
        });
        const closeBtn = el('button', 'bi-footer-close');
        closeBtn.textContent = 'CLOSE';
        closeBtn.addEventListener('click', () => this.close());
        footer.append(copyBtn, closeBtn);
        return footer;
    }
    buildTextSummary() {
        const relicNames = (this.run.relics_owned ?? [])
            .map(id => { const d = ALL_RELICS.find(r => r.id === id); return d ? d.name : id; })
            .join(', ');
        return [
            `=== BUILD REPORT ===`,
            `Class:    ${humanise(this.run.class_id)}`,
            `Mode:     ${this.run.mode_id}`,
            `Floor:    ${this.run.floor_reached}`,
            `Archetype: ${this.run.build_archetype}`,
            `Keystone: ${this.run.keystone_owned ?? 'none'}`,
            `Relics:   ${relicNames || 'none'}`,
            `---`,
            `Kills:    ${this.run.kills}  |  Bosses: ${this.run.bosses_killed ?? 0}`,
            `Damage:   ${this.run.damage_dealt}  |  Healing: ${this.run.healing_done}`,
            `Top Hit:  ${this.run.highest_hit}`,
            `Score:    ${this.run.score}`,
            `Date:     ${new Date(this.run.date).toLocaleDateString()}`,
        ].join('\n');
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function el(tag, className) {
    const e = document.createElement(tag);
    if (className)
        className.split(' ').forEach(c => c && e.classList.add(c));
    return e;
}
function humanise(id) {
    if (!id || id === 'unknown')
        return '—';
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
}
function formatNum(n) {
    if (n >= 1000000)
        return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
}
function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
