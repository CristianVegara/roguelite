/**
 * MerchantModal.ts — HTML replacement for MerchantScene.
 *
 * More complex than Relic/Upgrade modals:
 *   - Player can buy multiple items before leaving
 *   - Reroll button: escalating cost, replaces offer cards
 *   - Leave button: always visible, emits 'merchant:closed'
 *   - Gold display reads from runState and stays live
 *
 * Bus protocol:
 *   ← merchant:available   open the modal
 *   → merchant:purchase    GameScene deducts gold, applies effect, updates runState
 *   → merchant:closed      GameScene resumes + advances floor
 *
 * Mounts in #modal-root.
 */

import { bus }      from '../bridge/GameEventBus';
import { runState } from '../bridge/RunStateStore';
import { pickRunUpgrades }  from '../data/AllUpgrades';
import { UpgradeDefinition, RARITY_LABEL, RARITY_COLOR, TIER_LABEL, OwnedUpgrades } from '../data/UpgradeDefinition';

interface ConsumableDef {
  id:     string;
  name:   string;
  desc:   string;
  cost:   number;
}

const CONSUMABLES: ConsumableDef[] = [
  { id: 'war_ration',       name: 'War Ration',       desc: 'Restore 25% max HP',      cost: 20 },
  { id: 'sharpening_stone', name: 'Sharpening Stone', desc: '+10% damage (this floor)', cost: 25 },
  { id: 'guard_totem',      name: 'Guard Totem',       desc: '+20 armor (this floor)',   cost: 25 },
];

export class MerchantModal {
  private root:   HTMLElement;
  private active = false;

  // Merchant state
  private floor        = 0;
  private ownedSnapshot!: OwnedUpgrades;
  private offers:   Array<{ upg: UpgradeDefinition; cost: number; sold: boolean }> = [];
  private soldConsumables = new Set<string>();
  private rerollCount  = 0;
  private rerollCost   = 15;

  // DOM refs updated on gold/reroll changes
  private goldEl!:       HTMLElement;
  private offerGrid!:    HTMLElement;
  private rerollBtn!:    HTMLButtonElement;
  private goldSub:       (() => void) | null = null;

  constructor() {
    this.root = document.getElementById('modal-root')!;

    bus.on('merchant:available', (e) => {
      if (this.active) return;
      // Capture offer snapshot from bus; ownedSnapshot is reconstructed from payload
      this.floor       = e.payload.floor;
      this.rerollCount = 0;
      this.rerollCost  = 15;
      this.soldConsumables.clear();
      this.open(e.payload.upgradeCards);
    });
  }

  // ── Open / close ────────────────────────────────────────────────────────────

  private open(initialOffers: UpgradeDefinition[]): void {
    this.active = true;

    // Snapshot owned upgrades from run state (approximation — track by id)
    // We use an empty map; the actual owned tracking is in GameScene
    this.ownedSnapshot = new Map();

    this.offers = initialOffers.map(upg => ({
      upg,
      cost: this.computeCost(upg),
      sold: false,
    }));

    const dim = document.createElement('div');
    dim.className = 'modal-dim';

    const panel = document.createElement('div');
    panel.className = 'merchant-modal';

    panel.append(
      this.buildHeader(),
      this.buildConsumableRow(),
      this.buildOfferSection(),
      this.buildFooter(),
    );

    dim.appendChild(panel);
    this.root.appendChild(dim);
    requestAnimationFrame(() => dim.classList.add('is-visible'));

    // Live gold display
    this.goldSub = runState.subscribe(s => s.gold, (gold) => {
      if (this.goldEl) this.goldEl.textContent = `Gold: ${gold} ★`;
      this.refreshAffordability();
    });
  }

