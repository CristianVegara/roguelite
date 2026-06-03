/**
 * NameEntryScreen.ts — HTML replacement for NameEntryScene.
 *
 * Registered with the router under 'name-entry'.
 * On submit: ServiceLocator.profile.createProfile(name) → router.navigate('home').
 */

import { ServiceLocator }        from '../services/ServiceLocator';
import { LocalProfileService }   from '../services/local/LocalProfileService';
import { router }                from '../router/Router';

// ---------------------------------------------------------------------------
// Factory — registered with the router
// ---------------------------------------------------------------------------

export function createNameEntryScreen(): HTMLElement {
  return new NameEntryScreen().el;
}

// ---------------------------------------------------------------------------
// NameEntryScreen class
// ---------------------------------------------------------------------------

class NameEntryScreen {
  readonly el:     HTMLElement;
  private input!:  HTMLInputElement;
  private errorEl!: HTMLElement;

  constructor() {
    this.el = this.build();
    // Focus the input after mount
    requestAnimationFrame(() => this.input.focus());
  }

  private build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'ne-screen';

    const title = document.createElement('div');
    title.className   = 'ne-title';
    title.textContent = 'THE SPIRE AWAITS';

    const sub = document.createElement('div');
    sub.className   = 'ne-subtitle';
    sub.textContent = 'What do they call you?';

    const form = this.buildForm();

    const flavour = document.createElement('div');
    flavour.className   = 'ne-flavour';
    flavour.textContent = '"Every legend started here."';

    root.append(title, sub, form, flavour);
    return root;
  }

  private buildForm(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'ne-form';

    this.input = document.createElement('input');
    this.input.type         = 'text';
    this.input.maxLength    = 16;
    this.input.placeholder  = 'Your name…';
    this.input.autocomplete = 'off';
    this.input.spellcheck   = false;
    this.input.className    = 'ne-input';

    this.input.addEventListener('input', () => {
      this.errorEl.textContent = '';
      this.input.classList.remove('is-error');
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit();
    });

    const hint = document.createElement('div');
    hint.className   = 'ne-hint';
    hint.textContent = '2–16 characters  ·  letters, numbers, hyphens';

    this.errorEl = document.createElement('div');
    this.errorEl.className = 'ne-error';

    const btn = document.createElement('button');
    btn.className   = 'ne-begin-btn';
    btn.textContent = 'BEGIN';
    btn.addEventListener('click', () => this.submit());

    wrap.append(this.input, hint, this.errorEl, btn);
    return wrap;
  }

  private submit(): void {
    const raw   = this.input.value;
    const error = LocalProfileService.validateName(raw);

    if (error) {
      this.errorEl.textContent = error;
      this.input.classList.add('is-error');
      this.input.focus();
      // Shake animation via class toggle
      this.input.classList.add('is-shake');
      setTimeout(() => this.input.classList.remove('is-shake'), 400);
      return;
    }

    ServiceLocator.profile.createProfile(raw.trim());
    router.navigate('home');
  }
}
