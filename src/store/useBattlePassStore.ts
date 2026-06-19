import { create } from 'zustand';
import type {
  BattlePassSaveData,
  BattlePassSeason,
  QuestProgress,
  AchievementStats,
  QuestDefinition,
  BattlePassLevelReward,
} from '../types';
import {
  DAILY_QUEST_POOL,
  WEEKLY_QUEST_POOL,
  BATTLE_PASS_REWARDS,
  BATTLE_PASS_MAX_LEVEL,
  BATTLE_PASS_EXP_PER_LEVEL,
} from '../types';
import {
  getBattlePassData,
  updateBattlePassData,
  flushBattlePassData,
  getCurrentSeason,
  shouldRefreshDaily,
  shouldRefreshWeekly,
  refreshDailyQuests,
  refreshWeeklyQuests,
  updateQuestProgress,
  claimQuestReward,
  isNewSeason,
  resetForNewSeason,
} from '../utils/battlePassStorage';
import { getAchievementData } from '../utils/achievementStorage';

interface BattlePassNotification {
  id: string;
  type: 'level_up' | 'quest_complete' | 'season_reset';
  message: string;
  timestamp: number;
}

interface BattlePassState {
  data: BattlePassSaveData;
  currentSeason: BattlePassSeason;
  notifications: BattlePassNotification[];
}

interface BattlePassActions {
  load: () => void;
  refreshIfNeeded: () => void;
  updateProgress: (stats: AchievementStats) => void;
  claimQuest: (questId: string) => boolean;
  claimLevelReward: (level: number) => boolean;
  addExp: (exp: number) => void;
  unlockPremium: () => void;
  dismissNotification: (id: string) => void;
  getDailyQuestDefinitions: () => (QuestDefinition | undefined)[];
  getWeeklyQuestDefinitions: () => (QuestDefinition | undefined)[];
  getRewardsForLevel: (level: number) => BattlePassLevelReward[];
  getExpToNextLevel: () => number;
  getTotalExpForCurrentLevel: () => number;
}

let notifCounter = 0;

