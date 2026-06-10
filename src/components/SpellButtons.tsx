import React from 'react';
import { useBattleStore } from '../contexts/BattleContext';
import { SPELLS, ELEMENT_COLORS, COMBO_SPELLS, COMBO_ELEMENT_COLORS, ELEMENT_ICONS } from '../types';
import type { Spell, ComboSpell } from '../types';

export const SpellButtons: React.FC = () => {
  const { castSpell, castComboSpell, comboSpellCooldowns, canCastSpell, canCastComboSpell } = useBattleStore();

  const canCast = (spell: Spell) => canCastSpell(spell);
  const canCastCombo = (spell: ComboSpell) => canCastComboSpell(spell);

  const getButtonClassName = (spell: Spell, enabled: boolean) => {
    const baseClass = 'game-button flex flex-col items-center justify-center p-4 min-h-[120px]';
    const elementClass = `game-button-${spell.element}`;
    const disabledClass = enabled ? '' : 'opacity-50 cursor-not-allowed grayscale';
    return `${baseClass} ${elementClass} ${disabledClass}`;
  };

  const getComboButtonClassName = (spell: ComboSpell, enabled: boolean) => {
    const baseClass = 'game-button flex flex-col items-center justify-center p-4 min-h-[120px] relative';
    const disabledClass = enabled ? '' : 'opacity-50 cursor-not-allowed grayscale';
    return `${baseClass} ${disabledClass}`;
  };

  const formatCost = (spell: ComboSpell) => {
    return Object.entries(spell.cost)
      .map(([element, cost]) => `${ELEMENT_ICONS[element as keyof typeof ELEMENT_ICONS]}${cost}`)
      .join(' ');
  };

  const getComboButtonStyle = (spell: ComboSpell) => {
    const colors = spell.elements.split('+');
    const color1 = ELEMENT_COLORS[colors[0] as keyof typeof ELEMENT_COLORS];
    const color2 = ELEMENT_COLORS[colors[1] as keyof typeof ELEMENT_COLORS];
    return {
      background: `linear-gradient(135deg, ${color1}40, ${color2}40)`,
      borderColor: COMBO_ELEMENT_COLORS[spell.elements],
      borderWidth: '2px',
    };
  };

  return (
    <div className="game-card p-6">
      <h3 className="text-lg font-bold text-game-gold mb-4 text-center font-display">
        法术技能
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {SPELLS.map((spell) => {
          const enabled = canCast(spell);
          const color = ELEMENT_COLORS[spell.element];
          
          return (
            <button
              key={spell.id}
              onClick={() => enabled && castSpell(spell)}
              disabled={!enabled}
              className={getButtonClassName(spell, enabled)}
            >
              <div className="text-3xl mb-2">{spell.icon}</div>
              <div className="font-bold text-sm">{spell.name}</div>
              <div className="text-xs opacity-80 mt-1">
                消耗: {spell.cost} 能量
              </div>
              {spell.damage > 0 && (
                <div className="text-xs mt-1" style={{ color }}>
                  伤害: {spell.damage}
                </div>
              )}
              {spell.heal > 0 && (
                <div className="text-xs mt-1 text-green-400">
                  治疗: {spell.heal}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <h3 className="text-lg font-bold text-purple-400 mb-4 mt-6 text-center font-display">
        元素连携
      </h3>
      <div className="grid grid-cols-1 gap-4">
        {COMBO_SPELLS.map((spell) => {
          const enabled = canCastCombo(spell);
          const cooldown = comboSpellCooldowns[spell.id] || 0;
          
          return (
            <button
              key={spell.id}
              onClick={() => enabled && castComboSpell(spell)}
              disabled={!enabled}
              className={getComboButtonClassName(spell, enabled)}
              style={getComboButtonStyle(spell)}
            >
              {cooldown > 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                  <span className="text-2xl font-bold text-white">
                    冷却: {cooldown} 回合
                  </span>
                </div>
              )}
              <div className="text-3xl mb-2">{spell.icon}</div>
              <div className="font-bold text-sm">{spell.name}</div>
              <div className="text-xs opacity-80 mt-1">
                消耗: {formatCost(spell)}
              </div>
              <div className="text-xs mt-1 text-yellow-400">
                伤害: {spell.damage}
              </div>
              <div className="text-xs mt-1 text-purple-300">
                效果: {spell.effect === 'burn' ? '持续灼烧' : spell.effect === 'paralyze' ? '麻痹' : '降低抗性'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-gray-400 text-center">
        提示：连接消除符文获取能量，然后释放法术攻击敌人
      </div>
    </div>
  );
};
