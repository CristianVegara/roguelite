/**
 * RelicModal.ts — HTML replacement for RelicScene.
 *
 * Mobile fix: emits modal:open / modal:close so CombatHUD and
 * MobileChrome suppress their pointer-events while the overlay is up.
 */
import { bus } from '../bridge/GameEventBus';
import { RELIC_RARITY_COLOR, RELIC_RARITY_LABEL } from '../data/RelicDefinition';
export class RelicModal {
    constructor() {
        this.active = false;
        this.root = document.getElementById('modal-root');
        bus.on('relic:available', (e) => {
            if (this.active)
                return;
            this.open(e.payload.relics, e.payload.floor);
        });
    }
    open(relics, floor) {
        this.active = true;
        bus.emit({ type: 'modal:open', payload: {} });
        const dim = document.createElement('div');
        dim.className = 'modal-dim';
        const panel = document.createElement('div');
        panel.className = 'relic-modal';
        panel.append(this.buildHeader(floor), this.buildCardRow(relics), this.buildSkipBtn());
        dim.appendChild(panel);
        this.root.appendChild(dim);
        requestAnimationFrame(() => dim.classList.add('is-visible'));
    }
    close() {
        this.active = false;
        bus.emit({ type: 'modal:close', payload: {} });
        const dim = this.root.querySelector('.modal-dim');
        if (dim) {
            dim.classList.remove('is-visible');
            dim.addEventListener('transitionend', () => dim.remove(), { once: true });
        }
    }
    buildHeader(floor) {
        const hdr = document.createElement('div');
        hdr.className = 'rm-header';
        const title = document.createElement('div');
        title.className = 'rm-title';
        title.textContent = '✦  RELIC FOUND  ✦';
        const sub = document.createElement('div');
        sub.className = 'rm-subtitle';
        sub.textContent = `Floor ${floor} — choose a relic`;
        hdr.append(title, sub);
        return hdr;
    }
    buildCardRow(relics) {
        const row = document.createElement('div');
        row.className = 'rm-card-row';
        relics.forEach(r => row.appendChild(this.buildCard(r)));
        return row;
    }
    buildCard(relic) {
        const card = document.createElement('div');
        card.className = 'rm-card';
        card.style.setProperty('--relic-color', intToHex(relic.color));
        card.style.setProperty('--rarity-color', intToHex(RELIC_RARITY_COLOR[relic.rarity]));
        const badges = document.createElement('div');
        badges.className = 'rm-card-badges';
        const typeEl = document.createElement('span');
        typeEl.className = 'rm-card-type';
        typeEl.textContent = 'RELIC';
        const rarEl = document.createElement('span');
        rarEl.className = 'rm-card-rarity';
        rarEl.textContent = RELIC_RARITY_LABEL[relic.rarity];
        badges.append(typeEl, rarEl);
        const gemEl = document.createElement('div');
        gemEl.className = 'rm-card-gem';
        gemEl.textContent = '◈';
        const nameEl = document.createElement('div');
        nameEl.className = 'rm-card-name';
        nameEl.textContent = relic.name;
        const div = document.createElement('div');
        div.className = 'rm-card-divider';
        const descEl = document.createElement('div');
        descEl.className = 'rm-card-desc';
        descEl.textContent = relic.description;
        const flavEl = document.createElement('div');
        flavEl.className = 'rm-card-flavour';
        flavEl.textContent = relic.flavour ? `"${relic.flavour}"` : '';
        flavEl.hidden = !relic.flavour;
        card.append(badges, gemEl, nameEl, div, descEl, flavEl);
        card.addEventListener('click', () => {
            if (!this.active)
                return;
            card.classList.add('is-selected');
            setTimeout(() => {
                bus.emit({ type: 'relic:selected', payload: { relicId: relic.id } });
                this.close();
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
            bus.emit({ type: 'relic:skipped', payload: {} });
            this.close();
        });
        return skip;
    }
}
function intToHex(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}
