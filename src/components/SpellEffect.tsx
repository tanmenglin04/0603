import React from 'react';
import { useBattleStore } from '../contexts/BattleContext';
import { ELEMENT_COLORS, COMBO_ELEMENT_COLORS } from '../types';
import type { ElementType, ComboElementType } from '../types';

export const SpellEffect: React.FC = () => {
  const { spellEffect } = useBattleStore();

  if (!spellEffect) return null;

  const isCombo = spellEffect.includes('+');
  const color = isCombo
    ? COMBO_ELEMENT_COLORS[spellEffect as ComboElementType]
    : ELEMENT_COLORS[spellEffect as ElementType];

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      <div
        className="absolute inset-0 animate-ping"
        style={{
          background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0 animate-pulse"
        style={{
          background: `radial-gradient(circle, ${color}20 0%, transparent 60%)`,
        }}
      />
      
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-ping"
          style={{
            width: Math.random() * 30 + 10,
            height: Math.random() * 30 + 10,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            backgroundColor: color,
            opacity: 0.6,
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${Math.random() * 0.5 + 0.3}s`,
          }}
        />
      ))}
    </div>
  );
};
