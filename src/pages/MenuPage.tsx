import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useEquipmentStore } from '../store/useEquipmentStore';
import { LevelCard } from '../components/LevelCard';
import levelsData from '../data/levels.json';
import type { Level } from '../types';
import { requestNotificationPermission } from '../utils/notifications';
import { Sparkles, BookOpen, Gem, Coins, Mountain } from 'lucide-react';

const levels: Level[] = levelsData as Level[];

export const MenuPage: React.FC = () => {
  const { unlockedLevels, highestLevel, loadProgress } = useGameStore();
  const { gold, load: loadEquipment } = useEquipmentStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadProgress();
    loadEquipment();
    requestNotificationPermission();
  }, [loadProgress, loadEquipment]);

  return (
    <div className="min-h-screen w-full overflow-auto p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Sparkles size={48} className="text-game-gold animate-pulse" />
            <h1 className="text-5xl font-bold text-game-gold font-display">
              符文战棋
            </h1>
            <Sparkles size={48} className="text-game-gold animate-pulse" />
          </div>
          <p className="text-xl text-gray-400 mb-2">
            三消 × 战棋 融合策略游戏
          </p>
          <p className="text-gray-500">
            连接消除符文，积累元素能量，释放法术击败敌人！
          </p>
        </div>

        <div className="game-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen size={24} className="text-game-gold" />
            <h2 className="text-xl font-bold text-game-gold font-display">
              游戏说明
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="bg-game-bg-dark rounded-lg p-4">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-bold text-game-gold mb-2">连接符文</h3>
              <p className="text-gray-400">
                滑动连接3个以上同色符文进行消除，连接越长获得的能量越多
              </p>
            </div>
            <div className="bg-game-bg-dark rounded-lg p-4">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-bold text-game-gold mb-2">积累能量</h3>
              <p className="text-gray-400">
                消除不同颜色的符文获得对应元素能量，用于释放法术
              </p>
            </div>
            <div className="bg-game-bg-dark rounded-lg p-4">
              <div className="text-3xl mb-2">💥</div>
              <h3 className="font-bold text-game-gold mb-2">释放法术</h3>
              <p className="text-gray-400">
                消耗能量释放法术攻击敌人或治疗自己，注意敌人的元素抗性！
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-game-gold font-display">
              选择关卡
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 bg-game-card px-4 py-2 rounded-lg">
                <Coins size={18} className="text-game-gold" />
                <span className="text-game-gold font-bold">{gold}</span>
              </div>
              <button
                onClick={() => navigate('/tower')}
                className="game-button-secondary flex items-center gap-2 px-4 py-2 bg-purple-500/20 border-purple-500/50 hover:bg-purple-500/30"
              >
                <Mountain size={18} />
                <span>大秘境</span>
              </button>
              <button
                onClick={() => navigate('/equipment')}
                className="game-button-primary flex items-center gap-2 px-4 py-2"
              >
                <Gem size={18} />
                <span>符文装备</span>
              </button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {levels.map((level) => (
              <LevelCard
                key={level.id}
                level={level}
                isUnlocked={unlockedLevels.includes(level.id)}
                highestLevel={highestLevel}
              />
            ))}
          </div>
        </div>

        <div className="text-center text-gray-500 text-sm">
          <p>元素克制关系：🔥火克🌿草，🌿草克💧水，💧水克🔥火，⚡雷克💧水</p>
          <p className="mt-2">提示：利用元素克制可以造成更高伤害！</p>
        </div>
      </div>
    </div>
  );
};
