/**
 * NameEntryScreen.ts — HTML replacement for NameEntryScene.
 *
 * Registered with the router under 'name-entry'.
 * On submit: ServiceLocator.profile.createProfile(name) → router.navigate('home').
 *
 * CHANGES:
 *   - Added inputmode="text" + enterkeyhint="done" for mobile keyboard UX
 *   - Added live character counter (N/16) next to hint text
 *   - Added context-aware subtitle: "rename" vs first-time flow
 *   - flavour text hidden on rename context
 */

import { ServiceLocator }        from '../services/ServiceLocator';
import { LocalProfileService }   from '../services/local/LocalProfileService';
import { router }                from '../router/Router';

// ---------------------------------------------------------------------------
// Factory — registered with the router
// ---------------------------------------------------------------------------

export function createNameEntryScreen(): HTMLElement {
  // Rename context is passed via sessionStorage to avoid router params type
  // constraints. HomeScreen sets 'rename' before navigating; we clear it here.
  const isRename = sessionStorage.getItem('nameEntryContext') === 'rename';
  sessionStorage.removeItem('nameEntryContext');
  return new NameEntryScreen(isRename).el;
}

// ---------------------------------------------------------------------------
// NameEntryScreen class
// ---------------------------------------------------------------------------

class NameEntryScreen {
  readonly el:      HTMLElement;
  private input!:   HTMLInputElement;
  private errorEl!: HTMLElement;
  private charCountEl!: HTMLElement;
  private readonly isRename: boolean;

  constructor(isRename = false) {
    this.isRename = isRename;
    this.el = this.build();
    requestAnimationFrame(() => this.input.focus());
  }

  private build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'ne-screen';

    const title = document.createElement('div');
    title.className   = 'ne-title';
    title.textContent = this.isRename ? 'CHANGE YOUR NAME' : 'THE SPIRE AWAITS';

    const sub = document.createElement('div');
    sub.className   = 'ne-subtitle';
    // FIX: context-aware subtitle text
    sub.textContent = this.isRename
      ? 'Enter a new display name'
      : 'What do they call you?';

    const form = this.buildForm();

    root.append(title, sub, form);

    // FIX: Flavour text only shown on first-time entry, not rename
    if (!this.isRename) {
      const flavour = document.createElement('div');
      flavour.className   = 'ne-flavour';
      flavour.textContent = '"Every legend started here."';
      root.appendChild(flavour);
    }

    return root;
  }

  private buildForm(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'ne-form';

    this.input = document.createElement('input');
    this.input.type         = 'text';
    this.input.maxLength    = 16;
    this.input.placeholder  = 'Your name…';
    this.input.autocomplete = 'username';
    this.input.spellcheck   = false;
    this.input.className    = 'ne-input';
    this.input.setAttribute('inputmode',       'text');
    this.input.setAttribute('enterkeyhint',    'done');
    this.input.setAttribute('autocorrect',     'off');
    this.input.setAttribute('autocapitalize',  'off');
    // Accessibility: associate input with hint and error via IDs
    this.input.setAttribute('aria-label',      'Player name');
    this.input.setAttribute('aria-describedby','ne-hint ne-error');
    this.input.setAttribute('aria-required',   'true');

    // Hint row: hint text + character counter
    const hintRow = document.createElement('div');
    hintRow.className = 'ne-hint-row';

    const hint = document.createElement('div');
    hint.id          = 'ne-hint';
    hint.className   = 'ne-hint';
    hint.textContent = '2–16 characters  ·  letters, numbers, hyphens';

    this.charCountEl = document.createElement('div');
    this.charCountEl.className   = 'ne-char-count';
    this.charCountEl.textContent = '0/16';
    this.charCountEl.setAttribute('aria-live', 'polite');

    hintRow.append(hint, this.charCountEl);

    this.errorEl = document.createElement('div');
    this.errorEl.id        = 'ne-error';
    this.errorEl.className = 'ne-error';
    this.errorEl.setAttribute('aria-live', 'assertive');
    this.errorEl.setAttribute('role',      'alert');

    const btn = document.createElement('button');
    btn.className   = 'ne-begin-btn';
    btn.textContent = this.isRename ? 'SAVE' : 'BEGIN';
    btn.addEventListener('click', () => this.submit());

    this.input.addEventListener('input', () => {
      // Clear error on new input
      this.errorEl.textContent = '';
      this.input.classList.remove('is-error');
      // FIX: update character counter
      const len = this.input.value.length;
      this.charCountEl.textContent = `${len}/16`;
      // Visual warning when approaching limit
      this.charCountEl.classList.toggle('is-near-limit', len >= 14);
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit();
    });

    wrap.append(this.input, hintRow, this.errorEl, btn);
    return wrap;
  }

  private submit(): void {
    const raw   = this.input.value;
    const error = LocalProfileService.validateName(raw);

    if (error) {
      this.errorEl.textContent = error;
      this.input.classList.add('is-error');
      this.input.focus();
      this.input.classList.add('is-shake');
      setTimeout(() => this.input.classList.remove('is-shake'), 400);
      return;
    }

    ServiceLocator.profile.createProfile(raw.trim());
    router.navigate('home');
  }
}