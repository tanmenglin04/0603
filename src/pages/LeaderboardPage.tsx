import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArenaStore } from '../store/useArenaStore';
import {
  RANK_CONFIGS,
  AVATAR_FRAME_REWARDS,
  getRankByPoints,
  DEFENDER_AI_STYLE_NAMES,
  SPELLS,
  ELEMENT_COLORS,
  ELEMENT_ICONS,
} from '../types';
import type {
  LeaderboardEntry,
  RankTier,
  DefenderAIStyle,
  AvatarFrameReward,
  RankConfig,
} from '../types';
import {
  ArrowLeft,
  Trophy,
  Crown,
  Medal,
  Flame,
  Target,
  Swords,
  TrendingUp,
  Calendar,
  Shield,
  Zap,
  X,
  Heart,
  Bot,
  ChevronDown,
  ChevronUp,
  Star,
  Award,
} from 'lucide-react';

type TabType = 'points' | 'wins' | 'streak';
type FilterType = 'all' | RankTier;

const getRankConfig = (tier: RankTier | string): RankConfig =>
  RANK_CONFIGS.find((r) => r.tier === tier) || RANK_CONFIGS[0];

const rankFilterOptions: { value: FilterType; label: string; tier?: RankTier }[] = [
  { value: 'all', label: '全部' },
  { value: 'bronze', label: '青铜', tier: 'bronze' },
  { value: 'silver', label: '白银', tier: 'silver' },
  { value: 'gold', label: '黄金', tier: 'gold' },
  { value: 'platinum', label: '铂金', tier: 'platinum' },
  { value: 'diamond', label: '钻石', tier: 'diamond' },
  { value: 'master', label: '大师', tier: 'master' },
  { value: 'grandmaster', label: '宗师', tier: 'grandmaster' },
  { value: 'king', label: '王者', tier: 'king' },
  { value: 'legend', label: '传奇', tier: 'legend' },
];

interface DefenderInfo {
  name: string;
  avatar: string;
  avatarFrame: string | null;
  rank: RankTier;
  points: number;
  aiStyle: DefenderAIStyle;
  spells: string[];
  maxHp: number;
  wins: number;
  losses: number;
  winStreak: number;
}

const mockDefenderData: Record<string, DefenderInfo> = {
  bot_1: {
    name: '龙王敖广',
    avatar: '🐉',
    avatarFrame: 'frame_legend',
    rank: 'legend',
    points: 5200,
    aiStyle: 'tactical',
    spells: ['fireball', 'thunder-strike', 'water-heal', 'vine-whip'],
    maxHp: 320,
    wins: 156,
    losses: 23,
    winStreak: 12,
  },
  bot_2: {
    name: '剑仙李白',
    avatar: '⚔️',
    avatarFrame: 'frame_king',
    rank: 'king',
    points: 3950,
    aiStyle: 'aggressive',
    spells: ['fireball', 'thunder-strike', 'fireball', 'thunder-strike'],
    maxHp: 280,
    wins: 142,
    losses: 35,
    winStreak: 5,
  },
  bot_3: {
    name: '圣者孔明',
    avatar: '🔮',
    avatarFrame: 'frame_grandmaster',
    rank: 'grandmaster',
    points: 3050,
    aiStyle: 'balanced',
    spells: ['water-heal', 'vine-whip', 'fireball', 'thunder-strike'],
    maxHp: 300,
    wins: 128,
    losses: 44,
    winStreak: 3,
  },
  bot_4: {
    name: '战神吕布',
    avatar: '🛡️',
    avatarFrame: 'frame_master',
    rank: 'master',
    points: 2380,
    aiStyle: 'aggressive',
    spells: ['fireball', 'thunder-strike', 'vine-whip', 'fireball'],
    maxHp: 260,
    wins: 115,
    losses: 58,
    winStreak: 0,
  },
  bot_5: {
    name: '医仙华佗',
    avatar: '💊',
    avatarFrame: 'frame_diamond',
    rank: 'diamond',
    points: 1680,
    aiStyle: 'defensive',
    spells: ['water-heal', 'vine-whip', 'water-heal', 'vine-whip'],
    maxHp: 350,
    wins: 98,
    losses: 72,
    winStreak: 2,
  },
  bot_6: {
    name: '狂战士',
    avatar: '🗡️',
    avatarFrame: 'frame_platinum',
    rank: 'platinum',
    points: 1050,
    aiStyle: 'aggressive',
    spells: ['fireball', 'fireball', 'thunder-strike', 'thunder-strike'],
    maxHp: 240,
    wins: 85,
    losses: 80,
    winStreak: 0,
  },
  bot_7: {
    name: '暗影刺客',
    avatar: '🗡️',
    avatarFrame: 'frame_gold',
    rank: 'gold',
    points: 680,
    aiStyle: 'tactical',
    spells: ['thunder-strike', 'fireball', 'vine-whip', 'water-heal'],
    maxHp: 220,
    wins: 72,
    losses: 88,
    winStreak: 1,
  },
  bot_8: {
    name: '元素法师',
    avatar: '✨',
    avatarFrame: 'frame_silver',
    rank: 'silver',
    points: 320,
    aiStyle: 'balanced',
    spells: ['fireball', 'water-heal', 'vine-whip', 'thunder-strike'],
    maxHp: 200,
    wins: 58,
    losses: 95,
    winStreak: 0,
  },
  bot_9: {
    name: '新手勇者',
    avatar: '🛡️',
    avatarFrame: 'frame_bronze',
    rank: 'bronze',
    points: 85,
    aiStyle: 'random',
    spells: ['fireball', 'water-heal', 'vine-whip', 'thunder-strike'],
    maxHp: 180,
    wins: 32,
    losses: 110,
    winStreak: 0,
  },
};

