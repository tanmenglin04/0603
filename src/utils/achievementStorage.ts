import type { AchievementSaveData, AchievementStats, AchievementTier } from '../types';

const ACHIEVEMENT_STORAGE_KEY = 'rune-chess-achievements';

const defaultStats: AchievementStats = {
  runesEliminated: { fire: 0, water: 0, grass: 0, thunder: 0 },
  spellsCast: {},
  comboSpellsCast: {},
  enemiesKilled: {},
  equipmentAcquired: { common: 0, rare: 0, epic: 0, legendary: 0 },
  totalBattlesWon: 0,
  totalTowerFloorsCleared: 0,
  totalPVPWins: 0,
};

const defaultSaveData: AchievementSaveData = {
  stats: { ...defaultStats },
  progress: {},
  unlockedRewards: [],
  equippedAvatarFrame: null,
  equippedBoardSkin: null,
  equippedRuneEffect: null,
  medalBalance: { bronze: 0, silver: 0, gold: 0 },
  unlockedTitles: [],
  equippedTitle: null,
};

export const loadAchievementSave = (): AchievementSaveData => {
  try {
    const data = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        ...defaultSaveData,
        ...parsed,
        stats: { ...defaultStats, ...parsed.stats },
        medalBalance: { ...defaultSaveData.medalBalance, ...parsed.medalBalance },
      };
    }
  } catch (error) {
    console.error('Failed to load achievement data:', error);
  }
  return JSON.parse(JSON.stringify(defaultSaveData));
};

export const saveAchievementSave = (data: AchievementSaveData): void => {
  try {
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save achievement data:', error);
  }
};

let _pendingFlush: ReturnType<typeof setTimeout> | null = null;
let _cachedData: AchievementSaveData | null = null;

const flushToStorage = () => {
  if (_cachedData) {
    saveAchievementSave(_cachedData);
  }
  _pendingFlush = null;
};

export const getAchievementData = (): AchievementSaveData => {
  if (!_cachedData) {
    _cachedData = loadAchievementSave();
  }
  return _cachedData;
};

export const updateAchievementStats = (updater: (stats: AchievementStats) => void): void => {
  const data = getAchievementData();
  updater(data.stats);
  _cachedData = data;

  if (!_pendingFlush) {
    _pendingFlush = setTimeout(flushToStorage, 500);
  }
};

export const addMedals = (tier: AchievementTier, count: number): void => {
  const data = getAchievementData();
  data.medalBalance[tier] += count;
  _cachedData = data;
  if (!_pendingFlush) {
    _pendingFlush = setTimeout(flushToStorage, 500);
  }
};

export const spendMedals = (costs: Record<AchievementTier, number>): boolean => {
  const data = getAchievementData();
  for (const [tier, cost] of Object.entries(costs)) {
    if (data.medalBalance[tier as AchievementTier] < cost) return false;
  }
  for (const [tier, cost] of Object.entries(costs)) {
    data.medalBalance[tier as AchievementTier] -= cost;
  }
  _cachedData = data;
  saveAchievementSave(data);
  return true;
};

export const unlockReward = (rewardId: string): void => {
  const data = getAchievementData();
  if (!data.unlockedRewards.includes(rewardId)) {
    data.unlockedRewards.push(rewardId);
    _cachedData = data;
    saveAchievementSave(data);
  }
};

export const equipCosmetic = (type: 'avatar_frame' | 'board_skin' | 'rune_effect', rewardId: string | null): void => {
  const data = getAchievementData();
  if (type === 'avatar_frame') data.equippedAvatarFrame = rewardId;
  else if (type === 'board_skin') data.equippedBoardSkin = rewardId;
  else if (type === 'rune_effect') data.equippedRuneEffect = rewardId;
  _cachedData = data;
  saveAchievementSave(data);
};

export const flushAchievementData = (): void => {
  if (_pendingFlush) {
    clearTimeout(_pendingFlush);
    _pendingFlush = null;
  }
  flushToStorage();
};

export const invalidateAchievementCache = (): void => {
  _cachedData = null;
};

export const unlockTitle = (titleId: string): void => {
  const data = getAchievementData();
  if (!data.unlockedTitles.includes(titleId)) {
    data.unlockedTitles.push(titleId);
    _cachedData = data;
    saveAchievementSave(data);
  }
};

export const equipTitle = (titleId: string | null): void => {
  const data = getAchievementData();
  data.equippedTitle = titleId;
  _cachedData = data;
  saveAchievementSave(data);
};
