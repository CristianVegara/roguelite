/**
 * ShopScreen.ts — Class skin shop.
 *
 * CHANGES:
 *   - buildSkinButton(): skin status meta text now uses semantic colors:
 *       EQUIPPED → var(--accent-nature)  green  — "you own and are using this"
 *       UNLOCKED → var(--text-muted)     grey   — "you own this but it's not equipped"
 *       cost ★   → var(--accent-gold)    gold   — "this costs currency" (CSS default)
 *   - renderSelection(): shop-preview now uses image-rendering: pixelated
 *     and background-size: auto so pixel-art sprites aren't blurred.
 *   - refreshActionButton(): added .can-afford to base skin equip button
 *     so it always shows as actionable (not just when purchasing).
 */

import { ALL_CLASSES, ClassDefinition } from '../data/ClassDefinition';
import { ClassSkinDefinition, getClassSkins } from '../data/ClassSkins';
import { metaService } from '../meta/MetaService';
import { router } from '../router/Router';
import { SpriteLoader } from '../sprites/SpriteLoader';

export function createShopScreen(): HTMLElement {
  return new ShopScreen().el;
}

type SkinChoice =
  | { kind: 'base'; classId: string }
  | { kind: 'skin'; skin: ClassSkinDefinition };

class ShopScreen {
  readonly el: HTMLElement;

  private selectedClass:  ClassDefinition  = ALL_CLASSES[0];
  private selectedChoice: SkinChoice       = { kind: 'base', classId: ALL_CLASSES[0]?.id ?? '' };

  private currencyEl!:  HTMLElement;
  private classListEl!: HTMLElement;
  private skinListEl!:  HTMLElement;
  private previewEl!:   HTMLElement;
  private titleEl!:     HTMLElement;
  private costEl!:      HTMLElement;
  private actionBtn!:   HTMLButtonElement;

  constructor() {
    this.el = this.build();
    this.selectClass(this.selectedClass);
  }

  private build(): HTMLElement {
    const root = el('div', 'shop-screen');
    root.append(this.buildHeader(), this.buildBody());
    return root;
  }

  private buildHeader(): HTMLElement {
    const header = el('div', 'shop-header');

    const back = document.createElement('button');
    back.className   = 'shop-back-btn';
    back.textContent = '\u2190 BACK';
    back.addEventListener('click', () => router.back());

    const titleWrap = el('div', 'shop-title-wrap');
    const title = el('div', 'shop-title');
    title.textContent = 'SHOP';
    const sub = el('div', 'shop-subtitle');
    sub.textContent = 'CLASS SKINS';
    titleWrap.append(title, sub);

    this.currencyEl = el('div', 'shop-currency');
    this.refreshCurrency();

    header.append(back, titleWrap, this.currencyEl);
    return header;
  }

  private buildBody(): HTMLElement {
    const body = el('div', 'shop-body');

    this.classListEl = el('div', 'shop-class-list');
    ALL_CLASSES.forEach((cls) => {
      const btn = document.createElement('button');
      btn.className          = 'shop-class-btn';
      btn.dataset['classId'] = cls.id;
      btn.style.setProperty('--cls-color', intToHex(cls.color));
      btn.textContent = cls.icon + ' ' + cls.name.toUpperCase();
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', cls.name + ' class');
      btn.addEventListener('click', () => this.selectClass(cls));
      this.classListEl.appendChild(btn);
    });

    const right       = el('div', 'shop-right');
    this.previewEl    = el('div', 'shop-preview');
    this.titleEl      = el('div', 'shop-skin-title');
    this.costEl       = el('div', 'shop-skin-cost');
    this.actionBtn    = document.createElement('button');
    this.actionBtn.className = 'shop-action-btn';
    this.actionBtn.addEventListener('click', () => this.performAction());

    const detail = el('div', 'shop-detail');
    detail.append(this.previewEl, this.titleEl, this.costEl, this.actionBtn);

    this.skinListEl = el('div', 'shop-skin-list');
    right.append(detail, this.skinListEl);

    body.append(this.classListEl, right);
    return body;
  }

  private selectClass(cls: ClassDefinition): void {
    this.selectedClass = cls;
    const equippedSkinId = metaService.getEquippedSkinId(cls.id);
    const equippedSkin   = getClassSkins(cls.id).find(s => s.id === equippedSkinId);
    this.selectedChoice  = equippedSkin
      ? { kind: 'skin', skin: equippedSkin }
      : { kind: 'base', classId: cls.id };

    this.renderClassButtons();
    this.renderSkinList();
    this.renderSelection();
  }

  private selectChoice(choice: SkinChoice): void {
    this.selectedChoice = choice;
    this.renderSkinList();
    this.renderSelection();
  }

