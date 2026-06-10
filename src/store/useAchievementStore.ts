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
  recordRunesEliminated: (element: ElementType, count: number) => void;
  recordSpellCast: (spellId: string) => void;
  recordComboSpellCast: (spellId: string) => void;
  recordEnemyKilled: (enemyId: string) => void;
  recordEquipmentAcquired: (quality: EquipmentQuality) => void;
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

const computeProgressFromStats = (
  stats: AchievementStats,
  definitions: AchievementDefinition[]
): Record<string, AchievementProgress> => {
  const progress: Record<string, AchievementProgress> = {};

  for (const def of definitions) {
    const currentCount = getStatValue(stats, def.statKey);
    const completedTiers: AchievementTier[] = [];

    for (const tierConfig of def.tiers) {
      if (currentCount >= tierConfig.threshold) {
        completedTiers.push(tierConfig.tier);
      }
    }

    const existing = progress[def.id];
    progress[def.id] = {
      achievementId: def.id,
      currentCount,
      completedTiers,
      claimedTiers: existing?.claimedTiers || [],
    };
  }

  return progress;
};

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

let notifCounter = 0;

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
    const progress = computeProgressFromStats(data.stats, ACHIEVEMENT_DEFINITIONS);

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      if (progress[def.id] && data.progress[def.id]) {
        progress[def.id].claimedTiers = data.progress[def.id].claimedTiers || [];
      }
    }

    set({
      stats: data.stats,
      progress,
      unlockedRewards: data.unlockedRewards,
      equippedAvatarFrame: data.equippedAvatarFrame,
      equippedBoardSkin: data.equippedBoardSkin,
      equippedRuneEffect: data.equippedRuneEffect,
      medalBalance: data.medalBalance,
    });
  },

  recordRunesEliminated: (element: ElementType, count: number) => {
    updateAchievementStats((stats) => {
      stats.runesEliminated[element] += count;
    });
    get().load();
  },

  recordSpellCast: (spellId: string) => {
    updateAchievementStats((stats) => {
      stats.spellsCast[spellId] = (stats.spellsCast[spellId] || 0) + 1;
    });
    get().load();
  },

  recordComboSpellCast: (spellId: string) => {
    updateAchievementStats((stats) => {
      stats.comboSpellsCast[spellId] = (stats.comboSpellsCast[spellId] || 0) + 1;
    });
    get().load();
  },

  recordEnemyKilled: (enemyId: string) => {
    const enemyType = ENEMY_TYPE_MAPPING[enemyId] || ENEMY_TYPE_MAPPING[enemyId.toLowerCase()] || 'unknown';
    updateAchievementStats((stats) => {
      stats.enemiesKilled[enemyType] = (stats.enemiesKilled[enemyType] || 0) + 1;
    });
    get().load();
  },

  recordEquipmentAcquired: (quality: EquipmentQuality) => {
    updateAchievementStats((stats) => {
      stats.equipmentAcquired[quality] += 1;
    });
    get().load();
  },

  recordBattleWon: () => {
    updateAchievementStats((stats) => {
      stats.totalBattlesWon += 1;
    });
    get().load();
  },

  recordTowerFloorCleared: () => {
    updateAchievementStats((stats) => {
      stats.totalTowerFloorsCleared += 1;
    });
    get().load();
  },

  recordPVPWin: () => {
    updateAchievementStats((stats) => {
      stats.totalPVPWins += 1;
    });
    get().load();
  },

  claimAchievement: (achievementId: string, tier: AchievementTier): boolean => {
    const { progress } = get();
    const achProgress = progress[achievementId];
    if (!achProgress) return false;
    if (!achProgress.completedTiers.includes(tier)) return false;
    if (achProgress.claimedTiers.includes(tier)) return false;

    achProgress.claimedTiers = [...achProgress.claimedTiers, tier];

    addMedals(tier, 1);

    const def = ACHIEVEMENT_DEFINITIONS.find(d => d.id === achievementId);
    const newNotifications: AchievementNotification[] = [
      {
        id: `notif_${++notifCounter}`,
        achievementName: def?.tiers.find(t => t.tier === tier)?.name || achievementId,
        tier,
        timestamp: Date.now(),
      },
    ];

    const data = getAchievementData();
    data.progress[achievementId] = { ...achProgress };
    flushAchievementData();

    set((state) => ({
      progress: { ...state.progress, [achievementId]: { ...achProgress } },
      medalBalance: { ...data.medalBalance },
      notifications: [...state.notifications, ...newNotifications],
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
