/**
 * ModeRunner — the single entry point for starting any game mode.
 *
 * Called from HomeScene mode cards.
 * Decides whether to route through ClassScene (player picks class)
 * or jump directly to GameScene (mode forces/randomises the class).
 */
import Phaser from 'phaser';
import { ModeId, getModeById } from './GameModeConfig';
import { ALL_CLASSES }         from '../data/ClassDefinition';
import { setRunConfig }        from '../RunConfig';

export class ModeRunner {
  /**
   * Start a run for the given mode from the hub.
   *
   * @param scene    The calling Phaser scene (used for scene.start())
   * @param modeId   Which mode to launch
   */
  static start(scene: Phaser.Scene, modeId: ModeId): void {
    const mode = getModeById(modeId);

    if (mode.rules.forceRandomClass) {
      // Pick a random class — skip ClassScene
      const cls = ALL_CLASSES[Math.floor(Math.random() * ALL_CLASSES.length)];
      setRunConfig({
        classId:   cls.id,
        modeId,
        rules:     mode.rules,
        startTime: Date.now(),
      });
      scene.scene.start('GameScene');

    } else {
      // Player chooses class — route through ClassScene
      setRunConfig({
        classId:   '',            // ClassScene will fill this in
        modeId,
        rules:     mode.rules,
        startTime: Date.now(),
      });
      scene.scene.start('ClassScene');
    }
  }
}
