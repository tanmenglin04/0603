import React from 'react';
import { useBattleStore } from '../contexts/BattleContext';
import { ELEMENT_COLORS } from '../types';
import type { ElementType } from '../types';

export const FloatingTexts: React.FC = () => {
  const { floatingTexts } = useBattleStore();

  const getColor = (color: string) => {
    if (color in ELEMENT_COLORS) {
      return ELEMENT_COLORS[color as ElementType];
    }
    return color;
  };

  return (
    <>
      {floatingTexts.map((text) => (
        <div
          key={text.id}
          className="floating-text text-2xl"
          style={{
            left: text.x,
            top: text.y,
            color: getColor(text.color),
          }}
        >
          {text.text}
        </div>
      ))}
    </>
  );
};
