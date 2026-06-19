import type {
  BattlePassSaveData,
  BattlePassSeason,
  QuestProgress,
  QuestDefinition,
  AchievementStats,
  QuestType,
} from '../types';
import {
  BATTLE_PASS_SEASON_DAYS,
  BATTLE_PASS_MAX_LEVEL,
  BATTLE_PASS_EXP_PER_LEVEL,
  DAILY_QUEST_COUNT,
  WEEKLY_QUEST_COUNT,
  DAILY_QUEST_POOL,
  WEEKLY_QUEST_POOL,
} from '../types';

const BATTLE_PASS_STORAGE_KEY = 'rune-chess-battlepass';

const getStartOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const getStartOfWeek = (timestamp: number): number => {
  const date = new Date(timestamp);
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

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

const defaultSaveData: BattlePassSaveData = {
  currentSeasonId: null,
  level: 1,
  currentExp: 0,
  totalExpEarned: 0,
  premiumUnlocked: false,
  claimedLevels: [],
  dailyQuests: [],
  weeklyQuests: [],
  lastDailyRefresh: 0,
  lastWeeklyRefresh: 0,
  seasonStartStats: null,
};

export const generateSeasonId = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const weekNum = Math.ceil(now.getDate() / 7);
  return `bp_${year}_${month}_w${weekNum}`;
};

export const getCurrentSeason = (): BattlePassSeason => {
  const now = Date.now();
  const startOfSeason = getStartOfWeek(now);
  const endDate = startOfSeason + BATTLE_PASS_SEASON_DAYS * 24 * 60 * 60 * 1000;
  const seasonNumber = Math.floor((now - new Date('2024-01-01').getTime()) / (BATTLE_PASS_SEASON_DAYS * 24 * 60 * 60 * 1000)) + 1;

  return {
    seasonId: generateSeasonId(),
    seasonNumber,
    name: `第 ${seasonNumber} 赛季`,
    startDate: startOfSeason,
    endDate,
    isActive: true,
    maxLevel: BATTLE_PASS_MAX_LEVEL,
    expPerLevel: BATTLE_PASS_EXP_PER_LEVEL,
    description: '完成任务获取经验，解锁丰厚奖励！',
  };
};

const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const generateRandomQuests = (
  pool: QuestDefinition[],
  count: number,
  type: QuestType,
  stats: AchievementStats
): QuestProgress[] => {
  const shuffled = shuffleArray(pool.filter(q => q.type === type));
  const selected = shuffled.slice(0, count);

  return selected.map(quest => ({
    questId: quest.id,
    current: 0,
    target: quest.target,
    status: 'in_progress' as const,
    startSnapshot: getStatValue(stats, quest.statKey),
  }));
};

export const getStatValue = (stats: AchievementStats, statKey: string): number => {
  const parts = statKey.split('.');

  if (parts.length === 1) {
    const value = (stats as Record<string, number>)[parts[0]];
    return typeof value === 'number' ? value : 0;
  }

  if (parts.length === 2) {
    const [category, key] = parts;
    const bucket = (stats as Record<string, Record<string, number>>)[category];

    if (!bucket) return 0;

    if (key === '_total') {
      return Object.values(bucket).reduce((s: number, v: number) => s + (typeof v === 'number' ? v : 0), 0);
    }

    if (key.endsWith('+')) {
      const baseKey = key.slice(0, -1);
      const qualities = ['common', 'rare', 'epic', 'legendary'];
      const startIndex = qualities.indexOf(baseKey);
      if (startIndex === -1) return 0;
      return qualities.slice(startIndex).reduce((sum, q) => sum + (bucket[q] || 0), 0);
    }

    return bucket[key] || 0;
  }

  return 0;
};

export const loadBattlePassData = (): BattlePassSaveData => {
  try {
    const data = localStorage.getItem(BATTLE_PASS_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        ...defaultSaveData,
        ...parsed,
      };
    }
  } catch (error) {
    console.error('Failed to load battle pass data:', error);
  }
  return JSON.parse(JSON.stringify(defaultSaveData));
};

