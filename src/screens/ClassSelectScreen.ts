/**
 * ClassSelectScreen.ts — HTML replacement for ClassScene.
 *
 * Registered with the router under 'class-select'.
 * Receives { modeId } from router params (set by HomeScreen mode card click).
 *
 * On class card click: calls startRun({ classId, modeId }).
 * Back button / ESC: router.back().
 */

import { ALL_CLASSES, ClassDefinition } from '../data/ClassDefinition';
import { router }                        from '../router/Router';
import { startRun }                      from '../bridge/startRun';
import { ModeId }                        from '../modes/GameModeConfig';

// ---------------------------------------------------------------------------
// Factory — registered with the router
// ---------------------------------------------------------------------------

export function createClassSelectScreen(params: Record<string, unknown>): HTMLElement {
  const modeId = (params['modeId'] as ModeId) ?? 'classic';
  return new ClassSelectScreen(modeId).el;
}

// ---------------------------------------------------------------------------
// ClassSelectScreen class
// ---------------------------------------------------------------------------

class ClassSelectScreen {
  readonly el: HTMLElement;

  constructor(private readonly modeId: ModeId) {
    this.el = this.build();
  }

  private build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cs-screen';

    root.append(
      this.buildHeader(),
      this.buildGrid(),
    );

    // ESC / B → back (but never during combat — listener may outlive this screen)
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
    back.textContent = '← BACK';
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

    ALL_CLASSES.forEach(cls => {
      grid.appendChild(this.buildCard(cls));
    });

    return grid;
  }

  private buildCard(cls: ClassDefinition): HTMLElement {
    const card = document.createElement('div');
    card.className = 'cs-card';
    card.style.setProperty('--cls-color', intToHex(cls.color));

    // Icon + name row
    const topRow = document.createElement('div');
    topRow.className = 'cs-card-top';

    const icon = document.createElement('span');
    icon.className   = 'cs-card-icon';
    icon.textContent = cls.icon;

    const nameWrap = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className   = 'cs-card-name';
    nameEl.textContent = cls.name.toUpperCase();

    const flavourEl = document.createElement('div');
    flavourEl.className   = 'cs-card-flavour';
    flavourEl.textContent = cls.flavour;

    nameWrap.append(nameEl, flavourEl);
    topRow.append(icon, nameWrap);

    // Divider
    const div = document.createElement('div');
    div.className = 'cs-card-divider';

    // Description
    const desc = document.createElement('div');
    desc.className   = 'cs-card-desc';
    desc.textContent = cls.description;

    // Category weight tags
    const tags = document.createElement('div');
    tags.className = 'cs-card-tags';
    Object.entries(cls.categoryWeights)
      .filter(([, w]) => (w ?? 0) >= 2)
      .forEach(([cat, w]) => {
        const tag = document.createElement('span');
        tag.className   = 'cs-card-tag';
        tag.textContent = `${cat} ×${w ?? 1}`;
        tags.appendChild(tag);
      });

    card.append(topRow, div, desc, tags);

    card.addEventListener('click', () => {
      card.classList.add('is-selected');
      // Small delay for the visual press, then start the run
      setTimeout(() => {
        startRun({ modeId: this.modeId, classId: cls.id });
      }, 100);
    });

    return card;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
