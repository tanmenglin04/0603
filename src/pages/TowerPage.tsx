import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTowerStore } from '../store/useTowerStore';
import { TOWER_TOTAL_FLOORS, TOWER_BLESSINGS, TOWER_DEBUFFS, QUALITY_COLORS, QUALITY_NAMES } from '../types';
import type { TowerBlessing, TowerDebuffType } from '../types';
import { Mountain, Castle, Tent, Trophy, Coins, Heart, Shield, Zap, X, Play, Home, BookOpen, Star, Trash2 } from 'lucide-react';

const RARITY_BG: Record<string, string> = {
  common: 'bg-gray-500/20 border-gray-500/50',
  rare: 'bg-blue-500/20 border-blue-500/50',
  epic: 'bg-purple-500/20 border-purple-500/50',
};

export const TowerPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    isInTower,
    currentFloor,
    playerHp,
    playerMaxHp,
    playerShield,
    gold,
    currentBlessings,
    currentFloorData,
    highestFloor,
    unlockedBlessings,
    bossKills,
    battleStatus,
    activeDebuffs,
    init,
    startRun,
    prepareBattle,
    buyBlessing,
    getShopBlessings,
    restAtCamp,
    removeDebuff,
    continueFromCamp,
    completeFloor,
    handleDefeat,
    exitTower,
    hasBlessing,
  } = useTowerStore();

  const [shopBlessings, setShopBlessings] = useState<TowerBlessing[]>([]);
  const [showBlessingCodex, setShowBlessingCodex] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (battleStatus === 'camp') {
      setShopBlessings(getShopBlessings());
    }
  }, [battleStatus, getShopBlessings]);

  const handleStartBattle = () => {
    prepareBattle();
    navigate(`/tower/battle/${currentFloor}`);
  };

  const handleFloorVictory = () => {
    completeFloor();
  };

  const handleFloorDefeat = () => {
    handleDefeat();
  };

  const handleRest = () => {
    const cost = 30;
    restAtCamp(cost);
  };

  const handleBuyBlessing = (blessing: TowerBlessing) => {
    if (buyBlessing(blessing)) {
      setShopBlessings(prev => prev.filter(b => b.type !== blessing.type));
    }
  };

  const handleRemoveDebuff = (debuffType: TowerDebuffType) => {
    const cost = 50;
    if (removeDebuff(debuffType, cost)) {
    }
  };

  const renderBlessingIcon = (type: string) => {
    const blessing = TOWER_BLESSINGS.find(b => b.type === type);
    return blessing?.icon || '✨';
  };

  const renderBlessingName = (type: string) => {
    const blessing = TOWER_BLESSINGS.find(b => b.type === type);
    return blessing?.name || type;
  };

  const renderDebuffName = (type: string) => {
    const debuff = TOWER_DEBUFFS.find(d => d.type === type);
    return debuff?.name || type;
  };

  const renderDebuffDescription = (type: string) => {
    const debuff = TOWER_DEBUFFS.find(d => d.type === type);
    return debuff?.description || type;
  };

  const getUniqueDebuffs = () => {
    const seen = new Set<string>();
    return activeDebuffs.filter(d => {
      if (seen.has(d.type)) return false;
      seen.add(d.type);
      return true;
    });
  };

  if (!isInTower) {
    return (
      <div className="min-h-screen w-full overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Mountain size={48} className="text-game-gold animate-pulse" />
              <h1 className="text-5xl font-bold text-game-gold font-display">
                大秘境
              </h1>
              <Mountain size={48} className="text-game-gold animate-pulse" />
            </div>
            <p className="text-xl text-gray-400 mb-2">
              Roguelike 爬塔模式
            </p>
            <p className="text-gray-500">
              挑战50层秘境，收集祝福，击败BOSS！
            </p>
          </div>

          <div className="game-card p-6 mb-8">
            <h2 className="text-xl font-bold text-game-gold mb-4 font-display">
              战绩统计
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-game-bg-dark rounded-lg p-4 text-center">
                <Trophy size={32} className="mx-auto mb-2 text-game-gold" />
                <div className="text-2xl font-bold text-white">{highestFloor}</div>
                <div className="text-sm text-gray-400">最高层数</div>
              </div>
              <div className="bg-game-bg-dark rounded-lg p-4 text-center">
                <Castle size={32} className="mx-auto mb-2 text-red-400" />
                <div className="text-2xl font-bold text-white">{bossKills}</div>
                <div className="text-sm text-gray-400">击杀BOSS</div>
              </div>
              <div className="bg-game-bg-dark rounded-lg p-4 text-center">
                <Star size={32} className="mx-auto mb-2 text-purple-400" />
                <div className="text-2xl font-bold text-white">{unlockedBlessings.length}</div>
                <div className="text-sm text-gray-400">解锁祝福</div>
              </div>
              <div className="bg-game-bg-dark rounded-lg p-4 text-center">
                <Coins size={32} className="mx-auto mb-2 text-yellow-400" />
                <div className="text-2xl font-bold text-white">{TOWER_BLESSINGS.length}</div>
                <div className="text-sm text-gray-400">总祝福数</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={startRun}
              className="game-button-primary text-xl py-6 flex items-center justify-center gap-3"
            >
              <Play size={28} />
              <span>开始挑战</span>
            </button>
            <button
              onClick={() => setShowBlessingCodex(true)}
              className="game-button-secondary text-xl py-6 flex items-center justify-center gap-3"
            >
              <BookOpen size={28} />
              <span>祝福图鉴</span>
            </button>
          </div>

          <div className="game-card p-6">
            <h2 className="text-xl font-bold text-game-gold mb-4 font-display">
              玩法说明
            </h2>
            <div className="space-y-3 text-gray-300">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎯</span>
                <p>共 <span className="text-game-gold font-bold">{TOWER_TOTAL_FLOORS}</span> 层，每层随机生成敌人、负面效果和祝福</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏕️</span>
                <p>每通过 <span className="text-game-gold font-bold">3</span> 层出现营地，可购买祝福或恢复生命</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">👹</span>
                <p>每 <span className="text-game-gold font-bold">10</span> 层设置精英守关BOSS，挑战难度更高</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">💀</span>
                <p>失败后需从第一层重新开始，但保留已解锁的祝福图鉴</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="mt-8 w-full game-button-secondary flex items-center justify-center gap-2"
          >
            <Home size={20} />
            <span>返回主菜单</span>
          </button>
        </div>

        {showBlessingCodex && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="game-card p-6 max-w-3xl w-full max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-game-gold font-display flex items-center gap-2">
                  <BookOpen /> 祝福图鉴
                </h2>
                <button
                  onClick={() => setShowBlessingCodex(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="grid gap-4">
                {TOWER_BLESSINGS.map(blessing => {
                  const isUnlocked = unlockedBlessings.includes(blessing.type);
                  return (
                    <div
                      key={blessing.type}
                      className={`p-4 rounded-lg border-2 flex items-center gap-4 ${
                        isUnlocked ? RARITY_BG[blessing.rarity] : 'bg-gray-800/50 border-gray-700 opacity-50'
                      }`}
                    >
                      <div className="text-4xl">
                        {isUnlocked ? blessing.icon : '❓'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white">
                            {isUnlocked ? blessing.name : '???'}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: QUALITY_COLORS[blessing.rarity] + '30',
                              color: QUALITY_COLORS[blessing.rarity],
                            }}
                          >
                            {QUALITY_NAMES[blessing.rarity as keyof typeof QUALITY_NAMES]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {isUnlocked ? blessing.description : '尚未解锁'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-game-gold">
                          <Coins size={16} />
                          <span>{blessing.cost}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (battleStatus === 'camp') {
    return (
      <div className="min-h-screen w-full overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Tent size={48} className="text-green-400" />
              <h1 className="text-4xl font-bold text-green-400 font-display">
                营地休息
              </h1>
              <Tent size={48} className="text-green-400" />
            </div>
            <p className="text-gray-400">
              第 {currentFloor} 层 · 休整一下继续前进
            </p>
          </div>

          <div className="game-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-game-gold font-display">
                当前状态
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-game-gold">
                  <Coins size={18} />
                  <span className="font-bold">{gold}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-game-bg-dark rounded-lg p-4 text-center">
                <Heart size={24} className="mx-auto mb-2 text-red-400" />
                <div className="text-lg font-bold text-white">{playerHp}/{playerMaxHp}</div>
                <div className="text-xs text-gray-400">生命值</div>
              </div>
              <div className="bg-game-bg-dark rounded-lg p-4 text-center">
                <Shield size={24} className="mx-auto mb-2 text-blue-400" />
                <div className="text-lg font-bold text-white">{playerShield}</div>
                <div className="text-xs text-gray-400">护盾</div>
              </div>
              <div className="bg-game-bg-dark rounded-lg p-4 text-center">
                <Zap size={24} className="mx-auto mb-2 text-purple-400" />
                <div className="text-lg font-bold text-white">{currentBlessings.length}</div>
                <div className="text-xs text-gray-400">祝福数</div>
              </div>
            </div>
          </div>

          <div className="game-card p-6 mb-6">
            <h2 className="text-xl font-bold text-game-gold mb-4 font-display">
              休息恢复
            </h2>
            <button
              onClick={handleRest}
              disabled={gold < 30 || playerHp >= playerMaxHp}
              className={`w-full p-4 rounded-lg border-2 flex items-center justify-between ${
                gold >= 30 && playerHp < playerMaxHp
                  ? 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30 cursor-pointer'
                  : 'bg-gray-700/30 border-gray-600 cursor-not-allowed opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">💤</span>
                <div className="text-left">
                  <div className="font-bold text-white">休息恢复</div>
                  <div className="text-sm text-gray-400">恢复 30% 最大生命值</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-game-gold">
                <Coins size={16} />
                <span>30</span>
              </div>
            </button>
          </div>

          {getUniqueDebuffs().length > 0 && (
            <div className="game-card p-6 mb-6">
              <h2 className="text-xl font-bold text-game-gold mb-4 font-display">
                净化负面效果
              </h2>
              <div className="space-y-3">
                {getUniqueDebuffs().map(debuff => {
                  const canAfford = gold >= 50;
                  return (
                    <button
                      key={debuff.type}
                      onClick={() => handleRemoveDebuff(debuff.type)}
                      disabled={!canAfford}
                      className={`w-full p-4 rounded-lg border-2 flex items-center justify-between ${
                        canAfford
                          ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30 cursor-pointer'
                          : 'bg-gray-700/30 border-gray-600 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Trash2 size={24} className="text-red-400" />
                        <div className="text-left">
                          <div className="font-bold text-white">{renderDebuffName(debuff.type)}</div>
                          <div className="text-sm text-gray-400">{renderDebuffDescription(debuff.type)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-game-gold">
                        <Coins size={16} />
                        <span>50</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="game-card p-6 mb-6">
            <h2 className="text-xl font-bold text-game-gold mb-4 font-display">
              祝福商店
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {shopBlessings.map(blessing => {
                const alreadyOwned = currentBlessings.includes(blessing.type);
                const canAfford = gold >= blessing.cost;
                return (
                  <div
                    key={blessing.type}
                    className={`p-4 rounded-lg border-2 ${RARITY_BG[blessing.rarity]} ${
                      !alreadyOwned && canAfford ? 'cursor-pointer hover:scale-105 transition-transform' : 'opacity-60'
                    }`}
                    onClick={() => !alreadyOwned && canAfford && handleBuyBlessing(blessing)}
                  >
                    <div className="text-center mb-3">
                      <span className="text-4xl">{blessing.icon}</span>
                    </div>
                    <div className="text-center mb-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: QUALITY_COLORS[blessing.rarity] + '30',
                          color: QUALITY_COLORS[blessing.rarity],
                        }}
                      >
                        {QUALITY_NAMES[blessing.rarity as keyof typeof QUALITY_NAMES]}
                      </span>
                    </div>
                    <div className="font-bold text-white text-center mb-2">
                      {blessing.name}
                    </div>
                    <p className="text-xs text-gray-400 text-center mb-3">
                      {blessing.description}
                    </p>
                    <div className="flex items-center justify-center gap-1 text-game-gold">
                      {alreadyOwned ? (
                        <span className="text-green-400">已拥有</span>
                      ) : (
                        <>
                          <Coins size={14} />
                          <span>{blessing.cost}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {currentBlessings.length > 0 && (
            <div className="game-card p-6 mb-6">
              <h2 className="text-xl font-bold text-game-gold mb-4 font-display">
                当前祝福
              </h2>
              <div className="flex flex-wrap gap-3">
                {currentBlessings.map(type => (
                  <div
                    key={type}
                    className="flex items-center gap-2 px-3 py-2 bg-game-bg-dark rounded-lg"
                  >
                    <span className="text-xl">{renderBlessingIcon(type)}</span>
                    <span className="text-white text-sm">{renderBlessingName(type)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={continueFromCamp}
            className="w-full game-button-primary text-lg py-4"
          >
            继续前进
          </button>
        </div>
      </div>
    );
  }

  if (battleStatus === 'defeat') {
    return (
      <div className="min-h-screen w-full overflow-auto p-8 flex items-center justify-center">
        <div className="game-card p-8 text-center max-w-md">
          <div className="text-6xl mb-4">💀</div>
          <h1 className="text-4xl font-bold text-red-500 mb-4 font-display">
            挑战失败
          </h1>
          <p className="text-gray-400 mb-6">
            你在第 <span className="text-game-gold font-bold">{currentFloor}</span> 层倒下了...
          </p>
          <div className="bg-game-bg-dark rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-2xl font-bold text-game-gold">{currentFloor}</div>
                <div className="text-gray-400">到达层数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-game-gold">{currentBlessings.length}</div>
                <div className="text-gray-400">获得祝福</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleDefeat}
              className="w-full game-button-primary"
            >
              重新挑战
            </button>
            <button
              onClick={exitTower}
              className="w-full game-button-secondary"
            >
              返回大秘境
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (battleStatus === 'victory') {
    return (
      <div className="min-h-screen w-full overflow-auto p-8 flex items-center justify-center">
        <div className="game-card p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl font-bold text-game-gold mb-4 font-display">
            恭喜通关！
          </h1>
          <p className="text-gray-400 mb-6">
            你成功征服了全部 {TOWER_TOTAL_FLOORS} 层大秘境！
          </p>
          <div className="bg-game-bg-dark rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-2xl font-bold text-game-gold">{gold}</div>
                <div className="text-gray-400">获得金币</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-game-gold">{currentBlessings.length}</div>
                <div className="text-gray-400">收集祝福</div>
              </div>
            </div>
          </div>
          <button
            onClick={exitTower}
            className="w-full game-button-primary"
          >
            返回大秘境
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Mountain size={48} className="text-game-gold" />
            <h1 className="text-4xl font-bold text-game-gold font-display">
              大秘境 第 {currentFloor} 层
            </h1>
            <Mountain size={48} className="text-game-gold" />
          </div>
          {currentFloorData?.isBoss && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 font-bold">
              <Castle size={20} />
              <span>BOSS 战！</span>
            </div>
          )}
        </div>

        <div className="game-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-game-gold font-display">
              玩家状态
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-game-gold">
                <Coins size={18} />
                <span className="font-bold">{gold}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-game-bg-dark rounded-lg p-4 text-center">
              <Heart size={24} className="mx-auto mb-2 text-red-400" />
              <div className="text-lg font-bold text-white">{playerHp}/{playerMaxHp}</div>
              <div className="text-xs text-gray-400">生命值</div>
            </div>
            <div className="bg-game-bg-dark rounded-lg p-4 text-center">
              <Shield size={24} className="mx-auto mb-2 text-blue-400" />
              <div className="text-lg font-bold text-white">{playerShield}</div>
              <div className="text-xs text-gray-400">护盾</div>
            </div>
            <div className="bg-game-bg-dark rounded-lg p-4 text-center">
              <Zap size={24} className="mx-auto mb-2 text-purple-400" />
              <div className="text-lg font-bold text-white">{currentBlessings.length}</div>
              <div className="text-xs text-gray-400">祝福数</div>
            </div>
          </div>
        </div>

        {currentFloorData && currentFloorData.debuffs.length > 0 && (
          <div className="game-card p-6 mb-6">
            <h2 className="text-xl font-bold text-red-400 mb-4 font-display">
              ⚠️ 本层负面效果
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {currentFloorData.debuffs.map(debuff => (
                <div
                  key={debuff.type}
                  className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3"
                >
                  <span className="text-3xl">{debuff.icon}</span>
                  <div>
                    <div className="font-bold text-red-400">{debuff.name}</div>
                    <div className="text-sm text-gray-400">{debuff.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentFloorData && currentFloorData.floorBlessings && currentFloorData.floorBlessings.length > 0 && (
          <div className="game-card p-6 mb-6">
            <h2 className="text-xl font-bold text-green-400 mb-4 font-display">
              ✨ 通关奖励祝福
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {currentFloorData.floorBlessings.map(blessing => (
                <div
                  key={blessing.type}
                  className={`p-4 rounded-lg border-2 ${RARITY_BG[blessing.rarity]} flex items-center gap-3`}
                >
                  <span className="text-3xl">{blessing.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">{blessing.name}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: QUALITY_COLORS[blessing.rarity] + '30',
                          color: QUALITY_COLORS[blessing.rarity],
                        }}
                      >
                        {QUALITY_NAMES[blessing.rarity as keyof typeof QUALITY_NAMES]}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">{blessing.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentBlessings.length > 0 && (
          <div className="game-card p-6 mb-6">
            <h2 className="text-xl font-bold text-purple-400 mb-4 font-display">
              当前激活的祝福
            </h2>
            <div className="flex flex-wrap gap-3">
              {currentBlessings.map(type => {
                const blessing = TOWER_BLESSINGS.find(b => b.type === type);
                return (
                  <div
                    key={type}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${RARITY_BG[blessing?.rarity || 'common']}`}
                  >
                    <span className="text-xl">{blessing?.icon || '✨'}</span>
                    <span className="text-white text-sm">{blessing?.name || type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleStartBattle}
            className="w-full game-button-primary text-lg py-4 flex items-center justify-center gap-2"
          >
            <Play size={24} />
            <span>开始战斗</span>
          </button>
          <button
            onClick={exitTower}
            className="w-full game-button-secondary flex items-center justify-center gap-2"
          >
            <X size={20} />
            <span>放弃挑战</span>
          </button>
        </div>
      </div>
    </div>
  );
};
