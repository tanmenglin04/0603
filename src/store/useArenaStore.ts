import { create } from 'zustand';
import type {
  ArenaStore,
  ArenaPlayerProfile,
  DefenderLoadout,
  BattleRecord,
  BattleReplayData,
  SeasonInfo,
  SeasonResult,
  LeaderboardEntry,
  ScheduledTask,
  PVPBattleState,
  RankStars,
  RankTier,
  BattleCodePayload,
  AvatarFrameReward,
  RankConfig,
  ReplayAction,
  EnergyPool,
  Spell,
  Rune,
  AVATAR_FRAME_REWARDS,
  RANK_CONFIGS,
  SPELLS,
  GRID_SIZE,
  BATTLE_TIMEOUT_MS,
  WIN_POINTS_BASE,
  LOSS_POINTS_BASE,
  DRAW_POINTS_BASE,
  WIN_STREAK_BONUS_PER_WIN,
  MAX_WIN_STREAK_BONUS,
  DEFAULT_AI_CONFIG,
  BattleStatus,
} from '../types';
import {
  AVATAR_FRAME_REWARDS as AFR,
  RANK_CONFIGS as RC,
  SPELLS as SP,
  GRID_SIZE as GS,
  BATTLE_TIMEOUT_MS as BTM,
  WIN_POINTS_BASE as WPB,
  LOSS_POINTS_BASE as LPB,
  DRAW_POINTS_BASE as DPB,
  WIN_STREAK_BONUS_PER_WIN as WSB,
  MAX_WIN_STREAK_BONUS as MWSB,
  DEFAULT_AI_CONFIG as DAIC,
  getRankByPoints,
} from '../types';
import { generateBattleCode, parseBattleCode, generateId } from '../utils/battleCode';
import { useAchievementStore } from './useAchievementStore';

const ARENA_STORAGE_KEY = 'rune-chess-arena-v1';
const TASK_CHECK_INTERVAL = 60 * 1000;