  private close(): void {
    this.active = false;
    this.goldSub?.();
    this.goldSub = null;

    const dim = this.root.querySelector('.modal-dim');
    if (dim) {
      dim.classList.remove('is-visible');
      dim.addEventListener('transitionend', () => dim.remove(), { once: true });
    }
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const hdr = document.createElement('div');
    hdr.className = 'mm-header';

    const title = document.createElement('div');
    title.className   = 'mm-title';
    title.textContent = '🛒  MERCHANT';

    const sub = document.createElement('div');
    sub.className   = 'mm-subtitle';
    sub.textContent = `Floor ${this.floor} — spend wisely`;

    this.goldEl = document.createElement('div');
    this.goldEl.className   = 'mm-gold';
    this.goldEl.textContent = `Gold: ${runState.get().gold} ★`;

    hdr.append(title, sub, this.goldEl);
    return hdr;
  }

  // ── Consumables ─────────────────────────────────────────────────────────────

  private buildConsumableRow(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'mm-consumable-section';

    const label = document.createElement('div');
    label.className   = 'mm-section-label';
    label.textContent = 'CONSUMABLES';
    section.appendChild(label);

    const row = document.createElement('div');
    row.className = 'mm-consumable-row';

    CONSUMABLES.forEach(c => {
      const cell = document.createElement('div');
      cell.className = 'mm-consumable';
      cell.dataset['id'] = c.id;

      const nameEl = document.createElement('div');
      nameEl.className   = 'mm-con-name';
      nameEl.textContent = c.name;

      const descEl = document.createElement('div');
      descEl.className   = 'mm-con-desc';
      descEl.textContent = c.desc;

      const costEl = document.createElement('div');
      costEl.className   = 'mm-con-cost';
      costEl.textContent = `${c.cost} ★`;

      cell.append(nameEl, descEl, costEl);

      cell.addEventListener('click', () => {
        if (this.soldConsumables.has(c.id)) return;
        const gold = runState.get().gold;
        if (gold < c.cost) {
          cell.classList.add('is-flash');
          setTimeout(() => cell.classList.remove('is-flash'), 300);
          return;
        }
        this.soldConsumables.add(c.id);
        cell.classList.add('is-sold');
        costEl.textContent = 'USED';
        bus.emit({ type: 'merchant:purchase', payload: { itemId: c.id, type: 'consumable', cost: c.cost } });
      });

      row.appendChild(cell);
    });

    section.appendChild(row);
    return section;
  }

  // ── Upgrade offer grid ──────────────────────────────────────────────────────

  private buildOfferSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'mm-offer-section';

    const label = document.createElement('div');
    label.className   = 'mm-section-label';
    label.textContent = 'UPGRADES FOR SALE';
    section.appendChild(label);

    this.offerGrid = document.createElement('div');
    this.offerGrid.className = 'mm-offer-grid';
    this.renderOfferGrid();
    section.appendChild(this.offerGrid);

