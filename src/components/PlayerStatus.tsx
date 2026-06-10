import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { Heart, Shield } from 'lucide-react';

export const PlayerStatus: React.FC = () => {
  const { playerHp, playerMaxHp, isPlayerTurn, battleStatus, screenShake } = useGameStore();

  const hpPercentage = (playerHp / playerMaxHp) * 100;
  
  const getHpColor = () => {
    if (hpPercentage > 60) return 'bg-green-500';
    if (hpPercentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`game-card p-6 ${screenShake && isPlayerTurn ? 'shake' : ''}`}>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-game-gold to-game-gold-light flex items-center justify-center text-4xl shadow-lg shadow-game-gold/30">
          🧙
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-game-gold font-display">
              元素法师
            </h3>
            {isPlayerTurn && battleStatus === 'playing' && (
              <div className="px-3 py-1 bg-green-500 rounded-full text-sm animate-pulse">
                你的回合
              </div>
            )}
          </div>
          
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-1">
                <Heart size={16} className="text-red-400" />
                生命值
              </span>
              <span className="font-bold">
                {playerHp} / {playerMaxHp}
              </span>
            </div>
            <div className="health-bar h-6">
              <div
                className={`health-bar-fill ${getHpColor()}`}
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Shield size={14} />
            <span>提示：连接3个以上同色符文可消除并获得能量</span>
          </div>
        </div>
      </div>
    </div>
  );
};