const generatePlayerId = (): string => {
  return `player_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
};

const createDefaultProfile = (name: string): ArenaPlayerProfile => ({
  playerId: generatePlayerId(),
  playerName: name,
  avatar: '🧙',
  currentRank: 'bronze',
  currentStars: 0,
  rankPoints: 0,
  highestRank: 'bronze',
  highestPoints: 0,
  totalWins: 0,
  totalLosses: 0,
  totalDraws: 0,
  winStreak: 0,
  bestWinStreak: 0,
  seasonsPlayed: 0,
  currentLoadoutId: null,
  loadouts: [],
  unlockedAvatarFrames: ['frame_bronze'],
  equippedAvatarFrame: null,
});

const createDefaultLoadout = (name: string): DefenderLoadout => ({
  id: generateId(),
  name,
  createdAt: Date.now(),
  equippedRunes: {},
  selectedSpellIds: ['fireball', 'water-heal', 'vine-whip', 'thunder-strike'],
  aiStyle: 'balanced',
  aiConfig: { ...DAIC },
  playerMaxHp: 200,
});

const getCurrentSeasonDates = (): { start: number; end: number } => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.getTime(), end: end.getTime() };
};

const createDefaultSeason = (): SeasonInfo => {
  const { start, end } = getCurrentSeasonDates();
  const now = Date.now();
  const seasonNumber = Math.floor((now - new Date(2024, 0, 1).getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1;
  return {
    seasonId: `season_${seasonNumber}`,
    seasonNumber,
    name: `第${seasonNumber}赛季`,
    startDate: start,
    endDate: end,
    isActive: true,
    rewardsDistributed: false,
    pointDecayRate: 50,
    description: '本赛季奖励丰厚，冲击高段位领取专属头像框！',
  };
};

interface ArenaSaveData {
  profile: ArenaPlayerProfile | null;
  currentSeason: SeasonInfo | null;
  battleHistory: BattleRecord[];
  seasonResults: SeasonResult[];
  pendingTasks: ScheduledTask[];
  lastTaskCheck: number;
  customLeaderboard: LeaderboardEntry[];
}

const saveArenaToStorage = (data: Partial<ArenaSaveData>): void => {
  try {
    const existing = loadArenaFromStorage();
    const merged = { ...existing, ...data };
    localStorage.setItem(ARENA_STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error('Failed to save arena data:', error);
  }
};

const loadArenaFromStorage = (): ArenaSaveData => {
  try {
    const data = localStorage.getItem(ARENA_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load arena data:', error);
  }
  return {
    profile: null,
    currentSeason: null,
    battleHistory: [],
    seasonResults: [],
    pendingTasks: [],
    lastTaskCheck: 0,
    customLeaderboard: [],
  };
};

const getSpellsByIds = (ids: string[]): Spell[] => {
  return ids.map((id) => SP.find((s) => s.id === id)).filter((s): s is Spell => !!s);
};

const createRuneGrid = (gridSize: number): Rune[][] => {
  const elements: ('fire' | 'water' | 'grass' | 'thunder')[] = ['fire', 'water', 'grass', 'thunder'];
  const grid: Rune[][] = [];
  for (let row = 0; row < gridSize; row++) {
    grid[row] = [];
    for (let col = 0; col < gridSize; col++) {
      grid[row][col] = {
        id: `rune_${row}_${col}_${Date.now()}_${Math.random()}`,
        element: elements[Math.floor(Math.random() * elements.length)],
        row,
        col,
        isSelected: false,
        isMatched: false,
        isNew: false,
        tileType: 'normal',
        frozenHitCount: 0,
        doubleEnergyTurnsLeft: 0,
      };
    }
  }
  return grid;
};

const emptyEnergy: EnergyPool = { fire: 0, water: 0, grass: 0, thunder: 0 };

export const useArenaStore = create<ArenaStore>((set, get) => ({
  currentProfile: null,
  currentSeason: null,
  currentLoadout: null,
  battleHistory: [],
  leaderboard: [],
  pendingTasks: [],
  seasonResults: [],
  isLoading: false,
  error: null,
  currentBattle: null,
  activeReplay: null,
  isP2PBattle: false,
  p2pIsHost: false,
  p2pBattleController: null,

  initializeArena: () => {
    const saved = loadArenaFromStorage();
    const season = saved.currentSeason || createDefaultSeason();
    const now = Date.now();

    if (now > season.endDate && !season.rewardsDistributed) {
      season.isActive = false;
    }

    const leaderboard = saved.customLeaderboard.length > 0
      ? saved.customLeaderboard
      : [
          { playerId: 'bot_1', playerName: '龙王敖广', avatar: '🐉', avatarFrame: 'frame_legend', rank: 1, tier: 'legend', rankPoints: 5200, wins: 156, losses: 23, winRate: 87.1, winStreak: 12 },
          { playerId: 'bot_2', playerName: '剑仙李白', avatar: '⚔️', avatarFrame: 'frame_king', rank: 2, tier: 'king', rankPoints: 3950, wins: 142, losses: 35, winRate: 80.2, winStreak: 5 },
          { playerId: 'bot_3', playerName: '圣者孔明', avatar: '🔮', avatarFrame: 'frame_grandmaster', rank: 3, tier: 'grandmaster', rankPoints: 3050, wins: 128, losses: 44, winRate: 74.4, winStreak: 3 },
          { playerId: 'bot_4', playerName: '战神吕布', avatar: '🛡️', avatarFrame: 'frame_master', rank: 4, tier: 'master', rankPoints: 2380, wins: 115, losses: 58, winRate: 66.5, winStreak: 0 },
          { playerId: 'bot_5', playerName: '医仙华佗', avatar: '💊', avatarFrame: 'frame_diamond', rank: 5, tier: 'diamond', rankPoints: 1680, wins: 98, losses: 72, winRate: 57.6, winStreak: 2 },
          { playerId: 'bot_6', playerName: '狂战士', avatar: '🗡️', avatarFrame: 'frame_platinum', rank: 6, tier: 'platinum', rankPoints: 1050, wins: 85, losses: 80, winRate: 51.5, winStreak: 0 },
          { playerId: 'bot_7', playerName: '暗影刺客', avatar: '🗡️', avatarFrame: 'frame_gold', rank: 7, tier: 'gold', rankPoints: 680, wins: 72, losses: 88, winRate: 45.0, winStreak: 1 },
          { playerId: 'bot_8', playerName: '元素法师', avatar: '✨', avatarFrame: 'frame_silver', rank: 8, tier: 'silver', rankPoints: 320, wins: 58, losses: 95, winRate: 37.9, winStreak: 0 },
          { playerId: 'bot_9', playerName: '新手勇者', avatar: '🛡️', avatarFrame: 'frame_bronze', rank: 9, tier: 'bronze', rankPoints: 85, wins: 32, losses: 110, winRate: 22.5, winStreak: 0 },
        ];

    set({
      currentProfile: saved.profile,
      currentSeason: season,
      battleHistory: saved.battleHistory || [],
      seasonResults: saved.seasonResults || [],
      pendingTasks: saved.pendingTasks || [],
      leaderboard,
    });

    if (Date.now() - saved.lastTaskCheck > TASK_CHECK_INTERVAL) {
      setTimeout(() => get().executeScheduledTasks(), 100);
    }
  },

  createOrUpdateProfile: (name: string) => {
    const existing = get().currentProfile;
    let profile: ArenaPlayerProfile;

    if (existing) {
      profile = { ...existing, playerName: name };
    } else {
      profile = createDefaultProfile(name);
      const defaultLoadout = createDefaultLoadout('默认阵容');
      profile.loadouts = [defaultLoadout];
      profile.currentLoadoutId = defaultLoadout.id;
    }

    set({
      currentProfile: profile,
      currentLoadout: profile.loadouts.find((l) => l.id === profile.currentLoadoutId) || profile.loadouts[0] || null,
    });
    get().saveArenaData();
  },

  createLoadout: (name: string): DefenderLoadout => {
    const profile = get().currentProfile;
    if (!profile) {
      get().createOrUpdateProfile('玩家');
    }
    const currentProfile = get().currentProfile!;

    const newLoadout = createDefaultLoadout(name);
    const updatedProfile = {
      ...currentProfile,
      loadouts: [...currentProfile.loadouts, newLoadout],
      currentLoadoutId: currentProfile.currentLoadoutId || newLoadout.id,
    };

    set({
      currentProfile: updatedProfile,
      currentLoadout: updatedProfile.loadouts.find((l) => l.id === updatedProfile.currentLoadoutId) || null,
    });
    get().saveArenaData();
    return newLoadout;
  },

  updateLoadout: (loadoutId: string, updates: Partial<DefenderLoadout>) => {
    const profile = get().currentProfile;
    if (!profile) return;

    const updatedLoadouts = profile.loadouts.map((l) =>
      l.id === loadoutId ? { ...l, ...updates } : l
    );
    const updatedProfile = { ...profile, loadouts: updatedLoadouts };

    set({
      currentProfile: updatedProfile,
      currentLoadout:
        get().currentLoadout?.id === loadoutId
          ? updatedLoadouts.find((l) => l.id === loadoutId) || null
          : get().currentLoadout,
    });
    get().saveArenaData();
  },

  deleteLoadout: (loadoutId: string) => {
    const profile = get().currentProfile;
    if (!profile) return;
    if (profile.loadouts.length <= 1) return;

    const updatedLoadouts = profile.loadouts.filter((l) => l.id !== loadoutId);
    let currentLoadoutId = profile.currentLoadoutId;
    if (currentLoadoutId === loadoutId) {
      currentLoadoutId = updatedLoadouts[0]?.id || null;
    }

    const updatedProfile = { ...profile, loadouts: updatedLoadouts, currentLoadoutId };
    set({
      currentProfile: updatedProfile,
      currentLoadout: updatedLoadouts.find((l) => l.id === currentLoadoutId) || null,
    });
    get().saveArenaData();
  },

  setActiveLoadout: (loadoutId: string) => {
    const profile = get().currentProfile;
    if (!profile) return;

    const loadout = profile.loadouts.find((l) => l.id === loadoutId);
    if (!loadout) return;

    const updatedProfile = { ...profile, currentLoadoutId: loadoutId };
    set({
      currentProfile: updatedProfile,
      currentLoadout: loadout,
    });
    get().saveArenaData();
  },

  generateBattleCode: (loadoutId: string): string => {
    const profile = get().currentProfile;
    if (!profile) {
      get().createOrUpdateProfile('玩家');
    }
    const currentProfile = get().currentProfile!;
    const loadout = currentProfile.loadouts.find((l) => l.id === loadoutId);
    if (!loadout) return '';

    return generateBattleCode(currentProfile, loadout);
  },

  parseBattleCode: (code: string): BattleCodePayload | null => {
    return parseBattleCode(code);
  },

  startOffensiveBattle: (battleCode: string): boolean => {
    const payload = parseBattleCode(battleCode);
    if (!payload) {
      set({ error: '无效的对战码或已过期' });
      return false;
    }

    let profile = get().currentProfile;
    if (!profile) {
      get().createOrUpdateProfile('玩家');
      profile = get().currentProfile!;
    }

    const defenderLoadout = payload.loadout;
    const defenderMaxHp = defenderLoadout.playerMaxHp;
    const playerMaxHp = 200;

    const battleState: PVPBattleState = {
      battleId: generateId(),
      battleCode,
      mode: 'offense',
      isStarted: true,
      isFinished: false,
      turn: 1,
      isPlayerTurn: true,
      playerHp: playerMaxHp,
      playerMaxHp,
      enemyHp: defenderMaxHp,
      enemyMaxHp: defenderMaxHp,
      playerEnergy: { ...emptyEnergy },
      enemyEnergy: { ...emptyEnergy },
      maxEnergy: 12,
      gridSize: GS,
      runeGrid: createRuneGrid(GS),
      selectedRunes: [],
      playerSpells: getSpellsByIds(['fireball', 'water-heal', 'vine-whip', 'thunder-strike']),
      enemySpells: getSpellsByIds(defenderLoadout.selectedSpellIds),
      comboSpellCooldowns: {},
      enemyComboSpellCooldowns: {},
      statusEffects: { player: [], enemy: [] },
      battleStatus: 'playing',
      isAnimating: false,
      floatingTexts: [],
      screenShake: false,
      spellEffect: null,
      comboCount: 0,
      lastActionTime: Date.now(),
      timeoutMs: BTM,
      defenderAIStyle: defenderLoadout.aiStyle,
      isRecordingReplay: true,
      replayActions: [],
      battleStartTime: Date.now(),
    };

    const initialReplayAction: ReplayAction = {
      turn: 0,
      side: 'attacker',
      actionType: 'end_turn',
      timestamp: Date.now(),
      payload: { type: 'battle_start', defenderName: payload.playerName },
      hpAfter: { attacker: playerMaxHp, defender: defenderMaxHp },
      energyAfter: { ...emptyEnergy },
      description: `对战开始！对手: ${payload.playerName}`,
    };
    battleState.replayActions = [initialReplayAction];

    set({ currentBattle: battleState, error: null });
    return true;
  },

  startPracticeBattle: () => {
    let profile = get().currentProfile;
    if (!profile) {
      get().createOrUpdateProfile('玩家');
      profile = get().currentProfile!;
    }

    const playerMaxHp = 200;
    const aiMaxHp = 180;

    const battleState: PVPBattleState = {
      battleId: generateId(),
      battleCode: 'PRACTICE',
      mode: 'offense',
      isStarted: true,
      isFinished: false,
      turn: 1,
      isPlayerTurn: true,
      playerHp: playerMaxHp,
      playerMaxHp,
      enemyHp: aiMaxHp,
      enemyMaxHp: aiMaxHp,
      playerEnergy: { ...emptyEnergy },
      enemyEnergy: { ...emptyEnergy },
      maxEnergy: 12,
      gridSize: GS,
      runeGrid: createRuneGrid(GS),
      selectedRunes: [],
      playerSpells: getSpellsByIds(['fireball', 'water-heal', 'vine-whip', 'thunder-strike']),
      enemySpells: getSpellsByIds(['fireball', 'water-heal', 'vine-whip', 'thunder-strike']),
      comboSpellCooldowns: {},
      enemyComboSpellCooldowns: {},
      statusEffects: { player: [], enemy: [] },
      battleStatus: 'playing',
      isAnimating: false,
      floatingTexts: [],
      screenShake: false,
      spellEffect: null,
      comboCount: 0,
      lastActionTime: Date.now(),
      timeoutMs: BTM,
      defenderAIStyle: 'balanced',
      isRecordingReplay: false,
      replayActions: [],
      battleStartTime: Date.now(),
    };

    set({ currentBattle: battleState, error: null });
  },

  finishPVPBattle: (result: BattleRecord['result'], replayData?: BattleReplayData) => {
    const battle = get().currentBattle;
    const profile = get().currentProfile;
    const season = get().currentSeason;

    if (!battle || !profile) return;

    const payload = parseBattleCode(battle.battleCode);
    const defenderPoints = payload?.rankPoints || 100;

    let attackerPointsChange = 0;
    let defenderPointsChange = 0;

    if (battle.battleCode !== 'PRACTICE' && season?.isActive) {
      if (result === 'attacker_win') {
        attackerPointsChange = get().calculatePointsChange(defenderPoints, 'attacker_win');
        defenderPointsChange = -get().calculatePointsChange(profile.rankPoints, 'defender_win');
      } else if (result === 'defender_win') {
        attackerPointsChange = -get().calculatePointsChange(defenderPoints, 'defender_win');
        defenderPointsChange = get().calculatePointsChange(profile.rankPoints, 'attacker_win');
      } else if (result === 'draw') {
        attackerPointsChange = DPB;
        defenderPointsChange = DPB;
      } else if (result === 'timeout') {
        attackerPointsChange = -LPB;
        defenderPointsChange = WPB;
      }
    }

    const newRankStars = battle.battleCode !== 'PRACTICE' ? get().updateRankPoints(attackerPointsChange) : null;

    const record: BattleRecord = {
      battleId: battle.battleId,
      seasonId: season?.seasonId || 'unknown',
      attackerPlayerId: profile.playerId,
      attackerName: profile.playerName,
      defenderPlayerId: payload?.playerId || 'unknown',
      defenderName: payload?.playerName || '未知对手',
      defenderLoadoutId: payload?.loadoutId || 'unknown',
      battleCode: battle.battleCode,
      result,
      attackerHpRemaining: battle.playerHp,
      defenderHpRemaining: battle.enemyHp,
      totalTurns: battle.turn,
      durationMs: Date.now() - battle.battleStartTime,
      startedAt: battle.battleStartTime,
      endedAt: Date.now(),
      attackerPointsChange,
      defenderPointsChange,
      isRated: battle.battleCode !== 'PRACTICE' && !!season?.isActive,
      isP2P: false,
      replayData: replayData || (battle.isRecordingReplay ? {
        battleId: battle.battleId,
        defenderLoadoutSnapshot: payload?.loadout || createDefaultLoadout(''),
        attackerSpells: battle.playerSpells.map(s => s.id),
        initialState: {
          attackerHp: battle.playerMaxHp,
          defenderHp: battle.enemyMaxHp,
          attackerMaxHp: battle.playerMaxHp,
          defenderMaxHp: battle.enemyMaxHp,
        },
        actions: battle.replayActions,
        finalState: {
          attackerHp: battle.playerHp,
          defenderHp: battle.enemyHp,
          result,
        },
        recordedAt: Date.now(),
        isP2P: false,
      } : null),
      timeoutSide: result === 'timeout' ? 'attacker' : undefined,
    };

    const updatedHistory = [record, ...get().battleHistory].slice(0, 100);

    try {
      if (result === 'attacker_win') {
        useAchievementStore.getState().recordPVPWin();
      }
    } catch { /* non-critical */ }

    set({
      battleHistory: updatedHistory,
      currentBattle: { ...battle, isFinished: true, battleStatus: result === 'attacker_win' ? 'victory' : 'defeat' },
    });
    get().saveArenaData();
  },

  updateRankPoints: (pointsChange: number): RankStars => {
    const profile = get().currentProfile;
    if (!profile) {
      return { tier: 'bronze', stars: 0, consecutiveWins: 0 };
    }

    let newPoints = Math.max(0, profile.rankPoints + pointsChange);
    let newWins = profile.totalWins;
    let newLosses = profile.totalLosses;
    let newDraws = profile.totalDraws;
    let newWinStreak = profile.winStreak;
    let newBestStreak = profile.bestWinStreak;

    if (pointsChange > 0) {
      newWins++;
      newWinStreak++;
      if (newWinStreak > newBestStreak) newBestStreak = newWinStreak;
    } else if (pointsChange < 0) {
      newLosses++;
      newWinStreak = 0;
    } else {
      newDraws++;
    }

    const currentRank = getRankByPoints(newPoints);
    const previousRank = getRankByPoints(profile.rankPoints);

    let unlockedFrames = [...profile.unlockedAvatarFrames];
    for (const frame of AFR) {
      const shouldUnlock = newPoints >= RC.find(r => r.tier === frame.minRank)?.minPoints || 0;
      if (shouldUnlock && !unlockedFrames.includes(frame.id)) {
        unlockedFrames.push(frame.id);
      }
    }

    const updatedProfile = {
      ...profile,
      rankPoints: newPoints,
      currentRank: currentRank.tier,
      highestRank: profile.highestPoints < newPoints ? currentRank.tier : profile.highestRank,
      highestPoints: Math.max(profile.highestPoints, newPoints),
      totalWins: newWins,
      totalLosses: newLosses,
      totalDraws: newDraws,
      winStreak: newWinStreak,
      bestWinStreak: newBestStreak,
      unlockedAvatarFrames: unlockedFrames,
    };

    set({ currentProfile: updatedProfile });
    get().saveArenaData();

    return {
      tier: currentRank.tier,
      stars: Math.floor((newPoints - currentRank.minPoints) / Math.ceil((currentRank.maxPoints - currentRank.minPoints + 1) / 5)),
      consecutiveWins: newWinStreak,
    };
  },

  checkRankPromotion: () => {
    const profile = get().currentProfile;
    if (!profile) return { promoted: false };

    const currentRankConfig = RC.find(r => r.tier === profile.currentRank);
    if (!currentRankConfig) return { promoted: false };

    if (profile.rankPoints > currentRankConfig.maxPoints) {
      const nextIndex = RC.findIndex(r => r.tier === profile.currentRank) + 1;
      if (nextIndex < RC.length) {
        const newTier = RC[nextIndex].tier;
        const updatedProfile = { ...profile, currentRank: newTier, currentStars: 0 };
        set({ currentProfile: updatedProfile });
        get().saveArenaData();
        return { promoted: true, newTier };
      }
    }
    return { promoted: false };
  },

  checkRankDemotion: () => {
    const profile = get().currentProfile;
    if (!profile) return { demoted: false };

    const currentRankConfig = RC.find(r => r.tier === profile.currentRank);
    if (!currentRankConfig) return { demoted: false };

    if (profile.rankPoints < currentRankConfig.minPoints) {
      const prevIndex = RC.findIndex(r => r.tier === profile.currentRank) - 1;
      if (prevIndex >= 0) {
        const newTier = RC[prevIndex].tier;
        const updatedProfile = { ...profile, currentRank: newTier };
        set({ currentProfile: updatedProfile });
        get().saveArenaData();
        return { demoted: true, newTier };
      }
    }
    return { demoted: false };
  },

  getLeaderboard: (limit: number = 10): LeaderboardEntry[] => {
    const board = get().leaderboard;
    const profile = get().currentProfile;

    let result = [...board];

    if (profile) {
      const myEntry: LeaderboardEntry = {
        playerId: profile.playerId,
        playerName: `${profile.playerName} (我)`,
        avatar: profile.avatar,
        avatarFrame: profile.equippedAvatarFrame,
        rank: 0,
        tier: profile.currentRank,
        rankPoints: profile.rankPoints,
        wins: profile.totalWins,
        losses: profile.totalLosses,
        winRate: profile.totalWins + profile.totalLosses > 0
          ? Math.round((profile.totalWins / (profile.totalWins + profile.totalLosses)) * 1000) / 10
          : 0,
        winStreak: profile.winStreak,
      };

      const allWithMe = [...result.filter(e => e.playerId !== profile.playerId), myEntry];
      allWithMe.sort((a, b) => b.rankPoints - a.rankPoints);
      allWithMe.forEach((e, i) => { e.rank = i + 1; });
      result = allWithMe;
    }

    return result.slice(0, limit);
  },

  getBattleHistory: (limit: number = 20): BattleRecord[] => {
    return get().battleHistory.slice(0, limit);
  },

  startReplay: (battleId: string): BattleReplayData | null => {
    const record = get().battleHistory.find(r => r.battleId === battleId);
    if (!record?.replayData) return null;

    set({ activeReplay: record.replayData });
    return record.replayData;
  },

  checkSeasonTransition: () => {
    const season = get().currentSeason;
    const profile = get().currentProfile;
    const now = Date.now();

    if (!season || !profile) return { seasonChanged: false };

    if (now < season.endDate) return { seasonChanged: false };
    if (season.rewardsDistributed) {
      const newSeason = createDefaultSeason();
      set({ currentSeason: newSeason });
      get().saveArenaData();
      return { seasonChanged: true };
    }

    const leaderboard = get().getLeaderboard(100);
    const myPosition = leaderboard.findIndex(e => e.playerId === profile.playerId) + 1;

    const finalRank = profile.currentRank;
    const earnedFrames: string[] = [];
    for (const frame of AFR) {
      const frameRankIndex = RC.findIndex(r => r.tier === frame.minRank);
      const currentRankIndex = RC.findIndex(r => r.tier === finalRank);
      if (currentRankIndex >= frameRankIndex && !profile.unlockedAvatarFrames.includes(frame.id)) {
        earnedFrames.push(frame.id);
      }
    }

    const decayRate = season.pointDecayRate || 50;
    const rankDecayApplied = Math.min(decayRate * 2, Math.floor(profile.rankPoints * 0.2));
    const nextSeasonPoints = Math.max(0, profile.rankPoints - rankDecayApplied);

    const result: SeasonResult = {
      seasonId: season.seasonId,
      playerId: profile.playerId,
      finalRank,
      finalPoints: profile.rankPoints,
      finalPosition: myPosition || leaderboard.length,
      rewards: {
        avatarFrames: earnedFrames,
        gold: Math.floor(profile.rankPoints / 10) + (myPosition <= 10 ? 500 : myPosition <= 50 ? 200 : 50),
      },
      rankDecayApplied,
      nextSeasonStartingPoints: nextSeasonPoints,
    };

    const updatedProfile = {
      ...profile,
      rankPoints: nextSeasonPoints,
      currentRank: getRankByPoints(nextSeasonPoints).tier,
      currentStars: 0,
      winStreak: 0,
      seasonsPlayed: profile.seasonsPlayed + 1,
      unlockedAvatarFrames: [...profile.unlockedAvatarFrames, ...earnedFrames],
    };

    const updatedSeason = { ...season, rewardsDistributed: true };
    const newSeason = createDefaultSeason();
    const newResults = [result, ...get().seasonResults];

    set({
      currentProfile: updatedProfile,
      currentSeason: newSeason,
      seasonResults: newResults,
    });

    saveArenaToStorage({
      currentSeason: newSeason,
      seasonResults: newResults,
    });

    return { seasonChanged: true, result };
  },

  executeScheduledTasks: () => {
    const transition = get().checkSeasonTransition();

    const tasks = get().pendingTasks;
    const now = Date.now();
    const completedTasks: ScheduledTask[] = [];
    const remainingTasks: ScheduledTask[] = [];

    for (const task of tasks) {
      if (now >= task.executeAt && !task.isCompleted) {
        switch (task.taskType) {
          case 'season_end':
            get().checkSeasonTransition();
            break;
          case 'point_decay':
            const profile = get().currentProfile;
            if (profile) {
              const decay = task.payload?.amount || 50;
              const newPoints = Math.max(0, profile.rankPoints - decay);
              const updated = {
                ...profile,
                rankPoints: newPoints,
                currentRank: getRankByPoints(newPoints).tier,
              };
              set({ currentProfile: updated });
            }
            break;
        }
        task.isCompleted = true;
        task.completedAt = now;
        completedTasks.push(task);
      } else {
        remainingTasks.push(task);
      }
    }

    set({ pendingTasks: remainingTasks });
    saveArenaToStorage({
      pendingTasks: remainingTasks,
      lastTaskCheck: now,
    });
  },

  forceEndCurrentSeason: () => {
    const season = get().currentSeason;
    if (!season) return;

    const updatedSeason = { ...season, endDate: Date.now() - 1000, isActive: false };
    set({ currentSeason: updatedSeason });
    saveArenaToStorage({ currentSeason: updatedSeason });

    setTimeout(() => get().checkSeasonTransition(), 100);
  },

  getAvatarFrameById: (frameId: string): AvatarFrameReward | undefined => {
    return AFR.find(f => f.id === frameId);
  },

  equipAvatarFrame: (frameId: string | null) => {
    const profile = get().currentProfile;
    if (!profile) return;

    if (frameId && !profile.unlockedAvatarFrames.includes(frameId)) return;

    const updated = { ...profile, equippedAvatarFrame: frameId };
    set({ currentProfile: updated });
    get().saveArenaData();
  },

  cleanupOldBattles: (daysToKeep: number = 30) => {
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const filtered = get().battleHistory.filter(b => b.startedAt >= cutoff);
    set({ battleHistory: filtered });
    get().saveArenaData();
  },

  calculatePointsChange: (opponentPoints: number, result: BattleRecord['result']): number => {
    const profile = get().currentProfile;
    const myPoints = profile?.rankPoints || 0;

    const ratingDiff = opponentPoints - myPoints;
    const kFactor = myPoints < 1000 ? 40 : myPoints < 2000 ? 32 : myPoints < 3000 ? 24 : 20;
    const expectedScore = 1 / (1 + Math.pow(10, ratingDiff / 400));

    let actualScore = 0;
    let baseChange = 0;

    switch (result) {
      case 'attacker_win':
        actualScore = 1;
        baseChange = WPB;
        break;
      case 'defender_win':
        actualScore = 0;
        baseChange = -LPB;
        break;
      case 'draw':
        actualScore = 0.5;
        baseChange = DPB;
        break;
      case 'timeout':
        actualScore = 0;
        baseChange = -Math.floor(LPB * 1.5);
        break;
    }

    const eloChange = Math.round(kFactor * (actualScore - expectedScore));
    let totalChange = baseChange + eloChange;

    if (result === 'attacker_win' && profile) {
      const streakBonus = Math.min(profile.winStreak * WSB, MWSB);
      totalChange += streakBonus;
    }

    return Math.max(-50, Math.min(80, totalChange));
  },

  saveArenaData: () => {
    const { currentProfile, currentSeason, battleHistory, seasonResults, pendingTasks, leaderboard } = get();
    saveArenaToStorage({
      profile: currentProfile,
      currentSeason,
      battleHistory,
      seasonResults,
      pendingTasks,
      customLeaderboard: leaderboard,
      lastTaskCheck: Date.now(),
    });
  },

  loadArenaData: () => {
    get().initializeArena();
  },

  resetCurrentBattle: () => {
    set({ currentBattle: null, activeReplay: null, isP2PBattle: false, p2pIsHost: false, p2pBattleController: null });
  },

  startP2PBattle: (controller: any, isHost: boolean) => {
    const battleState = controller.getBattleState();
    if (!battleState) return;

    set({
      currentBattle: battleState,
      isP2PBattle: true,
      p2pIsHost: isHost,
      p2pBattleController: controller,
      error: null,
    });
  },

  finishP2PBattle: (result: BattleRecord['result'], replayData?: BattleReplayData, peerProfile?: ArenaPlayerProfile) => {
    const battle = get().currentBattle;
    const profile = get().currentProfile;
    const season = get().currentSeason;
    const isP2P = get().isP2PBattle;
    const isHost = get().p2pIsHost;

    if (!battle || !profile) return;

    const peerPoints = peerProfile?.rankPoints || profile.rankPoints;

    let attackerPointsChange = 0;
    let defenderPointsChange = 0;

    if (isP2P && season?.isActive) {
      if (result === 'attacker_win') {
        attackerPointsChange = get().calculatePointsChange(peerPoints, 'attacker_win');
        defenderPointsChange = -get().calculatePointsChange(profile.rankPoints, 'defender_win');
      } else if (result === 'defender_win') {
        attackerPointsChange = -get().calculatePointsChange(peerPoints, 'defender_win');
        defenderPointsChange = get().calculatePointsChange(profile.rankPoints, 'attacker_win');
      } else if (result === 'draw') {
        attackerPointsChange = DPB;
        defenderPointsChange = DPB;
      } else if (result === 'timeout') {
        attackerPointsChange = -LPB;
        defenderPointsChange = WPB;
      }
    }

    const myPointsChange = isHost ? attackerPointsChange : defenderPointsChange;
    const newRankStars = isP2P && season?.isActive ? get().updateRankPoints(myPointsChange) : null;

    const record: BattleRecord = {
      battleId: battle.battleId,
      seasonId: season?.seasonId || 'unknown',
      attackerPlayerId: isHost ? profile.playerId : peerProfile?.playerId || 'unknown',
      attackerName: isHost ? profile.playerName : peerProfile?.playerName || '对手',
      defenderPlayerId: isHost ? peerProfile?.playerId || 'unknown' : profile.playerId,
      defenderName: isHost ? peerProfile?.playerName || '对手' : profile.playerName,
      defenderLoadoutId: 'p2p_loadout',
      battleCode: battle.battleCode,
      result,
      attackerHpRemaining: isHost ? battle.playerHp : battle.enemyHp,
      defenderHpRemaining: isHost ? battle.enemyHp : battle.playerHp,
      totalTurns: battle.turn,
      durationMs: Date.now() - battle.battleStartTime,
      startedAt: battle.battleStartTime,
      endedAt: Date.now(),
      attackerPointsChange,
      defenderPointsChange,
      isRated: isP2P && !!season?.isActive,
      replayData: replayData || (battle.isRecordingReplay ? {
        battleId: battle.battleId,
        defenderLoadoutSnapshot: get().currentLoadout || createDefaultLoadout(''),
        attackerSpells: battle.playerSpells.map(s => s.id),
        initialState: {
          attackerHp: battle.playerMaxHp,
          defenderHp: battle.enemyMaxHp,
          attackerMaxHp: battle.playerMaxHp,
          defenderMaxHp: battle.enemyMaxHp,
        },
        actions: battle.replayActions,
        finalState: {
          attackerHp: battle.playerHp,
          defenderHp: battle.enemyHp,
          result,
        },
        recordedAt: Date.now(),
        isP2P: true,
        hostPlayerId: isHost ? profile.playerId : peerProfile?.playerId,
        clientPlayerId: isHost ? peerProfile?.playerId : profile.playerId,
      } : null),
      timeoutSide: result === 'timeout' ? (isHost ? 'attacker' : 'defender') : undefined,
      isP2P: true,
    };

    const updatedHistory = [record, ...get().battleHistory].slice(0, 100);

    try {
      if (result === 'attacker_win' && isHost) {
        useAchievementStore.getState().recordPVPWin();
      } else if (result === 'defender_win' && !isHost) {
        useAchievementStore.getState().recordPVPWin();
      }
    } catch { /* non-critical */ }

    set({
      battleHistory: updatedHistory,
      currentBattle: { ...battle, isFinished: true, battleStatus: result === 'attacker_win' ? 'victory' : 'defeat' },
    });
    get().saveArenaData();
  },
}));