export const useBattlePassStore = create<BattlePassState & BattlePassActions>((set, get) => ({
  data: {
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
  },
  currentSeason: getCurrentSeason(),
  notifications: [],

  load: () => {
    const data = getBattlePassData();
    const season = getCurrentSeason();
    const achievementData = getAchievementData();

    if (isNewSeason(data, season) && data.currentSeasonId !== null) {
      const newData = resetForNewSeason(achievementData.stats);
      updateBattlePassData((d) => {
        Object.assign(d, newData);
      });
      flushBattlePassData();

      const newNotif: BattlePassNotification = {
        id: `notif_${++notifCounter}`,
        type: 'season_reset',
        message: `新赛季开始！${season.name}`,
        timestamp: Date.now(),
      };

      set({
        data: { ...newData },
        currentSeason: season,
        notifications: [newNotif],
      });
      return;
    }

    if (data.currentSeasonId === null) {
      const newData = resetForNewSeason(achievementData.stats);
      updateBattlePassData((d) => {
        Object.assign(d, newData);
      });
      flushBattlePassData();
      set({ data: { ...newData }, currentSeason: season });
      return;
    }

    set({ data: { ...data }, currentSeason: season });

    setTimeout(() => {
      get().refreshIfNeeded();
    }, 100);
  },

  refreshIfNeeded: () => {
    const { data } = get();
    const achievementData = getAchievementData();
    let needsUpdate = false;

    const newDaily = shouldRefreshDaily(data);
    const newWeekly = shouldRefreshWeekly(data);

    if (newDaily || newWeekly) {
      updateBattlePassData((d) => {
        if (newDaily) {
          d.dailyQuests = refreshDailyQuests(achievementData.stats);
          d.lastDailyRefresh = Date.now();
          needsUpdate = true;
        }
        if (newWeekly) {
          d.weeklyQuests = refreshWeeklyQuests(achievementData.stats);
          d.lastWeeklyRefresh = Date.now();
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        flushBattlePassData();
        const updatedData = getBattlePassData();
        set({ data: { ...updatedData } });
      }
    }

    get().updateProgress(achievementData.stats);
  },

  updateProgress: (stats: AchievementStats) => {
    const { data } = get();

    const updatedDaily = updateQuestProgress(data.dailyQuests, stats);
    const updatedWeekly = updateQuestProgress(data.weeklyQuests, stats);

    const newlyCompleted: QuestProgress[] = [];
    updatedDaily.forEach((q, i) => {
      if (q.status === 'completed' && data.dailyQuests[i]?.status === 'in_progress') {
        newlyCompleted.push(q);
      }
    });
    updatedWeekly.forEach((q, i) => {
      if (q.status === 'completed' && data.weeklyQuests[i]?.status === 'in_progress') {
        newlyCompleted.push(q);
      }
    });

    updateBattlePassData((d) => {
      d.dailyQuests = updatedDaily;
      d.weeklyQuests = updatedWeekly;
    });

    const newNotifications: BattlePassNotification[] = newlyCompleted.map((q) => {
      const def = [...DAILY_QUEST_POOL, ...WEEKLY_QUEST_POOL].find((d) => d.id === q.questId);
      return {
        id: `notif_${++notifCounter}`,
        type: 'quest_complete',
        message: `任务完成：${def?.name || q.questId}`,
        timestamp: Date.now(),
      };
    });

    const updatedData = getBattlePassData();
    set((state) => ({
      data: { ...updatedData },
      notifications: [...state.notifications, ...newNotifications],
    }));
  },

  claimQuest: (questId: string): boolean => {
    const { data } = get();

    const result = claimQuestReward(data, questId);
    if (!result.success) return false;

    flushBattlePassData();

    const updatedData = getBattlePassData();
    const newNotif: BattlePassNotification = {
      id: `notif_${++notifCounter}`,
      type: 'level_up',
      message: `获得 ${result.expGained} 点通行证经验`,
      timestamp: Date.now(),
    };

    set((state) => ({
      data: { ...updatedData },
      notifications: [...state.notifications, newNotif],
    }));

    return true;
  },

  claimLevelReward: (level: number): boolean => {
    const { data } = get();
    if (data.level < level) return false;
    if (data.claimedLevels.includes(level)) return false;

    const rewards = BATTLE_PASS_REWARDS.filter((r) => r.level === level);
    if (rewards.length === 0) return false;

    const availableRewards = rewards.filter((r) => !r.isPremium || data.premiumUnlocked);
    if (availableRewards.length === 0) return false;

    updateBattlePassData((d) => {
      d.claimedLevels.push(level);
    });
    flushBattlePassData();

    const updatedData = getBattlePassData();
    set({ data: { ...updatedData } });

    return true;
  },

  addExp: (exp: number) => {
    const { data } = get();
    const prevLevel = data.level;

    updateBattlePassData((d) => {
      d.totalExpEarned += exp;
      d.currentExp += exp;

      while (d.currentExp >= BATTLE_PASS_EXP_PER_LEVEL && d.level < BATTLE_PASS_MAX_LEVEL) {
        d.currentExp -= BATTLE_PASS_EXP_PER_LEVEL;
        d.level += 1;
      }

      if (d.level >= BATTLE_PASS_MAX_LEVEL) {
        d.currentExp = 0;
      }
    });
    flushBattlePassData();

    const updatedData = getBattlePassData();
    const newNotifications: BattlePassNotification[] = [];

    if (updatedData.level > prevLevel) {
      newNotifications.push({
        id: `notif_${++notifCounter}`,
        type: 'level_up',
        message: `通行证升级！当前等级：${updatedData.level}`,
        timestamp: Date.now(),
      });
    }

    set((state) => ({
      data: { ...updatedData },
      notifications: [...state.notifications, ...newNotifications],
    }));
  },

  unlockPremium: () => {
    updateBattlePassData((d) => {
      d.premiumUnlocked = true;
    });
    flushBattlePassData();

    const updatedData = getBattlePassData();
    set({ data: { ...updatedData } });
  },

  dismissNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  getDailyQuestDefinitions: (): (QuestDefinition | undefined)[] => {
    const { data } = get();
    return data.dailyQuests.map((q) =>
      DAILY_QUEST_POOL.find((def) => def.id === q.questId)
    );
  },

  getWeeklyQuestDefinitions: (): (QuestDefinition | undefined)[] => {
    const { data } = get();
    return data.weeklyQuests.map((q) =>
      WEEKLY_QUEST_POOL.find((def) => def.id === q.questId)
    );
  },

  getRewardsForLevel: (level: number): BattlePassLevelReward[] => {
    return BATTLE_PASS_REWARDS.filter((r) => r.level === level);
  },

  getExpToNextLevel: (): number => {
    const { data } = get();
    if (data.level >= BATTLE_PASS_MAX_LEVEL) return 0;
    return BATTLE_PASS_EXP_PER_LEVEL - data.currentExp;
  },

  getTotalExpForCurrentLevel: (): number => {
    const { data } = get();
    return (data.level - 1) * BATTLE_PASS_EXP_PER_LEVEL + data.currentExp;
  },
}));
