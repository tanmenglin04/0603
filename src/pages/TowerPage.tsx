import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTowerStore } from '../store/useTowerStore';
import { TOWER_TOTAL_FLOORS, TOWER_BLESSINGS, TOWER_DEBUFFS, TOWER_THEMES, QUALITY_COLORS, QUALITY_NAMES } from '../types';
import type { TowerBlessing, TowerDebuffType, TowerNarrativeChoice, TowerBranchChoice, TowerEnding } from '../types';
import { Mountain, Castle, Tent, Trophy, Coins, Heart, Shield, Zap, X, Play, Home, BookOpen, Star, Trash2, Swords, Scroll, Sparkles } from 'lucide-react';

const RARITY_BG: Record<string, string> = {
  common: 'bg-gray-500/20 border-gray-500/50',
  rare: 'bg-blue-500/20 border-blue-500/50',
  epic: 'bg-purple-500/20 border-purple-500/50',
};

const THEME_COLORS: Record<string, string> = {
  dungeon: '#8B7355',
  jungle: '#228B22',
  abyss: '#4B0082',
  dragon_nest: '#B22222',
  void: '#1a1a2e',
};

const THEME_NAMES: Record<string, string> = {
  dungeon: '石砌地牢',
  jungle: '翠绿丛林',
  abyss: '幽暗深渊',
  dragon_nest: '烈焰龙巢',
  void: '虚空裂隙',
};

