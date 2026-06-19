import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBattlePassStore } from '../store/useBattlePassStore';
import {
  BATTLE_PASS_REWARDS,
  BATTLE_PASS_MAX_LEVEL,
  BATTLE_PASS_EXP_PER_LEVEL,
  DAILY_QUEST_POOL,
  WEEKLY_QUEST_POOL,
  QUALITY_COLORS,
} from '../types';
import type { QuestProgress, QuestDefinition } from '../types';
import { Home, Trophy, Target, Calendar, Gift, Lock, Check, ChevronRight } from 'lucide-react';

type TabType = 'quests' | 'rewards' | 'season';

export const BattlePassPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    data,
    currentSeason,
    notifications,
    load,
    claimQuest,
    claimLevelReward,
    dismissNotification,
    getExpToNextLevel,
  } = useBattlePassStore();

  const [activeTab, setActiveTab] = useState<TabType>('quests');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        notifications.forEach(n => dismissNotification(n.id));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notifications, dismissNotification]);

  const dailyQuestsWithDefs = data.dailyQuests.map(progress => ({
    progress,
    definition: DAILY_QUEST_POOL.find(d => d.id === progress.questId),
  })).filter(item => item.definition) as { progress: QuestProgress; definition: QuestDefinition }[];

  const weeklyQuestsWithDefs = data.weeklyQuests.map(progress => ({
    progress,
    definition: WEEKLY_QUEST_POOL.find(d => d.id === progress.questId),
  })).filter(item => item.definition) as { progress: QuestProgress; definition: QuestDefinition }[];

  const expPercent = (data.currentExp / BATTLE_PASS_EXP_PER_LEVEL) * 100;

  const formatTimeUntilRefresh = (lastRefresh: number, intervalMs: number): string => {
    const nextRefresh = lastRefresh + intervalMs;
    const remaining = Math.max(0, nextRefresh - Date.now());
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时${minutes}分钟`;
  };

  const renderQuestCard = (progress: QuestProgress, definition: QuestDefinition) => {
    const isCompleted = progress.status === 'completed';
    const isClaimed = progress.status === 'claimed';
    const progressPercent = (progress.current / progress.target) * 100;

    return (
      <div
        key={progress.questId}
        className={`game-card p-4 transition-all duration-300 ${
          isClaimed ? 'opacity-60' : ''
        } ${isCompleted && !isClaimed ? 'ring-2 ring-game-gold/50' : ''}`}
      >
        <div className="flex items-start gap-4">
          <div className="text-3xl">{definition.icon}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white">{definition.name}</h4>
              <span className="text-sm text-game-gold font-medium">+{definition.expReward} EXP</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">{definition.description}</p>
            <div className="mt-3">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>进度</span>
                <span>{progress.current} / {progress.target}</span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, progressPercent)}%`,
                    backgroundColor: isCompleted ? '#fbbf24' : '#3b82f6',
                  }}
                />
              </div>
            </div>
            <div className="mt-3">
              {isClaimed ? (
                <div className="flex items-center justify-center gap-2 text-gray-500 py-2">
                  <Check size={16} />
                  <span className="text-sm">已领取</span>
                </div>
              ) : isCompleted ? (
                <button
                  onClick={() => claimQuest(progress.questId)}
                  className="w-full py-2 rounded-lg bg-game-gold text-black font-bold text-sm hover:bg-yellow-400 transition-colors"
                >
                  领取奖励
                </button>
              ) : (
                <div className="text-center text-gray-500 text-sm py-2">
                  进行中...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestsTab = () => (
    <div className="space-y-6">
      <div className="game-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-game-gold font-display flex items-center gap-2">
            <Target size={20} />
            日常任务
          </h3>
          <span className="text-sm text-gray-400">
            刷新: {formatTimeUntilRefresh(data.lastDailyRefresh, 24 * 60 * 60 * 1000)}
          </span>
        </div>
        <div className="space-y-3">
          {dailyQuestsWithDefs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无日常任务</div>
          ) : (
            dailyQuestsWithDefs.map(({ progress, definition }) =>
              renderQuestCard(progress, definition)
            )
          )}
        </div>
      </div>

      <div className="game-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-game-gold font-display flex items-center gap-2">
            <Calendar size={20} />
            周常任务
          </h3>
          <span className="text-sm text-gray-400">
            刷新: {formatTimeUntilRefresh(data.lastWeeklyRefresh, 7 * 24 * 60 * 60 * 1000)}
          </span>
        </div>
        <div className="space-y-3">
          {weeklyQuestsWithDefs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无周常任务</div>
          ) : (
            weeklyQuestsWithDefs.map(({ progress, definition }) =>
              renderQuestCard(progress, definition)
            )
          )}
        </div>
      </div>
    </div>
  );

  const renderRewardsTab = () => {
    const rewardsByLevel: Record<number, typeof BATTLE_PASS_REWARDS> = {};
    BATTLE_PASS_REWARDS.forEach(reward => {
      if (!rewardsByLevel[reward.level]) rewardsByLevel[reward.level] = [];
      rewardsByLevel[reward.level].push(reward);
    });

    return (
      <div className="game-card p-6">
        <h3 className="text-lg font-bold text-game-gold mb-6 font-display flex items-center gap-2">
          <Gift size={20} />
          通行证奖励
        </h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {Array.from({ length: BATTLE_PASS_MAX_LEVEL }, (_, i) => i + 1).map(level => {
            const rewards = rewardsByLevel[level] || [];
            const isUnlocked = data.level >= level;
            const isClaimed = data.claimedLevels.includes(level);
            const hasPremiumReward = rewards.some(r => r.isPremium);

            return (
              <div
                key={level}
                className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-200 cursor-pointer hover:bg-white/5 ${
                  isUnlocked ? 'opacity-100' : 'opacity-50'
                }`}
                onClick={() => setSelectedLevel(selectedLevel === level ? null : level)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  isUnlocked ? 'bg-game-gold/20 text-game-gold' : 'bg-gray-700 text-gray-500'
                }`}>
                  {level}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  {rewards.slice(0, 2).map((reward, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        reward.isPremium && !data.premiumUnlocked
                          ? 'bg-purple-900/30 text-purple-400'
                          : 'bg-gray-700/50 text-gray-300'
                      }`}
                    >
                      <span>{reward.icon}</span>
                      <span className="truncate max-w-[80px]">{reward.name}</span>
                      {reward.isPremium && <Lock size={12} />}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {isClaimed ? (
                    <Check size={18} className="text-green-500" />
                  ) : isUnlocked ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        claimLevelReward(level);
                      }}
                      className="px-3 py-1 text-xs rounded bg-game-gold/20 text-game-gold hover:bg-game-gold/30 transition-colors"
                    >
                      领取
                    </button>
                  ) : (
                    <Lock size={16} className="text-gray-600" />
                  )}
                  <ChevronRight size={16} className={`text-gray-600 transition-transform ${
                    selectedLevel === level ? 'rotate-90' : ''
                  }`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSeasonTab = () => {
    const daysRemaining = Math.ceil((currentSeason.endDate - Date.now()) / (24 * 60 * 60 * 1000));
    const seasonProgress = Math.min(100, ((Date.now() - currentSeason.startDate) / (currentSeason.endDate - currentSeason.startDate)) * 100);

    return (
      <div className="space-y-6">
        <div className="game-card p-6">
          <h3 className="text-lg font-bold text-game-gold mb-4 font-display flex items-center gap-2">
            <Trophy size={20} />
            {currentSeason.name}
          </h3>
          <p className="text-gray-400 mb-4">{currentSeason.description}</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">赛季进度</span>
                <span className="text-white">{daysRemaining} 天剩余</span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-game-gold to-yellow-400 rounded-full"
                  style={{ width: `${seasonProgress}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-game-bg-dark rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-game-gold">{data.level}</div>
                <div className="text-sm text-gray-400">当前等级</div>
              </div>
              <div className="bg-game-bg-dark rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{data.totalExpEarned}</div>
                <div className="text-sm text-gray-400">累计经验</div>
              </div>
            </div>
          </div>
        </div>

        <div className="game-card p-6">
          <h4 className="font-bold text-white mb-3">赛季奖励预览</h4>
          <div className="grid grid-cols-5 gap-2">
            {[10, 20, 30, 40, 50].map(level => {
              const rewards = BATTLE_PASS_REWARDS.filter(r => r.level === level && !r.isPremium);
              const isUnlocked = data.level >= level;
              return (
                <div
                  key={level}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center p-2 ${
                    isUnlocked ? 'bg-game-gold/20' : 'bg-gray-800'
                  }`}
                >
                  <div className="text-2xl mb-1">
                    {rewards[0]?.icon || '🎁'}
                  </div>
                  <div className={`text-xs ${isUnlocked ? 'text-game-gold' : 'text-gray-500'}`}>
                    Lv.{level}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!data.premiumUnlocked && (
          <div className="game-card p-6 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30">
            <div className="flex items-center gap-4">
              <div className="text-4xl">👑</div>
              <div className="flex-1">
                <h4 className="font-bold text-white text-lg">升级高级通行证</h4>
                <p className="text-sm text-gray-400 mt-1">解锁全部奖励，获得专属装扮</p>
              </div>
              <button className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm hover:from-purple-600 hover:to-pink-600 transition-all">
                升级
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-game-bg text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/menu')}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Home size={24} />
          </button>
          <h1 className="text-2xl font-bold font-display text-game-gold">赛季通行证</h1>
          <div className="w-10" />
        </div>

        <div className="game-card p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-game-gold to-amber-600 flex items-center justify-center text-3xl font-bold text-black">
              {data.level}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg">{currentSeason.name}</span>
                <span className="text-game-gold font-medium">{getExpToNextLevel()} EXP 升级</span>
              </div>
              <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-game-gold to-yellow-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, expPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Lv.{data.level}</span>
                <span>Lv.{Math.min(data.level + 1, BATTLE_PASS_MAX_LEVEL)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { key: 'quests', label: '任务', icon: Target },
            { key: 'rewards', label: '奖励', icon: Gift },
            { key: 'season', label: '赛季', icon: Trophy },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`flex-1 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === tab.key
                  ? 'bg-game-gold text-black'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'quests' && renderQuestsTab()}
        {activeTab === 'rewards' && renderRewardsTab()}
        {activeTab === 'season' && renderSeasonTab()}
      </div>

      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className="game-card p-4 flex items-center gap-3 animate-pulse"
              style={{ minWidth: '200px' }}
            >
              <div className="text-2xl">
                {notif.type === 'level_up' ? '⬆️' : notif.type === 'quest_complete' ? '✅' : '🎉'}
              </div>
              <div>
                <div className="font-medium text-white">{notif.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
