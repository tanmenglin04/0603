import type {
  ScheduledTask,
  SeasonInfo,
  ArenaPlayerProfile,
  SeasonResult,
  AvatarFrameReward,
  RANK_CONFIGS,
  AVATAR_FRAME_REWARDS,
} from '../types';
import {
  RANK_CONFIGS as RC,
  AVATAR_FRAME_REWARDS as AFR,
  POINT_DECAY_RATE_PER_WEEK,
} from '../types';

const SEASON_SCHEDULE_KEY = 'arena_season_schedule';
const DECAY_LAST_APPLIED_KEY = 'arena_last_decay_applied';

const generateTaskId = (): string => {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
};

export const getMonthEndTimestamp = (from: number = Date.now()): number => {
  const date = new Date(from);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return lastDay.getTime();
};

export const getNextMondayTimestamp = (from: number = Date.now()): number => {
  const date = new Date(from);
  const day = date.getDay();
  const diff = day === 0 ? 7 : 7 - day;
  const nextMonday = new Date(date);
  nextMonday.setDate(date.getDate() + diff);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday.getTime();
};

export const createSeasonEndTask = (season: SeasonInfo): ScheduledTask => {
  return {
    taskId: generateTaskId(),
    taskType: 'season_end',
    executeAt: season.endDate,
    isCompleted: false,
    payload: { seasonId: season.seasonId, seasonNumber: season.seasonNumber },
    createdAt: Date.now(),
  };
};

export const createRewardDistributionTask = (season: SeasonInfo): ScheduledTask => {
  return {
    taskId: generateTaskId(),
    taskType: 'reward_distribution',
    executeAt: season.endDate + 60 * 1000,
    isCompleted: false,
    payload: { seasonId: season.seasonId, delayMs: 60000 },
    createdAt: Date.now(),
  };
};

export const createPointDecayTask = (executeAt?: number): ScheduledTask => {
  return {
    taskId: generateTaskId(),
    taskType: 'point_decay',
    executeAt: executeAt || getNextMondayTimestamp(),
    isCompleted: false,
    payload: {
      amount: POINT_DECAY_RATE_PER_WEEK,
      appliesToMinRank: 'gold',
      recursive: true,
      intervalMs: 7 * 24 * 60 * 60 * 1000,
    },
    createdAt: Date.now(),
  };
};

export const calculateSeasonRewards = (
  profile: ArenaPlayerProfile,
  finalPosition: number
): SeasonResult['rewards'] => {
  const earnedFrames: string[] = [];

  for (const frame of AFR) {
    const frameRankIndex = RC.findIndex((r) => r.tier === frame.minRank);
    const currentRankIndex = RC.findIndex((r) => r.tier === profile.currentRank);
    if (currentRankIndex >= frameRankIndex && !profile.unlockedAvatarFrames.includes(frame.id)) {
      earnedFrames.push(frame.id);
    }
  }

  let goldReward = 100;
  goldReward += Math.floor(profile.rankPoints / 8);

  if (finalPosition <= 1) goldReward += 5000;
  else if (finalPosition <= 3) goldReward += 3000;
  else if (finalPosition <= 10) goldReward += 1500;
  else if (finalPosition <= 50) goldReward += 500;
  else if (finalPosition <= 100) goldReward += 200;

  goldReward += profile.totalWins * 5;

  if (profile.winStreak >= 10) goldReward += 200;
  if (profile.bestWinStreak >= 20) goldReward += 500;

  return {
    avatarFrames: earnedFrames,
    gold: goldReward,
  };
};

export const calculateRankDecay = (
  profile: ArenaPlayerProfile,
  decayRate: number = POINT_DECAY_RATE_PER_WEEK
): { newPoints: number; decayApplied: number } => {
  const goldRank = RC.find((r) => r.tier === 'gold');
  if (!goldRank || profile.rankPoints < goldRank.minPoints) {
    return { newPoints: profile.rankPoints, decayApplied: 0 };
  }

  const maxDecay = Math.floor(profile.rankPoints * 0.15);
  const actualDecay = Math.min(decayRate, maxDecay);
  const newPoints = Math.max(goldRank.minPoints - 1, profile.rankPoints - actualDecay);

  return {
    newPoints,
    decayApplied: profile.rankPoints - newPoints,
  };
};

