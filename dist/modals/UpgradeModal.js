/**
 * UpgradeModal.ts — HTML replacement for UpgradeScene.
 *
 * Self-managing: instantiated once from main.ts.
 * Opens when bus fires 'upgrade:available'.
 * Emits 'upgrade:selected' (with upgradeId) or 'upgrade:skipped' when done.
 * GameScene applies the upgrade — the modal only handles display.
 *
 * Mounts in #modal-root.
 */
import { bus } from '../bridge/GameEventBus';
import { RARITY_LABEL, RARITY_COLOR, TIER_LABEL } from '../data/UpgradeDefinition';
export class UpgradeModal {
    constructor() {
        this.active = false;
        this.root = document.getElementById('modal-root');
        bus.on('upgrade:available', (e) => {
            if (this.active)
                return;
            this.open(e.payload.upgrades, e.payload.contextLabel, e.payload.floor);
        });
    }
    // ── Open / close ────────────────────────────────────────────────────────────
    cleanupStaleOverlay() {
        this.root.querySelectorAll('.modal-dim').forEach((dim) => dim.remove());
    }
    open(upgrades, contextLabel, _floor) {
        this.cleanupStaleOverlay();
        this.active = true;
        bus.emit({ type: 'modal:open', payload: {} });
        const dim = document.createElement('div');
        dim.className = 'modal-dim';
        this.panel = document.createElement('div');
        this.panel.className = 'upgrade-modal';
        this.panel.append(this.buildHeader(contextLabel), this.buildCardRow(upgrades), this.buildSkipBtn());
        dim.appendChild(this.panel);
        this.root.appendChild(dim);
        requestAnimationFrame(() => dim.classList.add('is-visible'));
    }
    close() {
        this.active = false;
        bus.emit({ type: 'modal:close', payload: {} });
        const dim = this.root.querySelector('.modal-dim');
        if (!dim)
            return;
        dim.classList.remove('is-visible');
        dim.style.pointerEvents = 'none';
        const removeDim = () => {
            if (dim.parentElement)
                dim.remove();
            clearTimeout(timeout);
        };
        const timeout = window.setTimeout(removeDim, 300);
        dim.addEventListener('transitionend', removeDim, { once: true });
    }
    // ── Layout ──────────────────────────────────────────────────────────────────
    buildHeader(contextLabel) {
        const hdr = document.createElement('div');
        hdr.className = 'um-header';
        const title = document.createElement('div');
        title.className = 'um-title';
        title.textContent = 'CHOOSE AN UPGRADE';
        const sub = document.createElement('div');
        sub.className = 'um-subtitle';
        sub.textContent = contextLabel;
        hdr.append(title, sub);
        return hdr;
    }
    buildCardRow(upgrades) {
        const row = document.createElement('div');
        row.className = 'um-card-row';
        upgrades.forEach(upg => row.appendChild(this.buildCard(upg)));
        return row;
    }
    buildCard(upg) {
        const card = document.createElement('div');
        card.className = 'um-card';
        const accentColor = intToHex(upg.color);
        const rarityColor = intToHex(RARITY_COLOR[upg.rarity]);
        card.style.setProperty('--upg-color', accentColor);
        card.style.setProperty('--rarity-color', rarityColor);
        card.dataset['rarity'] = upg.rarity;
        const badges = document.createElement('div');
        badges.className = 'um-card-badges';
        const tierEl = document.createElement('span');
        tierEl.className = 'um-card-tier';
        tierEl.textContent = TIER_LABEL[upg.tier];
        if (upg.tier === 'keystone')
            tierEl.classList.add('is-keystone');
        const rarEl = document.createElement('span');
        rarEl.className = 'um-card-rarity';
        rarEl.textContent = RARITY_LABEL[upg.rarity];
        badges.append(tierEl, rarEl);
        const catEl = document.createElement('div');
        catEl.className = 'um-card-cat';
        catEl.textContent = upg.category.toUpperCase();
        const nameEl = document.createElement('div');
        nameEl.className = 'um-card-name';
        nameEl.textContent = upg.name;
        const div = document.createElement('div');
        div.className = 'um-card-divider';
        const descEl = document.createElement('div');
        descEl.className = 'um-card-desc';
        descEl.textContent = upg.description;
        const flavEl = document.createElement('div');
        flavEl.className = 'um-card-flavour';
        flavEl.textContent = upg.flavour ? `"${upg.flavour}"` : '';
        flavEl.hidden = !upg.flavour;
        const stackEl = document.createElement('div');
        stackEl.className = 'um-card-stack';
        stackEl.hidden = upg.maxStacks <= 1;
        stackEl.textContent = upg.stackNote
            ? `↑ ${upg.stackNote}  (max ${upg.maxStacks}×)`
            : `Stackable  ×${upg.maxStacks}`;
        card.append(badges, catEl, nameEl, div, descEl, flavEl, stackEl);
        card.addEventListener('click', () => {
            if (!this.active)
                return;
            card.classList.add('is-selected');
            setTimeout(() => {
                this.close();
                bus.emit({ type: 'upgrade:selected', payload: { upgradeId: upg.id } });
            }, 100);
        });
        return card;
    }
    buildSkipBtn() {
        const skip = document.createElement('button');
        skip.className = 'um-skip-btn';
        skip.textContent = 'SKIP';
        skip.addEventListener('click', () => {
            if (!this.active)
                return;
            this.close();
            bus.emit({ type: 'upgrade:skipped', payload: {} });
        });
        return skip;
    }
}
function intToHex(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}
