import { create } from 'zustand';
import type {
  AchievementStats,
  AchievementProgress,
  AchievementTier,
  AchievementCategory,
  AchievementDefinition,
  CosmeticReward,
  ElementType,
  EquipmentQuality,
} from '../types';
import {
  ACHIEVEMENT_DEFINITIONS,
  COSMETIC_REWARDS,
  ENEMY_TYPE_MAPPING,
} from '../types';
import {
  getAchievementData,
  updateAchievementStats,
  addMedals,
  spendMedals,
  unlockReward,
  equipCosmetic,
  flushAchievementData,
} from '../utils/achievementStorage';

interface AchievementNotification {
  id: string;
  achievementName: string;
  tier: AchievementTier;
  timestamp: number;
}

interface AchievementState {
  stats: AchievementStats;
  progress: Record<string, AchievementProgress>;
  unlockedRewards: string[];
  equippedAvatarFrame: string | null;
  equippedBoardSkin: string | null;
  equippedRuneEffect: string | null;
  medalBalance: Record<AchievementTier, number>;
  notifications: AchievementNotification[];
}

interface AchievementActions {
  load: () => void;
  syncProgress: () => void;
  recordRunesEliminated: (element: ElementType, count: number) => void;
  recordSpellCast: (spellId: string) => void;
  recordComboSpellCast: (spellId: string) => void;
  recordEnemyKilled: (enemyId: string) => void;
  recordEquipmentAcquired: (quality: EquipmentQuality) => void;
  recordEquipmentConsumed: (quality: EquipmentQuality) => void;
  recordBattleWon: () => void;
  recordTowerFloorCleared: () => void;
  recordPVPWin: () => void;
  claimAchievement: (achievementId: string, tier: AchievementTier) => boolean;
  purchaseReward: (rewardId: string) => boolean;
  equipReward: (type: 'avatar_frame' | 'board_skin' | 'rune_effect', rewardId: string | null) => void;
  dismissNotification: (id: string) => void;
  getAchievementsByCategory: (category: AchievementCategory) => AchievementDefinition[];
  getProgressForAchievement: (id: string) => AchievementProgress;
  getRewardsByType: (type: CosmeticReward['type']) => CosmeticReward[];
}

const getStatValue = (stats: AchievementStats, statKey: string): number => {
  const parts = statKey.split('.');
  if (parts.length === 1) {
    return (stats as Record<string, number>)[statKey] || 0;
  }
  if (parts.length === 2) {
    const [category, key] = parts;
    const bucket = (stats as Record<string, Record<string, number>>)[category];
    if (!bucket) return 0;
    if (key === '_total') {
      return Object.values(bucket).reduce((s: number, v: number) => s + (typeof v === 'number' ? v : 0), 0);
    }
    return bucket[key] || 0;
  }
  return 0;
};

const computeProgressForSingle = (
  def: AchievementDefinition,
  stats: AchievementStats,
  existingClaimed: AchievementTier[] = []
): AchievementProgress => {
  const currentCount = getStatValue(stats, def.statKey);
  const completedTiers: AchievementTier[] = [];

  for (const tierConfig of def.tiers) {
    if (currentCount >= tierConfig.threshold) {
      completedTiers.push(tierConfig.tier);
    }
  }

  return {
    achievementId: def.id,
    currentCount,
    completedTiers,
    claimedTiers: existingClaimed,
  };
};

const computeProgressForStats = (
  stats: AchievementStats,
  definitions: AchievementDefinition[],
  existingProgress: Record<string, AchievementProgress> = {}
): Record<string, AchievementProgress> => {
  const progress: Record<string, AchievementProgress> = {};
  for (const def of definitions) {
    progress[def.id] = computeProgressForSingle(
      def,
      stats,
      existingProgress[def.id]?.claimedTiers || []
    );
  }
  return progress;
};

let notifCounter = 0;

const achievementsByStatKey: Record<string, AchievementDefinition[]> = {};
for (const def of ACHIEVEMENT_DEFINITIONS) {
  const prefix = def.statKey.split('.')[0];
  if (!achievementsByStatKey[prefix]) achievementsByStatKey[prefix] = [];
  achievementsByStatKey[prefix].push(def);
}