export const calculateNextSeasonStartingPoints = (
  finalPoints: number,
  decayApplied: number
): number => {
  const base = Math.max(0, finalPoints - decayApplied);
  const softResetFloor = RC.find((r) => r.tier === 'silver')?.minPoints || 150;
  return Math.max(softResetFloor, Math.floor(base * 0.7));
};

export const generateSeasonResults = (
  season: SeasonInfo,
  profile: ArenaPlayerProfile,
  finalPosition: number
): SeasonResult => {
  const rewards = calculateSeasonRewards(profile, finalPosition);
  const { decayApplied } = calculateRankDecay(profile, season.pointDecayRate);
  const nextSeasonPoints = calculateNextSeasonStartingPoints(profile.rankPoints, decayApplied);

  return {
    seasonId: season.seasonId,
    playerId: profile.playerId,
    finalRank: profile.currentRank,
    finalPoints: profile.rankPoints,
    finalPosition,
    rewards,
    rankDecayApplied: decayApplied,
    nextSeasonStartingPoints: nextSeasonPoints,
  };
};

export const buildSeasonSchedule = (season: SeasonInfo): ScheduledTask[] => {
  const tasks: ScheduledTask[] = [];

  tasks.push(createSeasonEndTask(season));
  tasks.push(createRewardDistributionTask(season));

  let decayTime = getNextMondayTimestamp(season.startDate);
  while (decayTime < season.endDate) {
    tasks.push(createPointDecayTask(decayTime));
    decayTime += 7 * 24 * 60 * 60 * 1000;
  }

  return tasks;
};

export const saveSchedule = (tasks: ScheduledTask[]): void => {
  try {
    localStorage.setItem(SEASON_SCHEDULE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error('Failed to save schedule:', error);
  }
};

export const loadSchedule = (): ScheduledTask[] => {
  try {
    const data = localStorage.getItem(SEASON_SCHEDULE_KEY);
    if (data) return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load schedule:', error);
  }
  return [];
};

export const getLastDecayDate = (): number => {
  try {
    const data = localStorage.getItem(DECAY_LAST_APPLIED_KEY);
    return data ? parseInt(data, 10) : 0;
  } catch {
    return 0;
  }
};

export const setLastDecayDate = (date: number): void => {
  try {
    localStorage.setItem(DECAY_LAST_APPLIED_KEY, date.toString());
  } catch {}
};

export const shouldApplyWeeklyDecay = (): boolean => {
  const last = getLastDecayDate();
  if (!last) return true;
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - last >= oneWeek;
};

export const getSeasonProgress = (season: SeasonInfo): {
  progress: number;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
} => {
  const now = Date.now();
  const total = season.endDate - season.startDate;
  const elapsed = Math.min(now, season.endDate) - season.startDate;
  const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const totalDays = Math.ceil(total / (24 * 60 * 60 * 1000));
  const daysElapsed = Math.floor(elapsed / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, Math.ceil((season.endDate - now) / (24 * 60 * 60 * 1000)));

  return { progress, daysRemaining, daysElapsed, totalDays };
};

export const formatSeasonDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

export class SeasonScheduler {
  private checkInterval: number | null = null;

  start(onTaskDue: (tasks: ScheduledTask[]) => void) {
    this.stop();

    this.checkInterval = window.setInterval(() => {
      const tasks = loadSchedule();
      const now = Date.now();
      const dueTasks = tasks.filter((t) => !t.isCompleted && t.executeAt <= now);

      if (dueTasks.length > 0) {
        onTaskDue(dueTasks);

        const updated = tasks.map((t) => {
          if (dueTasks.find((d) => d.taskId === t.taskId)) {
            return { ...t, isCompleted: true, completedAt: now };
          }
          if (t.taskType === 'point_decay' && t.payload?.recursive) {
            const lastExecuted = dueTasks.find((d) => d.taskId === t.taskId)?.completedAt;
            if (lastExecuted) {
              const interval = t.payload.intervalMs || 7 * 24 * 60 * 60 * 1000;
              return {
                ...t,
                isCompleted: false,
                executeAt: lastExecuted + interval,
                completedAt: now,
              };
            }
          }
          return t;
        });

        saveSchedule(updated);
      }
    }, 30 * 1000);
  }

  stop() {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
