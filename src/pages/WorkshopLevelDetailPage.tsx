import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkshopStore } from '../store/useWorkshopStore';
import { BACKGROUNDS, DIFFICULTY_META } from '../types/workshop';
import { sanitizeString } from '../utils/levelValidation';
import {
  ArrowLeft,
  Play,
  ThumbsUp,
  ThumbsDown,
  Star,
  Crown,
  MessageSquare,
  Send,
  CheckCircle,
  Users,
  Clock,
  Zap,
  Heart,
  Shield,
} from 'lucide-react';

const StarRating: React.FC<{ value: number; onChange?: (v: number) => void; size?: number }> = ({
  value,
  onChange,
  size = 20,
}) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          className="transition-transform hover:scale-110"
          disabled={!onChange}
        >
          <Star
            size={size}
            className={
              i <= (hover || value)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-600'
            }
          />
        </button>
      ))}
    </div>
  );
};

export const WorkshopLevelDetailPage: React.FC = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const {
    getLevelById,
    getComments,
    addComment,
    rateLevel,
    playLevel,
    recordClear,
    likeLevel,
    dislikeLevel,
    userRatings,
    userLikeDislike,
    load,
  } = useWorkshopStore();

  useEffect(() => {
    load();
  }, [load]);

  const level = levelId ? getLevelById(levelId) : undefined;
  const comments = levelId ? getComments(levelId) : [];
  const userRating = levelId ? userRatings[levelId] || 0 : 0;
  const userLikeState = levelId ? userLikeDislike[levelId] || null : null;

  const [commentText, setCommentText] = useState('');
  const [commentRating, setCommentRating] = useState(0);
  const [activeSection, setActiveSection] = useState<'info' | 'comments'>('info');

  if (!level) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl text-game-gold mb-2">关卡未找到</h2>
          <button onClick={() => navigate('/workshop')} className="game-button-primary px-6 py-2 mt-4">
            返回工坊
          </button>
        </div>
      </div>
    );
  }

  const bg = BACKGROUNDS.find((b) => b.id === level.background);
  const diff = DIFFICULTY_META[level.difficulty];
  const clearRate = level.plays > 0 ? Math.round((level.clears / level.plays) * 100) : 0;

  const handlePlay = () => {
    playLevel(level.id);
    navigate('/workshop/trial', { state: { level } });
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment(level.id, commentText, commentRating);
    setCommentText('');
    setCommentRating(0);
  };

  const ELEMENT_EMOJI: Record<string, string> = { fire: '🔥', water: '💧', grass: '🌿', thunder: '⚡' };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}天前`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="min-h-screen w-full overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/workshop')}
          className="game-button-secondary flex items-center gap-2 px-4 py-2 mb-6"
        >
          <ArrowLeft size={18} />
          <span>返回工坊</span>
        </button>

        <div
          className="game-card overflow-hidden mb-6"
          style={{
            background: `linear-gradient(180deg, ${bg?.color || '#333'}15 0%, var(--tw-gradient-from, #2d2d44) 40%)`,
          }}
        >
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6">
              <div
                className="w-32 h-32 rounded-xl flex items-center justify-center text-7xl flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${bg?.color || '#333'}30, ${bg?.color || '#333'}10)`,
                  border: `2px solid ${bg?.color || '#333'}50`,
                }}
              >
                {level.enemy.sprite}
              </div>

              <div className="flex-1">
                <div className="flex items-start gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-game-gold font-display">
                    {level.name}
                  </h1>
                  {level.isFeatured && (
                    <span className="flex items-center gap-1 bg-game-gold/20 border border-game-gold/50 rounded-full px-2 py-0.5 text-xs text-game-gold flex-shrink-0">
                      <Crown size={12} /> 精选
                    </span>
                  )}
                  {level.isOfficial && (
                    <span className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/50 rounded-full px-2 py-0.5 text-xs text-purple-300 flex-shrink-0">
                      官方
                    </span>
                  )}
                </div>
                <p className="text-gray-300 mb-4">{level.description}</p>

                <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
                  <span className="flex items-center gap-1">
                    <Users size={14} /> {level.authorName}
                  </span>
                  <span
                    className="flex items-center gap-1 font-medium"
                    style={{ color: diff.color }}
                  >
                    {diff.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> {timeAgo(level.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    {level.gridSize}×{level.gridSize}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2 bg-game-bg-dark/50 rounded-lg px-3 py-1.5">
                    <Play size={14} className="text-game-gold" />
                    <span className="text-gray-400">游玩</span>
                    <span className="text-game-gold font-bold">{level.plays}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-game-bg-dark/50 rounded-lg px-3 py-1.5">
                    <CheckCircle size={14} className="text-green-400" />
                    <span className="text-gray-400">通关率</span>
                    <span className="text-green-400 font-bold">{clearRate}%</span>
                  </div>
                  <div className="flex items-center gap-2 bg-game-bg-dark/50 rounded-lg px-3 py-1.5">
                    <Star size={14} className="text-yellow-400" />
                    <span className="text-gray-400">评分</span>
                    <span className="text-yellow-400 font-bold">
                      {level.averageRating > 0 ? level.averageRating.toFixed(1) : '-'}
                    </span>
                    <span className="text-gray-500 text-xs">({level.ratingCount})</span>
                  </div>
                  <div className="flex items-center gap-2 bg-game-bg-dark/50 rounded-lg px-3 py-1.5">
                    <ThumbsUp size={14} className="text-blue-400" />
                    <span className="text-blue-400 font-bold">{level.likes}</span>
                    <ThumbsDown size={14} className="text-gray-500 ml-1" />
                    <span className="text-gray-500">{level.dislikes}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handlePlay} className="game-button-primary flex items-center gap-2 px-6 py-3">
                <Play size={18} />
                <span>挑战关卡</span>
              </button>
              <button
                onClick={() => likeLevel(level.id)}
                className={`game-button-secondary flex items-center gap-2 px-4 py-3 transition-all ${
                  userLikeState === 'like'
                    ? 'text-white bg-blue-500/40 border-blue-400'
                    : 'text-blue-400 border-blue-400/30 hover:bg-blue-500/20'
                }`}
              >
                <ThumbsUp size={16} className={userLikeState === 'like' ? 'fill-current' : ''} />
                <span>{userLikeState === 'like' ? '已点赞' : '点赞'}</span>
              </button>
              <button
                onClick={() => dislikeLevel(level.id)}
                className={`game-button-secondary flex items-center gap-2 px-4 py-3 transition-all ${
                  userLikeState === 'dislike'
                    ? 'text-white bg-gray-500/40 border-gray-400'
                    : 'text-gray-400 border-gray-400/30 hover:bg-gray-500/20'
                }`}
              >
                <ThumbsDown size={16} className={userLikeState === 'dislike' ? 'fill-current' : ''} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveSection('info')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === 'info' ? 'bg-game-gold/20 text-game-gold' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            关卡详情
          </button>
          <button
            onClick={() => setActiveSection('comments')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              activeSection === 'comments' ? 'bg-game-gold/20 text-game-gold' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <MessageSquare size={14} />
            评论 ({comments.length})
          </button>
        </div>

        {activeSection === 'info' && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="game-card p-5">
              <h3 className="text-game-gold font-bold mb-3 flex items-center gap-2">
                <Heart size={16} className="text-red-400" /> 敌人信息
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{level.enemy.sprite}</span>
                  <div>
                    <p className="text-lg font-bold text-gray-200">{level.enemy.name}</p>
                    <p className="text-xs text-gray-400">{level.enemy.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-game-bg-dark rounded-lg p-2">
                    <span className="text-gray-500 text-xs">生命值</span>
                    <p className="text-red-400 font-bold">{level.enemy.maxHp}</p>
                  </div>
                  <div className="bg-game-bg-dark rounded-lg p-2">
                    <span className="text-gray-500 text-xs">攻击力</span>
                    <p className="text-orange-400 font-bold">{level.enemy.attack}</p>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">元素抗性</span>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {Object.entries(level.enemy.resistance).map(([el, val]) => (
                      <span
                        key={el}
                        className={`text-xs px-2 py-1 rounded-full ${
                          (val as number) > 0
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}
                      >
                        {ELEMENT_EMOJI[el as string]}{' '}
                        {(val as number) > 0
                          ? `抗性${Math.round((val as number) * 100)}%`
                          : `弱点${Math.round(Math.abs(val as number) * 100)}%`}
                      </span>
                    ))}
                    {Object.keys(level.enemy.resistance).length === 0 && (
                      <span className="text-xs text-gray-500">无元素抗性</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">攻击模式</span>
                  <div className="flex gap-1 mt-1">
                    {level.enemy.attackPattern.map((dmg, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 bg-game-bg-dark rounded text-gray-300"
                      >
                        {dmg}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">AI策略</span>
                  <p className="text-sm text-gray-300">{level.enemy.aiConfig.priority}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="game-card p-5">
                <h3 className="text-game-gold font-bold mb-3 flex items-center gap-2">
                  <Shield size={16} className="text-blue-400" /> 关卡配置
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-game-bg-dark rounded-lg p-3">
                    <span className="text-gray-500 text-xs">棋盘尺寸</span>
                    <p className="text-game-gold font-bold">{level.gridSize}×{level.gridSize}</p>
                  </div>
                  <div className="bg-game-bg-dark rounded-lg p-3">
                    <span className="text-gray-500 text-xs">玩家生命</span>
                    <p className="text-red-400 font-bold">{level.playerMaxHp}</p>
                  </div>
                  <div className="bg-game-bg-dark rounded-lg p-3">
                    <span className="text-gray-500 text-xs">能量上限</span>
                    <p className="text-yellow-400 font-bold">{level.maxEnergy}</p>
                  </div>
                  <div className="bg-game-bg-dark rounded-lg p-3">
                    <span className="text-gray-500 text-xs">背景主题</span>
                    <p className="text-gray-200 font-bold">{bg?.icon} {bg?.name}</p>
                  </div>
                </div>
              </div>

              <div className="game-card p-5">
                <h3 className="text-game-gold font-bold mb-3 flex items-center gap-2">
                  <Zap size={16} className="text-yellow-400" /> 特殊方块与地形
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {level.specialTiles.obstacle > 0 && (
                    <div className="bg-game-bg-dark rounded-lg p-3">
                      <span className="text-gray-400">🪨 障碍石</span>
                      <p className="text-gray-200 font-bold">{level.specialTiles.obstacle}</p>
                    </div>
                  )}
                  {level.specialTiles.frozen > 0 && (
                    <div className="bg-game-bg-dark rounded-lg p-3">
                      <span className="text-blue-300">❄️ 冰霜符文</span>
                      <p className="text-gray-200 font-bold">{level.specialTiles.frozen}</p>
                    </div>
                  )}
                  {level.specialTiles.doubleEnergy > 0 && (
                    <div className="bg-game-bg-dark rounded-lg p-3">
                      <span className="text-yellow-300">⚡ 双倍能量</span>
                      <p className="text-gray-200 font-bold">{level.specialTiles.doubleEnergy}</p>
                    </div>
                  )}
                  {level.terrain.magma > 0 && (
                    <div className="bg-game-bg-dark rounded-lg p-3">
                      <span className="text-orange-300">🌋 岩浆</span>
                      <p className="text-gray-200 font-bold">{level.terrain.magma}</p>
                    </div>
                  )}
                  {level.terrain.frost > 0 && (
                    <div className="bg-game-bg-dark rounded-lg p-3">
                      <span className="text-cyan-300">❄️ 冰霜地形</span>
                      <p className="text-gray-200 font-bold">{level.terrain.frost}</p>
                    </div>
                  )}
                  {level.terrain.thorns > 0 && (
                    <div className="bg-game-bg-dark rounded-lg p-3">
                      <span className="text-green-300">🌵 荆棘</span>
                      <p className="text-gray-200 font-bold">{level.terrain.thorns}</p>
                    </div>
                  )}
                  {level.terrain.storm > 0 && (
                    <div className="bg-game-bg-dark rounded-lg p-3">
                      <span className="text-purple-300">⛈️ 雷暴</span>
                      <p className="text-gray-200 font-bold">{level.terrain.storm}</p>
                    </div>
                  )}
                </div>
                {level.tags.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {level.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-game-gold/10 text-game-gold/70 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="game-card p-5">
                <h3 className="text-game-gold font-bold mb-3 flex items-center gap-2">
                  <Star size={16} className="text-yellow-400" /> 为关卡评分
                </h3>
                <div className="flex items-center gap-3">
                  <StarRating value={userRating} onChange={(v) => rateLevel(level.id, v)} size={24} />
                  <span className="text-gray-400 text-sm">
                    {userRating > 0 ? `${userRating} 分` : '点击评分'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'comments' && (
          <div className="space-y-4">
            <div className="game-card p-5">
              <h3 className="text-game-gold font-bold mb-3">发表评论</h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gray-400 text-sm">评分:</span>
                <StarRating value={commentRating} onChange={setCommentRating} size={18} />
              </div>
              <div className="flex gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="分享你的游戏体验..."
                  className="flex-1 bg-game-bg-dark border border-game-gold/30 rounded-lg px-4 py-2 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-game-gold resize-none h-20"
                  maxLength={500}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="game-button-primary px-4 self-end disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

            {comments.length === 0 ? (
              <div className="game-card p-8 text-center">
                <MessageSquare size={48} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">暂无评论，来发表第一条吧！</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((comment) => (
                    <div key={comment.id} className="game-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-game-gold/20 flex items-center justify-center text-sm">
                          {comment.authorName[0]}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-200 text-sm">
                              {comment.authorName}
                            </span>
                            {comment.isOfficial && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                                官方
                              </span>
                            )}
                            <span className="text-xs text-gray-500">{timeAgo(comment.createdAt)}</span>
                          </div>
                          {comment.rating > 0 && (
                            <div className="flex gap-0.5 mb-1">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <Star
                                  key={i}
                                  size={10}
                                  className={
                                    i <= comment.rating
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-gray-600'
                                  }
                                />
                              ))}
                            </div>
                          )}
                          <p className="text-gray-300 text-sm">{comment.content}</p>
                          <button className="text-xs text-gray-500 mt-1 hover:text-gray-400 flex items-center gap-1">
                            <ThumbsUp size={10} /> {comment.likes}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
