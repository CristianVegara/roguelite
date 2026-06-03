import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';
import { ServiceLocator }          from '../services/ServiceLocator';
import { LocalProfileService }     from '../services/local/LocalProfileService';

/**
 * NameEntryScene — first-launch experience.
 *
 * Shown by BootScene when no player profile exists.
 * Creates a native <input> element positioned over the canvas so the player
 * can type freely without Phaser keyboard event conflicts.
 *
 * On submit: creates the profile → routes to HomeScene.
 */
export class NameEntryScene extends Phaser.Scene {
  private inputEl:   HTMLInputElement | null = null;
  private errorText!: Phaser.GameObjects.Text;
  private beginZone!: Phaser.GameObjects.Zone;
  private beginBg!:   Phaser.GameObjects.Graphics;
  private beginLabel!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'NameEntryScene' }); }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.drawBackground();
    this.drawTitle();
    this.createDomInput();
    this.drawForm();
    this.drawBeginButton();
    this.bindKeys();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeDomInput());
  }

  // ---------------------------------------------------------------------------
  // Background & title
  // ---------------------------------------------------------------------------

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(0x080812);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle top accent
    g.fillStyle(0x0c0c1e);
    g.fillRect(0, 0, GAME_WIDTH, 3);
  }

  private drawTitle(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.20, 'THE SPIRE AWAITS', {
      fontSize: '22px', color: '#c0c0d8',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.20 + 32, 'What do they call you?', {
      fontSize: '12px', color: '#555577', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  // ---------------------------------------------------------------------------
  // Native <input> element
  // ---------------------------------------------------------------------------

  private createDomInput(): void {
    const canvas = this.game.canvas;
    const rect   = canvas.getBoundingClientRect();
    const cx     = rect.left + rect.width  / 2;
    const cy     = rect.top  + rect.height * 0.45;

    this.inputEl = document.createElement('input');
    this.inputEl.type        = 'text';
    this.inputEl.maxLength   = 16;
    this.inputEl.placeholder = 'Your name…';
    this.inputEl.autocomplete = 'off';
    this.inputEl.spellcheck  = false;

    Object.assign(this.inputEl.style, {
      position:        'fixed',
      left:            `${cx}px`,
      top:             `${cy}px`,
      transform:       'translate(-50%, -50%)',
      width:           '220px',
      padding:         '10px 14px',
      fontFamily:      'monospace',
      fontSize:        '16px',
      letterSpacing:   '1px',
      textAlign:       'center',
      background:      '#0c0c1e',
      color:           '#e0e0e0',
      border:          '1px solid #252540',
      borderRadius:    '6px',
      outline:         'none',
      boxSizing:       'border-box',
      zIndex:          '10',
    });

    // Live border feedback
    this.inputEl.addEventListener('focus', () => {
      this.inputEl!.style.borderColor = '#4fc3f7';
    });
    this.inputEl.addEventListener('blur', () => {
      this.inputEl!.style.borderColor = '#252540';
    });
    this.inputEl.addEventListener('input', () => {
      this.errorText?.setText('');
      this.inputEl!.style.borderColor = '#4fc3f7';
    });

    document.body.appendChild(this.inputEl);
    this.inputEl.focus();
  }

  private removeDomInput(): void {
    if (this.inputEl?.parentNode) {
      this.inputEl.parentNode.removeChild(this.inputEl);
    }
    this.inputEl = null;
  }

  // ---------------------------------------------------------------------------
  // Form labels
  // ---------------------------------------------------------------------------

  private drawForm(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.45 + 38, '2–16 characters  ·  letters, numbers, hyphens', {
      fontSize: '9px', color: '#333355', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.errorText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.45 + 58, '', {
      fontSize: '10px', color: '#e74c3c', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  // ---------------------------------------------------------------------------
  // BEGIN button
  // ---------------------------------------------------------------------------

  private drawBeginButton(): void {
    const bx = GAME_WIDTH / 2;
    const by = GAME_HEIGHT * 0.60;
    const bw = 160, bh = 44;

    this.beginBg = this.add.graphics();
    const drawDefault = () => {
      this.beginBg.clear();
      this.beginBg.fillStyle(0x0e1e36);
      this.beginBg.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
      this.beginBg.lineStyle(2, 0x4fc3f7);
      this.beginBg.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
    };
    const drawHover = () => {
      this.beginBg.clear();
      this.beginBg.fillStyle(0x162a50);
      this.beginBg.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
      this.beginBg.lineStyle(2, 0x7de8ff);
      this.beginBg.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
    };
    drawDefault();

    this.beginLabel = this.add.text(bx, by, 'BEGIN', {
      fontSize: '15px', color: '#4fc3f7',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.beginZone = this.add.zone(bx, by, bw, bh).setInteractive({ cursor: 'pointer' });
    this.beginZone.on('pointerover',  drawHover);
    this.beginZone.on('pointerout',   drawDefault);
    this.beginZone.on('pointerdown',  () => this.submit());

    // Flavour
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.73, '"Every legend started here."', {
      fontSize: '10px', color: '#222244',
      fontFamily: 'monospace', fontStyle: 'italic',
    }).setOrigin(0.5);
  }

  // ---------------------------------------------------------------------------
  // Submission
  // ---------------------------------------------------------------------------

  private bindKeys(): void {
    this.input.keyboard?.on('keydown-ENTER', () => this.submit());
  }

  private submit(): void {
    const raw   = this.inputEl?.value ?? '';
    const error = LocalProfileService.validateName(raw);

    if (error) {
      this.errorText.setText(error);
      if (this.inputEl) {
        this.inputEl.style.borderColor = '#e74c3c';
        this.inputEl.focus();
      }
      // Shake the button for visual feedback
      this.tweens.add({
        targets: [this.beginLabel, this.beginBg],
        x: '+=5', duration: 40, yoyo: true, repeat: 3, ease: 'Power1',
      });
      return;
    }

    // Create profile and transition
    ServiceLocator.profile.createProfile(raw.trim());

    this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, progress: number) => {
      if (progress === 1) this.scene.start('HomeScene');
    });
  }
}