const THEME_ICONS: Record<string, string> = {
  dungeon: '🏰',
  jungle: '🌳',
  abyss: '🕳️',
  dragon_nest: '🐲',
  void: '🌌',
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
    currentTheme,
    showNarrative,
    narrativePhase,
    currentNarrativeText,
    currentNarrativeTitle,
    currentBranchChoices,
    currentNarrativeChoices,
    narrativeResultText,
    currentCampNarrative,
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
    proceedFromNarrative,
    makeBranchChoice,
    makeNarrativeChoice,
    showCampNarrative,
    currentEnding,
    branchChoices,
  } = useTowerStore();

  const [shopBlessings, setShopBlessings] = useState<TowerBlessing[]>([]);
  const [showBlessingCodex, setShowBlessingCodex] = useState(false);
  const [showCampShop, setShowCampShop] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (battleStatus === 'camp') {
      setShopBlessings(getShopBlessings());
      setShowCampShop(false);
    }
  }, [battleStatus, getShopBlessings]);

  const handleStartBattle = () => {
    prepareBattle();
    navigate(`/tower/battle/${currentFloor}`);
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
    removeDebuff(debuffType, cost);
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

  const themeColor = THEME_COLORS[currentTheme] || '#8B7355';
  const themeName = THEME_NAMES[currentTheme] || '未知';
  const themeIcon = THEME_ICONS[currentTheme] || '🏰';

  if (showNarrative && narrativePhase) {
    return (
      <div className="min-h-screen w-full overflow-auto p-8 flex items-center justify-center">
        <div className="game-card p-8 max-w-2xl w-full text-center" style={{ borderColor: themeColor + '80' }}>
          <div className="text-4xl mb-2">{themeIcon}</div>
          <h2 className="text-2xl font-bold mb-6 font-display" style={{ color: themeColor }}>
            {currentNarrativeTitle}
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-6 whitespace-pre-line">
            {currentNarrativeText}
          </p>
          
          {narrativeResultText && (
            <div className="bg-game-bg-dark rounded-lg p-4 mb-6 border border-game-gold/30">
              <p className="text-game-gold">{narrativeResultText}</p>
            </div>
          )}

          {currentNarrativeChoices.length > 0 && !narrativeResultText && (
            <div className="space-y-3 mb-6">
              {currentNarrativeChoices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => makeNarrativeChoice(choice)}
                  className="w-full p-4 rounded-lg border-2 bg-game-bg-dark border-game-gold/30 hover:border-game-gold/60 hover:bg-game-gold/10 transition-colors text-left flex items-center gap-3"
                >
                  <span className="text-2xl">{choice.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold text-white">{choice.text}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {currentBranchChoices.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-lg font-bold text-game-gold mb-3">做出你的选择</h3>
              {currentBranchChoices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => makeBranchChoice(choice)}
                  className="w-full p-4 rounded-lg border-2 bg-game-bg-dark hover:bg-game-gold/10 transition-colors text-left"
                  style={{ borderColor: themeColor + '50' }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{choice.icon}</span>
                    <span className="font-bold text-white">{choice.name}</span>
                  </div>
                  <p className="text-sm text-gray-400 ml-9">{choice.description}</p>
                </button>
              ))}
            </div>
          )}

          {(!currentNarrativeChoices.length || narrativeResultText) && !currentBranchChoices.length && (
            <button
              onClick={proceedFromNarrative}
              className="game-button-primary px-8 py-3"
            >
              {narrativePhase === 'boss_intro' ? '开始战斗' : 
               narrativePhase === 'boss_victory' ? '继续' : '继续'}
            </button>
          )}
        </div>
      </div>
    );
  }

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
              Roguelike 五段式主题爬塔
            </p>
            <p className="text-gray-500">
              地牢 → 丛林 → 深渊 → 龙巢 → 虚空，每段10层，挑战50层秘境！
            </p>
          </div>

          <div className="game-card p-6 mb-8">
            <h2 className="text-xl font-bold text-game-gold mb-4 font-display">
              五段主题
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {TOWER_THEMES.map((t, i) => (
                <div key={t.type} className="bg-game-bg-dark rounded-lg p-3 text-center border-2" style={{ borderColor: t.color + '60' }}>
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <div className="text-xs font-bold text-white">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.startFloor}-{t.endFloor}F</div>
                </div>
              ))}
            </div>
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
                <span className="text-2xl">🏰🌳🕳️🐲🌌</span>
                <p>五段主题，每段 <span className="text-game-gold font-bold">10</span> 层，敌人风格与 debuff 随主题变化</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚔️</span>
                <p>每段第 <span className="text-game-gold font-bold">5</span> 层遭遇精英敌人，第 <span className="text-game-gold font-bold">10</span> 层挑战主题BOSS</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏕️</span>
                <p>营地休息触发故事事件，你的选择将影响后续冒险走向</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">📖</span>
                <p>分支叙事系统，不同选择导向不同结局，收集全部8种结局！</p>
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
    const hasCampNarrative = currentFloorData?.campNarrative;
    
    return (
      <div className="min-h-screen w-full overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Tent size={48} style={{ color: themeColor }} />
              <h1 className="text-4xl font-bold font-display" style={{ color: themeColor }}>
                {themeIcon} {themeName} · 营地休息
              </h1>
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

          {hasCampNarrative && !showCampShop && (
            <div className="game-card p-6 mb-6" style={{ borderColor: themeColor + '40' }}>
              <div className="flex items-center gap-3 mb-4">
                <Scroll size={24} style={{ color: themeColor }} />
                <h2 className="text-xl font-bold font-display" style={{ color: themeColor }}>
                  {currentFloorData!.campNarrative!.title}
                </h2>
              </div>
              {currentFloorData!.campNarrative!.npcName && (
                <div className="flex items-center gap-2 mb-3 bg-game-bg-dark rounded-lg p-3">
                  <span className="text-2xl">{currentFloorData!.campNarrative!.npcSprite || '👤'}</span>
                  <span className="font-bold text-white">{currentFloorData!.campNarrative!.npcName}</span>
                </div>
              )}
              <p className="text-gray-300 leading-relaxed mb-6 whitespace-pre-line">
                {currentFloorData!.campNarrative!.text}
              </p>
              {currentFloorData!.campNarrative!.choices.length > 0 && (
                <div className="space-y-3 mb-4">
                  {currentFloorData!.campNarrative!.choices.map((choice) => (
                    <button
                      key={choice.id}
                      onClick={() => {
                        makeNarrativeChoice(choice);
                      }}
                      className="w-full p-4 rounded-lg border-2 bg-game-bg-dark hover:bg-game-gold/10 transition-colors text-left flex items-center gap-3"
                      style={{ borderColor: themeColor + '40' }}
                    >
                      <span className="text-2xl">{choice.icon}</span>
                      <div className="flex-1">
                        <div className="font-bold text-white">{choice.text}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {narrativeResultText && (
                <div className="bg-game-bg-dark rounded-lg p-4 mb-4 border border-game-gold/30">
                  <p className="text-game-gold">{narrativeResultText}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={handleRest}
              disabled={gold < 30 || playerHp >= playerMaxHp}
              className={`p-4 rounded-lg border-2 flex items-center justify-between ${
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
            <button
              onClick={() => setShowCampShop(!showCampShop)}
              className="p-4 rounded-lg border-2 bg-purple-500/20 border-purple-500/50 hover:bg-purple-500/30 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">🛒</span>
                <div className="text-left">
                  <div className="font-bold text-white">祝福商店</div>
                  <div className="text-sm text-gray-400">购买强力祝福</div>
                </div>
              </div>
              <Sparkles size={20} className="text-purple-400" />
            </button>
          </div>

          {showCampShop && (
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
          )}

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
    const ending: TowerEnding | null = currentEnding;
    const endingColor = ending?.color || '#FFD700';
    const endingIcon = ending?.icon || '🏆';
    
    return (
      <div className="min-h-screen w-full overflow-auto p-8 flex items-center justify-center">
        <div className="game-card p-8 text-center max-w-2xl w-full" style={{ borderColor: endingColor + '60' }}>
          <div className="text-7xl mb-4 animate-bounce">{endingIcon}</div>
          <h1 
            className="text-4xl font-bold mb-2 font-display" 
            style={{ color: endingColor }}
          >
            {ending?.name || '恭喜通关！'}
          </h1>
          <div className="text-sm text-gray-400 mb-4">结局 #{TOWER_ENDINGS.findIndex(e => e.type === ending?.type) + 1} / {TOWER_ENDINGS.length}</div>
          <p className="text-gray-300 text-lg leading-relaxed mb-8 whitespace-pre-line">
            {ending?.description || `你成功征服了全部 ${TOWER_TOTAL_FLOORS} 层大秘境，成为了传说中的英雄！`}
          </p>
          
          {branchChoices.length > 0 && (
            <div className="bg-game-bg-dark rounded-lg p-4 mb-6 border border-game-gold/20">
              <div className="text-sm text-gray-400 mb-3">你的关键选择：</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {branchChoices.map((choice, i) => {
                  const theme = TOWER_THEMES[Math.min(i, TOWER_THEMES.length - 1)];
                  return (
                    <div 
                      key={i} 
                      className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
                      style={{ 
                        backgroundColor: theme.color + '20', 
                        color: theme.color,
                        border: `1px solid ${theme.color}40`
                      }}
                    >
                      <span>{theme.icon}</span>
                      <span>{choice.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="bg-game-bg-dark rounded-lg p-6 mb-6 border border-game-gold/20">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-3xl font-bold text-game-gold mb-1">{gold}</div>
                <div className="text-gray-400">获得金币</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-400 mb-1">{currentBlessings.length}</div>
                <div className="text-gray-400">收集祝福</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-400 mb-1">{bossKills}</div>
                <div className="text-gray-400">击杀BOSS</div>
              </div>
            </div>
          </div>
          
          <button
            onClick={exitTower}
            className="w-full game-button-primary text-lg py-4"
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
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold" style={{ backgroundColor: themeColor + '20', color: themeColor, border: `1px solid ${themeColor}50` }}>
              <span>{themeIcon}</span>
              <span>{themeName}</span>
            </div>
            {currentFloorData?.isBoss && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 font-bold">
                <Castle size={20} />
                <span>BOSS 战！</span>
              </div>
            )}
            {currentFloorData?.isElite && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-400 font-bold">
                <Swords size={20} />
                <span>精英战！</span>
              </div>
            )}
          </div>
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
            <span>{currentFloorData?.isBoss ? '挑战BOSS' : currentFloorData?.isElite ? '挑战精英' : '开始战斗'}</span>
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
