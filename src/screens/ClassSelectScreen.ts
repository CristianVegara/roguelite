/**
 * ClassSelectScreen.ts — HTML replacement for ClassScene.
 *
 * CHANGES:
 *   - buildCard(): adds .cs-card-sprite preview zone populated via
 *     SpriteLoader.getClassSpriteBackgroundStyle(). Falls back to emoji
 *     icon (.is-fallback) when sprite sheet not available.
 *   - buildCard(): adds .cs-card-best showing per-class run count and
 *     average floor from profile.floors_by_class / runs_by_class.
 *   - Category tags opacity removed (handled in CSS now).
 *   - Card click: immediate visual press, then startRun after 80ms.
 */

import { ALL_CLASSES, ClassDefinition } from '../data/ClassDefinition';
import { router }                        from '../router/Router';
import { startRun }                      from '../bridge/startRun';
import { ModeId }                        from '../modes/GameModeConfig';
import { ServiceLocator }                from '../services/ServiceLocator';
import { SpriteLoader }                  from '../sprites/SpriteLoader';

export function createClassSelectScreen(params: Record<string, unknown>): HTMLElement {
  const modeId = (params['modeId'] as ModeId) ?? 'classic';
  return new ClassSelectScreen(modeId).el;
}

class ClassSelectScreen {
  readonly el: HTMLElement;

  // Cache per-class stats from profile so we don't re-query per card
  private readonly classRunCounts: Record<string, number>;
  private readonly classAvgFloors: Record<string, number>;

  constructor(private readonly modeId: ModeId) {
    const profile = ServiceLocator.profile.getProfile();
    this.classRunCounts = profile?.runs_by_class   ?? {};
    this.classAvgFloors = {};

    if (profile) {
      for (const [id, totalFloors] of Object.entries(profile.floors_by_class)) {
        const runs = this.classRunCounts[id] ?? 1;
        this.classAvgFloors[id] = Math.round(totalFloors / runs);
      }
    }

    this.el = this.build();
  }

  private build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cs-screen';

    root.append(
      this.buildHeader(),
      this.buildGrid(),
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
        document.removeEventListener('keydown', onKey);
        if (router.getCurrent()?.name !== 'combat') router.back();
      }
    };
    document.addEventListener('keydown', onKey);

    return root;
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'cs-header';

    const back = document.createElement('button');
    back.className   = 'cs-back-btn';
    back.textContent = '\u2190 BACK';
    back.addEventListener('click', () => router.back());

    const titleWrap = document.createElement('div');
    titleWrap.className = 'cs-title-wrap';

    const title = document.createElement('div');
    title.className   = 'cs-title';
    title.textContent = 'CHOOSE YOUR CLASS';

    const sub = document.createElement('div');
    sub.className   = 'cs-subtitle';
    sub.textContent = 'Your class shapes which upgrades you discover';

    titleWrap.append(title, sub);
    header.append(back, titleWrap);
    return header;
  }

  // ── Class card grid ─────────────────────────────────────────────────────────

  private buildGrid(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'cs-grid';
    grid.setAttribute('role', 'list');
    grid.setAttribute('aria-label', 'Choose your class');

    ALL_CLASSES.forEach(cls => {
      grid.appendChild(this.buildCard(cls));
    });

    // Arrow key navigation through cards
    grid.addEventListener('keydown', (e) => {
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.cs-card'));
      const focused = document.activeElement as HTMLElement;
      const idx = cards.indexOf(focused);
      if (idx < 0) return;

      let next = -1;
      const cols = window.innerWidth <= 479 ? 1 : 2;
      if (e.key === 'ArrowRight') next = Math.min(idx + 1, cards.length - 1);
      else if (e.key === 'ArrowLeft')  next = Math.max(idx - 1, 0);
      else if (e.key === 'ArrowDown')  next = Math.min(idx + cols, cards.length - 1);
      else if (e.key === 'ArrowUp')    next = Math.max(idx - cols, 0);

      if (next >= 0 && next !== idx) {
        e.preventDefault();
        cards[next].focus();
      }
    });

    return grid;
  }

  private buildCard(cls: ClassDefinition): HTMLElement {
    const card = document.createElement('div');
    card.className = 'cs-card';
    card.style.setProperty('--cls-color', intToHex(cls.color));
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', cls.name + ' — ' + cls.flavour);

    // ── Sprite preview ──────────────────────────────────────────────────────
    // Try to load the class sprite sheet style. Falls back to emoji icon.
    const sprite = document.createElement('div');
    sprite.className = 'cs-card-sprite';

    const spriteStyle = SpriteLoader.getClassSpriteBackgroundStyle(cls.id);
    if (spriteStyle.backgroundImage && spriteStyle.backgroundImage !== 'none') {
      sprite.style.backgroundImage    = spriteStyle.backgroundImage;
      sprite.style.backgroundSize     = spriteStyle.backgroundSize;
      sprite.style.backgroundPosition = spriteStyle.backgroundPosition;
      sprite.style.imageRendering     = 'pixelated';
    } else {
      // Fallback: show the class emoji icon inside the sprite zone
      sprite.classList.add('is-fallback');
      sprite.textContent = cls.icon;
    }

    // ── Name + flavour ──────────────────────────────────────────────────────
    const nameWrap = document.createElement('div');

    const nameEl = document.createElement('div');
    nameEl.className   = 'cs-card-name';
    nameEl.textContent = cls.name.toUpperCase();

    const flavourEl = document.createElement('div');
    flavourEl.className   = 'cs-card-flavour';
    flavourEl.textContent = cls.flavour;

    nameWrap.append(nameEl, flavourEl);

    // ── Top row: sprite + name ──────────────────────────────────────────────
    const topRow = document.createElement('div');
    topRow.className = 'cs-card-top';
    topRow.append(sprite, nameWrap);

    // ── Divider ─────────────────────────────────────────────────────────────
    const div = document.createElement('div');
    div.className = 'cs-card-divider';

    // ── Description ─────────────────────────────────────────────────────────
    const desc = document.createElement('div');
    desc.className   = 'cs-card-desc';
    desc.textContent = cls.description;

    // ── Category weight tags ────────────────────────────────────────────────
    const tags = document.createElement('div');
    tags.className = 'cs-card-tags';
    Object.entries(cls.categoryWeights)
      .filter(([, w]) => (w ?? 0) >= 2)
      .forEach(([cat, w]) => {
        const tag = document.createElement('span');
        tag.className   = 'cs-card-tag';
        tag.textContent = cat + ' \xd7' + (w ?? 1);
        tags.appendChild(tag);
      });

    // ── Per-class run stats ─────────────────────────────────────────────────
    const runs    = this.classRunCounts[cls.id] ?? 0;
    const avgFloor = this.classAvgFloors[cls.id] ?? 0;

    const bestEl = document.createElement('div');
    bestEl.className = 'cs-card-best';
    if (runs > 0) {
      bestEl.innerHTML =
        runs + ' run' + (runs !== 1 ? 's' : '') +
        ' \u00b7 avg fl. <span>' + avgFloor + '</span>';
    }
    // Empty if no runs — element still exists but renders nothing

    card.append(topRow, div, desc, tags, bestEl);

    card.addEventListener('click', () => {
      card.classList.add('is-selected');
      setTimeout(() => startRun({ modeId: this.modeId, classId: cls.id }), 80);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.add('is-selected');
        setTimeout(() => startRun({ modeId: this.modeId, classId: cls.id }), 80);
      }
    });

    return card;
  }
}

function intToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}