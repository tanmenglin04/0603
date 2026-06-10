import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArenaStore } from '../store/useArenaStore';
import {
  ArrowLeft,
  Swords,
  Shield,
  Dumbbell,
  Trophy,
  Star,
  Flame,
  Calendar,
  TrendingUp,
  Target,
  User,
  Crown,
  Zap,
  Input,
  X,
  Play,
} from 'lucide-react';
import {
  RANK_CONFIGS,
  getRankByPoints,
  type RankTier,
  type AvatarFrameReward,
} from '../types';

const getRankConfig = (tier: RankTier) =>
  RANK_CONFIGS.find((r) => r.tier === tier) || RANK_CONFIGS[0];

const getStarsForRank = (points: number): number => {
  const rank = getRankByPoints(points);
  if (rank.tier === 'legend') return 0;
  const range = rank.maxPoints - rank.minPoints + 1;
  const stars = Math.ceil(rank.starsRequired || 5);
  const progress = points - rank.minPoints;
  return Math.min(stars, Math.floor((progress / range) * stars) + 1);
};

export const ArenaHomePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentProfile,
    currentSeason,
    battleHistory,
    initializeArena,
    createOrUpdateProfile,
    getAvatarFrameById,
    startOffensiveBattle,
    startPracticeBattle,
  } = useArenaStore();

  const [showBattleCodeModal, setShowBattleCodeModal] = useState(false);
  const [battleCode, setBattleCode] = useState('');
  const [battleCodeError, setBattleCodeError] = useState('');

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    initializeArena();

    const timer = setTimeout(() => {
      const state = useArenaStore.getState();
      if (!state.currentProfile) {
        state.createOrUpdateProfile('玩家');
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [initializeArena]);

  if (!currentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-game-gold text-xl animate-pulse">加载中...</div>
      </div>
    );
  }

  const rankConfig = getRankConfig(currentProfile.currentRank);
  const currentStars = getStarsForRank(currentProfile.rankPoints);
  const equippedFrame: AvatarFrameReward | undefined = currentProfile.equippedAvatarFrame
    ? getAvatarFrameById(currentProfile.equippedAvatarFrame)
    : undefined;

  const totalBattles = currentProfile.totalWins + currentProfile.totalLosses + currentProfile.totalDraws;
  const winRate = totalBattles > 0
    ? Math.round((currentProfile.totalWins / totalBattles) * 1000) / 10
    : 0;

  const now = Date.now();
  const seasonEnd = currentSeason?.endDate || now;
  const seasonStart = currentSeason?.startDate || now;
  const daysRemaining = Math.max(0, Math.ceil((seasonEnd - now) / (24 * 60 * 60 * 1000)));
  const seasonTotal = seasonEnd - seasonStart;
  const seasonProgress = seasonTotal > 0
    ? Math.min(100, ((now - seasonStart) / seasonTotal) * 100)
    : 0;

  const nextRankIndex = RANK_CONFIGS.findIndex((r) => r.tier === rankConfig.tier) + 1;
  const nextRank = nextRankIndex < RANK_CONFIGS.length ? RANK_CONFIGS[nextRankIndex] : null;
  const rankProgress = nextRank
    ? Math.min(100, ((currentProfile.rankPoints - rankConfig.minPoints) / (nextRank.minPoints - rankConfig.minPoints)) * 100)
    : 100;

  const handleMatchBattle = () => {
    setBattleCodeError('');
    const trimmed = battleCode.trim();
    if (!trimmed) {
      setBattleCodeError('请输入对战码');
      return;
    }
    const success = startOffensiveBattle(trimmed);
    if (success) {
      setShowBattleCodeModal(false);
      setBattleCode('');
      navigate('/arena/battle');
    } else {
      setBattleCodeError('无效的对战码或已过期');
    }
  };

  const handlePracticeMode = () => {
    startPracticeBattle();
    navigate('/arena/battle');
  };

  const renderStars = (count: number, max: number = 5) => {
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className={i < count ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full overflow-auto p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-game-card border border-game-gold/30 text-gray-300 hover:text-game-gold hover:border-game-gold/60 transition-all"
          >
            <ArrowLeft size={20} />
            <span>返回主菜单</span>
          </button>
          <div className="flex items-center gap-2 text-game-gold font-display text-xl md:text-2xl">
            <Crown size={28} className="text-game-gold animate-pulse" />
            <span>竞技场 PVP</span>
          </div>
          <div className="w-32" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="game-card p-6">
            <div className="flex flex-col items-center">
              <div
                className="relative w-28 h-28 rounded-full flex items-center justify-center mb-4"
                style={{
                  border: equippedFrame ? `4px solid ${equippedFrame.borderColor}` : '4px solid #d4af37',
                  background: equippedFrame?.bgColor || 'linear-gradient(135deg, #2d2d44 0%, #1a0b2e 100%)',
                  boxShadow: equippedFrame ? `0 0 20px ${equippedFrame.borderColor}50` : '0 0 20px rgba(212, 175, 55, 0.3)',
                }}
              >
                <span className="text-5xl">{currentProfile.avatar}</span>
                {equippedFrame && (
                  <div
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    style={{ background: equippedFrame.bgColor, border: `2px solid ${equippedFrame.borderColor}` }}
                  >
                    {equippedFrame.icon}
                  </div>
                )}
              </div>

              <h3 className="text-xl font-bold text-white mb-1">{currentProfile.playerName}</h3>

              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full mb-3"
                style={{ background: `${rankConfig.color}20`, border: `1px solid ${rankConfig.color}60` }}
              >
                <span className="text-lg">{rankConfig.icon}</span>
                <span className="font-bold" style={{ color: rankConfig.color }}>
                  {rankConfig.name}
                </span>
              </div>

              {rankConfig.tier !== 'legend' && (
                <div className="w-full mb-2">
                  {renderStars(currentStars, rankConfig.starsRequired || 5)}
                </div>
              )}

              <div className="text-game-gold font-bold text-2xl mb-1 flex items-center gap-1">
                <Target size={18} />
                {currentProfile.rankPoints} 积分
              </div>

              {currentProfile.winStreak > 0 && (
                <div className="flex items-center gap-1 text-orange-400 text-sm font-bold">
                  <Flame size={16} className="animate-pulse" />
                  <span>连胜 {currentProfile.winStreak} 场</span>
                </div>
              )}
            </div>
          </div>

          <div className="game-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={22} className="text-game-gold" />
              <h3 className="text-lg font-bold text-game-gold font-display">段位进度</h3>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">当前段位</span>
                <span className="font-bold" style={{ color: rankConfig.color }}>
                  {rankConfig.icon} {rankConfig.name}
                </span>
              </div>
              <div className="w-full h-3 bg-game-bg-dark rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${rankProgress}%`,
                    background: `linear-gradient(90deg, ${rankConfig.color}, ${rankConfig.color}aa)`,
                    boxShadow: `0 0 10px ${rankConfig.color}`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>{rankConfig.minPoints}</span>
                {nextRank ? (
                  <span>{nextRank.minPoints} → {nextRank.name}</span>
                ) : (
                  <span>已达最高段位</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-game-bg-dark rounded-lg p-3 text-center">
                <div className="text-gray-400 text-xs mb-1">最高积分</div>
                <div className="text-game-gold font-bold text-lg flex items-center justify-center gap-1">
                  <Crown size={14} />
                  {currentProfile.highestPoints}
                </div>
              </div>
              <div className="bg-game-bg-dark rounded-lg p-3 text-center">
                <div className="text-gray-400 text-xs mb-1">最高连胜</div>
                <div className="text-orange-400 font-bold text-lg flex items-center justify-center gap-1">
                  <Flame size={14} />
                  {currentProfile.bestWinStreak}
                </div>
              </div>
            </div>

            <div className="bg-game-bg-dark rounded-lg p-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">历史段位</span>
                <span
                  className="font-bold"
                  style={{ color: getRankConfig(currentProfile.highestRank).color }}
                >
                  {getRankConfig(currentProfile.highestRank).icon} {getRankConfig(currentProfile.highestRank).name}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                赛季参与: {currentProfile.seasonsPlayed} 次
              </div>
            </div>
          </div>

          <div className="game-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={22} className="text-game-gold" />
              <h3 className="text-lg font-bold text-game-gold font-display">
                {currentSeason?.name || '赛季信息'}
              </h3>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">赛季进度</span>
                <span className="text-sm text-game-gold font-bold">
                  {Math.round(seasonProgress)}%
                </span>
              </div>
              <div className="w-full h-3 bg-game-bg-dark rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-game-gold to-game-gold-light rounded-full transition-all duration-500"
                  style={{ boxShadow: '0 0 10px rgba(212, 175, 55, 0.5)' }}
                />
              </div>
            </div>

            <div className="bg-game-bg-dark rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={20} className="text-yellow-400 animate-pulse" />
                  <span className="text-gray-400">剩余天数</span>
                </div>
                <div className="text-3xl font-bold text-yellow-400 font-display">
                  {daysRemaining}
                  <span className="text-sm ml-1 text-gray-400">天</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              {currentSeason?.description || '本赛季奖励丰厚，冲击高段位领取专属头像框！'}
            </p>
          </div>
        </div>

        <div className="game-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={22} className="text-game-gold" />
            <h3 className="text-lg font-bold text-game-gold font-display">历史战绩</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-game-bg-dark rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400 mb-1">
                {currentProfile.totalWins}
              </div>
              <div className="text-gray-400 text-sm">胜利</div>
            </div>
            <div className="bg-game-bg-dark rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-400 mb-1">
                {currentProfile.totalLosses}
              </div>
              <div className="text-gray-400 text-sm">失败</div>
            </div>
            <div className="bg-game-bg-dark rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-gray-400 mb-1">
                {currentProfile.totalDraws}
              </div>
              <div className="text-gray-400 text-sm">平局</div>
            </div>
            <div className="bg-game-bg-dark rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-game-gold mb-1">
                {winRate}%
              </div>
              <div className="text-gray-400 text-sm">胜率</div>
            </div>
          </div>

          {battleHistory.length > 0 && (
            <div className="border-t border-game-gold/20 pt-4">
              <div className="text-sm text-gray-400 mb-2">最近 {Math.min(10, battleHistory.length)} 场战斗</div>
              <div className="flex flex-wrap gap-2">
                {battleHistory.slice(0, 10).map((record) => {
                  const isWin = record.result === 'attacker_win';
                  const isLoss = record.result === 'defender_win';
                  return (
                    <div
                      key={record.battleId}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                        isWin
                          ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                          : isLoss
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
                      }`}
                      title={`对手: ${record.defenderName}\n${
                        isWin ? '胜利' : isLoss ? '失败' : '平局'
                      }\n积分变化: ${record.attackerPointsChange > 0 ? '+' : ''}${record.attackerPointsChange}`}
                    >
                      {isWin ? '胜' : isLoss ? '负' : '平'}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="game-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Swords size={22} className="text-game-gold" />
            <h3 className="text-lg font-bold text-game-gold font-display">竞技入口</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/arena/loadout')}
              className="group relative overflow-hidden bg-gradient-to-br from-blue-600/20 to-blue-900/30 border-2 border-blue-500/40 rounded-xl p-5 hover:border-blue-400 hover:scale-105 transition-all duration-300 text-left"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
                  <Shield size={28} className="text-blue-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">防守阵容</h4>
                <p className="text-sm text-gray-400">配置你的防御阵容和AI策略</p>
              </div>
            </button>

            <button
              onClick={() => setShowBattleCodeModal(true)}
              className="group relative overflow-hidden bg-gradient-to-br from-orange-600/20 to-red-900/30 border-2 border-orange-500/40 rounded-xl p-5 hover:border-orange-400 hover:scale-105 transition-all duration-300 text-left"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                  <Input size={28} className="text-orange-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">匹配对战</h4>
                <p className="text-sm text-gray-400">输入对战码挑战其他玩家</p>
              </div>
            </button>

            <button
              onClick={handlePracticeMode}
              className="group relative overflow-hidden bg-gradient-to-br from-green-600/20 to-emerald-900/30 border-2 border-green-500/40 rounded-xl p-5 hover:border-green-400 hover:scale-105 transition-all duration-300 text-left"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center mb-4 group-hover:bg-green-500/30 transition-colors">
                  <Dumbbell size={28} className="text-green-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">练习模式</h4>
                <p className="text-sm text-gray-400">与AI对战，不影响积分排名</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/arena/leaderboard')}
              className="group relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-violet-900/30 border-2 border-purple-500/40 rounded-xl p-5 hover:border-purple-400 hover:scale-105 transition-all duration-300 text-left"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                  <Trophy size={28} className="text-purple-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">排行榜</h4>
                <p className="text-sm text-gray-400">查看全服玩家排名</p>
              </div>
            </button>
          </div>
        </div>

        <div className="game-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <User size={22} className="text-game-gold" />
            <h3 className="text-lg font-bold text-game-gold font-display">段位列表</h3>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
            {RANK_CONFIGS.map((rank) => {
              const isCurrent = rank.tier === currentProfile.currentRank;
              const isUnlocked = currentProfile.rankPoints >= rank.minPoints;
              return (
                <div
                  key={rank.tier}
                  className={`relative rounded-lg p-3 text-center transition-all ${
                    isCurrent
                      ? 'ring-2 ring-game-gold bg-game-gold/10 scale-105'
                      : isUnlocked
                      ? 'bg-game-bg-dark/50'
                      : 'bg-game-bg-dark/20 opacity-50'
                  }`}
                >
                  <div className="text-2xl mb-1">{rank.icon}</div>
                  <div
                    className="text-xs font-bold"
                    style={{ color: rank.color }}
                  >
                    {rank.name}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {rank.minPoints}+
                  </div>
                  {isCurrent && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-game-gold rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-game-bg-dark font-bold">你</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {showBattleCodeModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="game-card p-6 w-full max-w-md animate-pop-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-game-gold font-display flex items-center gap-2">
                  <Swords size={22} />
                  输入对战码
                </h3>
                <button
                  onClick={() => {
                    setShowBattleCodeModal(false);
                    setBattleCode('');
                    setBattleCodeError('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">对手分享的对战码</label>
                <textarea
                  value={battleCode}
                  onChange={(e) => setBattleCode(e.target.value)}
                  placeholder="粘贴或输入对战码..."
                  className="w-full h-24 px-4 py-3 rounded-lg bg-game-bg-dark border border-game-gold/30 text-white placeholder-gray-600 focus:outline-none focus:border-game-gold resize-none font-mono text-sm"
                />
                {battleCodeError && (
                  <div className="text-red-400 text-sm mt-2 flex items-center gap-1">
                    <X size={14} />
                    {battleCodeError}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBattleCodeModal(false);
                    setBattleCode('');
                    setBattleCodeError('');
                  }}
                  className="flex-1 px-4 py-3 rounded-lg bg-game-bg-dark border border-gray-600 text-gray-300 hover:bg-gray-700/30 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleMatchBattle}
                  className="flex-1 game-button-primary flex items-center justify-center gap-2"
                >
                  <Play size={18} />
                  开始对战
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