export const useAchievementStore = create<AchievementState & AchievementActions>((set, get) => ({
  stats: {
    runesEliminated: { fire: 0, water: 0, grass: 0, thunder: 0 },
    spellsCast: {},
    comboSpellsCast: {},
    enemiesKilled: {},
    equipmentAcquired: { common: 0, rare: 0, epic: 0, legendary: 0 },
    totalBattlesWon: 0,
    totalTowerFloorsCleared: 0,
    totalPVPWins: 0,
  },
  progress: {},
  unlockedRewards: [],
  equippedAvatarFrame: null,
  equippedBoardSkin: null,
  equippedRuneEffect: null,
  medalBalance: { bronze: 0, silver: 0, gold: 0 },
  notifications: [],

  load: () => {
    const data = getAchievementData();
    const progress = computeProgressForStats(data.stats, ACHIEVEMENT_DEFINITIONS, data.progress);

    set({
      stats: { ...data.stats },
      progress,
      unlockedRewards: [...data.unlockedRewards],
      equippedAvatarFrame: data.equippedAvatarFrame,
      equippedBoardSkin: data.equippedBoardSkin,
      equippedRuneEffect: data.equippedRuneEffect,
      medalBalance: { ...data.medalBalance },
    });
  },

  syncProgress: () => {
    const { stats, progress } = get();
    const newProgress = computeProgressForStats(stats, ACHIEVEMENT_DEFINITIONS, progress);
    set({ progress: newProgress });
  },

  recordRunesEliminated: (element: ElementType, count: number) => {
    updateAchievementStats((stats) => {
      stats.runesEliminated[element] += count;
    });

    set((state) => {
      const newStats = { ...state.stats };
      newStats.runesEliminated = { ...newStats.runesEliminated };
      newStats.runesEliminated[element] += count;

      const affected = achievementsByStatKey.runesEliminated || [];
      const newProgress = { ...state.progress };
      for (const def of affected) {
        newProgress[def.id] = computeProgressForSingle(def, newStats, state.progress[def.id]?.claimedTiers || []);
      }

      return { stats: newStats, progress: newProgress };
    });
  },

  recordSpellCast: (spellId: string) => {
    updateAchievementStats((stats) => {
      stats.spellsCast[spellId] = (stats.spellsCast[spellId] || 0) + 1;
    });

    set((state) => {
      const newStats = { ...state.stats };
      newStats.spellsCast = { ...newStats.spellsCast };
      newStats.spellsCast[spellId] = (newStats.spellsCast[spellId] || 0) + 1;

      const affected = achievementsByStatKey.spellsCast || [];
      const newProgress = { ...state.progress };
      for (const def of affected) {
        newProgress[def.id] = computeProgressForSingle(def, newStats, state.progress[def.id]?.claimedTiers || []);
      }

      return { stats: newStats, progress: newProgress };
    });
  },

  recordComboSpellCast: (spellId: string) => {
    updateAchievementStats((stats) => {
      stats.comboSpellsCast[spellId] = (stats.comboSpellsCast[spellId] || 0) + 1;
    });

    set((state) => {
      const newStats = { ...state.stats };
      newStats.comboSpellsCast = { ...newStats.comboSpellsCast };
      newStats.comboSpellsCast[spellId] = (newStats.comboSpellsCast[spellId] || 0) + 1;

      const affected = achievementsByStatKey.comboSpellsCast || [];
      const newProgress = { ...state.progress };
      for (const def of affected) {
        newProgress[def.id] = computeProgressForSingle(def, newStats, state.progress[def.id]?.claimedTiers || []);
      }

      return { stats: newStats, progress: newProgress };
    });
  },

  recordEnemyKilled: (enemyId: string) => {
    const enemyType = ENEMY_TYPE_MAPPING[enemyId] || ENEMY_TYPE_MAPPING[enemyId.toLowerCase()] || 'unknown';

    updateAchievementStats((stats) => {
      stats.enemiesKilled[enemyType] = (stats.enemiesKilled[enemyType] || 0) + 1;
    });

    set((state) => {
      const newStats = { ...state.stats };
      newStats.enemiesKilled = { ...newStats.enemiesKilled };
      newStats.enemiesKilled[enemyType] = (newStats.enemiesKilled[enemyType] || 0) + 1;

      const affected = achievementsByStatKey.enemiesKilled || [];
      const newProgress = { ...state.progress };
      for (const def of affected) {
        newProgress[def.id] = computeProgressForSingle(def, newStats, state.progress[def.id]?.claimedTiers || []);
      }

      return { stats: newStats, progress: newProgress };
    });
  },

  recordEquipmentAcquired: (quality: EquipmentQuality) => {
    updateAchievementStats((stats) => {
      stats.equipmentAcquired[quality] += 1;
    });

    set((state) => {
      const newStats = { ...state.stats };
      newStats.equipmentAcquired = { ...newStats.equipmentAcquired };
      newStats.equipmentAcquired[quality] += 1;

      const affected = achievementsByStatKey.equipmentAcquired || [];
      const newProgress = { ...state.progress };
      for (const def of affected) {
        newProgress[def.id] = computeProgressForSingle(def, newStats, state.progress[def.id]?.claimedTiers || []);
      }

      return { stats: newStats, progress: newProgress };
    });
  },

  recordEquipmentConsumed: (quality: EquipmentQuality) => {
    updateAchievementStats((stats) => {
      stats.equipmentAcquired[quality] = Math.max(0, stats.equipmentAcquired[quality] - 1);
    });

    set((state) => {
      const newStats = { ...state.stats };
      newStats.equipmentAcquired = { ...newStats.equipmentAcquired };
      newStats.equipmentAcquired[quality] = Math.max(0, newStats.equipmentAcquired[quality] - 1);

      const affected = achievementsByStatKey.equipmentAcquired || [];
      const newProgress = { ...state.progress };
      for (const def of affected) {
        newProgress[def.id] = computeProgressForSingle(def, newStats, state.progress[def.id]?.claimedTiers || []);
      }

      return { stats: newStats, progress: newProgress };
    });
  },

  recordBattleWon: () => {
    updateAchievementStats((stats) => {
      stats.totalBattlesWon += 1;
    });

    set((state) => {
      const newStats = { ...state.stats };
      newStats.totalBattlesWon += 1;

      const affected = achievementsByStatKey.totalBattlesWon || [];
      const newProgress = { ...state.progress };
      for (const def of affected) {
        newProgress[def.id] = computeProgressForSingle(def, newStats, state.progress[def.id]?.claimedTiers || []);
      }

      return { stats: newStats, progress: newProgress };
    });
  },

  recordTowerFloorCleared: () => {
    updateAchievementStats((stats) => {
      stats.totalTowerFloorsCleared += 1;
    });

    set((state) => {
      const newStats = { ...state.stats };
      newStats.totalTowerFloorsCleared += 1;

      const affected = achievementsByStatKey.totalTowerFloorsCleared || [];
      const newProgress = { ...state.progress };
      for (const def of affected) {
        newProgress[def.id] = computeProgressForSingle(def, newStats, state.progress[def.id]?.claimedTiers || []);
      }

      return { stats: newStats, progress: newProgress };
    });
  },

  recordPVPWin: () => {
    updateAchievementStats((stats) => {
      stats.totalPVPWins += 1;
    });

    set((state) => {
      const newStats = { ...state.stats };
      newStats.totalPVPWins += 1;

      const affected = achievementsByStatKey.totalPVPWins || [];
      const newProgress = { ...state.progress };
      for (const def of affected) {
        newProgress[def.id] = computeProgressForSingle(def, newStats, state.progress[def.id]?.claimedTiers || []);
      }

      return { stats: newStats, progress: newProgress };
    });
  },

  claimAchievement: (achievementId: string, tier: AchievementTier): boolean => {
    const { progress } = get();
    const achProgress = progress[achievementId];
    if (!achProgress) return false;
    if (!achProgress.completedTiers.includes(tier)) return false;
    if (achProgress.claimedTiers.includes(tier)) return false;

    const newClaimed = [...achProgress.claimedTiers, tier];
    const newProgressEntry = { ...achProgress, claimedTiers: newClaimed };

    addMedals(tier, 1);

    const def = ACHIEVEMENT_DEFINITIONS.find(d => d.id === achievementId);
    const newNotification: AchievementNotification = {
      id: `notif_${++notifCounter}`,
      achievementName: def?.tiers.find(t => t.tier === tier)?.name || achievementId,
      tier,
      timestamp: Date.now(),
    };

    const data = getAchievementData();
    data.progress[achievementId] = { ...newProgressEntry };
    flushAchievementData();

    set((state) => ({
      progress: { ...state.progress, [achievementId]: newProgressEntry },
      medalBalance: { ...data.medalBalance },
      notifications: [...state.notifications, newNotification],
    }));

    return true;
  },

  purchaseReward: (rewardId: string): boolean => {
    const reward = COSMETIC_REWARDS.find(r => r.id === rewardId);
    if (!reward) return false;

    const { unlockedRewards, medalBalance } = get();
    if (unlockedRewards.includes(rewardId)) return false;

    for (const [tier, cost] of Object.entries(reward.costTiers)) {
      if (medalBalance[tier as AchievementTier] < cost) return false;
    }

    const success = spendMedals(reward.costTiers);
    if (!success) return false;

    unlockReward(rewardId);

    const data = getAchievementData();
    set({
      unlockedRewards: [...data.unlockedRewards],
      medalBalance: { ...data.medalBalance },
    });

    return true;
  },

  equipReward: (type: 'avatar_frame' | 'board_skin' | 'rune_effect', rewardId: string | null) => {
    const { unlockedRewards } = get();
    if (rewardId && !unlockedRewards.includes(rewardId)) return;

    equipCosmetic(type, rewardId);

    const data = getAchievementData();
    set({
      equippedAvatarFrame: data.equippedAvatarFrame,
      equippedBoardSkin: data.equippedBoardSkin,
      equippedRuneEffect: data.equippedRuneEffect,
    });
  },

  dismissNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id),
    }));
  },

  getAchievementsByCategory: (category: AchievementCategory): AchievementDefinition[] => {
    return ACHIEVEMENT_DEFINITIONS.filter(d => d.category === category);
  },

  getProgressForAchievement: (id: string): AchievementProgress => {
    return get().progress[id] || {
      achievementId: id,
      currentCount: 0,
      completedTiers: [],
      claimedTiers: [],
    };
  },

  getRewardsByType: (type: CosmeticReward['type']): CosmeticReward[] => {
    return COSMETIC_REWARDS.filter(r => r.type === type);
  },
}));
