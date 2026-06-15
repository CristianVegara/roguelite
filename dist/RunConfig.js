/**
 * RunConfig — per-run choices passed between scenes.
 * Set by ModeRunner (or ClassScene) before GameScene starts.
 */
import { getDefaultRules } from './modes/GameModeConfig';
let _config = {
    classId: '',
    modeId: 'classic',
    rules: getDefaultRules(),
    startTime: 0,
};
export function setRunConfig(config) {
    _config = { ..._config, ...config };
}
export function getRunConfig() {
    return _config;
}
