import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { Clock, Swords, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TurnInfo: React.FC = () => {
  const { turn, isPlayerTurn, enemy, currentLevelId, returnToMenu } = useGameStore();
  const navigate = useNavigate();

  const handleBack = () => {
    returnToMenu();
    navigate('/');
  };

  return (
    <div className="game-card p-4">
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-game-card-hover hover:bg-game-card transition-colors"
        >
          <ArrowLeft size={20} />
          <span>返回菜单</span>
        </button>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-game-gold" />
            <span className="font-bold">回合 {turn}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Swords size={20} className={isPlayerTurn ? 'text-green-400' : 'text-red-400'} />
            <span className={isPlayerTurn ? 'text-green-400' : 'text-red-400'}>
              {isPlayerTurn ? '你的回合' : '敌方回合'}
            </span>
          </div>
          
          {enemy && (
            <div className="flex items-center gap-2 text-orange-400">
              <span>⚠️ 下次攻击: {enemy.attackPattern[enemy.currentAttackIndex]} 伤害</span>
            </div>
          )}
        </div>
        
        <div className="text-game-gold font-display text-lg">
          关卡 {currentLevelId}
        </div>
      </div>
    </div>
  );
};