export const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentProfile,
    currentSeason,
    leaderboard,
    initializeArena,
    getLeaderboard,
    getAvatarFrameById,
  } = useArenaStore();

  const [activeTab, setActiveTab] = useState<TabType>('points');
  const [rankFilter, setRankFilter] = useState<FilterType>('all');
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardEntry | null>(null);
  const [showDefenderModal, setShowDefenderModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    initializeArena();
  }, [initializeArena]);

  const fullLeaderboard = useMemo(() => {
    const board = getLeaderboard(100);
    let sorted = [...board];
    switch (activeTab) {
      case 'wins':
        sorted.sort((a, b) => b.wins - a.wins || b.rankPoints - a.rankPoints);
        break;
      case 'streak':
        sorted.sort((a, b) => b.winStreak - a.winStreak || b.rankPoints - a.rankPoints);
        break;
      case 'points':
      default:
        sorted.sort((a, b) => b.rankPoints - a.rankPoints);
    }
    sorted.forEach((e, i) => { e.rank = i + 1; });
    return sorted;
  }, [leaderboard, activeTab, getLeaderboard]);

  const filteredLeaderboard = useMemo(() => {
    if (rankFilter === 'all') return fullLeaderboard;
    return fullLeaderboard.filter((e) => e.tier === rankFilter);
  }, [fullLeaderboard, rankFilter]);

  const myEntry = useMemo(() => {
    if (!currentProfile) return null;
    return fullLeaderboard.find((e) => e.playerId === currentProfile.playerId);
  }, [fullLeaderboard, currentProfile]);

  const otherEntries = useMemo(() => {
    if (!myEntry) return filteredLeaderboard;
    return filteredLeaderboard;
  }, [filteredLeaderboard, myEntry]);

  const seasonDaysRemaining = useMemo(() => {
    if (!currentSeason) return 0;
    const now = Date.now();
    return Math.max(0, Math.ceil((currentSeason.endDate - now) / (24 * 60 * 60 * 1000)));
  }, [currentSeason]);

  const seasonProgressPercent = useMemo(() => {
    if (!currentSeason) return 0;
    const total = currentSeason.endDate - currentSeason.startDate;
    const elapsed = Date.now() - currentSeason.startDate;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [currentSeason]);

  const getRankIconForPosition = (rank: number) => {
    if (rank === 1) return <Crown size={24} className="text-yellow-400 fill-yellow-400" />;
    if (rank === 2) return <Medal size={24} className="text-gray-300 fill-gray-300" />;
    if (rank === 3) return <Award size={24} className="text-orange-400 fill-orange-400" />;
    return <span className="text-gray-400 font-bold text-lg w-8 text-center">{rank}</span>;
  };

  const getRowBgClass = (rank: number, isMe: boolean) => {
    if (isMe) return 'bg-game-gold/10 border border-game-gold/50 hover:bg-game-gold/20';
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/15 to-transparent hover:from-yellow-500/25 border-l-4 border-yellow-400';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300/15 to-transparent hover:from-gray-300/25 border-l-4 border-gray-300';
    if (rank === 3) return 'bg-gradient-to-r from-orange-500/15 to-transparent hover:from-orange-500/25 border-l-4 border-orange-400';
    return 'hover:bg-game-card-hover border-l-4 border-transparent';
  };

  const handleViewDefender = (entry: LeaderboardEntry) => {
    setSelectedPlayer(entry);
    setShowDefenderModal(true);
  };

  const defenderInfo = useMemo(() => {
    if (!selectedPlayer) return null;
    const mock = mockDefenderData[selectedPlayer.playerId];
    if (mock) return mock;
    return {
      name: selectedPlayer.playerName,
      avatar: selectedPlayer.avatar,
      avatarFrame: selectedPlayer.avatarFrame,
      rank: selectedPlayer.tier,
      points: selectedPlayer.rankPoints,
      aiStyle: 'balanced' as DefenderAIStyle,
      spells: ['fireball', 'water-heal', 'vine-whip', 'thunder-strike'],
      maxHp: 200,
      wins: selectedPlayer.wins,
      losses: selectedPlayer.losses,
      winStreak: selectedPlayer.winStreak,
    } as DefenderInfo;
  }, [selectedPlayer]);

  const defenderFrame: AvatarFrameReward | undefined = defenderInfo?.avatarFrame
    ? getAvatarFrameById(defenderInfo.avatarFrame)
    : undefined;

  return (
    <div className="min-h-screen w-full overflow-auto p-4 md:p-6 bg-game-bg">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/arena')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-game-card border border-game-gold/30 text-gray-300 hover:text-game-gold hover:border-game-gold/60 transition-all"
          >
            <ArrowLeft size={20} />
            <span>返回竞技场</span>
          </button>
          <div className="flex items-center gap-2 text-game-gold font-display text-xl md:text-2xl">
            <Trophy size={28} />
            <span>段位排行榜</span>
          </div>
          <div className="w-32" />
        </div>

        <div className="game-card p-4 md:p-6 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 bg-gradient-to-br from-game-gold via-purple-500 to-blue-500" />
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-game-gold/30 to-purple-500/30 flex items-center justify-center border border-game-gold/40">
                  <Calendar size={28} className="text-game-gold" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white font-display">
                    {currentSeason?.name || '当前赛季'}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {currentSeason?.description || '本赛季奖励丰厚，冲击高段位领取专属头像框！'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 md:gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-yellow-400 mb-1">
                    <Flame size={16} className="animate-pulse" />
                    <span className="text-2xl md:text-3xl font-black font-display">{seasonDaysRemaining}</span>
                    <span className="text-sm text-gray-400">天</span>
                  </div>
                  <div className="text-xs text-gray-500">剩余天数</div>
                </div>
                <div className="hidden md:block w-px h-12 bg-game-gold/20" />
                <div className="hidden md:block text-center">
                  <div className="text-xl md:text-2xl font-bold text-game-gold mb-1">
                    {RANK_CONFIGS.length}
                  </div>
                  <div className="text-xs text-gray-500">段位等级</div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-gray-400">赛季进度</span>
                <span className="text-game-gold font-bold">{Math.round(seasonProgressPercent)}%</span>
              </div>
              <div className="w-full h-2.5 bg-game-bg-dark rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${seasonProgressPercent}%`,
                    background: 'linear-gradient(90deg, #d4af37, #a855f7, #3b82f6)',
                    boxShadow: '0 0 15px rgba(212, 175, 55, 0.5)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {myEntry && (
          <div
            onClick={() => handleViewDefender(myEntry)}
            className="game-card p-4 mb-6 border-2 border-game-gold/50 cursor-pointer hover:border-game-gold transition-all group relative overflow-hidden"
          >
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-game-gold/20 border border-game-gold/40 text-game-gold text-xs font-bold flex items-center gap-1">
              <Star size={12} className="fill-game-gold" />
              我的排名
            </div>
            <div className="flex items-center gap-4 pr-24">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-game-gold/20 flex items-center justify-center shrink-0 border-2 border-game-gold">
                {myEntry.rank <= 3 ? (
                  getRankIconForPosition(myEntry.rank)
                ) : (
                  <span className="text-game-gold font-black text-2xl md:text-3xl font-display">
                    {myEntry.rank}
                  </span>
                )}
              </div>

              <div
                className="relative w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0"
                style={{
                  border: myEntry.avatarFrame
                    ? `3px solid ${getAvatarFrameById(myEntry.avatarFrame)?.borderColor || '#d4af37'}`
                    : '3px solid #d4af37',
                  background: getAvatarFrameById(myEntry.avatarFrame)?.bgColor || 'linear-gradient(135deg, #2d2d44 0%, #1a0b2e 100%)',
                }}
              >
                <span className="text-2xl md:text-3xl">{myEntry.avatar}</span>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white text-lg md:text-xl mb-1 flex items-center gap-2">
                  {myEntry.playerName}
                  <ChevronDown size={16} className="text-gray-500 group-hover:text-game-gold transition-colors md:ml-auto" />
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      background: `${getRankConfig(myEntry.tier).color}20`,
                      border: `1px solid ${getRankConfig(myEntry.tier).color}60`,
                    }}
                  >
                    <span>{getRankConfig(myEntry.tier).icon}</span>
                    <span className="text-sm font-bold" style={{ color: getRankConfig(myEntry.tier).color }}>
                      {getRankConfig(myEntry.tier).name}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400 flex items-center gap-1">
                    <Target size={14} className="text-game-gold" />
                    <span className="text-game-gold font-bold">{myEntry.rankPoints}</span> 积分
                  </span>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-6 shrink-0">
                <div className="text-center">
                  <div className="text-green-400 font-bold text-lg">{myEntry.wins}</div>
                  <div className="text-xs text-gray-500">胜场</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-bold text-lg">{myEntry.losses}</div>
                  <div className="text-xs text-gray-500">负场</div>
                </div>
                <div className="text-center">
                  <div className="text-game-gold font-bold text-lg">{myEntry.winRate}%</div>
                  <div className="text-xs text-gray-500">胜率</div>
                </div>
                {myEntry.winStreak > 0 && (
                  <div className="text-center">
                    <div className="text-orange-400 font-bold text-lg flex items-center justify-center gap-1">
                      <Flame size={16} />
                      {myEntry.winStreak}
                    </div>
                    <div className="text-xs text-gray-500">连胜</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="game-card p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 -mx-1 px-1">
              {[
                { key: 'points' as TabType, label: '积分排行', icon: TrendingUp },
                { key: 'wins' as TabType, label: '胜场排行', icon: Swords },
                { key: 'streak' as TabType, label: '连胜排行', icon: Flame },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-game-gold text-game-bg-dark shadow-lg shadow-game-gold/30'
                        : 'bg-game-bg-dark text-gray-400 hover:text-gray-200 hover:bg-game-card-hover'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="md:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-game-bg-dark text-gray-300 border border-game-gold/30"
            >
              <Shield size={16} />
              段位筛选
              {showMobileFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex flex-wrap gap-2`}>
              {rankFilterOptions.map((opt) => {
                const isActive = rankFilter === opt.value;
                const rankColor = opt.tier ? getRankConfig(opt.tier).color : undefined;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setRankFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      isActive
                        ? 'text-white shadow-lg'
                        : 'bg-game-bg-dark text-gray-400 hover:text-gray-200 border border-transparent hover:border-game-gold/30'
                    }`}
                    style={
                      isActive && rankColor
                        ? {
                            background: rankColor,
                            boxShadow: `0 0 10px ${rankColor}60`,
                          }
                        : isActive
                        ? { background: '#d4af37', color: '#1a0b2e' }
                        : {}
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-game-gold/10">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-game-bg-dark/80 text-xs text-gray-400 uppercase tracking-wider sticky top-0">
                  <th className="text-left px-4 py-3 font-bold">排名</th>
                  <th className="text-left px-4 py-3 font-bold">玩家</th>
                  <th className="text-left px-4 py-3 font-bold">段位</th>
                  <th className="text-right px-4 py-3 font-bold">积分</th>
                  <th className="text-right px-4 py-3 font-bold">胜/负</th>
                  <th className="text-right px-4 py-3 font-bold">胜率</th>
                  <th className="text-right px-4 py-3 font-bold">连胜</th>
                  <th className="text-right px-4 py-3 font-bold">阵容</th>
                </tr>
              </thead>
              <tbody>
                {otherEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-500">
                      <Trophy size={48} className="mx-auto mb-3 opacity-30" />
                      <div>该段位暂无玩家</div>
                    </td>
                  </tr>
                ) : (
                  otherEntries.map((entry) => {
                    const isMe = entry.playerId === currentProfile?.playerId;
                    const rankCfg = getRankConfig(entry.tier);
                    const frame = entry.avatarFrame ? getAvatarFrameById(entry.avatarFrame) : undefined;
                    return (
                      <tr
                        key={entry.playerId}
                        className={`border-t border-game-gold/5 transition-all cursor-pointer ${getRowBgClass(entry.rank, isMe)}`}
                        onClick={() => handleViewDefender(entry)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {getRankIconForPosition(entry.rank)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                border: frame ? `2.5px solid ${frame.borderColor}` : '2.5px solid rgba(255,255,255,0.1)',
                                background: frame?.bgColor || 'linear-gradient(135deg, #2d2d44 0%, #1a0b2e 100%)',
                              }}
                            >
                              <span className="text-xl">{entry.avatar}</span>
                            </div>
                            <div className="min-w-0">
                              <div className={`font-bold truncate ${isMe ? 'text-game-gold' : 'text-white'}`}>
                                {entry.playerName}
                                {isMe && <span className="ml-1 text-xs">(我)</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{
                              background: `${rankCfg.color}15`,
                              border: `1px solid ${rankCfg.color}40`,
                            }}
                          >
                            <span className="text-base">{rankCfg.icon}</span>
                            <span className="text-sm font-bold" style={{ color: rankCfg.color }}>
                              {rankCfg.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-game-gold font-bold text-lg font-display flex items-center justify-end gap-1">
                            <Target size={14} />
                            {entry.rankPoints}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2 text-sm">
                            <span className="text-green-400 font-bold">{entry.wins}</span>
                            <span className="text-gray-600">/</span>
                            <span className="text-red-400 font-bold">{entry.losses}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-bold text-sm ${
                              entry.winRate >= 70
                                ? 'text-green-400'
                                : entry.winRate >= 50
                                ? 'text-yellow-400'
                                : 'text-gray-400'
                            }`}
                          >
                            {entry.winRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {entry.winStreak > 0 ? (
                            <span className="inline-flex items-center gap-1 text-orange-400 font-bold text-sm">
                              <Flame size={14} className="animate-pulse" />
                              {entry.winStreak}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDefender(entry);
                            }}
                          >
                            <Shield size={12} />
                            查看
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredLeaderboard.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <span>
                显示 {filteredLeaderboard.length} 名玩家
                {rankFilter !== 'all' && ` (${getRankConfig(rankFilter).name}段位)`}
              </span>
              <span>数据更新于 实时</span>
            </div>
          )}
        </div>

        {showDefenderModal && defenderInfo && selectedPlayer && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="game-card p-6 w-full max-w-lg animate-pop-in max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <h3 className="text-xl font-bold text-game-gold font-display flex items-center gap-2">
                  <Shield size={24} />
                  防守阵容详情
                </h3>
                <button
                  onClick={() => setShowDefenderModal(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6 p-4 bg-game-bg-dark rounded-xl border border-game-gold/20">
                <div
                  className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    border: defenderFrame ? `4px solid ${defenderFrame.borderColor}` : '4px solid #d4af37',
                    background: defenderFrame?.bgColor || 'linear-gradient(135deg, #2d2d44 0%, #1a0b2e 100%)',
                    boxShadow: defenderFrame ? `0 0 25px ${defenderFrame.borderColor}60` : '0 0 20px rgba(212,175,55,0.3)',
                  }}
                >
                  <span className="text-3xl md:text-4xl">{defenderInfo.avatar}</span>
                  {defenderFrame && (
                    <div
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-sm"
                      style={{
                        background: defenderFrame.bgColor,
                        border: `2px solid ${defenderFrame.borderColor}`,
                      }}
                    >
                      {defenderFrame.icon}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white text-xl mb-1 truncate">
                    {defenderInfo.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{
                        background: `${getRankConfig(defenderInfo.rank).color}20`,
                        border: `1px solid ${getRankConfig(defenderInfo.rank).color}60`,
                      }}
                    >
                      <span>{getRankConfig(defenderInfo.rank).icon}</span>
                      <span className="text-sm font-bold" style={{ color: getRankConfig(defenderInfo.rank).color }}>
                        {getRankConfig(defenderInfo.rank).name}
                      </span>
                    </div>
                    <span className="text-sm text-game-gold font-bold flex items-center gap-1">
                      <Target size={14} />
                      {defenderInfo.points} 分
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-game-bg-dark rounded-lg p-3 text-center">
                  <div className="text-green-400 font-bold text-xl mb-0.5">{defenderInfo.wins}</div>
                  <div className="text-xs text-gray-500">总胜场</div>
                </div>
                <div className="bg-game-bg-dark rounded-lg p-3 text-center">
                  <div className="text-red-400 font-bold text-xl mb-0.5">{defenderInfo.losses}</div>
                  <div className="text-xs text-gray-500">总负场</div>
                </div>
                <div className="bg-game-bg-dark rounded-lg p-3 text-center">
                  {defenderInfo.winStreak > 0 ? (
                    <>
                      <div className="text-orange-400 font-bold text-xl mb-0.5 flex items-center justify-center gap-1">
                        <Flame size={16} />
                        {defenderInfo.winStreak}
                      </div>
                      <div className="text-xs text-gray-500">当前连胜</div>
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 font-bold text-xl mb-0.5">-</div>
                      <div className="text-xs text-gray-500">连胜中断</div>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={18} className="text-purple-400" />
                  <h5 className="font-bold text-white">AI 防守风格</h5>
                </div>
                <div className="bg-gradient-to-r from-purple-500/15 to-transparent rounded-xl p-4 border border-purple-500/30">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/30 flex items-center justify-center">
                      <Bot size={22} className="text-purple-300" />
                    </div>
                    <div>
                      <div className="font-bold text-purple-300">
                        {DEFENDER_AI_STYLE_NAMES[defenderInfo.aiStyle]}
                      </div>
                      <div className="text-xs text-gray-500">
                        {defenderInfo.aiStyle === 'aggressive' && '优先高伤害，不惜牺牲血量'}
                        {defenderInfo.aiStyle === 'defensive' && '注重治疗防御，后发制人'}
                        {defenderInfo.aiStyle === 'balanced' && '攻守兼备，灵活应变'}
                        {defenderInfo.aiStyle === 'tactical' && '追求最大收益，战术大师'}
                        {defenderInfo.aiStyle === 'random' && '随机应变，难以预测'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={18} className="text-game-gold" />
                  <h5 className="font-bold text-white">携带法术</h5>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {defenderInfo.spells.map((spellId, idx) => {
                    const spell = SPELLS.find((s) => s.id === spellId);
                    if (!spell) {
                      return (
                        <div key={idx} className="bg-game-bg-dark rounded-xl p-3 border border-gray-600/30 text-center">
                          <div className="text-3xl mb-1 opacity-30">❓</div>
                          <div className="text-xs text-gray-500">未知</div>
                        </div>
                      );
                    }
                    const color = ELEMENT_COLORS[spell.element];
                    return (
                      <div
                        key={idx}
                        className="bg-game-bg-dark rounded-xl p-3 border transition-all hover:scale-105"
                        style={{ borderColor: `${color}40` }}
                      >
                        <div
                          className="w-12 h-12 mx-auto rounded-xl mb-2 flex items-center justify-center"
                          style={{
                            background: `${color}20`,
                            border: `1px solid ${color}40`,
                          }}
                        >
                          <span className="text-2xl">{spell.icon}</span>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-white truncate mb-0.5">{spell.name}</div>
                          <div className="flex items-center justify-center gap-1 text-xs">
                            <span style={{ color }}>{ELEMENT_ICONS[spell.element]}</span>
                            <span className="text-gray-500">{spell.cost}</span>
                          </div>
                          {spell.damage > 0 && (
                            <div className="text-[10px] text-red-400 mt-0.5">伤害 {spell.damage}</div>
                          )}
                          {spell.heal > 0 && (
                            <div className="text-[10px] text-green-400 mt-0.5">治疗 {spell.heal}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Heart size={18} className="text-red-400" />
                  <h5 className="font-bold text-white">生命上限</h5>
                </div>
                <div className="bg-game-bg-dark rounded-xl p-4 border border-red-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">防守方生命值</span>
                    <span className="text-white font-bold text-xl font-display flex items-center gap-1">
                      <Heart size={18} className="text-red-400 fill-red-400" />
                      {defenderInfo.maxHp}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-game-bg rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                      style={{
                        width: '100%',
                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-game-gold/20 flex gap-3">
                <button
                  onClick={() => setShowDefenderModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg bg-game-bg-dark border border-gray-600 text-gray-300 hover:bg-gray-700/30 transition-colors font-bold"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