  private renderClassButtons(): void {
    this.classListEl.querySelectorAll<HTMLButtonElement>('.shop-class-btn').forEach((btn) => {
      const active = btn.dataset['classId'] === this.selectedClass.id;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  private renderSkinList(): void {
    this.skinListEl.innerHTML = '';
    this.skinListEl.setAttribute('role', 'listbox');
    this.skinListEl.setAttribute('aria-label', this.selectedClass.name + ' skins');

    this.skinListEl.appendChild(this.buildSkinButton({
      kind: 'base', classId: this.selectedClass.id,
    }));

    const skins = getClassSkins(this.selectedClass.id);
    if (skins.length === 0) {
      const empty = el('div', 'shop-empty');
      empty.textContent = 'NO SKINS FOUND';
      this.skinListEl.appendChild(empty);
      return;
    }

    skins.forEach(skin => {
      this.skinListEl.appendChild(this.buildSkinButton({ kind: 'skin', skin }));
    });
  }

  private buildSkinButton(choice: SkinChoice): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'shop-skin-btn';
    btn.setAttribute('role', 'option');

    const selected = this.choiceId(choice) === this.choiceId(this.selectedChoice);
    const equipped = this.isChoiceEquipped(choice);
    const unlocked = choice.kind === 'base' || metaService.isSkinUnlocked(choice.skin.id);

    btn.classList.toggle('is-active',  selected);
    btn.classList.toggle('is-locked', !unlocked);
    btn.setAttribute('aria-selected', String(selected));

    const skinName  = choice.kind === 'base' ? 'Base skin' : choice.skin.displayName;
    const skinState = equipped ? 'equipped' : unlocked ? 'unlocked' : 'locked';
    btn.setAttribute('aria-label', skinName + ', ' + skinState);

    const name = el('span', 'shop-skin-name');
    name.textContent = choice.kind === 'base' ? 'BASE' : choice.skin.displayName.toUpperCase();

    const meta = el('span', 'shop-skin-meta');

    // FIX: semantic colors for each ownership state
    if (equipped) {
      meta.textContent   = 'EQUIPPED';
      meta.style.color   = 'var(--accent-nature)';   // green — actively in use
    } else if (unlocked) {
      meta.textContent   = 'UNLOCKED';
      meta.style.color   = 'var(--text-muted)';      // grey — owned but not equipped
    } else {
      const cost = choice.kind === 'skin' ? choice.skin.cost : 0;
      meta.textContent   = cost + ' \u2605';
      // gold color comes from .shop-skin-meta in CSS — no inline override needed
    }

    btn.append(name, meta);
    btn.addEventListener('click', () => this.selectChoice(choice));
    return btn;
  }

  private renderSelection(): void {
    // Reset preview
    this.previewEl.style.backgroundImage    = '';
    this.previewEl.style.backgroundSize     = '';
    this.previewEl.style.backgroundPosition = '';
    this.previewEl.textContent              = '';

    const choice = this.selectedChoice;

    if (choice.kind === 'skin') {
      this.previewEl.style.backgroundImage    = `url('${choice.skin.url}')`;
      // FIX: use 'contain' for skin images (they may be full character sheets)
      this.previewEl.style.backgroundSize     = 'contain';
      this.previewEl.style.backgroundPosition = 'center';
      this.previewEl.style.backgroundRepeat   = 'no-repeat';
      this.titleEl.textContent = this.selectedClass.name.toUpperCase() +
        ' \u00b7 ' + choice.skin.displayName.toUpperCase();
      this.costEl.textContent = metaService.isSkinUnlocked(choice.skin.id)
        ? 'UNLOCKED'
        : choice.skin.cost + ' \u2605';
    } else {
      const baseStyle = SpriteLoader.getClassSpriteBackgroundStyle(this.selectedClass.id);
      this.previewEl.style.backgroundImage    = baseStyle.backgroundImage;
      // FIX: pixel-art sprites should not be scaled with 'contain' — use auto
      // size so each pixel maps 1:1 and then scale up 3x for visibility.
      // If the sprite is very small (24×32 placeholder), 'contain' centres a
      // tiny image; '300% auto' keeps it crisp and fills the preview box.
      this.previewEl.style.backgroundSize     = '300% auto';
      this.previewEl.style.backgroundPosition = 'center top';
      this.previewEl.style.backgroundRepeat   = 'no-repeat';
      // FIX: pixel art rendering — crisp-edges for standards, pixelated for Chrome
      (this.previewEl.style as any)['imageRendering'] = 'pixelated';

      this.titleEl.textContent = this.selectedClass.name.toUpperCase() + ' \u00b7 BASE';
      this.costEl.textContent  = 'OWNED';
    }

    this.refreshActionButton();
  }

  private refreshActionButton(): void {
    const choice   = this.selectedChoice;
    const equipped = this.isChoiceEquipped(choice);

    if (equipped) {
      this.actionBtn.textContent = 'EQUIPPED';
      this.actionBtn.disabled    = true;
      this.actionBtn.classList.remove('can-afford');
      return;
    }

    if (choice.kind === 'base') {
      this.actionBtn.textContent = 'EQUIP';
      this.actionBtn.disabled    = false;
      // FIX: base skin equip button should always look actionable
      this.actionBtn.classList.add('can-afford');
      return;
    }

    const unlocked  = metaService.isSkinUnlocked(choice.skin.id);
    const canAfford = metaService.canPurchaseSkin(choice.skin.id);

    this.actionBtn.textContent = unlocked ? 'EQUIP' : 'BUY';
    this.actionBtn.disabled    = !unlocked && !canAfford;
    this.actionBtn.classList.toggle('can-afford', unlocked || canAfford);
  }

  private performAction(): void {
    const choice = this.selectedChoice;

    if (choice.kind === 'base') {
      metaService.equipSkin(this.selectedClass.id, null);
    } else if (metaService.isSkinUnlocked(choice.skin.id)) {
      metaService.equipSkin(this.selectedClass.id, choice.skin.id);
    } else {
      metaService.purchaseSkin(choice.skin.id);
    }

    this.refreshCurrency();
    this.renderSkinList();
    this.renderSelection();
  }

  private isChoiceEquipped(choice: SkinChoice): boolean {
    const equippedSkinId = metaService.getEquippedSkinId(this.selectedClass.id);
    return choice.kind === 'base'
      ? equippedSkinId === null
      : equippedSkinId === choice.skin.id;
  }

  private choiceId(choice: SkinChoice): string {
    return choice.kind === 'base' ? choice.classId + ':base' : choice.skin.id;
  }

  private refreshCurrency(): void {
    if (this.currencyEl) {
      this.currencyEl.textContent = '\u2605 ' + metaService.currency;
    }
  }
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) className.split(' ').forEach(c => c && e.classList.add(c));
  return e;
}

function intToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}