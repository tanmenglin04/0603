import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Play, Star } from 'lucide-react';
import type { Level } from '../types';
import { getCurrentBattle, getLevelStars } from '../utils/localStorage';

interface LevelCardProps {
  level: Level;
  isUnlocked: boolean;
  highestLevel: number;
}

export const LevelCard: React.FC<LevelCardProps> = ({ level, isUnlocked, highestLevel }) => {
  const navigate = useNavigate();
  const hasSavedProgress = getCurrentBattle()?.levelId === level.id;
  const isCompleted = highestLevel >= level.id;
  const earnedStars = getLevelStars(level.id);

  const handleClick = () => {
    if (isUnlocked) {
      navigate(`/battle/${level.id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`game-card p-6 transition-all duration-300 cursor-pointer ${
        isUnlocked
          ? 'hover:scale-105 hover:shadow-game-gold/30 hover:shadow-xl'
          : 'opacity-60 cursor-not-allowed grayscale'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="text-6xl">{level.enemy.sprite}</div>
        <div className="flex items-center gap-1">
          {isCompleted && (
            <div className="flex">
              {[1, 2, 3].map((star) => (
                <Star
                  key={star}
                  size={20}
                  className={
                    star <= earnedStars
                      ? 'text-game-gold fill-game-gold'
                      : 'text-gray-600 fill-gray-600'
                  }
                />
              ))}
            </div>
          )}
          {!isUnlocked && <Lock size={24} className="text-gray-500" />}
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-game-gold mb-2 font-display">
        第 {level.id} 关：{level.name}
      </h3>
      
      <p className="text-sm text-gray-400 mb-4">{level.description}</p>
      
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-400">
          <span className="text-red-400">敌人HP: </span>
          {level.enemy.maxHp}
        </div>
        <div className="text-gray-400">
          <span className="text-green-400">玩家HP: </span>
          {level.playerMaxHp}
        </div>
      </div>
      
      {hasSavedProgress && (
        <div className="mt-4 px-3 py-2 bg-orange-500/20 border border-orange-500/50 rounded-lg text-orange-400 text-sm text-center">
          ⏳ 有未完成的战斗进度
        </div>
      )}
      
      {isUnlocked && !hasSavedProgress && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="mt-4 w-full game-button-primary flex items-center justify-center gap-2"
        >
          <Play size={20} />
          <span>开始战斗</span>
        </button>
      )}
      
      {isUnlocked && hasSavedProgress && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="mt-4 w-full game-button-primary flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-400"
        >
          <Play size={20} />
          <span>继续战斗</span>
        </button>
      )}
    </div>
  );
};
