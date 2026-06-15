import React, { useEffect, useState, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useEquipmentStore } from '../store/useEquipmentStore';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, ArrowRight, Home, Coins, Play, Download, Share2, Star } from 'lucide-react';
import levelsData from '../data/levels.json';
import type { Level, RuneEquipment, ShareCardData, HighlightType } from '../types';
import { LEVEL_GOLD_REWARD, QUALITY_NAMES, QUALITY_COLORS, ELEMENT_ICONS, ELEMENT_NAMES, HIGHLIGHT_TYPE_META } from '../types';
import { saveLevelStars } from '../utils/localStorage';
import { saveReplay } from '../utils/replayStorage';

const levels: Level[] = levelsData as Level[];

const calculateStars = (level: Level, playerHp: number): number => {
  const thresholds = level.stars;
  if (playerHp >= thresholds[0]) return 3;
  if (playerHp >= thresholds[1]) return 2;
  if (playerHp >= thresholds[2]) return 1;
  return 1;
};

export const BattleResult: React.FC = () => {
  const { battleStatus, currentLevelId, playerHp, resetBattle, returnToMenu, highestLevel, lastReplayData, lastReplayShareCards, saveCurrentReplay } = useGameStore();
  const { addReward, syncFromLS } = useEquipmentStore();
  const navigate = useNavigate();

  const [rewards, setRewards] = useState<{ gold: number; equipment: RuneEquipment[] } | null>(null);
  const [selectedCard, setSelectedCard] = useState<ShareCardData | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [replaySaved, setReplaySaved] = useState(false);

  useEffect(() => {
    if (battleStatus === 'victory' && currentLevelId && !rewards) {
      const earnedEquipment = addReward(currentLevelId);
      syncFromLS();
      const goldReward = LEVEL_GOLD_REWARD[currentLevelId] || 80;
      setRewards({ gold: goldReward, equipment: earnedEquipment });
    }
  }, [battleStatus, currentLevelId, rewards, addReward, syncFromLS]);

  useEffect(() => {
    setReplaySaved(false);
  }, [battleStatus, currentLevelId]);

  if (battleStatus !== 'victory' && battleStatus !== 'defeat') return null;

  const isVictory = battleStatus === 'victory';
  const currentLevel = levels.find(l => l.id === currentLevelId);
  const nextLevel = levels.find(l => l.id === (currentLevelId || 0) + 1);
  const hasNextLevel = nextLevel && currentLevelId && highestLevel >= currentLevelId + 1;

  const earnedStars = isVictory && currentLevel ? calculateStars(currentLevel, playerHp) : 0;

  if (isVictory && currentLevelId) {
    saveLevelStars(currentLevelId, earnedStars);
  }

  const hasReplay = !!lastReplayData;
  const hasShareCards = lastReplayShareCards && lastReplayShareCards.length > 0;

  const handleRetry = () => {
    setRewards(null);
    resetBattle();
  };

  const handleNextLevel = () => {
    if (nextLevel) {
      setRewards(null);
      returnToMenu();
      navigate(`/battle/${nextLevel.id}`);
    }
  };

  const handleReturnToMenu = () => {
    setRewards(null);
    returnToMenu();
    navigate('/');
  };

  const handleViewReplay = () => {
    navigate('/replay', { state: { fromGameStore: true } });
  };

  const handleSaveReplay = () => {
    const ok = saveCurrentReplay();
    setReplaySaved(ok);
    setTimeout(() => setReplaySaved(false), 3000);
  };

  const handleViewCard = (card: ShareCardData) => {
    setSelectedCard(card);
    setShowCardModal(true);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="game-card p-8 max-w-md w-full mx-4 animate-pop-in max-h-[90vh] overflow-y-auto">
        <div className="text-center">
          <div className={`text-8xl mb-4 ${isVictory ? 'animate-bounce' : 'animate-pulse'}`}>
            {isVictory ? '🏆' : '💀'}
          </div>
          
          <h2 className={`text-4xl font-bold mb-2 font-display ${isVictory ? 'text-game-gold' : 'text-red-500'}`}>
            {isVictory ? '胜利！' : '战败...'}
          </h2>
          
          <p className="text-gray-400 mb-6">
            {isVictory 
              ? `恭喜你通过了「${currentLevel?.name}」！` 
              : `在「${currentLevel?.name}」中战败了，再接再厉！`
            }
          </p>
          
          {isVictory && (
            <div className="mb-6">
              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3].map((star) => (
                  <span
                    key={star}
                    className={`text-4xl transition-all duration-300 ${
                      star <= earnedStars ? 'scale-100 opacity-100' : 'scale-75 opacity-30 grayscale'
                    }`}
                  >
                    ⭐
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-400">
                剩余生命: <span className="text-green-400 font-bold">{playerHp}</span> / {currentLevel?.playerMaxHp}
              </p>
            </div>
          )}

          {isVictory && rewards && (
            <div className="mb-6 game-card p-4">
              <h3 className="text-game-gold font-bold mb-3 text-sm">🎁 战斗奖励</h3>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Coins size={18} className="text-game-gold" />
                <span className="text-game-gold font-bold text-lg">+{rewards.gold} 金币</span>
              </div>
              {rewards.equipment.length > 0 && (
                <div className="space-y-2">
                  {rewards.equipment.map((eq) => (
                    <div
                      key={eq.id}
                      className="flex items-center justify-between bg-game-bg-dark/60 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span>{ELEMENT_ICONS[eq.element]}</span>
                        <span style={{ color: QUALITY_COLORS[eq.quality] }} className="font-bold text-sm">
                          {QUALITY_NAMES[eq.quality]}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {ELEMENT_NAMES[eq.element]}符文
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {eq.affixes.map((a, i) => (
                          <span key={i} className="text-xs text-gray-300">
                            {a.type === 'energy_boost' ? '⚡' : a.type === 'spell_damage' ? '⚔️' : '✨'}
                            {a.type === 'energy_boost' ? `+${a.value}` : a.type === 'spell_damage' ? `+${a.value}%` : `+${a.value}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasReplay && (
            <div className="mb-6 game-card p-4">
              <h3 className="text-game-gold font-bold mb-3 text-sm flex items-center justify-center gap-2">
                <Play size={16} />
                🎬 战斗回放与分享
              </h3>
              
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handleViewReplay}
                  className="flex-1 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-all text-sm font-bold flex items-center justify-center gap-1"
                >
                  <Play size={16} />
                  查看回放
                </button>
                <button
                  onClick={handleSaveReplay}
                  disabled={replaySaved}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-all text-sm font-bold flex items-center justify-center gap-1 ${
                    replaySaved
                      ? 'bg-green-500/20 border-green-500/40 text-green-300 cursor-default'
                      : 'bg-game-gold/20 border-game-gold/40 text-game-gold hover:bg-game-gold/30'
                  }`}
                >
                  {replaySaved ? (
                    <>
                      <span>✅</span>
                      已保存
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      保存录像
                    </>
                  )}
                </button>
              </div>

              {hasShareCards && (
                <div>
                  <div className="flex items-center gap-2 mb-2 justify-center">
                    <Share2 size={14} className="text-yellow-400" />
                    <span className="text-xs font-bold text-yellow-400">
                      高光分享卡片 ({lastReplayShareCards.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {lastReplayShareCards.slice(0, 4).map((card, i) => {
                      const meta = HIGHLIGHT_TYPE_META[card.highlightType as HighlightType];
                      return (
                        <button
                          key={i}
                          onClick={() => handleViewCard(card)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:scale-105 flex items-center gap-1"
                          style={{
                            background: `${card.primaryColor || '#d4af37'}20`,
                            borderColor: `${card.primaryColor || '#d4af37'}60`,
                            color: card.primaryColor || '#d4af37',
                          }}
                        >
                          <Star size={12} />
                          <span className="truncate max-w-[100px]">
                            {meta?.name || card.highlightName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasReplay && lastReplayData && (
                <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-500 flex items-center justify-center gap-3 flex-wrap">
                  <span>回合: {lastReplayData.totalTurns}</span>
                  <span>·</span>
                  <span>事件: {lastReplayData.events.length}</span>
                  <span>·</span>
                  <span>
                    {(
                      (JSON.stringify(lastReplayData).length * 2) /
                      1024
                    ).toFixed(1)}
                    KB
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-3">
            {isVictory && hasNextLevel && (
              <button
                onClick={handleNextLevel}
                className="w-full game-button-primary flex items-center justify-center gap-2"
              >
                <span>下一关</span>
                <ArrowRight size={20} />
              </button>
            )}
            
            <button
              onClick={handleRetry}
              className={`w-full ${isVictory ? 'game-button' : 'game-button-primary'} flex items-center justify-center gap-2 ${
                !isVictory ? '' : 'bg-game-card hover:bg-game-card-hover text-white'
              }`}
            >
              <RotateCcw size={20} />
              <span>{isVictory ? '再玩一次' : '重新挑战'}</span>
            </button>
            
            <button
              onClick={handleReturnToMenu}
              className="w-full game-button bg-game-card hover:bg-game-card-hover text-white flex items-center justify-center gap-2"
            >
              <Home size={20} />
              <span>返回菜单</span>
            </button>
          </div>
        </div>
      </div>

      {showCardModal && selectedCard && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowCardModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl border-2"
            style={{
              background: `linear-gradient(135deg, ${selectedCard.primaryColor}20 0%, #1a1a2e 50%, ${selectedCard.accentColor}20 100%)`,
              borderColor: selectedCard.primaryColor,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowCardModal(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
            >
              ✕
            </button>
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                  style={{
                    background: `${selectedCard.primaryColor}30`,
                    border: `3px solid ${selectedCard.primaryColor}`,
                    boxShadow: `0 0 30px ${selectedCard.primaryColor}60`,
                  }}
                >
                  {HIGHLIGHT_TYPE_META[selectedCard.highlightType as HighlightType]?.icon || '⭐'}
                </div>
              </div>
              <div>
                <div
                  className="text-2xl md:text-3xl font-black font-display mb-1"
                  style={{ color: selectedCard.primaryColor }}
                >
                  {selectedCard.highlightName}
                </div>
                <div className="text-gray-400 text-sm">
                  {selectedCard.enemyName} · 第{selectedCard.turnNumber}回合
                </div>
              </div>
              <div
                className="rounded-xl p-5 space-y-3"
                style={{
                  background: `${selectedCard.primaryColor}15`,
                  border: `1px solid ${selectedCard.primaryColor}40`,
                }}
              >
                {Object.entries(selectedCard.stats).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">{k}</span>
                    <span className="font-bold text-white text-lg">{v}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-white/10 text-xs text-gray-500">
                战斗ID: {selectedCard.battleId?.slice(0, 16)}
              </div>
              <div className="flex gap-2 justify-center text-xs text-gray-400 pt-1">
                <span>✨ 自动生成的高光卡片</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
