import type {
  BattleReplayV2,
  ReplayListEntry,
  ReplayStorageStats,
} from '../types';
import {
  encodeCompressedReplay,
  decodeCompressedReplay,
  estimateReplaySize,
} from './battleRecorder';
import { detectHighlights } from './highlightDetector';

const STORAGE_PREFIX = 'battle_replay_v2_';
const INDEX_KEY = 'battle_replay_index_v2';
const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_REPLAYS = 50;
const AUTO_PRUNE_THRESHOLD = 40;

interface ReplayIndexEntry {
  battleId: string;
  fileName: string;
  levelId: number;
  levelName: string;
  enemyName: string;
  result: 'victory' | 'defeat';
  totalTurns: number;
  durationMs: number;
  recordedAt: number;
  fileSize: number;
  hasHighlights: boolean;
  highlightCount: number;
}

interface ReplayIndexData {
  entries: ReplayIndexEntry[];
  version: 'v2';
  updatedAt: number;
}

const loadIndex = (): ReplayIndexData => {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) {
      return { entries: [], version: 'v2', updatedAt: Date.now() };
    }
    const parsed = JSON.parse(raw);
    if (parsed.version !== 'v2') {
      return { entries: [], version: 'v2', updatedAt: Date.now() };
    }
    return parsed;
  } catch {
    return { entries: [], version: 'v2', updatedAt: Date.now() };
  }
};

