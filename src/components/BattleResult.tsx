import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useEquipmentStore } from '../store/useEquipmentStore';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, ArrowRight, Home, Coins } from 'lucide-react';
import levelsData from '../data/levels.json';
import type { Level, RuneEquipment } from '../types';
import { LEVEL_GOLD_REWARD, QUALITY_NAMES, QUALITY_COLORS, ELEMENT_ICONS, ELEMENT_NAMES } from '../types';
import { saveLevelStars } from '../utils/localStorage';

const levels: Level[] = levelsData as Level[];

const calculateStars = (level: Level, playerHp: number): number => {
  const thresholds = level.stars;
  if (playerHp >= thresholds[0]) return 3;
  if (playerHp >= thresholds[1]) return 2;
  if (playerHp >= thresholds[2]) return 1;
  return 1;
};

export const BattleResult: React.FC = () => {
  const { battleStatus, currentLevelId, playerHp, resetBattle, returnToMenu, highestLevel } = useGameStore();
  const { addReward, syncFromLS } = useEquipmentStore();
  const navigate = useNavigate();

  const [rewards, setRewards] = useState<{ gold: number; equipment: RuneEquipment[] } | null>(null);

  useEffect(() => {
    if (battleStatus === 'victory' && currentLevelId && !rewards) {
      const earnedEquipment = addReward(currentLevelId);
      syncFromLS();
      const goldReward = LEVEL_GOLD_REWARD[currentLevelId] || 80;
      setRewards({ gold: goldReward, equipment: earnedEquipment });
    }
  }, [battleStatus, currentLevelId, rewards, addReward, syncFromLS]);

  if (battleStatus !== 'victory' && battleStatus !== 'defeat') return null;

  const isVictory = battleStatus === 'victory';
  const currentLevel = levels.find(l => l.id === currentLevelId);
  const nextLevel = levels.find(l => l.id === (currentLevelId || 0) + 1);
  const hasNextLevel = nextLevel && currentLevelId && highestLevel >= currentLevelId + 1;

  const earnedStars = isVictory && currentLevel ? calculateStars(currentLevel, playerHp) : 0;

  if (isVictory && currentLevelId) {
    saveLevelStars(currentLevelId, earnedStars);
  }

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
    </div>
  );
};