    return section;
  }

  private renderOfferGrid(): void {
    this.offerGrid.innerHTML = '';
    const gold = runState.get().gold;

    this.offers.forEach((offer, i) => {
      const card = this.buildOfferCard(offer, i, gold);
      this.offerGrid.appendChild(card);
    });
  }

  private buildOfferCard(
    offer: { upg: UpgradeDefinition; cost: number; sold: boolean },
    _index: number,
    gold: number,
  ): HTMLElement {
    const { upg, cost, sold } = offer;
    const canAfford = !sold && gold >= cost;

    const card = document.createElement('div');
    card.className = 'mm-offer-card';
    if (sold) card.classList.add('is-sold');
    if (!canAfford && !sold) card.classList.add('is-cant-afford');
    card.style.setProperty('--upg-color',   intToHex(upg.color));
    card.style.setProperty('--rarity-color', intToHex(RARITY_COLOR[upg.rarity]));

    const badges = document.createElement('div');
    badges.className = 'um-card-badges';

    const tierEl = document.createElement('span');
    tierEl.className   = 'um-card-tier';
    tierEl.textContent = TIER_LABEL[upg.tier];
    if (upg.tier === 'keystone') tierEl.classList.add('is-keystone');

    const rarEl = document.createElement('span');
    rarEl.className   = 'um-card-rarity';
    rarEl.textContent = RARITY_LABEL[upg.rarity];

    badges.append(tierEl, rarEl);

    const catEl = document.createElement('div');
    catEl.className   = 'um-card-cat';
    catEl.textContent = upg.category.toUpperCase();

    const nameEl = document.createElement('div');
    nameEl.className   = 'um-card-name';
    nameEl.textContent = upg.name;

    const divEl = document.createElement('div');
    divEl.className = 'um-card-divider';

    const descEl = document.createElement('div');
    descEl.className   = 'um-card-desc';
    descEl.textContent = upg.description;

    const buyBtn = document.createElement('button');
    buyBtn.className   = 'mm-buy-btn';
    buyBtn.textContent = sold ? 'SOLD' : `${cost} ★  BUY`;
    buyBtn.disabled    = sold;
    if (canAfford && !sold) buyBtn.classList.add('can-afford');

    card.append(badges, catEl, nameEl, divEl, descEl, buyBtn);

    if (!sold) {
      card.addEventListener('click', () => {
        if (offer.sold) return;
        const currentGold = runState.get().gold;
        if (currentGold < cost) {
          card.classList.add('is-flash');
          setTimeout(() => card.classList.remove('is-flash'), 300);
          return;
        }
        offer.sold = true;
        card.classList.add('is-sold');
        buyBtn.textContent = 'SOLD';
        buyBtn.disabled    = true;
        bus.emit({ type: 'merchant:purchase', payload: { itemId: upg.id, type: 'upgrade', cost } });
      });
    }

    return card;
  }

  private refreshAffordability(): void {
    if (!this.offerGrid) return;
    const gold = runState.get().gold;
    // Re-render offer grid to reflect new gold
    this.offerGrid.innerHTML = '';
    this.offers.forEach((offer, i) => {
      this.offerGrid.appendChild(this.buildOfferCard(offer, i, gold));
    });
    // Update reroll button
    if (this.rerollBtn) {
      this.rerollBtn.disabled    = gold < this.rerollCost;
      this.rerollBtn.textContent = `REROLL  ${this.rerollCost} ★`;
    }
  }

  // ── Footer (reroll + leave) ─────────────────────────────────────────────────

  private buildFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'mm-footer';

    this.rerollBtn = document.createElement('button');
    this.rerollBtn.className   = 'mm-reroll-btn';
    this.rerollBtn.textContent = `REROLL  ${this.rerollCost} ★`;
    this.rerollBtn.disabled    = runState.get().gold < this.rerollCost;

    this.rerollBtn.addEventListener('click', () => {
      const gold = runState.get().gold;
      if (gold < this.rerollCost) return;

      bus.emit({ type: 'merchant:purchase', payload: { itemId: 'reroll', type: 'reroll', cost: this.rerollCost } });

      // Escalate cost and pick new offers
      this.rerollCount++;
      this.rerollCost = Math.min(100, Math.floor(15 * Math.pow(1.5, this.rerollCount)));

      // Pick new upgrades (use same floor and fresh ownedSnapshot)
      const newUpgrades = pickRunUpgrades(3, this.floor, this.ownedSnapshot);
      this.offers = newUpgrades.map(upg => ({
        upg,
        cost: this.computeCost(upg),
        sold: false,
      }));
      this.renderOfferGrid();
    });

    const leaveBtn = document.createElement('button');
    leaveBtn.className   = 'mm-leave-btn';
    leaveBtn.textContent = 'LEAVE SHOP';
    leaveBtn.addEventListener('click', () => {
      bus.emit({ type: 'merchant:closed', payload: {} });
      this.close();
    });

    footer.append(this.rerollBtn, leaveBtn);
    return footer;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private computeCost(upg: UpgradeDefinition): number {
    const rarityBase: Record<string, number> = {
      common: 15, uncommon: 25, rare: 40, legendary: 60,
    };
    return (rarityBase[upg.rarity] ?? 20) + Math.floor(this.floor * 0.5);
  }
}

function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