const saveIndex = (index: ReplayIndexData): void => {
  try {
    index.updatedAt = Date.now();
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {}
};

const getStorageKey = (battleId: string): string => {
  return `${STORAGE_PREFIX}${battleId}`;
};

const pruneOldReplaysIfNeeded = (index: ReplayIndexData, newSizeBytes: number): void => {
  let totalSize = index.entries.reduce((sum, e) => sum + e.fileSize, 0) + newSizeBytes;
  let count = index.entries.length;

  while (
    (totalSize > MAX_TOTAL_SIZE_BYTES || count > AUTO_PRUNE_THRESHOLD) &&
    index.entries.length > 0
  ) {
    const sorted = [...index.entries].sort((a, b) => a.recordedAt - b.recordedAt);
    const oldest = sorted[0];
    try {
      localStorage.removeItem(getStorageKey(oldest.battleId));
    } catch {}
    const idx = index.entries.findIndex((e) => e.battleId === oldest.battleId);
    if (idx >= 0) {
      totalSize -= index.entries[idx].fileSize;
      count -= 1;
      index.entries.splice(idx, 1);
    } else {
      break;
    }
  }
};

export const saveReplay = (replay: BattleReplayV2): boolean => {
  try {
    const replayWithHighlights: BattleReplayV2 = {
      ...replay,
      highlights: replay.highlights.length > 0 ? replay.highlights : detectHighlights(replay),
    };

    const encoded = encodeCompressedReplay(replayWithHighlights);
    const size = estimateReplaySize(replayWithHighlights);

    const index = loadIndex();
    pruneOldReplaysIfNeeded(index, size);

    const key = getStorageKey(replay.battleId);
    localStorage.setItem(key, encoded);

    const entry: ReplayIndexEntry = {
      battleId: replay.battleId,
      fileName: key,
      levelId: replay.levelId,
      levelName: replay.levelName,
      enemyName: replay.enemyName,
      result: replay.result,
      totalTurns: replay.totalTurns,
      durationMs: replay.durationMs,
      recordedAt: replay.endedAt,
      fileSize: size,
      hasHighlights: replayWithHighlights.highlights.length > 0,
      highlightCount: replayWithHighlights.highlights.length,
    };

    const existingIdx = index.entries.findIndex((e) => e.battleId === replay.battleId);
    if (existingIdx >= 0) {
      index.entries[existingIdx] = entry;
    } else {
      index.entries.push(entry);
    }

    if (index.entries.length > MAX_REPLAYS) {
      const sorted = [...index.entries].sort((a, b) => a.recordedAt - b.recordedAt);
      const excess = sorted.slice(0, index.entries.length - MAX_REPLAYS);
      excess.forEach((e) => {
        try {
          localStorage.removeItem(getStorageKey(e.battleId));
        } catch {}
        const idx = index.entries.findIndex((x) => x.battleId === e.battleId);
        if (idx >= 0) index.entries.splice(idx, 1);
      });
    }

    saveIndex(index);
    return true;
  } catch {
    return false;
  }
};

export const loadReplay = (battleId: string): BattleReplayV2 | null => {
  try {
    const key = getStorageKey(battleId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const replay = decodeCompressedReplay(raw);
    if (!replay) return null;
    if (replay.highlights.length === 0) {
      replay.highlights = detectHighlights(replay);
    }
    return replay;
  } catch {
    return null;
  }
};

export const deleteReplay = (battleId: string): boolean => {
  try {
    localStorage.removeItem(getStorageKey(battleId));
    const index = loadIndex();
    const idx = index.entries.findIndex((e) => e.battleId === battleId);
    if (idx >= 0) {
      index.entries.splice(idx, 1);
      saveIndex(index);
    }
    return true;
  } catch {
    return false;
  }
};

export const listReplays = (
  options: {
    limit?: number;
    levelId?: number;
    result?: 'victory' | 'defeat';
    onlyHighlights?: boolean;
    sortBy?: 'date' | 'duration' | 'turns';
    sortOrder?: 'asc' | 'desc';
  } = {}
): ReplayListEntry[] => {
  const index = loadIndex();
  let entries = [...index.entries];

  if (options.levelId !== undefined) {
    entries = entries.filter((e) => e.levelId === options.levelId);
  }
  if (options.result) {
    entries = entries.filter((e) => e.result === options.result);
  }
  if (options.onlyHighlights) {
    entries = entries.filter((e) => e.hasHighlights);
  }

  const sortBy = options.sortBy || 'date';
  const sortOrder = options.sortOrder || 'desc';
  entries.sort((a, b) => {
    let diff = 0;
    switch (sortBy) {
      case 'duration':
        diff = a.durationMs - b.durationMs;
        break;
      case 'turns':
        diff = a.totalTurns - b.totalTurns;
        break;
      case 'date':
      default:
        diff = a.recordedAt - b.recordedAt;
        break;
    }
    return sortOrder === 'desc' ? -diff : diff;
  });

  if (options.limit) {
    entries = entries.slice(0, options.limit);
  }

  return entries.map(
    (e): ReplayListEntry => ({
      battleId: e.battleId,
      levelId: e.levelId,
      levelName: e.levelName,
      enemyName: e.enemyName,
      result: e.result,
      totalTurns: e.totalTurns,
      durationMs: e.durationMs,
      recordedAt: e.recordedAt,
      fileSize: e.fileSize,
      hasHighlights: e.hasHighlights,
      highlightCount: e.highlightCount,
    })
  );
};

export const getReplayStorageStats = (): ReplayStorageStats => {
  const index = loadIndex();
  const totalSizeBytes = index.entries.reduce((sum, e) => sum + e.fileSize, 0);
  const dates = index.entries.map((e) => e.recordedAt).sort((a, b) => a - b);

  return {
    totalReplays: index.entries.length,
    totalSizeBytes,
    totalSizeMB: (totalSizeBytes / (1024 * 1024)).toFixed(2),
    oldestReplayDate: dates.length > 0 ? dates[0] : null,
    newestReplayDate: dates.length > 0 ? dates[dates.length - 1] : null,
  };
};

export const clearOldReplays = (olderThanDays: number): number => {
  const threshold = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const index = loadIndex();
  const toDelete = index.entries.filter((e) => e.recordedAt < threshold);
  let deleted = 0;

  toDelete.forEach((e) => {
    try {
      localStorage.removeItem(getStorageKey(e.battleId));
      deleted++;
    } catch {}
  });

  index.entries = index.entries.filter((e) => e.recordedAt >= threshold);
  saveIndex(index);
  return deleted;
};

export const clearAllReplays = (): number => {
  const index = loadIndex();
  const count = index.entries.length;

  index.entries.forEach((e) => {
    try {
      localStorage.removeItem(getStorageKey(e.battleId));
    } catch {}
  });

  saveIndex({ entries: [], version: 'v2', updatedAt: Date.now() });
  return count;
};

export const replayExists = (battleId: string): boolean => {
  const index = loadIndex();
  return index.entries.some((e) => e.battleId === battleId);
};