export const saveBattlePassData = (data: BattlePassSaveData): void => {
  try {
    localStorage.setItem(BATTLE_PASS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save battle pass data:', error);
  }
};

let _pendingFlush: ReturnType<typeof setTimeout> | null = null;
let _cachedData: BattlePassSaveData | null = null;

const flushToStorage = () => {
  if (_cachedData) {
    saveBattlePassData(_cachedData);
  }
  _pendingFlush = null;
};

export const getBattlePassData = (): BattlePassSaveData => {
  if (!_cachedData) {
    _cachedData = loadBattlePassData();
  }
  return _cachedData;
};

export const updateBattlePassData = (updater: (data: BattlePassSaveData) => void): void => {
  const data = getBattlePassData();
  updater(data);
  _cachedData = data;

  if (!_pendingFlush) {
    _pendingFlush = setTimeout(flushToStorage, 500);
  }
};

export const flushBattlePassData = (): void => {
  if (_pendingFlush) {
    clearTimeout(_pendingFlush);
    _pendingFlush = null;
  }
  flushToStorage();
};

export const invalidateBattlePassCache = (): void => {
  _cachedData = null;
};

export const shouldRefreshDaily = (data: BattlePassSaveData): boolean => {
  const today = getStartOfDay(Date.now());
  return getStartOfDay(data.lastDailyRefresh) !== today;
};

export const shouldRefreshWeekly = (data: BattlePassSaveData): boolean => {
  const thisWeek = getStartOfWeek(Date.now());
  return getStartOfWeek(data.lastWeeklyRefresh) !== thisWeek;
};

export const refreshDailyQuests = (stats: AchievementStats): QuestProgress[] => {
  return generateRandomQuests(DAILY_QUEST_POOL, DAILY_QUEST_COUNT, 'daily', stats);
};

export const refreshWeeklyQuests = (stats: AchievementStats): QuestProgress[] => {
  return generateRandomQuests(WEEKLY_QUEST_POOL, WEEKLY_QUEST_COUNT, 'weekly', stats);
};

export const updateQuestProgress = (
  quests: QuestProgress[],
  stats: AchievementStats
): QuestProgress[] => {
  return quests.map(quest => {
    const questDef = [...DAILY_QUEST_POOL, ...WEEKLY_QUEST_POOL].find(q => q.id === quest.questId);
    if (!questDef) return quest;

    const currentStatValue = getStatValue(stats, questDef.statKey);
    const progress = Math.max(0, currentStatValue - quest.startSnapshot);
    const current = Math.min(progress, quest.target);
    const isCompleted = current >= quest.target;

    return {
      ...quest,
      current,
      status: quest.status === 'claimed' ? 'claimed' : (isCompleted ? 'completed' : 'in_progress'),
    };
  });
};

export const addExp = (data: BattlePassSaveData, exp: number): { leveledUp: boolean; newLevel: number } => {
  const prevLevel = data.level;
  data.totalExpEarned += exp;
  data.currentExp += exp;

  while (data.currentExp >= data.expPerLevel && data.level < BATTLE_PASS_MAX_LEVEL) {
    data.currentExp -= data.expPerLevel;
    data.level += 1;
  }

  if (data.level >= BATTLE_PASS_MAX_LEVEL) {
    data.currentExp = 0;
  }

  return {
    leveledUp: data.level > prevLevel,
    newLevel: data.level,
  };
};

export const getExpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  return (level - 1) * BATTLE_PASS_EXP_PER_LEVEL;
};

export const getTotalExpForLevel = (level: number, currentExp: number): number => {
  return getExpForLevel(level) + currentExp;
};

export const isNewSeason = (data: BattlePassSaveData, season: BattlePassSeason): boolean => {
  return data.currentSeasonId !== season.seasonId;
};

export const resetForNewSeason = (stats: AchievementStats): BattlePassSaveData => {
  const newData: BattlePassSaveData = {
    ...defaultSaveData,
    currentSeasonId: generateSeasonId(),
    seasonStartStats: JSON.parse(JSON.stringify(stats)),
    lastDailyRefresh: Date.now(),
    lastWeeklyRefresh: Date.now(),
  };

  newData.dailyQuests = refreshDailyQuests(stats);
  newData.weeklyQuests = refreshWeeklyQuests(stats);

  return newData;
};

export const claimQuestReward = (
  data: BattlePassSaveData,
  questId: string
): { success: boolean; expGained: number } => {
  const allQuests = [...data.dailyQuests, ...data.weeklyQuests];
  const quest = allQuests.find(q => q.questId === questId);

  if (!quest || quest.status !== 'completed') {
    return { success: false, expGained: 0 };
  }

  const questDef = [...DAILY_QUEST_POOL, ...WEEKLY_QUEST_POOL].find(q => q.id === questId);
  if (!questDef) {
    return { success: false, expGained: 0 };
  }

  if (quest.status === 'claimed') {
    return { success: false, expGained: 0 };
  }

  quest.status = 'claimed';
  const result = addExp(data, questDef.expReward);

  return { success: true, expGained: questDef.expReward };
};

export const getDaysRemainingInSeason = (season: BattlePassSeason): number => {
  const now = Date.now();
  const remaining = Math.max(0, season.endDate - now);
  return Math.ceil(remaining / (24 * 60 * 60 * 1000));
};

export const getSeasonProgress = (season: BattlePassSeason): number => {
  const now = Date.now();
  const total = season.endDate - season.startDate;
  const elapsed = Math.min(now, season.endDate) - season.startDate;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
};
