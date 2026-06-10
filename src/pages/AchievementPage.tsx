import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAchievementStore } from '../store/useAchievementStore';
import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_CATEGORY_META,
  ACHIEVEMENT_TIER_META,
  COSMETIC_REWARDS,
  ELEMENT_NAMES,
  QUALITY_NAMES,
  QUALITY_COLORS,
} from '../types';
import type { AchievementCategory, AchievementTier } from '../types';
import { Trophy, Home, Medal, ShoppingBag, BarChart3 } from 'lucide-react';

type TabType = 'stats' | 'achievements' | 'rewards';

export const AchievementPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    stats,
    progress,
    unlockedRewards,
    medalBalance,
    equippedAvatarFrame,
    equippedBoardSkin,
    equippedRuneEffect,
    notifications,
    load,
    claimAchievement,
    purchaseReward,
    equipReward,
    dismissNotification,
  } = useAchievementStore();

  const [activeTab, setActiveTab] = useState<TabType>('achievements');
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');

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

  const totalMedals = (tier: AchievementTier) => medalBalance[tier];

  const getFilteredAchievements = (): AchievementDefinition[] => {
    if (selectedCategory === 'all') return ACHIEVEMENT_DEFINITIONS;
    return ACHIEVEMENT_DEFINITIONS.filter(d => d.category === selectedCategory);
  };

  const renderProgressBar = (current: number, target: number, color: string) => {
    const pct = Math.min(100, (current / target) * 100);
    return (
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    );
  };

  const renderStatsTab = () => (
    <div className="space-y-6">
      <div className="game-card p-6">
        <h3 className="text-lg font-bold text-game-gold mb-4 font-display flex items-center gap-2">
          🔮 符文消除统计
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(stats.runesEliminated) as [string, number][]).map(([element, count]) => (
            <div key={element} className="bg-game-bg-dark rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">
                {element === 'fire' ? '🔥' : element === 'water' ? '💧' : element === 'grass' ? '🌿' : '⚡'}
              </div>
              <div className="text-2xl font-bold text-white">{count.toLocaleString()}</div>
              <div className="text-sm text-gray-400">{ELEMENT_NAMES[element as keyof typeof ELEMENT_NAMES]}符文</div>
            </div>
          ))}
        </div>
      </div>

      <div className="game-card p-6">
        <h3 className="text-lg font-bold text-game-gold mb-4 font-display flex items-center gap-2">
          📖 法术释放统计
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'fireball', name: '火球术', icon: '🔥' },
            { id: 'water-heal', name: '治愈之泉', icon: '💧' },
            { id: 'vine-whip', name: '藤蔓抽击', icon: '🌿' },
            { id: 'thunder-strike', name: '雷霆一击', icon: '⚡' },
          ].map(spell => (
            <div key={spell.id} className="bg-game-bg-dark rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">{spell.icon}</div>
              <div className="text-2xl font-bold text-white">{(stats.spellsCast[spell.id] || 0).toLocaleString()}</div>
              <div className="text-sm text-gray-400">{spell.name}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-game-bg-dark rounded-lg p-4 text-center">
          <div className="text-3xl mb-2">✨</div>
          <div className="text-2xl font-bold text-white">
            {Object.values(stats.comboSpellsCast).reduce((s, v) => s + v, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">融合法术</div>
        </div>
      </div>

      <div className="game-card p-6">
        <h3 className="text-lg font-bold text-game-gold mb-4 font-display flex items-center gap-2">
          ⚔️ 击杀统计
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(Object.entries(stats.enemiesKilled) as [string, number][]).filter(([, c]) => c > 0).length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-4">暂无击杀记录</div>
          ) : (
            (Object.entries(stats.enemiesKilled) as [string, number][])
              .filter(([, c]) => c > 0)
              .map(([type, count]) => (
                <div key={type} className="bg-game-bg-dark rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{count.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">{type}</div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="game-card p-6">
        <h3 className="text-lg font-bold text-game-gold mb-4 font-display flex items-center gap-2">
          💎 装备获得统计
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(stats.equipmentAcquired) as [string, number][]).map(([quality, count]) => (
            <div key={quality} className="bg-game-bg-dark rounded-lg p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: QUALITY_COLORS[quality as keyof typeof QUALITY_COLORS] }}>
                {count.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">{QUALITY_NAMES[quality as keyof typeof QUALITY_NAMES]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="game-card p-6">
        <h3 className="text-lg font-bold text-game-gold mb-4 font-display flex items-center gap-2">
          🏆 综合战绩
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-game-bg-dark rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.totalBattlesWon.toLocaleString()}</div>
            <div className="text-sm text-gray-400">战斗胜利</div>
          </div>
          <div className="bg-game-bg-dark rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">{stats.totalTowerFloorsCleared.toLocaleString()}</div>
            <div className="text-sm text-gray-400">秘境通关</div>
          </div>
          <div className="bg-game-bg-dark rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.totalPVPWins.toLocaleString()}</div>
            <div className="text-sm text-gray-400">PVP胜利</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAchievementCard = (def: AchievementDefinition) => {
    const prog = progress[def.id] || { currentCount: 0, completedTiers: [], claimedTiers: [] };
    const categoryMeta = ACHIEVEMENT_CATEGORY_META[def.category];

    return (
      <div key={def.id} className="game-card p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-3xl">{def.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-white">{def.name}</span>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: categoryMeta.color + '30', color: categoryMeta.color }}
              >
                {categoryMeta.name}
              </span>
            </div>
            <p className="text-sm text-gray-400">{def.description}</p>
          </div>
        </div>

        <div className="space-y-2">
          {def.tiers.map((tierConfig) => {
            const isCompleted = prog.completedTiers.includes(tierConfig.tier);
            const isClaimed = prog.claimedTiers.includes(tierConfig.tier);
            const tierMeta = ACHIEVEMENT_TIER_META[tierConfig.tier];

            return (
              <div
                key={tierConfig.tier}
                className={`p-3 rounded-lg border ${
                  isClaimed
                    ? 'border-game-gold/50 bg-game-gold/10'
                    : isCompleted
                    ? 'border-green-500/50 bg-green-500/10'
                    : 'border-gray-600 bg-gray-800/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tierMeta.icon}</span>
                    <span className="font-bold text-sm" style={{ color: tierMeta.color }}>
                      {tierConfig.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">
                      {Math.min(prog.currentCount, tierConfig.threshold).toLocaleString()} / {tierConfig.threshold.toLocaleString()}
                    </span>
                    {isClaimed && (
                      <span className="text-xs text-game-gold bg-game-gold/20 px-2 py-0.5 rounded">已领取</span>
                    )}
                    {isCompleted && !isClaimed && (
                      <button
                        onClick={() => claimAchievement(def.id, tierConfig.tier)}
                        className="text-xs bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded hover:bg-green-500/30 transition-colors"
                      >
                        领取奖章
                      </button>
                    )}
                  </div>
                </div>
                {renderProgressBar(
                  Math.min(prog.currentCount, tierConfig.threshold),
                  tierConfig.threshold,
                  isClaimed ? '#ffd700' : isCompleted ? '#22c55e' : tierMeta.color
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAchievementsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">奖章余额：</span>
          {(['bronze', 'silver', 'gold'] as AchievementTier[]).map(tier => (
            <div key={tier} className="flex items-center gap-1">
              <span>{ACHIEVEMENT_TIER_META[tier].icon}</span>
              <span className="font-bold" style={{ color: ACHIEVEMENT_TIER_META[tier].color }}>
                {totalMedals(tier)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            selectedCategory === 'all'
              ? 'bg-game-gold/20 text-game-gold border border-game-gold/50'
              : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
          }`}
        >
          全部
        </button>
        {(Object.entries(ACHIEVEMENT_CATEGORY_META) as [AchievementCategory, typeof ACHIEVEMENT_CATEGORY_META[AchievementCategory]][]).map(
          ([cat, meta]) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                selectedCategory === cat
                  ? 'border'
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }`}
              style={
                selectedCategory === cat
                  ? { backgroundColor: meta.color + '20', color: meta.color, borderColor: meta.color + '80' }
                  : undefined
              }
            >
              {meta.icon} {meta.name}
            </button>
          )
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {getFilteredAchievements().map(def => renderAchievementCard(def))}
      </div>
    </div>
  );

  const renderRewardCard = (reward: CosmeticReward) => {
    const isUnlocked = unlockedRewards.includes(reward.id);
    const canAfford = (['bronze', 'silver', 'gold'] as AchievementTier[]).every(
      tier => medalBalance[tier] >= reward.costTiers[tier]
    );
    const isEquipped =
      (reward.type === 'avatar_frame' && equippedAvatarFrame === reward.id) ||
      (reward.type === 'board_skin' && equippedBoardSkin === reward.id) ||
      (reward.type === 'rune_effect' && equippedRuneEffect === reward.id);

    const typeLabel = reward.type === 'avatar_frame' ? '头像框' : reward.type === 'board_skin' ? '棋盘皮肤' : '符文特效';

    return (
      <div
        key={reward.id}
        className={`game-card p-4 ${isEquipped ? 'ring-2 ring-game-gold' : ''}`}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="text-3xl">{reward.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-white">{reward.name}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{typeLabel}</span>
            </div>
            <p className="text-sm text-gray-400">{reward.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(['bronze', 'silver', 'gold'] as AchievementTier[]).map(tier => {
              const cost = reward.costTiers[tier];
              if (cost === 0) return null;
              const enough = medalBalance[tier] >= cost;
              return (
                <div key={tier} className={`flex items-center gap-1 text-sm ${enough ? 'text-white' : 'text-red-400'}`}>
                  <span>{ACHIEVEMENT_TIER_META[tier].icon}</span>
                  <span>{cost}</span>
                </div>
              );
            })}
          </div>

          <div>
            {isEquipped ? (
              <span className="text-xs text-game-gold bg-game-gold/20 px-3 py-1 rounded">使用中</span>
            ) : isUnlocked ? (
              <button
                onClick={() => equipReward(reward.type, reward.id)}
                className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/50 px-3 py-1 rounded hover:bg-blue-500/30 transition-colors"
              >
                装备
              </button>
            ) : canAfford ? (
              <button
                onClick={() => purchaseReward(reward.id)}
                className="text-xs bg-game-gold/20 text-game-gold border border-game-gold/50 px-3 py-1 rounded hover:bg-game-gold/30 transition-colors"
              >
                兑换
              </button>
            ) : (
              <span className="text-xs text-gray-500 bg-gray-700/50 px-3 py-1 rounded">奖章不足</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRewardsTab = () => {
    const frames = COSMETIC_REWARDS.filter(r => r.type === 'avatar_frame');
    const skins = COSMETIC_REWARDS.filter(r => r.type === 'board_skin');
    const effects = COSMETIC_REWARDS.filter(r => r.type === 'rune_effect');

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-400">奖章余额：</span>
          {(['bronze', 'silver', 'gold'] as AchievementTier[]).map(tier => (
            <div key={tier} className="flex items-center gap-1">
              <span>{ACHIEVEMENT_TIER_META[tier].icon}</span>
              <span className="font-bold" style={{ color: ACHIEVEMENT_TIER_META[tier].color }}>
                {totalMedals(tier)}
              </span>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-lg font-bold text-game-gold mb-3 font-display flex items-center gap-2">
            🖼️ 限定头像框
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {frames.map(r => renderRewardCard(r))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-game-gold mb-3 font-display flex items-center gap-2">
            🎨 棋盘皮肤
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {skins.map(r => renderRewardCard(r))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-game-gold mb-3 font-display flex items-center gap-2">
            ✨ 符文特效外观
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {effects.map(r => renderRewardCard(r))}
          </div>
        </div>
      </div>
    );
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'stats', label: '数据统计', icon: <BarChart3 size={18} /> },
    { key: 'achievements', label: '成就奖章', icon: <Medal size={18} /> },
    { key: 'rewards', label: '奖励兑换', icon: <ShoppingBag size={18} /> },
  ];

  return (
    <div className="min-h-screen w-full overflow-auto p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Trophy size={48} className="text-game-gold animate-pulse" />
            <h1 className="text-5xl font-bold text-game-gold font-display">
              成就殿堂
            </h1>
            <Trophy size={48} className="text-game-gold animate-pulse" />
          </div>
          <p className="text-xl text-gray-400 mb-2">
            记录你的战斗历程，收集荣誉奖章
          </p>
          <div className="flex items-center justify-center gap-6 mt-4">
            {(['bronze', 'silver', 'gold'] as AchievementTier[]).map(tier => (
              <div key={tier} className="flex items-center gap-2 bg-game-card px-4 py-2 rounded-lg">
                <span className="text-xl">{ACHIEVEMENT_TIER_META[tier].icon}</span>
                <span className="font-bold text-lg" style={{ color: ACHIEVEMENT_TIER_META[tier].color }}>
                  {totalMedals(tier)}
                </span>
                <span className="text-sm text-gray-400">{ACHIEVEMENT_TIER_META[tier].name}奖章</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-colors ${
                activeTab === tab.key
                  ? 'bg-game-gold/20 text-game-gold border border-game-gold/50'
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'achievements' && renderAchievementsTab()}
        {activeTab === 'rewards' && renderRewardsTab()}

        <button
          onClick={() => navigate('/')}
          className="mt-8 w-full game-button-secondary flex items-center justify-center gap-2"
        >
          <Home size={20} />
          <span>返回主菜单</span>
        </button>
      </div>

      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className="flex items-center gap-3 bg-game-card border border-game-gold/50 rounded-lg px-4 py-3 shadow-lg animate-bounce"
            >
              <span className="text-2xl">{ACHIEVEMENT_TIER_META[n.tier].icon}</span>
              <div>
                <div className="text-sm font-bold text-game-gold">成就达成！</div>
                <div className="text-sm text-white">{n.achievementName}</div>
              </div>
              <button
                onClick={() => dismissNotification(n.id)}
                className="text-gray-400 hover:text-white ml-2"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
