import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkshopStore } from '../store/useWorkshopStore';
import { WORKSHOP_SORT_OPTIONS, WORKSHOP_CATEGORIES, BACKGROUNDS, DIFFICULTY_META } from '../types/workshop';
import type { WorkshopSortType, WorkshopCategory, WorkshopLevel } from '../types/workshop';
import {
  ArrowLeft,
  Search,
  Plus,
  Wrench,
  Flame,
  CheckCircle,
  Clock,
  Star,
  ThumbsUp,
  Crown,
  Eye,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

const LevelCard: React.FC<{ level: WorkshopLevel; onClick: () => void }> = ({ level, onClick }) => {
  const bg = BACKGROUNDS.find((b) => b.id === level.background);
  const diff = DIFFICULTY_META[level.difficulty];
  const clearRate = level.plays > 0 ? Math.round((level.clears / level.plays) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className="game-card p-0 overflow-hidden cursor-pointer group transition-all hover:scale-[1.02] hover:shadow-game-gold/20"
    >
      <div
        className="h-28 flex items-center justify-center relative"
        style={{
          background: `linear-gradient(135deg, ${bg?.color || '#333'}30 0%, ${bg?.color || '#333'}10 100%)`,
        }}
      >
        <span className="text-5xl group-hover:scale-110 transition-transform">{level.enemy.sprite}</span>
        {level.isFeatured && (
          <div className="absolute top-2 right-2 bg-game-gold/20 border border-game-gold/50 rounded-full px-2 py-0.5 flex items-center gap-1">
            <Crown size={12} className="text-game-gold" />
            <span className="text-[10px] text-game-gold font-medium">精选</span>
          </div>
        )}
        {level.isOfficial && (
          <div className="absolute top-2 left-2 bg-purple-500/20 border border-purple-500/50 rounded-full px-2 py-0.5 flex items-center gap-1">
            <span className="text-[10px] text-purple-300 font-medium">官方</span>
          </div>
        )}
        <div
          className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ color: diff.color, backgroundColor: diff.color + '20' }}
        >
          {diff.name}
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-gray-300 text-[10px]">
          <Eye size={10} />
          {level.plays}
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-bold text-game-gold truncate group-hover:text-game-gold-light transition-colors">
          {level.name}
        </h3>
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{level.description}</p>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="flex items-center gap-0.5">
              <ThumbsUp size={10} className="text-blue-400" />
              {level.likes}
            </span>
            <span className="flex items-center gap-0.5">
              <CheckCircle size={10} className="text-green-400" />
              {clearRate}%
            </span>
            <span className="flex items-center gap-0.5">
              <Star size={10} className="text-yellow-400" />
              {level.averageRating > 0 ? level.averageRating.toFixed(1) : '-'}
            </span>
          </div>
          <span className="text-[10px] text-gray-500">
            {bg?.icon} {bg?.name}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-game-gold/10">
          <span className="text-xs text-gray-500">{level.authorName}</span>
          <span className="text-[10px] text-gray-600">{level.gridSize}×{level.gridSize}</span>
        </div>
      </div>
    </div>
  );
};

const SORT_ICONS: Record<WorkshopSortType, React.ReactNode> = {
  hot: <Flame size={14} />,
  clear_rate: <CheckCircle size={14} />,
  newest: <Clock size={14} />,
  rating: <Star size={14} />,
};

export const WorkshopPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    sortType,
    category,
    searchQuery,
    setSortType,
    setCategory,
    setSearchQuery,
    getFilteredLevels,
    load,
  } = useWorkshopStore();

  const [searchInput, setSearchInput] = useState(searchQuery);

  useEffect(() => {
    load();
  }, [load]);

  const levels = useMemo(() => getFilteredLevels(), [sortType, category, searchQuery, load]);

  const featuredLevels = useMemo(() => {
    return levels.filter((l) => l.isFeatured || l.isOfficial).slice(0, 3);
  }, [levels]);

  const hotLevels = useMemo(() => {
    if (searchQuery || category !== 'all') return [];
    return [...levels]
      .filter((l) => !l.isFeatured && !l.isOfficial)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 4);
  }, [levels, searchQuery, category]);

  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  return (
    <div className="min-h-screen w-full overflow-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="game-button-secondary flex items-center gap-2 px-4 py-2"
            >
              <ArrowLeft size={18} />
              <span>主菜单</span>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-game-gold font-display">创意工坊</h1>
              <p className="text-gray-400 text-sm mt-0.5">挑战玩家自制关卡，或发布你的创作</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/workshop/editor')}
            className="game-button-primary flex items-center gap-2 px-5 py-2.5"
          >
            <Wrench size={18} />
            <span>创建关卡</span>
          </button>
        </div>

        <div className="game-card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1 relative w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索关卡名称、描述、作者..."
                className="w-full bg-game-bg-dark border border-game-gold/30 rounded-lg pl-10 pr-4 py-2 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-game-gold"
              />
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {WORKSHOP_SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortType(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                    sortType === opt.value
                      ? 'bg-game-gold/20 text-game-gold border border-game-gold/50'
                      : 'bg-game-bg-dark text-gray-400 border border-game-gold/10 hover:border-game-gold/30'
                  }`}
                >
                  {SORT_ICONS[opt.value]}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5 mt-3 flex-wrap">
            {WORKSHOP_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  category === cat.value
                    ? 'bg-game-gold/20 text-game-gold border border-game-gold/50'
                    : 'text-gray-400 border border-transparent hover:text-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {levels.length === 0 ? (
          <div className="game-card p-12 text-center">
            <div className="text-6xl mb-4">🏗️</div>
            <h2 className="text-xl font-bold text-game-gold mb-2">暂无关卡</h2>
            <p className="text-gray-400 mb-6">成为第一个创建关卡的人吧！</p>
            <button
              onClick={() => navigate('/workshop/editor')}
              className="game-button-primary flex items-center gap-2 mx-auto px-6 py-3"
            >
              <Plus size={18} />
              <span>创建关卡</span>
            </button>
          </div>
        ) : (
          <>
            {featuredLevels.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Crown size={20} className="text-game-gold" />
                  <h2 className="text-xl font-bold text-game-gold font-display">官方精选</h2>
                  <Sparkles size={18} className="text-yellow-400" />
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featuredLevels.map((level) => (
                    <div key={level.id} className="relative">
                      <div className="absolute -top-2 -left-2 z-10 bg-gradient-to-r from-game-gold to-yellow-500 text-game-bg-dark text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                        精选推荐
                      </div>
                      <LevelCard
                        level={level}
                        onClick={() => navigate(`/workshop/level/${level.id}`)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hotLevels.length > 0 && !searchQuery && category === 'all' && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={20} className="text-orange-400" />
                  <h2 className="text-lg font-bold text-gray-200">热门关卡</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {hotLevels.map((level) => (
                    <LevelCard
                      key={level.id}
                      level={level}
                      onClick={() => navigate(`/workshop/level/${level.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-200">
                  {category === 'all' ? '全部关卡' : WORKSHOP_CATEGORIES.find(c => c.value === category)?.label}
                </h2>
                <span className="text-sm text-gray-500">共 {levels.length} 个</span>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {levels.map((level) => (
                  <LevelCard
                    key={level.id}
                    level={level}
                    onClick={() => navigate(`/workshop/level/${level.id}`)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>共 {levels.length} 个关卡 · 创意工坊让每位玩家都能成为关卡设计师</p>
        </div>
      </div>
    </div>
  );
};
