/**
 * RunConfig — per-run choices passed between scenes.
 * Set by ModeRunner (or ClassScene) before GameScene starts.
 */
import { GameModeRules, getDefaultRules } from './modes/GameModeConfig';

export interface RunConfig {
  classId:   string;
  modeId:    string;
  rules:     GameModeRules;
  startTime: number;
}

let _config: RunConfig = {
  classId:   '',
  modeId:    'classic',
  rules:     getDefaultRules(),
  startTime: 0,
};

export function setRunConfig(config: Partial<RunConfig>): void {
  _config = { ..._config, ...config };
}

export function getRunConfig(): Readonly<RunConfig> {
  return _config;
}
