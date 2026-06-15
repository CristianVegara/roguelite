/**
 * services/types.ts
 *
 * Data Transfer Objects and Service Interfaces for the platform layer.
 *
 * Architecture principle: all game code depends only on these interfaces,
 * never on a concrete implementation. When a real backend arrives, only the
 * concrete services in /local/ (or /remote/) change — nothing in game logic.
 */
// ---------------------------------------------------------------------------
// DTO: PlayerProfile
// ---------------------------------------------------------------------------
export const PROFILE_SCHEMA_VERSION = 1;
export const ALL_MILESTONES = [
    {
        id: 'first_steps',
        title: 'First Steps',
        description: 'Complete your first run',
        check: (p) => p.total_runs >= 1,
    },
    {
        id: 'floor_20',
        title: 'Climber',
        description: 'Reach Floor 20',
        check: (p) => p.highest_floor >= 20,
    },
    {
        id: 'floor_40',
        title: 'High Ascent',
        description: 'Reach Floor 40',
        check: (p) => p.highest_floor >= 40,
    },
    {
        id: 'boss_slayer',
        title: 'Boss Slayer',
        description: 'Defeat 10 bosses across all runs',
        check: (p) => p.total_bosses_killed >= 10,
    },
    {
        id: 'veteran',
        title: 'Veteran',
        description: 'Complete 25 runs',
        check: (p) => p.total_runs >= 25,
    },
    {
        id: 'speed_demon',
        title: 'Speed Demon',
        description: 'Complete a run in under 5 minutes',
        check: (_p, run) => !!run && run.duration_ms < 300000 && run.floor_reached >= 5,
    },
    {
        id: 'devoted',
        title: 'Devoted',
        description: 'Maintain a 7-day play streak',
        check: (p) => p.best_streak >= 7,
    },
    {
        id: 'damage_dealer',
        title: 'Damage Dealer',
        description: 'Deal 500,000 total damage across all runs',
        check: (p) => p.total_damage_dealt >= 500000,
    },
    {
        id: 'classic_conqueror',
        title: 'Conqueror of the Classic',
        description: 'Complete Classic Mode by clearing Floor 100',
        check: (_p, run) => run?.mode_id === 'classic' && run?.won === true,
    },
];
