import React from 'react';
import { useBattleStore } from '../contexts/BattleContext';
import { ELEMENT_NAMES, ELEMENT_COLORS, STATUS_EFFECT_NAMES, STATUS_EFFECT_ICONS, ENEMY_BEHAVIOR_ICONS, ENEMY_AI_PRIORITY_NAMES } from '../types';
import type { ElementType, StatusEffect, Minion, Enemy } from '../types';
import { getNextAttackPreview } from '../utils/enemyAI';

interface MinionCardProps {
  minion: Minion;
  isSelected: boolean;
  onSelect: () => void;
}

const MinionCard: React.FC<MinionCardProps> = ({ minion, isSelected, onSelect }) => {
  const hpPercentage = (minion.currentHp / minion.maxHp) * 100;
  
  return (
    <div 
      className={`bg-game-bg-dark rounded-lg p-3 border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
        isSelected 
          ? 'border-purple-400 shadow-lg shadow-purple-500/30' 
          : 'border-purple-500/30 hover:border-purple-400/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{minion.sprite}</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-purple-300">{minion.name}</div>
          <div className="text-xs text-gray-400">
            攻击: {minion.attack} | 自爆: {minion.explosionDamage}
          </div>
        </div>
        {isSelected && (
          <div className="text-xs bg-purple-500 px-2 py-0.5 rounded">选中</div>
        )}
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span>生命值</span>
          <span>{minion.currentHp}/{minion.maxHp}</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-all duration-300"
            style={{ width: `${hpPercentage}%` }}
          />
        </div>
      </div>
      <div className="text-xs text-center text-orange-400 animate-pulse">
        ⏱️ {minion.turnsUntilExplosion} 回合后自爆
      </div>
    </div>
  );
};

interface MainEnemyCardProps {
  enemy: Enemy;
  isSelected: boolean;
  onSelect: () => void;
}

const MainEnemyCard: React.FC<MainEnemyCardProps> = ({ enemy, isSelected, onSelect }) => {
  const { playerHp, playerMaxHp, screenShake } = useBattleStore();
  
  const hpPercentage = (enemy.currentHp / enemy.maxHp) * 100;
  const nextAttackPreview = getNextAttackPreview(enemy, playerHp, playerMaxHp);
  const { chargeState, defenseState, isBerserk, currentBehavior } = enemy.behaviorState;
  const hpPercent = enemy.currentHp / enemy.maxHp;
  const berserkThreshold = enemy.aiConfig.berserkThreshold;
  
  const getHpColor = () => {
    if (hpPercentage > 60) return 'bg-green-500';
    if (hpPercentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getBehaviorColor = () => {
    switch (currentBehavior) {
      case 'charge': return 'text-orange-400 border-orange-400';
      case 'defend': return 'text-blue-400 border-blue-400';
      case 'summon': return 'text-purple-400 border-purple-400';
      case 'berserk': return 'text-red-500 border-red-500';
      default: return 'text-gray-400 border-gray-400';
    }
  };

  return (
    <div 
      className={`game-card p-6 ${screenShake ? 'shake' : ''} cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-game-bg' 
          : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-6">
        <div className="relative">
          <div className={`text-8xl animate-float ${isBerserk ? 'animate-pulse' : ''}`}>
            {enemy.sprite}
          </div>
          {isBerserk && (
            <div className="absolute -top-2 -right-2 text-2xl animate-bounce">🔥</div>
          )}
          {defenseState.isDefending && (
            <div className="absolute -bottom-2 -left-2 text-2xl">🛡️</div>
          )}
          {chargeState.isCharging && (
            <div className="absolute -bottom-2 -right-2 text-2xl animate-pulse">⚡</div>
          )}
          {isSelected && (
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">
              选中目标
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-bold text-game-gold font-display">
              {enemy.name}
              {isBerserk && (
                <span className="ml-2 text-red-500 text-lg">(狂暴)</span>
              )}
            </h3>
            {!useBattleStore().isPlayerTurn && useBattleStore().battleStatus === 'playing' && (
              <div className="px-3 py-1 bg-red-500 rounded-full text-sm animate-pulse">
                敌方回合
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-400 mb-4">{enemy.description}</p>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>生命值</span>
              <span className="font-bold">
                {enemy.currentHp} / {enemy.maxHp}
                {hpPercent <= berserkThreshold && (
                  <span className="ml-2 text-red-500">⚠️ 狂暴触发</span>
                )}
              </span>
            </div>
            <div className="health-bar relative">
              <div
                className={`health-bar-fill ${getHpColor()} transition-all duration-500`}
                style={{ width: `${hpPercentage}%` }}
              />
              <div
                className="absolute top-0 left-0 h-full bg-red-500/30"
                style={{ width: `${berserkThreshold * 100}%` }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-game-bg-dark rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">AI类型</div>
              <div className="text-lg font-bold text-cyan-400">
                {ENEMY_AI_PRIORITY_NAMES[enemy.aiConfig.priority]}
              </div>
            </div>
            <div className="bg-game-bg-dark rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">下次行动</div>
              <div className={`text-lg font-bold ${getBehaviorColor()}`}>
                {ENEMY_BEHAVIOR_ICONS[currentBehavior]} {nextAttackPreview}
              </div>
            </div>
          </div>

          {chargeState.isCharging && (
            <div className="mb-4 p-3 bg-orange-500/20 border border-orange-500/50 rounded-lg">
              <div className="flex items-center gap-2 text-orange-400">
                <span className="text-2xl animate-pulse">⚡</span>
                <div>
                  <div className="font-bold">正在蓄力: {chargeState.skillName}</div>
                  <div className="text-sm">
                    还需 {chargeState.chargeTurnsRemaining} 回合 | 预计伤害: <span className="text-red-400 font-bold">{chargeState.chargedDamage}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {defenseState.isDefending && (
            <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-400">
                <span className="text-2xl">🛡️</span>
                <div>
                  <div className="font-bold">防御姿态</div>
                  <div className="text-sm">
                    受到伤害降低 {Math.floor(defenseState.damageReduction * 100)}% | 攻击力降低 {Math.floor(defenseState.attackPenalty * 100)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {isBerserk && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg animate-pulse">
              <div className="flex items-center gap-2 text-red-400">
                <span className="text-2xl">🔥</span>
                <div>
                  <div className="font-bold">狂暴模式</div>
                  <div className="text-sm">
                    攻击力 x{enemy.aiConfig.berserkAttackMultiplier} | 每回合反噬 {enemy.aiConfig.berserkSelfDamagePerTurn} 点伤害
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-2">状态效果</div>
            <div className="flex flex-wrap gap-2">
              {enemy.statusEffects.map((effect: StatusEffect, index: number) => {
                const effectName = STATUS_EFFECT_NAMES[effect.type];
                const effectIcon = STATUS_EFFECT_ICONS[effect.type];
                const effectColor = effect.type === 'burn' ? '#ff6b6b' : effect.type === 'paralyze' ? '#ffd93d' : '#6bcfff';
                
                return (
                  <div
                    key={index}
                    className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
                    style={{
                      backgroundColor: `${effectColor}20`,
                      border: `1px solid ${effectColor}`,
                      color: effectColor,
                    }}
                  >
                    {effectIcon} {effectName} ({effect.duration}回合)
                  </div>
                );
              })}
              {enemy.statusEffects.length === 0 && (
                <div className="text-gray-500 text-sm">无状态效果</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-2">元素抗性</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(enemy.resistance).map(([element, value]) => {
                const el = element as ElementType;
                const color = ELEMENT_COLORS[el];
                const isWeak = value && value < 0;
                const isStrong = value && value > 0.3;
                
                return (
                  <div
                    key={element}
                    className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
                    style={{
                      backgroundColor: `${color}20`,
                      border: `1px solid ${color}`,
                      color,
                    }}
                  >
                    {ELEMENT_NAMES[el]}: {isWeak ? '弱点' : isStrong ? '抗性' : `${Math.round((value || 0) * 100)}%`}
                  </div>
                );
              })}
              {Object.keys(enemy.resistance).length === 0 && (
                <div className="text-gray-500 text-sm">无特殊抗性</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const EnemyCard: React.FC = () => {
  const { enemy, enemyUnits, selectedTargetId, selectTarget } = useBattleStore();

  if (!enemy) return null;

  const mainEnemy = enemyUnits.find(u => u.type === 'enemy') as Enemy;
  const minions = enemyUnits.filter(u => u.type === 'minion') as Minion[];

  const handleSelectUnit = (unitId: string) => {
    selectTarget(unitId);
  };

  return (
    <div className="space-y-4">
      {mainEnemy && (
        <MainEnemyCard 
          enemy={mainEnemy}
          isSelected={selectedTargetId === mainEnemy.id}
          onSelect={() => handleSelectUnit(mainEnemy.id)}
        />
      )}

      {minions.length > 0 && (
        <div>
          <div className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <span>👻</span> 敌方小怪 ({minions.length}) - 点击选择攻击目标
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {minions.map(minion => (
              <MinionCard
                key={minion.id}
                minion={minion}
                isSelected={selectedTargetId === minion.id}
                onSelect={() => handleSelectUnit(minion.id)}
              />
            ))}
          </div>
        </div>
      )}

      {enemyUnits.length > 1 && (
        <div className="text-center text-xs text-gray-400 mt-2">
          💡 提示：点击上方单位可以切换攻击目标
        </div>
      )}
    </div>
  );
};
