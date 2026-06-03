import { IRunHistoryService, RunResultDTO } from '../types';

const SAVE_KEY  = 'roguelite_runs_v1';
const MAX_RUNS  = 50;   // cap to avoid localStorage bloat

interface StoredHistory {
  schema_version: number;
  runs: RunResultDTO[];
}

const SCHEMA_VERSION = 1;

export class LocalRunHistoryService implements IRunHistoryService {

  addRun(run: RunResultDTO): void {
    const history = this.load();
    // Newest first
    history.unshift(run);
    if (history.length > MAX_RUNS) history.length = MAX_RUNS;
    this.save(history);
  }

  getRecentRuns(limit = 20): RunResultDTO[] {
    return this.load().slice(0, limit);
  }

  clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private load(): RunResultDTO[] {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return [];
      const stored = JSON.parse(raw) as Partial<StoredHistory>;
      if (stored.schema_version !== SCHEMA_VERSION) return [];
      return stored.runs ?? [];
    } catch {
      return [];
    }
  }

  private save(runs: RunResultDTO[]): void {
    try {
      const stored: StoredHistory = { schema_version: SCHEMA_VERSION, runs };
      localStorage.setItem(SAVE_KEY, JSON.stringify(stored));
    } catch (e) {
      console.warn('[LocalRunHistoryService] save failed:', e);
    }
  }
}
